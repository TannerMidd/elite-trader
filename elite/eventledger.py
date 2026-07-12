"""Compressed, commander-scoped journal history and replay primitives.

The live :class:`elite.state.AppState` is deliberately small and ephemeral.
This module is the durable counterpart: every useful journal event can be
written once, queried for the lifetime of a commander, and replayed to rebuild
derived features after an upgrade.  Payloads are canonical JSON compressed
with zlib; the canonical digest also makes bootstrap/live overlap idempotent.
"""

from __future__ import annotations

import hashlib
import json
import time
import zlib
from datetime import datetime, timezone
from typing import Iterable, Iterator

from . import marketdb


SCHEMA_VERSION = 1

SCHEMA = """
CREATE TABLE IF NOT EXISTS ledger_events(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    commander_id TEXT NOT NULL,
    event_uid TEXT NOT NULL,
    event_ts INTEGER NOT NULL,
    timestamp TEXT,
    event_type TEXT NOT NULL,
    category TEXT NOT NULL,
    system TEXT,
    body TEXT,
    station TEXT,
    source_file TEXT,
    source_line INTEGER,
    payload BLOB NOT NULL,
    payload_size INTEGER NOT NULL,
    stored_size INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(commander_id, event_uid));
CREATE INDEX IF NOT EXISTS idx_ledger_commander_time
    ON ledger_events(commander_id, event_ts, id);
CREATE INDEX IF NOT EXISTS idx_ledger_commander_category_time
    ON ledger_events(commander_id, category, event_ts);
CREATE INDEX IF NOT EXISTS idx_ledger_commander_type_time
    ON ledger_events(commander_id, event_type, event_ts);
CREATE INDEX IF NOT EXISTS idx_ledger_source
    ON ledger_events(commander_id, source_file, source_line);

CREATE TABLE IF NOT EXISTS ledger_journal_files(
    commander_id TEXT NOT NULL,
    file_key TEXT NOT NULL,
    size_bytes INTEGER,
    mtime_ns INTEGER,
    content_hash TEXT,
    last_line INTEGER NOT NULL DEFAULT 0,
    event_count INTEGER NOT NULL DEFAULT 0,
    first_event_ts INTEGER,
    last_event_ts INTEGER,
    complete INTEGER NOT NULL DEFAULT 0,
    imported_at TEXT,
    error TEXT,
    PRIMARY KEY(commander_id, file_key));

CREATE TABLE IF NOT EXISTS ledger_meta(
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL);
"""


_CATEGORY_EVENTS = {
    "travel": {
        "ApproachBody", "Docked", "DockingCancelled", "DockingDenied",
        "DockingGranted", "DockingRequested", "FSDJump", "FSDTarget",
        "JetConeBoost", "Liftoff", "Location", "NavRoute", "NavRouteClear",
        "StartJump", "SupercruiseEntry", "SupercruiseExit", "Touchdown",
        "Undocked", "USSDrop",
    },
    "combat": {
        "Bounty", "CapShipBond", "CommitCrime", "Died", "EscapeInterdiction",
        "FactionKillBond", "FighterDestroyed", "HeatDamage", "HullDamage",
        "Interdicted", "Interdiction", "PVPKill", "ShieldState",
        "ShipTargeted", "UnderAttack",
    },
    "missions": {
        "MissionAbandoned", "MissionAccepted", "MissionCompleted",
        "MissionFailed", "MissionRedirected", "Missions", "CargoDepot",
        "CommunityGoal", "CommunityGoalDiscard", "CommunityGoalJoin",
        "CommunityGoalReward",
    },
    "exploration": {
        "CodexEntry", "DiscoveryScan", "FSSAllBodiesFound", "FSSBodySignals",
        "FSSDiscoveryScan", "FSSSignalDiscovered", "MaterialDiscovered",
        "MultiSellExplorationData", "NavBeaconScan", "SAAScanComplete",
        "SAASignalsFound", "Scan", "ScanBaryCentre", "ScanOrganic",
        "SellExplorationData", "SellOrganicData",
    },
    "mining": {
        "AsteroidCracked", "LaunchDrone", "MiningRefined", "ProspectedAsteroid",
    },
    "carrier": {
        "CarrierBankTransfer", "CarrierBuy", "CarrierCancelDecommission",
        "CarrierCrewServices", "CarrierDecommission", "CarrierDepositFuel",
        "CarrierDockingPermission", "CarrierFinance", "CarrierJump",
        "CarrierJumpCancelled", "CarrierJumpRequest", "CarrierModulePack",
        "CarrierNameChange", "CarrierShipPack", "CarrierStats", "CarrierTradeOrder",
        "CarrierTritiumTransfer", "CarrierUndock", "CarrierVendor",
    },
    "trade": {
        "BuyTradeData", "CollectCargo", "EjectCargo", "Market", "MarketBuy",
        "MarketSell", "SellDrones", "BuyDrones", "Cargo", "CargoTransfer",
    },
    "engineering": {
        "EngineerContribution", "EngineerCraft", "EngineerProgress",
        "MaterialCollected", "MaterialDiscarded", "MaterialTrade",
        "Synthesis", "TechnologyBroker",
    },
    "galaxy": {
        "ColonisationConstructionDepot", "ColonisationSystemClaim",
        "Powerplay", "PowerplayCollect", "PowerplayDefect",
        "PowerplayDeliver", "PowerplayFastTrack", "PowerplayJoin",
        "PowerplayLeave", "PowerplayMerits", "PowerplayRank", "PowerplaySalary",
        "SquadronDemotion", "SquadronDisbanded", "SquadronPromotion",
        "SquadronStartup",
    },
}

