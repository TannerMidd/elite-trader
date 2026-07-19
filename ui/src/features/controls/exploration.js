import { requireById } from "../../core/dom.js";
import { persistForm } from "../../core/form-persistence.js";
import { buildExoGenusChips, searchExobio } from "../exobio.js";
import { planNeutron, planRiches } from "../planners.js";

let initialized = false;

/** Own exobiology and route-planner form lifecycle. */
export function initializeExplorationControls() {
  if (initialized) return;
  initialized = true;

  requireById("exo-form").addEventListener("submit", searchExobio);
  buildExoGenusChips();
  requireById("rr-form").addEventListener("submit", planRiches);
  requireById("nr-form").addEventListener("submit", planNeutron);

  persistForm("nr-form", "neutronForm", ["nr-to", "nr-range", "nr-eff"]);
  persistForm("rr-form", "richesForm", [
    "rr-range",
    "rr-radius",
    "rr-minvalue",
    "rr-max",
    "rr-loop",
  ]);
  persistForm("exo-form", "exoForm", ["exo-grav", "exo-minvalue"]);
}
