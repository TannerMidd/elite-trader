"""Offline profile viewing never splits API, DB, and live journal ownership."""

import os
import sys
import tempfile
import threading
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
_tmp = tempfile.TemporaryDirectory()
os.environ["ET_DATA_DIR"] = _tmp.name

from elite import marketdb  # noqa: E402
from elite.journal import JournalWatcher  # noqa: E402
from elite.server import create_app  # noqa: E402
from elite.state import AppState  # noqa: E402


state = AppState()
watcher = JournalWatcher(state, journal_dir=_tmp.name)
watcher._live = True
watcher._publish_public_event = lambda _event: None
watcher.handle_event({
    "timestamp": "2026-07-18T10:00:00Z",
    "event": "Commander",
    "Name": "Alpha",
})
alpha = marketdb.commander_profile_id("Alpha", "live")
beta = marketdb.ensure_commander_profile("Beta", make_active=False)

app = create_app(state)
app.testing = True
client = app.test_client()


def assert_active_identity(commander_id):
    snapshot = client.get("/api/state").get_json()
    assert snapshot["commander_id"] == commander_id, snapshot
    overview = client.get("/api/profiles").get_json()
    assert overview["active_commander_id"] == commander_id, overview
    assert [p["id"] for p in overview["profiles"] if p["active"]] == [commander_id]
    analytics = client.get(
        "/api/analytics",
        headers={"X-Frameshift-Commander": commander_id},
    )
    assert analytics.status_code == 200, analytics.get_json()
    assert analytics.get_json()["commander_id"] == commander_id


assert state.snapshot()["game_running"] is True
assert_active_identity(alpha)

# A profile button cannot pull the API/UI away from a running journal owner.
blocked = client.post(f"/api/profiles/{beta}/activate")
assert blocked.status_code == 409, blocked.get_json()
assert blocked.get_json()["profile_live"] is True
assert_active_identity(alpha)

# Live analytics carry the watcher identity rather than consulting a mutable
# process-wide active-profile fallback.
watcher.handle_event({
    "timestamp": "2026-07-18T10:01:00Z",
    "event": "MarketBuy",
    "Type": "Gold",
    "Count": 2,
    "BuyPrice": 10,
    "TotalCost": 20,
})
conn = marketdb.connect()
owner = conn.execute(
    "SELECT commander_id FROM trade_log WHERE event='buy' AND symbol='gold'"
).fetchone()[0]
conn.close()
assert owner == alpha

# Once the game is closed, selecting an archived profile updates the database
# and /api/state together so the next frontend poll changes its scoped header.
watcher.handle_event({
    "timestamp": "2026-07-18T10:02:00Z",
    "event": "Shutdown",
})
selected = client.post(f"/api/profiles/{beta}/activate")
assert selected.status_code == 200, selected.get_json()
assert selected.get_json()["commander_id"] == beta
assert_active_identity(beta)
stale_alpha = client.get(
    "/api/analytics",
    headers={"X-Frameshift-Commander": alpha},
)
assert stale_alpha.status_code == 409
assert stale_alpha.get_json()["profile_changed"] is True

# Even during offline viewing, a watcher-owned derived write cannot land under
# the selected archive. A subsequent live event also atomically restores the
# watcher profile before the scoped API can serve another request.
watcher._on_marketsell({
    "timestamp": "2026-07-18T10:03:00Z",
    "Type": "Silver",
    "Count": 3,
    "SellPrice": 50,
    "TotalSale": 150,
})
assert_active_identity(beta)
conn = marketdb.connect()
owner = conn.execute(
    "SELECT commander_id FROM trade_log WHERE event='sell' AND symbol='silver'"
).fetchone()[0]
conn.close()
assert owner == alpha

# Deterministically pause a live event after it owns the transition guard.
# A simultaneous ACTIVATE request must wait, then observe game_running=True
# and fail instead of returning success from a stale offline snapshot.
original_reassert = watcher._reassert_live_commander
event_owns_transition = threading.Event()
release_event = threading.Event()
activation_finished = threading.Event()
activation_result = {}


def paused_reassert():
    event_owns_transition.set()
    assert release_event.wait(5), "test did not release the live transition"
    original_reassert()


def resume_live_journal():
    watcher.handle_event({
        "timestamp": "2026-07-18T10:04:00Z",
        "event": "MarketSell",
        "Type": "Bauxite",
        "Count": 1,
        "SellPrice": 25,
        "TotalSale": 25,
    })


def race_activation():
    with app.test_client() as race_client:
        response = race_client.post(f"/api/profiles/{beta}/activate")
        activation_result["status"] = response.status_code
        activation_result["payload"] = response.get_json()
    activation_finished.set()


watcher._reassert_live_commander = paused_reassert
journal_thread = threading.Thread(target=resume_live_journal)
activation_thread = threading.Thread(target=race_activation)
journal_thread.start()
assert event_owns_transition.wait(5), "live event did not enter the transition"
activation_thread.start()
assert not activation_finished.wait(0.1), "ACTIVATE bypassed the live transition guard"
release_event.set()
journal_thread.join(5)
activation_thread.join(5)
watcher._reassert_live_commander = original_reassert
assert not journal_thread.is_alive()
assert not activation_thread.is_alive()
assert activation_result["status"] == 409, activation_result
assert activation_result["payload"]["profile_live"] is True
assert_active_identity(alpha)

# A real journal handoff remains authoritative and leaves all three identity
# surfaces on the newly logged-in commander.
watcher.handle_event({
    "timestamp": "2026-07-18T10:05:00Z",
    "event": "Fileheader",
    "gameversion": "4.1.0.0",
    "build": "r1",
})
watcher.handle_event({
    "timestamp": "2026-07-18T10:05:01Z",
    "event": "Commander",
    "Name": "Beta",
})
assert_active_identity(beta)

print("profile activation coherent: offline view, live writes, and handoff stay scoped")
