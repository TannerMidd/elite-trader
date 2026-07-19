/**
 * @import {
 *   CarrierWorkflowView,
 *   CombatHistoryRow,
 *   CombatWorkflowView,
 *   ExobiologyWorkflowView,
 *   MiningHistoryRow,
 *   MiningWorkflowView,
 *   SpecialistMutationRequest,
 *   SpecialistName,
 *   SpecialistState,
 * } from "./types.js"
 */
import { specialistsApi } from "../../api/specialists.js";
import { byId } from "../../core/dom.js";
import { appStore, commanderIdOf } from "../../core/store.js";
import {
  initCarrierSpecialist,
  renderCarrierSpecialist,
  resetCarrierSpecialist,
} from "./carrier.js";
import { initCombatSpecialist, renderCombatSpecialist } from "./combat.js";
import { normaliseSpecialistSnapshot, specialistError } from "./core.js";
import { initExobiologySpecialist, renderExobiologySpecialist } from "./exobiology.js";
import { initMiningSpecialist, renderMiningSpecialist } from "./mining.js";

/** @type {readonly SpecialistName[]} */
const SPECIALIST_NAMES = ["mining", "combat", "carrier", "exobiology"];

/** @type {SpecialistState|null} */
let specialistState = null;
/** @type {Promise<SpecialistState|null>|null} */
let specialistLoading = null;
let lastFetchAt = 0;
let resetEpoch = 0;
let initialized = false;
/** @type {number|null} */
let refreshTimer = null;
/** @type {null|(() => void)} */
let unsubscribeProfile = null;

/** @returns {MiningWorkflowView} */
function miningWorkflow() {
  return specialistState?.mining || {};
}

/** @returns {CombatWorkflowView} */
function combatWorkflow() {
  return specialistState?.combat || {};
}

/** @returns {CarrierWorkflowView} */
function carrierWorkflow() {
  return specialistState?.carrier || {};
}

/** @returns {ExobiologyWorkflowView} */
function exobiologyWorkflow() {
  return specialistState?.exobiology || {};
}

/** @returns {MiningHistoryRow[]} */
function miningHistory() {
  return (
    specialistState?.mining?.history ||
    specialistState?.history?.mining ||
    specialistState?.histories?.mining ||
    specialistState?.mining_history ||
    []
  );
}

/** @returns {CombatHistoryRow[]} */
function combatHistory() {
  return (
    specialistState?.combat?.history ||
    specialistState?.history?.combat ||
    specialistState?.histories?.combat ||
    specialistState?.combat_history ||
    []
  );
}

/** @param {string} value @returns {value is SpecialistName} */
function isSpecialistName(value) {
  return SPECIALIST_NAMES.some((name) => name === value);
}

/** @param {unknown} requestedName */
function setSpecialistWorkflow(requestedName) {
  const candidate = String(requestedName || "");
  const name = isSpecialistName(candidate) ? candidate : "mining";
  localStorage.setItem("specialistWorkflow", name);
  document.querySelectorAll(".sp-switcher [data-specialist]").forEach((element) => {
    if (!(element instanceof HTMLElement)) return;
    const active = element.dataset.specialist === name;
    element.setAttribute("aria-pressed", String(active));
    element.setAttribute("aria-selected", String(active));
    element.tabIndex = active ? 0 : -1;
  });
  document.querySelectorAll(".sp-workflow").forEach((panel) => {
    panel.classList.toggle("hidden", panel.id !== `sp-workflow-${name}`);
  });
}

function specialistVisible() {
  const pane = byId("tab-specialists");
  return Boolean(pane && !pane.classList.contains("hidden") && !document.hidden);
}

/** Exposes the timestamp without leaking mutable module state. */
export function specialistLastFetch() {
  return lastFetchAt;
}

export function renderSpecialists() {
  if (!byId("sp-mining-state")) return;
  renderMiningSpecialist(miningWorkflow(), miningHistory());
  renderCombatSpecialist(combatWorkflow(), combatHistory());
  renderCarrierSpecialist(carrierWorkflow());
  renderExobiologySpecialist(exobiologyWorkflow());
}

/**
 * @param {boolean} [silent]
 * @returns {Promise<SpecialistState|null>}
 */
