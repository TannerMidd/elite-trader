/** @import {DownloadArtifact, JsonObject, JsonValue} from "./common.js" */

/**
 * @typedef {{
 *   all?: boolean,
 *   statuses?: readonly string[],
 * }} ObjectiveListOptions
 *
 * @typedef {{
 *   id: string,
 *   title: string,
 *   status: string,
 *   category?: string,
 *   priority?: number,
 *   system?: string|null,
 *   station?: string|null,
 *   body?: string|null,
 *   estimated_seconds?: number|null,
 *   deadline?: number|null,
 *   reward?: number,
 *   risk?: string|null,
 *   payload?: JsonObject,
 *   dependencies?: string[],
 *   source?: string,
 *   source_ref?: string|null,
 *   created_at?: string,
 *   updated_at?: string,
 * }} Objective
 *
 * @typedef {{
 *   title?: string,
 *   status?: string,
 *   category?: string,
 *   priority?: number,
 *   system?: string|null,
 *   station?: string|null,
 *   body?: string|null,
 *   estimated_seconds?: number|null,
 *   deadline?: number|string|null,
 *   reward?: number,
 *   risk?: string|null,
 *   payload?: JsonObject,
 *   dependencies?: string[],
 *   source_ref?: string|null,
 * }} ObjectiveRequest
 *
 * @typedef {{objectives: Objective[]}} ObjectiveListResponse
 * @typedef {{objective: Objective}} ObjectiveMutationResponse
 *
 * @typedef {{
 *   minutes?: number,
 *   time_budget_minutes?: number,
 *   max_tasks?: number,
 *   context?: {
 *     cargo_rescue?: JsonValue,
 *     cargo_options?: JsonValue,
 *     colonisation_sources?: JsonValue,
 *     powerplay_tasks?: JsonValue,
 *     exploration_cash_in?: JsonValue,
 *   },
 * }} ObjectivePlanRequest
 *
 * @typedef {{
 *   system?: string|null,
 *   station?: string|null,
 *   body?: string|null,
 * }} ObjectiveDestination
 *
 * @typedef {{
 *   id: string,
 *   category: string,
 *   title: string,
 *   activity: string,
 *   priority: number,
 *   why: string,
 *   plot: ObjectiveDestination|null,
 *   estimated_seconds: number,
 *   estimated_minutes: number,
 *   deadline: number|null,
 *   reward: number,
 *   risk: string|null,
 *   depends_on: string[],
 *   payload: JsonObject,
 * }} ObjectivePlanTask
 *
 * @typedef {{
 *   commander_id: string,
 *   budget_minutes: number,
 *   planned_minutes: number,
 *   remaining_minutes: number,
 *   selected: ObjectivePlanTask[],
 *   alternatives: ObjectivePlanTask[],
 *   graph: {
 *     nodes: ObjectivePlanTask[],
 *     edges: {from: string, to: string}[],
 *   },
 *   warnings: string[],
 *   generated_at: string,
 * }} ObjectivePlanResponse
 *
 * @typedef {{
 *   activity: string,
 *   seconds: number,
 *   median_seconds: number|null,
 *   sample_count: number,
 *   source: "personal_median"|"conservative_default",
 *   context: string|null,
 *   conservative_margin: number|null,
 * }} TimingEstimate
 *
 * @typedef {{
 *   activity: string,
 *   context: string,
 *   started_at: number,
 * }} PendingTiming
 *
 * @typedef {{
 *   commander_id: string,
 *   activities: {[activity: string]: TimingEstimate},
 *   pending: PendingTiming[],
 * }} TimingsResponse
 *
 * @typedef {"boards"|"objectives"|"assignments"|"reservations"|"contributions"} OperationRecordKind
 * @typedef {"create_board"|"add_objective"|"assign"|"reserve"|"contribute"} OperationAction
 *
 * @typedef {{
 *   id: string,
 *   title: string,
 *   description?: string,
 *   status?: string,
 *   created_at?: string,
 *   updated_at?: string,
 *   revision?: number,
 *   updated_by?: string,
 *   version_hash?: string,
 *   deleted_at?: string|null,
 * }} OperationBoard
 *
 * @typedef {{
 *   id: string,
 *   board_id: string,
 *   objective_id?: string|null,
 *   title?: string,
 *   description?: string,
 *   status?: string,
 *   priority?: number,
 *   system?: string|null,
 *   station?: string|null,
 *   deadline?: number|null,
 *   assignee?: string|null,
 *   role?: string,
 *   resource_type?: string,
 *   resource_key?: string,
 *   amount?: number,
 *   unit?: string,
 *   contributor?: string,
 *   kind?: string,
 *   note?: string,
 *   evidence?: JsonValue,
 *   payload?: JsonObject,
 *   created_at?: string,
 *   updated_at?: string,
 *   revision?: number,
 *   updated_by?: string,
 *   version_hash?: string,
 *   deleted_at?: string|null,
 * }} OperationRecord
 *
 * @typedef {{
 *   id?: number,
 *   table_name?: string,
 *   record_id?: string,
 *   board_id?: string,
 *   local_version?: string,
 *   incoming_version?: string,
 *   losing_payload?: JsonObject,
 *   detected_at?: string,
 * }} OperationConflict
 *
 * @typedef {{
 *   boards: OperationBoard[],
 *   conflicts: OperationConflict[],
 * }} OperationsListResponse
 *
 * @typedef {{
 *   board: OperationBoard,
 *   objectives: OperationRecord[],
 *   assignments: OperationRecord[],
 *   reservations: OperationRecord[],
 *   contributions: OperationRecord[],
 *   conflicts: OperationConflict[],
 * }} OperationsBoardResponse
 *
 * @typedef {{
 *   action?: OperationAction,
 *   title?: string,
 *   description?: string,
 *   board_id?: string,
 *   objective_id?: string|null,
 *   priority?: number,
 *   system?: string|null,
 *   station?: string|null,
 *   deadline?: number|null,
 *   assignee?: string|null,
 *   role?: string,
 *   resource_type?: string,
 *   resource_key?: string,
 *   amount?: number,
 *   unit?: string,
 *   contributor?: string,
 *   kind?: string,
 *   note?: string,
 *   evidence?: JsonValue,
 *   payload?: JsonObject,
 * }} OperationRequest
 *
 * @typedef {{
 *   title?: string,
 *   description?: string,
 *   status?: string,
 *   priority?: number,
 *   system?: string|null,
 *   station?: string|null,
 *   deadline?: number|null,
 *   assignee?: string|null,
 *   role?: string,
 *   resource_type?: string,
 *   resource_key?: string,
 *   amount?: number,
 *   unit?: string,
 *   contributor?: string,
 *   kind?: string,
 *   note?: string,
 *   evidence?: JsonValue,
 *   payload?: JsonObject,
 * }} OperationRecordChanges
 *
 * @typedef {{record: OperationBoard|OperationRecord}} OperationMutationResponse
 *
 * @typedef {{
 *   inserted: number,
 *   updated: number,
 *   unchanged: number,
 *   kept_local: number,
 *   conflicts: number,
 * }} OperationImportReport
 */

export {};
