"""Live FSD jump signal for the flight panel's jump-sequence overlay.

StartJump (Hyperspace, live tailing only) publishes a `jump` block in the
state snapshot; FSDJump or Shutdown clears it; a jump that never resolves
expires instead of triggering the overlay forever.
"""
import sys
import tempfile
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from elite.journal import JournalWatcher
from elite.state import AppState

START = {
    "timestamp": "2026-07-18T20:00:00Z", "event": "StartJump",
    "JumpType": "Hyperspace", "StarSystem": "Maia", "SystemAddress": 1,
    "StarClass": "B",
}

with tempfile.TemporaryDirectory() as td:
    # Bootstrap replay must not publish a jump: the overlay would fire at startup.
    state = AppState()
    w = JournalWatcher(state, journal_dir=td)
    w._live = False
    w.handle_event(dict(START))
    assert state.snapshot()["jump"] is None, "replayed StartJump must stay private"

    # Live hyperspace StartJump publishes destination, class, and scoopability.
    w._live = True
    w.handle_event(dict(START))
    jump = state.snapshot()["jump"]
    assert jump and jump["system"] == "Maia" and jump["star_class"] == "B", jump
    assert jump["scoopable"] is True and jump["taxi"] is False, jump
    assert 0 <= jump["elapsed_s"] < 5, jump
    assert jump["started_ms"] > 0, jump

    # The supercruise variant has no tunnel and must not disturb a live jump.
    w.handle_event({"timestamp": "t", "event": "StartJump", "JumpType": "Supercruise"})
    assert state.snapshot()["jump"]["system"] == "Maia"

    # Arrival clears the signal in the same update that moves the commander.
    w.handle_event({"timestamp": "t", "event": "FSDJump", "StarSystem": "Maia",
                    "SystemAddress": 1, "StarPos": [0, 0, 0], "JumpDist": 34.2,
                    "FuelUsed": 3.1, "FuelLevel": 12.0})
    snap = state.snapshot()
    assert snap["jump"] is None and snap["system"] == "Maia", snap["jump"]
    assert snap["jump_history"][0]["system"] == "Maia"

    # Non-scoopable class + Taxi flag survive the trip into the snapshot.
    w.handle_event(dict(START, StarSystem="Jackson's Lighthouse", StarClass="N",
                        Taxi=True))
    jump = state.snapshot()["jump"]
    assert jump["scoopable"] is False and jump["taxi"] is True, jump

    # Shutdown mid-jump (alt-F4 during the countdown) clears the signal.
    w.handle_event({"timestamp": "2026-07-18T20:05:00Z", "event": "Shutdown"})
    assert state.snapshot()["jump"] is None

    # A StartJump whose FSDJump never lands expires rather than lingering.
    w.handle_event(dict(START))
    state.update(jump=dict(state.jump, started_ms=int(
        (time.time() - AppState.JUMP_EXPIRY_S - 1) * 1000)))
    assert state.snapshot()["jump"] is None, "stale jump must expire"

print("jump state OK: live-only publish, clear on arrival/shutdown, stale expiry")
