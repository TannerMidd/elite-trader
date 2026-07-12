"""Market confidence and route-rescue risk semantics."""

import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
_tmp = tempfile.TemporaryDirectory()
os.environ["ET_DATA_DIR"] = _tmp.name

from elite.routes import trade_confidence  # noqa: E402

NOW = 2_000_000_000

fresh = trade_confidence(NOW - 300, amount=100, supply=10_000, demand=100_000, now=NOW)
assert fresh["band"] == "high" and fresh["score"] >= 80, fresh
assert fresh["reasons"] == [], fresh

stale = trade_confidence(NOW - 10 * 86400, amount=100, supply=10_000, demand=100_000, now=NOW)
assert stale["band"] == "low" and "price is over 7 days old" in stale["reasons"], stale
assert stale["low_factor"] < fresh["low_factor"]

bulk = trade_confidence(NOW - 300, amount=300, supply=10_000, demand=1000, now=NOW)
assert bulk["band"] != "high", bulk
assert any("bulk-sale" in reason for reason in bulk["reasons"]), bulk

thin = trade_confidence(NOW - 300, amount=500, supply=100, demand=200, now=NOW)
assert thin["band"] == "low"
assert any("cannot" in reason for reason in thin["reasons"]), thin

buy_only = trade_confidence(NOW - 300, amount=100, supply=10_000, demand=None, now=NOW)
assert buy_only["band"] == "high" and not any("demand" in reason for reason in buy_only["reasons"]), buy_only

sell_only = trade_confidence(NOW - 300, amount=100, supply=None, demand=100_000, now=NOW)
assert sell_only["band"] == "high" and not any("supply" in reason for reason in sell_only["reasons"]), sell_only

print("route confidence OK: freshness, side-aware depth, bulk risk, conservative range")
