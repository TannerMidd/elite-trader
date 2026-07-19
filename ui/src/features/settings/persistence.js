/** @import {JsonValue} from "../../api/contracts/common.js" */
import { settingsApi } from "../../api/settings.js";

/**
 * @param {string} key
 * @param {JsonValue} value
 * @param {HTMLElement|null} [row]
 */
export async function saveSetting(key, value, row = null) {
  try {
    await settingsApi.updateSettings({ [key]: value });
    if (row) {
      row.classList.add("saved");
      window.setTimeout(() => row.classList.remove("saved"), 700);
    }
    return true;
  } catch {
    const input = row?.querySelector("input");
    if (input instanceof HTMLInputElement && input.type === "checkbox") {
      input.checked = !Boolean(value);
    }
    return false;
  }
}
