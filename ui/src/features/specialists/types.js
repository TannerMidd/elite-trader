/**
 * @import {
 *   CarrierOrder,
 *   CarrierRouteLeg,
 *   CarrierRouteLegRequest,
 *   CarrierRouteSummary,
 *   CarrierUpkeep,
 *   CarrierWorkflow,
 *   CombatReadiness,
 *   CombatSession,
 *   CombatTarget,
 *   CombatWorkflow,
 *   ExobiologySampling,
 *   ExobiologyWorkflow,
 *   InventoryItem,
 *   MiningLimpetSummary,
 *   MiningSession,
 *   MiningWorkflow,
 *   SpecialistSnapshot,
 *   SurfaceMap,
 *   SurfacePin,
 *   SurfacePosition,
 * } from "../../api/contracts/specialists.js"
 */

/**
 * Compatibility views preserve older locally stored snapshots while making
 * every field consumed by the UI explicit.
 *
 * @typedef {"mining"|"combat"|"carrier"|"exobiology"} SpecialistName
 *
 * @typedef {Partial<MiningSession> & {
 *   system?: string|null,
 *   body?: string|null,
 *   ring?: string|null,
 *   limpets?: Partial<MiningLimpetSummary>,
 * }} MiningSessionView
 *
 * @typedef {Partial<Pick<MiningSession,
 *   "started_ts"|"ended_ts"|"duration_s"|"refined_t"|"tons_per_hour"|
 *   "asteroids_prospected"|"attributed_revenue_cr"
 * >>} MiningHistoryRow
 *
 * @typedef {Omit<Partial<MiningWorkflow>, "session"|"history"> & {
 *   session?: MiningSessionView|null,
 *   history?: MiningHistoryRow[],
 * }} MiningWorkflowView
 *
 * @typedef {{
 *   item?: string,
 *   slot?: string|null,
 *   clip?: number,
 *   hopper?: number,
 *   total?: number,
 * }} CombatAmmoRow
 *
 * @typedef {Omit<Partial<CombatReadiness>, "checklist"|"ammo"> & {
 *   checklist?: Record<string, boolean>,
 *   ammo?: {
 *     by_module?: CombatAmmoRow[],
 *     observed_total?: number,
 *     precision?: string,
 *   },
 * }} CombatReadinessView
 *
 * @typedef {Partial<CombatSession>} CombatSessionView
 *
 * @typedef {Partial<Pick<CombatSession,
 *   "started_ts"|"ended_ts"|"duration_s"|"kills"|"ax_kills"|"bounty_cr"|
 *   "bond_cr"|"damage_events"|"synthesis"
 * >>} CombatHistoryRow
 *
 * @typedef {Omit<Partial<CombatWorkflow>, "session"|"history"|"readiness"|"target"> & {
 *   session?: CombatSessionView|null,
 *   history?: CombatHistoryRow[],
 *   readiness?: CombatReadinessView,
 *   target?: CombatTarget|null,
 * }} CombatWorkflowView
 *
 * @typedef {{balance_cr?: number|null, reserve_cr?: number|null}} CarrierFinanceView
 * @typedef {{cargo_t?: number|null, capacity_t?: number|null}} CarrierSpaceView
 * @typedef {{leg: number, reason: string}} CarrierRouteIssue
 * @typedef {Omit<Partial<CarrierRouteSummary>, "issues"|"legs"> & {
 *   legs?: CarrierRouteLeg[],
 *   issues?: Array<string|CarrierRouteIssue>,
 * }} CarrierRouteView
 * @typedef {{
 *   items?: CarrierOrder[],
 *   buy_order_exposure_cr?: number,
 *   sale_order_stock_t?: number,
 * }} CarrierOrdersView
 * @typedef {Omit<Partial<CarrierWorkflow>,
 *   "finance"|"space"|"orders"|"upkeep"|"route"|"inventory"
 * > & {
 *   finance?: CarrierFinanceView,
 *   space?: CarrierSpaceView,
 *   orders?: CarrierOrdersView,
 *   upkeep?: Partial<CarrierUpkeep>,
 *   route?: CarrierRouteView,
 *   inventory?: Record<string, InventoryItem>,
 * }} CarrierWorkflowView
 *
 * @typedef {Omit<Partial<SurfacePosition>, "lat"|"lon"> & {
 *   lat?: number,
 *   lon?: number,
 *   alt_m?: number|null,
 * }} SurfacePositionView
 * @typedef {{clear?: boolean|null, min_dist_m?: number|null}} SampleClearance
 * @typedef {Omit<Partial<ExobiologySampling>, "clearance"> & {
 *   clearance?: SampleClearance|null,
 * }} ExobiologySamplingView
 * @typedef {Omit<Partial<SurfaceMap>, "pins"|"center"> & {
 *   pins?: SurfacePin[],
 *   center?: SurfacePositionView|null,
 * }} SurfaceMapView
 * @typedef {Omit<Partial<ExobiologyWorkflow>,
 *   "position"|"sampling"|"current_map"
 * > & {
 *   position?: SurfacePositionView|null,
 *   sampling?: ExobiologySamplingView|null,
 *   current_map?: SurfaceMapView|null,
 * }} ExobiologyWorkflowView
 *
 * @typedef {{
 *   mining?: MiningHistoryRow[],
 *   combat?: CombatHistoryRow[],
 * }} SpecialistHistoryMap
 *
 * @typedef {{
 *   commander_id?: string,
 *   mining?: MiningWorkflowView,
 *   combat?: CombatWorkflowView,
 *   carrier?: CarrierWorkflowView,
 *   exobiology?: ExobiologyWorkflowView,
 *   history?: SpecialistHistoryMap,
 *   histories?: SpecialistHistoryMap,
 *   mining_history?: MiningHistoryRow[],
 *   combat_history?: CombatHistoryRow[],
 * }} SpecialistState
 *
 * @typedef {{
 *   perform: () => Promise<SpecialistSnapshot>,
 *   button: HTMLButtonElement|null,
 *   successMessage: string,
 * }} SpecialistMutationRequest
 *
 * @typedef {(request: SpecialistMutationRequest) => Promise<boolean>} MutationRunner
 *
 * @typedef {{
 *   started_ts?: number|null,
 *   ended_ts?: number|null,
 *   duration_s?: number|null,
 * }} TimedSpecialistSession
 *
 * @typedef {{title: unknown, subtitle: unknown}} SpecialistHistoryDetail
 *
 * @typedef {Partial<CarrierRouteLegRequest>} CarrierRouteLegSeed
 */

export {};
