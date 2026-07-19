import { clear, html, render } from "../../core/html.js";
import { initBoardForms } from "./board-forms.js";
import { initBoardExchange } from "./exchange.js";
import {
  button,
  confirmOpsAction,
  currentCommanderName,
  element,
  getOpsApi,
  input,
  isStaleOpsError,
  listen,
  opsEpochLabel,
  opsState,
  renderOpsError,
  select,
  setActiveBoardId,
} from "./shared.js";

/**
 * @import {
 *   OperationRecord,
 *   OperationRecordChanges,
 *   OperationRecordKind,
 * } from "../../api/contracts/operations.js"
 */

/** @param {string|undefined} value @returns {value is OperationRecordKind} */
function isOperationRecordKind(value) {
  return (
    value === "boards" ||
    value === "objectives" ||
    value === "assignments" ||
    value === "reservations" ||
    value === "contributions"
  );
}

/**
 * @param {string[]} values
 * @param {string|null|undefined} current
 */
function statusOptions(values, current) {
  return values.map(
    (value) =>
      html`<option value="${value}" ${value === current ? "selected" : ""}>
        ${value.toUpperCase()}
      </option>`,
  );
}

export function renderOpsBoardSelector() {
  const boardSelect = select("ops-board-select");
  boardSelect.replaceChildren();
  if (!opsState.boards.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "NO BOARDS";
    boardSelect.appendChild(option);
    boardSelect.disabled = true;
    return;
  }
  boardSelect.disabled = false;
  for (const board of opsState.boards) {
    const option = document.createElement("option");
    option.value = board.id;
    option.textContent = `${board.title} · ${String(board.status || "active").toUpperCase()}`;
    option.selected = board.id === opsState.activeBoardId;
    boardSelect.appendChild(option);
  }
}

/**
 * @param {string|null|undefined} objectiveId
 * @returns {string}
 */
function objectiveTitle(objectiveId) {
  if (!objectiveId) return "Whole board";
  const objectives = opsState.snapshot?.objectives || [];
  return objectives.find((item) => item.id === objectiveId)?.title || "Unknown objective";
}

function fillBoardObjectiveSelects() {
  const objectives = opsState.snapshot?.objectives || [];
  for (const id of [
    "ops-assignment-objective",
    "ops-reservation-objective",
    "ops-contribution-objective",
  ]) {
    const target = select(id);
    const previous = target.value;
    target.replaceChildren();
    const wholeBoard = document.createElement("option");
    wholeBoard.value = "";
    wholeBoard.textContent = "Whole board";
    target.appendChild(wholeBoard);
    for (const objective of objectives) {
      const option = document.createElement("option");
      option.value = objective.id;
      option.textContent = objective.title || "Untitled objective";
      target.appendChild(option);
    }
    if ([...target.options].some((option) => option.value === previous)) {
      target.value = previous;
    }
  }
}

/**
 * @param {OperationRecord} record
 * @param {"objectives"|"assignments"|"reservations"|"contributions"} kind
 */
