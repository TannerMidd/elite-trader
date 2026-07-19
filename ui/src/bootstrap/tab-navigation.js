import { loadAnalytics } from "../features/analytics.js";
import { nudgeDbStatus } from "../features/database.js";
import { loadOpsWorkspace } from "../features/ops/index.js";
import { loadSpecialists, specialistLastFetch } from "../features/specialists/index.js";
import { configureTabActivation, initializeTabs } from "../shell/tabs.js";

/** @param {string} name */
function activateFeatureWorkspace(name) {
  if (name === "analytics") loadAnalytics();
  if (name === "ops") void loadOpsWorkspace();
  if (name === "specialists" && Date.now() - specialistLastFetch() >= 1500) {
    void loadSpecialists();
  }
  if (name === "database") nudgeDbStatus();
}

/** Configure feature activation effects, then wire desktop tab controls. */
export function initializeTabNavigation() {
  configureTabActivation(activateFeatureWorkspace);
  initializeTabs();
}
