/** @import {ApplicationState} from "../api/contracts/state.js" */
import { byId, requireById } from "../core/dom.js";
import { fmtUnknownNumber } from "../core/fmt.js";
import { clear, html, render } from "../core/html.js";
import { appStore } from "../core/store.js";
import { marketApi } from "../api/market.js";
import { confidenceAgeLabel, confidenceBadge, creditRangeBadge } from "./commodities.js";
import { activateTab } from "../shell/tabs.js";
import { setPanelPage } from "../shell/panel.js";
import { plotButton } from "../shell/status.js";

/**
 * @typedef {{station?: string, system: string, buy_price?: number, supply?: number, distance?: number}} ColonisationSource
 * @typedef {{symbol: string, name?: string, remaining: number, payment: number}} DepotResource
 * @typedef {{
 *   complete?: boolean,
 *   failed?: boolean,
 *   updated?: unknown,
 *   progress?: number,
 *   resources: DepotResource[],
 *   station?: string,
 *   system?: string,
 *   market_id: string|number,
 * }} ColonisationDepot
 * @typedef {{age_s?: number|null}} MarketConfidence
 * @typedef {{
 *   name?: string,
 *   units?: number,
 *   sell_price?: number,
 *   partial?: boolean,
 * }} CargoBuyerItem
 * @typedef {{
 *   station?: string,
 *   system: string,
 *   total?: number,
 *   distance?: number,
 *   dist_ls?: number|null,
 *   large_pad?: boolean,
 *   items?: CargoBuyerItem[],
 *   confidence?: MarketConfidence,
 *   payout_range?: unknown,
 * }} CargoBuyer
 */

/** @param {string} id @returns {HTMLElement} */
const $ = (id) => /** @type {HTMLElement} */ (requireById(id));
const fmtNum = fmtUnknownNumber;

/** @type {Record<string, Record<string, ColonisationSource[]>>} */
export const coloSources = {};

/**
 * @param {string|number} marketId
 * @param {{commanderId: string|null, generation: number}} [identity]
 */
export function colonisationSourceCacheKey(marketId, identity = appStore.identity()) {
  return `${identity.commanderId || "pending"}:${identity.generation}:${marketId}`;
}

/** Clear commander-derived search results during a profile transition. */
export function resetColonisationWorkspace() {
  for (const key of Object.keys(coloSources)) delete coloSources[key];
  const list = /** @type {HTMLElement|null} */ (byId("colonisation-list"));
  if (list) {
    list.replaceChildren();
    list.dataset.sig = "";
  }
  byId("colonisation-empty")?.classList.remove("hidden");
  byId("cargo-sell-results")?.replaceChildren();
  const cargoStatus = byId("cargo-sell-status");
  if (cargoStatus) {
    cargoStatus.textContent = "";
    cargoStatus.classList.remove("error");
  }
}

/**
 * @param {Element} cell
 * @param {ColonisationSource[]} sources
 */
export function fillSourceCell(cell, sources) {
  clear(cell);
  if (!(sources || []).length) {
    render(cell, html`<span class="dim">none within 50 ly</span>`);
    return;
  }
  for (const s of sources) {
    const row = document.createElement("div");
    row.className = "colo-src";
    render(
      row,
      html`<b>${s.station}</b>
        <span class="sub"
          >${s.system} · ${fmtNum(s.buy_price)} cr · ${fmtNum(s.supply)} supply · ${s.distance}
          ly</span
        >`,
    );
    row.appendChild(plotButton(s.system));
    cell.appendChild(row);
  }
}

