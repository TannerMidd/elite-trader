/** @import {ApplicationState, JournalRebuildState, StateAlert} from "../api/contracts/state.js" */
import { appStore } from "../core/store.js";
import { byId, requireById, setSafeHref } from "../core/dom.js";
import { clear } from "../core/html.js";
import { openExternal } from "./extensions.js";
import { activateTab } from "../shell/tabs.js";
import { setPanelPage } from "../shell/panel.js";
import { speak } from "../shell/voice.js";
import { alertState } from "./alert-state.js";

/**
 * @typedef {ApplicationState & {
 *   nav: ApplicationState["nav"] & {
 *     advisory?: {code?: string, say?: string, text?: string, level?: string}|null,
 *     system?: string|null,
 *   },
 * }} AlertApplicationState
 * @typedef {Pick<StateAlert, "level"|"text">} ToastAlert
 */

/** @returns {AlertApplicationState|null} */
function currentState() {
  return /** @type {AlertApplicationState|null} */ (appStore.getSnapshot());
}

/** @param {AlertApplicationState|null} [snapshot] */
export function renderBanner(snapshot = currentState()) {
  if (!snapshot) return;
  const banner = /** @type {HTMLElement} */ (requireById("banner"));
  const advisory = snapshot.nav?.advisory;
  const rebuildVisible = !!(
    snapshot.journal_rebuild?.active || snapshot.journal_rebuild?.phase === "error"
  );
  if (!rebuildVisible) delete banner.dataset.rebuildSignature;

  // Speak the fuel advisory once whenever the situation (code + system) changes.
  const signature = advisory ? `${advisory.code || ""}|${snapshot.nav.system || ""}` : null;
  if (alertState.observeFuelSignature(signature) && advisory?.say) {
    speak(advisory.say);
  }

  banner.classList.remove("banner-critical", "banner-warn", "banner-rebuild");
  if (snapshot.journal_dir_found === false) {
    // The folder notice replaces the rebuild subtree. Force reconstruction to
    // recreate its DOM if the folder reappears with the same progress values.
    delete banner.dataset.rebuildSignature;
    if (!banner.querySelector(".banner-settings-btn")) {
      banner.textContent =
        "Elite Dangerous journal folder not found — if the game is installed, point Frameshift at it: ";
      const btn = document.createElement("button");
      btn.className = "hb hb-utility banner-settings-btn";
      btn.textContent = "OPEN SETTINGS";
      btn.addEventListener("click", () => {
        if (document.body.classList.contains("panel-mode")) setPanelPage("database");
        else activateTab("database");
        /** @type {HTMLElement|null} */ (byId("journal-dir-input"))?.focus();
      });
      banner.appendChild(btn);
    }
    banner.classList.remove("hidden");
  } else if (rebuildVisible) {
    renderJournalRebuild(banner, snapshot.journal_rebuild);
  } else if (!snapshot.system) {
    banner.textContent =
      "Waiting for journal data - start Elite Dangerous (or play a bit) and this will fill in.";
    banner.classList.remove("hidden");
  } else if (advisory) {
    banner.textContent = `⚠ ${advisory.text || ""}`;
    banner.classList.add(advisory.level === "critical" ? "banner-critical" : "banner-warn");
    banner.classList.remove("hidden");
  } else {
    banner.classList.add("hidden");
  }
}

export const REBUILD_STAGES = [
  { label: "FLIGHT RECORDER", done: "SYNCED" },
  { label: "COCKPIT RESTORE", done: "RESTORED" },
  { label: "SYSTEMS CHECK", done: "PASS" },
];

/**
 * @param {HTMLElement} banner
 * @param {JournalRebuildState} rebuild
 */
