"""Cartographic value estimation: what your unsold exploration data is worth.
Community-derived approximations of Universal Cartographics payouts."""

# Base scan values (credits) by planet class; (base, terraformable_base).
PLANET_VALUES = {
    "Earthlike body": (270000, 270000),
    "Water world": (99750, 279000),
    "Ammonia world": (143000, 143000),
    "High metal content body": (34310, 163000),
    "Metal rich body": (31000, 31000),
    "Rocky body": (500, 130000),
    "Rocky ice body": (500, 500),
    "Icy body": (500, 500),
    "Water giant": (667, 667),
    "Sudarsky class I gas giant": (3845, 3845),
    "Sudarsky class II gas giant": (28405, 28405),
    "Sudarsky class III gas giant": (995, 995),
    "Sudarsky class IV gas giant": (1119, 1119),
    "Sudarsky class V gas giant": (966, 966),
    "Gas giant with ammonia based life": (774, 774),
    "Gas giant with water based life": (883, 883),
    "Helium rich gas giant": (900, 900),
}

STAR_VALUES = {"N": 22628, "H": 22628, "DA": 14057, "DB": 14057, "DC": 14057}
DEFAULT_STAR_VALUE = 1200
MAPPED_MULTIPLIER = 3.3      # DSS mapping (with efficiency ~4x; we stay conservative)
FIRST_DISCOVERY = 2.6        # first-ever FSS scan bonus


def scan_base_value(event):
    """Base value of a Scan journal event's body, or None if not scannable."""
    planet_class = event.get("PlanetClass")
    if planet_class:
        base, terra = PLANET_VALUES.get(planet_class, (500, 500))
        terraformable = "erraformable" in (event.get("TerraformState") or "")
        return terra if terraformable else base
    star_type = event.get("StarType")
    if star_type:
        for prefix, value in STAR_VALUES.items():
            if star_type.startswith(prefix):
                return value
        return DEFAULT_STAR_VALUE
    return None


def effective_value(entry):
    value = entry["base"]
    if entry.get("first"):
        value *= FIRST_DISCOVERY
    if entry.get("mapped"):
        value *= MAPPED_MULTIPLIER
    return int(value)
