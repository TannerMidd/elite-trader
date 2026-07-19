import { byId, requireById } from "../core/dom.js";
import { fmtNum } from "../core/fmt.js";
import { appStore } from "../core/store.js";
import { clear, html, render } from "../core/html.js";
import { isStaleCommanderResponse } from "../api/errors.js";
import { marketApi } from "../api/market.js";
import { systemApi } from "../api/system.js";

let systemStationsRequestId = 0;
/** @type {WeakMap<HTMLElement, object>} */
let stationMarketRequests = new WeakMap();

/**
 * @typedef {{
 *   station: string,
 *   type?: string|null,
 *   body?: string|null,
 *   dist_ls?: number|null,
 *   pads?: {
 *     l?: number,
 *     m?: number,
 *     s?: number,
 *     large?: number,
 *     medium?: number,
 *     small?: number,
 *   },
 *   economy?: string|null,
 *   faction?: string|null,
 *   services?: string[],
 *   market_id?: number|null,
 *   local_market?: boolean,
 * }} SystemStation
 * @typedef {{
 *   name?: string,
 *   category?: string,
 *   sell?: number,
 *   buy?: number,
 *   sell_price?: number,
 *   buy_price?: number,
 *   demand?: number,
 *   stock?: number,
 * }} StationMarketItem
 * @typedef {{items?: StationMarketItem[], updated_at?: number|null}} StationMarketResponse
 */

export function resetSystemStationsWorkspace() {
  systemStationsRequestId += 1;
  stationMarketRequests = new WeakMap();
  const input = /** @type {HTMLInputElement|null} */ (byId("ss-system"));
  const status = /** @type {HTMLElement|null} */ (byId("ss-status"));
  const list = /** @type {HTMLElement|null} */ (byId("ss-list"));
  const button = /** @type {HTMLButtonElement|null} */ (byId("ss-go"));
  if (input) input.value = "";
  if (status) {
    status.classList.remove("error");
    status.textContent = "";
  }
  if (list) clear(list);
  if (button) button.disabled = false;
}

appStore.onProfileChange(resetSystemStationsWorkspace);

/** @param {SubmitEvent|{preventDefault(): void}|null|undefined} [ev] */
export async function loadSystemStations(ev) {
  if (ev) ev.preventDefault();
  const status = /** @type {HTMLElement} */ (requireById("ss-status"));
  const list = /** @type {HTMLElement} */ (requireById("ss-list"));
  const go = /** @type {HTMLButtonElement} */ (requireById("ss-go"));
  const systemInput = /** @type {HTMLInputElement} */ (requireById("ss-system"));
  const snapshot = appStore.getSnapshot();
  const snapshotSystem =
    snapshot && typeof snapshot === "object" ? Reflect.get(snapshot, "system") : "";
  const sys = systemInput.value.trim() || String(snapshotSystem || "");
  const identity = appStore.identity();
  const requestId = ++systemStationsRequestId;
  go.disabled = true;
  status.classList.remove("error");
  status.textContent = "Fetching stations… (~2–5s)";
  clear(list);
  try {
    const data = await systemApi.getSystemStations(sys);
    if (requestId !== systemStationsRequestId || !appStore.isCurrent(identity)) return;
    const sts = data.stations || [];
    status.textContent = sts.length
      ? `${sts.length} station${sts.length === 1 ? "" : "s"} in ${data.system}`
      : data.note || "No stations known for this system.";
    for (const s of sts) list.appendChild(stationRow(s));
  } catch (err) {
    if (
      requestId !== systemStationsRequestId ||
      isStaleCommanderResponse(err) ||
      !appStore.isCurrent(identity)
    ) {
      return;
    }
    status.classList.add("error");
    status.textContent = err instanceof Error ? err.message : String(err);
  } finally {
    if (requestId === systemStationsRequestId && appStore.isCurrent(identity)) {
      go.disabled = false;
    }
  }
}

