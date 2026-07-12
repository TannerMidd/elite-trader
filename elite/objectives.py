"""Local commander objectives and a rule-based, time-budgeted action planner."""

from __future__ import annotations

import hashlib
import json
import time
import uuid
from datetime import datetime, timezone
from typing import Callable

from . import marketdb
from .timings import TimingModel


SCHEMA = """
CREATE TABLE IF NOT EXISTS commander_objectives(
    id TEXT PRIMARY KEY,
    commander_id TEXT NOT NULL,
    source TEXT NOT NULL,
    source_ref TEXT,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'other',
    status TEXT NOT NULL DEFAULT 'open',
    priority INTEGER NOT NULL DEFAULT 50,
    system TEXT,
    station TEXT,
    body TEXT,
    estimated_seconds INTEGER,
    deadline INTEGER,
    reward INTEGER,
    risk TEXT,
    payload TEXT NOT NULL DEFAULT '{}',
    dependencies TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(commander_id,source,source_ref));
CREATE INDEX IF NOT EXISTS idx_objectives_open
    ON commander_objectives(commander_id,status,priority DESC,deadline);
CREATE TABLE IF NOT EXISTS commander_alerts(
    id TEXT PRIMARY KEY,
    commander_id TEXT NOT NULL,
    source TEXT NOT NULL,
    level TEXT NOT NULL DEFAULT 'info',
    code TEXT,
    text TEXT NOT NULL,
    say TEXT,
    acknowledged INTEGER NOT NULL DEFAULT 0,
    payload TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_alerts_unread
    ON commander_alerts(commander_id,acknowledged,created_at DESC);
"""

_VALID_STATUS = {"open", "active", "blocked", "done", "dismissed"}


def ensure_schema() -> None:
    marketdb.ensure_user_schema(SCHEMA)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _clean_text(value, limit=500):
    return str(value or "").strip()[:limit]


def _json(value) -> str:
    return json.dumps(value if value is not None else {}, sort_keys=True, separators=(",", ":"), default=str)


def _loads(value, fallback):
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return fallback


def _epoch_seconds(value):
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        return int(value / 1000 if value > 10_000_000_000 else value)
    if isinstance(value, str):
        try:
            dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return int(dt.timestamp())
        except ValueError:
            return None
    return None


def _row_to_objective(row) -> dict:
    keys = (
        "id", "commander_id", "source", "source_ref", "title", "category",
        "status", "priority", "system", "station", "body", "estimated_seconds",
        "deadline", "reward", "risk", "payload", "dependencies", "created_at",
        "updated_at",
    )
    value = dict(zip(keys, row))
    value["payload"] = _loads(value["payload"], {})
    value["dependencies"] = _loads(value["dependencies"], [])
    return value


