"""Fuel-scoop planning + one-shot flight alerts, end to end.

Covers the pure advisory logic in elite.flight and the JournalWatcher handlers
that feed it (FuelUsed capture, NavRoute.json parsing, and the interdiction /
hull-damage / first-discovery voice alerts)."""
import json
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from elite import flight
from elite.journal import JournalWatcher
from elite.state import AppState

# ---------- pure logic: scoopability ----------

assert [flight.is_scoopable(c) for c in ("K", "M", "A", "G", "B", "F", "O")] == [True] * 7
assert [flight.is_scoopable(c) for c in ("L", "T", "Y", "N", "D", "H", "MS")] == [False] * 7
assert flight.is_scoopable("TTS") and flight.is_scoopable("AeBe")  # proto-stars scoop
assert not flight.is_scoopable("") and not flight.is_scoopable(None)

# ---------- pure logic: route trimming + advisories ----------

route = [
    {"system": "Changthini", "address": 1, "star_class": "K"},
    {"system": "Moultac", "address": 2, "star_class": "K"},
    {"system": "Dwarf1", "address": 3, "star_class": "Y"},
    {"system": "Dwarf2", "address": 4, "star_class": "T"},
    {"system": "HR 3495", "address": 5, "star_class": "A"},
]

# Off-route -> no trimmed route, so no false advisories.
assert flight.route_ahead(route, 999, "Nowhere") == []
# Match by address; current system is included as ahead[0].
ahead = flight.route_ahead(route, 2, "Moultac")
assert [s["system"] for s in ahead] == ["Moultac", "Dwarf1", "Dwarf2", "HR 3495"]
assert [s["scoopable"] for s in ahead] == [True, False, False, True]

# Plenty of fuel at a scoopable star, but two dry jumps ahead -> top-off warning.
adv = flight.fuel_advisory(ahead, fuel_main=25, fuel_capacity=32, fuel_per_jump=5)
assert adv["code"] == "dry_stretch" and adv["level"] == "warn", adv
assert "2 jumps" in adv["say"], adv

# Low fuel at that scoopable star: tank ~1 jump, next fuel star 3 away -> SCOOP NOW.
adv = flight.fuel_advisory(ahead, fuel_main=6, fuel_capacity=32, fuel_per_jump=5)
assert adv["code"] == "scoop_now" and adv["level"] == "critical", adv
assert "3 jumps" in adv["say"], adv

# Same low fuel but sitting on a non-scoopable star -> strand risk, not scoop-now.
ahead_dry = flight.route_ahead(route, 3, "Dwarf1")  # Dwarf1(Y) -> Dwarf2(T) -> HR3495(A)
adv = flight.fuel_advisory(ahead_dry, fuel_main=4, fuel_capacity=32, fuel_per_jump=5)
assert adv["code"] == "strand_risk" and adv["level"] == "critical", adv

# No route ahead but genuinely low fuel -> low_fuel warning still fires.
adv = flight.fuel_advisory([], fuel_main=5, fuel_capacity=32, fuel_per_jump=5)
assert adv["code"] == "low_fuel", adv
# No route, healthy fuel -> nothing.
assert flight.fuel_advisory([], fuel_main=30, fuel_capacity=32, fuel_per_jump=5) is None

print("flight logic OK: scoopability, route trim, scoop_now/dry_stretch/strand/low_fuel")

# ---------- journal integration: nav advisory + alerts ----------

nav_route_file = {
    "timestamp": "2026-07-08T23:01:10Z", "event": "NavRoute",
    "Route": [
        {"StarSystem": "Moultac", "SystemAddress": 2, "StarPos": [0, 0, 0], "StarClass": "K"},
        {"StarSystem": "Dwarf1", "SystemAddress": 3, "StarPos": [1, 0, 0], "StarClass": "Y"},
        {"StarSystem": "Dwarf2", "SystemAddress": 4, "StarPos": [2, 0, 0], "StarClass": "T"},
        {"StarSystem": "HR 3495", "SystemAddress": 5, "StarPos": [3, 0, 0], "StarClass": "A"},
    ],
}

