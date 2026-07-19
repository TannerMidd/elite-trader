import { analyticsApi } from "../api/analytics.js";
import { byId } from "../core/dom.js";
import { clear } from "../core/html.js";
import { appStore } from "../core/store.js";
import { recoverCargo } from "./colonisation.js";
import { alertState } from "./alert-state.js";

/**
 * @import {
 *   MarketAlert,
 *   MarketWatch,
 *   WatchLoopRequest,
 * } from "../api/contracts/analytics.js"
 */

/**
 * This open request map is intentional: planner provenance added by future
 * route versions must survive when a loop is persisted as a watch.
 *
 * @param {WatchLoopRequest} loop
 * @param {HTMLButtonElement} button
 */
export async function watchLoop(loop, button) {
  if (window.Notification && Notification.permission === "default") {
    try {
      await Notification.requestPermission();
    } catch {
      // Notifications are optional; the in-app alert remains available.
    }
  }
  try {
    await analyticsApi.watchLoop(loop);
    button.textContent = "WATCHING";
    button.disabled = true;
    pollAlerts();
  } catch (error) {
    alert(error instanceof Error ? error.message : String(error));
  }
}

export function clearAlertWorkspace() {
  alertState.reset();
  const watchList = byId("watch-list");
  if (watchList) clear(watchList);
  const alertStrip = byId("alert-strip");
  if (alertStrip) {
    clear(alertStrip);
    alertStrip.classList.add("hidden");
  }
  const flightToast = byId("flight-toast");
  if (flightToast) {
    flightToast.classList.add("hidden");
    flightToast.textContent = "";
  }
}

export async function pollAlerts() {
  const identity = appStore.identity();
  alertState.cancelPoll();
  if (!identity.commanderId) {
    clearAlertWorkspace();
    return;
  }
  try {
    const data = await analyticsApi.listAlerts();
    if (!appStore.isCurrent(identity) || data.commander_id !== identity.commanderId) {
      return;
    }
    renderWatches(data.watches);
    renderAlerts(data.alerts);
  } catch {
    // Retry on the next poll.
  }
  if (appStore.isCurrent(identity)) {
    alertState.schedulePoll(() => void pollAlerts());
  }
}

/** @param {MarketWatch[]} watches */
export function renderWatches(watches) {
  const list = byId("watch-list");
  if (!list) return;
  clear(list);
  for (const watch of watches) {
    const chip = document.createElement("span");
    chip.className = "watch-chip";
    chip.append(`👁 ${watch.label} `);
    const remove = document.createElement("button");
    remove.className = "hb hb-utility hb-icon hb-sm";
    remove.textContent = "×";
    remove.title = "Stop watching";
    remove.addEventListener("click", async () => {
      await analyticsApi.removeWatch(watch.id);
      pollAlerts();
    });
    chip.appendChild(remove);
    list.appendChild(chip);
  }
}

/** @param {MarketAlert[]} alerts */
export function renderAlerts(alerts) {
  const strip = byId("alert-strip");
  if (!strip) return;
  if (!alerts.length) {
    strip.classList.add("hidden");
    return;
  }
  const newest = alerts[0];
  if (!newest) return;
  const previousTimestamp = alertState.replaceRouteAlertTimestamp(newest.ts);
  if (newest.ts !== previousTimestamp) {
    if (
      previousTimestamp !== null &&
      window.Notification &&
      Notification.permission === "granted"
    ) {
      try {
        new Notification("Frameshift route alert", { body: newest.text });
      } catch {
        // Browser notification support varies; keep the in-app alert visible.
      }
    }
  }
  strip.classList.remove("hidden");
  clear(strip);
  for (const alertItem of alerts.slice(0, 3)) {
    const row = document.createElement("div");
    row.className = "alert-row";
    const message = document.createElement("span");
    message.textContent = `⚠ ${alertItem.text}`;
    row.appendChild(message);
    if (alertItem.market_id != null) {
      const marketId = alertItem.market_id;
      const recover = document.createElement("button");
      recover.className = "hb hb-utility alert-recover";
      recover.textContent = "RECOVER CARGO";
      recover.title =
        "Use the cargo currently aboard to find a different buyer, excluding the degraded market";
      recover.addEventListener("click", () => recoverCargo(marketId, recover));
      row.appendChild(recover);
    }
    strip.appendChild(row);
  }
  const dismiss = document.createElement("button");
  dismiss.className = "hb hb-ghost hb-sm";
  dismiss.textContent = "dismiss";
  dismiss.addEventListener("click", async () => {
    await analyticsApi.clearAlerts();
    pollAlerts();
  });
  strip.appendChild(dismiss);
}
