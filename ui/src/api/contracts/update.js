/**
 * @typedef {{
 *   current: string,
 *   latest: string|null,
 *   available: boolean,
 *   notes_url: string,
 *   notes: string|null,
 *   notes_title: string|null,
 *   size: number|null,
 *   supported: boolean,
 *   verification: string,
 *   error: string|null,
 * }} UpdateCheckResponse
 *
 * @typedef {{ok: true}} UpdateApplyResponse
 *
 * @typedef {"idle"|"downloading"|"verifying"|"restarting"|"error"} UpdatePhase
 *
 * @typedef {{
 *   phase: UpdatePhase,
 *   error: string|null,
 *   downloaded_mb: number,
 *   total_mb: number,
 *   pct: number,
 * }} UpdateProgressResponse
 */

export {};
