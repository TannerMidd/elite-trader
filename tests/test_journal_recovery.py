"""Journal background failures remain visible and retryable."""

import json
import os
import sys
import tempfile
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
_tmp = tempfile.TemporaryDirectory()
os.environ["ET_DATA_DIR"] = _tmp.name

from elite import marketdb  # noqa: E402
from elite.journal import JournalWatcher  # noqa: E402
from elite.state import AppState  # noqa: E402


root = Path(_tmp.name)


def write(name, events):
    (root / name).write_text(
        "\n".join(json.dumps(event, separators=(",", ":")) for event in events) + "\n",
        encoding="utf-8",
    )


completed = "Journal.2026-07-11T120000.01.log"
write(completed, [
    {"timestamp": "2026-07-11T12:00:00Z", "event": "Fileheader", "gameversion": "4.1"},
    {"timestamp": "2026-07-11T12:00:01Z", "event": "Commander", "Name": "Alpha"},
    {"timestamp": "2026-07-11T12:00:02Z", "event": "MissionCompleted",
     "Name": "Mission_Test", "Reward": 12345},
])
write("Journal.2026-07-12T120000.01.log", [
    {"timestamp": "2026-07-12T12:00:00Z", "event": "Fileheader", "gameversion": "4.1"},
    {"timestamp": "2026-07-12T12:00:01Z", "event": "Commander", "Name": "Alpha"},
])

watcher = JournalWatcher(AppState(), journal_dir=root)
original = watcher._import_event


def fail_once(event, commander_id):
    raise OSError("simulated transient database failure")


watcher._import_event = fail_once
watcher.import_trade_history()
alpha = marketdb.commander_profile_id("Alpha")
conn = marketdb.connect_user()
assert not conn.execute(
    "SELECT 1 FROM imported_journals WHERE commander_id=? AND filename=?",
    (alpha, completed),
).fetchone(), "a partial reducer run was incorrectly marked complete"
conn.close()

watcher._import_event = original
from elite.timings import TimingModel  # noqa: E402

original_observe = TimingModel.observe_event
TimingModel.observe_event = lambda self, event: (_ for _ in ()).throw(
    OSError("simulated timing reducer failure"))
try:
    watcher.import_trade_history()
finally:
    TimingModel.observe_event = original_observe
conn = marketdb.connect_user()
assert not conn.execute(
    "SELECT 1 FROM imported_journals WHERE commander_id=? AND filename=?",
    (alpha, completed),
).fetchone(), "a timing failure was incorrectly checkpointed"
conn.close()

watcher.import_trade_history()
conn = marketdb.connect_user()
assert conn.execute(
    "SELECT 1 FROM imported_journals WHERE commander_id=? AND filename=?",
    (alpha, completed),
).fetchone(), "successful retry did not checkpoint the journal"
assert conn.execute(
    "SELECT amount FROM income_log WHERE commander_id=? AND category='mission'",
    (alpha,),
).fetchone()[0] == 12345
conn.close()

# Startup/poll failures are reported and do not disappear into bare `pass`
# handlers. Let the chronological import fail once and retry, then stop after
# the first live-poll wait.
contexts = []
recovery_state = AppState()
watcher = JournalWatcher(recovery_state, journal_dir=root)
watcher.bootstrap = lambda: (_ for _ in ()).throw(RuntimeError("bootstrap"))
watcher._probe_game = lambda: (_ for _ in ()).throw(RuntimeError("probe"))
history_calls = {"count": 0}


def fail_history_once():
    history_calls["count"] += 1
    if history_calls["count"] == 1:
        raise RuntimeError("history")
    return True


watcher.import_trade_history = fail_history_once
watcher._ensure_journal_dir = lambda: (_ for _ in ()).throw(RuntimeError("poll"))
watcher._log_background_failure = lambda context, exc: contexts.append((context, type(exc).__name__))

original_wait = watcher._stop_event.wait
wait_calls = {"count": 0}


def stop_after_retry(_seconds):
    wait_calls["count"] += 1
    if wait_calls["count"] == 1:
        return False
    raise StopIteration()


watcher._stop_event.wait = stop_after_retry
try:
    try:
        watcher.run_forever()
    except StopIteration:
        pass
finally:
    watcher._stop_event.wait = original_wait

assert [context for context, _kind in contexts] == [
    "initial game process probe", "journal history import", "journal bootstrap",
]
assert history_calls["count"] == 2
assert recovery_state.snapshot()["journal_rebuild"]["phase"] == "error"
assert recovery_state.snapshot()["journal_rebuild"]["active"] is False
assert not watcher._live

