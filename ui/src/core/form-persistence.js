import { requireById } from "./dom.js";

/** @typedef {HTMLInputElement|HTMLSelectElement} PersistedControl */

/**
 * @param {string} id
 * @returns {PersistedControl}
 */
export function persistedControl(id) {
  return /** @type {PersistedControl} */ (requireById(id));
}

/**
 * Restore and persist a small, device-local form preference set.
 *
 * @param {string} formId
 * @param {string} storageKey
 * @param {string[]} fieldIds
 * @returns {boolean}
 */
export function persistForm(formId, storageKey, fieldIds) {
  let restored = false;
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
    for (const id of fieldIds) {
      if (!(id in saved)) continue;
      const element = persistedControl(id);
      if (element instanceof HTMLInputElement && element.type === "checkbox") {
        element.checked = Boolean(saved[id]);
      } else {
        element.value = String(saved[id]);
      }
      restored = true;
    }
  } catch {
    // Corrupted storage: keep the server/template defaults.
  }

  requireById(formId).addEventListener("input", () => {
    /** @type {Record<string, string|boolean>} */
    const out = {};
    for (const id of fieldIds) {
      const element = persistedControl(id);
      out[id] =
        element instanceof HTMLInputElement && element.type === "checkbox"
          ? element.checked
          : element.value;
    }
    localStorage.setItem(storageKey, JSON.stringify(out));
  });
  return restored;
}
