#!/usr/bin/env python3
"""Build Frameshift's bundled engineering catalog from EDEngineer reference data.

The input files are MIT-licensed and contain ship engineering, synthesis,
technology-broker/Guardian unlocks and Odyssey suit/weapon recipes.  The output
is normalised, deterministic and compressed for the one-file desktop build.

Usage:
    python tools/build_engineering_catalog.py PATH/TO/EDEngineer/Resources/Data \
        elite/data/engineering_catalog.json.gz
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import io
import json
import re
from pathlib import Path

RARITY_GRADE = {
    "VeryCommon": 1,
    # EDEngineer's names follow Frontier's rarity labels: Common is G2 and
    # Standard is G3 (the names are easy to order incorrectly).
    "Common": 2,
    "Standard": 3,
    "Rare": 4,
    "VeryRare": 5,
}

NAME_FIXES = {
    ("Weapon", "Manticore Opressor"): "Manticore Oppressor",
}


def slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def material_kind(row):
    if row.get("Kind") == "Data":
        return "encoded"
    if row.get("Kind") == "Material":
        return str(row.get("Subkind") or "material").lower()
    if row.get("Kind") == "OdysseyIngredient":
        return "odyssey"
    if row.get("Kind") == "Commodity":
        return "commodity"
    return str(row.get("Kind") or "other").lower()


def recipe_kind(row):
    engineers = set(row.get("Engineers") or [])
    if "@Synthesis" in engineers:
        return "synthesis"
    if "@Technology" in engineers:
        return "unlock"
    if row.get("Grade") is not None:
        if row.get("Type") in {"Suit", "Weapon"} and "@Merchant" in engineers:
            return "odyssey-upgrade"
        if row.get("Type") in {"Suit", "Weapon"}:
            return "odyssey-modification"
        return "ship-engineering"
    if row.get("Type") in {
        "AFM Refill", "AX Explosive Munitions", "AX Remote Flak Munitions",
        "AX Small Calibre Munitions", "Enzyme Missile Launcher Munitions",
        "Explosive Munitions", "FSD Injection", "Flechette Launcher Munitions",
        "Guardian Gauss Cannon Munitions", "Guardian Plasma Charger Munitions",
        "Guardian Shard Cannon Munitions", "Heat Sink Launcher", "High Velocity Munitions",
        "Large Calibre Munitions", "Limpets", "Plasma Munitions", "Shock Cannon Munitions",
        "Small Calibre Munitions", "SRV Ammo Restock", "SRV Refuel", "SRV Repair",
    }:
        return "synthesis"
    if row.get("Type") in {"Guardian", "Human", "Unlock"}:
        return "unlock"
    return "experimental"


def build(source: Path):
    raw_blueprints = read_json(source / "blueprints.json")
    raw_materials = read_json(source / "entryData.json")
    materials = {}
    for row in raw_materials:
        name = row["Name"]
        materials[name] = {
            "name": name,
            "symbol": str(row.get("FormattedName") or slug(name)).lower(),
            "kind": material_kind(row),
            "grade": RARITY_GRADE.get(row.get("Rarity")),
            "family": row.get("Group"),
            "sources": list(row.get("OriginDetails") or []),
            "value_cr": row.get("ValueCr"),
            "barter_cost": row.get("BarterCost"),
            "barter_value": row.get("BarterValue"),
            "settlement_types": list(row.get("SettlementType") or []),
            "building_types": list(row.get("BuildingType") or []),
            "container_types": list(row.get("ContainerType") or []),
        }

    groups = {}
    recipes = []
    for row in raw_blueprints:
        module, name = row["Type"], row["Name"]
        name = NAME_FIXES.get((module, name), name)
        group_id = f"{slug(module)}--{slug(name)}"
        grade = row.get("Grade")
        recipe_id = f"{group_id}--g{grade}" if grade is not None else group_id
        ingredients = []
        for ingredient in row.get("Ingredients") or []:
            material = materials[ingredient["Name"]]
            ingredients.append({
                "name": material["name"],
                "symbol": material["symbol"],
                "quantity": int(ingredient.get("Size") or 0),
                "kind": material["kind"],
                "grade": material["grade"],
                "family": material["family"],
            })
        recipe = {
            "id": recipe_id,
            "group_id": group_id,
            "module": module,
            "name": name,
            "display_name": f"{module} · {name}",
            "kind": recipe_kind(row),
            "grade": grade,
            "engineers": list(row.get("Engineers") or []),
            "ingredients": ingredients,
            "effects": [
                {
                    "effect": effect.get("Effect"),
                    "property": effect.get("Property"),
                    "good": bool(effect.get("IsGood")),
                }
                for effect in row.get("Effects") or []
            ],
            "coriolis_guid": row.get("CoriolisGuid"),
        }
        recipes.append(recipe)
        group = groups.setdefault(group_id, {
            "id": group_id,
            "module": module,
            "name": name,
            "display_name": recipe["display_name"],
            "kind": recipe["kind"],
            "grades": [],
            "recipe_ids": [],
            "engineers": [],
        })
        group["recipe_ids"].append(recipe_id)
        if grade is not None:
            group["grades"].append(int(grade))
        group["engineers"] = sorted(set(group["engineers"]) | set(recipe["engineers"]))

    for group in groups.values():
        group["grades"] = sorted(set(group["grades"]))
        group["recipe_ids"].sort()

    source_hash = hashlib.sha256()
    for name in ("blueprints.json", "entryData.json"):
        source_hash.update((source / name).read_bytes())
    return {
        "schema_version": 1,
        "normalizations": {
            "material_grades": "elite-v1",
            "recipe_kinds": "frameshift-v1",
        },
        "source": {
            "project": "EDEngineer",
            "url": "https://github.com/msarilar/EDEngineer",
            "license": "MIT",
            "sha256": source_hash.hexdigest(),
        },
        "stats": {
            "groups": len(groups),
            "recipes": len(recipes),
            "materials": len(materials),
        },
        "groups": sorted(groups.values(), key=lambda value: value["display_name"].casefold()),
        "recipes": sorted(recipes, key=lambda value: (value["display_name"].casefold(), value["grade"] or 0)),
        "materials": sorted(materials.values(), key=lambda value: value["name"].casefold()),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    catalog = build(args.source)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("wb") as raw:
        with gzip.GzipFile(filename="", mode="wb", fileobj=raw, compresslevel=9, mtime=0) as compressed:
            with io.TextIOWrapper(compressed, encoding="utf-8") as handle:
                json.dump(catalog, handle, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    print(json.dumps(catalog["stats"], sort_keys=True))


if __name__ == "__main__":
    main()
