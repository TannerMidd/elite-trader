import { marketApi } from "../api/market.js";
import { copyText } from "../core/clipboard.js";
import { requireById } from "../core/dom.js";
import { clear, html, render, renderToString } from "../core/html.js";
import { appStore } from "../core/store.js";
import { plotButton } from "../shell/status.js";
import {
  normalizeJumpEntries,
  normalizeMarketSnapshot,
  normalizePriceSeries,
} from "./market-normalizers.js";
import { getExpandedMarketSymbol } from "./market-state.js";

/** @import {MarketItem, PricePoint, PriceSeriesMap} from "./market-normalizers.js" */

/** @type {{key: string, dir: number}} */
export const marketSort = { key: "sell", dir: -1 };

/** @type {{id: string|number|null, series: PriceSeriesMap}} */
export let marketHist = { id: null, series: {} };

/** @param {string} id @returns {HTMLElement} */
function element(id) {
  const node = requireById(id);
  if (!(node instanceof HTMLElement)) throw new TypeError(`#${id} must be an HTML element.`);
  return node;
}

/** @param {string} id @returns {HTMLInputElement} */
function input(id) {
  const node = requireById(id);
  if (!(node instanceof HTMLInputElement)) throw new TypeError(`#${id} must be an input.`);
  return node;
}

/** @param {string} id @returns {HTMLTableElement} */
function table(id) {
  const node = requireById(id);
  if (!(node instanceof HTMLTableElement)) throw new TypeError(`#${id} must be a table.`);
  return node;
}

/** @param {string|number|null|undefined} marketId */
export async function loadMarketHistory(marketId) {
  if (!marketId || marketHist.id === marketId) return;
  marketHist = { id: marketId, series: {} };
  try {
    const data = await marketApi.getPriceHistory(marketId);
    if (marketHist.id === marketId) {
      marketHist.series = normalizePriceSeries(data.history);
      renderMarket();
    }
  } catch {
    // Sparklines are best-effort.
  }
}

/** @param {readonly PricePoint[]|null|undefined} points */
function sparklineTemplate(points) {
  const sells = (points || []).map((point) => point[1]).filter((value) => value > 0);
  if (sells.length < 2) return "";
  const width = 64;
  const height = 16;
  const minimum = Math.min(...sells);
  const maximum = Math.max(...sells);
  const span = maximum - minimum || 1;
  const step = width / (sells.length - 1);
  const coordinates = sells
    .map(
      (value, index) =>
        `${(index * step).toFixed(1)},${(height - 2 - ((value - minimum) / span) * (height - 4)).toFixed(1)}`,
    )
    .join(" ");
  const first = sells.at(0);
  const last = sells.at(-1);
  if (first == null || last == null) return "";
  const up = last >= first;
  return html`<svg
    class="spark"
    width="${width}"
    height="${height}"
    viewBox="0 0 ${width} ${height}"
    role="img"
    aria-label="sell price trend"
  >
    <polyline
      points="${coordinates}"
      fill="none"
      stroke="${up ? "var(--good)" : "var(--bad)"}"
      stroke-width="1.5"
    />
  </svg>`;
}

/** @param {readonly PricePoint[]|null|undefined} points */
export function sparkline(points) {
  const template = sparklineTemplate(points);
  return template ? renderToString(template) : "";
}

