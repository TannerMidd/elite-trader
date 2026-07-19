import { securityApi } from "../api/security.js";
import { requireById } from "../core/dom.js";
import { clear, html, render } from "../core/html.js";
import { appStore } from "../core/store.js";
import { resetGalaxyHistoryWorkspace } from "./galaxy-history.js";
import { clearRouteWorkspace } from "./route-state.js";

/** @import {SecurityStatus} from "../api/contracts/security.js" */

/** @type {SecurityStatus|null} */
export let securityStatus = null;

/** @type {HTMLElement|null} */
export let pairingReturnFocus = null;

/** @type {{element: HTMLElement, inert: boolean, ariaHidden: string|null}[]} */
export let pairingInertState = [];

let pairingGateControlsInitialized = false;

/** @template {HTMLElement} T @param {string} id @returns {T} */
function element(id) {
  return /** @type {T} */ (/** @type {unknown} */ (requireById(id)));
}

/** @param {unknown} error */
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

export function friendlyDeviceName() {
  const userAgentData = Reflect.get(navigator, "userAgentData");
  const platform =
    (userAgentData && typeof userAgentData === "object"
      ? Reflect.get(userAgentData, "platform")
      : null) ||
    navigator.platform ||
    "Browser";
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent || "");
  return `${String(platform)}${mobile ? " tablet" : " browser"}`.slice(0, 80);
}

