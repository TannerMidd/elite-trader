# Specialist workflow backend

The specialist trackers are local reducers. They read Frontier journal and
Status.json data, write only to `commander.db`, and require no login, API key,
or companion service.

## Integration

Create one facade after selecting the active commander profile:

```python
from elite.eventledger import EventLedger
from elite.specialists import SpecialistWorkflows

ledger = EventLedger(commander_id)
workflows = SpecialistWorkflows(commander_id)

recorded = ledger.record(
    event,
    source_file=filename,
    source_line=line,
    dedupe_key=f"{filename}:{line}",
)
workflows.observe_event(event, recorded["event_uid"], context=context)
workflows.update_status(app_state.pos)
```

Passing a source-position-based ledger UID makes bootstrap and live-tail
overlap idempotent without collapsing two identical events written in the
same journal second (common for `MiningRefined`). The
facade also exports `EXPECTED_JOURNAL_EVENTS` so a tailer can inspect the full
contract.

`CargoTransfer` does not identify the carrier. Pass
`context={"at_own_carrier": True}` only when the player is at their own
carrier; otherwise the carrier planner deliberately ignores that transfer.

## APIs

- `MiningTracker`: `start`, `observe_event`, `end`, `snapshot`, `history`.
  Tracks prospector results, refined/cargo yield, collector and prospector
  limpets, purchase/sale cost, motherlodes, and only attributes commodity
  revenue up to tonnes refined in that run.
- `CombatTracker`: `start`, `observe_event`, `end`, `update_inputs`,
  `snapshot`, `history`; `ax_readiness` is also a pure function. Ammunition is
  labeled as the most recent `Loadout` observation because weapon firing is
  not emitted to the journal.
- `CarrierPlanner`: `observe_event`, `configure_upkeep`, `plan_route`,
  `set_inventory`, `snapshot`. Weekly upkeep and per-jump/per-leg tritium are
  explicit local inputs because the journal does not provide a reliable
  weekly bill or exact future jump consumption.
- `ExobiologyMapper`: `update_position`, `observe_event`, `add_pin`,
  `remove_pin`, `clear_body`, `snapshot`, `geojson`. Status position supplies
  latitude, longitude, radius, altitude, and heading; journal sample events
  create persistent body-local pins.

## Journal events

- Mining: `ProspectedAsteroid`, `MiningRefined`, `AsteroidCracked`,
  `LaunchDrone`, `BuyDrones`, `SellDrones`, `Cargo`, `CollectCargo`,
  `EjectCargo`, `MarketSell`, `Died`, `Shutdown`.
- Combat/AX: `Loadout`, `Cargo`, `Materials`, `ShipTargeted`, `UnderAttack`,
  `Bounty`, `FactionKillBond`, `CapShipBond`, `PVPKill`, `Synthesis`,
  `HeatDamage`, `HullDamage`, `FighterDestroyed`, `RedeemVoucher`, `Died`,
  `Docked`, `Shutdown`.
- Carrier: `CarrierStats`, `CarrierFinance`, `CarrierBankTransfer`,
  `CarrierCrewServices`, `CarrierTradeOrder`, `CarrierJumpRequest`,
  `CarrierJumpCancelled`, `CarrierJump`, `CarrierLocation`,
  `CarrierDepositFuel`, `CarrierTritiumTransfer`, `CarrierNameChange`, and
  context-qualified `CargoTransfer`.
- Exobiology: `Location`, `FSDJump`, `ApproachBody`, `Scan`,
  `SAASignalsFound`, `ScanOrganic`, `Touchdown`, `CodexEntry`,
  `SellOrganicData`, `Died`, plus Status.json surface position updates.
