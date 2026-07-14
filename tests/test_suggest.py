"""Prefix suggestions: indexed lookups, input hygiene, both kinds."""

import os
import sys
import tempfile
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

_tmp = tempfile.TemporaryDirectory()
os.environ["ET_DATA_DIR"] = _tmp.name

from elite import marketdb  # noqa: E402

conn = marketdb.connect()
conn.executemany(
    "INSERT INTO systems(id64, name, x, y, z) VALUES(?, ?, 0, 0, 0)",
    [(1, "LHS 3746"), (2, "LHS 3006"), (3, "lhs 20"), (4, "Sol"), (5, "Lave")],
)
conn.executemany(
    "INSERT INTO stations(market_id, system_id64, name, large_pad) VALUES(?, 1, ?, 1)",
    [(11, "Gamow Terminal"), (12, "Gamma Dock"), (13, "Alpha Port"), (14, "Gamow Terminal")],
)
conn.commit()

# The stations name index must exist (a per-keystroke scan of 475k stations
# costs ~90 ms; the index makes it sub-millisecond).
indexes = {row[1] for row in conn.execute("PRAGMA index_list(stations)")}
assert "idx_stations_name" in indexes, indexes
conn.close()

from elite.server import create_app  # noqa: E402
from elite.state import AppState  # noqa: E402

client = create_app(AppState()).test_client()


def suggest(**params):
    response = client.get("/api/suggest", query_string=params)
    assert response.status_code == 200
    return response.get_json()["suggestions"]


# Case-insensitive prefix, capped and ordered
assert suggest(kind="systems", q="lhs") == ["lhs 20", "LHS 3006", "LHS 3746"]
assert suggest(kind="systems", q="LHS 37") == ["LHS 3746"]
# Stations deduplicate identical names
assert suggest(kind="stations", q="gam") == ["Gamma Dock", "Gamow Terminal"]
# Too short / too long / wildcard-only input returns nothing (never scans)
assert suggest(kind="systems", q="L") == []
assert suggest(kind="systems", q="x" * 61) == []
assert suggest(kind="systems", q="%%__") == []
# Wildcards are stripped, not honored: %o% must not match "Sol"
assert suggest(kind="systems", q="%o%") == []
# Unknown kind falls back to systems rather than erroring
assert suggest(kind="nonsense", q="so") == ["Sol"]

print("suggest OK")