# Transient journal/SQLite bootstrap failures retry even after the one-time
# derived migration marker is already complete. Live polling starts only after
# a coherent staged state has been published.
transient_state = AppState()
transient_state.update(system="Last coherent")
transient = JournalWatcher(transient_state, journal_dir=root)
transient._probe_game = lambda: None
transient.import_trade_history = lambda: True
transient._finalize_derived_history_replay = lambda: True
transient._derived_history_replay_pending = lambda: False
transient_calls = {"count": 0}


def transient_bootstrap():
    transient_calls["count"] += 1
    if transient_calls["count"] == 1:
        raise OSError("simulated temporary journal lock")
    staged = AppState()
    staged.update(system="Published after retry")
    transient._staged_bootstrap_state = staged
    return True


transient.bootstrap = transient_bootstrap
transient._stop_event.wait = lambda _seconds: False
transient._fetch_community_bio = lambda *_args: transient._stop_event.set()
transient.run_forever()
assert transient_calls["count"] == 2
assert transient_state.snapshot()["system"] == "Published after retry"
assert transient_state.snapshot()["journal_rebuild"]["phase"] == "complete"
assert transient._live

# A configured journal folder that does not exist at startup remains
# recoverable. Creating it while the watcher is running triggers a coherent
# bootstrap without restarting the application.
late_root = root / "appears-later"
late_state = AppState()
late = JournalWatcher(late_state, journal_dir=late_root)
late._probe_game = lambda: None


def late_import():
    if late_root.is_dir():
        progress = late_state.snapshot()
        assert progress["journal_dir_found"] is True
        assert progress["journal_rebuild"]["active"] is True
    return True


late.import_trade_history = late_import
late._finalize_derived_history_replay = lambda: True
late._derived_history_replay_pending = lambda: False
late_created = {"done": False}


def create_late_journal(_seconds):
    if not late_created["done"]:
        late_created["done"] = True
        late_root.mkdir()
        (late_root / "Journal.2026-07-12T130000.01.log").write_text(
            "\n".join(json.dumps(event, separators=(",", ":")) for event in (
                {"timestamp": "2026-07-12T13:00:00Z", "event": "Fileheader",
                 "gameversion": "4.1"},
                {"timestamp": "2026-07-12T13:00:01Z", "event": "Commander",
                 "Name": "Recovered"},
                {"timestamp": "2026-07-12T13:00:02Z", "event": "Location",
                 "StarSystem": "Recovered System"},
            )) + "\n", encoding="utf-8")
    return False


late._stop_event.wait = create_late_journal
late._fetch_community_bio = lambda *_args: (
    late._stop_event.set() if late_state.system == "Recovered System" else None
)
late.run_forever()
assert late_created["done"]
assert late_state.snapshot()["system"] == "Recovered System"
assert late_state.snapshot()["journal_rebuild"]["phase"] == "complete"
assert late._live

# If the directory appears in the narrow interval after the recovery check,
# public tailing remains gated. The following loop performs the normal staged
# reconstruction instead of exposing that journal line by line.
race_root = root / "race-appears"
race_state = AppState()
race_state.update(system="Race coherent")
race = JournalWatcher(race_state, journal_dir=race_root)
race._probe_game = lambda: None
race._finalize_derived_history_replay = lambda: True
race._derived_history_replay_pending = lambda: False


def race_import():
    if race_root.is_dir():
        visible = race_state.snapshot()
        assert visible["system"] == "Race coherent"
        assert visible["journal_dir_found"] is True
        assert visible["journal_rebuild"]["active"] is True
    return True


race.import_trade_history = race_import
original_race_ensure = race._ensure_journal_dir
race_ensure_calls = {"count": 0}


def ensure_then_create():
    race_ensure_calls["count"] += 1
    original_race_ensure()
    if race_ensure_calls["count"] == 1:
        race_root.mkdir()
        (race_root / "Journal.2026-07-12T140000.01.log").write_text(
            "\n".join(json.dumps(event, separators=(",", ":")) for event in (
                {"timestamp": "2026-07-12T14:00:00Z", "event": "Fileheader",
                 "gameversion": "4.1"},
                {"timestamp": "2026-07-12T14:00:01Z", "event": "Commander",
                 "Name": "Race Recovered"},
                {"timestamp": "2026-07-12T14:00:02Z", "event": "Location",
                 "StarSystem": "Race Recovered System"},
            )) + "\n", encoding="utf-8")


race._ensure_journal_dir = ensure_then_create
race._stop_event.wait = lambda _seconds: False
race._fetch_community_bio = lambda *_args: (
    race._stop_event.set() if race_state.system == "Race Recovered System" else None
)
race.run_forever()
assert race_ensure_calls["count"] == 2
assert race_state.snapshot()["system"] == "Race Recovered System"
assert race._live

print("journal recovery OK: failed reducers retry and watcher failures are diagnosed")
