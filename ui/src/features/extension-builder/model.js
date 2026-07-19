/** @import {JsonPrimitive} from "../../api/contracts/common.js" */
/** @import {ExtensionAction, ExtensionCondition, ExtensionManifest, ExtensionRule} from "../../api/contracts/extensions.js" */
import { XB_EVENTS } from "./catalog.js";

/**
 * @typedef {"eq"|"in"|"min"|"max"|"exists"|"absent"} BuilderOperator
 * @typedef {{field: string, op: BuilderOperator, value: string}} BuilderCondition
 * @typedef {{
 *   type: "alert"|"objective",
 *   level: string,
 *   text: string,
 *   voice: boolean,
 *   title: string,
 *   category: string,
 * }} BuilderAction
 * @typedef {{
 *   event: string,
 *   customEvent: string,
 *   conditions: BuilderCondition[],
 *   action: BuilderAction,
 * }} BuilderRule
 * @typedef {{
 *   name: string,
 *   editingId: string|null,
 *   rules: BuilderRule[],
 * }} BuilderModel
 * @typedef {{
 *   name?: string,
 *   editingId?: string|null,
 *   rules?: Array<Partial<Omit<BuilderRule, "action"|"conditions">> & {
 *     action?: Partial<BuilderAction>,
 *     conditions?: Partial<BuilderCondition>[],
 *   }>,
 * }} BuilderSeed
 */

/** @param {unknown} name */
export function xbSlug(name) {
  const slug = String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return /^[a-z0-9]/.test(slug) && slug.length >= 2 ? slug : "";
}

/** @returns {BuilderRule} */
export function xbBlankRule() {
  return {
    event: "FSDJump",
    customEvent: "",
    conditions: [],
    action: {
      type: "alert",
      level: "info",
      text: "",
      voice: false,
      title: "",
      category: "",
    },
  };
}

/**
 * @param {BuilderSeed|null|undefined} seed
 * @returns {BuilderModel}
 */
export function createBuilderModel(seed) {
  const sourceRules = seed?.rules ?? [xbBlankRule()];
  return {
    name: seed?.name || "",
    editingId: seed?.editingId || null,
    rules: sourceRules.map((rule) => {
      const blank = xbBlankRule();
      return {
        ...blank,
        ...rule,
        event: typeof rule.event === "string" ? rule.event : blank.event,
        customEvent: typeof rule.customEvent === "string" ? rule.customEvent : "",
        action: { ...blank.action, ...(rule.action || {}) },
        conditions: (rule.conditions || []).map((condition) => ({
          field: condition.field || "",
          op: isBuilderOperator(condition.op) ? condition.op : "eq",
          value: condition.value || "",
        })),
      };
    }),
  };
}

/** @param {unknown} value @returns {value is BuilderOperator} */
function isBuilderOperator(value) {
  return ["eq", "in", "min", "max", "exists", "absent"].includes(String(value));
}

/** @param {unknown} text @returns {JsonPrimitive} */
export function xbCoerce(text) {
  const value = String(text).trim();
  if (value === "true") return true;
  if (value === "false") return false;
  if (value !== "" && Number.isFinite(Number(value))) return Number(value);
  return value;
}

/**
 * @param {BuilderModel} model
 * @param {string} rawName
 * @returns {ExtensionManifest}
 */
export function collectManifest(model, rawName) {
  const name = rawName.trim();
  const id = model.editingId || xbSlug(name);
  if (!name) throw new Error("Give the extension a name.");
  if (!id) throw new Error("The name must contain at least two letters or digits.");
  /** @type {ExtensionRule[]} */
  const rules = [];
  const permissions = new Set(["read:journal"]);

  for (const rule of model.rules) {
    const event = rule.event || rule.customEvent.trim();
    if (!event) throw new Error("Every rule needs an event.");
    /** @type {Record<string, ExtensionCondition>} */
    const when = {};
    for (const condition of rule.conditions) {
      if (!condition.field) throw new Error("Conditions need a field name.");
      if (condition.op === "exists") when[condition.field] = { exists: true };
      else if (condition.op === "absent") when[condition.field] = { exists: false };
      else if (condition.op === "in") {
        when[condition.field] = {
          in: condition.value
            .split(",")
            .map((value) => xbCoerce(value))
            .filter((value) => value !== ""),
        };
      } else if (condition.op === "min" || condition.op === "max") {
        const number = Number(condition.value);
        if (!Number.isFinite(number)) {
          throw new Error(
            `"${condition.field}" needs a numeric value for ${
              condition.op === "min" ? "at least" : "at most"
            }.`,
          );
        }
        when[condition.field] = condition.op === "min" ? { min: number } : { max: number };
      } else {
        when[condition.field] = { eq: xbCoerce(condition.value) };
      }
    }

    /** @type {ExtensionAction} */
    let action;
    if (rule.action.type === "alert") {
      if (!rule.action.text.trim()) throw new Error("Alert rules need alert text.");
      const text = rule.action.text.trim();
      action = {
        type: "alert",
        text,
        level: rule.action.level || "info",
        code: "user." + id,
      };
      if (rule.action.voice) action.say = text;
      permissions.add("emit:alert");
    } else {
      if (!rule.action.title.trim()) throw new Error("Objective rules need a title.");
      action = { type: "objective", title: rule.action.title.trim() };
      if (rule.action.category.trim()) action.category = rule.action.category.trim();
      permissions.add("emit:objective");
    }
    const entry = /** @type {ExtensionRule} */ ({ event, action });
    if (Object.keys(when).length) entry.when = when;
    rules.push(entry);
  }
  if (!rules.length) throw new Error("Add at least one rule.");
  return { id, api_version: 1, name, version: "1", permissions: [...permissions], rules };
}

/**
 * @param {ExtensionRule} rule
 * @returns {BuilderRule}
 */
export function xbRuleFromManifest(rule) {
  /** @type {BuilderCondition[]} */
  const conditions = [];
  for (const [field, expected] of Object.entries(rule.when || {})) {
    if (expected !== null && typeof expected === "object" && !Array.isArray(expected)) {
      if ("exists" in expected) {
        conditions.push({ field, op: expected.exists ? "exists" : "absent", value: "" });
      }
      if ("eq" in expected) conditions.push({ field, op: "eq", value: String(expected.eq) });
      if ("in" in expected) {
        conditions.push({ field, op: "in", value: (expected.in || []).join(", ") });
      }
      if ("min" in expected) conditions.push({ field, op: "min", value: String(expected.min) });
      if ("max" in expected) conditions.push({ field, op: "max", value: String(expected.max) });
    } else {
      conditions.push({ field, op: "eq", value: String(expected) });
    }
  }
  const action = rule.action;
  const known = XB_EVENTS.some((event) => event.id === rule.event);
  return {
    event: known ? rule.event : "",
    customEvent: known ? "" : rule.event,
    conditions,
    action: {
      type: action.type === "objective" ? "objective" : "alert",
      level: action.level || "info",
      text: action.text || "",
      voice: Boolean(action.say),
      title: action.title || "",
      category: action.category || "",
    },
  };
}