class ObjectiveStore:
    """CRUD for durable personal objectives and extension suggestions."""

    _SELECT = (
        "SELECT id,commander_id,source,source_ref,title,category,status,priority,"
        "system,station,body,estimated_seconds,deadline,reward,risk,payload,dependencies,"
        "created_at,updated_at FROM commander_objectives"
    )

    def __init__(self, commander_id: str | None = None):
        ensure_schema()
        self.commander_id = commander_id or marketdb.active_commander_id()

    def create(
        self, title: str, *, category="other", source="user", source_ref=None,
        priority=50, system=None, station=None, body=None, estimated_seconds=None,
        deadline=None, reward=None, risk=None, payload=None, dependencies=None,
    ) -> dict:
        title = _clean_text(title, 240)
        if not title:
            raise ValueError("objective title is required")
        source = _clean_text(source, 80) or "user"
        if source_ref is not None:
            source_ref = _clean_text(source_ref, 240)
        objective_id = "obj-" + uuid.uuid4().hex
        now = _now_iso()
        conn = marketdb.connect_user()
        try:
            before = conn.total_changes
            conn.execute(
                "INSERT OR IGNORE INTO commander_objectives("
                "id,commander_id,source,source_ref,title,category,status,priority,system,station,"
                "body,estimated_seconds,deadline,reward,risk,payload,dependencies,created_at,updated_at)"
                " VALUES(?,?,?,?,?,?,'open',?,?,?,?,?,?,?,?,?,?,?,?)",
                (
                    objective_id, self.commander_id, source, source_ref, title,
                    _clean_text(category, 60) or "other", max(0, min(int(priority), 100)),
                    _clean_text(system, 160) or None, _clean_text(station, 160) or None,
                    _clean_text(body, 200) or None,
                    int(estimated_seconds) if estimated_seconds is not None else None,
                    _epoch_seconds(deadline), int(reward) if reward is not None else None,
                    _clean_text(risk, 40) or None, _json(payload),
                    _json(list(dependencies or [])), now, now,
                ),
            )
            if conn.total_changes == before and source_ref is not None:
                row = conn.execute(
                    self._SELECT + " WHERE commander_id=? AND source=? AND source_ref=?",
                    (self.commander_id, source, source_ref),
                ).fetchone()
            else:
                row = conn.execute(self._SELECT + " WHERE id=?", (objective_id,)).fetchone()
            conn.commit()
            return _row_to_objective(row)
        finally:
            conn.close()

    def update(self, objective_id: str, **changes) -> dict | None:
        allowed = {
            "title", "category", "status", "priority", "system", "station", "body",
            "estimated_seconds", "deadline", "reward", "risk", "payload", "dependencies",
        }
        values = {key: value for key, value in changes.items() if key in allowed}
        if "status" in values and values["status"] not in _VALID_STATUS:
            raise ValueError("invalid objective status")
        if "title" in values:
            values["title"] = _clean_text(values["title"], 240)
            if not values["title"]:
                raise ValueError("objective title is required")
        for key in ("category", "system", "station", "body", "risk"):
            if key in values:
                values[key] = _clean_text(values[key], 240) or None
        if "priority" in values:
            values["priority"] = max(0, min(int(values["priority"]), 100))
        if "deadline" in values:
            values["deadline"] = _epoch_seconds(values["deadline"])
        if "payload" in values:
            values["payload"] = _json(values["payload"])
        if "dependencies" in values:
            values["dependencies"] = _json(list(values["dependencies"] or []))
        if not values:
            return self.get(objective_id)
        values["updated_at"] = _now_iso()
        conn = marketdb.connect_user()
        try:
            params = list(values.values()) + [objective_id, self.commander_id]
            conn.execute(
                "UPDATE commander_objectives SET "
                + ",".join(f"{key}=?" for key in values)
                + " WHERE id=? AND commander_id=?",
                tuple(params),
            )
            conn.commit()
            row = conn.execute(
                self._SELECT + " WHERE id=? AND commander_id=?",
                (objective_id, self.commander_id),
            ).fetchone()
            return _row_to_objective(row) if row else None
        finally:
            conn.close()

    def get(self, objective_id: str) -> dict | None:
        conn = marketdb.connect_user()
        try:
            row = conn.execute(
                self._SELECT + " WHERE id=? AND commander_id=?",
                (objective_id, self.commander_id),
            ).fetchone()
            return _row_to_objective(row) if row else None
        finally:
            conn.close()

    def list(self, *, statuses=("open", "active", "blocked"), limit=500) -> list[dict]:
        clauses = ["commander_id=?"]
        params: list = [self.commander_id]
        if statuses:
            statuses = list(statuses)
            clauses.append("status IN (" + ",".join("?" for _ in statuses) + ")")
            params.extend(statuses)
        params.append(max(1, min(int(limit), 5000)))
        conn = marketdb.connect_user()
        try:
            rows = conn.execute(
                self._SELECT + " WHERE " + " AND ".join(clauses)
                + " ORDER BY priority DESC,CASE WHEN deadline IS NULL THEN 1 ELSE 0 END,deadline LIMIT ?",
                tuple(params),
            ).fetchall()
            return [_row_to_objective(row) for row in rows]
        finally:
            conn.close()


