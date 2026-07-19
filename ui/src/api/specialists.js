import { http } from "../core/http.js";
import { pathSegment, withQuery } from "./query.js";

/** @import {CarrierConfigRequest, CarrierInventory, CarrierRouteRequest, CombatStartRequest, ExobiologyPinRequest, MiningStartRequest, SpecialistPagination, SpecialistSnapshot} from "./contracts/specialists.js" */

const commanderScope = /** @type {const} */ ({ scope: "commander" });

/** @param {typeof http} [client] */
export function createSpecialistsApi(client = http) {
  /** @param {SpecialistPagination} [pagination] @returns {Promise<SpecialistSnapshot>} */
  function getSnapshot(pagination = {}) {
    return client.json(withQuery("/api/specialists", pagination), commanderScope);
  }

  /**
   * @param {MiningStartRequest} [request]
   * @returns {Promise<SpecialistSnapshot>}
   */
  function startMiningRun(request = {}) {
    return client.json("/api/specialists/mining/start", {
      method: "POST",
      json: request,
      scope: "commander",
    });
  }

  /** @param {string} [reason] @returns {Promise<SpecialistSnapshot>} */
  function endMiningRun(reason = "manual") {
    return client.json("/api/specialists/mining/end", {
      method: "POST",
      json: { reason },
      scope: "commander",
    });
  }

  /** @param {CombatStartRequest} [request] @returns {Promise<SpecialistSnapshot>} */
  function startCombatSession(request = {}) {
    return client.json("/api/specialists/combat/start", {
      method: "POST",
      json: request,
      scope: "commander",
    });
  }

  /** @param {string} [reason] @returns {Promise<SpecialistSnapshot>} */
  function endCombatSession(reason = "manual") {
    return client.json("/api/specialists/combat/end", {
      method: "POST",
      json: { reason },
      scope: "commander",
    });
  }

  /**
   * @param {CarrierConfigRequest} request
   * @returns {Promise<SpecialistSnapshot>}
   */
  function configureCarrier(request) {
    return client.json("/api/specialists/carrier/config", {
      method: "POST",
      json: request,
      scope: "commander",
    });
  }

  /**
   * @param {CarrierRouteRequest} request
   * @returns {Promise<SpecialistSnapshot>}
   */
  function planCarrierRoute(request) {
    return client.json("/api/specialists/carrier/route", {
      method: "POST",
      json: request,
      scope: "commander",
    });
  }

  /**
   * @param {CarrierInventory} items
   * @param {string} [source]
   * @returns {Promise<SpecialistSnapshot>}
   */
  function setCarrierInventory(items, source = "commander inventory input") {
    return client.json("/api/specialists/carrier/inventory", {
      method: "POST",
      json: { items, source },
      scope: "commander",
    });
  }

  /**
   * @param {ExobiologyPinRequest} request
   * @returns {Promise<SpecialistSnapshot>}
   */
  function addExobiologyPin(request) {
    return client.json("/api/specialists/exobiology/pins", {
      method: "POST",
      json: request,
      scope: "commander",
    });
  }

  /** @param {string} pinId @returns {Promise<SpecialistSnapshot>} */
  function removeExobiologyPin(pinId) {
    return client.json(`/api/specialists/exobiology/pins/${pathSegment(pinId)}`, {
      method: "DELETE",
      scope: "commander",
    });
  }

  /**
   * The server emits GeoJSON as application/json; a Blob preserves the current
   * browser download workflow without reparsing and serializing the document.
   *
   * @param {string} [body]
   * @returns {Promise<Blob>}
   */
  function exportExobiologyGeoJson(body) {
    return client.blob(withQuery("/api/specialists/exobiology/geojson", { body }), {
      scope: "commander",
    });
  }

  return Object.freeze({
    getSnapshot,
    startMiningRun,
    endMiningRun,
    startCombatSession,
    endCombatSession,
    configureCarrier,
    planCarrierRoute,
    setCarrierInventory,
    addExobiologyPin,
    removeExobiologyPin,
    exportExobiologyGeoJson,
  });
}

export const specialistsApi = createSpecialistsApi();
