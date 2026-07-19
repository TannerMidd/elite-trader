import { requireById } from "../../core/dom.js";
import {
  fillEngineeringCatalog,
  findTraders,
  loadEngineering,
  pinBlueprint,
  updateEngineeringGradeFields,
} from "../engineering.js";

let initialized = false;

/** @param {string} id */
function valueControl(id) {
  return /** @type {HTMLInputElement|HTMLSelectElement} */ (requireById(id));
}

/** Own Engineering pane forms and initial load. */
export function initializeEngineeringControls() {
  if (initialized) return;
  initialized = true;

  requireById("engplan-form").addEventListener("submit", (event) => {
    event.preventDefault();
    pinBlueprint({
      id: valueControl("ep-blueprint").value,
      current_grade: Number(valueControl("ep-current").value) || 0,
      target_grade: Number(valueControl("ep-target").value) || 0,
      quantity: Number(valueControl("ep-quantity").value) || 1,
    });
  });
  requireById("ep-search").addEventListener("input", () => fillEngineeringCatalog());
  requireById("ep-kind").addEventListener("change", () => fillEngineeringCatalog());
  requireById("ep-blueprint").addEventListener("change", () => updateEngineeringGradeFields());
  requireById("ep-target").addEventListener("change", () =>
    updateEngineeringGradeFields(
      Number(valueControl("ep-current").value),
      Number(valueControl("ep-target").value),
    ),
  );
  requireById("ep-traders").addEventListener("click", findTraders);
  loadEngineering();
}
