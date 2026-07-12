"""Per-commander activity timing learned entirely from local journal events."""

from __future__ import annotations

import statistics
from datetime import datetime, timezone

from . import marketdb
from .eventledger import parse_event_time


SCHEMA = """
CREATE TABLE IF NOT EXISTS timing_observations(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    commander_id TEXT NOT NULL,
    activity TEXT NOT NULL,
    context_key TEXT NOT NULL DEFAULT '',
    started_at INTEGER NOT NULL,
    ended_at INTEGER NOT NULL,
    duration_s REAL NOT NULL,
    source TEXT NOT NULL DEFAULT 'journal',
    created_at TEXT NOT NULL,
    UNIQUE(commander_id,activity,context_key,started_at,ended_at));
CREATE INDEX IF NOT EXISTS idx_timing_activity
    ON timing_observations(commander_id,activity,context_key,duration_s);
CREATE TABLE IF NOT EXISTS timing_pending(
    commander_id TEXT NOT NULL,
    activity TEXT NOT NULL,
    context_key TEXT NOT NULL DEFAULT '',
    started_at INTEGER NOT NULL,
    source_event TEXT,
    PRIMARY KEY(commander_id,activity,context_key));
"""


# Deliberately padded estimates for a commander with no history.  They include
# ordinary menu/loading/approach overhead instead of pretending every task is
# performed under speed-run conditions.
DEFAULT_SECONDS = {
    "hyperspace_jump": 105,
    "supercruise": 360,
    "docking": 210,
    "station_turnaround": 300,
    "flight_leg": 720,
    "surface_stop": 900,
    "srv_sortie": 1200,
    "fss_scan": 600,
    "exobiology_sample_cycle": 720,
    "mining_cycle": 240,
    "carrier_jump_wait": 960,
    "trade_hop": 900,
    "mission_delivery": 1200,
    "combat_kill": 300,
    "engineering_material_stop": 900,
    "engineering_visit": 1200,
    "colonisation_delivery": 1200,
    "powerplay_task": 1200,
    "community_goal_delivery": 1200,
    "exploration_cash_in": 900,
}

MIN_SECONDS = {
    "hyperspace_jump": 15,
    "supercruise": 10,
    "docking": 10,
    "station_turnaround": 10,
    "flight_leg": 30,
    "surface_stop": 20,
    "srv_sortie": 30,
    "fss_scan": 10,
    "exobiology_sample_cycle": 20,
    "mining_cycle": 5,
    "carrier_jump_wait": 30,
}

MAX_SECONDS = {
    "hyperspace_jump": 600,
    "supercruise": 7200,
    "docking": 1800,
    "station_turnaround": 7200,
    "flight_leg": 14_400,
    "surface_stop": 21_600,
    "srv_sortie": 43_200,
    "fss_scan": 7200,
    "exobiology_sample_cycle": 7200,
    "mining_cycle": 3600,
    "carrier_jump_wait": 7200,
}


def ensure_schema() -> None:
    marketdb.ensure_user_schema(SCHEMA)


def _context(*values) -> str:
    return " | ".join(str(v).strip() for v in values if v is not None and str(v).strip())[:300]


