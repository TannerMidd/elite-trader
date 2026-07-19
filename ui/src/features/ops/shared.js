import {
  createOperationsApi,
  isStaleOperationsError,
  operationsApi,
} from "../../api/operations.js";
import { requireById } from "../../core/dom.js";
import { html, render } from "../../core/html.js";
import { appStore, commanderIdOf } from "../../core/store.js";

/**
 * @import {
 *   Objective,
 *   ObjectivePlanResponse,
 *   OperationBoard,
 *   OperationConflict,
 *   OperationsBoardResponse,
 *   TimingsResponse,
 * } from "../../api/contracts/operations.js"
 */
/** @typedef {ReturnType<typeof createOperationsApi>} OperationsApi */
/** @typedef {Parameters<typeof createOperationsApi>[0]} OperationsHttpClient */
/**
 * @typedef {Pick<typeof appStore, "getSnapshot"|"identity"|"isCurrent"|"onProfileChange">} OpsStore
 * @typedef {{
 *   api?: OperationsApi,
 *   client?: OperationsHttpClient,
 *   store?: OpsStore,
 *   storage?: Storage,
 *   root?: Document,
 *   confirm?: (message: string) => boolean,
 *   plotSystem?: (system: string) => unknown,
 * }} OpsRuntimeOptions
 */

/** @type {{
 *   api: OperationsApi,
 *   store: OpsStore,
 *   storage: Storage|null,
 *   root: Document|null,
 *   confirm: ((message: string) => boolean)|null,
 *   plotSystem: ((system: string) => unknown)|null,
 * }} */
const runtime = {
  api: operationsApi,
  store: appStore,
  storage: null,
  root: null,
  confirm: null,
  plotSystem: null,
};

/** Shared mutable feature state; reset in place so module references stay valid. */
/** @type {{
 *   objectives: Objective[],
 *   plan: ObjectivePlanResponse|null,
 *   timings: TimingsResponse|null,
 *   boards: OperationBoard[],
 *   snapshot: OperationsBoardResponse|null,
 *   conflicts: OperationConflict[],
 *   activeBoardId: string,
 * }} */
export const opsState = {
  objectives: [],
  plan: null,
  timings: null,
  boards: [],
  snapshot: null,
  conflicts: [],
  activeBoardId: "",
};

/**
 * Override seams for a host shell or focused test.
 *
 * @param {OpsRuntimeOptions} [options]
 */
export function configureOpsRuntime(options = {}) {
  if (options.api) runtime.api = options.api;
  else if (options.client) runtime.api = createOperationsApi(options.client);
  if (options.store) runtime.store = options.store;
  if (options.storage) runtime.storage = options.storage;
  if (options.root) runtime.root = options.root;
  if (options.confirm) runtime.confirm = options.confirm;
  if (options.plotSystem) runtime.plotSystem = options.plotSystem;
}

/** @returns {OpsStore} */
export function getOpsStore() {
  return runtime.store;
}

/** @returns {OperationsApi} */
export function getOpsApi() {
  return runtime.api;
}

/** @returns {Document} */
export function getOpsDocument() {
  if (runtime.root) return runtime.root;
  if (typeof document === "undefined") {
    throw new Error("OPS requires a document before DOM behavior can initialize.");
  }
  return document;
}

/** @returns {Storage} */
export function getOpsStorage() {
  if (runtime.storage) return runtime.storage;
  if (typeof localStorage === "undefined") {
    throw new Error("OPS requires browser storage.");
  }
  return localStorage;
}

/**
 * @param {string} id
 * @returns {HTMLElement}
 */
export function element(id) {
  const node = requireById(id, getOpsDocument());
  if (!(node instanceof HTMLElement)) throw new TypeError(`#${id} must be an HTML element.`);
  return node;
}

/**
 * @param {string} id
 * @returns {HTMLElement|null}
 */
export function maybeElement(id) {
  const node = getOpsDocument().getElementById(id);
  return node instanceof HTMLElement ? node : null;
}

/**
 * @param {string} id
 * @returns {HTMLInputElement}
 */
export function input(id) {
  const node = element(id);
  if (!(node instanceof HTMLInputElement)) throw new TypeError(`#${id} must be an input.`);
  return node;
}

/**
 * @param {string} id
 * @returns {HTMLSelectElement}
 */
export function select(id) {
  const node = element(id);
  if (!(node instanceof HTMLSelectElement)) throw new TypeError(`#${id} must be a select.`);
  return node;
}

/**
 * @param {string} id
 * @returns {HTMLFormElement}
 */
export function form(id) {
  const node = element(id);
  if (!(node instanceof HTMLFormElement)) throw new TypeError(`#${id} must be a form.`);
  return node;
}