/** @param {ApplicationState|null} [snapshot] */
export function renderColonisation(
  snapshot = /** @type {ApplicationState|null} */ (appStore.getSnapshot()),
) {
  if (!snapshot) return;
  const list = $("colonisation-list");
  const identity = appStore.identity();
  const depots = /** @type {ColonisationDepot[]} */ (snapshot.colonisation || []).filter(
    (depot) => !depot.complete && !depot.failed,
  );
  $("colonisation-empty").classList.toggle("hidden", depots.length > 0);
  // The depot event re-fires every few seconds while docked with only its
  // timestamp moving — leave it out of the signature so the card doesn't
  // rebuild (flashing, and eating fetched sources) unless something real
  // changed: progress, deliveries, a new project.
  const sig = JSON.stringify([
    identity.commanderId,
    identity.generation,
    depots.map(({ updated: _updated, ...rest }) => rest),
  ]);
  if (list.dataset.sig === sig) return;
  list.dataset.sig = sig;
  clear(list);
  for (const d of depots) {
    const div = document.createElement("div");
    div.className = "hop";
    const pct = Math.round((d.progress || 0) * 100);
    const remaining = d.resources.filter((r) => r.remaining > 0);
    const rows = remaining.slice(0, 12).map(
      (resource) =>
        html`<tr>
          <td>${resource.name}</td>
          <td class="num">${fmtNum(resource.remaining)}</td>
          <td class="num">${fmtNum(resource.payment)}</td>
          <td class="num profit-cell">+${fmtNum(resource.remaining * resource.payment)}</td>
          <td class="src" data-symbol="${resource.symbol}"></td>
        </tr>`,
    );
    render(
      div,
      html`<div class="route-line">
          <b>${d.station || "Construction site"}</b>
          <span class="dim">${d.system || ""}</span>
          <span class="profit">${pct}% complete</span>
        </div>
        <div class="seedbar">
          <div style="height:100%;width:${pct}%;background:var(--orange)"></div>
        </div>
        ${
          remaining.length
            ? html`<table class="hop-table">
                <thead>
                  <tr>
                    <th>Still needed</th>
                    <th class="num">Units</th>
                    <th class="num">Pays/unit</th>
                    <th class="num">Total payout</th>
                    <th>Nearest source</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows}
                </tbody>
              </table>`
            : html`<div class="commodities">All resources delivered.</div>`
        }`,
    );
    if (remaining.length) {
      const cacheKey = colonisationSourceCacheKey(d.market_id, identity);
      const btn = document.createElement("button");
      btn.className = "hb hb-utility";
      btn.textContent = "FIND SOURCES";
      btn.title = "Cheapest nearby stations selling what's still needed";
      btn.addEventListener("click", async () => {
        const requestIdentity = identity;
        if (!requestIdentity.commanderId || !appStore.isCurrent(requestIdentity)) return;
        btn.disabled = true;
        btn.textContent = "SEARCHING…";
        try {
          const data =
            /** @type {{commodities?: {symbol: string, sources?: ColonisationSource[]}[]}} */ (
              await marketApi.findColonisationSources(d.market_id, 50)
            );
          if (!appStore.isCurrent(requestIdentity)) return;
          const requestCacheKey = colonisationSourceCacheKey(d.market_id, requestIdentity);
          const cache = (coloSources[requestCacheKey] =
            /** @type {Record<string, ColonisationSource[]>} */ ({}));
          if (!div.isConnected) return;
          for (const c of data.commodities || []) {
            const cell = div.querySelector(`.src[data-symbol="${CSS.escape(c.symbol)}"]`);
            if (!cell) continue;
            const sources = c.sources || [];
            cache[c.symbol] = sources;
            fillSourceCell(cell, sources);
          }
          btn.textContent = "REFRESH";
          btn.disabled = false;
        } catch (_error) {
          if (!appStore.isCurrent(requestIdentity) || !div.isConnected) return;
          btn.textContent = "FIND SOURCES";
          btn.disabled = false;
        }
      });
      const routeLine = /** @type {HTMLElement} */ (div.querySelector(".route-line"));
      routeLine.insertBefore(btn, div.querySelector(".profit"));
      // Survive rebuilds (progress ticks, deliveries): re-fill previously
      // fetched sources instead of losing them.
      const cached = coloSources[cacheKey];
      if (cached) {
        let hits = 0;
        for (const [sym, sources] of Object.entries(cached)) {
          const cell = div.querySelector(`.src[data-symbol="${CSS.escape(sym)}"]`);
          if (cell) {
            fillSourceCell(cell, sources);
            hits++;
          }
        }
        if (hits) btn.textContent = "REFRESH";
      }
    }
    list.appendChild(div);
  }
}

/**
 * @param {CargoBuyer[]} results
 * @param {boolean} [recovery]
 */
