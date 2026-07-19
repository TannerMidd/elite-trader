/**
 * @import {
 *   CarrierRouteIssue,
 *   CarrierRouteLegSeed,
 *   CarrierWorkflowView,
 *   MutationRunner,
 * } from "./types.js"
 */
/** @import {CarrierRouteLegRequest, InventoryItem} from "../../api/contracts/specialists.js" */
import { specialistsApi } from "../../api/specialists.js";
import {
  fmtCr,
  html,
  render,
  setText,
  specialistElement,
  specialistError,
  specialistForm,
  specialistHumanName,
  specialistInput,
  specialistNumber,
  specialistTextArea,
} from "./core.js";

/** @param {CarrierRouteLegSeed} [leg] */
export function carrierAddRouteLeg(leg = {}) {
  const row = document.createElement("div");
  row.className = "sp-route-leg";
  render(
    row,
    html`<label
        >System<input
          class="sp-leg-system"
          type="text"
          maxlength="160"
          value="${leg.system || ""}"
          placeholder="Destination"
          required
      /></label>
      <label
        >Distance (ly)<input
          class="sp-leg-distance"
          type="number"
          min="0.01"
          step="0.01"
          value="${leg.distance_ly ?? ""}"
          placeholder="Exact leg"
          required
      /></label>
      <label
        >Tritium (t)<input
          class="sp-leg-tritium"
          type="number"
          min="0"
          step="0.1"
          value="${leg.tritium_t ?? ""}"
          placeholder="Optional"
      /></label>
      <button
        class="hb hb-utility hb-icon hb-sm sp-remove-leg"
        type="button"
        title="Remove this route leg"
        aria-label="Remove this route leg"
      >
        ×
      </button>`,
  );
  specialistElement("sp-carrier-legs").appendChild(row);
  row.querySelector(".sp-remove-leg")?.addEventListener("click", () => {
    row.remove();
    if (!specialistElement("sp-carrier-legs").children.length) carrierAddRouteLeg();
  });
}

/**
 * @param {string} value
 * @returns {InventoryItem[]}
 */
export function parseCarrierInventoryText(value) {
  /** @type {InventoryItem[]} */
  const rows = [];
  for (const [index, raw] of value.split(/\r?\n/).entries()) {
    if (!raw.trim()) continue;
    const fields = raw.split(/\s*[|,\t]\s*/);
    if (fields.length < 2 || !fields[0]?.trim()) {
      throw new Error(`Inventory line ${index + 1}: use Commodity | tonnes.`);
    }
    const count = Number(fields.at(-1));
    if (!Number.isFinite(count) || count < 0) {
      throw new Error(`Inventory line ${index + 1}: tonnes must be zero or greater.`);
    }
    const name = fields.slice(0, -1).join(" | ").trim();
    const symbol = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
    rows.push({ symbol, name, count: Math.floor(count) });
  }
  return rows;
}

/**
 * @param {Element} row
 * @param {string} selector
 */
function routeInput(row, selector) {
  const input = row.querySelector(selector);
  if (!(input instanceof HTMLInputElement)) {
    throw new TypeError(`Carrier route row is missing ${selector}.`);
  }
  return input;
}

/** @returns {CarrierRouteLegRequest[]} */
function carrierRouteLegs() {
  return [...document.querySelectorAll(".sp-route-leg")].map((row) => {
    const system = routeInput(row, ".sp-leg-system");
    const distance = routeInput(row, ".sp-leg-distance");
    const tritium = routeInput(row, ".sp-leg-tritium");
    return {
      system: system.value.trim(),
      distance_ly: Number(distance.value),
      ...(tritium.value === "" ? {} : { tritium_t: Number(tritium.value) }),
    };
  });
}

/** @param {string|CarrierRouteIssue} issue */
function carrierRouteIssueText(issue) {
  return typeof issue === "string" ? issue : `Leg ${issue.leg}: ${issue.reason}`;
}

