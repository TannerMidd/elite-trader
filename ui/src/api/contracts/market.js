/** @import {JsonObject} from "./common.js" */

/**
 * Query strings deliberately accept their numeric form as well as the form
 * control strings used by the browser.
 *
 * @typedef {string|number} NumericQuery
 *
 * @typedef {{
 *   q: string,
 *   mode?: "buy"|"sell",
 *   radius?: NumericQuery,
 *   min_units?: NumericQuery,
 *   max_price_age_days?: NumericQuery,
 *   max_system_distance?: NumericQuery,
 *   large_pad?: string|number|boolean,
 *   system?: string,
 * }} CommoditySearchQuery
 *
 * @typedef {{
 *   mode?: "loop"|"chain"|string,
 *   source?: "auto"|"local"|"spansh",
 *   system?: string,
 *   station?: string,
 *   capital?: number,
 *   max_cargo?: number,
 *   radius?: number,
 *   max_leg?: number,
 *   jump_range?: number,
 *   results?: number,
 *   min_supply?: number,
 *   max_hop_distance?: number,
 *   max_hops?: number,
 *   max_system_distance?: number,
 *   max_price_age_days?: number,
 *   requires_large_pad?: boolean,
 *   allow_planetary?: boolean,
 *   unique?: boolean,
 * }} TradeRouteRequest
 *
 * @typedef {{
 *   radius?: NumericQuery,
 *   min_price?: NumericQuery,
 *   max_price_age_days?: NumericQuery,
 *   max_system_distance?: NumericQuery,
 *   large_pad?: string|number|boolean,
 *   system?: string,
 * }} MiningQuery
 *
 * @typedef {{
 *   q: string,
 *   type?: "module"|"ship"|string,
 *   system?: string,
 * }} StationSearchQuery
 *
 * @typedef {{
 *   radius?: NumericQuery,
 *   max_price_age_days?: NumericQuery,
 *   large_pad?: string|number|boolean,
 * }} CargoSellQuery
 *
 * @typedef {{
 *   failed_market_id?: string|number|null,
 *   radius?: number,
 *   max_age_days?: number,
 *   large_pad?: boolean,
 *   limit?: number,
 * }} CargoRecoveryRequest
 *
 * @typedef {{
 *   score: number,
 *   band: "high"|"medium"|"low"|string,
 *   age_s: number,
 *   observed_at?: number,
 *   source: string,
 *   bulk_fraction?: number|null,
 *   reasons: string[],
 * }} MarketConfidence
 *
 * @typedef {{
 *   commodities: {symbol: string, name: string, category: string|null}[],
 * }} CommodityListResponse
 *
 * @typedef {{suggestions: string[]}} SuggestionResponse
 *
 * @typedef {{
 *   station: string,
 *   system: string,
 *   type?: string|null,
 *   distance: number,
 *   dist_ls?: number|null,
 *   large_pad?: boolean,
 *   buy_price: number,
 *   sell_price: number,
 *   supply: number,
 *   demand: number,
 *   updated_at: number,
 *   confidence: MarketConfidence,
 *   depth_for_request: number,
 * }} CommoditySearchResult
 *
 * @typedef {{
 *   commodity: string,
 *   symbol?: string,
 *   results: CommoditySearchResult[],
 * }} CommoditySearchResponse
 *
 * @typedef {{
 *   name: string,
 *   symbol?: string,
 *   amount: number,
 *   buy_price: number,
 *   sell_price: number,
 *   profit: number,
 *   supply?: number|null,
 *   demand?: number|null,
 * }} TradeCommodity
 *
 * @typedef {{
 *   station: string,
 *   system: string,
 *   market_id: number,
 *   dist_ls?: number|null,
 *   large_pad?: boolean,
 *   updated_at?: number,
 *   from_player: number,
 * }} TradeEndpoint
 *
 * @typedef {{
 *   a: TradeEndpoint,
 *   b: TradeEndpoint,
 *   distance: number,
 *   positioning_distance?: number,
 *   positioning_minutes?: number,
 *   profit: number,
 *   profit_range?: {low: number, observed: number},
 *   minutes_per_trip?: number,
 *   profit_per_hour?: number,
 *   first_trip_profit_per_hour?: number,
 *   confidence?: MarketConfidence,
 *   outbound?: {profit: number, commodities: TradeCommodity[], confidence: MarketConfidence},
 *   inbound?: {profit: number, commodities: TradeCommodity[], confidence: MarketConfidence},
 * }} TradeLoop
 *
 * @typedef {{
 *   from_system: string,
 *   from_station: string,
 *   to_system: string,
 *   to_station: string,
 *   to_dist_ls?: number|null,
 *   distance: number,
 *   profit: number,
 *   cumulative_profit: number,
 *   profit_range?: {low: number, observed: number},
 *   confidence?: MarketConfidence,
 *   commodities: TradeCommodity[],
 * }} TradeHop
 *
 * @typedef {{
 *   mode: "loop"|"chain",
 *   source: string,
 *   loops?: TradeLoop[],
 *   hops?: TradeHop[],
 * }} TradeRouteResponse
 *
 * @typedef {{
 *   symbol: string,
 *   name: string,
 *   method: string,
 *   sell_price: number,
 *   demand: number,
 *   station: string,
 *   system: string,
 *   distance: number,
 *   dist_ls?: number|null,
 *   large_pad?: boolean,
 *   updated_at: number,
 *   confidence: MarketConfidence,
 * }} MiningResult
 *
 * @typedef {{results: MiningResult[], start: string}} MiningResponse
 *
 * @typedef {{
 *   count: number,
 *   ring: string,
 *   system: string,
 *   distance: number,
 *   dist_ls?: number|null,
 *   reserve?: string|null,
 * }} MiningHotspot
 *
 * @typedef {{
 *   mineral: string,
 *   reference: string|null,
 *   hotspots: MiningHotspot[],
 * }} MiningHotspotsResponse
 *
 * @typedef {{
 *   id?: number|string,
 *   symbol?: string,
 *   name?: string,
 *   category?: string,
 *   buy_price?: number,
 *   sell_price?: number,
 *   stock?: number,
 *   supply?: number,
 *   demand?: number,
 * }} StationMarketItem
 *
 * @typedef {{
 *   market_id?: number,
 *   station?: string,
 *   system?: string,
 *   updated_at?: number,
 *   items: StationMarketItem[],
 * }} StationMarketResponse
 *
 * @typedef {{
 *   market_id: number|null,
 *   history: JsonObject,
 * }} PriceHistoryResponse
 *
 * @typedef {{
 *   station: string,
 *   system: string,
 *   type?: string|null,
 *   distance?: number,
 *   dist_ls?: number|null,
 *   large_pad?: boolean,
 *   market_id?: number|null,
 *   module?: string,
 *   ship?: string,
 * }} StationSearchResult
 *
 * @typedef {{results: StationSearchResult[]}} StationSearchResponse
 *
 * @typedef {{
 *   station: string,
 *   system: string,
 *   distance: number,
 *   dist_ls?: number|null,
 *   type?: string|null,
 *   large_pad?: boolean,
 *   carrier?: boolean,
 * }} ServiceStation
 *
 * @typedef {{
 *   reference: string|null,
 *   carto: ServiceStation[],
 *   bio: ServiceStation[],
 * }} DataSaleStationsResponse
 *
 * @typedef {{
 *   reference: string|null,
 *   stations: ServiceStation[],
 * }} InterstellarFactorsResponse
 *
 * @typedef {{
 *   symbol?: string,
 *   name?: string,
 *   count?: number,
 *   demand?: number,
 *   sell_price?: number,
 *   payout?: number,
 * }} CargoBuyerItem
 *
 * @typedef {{
 *   market_id: number,
 *   station: string,
 *   system: string,
 *   distance: number,
 *   dist_ls?: number|null,
 *   large_pad?: boolean,
 *   updated_at: number,
 *   total: number,
 *   payout_range?: {low: number, observed: number},
 *   confidence: MarketConfidence,
 *   items: CargoBuyerItem[],
 * }} CargoBuyer
 *
 * @typedef {{results: CargoBuyer[]}} CargoSellResponse
 *
 * @typedef {{
 *   reason: string,
 *   excluded_market_id: string|number|null,
 *   recommended: CargoBuyer|null,
 *   alternatives: CargoBuyer[],
 * }} CargoRecoveryResponse
 *
 * @typedef {{
 *   symbol: string,
 *   name?: string,
 *   required?: number,
 *   provided?: number,
 *   remaining: number,
 *   sources: CommoditySearchResult[],
 * }} ColonisationCommoditySource
 *
 * @typedef {{commodities: ColonisationCommoditySource[]}} ColonisationSourcesResponse
 *
 * @typedef {{genera: string[]}} ExobiologyGeneraResponse
 */

export {};
