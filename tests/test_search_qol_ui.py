"""Static contract for the v2.1.7 search QoL batch: every result table sorts,
searches can run near any system, result rows offer copy, and search settings
persist across reloads."""

from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
APP = (ROOT / "ui" / "app.js").read_text(encoding="utf-8")
HTML = (ROOT / "ui" / "index.html").read_text(encoding="utf-8")

# Shared sorting machinery drives all three result tables.
for token in (
    "function sortedRows(",
    "function updateSortIndicators(",
    "function bumpSort(",
    "function sortableHeaders(",
    "MN_SORT_COLUMNS",
    "OS_SORT_COLUMNS",
    "CS_SORT_COLUMNS",
    'sortableHeaders("cs-table", sortCommodityTable)',
    'sortableHeaders("mining-table", sortMiningTable)',
    'sortableHeaders("os-table", sortStationTable)',
):
    assert token in APP, token

# Mining and outfitting headers are sortable in the markup (commodity search
# already was in v2.1.6).
assert '<th class="sortable" data-sort="mineral">Mineral</th>' in HTML
assert '<th class="num sortable" data-sort="demand">Demand</th>' in HTML
assert '<th class="num sortable" data-sort="dist_ls">Star dist</th>' in HTML
assert HTML.count('data-sort="jump"') >= 3  # cs + mining + os

# "Near <system>" overrides ride the endpoints' existing ?system= parameter
# and feed from the same autocomplete as the other system boxes.
for near in ("cs-near", "mn-near", "os-near"):
    assert f'id="{near}"' in HTML, near
    assert f'"{near}"' in APP, near
assert APP.count('params.set("system", near)') == 3

# Result rows carry a copy button next to the plot button.
assert "function copySystemButton(" in APP
assert APP.count("copySystemButton(r.system)") == 3

# Search settings persist across reloads; the route form keeps its legacy
# storage key so existing installs keep their saved settings. The Near
# overrides deliberately do NOT persist.
for token in (
    'persistForm("route-form", "routeForm"',
    'persistForm("cs-form", "csForm"',
    'persistForm("mining-form", "miningForm"',
    'persistForm("os-form", "osForm"',
    'persistForm("nr-form", "neutronForm"',
    'persistForm("rr-form", "richesForm"',
    'persistForm("exo-form", "exoForm"',
    'persistForm("sd-form", "sellDataForm"',
):
    assert token in APP, token
assert '"cs-near"' not in APP.split('persistForm("cs-form"', 1)[1].split(")", 1)[0]

# The commodity SEARCH button disables while a search is in flight, like
# every other search button.
cs_fn = APP.split("async function searchCommodity(", 1)[1].split("async function", 1)[0]
assert "go.disabled = true" in cs_fn
assert "go.disabled = false" in cs_fn

print("search QoL UI OK: sortable tables, near overrides, row copy, persistent forms")
