"""Bundled, offline Elite Dangerous engineering reference catalog.

The source data is generated at release time from the MIT-licensed EDEngineer
reference files and shipped inside Frameshift.  Runtime code never downloads
data, authenticates, or calls a third-party service.

This module deliberately owns the small amount of source normalisation that is
needed by consumers.  In particular EDEngineer's ``Common`` and ``Standard``
rarities correspond to Elite material grades 2 and 3 respectively, and older
catalog builds classified graded synthesis recipes as ship engineering.
"""

from __future__ import annotations

import gzip
import json
import re
import sys
from functools import lru_cache
from pathlib import Path


CATALOG_FILENAME = "engineering_catalog.json.gz"
SUPPORTED_SCHEMA = 1

KIND_LABELS = {
    "ship-engineering": "Ship engineering",
    "experimental": "Ship experimentals",
    "synthesis": "Synthesis",
    "unlock": "Technology & engineer unlocks",
    "odyssey-upgrade": "Odyssey upgrades",
    "odyssey-modification": "Odyssey modifications",
}
KIND_ORDER = tuple(KIND_LABELS)

# Journal identifiers used by Elite do not always match EDEngineer's current
# FormattedName.  These aliases also make both v1 planner recipes migrate with
# their already-recorded inventory, without depending on UI language.
JOURNAL_SYMBOL_ALIASES = {
    "Atypical Disrupted Wake Echoes": ("disruptedwakeechoes",),
    "Anomalous FSD Telemetry": ("fsdtelemetry",),
    "Strange Wake Solutions": ("wakesolutions",),
    "Eccentric Hyperspace Trajectories": ("hyperspacetrajectories",),
    "Datamined Wake Exceptions": ("dataminedwake",),
    "Specialised Legacy Firmware": ("legacyfirmware",),
    "Modified Consumer Firmware": ("consumerfirmware",),
    "Cracked Industrial Firmware": ("industrialfirmware",),
    "Security Firmware Patch": ("securityfirmware",),
    "Modified Embedded Firmware": ("embeddedfirmware",),
}

# The upstream Odyssey data contains "Opressor" for G3-G5 and "Oppressor" for
# G2.  Keep all 505 source groups auditable, but merge that alias into one
# complete G2-G5 planner item and hide the misspelled duplicate from searches.
CATALOG_GROUP_ALIASES = {
    "weapon--manticore-opressor": "weapon--manticore-oppressor",
}


def _key(value) -> str:
    """Case/punctuation-insensitive key used for names and journal symbols."""
    return re.sub(r"[^a-z0-9]+", "", str(value or "").casefold())


def _resource_path() -> Path:
    local = Path(__file__).resolve().parent / "data" / CATALOG_FILENAME
    if local.is_file():
        return local
    # Kept as a defensive fallback for alternative PyInstaller layouts.
    bundled = Path(getattr(sys, "_MEIPASS", "")) / "elite" / "data" / CATALOG_FILENAME
    if bundled.is_file():
        return bundled
    raise FileNotFoundError(f"Bundled engineering catalog is missing: {local}")


def _normal_kind(row: dict) -> str:
    engineers = set(row.get("engineers") or ())
    module = str(row.get("module") or "").casefold()
    if "@Synthesis" in engineers:
        return "synthesis"
    if "@Technology" in engineers:
        return "unlock"
    kind = row.get("kind") or "ship-engineering"
    if kind == "experimental" and module in {"suit", "weapon"}:
        return "odyssey-modification"
    return kind


def _normal_material(row: dict, grades_are_normalized=False) -> dict:
    out = dict(row)
    # EDEngineer rarity labels are not ordered alphabetically: Common is G2,
    # Standard is G3.  Catalogs produced before this was corrected contain the
    # two numeric values swapped for every regular material category.
    if not grades_are_normalized and out.get("kind") in {"raw", "manufactured", "encoded"}:
        if out.get("grade") == 2:
            out["grade"] = 3
        elif out.get("grade") == 3:
            out["grade"] = 2
    out["sources"] = tuple(s for s in (out.get("sources") or ()) if s)
    return out


