/** @import {MiningResult} from "../api/contracts/market.js" */

import { byId, requireById } from "../core/dom.js";
import { fmtNum } from "../core/fmt.js";
import { clear, html, render } from "../core/html.js";
import { appStore } from "../core/store.js";
import { isStaleCommanderResponse } from "../api/errors.js";
import { marketApi } from "../api/market.js";
import {
  bumpSort,
  confidenceAgeLabel,
  confidenceBadge,
  sortedRows,
  updateSortIndicators,
} from "./commodities.js";
import { copySystemButton, plotButton } from "../shell/status.js";

/** @type {MiningResult[]|null} */
export let mnResults = null;

/** @type {{key: string, dir: number}|null} */
export let mnSort = null;

let miningSearchRequestId = 0;

/** @type {WeakMap<HTMLButtonElement, object>} */
let hotspotRequestTokens = new WeakMap();
/** @type {Set<HTMLButtonElement>} */
let activeHotspotButtons = new Set();

/** @type {Record<string, {value: (row: MiningResult) => string|number, firstDir: number}>} */
export const MN_SORT_COLUMNS = {
  mineral: { value: (r) => (r.name || "").toLowerCase(), firstDir: 1 },
  method: { value: (r) => (r.method || "").toLowerCase(), firstDir: 1 },
  sell: { value: (r) => r.sell_price || 0, firstDir: -1 },
  station: { value: (r) => (r.station || "").toLowerCase(), firstDir: 1 },
  jump: { value: (r) => (r.distance != null ? Number(r.distance) : Infinity), firstDir: 1 },
  demand: { value: (r) => r.demand || 0, firstDir: -1 },
};

export function renderMiningRows() {
  const table = /** @type {HTMLTableElement} */ (requireById("mining-table"));
  const tbody = /** @type {HTMLTableSectionElement} */ (table.querySelector("tbody"));
  if (!mnResults) return;
  updateSortIndicators(table, mnSort);
  clear(tbody);
  for (const r of sortedRows(mnResults, MN_SORT_COLUMNS, mnSort)) {
    const tr = document.createElement("tr");
    tr.className = "mining-result-row";
    const methodClass = String(r.method || "")
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "");
    render(
      tr,
      html`<td><b>${r.name}</b></td>
        <td><span class="mine-method mine-${methodClass}">${r.method}</span></td>
        <td class="num orange">${fmtNum(r.sell_price)}</td>
        <td>
          ${r.station}${r.large_pad ? "" : html` <span class="sub">no L pad</span>`}
          <div class="sub mining-confidence">
            ${r.system} · ${confidenceAgeLabel(r.confidence?.age_s)}
          </div>
        </td>
        <td class="num">${r.distance} ly</td>
        <td class="num">${fmtNum(r.demand)}</td>`,
    );
    const badge = confidenceBadge(r.confidence);
    if (badge) tr.querySelector(".mining-confidence")?.append(" ", badge);
    const td = document.createElement("td");
    const hs = document.createElement("button");
    hs.className = "hb hb-utility";
    hs.type = "button";
    hs.textContent = "◇ hotspots";
    hs.title = "Find the nearest ring hotspots for " + r.name;
    hs.addEventListener("click", () => showHotspots(r.name, hs, tr));
    td.appendChild(hs);
    td.appendChild(copySystemButton(r.system));
    td.appendChild(plotButton(r.system));
    tr.appendChild(td);
    tbody.appendChild(tr);
  }
}

/** @param {string} key */
export function sortMiningTable(key) {
  if (!MN_SORT_COLUMNS[key] || !mnResults) return;
  mnSort = bumpSort(mnSort, key, MN_SORT_COLUMNS);
  renderMiningRows();
}

