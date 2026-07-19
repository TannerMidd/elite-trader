import { http } from "../core/http.js";
import { withQuery } from "./query.js";

/** @import {UpdateApplyResponse, UpdateCheckResponse, UpdateProgressResponse} from "./contracts/update.js" */

/** @param {typeof http} [client] */
export function createUpdateApi(client = http) {
  /** @param {boolean} [force] @returns {Promise<UpdateCheckResponse>} */
  function checkForUpdate(force = false) {
    return client.json(withQuery("/api/update/check", { force: force ? 1 : undefined }));
  }

  /** @returns {Promise<UpdateApplyResponse>} */
  function applyUpdate() {
    return client.json("/api/update/apply", { method: "POST" });
  }

  /** @returns {Promise<UpdateProgressResponse>} */
  function getUpdateStatus() {
    return client.json("/api/update/status");
  }

  return Object.freeze({ checkForUpdate, applyUpdate, getUpdateStatus });
}

export const updateApi = createUpdateApi();
