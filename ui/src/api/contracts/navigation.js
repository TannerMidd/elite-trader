/**
 * @typedef {{
 *   system: string,
 *   dry_run?: boolean,
 *   close_map?: boolean,
 * }} PlotSystemRequest
 *
 * @typedef {{
 *   ok?: boolean,
 *   cancelled?: boolean,
 *   system: string,
 *   steps?: string[],
 * }} PlotSystemResponse
 *
 * @typedef {{
 *   ok: boolean,
 *   cancelling: boolean,
 * }} CancelPlotResponse
 *
 * @typedef {{
 *   from?: string,
 *   to?: string,
 *   jump_range?: number,
 *   radius?: number,
 *   max_results?: number,
 *   max_distance?: number,
 *   min_value?: number,
 *   loop?: boolean,
 * }} RichesRouteRequest
 *
 * @typedef {{
 *   name: string,
 *   type?: string|null,
 *   terraformable?: boolean,
 *   dist_ls?: number|null,
 *   map_value?: number,
 *   scan_value?: number,
 * }} RichesBody
 *
 * @typedef {{
 *   system: string,
 *   total_value: number,
 *   bodies: RichesBody[],
 * }} RichesSystem
 *
 * @typedef {{
 *   systems: RichesSystem[],
 * }} RichesRouteResponse
 *
 * @typedef {{
 *   from?: string,
 *   to: string,
 *   jump_range?: number,
 *   efficiency?: number,
 * }} NeutronRouteRequest
 *
 * @typedef {{
 *   system: string,
 *   neutron?: boolean,
 *   jumps?: number|null,
 *   distance_jumped?: number|null,
 *   distance_left?: number|null,
 * }} NeutronWaypoint
 *
 * @typedef {{
 *   waypoints: NeutronWaypoint[],
 *   total_jumps: number,
 *   distance?: number,
 * }} NeutronRouteResponse
 *
 * @typedef {{
 *   system?: string,
 *   max_gravity?: string|number,
 *   min_value?: string|number,
 *   genera?: string,
 * }} ExobiologyRouteQuery
 *
 * @typedef {{
 *   body: string,
 *   subtype?: string|null,
 *   gravity: number,
 *   dist_ls?: number|null,
 *   value: number,
 *   genuses?: string[],
 * }} ExobiologyBody
 *
 * @typedef {{
 *   system: string,
 *   distance: number,
 *   value: number,
 *   bodies: ExobiologyBody[],
 * }} ExobiologySystem
 *
 * @typedef {{
 *   reference: string|null,
 *   systems: ExobiologySystem[],
 *   genera: string[],
 *   total_value: number,
 *   relaxed: string|null,
 * }} ExobiologyRouteResponse
 */

export {};