EVENT_CATEGORY = {
    event: category
    for category, events in _CATEGORY_EVENTS.items()
    for event in events
}


def ensure_schema() -> None:
    marketdb.ensure_user_schema(SCHEMA)
    conn = marketdb.connect_user()
    try:
        conn.execute(
            "INSERT OR REPLACE INTO ledger_meta(key, value) VALUES(?, ?)",
            ("schema_version", str(SCHEMA_VERSION)),
        )
        conn.commit()
    finally:
        conn.close()


def parse_event_time(value) -> int:
    """Return epoch milliseconds for journal ISO timestamps or numeric input."""
    if isinstance(value, (int, float)):
        # Journal callers sometimes already use seconds; retain millisecond
        # values without multiplying them again.
        return int(value if value > 10_000_000_000 else value * 1000)
    if isinstance(value, str) and value:
        try:
            dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return int(dt.timestamp() * 1000)
        except ValueError:
            pass
    return int(time.time() * 1000)


def category_for(event_type: str) -> str:
    if event_type.startswith("Carrier"):
        return "carrier"
    if event_type.startswith("Mission"):
        return "missions"
    if event_type.startswith("Powerplay") or event_type.startswith("Squadron"):
        return "galaxy"
    return EVENT_CATEGORY.get(event_type, "other")


def _canonical(event: dict) -> bytes:
    return json.dumps(
        event, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str
    ).encode("utf-8")


def _field(event: dict, *names):
    for name in names:
        value = event.get(name)
        if value is not None and value != "":
            return str(value)
    return None