def _task_id(category, title, system=None, station=None, ref=None) -> str:
    raw = "|".join(str(v or "") for v in (category, title, system, station, ref))
    return "task-" + hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


def _destination(value: dict) -> dict | None:
    system = value.get("system") or value.get("dest_system") or value.get("SystemName")
    station = value.get("station") or value.get("dest_station") or value.get("market")
    body = value.get("body")
    if not system and not station and not body:
        return None
    return {"system": system, "station": station, "body": body}


class ObjectiveEngine:
    """Turn the current local snapshot into a feasible session plan.

    The engine never makes a network request.  Optional local search results
    (cargo buyers, colony sources, cash-in stations, PP assignments) are passed
    inside ``snapshot`` and become plot-ready tasks.
    """

    def __init__(self, commander_id: str | None = None, timing_model: TimingModel | None = None):
        self.commander_id = commander_id or marketdb.active_commander_id()
        self.timings = timing_model or TimingModel(self.commander_id)

    def _duration(self, activity, value=None):
        if isinstance(value, (int, float)) and value > 0:
            return int(value * 60)
        return self.timings.estimate(activity)["seconds"]

    def _task(
        self, category, title, *, activity, priority=50, why="", destination=None,
        minutes=None, deadline=None, reward=0, risk=None, depends_on=None, ref=None,
        payload=None,
    ) -> dict:
        destination = destination or None
        seconds = self._duration(activity, minutes)
        task_id = _task_id(
            category, title,
            destination.get("system") if destination else None,
            destination.get("station") if destination else None,
            ref,
        )
        return {
            "id": task_id, "category": category, "title": title,
            "activity": activity, "priority": max(0, min(int(priority), 100)),
            "why": why, "plot": destination, "estimated_seconds": seconds,
            "estimated_minutes": max(1, int(round(seconds / 60))),
            "deadline": _epoch_seconds(deadline), "reward": int(reward or 0),
            "risk": risk, "depends_on": list(depends_on or []),
            "payload": payload or {},
        }

    def _mission_tasks(self, snapshot, now):
        tasks = []
        for mission in snapshot.get("missions") or []:
            expiry = _epoch_seconds(mission.get("expiry_ts") or mission.get("expiry"))
            if expiry and expiry <= now:
                continue
            remaining = expiry - now if expiry else None
            urgency = 95 if remaining is not None and remaining <= 30 * 60 else 80 if remaining is not None and remaining <= 2 * 3600 else 58
            name = mission.get("name") or "Mission"
            destination = _destination(mission)
            delivered = mission.get("delivered") or 0
            total = mission.get("to_deliver") or mission.get("count")
            progress = f" ({delivered}/{total} delivered)" if total else ""
            activity = "mission_delivery"
            minutes = None
            if mission.get("kind") == "combat":
                activity = "combat_kill"
                remaining_kills = max(1, int(mission.get("kill_count") or 1))
                minutes = self.timings.estimate("combat_kill")["seconds"] * remaining_kills / 60
            tasks.append(self._task(
                "missions", f"Complete {name}{progress}", activity=activity,
                priority=urgency, why="Active mission" + (" expires soon" if urgency >= 80 else ""),
                destination=destination, minutes=minutes, deadline=expiry, reward=mission.get("reward"),
                risk="deadline" if urgency >= 80 else None, ref=mission.get("id"), payload=mission,
            ))
        return tasks

    def _engineering_tasks(self, snapshot):
        tasks = []
        plans = snapshot.get("engineering_plans") or snapshot.get("engineering") or []
        if isinstance(plans, dict):
            plans = plans.get("pinned") or plans.get("plans") or []
        for plan in plans:
            name = plan.get("blueprint") or plan.get("name") or "Pinned engineering plan"
            grade = plan.get("grade")
            label = f"{name} G{grade}" if grade else name
            if plan.get("tasks"):
                previous = []
                for index, step in enumerate(plan["tasks"]):
                    task = self._task(
                        "engineering", step.get("title") or f"Work on {label}",
                        activity=step.get("activity") or "engineering_material_stop",
                        priority=step.get("priority", 60), why=step.get("why") or f"Pinned: {label}",
                        destination=_destination(step), minutes=step.get("minutes"),
                        depends_on=step.get("depends_on") or previous, ref=f"{label}:{index}",
                        payload=step,
                    )
                    tasks.append(task)
                    previous = [task["id"]]
                continue
            materials = plan.get("materials") or []
            missing = [m for m in materials if (m.get("short") or m.get("missing") or 0) > 0]
            collect_id = None
            if missing:
                names = ", ".join((m.get("name") or m.get("symbol") or "material") for m in missing[:3])
                suffix = f" +{len(missing) - 3} more" if len(missing) > 3 else ""
                source = plan.get("source") or plan.get("material_source") or {}
                task = self._task(
                    "engineering", f"Collect materials for {label}",
                    activity="engineering_material_stop", priority=62,
                    why=f"Missing {names}{suffix}", destination=_destination(source),
                    ref=f"collect:{label}", payload={"missing": missing},
                )
                tasks.append(task)
                collect_id = task["id"]
            engineer = plan.get("engineer") or {}
            if isinstance(engineer, str):
                engineer = {"name": engineer}
            if plan.get("craftable") or engineer.get("system") or plan.get("engineer_system"):
                destination = {
                    "system": engineer.get("system") or plan.get("engineer_system"),
                    "station": engineer.get("station") or plan.get("engineer_station"),
                    "body": engineer.get("body"),
                }
                destination = destination if any(destination.values()) else None
                tasks.append(self._task(
                    "engineering", f"Engineer {label}", activity="engineering_visit",
                    priority=72 if plan.get("craftable") else 55,
                    why="Materials ready" if plan.get("craftable") else "Finish the pinned upgrade",
                    destination=destination, depends_on=[collect_id] if collect_id else [],
                    ref=f"craft:{label}", payload=plan,
                ))
        return tasks

    def _cargo_tasks(self, snapshot):
        options = snapshot.get("cargo_rescue") or snapshot.get("cargo_options") or []
        if isinstance(options, dict):
            options = [options]
        tasks = []
        for index, option in enumerate(options):
            commodity = option.get("commodity") or option.get("name") or "cargo"
            tons = option.get("tons") or option.get("quantity")
            label = f"Sell {tons} t {commodity}" if tons else f"Rescue {commodity} cargo"
            tasks.append(self._task(
                "cargo", label, activity="trade_hop", priority=100 if option.get("stranded") else 88,
                why=option.get("reason") or "Best verified local buyer for cargo already aboard",
                destination=_destination(option), minutes=option.get("minutes"),
                reward=option.get("profit") or option.get("value"), risk="market" if option.get("stale") else None,
                ref=option.get("id") or index, payload=option,
            ))
        return tasks

    def _colonisation_tasks(self, snapshot):
        tasks = []
        inventory = {
            str(item.get("symbol") or item.get("name") or "").lower(): int(item.get("count") or 0)
            for item in snapshot.get("cargo_inventory") or []
        }
        sources = snapshot.get("colonisation_sources") or {}
        for depot in snapshot.get("colonisation") or []:
            if depot.get("complete") or depot.get("failed"):
                continue
            destination = _destination(depot)
            for resource in (depot.get("resources") or [])[:8]:
                remaining = int(resource.get("remaining") or 0)
                if remaining <= 0:
                    continue
                symbol = str(resource.get("symbol") or resource.get("name") or "").lower()
                aboard = min(remaining, inventory.get(symbol, 0))
                if aboard:
                    tasks.append(self._task(
                        "colonisation", f"Deliver {aboard} t {resource.get('name') or symbol}",
                        activity="colonisation_delivery", priority=86,
                        why="Construction cargo is already aboard", destination=destination,
                        reward=aboard * int(resource.get("payment") or 0),
                        ref=f"deliver:{depot.get('market_id')}:{symbol}", payload=resource,
                    ))
                source_rows = sources.get(symbol) or sources.get(resource.get("name")) or []
                if isinstance(source_rows, dict):
                    source_rows = [source_rows]
                if not aboard and source_rows:
                    source = source_rows[0]
                    collect = self._task(
                        "colonisation", f"Source {resource.get('name') or symbol}",
                        activity="trade_hop", priority=64,
                        why=f"{remaining} t remains at the construction depot",
                        destination=_destination(source), minutes=source.get("minutes"),
                        ref=f"source:{depot.get('market_id')}:{symbol}", payload=source,
                    )
                    tasks.append(collect)
                    tasks.append(self._task(
                        "colonisation", f"Deliver {resource.get('name') or symbol} to construction",
                        activity="colonisation_delivery", priority=63,
                        why="Second leg of the local sourcing run", destination=destination,
                        depends_on=[collect["id"]], ref=f"return:{depot.get('market_id')}:{symbol}",
                        payload=resource,
                    ))
        return tasks

    def _galaxy_tasks(self, snapshot):
        tasks = []
        galaxy = snapshot.get("galaxy") or {}
        explicit = snapshot.get("powerplay_tasks") or galaxy.get("assignments") or []
        for index, item in enumerate(explicit):
            tasks.append(self._task(
                "powerplay", item.get("title") or "Complete Powerplay assignment",
                activity="powerplay_task", priority=item.get("priority", 58),
                why=item.get("why") or "Local Powerplay objective", destination=_destination(item),
                minutes=item.get("minutes"), reward=item.get("merits"), ref=item.get("id") or index,
                payload=item,
            ))
        if not explicit and galaxy.get("powerplay") and galaxy.get("pp_system"):
            pp = galaxy["powerplay"]
            system = snapshot.get("system")
            tasks.append(self._task(
                "powerplay", f"Support {pp.get('power') or 'your Power'} in {system or 'this system'}",
                activity="powerplay_task", priority=45,
                why=f"Current system state: {galaxy['pp_system'].get('state') or 'active'}",
                destination={"system": system} if system else None,
                ref=f"{pp.get('power')}:{system}", payload=galaxy["pp_system"],
            ))
        for goal in galaxy.get("community_goals") or []:
            if goal.get("complete"):
                continue
            tasks.append(self._task(
                "community_goal", f"Contribute to {goal.get('title') or 'community goal'}",
                activity="community_goal_delivery", priority=56,
                why=f"Current contribution: {goal.get('contribution') or 0}",
                destination=_destination(goal), deadline=goal.get("expiry"),
                ref=goal.get("cgid"), payload=goal,
            ))
        return tasks

    def _exploration_tasks(self, snapshot):
        exploration = snapshot.get("exploration") or {}
        bio = snapshot.get("bio") or {}
        vault = (bio.get("vault") or {}) if isinstance(bio, dict) else {}
        value = int(exploration.get("total") or 0) + int(vault.get("total") or 0)
        tasks = []
        cash_in = snapshot.get("exploration_cash_in") or snapshot.get("cash_in_station")
        if value >= 10_000_000:
            tasks.append(self._task(
                "exploration", f"Cash in {value:,} Cr of unsold discoveries",
                activity="exploration_cash_in", priority=98 if value >= 50_000_000 else 82,
                why="Unsold exploration and biology data is lost on destruction",
                destination=_destination(cash_in) if isinstance(cash_in, dict) else None,
                reward=value, risk="destruction", ref=f"cash:{value}",
            ))
        for body in (bio.get("system_signals") or [])[:3] if isinstance(bio, dict) else []:
            count = body.get("count") or len(body.get("genuses") or body.get("community_genuses") or [])
            if count:
                tasks.append(self._task(
                    "exploration", f"Survey {body.get('body') or 'biological body'}",
                    activity="exobiology_sample_cycle", priority=50 + min(int(count), 10),
                    why=f"{count} biological signal{'s' if count != 1 else ''}",
                    destination={"system": snapshot.get("system"), "body": body.get("body")},
                    ref=body.get("body"), payload=body,
                ))
        return tasks

    def _stored_tasks(self, now):
        tasks = []
        rows = ObjectiveStore(self.commander_id).list(statuses=("open", "active"))
        stored_to_task = {}
        for objective in rows:
            payload = objective.get("payload") or {}
            deadline = objective.get("deadline")
            priority = objective.get("priority") or 50
            if deadline and deadline <= now:
                priority = max(priority, 95)
            destination = {
                "system": objective.get("system"), "station": objective.get("station"),
                "body": objective.get("body"),
            }
            destination = destination if any(destination.values()) else None
            seconds = objective.get("estimated_seconds")
            task = self._task(
                objective.get("category") or "objective", objective["title"],
                activity=payload.get("activity") or "station_turnaround", priority=priority,
                why=payload.get("why") or f"Saved objective from {objective.get('source') or 'Frameshift'}",
                destination=destination,
                minutes=(float(seconds) / 60) if seconds else payload.get("minutes"),
                deadline=deadline, reward=objective.get("reward"), risk=objective.get("risk"),
                ref=objective["id"], payload={**payload, "stored_objective_id": objective["id"]},
            )
            task["stored_objective_id"] = objective["id"]
            task["stored_dependencies"] = list(objective.get("dependencies") or [])
            tasks.append(task)
            stored_to_task[objective["id"]] = task["id"]
        for task in tasks:
            task["depends_on"] = [
                stored_to_task[value]
                for value in task.pop("stored_dependencies")
                if value in stored_to_task
            ]
        return tasks

    @staticmethod
    def _select(tasks, budget_s, max_tasks):
        by_id = {task["id"]: task for task in tasks}
        selected = []
        selected_ids = set()
        used = 0

        def bundle(task, visiting=None, bundled=None):
            visiting, bundled = set(visiting or ()), list(bundled or ())
            if task["id"] in selected_ids or any(row["id"] == task["id"] for row in bundled):
                return bundled
            if task["id"] in visiting:
                return None
            visiting.add(task["id"])
            for dependency_id in task["depends_on"]:
                dependency = by_id.get(dependency_id)
                if dependency:
                    bundled = bundle(dependency, visiting, bundled)
                    if bundled is None:
                        return None
            bundled.append(task)
            return bundled

        ranked = sorted(
            tasks,
            key=lambda t: (
                -t["priority"],
                -(t["reward"] / max(t["estimated_seconds"], 1)),
                t["estimated_seconds"], t["title"],
            ),
        )
        for task in ranked:
            if len(selected) >= max_tasks:
                break
            additions = bundle(task)
            if additions is None:
                continue
            additions = [row for row in additions if row["id"] not in selected_ids]
            if len(selected) + len(additions) > max_tasks:
                continue
            if used + sum(row["estimated_seconds"] for row in additions) > budget_s:
                continue
            for addition in additions:
                selected.append(addition)
                selected_ids.add(addition["id"])
                used += addition["estimated_seconds"]
        alternatives = [task for task in ranked if task["id"] not in selected_ids]
        return selected, alternatives, used

    def plan(self, time_budget_minutes: int, snapshot: dict, *, now=None, max_tasks=12) -> dict:
        budget_minutes = max(5, min(int(time_budget_minutes), 24 * 60))
        now = int(now or time.time())
        tasks = []
        tasks.extend(self._cargo_tasks(snapshot))
        tasks.extend(self._mission_tasks(snapshot, now))
        tasks.extend(self._engineering_tasks(snapshot))
        tasks.extend(self._colonisation_tasks(snapshot))
        tasks.extend(self._galaxy_tasks(snapshot))
        tasks.extend(self._exploration_tasks(snapshot))
        tasks.extend(self._stored_tasks(now))

        # De-duplicate stable rule outputs, keeping the highest priority copy.
        unique = {}
        for task in tasks:
            if task["id"] not in unique or task["priority"] > unique[task["id"]]["priority"]:
                unique[task["id"]] = task
        tasks = list(unique.values())
        selected, alternatives, used = self._select(tasks, budget_minutes * 60, max(1, int(max_tasks)))
        edges = [
            {"from": dependency, "to": task["id"]}
            for task in tasks for dependency in task["depends_on"]
        ]
        warnings = []
        if any(task["risk"] == "destruction" and not task.get("plot") for task in tasks):
            warnings.append("Unsold discovery data is at risk, but no local cash-in destination was supplied.")
        if not selected:
            warnings.append("No known objective fits the available local state and time budget.")
        return {
            "commander_id": self.commander_id,
            "budget_minutes": budget_minutes,
            "planned_minutes": int(round(used / 60)),
            "remaining_minutes": max(0, budget_minutes - int(round(used / 60))),
            "selected": selected, "alternatives": alternatives,
            "graph": {"nodes": tasks, "edges": edges}, "warnings": warnings,
            "generated_at": _now_iso(),
        }


