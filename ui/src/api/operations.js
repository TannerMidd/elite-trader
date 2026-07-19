import { StaleResponseError, http } from "../core/http.js";
import { pathSegment, withQuery } from "./query.js";

/** @import {DownloadArtifact, JsonValue} from "./contracts/common.js" */
/** @import {ObjectiveListOptions, ObjectiveListResponse, ObjectiveMutationResponse, ObjectivePlanRequest, ObjectivePlanResponse, ObjectiveRequest, OperationImportReport, OperationMutationResponse, OperationRecordChanges, OperationRecordKind, OperationRequest, OperationsBoardResponse, OperationsListResponse, TimingsResponse} from "./contracts/operations.js" */

const commanderScope = /** @type {const} */ ({ scope: "commander" });

/** @param {unknown} error */
export function isStaleOperationsError(error) {
  return error instanceof StaleResponseError;
}

/** @param {typeof http} [client] */
export function createOperationsApi(client = http) {
  /**
   * @param {ObjectiveListOptions} [options]
   * @returns {Promise<ObjectiveListResponse>}
   */
  function listObjectives(options = {}) {
    const query = options.all ? { all: 1 } : { statuses: options.statuses };
    return client.json(withQuery("/api/objectives", query), commanderScope);
  }

  /** @param {ObjectiveRequest} request @returns {Promise<ObjectiveMutationResponse>} */
  function createObjective(request) {
    return client.json("/api/objectives", {
      method: "POST",
      json: request,
      scope: "commander",
    });
  }

  /**
   * @param {string} objectiveId
   * @param {ObjectiveRequest} changes
   * @returns {Promise<ObjectiveMutationResponse>}
   */
  function updateObjective(objectiveId, changes) {
    return client.json(`/api/objectives/${pathSegment(objectiveId)}`, {
      method: "PATCH",
      json: changes,
      scope: "commander",
    });
  }

  /** @param {string} objectiveId @returns {Promise<ObjectiveMutationResponse>} */
  function dismissObjective(objectiveId) {
    return client.json(`/api/objectives/${pathSegment(objectiveId)}`, {
      method: "DELETE",
      scope: "commander",
    });
  }

  /** @param {ObjectivePlanRequest} request @returns {Promise<ObjectivePlanResponse>} */
  function planObjectives(request) {
    return client.json("/api/objectives/plan", {
      method: "POST",
      json: request,
      scope: "commander",
    });
  }

  /** @returns {Promise<TimingsResponse>} */
  function getTimings() {
    return client.json("/api/timings", commanderScope);
  }

  /** @returns {Promise<OperationsListResponse>} */
  function listBoards() {
    return client.json("/api/operations", commanderScope);
  }

  /** @param {string} boardId @returns {Promise<OperationsBoardResponse>} */
  function getBoard(boardId) {
    return client.json(withQuery("/api/operations", { board_id: boardId }), commanderScope);
  }

  /** @param {OperationRequest} request @returns {Promise<OperationMutationResponse>} */
  function createRecord(request) {
    return client.json("/api/operations", {
      method: "POST",
      json: request,
      scope: "commander",
    });
  }

  /**
   * @param {OperationRecordKind} kind
   * @param {string} recordId
   * @param {OperationRecordChanges} changes
   * @returns {Promise<OperationMutationResponse>}
   */
  function updateRecord(kind, recordId, changes) {
    return client.json(`/api/operations/${pathSegment(kind)}/${pathSegment(recordId)}`, {
      method: "PATCH",
      json: changes,
      scope: "commander",
    });
  }

  /**
   * @param {OperationRecordKind} kind
   * @param {string} recordId
   * @returns {Promise<OperationMutationResponse>}
   */
  function removeRecord(kind, recordId) {
    return client.json(`/api/operations/${pathSegment(kind)}/${pathSegment(recordId)}`, {
      method: "DELETE",
      scope: "commander",
    });
  }

  /**
   * @param {string} [boardId]
   * @returns {Promise<DownloadArtifact>}
   */
  function exportBoards(boardId) {
    return client.download(withQuery("/api/operations/export", { board_id: boardId }), {
      scope: "commander",
    });
  }

  /** @param {JsonValue} document @returns {Promise<OperationImportReport>} */
  function importBoards(document) {
    return client.json("/api/operations/import", {
      method: "POST",
      json: { document },
      scope: "commander",
    });
  }

  return Object.freeze({
    listObjectives,
    createObjective,
    updateObjective,
    dismissObjective,
    planObjectives,
    getTimings,
    listBoards,
    getBoard,
    createRecord,
    updateRecord,
    removeRecord,
    exportBoards,
    importBoards,
  });
}

export const operationsApi = createOperationsApi();
