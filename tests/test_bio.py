"""Feed synthetic exobiology journal events through the real JournalWatcher."""
import json
import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

_tmp = tempfile.TemporaryDirectory()
os.environ["ET_DATA_DIR"] = _tmp.name

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

# Exploration tracker + genus prediction
explo_events = [
    {"timestamp": "2026-07-06T02:00:00Z", "event": "Location", "StarSystem": "Testland", "StarPos": [0, 0, 0], "Docked": False},
    {"timestamp": "2026-07-06T02:01:00Z", "event": "Scan", "BodyName": "Testland 3", "PlanetClass": "High metal content body",
     "TerraformState": "Terraformable", "WasDiscovered": False, "SurfaceGravity": 4.0, "SurfaceTemperature": 300},
    {"timestamp": "2026-07-06T02:02:00Z", "event": "SAAScanComplete", "BodyName": "Testland 3"},
    {"timestamp": "2026-07-06T02:03:00Z", "event": "Scan", "BodyName": "Testland 4 b", "PlanetClass": "Rocky body",
     "Atmosphere": "thin carbon dioxide atmosphere", "SurfaceGravity": 1.96, "SurfaceTemperature": 180.0,
     "Landable": True, "WasDiscovered": True},
    {"timestamp": "2026-07-06T02:04:00Z", "event": "FSSBodySignals", "BodyName": "Testland 4 b",
     "Signals": [{"Type": "$SAA_SignalType_Biological;", "Count": 5}]},
]
with tempfile.TemporaryDirectory() as td:
    (Path(td) / "Journal.2026-07-06T020000.01.log").write_text(
        "\n".join(json.dumps(e) for e in explo_events), encoding="utf-8")
    state3 = AppState()
    JournalWatcher(state3, journal_dir=td).bootstrap()
    snap3 = state3.snapshot()

ex = snap3["exploration"]
assert ex["count"] == 2 and ex["mapped"] == 1 and ex["firsts"] == 1, ex
top = ex["top"][0]
assert top["body"] == "Testland 3" and top["value"] == int(163000 * 2.6 * 3.3), top

bio_body = snap3["bio"]["system_signals"][0]
predicted = [g["name"] for g in bio_body.get("predicted", [])]
assert "Bacterium" in predicted and "Cactoida" in predicted and "Tussock" in predicted, predicted
assert "Fonticulua" not in predicted and "Fumerola" not in predicted, predicted

print("exploration tracker + genus prediction OK")

# First-logged (5x) estimate: undiscovered body -> first; discovered -> not.
# ScanOrganic names the body by ID; the Scan event maps ID -> name.
first_events = [
    {"timestamp": "2026-07-06T03:00:00Z", "event": "Location", "StarSystem": "Testland",
     "SystemAddress": 999, "StarPos": [0, 0, 0], "Docked": False},
    {"timestamp": "2026-07-06T03:01:00Z", "event": "Scan", "BodyName": "Testland 5 c", "BodyID": 12,
     "PlanetClass": "Rocky body", "Atmosphere": "thin ammonia atmosphere", "SurfaceGravity": 2.65,
     "SurfaceTemperature": 178.4, "Landable": True, "WasDiscovered": False},
    {"timestamp": "2026-07-06T03:02:00Z", "event": "FSSBodySignals", "BodyName": "Testland 5 c",
     "Signals": [{"Type": "$SAA_SignalType_Biological;", "Count": 1}]},
    {"timestamp": "2026-07-06T03:03:00Z", "event": "Scan", "BodyName": "Testland 6 a", "BodyID": 17,
     "PlanetClass": "Rocky body", "Atmosphere": "thin ammonia atmosphere", "SurfaceGravity": 2.65,
     "SurfaceTemperature": 178.4, "Landable": True, "WasDiscovered": True},
    # Complete one species on each body (Log + 2 Samples + Analyse)
    *[
        {"timestamp": f"2026-07-06T03:1{i}:00Z", "event": "ScanOrganic", "ScanType": st, "Body": 12,
         "Genus_Localised": "Stratum", "Species_Localised": "Stratum Tectonicas"}
        for i, st in enumerate(("Log", "Sample", "Sample", "Analyse"))
    ],
    *[
        {"timestamp": f"2026-07-06T03:2{i}:00Z", "event": "ScanOrganic", "ScanType": st, "Body": 17,
         "Genus_Localised": "Bacterium", "Species_Localised": "Bacterium Aurasus"}
        for i, st in enumerate(("Log", "Sample", "Sample", "Analyse"))
    ],
]
with tempfile.TemporaryDirectory() as td:
    (Path(td) / "Journal.2026-07-06T030000.01.log").write_text(
        "\n".join(json.dumps(e) for e in first_events), encoding="utf-8")
    state4 = AppState()
    watcher = JournalWatcher(state4, journal_dir=td)
    watcher.bootstrap()
    snap4 = state4.snapshot()

