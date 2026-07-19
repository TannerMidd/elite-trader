import { http } from "../core/http.js";
import { pathSegment } from "./query.js";

/** @import {CreatePairingCodeRequest, PairedDevicesResponse, PairDeviceRequest, PairDeviceResponse, PairingCode, RevokeResponse, SecurityStatus, UpdateDeviceRequest, UpdateDeviceResponse} from "./contracts/security.js" */

/**
 * @param {typeof http} [client]
 */
export function createSecurityApi(client = http) {
  /** @returns {Promise<SecurityStatus>} */
  function getStatus() {
    return client.json("/api/security/status");
  }

  /** @param {PairDeviceRequest} request @returns {Promise<PairDeviceResponse>} */
  function pairDevice(request) {
    return client.json("/api/security/pair", { method: "POST", json: request });
  }

  /** @param {CreatePairingCodeRequest} request @returns {Promise<PairingCode>} */
  function createPairingCode(request) {
    return client.json("/api/security/pairing-code", { method: "POST", json: request });
  }

  /** @returns {Promise<PairedDevicesResponse>} */
  function listDevices() {
    return client.json("/api/security/devices");
  }

  /**
   * @param {string} deviceId
   * @param {UpdateDeviceRequest} changes
   * @returns {Promise<UpdateDeviceResponse>}
   */
  function updateDevice(deviceId, changes) {
    return client.json(`/api/security/devices/${pathSegment(deviceId)}`, {
      method: "PATCH",
      json: changes,
    });
  }

  /** @param {string} deviceId @returns {Promise<RevokeResponse>} */
  function revokeDevice(deviceId) {
    return client.json(`/api/security/devices/${pathSegment(deviceId)}`, { method: "DELETE" });
  }

  /** @returns {Promise<RevokeResponse>} */
  function revokeSession() {
    return client.json("/api/security/session", { method: "DELETE" });
  }

  return Object.freeze({
    getStatus,
    pairDevice,
    createPairingCode,
    listDevices,
    updateDevice,
    revokeDevice,
    revokeSession,
  });
}

export const securityApi = createSecurityApi();