/** @param {readonly PricePoint[]|null|undefined} points */
function histChartTemplate(points) {
  const width = 720;
  const height = 150;
  const padLeft = 8;
  const padRight = 8;
  const padTop = 16;
  const padBottom = 22;
  const visiblePoints = (points || []).filter((point) => point[1] > 0 || point[2] > 0);
  if (visiblePoints.length < 2) return "";
  const firstPoint = visiblePoints.at(0);
  const lastPoint = visiblePoints.at(-1);
  if (!firstPoint || !lastPoint) return "";
  const firstTime = firstPoint[0];
  const lastTime = lastPoint[0];
  const timeSpan = lastTime - firstTime || 1;
  const values = visiblePoints
    .flatMap((point) => [point[1], point[2]])
    .filter((value) => value > 0);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const valueSpan = maximum - minimum || 1;
  /** @param {number} timestamp */
  const x = (timestamp) =>
    padLeft + ((timestamp - firstTime) / timeSpan) * (width - padLeft - padRight);
  /** @param {number} value */
  const y = (value) => padTop + (1 - (value - minimum) / valueSpan) * (height - padTop - padBottom);
  /** @param {1|2} index @param {string} color @param {number} strokeWidth */
  const line = (index, color, strokeWidth) => {
    const linePoints = visiblePoints.filter((point) => point[index] > 0);
    if (linePoints.length < 2) return "";
    const coordinates = linePoints
      .map((point) => `${x(point[0]).toFixed(1)},${y(point[index]).toFixed(1)}`)
      .join(" ");
    return html`<polyline
      points="${coordinates}"
      fill="none"
      stroke="${color}"
      stroke-width="${strokeWidth}"
    />`;
  };
  /** @param {number} timestamp */
  const formatDate = (timestamp) => new Date(timestamp * 1000).toLocaleDateString();
  const last = lastPoint;
  return html`<svg
    class="histchart"
    viewBox="0 0 ${width} ${height}"
    role="img"
    aria-label="price history"
  >
    ${line(2, "var(--dim)", 1)} ${line(1, "var(--good)", 1.8)}
    <text x="${padLeft}" y="11" class="hc-label">${maximum.toLocaleString()} cr</text>
    <text x="${padLeft}" y="${height - padBottom + 12}" class="hc-label">
      ${minimum.toLocaleString()} cr
    </text>
    <text x="${padLeft}" y="${height - 4}" class="hc-label dim">${formatDate(firstTime)}</text>
    <text x="${width - padRight}" y="${height - 4}" class="hc-label dim" text-anchor="end">
      ${formatDate(lastTime)}
    </text>
    ${
      last[1] > 0
        ? html`<text x="${width - padRight}" y="11" class="hc-label good" text-anchor="end">
            sell ${last[1].toLocaleString()} cr
          </text>`
        : ""
    }
  </svg>`;
}

/** @param {readonly PricePoint[]|null|undefined} points */
export function histChart(points) {
  const template = histChartTemplate(points);
  return template ? renderToString(template) : "";
}

/** @param {MarketItem} item @param {string} key @returns {string|number} */
function marketSortValue(item, key) {
  switch (key) {
    case "name":
      return item.name || "";
    case "buy":
      return item.buy || 0;
    case "demand":
      return item.demand || 0;
    case "stock":
      return item.stock || 0;
    case "sell":
    default:
      return item.sell || 0;
  }
}

export function renderMarket() {
  const snapshot = appStore.getSnapshot();
  const market = normalizeMarketSnapshot(snapshot?.market);
  const title = element("market-title");
  const marketTable = table("market-table");
  const body = marketTable.tBodies.item(0);
  if (!body) throw new Error("#market-table must contain a tbody.");
  const empty = element("market-empty");

  if (!market?.items?.length) {
    title.textContent = "STATION MARKET";
    clear(body);
    empty.classList.remove("hidden");
    return;
  }
  loadMarketHistory(market.market_id);
  empty.classList.add("hidden");
  title.textContent = market.is_current_station
    ? `STATION MARKET — ${market.station || "?"}`
    : `LAST VISITED MARKET — ${market.station || "?"}`;

  const filter = input("market-filter").value.trim().toLowerCase();
  let items = market.items;
  if (filter) {
    items = items.filter(
      (item) =>
        (item.name || "").toLowerCase().includes(filter) ||
        (item.category || "").toLowerCase().includes(filter),
    );
  }
  const { key, dir } = marketSort;
  items = [...items].sort((left, right) => {
    const leftValue = marketSortValue(left, key);
    const rightValue = marketSortValue(right, key);
    const comparison =
      typeof leftValue === "string" && typeof rightValue === "string"
        ? leftValue.localeCompare(rightValue)
        : Number(leftValue) - Number(rightValue);
    return comparison * dir;
  });

  clear(body);
  const historyReady = marketHist.id === market.market_id;
  const expandedSymbol = getExpandedMarketSymbol();
  for (const item of items) {
    const series = historyReady && item.symbol ? marketHist.series[item.symbol] : undefined;
    const spark = series && sparklineTemplate(series);
    const row = document.createElement("tr");
    render(
      row,
      html`<td>
          ${item.name || "?"}
          <div class="sub">${item.category || ""}</div>
        </td>
        <td class="num">
          ${item.sell ? item.sell.toLocaleString() : "—"}${trendArrowTemplate(
            item.sell,
            item.prev_sell,
          )}
        </td>
        <td class="num">
          ${item.buy ? item.buy.toLocaleString() : "—"}${trendArrowTemplate(
            item.buy,
            item.prev_buy,
          )}
        </td>
        <td class="num">${item.demand ? item.demand.toLocaleString() : "—"}</td>
        <td class="num">${item.stock ? item.stock.toLocaleString() : "—"}</td>
        ${
          spark
            ? html`<td
                class="num sparkcell spark-click"
                data-sym="${item.symbol || ""}"
                title="Tap for the full price-history chart"
              >
                ${spark}
              </td>`
            : html`<td class="num sparkcell">
                <span
                  class="dim"
                  title="History builds as this station gets visits and EDDN reports"
                  >·</span
                >
              </td>`
        }`,
    );
    body.appendChild(row);
    if (expandedSymbol === item.symbol && series) {
      const historyRow = document.createElement("tr");
      historyRow.className = "hist-row";
      render(historyRow, html`<td colspan="6">${histChartTemplate(series)}</td>`);
      body.appendChild(historyRow);
    }
  }
}