function boardRecordTemplate(record, kind) {
  let title = record.title || "Untitled record";
  /** @type {string[]} */
  const facts = [];
  /** @type {string[]|null} */
  let statuses = null;
  if (kind === "objectives") {
    statuses = ["open", "active", "blocked", "done"];
    if (record.description) facts.push(record.description);
    if (record.system) {
      facts.push(record.system + (record.station ? ` · ${record.station}` : ""));
    }
    if (record.deadline) facts.push(`due ${opsEpochLabel(record.deadline)}`);
    facts.push(`priority ${record.priority ?? 50}`);
  } else if (kind === "assignments") {
    title = record.assignee || "Unassigned";
    statuses = ["assigned", "active", "done", "released"];
    facts.push(objectiveTitle(record.objective_id));
    if (record.role) facts.push(record.role);
  } else if (kind === "reservations") {
    title = record.resource_key || "Reserved resource";
    statuses = ["reserved", "fulfilled", "released"];
    facts.push(
      `${Number(record.amount || 0).toLocaleString()}${record.unit ? ` ${record.unit}` : ""}`,
    );
    facts.push(record.resource_type || "resource");
    facts.push(objectiveTitle(record.objective_id));
    if (record.assignee) facts.push(`by ${record.assignee}`);
  } else {
    title = `${record.contributor || "Commander"} · ${record.kind || "contribution"}`;
    facts.push(
      `${Number(record.amount || 0).toLocaleString()}${record.unit ? ` ${record.unit}` : ""}`,
    );
    facts.push(objectiveTitle(record.objective_id));
    if (record.note) facts.push(record.note);
  }
  facts.push(`rev ${record.revision || 1}`);
  const statusClass = String(record.status || "")
    .toLowerCase()
    .replace(/[^a-z-]/g, "");
  const statusSelector = statuses
    ? html`<select
        data-op-status
        data-kind="${kind}"
        data-id="${record.id}"
        aria-label="${kind} status"
      >
        ${statusOptions(statuses, record.status)}
      </select>`
    : false;
  return html`<article class="ops-record ${statusClass}">
    <div>
      <div class="ops-record-title">${title}</div>
      <div class="ops-record-meta">
        ${facts.filter(Boolean).map((fact) => html`<span>${fact}</span>`)}
      </div>
    </div>
    <div class="ops-record-controls">
      ${statusSelector}
      <button
        class="hb hb-utility hb-danger"
        type="button"
        data-op-delete
        data-kind="${kind}"
        data-id="${record.id}"
      >
        REMOVE
      </button>
    </div>
  </article>`;
}

function renderOpsConflicts() {
  const conflicts = opsState.conflicts || [];
  const box = element("ops-conflicts");
  box.classList.toggle("hidden", !conflicts.length);
  if (!conflicts.length) {
    clear(box);
    return;
  }
  render(
    box,
    html`<b>▲ ${conflicts.length} merge conflict${conflicts.length === 1 ? "" : "s"} recorded</b>
      <div class="dim">
        The deterministic winner is already active. The losing version remains in local conflict
        history for review.
      </div>
      ${conflicts.slice(0, 20).map((conflict) => {
        const table = String(conflict.table_name || "record").replace("operation_", "");
        return html`<div class="ops-conflict-row">
          ${table} · ${conflict.record_id || "unknown"} ·
          ${opsEpochLabel(conflict.detected_at) || conflict.detected_at || "time unknown"} · local
          ${String(conflict.local_version || "?").slice(0, 28)} / incoming
          ${String(conflict.incoming_version || "?").slice(0, 28)}
        </div>`;
      })}`,
  );
}

export function renderOperationsBoard() {
  renderOpsBoardSelector();
  const snapshot = opsState.snapshot;
  const board = snapshot?.board;
  element("ops-board-empty").textContent =
    "Create a board here or import one shared by another commander.";
  element("ops-board-empty").classList.toggle("hidden", Boolean(board));
  element("ops-board-workspace").classList.toggle("hidden", !board);
  button("ops-board-export").disabled = !board;
  if (!board) return;

  element("ops-board-name").textContent = board.title || "Untitled board";
  element("ops-board-briefing").textContent = board.description || "No briefing supplied.";
  element("ops-board-meta").textContent =
    `REVISION ${board.revision || 1} · updated ` +
    `${opsEpochLabel(board.updated_at) || board.updated_at || "unknown"} · ` +
    `node ${String(board.updated_by || "local").slice(0, 24)}`;
  const boardStatus = select("ops-board-status");
  const currentStatus = board.status || "active";
  if (![...boardStatus.options].some((option) => option.value === currentStatus)) {
    const option = document.createElement("option");
    option.value = currentStatus;
    option.textContent = currentStatus.toUpperCase();
    boardStatus.appendChild(option);
  }
  boardStatus.value = currentStatus;
  fillBoardObjectiveSelects();

  /** @type {Array<[string, "objectives"|"assignments"|"reservations"|"contributions", string]>} */
  const groups = [
    ["ops-board-objectives", "objectives", "No board objectives yet."],
    ["ops-assignments", "assignments", "No assignments yet."],
    ["ops-reservations", "reservations", "No resource reservations yet."],
    ["ops-contributions", "contributions", "No contributions logged yet."],
  ];
  for (const [id, kind, emptyMessage] of groups) {
    const records = snapshot[kind];
    render(
      element(id),
      records.length
        ? html`${records.map((record) => boardRecordTemplate(record, kind))}`
        : html`<div class="empty dim">${emptyMessage}</div>`,
    );
  }
  renderOpsConflicts();
}

