import { initOps } from "../features/ops/index.js";
import { plotSystem } from "../features/plot.js";
import { bootstrapSecurity } from "../features/security.js";
import { initSpecialists } from "../features/specialists/index.js";
import { initializeBusyButtonStates } from "../shell/busy-controls.js";
import { panelModeOnLaunch, setPanelMode } from "../shell/panel.js";
import { mountApplicationView } from "../shell/view.js";

/**
 * @param {() => void} initTabs
 * @returns {Promise<boolean>}
 */
export async function initializeShellNavigation(initTabs) {
  mountApplicationView();
  initializeBusyButtonStates();
  try {
    if (!(await bootstrapSecurity())) return false;
    initSpecialists();
    initOps({ plotSystem });
    initTabs();
    // Resolve the pre-paint guard as soon as local authentication is ready.
    // Waiting until the rest of the page's handlers are wired lets the desktop
    // layout flash briefly on every Panel refresh.
    setPanelMode(panelModeOnLaunch(), false);
  } finally {
    // Storage/browser policy or an initialization exception may prevent the
    // normal setPanelMode path. Never leave an authenticated page invisible.
    document.documentElement.classList.remove("panel-mode-prepaint");
  }
  return true;
}