/** @param {CarrierWorkflowView|null|undefined} carrier */
export function renderCarrierSpecialist(carrier) {
  const workflow = carrier || {};
  const observed = workflow.carrier_id != null;
  const location = workflow.location;
  specialistElement("sp-carrier-identity").textContent = observed
    ? `${workflow.name || "FLEET CARRIER"}${workflow.callsign ? ` · ${workflow.callsign}` : ""}`
    : "NO OWNER SNAPSHOT";
  specialistElement("sp-carrier-message").textContent = workflow.pending_decommission
    ? "Decommissioning is marked pending in the latest owner snapshot."
    : workflow.pending_jump?.system
      ? `Jump scheduled: ${workflow.pending_jump.system}${
          workflow.pending_jump.body ? ` · ${workflow.pending_jump.body}` : ""
        }.`
      : observed
        ? `${location?.system || "Location not observed"}${
            location?.body ? ` · ${location.body}` : ""
          } · ${workflow.docking_access || "docking access unknown"}`
        : "Open Carrier Management in game to supply an authoritative status snapshot.";

  const finance = workflow.finance || {};
  const upkeep = workflow.upkeep || {};
  const space = workflow.space || {};
  const orders = workflow.orders || {};
  setText("sp-carrier-balance", finance.balance_cr == null ? "—" : fmtCr(finance.balance_cr));
  setText("sp-carrier-reserve", finance.reserve_cr == null ? "—" : fmtCr(finance.reserve_cr));
  setText(
    "sp-carrier-runway",
    upkeep.reserve_weeks == null ? "—" : `${specialistNumber(upkeep.reserve_weeks)} wk`,
  );
  setText(
    "sp-carrier-tank",
    workflow.fuel_t == null ? "—" : `${specialistNumber(workflow.fuel_t)} t`,
  );
  setText(
    "sp-carrier-space",
    space.cargo_t == null
      ? "—"
      : `${specialistNumber(space.cargo_t)} / ${specialistNumber(space.capacity_t)} t`,
  );
  setText("sp-carrier-exposure", fmtCr(orders.buy_order_exposure_cr || 0));

  const configForm = specialistForm("sp-carrier-config-form");
  if (!configForm.dataset.seeded) {
    if (upkeep.weekly_cr != null) {
      specialistInput("sp-carrier-weekly").value = String(upkeep.weekly_cr);
    }
    if (upkeep.target_weeks != null) {
      specialistInput("sp-carrier-target-weeks").value = String(upkeep.target_weeks);
    }
    configForm.dataset.seeded = "1";
  }
  specialistElement("sp-carrier-upkeep-note").textContent =
    upkeep.weekly_cr == null
      ? "Weekly upkeep is not journaled. Enter the value shown in Carrier Management; Frameshift will not guess it."
      : `${fmtCr(upkeep.weekly_cr)} / week · source: ${upkeep.source || "commander input"}${
          (upkeep.target_shortfall_cr || 0) > 0
            ? ` · ${fmtCr(upkeep.target_shortfall_cr || 0)} short of the ${
                upkeep.target_weeks
              }-week target.`
            : ` · ${upkeep.target_weeks}-week target covered.`
        }`;

  const inventory = Object.entries(workflow.inventory || {}).map(([symbol, item]) => ({
    ...item,
    symbol: item.symbol || symbol,
  }));
  render(
    specialistElement("sp-carrier-inventory"),
    inventory.length
      ? html`${inventory.map(
          (item) =>
            html`<span
              >${item.name || specialistHumanName(item.symbol)}<b
                >${specialistNumber(item.count || 0)} t</b
              ></span
            >`,
        )}`
      : html`<span class="dim">No carrier inventory has been supplied.</span>`,
  );
  specialistElement("sp-carrier-inventory-source").textContent =
    `Source: ${workflow.inventory_source || "not supplied"}. ` +
    "CargoTransfer deltas are accepted only while docked at your own carrier.";
  const inventoryForm = specialistForm("sp-carrier-inventory-form");
  if (!inventoryForm.dataset.seeded) {
    specialistTextArea("sp-carrier-inventory-input").value = inventory
      .map((item) => `${item.name || specialistHumanName(item.symbol)} | ${item.count || 0}`)
      .join("\n");
    inventoryForm.dataset.seeded = "1";
  }

  const route = workflow.route || {};
  const legs = specialistElement("sp-carrier-legs");
  if (!legs.dataset.seeded) {
    legs.replaceChildren();
    if (route.legs?.length) route.legs.forEach(carrierAddRouteLeg);
    else carrierAddRouteLeg();
    if (route.reserve_t != null) {
      specialistInput("sp-carrier-route-reserve").value = String(route.reserve_t);
    }
    legs.dataset.seeded = "1";
  }
  const issueText = (route.issues || []).map(carrierRouteIssueText).join(" · ");
  const routeResult = specialistElement("sp-carrier-route-result");
  routeResult.classList.remove("good", "warn");
  if (!route.leg_count) {
    routeResult.textContent =
      "Add systems and exact leg distances; Frameshift checks observed range and tritium coverage.";
  } else {
    const fuel =
      route.tritium_required_t == null
        ? "tritium unknown"
        : `${specialistNumber(route.tritium_required_t)} t required`;
    const stock =
      route.available_t == null
        ? "available stock unknown"
        : `${specialistNumber(route.available_t)} t available`;
    const deficit =
      (route.deficit_t || 0) > 0 ? ` · ${specialistNumber(route.deficit_t)} t deficit` : "";
    routeResult.textContent =
      `${route.leg_count} legs · ${specialistNumber(
        route.total_distance_ly,
      )} ly · ${fuel} · ${stock}${deficit}` +
      ` · source: ${route.tritium_source || "unknown"}${issueText ? ` · ${issueText}` : ""}`;
    routeResult.classList.add(route.valid && !((route.deficit_t || 0) > 0) ? "good" : "warn");
  }

  const orderItems = orders.items || [];
  render(
    specialistElement("sp-carrier-orders"),
    html`${orderItems.map((order) => {
      const exposure =
        order.side === "buy" ? (order.quantity || 0) * (order.price_cr || 0) : order.quantity || 0;
      return html`<tr>
        <td>
          ${order.name || order.symbol}
          ${order.black_market ? html`<span class="chip">BLACK MARKET</span>` : ""}
        </td>
        <td>${order.side.toUpperCase()}</td>
        <td class="num">${specialistNumber(order.quantity || 0, " t")}</td>
        <td class="num">${fmtCr(order.price_cr || 0)}</td>
        <td class="num">
          ${order.side === "buy" ? fmtCr(exposure) : `${specialistNumber(exposure)} t stock`}
        </td>
      </tr>`;
    })}`,
  );
  specialistElement("sp-carrier-orders-empty").classList.toggle("hidden", orderItems.length > 0);
}

