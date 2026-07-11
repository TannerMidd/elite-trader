"""FSD-injection (jumponium) readiness: recipe math from the raw-material
inventory, the snapshot's synth block, and the strand-advisory synth hint."""
import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

_tmp = tempfile.TemporaryDirectory()
os.environ["ET_DATA_DIR"] = _tmp.name

from elite import flight  # noqa: E402
from elite.journal import JournalWatcher  # noqa: E402
from elite.state import AppState  # noqa: E402

# ---------- recipe math (verified against EDDiscovery's FrontierData) ----------

assert flight.fsd_injections({}) == {"basic": 0, "standard": 0, "premium": 0}

raw = {"carbon": 5, "vanadium": 3, "germanium": 4, "cadmium": 1, "niobium": 2,
       "arsenic": 2, "polonium": 1, "yttrium": 9}
s = flight.fsd_injections(raw)
# basic = min(C5, V3, Ge4) = 3; standard adds Cd1, Nb2 -> 1;
# premium = min(C5, Ge4, Nb2, As2, Po1, Y9) = 1.
assert s == {"basic": 3, "standard": 1, "premium": 1}, s

# Vanadium is not in the premium recipe (it uses C/Ge/Nb/As/Po/Y).
s = flight.fsd_injections({"carbon": 1, "germanium": 1, "niobium": 1,
                           "arsenic": 1, "polonium": 1, "yttrium": 1})
assert s == {"basic": 0, "standard": 0, "premium": 1}, s

print("recipe math OK: basic/standard/premium counts from raw inventory")

# ---------- strand advisories carry the best available boost ----------

route_ahead = [
    {"system": "Dwarf1", "star_class": "Y", "scoopable": False},
    {"system": "Dwarf2", "star_class": "T", "scoopable": False},
    {"system": "HR 3495", "star_class": "A", "scoopable": True},
]

synth = {"basic": 2, "standard": 0, "premium": 1}
adv = flight.fuel_advisory(route_ahead, fuel_main=4, fuel_capacity=32, fuel_per_jump=5, synth=synth)
assert adv["code"] == "strand_risk", adv
assert "SYNTH READY premium ×1 (+100%)" in adv["text"], adv["text"]
assert "Premium FSD injection is ready" in adv["say"], adv["say"]

# Falls back to the strongest tier actually available.
adv = flight.fuel_advisory(route_ahead, 4, 32, 5, synth={"basic": 4, "standard": 0, "premium": 0})
assert "SYNTH READY basic ×4 (+25%)" in adv["text"], adv["text"]

# Nothing synthesizable (or no synth info): the advisory reads as before.
for empty in (None, {"basic": 0, "standard": 0, "premium": 0}):
    adv = flight.fuel_advisory(route_ahead, 4, 32, 5, synth=empty)
    assert adv["code"] == "strand_risk" and "SYNTH" not in adv["text"], adv

# scoop_now is solved by scooping, not synthesis — never gets the hint.
scoopable_here = [{"system": "Moultac", "star_class": "K", "scoopable": True}] + route_ahead
adv = flight.fuel_advisory(scoopable_here, 6, 32, 5, synth=synth)
assert adv["code"] == "scoop_now" and "SYNTH" not in adv["text"], adv

print("advisory OK: strand hints carry best tier, scoop_now untouched")

# ---------- journal + snapshot integration ----------

with tempfile.TemporaryDirectory() as td:
    state = AppState()
    w = JournalWatcher(state, journal_dir=td)
    w.handle_event({
        "timestamp": "t", "event": "Materials",
        "Raw": [{"Name": "carbon", "Count": 12}, {"Name": "vanadium", "Count": 2},
                {"Name": "germanium", "Count": 5}],
        "Manufactured": [], "Encoded": [],
    })
    snap = state.snapshot()
    assert snap["synth"] == {"basic": 2, "standard": 0, "premium": 0}, snap["synth"]

    # Collecting the missing metals unlocks higher tiers live.
    for name in ("cadmium", "niobium", "arsenic", "polonium", "yttrium"):
        w.handle_event({"timestamp": "t", "event": "MaterialCollected",
                        "Category": "Raw", "Name": name, "Count": 3})
    snap = state.snapshot()
    assert snap["synth"] == {"basic": 2, "standard": 2, "premium": 3}, snap["synth"]

print("integration OK: Materials/MaterialCollected drive the snapshot synth block")
print("ALL SYNTH TESTS PASSED")
