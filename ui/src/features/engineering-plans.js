/** @import {EngineeringWishlist, EngineeringWishlistItem} from "../api/contracts/engineering.js" */

import { requireById } from "../core/dom.js";
import { clear, html, render } from "../core/html.js";

/**
 * @typedef {{
 *   gradeText(item: EngineeringWishlistItem): string,
 *   edit(item: EngineeringWishlistItem): void,
 *   remove(id: string): void,
 * }} EngineeringPlanActions
 */

/**
 * @param {EngineeringWishlist} wishlist
 * @param {EngineeringPlanActions} actions
 */
export function renderEngineeringPlans(wishlist, actions) {
  const list = /** @type {HTMLElement} */ (requireById("engplan-list"));
  const materials = /** @type {HTMLElement} */ (requireById("engplan-materials"));
  const summary = /** @type {HTMLElement} */ (requireById("engplan-summary"));
  const items = wishlist.items || [];
  clear(list);
  clear(materials);
  if (!items.length) {
    clear(summary);
    render(
      list,
      html`<div class="dim empty ep-empty">
        Your wishlist is empty. Search the complete catalog above, choose the grade path and
        quantity, then add it here. A strong first ship upgrade is
        <b>Frame Shift Drive · Increased FSD Range</b>.
      </div>`,
    );
    return;
  }

  const readiness = wishlist.craftable
    ? "Everything is aboard"
    : wishlist.obtainable_with_suggested_trades
      ? "Material trades can close every listed gap"
      : `${wishlist.progress || 0}% directly collected`;
  render(
    summary,
    html`<div class="ep-summary-head">
        <div>
          <span class="ep-count">${items.length}</span> wishlist
          ${items.length === 1 ? "item" : "items"}
        </div>
        <div class="${wishlist.craftable ? "good" : "dim"}">${readiness}</div>
      </div>
      <div class="stack-bar"><div style="width:${wishlist.progress || 0}%"></div></div>`,
  );

  for (const item of items) {
    const card = document.createElement("div");
    card.className = "engplan ep-wish-item" + (item.craftable ? " done" : "");
    const engineers = item.engineer_access.length
      ? item.engineer_access
          .map(
            (engineer) => `${engineer.name}${engineer.max_grade ? ` G${engineer.max_grade}` : ""}`,
          )
          .join(", ")
      : "Synthesis / broker / merchant";
    const applications = item.applications || 0;
    const applicationText =
      item.kind === "ship-engineering"
        ? `${applications} deterministic application${applications === 1 ? "" : "s"}`
        : `${item.quantity} item${item.quantity === 1 ? "" : "s"}`;
    render(
      card,
      html`<div class="ep-wish-main">
          <div>
            <span class="chip ep-kind-chip">${item.kind_label}</span>
            <b>${item.blueprint}</b>
          </div>
          <div class="ep-wish-actions"></div>
        </div>
        <div class="ep-wish-facts">
          <span>${actions.gradeText(item)}</span><span>×${item.quantity}</span>
          <span>${applicationText}</span>
          <span class="${item.craftable ? "good" : "dim"}"
            >${item.craftable ? "Ready" : `${item.progress}% allocated`}</span
          >
        </div>
        <div class="dim ep-engineers">${engineers}</div>`,
    );
    const actionBar = card.querySelector(".ep-wish-actions");
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "hb hb-utility";
    edit.textContent = "EDIT";
    edit.addEventListener("click", () => actions.edit(item));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "hb hb-utility hb-danger ep-remove";
    remove.textContent = "REMOVE";
    remove.addEventListener("click", () => actions.remove(item.id));
    actionBar?.append(edit, remove);
    list.appendChild(card);
  }

  const materialRows = wishlist.materials || [];
  render(
    materials,
    html`<div class="ep-shopping-head">
      <div class="label">CONSOLIDATED SHOPPING LIST</div>
      <div class="dim">
        ${materialRows.length} distinct
        ${materialRows.length === 1 ? "requirement" : "requirements"} · inventory is reserved once
        across the whole wishlist
      </div>
    </div>`,
  );
  const rows = document.createElement("div");
  rows.className = "ep-material-rows";
  for (const material of materialRows) {
    const short = material.deficit > 0;
    const grade = material.grade ? `G${material.grade} ` : "";
    const trade = material.trade;
    const tradeTemplate = trade
      ? html`<div class="ep-trade">
          <b>VALID TRADE</b> ${trade.spend}× ${trade.from} covers
          ${
            trade.covers >= material.deficit
              ? "this shortfall"
              : `${trade.covers} of ${material.deficit}`
          }
        </div>`
      : false;
    const row = document.createElement("div");
    row.className = "ep-material-row" + (short ? " short" : " ready");
    render(
      row,
      html`<div class="ep-material-status ${short ? "warn" : "good"}">${short ? "○" : "✓"}</div>
        <div class="ep-material-body">
          <div class="ep-material-main">
            <b>${material.name}</b>
            <span class="chip">${grade}${material.kind}</span>
            <span class="ep-counts ${short ? "warn" : ""}"
              >${material.have} /
              ${material.need}${short ? ` · need ${material.deficit}` : ""}</span
            >
          </div>
          ${tradeTemplate}
          <details class="ep-source">
            <summary>WHERE TO FIND IT</summary>
            <div>${material.source || "No source note in the bundled catalog."}</div>
          </details>
        </div>`,
    );
    rows.appendChild(row);
  }
  materials.appendChild(rows);
}
