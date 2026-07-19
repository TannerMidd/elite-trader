import { requireById, setStyleValue } from "../core/dom.js";
import { fmtNum } from "../core/fmt.js";
import { clear, html, render, renderToString } from "../core/html.js";
import { plotButton } from "../shell/status.js";
import { watchLoop } from "./route-alerts.js";
import { trackButton } from "./route-progress.js";
import { commodityTableTemplate } from "./route-result-templates.js";

/**
 * @typedef {{low?: number|null, observed?: number|null}} CreditRange
 * @typedef {{
 *   band?: string,
 *   score?: number|null,
 *   source?: string,
 *   age_s?: number|null,
 *   reasons?: string[],
 * }} RouteConfidence
 * @typedef {{
 *   name?: string,
 *   amount?: number|null,
 *   buy_price?: number|null,
 *   supply?: number|null,
 *   sell_price?: number|null,
 *   demand?: number|null,
 *   profit?: number|null,
 * }} RouteCommodity
 * @typedef {{
 *   station: string,
 *   system: string,
 *   from_player?: number|null,
 *   dist_ls?: number|null,
 * }} LoopStation
 * @typedef {{
 *   commodities: RouteCommodity[],
 *   confidence?: RouteConfidence|null,
 *   profit: number,
 * }} LoopLeg
 * @typedef {{
 *   a: LoopStation,
 *   b: LoopStation,
 *   outbound: LoopLeg,
 *   inbound: LoopLeg,
 *   confidence?: RouteConfidence|null,
 *   profit: number,
 *   profit_per_hour?: number|null,
 *   profit_range?: CreditRange|null,
 *   minutes_per_trip?: number|null,
 *   distance?: number|null,
 *   positioning_minutes?: number|null,
 *   first_trip_profit_per_hour?: number|null,
 * }} TradeLoop
 * @typedef {{
 *   from_station?: string,
 *   from_system?: string,
 *   to_station?: string,
 *   to_system?: string,
 *   distance?: number|null,
 *   to_dist_ls?: number|null,
 *   profit?: number|null,
 *   cumulative_profit?: number|null,
 *   profit_range?: CreditRange|null,
 *   confidence?: RouteConfidence|null,
 *   commodities?: RouteCommodity[],
 * }} TradeHop
 * @typedef {{
 *   loops?: TradeLoop[],
 *   hops?: TradeHop[],
 *   mode?: string,
 *   source?: string,
 * }} TradeRouteResponse
 */

/** @param {number|null|undefined} seconds */
export function confidenceAgeText(seconds) {
  if (seconds == null || !Number.isFinite(Number(seconds))) return "age unknown";
  const value = Math.max(0, Number(seconds));
  if (value < 3600) return `${Math.max(1, Math.round(value / 60))}m old`;
  if (value < 172800) return `${Math.round(value / 3600)}h old`;
  return `${Math.round(value / 86400)}d old`;
}

/** @param {RouteConfidence|null|undefined} confidence */
function confidenceTemplate(confidence) {
  if (!confidence) return null;
  const allowed = new Set(["high", "medium", "low"]);
  const band = allowed.has(String(confidence.band).toLowerCase())
    ? String(confidence.band).toLowerCase()
    : "low";
  const score = Number.isFinite(Number(confidence.score))
    ? Math.round(Number(confidence.score))
    : "?";
  const reasons =
    Array.isArray(confidence.reasons) && confidence.reasons.length
      ? confidence.reasons.join("; ")
      : "no material freshness or depth warning";
  const detail = `${confidence.source || "market observation"}; ${confidenceAgeText(confidence.age_s)}; ${reasons}`;
  return html`<span class="confidence confidence-${band}" title="${detail}"
    >${band.toUpperCase()} ${score}</span
  >`;
}

/** @param {RouteConfidence|null|undefined} confidence */
export function confidenceHtml(confidence) {
  const template = confidenceTemplate(confidence);
  return template ? renderToString(template) : "";
}

