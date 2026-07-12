"""Journal transition timing model and conservative personal estimates."""

import os
import sys
import tempfile
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
_tmp = tempfile.TemporaryDirectory()
os.environ["ET_DATA_DIR"] = _tmp.name

from elite import marketdb  # noqa: E402
from elite.timings import TimingModel  # noqa: E402


commander = marketdb.ensure_commander_profile("Timing Tester")
model = TimingModel(commander)
cold = model.estimate("hyperspace_jump")
assert cold["source"] == "conservative_default" and cold["seconds"] == 105, cold

# Three real start/end transitions establish a per-commander median of 60 s.
for hour, seconds in enumerate((50, 60, 70)):
    start = f"2026-01-01T0{hour}:00:00Z"
    end = f"2026-01-01T0{hour}:0{seconds // 60}:{seconds % 60:02d}Z"
    if seconds < 60:
        end = f"2026-01-01T0{hour}:00:{seconds:02d}Z"
    model.observe_event({"timestamp": start, "event": "StartJump", "JumpType": "Hyperspace", "StarSystem": "Achenar"})
    completed = model.observe_event({"timestamp": end, "event": "FSDJump", "StarSystem": "Achenar"})
    assert completed and completed[0]["activity"] == "hyperspace_jump", completed

personal = model.estimate("hyperspace_jump")
assert personal["source"] == "personal_median" and personal["median_seconds"] == 60, personal
assert personal["seconds"] == 72 and personal["sample_count"] == 3, personal
assert model.estimate("hyperspace_jump", conservative=False)["seconds"] == 60

# Pending transitions are durable across model instances/restarts.
model.observe_event({"timestamp": "2026-01-02T00:00:00Z", "event": "DockingRequested", "StationName": "Jameson Memorial"})
reloaded = TimingModel(commander)
done = reloaded.observe_event({"timestamp": "2026-01-02T00:02:00Z", "event": "Docked", "StationName": "Jameson Memorial"})
assert any(row["activity"] == "docking" and row["duration_s"] == 120 for row in done), done

# Replayed duplicates and implausible transition gaps do not pollute learning.
assert not model.record("hyperspace_jump", 2)
assert model.record("hyperspace_jump", 60, started_at=1, ended_at=60001, source="journal")
before = model.estimate("hyperspace_jump")["sample_count"]
assert not model.record("hyperspace_jump", 60, started_at=1, ended_at=60001, source="journal")
assert model.estimate("hyperspace_jump")["sample_count"] == before

other = TimingModel(marketdb.ensure_commander_profile("Different Timing Tester"))
assert other.estimate("hyperspace_jump")["source"] == "conservative_default"
snapshot = reloaded.snapshot()
assert any(row["activity"] == "station_turnaround" for row in snapshot["pending"]), snapshot

print("timings OK: conservative defaults, durable transitions, personal medians, isolation")