class ExtensionActionSink:
    """Validated sink for declarative extension alerts and objectives."""

    def __init__(
        self, commander_id: str | None = None,
        alert_callback: Callable[[dict], None] | None = None,
    ):
        ensure_schema()
        self.commander_id = commander_id or marketdb.active_commander_id()
        self.objectives = ObjectiveStore(self.commander_id)
        self.alert_callback = alert_callback

    def accept(self, action: dict) -> dict:
        if not isinstance(action, dict):
            raise ValueError("extension action must be an object")
        action_type = action.get("type")
        source = "extension:" + (_clean_text(action.get("extension_id"), 64) or "unknown")
        if action_type == "objective":
            title = _clean_text(action.get("title"), 240)
            if not title:
                raise ValueError("extension objective needs a title")
            stable = action.get("source_ref") or hashlib.sha256(_json(action).encode("utf-8")).hexdigest()
            objective = self.objectives.create(
                title, category=action.get("category") or "extension", source=source,
                source_ref=stable, priority=action.get("priority", 50),
                system=action.get("system"), station=action.get("station"), body=action.get("body"),
                estimated_seconds=action.get("estimated_seconds"), deadline=action.get("deadline"),
                reward=action.get("reward"), risk=action.get("risk"), payload=action,
                dependencies=action.get("dependencies"),
            )
            return {"type": "objective", "objective": objective}
        if action_type == "alert":
            text = _clean_text(action.get("text"), 1000)
            if not text:
                raise ValueError("extension alert needs text")
            alert = {
                "id": "alert-" + uuid.uuid4().hex,
                "commander_id": self.commander_id,
                "source": source,
                "level": _clean_text(action.get("level"), 20) or "info",
                "code": _clean_text(action.get("code"), 100) or None,
                "text": text,
                "say": _clean_text(action.get("say"), 1000) or None,
                "created_at": _now_iso(),
            }
            conn = marketdb.connect_user()
            try:
                conn.execute(
                    "INSERT INTO commander_alerts("
                    "id,commander_id,source,level,code,text,say,payload,created_at)"
                    " VALUES(?,?,?,?,?,?,?,?,?)",
                    (
                        alert["id"], self.commander_id, source, alert["level"], alert["code"],
                        alert["text"], alert["say"], _json(action), alert["created_at"],
                    ),
                )
                conn.commit()
            finally:
                conn.close()
            if self.alert_callback:
                self.alert_callback(dict(alert))
            return {"type": "alert", "alert": alert}
        raise ValueError("unsupported extension action type")


def accept_extension_action(action: dict, *, commander_id=None, alert_callback=None) -> dict:
    return ExtensionActionSink(commander_id, alert_callback).accept(action)
