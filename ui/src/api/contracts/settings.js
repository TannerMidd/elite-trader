/** @import {JsonValue} from "./common.js" */

/**
 * Settings are an intentionally extensible server-owned key/value registry.
 * Values remain bounded to JSON even though new keys may ship independently
 * of the browser client.
 *
 * @typedef {{[key: string]: JsonValue}} SettingsValues
 *
 * @typedef {{
 *   version: string,
 *   journal_dir: string,
 *   data_dir: string,
 *   auto_update_supported: boolean,
 * }} SettingsInfo
 *
 * @typedef {{
 *   settings: SettingsValues,
 *   info?: SettingsInfo,
 * }} SettingsResponse
 *
 * @typedef {{
 *   path: string,
 *   auto: boolean,
 *   exists: boolean|null,
 *   files: number,
 *   unchecked?: boolean,
 *   error?: string,
 * }} JournalDirectoryValidation
 *
 * @typedef {{
 *   name: string,
 *   label: string,
 *   mb: number,
 *   installed: boolean,
 * }} TextToSpeechVoice
 *
 * @typedef {{
 *   ready: boolean,
 *   voice: string,
 *   voices: TextToSpeechVoice[],
 *   downloading: boolean,
 *   progress: number,
 *   error: string|null,
 *   supported: boolean,
 * }} TextToSpeechStatus
 *
 * @typedef {"idle"|"downloading"|"importing"|"done"|"error"} MarketSeedPhase
 *
 * @typedef {{
 *   phase: MarketSeedPhase,
 *   error: string|null,
 *   downloaded_mb: number,
 *   total_mb: number,
 *   systems_done: number,
 *   stations_done: number,
 *   commodities_done: number,
 *   started_at: string|null,
 *   finished_at: string|null,
 * }} MarketSeedProgress
 *
 * @typedef {{
 *   connected: boolean,
 *   last_message_at: string|null,
 *   markets_updated: number,
 *   skipped_unknown: number,
 *   skipped_legacy: number,
 * }} EddnStatus
 *
 * @typedef {{
 *   enabled: boolean,
 *   market_enabled: boolean,
 *   extended_enabled: boolean,
 *   uploads: number,
 *   last_upload_at: string|null,
 *   last_error: string|null,
 *   by_schema: {[schema: string]: number},
 * }} EddnUploadStatus
 *
 * @typedef {{
 *   db_path: string,
 *   db_size_mb: number,
 *   systems: number,
 *   stations: number,
 *   commodity_rows: number,
 *   seeded_at: string|null,
 *   ready: boolean,
 *   seeding: MarketSeedProgress,
 *   eddn: EddnStatus,
 *   eddn_upload: EddnUploadStatus,
 * }} MarketDatabaseStatus
 *
 * @typedef {{ok: true}} MarketSeedResponse
 */

export {};
