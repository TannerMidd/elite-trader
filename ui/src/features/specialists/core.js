/**
 * @import {
 *   CombatHistoryRow,
 *   MiningHistoryRow,
 *   SpecialistHistoryDetail,
 *   SpecialistHistoryMap,
 *   SpecialistState,
 *   TimedSpecialistSession,
 * } from "./types.js"
 */
import { requireById, setText } from "../../core/dom.js";
import { fmtCr, fmtDuration } from "../../core/fmt.js";
import { html, render } from "../../core/html.js";

export { fmtCr, fmtDuration, html, render, setText };

/** @param {unknown} value @returns {value is Record<string, unknown>} */
export function isSpecialistRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Keep the Specialist workspace's stable ID contract behind one checked DOM
 * seam so alternate shell hosts and tests can provide an isolated root.
 *
 * @param {string} id
 * @returns {HTMLElement}
 */
export function specialistElement(id) {
  const element = requireById(id);
  if (!(element instanceof HTMLElement)) {
    throw new TypeError(`Specialist control #${id} must be an HTML element.`);
  }
  return element;
}

/** @param {string} id */
export function specialistButton(id) {
  const element = requireById(id);
  if (!(element instanceof HTMLButtonElement)) {
    throw new TypeError(`Specialist control #${id} must be a button.`);
  }
  return element;
}

/** @param {string} id */
export function specialistInput(id) {
  const element = requireById(id);
  if (!(element instanceof HTMLInputElement)) {
    throw new TypeError(`Specialist control #${id} must be an input.`);
  }
  return element;
}

/** @param {string} id */
export function specialistTextArea(id) {
  const element = requireById(id);
  if (!(element instanceof HTMLTextAreaElement)) {
    throw new TypeError(`Specialist control #${id} must be a textarea.`);
  }
  return element;
}

/** @param {string} id */
export function specialistForm(id) {
  const element = requireById(id);
  if (!(element instanceof HTMLFormElement)) {
    throw new TypeError(`Specialist control #${id} must be a form.`);
  }
  return element;
}

/** @param {string} id */
export function specialistSelect(id) {
  const element = requireById(id);
  if (!(element instanceof HTMLSelectElement)) {
    throw new TypeError(`Specialist control #${id} must be a select.`);
  }
  return element;
}

/**
 * @param {unknown} error
 * @param {string} [fallback]
 * @returns {string}
 */
export function specialistError(error, fallback = "The specialist service is unavailable.") {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error.trim();
  if (isSpecialistRecord(error)) {
    const message = error.message;
    if (typeof message === "string" && message.trim()) return message.trim();
    const detail = error.detail;
    if (typeof detail === "string" && detail.trim()) return detail.trim();
  }
  return fallback;
}

/** @param {unknown} value @returns {value is number} */
function isOptionalNumber(value) {
  return value == null || typeof value === "number";
}

/** @param {unknown} value @returns {value is MiningHistoryRow} */
function isMiningHistoryRow(value) {
  if (!isSpecialistRecord(value)) return false;
  return [
    "started_ts",
    "ended_ts",
    "duration_s",
    "refined_t",
    "tons_per_hour",
    "asteroids_prospected",
    "attributed_revenue_cr",
  ].every((key) => isOptionalNumber(value[key]));
}

/** @param {unknown} value @returns {value is CombatHistoryRow} */
function isCombatHistoryRow(value) {
  if (!isSpecialistRecord(value)) return false;
  if (
    ![
      "started_ts",
      "ended_ts",
      "duration_s",
      "kills",
      "ax_kills",
      "bounty_cr",
      "bond_cr",
      "damage_events",
    ].every((key) => isOptionalNumber(value[key]))
  ) {
    return false;
  }
  return value.synthesis == null || isSpecialistRecord(value.synthesis);
}

/** @param {unknown} value @returns {SpecialistHistoryMap|undefined} */
function normaliseHistoryMap(value) {
  if (!isSpecialistRecord(value)) return undefined;
  if (value.mining != null && !Array.isArray(value.mining)) return undefined;
  if (value.combat != null && !Array.isArray(value.combat)) return undefined;
  const mining = Array.isArray(value.mining) ? value.mining.filter(isMiningHistoryRow) : undefined;
  const combat = Array.isArray(value.combat) ? value.combat.filter(isCombatHistoryRow) : undefined;
  return { mining, combat };
}

