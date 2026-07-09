"""Price history + persistent watches: recording, tracking cap, watch
persistence across a simulated restart, and baseline re-anchoring."""
import json
import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

_tmp = tempfile.TemporaryDirectory()
os.environ["ET_DATA_DIR"] = _tmp.name  # isolate the DB before elite imports

from elite import alerts, marketdb  # noqa: E402

# ---------- price history recording & reading ----------

conn = marketdb.connect()
NOW = marketdb.now_epoch()
rows_t1 = [("gold", 9000, 9500, 100, 50), ("silver", 4000, 4600, 200, 80)]
rows_t2 = [("gold", 9100, 9800, 90, 60), ("silver", 4000, 4300, 210, 70)]
marketdb.record_price_history(conn, 111, rows_t1, ts=NOW - 3600)
marketdb.record_price_history(conn, 111, rows_t2, ts=NOW)
marketdb.record_price_history(conn, 111, rows_t2, ts=NOW)  # dup ts: ignored
conn.commit()
conn.close()

hist = marketdb.price_history(111)
assert set(hist) == {"gold", "silver"}, hist
assert [p[1] for p in hist["gold"]] == [9500, 9800], hist["gold"]  # sell series, oldest first
assert len(hist["gold"]) == 2, "duplicate timestamp must be ignored"

# ---------- tracked-market cap evicts oldest history ----------

marketdb.TRACKED_CAP = 3
for i, mid in enumerate([201, 202, 203, 204]):  # oldest two fall off the cap
    marketdb._tracked_cache = None
    conn = marketdb.connect()
    conn.execute("INSERT OR REPLACE INTO tracked_markets(market_id, added_ts) VALUES(?, ?)", (mid, NOW - 100 + i))
    marketdb.record_price_history(conn, mid, [("gold", 1, 2, 3, 4)], ts=NOW - 100 + i)
    conn.commit()
    conn.close()
marketdb.track_market(205)  # newest; triggers the cap sweep
assert 205 in marketdb.tracked_ids() and 201 not in marketdb.tracked_ids(), marketdb.tracked_ids()
assert marketdb.price_history(201) == {}, "evicted market keeps no history"
assert marketdb.price_history(203) != {}

print("price history OK: record/read, dup-ts ignore, tracked cap eviction")

# ---------- watches persist and re-anchor ----------

loop = {
    "a": {"market_id": 111, "station": "Alpha Port"},
    "b": {"market_id": 222, "station": "Beta Hub"},
    "profit": 1_000_000,
    "outbound": {"commodities": [{"symbol": "gold", "amount": 40, "buy_price": 9000, "sell_price": 9800}]},
    "inbound": {"commodities": []},
}
w = alerts.add_loop_watch(loop)
assert w["id"] >= 1
assert alerts.watched_market_ids() == {111, 222}

# Simulated restart: wipe in-memory state, reload from the DB.
alerts.WATCHES.clear()
alerts._loaded = False
snap = alerts.snapshot()
assert len(snap["watches"]) == 1 and snap["watches"][0]["label"] == "Alpha Port ⇄ Beta Hub", snap
assert alerts.watched_market_ids() == {111, 222}, "watch must survive restart"

# Price drop below 90% of the 9800 baseline -> alert + re-anchored baseline.
alerts.on_market_update(222, "Beta Hub", [("gold", 0, 8500, 0, 500)])
snap = alerts.snapshot()
assert any("dropped" in a["text"] for a in snap["alerts"]), snap["alerts"]
watch = list(alerts.WATCHES.values())[0]
sell_conds = [c for c in watch["conditions"] if c[2] == "sell"]
assert sell_conds[0][4] == 8500, f"baseline must re-anchor to the alerted price: {sell_conds}"

# The same price again must NOT re-alert (it is the new baseline)...
n = len(alerts.snapshot()["alerts"])
alerts.on_market_update(222, "Beta Hub", [("gold", 0, 8500, 0, 500)])
assert len(alerts.snapshot()["alerts"]) == n, "same price after re-anchor must not re-alert"
# ...but a further 10% drop must.
alerts.on_market_update(222, "Beta Hub", [("gold", 0, 7500, 0, 500)])
assert len(alerts.snapshot()["alerts"]) == n + 1, "further decay must fire a fresh alert"

# Re-anchored baseline also persisted: reload again and check.
alerts.WATCHES.clear()
alerts._loaded = False
watch = list(alerts.snapshot() and alerts.WATCHES.values())[0]
sell_conds = [c for c in watch["conditions"] if c[2] == "sell"]
assert sell_conds[0][4] == 7500, sell_conds

# Removal persists too.
assert alerts.remove_watch(w["id"])
alerts.WATCHES.clear()
alerts._loaded = False
assert alerts.snapshot()["watches"] == []

print("watches OK: persist across restart, re-anchor + persist, no repeat alerts, removal")
print("ALL MARKET-HISTORY TESTS PASSED")
