import { http } from "../core/http.js";
import { withQuery } from "./query.js";

/** @import {EngineeringPinRequest, EngineeringPinResponse, EngineeringWorkshopResponse, MaterialTradersResponse} from "./contracts/engineering.js" */

/** @param {typeof http} [client] */
export function createEngineeringApi(client = http) {
  /** @returns {Promise<EngineeringWorkshopResponse>} */
  function getWorkshop() {
    return client.json("/api/engineering", { scope: "commander" });
  }

  /** @param {EngineeringPinRequest} request @returns {Promise<EngineeringPinResponse>} */
  function setPinnedBlueprint(request) {
    return client.json("/api/engineering/pin", {
      method: "POST",
      json: request,
      scope: "commander",
    });
  }

  /**
   * @param {string} kind
   * @param {string} [system]
   * @returns {Promise<MaterialTradersResponse>}
   */
  function findMaterialTraders(kind, system) {
    return client.json(withQuery("/api/material-traders", { kind, system }), {
      scope: "commander",
    });
  }

  return Object.freeze({ getWorkshop, setPinnedBlueprint, findMaterialTraders });
}

export const engineeringApi = createEngineeringApi();
