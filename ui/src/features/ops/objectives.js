import { fmtCr } from "../../core/fmt.js";
import { html, render } from "../../core/html.js";
import {
  button,
  confirmOpsAction,
  element,
  formatOpsDuration,
  form,
  getOpsApi,
  input,
  isStaleOpsError,
  listen,
  opsActivityName,
  opsDateInput,
  opsEpochLabel,
  opsState,
  renderOpsError,
  select,
} from "./shared.js";

/** @import {ObjectiveRequest} from "../../api/contracts/operations.js" */

const OBJECTIVE_STATUSES = ["open", "active", "blocked", "done", "dismissed"];

/** @returns {string} */
export function objectiveQuery() {
  const filter = select("ops-objective-filter")?.value || "current";
  if (filter === "done") return "done,dismissed";
  if (filter === "all") return "open,active,blocked,done,dismissed";
  return "open,active,blocked";
}

export function renderOpsObjectives() {
  const objectives = opsState.objectives || [];
  element("ops-objective-count").textContent = String(objectives.length);
  element("ops-objective-statusline").textContent = objectives.length
    ? "Status changes are saved immediately. EDIT exposes every stored planning field."
    : "No objectives match this view.";

  render(
    element("ops-objective-list"),
    html`${objectives.map((objective) => {
      const facts = [opsActivityName(objective.category)];
      if (objective.estimated_seconds) {
        facts.push(formatOpsDuration(objective.estimated_seconds));
      }
      if (objective.system) {
        facts.push(
          objective.system +
            (objective.station || objective.body
              ? ` · ${objective.station || objective.body}`
              : ""),
        );
      }
      if (objective.deadline) facts.push(`due ${opsEpochLabel(objective.deadline)}`);
      if (objective.reward) facts.push(fmtCr(objective.reward));
      const statusClass = String(objective.status || "")
        .toLowerCase()
        .replace(/[^a-z-]/g, "");
      const options = OBJECTIVE_STATUSES.map(
        (value) =>
          html`<option value="${value}" ${objective.status === value ? "selected" : ""}>
            ${value.toUpperCase()}
          </option>`,
      );
      return html`<article class="ops-record ${statusClass}" data-objective-id="${objective.id}">
        <div>
          <div class="ops-record-title">${objective.title}</div>
          <div class="ops-record-meta">
            <span>PRIORITY ${Number(objective.priority || 0)}</span>
            ${facts.map((fact) => html`<span>${fact}</span>`)}
          </div>
        </div>
        <div class="ops-record-controls">
          <select
            data-objective-status="${objective.id}"
            aria-label="Status for ${objective.title}"
          >
            ${options}
          </select>
          <button class="hb hb-utility" type="button" data-objective-edit="${objective.id}">
            EDIT
          </button>
          <button
            class="hb hb-utility hb-danger"
            type="button"
            data-objective-delete="${objective.id}"
          >
            DELETE
          </button>
        </div>
      </article>`;
    })}`,
  );
}

export async function loadOpsObjectives() {
  try {
    const data = await getOpsApi().listObjectives({ statuses: objectiveQuery().split(",") });
    opsState.objectives = data.objectives;
    renderOpsObjectives();
  } catch (error) {
    if (!isStaleOpsError(error)) renderOpsError("ops-objective-statusline", error);
  }
}

export function resetOpsObjectiveForm() {
  form("ops-objective-form").reset();
  input("ops-objective-id").value = "";
  input("ops-objective-priority").value = "50";
  select("ops-objective-status").value = "open";
  button("ops-objective-save").textContent = "ADD OBJECTIVE";
  button("ops-objective-cancel").classList.add("hidden");
}

/**
 * @param {string} objectiveId
 */
export function editOpsObjective(objectiveId) {
  const objective = opsState.objectives.find((item) => item.id === objectiveId);
  if (!objective) return;
  input("ops-objective-id").value = objective.id;
  input("ops-objective-title").value = objective.title || "";
  select("ops-objective-category").value = objective.category || "other";
  input("ops-objective-priority").value = String(objective.priority ?? 50);
  input("ops-objective-minutes").value = objective.estimated_seconds
    ? String(Math.max(1, Math.round(objective.estimated_seconds / 60)))
    : "";
  input("ops-objective-system").value = objective.system || "";
  input("ops-objective-station").value = objective.station || "";
  input("ops-objective-body").value = objective.body || "";
  input("ops-objective-deadline").value = opsDateInput(objective.deadline);
  select("ops-objective-status").value = objective.status || "open";
  button("ops-objective-save").textContent = "SAVE CHANGES";
  button("ops-objective-cancel").classList.remove("hidden");
  input("ops-objective-title").focus();
}

