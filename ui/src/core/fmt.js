/** Pure display formatters. */

const NUMBER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/**
 * @param {unknown} value
 * @returns {string}
 */
export function fmtNum(value) {
  const number = Number(value);
  return Number.isFinite(number) ? NUMBER.format(number) : "—";
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function fmtCr(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${NUMBER.format(Math.round(number))} cr` : "—";
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function signedCr(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  const prefix = number > 0 ? "+" : "";
  return `${prefix}${NUMBER.format(Math.round(number))} cr`;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function shortCr(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  const absolute = Math.abs(number);
  if (absolute >= 1_000_000_000) return `${(number / 1_000_000_000).toFixed(1)}B`;
  if (absolute >= 1_000_000) return `${(number / 1_000_000).toFixed(1)}M`;
  if (absolute >= 1_000) return `${(number / 1_000).toFixed(1)}K`;
  return NUMBER.format(Math.round(number));
}

/**
 * @param {unknown} seconds
 * @returns {string}
 */
export function fmtDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = total % 60;
  if (hours) return `${hours}h ${minutes}m`;
  if (minutes) return `${minutes}m ${remainder}s`;
  return `${remainder}s`;
}

/**
 * @param {unknown} seconds
 * @returns {string}
 */
export function ageText(seconds) {
  const total = Number(seconds);
  if (!Number.isFinite(total) || total < 0) return "unknown";
  if (total < 60) return "just now";
  if (total < 3600) return `${Math.floor(total / 60)}m ago`;
  if (total < 86400) return `${Math.floor(total / 3600)}h ago`;
  return `${Math.floor(total / 86400)}d ago`;
}

/**
 * Preserve a question-mark distinction where "unknown" is operationally
 * different from an intentionally empty display value.
 *
 * @param {number|null|undefined} value
 * @returns {string}
 */
export function fmtUnknownNumber(value) {
  return value == null ? "?" : Math.round(value).toLocaleString();
}

/**
 * Compact credit value used by dense cockpit telemetry.
 *
 * @param {number} value
 * @returns {string}
 */
export function compactCredits(value) {
  const absolute = Math.abs(value);
  if (absolute >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (absolute >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (absolute >= 1e3) return `${(value / 1e3).toFixed(0)}k`;
  return String(Math.round(value));
}

/**
 * @param {number|null|undefined} value
 * @returns {string}
 */
export function signedCompactCredits(value) {
  if (value == null) return "—";
  return `${value >= 0 ? "+" : "−"}${compactCredits(Math.abs(value))} cr`;
}

/**
 * Compact duration that promotes multi-day values.
 *
 * @param {number|null|undefined} seconds
 * @returns {string}
 */
export function compactDuration(seconds) {
  if (seconds == null || seconds < 0) return "—";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${minutes}m`;
  if (minutes) return `${minutes}m`;
  return `${Math.floor(seconds)}s`;
}
