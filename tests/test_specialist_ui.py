"""Static UI contract for the account-free specialist cockpit."""

from __future__ import annotations

import collections
import re
import shutil
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
html = (ROOT / "ui" / "index.html").read_text(encoding="utf-8")
app = (ROOT / "ui" / "app.js").read_text(encoding="utf-8")
css = (ROOT / "ui" / "style.css").read_text(encoding="utf-8")


# The surface is reachable in desktop and cockpit modes and all four workflow
# panels exist under one dedicated tab.
assert 'data-tab="specialists"' in html
assert 'data-page="specialists"' in html
assert '"specialists"' in re.search(r"const PANEL_PAGES = \[[^;]+", app).group(0)
for workflow in ("mining", "combat", "carrier", "exobiology"):
    assert f'data-specialist="{workflow}"' in html
    assert f'id="sp-workflow-{workflow}"' in html


# Every specialist element referenced through the app's ID helper is present,
# and the document does not accidentally duplicate IDs.
ids = re.findall(r'\bid="([^"]+)"', html)
duplicates = [name for name, count in collections.Counter(ids).items() if count > 1]
assert not duplicates, f"duplicate HTML ids: {duplicates}"
specialist_refs = set(re.findall(r'\$\("(sp-[^"]+)"\)', app))
missing = sorted(specialist_refs - set(ids))
assert not missing, f"specialist JS references missing HTML ids: {missing}"


# Every specialist call must resolve to a declaration. This catches merge
# damage that leaves a later renderer/init block behind after its shared helper
# block was dropped—the exact class of failure a syntax check cannot see.
required_functions = {
    "setSpecialistWorkflow", "specialistVisible", "specialistError", "specialistJson",
    "normaliseSpecialistSnapshot", "specialistWorkflow", "specialistHistory",
    "loadSpecialists", "specialistDuration", "specialistTimestamp", "specialistAgo",
    "specialistNumber", "specialistHumanName", "renderSpecialistFacts",
    "renderSpecialistHistory", "renderMiningSpecialist", "renderCombatSpecialist",
    "renderCarrierSpecialist", "renderExobiologySpecialist", "renderSpecialists",
    "runSpecialistMutation", "initSpecialists",
}
defined_functions = set(re.findall(r"(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(", app))
missing_functions = sorted(required_functions - defined_functions)
assert not missing_functions, f"specialist functions missing from app.js: {missing_functions}"
called_specialist_functions = set(re.findall(
    r"\b((?:[A-Za-z_$][\w$]*Specialist[\w$]*|specialist[A-Z][\w$]*))\s*\(", app
))
undefined_calls = sorted(called_specialist_functions - defined_functions)
assert not undefined_calls, f"undefined specialist function calls: {undefined_calls}"


# HTTP contract: journal snapshot, manual session boundaries, explicit carrier
# planning inputs, persistent surface pins, and portable GeoJSON.
for endpoint in (
    "/api/specialists",
    "/api/specialists/mining/start",
    "/api/specialists/mining/end",
    "/api/specialists/combat/start",
    "/api/specialists/combat/end",
    "/api/specialists/carrier/config",
    "/api/specialists/carrier/route",
    "/api/specialists/carrier/inventory",
    "/api/specialists/exobiology/pins",
    "/api/specialists/exobiology/geojson",
):
    assert endpoint in app, endpoint
assert 'method: "DELETE"' in app
assert "weekly_upkeep_cr" in app
assert "tritium_per_jump_t" in app


# Honest limitations are visible at the point of use, not buried in settings.
specialist_html = html.split('<div class="tabpane hidden" id="tab-specialists">', 1)[1]
specialist_html = specialist_html.split('<div class="tabpane hidden" id="tab-galaxy">', 1)[0]
assert "latest Loadout observation" in specialist_html
assert "weekly upkeep is an explicit commander input" in specialist_html
assert "no account, API key or online service" in specialist_html
assert not re.search(r"https?://", specialist_html), "specialist UI must remain local-only"


# Touch/cockpit and surface-map styles must stay part of the UI contract.
for selector in (
    ".sp-switcher",
    ".sp-stat-grid",
    ".sp-readiness-layout",
    ".sp-route-leg",
    ".sp-surface-map",
    ".sp-clearance.clear",
    "body.panel-mode #tab-specialists",
):
    assert selector in css, selector


node = shutil.which("node")
if node:
    subprocess.run([node, "--check", str(ROOT / "ui" / "app.js")], check=True)
    subprocess.run([node, str(ROOT / "tests" / "specialist_ui_runtime.cjs")], check=True)

print("specialist UI OK: four local cockpit workflows and endpoint contract")
