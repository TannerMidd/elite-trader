/** @import {StationSearchResult} from "../api/contracts/market.js" */

import { byId, requireById } from "../core/dom.js";
import { fmtNum } from "../core/fmt.js";
import { clear, html, render } from "../core/html.js";
import { appStore } from "../core/store.js";
import { isStaleCommanderResponse } from "../api/errors.js";
import { marketApi } from "../api/market.js";
import { bumpSort, sortedRows, updateSortIndicators } from "./commodities.js";
import { copySystemButton, plotButton } from "../shell/status.js";

/** @type {StationSearchResult[]|null} */
export let osResults = null;

/** @type {{key: string, dir: number}|null} */
export let osSort = null;

let stationSearchRequestId = 0;

/** @type {Record<string, {value: (row: StationSearchResult) => string|number, firstDir: number}>} */
export const OS_SORT_COLUMNS = {
  station: { value: (r) => (r.station || "").toLowerCase(), firstDir: 1 },
  system: { value: (r) => (r.system || "").toLowerCase(), firstDir: 1 },
  jump: { value: (r) => (r.distance != null ? Number(r.distance) : Infinity), firstDir: 1 },
  dist_ls: { value: (r) => (r.dist_ls != null ? Number(r.dist_ls) : Infinity), firstDir: 1 },
  pad: { value: (r) => (r.large_pad ? 0 : 1), firstDir: 1 },
};

export function renderStationRows() {
  const table = /** @type {HTMLTableElement} */ (requireById("os-table"));
  const tbody = /** @type {HTMLTableSectionElement} */ (table.querySelector("tbody"));
  if (!osResults) return;
  updateSortIndicators(table, osSort);
  clear(tbody);
  for (const r of sortedRows(osResults, OS_SORT_COLUMNS, osSort)) {
    const tr = document.createElement("tr");
    render(
      tr,
      html`<td>
          ${r.station}
          <div class="sub">${r.type || ""}</div>
        </td>
        <td>${r.system}</td>
        <td class="num">${r.distance} ly</td>
        <td class="num">${r.dist_ls != null ? fmtNum(Math.round(r.dist_ls)) + " ls" : "?"}</td>
        <td>${r.large_pad ? "L" : "M/S"}</td>`,
    );
    const td = document.createElement("td");
    td.appendChild(copySystemButton(r.system));
    td.appendChild(plotButton(r.system));
    tr.appendChild(td);
    tbody.appendChild(tr);
  }
}

/** @param {string} key */
export function sortStationTable(key) {
  if (!OS_SORT_COLUMNS[key] || !osResults) return;
  osSort = bumpSort(osSort, key, OS_SORT_COLUMNS);
  renderStationRows();
}

/** @param {SubmitEvent|{preventDefault(): void}} ev */
export async function searchStations(ev) {
  ev.preventDefault();
  const identity = appStore.identity();
  const status = /** @type {HTMLElement} */ (requireById("os-status"));
  const table = /** @type {HTMLTableElement} */ (requireById("os-table"));
  const go = /** @type {HTMLButtonElement} */ (requireById("os-go"));
  const near = /** @type {HTMLInputElement} */ (requireById("os-near")).value.trim();
  if (!identity.commanderId) {
    status.classList.add("error");
    status.textContent = "Waiting for the commander profile...";
    return;
  }
  const requestId = ++stationSearchRequestId;
  go.disabled = true;
  status.classList.remove("error");
  status.textContent = "Searching…";
  try {
    const data = await marketApi.searchStations({
      q: /** @type {HTMLInputElement} */ (requireById("os-query")).value.trim(),
      type: /** @type {HTMLSelectElement} */ (requireById("os-type")).value,
      system: near || undefined,
    });
    if (requestId !== stationSearchRequestId || !appStore.isCurrent(identity)) return;
    osResults = data.results || [];
    // Show the default nearest-first order in the headers.
    if (!osSort) osSort = { key: "jump", dir: 1 };
    status.textContent = osResults.length
      ? `${osResults.length} station(s) with "${/** @type {HTMLInputElement} */ (requireById("os-query")).value.trim()}" nearest ${near || "you"}:`
      : "Nothing found — check the spelling (e.g. '6A Fuel Scoop', 'Python Mk II').";
    renderStationRows();
    table.classList.toggle("hidden", osResults.length === 0);
  } catch (err) {
    if (
      requestId !== stationSearchRequestId ||
      isStaleCommanderResponse(err) ||
      !appStore.isCurrent(identity)
    )
      return;
    status.classList.add("error");
    status.textContent = err instanceof Error ? err.message : String(err);
  } finally {
    if (requestId === stationSearchRequestId) go.disabled = false;
  }
}

appStore.onProfileChange(() => {
  stationSearchRequestId += 1;
  osResults = null;
  osSort = null;
  const go = /** @type {HTMLButtonElement|null} */ (byId("os-go"));
  if (go) go.disabled = false;
  for (const id of ["os-status"]) byId(id)?.replaceChildren();
  const table = /** @type {HTMLTableElement|null} */ (byId("os-table"));
  table?.querySelector("tbody")?.replaceChildren();
  table?.classList.add("hidden");
});