/** @param {CreditRange|null|undefined} range @param {string} [suffix] */
function creditRangeTemplate(range, suffix = "cr") {
  if (!range || range.low == null || range.observed == null) return null;
  return html`<span class="risk-range"
    >conservative ${fmtNum(range.low)}–${fmtNum(range.observed)} ${suffix}</span
  >`;
}

/** @param {CreditRange|null|undefined} range @param {string} [suffix] */
export function creditRangeHtml(range, suffix = "cr") {
  const template = creditRangeTemplate(range, suffix);
  return template ? renderToString(template) : "";
}

/** @returns {HTMLElement} */
function routeResults() {
  return /** @type {HTMLElement} */ (requireById("route-results"));
}

/** @param {TradeLoop[]} loops */
export function renderLoops(loops) {
  const results = routeResults();
  clear(results);
  loops.forEach((loop, index) => {
    const div = document.createElement("div");
    div.className = "hop";
    setStyleValue(div, "--i", index);
    const tons = [...loop.outbound.commodities, ...loop.inbound.commodities].reduce(
      (total, commodity) => total + (commodity.amount || 0),
      0,
    );
    render(
      div,
      html`<div class="route-line">
          <span class="dim">#${index + 1}</span>
          <b>${loop.a.station}</b><span class="dim">${loop.a.system}</span>
          <span class="arrow">⇄</span>
          <b>${loop.b.station}</b><span class="dim">${loop.b.system}</span>
          ${confidenceTemplate(loop.confidence)}
          <span class="profit">
            ${
              loop.profit_per_hour != null
                ? "+" + fmtNum(loop.profit_per_hour) + " cr/hr"
                : "+" + fmtNum(loop.profit) + " cr / trip"
            }
          </span>
        </div>
        <div class="commodities">
          observed +${fmtNum(loop.profit)} cr / round trip
          ${loop.profit_range ? html` · ${creditRangeTemplate(loop.profit_range)}` : false}
          ${loop.minutes_per_trip != null ? ` · ≈${loop.minutes_per_trip} min/trip` : ""} ·
          ${loop.distance} ly apart · start ${loop.a.from_player} ly from you
          ${
            loop.positioning_minutes != null
              ? ` · ${fmtNum(loop.positioning_minutes)} min positioning`
              : ""
          }
          ${
            loop.first_trip_profit_per_hour != null
              ? ` · first run ${fmtNum(loop.first_trip_profit_per_hour)} cr/hr incl. positioning`
              : ""
          }
          · ${loop.a.dist_ls != null ? fmtNum(loop.a.dist_ls) : "?"} /
          ${loop.b.dist_ls != null ? fmtNum(loop.b.dist_ls) : "?"} ls to pads
          ${tons ? ` · ${fmtNum(loop.profit / tons)} cr/t moved` : ""}
        </div>
        <div class="leg-label">
          OUTBOUND ${confidenceTemplate(loop.outbound.confidence)}
          <span class="profit-cell">+${fmtNum(loop.outbound.profit)}</span>
        </div>
        ${commodityTableTemplate(loop.outbound.commodities)}
        <div class="leg-label">
          RETURN ${confidenceTemplate(loop.inbound.confidence)}
          <span class="profit-cell">
            ${
              loop.inbound.commodities.length ? "+" + fmtNum(loop.inbound.profit) : "fly back empty"
            }
          </span>
        </div>
        ${commodityTableTemplate(loop.inbound.commodities)}`,
    );
    const line = div.querySelector(".route-line");
    if (!line) return;
    const btnA = plotButton(loop.a.system);
    const btnB = plotButton(loop.b.system);
    const watchBtn = document.createElement("button");
    watchBtn.className = "hb hb-utility";
    watchBtn.textContent = "WATCH";
    watchBtn.title = "Alert me when this loop's prices/stock degrade (live EDDN)";
    watchBtn.addEventListener("click", () => watchLoop(loop, watchBtn));
    line.insertBefore(btnA, line.querySelector(".profit"));
    line.insertBefore(btnB, line.querySelector(".profit"));
    line.insertBefore(watchBtn, line.querySelector(".profit"));
    results.appendChild(div);
  });
}

