import { HttpError, StaleResponseError } from "../core/http.js";

/**
 * Identify a commander-scoped response invalidated by a profile handoff
 * without exposing the transport layer to feature modules.
 *
 * @param {unknown} error
 * @returns {boolean}
 */
export function isStaleCommanderResponse(error) {
  return error instanceof StaleResponseError;
}

/**
 * Keep authentication branching behind the API boundary so composition code
 * does not need to import transport error types.
 *
 * @param {unknown} error
 * @returns {boolean}
 */
export function isUnauthorizedResponse(error) {
  return error instanceof HttpError && error.status === 401;
}