items = snap4["bio"]["vault"]["items"]
stratum = next(i for i in items if i["species"] == "Stratum Tectonicas")
bacterium = next(i for i in items if i["species"] == "Bacterium Aurasus")
assert stratum["first"] is True and stratum["body"] == "Testland 5 c", stratum
assert bacterium["first"] is False and bacterium["body"] == "Testland 6 a", bacterium
# Vault total pays 5x on the first-logged species only.
assert snap4["bio"]["vault"]["total"] == stratum["value"] * 5 + bacterium["value"], snap4["bio"]["vault"]
# The undiscovered flag reaches the UI's bio table for the ★ marker.
sig_body = next(b for b in snap4["bio"]["system_signals"] if b["body"] == "Testland 5 c")
assert sig_body["was_discovered"] is False, sig_body

# Community override: another commander already reported the genus there.
state4.bio_community = {"id64": 999, "system": "Testland",
                        "bodies": {"Testland 5 c": {"count": 1, "genuses": [{"name": "Stratum"}]}}}
assert watcher._likely_first_log("Stratum", "Testland 5 c") is False   # already reported
assert watcher._likely_first_log("Concha", "Testland 5 c") is True    # other genus still yours
assert watcher._likely_first_log("Stratum", None) is False             # unknown body -> no claim

print("first-logged (5x) estimate OK: undiscovered body, discovered body, community override")

# Long expeditions: samples completed many sessions ago must survive a restart.
# The bootstrap walk-back keeps selecting files until it crosses a vault
# boundary (organic sale or death), not just the essentials window.
old_session = [
    {"timestamp": "2026-06-20T01:00:00Z", "event": "LoadGame", "Commander": "Test"},
    {"timestamp": "2026-06-20T01:00:30Z", "event": "SellOrganicData",
     "BioData": [{"SpeciesName_Localised": "Bacterium Acies", "Value": 1000000, "Bonus": 0}]},
    {"timestamp": "2026-06-20T01:01:00Z", "event": "Location", "StarSystem": "Farland",
     "SystemAddress": 555, "StarPos": [0, 0, 0], "Docked": False},
    {"timestamp": "2026-06-20T01:02:00Z", "event": "Scan", "BodyName": "Farland 1 a", "BodyID": 7,
     "PlanetClass": "Rocky body", "Atmosphere": "thin ammonia atmosphere", "SurfaceGravity": 2.65,
     "SurfaceTemperature": 178.4, "Landable": True, "WasDiscovered": False},
    *[
        {"timestamp": f"2026-06-20T01:1{i}:00Z", "event": "ScanOrganic", "ScanType": st, "Body": 7,
         "Genus_Localised": "Stratum", "Species_Localised": "Stratum Tectonicas"}
        for i, st in enumerate(("Log", "Sample", "Sample", "Analyse"))
    ],
]
filler = lambda day: [
    {"timestamp": f"2026-06-{day:02d}T01:00:00Z", "event": "LoadGame", "Commander": "Test"},
    {"timestamp": f"2026-06-{day:02d}T01:01:00Z", "event": "Loadout"},
    {"timestamp": f"2026-06-{day:02d}T01:02:00Z", "event": "FSDJump", "StarSystem": "Farland",
     "SystemAddress": 555, "StarPos": [0, 0, 0]},
]
with tempfile.TemporaryDirectory() as td:
    (Path(td) / "Journal.2026-06-20T010000.01.log").write_text(
        "\n".join(json.dumps(e) for e in old_session), encoding="utf-8")
    for day in range(21, 34):  # 13 newer sessions with no bio events at all
        (Path(td) / f"Journal.2026-06-{day}T010000.01.log").write_text(
            "\n".join(json.dumps(e) for e in filler(day)), encoding="utf-8")
    state5 = AppState()
    JournalWatcher(state5, journal_dir=td).bootstrap()
    vault5 = state5.snapshot()["bio"]["vault"]
assert len(vault5["items"]) == 1 and vault5["items"][0]["first"] is True, vault5
assert vault5["total"] == vault5["items"][0]["value"] * 5, vault5

print("bootstrap walk-back OK: unsold samples beyond the essentials window survive restart")
