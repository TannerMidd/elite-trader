"""Thread-safe store for everything the app knows about the game."""

import threading
from collections import deque


class AppState:
    def __init__(self):
        self._lock = threading.Lock()

        # Commander / ship
        self.commander = None
        self.ship_type = None
        self.ship_name = None
        self.ship_ident = None
        self.cargo_capacity = None
        self.max_jump_range = None
        self.fuel_capacity = None
        self.rebuy = None  # insurance cost from Loadout

        # Location
        self.system = None
        self.system_address = None
        self.star_pos = None
        self.body = None
        self.docked = False
        self.station = None
        self.station_type = None
        self.station_market_id = None
        self.dist_from_star_ls = None

        # Live status (Status.json)
        self.credits = None
        self.fuel_main = None
        self.fuel_reservoir = None
        self.cargo_tons = None
        self.legal_state = None
        self.destination = None

        # Collections
        self.jump_history = deque(maxlen=20)  # newest first
        self.cargo_inventory = []
        self.market = None  # {"market_id", "station", "system", "timestamp", "items": [...]}

        # Flight safety: plotted route (for fuel-scoop callouts) and a queue of
        # one-shot voice alerts (interdiction, hull damage, first discovery).
        self.nav_route = []            # [{"system","address","star_class"}, ...]
        self.fuel_used_samples = deque(maxlen=5)  # recent FSDJump FuelUsed values
        self.alerts = deque(maxlen=8)  # [{"id","level","code","say","text","ts"}]
        self._alert_seq = 0

        # Exobiology (current system signals; vault persists until sold/death)
        self.bio_signals = {}   # body name -> {count, genuses:[...], body details}
        self.bio_sampling = None  # {"genus","species","variant","progress"}
        self.bio_vault = []     # [{"species","genus","variant","value","body"}]
        # Community-mapped genuses for the current system (Spansh galaxy dump)
        self.bio_community = {}  # {"id64", "system", "bodies": {body: {count, genuses}}}

        # Colonization construction depots (latest event per MarketID)
        self.colonisation = {}  # market_id -> {progress, resources, station, ...}

        # Unsold cartographic data (cleared on sell/death)
        self.explo_scans = {}  # body name -> {base, first, mapped, class}

        # Active missions (MissionID -> details) and engineering materials
        self.missions = {}
        self.materials = {"Raw": {}, "Manufactured": {}, "Encoded": {}}

        # Combat: session counters + kills per faction while that faction has
        # active massacre missions (drives the stack-progress card).
        self.combat_kills = 0
        self.combat_bounty_cr = 0
        self.combat_bonds_cr = 0
        self.faction_kills = {}  # target faction -> kills while stack active

        # Live session counters (reset each LoadGame / game launch)
        self.session_start_ts = None      # epoch when the session began
        self.session_start_credits = None  # balance at session start
        self.session_jumps = 0
        self.session_ly = 0.0

        self.last_journal_event = None  # timestamp string of most recent event seen
        self.journal_dir_found = True

    def update(self, **kwargs):
        with self._lock:
            for key, value in kwargs.items():
                setattr(self, key, value)

    def add_jump(self, system, dist, timestamp):
        with self._lock:
            self.jump_history.appendleft(
                {"system": system, "dist": dist, "timestamp": timestamp}
            )
            self.session_jumps += 1
            if dist:
                self.session_ly += dist

    def record_kill(self, victim_faction, bounty_cr=0, bond_cr=0, counts_for_stack=False):
        """Session combat counters; returns the faction's new stack-kill count
        when the kill counts toward an active massacre stack, else None."""
        with self._lock:
            self.combat_kills += 1
            self.combat_bounty_cr += bounty_cr
            self.combat_bonds_cr += bond_cr
            if counts_for_stack and victim_faction:
                self.faction_kills[victim_faction] = self.faction_kills.get(victim_faction, 0) + 1
                return self.faction_kills[victim_faction]
        return None

    def push_alert(self, level, code, say, text):
        """Queue a one-shot voice alert. The UI speaks any alert whose id is
        newer than the last it announced, so each fires exactly once."""
        with self._lock:
            self._alert_seq += 1
            self.alerts.append({
                "id": self._alert_seq, "level": level, "code": code,
                "say": say, "text": text,
            })

    def add_fuel_used(self, tons):
        with self._lock:
            if tons and tons > 0:
                self.fuel_used_samples.append(float(tons))

    def _fuel_per_jump(self):
        # Worst of the recent jumps → a conservative "jumps of fuel" projection.
        return max(self.fuel_used_samples) if self.fuel_used_samples else None

    def _nav_snapshot(self):
        from . import flight

        ahead = flight.route_ahead(self.nav_route, self.system_address, self.system)
        fpj = self._fuel_per_jump()
        jumps_of_fuel = (
            int(self.fuel_main / fpj) if (fpj and self.fuel_main is not None) else None
        )
        # No fuel nagging while docked — you're safe and can refuel.
        advisory = (
            None if self.docked
            else flight.fuel_advisory(ahead, self.fuel_main, self.fuel_capacity, fpj)
        )
        return {
            "system": self.system,
            "ahead": ahead[:12],
            "fuel_per_jump": round(fpj, 2) if fpj else None,
            "jumps_of_fuel": jumps_of_fuel,
            "advisory": advisory,
        }

    def start_session(self, ts, credits):
        """Reset the live-session counters at a game launch (LoadGame)."""
        with self._lock:
            self.session_start_ts = ts
            self.session_start_credits = credits
            self.session_jumps = 0
            self.session_ly = 0.0
            self.combat_kills = 0
            self.combat_bounty_cr = 0
            self.combat_bonds_cr = 0

    def _massacre_snapshot(self):
        """Stack progress per target faction. Kills count toward every giver's
        massacre missions simultaneously, so the kills actually needed are the
        *largest single giver's* total, not the sum across givers."""
        stacks = {}
        for m in self.missions.values():
            if m.get("kind") != "combat" or not m.get("target_faction") or not m.get("kill_count"):
                continue
            if "massacre" not in (m.get("name") or "").lower():
                continue
            s = stacks.setdefault(m["target_faction"], {"missions": 0, "reward": 0, "by_giver": {}})
            s["missions"] += 1
            s["reward"] += m.get("reward") or 0
            giver = m.get("faction") or "?"
            s["by_giver"][giver] = s["by_giver"].get(giver, 0) + m["kill_count"]
        out = []
        for faction, s in stacks.items():
            needed = max(s["by_giver"].values())
            done = self.faction_kills.get(faction, 0)
            out.append({
                "faction": faction,
                "missions": s["missions"],
                "givers": len(s["by_giver"]),
                "reward": s["reward"],
                "kills_needed": needed,
                "kills_done": min(done, needed),
                "complete": done >= needed,
            })
        return sorted(out, key=lambda s: -s["reward"])

    def _combat_snapshot(self):
        return {
            "kills": self.combat_kills,
            "bounty_cr": self.combat_bounty_cr,
            "bonds_cr": self.combat_bonds_cr,
            "massacre": self._massacre_snapshot(),
        }

    def _session_snapshot(self):
        credits_now = self.credits
        earned = (
            credits_now - self.session_start_credits
            if credits_now is not None and self.session_start_credits is not None
            else None
        )
        return {
            "start_ts": self.session_start_ts,
            "start_credits": self.session_start_credits,
            "credits_now": credits_now,
            "earned": earned,
            "jumps": self.session_jumps,
            "ly": round(self.session_ly, 1),
        }

    def _exploration_snapshot(self):
        from . import exploration

        entries = [
            {**e, "value": exploration.effective_value(e)} for e in self.explo_scans.values()
        ]
        entries.sort(key=lambda e: -e["value"])
        return {
            "total": sum(e["value"] for e in entries),
            "count": len(entries),
            "mapped": sum(1 for e in entries if e.get("mapped")),
            "firsts": sum(1 for e in entries if e.get("first")),
            "top": entries[:8],
        }

    def snapshot(self):
        with self._lock:
            market = None
            if self.market:
                market = dict(self.market)
                market["is_current_station"] = (
                    self.docked and self.market.get("market_id") == self.station_market_id
                )
            return {
                "commander": self.commander,
                "ship_type": self.ship_type,
                "ship_name": self.ship_name,
                "ship_ident": self.ship_ident,
                "cargo_capacity": self.cargo_capacity,
                "max_jump_range": self.max_jump_range,
                "fuel_capacity": self.fuel_capacity,
                "rebuy": self.rebuy,
                "system": self.system,
                "star_pos": self.star_pos,
                "body": self.body,
                "docked": self.docked,
                "station": self.station,
                "station_type": self.station_type,
                "dist_from_star_ls": self.dist_from_star_ls,
                "credits": self.credits,
                "fuel_main": self.fuel_main,
                "fuel_reservoir": self.fuel_reservoir,
                "cargo_tons": self.cargo_tons,
                "legal_state": self.legal_state,
                "destination": self.destination,
                "jump_history": list(self.jump_history),
                "cargo_inventory": list(self.cargo_inventory),
                "market": market,
                "bio": {
                    "system_signals": self._bio_signals_snapshot(),
                    "sampling": self.bio_sampling,
                    "vault": {
                        "items": list(self.bio_vault),
                        "total": sum(i.get("value") or 0 for i in self.bio_vault),
                    },
                },
                "exploration": self._exploration_snapshot(),
                "colonisation": sorted(
                    self.colonisation.values(), key=lambda c: c.get("updated") or "", reverse=True
                ),
                "missions": sorted(
                    self.missions.values(), key=lambda m: m.get("expiry_ts") or float("inf")
                ),
                "materials": self._materials_snapshot(),
                "session": self._session_snapshot(),
                "combat": self._combat_snapshot(),
                "nav": self._nav_snapshot(),
                "alerts": list(self.alerts),
                "last_journal_event": self.last_journal_event,
                "journal_dir_found": self.journal_dir_found,
            }

    def _bio_signals_snapshot(self):
        """Your own scanned signals, enriched with community-mapped genuses
        (Spansh) for bodies you haven't DSS-mapped yourself, plus community-known
        bodies you haven't even FSS'd yet."""
        community = (
            self.bio_community.get("bodies") or {}
            if self.bio_community.get("id64") == self.system_address
            else {}
        )
        merged = {}
        for name, entry in self.bio_signals.items():
            e = dict(entry)
            cg = community.get(name)
            if cg and not e.get("genuses"):
                e["community_genuses"] = cg.get("genuses") or []
            merged[name] = e
        for name, cg in community.items():
            if name in merged:
                continue
            merged[name] = {
                "body": name,
                "count": cg.get("count"),
                "genuses": [],
                "community_genuses": cg.get("genuses") or [],
                "source": "community",
            }
        return sorted(merged.values(), key=lambda b: -(b.get("count") or 0))

    def _materials_snapshot(self):
        out = {}
        total = 0
        for cat in ("Raw", "Manufactured", "Encoded"):
            items = sorted(self.materials.get(cat, {}).values(), key=lambda m: -m.get("count", 0))
            out[cat.lower()] = items
            total += sum(m.get("count", 0) for m in items)
        out["total"] = total
        return out