class TimingModel:
    """Journal transition learner with conservative cold-start defaults."""

    def __init__(self, commander_id: str | None = None):
        ensure_schema()
        self.commander_id = commander_id or marketdb.active_commander_id()

    def record(
        self, activity: str, duration_s: float, *, context: str | None = None,
        started_at: int | None = None, ended_at: int | None = None,
        source: str = "manual",
    ) -> bool:
        activity = str(activity).strip()
        if not activity:
            raise ValueError("activity is required")
        duration_s = float(duration_s)
        minimum = MIN_SECONDS.get(activity, 1)
        maximum = MAX_SECONDS.get(activity, 12 * 3600)
        if not minimum <= duration_s <= maximum:
            return False
        ended_at = int(ended_at or datetime.now(timezone.utc).timestamp() * 1000)
        started_at = int(started_at or ended_at - duration_s * 1000)
        conn = marketdb.connect_user()
        try:
            before = conn.total_changes
            conn.execute(
                "INSERT OR IGNORE INTO timing_observations("
                "commander_id,activity,context_key,started_at,ended_at,duration_s,source,created_at)"
                " VALUES(?,?,?,?,?,?,?,?)",
                (
                    self.commander_id, activity, _context(context), started_at, ended_at,
                    round(duration_s, 3), str(source)[:50],
                    datetime.now(timezone.utc).isoformat(),
                ),
            )
            inserted = conn.total_changes > before
            conn.commit()
            return inserted
        finally:
            conn.close()

    def _begin(self, activity: str, event_ts: int, context: str, source_event: str) -> None:
        conn = marketdb.connect_user()
        try:
            # Keep the earliest member of a transition.  Replayed duplicate
            # starts must not move the stopwatch forward.
            conn.execute(
                "INSERT OR IGNORE INTO timing_pending("
                "commander_id,activity,context_key,started_at,source_event) VALUES(?,?,?,?,?)",
                (self.commander_id, activity, context, event_ts, source_event),
            )
            conn.commit()
        finally:
            conn.close()

    def _end(self, activity: str, event_ts: int, context: str | None = None) -> dict | None:
        conn = marketdb.connect_user()
        try:
            if context:
                row = conn.execute(
                    "SELECT context_key,started_at FROM timing_pending WHERE commander_id=? "
                    "AND activity=? AND context_key=?",
                    (self.commander_id, activity, context),
                ).fetchone()
            else:
                row = conn.execute(
                    "SELECT context_key,started_at FROM timing_pending WHERE commander_id=? "
                    "AND activity=? ORDER BY started_at LIMIT 1",
                    (self.commander_id, activity),
                ).fetchone()
            if not row:
                return None
            conn.execute(
                "DELETE FROM timing_pending WHERE commander_id=? AND activity=? AND context_key=?",
                (self.commander_id, activity, row[0]),
            )
            conn.commit()
        finally:
            conn.close()
        duration = (event_ts - row[1]) / 1000
        inserted = self.record(
            activity, duration, context=row[0], started_at=row[1], ended_at=event_ts,
            source="journal",
        )
        return {"activity": activity, "context": row[0], "duration_s": duration, "inserted": inserted}

    def observe_event(self, event: dict) -> list[dict]:
        """Feed one journal event; return any completed observations."""
        if not isinstance(event, dict) or not event.get("event"):
            return []
        kind = str(event["event"])
        ts = parse_event_time(event.get("timestamp"))
        completed: list[dict] = []

        if kind == "StartJump" and event.get("JumpType") == "Hyperspace":
            self._begin("hyperspace_jump", ts, _context(event.get("StarSystem")), kind)
        elif kind in {"FSDJump", "CarrierJump"}:
            result = self._end("hyperspace_jump", ts, _context(event.get("StarSystem")))
            if not result:  # destination spelling/context can be absent at StartJump
                result = self._end("hyperspace_jump", ts)
            if result:
                completed.append(result)

        if kind == "SupercruiseEntry":
            self._begin("supercruise", ts, _context(event.get("StarSystem")), kind)
        elif kind == "SupercruiseExit":
            result = self._end("supercruise", ts, _context(event.get("StarSystem"))) or self._end("supercruise", ts)
            if result:
                completed.append(result)

        if kind == "DockingRequested":
            self._begin("docking", ts, _context(event.get("StationName")), kind)
        elif kind == "Docked":
            result = self._end("docking", ts, _context(event.get("StationName"))) or self._end("docking", ts)
            if result:
                completed.append(result)
            result = self._end("flight_leg", ts)
            if result:
                completed.append(result)
            self._begin("station_turnaround", ts, _context(event.get("StationName")), kind)
        elif kind == "Undocked":
            result = self._end("station_turnaround", ts, _context(event.get("StationName"))) or self._end("station_turnaround", ts)
            if result:
                completed.append(result)
            self._begin("flight_leg", ts, _context(event.get("StarSystem")), kind)

        if kind == "Touchdown":
            self._begin("surface_stop", ts, _context(event.get("Body"), event.get("BodyName")), kind)
        elif kind == "Liftoff":
            result = self._end("surface_stop", ts)
            if result:
                completed.append(result)

        if kind == "LaunchSRV":
            self._begin("srv_sortie", ts, _context(event.get("SRVType")), kind)
        elif kind == "DockSRV":
            result = self._end("srv_sortie", ts)
            if result:
                completed.append(result)

        if kind == "FSSDiscoveryScan":
            self._begin("fss_scan", ts, _context(event.get("SystemName")), kind)
        elif kind == "FSSAllBodiesFound":
            result = self._end("fss_scan", ts)
            if result:
                completed.append(result)

        if kind == "ScanOrganic" and event.get("ScanType") == "Log":
            self._begin(
                "exobiology_sample_cycle", ts,
                _context(event.get("Species"), event.get("Genus")), kind,
            )
        elif kind == "ScanOrganic" and event.get("ScanType") == "Analyse":
            result = self._end("exobiology_sample_cycle", ts)
            if result:
                completed.append(result)

        if kind == "ProspectedAsteroid":
            self._begin("mining_cycle", ts, _context(event.get("MotherlodeMaterial")), kind)
        elif kind == "MiningRefined":
            result = self._end("mining_cycle", ts)
            if result:
                completed.append(result)

        if kind == "CarrierJumpRequest":
            self._begin("carrier_jump_wait", ts, _context(event.get("SystemName"), event.get("Body")), kind)
        elif kind in {"CarrierJump", "CarrierJumpCancelled"}:
            result = self._end("carrier_jump_wait", ts)
            if result:
                completed.append(result)
        return completed

    def estimate(
        self, activity: str, *, context: str | None = None,
        minimum_samples: int = 3, conservative: bool = True,
    ) -> dict:
        """Return a transparent personal estimate or conservative default.

        A context-specific median wins when it has enough samples; otherwise
        all observations for this commander/activity are used.  The displayed
        conservative value adds 20 percent to the median while returning the
        raw median alongside it.
        """
        activity = str(activity)
        conn = marketdb.connect_user()
        try:
            values = []
            context_used = ""
            if context:
                context_used = _context(context)
                values = [row[0] for row in conn.execute(
                    "SELECT duration_s FROM timing_observations WHERE commander_id=? "
                    "AND activity=? AND context_key=? ORDER BY duration_s",
                    (self.commander_id, activity, context_used),
                )]
            if len(values) < minimum_samples:
                context_used = ""
                values = [row[0] for row in conn.execute(
                    "SELECT duration_s FROM timing_observations WHERE commander_id=? "
                    "AND activity=? ORDER BY duration_s",
                    (self.commander_id, activity),
                )]
        finally:
            conn.close()
        if len(values) >= minimum_samples:
            median = float(statistics.median(values))
            seconds = median * (1.2 if conservative else 1.0)
            return {
                "activity": activity, "seconds": int(round(seconds)),
                "median_seconds": int(round(median)), "sample_count": len(values),
                "source": "personal_median", "context": context_used or None,
                "conservative_margin": 0.2 if conservative else 0,
            }
        default = int(DEFAULT_SECONDS.get(activity, 900))
        return {
            "activity": activity, "seconds": default,
            "median_seconds": None, "sample_count": len(values),
            "source": "conservative_default", "context": None,
            "conservative_margin": None,
        }

    def snapshot(self) -> dict:
        conn = marketdb.connect_user()
        try:
            activities = [row[0] for row in conn.execute(
                "SELECT DISTINCT activity FROM timing_observations WHERE commander_id=?",
                (self.commander_id,),
            )]
            pending = [
                {"activity": row[0], "context": row[1], "started_at": row[2]}
                for row in conn.execute(
                    "SELECT activity,context_key,started_at FROM timing_pending "
                    "WHERE commander_id=? ORDER BY started_at", (self.commander_id,)
                )
            ]
        finally:
            conn.close()
        known = sorted(set(DEFAULT_SECONDS) | set(activities))
        return {
            "commander_id": self.commander_id,
            "activities": {activity: self.estimate(activity) for activity in known},
            "pending": pending,
        }
