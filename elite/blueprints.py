"""Engineering planner: curated blueprint recipes, the material catalog needed
to reason about them, and the deficit / trade-conversion math.

DATA NOTES — community-derived (Inara/EDEngineer lineage), hand-curated:
- BLUEPRINTS is a *starter set* limited to recipes verified end-to-end; adding
  one is a dict entry, so the set grows release by release. Names are in-game
  display names.
- ROLLS_PER_GRADE is the planning estimate for how many rolls finish a grade;
  actual results vary with luck, so plans read "estimated".
- Material-trader ratios (same category): 6 -> 1 per grade UP, 1 -> 3 per
  grade DOWN. Cross-category trades cost double and are deliberately not
  suggested.
"""

ROLLS_PER_GRADE = {1: 2, 2: 2, 3: 3, 4: 4, 5: 5}

# Plain-language context so the planner explains itself to newer players.
BLUEPRINT_INFO = {
    "FSD Increased Range": {
        "what": "Makes your Frame Shift Drive jump farther — about +50% range at "
                "Grade 5. The best first upgrade for almost any ship.",
        "engineer": "Applied by Felicity Farseer in Deciat (easy early unlock), among others.",
    },
    "Thrusters Dirty Tuning": {
        "what": "Faster, more agile thrusters at the cost of extra heat — the "
                "go-to speed upgrade for nearly every build.",
        "engineer": "Applied by Professor Palin and others (higher grades need later unlocks).",
    },
}

# Where each material family actually comes from, in player terms.
MATERIAL_SOURCES = {
    "wake scans": "Scan the high-energy wakes ships leave after jumping away (needs a Frame Shift Wake Scanner; nav beacons and stations are good spots).",
    "firmware": "Downloaded at planetary settlement data points, or scanned from ships.",
    "chemical": "Dropped as salvage by destroyed ships; also mission rewards.",
    "mechanical components": "Dropped as salvage by destroyed ships (transport ships especially); also mission rewards.",
    "alloys": "Salvage from destroyed ships and crash sites; also mission rewards.",
}
_RAW_SOURCE = "Prospect rocks, outcrops and crystals with the SRV on planet surfaces."


def material_source(family):
    return MATERIAL_SOURCES.get(family) or (_RAW_SOURCE if family.startswith("raw") else None)

# name -> grade -> {material display name: qty per roll}
BLUEPRINTS = {
    "FSD Increased Range": {
        1: {"Atypical Disrupted Wake Echoes": 1},
        2: {"Atypical Disrupted Wake Echoes": 1, "Chemical Processors": 1},
        3: {"Phase Alloys": 1, "Chemical Processors": 1, "Strange Wake Solutions": 1},
        4: {"Manganese": 1, "Chemical Distillery": 1, "Eccentric Hyperspace Trajectories": 1},
        5: {"Arsenic": 1, "Chemical Manipulators": 1, "Datamined Wake Exceptions": 1},
    },
    "Thrusters Dirty Tuning": {
        1: {"Specialised Legacy Firmware": 1},
        2: {"Specialised Legacy Firmware": 1, "Mechanical Equipment": 1},
        3: {"Specialised Legacy Firmware": 1, "Chromium": 1, "Mechanical Components": 1},
        4: {"Modified Consumer Firmware": 1, "Selenium": 1, "Mechanical Components": 1},
        5: {"Cracked Industrial Firmware": 1, "Cadmium": 1, "Pharmaceutical Isolators": 1},
    },
}

# Material catalog for everything the recipes (and trade suggestions) touch:
# display name -> (journal symbol, kind, family, grade). Families are the
# material-trader columns; conversions are only suggested within a family.
MATERIALS = {
    # encoded: wake scans
    "Atypical Disrupted Wake Echoes": ("disruptedwakeechoes", "encoded", "wake scans", 1),
    "Anomalous FSD Telemetry": ("fsdtelemetry", "encoded", "wake scans", 2),
    "Strange Wake Solutions": ("wakesolutions", "encoded", "wake scans", 3),
    "Eccentric Hyperspace Trajectories": ("hyperspacetrajectories", "encoded", "wake scans", 4),
    "Datamined Wake Exceptions": ("dataminedwake", "encoded", "wake scans", 5),
    # encoded: firmware
    "Specialised Legacy Firmware": ("legacyfirmware", "encoded", "firmware", 1),
    "Modified Consumer Firmware": ("consumerfirmware", "encoded", "firmware", 2),
    "Cracked Industrial Firmware": ("industrialfirmware", "encoded", "firmware", 3),
    "Security Firmware Patch": ("securityfirmware", "encoded", "firmware", 4),
    "Modified Embedded Firmware": ("embeddedfirmware", "encoded", "firmware", 5),
    # manufactured: chemical
    "Chemical Storage Units": ("chemicalstorageunits", "manufactured", "chemical", 1),
    "Chemical Processors": ("chemicalprocessors", "manufactured", "chemical", 2),
    "Chemical Distillery": ("chemicaldistillery", "manufactured", "chemical", 3),
    "Chemical Manipulators": ("chemicalmanipulators", "manufactured", "chemical", 4),
    "Pharmaceutical Isolators": ("pharmaceuticalisolators", "manufactured", "chemical", 5),
    # manufactured: mechanical components
    "Mechanical Scrap": ("mechanicalscrap", "manufactured", "mechanical components", 1),
    "Mechanical Equipment": ("mechanicalequipment", "manufactured", "mechanical components", 2),
    "Mechanical Components": ("mechanicalcomponents", "manufactured", "mechanical components", 3),
    "Configurable Components": ("configurablecomponents", "manufactured", "mechanical components", 4),
    "Improvised Components": ("improvisedcomponents", "manufactured", "mechanical components", 5),
    # manufactured: alloys
    "Salvaged Alloys": ("salvagedalloys", "manufactured", "alloys", 1),
    "Galvanising Alloys": ("galvanisingalloys", "manufactured", "alloys", 2),
    "Phase Alloys": ("phasealloys", "manufactured", "alloys", 3),
    "Proto Light Alloys": ("protolightalloys", "manufactured", "alloys", 4),
    "Proto Radiolic Alloys": ("protoradiolicalloys", "manufactured", "alloys", 5),
    # raw (grades 1-4; families are the trader columns)
    "Carbon": ("carbon", "raw", "raw 2", 1),
    "Vanadium": ("vanadium", "raw", "raw 2", 2),
    "Niobium": ("niobium", "raw", "raw 2", 3),
    "Yttrium": ("yttrium", "raw", "raw 2", 4),
    "Phosphorus": ("phosphorus", "raw", "raw 3", 1),
    "Chromium": ("chromium", "raw", "raw 3", 2),
    "Molybdenum": ("molybdenum", "raw", "raw 3", 3),
    "Technetium": ("technetium", "raw", "raw 3", 4),
    "Sulphur": ("sulphur", "raw", "raw 4", 1),
    "Manganese": ("manganese", "raw", "raw 4", 2),
    "Cadmium": ("cadmium", "raw", "raw 4", 3),
    "Ruthenium": ("ruthenium", "raw", "raw 4", 4),
    "Iron": ("iron", "raw", "raw 5", 1),
    "Zinc": ("zinc", "raw", "raw 5", 2),
    "Tin": ("tin", "raw", "raw 5", 3),
    "Selenium": ("selenium", "raw", "raw 5", 4),
    "Nickel": ("nickel", "raw", "raw 6", 1),
    "Germanium": ("germanium", "raw", "raw 6", 2),
    "Tungsten": ("tungsten", "raw", "raw 6", 3),
    "Tellurium": ("tellurium", "raw", "raw 6", 4),
    "Rhenium": ("rhenium", "raw", "raw 7", 1),
    "Arsenic": ("arsenic", "raw", "raw 7", 2),
    "Mercury": ("mercury", "raw", "raw 7", 3),
    "Polonium": ("polonium", "raw", "raw 7", 4),
}