/** @param {unknown} value @returns {value is SpecialistState} */
function isSpecialistState(value) {
  if (!isSpecialistRecord(value)) return false;
  if (value.commander_id != null && typeof value.commander_id !== "string") return false;
  for (const name of ["mining", "combat", "carrier", "exobiology"]) {
    if (value[name] != null && !isSpecialistRecord(value[name])) return false;
  }
  if (value.history != null && !normaliseHistoryMap(value.history)) return false;
  if (value.histories != null && !normaliseHistoryMap(value.histories)) return false;
  return true;
}

/**
 * Accept the response envelopes shipped by older specialist API revisions.
 *
 * @param {unknown} data
 * @returns {SpecialistState}
 */
export function normaliseSpecialistSnapshot(data) {
  if (!isSpecialistRecord(data)) return {};
  const candidate = data.snapshot ?? data.specialists ?? data;
  if (!isSpecialistState(candidate)) return {};
  const envelopeHistory = normaliseHistoryMap(data.history ?? data.histories);
  if (candidate !== data && envelopeHistory) {
    return { ...candidate, history: envelopeHistory };
  }
  return candidate;
}

/**
 * @param {TimedSpecialistSession|null|undefined} session
 * @param {boolean} active
 * @returns {number|null}
 */
export function specialistDuration(session, active) {
  if (!session) return null;
  if (active && session.started_ts != null) {
    const raw = Number(session.started_ts);
    const startedMs = raw < 10_000_000_000 ? raw * 1000 : raw;
    if (Number.isFinite(startedMs)) {
      return Math.max(0, (Date.now() - startedMs) / 1000);
    }
  }
  return session.duration_s == null ? null : Number(session.duration_s);
}

/** @param {unknown} value */
export function specialistTimestamp(value) {
  if (value == null || value === "") return "Unknown time";
  const raw =
    typeof value === "number" || /^\d+(?:\.\d+)?$/.test(String(value))
      ? Number(value)
      : String(value);
  const millis = typeof raw === "number" && raw < 10_000_000_000 ? raw * 1000 : raw;
  const date = new Date(millis);
  return Number.isNaN(date.getTime()) ? "Unknown time" : date.toLocaleString();
}

/** @param {unknown} value */
export function specialistAgo(value) {
  if (value == null || value === "") return "unknown time";
  const raw = Number(value);
  if (!Number.isFinite(raw)) return specialistTimestamp(value);
  const millis = raw < 10_000_000_000 ? raw * 1000 : raw;
  const minutes = Math.floor(Math.max(0, Date.now() - millis) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 30 ? `${days}d ago` : specialistTimestamp(value);
}

/**
 * @param {unknown} value
 * @param {string} [suffix]
 */
export function specialistNumber(value, suffix = "") {
  if (value == null || value === "") return "—";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "—";
  return `${numeric.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}${suffix}`;
}

/** @param {unknown} value */
export function specialistHumanName(value) {
  return String(value || "unknown")
    .replace(/^hpt_|^int_|^ext_/, "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/**
 * @param {string} id
 * @param {Array<[unknown, unknown, unknown?]>} facts
 */
export function renderSpecialistFacts(id, facts) {
  render(
    specialistElement(id),
    html`${facts.map(
      ([label, value, note]) =>
        html`<div class="sp-fact">
          <span>${label}</span><b>${value}</b>
          ${note ? html`<small>${note}</small>` : ""}
        </div>`,
    )}`,
  );
}

/**
 * @template {TimedSpecialistSession} T
 * @param {string} id
 * @param {T[]} history
 * @param {(item: T) => SpecialistHistoryDetail} formatter
 */
export function renderSpecialistHistory(id, history, formatter) {
  const target = specialistElement(id);
  if (!history.length) {
    render(
      target,
      html`<div class="dim empty">No completed sessions recorded for this commander yet.</div>`,
    );
    return;
  }
  render(
    target,
    html`${history.slice(0, 8).map((item) => {
      const detail = formatter(item);
      const timestamp = item.ended_ts || item.started_ts;
      return html`<div class="sp-history-row">
        <div><b>${detail.title}</b><span>${detail.subtitle}</span></div>
        <time title="${specialistTimestamp(timestamp)}">${specialistAgo(timestamp)}</time>
      </div>`;
    })}`,
  );
}
