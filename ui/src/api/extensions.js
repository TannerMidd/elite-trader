import { http } from "../core/http.js";
import { pathSegment } from "./query.js";

/** @import {DownloadArtifact, JsonObject} from "./contracts/common.js" */
/** @import {DiagnosticsHealthResponse, ExtensionManifest, ExtensionManifestResponse, ExtensionSnapshot, ExtensionTestResponse} from "./contracts/extensions.js" */

/** @param {typeof http} [client] */
export function createExtensionsApi(client = http) {
  /** @returns {Promise<ExtensionSnapshot>} */
  function listExtensions() {
    return client.json("/api/extensions");
  }

  /** @returns {Promise<DiagnosticsHealthResponse>} */
  function getDiagnosticsHealth() {
    return client.json("/api/diagnostics/health");
  }

  /**
   * @returns {Promise<DownloadArtifact>}
   */
  function createSupportBundle() {
    return client.download("/api/diagnostics/bundle", { method: "POST" });
  }

  /** @returns {Promise<ExtensionSnapshot>} */
  function reloadExtensions() {
    return client.json("/api/extensions/reload", { method: "POST" });
  }

  /**
   * Test a manifest against the active commander's journal history.
   *
   * @param {ExtensionManifest} manifest
   * @returns {Promise<ExtensionTestResponse>}
   */
  function testManifestAgainstHistory(manifest) {
    return client.json("/api/extensions/test", {
      method: "POST",
      json: { manifest },
      scope: "commander",
    });
  }

  /**
   * Test deterministically with a supplied event; no commander context is read.
   *
   * @param {ExtensionManifest} manifest
   * @param {JsonObject} sampleEvent
   * @returns {Promise<ExtensionTestResponse>}
   */
  function testManifestWithSample(manifest, sampleEvent) {
    return client.json("/api/extensions/test", {
      method: "POST",
      json: { manifest, sample_event: sampleEvent },
    });
  }

  /** @param {ExtensionManifest} manifest @returns {Promise<ExtensionSnapshot>} */
  function saveManifest(manifest) {
    return client.json("/api/extensions/save", { method: "POST", json: { manifest } });
  }

  /** @param {string} extensionId @returns {Promise<ExtensionManifestResponse>} */
  function getManifest(extensionId) {
    return client.json(`/api/extensions/${pathSegment(extensionId)}/manifest`);
  }

  /** @param {string} extensionId @returns {Promise<ExtensionSnapshot>} */
  function deleteExtension(extensionId) {
    return client.json(`/api/extensions/${pathSegment(extensionId)}`, { method: "DELETE" });
  }

  /** @param {string} extensionId @returns {Promise<ExtensionSnapshot>} */
  function approveExtension(extensionId) {
    return client.json(`/api/extensions/${pathSegment(extensionId)}/approve`, { method: "POST" });
  }

  /** @param {string} extensionId @returns {Promise<ExtensionSnapshot>} */
  function revokeExtension(extensionId) {
    return client.json(`/api/extensions/${pathSegment(extensionId)}/revoke`, { method: "POST" });
  }

  return Object.freeze({
    listExtensions,
    getDiagnosticsHealth,
    createSupportBundle,
    reloadExtensions,
    testManifestAgainstHistory,
    testManifestWithSample,
    saveManifest,
    getManifest,
    deleteExtension,
    approveExtension,
    revokeExtension,
  });
}

export const extensionsApi = createExtensionsApi();
