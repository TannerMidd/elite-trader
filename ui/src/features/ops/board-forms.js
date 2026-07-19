import {
  element,
  form,
  getOpsApi,
  input,
  isStaleOpsError,
  listen,
  opsState,
  renderOpsError,
  select,
  setActiveBoardId,
} from "./shared.js";

/**
 * @import {
 *   OperationAction,
 *   OperationBoard,
 *   OperationRecord,
 *   OperationRecordKind,
 *   OperationRequest,
 * } from "../../api/contracts/operations.js"
 */
/** @typedef {() => Promise<void>} ReloadOperations */

/**
 * @param {OperationRecordKind} kind
 * @param {OperationRequest} payload
 * @returns {Promise<OperationBoard|OperationRecord>}
 */
async function postOperation(kind, payload) {
  /** @type {Record<OperationRecordKind, OperationAction>} */
  const actions = {
    boards: "create_board",
    objectives: "add_objective",
    assignments: "assign",
    reservations: "reserve",
    contributions: "contribute",
  };
  const data = await getOpsApi().createRecord({ action: actions[kind], ...payload });
  return data.record;
}

/** @param {unknown} error */
function reportBoardError(error) {
  if (!isStaleOpsError(error)) renderOpsError("ops-import-report", error);
}

/**
 * @param {Event} event
 * @param {ReloadOperations} reload
 */
async function createOperationsBoard(event, reload) {
  event.preventDefault();
  try {
    const board = await postOperation("boards", {
      title: input("ops-board-title").value.trim(),
      description: input("ops-board-description").value.trim(),
    });
    form("ops-board-form").reset();
    const details = element("ops-new-board-wrap");
    if (details instanceof HTMLDetailsElement) details.open = false;
    setActiveBoardId(board.id || "");
    await reload();
  } catch (error) {
    reportBoardError(error);
  }
}

/**
 * @param {Event} event
 * @param {ReloadOperations} reload
 */
async function addOperationsObjective(event, reload) {
  event.preventDefault();
  try {
    const deadline = input("ops-board-objective-deadline").value;
    await postOperation("objectives", {
      board_id: opsState.activeBoardId,
      title: input("ops-board-objective-title").value.trim(),
      description: input("ops-board-objective-description").value.trim(),
      system: input("ops-board-objective-system").value.trim() || null,
      station: input("ops-board-objective-station").value.trim() || null,
      deadline: deadline ? Math.floor(new Date(deadline).getTime() / 1000) : null,
      priority: Number(input("ops-board-objective-priority").value),
    });
    form("ops-board-objective-form").reset();
    input("ops-board-objective-priority").value = "50";
    await reload();
  } catch (error) {
    reportBoardError(error);
  }
}

/**
 * @param {Event} event
 * @param {ReloadOperations} reload
 */
async function addOperationsAssignment(event, reload) {
  event.preventDefault();
  try {
    await postOperation("assignments", {
      board_id: opsState.activeBoardId,
      objective_id: select("ops-assignment-objective").value || null,
      assignee: input("ops-assignment-name").value.trim(),
      role: input("ops-assignment-role").value.trim(),
    });
    form("ops-assignment-form").reset();
    await reload();
  } catch (error) {
    reportBoardError(error);
  }
}

/**
 * @param {Event} event
 * @param {ReloadOperations} reload
 */
async function addOperationsReservation(event, reload) {
  event.preventDefault();
  try {
    await postOperation("reservations", {
      board_id: opsState.activeBoardId,
      objective_id: select("ops-reservation-objective").value || null,
      resource_type: select("ops-reservation-type").value,
      resource_key: input("ops-reservation-key").value.trim(),
      amount: Number(input("ops-reservation-amount").value),
      unit: input("ops-reservation-unit").value.trim(),
      assignee: input("ops-reservation-assignee").value.trim() || null,
    });
    form("ops-reservation-form").reset();
    await reload();
  } catch (error) {
    reportBoardError(error);
  }
}

/**
 * @param {Event} event
 * @param {ReloadOperations} reload
 */
async function addOperationsContribution(event, reload) {
  event.preventDefault();
  try {
    await postOperation("contributions", {
      board_id: opsState.activeBoardId,
      objective_id: select("ops-contribution-objective").value || null,
      contributor: input("ops-contribution-name").value.trim(),
      kind: input("ops-contribution-kind").value.trim(),
      amount: Number(input("ops-contribution-amount").value),
      unit: input("ops-contribution-unit").value.trim(),
      note: input("ops-contribution-note").value.trim(),
    });
    const commander = input("ops-contribution-name").value;
    form("ops-contribution-form").reset();
    input("ops-contribution-name").value = commander;
    await reload();
  } catch (error) {
    reportBoardError(error);
  }
}

/**
 * @param {ReloadOperations} reload
 * @returns {() => void}
 */
export function initBoardForms(reload) {
  const disposers = [
    listen(form("ops-board-form"), "submit", (event) => {
      void createOperationsBoard(event, reload);
    }),
    listen(form("ops-board-objective-form"), "submit", (event) => {
      void addOperationsObjective(event, reload);
    }),
    listen(form("ops-assignment-form"), "submit", (event) => {
      void addOperationsAssignment(event, reload);
    }),
    listen(form("ops-reservation-form"), "submit", (event) => {
      void addOperationsReservation(event, reload);
    }),
    listen(form("ops-contribution-form"), "submit", (event) => {
      void addOperationsContribution(event, reload);
    }),
  ];
  return () => disposers.forEach((dispose) => dispose());
}
