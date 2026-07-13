"""Fleet-carrier status, market-order, upkeep, and tritium planning."""

from __future__ import annotations

from .workflowdb import WorkflowStore, event_epoch_ms
from .errors import ValidationError


WORKFLOW = "carrier_ops"
JOURNAL_EVENTS = frozenset(
    {
        "CargoTransfer",
        "CarrierBankTransfer",
        "CarrierCrewServices",
        "CarrierDepositFuel",
        "CarrierFinance",
        "CarrierJump",
        "CarrierJumpCancelled",
        "CarrierJumpRequest",
        "CarrierLocation",
        "CarrierNameChange",
        "CarrierStats",
        "CarrierTradeOrder",
        "CarrierTritiumTransfer",
    }
)


def _symbol(value) -> str:
    text = str(value or "").strip().strip("$;").lower()
    return text[:-5] if text.endswith("_name") else text


def _integer(value, default=0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _number(value, default=None):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _default_state() -> dict:
    return {
        "version": 1,
        "carrier_id": None,
        "carrier_type": None,
        "callsign": None,
        "name": None,
        "location": None,
        "docking_access": None,
        "allow_notorious": None,
        "fuel_t": None,
        "jump_range_current_ly": None,
        "jump_range_max_ly": 500.0,
        "pending_decommission": False,
        "pending_jump": None,
        "space": {},
        "finance": {},
        "services": {},
        "ship_packs": [],
        "module_packs": [],
        "orders": {},
        "inventory": {},
        "inventory_source": "journal transfer deltas only",
        "plan": {
            "weekly_upkeep_cr": None,
            "upkeep_source": "not configured; journal does not report weekly upkeep",
            "reserve_target_weeks": 8,
            "tritium_per_jump_t": None,
            "tritium_reserve_t": 0,
            "route": [],
        },
        "updated_ts": None,
    }


def _finance_fields(source: dict) -> dict:
    result = {}
    mapping = {
        "CarrierBalance": "balance_cr",
        "ReserveBalance": "reserve_cr",
        "AvailableBalance": "available_cr",
        "ReservePercent": "reserve_percent",
    }
    for game, local in mapping.items():
        if source.get(game) is not None:
            result[local] = _integer(source[game])
    taxes = {
        key.removeprefix("TaxRate_").removeprefix("TaxRate").lower() or "general": _integer(value)
        for key, value in source.items()
        if key.startswith("TaxRate") and value is not None
    }
    if taxes:
        result["tax_percent"] = taxes
    return result


def _space_fields(source: dict) -> dict:
    mapping = {
        "TotalCapacity": "capacity_t",
        "Crew": "services_t",
        "Cargo": "cargo_t",
        "CargoSpaceReserved": "orders_reserved_t",
        "ShipPacks": "ship_packs_t",
        "ModulePacks": "module_packs_t",
        "FreeSpace": "free_t",
    }
    return {
        local: _integer(source[game])
        for game, local in mapping.items()
        if source.get(game) is not None
    }


def _service(row: dict) -> dict:
    return {
        "role": row.get("CrewRole"),
        "name": row.get("CrewName"),
        "activated": bool(row.get("Activated")),
        "enabled": bool(row.get("Enabled", row.get("Activated"))),
    }


def _route_summary(state: dict) -> dict:
    plan = state.get("plan") or {}
    legs = list(plan.get("route") or [])
    max_range = (
        _number(state.get("jump_range_current_ly"))
        or _number(state.get("jump_range_max_ly"), 500.0)
        or 500.0
    )
    invalid = []
    total_distance = 0.0
    total_fuel = 0.0
    fuel_known = True
    sources = set()
    configured = _number(plan.get("tritium_per_jump_t"))
    rendered = []
    for index, raw in enumerate(legs):
        leg = dict(raw)
        distance = _number(leg.get("distance_ly"))
        fuel = _number(leg.get("tritium_t"))
        if distance is not None:
            total_distance += max(0, distance)
            if distance <= 0:
                invalid.append({"leg": index + 1, "reason": "distance must be positive"})
            elif distance > max_range:
                invalid.append({
                    "leg": index + 1,
                    "reason": f"distance exceeds observed current {max_range:g} ly jump range",
                })
        if fuel is not None:
            sources.add("per-leg input")
            total_fuel += max(0, fuel)
        elif configured is not None:
            sources.add("configured per-jump estimate")
            fuel = configured
            total_fuel += max(0, fuel)
        else:
            fuel_known = False
        rendered.append({**leg, "distance_ly": distance, "tritium_t": fuel})

    cargo_tritium = _integer((state.get("inventory", {}).get("tritium") or {}).get("count"))
    tank = _integer(state.get("fuel_t")) if state.get("fuel_t") is not None else None
    available = (tank + cargo_tritium) if tank is not None else None
    reserve = max(0, _integer(plan.get("tritium_reserve_t")))
    required = round(total_fuel, 2) if fuel_known else None
    deficit = None
    if required is not None and available is not None:
        deficit = max(0, round(required + reserve - available, 2))
    return {
        "legs": rendered,
        "leg_count": len(rendered),
        "total_distance_ly": round(total_distance, 2),
        "tritium_required_t": required,
        "tritium_source": ", ".join(sorted(sources)) if sources else "unknown; supply per-leg or per-jump input",
        "tank_t": tank,
        "cargo_tritium_t": cargo_tritium,
        "available_t": available,
        "reserve_t": reserve,
        "deficit_t": deficit,
        "valid": not invalid and (required is not None or not rendered),
        "issues": invalid,
    }


def _present(state: dict) -> dict:
    finance = dict(state.get("finance") or {})
    plan = state.get("plan") or {}
    weekly = plan.get("weekly_upkeep_cr")
    reserve = finance.get("reserve_cr")
    target = max(0, _integer(plan.get("reserve_target_weeks"), 8))
    runway = round(reserve / weekly, 1) if reserve is not None and weekly else None
    shortfall = max(0, weekly * target - reserve) if reserve is not None and weekly else None

    orders = []
    buy_exposure = 0
    sale_stock = 0
    for symbol, order in (state.get("orders") or {}).items():
        row = {"symbol": symbol, **order}
        orders.append(row)
        if order.get("side") == "buy":
            buy_exposure += (order.get("quantity") or 0) * (order.get("price_cr") or 0)
        else:
            sale_stock += order.get("quantity") or 0
    orders.sort(key=lambda row: (row.get("side") or "", row.get("name") or row["symbol"]))

    return {
        "carrier_id": state.get("carrier_id"),
        "carrier_type": state.get("carrier_type"),
        "callsign": state.get("callsign"),
        "name": state.get("name"),
        "location": state.get("location"),
        "docking_access": state.get("docking_access"),
        "allow_notorious": state.get("allow_notorious"),
        "fuel_t": state.get("fuel_t"),
        "jump_range_current_ly": state.get("jump_range_current_ly"),
        "jump_range_max_ly": state.get("jump_range_max_ly"),
        "pending_decommission": state.get("pending_decommission"),
        "pending_jump": state.get("pending_jump"),
        "space": dict(state.get("space") or {}),
        "finance": finance,
        "services": sorted((state.get("services") or {}).values(), key=lambda row: row.get("role") or ""),
        "ship_packs": list(state.get("ship_packs") or []),
        "module_packs": list(state.get("module_packs") or []),
        "orders": {
            "items": orders,
            "buy_order_exposure_cr": buy_exposure,
            "sale_order_stock_t": sale_stock,
        },
        "inventory": dict(state.get("inventory") or {}),
        "inventory_source": state.get("inventory_source"),
        "upkeep": {
            "weekly_cr": weekly,
            "source": plan.get("upkeep_source"),
            "reserve_weeks": runway,
            "target_weeks": target,
            "target_shortfall_cr": shortfall,
        },
        "route": _route_summary(state),
        "updated_ts": state.get("updated_ts"),
    }


class CarrierPlanner:
    """Owner-side fleet carrier state and explicit-input route planner."""

    def __init__(self, commander_id: str | None = None):
        self.store = WorkflowStore(WORKFLOW, _default_state, commander_id)

    def _reduce(self, state: dict, event: dict, ts: int, context=None) -> bool:
        kind = event["event"]
        context = context or {}
        event_carrier = event.get("CarrierID")
        own_carrier = state.get("carrier_id")
        if own_carrier and event_carrier and own_carrier != event_carrier:
            return False
        if kind == "CarrierJump" and own_carrier and event_carrier is None:
            pending = state.get("pending_jump") or {}
            destination = event.get("StarSystem") or event.get("SystemName")
            if not pending or destination != pending.get("system"):
                return False

        if event_carrier is not None:
            state["carrier_id"] = event_carrier
        if event.get("CarrierType"):
            state["carrier_type"] = event.get("CarrierType")
        state["updated_ts"] = ts

        if kind == "CarrierStats":
            state.update(
                callsign=event.get("Callsign"),
                name=event.get("Name"),
                docking_access=event.get("DockingAccess"),
                allow_notorious=event.get("AllowNotorious"),
                fuel_t=event.get("FuelLevel"),
                jump_range_current_ly=event.get("JumpRangeCurr"),
                jump_range_max_ly=event.get("JumpRangeMax") or state.get("jump_range_max_ly"),
                pending_decommission=bool(event.get("PendingDecommission")),
                space=_space_fields(event.get("SpaceUsage") or {}),
                finance=_finance_fields(event.get("Finance") or {}),
                services={
                    row.get("CrewRole"): _service(row)
                    for row in event.get("Crew") or [] if row.get("CrewRole")
                },
                ship_packs=list(event.get("ShipPacks") or []),
                module_packs=list(event.get("ModulePacks") or []),
            )
        elif kind == "CarrierFinance":
            state["finance"].update(_finance_fields(event))
        elif kind == "CarrierBankTransfer":
            if event.get("CarrierBalance") is not None:
                state["finance"]["balance_cr"] = _integer(event.get("CarrierBalance"))
            if event.get("PlayerBalance") is not None:
                state["finance"]["player_balance_cr"] = _integer(event.get("PlayerBalance"))
        elif kind == "CarrierNameChange":
            if event.get("Callsign"):
                state["callsign"] = event.get("Callsign")
            if event.get("Name"):
                state["name"] = event.get("Name")
        elif kind == "CarrierCrewServices":
            role = event.get("CrewRole")
            if not role:
                return False
            operation = str(event.get("Operation") or "").casefold()
            service = dict(state["services"].get(role) or {"role": role})
            service["name"] = event.get("CrewName") or service.get("name")
            if operation == "deactivate":
                service.update(activated=False, enabled=False)
            elif operation == "pause":
                service.update(activated=True, enabled=False)
            elif operation in {"activate", "replace", "resume"}:
                service.update(activated=True, enabled=True)
            service["last_operation"] = event.get("Operation")
            state["services"][role] = service
        elif kind == "CarrierTradeOrder":
            symbol = _symbol(event.get("Commodity"))
            if not symbol:
                return False
            if event.get("CancelTrade"):
                state["orders"].pop(symbol, None)
            else:
                buy_quantity = event.get("PurchaseOrder")
                sale_quantity = event.get("SaleOrder")
                side = "buy" if buy_quantity is not None else "sell"
                quantity = buy_quantity if buy_quantity is not None else sale_quantity
                state["orders"][symbol] = {
                    "name": event.get("Commodity_Localised") or event.get("Commodity") or symbol,
                    "side": side,
                    "quantity": max(0, _integer(quantity)),
                    "price_cr": max(0, _integer(event.get("Price"))),
                    "black_market": bool(event.get("BlackMarket")),
                    "updated_ts": ts,
                }
        elif kind == "CarrierJumpRequest":
            state["pending_jump"] = {
                "system": event.get("SystemName"),
                "system_address": event.get("SystemAddress"),
                "body": event.get("Body"),
                "body_id": event.get("BodyID"),
                "departure_ts": event_epoch_ms(event.get("DepartureTime")),
            }
        elif kind == "CarrierJumpCancelled":
            state["pending_jump"] = None
        elif kind in {"CarrierJump", "CarrierLocation"}:
            system = event.get("StarSystem") or event.get("SystemName")
            state["location"] = {
                "system": system,
                "system_address": event.get("SystemAddress"),
                "body": event.get("Body"),
                "body_id": event.get("BodyID"),
            }
            pending = state.get("pending_jump") or {}
            if kind == "CarrierLocation" or (system and system == pending.get("system")):
                state["pending_jump"] = None
        elif kind == "CarrierDepositFuel":
            if event.get("Total") is not None:
                state["fuel_t"] = _integer(event.get("Total"))
        elif kind == "CarrierTritiumTransfer":
            if event.get("Total") is not None:
                state["fuel_t"] = _integer(event.get("Total"))
        elif kind == "CargoTransfer":
            # CargoTransfer can also describe an SRV or somebody else's
            # carrier.  The journal has no owner ID, so require location
            # context rather than silently corrupting the carrier inventory.
            if not context.get("at_own_carrier"):
                return False
            for row in event.get("Transfers") or []:
                direction = str(row.get("Direction") or "").casefold()
                if direction not in {"tocarrier", "toship"}:
                    continue
                symbol = _symbol(row.get("Type"))
                if not symbol:
                    continue
                current = state["inventory"].setdefault(
                    symbol,
                    {
                        "name": row.get("Type_Localised") or row.get("Type") or symbol,
                        "count": 0,
                    },
                )
                delta = _integer(row.get("Count")) * (1 if direction == "tocarrier" else -1)
                current["count"] = max(0, current.get("count", 0) + delta)
        return True

    def observe_event(self, event: dict, event_uid: str | None = None, context=None) -> dict:
        if not isinstance(event, dict) or event.get("event") not in JOURNAL_EVENTS:
            return self.snapshot()
        reducer = lambda state, item, ts: self._reduce(state, item, ts, context)
        state, _ = self.store.apply_event(event, reducer, event_uid)
        return _present(state)

    def configure_upkeep(self, weekly_cr: int | None, target_weeks=8, source="commander input") -> dict:
        if weekly_cr is not None and _integer(weekly_cr) < 0:
            raise ValidationError("weekly upkeep cannot be negative")
        if _integer(target_weeks) < 0:
            raise ValidationError("target weeks cannot be negative")

        def change(state):
            state["plan"]["weekly_upkeep_cr"] = None if weekly_cr is None else _integer(weekly_cr)
            state["plan"]["upkeep_source"] = str(source)
            state["plan"]["reserve_target_weeks"] = _integer(target_weeks)
            return True

        state, _ = self.store.mutate(change)
        return _present(state)

    def plan_route(
        self, legs: list[dict], *, tritium_per_jump_t=None, reserve_t=None
    ) -> dict:
        if not isinstance(legs, list) or any(not isinstance(leg, dict) for leg in legs):
            raise ValidationError("legs must be a list of objects")
        if tritium_per_jump_t is not None and _number(tritium_per_jump_t, -1) < 0:
            raise ValidationError("tritium per jump cannot be negative")
        if reserve_t is not None and _number(reserve_t, -1) < 0:
            raise ValidationError("tritium reserve cannot be negative")

        def change(state):
            state["plan"]["route"] = [dict(leg) for leg in legs]
            state["plan"]["tritium_per_jump_t"] = (
                None if tritium_per_jump_t is None else _number(tritium_per_jump_t)
            )
            if reserve_t is not None:
                state["plan"]["tritium_reserve_t"] = _number(reserve_t)
            return True

        state, _ = self.store.mutate(change)
        return _present(state)

    def set_inventory(self, items, source="commander inventory input") -> dict:
        inventory = {}
        iterable = items.items() if isinstance(items, dict) else (
            (_symbol(row.get("symbol") or row.get("Type") or row.get("Name")), row)
            for row in items or []
        )
        for symbol, raw in iterable:
            symbol = _symbol(symbol)
            if not symbol:
                continue
            if isinstance(raw, dict):
                name = raw.get("name") or raw.get("Type_Localised") or symbol
                count = raw.get("count", raw.get("Count"))
            else:
                name, count = symbol, raw
            inventory[symbol] = {"name": name, "count": max(0, _integer(count))}

        def change(state):
            state["inventory"] = inventory
            state["inventory_source"] = str(source)
            return True

        state, _ = self.store.mutate(change)
        return _present(state)

    def snapshot(self) -> dict:
        return _present(self.store.load())
