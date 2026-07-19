import { loadCommodityList } from "../features/commodities.js";
import { pollDbStatus } from "../features/database.js";
import { loadLocalServices } from "../features/extensions.js";
import { loadProfiles } from "../features/profiles.js";
import { pollAlerts, renderRouteProgress } from "../features/routes.js";
import { refreshSecurityPanel } from "../features/security.js";
import { loadSettings } from "../features/settings.js";
import { pollUpdate } from "../features/updater.js";
import { loadTtsStatus } from "../shell/voice.js";

/**
 * @param {() => void|Promise<void>} poll
 */
export function startBackgroundPolling(poll) {
  renderRouteProgress(); // show a persisted route immediately, before first poll
  loadTtsStatus(); // arms the neural voice for callouts if it is installed
  poll();
  pollDbStatus();
  pollAlerts();
  pollUpdate();
  loadSettings();
  refreshSecurityPanel();
  loadLocalServices();
  loadProfiles();
  loadCommodityList();
}
