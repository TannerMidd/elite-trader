"""Combat tracker: bounty/bond session counters and massacre stack math."""
import json
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from elite.journal import JournalWatcher
from elite.state import AppState

with tempfile.TemporaryDirectory() as td:
    state = AppState()
    w = JournalWatcher(state, journal_dir=td)
    w._live = True

    def accept(mid, giver, target, kills, reward, name="Mission_Massacre"):
        w.handle_event({"timestamp": "t", "event": "MissionAccepted", "MissionID": mid,
                        "Name": name, "LocalisedName": "Massacre pirates",
                        "Faction": giver, "TargetFaction": target,
                        "KillCount": kills, "Reward": reward})

    # Three massacre missions on one target from two givers:
    # Giver A: 10 + 8 = 18 kills; Giver B: 12 kills -> stack needs max(18, 12) = 18.
    accept(1, "Giver A", "Crimson Pirates", 10, 5_000_000)
    accept(2, "Giver A", "Crimson Pirates", 8, 4_000_000)
    accept(3, "Giver B", "Crimson Pirates", 12, 6_000_000)
    # A non-massacre combat mission and a delivery must not join the stack.
    w.handle_event({"timestamp": "t", "event": "MissionAccepted", "MissionID": 4,
                    "Name": "Mission_Assassinate", "LocalisedName": "Assassinate X",
                    "Faction": "Giver A", "TargetFaction": "Crimson Pirates",
                    "KillCount": None, "Reward": 1})

    snap = state.snapshot()["combat"]
    assert len(snap["massacre"]) == 1, snap["massacre"]
    s = snap["massacre"][0]
    assert s["faction"] == "Crimson Pirates" and s["missions"] == 3 and s["givers"] == 2, s
    assert s["kills_needed"] == 18 and s["kills_done"] == 0, s
    assert s["reward"] == 15_000_000, s

    # Kills against the target count once each, whoever pays the bounty.
    for i in range(17):
        w.handle_event({"timestamp": "t", "event": "Bounty", "VictimFaction": "Crimson Pirates",
                        "TotalReward": 100_000, "Rewards": [{"Faction": "Fed", "Reward": 100_000}]})
    # A kill against an unrelated faction: session counter only.
    w.handle_event({"timestamp": "t", "event": "Bounty", "VictimFaction": "Bystanders",
                    "TotalReward": 50_000})
    snap = state.snapshot()["combat"]
    assert snap["kills"] == 18 and snap["bounty_cr"] == 17 * 100_000 + 50_000, snap
    s = snap["massacre"][0]
    assert s["kills_done"] == 17 and not s["complete"], s
    assert not any(a["code"] == "massacre" for a in state.snapshot()["alerts"])

    # The 18th stack kill (a CZ bond this time) completes the stack -> one alert.
    w.handle_event({"timestamp": "t", "event": "FactionKillBond", "VictimFaction": "Crimson Pirates",
                    "AwardingFaction": "Empire", "Reward": 80_000})
    snap = state.snapshot()["combat"]
    s = snap["massacre"][0]
    assert s["complete"] and s["kills_done"] == 18, s
    assert snap["bonds_cr"] == 80_000, snap
    massacre_alerts = [a for a in state.snapshot()["alerts"] if a["code"] == "massacre"]
    assert len(massacre_alerts) == 1, massacre_alerts

    # Overkill doesn't re-alert and kills_done stays capped at needed.
    w.handle_event({"timestamp": "t", "event": "Bounty", "VictimFaction": "Crimson Pirates",
                    "TotalReward": 1})
    s = state.snapshot()["combat"]["massacre"][0]
    assert s["kills_done"] == 18, s
    assert len([a for a in state.snapshot()["alerts"] if a["code"] == "massacre"]) == 1

    # Handing in all missions clears the stack AND resets the faction counter,
    # so a fresh stack starts from zero.
    for mid in (1, 2, 3):
        w.handle_event({"timestamp": "t", "event": "MissionCompleted", "MissionID": mid, "Reward": 0})
    snap = state.snapshot()["combat"]
    assert snap["massacre"] == [], snap["massacre"]
    accept(9, "Giver C", "Crimson Pirates", 5, 1_000_000)
    s = state.snapshot()["combat"]["massacre"][0]
    assert s["kills_done"] == 0 and s["kills_needed"] == 5, s

print("combat OK: stack math (max giver), bounty+bond counting, completion alert, reset on hand-in")
print("ALL COMBAT TESTS PASSED")
