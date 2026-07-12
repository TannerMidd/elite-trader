"""Game-running detection: process probe + journal Shutdown wiring."""
import json
import sys
import tempfile
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from elite import launcher
from elite.journal import JournalWatcher
from elite.state import AppState

# Process detection is deterministic and never depends on CI/container process
# visibility. A failed operating-system probe must remain "unknown" rather
# than silently claiming that the game is stopped.
if sys.platform == "win32":
    # Native Toolhelp snapshots are the primary path; unlike tasklist, they do
    # not fail with a localized/access-denied message on otherwise normal PCs.
    with patch.object(launcher, "_windows_process_names",
                      return_value=("System", "EliteDangerous64.exe")):
        assert launcher.is_running() is True
    with patch.object(launcher, "_windows_process_names", return_value=("System",)):
        assert launcher.is_running() is False
    # If Toolhelp is genuinely unavailable, tasklist remains a compatibility
    # fallback and its own failure is "unknown", never a false offline claim.
    with patch.object(launcher, "_windows_process_names", return_value=None):
        with patch.object(launcher.subprocess, "run", return_value=SimpleNamespace(
                returncode=0, stdout="EliteDangerous64.exe  4312 Console")):
            assert launcher.is_running() is True
        with patch.object(launcher.subprocess, "run", return_value=SimpleNamespace(
                returncode=1, stdout="ERROR: Access denied")):
            assert launcher.is_running() is None
else:
    with patch.object(launcher.subprocess, "run", return_value=SimpleNamespace(returncode=0)):
        assert launcher.is_running() is True
    with patch.object(launcher.subprocess, "run", return_value=SimpleNamespace(returncode=1)):
        assert launcher.is_running() is False
    with patch.object(launcher.subprocess, "run", return_value=SimpleNamespace(returncode=2)):
        assert launcher.is_running() is None

# LaunchError is user-facing so the API can echo it verbatim.
from elite.errors import UserFacingError
assert issubclass(launcher.LaunchError, UserFacingError)

print("launcher probe OK: running/not-running detection, user-facing error type")

# Journal wiring: a live Shutdown flips game_running False; any other live
# event flips it True. (Bootstrap replay must not claim current process state.)
events = [
    {"timestamp": "2026-07-06T01:00:00Z", "event": "Location", "StarSystem": "Testland",
     "StarPos": [0, 0, 0], "Docked": False},
]
with tempfile.TemporaryDirectory() as td:
    (Path(td) / "Journal.2026-07-06T010000.01.log").write_text(
        "\n".join(json.dumps(e) for e in events), encoding="utf-8")
    state = AppState()
    w = JournalWatcher(state, journal_dir=td)
    w.bootstrap()
    assert state.game_running is None, "bootstrap replay must not claim the game is live"

    w._live = True
    w.handle_event({"timestamp": "2026-07-06T02:00:00Z", "event": "Music", "MusicTrack": "MainMenu"})
    assert state.game_running is True
    w.handle_event({"timestamp": "2026-07-06T03:00:00Z", "event": "Shutdown"})
    assert state.game_running is False

print("journal wiring OK: live events mark running, Shutdown marks stopped, bootstrap stays unknown")

# Endpoint wiring, with the real launch monkeypatched out (no game starts here).
from elite.server import create_app

state2 = AppState()
app = create_app(state2)
app.testing = True
client = app.test_client()

calls = []
launcher.is_running = lambda *a, **k: False
launcher.launch = lambda: calls.append(1) or "Steam"
resp = client.post("/api/launch-game")
assert resp.status_code == 200 and resp.get_json()["via"] == "Steam" and calls, resp.get_json()

launcher.is_running = lambda *a, **k: True
resp = client.post("/api/launch-game")
assert resp.get_json().get("already_running") is True and len(calls) == 1, resp.get_json()

def _boom():
    raise launcher.LaunchError("Couldn't find Steam - start the game manually.")
launcher.is_running = lambda *a, **k: False
launcher.launch = _boom
resp = client.post("/api/launch-game")
assert resp.status_code == 502 and "Steam" in resp.get_json()["error"], resp.get_json()

print("launch endpoint OK: launches once, skips when running, echoes player-facing errors")
