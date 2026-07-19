/** @import {ApplicationState} from "../api/contracts/state.js" */
import { systemApi } from "../api/system.js";
import { requireById } from "../core/dom.js";
import { appStore } from "../core/store.js";
import { showFlightToast } from "./alerts.js";

export const LAUNCH_IDLE_LABEL = "▲ LAUNCH ELITE DANGEROUS";

export const LAUNCH_IDLE_STATUS = "Game offline — showing your last session's data";

/** @type {number} */
export let launchSentAt = 0;

/** @type {ReturnType<typeof setTimeout> | null} */
export let launchStageTimer = null;

/**
 * @param {string} id
 * @returns {HTMLElement}
 */
function element(id) {
  return /** @type {HTMLElement} */ (requireById(id));
}

/** @param {string} statusText */
export function resetLaunchUI(statusText) {
  launchSentAt = 0;
  clearTimeout(launchStageTimer ?? undefined);
  element("game-offline").classList.remove("launching");
  /** @type {HTMLButtonElement} */ (element("launch-game")).disabled = false;
  element("launch-label").textContent = LAUNCH_IDLE_LABEL;
  element("launch-status").textContent = statusText;
}

/** @param {ApplicationState|null} [snapshot] */
export function renderGameState(
  snapshot = /** @type {ApplicationState|null} */ (appStore.getSnapshot()),
) {
  if (!snapshot) return;
  const bar = element("game-offline");
  const offline = snapshot.game_running === false;
  bar.classList.toggle("show", offline);
  if (!offline && launchSentAt) {
    // Telemetry is flowing: the launch worked.
    resetLaunchUI(LAUNCH_IDLE_STATUS);
    showFlightToast({ level: "info", text: "✦ LAUNCH CONFIRMED · journal telemetry live · o7" });
  } else if (offline && launchSentAt && Date.now() - launchSentAt > 60000) {
    // The game writes its journal within seconds of starting, so a silent
    // minute means it isn't coming (killed during loading, launcher stuck).
    resetLaunchUI(
      "No telemetry after a minute — the game may not have started. Launch again when ready.",
    );
  }
}

export async function launchGame() {
  if (launchSentAt) {
    // Second press while spooling = abort the wait (QA found the game can be
    // exited mid-load, which would otherwise leave the sequence hanging).
    // A short grace period first: an accidental double-tap on a touchscreen
    // must not "abort" a launch that is genuinely underway.
    if (Date.now() - launchSentAt < 2000) return;
    resetLaunchUI("Sequence aborted — launch again when ready.");
    return;
  }
  const bar = element("game-offline");
  const btn = /** @type {HTMLButtonElement} */ (element("launch-game"));
  const status = element("launch-status");
  btn.disabled = true; // only while the request itself is in flight
  bar.classList.add("launching");
  element("launch-label").textContent = "IGNITION SEQUENCE ENGAGED";
  status.textContent = "T-0 · handing off to the launcher…";
  try {
    const data = await systemApi.launchGame();
    launchSentAt = Date.now();
    btn.disabled = false; // pressing again now aborts
    status.textContent =
      (data.already_running
        ? "The game is already running — waiting for its journal telemetry."
        : `T-0 · handed off to ${data.via} — spooling up…`) + " Press again to abort.";
    clearTimeout(launchStageTimer ?? undefined);
    launchStageTimer = setTimeout(() => {
      if (launchSentAt)
        status.textContent =
          "Awaiting journal telemetry — the cockpit takes a minute or two. Press again to abort.";
    }, 12000);
  } catch (err) {
    resetLaunchUI(String(err instanceof Error ? err.message : err));
  }
}