/** @param {TradeHop[]} hops */
export function renderRoutes(hops) {
  const results = routeResults();
  clear(results);
  if (!hops.length) return;

  let totalProfit = 0;
  let totalLow = 0;
  let totalDist = 0;
  let totalTons = 0;
  let firstOutlay = 0;
  hops.forEach((hop, index) => {
    totalProfit += hop.profit || 0;
    totalLow += hop.profit_range?.low ?? hop.profit ?? 0;
    totalDist += hop.distance || 0;
    for (const commodity of hop.commodities || []) {
      totalTons += commodity.amount || 0;
      if (index === 0) {
        firstOutlay += (commodity.amount || 0) * (commodity.buy_price || 0);
      }
    }
  });
  const summary = document.createElement("div");
  summary.className = "route-summary";
  render(
    summary,
    html`<span class="profit">+${fmtNum(totalProfit)} cr total</span>
      <span class="risk-range">conservative ${fmtNum(totalLow)}–${fmtNum(totalProfit)} cr</span>
      <span>${hops.length} hop${hops.length > 1 ? "s" : ""}</span>
      <span>${totalDist.toFixed(1)} ly</span>
      <span>${fmtNum(totalTons)} t moved</span>
      ${totalTons ? html`<span>${fmtNum(totalProfit / totalTons)} cr/t avg</span>` : false}
      ${firstOutlay ? html`<span>needs ~${fmtNum(firstOutlay)} cr up front</span>` : false}`,
  );
  if (hops.length > 1) {
    const firstHop = hops[0];
    summary.appendChild(
      trackButton("chain", "Trade chain", () => {
        if (!firstHop) return [];
        const waypoints = [];
        if (firstHop.from_system) {
          waypoints.push({ system: firstHop.from_system, note: firstHop.from_station });
        }
        for (const hop of hops) {
          if (hop.to_system) {
            waypoints.push({ system: hop.to_system, note: hop.to_station });
          }
        }
        return waypoints;
      }),
    );
  }
  results.appendChild(summary);

  hops.forEach((hop, index) => {
    const div = document.createElement("div");
    div.className = "hop";
    setStyleValue(div, "--i", index);
    const tons = (hop.commodities || []).reduce(
      (total, commodity) => total + (commodity.amount || 0),
      0,
    );
    const outlay = (hop.commodities || []).reduce(
      (total, commodity) => total + (commodity.amount || 0) * (commodity.buy_price || 0),
      0,
    );

    render(
      div,
      html`<div class="route-line">
          <b>${hop.from_station}</b><span class="dim">${hop.from_system}</span>
          <span class="arrow">➜</span>
          <b>${hop.to_station}</b><span class="dim">${hop.to_system}</span>
          ${confidenceTemplate(hop.confidence)}
          <span class="profit">+${fmtNum(hop.profit)} cr</span>
        </div>
        ${commodityTableTemplate(hop.commodities)}
        <div class="commodities">
          ${hop.distance != null ? `${Number(hop.distance).toFixed(1)} ly jump` : ""}
          ${hop.to_dist_ls != null ? ` · ${fmtNum(hop.to_dist_ls)} ls to station` : ""}
          ${tons ? ` · ${fmtNum((hop.profit || 0) / tons)} cr/t` : ""}
          ${outlay ? ` · costs ${fmtNum(outlay)} cr to load` : ""}
          ${hop.profit_range ? html` · ${creditRangeTemplate(hop.profit_range)}` : false}
          ${
            hop.cumulative_profit != null
              ? ` · total so far: ${fmtNum(hop.cumulative_profit)} cr`
              : ""
          }
        </div>`,
    );
    if (hop.to_system) {
      const line = div.querySelector(".route-line");
      if (line) line.insertBefore(plotButton(hop.to_system), line.querySelector(".profit"));
    }
    results.appendChild(div);
  });
}
