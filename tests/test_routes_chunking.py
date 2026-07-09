"""Wide-radius searches must not blow SQLite's host-parameter limit: a search
sweeping thousands of stations (deep-space radii) crashed every IN(...) query
before chunking. Fixture: 1,200 one-station systems around the origin."""
import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

_tmp = tempfile.TemporaryDirectory()
os.environ["ET_DATA_DIR"] = _tmp.name

from elite import marketdb, routes  # noqa: E402

N = 1200
assert N > routes.SQL_IN_CHUNK, "fixture must span multiple chunks"

conn = marketdb.connect()
now = marketdb.now_epoch()
for i in range(N):
    x = (i % 40) * 10.0
    y = ((i // 40) % 40) * 10.0
    z = (i // 1600) * 10.0
    conn.execute("INSERT INTO systems(id64, name, x, y, z) VALUES(?, ?, ?, ?, ?)",
                 (i + 1, f"Sys {i}", x, y, z))
    conn.execute(
        "INSERT INTO stations(market_id, system_id64, name, type, dist_ls, large_pad, updated_at)"
        " VALUES(?, ?, ?, 'Coriolis Starport', 100, 1, ?)",
        (1000 + i, i + 1, f"Station {i}", now),
    )
    # gold sellable everywhere, buyable at even stations
    conn.execute(
        "INSERT INTO commodities(market_id, symbol, buy_price, sell_price, supply, demand)"
        " VALUES(?, 'gold', ?, ?, ?, ?)",
        (1000 + i, 9000 if i % 2 == 0 else 0, 9500 + i, 500 if i % 2 == 0 else 0, 400),
    )
conn.execute("INSERT INTO commodity_names(symbol, name, category) VALUES('gold', 'Gold', 'Metals')")
conn.commit()
conn.close()

start = {"star_pos": [0.0, 0.0, 0.0], "radius": 5000}

r = routes.search_commodity("gold", "sell", star_pos=start["star_pos"], radius=5000, min_units=1)
assert len(r["results"]) == 40, len(r["results"])  # trimmed to limit
assert r["results"][0]["sell_price"] == 9500 + N - 1, r["results"][0]  # best price found across chunks

m = routes.mining_advisor(star_pos=start["star_pos"], radius=5000, min_price=0)
gold = next(x for x in m["results"] if x["symbol"] == "gold")
assert gold["sell_price"] == 9500 + N - 1, gold  # global best, not per-chunk best

s = routes.sell_cargo([{"symbol": "gold", "name": "Gold", "count": 100}],
                      star_pos=start["star_pos"], radius=5000)
assert s and s[0]["total"] == 100 * (9500 + N - 1), s[0]

print(f"chunked queries OK: {N} stations swept without 'too many SQL variables';"
      " best prices found across chunk boundaries")
print("ALL ROUTES-CHUNKING TESTS PASSED")
