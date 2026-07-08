"""Flight-safety helpers: fuel-scoop planning along the plotted route.

Fuel-scoopable stars are the main-sequence set "KGB FOAM" (K, G, B, F, O, A, M)
plus the two proto-star classes. Brown dwarfs (L, T, Y), white dwarfs (D*),
neutron stars (N), black holes (H) and exotics (S, MS, C, W…) cannot be scooped
— fly into a stretch of those with a near-empty tank and you strand.
"""

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


def _adv(level, code, say, text):
    return {"level": level, "code": code, "say": say, "text": text}


def fuel_advisory(ahead, fuel_main, fuel_capacity, fuel_per_jump):
    """The single most important fuel-safety advisory for the route ahead, or None.

    `ahead[0]` is the current system; `ahead[1:]` are systems still to jump to.
    `fuel_per_jump` is a conservative (worst recent) tons-per-jump estimate; when
    unknown, only the route-shape and low-fraction advisories fire, never a
    fuel-quantity projection. Levels: 'critical' (scoop or strand) > 'warn'."""
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

        # 1) CRITICAL — the tank can't reach the next place to refuel.
        if jumps_of_fuel is not None:
            if next_scoop is None:
                if jumps_of_fuel < len(upcoming):
                    return _adv(
                        "critical", "no_fuel_on_route",
                        f"Warning. No scoopable star left on this route. Fuel lasts about {jumps_of_fuel} jumps.",
                        f"NO FUEL STAR AHEAD · tank ≈{jumps_of_fuel} jumps",
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
                    f"Warning. Next fuel star is {next_scoop} jumps away but fuel lasts about {jumps_of_fuel}. Consider replotting.",
                    f"STRAND RISK · fuel star {next_scoop} jumps · tank ≈{jumps_of_fuel}",
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
