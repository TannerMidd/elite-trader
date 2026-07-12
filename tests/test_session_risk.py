"""Session freeze at shutdown, collected-value counter, data-at-risk ladder."""
import json
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from elite import marketdb
from elite.journal import JournalWatcher
from elite.state import AppState

# --- Session clock freezes at Shutdown (via bootstrap replay) ---
events = [
    {"timestamp": "2026-07-06T01:00:00Z", "event": "LoadGame", "Commander": "Test", "Credits": 1000000},
    {"timestamp": "2026-07-06T01:01:00Z", "event": "Location", "StarSystem": "Testland",
     "StarPos": [0, 0, 0], "Docked": False},
    {"timestamp": "2026-07-06T03:00:00Z", "event": "Shutdown"},
]
with tempfile.TemporaryDirectory() as td:
    (Path(td) / "Journal.2026-07-06T010000.01.log").write_text(
        "\n".join(json.dumps(e) for e in events), encoding="utf-8")
    state = AppState()
    JournalWatcher(state, journal_dir=td).bootstrap()
    sess = state.snapshot()["session"]

assert sess["end_ts"] == marketdb.parse_update_time("2026-07-06T03:00:00Z"), sess
assert sess["end_ts"] - sess["start_ts"] == 2 * 3600, sess  # frozen at 2h, not wall time
assert state.game_running is None  # historical Shutdown is not current process truth

print("session freeze OK: Shutdown pins end_ts, duration is play time not wall time")

# --- Collected value + data-at-risk ladder (live events) ---
state2 = AppState()
with tempfile.TemporaryDirectory() as td:
    w = JournalWatcher(state2, journal_dir=td)
w._live = True
w.handle_event({"timestamp": "2026-07-06T01:00:00Z", "event": "LoadGame", "Commander": "T", "Credits": 5000000})
state2.update(rebuy=1_000_000)

# An undiscovered terraformable HMC: base 163,000, first-discovery x2.6
w.handle_event({"timestamp": "2026-07-06T01:01:00Z", "event": "Scan", "BodyName": "Risk 1", "BodyID": 3,
                "PlanetClass": "High metal content body", "TerraformState": "Terraformable",
                "WasDiscovered": False, "Landable": True, "SurfaceGravity": 2.0, "SurfaceTemperature": 300})
expected_scan = round(163000 * 2.6)
assert state2.session_collected_cr == expected_scan, state2.session_collected_cr
# Re-scanning the same body must not double-count.
w.handle_event({"timestamp": "2026-07-06T01:02:00Z", "event": "Scan", "BodyName": "Risk 1", "BodyID": 3,
                "PlanetClass": "High metal content body", "TerraformState": "Terraformable",
                "WasDiscovered": False, "Landable": True, "SurfaceGravity": 2.0, "SurfaceTemperature": 300})
assert state2.session_collected_cr == expected_scan, "re-scan double-counted"

# Complete a first-log Stratum (19,010,800 x5 = 95M): collected jumps, and at
# 95x a 1M rebuy the risk ladder should fire a critical callout.
for st in ("Log", "Sample", "Sample", "Analyse"):
    w.handle_event({"timestamp": "2026-07-06T01:10:00Z", "event": "ScanOrganic", "ScanType": st,
                    "Body": 3, "Genus_Localised": "Stratum", "Species_Localised": "Stratum Tectonicas"})
assert state2.session_collected_cr == expected_scan + 19010800 * 5, state2.session_collected_cr

risk_alerts = [a for a in state2.alerts if a["code"] == "data_risk"]
assert len(risk_alerts) == 1 and risk_alerts[0]["level"] == "critical", risk_alerts
assert "95" in risk_alerts[0]["say"], risk_alerts[0]["say"]  # ~95M / ~95x mentioned

# Selling re-arms the ladder; the next big find alerts again.
w.handle_event({"timestamp": "2026-07-06T02:00:00Z", "event": "SellOrganicData",
                "BioData": [{"Value": 19010800, "Bonus": 76043200}]})
assert w._risk_level == 0
for st in ("Log", "Sample", "Sample", "Analyse"):
    w.handle_event({"timestamp": "2026-07-06T02:10:00Z", "event": "ScanOrganic", "ScanType": st,
                    "Body": 3, "Genus_Localised": "Stratum", "Species_Localised": "Stratum Tectonicas"})
risk_alerts = [a for a in state2.alerts if a["code"] == "data_risk"]
assert len(risk_alerts) == 2, risk_alerts

# Below the 20M floor nothing fires, however tiny the rebuy.
state3 = AppState()
with tempfile.TemporaryDirectory() as td:
    w3 = JournalWatcher(state3, journal_dir=td)
w3._live = True
state3.update(rebuy=5000)
w3.handle_event({"timestamp": "2026-07-06T01:01:00Z", "event": "Scan", "BodyName": "Tiny 1", "BodyID": 1,
                 "PlanetClass": "High metal content body", "WasDiscovered": False,
                 "Landable": True, "SurfaceGravity": 2.0, "SurfaceTemperature": 300})
assert not [a for a in state3.alerts if a["code"] == "data_risk"], "floor ignored"

print("collected + data-at-risk OK: per-body once, first multipliers, ladder fires/re-arms, floor holds")
