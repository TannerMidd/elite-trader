import { fmtNum } from "../core/fmt.js";
import { html, renderToString } from "../core/html.js";

/**
 * @typedef {{
 *   name?: string,
 *   amount?: number|null,
 *   buy_price?: number|null,
 *   supply?: number|null,
 *   sell_price?: number|null,
 *   demand?: number|null,
 *   profit?: number|null,
 * }} RouteCommodity
 */

/**
 * @param {RouteCommodity[]|null|undefined} commodities
 * @returns {ReturnType<typeof html>|null}
 */
export function commodityTableTemplate(commodities) {
  const items = commodities || [];
  if (!items.length) return null;
  const rows = items.map((commodity) => {
    const unit =
      commodity.sell_price != null && commodity.buy_price != null
        ? commodity.sell_price - commodity.buy_price
        : null;
    const line =
      commodity.profit != null
        ? commodity.profit
        : unit != null && commodity.amount != null
          ? unit * commodity.amount
          : null;
    const lowStock =
      commodity.supply != null &&
      commodity.amount != null &&
      commodity.supply < commodity.amount * 2;
    return html`<tr>
      <td>${commodity.name}</td>
      <td class="num">${fmtNum(commodity.amount)}</td>
      <td class="num">${fmtNum(commodity.buy_price)}</td>
      <td class="num${lowStock ? " warn" : ""}">${fmtNum(commodity.supply)}</td>
      <td class="num">${fmtNum(commodity.sell_price)}</td>
      <td class="num">${fmtNum(commodity.demand)}</td>
      <td class="num">${unit != null ? "+" + fmtNum(unit) : "?"}</td>
      <td class="num profit-cell">+${fmtNum(line)}</td>
    </tr>`;
  });
  return html`<table class="hop-table">
    <thead>
      <tr>
        <th>Commodity</th>
        <th class="num">Units</th>
        <th class="num">Buy</th>
        <th class="num">Stock</th>
        <th class="num">Sell</th>
        <th class="num">Demand</th>
        <th class="num">cr/unit</th>
        <th class="num">Total</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>`;
}

/**
 * @param {RouteCommodity[]|null|undefined} commodities
 * @returns {string}
 */
export function commodityTableHtml(commodities) {
  const template = commodityTableTemplate(commodities);
  return template ? renderToString(template) : "";
}
