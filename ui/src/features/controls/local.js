import { requireById } from "../../core/dom.js";
import { copyText } from "../../core/clipboard.js";
import { initExtensionBuilder, xbDeletePack, xbEditPack } from "../extension-builder.js";
import {
  changeExtensionApproval,
  downloadSupportBundle,
  loadLocalServices,
  reloadExtensions,
} from "../extensions.js";
import { loadProfiles } from "../profiles.js";
import { refreshSecurityPanel } from "../security.js";

let initialized = false;

/** @param {string} id */
function input(id) {
  return /** @type {HTMLInputElement} */ (requireById(id));
}

/** Own Local pane pairing, profiles, diagnostics, and extension controls. */
export function initializeLocalControls() {
  if (initialized) return;
  initialized = true;

  requireById("pairing-copy").addEventListener(
    "click",
    (event) => void copyText(input("pairing-link").value, event.currentTarget),
  );
  requireById("pairing-refresh").addEventListener("click", () => refreshSecurityPanel(true));
  requireById("diagnostics-bundle").addEventListener("click", downloadSupportBundle);
  requireById("extensions-reload").addEventListener("click", reloadExtensions);
  requireById("profiles-refresh").addEventListener("click", () => loadProfiles());
  initExtensionBuilder({ refreshLocalServices: loadLocalServices });
  requireById("extensions-status").addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest("[data-extension-action]");
    if (!(button instanceof HTMLButtonElement)) return;
    const extensionId = button.dataset.extensionId;
    if (!extensionId) return;
    if (button.dataset.extensionAction === "edit") {
      void xbEditPack(extensionId);
      return;
    }
    if (button.dataset.extensionAction === "delete") {
      void xbDeletePack(extensionId, button);
      return;
    }
    const action = button.dataset.extensionAction;
    if (action === "approve" || action === "revoke") {
      void changeExtensionApproval(extensionId, action, button);
    }
  });
}
