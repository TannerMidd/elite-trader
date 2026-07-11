"""All-levels player features: engineer progress, stored ships, the fleet
carrier panel, and the Odyssey ship locker (ShipLocker.json)."""
import json
import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

_tmp = tempfile.TemporaryDirectory()
os.environ["ET_DATA_DIR"] = _tmp.name

from elite import engineers as engref  # noqa: E402
from elite.journal import JournalWatcher  # noqa: E402
from elite.state import AppState  # noqa: E402

# ---------- reference table sanity ----------

assert len(engref.ENGINEERS) >= 35, len(engref.ENGINEERS)
assert all(v.get("system") and v.get("offers") for v in engref.ENGINEERS.values())
assert engref.info("Felicity Farseer")["system"] == "Deciat"
assert engref.info("Rosa Dayette").get("on_foot") is True
assert engref.info("Some Future Engineer") == {}  # unknown names still render

print("engineer reference OK: 38 workshops, systems + specialties present")

with tempfile.TemporaryDirectory() as td:
    state = AppState()
    w = JournalWatcher(state, journal_dir=td)

    # ---------- engineer progress: startup batch, then a live rank-up ----------

    w.handle_event({"timestamp": "t", "event": "EngineerProgress", "Engineers": [
        {"Engineer": "Felicity Farseer", "EngineerID": 300100, "Progress": "Unlocked",
         "Rank": 3, "RankProgress": 40},
        {"Engineer": "Elvira Martuuk", "EngineerID": 300160, "Progress": "Invited"},
        {"Engineer": "Professor Palin", "EngineerID": 300220, "Progress": "Known"},
        {"Engineer": "Rosa Dayette", "EngineerID": 400012, "Progress": "Unlocked", "Rank": 1},
    ]})
    engs = state.snapshot()["engineers"]
    assert [e["name"] for e in engs] == [
        "Felicity Farseer", "Rosa Dayette", "Elvira Martuuk", "Professor Palin",
    ], [e["name"] for e in engs]  # unlocked (rank desc) -> invited -> known
    assert engs[0]["system"] == "Deciat" and "FSD" in engs[0]["offers"]
    assert engs[1]["on_foot"] is True
    assert engs[2]["progress"] == "Invited" and engs[2]["system"] == "Khun"

    # Single live event: Martuuk unlocked, everyone else untouched.
    w.handle_event({"timestamp": "t", "event": "EngineerProgress",
                    "Engineer": "Elvira Martuuk", "EngineerID": 300160,
                    "Progress": "Unlocked", "Rank": 1, "RankProgress": 0})
    engs = state.snapshot()["engineers"]
    martuuk = next(e for e in engs if e["name"] == "Elvira Martuuk")
    assert martuuk["progress"] == "Unlocked" and martuuk["rank"] == 1
    assert len(engs) == 4

    # ---------- stored ships ----------

    w.handle_event({
        "timestamp": "t", "event": "StoredShips", "StationName": "Jameson Memorial",
        "StarSystem": "Shinrarta Dezhra", "MarketID": 128666762,
        "ShipsHere": [
            {"ShipID": 3, "ShipType": "dolphin", "ShipType_Localised": "Dolphin",
             "Name": "TADPOLE", "Value": 1854790, "Hot": False},
        ],
        "ShipsRemote": [
            {"ShipID": 7, "ShipType": "asp", "ShipType_Localised": "Asp Explorer",
             "Name": "SCOUT", "Value": 6661153, "Hot": True, "StarSystem": "Deciat",
             "ShipMarketID": 3223343616, "TransferPrice": 24805, "TransferTime": 763},
            {"ShipID": 9, "ShipType": "type9", "Value": 76555842, "Hot": False,
             "InTransit": True},
        ],
    })
    st = state.snapshot()["stored_ships"]
    assert st["station"] == "Jameson Memorial" and len(st["here"]) == 1 and len(st["remote"]) == 2
    assert st["here"][0]["name"] == "TADPOLE" and st["here"][0]["type"] == "Dolphin"
    scout = st["remote"][0]
    assert scout["system"] == "Deciat" and scout["hot"] is True and scout["transfer_cr"] == 24805
    assert st["remote"][1]["in_transit"] is True and st["remote"][1]["type"] == "Type9"

    # ---------- fleet carrier ----------

    assert state.snapshot()["carrier"] is None  # non-owners never see the card
    w.handle_event({
        "timestamp": "t", "event": "CarrierStats", "CarrierID": 1, "Callsign": "X7B-9TW",
        "Name": "STELLA OBSCURA", "FuelLevel": 485,
        "Finance": {"CarrierBalance": 4_860_000_000, "ReserveBalance": 120_000_000},
        "SpaceUsage": {"TotalCapacity": 25000, "FreeSpace": 12340},
    })
    fc = state.snapshot()["carrier"]
    assert fc["name"] == "STELLA OBSCURA" and fc["fuel_t"] == 485 and fc["free_space"] == 12340
    assert fc["balance"] == 4_860_000_000

    w.handle_event({"timestamp": "t", "event": "CarrierJumpRequest", "CarrierID": 1,
                    "SystemName": "Moultac", "Body": "Moultac 2",
                    "DepartureTime": "2026-07-11T21:00:00Z"})
    fc = state.snapshot()["carrier"]
    assert fc["jump"]["system"] == "Moultac" and fc["jump"]["departure_ts"] > 0

    w.handle_event({"timestamp": "t", "event": "CarrierDepositFuel", "CarrierID": 1,
                    "Amount": 250, "Total": 735})
    assert state.snapshot()["carrier"]["fuel_t"] == 735

    # Someone else's carrier arriving somewhere else must not clear our jump…
    w.handle_event({"timestamp": "t", "event": "CarrierJump", "StarSystem": "Elsewhere",
                    "SystemAddress": 99, "StarPos": [9, 9, 9], "Body": "Elsewhere A"})
    assert state.snapshot()["carrier"]["jump"] is not None
    # …but ours completing at the requested destination does.
    w.handle_event({"timestamp": "t", "event": "CarrierJump", "StarSystem": "Moultac",
                    "SystemAddress": 2, "StarPos": [0, 0, 0], "Body": "Moultac 2"})
    assert state.snapshot()["carrier"]["jump"] is None

    w.handle_event({"timestamp": "t", "event": "CarrierJumpRequest", "CarrierID": 1,
                    "SystemName": "Changthini", "DepartureTime": "2026-07-11T22:00:00Z"})
    w.handle_event({"timestamp": "t", "event": "CarrierJumpCancelled", "CarrierID": 1})
    assert state.snapshot()["carrier"]["jump"] is None

    print("journal OK: engineer batch+update ordering, stored ships, carrier stats/jump/fuel")

    # ---------- odyssey locker (ShipLocker.json) ----------

    locker_file = {
        "timestamp": "t", "event": "ShipLocker",
        "Items": [
            {"Name": "graphene", "Name_Localised": "Graphene", "OwnerID": 0, "Count": 12},
            {"Name": "graphene", "Name_Localised": "Graphene", "OwnerID": 7, "Count": 5},
            {"Name": "insight", "Name_Localised": "Insight", "OwnerID": 0, "Count": 2},
        ],
        "Components": [
            {"Name": "circuitboard", "Name_Localised": "Circuit Board", "OwnerID": 0, "Count": 9},
        ],
        "Consumables": [
            {"Name": "healthpack", "Name_Localised": "Medkit", "OwnerID": 0, "Count": 6},
        ],
        "Data": [
            {"Name": "internalcorrespondence", "Name_Localised": "Internal Correspondence",
             "OwnerID": 0, "Count": 3},
        ],
    }
    (Path(td) / "ShipLocker.json").write_text(json.dumps(locker_file), encoding="utf-8")
    w._refresh_status_files(force=True)
    locker = state.snapshot()["ship_locker"]
    assert locker["total"] == 12 + 5 + 2 + 9 + 6 + 3, locker["total"]
    graphene = locker["items"][0]
    assert graphene["name"] == "Graphene" and graphene["count"] == 17  # owner splits merged
    assert locker["components"][0]["count"] == 9 and locker["consumables"][0]["name"] == "Medkit"

    # A truncated/foreign file (no arrays) must keep the last good inventory.
    w._apply_shiplocker({"timestamp": "t", "event": "ShipLocker"})
    assert state.snapshot()["ship_locker"]["total"] == 37

print("locker OK: owner-split aggregation, file wiring, partial events ignored")
print("ALL FLEET & ENGINEERS TESTS PASSED")
