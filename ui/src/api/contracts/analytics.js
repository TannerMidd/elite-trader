/** @import {JsonObject} from "./common.js" */

/**
 * Watches persist the planner-produced loop document without translating it.
 * This request map is intentionally open so a saved watch retains new route
 * provenance fields added by future planner versions.
 *
 * @typedef {Record<string, unknown>} WatchLoopRequest
 *
 * @typedef {{
 *   id: number,
 *   label: string,
 *   created: string,
 *   profit?: number|null,
 * }} MarketWatch
 *
 * @typedef {{
 *   ts: string,
 *   watch_id: number,
 *   commander_id: string,
 *   market_id: number|null,
 *   text: string,
 * }} MarketAlert
 *
 * @typedef {{
 *   commander_id: string,
 *   watches: MarketWatch[],
 *   alerts: MarketAlert[],
 * }} AlertsResponse
 *
 * @typedef {{ok: true, watch: {id: number, label: string}}} WatchLoopResponse
 * @typedef {{ok: boolean}} RemoveWatchResponse
 * @typedef {{ok: true}} ClearAlertsResponse
 *
 * @typedef {{
 *   ts: number,
 *   balance: number,
 * }} BalancePoint
 *
 * @typedef {{
 *   date: string,
 *   profit: number,
 *   tons: number,
 * }} DailyTradeSummary
 *
 * @typedef {{
 *   profit: number,
 *   tons: number,
 *   sales: number,
 * }} TradePeriodSummary
 *
 * @typedef {{
 *   symbol: string,
 *   name: string,
 *   profit: number,
 *   tons: number,
 * }} CommodityProfitSummary
 *
 * @typedef {{
 *   start_ts?: number|null,
 *   end_ts?: number|null,
 *   jumps?: number,
 *   distance_ly?: number,
 *   collected_cr?: number,
 *   trade_profit?: number,
 *   tons_sold?: number,
 *   earnings?: {[category: string]: number},
 * }} AnalyticsSession
 *
 * @typedef {{
 *   commander_id: string,
 *   balance: BalancePoint[],
 *   daily: DailyTradeSummary[],
 *   today: TradePeriodSummary,
 *   week: TradePeriodSummary,
 *   period: TradePeriodSummary,
 *   earnings: {[category: string]: number},
 *   session: AnalyticsSession,
 *   top: CommodityProfitSummary[],
 * }} AnalyticsResponse
 *
 * @typedef {{
 *   events: number,
 *   first_event_ts: number|null,
 *   last_event_ts: number|null,
 *   payload_bytes: number,
 *   stored_bytes: number,
 * }} HistoryCategorySummary
 *
 * @typedef {{
 *   commander_id: string,
 *   events: number,
 *   first_event_ts: number|null,
 *   last_event_ts: number|null,
 *   payload_bytes: number,
 *   stored_bytes: number,
 *   categories: {[category: string]: HistoryCategorySummary},
 *   metrics: {
 *     travel: {jumps: number, distance_ly: number},
 *     combat: {bounties: number, bounty_cr: number, bonds: number, bond_cr: number, deaths: number},
 *     missions: {accepted: number, completed: number, failed: number, reward_cr: number},
 *     exploration: {scans: number, organics: number, sold_cr: number},
 *     mining: {refined_tons: number},
 *     carrier: {events: number},
 *   },
 * }} HistorySummaryResponse
 *
 * @typedef {{
 *   categories?: readonly string[],
 *   types?: readonly string[],
 *   since?: number,
 *   until?: number,
 *   system?: string,
 *   limit?: number,
 *   ascending?: boolean,
 * }} HistoryEventsQuery
 *
 * @typedef {{
 *   id: number,
 *   event_uid: string,
 *   event_ts: number,
 *   timestamp: string|null,
 *   event_type: string,
 *   category: string,
 *   system: string|null,
 *   body: string|null,
 *   station: string|null,
 *   source_file: string|null,
 *   source_line: number|null,
 *   event: JsonObject,
 *   payload_size: number,
 *   stored_size: number,
 * }} HistoryEvent
 *
 * @typedef {{events: HistoryEvent[]}} HistoryEventsResponse
 */

export {};