export async function loadSpecialists(silent = false) {
  if (specialistLoading) return specialistLoading;
  const identity = appStore.identity();
  if (!identity.commanderId) return null;

  const epoch = resetEpoch;
  const expectedCommander = identity.commanderId;
  const status = byId("sp-global-status");
  if (!silent && status) status.textContent = "Loading local specialist records…";

  const loading = specialistsApi
    .getSnapshot()
    .then((response) => {
      if (
        epoch !== resetEpoch ||
        !appStore.isCurrent(identity) ||
        (response.commander_id && response.commander_id !== expectedCommander)
      ) {
        return null;
      }
      specialistState = normaliseSpecialistSnapshot(response);
      lastFetchAt = Date.now();
      renderSpecialists();
      if (status) {
        status.textContent = "Journal and explicit-input records are stored locally per commander.";
        status.classList.remove("error");
      }
      return specialistState;
    })
    .catch((error) => {
      if (epoch !== resetEpoch || !appStore.isCurrent(identity)) return null;
      if (status) {
        status.textContent = `Specialist records unavailable: ${specialistError(error)}`;
        status.classList.add("error");
      }
      return null;
    });

  specialistLoading = loading;
  void loading.finally(() => {
    if (specialistLoading === loading) specialistLoading = null;
  });
  return loading;
}

/** @param {SpecialistMutationRequest} request */
async function runSpecialistMutation(request) {
  const { perform, button, successMessage } = request;
  const identity = appStore.identity();
  const epoch = resetEpoch;
  const original = button?.textContent ?? "";
  if (button) {
    button.disabled = true;
    button.textContent = "WORKING…";
  }
  try {
    await perform();
    if (epoch !== resetEpoch || !appStore.isCurrent(identity)) return false;
    await loadSpecialists(true);
    if (epoch !== resetEpoch || !appStore.isCurrent(identity)) return false;
    const status = byId("sp-global-status");
    if (status) {
      status.textContent = successMessage;
      status.classList.remove("error");
    }
    return true;
  } catch (error) {
    if (epoch === resetEpoch && appStore.isCurrent(identity)) {
      const status = byId("sp-global-status");
      if (status) {
        status.textContent = specialistError(error);
        status.classList.add("error");
      }
    }
    return false;
  } finally {
    if (button?.isConnected) {
      button.textContent = original;
      button.disabled = false;
    }
    if (specialistState && epoch === resetEpoch && appStore.isCurrent(identity)) {
      renderSpecialists();
    }
  }
}

/**
 * Clear all profile-owned browser state and form seeding.
 *
 * @param {unknown} [nextSnapshot]
 */
export function resetSpecialists(nextSnapshot = appStore.getSnapshot()) {
  resetEpoch += 1;
  specialistState = null;
  specialistLoading = null;
  lastFetchAt = 0;

  if (byId("sp-carrier-config-form")) resetCarrierSpecialist();
  const status = byId("sp-global-status");
  if (status) {
    status.textContent = commanderIdOf(nextSnapshot)
      ? "Loading local specialist records for this commander..."
      : "Waiting for a commander profile...";
    status.classList.remove("error");
  }
  renderSpecialists();
}

function initWorkflowSwitcher() {
  const switchButtons = [...document.querySelectorAll(".sp-switcher [data-specialist]")].filter(
    (element) => element instanceof HTMLElement,
  );
  switchButtons.forEach((button, index) => {
    button.addEventListener("click", () => {
      setSpecialistWorkflow(button.dataset.specialist);
    });
    button.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      const offset = event.key === "ArrowRight" ? 1 : switchButtons.length - 1;
      const next = (index + offset) % switchButtons.length;
      const nextButton = switchButtons[next];
      if (!nextButton) return;
      setSpecialistWorkflow(nextButton.dataset.specialist);
      nextButton.focus();
    });
  });
  setSpecialistWorkflow(localStorage.getItem("specialistWorkflow") || "mining");
}

export function initSpecialists() {
  if (initialized) return;
  initialized = true;

  initWorkflowSwitcher();
  initMiningSpecialist(runSpecialistMutation);
  initCombatSpecialist(runSpecialistMutation);
  initCarrierSpecialist(runSpecialistMutation);
  initExobiologySpecialist(runSpecialistMutation, exobiologyWorkflow);

  unsubscribeProfile = appStore.onProfileChange((change) => {
    resetSpecialists(change.snapshot);
    if (change.current.commanderId) void loadSpecialists(true);
  });
  refreshTimer = window.setInterval(() => {
    if (!specialistVisible()) return;
    if (specialistState) {
      renderMiningSpecialist(miningWorkflow(), miningHistory());
      renderCombatSpecialist(combatWorkflow(), combatHistory());
    }
    if (!specialistLoading && Date.now() - lastFetchAt >= 4000) {
      void loadSpecialists(true);
    }
  }, 1000);

  resetSpecialists(appStore.getSnapshot());
  if (appStore.identity().commanderId) void loadSpecialists(true);
}

// Retain references for future teardown support without exposing mutable state.
void refreshTimer;
void unsubscribeProfile;
