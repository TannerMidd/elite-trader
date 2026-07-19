import { startBackgroundPolling } from "./bootstrap/background-polling.js";
import { initializeFeatureActions } from "./bootstrap/feature-actions.js";
import { initializeShellNavigation } from "./bootstrap/shell-navigation.js";
import { initializeProfileLifecycle, pollApplicationState } from "./bootstrap/state-coordinator.js";
import { initializeTabNavigation } from "./bootstrap/tab-navigation.js";

document.addEventListener("DOMContentLoaded", async () => {
  initializeProfileLifecycle();
  if (!(await initializeShellNavigation(initializeTabNavigation))) return;
  initializeFeatureActions();
  startBackgroundPolling(pollApplicationState);
});
