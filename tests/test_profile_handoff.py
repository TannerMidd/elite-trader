"""First-run adoption and commander handoff never strand or cross-leak data."""

import os
import sys
import tempfile
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
_tmp = tempfile.TemporaryDirectory()
os.environ["ET_DATA_DIR"] = _tmp.name

from elite import marketdb, spansh  # noqa: E402
from elite.eventledger import EventLedger  # noqa: E402
from elite.journal import JournalWatcher  # noqa: E402
from elite.objectives import ObjectiveStore  # noqa: E402
from elite.specialists import SpecialistWorkflows  # noqa: E402
from elite.state import AppState  # noqa: E402
from elite.timings import TimingModel  # noqa: E402


# Every lazy feature schema exists before the first real Commander event, just
# as it can when somebody plans a session while the game is still closed.
before = ObjectiveStore().create("Plan made before launch")
EventLedger().record({"timestamp": "2026-07-12T10:00:00Z", "event": "Docked"})
TimingModel().record("docking", 120, started_at=1_000_000, ended_at=1_120_000)
SpecialistWorkflows().mining.start(context={"system": "Pre-game"})

state = AppState()
state.update(
    commander="Alpha", commander_id="old-profile", credits=999,
    system="Alpha System", pos={"lat": 1, "lon": 2, "body": "Alpha A 1"},
    missions={1: {"mission_id": 1, "name": "Alpha secret"}},
    bio_vault=[{"species": "Alpha bio", "value": 1}],
    materials={"Raw": {"iron": {"count": 99}}, "Manufactured": {}, "Encoded": {}},
)
watcher = JournalWatcher(state, journal_dir=_tmp.name)
watcher._status_mtimes = {"Cargo.json": 123}
watcher.handle_event({
    "timestamp": "2026-07-12T10:01:00Z", "event": "Fileheader",
    "gameversion": "3.8.0.0", "build": "legacy",
})
watcher.handle_event({
    "timestamp": "2026-07-12T10:01:01Z", "event": "Commander", "Name": "Beta",
})

legacy_id = marketdb.commander_profile_id("Beta", "legacy")
snapshot = state.snapshot()
assert snapshot["commander"] == "Beta" and snapshot["commander_id"] == legacy_id
assert snapshot["galaxy_mode"] == "legacy"
assert snapshot["credits"] is None and snapshot["system"] is None and snapshot["pos"] is None
assert snapshot["missions"] == [] and snapshot["bio"]["vault"]["items"] == []
assert snapshot["materials"]["raw"] == []
assert watcher._status_mtimes == {}

# First-run Legacy is a real profile too: pre-game durable data follows it
# instead of remaining invisible in the temporary default bucket.
assert {row["id"] for row in ObjectiveStore(legacy_id).list()} == {before["id"]}
assert EventLedger(legacy_id).lifetime_summary()["events"] >= 1
assert TimingModel(legacy_id).snapshot()["activities"]["docking"]["sample_count"] == 1
assert SpecialistWorkflows(legacy_id).mining.snapshot()["session"] is not None

# Re-running adoption for the recorded owner picks up a table introduced after
# the original marker, without allowing a later profile to steal it.
late = ObjectiveStore("default").create("Late optional-schema row")
marketdb.ensure_commander_profile("Beta", galaxy_mode="legacy")
assert late["id"] in {row["id"] for row in ObjectiveStore(legacy_id).list()}
marketdb.ensure_commander_profile("Gamma", galaxy_mode="live")
assert late["id"] not in {row["id"] for row in ObjectiveStore().list()}

# A running account switch buffers the new file prefix. The Live Fileheader is
# neither written to Beta's Legacy ledger nor exposed alongside Beta's state.
new_file = "Journal.2026-07-12T110000.01.log"
watcher.handle_event({
    "timestamp": "2026-07-12T11:00:00Z", "event": "Fileheader", "gameversion": "4.1",
}, source_file=new_file, source_line=1)
assert state.commander is None and state.commander_id is None
assert all(
    row.get("source_file") != new_file
    for row in EventLedger(legacy_id).query(event_types=["Fileheader"], limit=100)
)
watcher.handle_event({
    "timestamp": "2026-07-12T11:00:01Z", "event": "Commander", "Name": "Gamma",
}, source_file=new_file, source_line=2)
gamma_id = marketdb.commander_profile_id("Gamma", "live")
gamma_prefix = EventLedger(gamma_id).query(
    event_types=["Fileheader", "Commander"], limit=10, ascending=True)
assert [(row["source_file"], row["source_line"]) for row in gamma_prefix] == [
    (new_file, 1), (new_file, 2),
]

# Automatic community enrichment is Live-only. Legacy local survey state must
# not call or merge Spansh even when an id64 happens to match.
calls = []
original = spansh.system_genuses
spansh.system_genuses = lambda id64: calls.append(id64) or {"Beta A 1": {}}
try:
    state.update(galaxy_mode="legacy", system="Beta", system_address=42,
                 bio_community={"id64": 42, "bodies": {"stale": {}}})
    watcher._live = True
    watcher._fetch_community_bio(42, "Beta")
finally:
    spansh.system_genuses = original
assert calls == [] and state.bio_community == {}

print("profile handoff OK: atomic reset, optional-table adoption, Legacy isolation")
