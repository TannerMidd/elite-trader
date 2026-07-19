/** Public route feature facade. Route state, requests, rendering, and progress remain separately owned. */

export { commodityTableHtml } from "./route-result-templates.js";
export {
  confidenceAgeText,
  confidenceHtml,
  creditRangeHtml,
  renderLoops,
  renderRoutes,
} from "./route-results.js";
export { findBestLoop, findRoutes, seedRouteForm } from "./route-search.js";
export {
  advanceRoute,
  renderPanelRouteLine,
  renderRouteProgress,
  stopRoute,
  syncRouteToPosition,
  sysEq,
  trackButton,
  trackRoute,
} from "./route-progress.js";
export {
  activeRouteKey,
  clearRouteWorkspace,
  getActiveRoute,
  getActiveRouteCommander,
  loadActiveRoute,
  profileStorageId,
  saveActiveRoute,
} from "./route-state.js";
export {
  clearAlertWorkspace,
  pollAlerts,
  renderAlerts,
  renderWatches,
  watchLoop,
} from "./route-alerts.js";
