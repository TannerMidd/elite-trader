"""Journal reconstruction is visible, bounded, and atomically published."""

import json
import os
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
_tmp = tempfile.TemporaryDirectory()
os.environ["ET_DATA_DIR"] = _tmp.name

from elite.journal import JournalWatcher  # noqa: E402
from elite.state import AppState  # noqa: E402


journal_root = Path(_tmp.name) / "journals"
journal_root.mkdir()


def write_journal(index):
    path = journal_root / f"Journal.2026-07-{index:02d}T120000.01.log"
    events = [
        {"timestamp": f"2026-07-{index:02d}T12:00:00Z", "event": "Fileheader",
         "gameversion": "4.1"},
        {"timestamp": f"2026-07-{index:02d}T12:00:01Z", "event": "Commander",
         "Name": "Progress Test"},
        {"timestamp": f"2026-07-{index:02d}T12:00:02Z", "event": "Location",
         "StarSystem": f"System {index}", "StarPos": [index, 0, 0], "Docked": False},
    ]
    path.write_text(
        "\n".join(json.dumps(event, separators=(",", ":")) for event in events) + "\n",
        encoding="utf-8",
    )
    return path


paths = [write_journal(index) for index in (1, 2, 3)]
state = AppState()
state.update(game_running=True, system="Published system", commander="Published commander")
watcher = JournalWatcher(state, journal_dir=journal_root)

updates = []
original_progress = state.set_journal_rebuild


def record_progress(**fields):
    result = original_progress(**fields)
    updates.append(dict(result))
    return result


state.set_journal_rebuild = record_progress
watcher._begin_rebuild()
assert watcher.import_trade_history()

history = [item for item in updates if item["phase"] == "history"]
assert history and history[-1]["completed"] == 2 and history[-1]["total"] == 2
assert all(item["completed"] <= item["total"] for item in history if item["total"])
assert {item["current"] for item in history if item["current"]} <= {
    paths[0].name, paths[1].name,
}
assert all("\\" not in item["current"] and "/" not in item["current"]
           for item in history if item["current"]), "absolute journal path leaked"

# Observe the shared state after each staged recent-file replay. It must remain
# the last coherent public cockpit until all selected journals are complete.
visible_during_replay = []
original_process = watcher._process_lines
appended_during_replay = {"done": False}


def observe_public_state(*args, **kwargs):
    result = original_process(*args, **kwargs)
    visible_during_replay.append((state.system, state.commander))
    if (kwargs.get("source_file") == paths[-1].name
            and not appended_during_replay["done"]):
        appended_during_replay["done"] = True
        with paths[-1].open("a", encoding="utf-8") as handle:
            handle.write(json.dumps({
                "timestamp": "2026-07-03T12:01:00Z", "event": "Location",
                "StarSystem": "System 4", "StarPos": [4, 0, 0], "Docked": False,
            }, separators=(",", ":")) + "\n")
    return result


watcher._process_lines = observe_public_state
assert watcher.bootstrap()
assert visible_during_replay
assert set(visible_during_replay) == {("Published system", "Published commander")}
snapshot = state.snapshot()
assert snapshot["system"] == "Published system", "staged cockpit published before finalization"
assert watcher._publish_staged_bootstrap()
snapshot = state.snapshot()
assert snapshot["system"] == "System 3" and snapshot["commander"] == "Progress Test"
assert snapshot["game_running"] is True
assert snapshot["journal_rebuild"]["active"] is True

# A line appended after the bootstrap read must remain ahead of the retained
# tail offset and be consumed exactly once when live polling begins.
watcher._read_new_bytes()
assert state.snapshot()["system"] == "System 4"

# API snapshots get an independent progress dict, and retries increment without
# discarding the last honest phase/count.
copied = snapshot["journal_rebuild"]
copied["phase"] = "tampered"
assert state.snapshot()["journal_rebuild"]["phase"] == "bootstrap"
watcher._mark_rebuild_retry()
retry = state.snapshot()["journal_rebuild"]
assert retry["retrying"] is True and retry["attempt"] == 1
assert retry["completed"] == retry["total"] == 3
watcher._finish_rebuild()
assert state.snapshot()["journal_rebuild"]["active"] is False

# A temporarily unreadable newest journal is an ordering barrier: the last
# coherent public cockpit remains intact and the caller can retry safely.
blocked_state = AppState()
blocked_state.update(system="Still coherent", commander="Progress Test")
blocked = JournalWatcher(blocked_state, journal_dir=journal_root)
original_read_text = Path.read_text


def fail_latest(path, *args, **kwargs):
    if path == paths[-1]:
        raise OSError("simulated journal lock")
    return original_read_text(path, *args, **kwargs)


Path.read_text = fail_latest
try:
    try:
        blocked.bootstrap()
        raise AssertionError("unreadable newest journal was treated as complete")
    except OSError:
        pass
finally:
    Path.read_text = original_read_text
assert blocked_state.snapshot()["system"] == "Still coherent"

# A valid empty journal directory is the coherent first-run state, not a
# terminal migration failure. It can be published and begin live polling.
empty_root = Path(_tmp.name) / "empty-journals"
empty_root.mkdir()
empty_state = AppState()
empty_state.update(system="Old folder")
empty = JournalWatcher(empty_state, journal_dir=empty_root)
empty._begin_rebuild()
assert empty.bootstrap()
assert empty._publish_staged_bootstrap()
assert empty_state.snapshot()["system"] is None
empty._finish_rebuild()
empty._live = True
first_path = empty_root / "Journal.2026-07-12T120000.01.log"
first_path.write_text("\n".join(json.dumps(event, separators=(",", ":")) for event in (
    {"timestamp": "2026-07-12T12:00:00Z", "event": "Fileheader", "gameversion": "4.1"},
    {"timestamp": "2026-07-12T12:00:01Z", "event": "Commander", "Name": "First Run"},
    {"timestamp": "2026-07-12T12:00:02Z", "event": "Location", "StarSystem": "Starter System"},
)) + "\n", encoding="utf-8")
empty._poll_journal()
assert empty_state.snapshot()["system"] == "Starter System"
assert empty_state.snapshot()["journal_rebuild"]["phase"] == "complete"

# Cancellation during recent-file replay cannot leak a partial staged cockpit.
cancel_state = AppState()
cancel_state.update(system="Published before shutdown")
cancel = JournalWatcher(cancel_state, journal_dir=journal_root)
cancel._begin_rebuild()
original_cancel_process = cancel._process_lines


def cancel_after_first(*args, **kwargs):
    result = original_cancel_process(*args, **kwargs)
    cancel._stop_event.set()
    return result


cancel._process_lines = cancel_after_first
try:
    cancel.bootstrap()
    raise AssertionError("cancelled bootstrap was staged as complete")
except InterruptedError:
    pass
assert cancel._staged_bootstrap_state is None
assert cancel_state.snapshot()["system"] == "Published before shutdown"

print("journal rebuild UX OK: bounded progress, retry state, atomic cockpit publication")