/** @param {Event} event */
function submitButton(event) {
  return event instanceof SubmitEvent && event.submitter instanceof HTMLButtonElement
    ? event.submitter
    : null;
}

/** @param {MutationRunner} runMutation */
export function initCarrierSpecialist(runMutation) {
  specialistForm("sp-carrier-config-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const weekly = Number(specialistInput("sp-carrier-weekly").value);
    const target = Number(specialistInput("sp-carrier-target-weeks").value);
    void runMutation({
      perform: () =>
        specialistsApi.configureCarrier({
          weekly_upkeep_cr: weekly,
          target_weeks: target,
        }),
      button: submitButton(event),
      successMessage: "Carrier upkeep input saved locally.",
    });
  });
  specialistForm("sp-carrier-inventory-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const items = parseCarrierInventoryText(
        specialistTextArea("sp-carrier-inventory-input").value,
      );
      await runMutation({
        perform: () => specialistsApi.setCarrierInventory(items, "commander inventory input"),
        button: submitButton(event),
        successMessage: "Carrier inventory input saved locally.",
      });
    } catch (error) {
      const status = specialistElement("sp-global-status");
      status.textContent = specialistError(error);
      status.classList.add("error");
    }
  });
  specialistElement("sp-carrier-add-leg").addEventListener("click", () => carrierAddRouteLeg());
  specialistForm("sp-carrier-route-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const perJump = specialistInput("sp-carrier-per-jump").value;
    void runMutation({
      perform: () =>
        specialistsApi.planCarrierRoute({
          legs: carrierRouteLegs(),
          tritium_per_jump_t: perJump === "" ? null : Number(perJump),
          reserve_t: Number(specialistInput("sp-carrier-route-reserve").value) || 0,
        }),
      button: submitButton(event),
      successMessage: "Carrier tritium route recalculated from explicit inputs.",
    });
  });

  if (!specialistElement("sp-carrier-legs").children.length) carrierAddRouteLeg();
}

export function resetCarrierSpecialist() {
  for (const id of ["sp-carrier-config-form", "sp-carrier-inventory-form", "sp-carrier-legs"]) {
    delete specialistElement(id).dataset.seeded;
  }
  specialistForm("sp-carrier-config-form").reset();
  specialistForm("sp-carrier-inventory-form").reset();
  specialistForm("sp-carrier-route-form").reset();
  specialistElement("sp-carrier-legs").replaceChildren();
  carrierAddRouteLeg();
}
