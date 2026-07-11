"""CargoDepot handling: haulage-mission progress ('X of Y delivered') lands on
the tracked mission, wing updates included, unknown missions ignored."""
import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

_tmp = tempfile.TemporaryDirectory()
os.environ["ET_DATA_DIR"] = _tmp.name

from elite.journal import JournalWatcher  # noqa: E402
from elite.state import AppState  # noqa: E402

MID = 900_001

with tempfile.TemporaryDirectory() as td:
    state = AppState()
    w = JournalWatcher(state, journal_dir=td)

    w.handle_event({
        "timestamp": "t", "event": "MissionAccepted", "MissionID": MID,
        "Name": "Mission_Delivery_Boom", "LocalisedName": "Boom time delivery of 540 units of Clothing",
        "Faction": "Test Syndicate", "Commodity": "$Clothing_Name;", "Commodity_Localised": "Clothing",
        "Count": 540, "DestinationSystem": "Moultac", "DestinationStation": "Test Hub",
        "Reward": 2_000_000, "Wing": True, "Expiry": "2026-07-12T20:00:00Z",
    })

    # First delivery run docks 148 units.
    w.handle_event({
        "timestamp": "t", "event": "CargoDepot", "MissionID": MID, "UpdateType": "Deliver",
        "CargoType": "Clothing", "Count": 148, "StartMarketID": 1, "EndMarketID": 2,
        "ItemsCollected": 200, "ItemsDelivered": 148, "TotalItemsToDeliver": 540, "Progress": 0.274,
    })
    m = state.snapshot()["missions"][0]
    assert m["delivered"] == 148 and m["to_deliver"] == 540 and m["collected"] == 200, m
    assert m["kind"] == "delivery" and m["count"] == 540  # original fields intact

    # A wingmate delivers more: WingUpdate advances the same counters.
    w.handle_event({
        "timestamp": "t", "event": "CargoDepot", "MissionID": MID, "UpdateType": "WingUpdate",
        "CargoType": "Clothing", "Count": 0, "StartMarketID": 1, "EndMarketID": 2,
        "ItemsCollected": 400, "ItemsDelivered": 400, "TotalItemsToDeliver": 540, "Progress": 0.74,
    })
    m = state.snapshot()["missions"][0]
    assert m["delivered"] == 400 and m["to_deliver"] == 540, m

    # A depot event for a mission we never saw must not invent one.
    w.handle_event({
        "timestamp": "t", "event": "CargoDepot", "MissionID": 123456, "UpdateType": "Deliver",
        "ItemsCollected": 1, "ItemsDelivered": 1, "TotalItemsToDeliver": 10, "Progress": 0.1,
    })
    assert len(state.snapshot()["missions"]) == 1

    # All cargo delivered: the game redirects the mission to the reward stop —
    # the board's destination must follow.
    w.handle_event({
        "timestamp": "t", "event": "MissionRedirected", "MissionID": MID,
        "NewDestinationSystem": "Changthini", "NewDestinationStation": "Reward Port",
        "OldDestinationSystem": "Moultac", "OldDestinationStation": "Test Hub",
    })
    m = state.snapshot()["missions"][0]
    assert m["dest_system"] == "Changthini" and m["dest_station"] == "Reward Port", m
    assert m["delivered"] == 400, "redirect must not clobber depot progress"
    # Redirects for unknown missions are ignored too.
    w.handle_event({"timestamp": "t", "event": "MissionRedirected", "MissionID": 42,
                    "NewDestinationSystem": "Nowhere"})
    assert len(state.snapshot()["missions"]) == 1

    # Completion removes the mission as before.
    w.handle_event({"timestamp": "t", "event": "MissionCompleted", "MissionID": MID, "Reward": 2_000_000})
    assert state.snapshot()["missions"] == []

print("cargo depot OK: deliver + wing updates tracked, redirect follows, unknown ids ignored, completion clears")
print("ALL MISSION DEPOT TESTS PASSED")
