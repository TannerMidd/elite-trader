"""Client for the Spansh trade-route planner API (async job: submit then poll)."""

import time

import requests

BASE = "https://spansh.co.uk/api"
HEADERS = {"User-Agent": "EliteTrader/1.0 (personal ED companion app)"}
SUBMIT_TIMEOUT = 20
POLL_TIMEOUT = 20
MAX_WAIT_SECONDS = 90


class SpanshError(Exception):
    pass


def plan_route(
    system,
    station=None,
    capital=100000,
    max_cargo=8,
    max_hop_distance=25.0,
    max_hops=4,
    max_system_distance=1000,
    max_price_age_days=30,
    requires_large_pad=False,
    allow_planetary=True,
    allow_prohibited=False,
    unique=False,
):
    if not system:
        raise SpanshError("No starting system known yet - is the game running?")

    payload = {
        "system": system,
        "capital": int(capital),
        "max_cargo": int(max_cargo),
        "max_hop_distance": float(max_hop_distance),
        "max_hops": int(max_hops),
        "max_system_distance": int(max_system_distance),
        "max_price_age": int(max_price_age_days) * 86400,
        "requires_large_pad": 1 if requires_large_pad else 0,
        "allow_planetary": 1 if allow_planetary else 0,
        "allow_prohibited": 1 if allow_prohibited else 0,
        "unique": 1 if unique else 0,
        "permit": 0,
    }
    if station:
        payload["station"] = station

    try:
        resp = requests.post(
            f"{BASE}/trade/route", data=payload, headers=HEADERS, timeout=SUBMIT_TIMEOUT
        )
    except requests.RequestException as exc:
        raise SpanshError(f"Could not reach Spansh: {exc}") from exc

    if resp.status_code >= 400:
        raise SpanshError(_error_text(resp))
    job = resp.json().get("job")
    if not job:
        raise SpanshError(f"Spansh did not return a job id: {resp.text[:200]}")

    deadline = time.monotonic() + MAX_WAIT_SECONDS
    while time.monotonic() < deadline:
        try:
            poll = requests.get(f"{BASE}/results/{job}", headers=HEADERS, timeout=POLL_TIMEOUT)
        except requests.RequestException as exc:
            raise SpanshError(f"Lost connection to Spansh: {exc}") from exc
        if poll.status_code >= 400:
            raise SpanshError(_error_text(poll))
        data = poll.json()
        status = data.get("status")
        if status == "ok":
            return _parse_result(data.get("result"))
        if status in ("queued", "processing"):
            time.sleep(1.5)
            continue
        raise SpanshError(f"Spansh job failed: {data.get('error') or status}")
    raise SpanshError("Spansh took too long to compute a route; try again.")


def _error_text(resp):
    try:
        detail = resp.json().get("error")
    except ValueError:
        detail = None
    return f"Spansh error ({resp.status_code}): {detail or resp.text[:200]}"


def _parse_result(result):
    """Normalise Spansh's hop list into what the UI renders. Written defensively:
    unknown fields are dropped rather than crashing if the API shape drifts."""
    if not isinstance(result, list):
        raise SpanshError("Unexpected Spansh response shape (no route list).")
    hops = []
    for hop in result:
        source = hop.get("source") or {}
        dest = hop.get("destination") or {}
        commodities = [
            {
                "name": c.get("name"),
                "amount": c.get("amount"),
                "buy_price": (c.get("source_commodity") or {}).get("buy_price"),
                "sell_price": (c.get("destination_commodity") or {}).get("sell_price"),
                "profit": c.get("total_profit"),
                "supply": (c.get("source_commodity") or {}).get("supply"),
                "demand": (c.get("destination_commodity") or {}).get("demand"),
            }
            for c in hop.get("commodities") or []
        ]
        hops.append(
            {
                "from_system": source.get("system"),
                "from_station": source.get("station"),
                "to_system": dest.get("system"),
                "to_station": dest.get("station"),
                "to_dist_ls": dest.get("distance_to_arrival"),
                "distance": hop.get("distance"),
                "profit": hop.get("total_profit"),
                "cumulative_profit": hop.get("cumulative_profit"),
                "commodities": commodities,
            }
        )
    return hops