export function renderJournalRebuild(banner, rebuild) {
  const phase = String(rebuild.phase || "preparing");
  const completed = Math.max(0, Number(rebuild.completed) || 0);
  const total = Math.max(0, Number(rebuild.total) || 0);
  const shownCompleted = total ? Math.min(completed, total) : completed;
  const retrying = !!rebuild.retrying;
  const attempt = Number(rebuild.attempt) || 0;
  const current = String(rebuild.current || "");
  const fault = phase === "error";

  const signature = JSON.stringify([phase, shownCompleted, total, attempt, retrying, current]);
  if (banner.dataset.rebuildSignature === signature) {
    banner.classList.add("banner-rebuild");
    banner.classList.remove("hidden");
    return;
  }
  banner.dataset.rebuildSignature = signature;
  banner.replaceChildren();
  banner.classList.add("banner-rebuild");
  banner.classList.toggle("bs-fault", fault);
  banner.classList.toggle("bs-hold", retrying && !fault);

  // Which stage of the fixed pre-flight order is live right now.
  const stageIndex = phase === "bootstrap" ? 1 : phase === "finalizing" ? 2 : 0;
  const count = total
    ? `${String(shownCompleted).padStart(2, "0")}/${String(total).padStart(2, "0")}`
    : "--/--";

  const head = document.createElement("div");
  head.className = "bs-head";
  const dot = document.createElement("span");
  dot.className = "bs-dot";
  const lines = document.createElement("div");
  lines.className = "bs-lines";
  const title = document.createElement("div");
  title.className = "bs-title";
  title.textContent = fault
    ? "STARTUP FAULT"
    : retrying
      ? "STARTUP SEQUENCE — HOLDING"
      : "STARTUP SEQUENCE";
  const sub = document.createElement("div");
  sub.className = "bs-sub";
  sub.textContent = fault
    ? "Commander history could not be reconstructed safely — restart Frameshift once. " +
      "If this returns, create a support bundle from Settings → Diagnostics; " +
      "your journals and databases have not been deleted."
    : retrying
      ? "A local journal or database file was temporarily unavailable — retrying automatically" +
        (attempt ? ` (attempt ${attempt})` : "") +
        "."
      : "Journals are the source of truth: the live cockpit is rebuilt from your " +
        "latest flight logs at every launch.";
  lines.append(title, sub);
  head.append(dot, lines);

  const steps = document.createElement("div");
  steps.className = "bs-steps";
  REBUILD_STAGES.forEach((stage, index) => {
    const step = document.createElement("div");
    step.className = "bs-step";
    const glyph = document.createElement("span");
    glyph.className = "bs-glyph";
    const label = document.createElement("span");
    label.textContent = stage.label;
    const state = document.createElement("span");
    state.className = "bs-step-state";
    if (index < stageIndex) {
      step.classList.add("done");
      glyph.textContent = "✓";
      state.textContent = stage.done;
    } else if (index === stageIndex) {
      step.classList.add(fault ? "fault" : "active");
      glyph.textContent = fault ? "✕" : "▸";
      state.textContent = fault
        ? "FAULT"
        : retrying
          ? `RETRY${attempt ? " " + attempt : ""}`
          : index === 2 || !total
            ? "RUNNING"
            : count;
    } else {
      glyph.textContent = "○";
      state.textContent = "HOLD";
    }
    step.append(glyph, label, state);
    steps.appendChild(step);
  });

  banner.append(head, steps);

  if (!fault) {
    const meter = document.createElement("div");
    meter.className = "bs-meter";
    const bar = document.createElement("div");
    bar.className = "bs-bar";
    bar.setAttribute("role", "progressbar");
    bar.setAttribute("aria-valuemin", "0");
    const fill = document.createElement("div");
    fill.className = "bs-fill";
    if (total) {
      fill.style.width = `${Math.round((100 * shownCompleted) / total)}%`;
      bar.setAttribute("aria-valuemax", String(total));
      bar.setAttribute("aria-valuenow", String(shownCompleted));
      bar.setAttribute("aria-valuetext", `${shownCompleted} of ${total} journals complete`);
      bar.setAttribute("aria-label", `${shownCompleted} of ${total} journals complete`);
    } else {
      bar.classList.add("indeterminate");
      bar.setAttribute("aria-label", "Journal reconstruction in progress");
    }
    bar.appendChild(fill);
    const readout = document.createElement("div");
    readout.className = "bs-readout";
    // Journal filenames carry a timestamp: show it like a log tape readout.
    const tape = current.replace(/^Journal\./, "").replace(/\.\d+\.log$/i, "");
    readout.textContent =
      phase === "finalizing"
        ? "CROSS-CHECK · PRESERVED DATA"
        : (total ? `LOG ${count}` : "LOG --/--") + (tape ? ` · ${tape}` : "");
    meter.append(bar, readout);
    banner.appendChild(meter);
  }
  banner.classList.remove("hidden");
}

/** @param {AlertApplicationState|null} [snapshot] */
export function handleAlerts(snapshot = currentState()) {
  const alerts = snapshot?.alerts || [];
  // On the first state we see, adopt its high-water mark without speaking, so
  // alerts that fired before the page opened don't all replay at once.
  for (const alert of alertState.consumeStateAlerts(alerts)) {
    if (alert.say) speak(alert.say);
    showFlightToast(alert);
  }
}

/** @param {ToastAlert} alert */
export function showFlightToast(alert) {
  const toast = /** @type {HTMLElement|null} */ (byId("flight-toast"));
  if (!toast) return;
  toast.textContent = alert.text || "";
  toast.className =
    "flight-toast " +
    (alert.level === "critical"
      ? "toast-critical"
      : alert.level === "warn"
        ? "toast-warn"
        : "toast-info");
  toast.classList.remove("hidden");
  alertState.scheduleFlightToast(() => toast.classList.add("hidden"));
}

/** @param {AlertApplicationState|null} [snapshot] */
export function renderLinks(snapshot = currentState()) {
  if (!snapshot) return;
  const row = /** @type {HTMLElement} */ (requireById("links"));
  const links = snapshot.links || [];
  const sig = JSON.stringify(links);
  if (row.dataset.sig === sig) return;
  row.dataset.sig = sig;
  clear(row);
  for (const l of links) {
    const a = document.createElement("a");
    setSafeHref(a, l.url);
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = l.label;
    a.addEventListener("click", (ev) => {
      if (openExternal(l.url, l.label)) ev.preventDefault();
    });
    row.appendChild(a);
  }
}