/** @param {SubmitEvent|{preventDefault(): void}} ev */
export async function searchMining(ev) {
  ev.preventDefault();
  const identity = appStore.identity();
  const status = /** @type {HTMLElement} */ (requireById("mining-status"));
  const table = /** @type {HTMLTableElement} */ (requireById("mining-table"));
  const go = /** @type {HTMLButtonElement} */ (requireById("mn-go"));
  const near = /** @type {HTMLInputElement} */ (requireById("mn-near")).value.trim();
  if (!identity.commanderId) {
    status.classList.add("error");
    status.textContent = "Waiting for the commander profile...";
    return;
  }
  const requestId = ++miningSearchRequestId;
  go.disabled = true;
  status.classList.remove("error");
  status.textContent = "Checking live prices…";
  try {
    const params = {
      radius: /** @type {HTMLInputElement} */ (requireById("mn-radius")).value || "50",
      min_price: /** @type {HTMLInputElement} */ (requireById("mn-minprice")).value || "0",
      max_price_age_days: /** @type {HTMLInputElement} */ (requireById("mn-age")).value || "30",
      large_pad: /** @type {HTMLInputElement} */ (requireById("mn-largepad")).checked ? "1" : "0",
      system: near || undefined,
    };
    const data = await marketApi.findMiningLocations(params);
    if (requestId !== miningSearchRequestId || !appStore.isCurrent(identity)) return;
    mnResults = data.results || [];
    // Show the default best-price-first order in the headers.
    if (!mnSort) mnSort = { key: "sell", dir: -1 };
    renderMiningRows();
    table.classList.toggle("hidden", !mnResults.length);
    status.textContent = mnResults.length
      ? `${mnResults.length} mineable commodities with buyers within ${/** @type {HTMLInputElement} */ (requireById("mn-radius")).value} ly` +
        `${near ? " of " + near : ""}${mnSort ? "" : ", best price first"}. ◇ finds where to mine each.`
      : `Nothing mineable selling ${near ? "near " + near : "nearby"} with those filters — widen the radius or lower Min price. ` +
        "(Deep in the black? There are no buyers out here — see WHERE TO SELL YOUR DATA on the Explore tab.)";
  } catch (err) {
    if (
      requestId !== miningSearchRequestId ||
      isStaleCommanderResponse(err) ||
      !appStore.isCurrent(identity)
    )
      return;
    table.classList.add("hidden");
    status.classList.add("error");
    status.textContent = err instanceof Error ? err.message : String(err);
  } finally {
    if (requestId === miningSearchRequestId) go.disabled = false;
  }
}

/**
 * @param {string} mineral
 * @param {HTMLButtonElement} btn
 * @param {HTMLTableRowElement} afterRow
 */
export async function showHotspots(mineral, btn, afterRow) {
  const identity = appStore.identity();
  const next = afterRow.nextSibling;
  if (next instanceof Element && next.classList.contains("hotspot-row")) {
    next.remove(); // toggle off
    return;
  }
  if (!identity.commanderId) {
    const status = /** @type {HTMLElement|null} */ (byId("mining-status"));
    if (status) {
      status.classList.add("error");
      status.textContent = "Waiting for the commander profile...";
    }
    return;
  }
  const requestToken = {};
  hotspotRequestTokens.set(btn, requestToken);
  activeHotspotButtons.add(btn);
  btn.disabled = true;
  const detail = document.createElement("tr");
  detail.className = "hotspot-row";
  const cell = document.createElement("td");
  cell.colSpan = 7;
  render(cell, html`<span class="dim">Finding nearest ${mineral} hotspots via Spansh…</span>`);
  detail.appendChild(cell);
  afterRow.after(detail);
  try {
    const data = await marketApi.findMiningHotspots(mineral);
    if (hotspotRequestTokens.get(btn) !== requestToken || !appStore.isCurrent(identity)) return;
    const hs = data.hotspots || [];
    if (!hs.length) {
      render(
        cell,
        html`<span class="dim">No community-mapped ${mineral} hotspots found nearby.</span>`,
      );
      return;
    }
    render(
      cell,
      html`<div class="hotspots-title">
        Nearest <b>${mineral}</b> hotspots
        <span class="dim">· community-mapped · higher count = richer overlap</span>
      </div>`,
    );
    const list = document.createElement("div");
    list.className = "hotspot-list";
    for (const h of hs.slice(0, 10)) {
      const item = document.createElement("div");
      item.className = "hotspot-item";
      render(
        item,
        html`<span class="hs-count">${h.count}×</span>
          <b>${h.ring}</b>
          <span class="dim"
            >${h.system} · ${h.distance}
            ly${
              h.dist_ls != null ? " · " + fmtNum(Math.round(h.dist_ls)) + " ls" : ""
            }${h.reserve ? " · " + h.reserve : ""}</span
          >`,
      );
      item.appendChild(plotButton(h.system));
      list.appendChild(item);
    }
    cell.appendChild(list);
  } catch (err) {
    if (
      hotspotRequestTokens.get(btn) !== requestToken ||
      isStaleCommanderResponse(err) ||
      !appStore.isCurrent(identity)
    )
      return;
    render(
      cell,
      html`<span style="color:var(--bad)"
        >${err instanceof Error ? err.message : String(err)}</span
      >`,
    );
  } finally {
    if (hotspotRequestTokens.get(btn) === requestToken) {
      hotspotRequestTokens.delete(btn);
      btn.disabled = false;
    }
    activeHotspotButtons.delete(btn);
  }
}

appStore.onProfileChange(() => {
  miningSearchRequestId += 1;
  mnResults = null;
  mnSort = null;
  for (const hotspotButton of activeHotspotButtons) hotspotButton.disabled = false;
  activeHotspotButtons = new Set();
  hotspotRequestTokens = new WeakMap();
  const go = /** @type {HTMLButtonElement|null} */ (byId("mn-go"));
  if (go) go.disabled = false;
  byId("mining-status")?.replaceChildren();
  const table = /** @type {HTMLTableElement|null} */ (byId("mining-table"));
  table
    ?.querySelector("tbody")
    ?.querySelectorAll(".mining-result-row, .hotspot-row")
    .forEach((row) => row.remove());
  table?.classList.add("hidden");
});
