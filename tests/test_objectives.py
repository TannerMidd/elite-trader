"""Time-budget objective graph, durable objectives and extension action sink."""

import os
import sys
import tempfile
import time
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
_tmp = tempfile.TemporaryDirectory()
os.environ["ET_DATA_DIR"] = _tmp.name

from elite import marketdb  # noqa: E402
from elite.objectives import ExtensionActionSink, ObjectiveEngine, ObjectiveStore  # noqa: E402
from elite.timings import TimingModel  # noqa: E402


commander = marketdb.ensure_commander_profile("Objective Tester")
timing = TimingModel(commander)
for index, duration in enumerate((500, 600, 700)):
    timing.record("mission_delivery", duration, started_at=100000 + index * 1000000,
                  ended_at=100000 + index * 1000000 + duration * 1000)

now = int(time.time())
snapshot = {
    "system": "Sol",
    "cargo_inventory": [{"symbol": "steel", "name": "Steel", "count": 40}],
    "cargo_rescue": [{
        "id": "gold-buyer", "commodity": "Gold", "tons": 64, "system": "LHS 20",
        "station": "Ohm City", "profit": 4_000_000, "minutes": 12, "stranded": True,
    }],
    "missions": [{
        "id": 44, "name": "Urgent medicine delivery", "dest_system": "Barnard's Star",
        "dest_station": "Miller Depot", "expiry_ts": now + 25 * 60, "reward": 2_000_000,
    }],
    "engineering_plans": [{
        "blueprint": "FSD Increased Range", "grade": 5, "craftable": False,
        "materials": [{"name": "Datamined Wake Exceptions", "short": 3}],
        "source": {"system": "Shinrarta Dezhra", "station": "Jameson Memorial"},
        "engineer": {"system": "Deciat", "station": "Farseer Inc"},
    }],
    "colonisation": [{
        "market_id": 99, "system": "Colonisation Site", "station": "System Port",
        "resources": [{"symbol": "steel", "name": "Steel", "remaining": 100, "payment": 500}],
    }],
    "galaxy": {
        "powerplay": {"power": "Aisling Duval"},
        "pp_system": {"state": "Reinforcing"},
        "community_goals": [{
            "cgid": 12, "title": "Rebuild the station", "system": "Leesti",
            "market": "George Lucas", "expiry": now + 3 * 86400,
        }],
    },
    "exploration": {"total": 35_000_000},
    "bio": {
        "vault": {"total": 20_000_000},
        "system_signals": [{"body": "Sol A 1", "count": 3}],
    },
    "exploration_cash_in": {"system": "Sol", "station": "Galileo"},
}

plan = ObjectiveEngine(commander, timing).plan(75, snapshot, now=now)
nodes = plan["graph"]["nodes"]
categories = {task["category"] for task in nodes}
assert {"cargo", "missions", "engineering", "colonisation", "powerplay",
        "community_goal", "exploration"} <= categories, categories
assert plan["planned_minutes"] <= 75 and plan["remaining_minutes"] >= 0, plan
assert plan["selected"][0]["category"] == "cargo", plan["selected"]
urgent = next(task for task in nodes if task["category"] == "missions")
assert urgent["priority"] == 95 and urgent["estimated_seconds"] == 720, urgent
assert urgent["plot"] == {"system": "Barnard's Star", "station": "Miller Depot", "body": None}
craft = next(task for task in nodes if task["title"].startswith("Engineer FSD"))
assert craft["depends_on"] and any(edge["to"] == craft["id"] for edge in plan["graph"]["edges"])
cash = next(task for task in nodes if task["risk"] == "destruction")
assert cash["reward"] == 55_000_000 and cash["plot"]["station"] == "Galileo"
assert all(task["plot"] is None or task["plot"].get("system") or task["plot"].get("station")
           or task["plot"].get("body") for task in nodes)

store = ObjectiveStore(commander)
first = store.create("Survey Sol", source="test", source_ref="same", category="exploration")
again = store.create("Survey Sol duplicate", source="test", source_ref="same")
assert first["id"] == again["id"] and len(store.list()) == 1
assert store.update(first["id"], status="done")["status"] == "done"
try:
    store.update(first["id"], status="nonsense")
    raise AssertionError("invalid status accepted")
except ValueError:
    pass

alerts = []
sink = ExtensionActionSink(commander, alerts.append)
created = sink.accept({
    "type": "objective", "extension_id": "sample.pack", "title": "Check the anomaly",
    "category": "exploration", "system": "Sol",
})
created_again = sink.accept({
    "type": "objective", "extension_id": "sample.pack", "title": "Check the anomaly",
    "category": "exploration", "system": "Sol",
})
assert created["objective"]["id"] == created_again["objective"]["id"]
extension_plan = ObjectiveEngine(commander, timing).plan(30, {})
assert any(
    node.get("stored_objective_id") == created["objective"]["id"]
    for node in extension_plan["graph"]["nodes"]
), extension_plan
alert = sink.accept({
    "type": "alert", "extension_id": "sample.pack", "level": "warning",
    "code": "test", "text": "Cargo market changed", "say": "Market changed",
})
assert alert["alert"]["text"] == "Cargo market changed" and alerts == [alert["alert"]]

conn = marketdb.connect_user()
assert conn.execute("SELECT COUNT(*) FROM commander_alerts").fetchone()[0] == 1
conn.close()

other = ObjectiveStore(marketdb.ensure_commander_profile("Other Objective Tester"))
assert other.list() == []

print("objectives OK: 75-minute plan, dependency graph, persistence, extension actions")
