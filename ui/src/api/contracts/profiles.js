/**
 * @typedef {{[table: string]: number}} ProfileTableCounts
 *
 * @typedef {{
 *   id: string,
 *   name: string,
 *   galaxy_mode: "live"|"legacy"|"unknown",
 *   created_at: string,
 *   last_seen_at: string,
 *   active: boolean,
 *   tables: ProfileTableCounts,
 *   rows: number,
 * }} CommanderProfile
 *
 * @typedef {{
 *   profiles: CommanderProfile[],
 *   active_commander_id: string,
 *   adopted_by: string|null,
 *   unattributed: {
 *     tables: ProfileTableCounts,
 *     rows: number,
 *   },
 * }} ProfileOverview
 *
 * @typedef {{
 *   ok: true,
 *   moved: ProfileTableCounts,
 *   rows: number,
 * }} AssignUnattributedResponse
 *
 * @typedef {{
 *   ok: true,
 *   commander: string,
 *   commander_id: string,
 *   galaxy_mode: "live"|"legacy",
 * }} ActivateProfileResponse
 *
 * @typedef {{
 *   ok: true,
 *   removed: ProfileTableCounts,
 *   rows: number,
 * }} DeleteProfileResponse
 */

export {};
