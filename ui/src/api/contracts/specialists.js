/** @import {JsonObject, JsonValue} from "./common.js" */

/**
 * @typedef {{
 *   survey_page?: number,
 *   survey_page_size?: number,
 *   pin_page?: number,
 *   pin_page_size?: number,
 * }} SpecialistPagination
 *
 * @typedef {{
 *   symbol: string,
 *   name: string,
 *   count: number,
 * }} InventoryItem
 *
 * @typedef {{
 *   symbol: string,
 *   name: string,
 *   count: number,
 *   cargo_delta?: number,
 *   sold_t?: number,
 * }} MiningYield
 *
 * @typedef {{
 *   symbol: string,
 *   name: string,
 *   sightings: number,
 *   best_pct: number,
 *   average_pct: number,
 * }} ProspectedMaterial
 *
 * @typedef {{
 *   prospectors_used: number,
 *   collectors_launched: number,
 *   other_launched: number,
 *   estimated_used: number,
 *   inventory_accounting: number|null,
 *   bought: number,
 *   sold: number,
 *   remaining: number|null,
 *   cash_net_cost_cr: number,
 *   estimated_consumed_cost_cr: number|null,
 *   cost_source: string,
 *   limpets_per_tonne: number|null,
 *   cost_per_tonne_cr: number|null,
 * }} MiningLimpetSummary
 *
 * @typedef {{
 *   active: boolean,
 *   started_ts: number,
 *   ended_ts?: number|null,
 *   last_event_ts?: number,
 *   end_reason?: string|null,
 *   duration_s: number,
 *   asteroids_prospected?: number,
 *   asteroids_cracked?: number,
 *   refined_t: number,
 *   refined: MiningYield[],
 *   cargo_yield: MiningYield[],
 *   prospected_materials: ProspectedMaterial[],
 *   tons_per_hour: number|null,
 *   tons_per_asteroid: number|null,
 *   limpets: MiningLimpetSummary,
 *   attributed_revenue_cr: number,
 *   net_after_limpet_cash_cr: number,
 * }} MiningSession
 *
 * @typedef {{
 *   active: boolean,
 *   session: MiningSession|null,
 *   last_cargo: {[symbol: string]: InventoryItem},
 *   history?: MiningSession[],
 * }} MiningWorkflow
 *
 * @typedef {{
 *   ship?: string|null,
 *   pilot_name?: string|null,
 *   pilot_rank?: string|null,
 *   faction?: string|null,
 *   hull_health?: number|null,
 *   shield_health?: number|null,
 *   is_thargoid?: boolean,
 * }} CombatTarget
 *
 * @typedef {{
 *   label?: string,
 *   ready?: boolean,
 *   detail?: string,
 * }} ReadinessCheck
 *
 * @typedef {{
 *   score: number,
 *   level: string,
 *   checklist: ReadinessCheck[],
 *   ammo?: JsonObject,
 * }} CombatReadiness
 *
 * @typedef {{
 *   active: boolean,
 *   started_ts: number,
 *   ended_ts?: number|null,
 *   last_event_ts?: number,
 *   end_reason?: string|null,
 *   duration_s: number,
 *   kills?: number,
 *   ax_kills?: number,
 *   ax_kills_by_type?: {[ship: string]: number},
 *   pvp_kills?: number,
 *   bounty_cr?: number,
 *   bond_cr?: number,
 *   redeemed_cr?: number,
 *   deaths?: number,
 *   damage_events?: number,
 *   synthesis?: {[recipe: string]: number},
 *   synthesis_materials?: {[material: string]: number},
 * }} CombatSession
 *
 * @typedef {{
 *   active: boolean,
 *   session: CombatSession|null,
 *   target: CombatTarget|null,
 *   readiness: CombatReadiness,
 *   synthesis_lifetime: {[recipe: string]: number},
 *   history?: CombatSession[],
 * }} CombatWorkflow
 *
 * @typedef {{
 *   system: string,
 *   system_address?: number|null,
 *   body?: string|null,
 *   body_id?: number|null,
 *   departure_ts?: number|null,
 * }} CarrierLocation
 *
 * @typedef {{
 *   system: string,
 *   distance_ly: number,
 *   tritium_t?: number,
 * }} CarrierRouteLegRequest
 *
 * @typedef {CarrierRouteLegRequest & {
 *   jumps?: number,
 *   tritium_required_t?: number|null,
 *   source?: string,
 * }} CarrierRouteLeg
 *
 * @typedef {{
 *   legs: CarrierRouteLeg[],
 *   leg_count: number,
 *   total_distance_ly: number,
 *   tritium_required_t: number|null,
 *   tritium_source: string,
 *   tank_t: number,
 *   cargo_tritium_t: number,
 *   available_t: number,
 *   reserve_t: number,
 *   deficit_t: number,
 *   valid: boolean,
 *   issues: string[],
 * }} CarrierRouteSummary
 *
 * @typedef {{
 *   weekly_cr: number|null,
 *   source: string|null,
 *   reserve_weeks: number|null,
 *   target_weeks: number,
 *   target_shortfall_cr: number|null,
 * }} CarrierUpkeep
 *
 * @typedef {{
 *   symbol: string,
 *   name: string,
 *   side: "buy"|"sell",
 *   quantity: number,
 *   price_cr: number,
 *   black_market?: boolean,
 *   updated_ts?: number,
 * }} CarrierOrder
 *
 * @typedef {{
 *   carrier_id: number|null,
 *   carrier_type: string|null,
 *   callsign: string|null,
 *   name: string|null,
 *   location: CarrierLocation|null,
 *   docking_access: string|null,
 *   allow_notorious: boolean|null,
 *   fuel_t: number|null,
 *   jump_range_current_ly: number|null,
 *   jump_range_max_ly: number|null,
 *   pending_decommission: boolean|null,
 *   pending_jump: CarrierLocation|null,
 *   space: JsonObject,
 *   finance: JsonObject,
 *   services: JsonObject[],
 *   ship_packs: JsonObject[],
 *   module_packs: JsonObject[],
 *   orders: {
 *     items: CarrierOrder[],
 *     buy_order_exposure_cr: number,
 *     sale_order_stock_t: number,
 *   },
 *   inventory: {[symbol: string]: InventoryItem},
 *   inventory_source: string|null,
 *   upkeep: CarrierUpkeep,
 *   route: CarrierRouteSummary,
 *   updated_ts: number|null,
 * }} CarrierWorkflow
 *
 * @typedef {{
 *   lat: number,
 *   lon: number,
 *   body?: string|null,
 *   radius_m?: number|null,
 *   heading?: number|null,
 *   altitude_m?: number|null,
 * }} SurfacePosition
 *
 * @typedef {{
 *   id: string,
 *   label: string,
 *   kind: string,
 *   source?: string,
 *   lat: number,
 *   lon: number,
 *   created_ts?: number,
 *   metadata?: JsonObject,
 *   distance_m?: number|null,
 *   bearing_deg?: number|null,
 *   relative_bearing_deg?: number|null,
 *   east_m?: number|null,
 *   north_m?: number|null,
 * }} SurfacePin
 *
 * @typedef {{
 *   genus?: string|null,
 *   species?: string|null,
 *   variant?: string|null,
 *   progress?: number,
 *   colony_m?: number|null,
 *   clearance?: JsonObject|null,
 * }} ExobiologySampling
 *
 * @typedef {{
 *   key: string,
 *   system?: string|null,
 *   body?: string|null,
 *   radius_m?: number|null,
 *   pins: SurfacePin[],
 *   pins_total: number,
 *   pin_page: number,
 *   pin_page_size: number,
 *   pin_pages: number,
 *   completed?: JsonObject,
 *   center: SurfacePosition|null,
 *   updated_ts?: number,
 * }} SurfaceMap
 *
 * @typedef {{
 *   key: string,
 *   system?: string|null,
 *   body?: string|null,
 *   pins: number,
 *   completed: number,
 *   updated_ts?: number,
 * }} SurfaceSurveySummary
 *
 * @typedef {{
 *   system: string|null,
 *   system_address: number|null,
 *   position: SurfacePosition|null,
 *   sampling: ExobiologySampling|null,
 *   current_map: SurfaceMap|null,
 *   surveys: SurfaceSurveySummary[],
 *   survey_page: number,
 *   survey_page_size: number,
 *   surveys_total: number,
 *   survey_pages: number,
 *   last_sale_ts: number|null,
 * }} ExobiologyWorkflow
 *
 * @typedef {{
 *   commander_id: string,
 *   mining: MiningWorkflow,
 *   combat: CombatWorkflow,
 *   carrier: CarrierWorkflow,
 *   exobiology: ExobiologyWorkflow,
 * }} SpecialistSnapshot
 *
 * @typedef {{context?: JsonObject, force?: boolean}} MiningStartRequest
 * @typedef {{force?: boolean}} CombatStartRequest
 * @typedef {{weekly_upkeep_cr: number, target_weeks?: number}} CarrierConfigRequest
 *
 * @typedef {{
 *   legs: CarrierRouteLegRequest[],
 *   tritium_per_jump_t?: number|null,
 *   reserve_t?: number,
 * }} CarrierRouteRequest
 *
 * @typedef {InventoryItem[]|{[symbol: string]: InventoryItem}} CarrierInventory
 *
 * @typedef {{
 *   label?: string,
 *   kind?: string,
 *   position?: SurfacePosition,
 *   metadata?: JsonObject,
 * }} ExobiologyPinRequest
 */

export {};
