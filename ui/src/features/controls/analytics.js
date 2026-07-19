import { requireById } from "../../core/dom.js";
import { loadAnalytics } from "../analytics.js";
import { clearGalaxyHistory } from "../galaxy.js";

let initialized = false;

/** Own Analytics and Galaxy history controls. */
export function initializeAnalyticsControls() {
  if (initialized) return;
  initialized = true;
  requireById("an-days").addEventListener("change", loadAnalytics);
  requireById("galhistory-clear").addEventListener("click", clearGalaxyHistory);
}
