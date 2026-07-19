import { HttpError, http } from "../core/http.js";
import { withQuery } from "./query.js";

/** @import {JournalDirectoryValidation, MarketDatabaseStatus, MarketSeedResponse, SettingsResponse, SettingsValues, TextToSpeechStatus} from "./contracts/settings.js" */

/**
 * A rejected path is still a useful validation result for the settings form.
 *
 * @param {unknown} value
 * @returns {value is JournalDirectoryValidation}
 */
function isJournalValidation(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof Reflect.get(value, "path") === "string" &&
    typeof Reflect.get(value, "auto") === "boolean" &&
    typeof Reflect.get(value, "files") === "number"
  );
}

/** @param {typeof http} [client] */
export function createSettingsApi(client = http) {
  /** @returns {Promise<SettingsResponse>} */
  function getSettings() {
    return client.json("/api/settings");
  }

  /**
   * The settings registry is intentionally extensible; values are still
   * constrained to JSON by SettingsValues.
   *
   * @param {SettingsValues} changes
   * @returns {Promise<SettingsResponse>}
   */
  function updateSettings(changes) {
    return client.json("/api/settings", { method: "POST", json: changes });
  }

  /**
   * HTTP 400 means the server deliberately refused to probe a LAN-supplied
   * path. Preserve that payload as a displayable validation result.
   *
   * @param {string} path
   * @returns {Promise<JournalDirectoryValidation>}
   */
  async function validateJournalDirectory(path) {
    try {
      return await client.json(withQuery("/api/journal-dir/validate", { path }));
    } catch (error) {
      if (
        error instanceof HttpError &&
        error.status === 400 &&
        isJournalValidation(error.payload)
      ) {
        return error.payload;
      }
      throw error;
    }
  }

  /** @returns {Promise<MarketDatabaseStatus>} */
  function getMarketDatabaseStatus() {
    return client.json("/api/marketdb/status");
  }

  /** @returns {Promise<MarketSeedResponse>} */
  function seedMarketDatabase() {
    return client.json("/api/marketdb/seed", { method: "POST" });
  }

  /** @returns {Promise<TextToSpeechStatus>} */
  function getTextToSpeechStatus() {
    return client.json("/api/tts/status");
  }

  /** @returns {Promise<TextToSpeechStatus>} */
  function downloadTextToSpeechVoice() {
    return client.json("/api/tts/download", { method: "POST" });
  }

  /** @param {string} voice @returns {Promise<TextToSpeechStatus>} */
  function selectTextToSpeechVoice(voice) {
    return client.json("/api/tts/voice", { method: "POST", json: { voice } });
  }

  /** @param {string} text @returns {Promise<Blob>} */
  function synthesizeSpeech(text) {
    return client.blob("/api/speak", { method: "POST", json: { text } });
  }

  return Object.freeze({
    getSettings,
    updateSettings,
    validateJournalDirectory,
    getMarketDatabaseStatus,
    seedMarketDatabase,
    getTextToSpeechStatus,
    downloadTextToSpeechVoice,
    selectTextToSpeechVoice,
    synthesizeSpeech,
  });
}

export const settingsApi = createSettingsApi();
