"""Flight-safety helpers: fuel-scoop planning along the plotted route,
surface-sampling clearance, and FSD-injection (jumponium) readiness.

Fuel-scoopable stars are the main-sequence set "KGB FOAM" (K, G, B, F, O, A, M)
plus the two proto-star classes. Brown dwarfs (L, T, Y), white dwarfs (D*),
neutron stars (N), black holes (H) and exotics (S, MS, C, W…) cannot be scooped
— fly into a stretch of those with a near-empty tank and you strand.
"""

import math

SCOOPABLE_PRIMARY = set("OBAFGKM")
_SCOOPABLE_EXACT = {"TTS", "AeBe"}     # proto-stars: T Tauri, Herbig Ae/Be
_NON_SCOOPABLE_EXACT = {"MS"}          # S-type; first letter M but not scoopable


def is_scoopable(star_class):
    """True if a KGB-FOAM (or proto) star you can refuel at."""
    sc = (star_class or "").strip()
    if not sc:
        return False
    if sc in _SCOOPABLE_EXACT:
        return True
    if sc in _NON_SCOOPABLE_EXACT:
        return False
    # Brown/white dwarfs, neutron, black hole and exotic classes all start with
    # letters outside the set, so the first-letter test settles the rest.
    return sc[0] in SCOOPABLE_PRIMARY


def route_ahead(route, current_address=None, current_system=None):
    """Trim the plotted NavRoute to the portion still ahead of the commander.

    `route` is [{"system","address","star_class"}, …] as read from NavRoute.json.
    The game keeps the *whole* original route in that file as you fly it, so we
    locate the current position (by SystemAddress, then name) and return from
    there onward — each entry tagged with `scoopable`. Returns [] when the
    current system isn't on the route (stale / off-route), so callers don't act
    on a route the commander already left."""
    if not route:
        return []
    idx = None
    if current_address is not None:
        for i, r in enumerate(route):
            if r.get("address") == current_address:
                idx = i
                break
    if idx is None and current_system:
        for i, r in enumerate(route):
            if r.get("system") == current_system:
                idx = i
                break
    if idx is None:
        return []
    return [
        {
            "system": r.get("system"),
            "star_class": r.get("star_class"),
            "scoopable": is_scoopable(r.get("star_class")),
        }
        for r in route[idx:]
    ]


# ---------- surface sampling (exobiology clonal-colony distance) ----------

def surface_distance_m(lat1, lon1, lat2, lon2, radius_m):
    """Great-circle distance in metres between two lat/long points on a body
    of the given radius (haversine — planets in ED are spheres)."""
    if None in (lat1, lon1, lat2, lon2) or not radius_m:
        return None
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * radius_m * math.asin(math.sqrt(a))


def sample_clearance(points, pos, colony_m):
    """Live distance check for the genetic sampler: how far the commander has
    moved from each previous sample of the species in progress.

    `points` are [{"lat","lon","body"}, …] captured at each ScanOrganic;
    `pos` is the live Status.json position {"lat","lon","body","radius_m"}.
    Returns {"dists_m", "min_dist_m", "clear"} or None when there is nothing
    to measure (no points, off-body, or no live position). `clear` is None —
    unknown — when the genus's colony distance isn't in our table."""
    if not points or not pos:
        return None
    dists = [
        d for p in points
        if p.get("body") == pos.get("body")
        and (d := surface_distance_m(p.get("lat"), p.get("lon"),
                                     pos.get("lat"), pos.get("lon"),
                                     pos.get("radius_m"))) is not None
    ]
    if not dists:
        return None
    min_d = min(dists)
    return {
        "dists_m": [round(d) for d in dists],
        "min_dist_m": round(min_d),
        "clear": (min_d >= colony_m) if colony_m else None,
    }


# ---------- FSD injection (jumponium) readiness ----------

# Current live-game recipes (verified against EDDiscovery's FrontierData):
# raw-material journal symbols -> units per synthesis.
FSD_INJECTION_RECIPES = {
    "basic":    {"carbon": 1, "vanadium": 1, "germanium": 1},                                # +25% range
    "standard": {"carbon": 1, "vanadium": 1, "germanium": 1, "cadmium": 1, "niobium": 1},    # +50%
    "premium":  {"carbon": 1, "germanium": 1, "niobium": 1, "arsenic": 1,
                 "polonium": 1, "yttrium": 1},                                               # +100%
}
FSD_INJECTION_BOOST = {"basic": 25, "standard": 50, "premium": 100}


