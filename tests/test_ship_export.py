"""Current-ship export: EDSY import URL (EDMC-compatible gzip+base64 encoding),
SLEF JSON, the journal Loadout capture, and the /api/loadout-export endpoint."""
import base64
import gzip
import json
import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

_tmp = tempfile.TemporaryDirectory()
os.environ["ET_DATA_DIR"] = _tmp.name

from elite import shipexport  # noqa: E402
from elite.journal import JournalWatcher  # noqa: E402
from elite.state import AppState  # noqa: E402

LOADOUT = {
    "timestamp": "2026-07-10T20:00:00Z", "event": "Loadout",
    "Ship": "krait_mkii", "ShipName": "BESSIE", "ShipIdent": "TM-02",
    "HullValue": 45814205, "Rebuy": 2921033,
    "MaxJumpRange": 61.97, "CargoCapacity": 82,
    "FuelCapacity": {"Main": 32.0, "Reserve": 0.63},
    "Modules": [
        {"Slot": "FrameShiftDrive", "Item": "int_hyperdrive_size5_class5", "On": True,
         "Engineering": {"Engineer": "Felicity Farseer", "BlueprintName": "FSD_LongRange", "Level": 5}},
        {"Slot": "MediumHardpoint1", "Item": "hpt_beamlaser_gimbal_medium", "On": True},
    ],
}

# ---------- EDSY URL: exact EDMC encoding, round-trips to the same event ----------

url = shipexport.edsy_url(LOADOUT)
assert url.startswith("https://edsy.org/#/I="), url
blob = url[len("https://edsy.org/#/I="):]
assert "=" not in blob, "raw base64 padding must be %-escaped in the fragment"
decoded = json.loads(gzip.decompress(base64.urlsafe_b64decode(blob.replace("%3D", "="))))
assert decoded == LOADOUT, "loadout must survive the encode/decode round-trip"

# ---------- SLEF: the community wrapper Coriolis/Inara import ----------

slef = json.loads(shipexport.slef(LOADOUT))
assert isinstance(slef, list) and len(slef) == 1, slef
assert slef[0]["header"]["appName"] == "Frameshift"
assert slef[0]["header"]["appVersion"]
assert slef[0]["data"]["Ship"] == "krait_mkii"
assert slef[0]["data"]["Modules"][0]["Engineering"]["Level"] == 5

print("export encoding OK: EDSY url round-trip, SLEF wrapper")

# ---------- journal capture: Loadout events keep the full module list ----------

with tempfile.TemporaryDirectory() as td:
    state = AppState()
    w = JournalWatcher(state, journal_dir=td)
    assert state.get_loadout() is None
    w.handle_event(LOADOUT)
    kept = state.get_loadout()
    assert kept["ShipIdent"] == "TM-02" and len(kept["Modules"]) == 2
    snap = state.snapshot()
    assert snap["has_loadout"] is True and snap["rebuy"] == 2921033

# ---------- API endpoint ----------

from elite.server import create_app  # noqa: E402

state = AppState()
state.update(commander="Ship Export Test", commander_id="ship-export-test")
app = create_app(state)
client = app.test_client()
profile_headers = {"X-Frameshift-Commander": "ship-export-test"}

resp = client.get("/api/loadout-export", headers=profile_headers)
assert resp.status_code == 404 and "error" in resp.get_json(), resp.get_json()

state.update(loadout_raw=dict(LOADOUT))
resp = client.get("/api/loadout-export", headers=profile_headers)
data = resp.get_json()
assert resp.status_code == 200, data
assert data["ship_ident"] == "TM-02" and data["ship_name"] == "BESSIE"
assert data["edsy_url"].startswith("https://edsy.org/#/I=")
assert json.loads(data["slef"])[0]["data"]["ShipName"] == "BESSIE"

# A request pinned to Alpha must not export a loadout installed by a journal
# handoff after Flask captured the request identity.
original_get_loadout = state.get_loadout


def switch_before_loadout_read(commander_id=None):
    state.update(
        commander="Other Ship Export Test",
        commander_id="other-ship-export-test",
        loadout_raw={**LOADOUT, "ShipName": "OTHER SHIP"},
    )
    return original_get_loadout(commander_id)


state.get_loadout = switch_before_loadout_read
try:
    raced = client.get("/api/loadout-export", headers=profile_headers)
    assert raced.status_code == 404
    assert "OTHER SHIP" not in raced.get_data(as_text=True)
finally:
    state.get_loadout = original_get_loadout

print("api OK: 404 before a loadout, full export after")
print("ALL SHIP EXPORT TESTS PASSED")
