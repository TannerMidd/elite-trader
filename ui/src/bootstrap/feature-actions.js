import { initializeAnalyticsControls } from "../features/controls/analytics.js";
import { initializeEngineeringControls } from "../features/controls/engineering.js";
import { initializeExplorationControls } from "../features/controls/exploration.js";
import { initializeLocalControls } from "../features/controls/local.js";
import { initializeMarketControls } from "../features/controls/market.js";
import { initializeRouteControls } from "../features/controls/routes.js";
import { initializeUpdaterControls } from "../features/controls/updater.js";
import { initializeShellControls } from "../shell/controls.js";

/**
 * Compose pane-owned control initializers after the static application view is
 * mounted. Element IDs and handler details remain inside their owning pane.
 */
export function initializeFeatureActions() {
  initializeShellControls();
  initializeRouteControls();
  initializeMarketControls();
  initializeExplorationControls();
  initializeEngineeringControls();
  initializeLocalControls();
  initializeAnalyticsControls();
  initializeUpdaterControls();
}