export async function loadOperations() {
  try {
    const listData = await getOpsApi().listBoards();
    opsState.boards = listData.boards;
    if (!opsState.boards.some((board) => board.id === opsState.activeBoardId)) {
      setActiveBoardId(opsState.boards[0]?.id || "");
    }
    let detailData = null;
    if (opsState.activeBoardId) {
      detailData = await getOpsApi().getBoard(opsState.activeBoardId);
    }
    opsState.snapshot = detailData;
    opsState.conflicts = detailData?.conflicts || listData.conflicts || [];
    renderOperationsBoard();
  } catch (error) {
    if (isStaleOpsError(error)) return;
    element("ops-board-empty").classList.remove("hidden");
    renderOpsError("ops-board-empty", error);
    element("ops-board-workspace").classList.add("hidden");
  }
}

/** @param {unknown} error */
function reportBoardError(error) {
  if (!isStaleOpsError(error)) renderOpsError("ops-import-report", error);
}

/**
 * @param {OperationRecordKind} kind
 * @param {string} recordId
 * @param {OperationRecordChanges} changes
 */
export async function patchOperation(kind, recordId, changes) {
  try {
    await getOpsApi().updateRecord(kind, recordId, changes);
    await loadOperations();
  } catch (error) {
    if (isStaleOpsError(error)) return;
    reportBoardError(error);
    await loadOperations();
  }
}

/**
 * @param {OperationRecordKind} kind
 * @param {string} recordId
 */
export async function deleteOperation(kind, recordId) {
  const noun = kind === "boards" ? "operations board and its visible workspace" : kind.slice(0, -1);
  if (
    !confirmOpsAction(
      `Remove this ${noun}? The tombstone is retained for deterministic board merging.`,
    )
  ) {
    return;
  }
  try {
    await getOpsApi().removeRecord(kind, recordId);
    if (kind === "boards") setActiveBoardId("");
    await loadOperations();
  } catch (error) {
    reportBoardError(error);
  }
}

/** @returns {() => void} */
export function initBoards() {
  if (!input("ops-assignment-name").value) {
    input("ops-assignment-name").value = currentCommanderName();
  }
  if (!input("ops-contribution-name").value) {
    input("ops-contribution-name").value = currentCommanderName();
  }
  const disposers = [
    initBoardForms(loadOperations),
    initBoardExchange(loadOperations),
    listen(select("ops-board-select"), "change", (event) => {
      const target = event.currentTarget;
      if (!(target instanceof HTMLSelectElement)) return;
      setActiveBoardId(target.value);
      void loadOperations();
    }),
    listen(button("ops-board-refresh"), "click", () => void loadOperations()),
    listen(select("ops-board-status"), "change", (event) => {
      const target = event.currentTarget;
      const boardId = opsState.snapshot?.board?.id;
      if (target instanceof HTMLSelectElement && boardId) {
        void patchOperation("boards", boardId, { status: target.value });
      }
    }),
    listen(button("ops-board-delete"), "click", () => {
      const boardId = opsState.snapshot?.board?.id;
      if (boardId) void deleteOperation("boards", boardId);
    }),
    listen(element("ops-board-workspace"), "change", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const status = target.closest("[data-op-status]");
      if (!(status instanceof HTMLSelectElement)) return;
      const { kind, id } = status.dataset;
      if (isOperationRecordKind(kind) && id) {
        void patchOperation(kind, id, { status: status.value });
      }
    }),
    listen(element("ops-board-workspace"), "click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const remove = target.closest("[data-op-delete]");
      if (!(remove instanceof HTMLElement)) return;
      const { kind, id } = remove.dataset;
      if (isOperationRecordKind(kind) && id) void deleteOperation(kind, id);
    }),
  ];
  return () => disposers.forEach((dispose) => dispose());
}
