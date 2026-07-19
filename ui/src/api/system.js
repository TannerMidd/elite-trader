import { http } from "../core/http.js";
import { withQuery } from "./query.js";

/** @import {ApplicationState, LaunchGameResponse, LoadoutExportResponse, SystemStationsResponse} from "./contracts/state.js" */

/** @param {typeof http} [client] */
export function createSystemApi(client = http) {
  /**
   * Pairing-required responses surface as HttpError(status=401); consumers can
   * branch on that status without reimplementing response parsing.
   *
   * @returns {Promise<ApplicationState>}
   */
  function getState() {
    return client.json("/api/state");
  }

  /** @param {string} [system] @returns {Promise<SystemStationsResponse>} */
  function getSystemStations(system) {
    return client.json(withQuery("/api/system-stations", { system }), {
      scope: "commander",
    });
  }

  /** @returns {Promise<LoadoutExportResponse>} */
  function getLoadoutExport() {
    return client.json("/api/loadout-export", { scope: "commander" });
  }

  /** @returns {Promise<LaunchGameResponse>} */
  function launchGame() {
    return client.json("/api/launch-game", { method: "POST" });
  }

  return Object.freeze({ getState, getSystemStations, getLoadoutExport, launchGame });
}

export const systemApi = createSystemApi();