export function renderCargoBuyers(results, recovery = false) {
  const out = $("cargo-sell-results");
  clear(out);
  results.slice(0, 5).forEach((r, idx) => {
    const div = document.createElement("div");
    div.className = "hop";
    div.style.setProperty("--i", String(idx));
    const items = (r.items || [])
      .map(
        (item) =>
          `${item.name} ×${fmtNum(item.units)} @ ${fmtNum(item.sell_price)}${item.partial ? " (demand-capped)" : ""}`,
      )
      .join(" · ");
    render(
      div,
      html`<div class="route-line">
          <b>${r.station}</b><span class="dim">${r.system}</span>
          <span class="cargo-confidence"></span>
          <span class="profit">+${fmtNum(r.total)} cr observed</span>
        </div>
        <div class="commodities">
          ${r.distance} ly ·
          ${r.dist_ls != null ? fmtNum(r.dist_ls) + " ls" : "?"}${
            r.large_pad ? "" : " · no L pad"
          }${r.payout_range ? html` · <span class="cargo-payout-range"></span>` : ""}
          · ${confidenceAgeLabel(r.confidence?.age_s)} · ${items}
        </div>`,
    );
    const confidence = confidenceBadge(r.confidence);
    if (confidence) div.querySelector(".cargo-confidence")?.appendChild(confidence);
    const payout = creditRangeBadge(r.payout_range, "cr payout");
    if (payout) div.querySelector(".cargo-payout-range")?.appendChild(payout);
    const line = /** @type {HTMLElement} */ (div.querySelector(".route-line"));
    if (recovery && idx === 0) {
      const mark = document.createElement("span");
      mark.className = "recovery-mark";
      mark.textContent = "RECOMMENDED DIVERSION";
      line.insertBefore(mark, line.querySelector(".profit"));
    }
    line.insertBefore(plotButton(r.system), line.querySelector(".profit"));
    out.appendChild(div);
  });
}

export async function findCargoSell() {
  const status = $("cargo-sell-status");
  const out = $("cargo-sell-results");
  const identity = appStore.identity();
  if (!identity.commanderId) {
    status.classList.add("error");
    status.textContent = "Waiting for a commander profile...";
    clear(out);
    return;
  }
  status.classList.remove("error");
  status.textContent = "Finding the best buyers for your hold…";
  clear(out);
  try {
    const data = /** @type {{results?: CargoBuyer[]}} */ (
      await marketApi.findCargoBuyers({ radius: 50 })
    );
    if (!appStore.isCurrent(identity)) return;
    const results = data.results || [];
    status.textContent = results.length
      ? `Top ${results.length} buyers for your cargo within 50 ly:`
      : "Nobody nearby is buying what you're carrying — try after the next EDDN update or widen the net.";
    renderCargoBuyers(results);
  } catch (err) {
    if (!appStore.isCurrent(identity)) return;
    status.classList.add("error");
    status.textContent = err instanceof Error ? err.message : String(err);
  }
}

/**
 * @param {string|number} failedMarketId
 * @param {HTMLButtonElement} button
 */
export async function recoverCargo(failedMarketId, button) {
  const status = $("cargo-sell-status");
  const identity = appStore.identity();
  if (!identity.commanderId) {
    status.classList.add("error");
    status.textContent = "Waiting for a commander profile...";
    return;
  }
  const original = button.textContent;
  button.disabled = true;
  button.textContent = "REPLANNING…";
  try {
    const data = /** @type {{recommended?: CargoBuyer|null, alternatives?: CargoBuyer[]}} */ (
      await marketApi.recoverCargo({
        failed_market_id: failedMarketId,
        radius: 100,
        max_age_days: 7,
        limit: 5,
      })
    );
    if (!appStore.isCurrent(identity)) return;
    const results = [data.recommended, ...(data.alternatives || [])].filter(
      /** @returns {value is CargoBuyer} */ (value) => Boolean(value),
    );
    if (document.body.classList.contains("panel-mode")) setPanelPage("local");
    else activateTab("local");
    status.classList.toggle("error", !results.length);
    status.textContent = results.length
      ? "Diversion calculated from the cargo currently aboard. The failed market is excluded; payouts remain observations, not guarantees."
      : "No viable replacement buyer was found within 100 ly using market reports from the last 7 days.";
    renderCargoBuyers(results, true);
    $("cargo-sell-results").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    if (!appStore.isCurrent(identity)) return;
    status.classList.add("error");
    status.textContent = error instanceof Error ? error.message : String(error);
    if (document.body.classList.contains("panel-mode")) setPanelPage("local");
    else activateTab("local");
  } finally {
    if (appStore.isCurrent(identity) && button.isConnected) {
      button.disabled = false;
      button.textContent = original;
    }
  }
}
