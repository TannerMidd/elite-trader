"""Engineer reference data: home system and specialty for the workshop names
that appear in EngineerProgress journal events.

Names (not EngineerIDs) key the table — the journal always carries the
display name, and names are stable across game updates. Specialties are
deliberately terse; unlock requirements change with game balance passes, so
the UI links to Inara for those instead of risking stale advice here."""

# name -> {"system": home system, "offers": short specialty, "on_foot": bool}
ENGINEERS = {
    # --- ship engineers, bubble ---
    "Felicity Farseer":    {"system": "Deciat", "offers": "FSD range, thrusters, sensors"},
    "Elvira Martuuk":      {"system": "Khun", "offers": "FSD range, shields"},
    "The Dweller":         {"system": "Wyrd", "offers": "power distributor, lasers"},
    "Liz Ryder":           {"system": "Eurybia", "offers": "missiles, torpedoes"},
    "Tod 'The Blaster' McQuinn": {"system": "Wolf 397", "offers": "multi-cannons, fragment cannons"},
    "Zacariah Nemo":       {"system": "Yoru", "offers": "fragment cannons, plasma"},
    "Lei Cheung":          {"system": "Laksak", "offers": "shield generators, sensors"},
    "Hera Tani":           {"system": "Kuwemaki", "offers": "power plant, detailed surface scanner"},
    "Juri Ishmaak":        {"system": "Giryak", "offers": "mines, sensors, scanners"},
    "Selene Jean":         {"system": "Kuk", "offers": "hull reinforcement, armour"},
    "Marco Qwent":         {"system": "Sirius", "offers": "power plant, power distributor"},
    "Ram Tah":             {"system": "Meene", "offers": "utility modules, limpets"},
    "Broo Tarquin":        {"system": "Muang", "offers": "pulse & burst lasers"},
    "The Sarge":           {"system": "Beta-3 Tucani", "offers": "cannons, limpets"},
    "Colonel Bris Dekker": {"system": "Sol", "offers": "FSD interdictors"},
    "Didi Vatermann":      {"system": "Leesti", "offers": "shield boosters"},
    "Bill Turner":         {"system": "Alioth", "offers": "plasma accelerators, utilities"},
    "Lori Jameson":        {"system": "Shinrarta Dezhra", "offers": "sensors, scanners, life support"},
    "Professor Palin":     {"system": "Arque", "offers": "thrusters, FSD"},
    "Tiana Fortune":       {"system": "Achenar", "offers": "interdictors, limpets, sensors"},
    "Chloe Sedesi":        {"system": "Shenve", "offers": "thrusters, FSD"},
    # --- ship engineers, Colonia ---
    "Mel Brandon":         {"system": "Luchtaine", "offers": "lasers, shields, FSD, thrusters"},
    "Petra Olmanova":      {"system": "Asura", "offers": "armour, countermeasures, explosives"},
    "Marsha Hicks":        {"system": "Tir", "offers": "multi-cannons, fragment cannons, limpets"},
    "Etienne Dorn":        {"system": "Los", "offers": "rail guns, power, sensors"},
    # --- on-foot (Odyssey) engineers ---
    "Domino Green":        {"system": "Orishis", "offers": "suit & weapon mods", "on_foot": True},
    "Hero Ferrari":        {"system": "Siris", "offers": "suit & weapon mods", "on_foot": True},
    "Kit Fowler":          {"system": "Capoya", "offers": "suit & weapon mods", "on_foot": True},
    "Jude Navarro":        {"system": "Aurai", "offers": "suit & weapon mods", "on_foot": True},
    "Terra Velasquez":     {"system": "Shou Xing", "offers": "suit & weapon mods", "on_foot": True},
    "Oden Geiger":         {"system": "Candiaei", "offers": "suit & weapon mods", "on_foot": True},
    "Uma Laszlo":          {"system": "Xuane", "offers": "suit & weapon mods", "on_foot": True},
    "Wellington Beck":     {"system": "Jolapa", "offers": "suit & weapon mods", "on_foot": True},
    "Yarden Bond":         {"system": "Bayan", "offers": "suit & weapon mods", "on_foot": True},
    "Baltanos":            {"system": "Deriso", "offers": "suit & weapon mods", "on_foot": True},
    "Eleanor Bresa":       {"system": "Desy", "offers": "suit & weapon mods", "on_foot": True},
    "Rosa Dayette":        {"system": "Kojeara", "offers": "suit & weapon mods", "on_foot": True},
    "Yi Shen":             {"system": "Einheriar", "offers": "suit & weapon mods", "on_foot": True},
}


def info(name):
    """Reference info for an engineer display name ({} when unknown, so new
    engineers added by Frontier still render from journal data alone)."""
    return ENGINEERS.get(name) or {}