@lru_cache(maxsize=1)
def load() -> dict:
    """Load, validate and index the packaged catalog once per process."""
    with gzip.open(_resource_path(), "rt", encoding="utf-8") as handle:
        source = json.load(handle)
    if source.get("schema_version") != SUPPORTED_SCHEMA:
        raise ValueError(
            f"Unsupported engineering catalog schema {source.get('schema_version')!r}; "
            f"expected {SUPPORTED_SCHEMA}"
        )

    grades_are_normalized = (
        (source.get("normalizations") or {}).get("material_grades") == "elite-v1"
    )
    materials = [
        _normal_material(row, grades_are_normalized)
        for row in source.get("materials") or ()
    ]
    by_material_symbol = {str(m["symbol"]).casefold(): m for m in materials}
    by_material_name = {_key(m["name"]): m for m in materials}
    aliases = {}
    for material in materials:
        aliases[_key(material["symbol"])] = material["symbol"]
        aliases[_key(material["name"])] = material["symbol"]
        for alias in JOURNAL_SYMBOL_ALIASES.get(material["name"], ()):
            aliases[_key(alias)] = material["symbol"]

    recipes = []
    by_recipe = {}
    for raw in source.get("recipes") or ():
        recipe = dict(raw)
        recipe["kind"] = _normal_kind(recipe)
        ingredients = []
        for ingredient in recipe.get("ingredients") or ():
            item = dict(ingredient)
            material = by_material_name.get(_key(item.get("name")))
            if material:
                item.update({
                    "symbol": material["symbol"],
                    "kind": material["kind"],
                    "grade": material["grade"],
                    "family": material["family"],
                })
            ingredients.append(item)
        recipe["ingredients"] = tuple(ingredients)
        recipe["effects"] = tuple(dict(effect) for effect in recipe.get("effects") or ())
        recipe["engineers"] = tuple(recipe.get("engineers") or ())
        recipes.append(recipe)
        by_recipe[recipe["id"]] = recipe

    groups = []
    by_group = {}
    for raw in source.get("groups") or ():
        group = dict(raw)
        group["kind"] = _normal_kind(group)
        group["grades"] = tuple(sorted(set(int(g) for g in group.get("grades") or ())))
        group["engineers"] = tuple(group.get("engineers") or ())
        group["recipes"] = tuple(
            by_recipe[recipe_id] for recipe_id in group.get("recipe_ids") or ()
            if recipe_id in by_recipe
        )
        # Search includes ingredients, sources and effects, not only the title.
        terms = [group.get("display_name"), group.get("module"), group.get("name"),
                 group["kind"], KIND_LABELS.get(group["kind"])]
        terms.extend(group["engineers"])
        for recipe in group["recipes"]:
            for ingredient in recipe["ingredients"]:
                terms.append(ingredient.get("name"))
                material = by_material_name.get(_key(ingredient.get("name")))
                if material:
                    terms.extend(material["sources"])
            for effect in recipe["effects"]:
                terms.extend((effect.get("property"), effect.get("effect")))
        group["search_text"] = " ".join(str(v) for v in terms if v).casefold()
        groups.append(group)
        by_group[group["id"]] = group

    for alias_id, target_id in CATALOG_GROUP_ALIASES.items():
        alias = by_group.get(alias_id)
        target = by_group.get(target_id)
        if not alias or not target:
            continue
        target["grades"] = tuple(sorted(set(target["grades"]) | set(alias["grades"])))
        target["recipes"] = tuple(sorted(
            target["recipes"] + alias["recipes"],
            key=lambda recipe: int(recipe.get("grade") or 0),
        ))
        target["engineers"] = tuple(sorted(set(target["engineers"]) | set(alias["engineers"])))
        target["search_text"] += " " + alias["search_text"]
        alias["alias_of"] = target_id

    expected = source.get("stats") or {}
    actual = {"groups": len(groups), "recipes": len(recipes), "materials": len(materials)}
    if any(expected.get(k) != v for k, v in actual.items()):
        raise ValueError(f"Engineering catalog is incomplete: expected {expected}, loaded {actual}")
    if any(not group["recipes"] for group in groups):
        raise ValueError("Engineering catalog contains a group without recipes")

    return {
        "schema_version": SUPPORTED_SCHEMA,
        "source": dict(source.get("source") or {}),
        "stats": actual,
        "groups": tuple(groups),
        "recipes": tuple(recipes),
        "materials": tuple(materials),
        "by_group": by_group,
        "by_recipe": by_recipe,
        "by_material_symbol": by_material_symbol,
        "by_material_name": by_material_name,
        "material_aliases": aliases,
    }