with tempfile.TemporaryDirectory() as td:
    (Path(td) / "NavRoute.json").write_text(json.dumps(nav_route_file), encoding="utf-8")
    state = AppState()
    w = JournalWatcher(state, journal_dir=td)
    w._live = True  # simulate live tailing so alerts fire

    # Arrive at Moultac (scoopable) with a real fuel burn, then read NavRoute.json.
    w.handle_event({"timestamp": "t", "event": "FSDJump", "StarSystem": "Moultac",
                    "SystemAddress": 2, "StarPos": [0, 0, 0], "JumpDist": 40,
                    "FuelUsed": 6.0, "FuelLevel": 7.0})
    state.update(fuel_capacity=32)
    w._refresh_status_files(force=True)  # parses NavRoute.json

    snap = state.snapshot()
    nav = snap["nav"]
    assert nav["fuel_per_jump"] == 6.0, nav                # from FuelUsed
    assert nav["jumps_of_fuel"] == 1, nav                  # 7 / 6
    assert nav["ahead"][0]["system"] == "Moultac", nav
    # tank ~1 jump, next fuel star (HR 3495) is 3 jumps out -> SCOOP NOW critical
    assert nav["advisory"]["code"] == "scoop_now", nav["advisory"]

    # No fuel nagging while docked.
    w.handle_event({"timestamp": "t", "event": "Docked", "StarSystem": "Moultac",
                    "SystemAddress": 2, "StationName": "Test Hub", "StationType": "Coriolis"})
    assert state.snapshot()["nav"]["advisory"] is None
    w.handle_event({"timestamp": "t", "event": "Undocked"})

    # Interdiction, hull damage (crosses 50% then 25%), and a first-discovery scan.
    w.handle_event({"timestamp": "t", "event": "Interdicted", "IsPlayer": False,
                    "Interdictor": "Pirate Lord", "Submitted": False})
    w.handle_event({"timestamp": "t", "event": "HullDamage", "Health": 0.45, "PlayerPilot": True})
    w.handle_event({"timestamp": "t", "event": "HullDamage", "Health": 0.20, "PlayerPilot": True})
    w.handle_event({"timestamp": "t", "event": "HullDamage", "Health": 0.18, "PlayerPilot": True})  # same bucket, no dup
    w.handle_event({"timestamp": "t", "event": "Scan", "ScanType": "AutoScan",
                    "BodyName": "Moultac A", "BodyID": 0, "StarType": "K", "WasDiscovered": False})
    w.handle_event({"timestamp": "t", "event": "Scan", "ScanType": "AutoScan",
                    "BodyName": "Moultac A", "BodyID": 0, "StarType": "K", "WasDiscovered": False})  # dup system, no repeat

    alerts = state.snapshot()["alerts"]
    codes = [a["code"] for a in alerts]
    assert codes == ["interdiction", "hull", "hull", "first_discovery"], codes
    hull_pcts = [a["text"] for a in alerts if a["code"] == "hull"]
    assert "50%" in hull_pcts[0] and "25%" in hull_pcts[1], hull_pcts
    assert alerts[0]["level"] == "critical" and alerts[-1]["code"] == "first_discovery"
    # ids strictly increasing so the UI can speak each exactly once
    assert [a["id"] for a in alerts] == sorted(a["id"] for a in alerts)

    # SRV/Nomad fuel must not overwrite the ship's tank (Flags bit 24 unset =
    # not in the main ship; the Fuel block is the vehicle's own tiny tank).
    IN_SHIP, IN_SRV = 0x01000000, 0x04000000
    w._apply_status({"Flags": IN_SHIP | 8, "Fuel": {"FuelMain": 20.0, "FuelReservoir": 0.6}})
    assert state.snapshot()["fuel_main"] == 20.0
    w._apply_status({"Flags": IN_SRV, "Fuel": {"FuelMain": 0.45, "FuelReservoir": 0.0}})
    assert state.snapshot()["fuel_main"] == 20.0, "SRV fuel clobbered the ship reading"
    # With 20t (~3 jumps) the standing advisory stays the mild dry-stretch
    # top-off; had the 0.45t SRV tank been taken, it would escalate to a
    # critical scoop_now. Same check as before boarding the SRV.
    adv = state.snapshot()["nav"]["advisory"]
    assert adv and adv["code"] == "dry_stretch", adv
    w._apply_status({"Flags": IN_SHIP, "Fuel": {"FuelMain": 19.0, "FuelReservoir": 0.6}})
    assert state.snapshot()["fuel_main"] == 19.0  # back aboard -> live again

print("journal integration OK: FuelUsed->advisory, docked-mute, interdiction/hull/first-discovery alerts, SRV fuel ignored")
print("ALL FLIGHT TESTS PASSED")