/** @param {HTMLElement} gate @returns {HTMLElement[]} */
export function pairingFocusable(gate) {
  return [
    ...gate.querySelectorAll(
      'button:not([disabled]):not(.hidden), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ].filter(
    /** @returns {candidate is HTMLElement} */
    (candidate) => candidate instanceof HTMLElement && !candidate.closest(".hidden"),
  );
}

/** @param {KeyboardEvent} event */
export function pairingTrapKeydown(event) {
  const gate = element("pairing-gate");
  if (gate.classList.contains("hidden") || event.key !== "Tab") return;
  const focusable = pairingFocusable(gate);
  if (!focusable.length) {
    event.preventDefault();
    const panel = gate.querySelector(".pairing-panel");
    if (panel instanceof HTMLElement) panel.focus();
    return;
  }
  const first = focusable[0];
  const last = focusable.at(-1);
  if (!first || !last) return;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

/** @param {boolean} open */
export function setPairingModalOpen(open) {
  const gate = element("pairing-gate");
  const wasOpen = !gate.classList.contains("hidden");
  if (open) {
    if (!wasOpen) {
      pairingReturnFocus =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const modalScope = gate.parentElement || document.body;
      pairingInertState = [...modalScope.children].flatMap((candidate) =>
        candidate !== gate && candidate instanceof HTMLElement
          ? [
              {
                element: candidate,
                inert: Boolean(candidate.inert),
                ariaHidden: candidate.getAttribute("aria-hidden"),
              },
            ]
          : [],
      );
      for (const item of pairingInertState) {
        item.element.inert = true;
        item.element.setAttribute("aria-hidden", "true");
      }
      gate.addEventListener("keydown", pairingTrapKeydown);
    }
    gate.classList.remove("hidden");
    gate.setAttribute("aria-hidden", "false");
    setTimeout(() => {
      const panel = gate.querySelector(".pairing-panel");
      const target = pairingFocusable(gate)[0] || (panel instanceof HTMLElement ? panel : null);
      target?.focus();
    }, 0);
    return;
  }
  gate.classList.add("hidden");
  gate.setAttribute("aria-hidden", "true");
  gate.removeEventListener("keydown", pairingTrapKeydown);
  for (const item of pairingInertState) {
    item.element.inert = item.inert;
    if (item.ariaHidden == null) item.element.removeAttribute("aria-hidden");
    else item.element.setAttribute("aria-hidden", item.ariaHidden);
  }
  pairingInertState = [];
  if (pairingReturnFocus?.isConnected) pairingReturnFocus.focus();
  pairingReturnFocus = null;
}

/**
 * @param {string} title
 * @param {string} message
 * @param {boolean} retry
 */
export function showPairingGate(title, message, retry) {
  element("pairing-title").textContent = title;
  element("pairing-message").textContent = message;
  element("pairing-retry").classList.toggle("hidden", !retry);
  setPairingModalOpen(true);
}

export function clearAuthenticatedRuntime() {
  securityStatus = null;
  try {
    appStore.clear();
  } finally {
    clearRouteWorkspace();
    resetGalaxyHistoryWorkspace();
  }
}

/** @param {string} [message] */
export function enterPairingRequired(message) {
  try {
    clearAuthenticatedRuntime();
  } catch (_error) {
    // A stale workspace must never prevent a revoked device from being locked.
  } finally {
    showPairingGate(
      "This device is not paired",
      message ||
        "Access was revoked or expired. Open a new one-time LAN link from Frameshift on the gaming PC.",
      true,
    );
  }
}

/** @returns {Promise<SecurityStatus>} */
export async function fetchSecurityStatus() {
  securityStatus = await securityApi.getStatus();
  return securityStatus;
}

/** @returns {Promise<boolean>} */
export async function bootstrapSecurity() {
  if (!pairingGateControlsInitialized) {
    pairingGateControlsInitialized = true;
    element("pairing-retry").addEventListener("click", () => window.location.reload());
  }
  const url = new URL(window.location.href);
  const code = url.searchParams.get("pair");
  try {
    if (code) {
      showPairingGate(
        "Pairing this device…",
        "Exchanging the one-time cockpit link. No account or password is required.",
        false,
      );
      await securityApi.pairDevice({
        code,
        device_name: friendlyDeviceName(),
      });
      url.searchParams.delete("pair");
      history.replaceState({}, "", url.pathname + (url.search ? url.search : "") + url.hash);
    }
    const status = await fetchSecurityStatus();
    if (status.pairing_required) {
      enterPairingRequired(
        "Open the current one-time LAN link shown in Frameshift on the gaming PC. Previously paired devices reconnect automatically.",
      );
      return false;
    }
    setPairingModalOpen(false);
    return true;
  } catch (error) {
    showPairingGate("Pairing could not finish", errorMessage(error), true);
    return false;
  }
}

/** @param {SecurityStatus|null|undefined} status */
export function pairingAbsoluteUrl(status) {
  const pairing = status?.pairing;
  if (!pairing) return "";
  if (pairing.urls?.length) return pairing.urls[0] ?? "";
  return window.location.origin + pairing.path;
}

/** @param {boolean} [rotate] */
export async function refreshSecurityPanel(rotate = false) {
  try {
    if (rotate) {
      await securityApi.createPairingCode({ scopes: ["admin"] });
    }
    const status = await fetchSecurityStatus();
    const admin = status.scopes?.includes("admin");
    element("pairing-refresh").classList.toggle("hidden", !admin);
    element("security-state").textContent = status.local
      ? `Desktop access is automatic · ${status.paired_devices || 0} paired device${status.paired_devices === 1 ? "" : "s"}`
      : `Paired as ${status.device?.name || "LAN device"} · ${status.scopes.join(" / ")}`;
    const link = pairingAbsoluteUrl(status);
    element("pairing-share").classList.toggle("hidden", !link);
    const pairing = status.pairing;
    if (link && pairing) {
      const pairingLink = /** @type {HTMLInputElement} */ (element("pairing-link"));
      const qr = /** @type {HTMLImageElement} */ (element("pairing-qr"));
      pairingLink.value = link;
      const qrSvg = pairing.qr_svg || "";
      qr.classList.toggle("hidden", !qrSvg);
      if (qrSvg) qr.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(qrSvg);
      const seconds = Math.max(0, Math.round((pairing.expires_at * 1000 - Date.now()) / 1000));
      element("pairing-expiry").textContent =
        `Single use · expires in about ${Math.max(1, Math.ceil(seconds / 60))} minute${seconds > 60 ? "s" : ""}. The device remains paired afterwards.`;
    }
    await renderPairedDevices(Boolean(admin));
  } catch (error) {
    element("security-state").textContent = errorMessage(error);
  }
}

/** @param {boolean} admin */
export async function renderPairedDevices(admin) {
  const list = element("paired-devices");
  clear(list);
  if (!admin) return;
  const devices = (await securityApi.listDevices()).devices || [];
  for (const device of devices) {
    const row = document.createElement("div");
    row.className = "paired-device";
    const main = document.createElement("div");
    main.className = "device-main";
    render(
      main,
      html`<div class="device-name">${device.name || "LAN device"}</div>
        <div class="dim">
          ${device.last_ip || "address unknown"} · last seen ${device.last_seen || "never"}
        </div>`,
    );
    const scope = document.createElement("select");
    for (const value of ["read", "control", "admin"]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value.toUpperCase();
      option.selected =
        (device.scopes || []).includes(value) &&
        !(device.scopes || []).some(
          (other) =>
            ["read", "control", "admin"].indexOf(other) >
            ["read", "control", "admin"].indexOf(value),
        );
      scope.appendChild(option);
    }
    scope.title =
      "READ views data; CONTROL can plot/speak; ADMIN can change settings and pair devices.";
    scope.addEventListener("change", async () => {
      try {
        await securityApi.updateDevice(device.id, { scopes: [scope.value] });
        await refreshSecurityPanel();
      } catch (error) {
        element("security-state").textContent = errorMessage(error);
      }
    });
    const revoke = document.createElement("button");
    revoke.className = "hb hb-utility hb-danger";
    revoke.textContent = "REVOKE";
    revoke.addEventListener("click", async () => {
      try {
        await securityApi.revokeDevice(device.id);
        await refreshSecurityPanel();
      } catch (error) {
        element("security-state").textContent = errorMessage(error);
      }
    });
    row.append(main, scope, revoke);
    list.appendChild(row);
  }
}
