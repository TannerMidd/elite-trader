import { html, render } from "../../core/html.js";
import {
  button,
  element,
  getOpsApi,
  getOpsDocument,
  input,
  isStaleOpsError,
  listen,
  opsState,
  renderOpsError,
  setActiveBoardId,
} from "./shared.js";

/** @import {JsonObject, JsonValue} from "../../api/contracts/common.js" */
/**
 * @typedef {JsonObject & {
 *   boards?: JsonObject[],
 *   objectives?: JsonObject[],
 *   assignments?: JsonObject[],
 *   reservations?: JsonObject[],
 *   contributions?: JsonObject[],
 * }} OperationsDocumentRecords
 * @typedef {JsonObject & {
 *   format: "frameshift.operations",
 *   version: 1,
 *   exported_at?: string,
 *   node_id?: string,
 *   records?: OperationsDocumentRecords,
 * }} OperationsDocument
 */
/** @typedef {() => Promise<void>} ReloadOperations */

/** @param {unknown} error */
function reportBoardError(error) {
  if (!isStaleOpsError(error)) renderOpsError("ops-import-report", error);
}

async function exportOperationsBoard() {
  if (!opsState.activeBoardId) return;
  const exportButton = button("ops-board-export");
  exportButton.disabled = true;
  try {
    const artifact = await getOpsApi().exportBoards(opsState.activeBoardId);
    const boardName = opsState.snapshot?.board?.title || "operation";
    const fallback = `frameshift-${boardName.replace(/[^A-Za-z0-9_-]+/g, "-")}.json`;
    const filename = artifact.filename || fallback;
    const href = URL.createObjectURL(artifact.blob);
    const documentRoot = getOpsDocument();
    const anchor = documentRoot.createElement("a");
    anchor.href = href;
    anchor.download = filename;
    documentRoot.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  } catch (error) {
    reportBoardError(error);
  } finally {
    exportButton.disabled = false;
  }
}

/**
 * @param {unknown} value
 * @returns {value is JsonValue}
 */
function isJsonValue(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  return (
    typeof value === "object" &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null) &&
    Object.values(value).every((candidate) => isJsonValue(candidate))
  );
}

/**
 * @param {unknown} value
 * @returns {value is JsonObject}
 */
function isJsonObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && isJsonValue(value);
}

/**
 * @param {unknown} value
 * @returns {value is OperationsDocumentRecords}
 */
function isOperationsDocumentRecords(value) {
  if (!isJsonObject(value)) return false;
  for (const kind of ["boards", "objectives", "assignments", "reservations", "contributions"]) {
    const records = value[kind];
    if (
      records !== undefined &&
      (!Array.isArray(records) || !records.every((record) => isJsonObject(record)))
    ) {
      return false;
    }
  }
  return true;
}

/**
 * @param {unknown} value
 * @returns {value is OperationsDocument}
 */
function isOperationsDocument(value) {
  return (
    isJsonObject(value) &&
    value.format === "frameshift.operations" &&
    value.version === 1 &&
    (value.records === undefined || isOperationsDocumentRecords(value.records))
  );
}

/**
 * @param {OperationsDocument} documentValue
 * @returns {string}
 */
function firstImportedBoardId(documentValue) {
  const firstBoard = documentValue.records?.boards?.[0];
  return typeof firstBoard?.id === "string" ? firstBoard.id : "";
}

/**
 * @param {unknown} value
 * @returns {OperationsDocument}
 */
export function validateOperationsDocument(value) {
  if (!isOperationsDocument(value)) {
    throw new Error("This is not a supported Frameshift operations export.");
  }
  return value;
}

/**
 * @param {Event} event
 * @param {ReloadOperations} reload
 */
async function importOperationsBoard(event, reload) {
  const target = event.currentTarget;
  if (!(target instanceof HTMLInputElement)) return;
  const file = target.files?.[0];
  if (!file) return;
  try {
    if (file.size > 20 * 1024 * 1024) {
      throw new Error("Operations imports are limited to 20 MB.");
    }
    const documentValue = validateOperationsDocument(JSON.parse(await file.text()));
    const report = await getOpsApi().importBoards(documentValue);
    const firstBoard = firstImportedBoardId(documentValue);
    if (firstBoard) setActiveBoardId(firstBoard);
    render(
      element("ops-import-report"),
      html`<span class="good"
        >Import complete: ${Number(report.inserted || 0)} inserted, ${Number(report.updated || 0)}
        updated, ${Number(report.kept_local || 0)} kept local, ${Number(report.conflicts || 0)}
        conflicts.</span
      >`,
    );
    await reload();
  } catch (error) {
    reportBoardError(error);
  } finally {
    target.value = "";
  }
}

/**
 * @param {ReloadOperations} reload
 * @returns {() => void}
 */
export function initBoardExchange(reload) {
  const disposers = [
    listen(button("ops-board-export"), "click", () => void exportOperationsBoard()),
    listen(button("ops-board-import-trigger"), "click", () => input("ops-board-import").click()),
    listen(input("ops-board-import"), "change", (event) => {
      void importOperationsBoard(event, reload);
    }),
  ];
  return () => disposers.forEach((dispose) => dispose());
}