/**
 * @param {string} id
 * @returns {HTMLButtonElement}
 */
export function button(id) {
  const node = element(id);
  if (!(node instanceof HTMLButtonElement)) throw new TypeError(`#${id} must be a button.`);
  return node;
}

/**
 * @param {EventTarget} target
 * @param {string} type
 * @param {EventListenerOrEventListenerObject} listener
 * @returns {() => void}
 */
export function listen(target, type, listener) {
  target.addEventListener(type, listener);
  return () => target.removeEventListener(type, listener);
}

/**
 * @param {unknown} error
 * @returns {string}
 */
export function errorMessage(error) {
  return error instanceof Error && error.message
    ? error.message
    : String(error || "The local OPS request failed.");
}

/**
 * @param {unknown} error
 * @returns {boolean}
 */
export function isStaleOpsError(error) {
  return isStaleOperationsError(error);
}

/**
 * @param {string} id
 * @param {unknown} error
 */
export function renderOpsError(id, error) {
  render(element(id), html`<span class="warn">${errorMessage(error)}</span>`);
}

/**
 * @param {string|null|undefined} [commanderId]
 * @returns {string|null}
 */
export function opsBoardStorageKey(commanderId = runtime.store.identity().commanderId) {
  return commanderId ? `opsBoardId:v2:${encodeURIComponent(commanderId)}` : null;
}

/**
 * Migrate the old unscoped key exactly once to the first established profile.
 *
 * @param {string|null|undefined} commanderId
 * @param {Storage} [storage]
 * @returns {string}
 */
export function loadOpsBoardId(commanderId, storage) {
  const key = opsBoardStorageKey(commanderId);
  if (!key) return "";
  const targetStorage = storage || getOpsStorage();
  let value = targetStorage.getItem(key);
  if (value == null) {
    value = targetStorage.getItem("opsBoardId");
    if (value != null) {
      targetStorage.setItem(key, value);
      targetStorage.removeItem("opsBoardId");
    }
  }
  return value || "";
}

/**
 * @param {string} value
 * @param {Storage} [storage]
 */
export function saveOpsBoardId(value, storage) {
  const key = opsBoardStorageKey();
  if (!key) return;
  const targetStorage = storage || getOpsStorage();
  if (value) targetStorage.setItem(key, value);
  else targetStorage.removeItem(key);
}

/**
 * @param {string|null} commanderId
 */
export function resetOpsState(commanderId) {
  opsState.objectives = [];
  opsState.plan = null;
  opsState.timings = null;
  opsState.boards = [];
  opsState.snapshot = null;
  opsState.conflicts = [];
  opsState.activeBoardId = loadOpsBoardId(commanderId);
}

/** @returns {typeof opsState} */
export function getOpsState() {
  return opsState;
}

/**
 * @param {string} boardId
 */
export function setActiveBoardId(boardId) {
  opsState.activeBoardId = boardId;
  saveOpsBoardId(boardId);
}

/**
 * @param {unknown} snapshot
 * @returns {string|null}
 */
export function commanderIdFromSnapshot(snapshot) {
  return commanderIdOf(snapshot);
}

/** @returns {string} */
export function currentCommanderName() {
  const snapshot = runtime.store.getSnapshot();
  if (!snapshot || typeof snapshot !== "object") return "";
  return String(Reflect.get(snapshot, "commander") || "");
}

/**
 * Legacy OPS duration format: seconds are shown only below one minute.
 *
 * @param {unknown} seconds
 * @returns {string}
 */
export function formatOpsDuration(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value < 0) return "—";
  const days = Math.floor(value / 86400);
  const hours = Math.floor((value % 86400) / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${minutes}m`;
  if (minutes) return `${minutes}m`;
  return `${Math.floor(value)}s`;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function opsEpochLabel(value) {
  if (value == null || value === "") return "";
  const numeric = Number(value);
  const date = Number.isFinite(numeric)
    ? new Date(numeric > 10_000_000_000 ? numeric : numeric * 1000)
    : new Date(String(value));
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function opsDateInput(value) {
  if (!value) return "";
  const date = new Date(Number(value) * 1000);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function opsActivityName(value) {
  return String(value || "other")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

/**
 * @param {string} message
 * @returns {boolean}
 */
export function confirmOpsAction(message) {
  if (runtime.confirm) return runtime.confirm(message);
  return globalThis.confirm(message);
}

/**
 * @param {string} system
 */
export function plotOpsSystem(system) {
  if (!runtime.plotSystem) {
    throw new Error("OPS plot actions require initOps({ plotSystem }).");
  }
  runtime.plotSystem(system);
}