/** @param {number|null|undefined} current @param {number|null|undefined} previous */
export function trendArrow(current, previous) {
  const template = trendArrowTemplate(current, previous);
  return template ? ` ${renderToString(template)}` : "";
}

/** @param {number|null|undefined} current @param {number|null|undefined} previous */
function trendArrowTemplate(current, previous) {
  if (previous == null || !current || current === previous) return "";
  const up = current > previous;
  const percent = previous ? Math.round((Math.abs(current - previous) / previous) * 100) : 0;
  const title = `was ${previous.toLocaleString()} (${up ? "+" : "−"}${percent}% since last report)`;
  return html`<span class="trend ${up ? "up" : "down"}" title="${title}">${up ? "▲" : "▼"}</span>`;
}

export function renderJumps() {
  const snapshot = appStore.getSnapshot();
  const jumps = normalizeJumpEntries(snapshot?.jump_history);
  const list = element("jumps");
  element("jumps-empty").classList.toggle("hidden", jumps.length > 0);
  const signature = JSON.stringify(jumps);
  if (list.dataset.sig === signature) return;
  list.dataset.sig = signature;
  clear(list);
  for (const jump of jumps) {
    if (!jump.system) continue;
    const row = document.createElement("li");
    const when = jump.timestamp
      ? new Date(jump.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "";
    render(
      row,
      html`<span class="sysname">${jump.system}</span>
        <span class="dist">${jump.dist != null ? jump.dist.toFixed(1) + " ly" : ""}</span>
        <span class="when">${when}</span>`,
    );
    const copyButton = document.createElement("button");
    copyButton.className = "hb hb-utility hb-icon hb-sm";
    copyButton.title = "Copy system name";
    copyButton.textContent = "⧉";
    copyButton.addEventListener("click", () => copyText(jump.system || "", copyButton));
    row.appendChild(copyButton);
    row.appendChild(plotButton(jump.system));
    list.appendChild(row);
  }
}

export function renderCargo() {
  const snapshot = appStore.getSnapshot();
  const inventory = snapshot?.cargo_inventory || [];
  const list = element("cargo-list");
  element("cargo-empty").classList.toggle("hidden", inventory.length > 0);
  const signature = JSON.stringify(inventory);
  if (list.dataset.sig === signature) return;
  list.dataset.sig = signature;
  clear(list);
  for (const cargo of inventory) {
    const row = document.createElement("li");
    render(
      row,
      html`<span>${cargo.name || "?"}</span><span class="count">${cargo.count || 0} t</span>`,
    );
    list.appendChild(row);
  }
}

/** @param {number|null|undefined} low @param {number|null|undefined} high */
export function fmtRange(low, high) {
  if (low == null) return "?";
  /** @param {number} value */
  const millions = (value) => (value / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  return low === high ? millions(low) : `${millions(low)}–${millions(high ?? low)}`;
}
