import { appStore } from "../core/store.js";
import GalaxyData from "../data/galaxy-data.js";

/** @import {ApplicationState} from "../api/contracts/state.js" */

/** @typedef {NonNullable<ReturnType<typeof GalaxyData.observation>>} GalaxyObservation */
/** @typedef {Parameters<typeof GalaxyData.observation>[1]} GalaxySnapshotInput */

/**
 * @typedef {object} GalaxyHistoryView
 * @property {readonly GalaxyObservation[]} all
 * @property {readonly GalaxyObservation[]} entries
 * @property {GalaxyObservation|null} current
 * @property {GalaxyObservation|null} previous
 */

/** @type {GalaxyObservation[]} */
let observations = [];
/** @type {string|null} */
let loadedCommanderId = null;

/** @param {string} commanderId */
export function galaxyHistoryKey(commanderId) {
  return `galaxyHistory:v2:${encodeURIComponent(commanderId)}`;
}

/** @param {unknown} value @returns {value is GalaxyObservation} */
function isStoredObservation(value) {
  if (!value || typeof value !== "object") return false;
  return (
    typeof Reflect.get(value, "system") === "string" &&
    typeof Reflect.get(value, "observed_at") === "string"
  );
}

/** @param {string|null|undefined} commanderId @param {string|null} [legacyCommanderName] */
export function loadGalaxyHistory(commanderId, legacyCommanderName = null) {
  resetGalaxyHistoryWorkspace();
  loadedCommanderId = commanderId || null;
  if (!loadedCommanderId) return;

  try {
    const key = galaxyHistoryKey(loadedCommanderId);
    let raw = localStorage.getItem(key);
    if (raw == null && legacyCommanderName) {
      const legacyKey = `galaxyHistory:v1:${encodeURIComponent(legacyCommanderName)}`;
      raw = localStorage.getItem(legacyKey);
      if (raw != null) {
        localStorage.setItem(key, raw);
        localStorage.removeItem(legacyKey);
      }
    }
    const value = JSON.parse(raw || "[]");
    observations = Array.isArray(value) ? value.filter(isStoredObservation) : [];
  } catch {
    observations = [];
  }
}

export function saveGalaxyHistory() {
  if (!loadedCommanderId) return;
  try {
    localStorage.setItem(galaxyHistoryKey(loadedCommanderId), JSON.stringify(observations));
  } catch {
    // A full or disabled browser store must never break live rendering.
  }
}

/** @returns {readonly GalaxyObservation[]} */
export function getGalaxyHistory() {
  return observations;
}

/** @returns {string|null} */
export function getGalaxyHistoryCommander() {
  return loadedCommanderId;
}

/** Reset in-memory profile state without deleting any persisted observations. */
export function resetGalaxyHistoryWorkspace() {
  observations = [];
  loadedCommanderId = null;
}

export function clearLoadedGalaxyHistory() {
  observations = [];
  saveGalaxyHistory();
}

/**
 * Record the current system snapshot and return the observations relevant to it.
 *
 * @param {GalaxySnapshotInput} galaxy
 * @param {ApplicationState|null} [snapshot]
 * @returns {GalaxyHistoryView}
 */
export function updateGalaxyHistory(galaxy, snapshot = appStore.getSnapshot()) {
  const commanderId = snapshot?.commander_id || null;
  const system = snapshot?.system || null;
  if (!commanderId || !system) {
    return { all: [], entries: [], current: null, previous: null };
  }
  if (loadedCommanderId !== commanderId) {
    loadGalaxyHistory(commanderId, snapshot?.commander || null);
  }

  const entry = GalaxyData.observation(system, galaxy, new Date().toISOString());
  const previousLength = observations.length;
  const previousTail = observations[previousLength - 1];
  observations = GalaxyData.appendObservation(observations, entry, 300);
  const nextTail = observations[observations.length - 1];
  if (observations.length !== previousLength || previousTail !== nextTail) {
    saveGalaxyHistory();
  }

  const systemEntries = observations.filter((item) => item.system === system);
  const latest = systemEntries[systemEntries.length - 1] || null;
  const current = entry && latest?.signature === entry.signature ? latest : null;
  return {
    all: observations,
    entries: systemEntries,
    current,
    previous: current ? systemEntries[systemEntries.length - 2] || null : null,
  };
}
