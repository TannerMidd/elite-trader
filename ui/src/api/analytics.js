import { http } from "../core/http.js";
import { withQuery } from "./query.js";

/** @import {AlertsResponse, AnalyticsResponse, ClearAlertsResponse, HistoryEventsQuery, HistoryEventsResponse, HistorySummaryResponse, RemoveWatchResponse, WatchLoopRequest, WatchLoopResponse} from "./contracts/analytics.js" */

/** @param {typeof http} [client] */
export function createAnalyticsApi(client = http) {
  /** @returns {Promise<AlertsResponse>} */
  function listAlerts() {
    return client.json("/api/alerts", { scope: "commander" });
  }

  /** @param {WatchLoopRequest} loop @returns {Promise<WatchLoopResponse>} */
  function watchLoop(loop) {
    return client.json("/api/watch", {
      method: "POST",
      json: { loop },
      scope: "commander",
    });
  }

  /** @param {string|number} watchId @returns {Promise<RemoveWatchResponse>} */
  function removeWatch(watchId) {
    return client.json("/api/watch/remove", {
      method: "POST",
      json: { id: watchId },
      scope: "commander",
    });
  }

  /** @returns {Promise<ClearAlertsResponse>} */
  function clearAlerts() {
    return client.json("/api/alerts/clear", { method: "POST", scope: "commander" });
  }

  /** @param {number} days @returns {Promise<AnalyticsResponse>} */
  function getAnalytics(days) {
    return client.json(withQuery("/api/analytics", { days }), { scope: "commander" });
  }

  /** @returns {Promise<HistorySummaryResponse>} */
  function getHistorySummary() {
    return client.json("/api/history/summary", { scope: "commander" });
  }

  /**
   * @param {HistoryEventsQuery} query
   * @returns {Promise<HistoryEventsResponse>}
   */
  function listHistoryEvents(query) {
    return client.json(withQuery("/api/history/events", query), { scope: "commander" });
  }

  return Object.freeze({
    listAlerts,
    watchLoop,
    removeWatch,
    clearAlerts,
    getAnalytics,
    getHistorySummary,
    listHistoryEvents,
  });
}

export const analyticsApi = createAnalyticsApi();
