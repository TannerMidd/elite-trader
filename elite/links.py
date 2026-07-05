"""Builds external website URLs pre-filled with the current location."""

from urllib.parse import quote_plus


def build_links(system, station=None):
    links = []
    if system:
        q = quote_plus(system)
        links.append(
            {
                "label": "Inara: trade routes",
                "url": f"https://inara.cz/elite/market-traderoutes/?formbrief=1&ps1={q}",
            }
        )
        links.append(
            {
                "label": "Inara: commodities",
                "url": f"https://inara.cz/elite/commodities/?formbrief=1&ps1={q}",
            }
        )
        links.append(
            {
                "label": "Inara: system",
                "url": f"https://inara.cz/elite/starsystem/?search={q}",
            }
        )
        links.append(
            {
                "label": "EDSM: system",
                "url": f"https://www.edsm.net/en/system?systemName={q}",
            }
        )
    links.append({"label": "Spansh: trade planner", "url": "https://spansh.co.uk/trade"})
    return links
