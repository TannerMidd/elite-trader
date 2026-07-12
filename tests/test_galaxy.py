"""Galaxy page data (Powerplay 2.0, BGS factions/conflicts, community goals,
squadron) + v2.0.0 hardening: EDDN Legacy filtering, gameversion stamping,
and the server's Host/Origin request guard."""
import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

_tmp = tempfile.TemporaryDirectory()
os.environ["ET_DATA_DIR"] = _tmp.name

from elite.journal import JournalWatcher  # noqa: E402
from elite.state import AppState  # noqa: E402

with tempfile.TemporaryDirectory() as td:
    state = AppState()
    w = JournalWatcher(state, journal_dir=td)

    # ---------- Powerplay pledge lifecycle ----------

    # Real journals establish the profile before commander-owned snapshots.
    w.handle_event({"timestamp": "2026-07-12T09:00:00Z", "event": "Fileheader",
                    "gameversion": "4.1"})
    w.handle_event({"timestamp": "2026-07-12T09:00:01Z", "event": "LoadGame",
                    "Commander": "TEST", "Credits": 1000})

    w.handle_event({"timestamp": "t", "event": "Powerplay", "Power": "Edmund Mahon",
                    "Rank": 0, "Merits": 0, "TimePledged": 2682})
    pp = state.snapshot()["galaxy"]["powerplay"]
    assert pp["power"] == "Edmund Mahon" and pp["rank"] == 0
    assert pp["session_merits"] == 0

    w.handle_event({"timestamp": "t", "event": "PowerplayMerits", "Power": "Edmund Mahon",
                    "MeritsGained": 120, "TotalMerits": 120})
    w.handle_event({"timestamp": "t", "event": "PowerplayMerits", "Power": "Edmund Mahon",
                    "MeritsGained": 40, "TotalMerits": 160})
    w.handle_event({"timestamp": "t", "event": "PowerplayRank", "Power": "Edmund Mahon", "Rank": 1})
    pp = state.snapshot()["galaxy"]["powerplay"]
    assert pp["merits"] == 160 and pp["session_merits"] == 160 and pp["rank"] == 1

    # A new session resets the session tally but keeps the pledge.
    w.handle_event({"timestamp": "2026-07-12T09:59:59Z", "event": "Fileheader",
                    "gameversion": "4.1"})
    w.handle_event({"timestamp": "2026-07-12T10:00:00Z", "event": "LoadGame",
                    "Commander": "TEST", "Credits": 1000})
    pp = state.snapshot()["galaxy"]["powerplay"]
    assert pp["session_merits"] == 0 and pp["merits"] == 160

    # ---------- system politics on FSDJump (real journal shapes) ----------

    w.handle_event({
        "timestamp": "t", "event": "FSDJump", "StarSystem": "Swoilz PT-L b3",
        "SystemAddress": 7269634680321, "StarPos": [131.06, -59.69, 234.53],
        "JumpDist": 13.7,
        "Factions": [
            {"Name": "Imperial Wargrannys", "FactionState": "War", "Government": "Feudal",
             "Influence": 0.201629, "Allegiance": "Empire", "MyReputation": 0.0,
             "ActiveStates": [{"State": "War"}]},
            {"Name": "Aisling Duval Foundation", "FactionState": "None", "Government": "Patronage",
             "Influence": 0.586558, "Allegiance": "Empire", "MyReputation": 15.0,
             "PendingStates": [{"State": "Expansion", "Trend": 0}]},
        ],
        "SystemFaction": {"Name": "Aisling Duval Foundation"},
        "Conflicts": [{"WarType": "war", "Status": "active",
                       "Faction1": {"Name": "Imperial Wargrannys", "Stake": "Sinha Landing", "WonDays": 2},
                       "Faction2": {"Name": "Celestial Light Brigade", "Stake": "Nye's Progress", "WonDays": 1}}],
        "ControllingPower": "A. Lavigny-Duval",
        "Powers": ["A. Lavigny-Duval", "Aisling Duval"],
        "PowerplayState": "Exploited",
        "PowerplayStateControlProgress": 0.048612,
        "PowerplayStateReinforcement": 15,
        "PowerplayStateUndermining": 0,
    })
    gal = state.snapshot()["galaxy"]
    assert [f["name"] for f in gal["factions"]] == \
        ["Aisling Duval Foundation", "Imperial Wargrannys"]  # influence-sorted
    assert gal["factions"][0]["pending_states"] == ["Expansion"]
    assert gal["factions"][1]["active_states"] == ["War"]
    assert gal["controlling_faction"] == "Aisling Duval Foundation"
    assert gal["conflicts"][0]["faction1"]["stake"] == "Sinha Landing"
    assert gal["conflicts"][0]["faction1"]["won_days"] == 2
    assert gal["pp_system"]["controlling"] == "A. Lavigny-Duval"
    assert gal["pp_system"]["state"] == "Exploited"
    assert abs(gal["pp_system"]["control_progress"] - 0.048612) < 1e-9

    # An unpopulated system clears the previous system's politics.
    w.handle_event({"timestamp": "t", "event": "FSDJump", "StarSystem": "Nowhere XY-Z a1",
                    "SystemAddress": 1, "StarPos": [0, 0, 0], "JumpDist": 20.0})
    gal = state.snapshot()["galaxy"]
    assert gal["factions"] == [] and gal["conflicts"] == [] and gal["pp_system"] is None

    print("galaxy politics OK: pledge lifecycle, factions/conflicts/pp capture + clear")

    # ---------- community goals & squadron ----------

    w.handle_event({"timestamp": "t", "event": "CommunityGoal", "CurrentGoals": [
        {"CGID": 726, "Title": "Alliance Research Initiative", "SystemName": "Kaushpoos",
         "MarketName": "Neville Horizons", "Expiry": "2026-07-17T15:00:00Z",
         "IsComplete": False, "CurrentTotal": 10062, "PlayerContribution": 562,
         "NumContributors": 462, "PlayerPercentileBand": 50,
         "TierReached": "Tier 2", "PlayerInTopRank": False},
    ]})
    goals = state.snapshot()["galaxy"]["community_goals"]
    assert len(goals) == 1 and goals[0]["title"] == "Alliance Research Initiative"
    assert goals[0]["contribution"] == 562 and goals[0]["tier"] == "2"

    # Each event is a full snapshot: a later one without the goal replaces it.
    w.handle_event({"timestamp": "t", "event": "CommunityGoal", "CurrentGoals": []})
    assert state.snapshot()["galaxy"]["community_goals"] == []

    w.handle_event({"timestamp": "t", "event": "SquadronStartup",
                    "SquadronName": "The Fatherhood", "CurrentRank": 1})
    assert state.snapshot()["galaxy"]["squadron"]["name"] == "The Fatherhood"
    w.handle_event({"timestamp": "t", "event": "LeftSquadron", "SquadronName": "The Fatherhood"})
    assert state.snapshot()["galaxy"]["squadron"] is None

    # ---------- Fileheader stamps the game version for EDDN ----------

    w.handle_event({"timestamp": "t", "event": "Fileheader", "part": 1,
                    "Odyssey": True, "gameversion": "4.4.0.3", "build": "r330683/r0 "})
    assert state.game_version == "4.4.0.3" and state.game_build == "r330683/r0 "

    print("community goals, squadron, fileheader OK")

