"""Live and Legacy never share commander history or community-market advice."""

import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
_tmp = tempfile.TemporaryDirectory()
os.environ["ET_DATA_DIR"] = _tmp.name

from elite import marketdb, spansh  # noqa: E402
from elite.journal import JournalWatcher  # noqa: E402
from elite.server import create_app  # noqa: E402
from elite.state import AppState  # noqa: E402


live_id = marketdb.ensure_commander_profile("Same Name", galaxy_mode="live")
marketdb.log_income(1, "mission", 100)
legacy_expected = marketdb.commander_profile_id("Same Name", "legacy")
assert live_id == marketdb.commander_profile_id("Same Name")
assert legacy_expected != live_id

state = AppState()
watcher = JournalWatcher(state, journal_dir=_tmp.name)
watcher.handle_event({
    "timestamp": "2026-07-12T12:00:00Z", "event": "Fileheader",
    "gameversion": "3.8.0.0", "build": "legacy",
})
watcher.handle_event({
    "timestamp": "2026-07-12T12:00:01Z", "event": "Commander", "Name": "Same Name",
})
assert state.galaxy_mode == "legacy" and state.commander_id == legacy_expected
assert marketdb.active_commander_id() == legacy_expected

conn = marketdb.connect_user()
profiles = dict(conn.execute("SELECT id, galaxy_mode FROM commander_profiles WHERE id IN (?, ?)",
                             (live_id, legacy_expected)))
assert profiles == {live_id: "live", legacy_expected: "legacy"}
assert conn.execute(
    "SELECT COUNT(*) FROM income_log WHERE commander_id = ?", (live_id,)
).fetchone()[0] == 1
assert conn.execute(
    "SELECT COUNT(*) FROM income_log WHERE commander_id = ?", (legacy_expected,)
).fetchone()[0] == 0
conn.close()

app = create_app(state)
app.testing = True
blocked = app.test_client().post("/api/trade-route", json={})
assert blocked.status_code == 409 and blocked.get_json()["galaxy_mode"] == "legacy"
neutron_called = []
original_neutron = spansh.neutron_route
spansh.neutron_route = lambda **kwargs: neutron_called.append(kwargs) or {"route": []}
try:
    blocked = app.test_client().post("/api/neutron", json={"to": "Colonia"})
finally:
    spansh.neutron_route = original_neutron
assert blocked.status_code == 409 and not neutron_called
assert app.test_client().get(
    "/api/specialists",
    headers={"X-Frameshift-Commander": legacy_expected},
).status_code == 200

print("galaxy mode OK: profile isolation and fail-closed Live community tools")