_BY_SYMBOL = {v[0]: name for name, v in MATERIALS.items()}


def material_info(name):
    sym, kind, family, grade = MATERIALS[name]
    return {"name": name, "symbol": sym, "kind": kind, "family": family,
            "grade": grade, "source": material_source(family)}


def requirements(blueprint, target_grade, rolls=None):
    """Total estimated materials for a G1→target climb: {material name: qty}."""
    recipe = BLUEPRINTS.get(blueprint)
    if not recipe:
        raise KeyError(f"Unknown blueprint: {blueprint}")
    rolls = rolls or ROLLS_PER_GRADE
    need = {}
    for g in range(1, int(target_grade) + 1):
        for mat, qty in (recipe.get(g) or {}).items():
            need[mat] = need.get(mat, 0) + qty * rolls.get(g, 3)
    return need


def convertible(surplus, from_grade, to_grade):
    """Units of the target material obtainable from `surplus` units of a
    same-family material at a trader. Down: 1 -> 3 per grade; up: 6 -> 1."""
    if surplus <= 0:
        return 0
    if from_grade > to_grade:          # trading down multiplies
        return surplus * 3 ** (from_grade - to_grade)
    if from_grade < to_grade:          # trading up divides
        return surplus // 6 ** (to_grade - from_grade)
    return surplus


def plan(blueprint, target_grade, inventory, rolls=None):
    """Deficit plan for one pinned blueprint.

    `inventory`: {journal symbol: count} across all material kinds.
    Returns {"blueprint", "grade", "materials": [row...], "craftable"} where a
    row carries need/have/deficit and, when short, the best same-family trader
    conversion that covers (part of) the gap."""
    need = requirements(blueprint, target_grade, rolls)
    reserved = {MATERIALS[m][0]: q for m, q in need.items()}  # needed elsewhere isn't surplus
    rows = []
    for mat, qty in sorted(need.items(), key=lambda kv: -MATERIALS[kv[0]][3]):
        info = material_info(mat)
        have = inventory.get(info["symbol"], 0)
        deficit = max(0, qty - have)
        row = {**info, "need": qty, "have": have, "deficit": deficit}
        if deficit:
            row["trade"] = _best_trade(info, deficit, inventory, reserved)
        rows.append(row)
    return {
        "blueprint": blueprint,
        "grade": int(target_grade),
        "materials": rows,
        "craftable": all(r["deficit"] == 0 for r in rows),
    }


def _best_trade(target, deficit, inventory, reserved):
    """Best single same-family conversion covering the most of `deficit`."""
    best = None
    for name, (sym, kind, family, grade) in MATERIALS.items():
        if family != target["family"] or name == target["name"]:
            continue
        surplus = inventory.get(sym, 0) - reserved.get(sym, 0)
        gain = convertible(surplus, grade, target["grade"])
        if gain <= 0:
            continue
        used = surplus if gain <= deficit else _cost_for(min(gain, deficit), grade, target["grade"])
        covered = min(gain, deficit)
        if best is None or covered > best["covers"]:
            best = {"from": name, "spend": used, "covers": covered,
                    "direction": "down" if grade > target["grade"] else "up"}
    return best


def _cost_for(wanted, from_grade, to_grade):
    """Units of the source material a trader takes to produce `wanted` units."""
    if from_grade > to_grade:
        per = 3 ** (from_grade - to_grade)
        return -(-wanted // per)  # ceil
    return wanted * 6 ** (to_grade - from_grade)