/** @param {SystemStation} s */
export function stationRow(s) {
  const div = document.createElement("div");
  div.className = "sst";
  const pads =
    s.pads && (s.pads.l || s.pads.m || s.pads.s)
      ? `pads L${s.pads.l}/M${s.pads.m}/S${s.pads.s}`
      : null;
  const facts = [
    s.type,
    s.body ? "on " + s.body : null,
    s.dist_ls != null ? fmtNum(Math.round(s.dist_ls)) + " ls" : null,
    pads,
    s.economy,
    s.faction,
  ].filter(Boolean);
  const services = s.services || [];
  render(
    div,
    html`<div class="sst-line">
        <b>${s.station}</b><span class="dim sst-facts">${facts.join(" · ")}</span>
      </div>
      ${
        services.length
          ? html`<div class="sst-services">
              ${services.map((service) => html`<span class="chip">${service}</span>`)}
            </div>`
          : false
      }
      <div class="sst-market hidden"></div>`,
  );
  const line = div.querySelector(".sst-line");
  if (s.local_market && s.market_id != null) {
    const marketId = s.market_id;
    const btn = document.createElement("button");
    btn.className = "hb hb-utility";
    btn.textContent = "▤ MARKET";
    btn.title = "This station's commodity market from your local database (EDDN-fresh)";
    btn.addEventListener("click", () => toggleStationMarket(div, marketId, btn));
    line?.appendChild(btn);
  }
  return div;
}

/**
 * @param {HTMLElement} div
 * @param {string|number} marketId
 * @param {HTMLButtonElement} btn
 */
export async function toggleStationMarket(div, marketId, btn) {
  const box = /** @type {HTMLElement} */ (div.querySelector(".sst-market"));
  if (!box.classList.contains("hidden")) {
    box.classList.add("hidden");
    return;
  }
  if (!box.dataset.loaded) {
    const identity = appStore.identity();
    const requestToken = {};
    stationMarketRequests.set(div, requestToken);
    btn.disabled = true;
    try {
      const data = /** @type {StationMarketResponse} */ (
        await marketApi.getStationMarket(marketId)
      );
      if (
        stationMarketRequests.get(div) !== requestToken ||
        !appStore.isCurrent(identity) ||
        !div.isConnected
      )
        return;
      const rows = (data.items || []).map(
        (item) =>
          html`<tr>
            <td>
              ${item.name}
              <div class="sub">${item.category}</div>
            </td>
            <td class="num">
              ${
                item.sell || item.sell_price
                  ? (item.sell || item.sell_price)?.toLocaleString()
                  : "—"
              }
            </td>
            <td class="num">
              ${item.buy || item.buy_price ? (item.buy || item.buy_price)?.toLocaleString() : "—"}
            </td>
            <td class="num">${item.demand ? item.demand.toLocaleString() : "—"}</td>
            <td class="num">${item.stock ? item.stock.toLocaleString() : "—"}</td>
          </tr>`,
      );
      render(
        box,
        html`<div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Commodity</th>
                  <th class="num">Sell</th>
                  <th class="num">Buy</th>
                  <th class="num">Demand</th>
                  <th class="num">Stock</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
            </table>
          </div>
          <div class="dim sst-updated">
            ${(data.items || []).length} commodities · prices as of
            ${data.updated_at ? new Date(data.updated_at * 1000).toLocaleString() : "?"}
          </div>`,
      );
      box.dataset.loaded = "1";
    } catch (err) {
      if (
        stationMarketRequests.get(div) !== requestToken ||
        !appStore.isCurrent(identity) ||
        !div.isConnected
      )
        return;
      render(box, html`<div class="dim">${err instanceof Error ? err.message : String(err)}</div>`);
    } finally {
      if (stationMarketRequests.get(div) === requestToken) {
        stationMarketRequests.delete(div);
        btn.disabled = false;
      }
    }
  }
  box.classList.remove("hidden");
}
