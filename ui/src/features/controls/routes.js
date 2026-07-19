import { requireById } from "../../core/dom.js";
import { persistForm, persistedControl } from "../../core/form-persistence.js";
import { markRouteFormTouched } from "../route-state.js";
import { findRoutes } from "../routes.js";

let initialized = false;

function applyRouteMode() {
  const loop = persistedControl("rf-mode").value === "loop";
  for (const id of ["rf-radius-wrap", "rf-maxleg-wrap", "rf-jumprange-wrap", "rf-results-wrap"]) {
    requireById(id).classList.toggle("hidden", !loop);
  }
  requireById("rf-hop-wrap").classList.toggle("hidden", loop);
  requireById("rf-hops-wrap").classList.toggle("hidden", loop);
}

/** Own trade-route form lifecycle and device-local preferences. */
export function initializeRouteControls() {
  if (initialized) return;
  initialized = true;

  requireById("route-form").addEventListener("submit", findRoutes);
  requireById("route-form").addEventListener("input", () => {
    markRouteFormTouched();
  });
  requireById("rf-mode").addEventListener("change", applyRouteMode);
  if (
    persistForm("route-form", "routeForm", [
      "rf-mode",
      "rf-capital",
      "rf-cargo",
      "rf-radius",
      "rf-maxleg",
      "rf-jumprange",
      "rf-results",
      "rf-hop",
      "rf-hops",
      "rf-minsupply",
      "rf-lsdist",
      "rf-age",
      "rf-largepad",
    ])
  ) {
    markRouteFormTouched();
  }
  applyRouteMode();
}
