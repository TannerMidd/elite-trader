"""Journal provenance, lifetime backfill, specialists, and profile segregation."""

import json
import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
_tmp = tempfile.TemporaryDirectory()
os.environ["ET_DATA_DIR"] = _tmp.name

from elite import marketdb  # noqa: E402
from elite.eventledger import EventLedger  # noqa: E402
from elite.journal import JournalWatcher  # noqa: E402
from elite.mining import MiningTracker  # noqa: E402
from elite.state import AppState  # noqa: E402


root = Path(_tmp.name)


def write(name, events):
    (root / name).write_text(
        "\n".join(json.dumps(event, separators=(",", ":")) for event in events) + "\n",
        encoding="utf-8",
    )


alpha_file = "Journal.2026-07-11T120000.01.log"
alpha_refined = {
    "timestamp": "2026-07-11T12:00:02Z", "event": "MiningRefined",
    "Type": "Platinum", "Type_Localised": "Platinum", "Count": 1,
}
write(alpha_file, [
    {"timestamp": "2026-07-11T12:00:00Z", "event": "Fileheader", "gameversion": "4.1.0"},
    {"timestamp": "2026-07-11T12:00:01Z", "event": "Commander", "Name": "Alpha"},
    alpha_refined,
    dict(alpha_refined),  # same timestamp and payload, legitimate second tonne
])

beta_file = "Journal.2026-07-12T120000.01.log"
write(beta_file, [
    {"timestamp": "2026-07-12T12:00:00Z", "event": "Fileheader", "gameversion": "4.1.0"},
    {"timestamp": "2026-07-12T12:00:01Z", "event": "Commander", "Name": "Beta"},
    {"timestamp": "2026-07-12T12:00:02Z", "event": "Location", "StarSystem": "Sol"},
])

state = AppState()
watcher = JournalWatcher(state, journal_dir=root)
watcher.bootstrap()
assert state.commander == "Beta", "bootstrap mixed the older account into current state"
beta_id = marketdb.commander_profile_id("Beta")
alpha_id = marketdb.commander_profile_id("Alpha")
assert state.commander_id == beta_id

watcher.import_trade_history()
alpha_summary = EventLedger(alpha_id).lifetime_summary()
beta_summary = EventLedger(beta_id).lifetime_summary()
assert alpha_summary["events"] == 4 and beta_summary["events"] == 3
assert alpha_summary["metrics"]["mining"]["refined_tons"] == 2
assert MiningTracker(alpha_id).snapshot()["session"]["refined_t"] == 2
assert MiningTracker(beta_id).snapshot()["session"] is None
assert marketdb.active_commander_id() == beta_id, "history import changed the live profile"

# Re-running both paths uses the same file/line capability IDs and stays exact.
watcher.import_trade_history()
assert EventLedger(alpha_id).lifetime_summary()["events"] == 4
assert MiningTracker(alpha_id).snapshot()["session"]["refined_t"] == 2

print("journal intelligence OK: source-line identity, backfill, specialists, account isolation")
