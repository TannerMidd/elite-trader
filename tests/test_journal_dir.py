"""Journal-folder resolution and recovery: the in-app setting wins over the
env var, auto-detection falls back sanely, and the watcher recovers without a
restart when the folder appears or the setting changes."""
import json
import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from elite import settings
from elite.journal import JournalWatcher, find_journal_dir
from elite.state import AppState

# Keep the user's real settings.json out of this test.
_tmp_settings = tempfile.NamedTemporaryFile(suffix=".json", delete=False)
_tmp_settings.close()
settings.SETTINGS_PATH = Path(_tmp_settings.name)
settings._cache = None

EVENT = {"timestamp": "2026-07-09T00:00:00Z", "event": "Location",
         "StarSystem": "Testland", "StarPos": [0, 0, 0], "Docked": False}


def write_journal(d):
    (Path(d) / "Journal.2026-07-09T000000.01.log").write_text(
        json.dumps(EVENT) + "\n", encoding="utf-8")


with tempfile.TemporaryDirectory() as base:
    dir_a, dir_b = Path(base) / "a", Path(base) / "b"

    # ---------- precedence: setting > env var > auto-detect ----------
    os.environ["ED_JOURNAL_DIR"] = str(dir_b)
    settings.update({"journal_dir": str(dir_a)})
    assert find_journal_dir() == dir_a, "in-app setting must win over the env var"
    settings.update({"journal_dir": ""})
    assert find_journal_dir() == dir_b, "env var must win over auto-detection"
    del os.environ["ED_JOURNAL_DIR"]
    auto = find_journal_dir()
    assert auto.name == "Elite Dangerous", auto  # some real auto-detected path
    print("precedence OK: setting > env > auto")

    # ---------- recovery: folder appears after startup ----------
    settings.update({"journal_dir": str(dir_a)})  # doesn't exist yet
    state = AppState()
    w = JournalWatcher(state)
    assert w.journal_dir == dir_a
    w.bootstrap()
    assert state.journal_dir_found is False

    dir_a.mkdir()          # "the game's first launch created the folder"
    write_journal(dir_a)
    w._ensure_journal_dir()
    assert state.journal_dir_found is True, "must recover when the folder appears"
    assert state.snapshot()["system"] == "Testland", "recovery must run the full bootstrap"
    print("recovery OK: folder appearing after startup is picked up")

    # ---------- recovery: setting changed at runtime ----------
    dir_b.mkdir()
    (Path(dir_b) / "Journal.2026-07-09T010000.01.log").write_text(
        json.dumps({**EVENT, "StarSystem": "Otherland"}) + "\n", encoding="utf-8")
    settings.update({"journal_dir": str(dir_b)})
    w._ensure_journal_dir()
    assert w.journal_dir == dir_b
    assert state.snapshot()["system"] == "Otherland", "watcher must follow a changed setting"
    print("recovery OK: runtime setting change re-bootstraps")

    # ---------- bad manual path -> flagged, then recovers when fixed ----------
    settings.update({"journal_dir": str(Path(base) / "nope")})
    w._ensure_journal_dir()
    assert state.journal_dir_found is False, "a bad manual path must be flagged"
    settings.update({"journal_dir": str(dir_b)})
    w._ensure_journal_dir()
    assert state.journal_dir_found is True
    print("recovery OK: bad manual path flagged and recoverable")

    # ---------- explicit ctor dir never re-detects (test isolation) ----------
    w2 = JournalWatcher(AppState(), journal_dir=str(dir_a))
    settings.update({"journal_dir": str(dir_b)})
    w2._ensure_journal_dir()
    assert w2.journal_dir == Path(dir_a), "explicit ctor dir must stay fixed"
    settings.update({"journal_dir": ""})
    print("fixed-dir OK: explicit ctor dir ignores settings")

os.unlink(_tmp_settings.name)
print("ALL JOURNAL-DIR TESTS PASSED")