class EventLedger:
    """Durable journal store for one commander profile."""

    def __init__(self, commander_id: str | None = None):
        ensure_schema()
        self.commander_id = commander_id or marketdb.active_commander_id()

    def _encode(self, event: dict, dedupe_key: str | None = None):
        raw = _canonical(event)
        digest_material = raw if dedupe_key is None else str(dedupe_key).encode("utf-8")
        uid = hashlib.sha256(digest_material).hexdigest()
        return uid, raw, zlib.compress(raw, level=6)

    def _insert(
        self, conn, event: dict, *, source_file=None, source_line=None, dedupe_key=None
    ) -> dict:
        if not isinstance(event, dict) or not event.get("event"):
            raise ValueError("journal event must be an object with an event field")
        event_type = str(event["event"])
        uid, raw, packed = self._encode(event, dedupe_key)
        timestamp = event.get("timestamp")
        event_ts = parse_event_time(timestamp)
        now = datetime.now(timezone.utc).isoformat()
        before = conn.total_changes
        cursor = conn.execute(
            "INSERT OR IGNORE INTO ledger_events("
            "commander_id,event_uid,event_ts,timestamp,event_type,category,system,body,station,"
            "source_file,source_line,payload,payload_size,stored_size,created_at)"
            " VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (
                self.commander_id, uid, event_ts, str(timestamp or ""), event_type,
                category_for(event_type),
                _field(event, "StarSystem", "System", "SystemName"),
                _field(event, "BodyName", "Body"),
                _field(event, "StationName", "Station"),
                str(source_file) if source_file else None,
                int(source_line) if source_line is not None else None,
                packed, len(raw), len(packed), now,
            ),
        )
        inserted = conn.total_changes > before
        if inserted:
            event_id = cursor.lastrowid
        else:
            row = conn.execute(
                "SELECT id FROM ledger_events WHERE commander_id=? AND event_uid=?",
                (self.commander_id, uid),
            ).fetchone()
            event_id = row[0]
        return {"id": event_id, "event_uid": uid, "inserted": inserted}

    def record(
        self, event: dict, *, source_file: str | None = None,
        source_line: int | None = None, dedupe_key: str | None = None,
    ) -> dict:
        conn = marketdb.connect_user()
        try:
            result = self._insert(
                conn, event, source_file=source_file, source_line=source_line,
                dedupe_key=dedupe_key,
            )
            conn.commit()
            return result
        finally:
            conn.close()

    def record_many(self, events: Iterable, *, source_file: str | None = None) -> dict:
        """Write an iterable of events in one transaction.

        Items may be event dictionaries or ``(line_number, event)`` pairs.
        """
        conn = marketdb.connect_user()
        inserted = duplicate = 0
        first_ts = last_ts = None
        last_line = 0
        try:
            conn.execute("BEGIN IMMEDIATE")
            for index, item in enumerate(events, 1):
                if isinstance(item, tuple) and len(item) == 2:
                    line, event = item
                else:
                    line, event = index, item
                dedupe_key = f"{source_file}:{line}" if source_file else None
                result = self._insert(
                    conn, event, source_file=source_file, source_line=line,
                    dedupe_key=dedupe_key,
                )
                inserted += int(result["inserted"])
                duplicate += int(not result["inserted"])
                ts = parse_event_time(event.get("timestamp"))
                first_ts = ts if first_ts is None else min(first_ts, ts)
                last_ts = ts if last_ts is None else max(last_ts, ts)
                last_line = max(last_line, int(line))
            conn.commit()
            return {
                "inserted": inserted, "duplicates": duplicate, "last_line": last_line,
                "first_event_ts": first_ts, "last_event_ts": last_ts,
            }
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def prepare_journal(
        self, file_key: str, *, size_bytes: int | None = None,
        mtime_ns: int | None = None, content_hash: str | None = None,
    ) -> dict:
        """Claim a journal and report whether/import where parsing should resume."""
        conn = marketdb.connect_user()
        try:
            row = conn.execute(
                "SELECT size_bytes,mtime_ns,content_hash,last_line,event_count,complete "
                "FROM ledger_journal_files WHERE commander_id=? AND file_key=?",
                (self.commander_id, str(file_key)),
            ).fetchone()
            unchanged = bool(row and row[5] and (
                content_hash and row[2] == content_hash
                or not content_hash and row[0] == size_bytes and row[1] == mtime_ns
            ))
            resume_line = 0
            if row and size_bytes is not None and row[0] is not None and size_bytes >= row[0]:
                resume_line = int(row[3] or 0)
            if not unchanged:
                conn.execute(
                    "INSERT INTO ledger_journal_files("
                    "commander_id,file_key,size_bytes,mtime_ns,content_hash,last_line,event_count,complete,error)"
                    " VALUES(?,?,?,?,?,?,0,0,NULL)"
                    " ON CONFLICT(commander_id,file_key) DO UPDATE SET "
                    "size_bytes=excluded.size_bytes,mtime_ns=excluded.mtime_ns,"
                    "content_hash=excluded.content_hash,complete=0,error=NULL",
                    (
                        self.commander_id, str(file_key), size_bytes, mtime_ns,
                        content_hash, resume_line,
                    ),
                )
                conn.commit()
            return {
                "needs_import": not unchanged,
                "resume_after_line": resume_line if not unchanged else int(row[3] or 0),
                "event_count": int(row[4] or 0) if row else 0,
            }
        finally:
            conn.close()

    def import_journal(
        self, file_key: str, events: Iterable, *, size_bytes: int | None = None,
        mtime_ns: int | None = None, content_hash: str | None = None,
    ) -> dict:
        """Atomically import events and mark a journal complete.

        Re-importing a journal is safe: canonical event IDs collapse overlap
        with live-tail events and previous partial/bootstrap imports.
        """
        conn = marketdb.connect_user()
        inserted = duplicate = count = 0
        first_ts = last_ts = None
        last_line = 0
        try:
            conn.execute("BEGIN IMMEDIATE")
            for index, item in enumerate(events, 1):
                if isinstance(item, tuple) and len(item) == 2:
                    line, event = item
                else:
                    line, event = index, item
                result = self._insert(
                    conn, event, source_file=str(file_key), source_line=int(line),
                    dedupe_key=f"{file_key}:{int(line)}",
                )
                inserted += int(result["inserted"])
                duplicate += int(not result["inserted"])
                count += 1
                ts = parse_event_time(event.get("timestamp"))
                first_ts = ts if first_ts is None else min(first_ts, ts)
                last_ts = ts if last_ts is None else max(last_ts, ts)
                last_line = max(last_line, int(line))
            conn.execute(
                "INSERT INTO ledger_journal_files("
                "commander_id,file_key,size_bytes,mtime_ns,content_hash,last_line,event_count,"
                "first_event_ts,last_event_ts,complete,imported_at,error)"
                " VALUES(?,?,?,?,?,?,?,?,?,1,?,NULL)"
                " ON CONFLICT(commander_id,file_key) DO UPDATE SET "
                "size_bytes=excluded.size_bytes,mtime_ns=excluded.mtime_ns,"
                "content_hash=excluded.content_hash,last_line=MAX(last_line,excluded.last_line),"
                "event_count=MAX(event_count,excluded.last_line),"
                "first_event_ts=CASE WHEN first_event_ts IS NULL THEN excluded.first_event_ts "
                " ELSE MIN(first_event_ts,excluded.first_event_ts) END,"
                "last_event_ts=CASE WHEN last_event_ts IS NULL THEN excluded.last_event_ts "
                " ELSE MAX(last_event_ts,excluded.last_event_ts) END,"
                "complete=1,imported_at=excluded.imported_at,error=NULL",
                (
                    self.commander_id, str(file_key), size_bytes, mtime_ns, content_hash,
                    last_line, count, first_ts, last_ts,
                    datetime.now(timezone.utc).isoformat(),
                ),
            )
            conn.commit()
            return {
                "inserted": inserted, "duplicates": duplicate, "processed": count,
                "last_line": last_line,
            }
        except Exception as exc:
            conn.rollback()
            conn.execute(
                "INSERT INTO ledger_journal_files(commander_id,file_key,complete,error)"
                " VALUES(?,?,0,?) ON CONFLICT(commander_id,file_key) DO UPDATE SET "
                "complete=0,error=excluded.error",
                (self.commander_id, str(file_key), str(exc)[:500]),
            )
            conn.commit()
            raise
        finally:
            conn.close()

    @staticmethod
    def _decode_row(row) -> dict:
        event = json.loads(zlib.decompress(row[11]).decode("utf-8"))
        return {
            "id": row[0], "event_uid": row[1], "event_ts": row[2],
            "timestamp": row[3], "event_type": row[4], "category": row[5],
            "system": row[6], "body": row[7], "station": row[8],
            "source_file": row[9], "source_line": row[10], "event": event,
            "payload_size": row[12], "stored_size": row[13],
        }

    def query(
        self, *, categories=None, event_types=None, since=None, until=None,
        system=None, limit=200, ascending=False, after_id=None,
    ) -> list[dict]:
        limit = max(1, min(int(limit), 10_000))
        clauses = ["commander_id=?"]
        params: list = [self.commander_id]
        if categories:
            categories = [str(v) for v in categories]
            clauses.append("category IN (" + ",".join("?" for _ in categories) + ")")
            params.extend(categories)
        if event_types:
            event_types = [str(v) for v in event_types]
            clauses.append("event_type IN (" + ",".join("?" for _ in event_types) + ")")
            params.extend(event_types)
        if since is not None:
            clauses.append("event_ts>=?")
            params.append(parse_event_time(since))
        if until is not None:
            clauses.append("event_ts<=?")
            params.append(parse_event_time(until))
        if system:
            clauses.append("system=? COLLATE NOCASE")
            params.append(str(system))
        if after_id is not None:
            clauses.append("id>?")
            params.append(int(after_id))
        order = "ASC" if ascending else "DESC"
        params.append(limit)
        conn = marketdb.connect_user()
        try:
            rows = conn.execute(
                "SELECT id,event_uid,event_ts,timestamp,event_type,category,system,body,station,"
                "source_file,source_line,payload,payload_size,stored_size FROM ledger_events WHERE "
                + " AND ".join(clauses) + f" ORDER BY event_ts {order}, id {order} LIMIT ?",
                tuple(params),
            ).fetchall()
            return [self._decode_row(row) for row in rows]
        finally:
            conn.close()

    def replay(self, **query) -> Iterator[dict]:
        """Yield stored journal payloads oldest-first for deterministic rebuilds."""
        categories = query.pop("categories", None)
        event_types = query.pop("event_types", None)
        since, until = query.pop("since", None), query.pop("until", None)
        system, after_id = query.pop("system", None), query.pop("after_id", None)
        limit = query.pop("limit", None)
        # ``ascending`` is accepted for symmetry but replay is intentionally
        # chronological.  Reject misspellings instead of silently ignoring a
        # filter and replaying more commander history than requested.
        query.pop("ascending", None)
        if query:
            raise TypeError("unsupported replay options: " + ", ".join(sorted(query)))
        clauses = ["commander_id=?"]
        params: list = [self.commander_id]
        if categories:
            categories = [str(value) for value in categories]
            clauses.append("category IN (" + ",".join("?" for _ in categories) + ")")
            params.extend(categories)
        if event_types:
            event_types = [str(value) for value in event_types]
            clauses.append("event_type IN (" + ",".join("?" for _ in event_types) + ")")
            params.extend(event_types)
        if since is not None:
            clauses.append("event_ts>=?")
            params.append(parse_event_time(since))
        if until is not None:
            clauses.append("event_ts<=?")
            params.append(parse_event_time(until))
        if system:
            clauses.append("system=? COLLATE NOCASE")
            params.append(str(system))
        if after_id is not None:
            clauses.append("id>?")
            params.append(int(after_id))
        sql = (
            "SELECT payload FROM ledger_events WHERE " + " AND ".join(clauses)
            + " ORDER BY event_ts ASC,id ASC"
        )
        if limit is not None:
            sql += " LIMIT ?"
            params.append(max(1, int(limit)))
        conn = marketdb.connect_user()
        try:
            cursor = conn.execute(sql, tuple(params))
            while True:
                rows = cursor.fetchmany(500)
                if not rows:
                    return
                for row in rows:
                    yield json.loads(zlib.decompress(row[0]).decode("utf-8"))
        finally:
            conn.close()

    def journal_files(self) -> list[dict]:
        conn = marketdb.connect_user()
        try:
            rows = conn.execute(
                "SELECT file_key,size_bytes,mtime_ns,content_hash,last_line,event_count,"
                "first_event_ts,last_event_ts,complete,imported_at,error "
                "FROM ledger_journal_files WHERE commander_id=? ORDER BY file_key",
                (self.commander_id,),
            ).fetchall()
            keys = (
                "file_key", "size_bytes", "mtime_ns", "content_hash", "last_line",
                "event_count", "first_event_ts", "last_event_ts", "complete",
                "imported_at", "error",
            )
            return [dict(zip(keys, row)) for row in rows]
        finally:
            conn.close()

    def lifetime_summary(self) -> dict:
        conn = marketdb.connect_user()
        try:
            rows = conn.execute(
                "SELECT category,COUNT(*),MIN(event_ts),MAX(event_ts),"
                "SUM(payload_size),SUM(stored_size) FROM ledger_events "
                "WHERE commander_id=? GROUP BY category",
                (self.commander_id,),
            ).fetchall()
            categories = {
                row[0]: {
                    "events": row[1], "first_event_ts": row[2], "last_event_ts": row[3],
                    "payload_bytes": row[4], "stored_bytes": row[5],
                }
                for row in rows
            }
            total = conn.execute(
                "SELECT COUNT(*),MIN(event_ts),MAX(event_ts),SUM(payload_size),SUM(stored_size) "
                "FROM ledger_events WHERE commander_id=?", (self.commander_id,)
            ).fetchone()
        finally:
            conn.close()

        metrics = {
            "travel": {"jumps": 0, "distance_ly": 0.0},
            "combat": {"bounties": 0, "bounty_cr": 0, "bonds": 0, "bond_cr": 0, "deaths": 0},
            "missions": {"accepted": 0, "completed": 0, "failed": 0, "reward_cr": 0},
            "exploration": {"scans": 0, "organics": 0, "sold_cr": 0},
            "mining": {"refined_tons": 0},
            "carrier": {"events": categories.get("carrier", {}).get("events", 0)},
        }
        conn = marketdb.connect_user()
        try:
            metric_rows = conn.execute(
                "SELECT event_type,payload FROM ledger_events WHERE commander_id=? "
                "AND category IN ('travel','combat','missions','exploration','mining') "
                "ORDER BY event_ts,id",
                (self.commander_id,),
            )
            events = (
                (kind, json.loads(zlib.decompress(payload).decode("utf-8")))
                for kind, payload in metric_rows
            )
            for kind, event in events:
                if kind == "FSDJump":
                    metrics["travel"]["jumps"] += 1
                    metrics["travel"]["distance_ly"] += float(event.get("JumpDist") or 0)
                elif kind == "Bounty":
                    metrics["combat"]["bounties"] += 1
                    metrics["combat"]["bounty_cr"] += int(event.get("TotalReward") or event.get("Reward") or 0)
                elif kind in {"FactionKillBond", "CapShipBond"}:
                    metrics["combat"]["bonds"] += 1
                    metrics["combat"]["bond_cr"] += int(event.get("Reward") or 0)
                elif kind == "Died":
                    metrics["combat"]["deaths"] += 1
                elif kind == "MissionAccepted":
                    metrics["missions"]["accepted"] += 1
                elif kind == "MissionCompleted":
                    metrics["missions"]["completed"] += 1
                    metrics["missions"]["reward_cr"] += int(event.get("Reward") or 0)
                elif kind in {"MissionFailed", "MissionAbandoned"}:
                    metrics["missions"]["failed"] += 1
                elif kind in {"Scan", "SAAScanComplete"}:
                    metrics["exploration"]["scans"] += 1
                elif kind == "ScanOrganic" and event.get("ScanType") == "Analyse":
                    metrics["exploration"]["organics"] += 1
                elif kind in {"SellExplorationData", "MultiSellExplorationData", "SellOrganicData"}:
                    value = event.get("TotalEarnings") or event.get("TotalValue")
                    if value is None and kind == "SellOrganicData":
                        value = sum(
                            int(item.get("Value") or 0) + int(item.get("Bonus") or 0)
                            for item in event.get("BioData") or []
                        )
                    metrics["exploration"]["sold_cr"] += int(value or 0)
                elif kind == "MiningRefined":
                    metrics["mining"]["refined_tons"] += int(event.get("Count") or 1)
        finally:
            conn.close()
        metrics["travel"]["distance_ly"] = round(metrics["travel"]["distance_ly"], 2)
        return {
            "commander_id": self.commander_id,
            "events": total[0] or 0,
            "first_event_ts": total[1], "last_event_ts": total[2],
            "payload_bytes": total[3] or 0, "stored_bytes": total[4] or 0,
            "categories": categories, "metrics": metrics,
        }


def record_event(event: dict, **kwargs) -> dict:
    """Convenience entry point for the journal tailer."""
    commander_id = kwargs.pop("commander_id", None)
    return EventLedger(commander_id).record(event, **kwargs)