/**
 * @param {Event} event
 */
export async function saveOpsObjective(event) {
  event.preventDefault();
  const objectiveId = input("ops-objective-id").value;
  const minutes = Number(input("ops-objective-minutes").value);
  const deadlineValue = input("ops-objective-deadline").value;
  /** @type {ObjectiveRequest} */
  const payload = {
    title: input("ops-objective-title").value.trim(),
    category: select("ops-objective-category").value,
    priority: Number(input("ops-objective-priority").value),
    estimated_seconds: minutes > 0 ? Math.round(minutes * 60) : null,
    system: input("ops-objective-system").value.trim() || null,
    station: input("ops-objective-station").value.trim() || null,
    body: input("ops-objective-body").value.trim() || null,
    deadline: deadlineValue ? new Date(deadlineValue).toISOString() : null,
    status: select("ops-objective-status").value,
  };
  const submit = button("ops-objective-save");
  submit.disabled = true;
  try {
    const saved = objectiveId
      ? await getOpsApi().updateObjective(objectiveId, payload)
      : await getOpsApi().createObjective(payload);
    const createdId = saved.objective.id;
    if (!objectiveId && createdId && payload.status !== "open") {
      await getOpsApi().updateObjective(createdId, { status: payload.status });
    }
    resetOpsObjectiveForm();
    await loadOpsObjectives();
    element("ops-plan-status").textContent =
      "Objectives changed. Build a new session plan when ready.";
  } catch (error) {
    if (!isStaleOpsError(error)) renderOpsError("ops-objective-statusline", error);
  } finally {
    submit.disabled = false;
  }
}

/**
 * @param {string} objectiveId
 * @param {ObjectiveRequest} changes
 */
export async function patchOpsObjective(objectiveId, changes) {
  try {
    await getOpsApi().updateObjective(objectiveId, changes);
    await loadOpsObjectives();
  } catch (error) {
    if (isStaleOpsError(error)) return;
    renderOpsError("ops-objective-statusline", error);
    await loadOpsObjectives();
  }
}

/**
 * @param {string} objectiveId
 */
export async function deleteOpsObjective(objectiveId) {
  const objective = opsState.objectives.find((item) => item.id === objectiveId);
  if (!confirmOpsAction(`Delete objective “${objective?.title || objectiveId}”?`)) return;
  try {
    await getOpsApi().dismissObjective(objectiveId);
    if (input("ops-objective-id").value === objectiveId) resetOpsObjectiveForm();
    await loadOpsObjectives();
  } catch (error) {
    if (!isStaleOpsError(error)) renderOpsError("ops-objective-statusline", error);
  }
}

/** @returns {() => void} */
export function initObjectives() {
  const disposers = [
    listen(form("ops-objective-form"), "submit", (event) => {
      void saveOpsObjective(event);
    }),
    listen(button("ops-objective-cancel"), "click", () => resetOpsObjectiveForm()),
    listen(select("ops-objective-filter"), "change", () => {
      void loadOpsObjectives();
    }),
    listen(element("ops-objective-list"), "change", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const status = target.closest("[data-objective-status]");
      if (!(status instanceof HTMLSelectElement)) return;
      const objectiveId = status.dataset.objectiveStatus;
      if (objectiveId) void patchOpsObjective(objectiveId, { status: status.value });
    }),
    listen(element("ops-objective-list"), "click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const edit = target.closest("[data-objective-edit]");
      const remove = target.closest("[data-objective-delete]");
      if (edit instanceof HTMLElement && edit.dataset.objectiveEdit) {
        editOpsObjective(edit.dataset.objectiveEdit);
      }
      if (remove instanceof HTMLElement && remove.dataset.objectiveDelete) {
        void deleteOpsObjective(remove.dataset.objectiveDelete);
      }
    }),
  ];
  return () => disposers.forEach((dispose) => dispose());
}
