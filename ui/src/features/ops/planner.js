import { fmtCr } from "../../core/fmt.js";
import { html, render } from "../../core/html.js";
import {
  button,
  element,
  formatOpsDuration,
  form,
  getOpsApi,
  input,
  isStaleOpsError,
  listen,
  opsActivityName,
  opsEpochLabel,
  opsState,
  plotOpsSystem,
  renderOpsError,
} from "./shared.js";

/**
 * @import {
 *   ObjectivePlanResponse,
 *   ObjectivePlanTask,
 * } from "../../api/contracts/operations.js"
 */
/**
 * @typedef {{
 *   depends_on?: string[],
 *   estimated_minutes?: number,
 *   estimated_seconds?: number,
 * }} AlternativeTask
 * @typedef {{remaining_minutes: number}} AlternativePlan
 * @typedef {{id: string, title: string}} DependencyNode
 */

/**
 * @param {string} activity
 * @param {number|null|undefined} plannedSeconds
 * @returns {string}
 */
export function timingProvenance(activity, plannedSeconds) {
  const estimate = opsState.timings?.activities?.[activity];
  const planned = plannedSeconds ? `Plan estimate ${formatOpsDuration(plannedSeconds)}.` : "";
  if (!estimate) {
    return `${planned} No timing provenance is available for this activity.`.trim();
  }
  if (estimate.source === "personal_median") {
    const context = estimate.context ? ` for ${estimate.context}` : "";
    const margin = estimate.conservative_margin
      ? `; +${Math.round(estimate.conservative_margin * 100)}% planning margin`
      : "";
    return (
      `${planned} Personal median${context}: ${formatOpsDuration(estimate.median_seconds)} from ` +
      `${estimate.sample_count} local journal sample${estimate.sample_count === 1 ? "" : "s"}${margin}.`
    );
  }
  const partial = estimate.sample_count
    ? ` (${estimate.sample_count} sample${estimate.sample_count === 1 ? "" : "s"}; 3 required for a personal median)`
    : "";
  return (
    `${planned} Conservative built-in default: ${formatOpsDuration(estimate.seconds)}` +
    `${partial}.`
  );
}

export function renderOpsTimings() {
  const timings = opsState.timings;
  const activities = Object.entries(timings?.activities || {});
  const personal = activities.filter(([, value]) => value.source === "personal_median");
  element("ops-timing-summary").textContent = activities.length
    ? `${personal.length} PERSONAL · ${activities.length - personal.length} DEFAULT`
    : "NO TIMING DATA";

  if (!activities.length) {
    render(
      element("ops-timing-list"),
      html`<div class="empty dim">No timing model is available yet.</div>`,
    );
    return;
  }

  const pendingActivities = timings?.pending || [];
  const pending = pendingActivities.length
    ? html`<div class="dim empty">
        Currently learning
        ${pendingActivities.map((row) => opsActivityName(row.activity)).join(", ")}.
      </div>`
    : false;
  const rows = activities
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([activity, value]) => {
      const source =
        value.source === "personal_median"
          ? `${value.sample_count} samples · median ${formatOpsDuration(value.median_seconds)} · planned ${formatOpsDuration(value.seconds)}`
          : `conservative default · ${formatOpsDuration(value.seconds)}${value.sample_count ? ` · ${value.sample_count}/3 samples` : ""}`;
      return html`<div class="ops-timing-row">
        <b>${opsActivityName(activity)}</b><span>${source}</span>
      </div>`;
    });
  render(
    element("ops-timing-list"),
    html`${pending}
      <div class="ops-timing-table">${rows}</div>`,
  );
}

export async function loadOpsTimings() {
  try {
    const data = await getOpsApi().getTimings();
    opsState.timings = data;
    renderOpsTimings();
    if (opsState.plan) renderOpsPlan(opsState.plan);
  } catch (error) {
    if (isStaleOpsError(error)) return;
    element("ops-timing-summary").textContent = "UNAVAILABLE";
    renderOpsError("ops-timing-list", error);
  }
}

/**
 * @param {AlternativeTask} task
 * @param {AlternativePlan} plan
 * @param {Set<string>} selectedIds
 * @param {Map<string, DependencyNode>} nodeById
 * @returns {string}
 */
export function alternativeReason(task, plan, selectedIds, nodeById) {
  const dependencies = (task.depends_on || [])
    .map((id) => nodeById.get(id))
    .filter((item) => item !== undefined);
  const missing = dependencies.filter((item) => !selectedIds.has(item.id));
  if (missing.length) {
    return `Its required bundle also includes ${missing.map((item) => item.title).join(", ")}.`;
  }
  const estimated = task.estimated_minutes || Math.ceil((task.estimated_seconds || 0) / 60);
  if (estimated > plan.remaining_minutes) {
    return `Needs about ${estimated} minutes; ${plan.remaining_minutes} remain after selected work.`;
  }
  return (
    "Ranked behind selected work by priority, reward per minute and duration, " +
    "or its dependency bundle did not fit."
  );
}

/**
 * @param {ObjectivePlanTask} task
 * @param {number} index
 * @param {boolean} selected
 * @param {ObjectivePlanResponse} plan
 * @param {Map<string, ObjectivePlanTask>} nodeById
 */
