import { clear } from "../../core/html.js";
import { initBoards, loadOperations } from "./boards.js";
import { initObjectives, loadOpsObjectives, resetOpsObjectiveForm } from "./objectives.js";
import { initPlanner, loadOpsTimings } from "./planner.js";
import {
  commanderIdFromSnapshot,
  configureOpsRuntime,
  getOpsState,
  getOpsStore,
  maybeElement,
  resetOpsState,
} from "./shared.js";

/** @import {OpsRuntimeOptions} from "./shared.js" */

/** @type {Promise<void>|null} */
let workspaceLoading = null;
/** @type {(() => void)|null} */
let disposeOps = null;

/**
 * Clear commander-owned OPS state and restore the initial waiting/loading shell.
 *
 * @param {unknown} [snapshot]
 */
export function resetOps(snapshot = getOpsStore().getSnapshot()) {
  const commanderId = commanderIdFromSnapshot(snapshot);
  const commanderName =
    snapshot && typeof snapshot === "object"
      ? String(Reflect.get(snapshot, "commander") || "")
      : "";
  workspaceLoading = null;
  resetOpsState(commanderId);

  if (typeof document === "undefined" || typeof HTMLElement === "undefined") return;
  if (maybeElement("ops-objective-form")) resetOpsObjectiveForm();
  for (const id of [
    "ops-board-form",
    "ops-board-objective-form",
    "ops-assignment-form",
    "ops-reservation-form",
    "ops-contribution-form",
  ]) {
    const target = maybeElement(id);
    if (target instanceof HTMLFormElement) target.reset();
  }

  const assignmentName = maybeElement("ops-assignment-name");
  if (assignmentName instanceof HTMLInputElement) assignmentName.value = commanderName;
  const contributionName = maybeElement("ops-contribution-name");
  if (contributionName instanceof HTMLInputElement) {
    contributionName.value = commanderName;
  }

  for (const id of [
    "ops-plan-selected",
    "ops-plan-alternatives",
    "ops-objective-list",
    "ops-board-objectives",
    "ops-assignments",
    "ops-reservations",
    "ops-contributions",
    "ops-timing-list",
    "ops-plan-warnings",
    "ops-conflicts",
  ]) {
    const target = maybeElement(id);
    if (target) clear(target);
  }

  maybeElement("ops-board-workspace")?.classList.add("hidden");
  const empty = maybeElement("ops-board-empty");
  if (empty) {
    empty.classList.remove("hidden");
    empty.textContent = commanderId
      ? "Loading this commander's local operations workspace..."
      : "Waiting for a commander profile...";
  }
}

/**
 * Load all OPS regions once for the current commander.
 *
 * @returns {Promise<void>}
 */
export async function loadOpsWorkspace() {
  if (workspaceLoading) return workspaceLoading;
  const snapshot = getOpsStore().getSnapshot();
  if (!commanderIdFromSnapshot(snapshot)) {
    resetOps(snapshot);
    return;
  }

  const commanderName =
    snapshot && typeof snapshot === "object"
      ? String(Reflect.get(snapshot, "commander") || "")
      : "";
  const assignmentName = maybeElement("ops-assignment-name");
  if (assignmentName instanceof HTMLInputElement && !assignmentName.value) {
    assignmentName.value = commanderName;
  }
  const contributionName = maybeElement("ops-contribution-name");
  if (contributionName instanceof HTMLInputElement && !contributionName.value) {
    contributionName.value = commanderName;
  }

  const loading = Promise.all([loadOpsObjectives(), loadOpsTimings(), loadOperations()]).then(
    () => undefined,
  );
  workspaceLoading = loading;
  void loading.then(
    () => {
      if (workspaceLoading === loading) workspaceLoading = null;
    },
    () => {
      if (workspaceLoading === loading) workspaceLoading = null;
    },
  );
  return loading;
}

/**
 * Wire OPS behavior and commander handoff handling.
 *
 * @param {OpsRuntimeOptions & {load?: boolean}} [options]
 * @returns {() => void}
 */
export function initOps(options = {}) {
  disposeOps?.();
  configureOpsRuntime(options);

  const disposers = [initPlanner(), initObjectives(), initBoards()];
  resetOps();
  const unsubscribe = getOpsStore().onProfileChange((change) => {
    resetOps(change.snapshot);
    if (change.current.commanderId) void loadOpsWorkspace();
  });
  if (options.load !== false && getOpsStore().identity().commanderId) {
    void loadOpsWorkspace();
  }

  const dispose = () => {
    unsubscribe();
    disposers.forEach((teardown) => teardown());
    workspaceLoading = null;
    if (disposeOps === dispose) disposeOps = null;
  };
  disposeOps = dispose;
  return dispose;
}

export { getOpsState };
export { validateOperationsDocument } from "./exchange.js";