# ---------- EDDN: Legacy filtering + upload header stamping ----------

from elite.eddn import EddnListener  # noqa: E402

legacy = EddnListener._is_legacy
assert legacy({"gameversion": "3.8.0.0"}) is True
assert legacy({"gameversion": "4.4.0.3"}) is False
assert legacy({"gameversion": "CAPI-Legacy"}) is True
assert legacy({"gameversion": "CAPI-Live"}) is False
assert legacy({"gameversion": ""}) is False   # unstamped: keep (see rationale)
assert legacy({}) is False
assert legacy(None) is False

from elite import eddn_upload  # noqa: E402

assert eddn_upload.SOFTWARE_NAME == "Frameshift"

print("eddn OK: legacy filter boundaries, software identity")

# ---------- server request-source guard ----------

from elite.server import _host_allowed, create_app  # noqa: E402

assert _host_allowed("127.0.0.1:8666")
assert _host_allowed("localhost:8666")
assert _host_allowed("192.168.1.50:8666")
assert _host_allowed("10.0.0.2")
assert not _host_allowed("evil.example.com")      # DNS rebinding
assert not _host_allowed("8.8.8.8:8666")          # public IP: never port-forward
assert not _host_allowed("")

app = create_app(AppState())
client = app.test_client()

# Cross-site POST (what a malicious web page can fire at localhost) -> blocked
# before any endpoint logic runs, so an unrouted path shows the guard cleanly.
r = client.post("/api/nope", headers={"Origin": "https://evil.example.com"})
assert r.status_code == 403, r.status_code
# Same-origin POST -> passes the guard (404/405: unrouted, but not blocked).
r = client.post("/api/nope", headers={"Origin": "http://localhost"}, json={})
assert r.status_code in (404, 405), r.status_code
# No Origin (curl, scripts) -> unaffected.
r = client.get("/api/state")
assert r.status_code == 200, r.status_code
# Rebinding Host on a plain GET -> blocked.
r = client.get("/api/state", headers={"Host": "evil.example.com"})
assert r.status_code == 403, r.status_code

print("server guard OK: cross-site POST + rebinding Host rejected, LAN + curl untouched")

# ---------- updater: rename continuity ----------

from elite import updater  # noqa: E402

assert updater.ASSET_NAMES == ("Frameshift.exe", "EliteTrader.exe")
assert updater.REPO.endswith("frameshift")
assert updater.parse_version("v2.0.0") > updater.parse_version("1.16.0")

print("updater OK: dual asset names, new repo, version ordering across the rename")