function taskTemplate(task, index, selected, plan, nodeById) {
  const destination = task.plot || {};
  const place = [destination.system, destination.station || destination.body]
    .filter(Boolean)
    .join(" · ");
  const facts = [
    html`<span class="ops-fact">${opsActivityName(task.activity)}</span>`,
    html`<span class="ops-fact">${formatOpsDuration(task.estimated_seconds || 0)}</span>`,
    html`<span class="ops-fact">PRIORITY ${Number(task.priority || 0)}</span>`,
  ];
  if (task.reward) facts.push(html`<span class="ops-fact reward">${fmtCr(task.reward)}</span>`);
  if (place) facts.push(html`<span class="ops-fact">⌖ ${place}</span>`);
  if (task.deadline) {
    facts.push(html`<span class="ops-fact urgent">DUE ${opsEpochLabel(task.deadline)}</span>`);
  }
  if (task.risk) {
    facts.push(html`<span class="ops-fact urgent">RISK ${String(task.risk).toUpperCase()}</span>`);
  }

  const dependencies = task.depends_on
    .map((id) => nodeById.get(id))
    .filter((item) => item !== undefined);
  const requiredBy = selected
    ? plan.selected.filter((candidate) => candidate.depends_on.includes(task.id))
    : [];
  let decision;
  if (requiredBy.length) {
    decision = `Included first because ${requiredBy.map((item) => item.title).join(", ")} depends on it.`;
  } else if (selected) {
    decision =
      "Selected by priority, reward per minute and duration; its dependency bundle fits this budget.";
  } else {
    const selectedIds = new Set(plan.selected.map((item) => item.id));
    decision = alternativeReason(task, plan, selectedIds, nodeById);
  }

  const dependencyLine = dependencies.length
    ? html`<div class="ops-dependencies">
        <b>Requires:</b> ${dependencies.map((item) => item.title).join(" → ")}
      </div>`
    : false;
  const plot = destination.system
    ? html`<button
        class="hb hb-utility ops-task-action"
        type="button"
        data-ops-plot="${destination.system}"
      >
        PLOT ${destination.system}
      </button>`
    : false;
  return html`<article class="ops-task${selected ? "" : " alternative"}">
    <div class="ops-task-number">${selected ? index + 1 : `A${index + 1}`}</div>
    <div>
      <div class="ops-task-title">${task.title || "Untitled task"}</div>
      <div class="ops-task-why">${task.why || "Known local objective"} · ${decision}</div>
      <div class="ops-task-facts">${facts}</div>
      ${dependencyLine}
      <div class="ops-provenance">
        <b>Timing:</b> ${timingProvenance(task.activity, task.estimated_seconds)}
      </div>
    </div>
    ${plot}
  </article>`;
}

/**
 * @param {ObjectivePlanResponse} plan
 */
export function renderOpsPlan(plan) {
  opsState.plan = plan;
  const selectedTasks = plan.selected;
  const alternativeTasks = plan.alternatives;
  const graphNodes = plan.graph?.nodes || [...selectedTasks, ...alternativeTasks];
  const nodeById = new Map(graphNodes.map((task) => [task.id, task]));
  element("ops-plan-meta").textContent =
    `${plan.planned_minutes || 0} / ${plan.budget_minutes || 0} MIN`;
  element("ops-plan-status").textContent = selectedTasks.length
    ? `${plan.selected.length} task${plan.selected.length === 1 ? "" : "s"} selected · ` +
      `${plan.remaining_minutes || 0} minutes deliberately left uncommitted · generated ` +
      `${new Date(plan.generated_at || Date.now()).toLocaleTimeString()}`
    : "No known work fit this budget. Review the warnings and alternatives below.";

  const warnings = plan.warnings;
  element("ops-plan-warnings").classList.toggle("hidden", !warnings.length);
  render(
    element("ops-plan-warnings"),
    html`${warnings.map((warning) => html`<div>▲ ${warning}</div>`)}`,
  );
  render(
    element("ops-plan-selected"),
    selectedTasks.length
      ? html`${selectedTasks.map((task, index) => taskTemplate(task, index, true, plan, nodeById))}`
      : html`<div class="empty dim">No selected tasks.</div>`,
  );

  const alternatives = alternativeTasks;
  const visibleAlternatives = alternatives.slice(0, 50);
  element("ops-alternatives-wrap").classList.toggle("hidden", !alternatives.length);
  element("ops-alternative-count").textContent = alternatives.length
    ? `${alternatives.length} NOT SELECTED${alternatives.length > 50 ? " · SHOWING 50" : ""}`
    : "";
  render(
    element("ops-plan-alternatives"),
    html`${visibleAlternatives.map((task, index) =>
      taskTemplate(task, index, false, plan, nodeById),
    )}`,
  );
}

/**
 * @param {Event} event
 */
export async function buildOpsPlan(event) {
  event.preventDefault();
  const submit = button("ops-plan-go");
  submit.disabled = true;
  submit.textContent = "PLANNING…";
  element("ops-plan-status").textContent =
    "Evaluating current journal state, saved objectives and dependency bundles…";
  try {
    const budget = Number(input("ops-budget").value);
    const data = await getOpsApi().planObjectives({
      minutes: budget,
      time_budget_minutes: budget,
      max_tasks: Number(input("ops-max-tasks").value),
    });
    renderOpsPlan(data);
  } catch (error) {
    if (!isStaleOpsError(error)) renderOpsError("ops-plan-status", error);
  } finally {
    submit.disabled = false;
    submit.textContent = "BUILD SESSION PLAN";
  }
}

/** @returns {() => void} */
export function initPlanner() {
  const disposers = [
    listen(form("ops-plan-form"), "submit", (event) => {
      void buildOpsPlan(event);
    }),
    listen(element("ops-plan-card"), "click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const action = target.closest("[data-ops-plot]");
      if (!(action instanceof HTMLElement)) return;
      const system = action.dataset.opsPlot;
      if (system) plotOpsSystem(system);
    }),
  ];
  return () => disposers.forEach((dispose) => dispose());
}
