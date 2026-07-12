"""Durable compressed journal history: dedupe, query, replay and profiles."""

import os
import sys
import tempfile
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
_tmp = tempfile.TemporaryDirectory()
os.environ["ET_DATA_DIR"] = _tmp.name

from elite import marketdb  # noqa: E402
from elite.eventledger import EventLedger  # noqa: E402


alpha_id = marketdb.ensure_commander_profile("Ledger Alpha")
ledger = EventLedger(alpha_id)

events = [
    (1, {"timestamp": "2026-01-01T00:00:00Z", "event": "Location", "StarSystem": "Sol"}),
    (2, {"timestamp": "2026-01-01T00:01:00Z", "event": "FSDJump", "StarSystem": "Alpha Centauri", "JumpDist": 4.38}),
    (3, {"timestamp": "2026-01-01T00:02:00Z", "event": "Bounty", "TotalReward": 120000, "VictimFaction": "Pirates"}),
    (4, {"timestamp": "2026-01-01T00:03:00Z", "event": "MissionAccepted", "MissionID": 1}),
    (5, {"timestamp": "2026-01-01T00:04:00Z", "event": "MissionCompleted", "MissionID": 1, "Reward": 500000}),
    (6, {"timestamp": "2026-01-01T00:05:00Z", "event": "Scan", "BodyName": "Alpha Centauri A 1", "Parents": ["x" * 2000]}),
    (7, {"timestamp": "2026-01-01T00:06:00Z", "event": "ScanOrganic", "ScanType": "Analyse", "Species": "$Codex_Ent_Stratum_01_Name;"}),
    (8, {"timestamp": "2026-01-01T00:07:00Z", "event": "MiningRefined", "Type": "Platinum", "Count": 2}),
    (9, {"timestamp": "2026-01-01T00:08:00Z", "event": "CarrierStats", "CarrierID": 42}),
]

claim = ledger.prepare_journal("Journal.2026-01.log", size_bytes=1000, mtime_ns=10)
assert claim == {"needs_import": True, "resume_after_line": 0, "event_count": 0}, claim
report = ledger.import_journal(
    "Journal.2026-01.log", events, size_bytes=1000, mtime_ns=10, content_hash="abc"
)
assert report["inserted"] == len(events) and report["duplicates"] == 0, report

# Live-tail/bootstrap overlap and a full journal retry are idempotent when the
# source coordinate is preserved. Identical same-second events on different
# physical lines remain distinct (common for MiningRefined).
assert not ledger.record(
    events[1][1], source_file="Journal.2026-01.log", source_line=2,
    dedupe_key="Journal.2026-01.log:2",
)["inserted"]
duplicate_payload = dict(events[7][1])
assert ledger.record(
    duplicate_payload, source_file="Journal.2026-01.log", source_line=10,
    dedupe_key="Journal.2026-01.log:10",
)["inserted"]
assert ledger.lifetime_summary()["events"] == len(events) + 1
assert ledger.lifetime_summary()["metrics"]["mining"]["refined_tons"] == 4
retry = ledger.import_journal(
    "Journal.2026-01.log", events, size_bytes=1000, mtime_ns=10, content_hash="abc"
)
assert retry["inserted"] == 0 and retry["duplicates"] == len(events), retry
claim = ledger.prepare_journal(
    "Journal.2026-01.log", size_bytes=1000, mtime_ns=10, content_hash="abc"
)
assert not claim["needs_import"] and claim["resume_after_line"] == 9, claim

travel = ledger.query(categories=["travel"], ascending=True)
assert [row["event_type"] for row in travel] == ["Location", "FSDJump"], travel
assert travel[1]["system"] == "Alpha Centauri"
scan = ledger.query(event_types=["Scan"])[0]
assert scan["stored_size"] < scan["payload_size"] / 3, scan
assert list(e["event"] for e in ledger.replay(categories=["missions"])) == [
    "MissionAccepted", "MissionCompleted"
]

summary = ledger.lifetime_summary()
assert summary["events"] == len(events) + 1, summary
assert summary["metrics"]["travel"] == {"jumps": 1, "distance_ly": 4.38}
assert summary["metrics"]["combat"]["bounty_cr"] == 120000
assert summary["metrics"]["missions"]["reward_cr"] == 500000
assert summary["metrics"]["exploration"]["organics"] == 1
assert summary["metrics"]["mining"]["refined_tons"] == 4
assert summary["metrics"]["carrier"]["events"] == 1
assert summary["stored_bytes"] < summary["payload_bytes"]

# A failed import rolls back its event rows and leaves a resumable error marker.
try:
    ledger.import_journal("Journal.bad.log", [(1, events[0][1]), (2, {"timestamp": "x"})])
    raise AssertionError("invalid event was accepted")
except ValueError:
    pass
bad = next(row for row in ledger.journal_files() if row["file_key"] == "Journal.bad.log")
assert not bad["complete"] and "event field" in bad["error"], bad
assert ledger.lifetime_summary()["events"] == len(events) + 1

# Commander histories never bleed together.
beta_id = marketdb.ensure_commander_profile("Ledger Beta")
beta = EventLedger(beta_id)
beta.record({"timestamp": "2026-01-01T01:00:00Z", "event": "FSDJump", "StarSystem": "Beta", "JumpDist": 20})
assert beta.lifetime_summary()["events"] == 1
assert ledger.lifetime_summary()["events"] == len(events) + 1

print("event ledger OK: compressed, deduped, resumable, replayable, commander-scoped")
