"""Feed synthetic exobiology journal events through the real JournalWatcher."""
import json
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from elite.journal import JournalWatcher
from elite.state import AppState

events = [
    {"timestamp": "2026-07-06T01:00:00Z", "event": "Location", "StarSystem": "Testland", "StarPos": [0, 0, 0], "Docked": False},
    {"timestamp": "2026-07-06T01:01:00Z", "event": "Scan", "BodyName": "Testland 2 a", "PlanetClass": "Rocky body",
     "Atmosphere": "thin ammonia atmosphere", "SurfaceGravity": 2.65, "SurfaceTemperature": 178.4, "Landable": True},
    {"timestamp": "2026-07-06T01:02:00Z", "event": "FSSBodySignals", "BodyName": "Testland 2 a",
     "Signals": [{"Type": "$SAA_SignalType_Biological;", "Count": 3}]},
    {"timestamp": "2026-07-06T01:03:00Z", "event": "SAASignalsFound", "BodyName": "Testland 2 a",
     "Signals": [{"Type": "$SAA_SignalType_Biological;", "Count": 3}],
     "Genuses": [{"Genus": "$Codex_Ent_Stratum_Genus_Name;", "Genus_Localised": "Stratum"},
                  {"Genus": "$Codex_Ent_Bacterial_Genus_Name;", "Genus_Localised": "Bacterium"}]},
    {"timestamp": "2026-07-06T01:10:00Z", "event": "ScanOrganic", "ScanType": "Log",
     "Genus_Localised": "Stratum", "Species_Localised": "Stratum Tectonicas"},
    {"timestamp": "2026-07-06T01:12:00Z", "event": "ScanOrganic", "ScanType": "Sample",
     "Genus_Localised": "Stratum", "Species_Localised": "Stratum Tectonicas"},
    {"timestamp": "2026-07-06T01:14:00Z", "event": "ScanOrganic", "ScanType": "Sample",
     "Genus_Localised": "Stratum", "Species_Localised": "Stratum Tectonicas"},
    {"timestamp": "2026-07-06T01:14:01Z", "event": "ScanOrganic", "ScanType": "Analyse",
     "Genus_Localised": "Stratum", "Species_Localised": "Stratum Tectonicas"},
]

with tempfile.TemporaryDirectory() as td:
    (Path(td) / "Journal.2026-07-06T010000.01.log").write_text(
        "\n".join(json.dumps(e) for e in events), encoding="utf-8")
    state = AppState()
    JournalWatcher(state, journal_dir=td).bootstrap()
    snap = state.snapshot()

bio = snap["bio"]
body = bio["system_signals"][0]
assert body["body"] == "Testland 2 a" and body["count"] == 3, body
assert body["gravity_g"] == 0.27 and body["temp_k"] == 178 and body["landable"], body
genus_names = [g["name"] for g in body["genuses"]]
assert genus_names == ["Stratum", "Bacterium"], genus_names
stratum = body["genuses"][0]
assert stratum["colony_m"] == 500 and stratum["max_value"] == 19010800, stratum
assert bio["sampling"] is None, bio["sampling"]  # completed -> moved to vault
assert bio["vault"]["items"][0]["species"] == "Stratum Tectonicas"
assert bio["vault"]["total"] == 19010800, bio["vault"]

# Mid-sampling state: replay without the final two events
with tempfile.TemporaryDirectory() as td:
    (Path(td) / "Journal.2026-07-06T010000.01.log").write_text(
        "\n".join(json.dumps(e) for e in events[:-2]), encoding="utf-8")
    state2 = AppState()
    JournalWatcher(state2, journal_dir=td).bootstrap()
    samp = state2.snapshot()["bio"]["sampling"]
assert samp["progress"] == 2 and samp["species"] == "Stratum Tectonicas" and samp["colony_m"] == 500, samp

print("bio pipeline OK: signals+genus values+body details, sampling progress, vault total all correct")