def fsd_injections(raw_counts):
    """How many FSD injections of each tier the raw-material inventory covers.
    `raw_counts` maps journal symbol ('carbon', …) -> units held."""
    return {
        tier: min(int(raw_counts.get(sym, 0)) // n for sym, n in recipe.items())
        for tier, recipe in FSD_INJECTION_RECIPES.items()
    }


def _best_injection(synth):
    """The strongest tier currently synthesizable, or None."""
    for tier in ("premium", "standard", "basic"):
        if synth and synth.get(tier):
            return tier, synth[tier]
    return None


def _adv(level, code, say, text):
    return {"level": level, "code": code, "say": say, "text": text}


def fuel_advisory(ahead, fuel_main, fuel_capacity, fuel_per_jump, synth=None):
    """The single most important fuel-safety advisory for the route ahead, or None.

    `ahead[0]` is the current system; `ahead[1:]` are systems still to jump to.
    `fuel_per_jump` is a conservative (worst recent) tons-per-jump estimate; when
    unknown, only the route-shape and low-fraction advisories fire, never a
    fuel-quantity projection. Levels: 'critical' (scoop or strand) > 'warn'.

    `synth` is the fsd_injections() readout; when a strand advisory fires and a
    jump-range boost is synthesizable, the advisory says so — a longer jump
    range means fewer jumps of fuel to reach the next scoopable star."""
    ahead = ahead or []
    current = ahead[0] if ahead else None
    upcoming = ahead[1:]  # systems still to jump to (empty when off-route/arrived)

    jpj = fuel_per_jump if (fuel_per_jump and fuel_per_jump > 0) else None
    jumps_of_fuel = int(fuel_main / jpj) if (jpj and fuel_main is not None) else None

    # Route-shape advisories only apply while a plotted route lies ahead.
    if upcoming:
        # Jumps to the next scoopable star ahead (1 = the very next system).
        next_scoop = next((i + 1 for i, s in enumerate(upcoming) if s["scoopable"]), None)
        # Consecutive non-scoopable systems immediately ahead (the "dry stretch").
        dry = 0
        for s in upcoming:
            if s["scoopable"]:
                break
            dry += 1

        # A strand advisory can sometimes be escaped without fuel: boost jump
        # range with an FSD injection and the same distance takes fewer jumps.
        best = _best_injection(synth)
        say_synth = (
            f" {best[0].title()} FSD injection is ready — a +{FSD_INJECTION_BOOST[best[0]]} percent"
            " range boost may reach fuel in fewer jumps." if best else ""
        )
        text_synth = f" · SYNTH READY {best[0]} ×{best[1]} (+{FSD_INJECTION_BOOST[best[0]]}%)" if best else ""

        # 1) CRITICAL — the tank can't reach the next place to refuel.
        if jumps_of_fuel is not None:
            if next_scoop is None:
                if jumps_of_fuel < len(upcoming):
                    return _adv(
                        "critical", "no_fuel_on_route",
                        f"Warning. No scoopable star left on this route. Fuel lasts about {jumps_of_fuel} jumps."
                        + say_synth,
                        f"NO FUEL STAR AHEAD · tank ≈{jumps_of_fuel} jumps" + text_synth,
                    )
            elif next_scoop > jumps_of_fuel:
                if current["scoopable"]:
                    return _adv(
                        "critical", "scoop_now",
                        f"Scoop now. Next fuel star is {next_scoop} jumps away, tank lasts about {jumps_of_fuel}.",
                        f"SCOOP NOW · next fuel star {next_scoop} jumps · tank ≈{jumps_of_fuel}",
                    )
                return _adv(
                    "critical", "strand_risk",
                    f"Warning. Next fuel star is {next_scoop} jumps away but fuel lasts about {jumps_of_fuel}. Consider replotting."
                    + say_synth,
                    f"STRAND RISK · fuel star {next_scoop} jumps · tank ≈{jumps_of_fuel}" + text_synth,
                )

        # 2) WARN — leaving a scoopable star into a dry stretch; top off first.
        if current["scoopable"] and dry >= 2:
            return _adv(
                "warn", "dry_stretch",
                f"Top off before you leave. The next {dry} jumps have no fuel star.",
                f"TOP OFF · {dry} dry jumps ahead",
            )

    # 3) WARN — low fuel fraction, whether or not a route is plotted.
    if fuel_main is not None and fuel_capacity:
        frac = fuel_main / fuel_capacity
        if frac < 0.25:
            pct = round(frac * 100)
            return _adv("warn", "low_fuel", f"Low fuel. {pct} percent.", f"LOW FUEL · {pct}%")

    return None
