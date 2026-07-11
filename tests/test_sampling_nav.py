"""Exobio surface-sampling navigator: great-circle distance, clearance logic,
and the journal integration — Status.json position feeding a live distance
readout plus the one-shot 'clear to sample' voice callout."""
import math
import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

_tmp = tempfile.TemporaryDirectory()
os.environ["ET_DATA_DIR"] = _tmp.name

from elite import flight  # noqa: E402
from elite.journal import JournalWatcher  # noqa: E402
from elite.state import AppState  # noqa: E402

# ---------- pure logic: haversine on a sphere ----------

R_EARTH = 6_371_000
# One degree of latitude on a 6371 km sphere is ~111.19 km.
d = flight.surface_distance_m(0, 0, 1, 0, R_EARTH)
assert abs(d - 111_195) < 200, d
assert flight.surface_distance_m(10, 20, 10, 20, R_EARTH) == 0
assert flight.surface_distance_m(None, 0, 1, 0, R_EARTH) is None
assert flight.surface_distance_m(0, 0, 1, 0, None) is None
# Longitude degrees shrink with latitude: at 60°N one degree of longitude is
# half the equatorial length.
d_eq = flight.surface_distance_m(0, 0, 0, 1, R_EARTH)
d_60 = flight.surface_distance_m(60, 0, 60, 1, R_EARTH)
assert abs(d_60 - d_eq / 2) < 100, (d_eq, d_60)

# Small-planet scale: exactly 500 m of arc on a 600 km-radius moon.
R_MOON = 600_000
LAT_500M = math.degrees(500 / R_MOON)
d = flight.surface_distance_m(0, 0, LAT_500M, 0, R_MOON)
assert abs(d - 500) < 1, d

# ---------- pure logic: sample clearance ----------

pos = {"lat": 0.0, "lon": 0.0, "body": "P 1 a", "radius_m": R_MOON}
pts = [{"lat": LAT_500M, "lon": 0.0, "body": "P 1 a"}]
c = flight.sample_clearance(pts, pos, 500)
assert c["min_dist_m"] == 500 and c["clear"] is True, c
c = flight.sample_clearance(pts, pos, 800)
assert c["clear"] is False and c["dists_m"] == [500], c
# The nearest point gates the clearance when there are several.
c = flight.sample_clearance(pts + [{"lat": 0.0001, "lon": 0.0, "body": "P 1 a"}], pos, 500)
assert c["clear"] is False and c["min_dist_m"] < 500, c
# Points on another body (flew off mid-sampling) don't count.
assert flight.sample_clearance([{"lat": 0, "lon": 0, "body": "elsewhere"}], pos, 500) is None
# Unknown colony distance: distance still reported, clearance unknown.
c = flight.sample_clearance(pts, pos, None)
assert c["min_dist_m"] == 500 and c["clear"] is None, c
assert flight.sample_clearance([], pos, 500) is None
assert flight.sample_clearance(pts, None, 500) is None

print("sampling logic OK: haversine, clearance vs colony distance, off-body/None guards")

# ---------- journal integration ----------

IN_SRV = 0x04000000  # Flags bit 26: keeps _apply_status from touching ship fuel


def status(lat, lon):
    return {"Flags": IN_SRV, "Latitude": lat, "Longitude": lon,
            "BodyName": "P 1 a", "PlanetRadius": float(R_MOON),
            "Heading": 90, "Altitude": 0.0}


def organic(scan_type):
    return {"timestamp": "t", "event": "ScanOrganic", "ScanType": scan_type,
            "Genus": "$Codex_Ent_Bacterial_Genus_Name;", "Genus_Localised": "Bacterium",
            "Species": "$Codex_Ent_Bacterial_01_Name;",
            "Species_Localised": "Bacterium Aurasus", "Body": 7}


with tempfile.TemporaryDirectory() as td:
    state = AppState()
    w = JournalWatcher(state, journal_dir=td)
    w._live = True

    # On the ground; take the first sample (Log).
    w._apply_status(status(0.0, 0.0))
    w.handle_event(organic("Log"))
    samp = state.snapshot()["bio"]["sampling"]
    assert samp["progress"] == 1 and samp["colony_m"] == 500, samp
    assert samp["min_dist_m"] == 0 and samp["clear"] is False, samp
    assert state.snapshot()["alerts"] == [], "no callout while too close"

    # Drive 250 m: still too close, no callout.
    w._apply_status(status(LAT_500M / 2, 0.0))
    assert state.snapshot()["bio"]["sampling"]["clear"] is False
    assert state.snapshot()["alerts"] == []

    # Cross the colony distance (a hair past 500 m — real movement never lands
    # on the exact float boundary): one 'clear to sample' callout, exactly once.
    w._apply_status(status(LAT_500M * 1.01, 0.0))
    samp = state.snapshot()["bio"]["sampling"]
    assert samp["clear"] is True and samp["min_dist_m"] >= 500, samp
    alerts = state.snapshot()["alerts"]
    assert [a["code"] for a in alerts] == ["sample_clear"], alerts
    assert "Bacterium Aurasus" in alerts[0]["text"], alerts[0]
    w._apply_status(status(LAT_500M * 2, 0.0))  # keep driving: no repeat
    assert len(state.snapshot()["alerts"]) == 1

    # Second sample re-arms the callout and adds a reference point.
    w.handle_event(organic("Sample"))
    samp = state.snapshot()["bio"]["sampling"]
    assert samp["progress"] == 2 and samp["min_dist_m"] == 0, samp
    # Clearance is the minimum across ALL previous points: 505 m past point 2
    # is ~1500 m past point 1, so both clear.
    w._apply_status(status(LAT_500M * 3.01, 0.0))
    assert state.snapshot()["bio"]["sampling"]["clear"] is True
    assert [a["code"] for a in state.snapshot()["alerts"]] == ["sample_clear", "sample_clear"]

    # Analyse (third sample) completes the organism: card gone, points cleared.
    w.handle_event(organic("Analyse"))
    snap = state.snapshot()
    assert snap["bio"]["sampling"] is None
    assert state.bio_sample_points == []
    assert len(snap["bio"]["vault"]["items"]) == 1

    # No position at Log time (Horizons oddity): card still works, no distance.
    w._apply_status({"Flags": IN_SRV})  # lat/long gone
    w.handle_event(organic("Log"))
    samp = state.snapshot()["bio"]["sampling"]
    assert samp["progress"] == 1 and "min_dist_m" not in samp, samp
    w._apply_status(status(0.0, 0.0))  # position returns; still no false alert
    assert len(state.snapshot()["alerts"]) == 2

print("journal integration OK: live distance, one-shot clear callouts, re-arm per sample, Analyse cleanup")
print("ALL SAMPLING NAV TESTS PASSED")