def canonical_material_symbol(value) -> str | None:
    """Return the bundled canonical symbol for a name/journal identifier."""
    return load()["material_aliases"].get(_key(value))


def material(value) -> dict | None:
    canonical = canonical_material_symbol(value)
    if not canonical:
        return None
    return load()["by_material_symbol"].get(canonical.casefold())


def group(group_id: str) -> dict:
    try:
        return load()["by_group"][group_id]
    except KeyError:
        raise KeyError(f"Unknown engineering catalog item: {group_id}") from None


def search(query="", kinds=None, module="", engineer="") -> list[dict]:
    """Search/filter summaries for the local catalog.

    All query words must match, but they may match title, engineer, ingredient,
    effect or source text.  This keeps the browser UI fast while still allowing
    useful searches such as ``selenium`` or ``high grade emissions``.
    """
    words = [word for word in str(query or "").casefold().split() if word]
    wanted_kinds = {str(k) for k in (kinds or ()) if k}
    module_key = str(module or "").casefold()
    engineer_key = str(engineer or "").casefold()
    rows = []
    for item in load()["groups"]:
        if item.get("alias_of"):
            continue
        if wanted_kinds and item["kind"] not in wanted_kinds:
            continue
        if module_key and module_key not in str(item.get("module") or "").casefold():
            continue
        if engineer_key and not any(engineer_key in e.casefold() for e in item["engineers"]):
            continue
        if any(word not in item["search_text"] for word in words):
            continue
        rows.append(summary(item))
    return rows


def summary(item: dict) -> dict:
    return {
        "id": item["id"],
        "display_name": item["display_name"],
        "module": item["module"],
        "name": item["name"],
        "kind": item["kind"],
        "kind_label": KIND_LABELS.get(item["kind"], item["kind"]),
        "grades": list(item["grades"]),
        "engineers": [e for e in item["engineers"] if not e.startswith("@")],
        "engineer_access": engineer_access(item),
        "alias_of": item.get("alias_of"),
    }


def engineer_access(item: dict) -> list[dict]:
    """Engineer names with the maximum grade each can actually apply."""
    access = {}
    for recipe in item.get("recipes") or ():
        grade = recipe.get("grade")
        for engineer in recipe.get("engineers") or ():
            if engineer.startswith("@"):
                continue
            if engineer not in access or (grade is not None and (access[engineer] or 0) < grade):
                access[engineer] = grade
    return [{"name": name, "max_grade": access[name]} for name in sorted(access)]


def catalog_payload() -> dict:
    """Compact payload intended for the local browser catalog picker."""
    data = load()
    counts = {kind: 0 for kind in KIND_ORDER}
    for item in data["groups"]:
        if item.get("alias_of"):
            continue
        counts[item["kind"]] = counts.get(item["kind"], 0) + 1
    return {
        "schema_version": data["schema_version"],
        "source": data["source"],
        "stats": {**data["stats"], "planner_items": sum(counts.values()), "categories": counts},
        "kind_labels": KIND_LABELS,
        "groups": [summary(item) for item in data["groups"]],
    }
