import { byId, requireById, setText } from "../core/dom.js";
import { compactCredits, fmtUnknownNumber } from "../core/fmt.js";
import { clear, html, render } from "../core/html.js";
import { appStore } from "../core/store.js";
import { analyticsApi } from "../api/analytics.js";
import { accentColor } from "./settings.js";
import { renderEarnings } from "./status.js";

/**
 * @typedef {{ts: number, balance: number}} BalancePoint
 * @typedef {{date: string, profit: number, tons: number}} DailyPoint
 * @typedef {{
 *   commander_id?: string,
 *   today: {profit: number},
 *   week: {profit: number},
 *   period: {profit: number, tons: number},
 *   session?: {trade_profit?: number|null, tons_sold?: number|null},
 *   earnings?: Record<string, number>,
 *   balance?: BalancePoint[],
 *   daily?: DailyPoint[],
 *   top?: {name?: string, symbol?: string, tons?: number, profit?: number}[],
 * }} AnalyticsWorkspace
 */

export const SVG_NS = "http://www.w3.org/2000/svg";
const fmtNum = fmtUnknownNumber;

/**
 * @param {string} tag
 * @param {Record<string, string|number>} attrs
 * @param {SVGElement} [parent]
 * @returns {SVGElement}
 */
export function svgEl(tag, attrs, parent) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
  if (parent) parent.appendChild(el);
  return el;
}

/** @returns {HTMLElement} */
export function chartTip() {
  let tip = /** @type {HTMLElement|null} */ (document.getElementById("chart-tip"));
  if (!tip) {
    tip = document.createElement("div");
    tip.id = "chart-tip";
    tip.className = "chart-tip hidden";
    document.body.appendChild(tip);
  }
  return tip;
}

/**
 * @param {SVGSVGElement} svg
 * @param {string} msg
 */
export function chartEmptyNote(svg, msg) {
  const W = svg.clientWidth || 900,
    H = 120;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svgEl(
    "text",
    { x: W / 2, y: H / 2, "text-anchor": "middle", fill: "var(--dim)", "font-size": 13 },
    svg,
  ).textContent = msg;
}

/**
 * @param {SVGSVGElement} svg
 * @param {BalancePoint[]} points
 */
export function drawBalanceChart(svg, points) {
  clear(svg);
  if (points.length < 2) {
    chartEmptyNote(
      svg,
      "No balance history yet — it records as you play (and big journal imports fill it in).",
    );
    return;
  }
  const W = svg.clientWidth || 900,
    H = 220,
    padL = 56,
    padR = 70,
    padY = 18;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const ts = points.map((p) => p.ts),
    vs = points.map((p) => p.balance);
  const t0 = Math.min(...ts),
    t1 = Math.max(...ts);
  const v0 = Math.min(...vs),
    v1 = Math.max(...vs);
  const vpad = (v1 - v0) * 0.08 || v1 * 0.05 || 1;
  /** @param {number} value */
  const x = (value) => padL + ((value - t0) / Math.max(1, t1 - t0)) * (W - padL - padR);
  /** @param {number} value */
  const y = (value) =>
    H - padY - ((value - (v0 - vpad)) / (v1 + vpad - (v0 - vpad))) * (H - 2 * padY);

  for (let i = 0; i <= 2; i++) {
    // recessive grid: 3 lines
    const v = v0 + ((v1 - v0) * i) / 2;
    svgEl(
      "line",
      { x1: padL, x2: W - padR, y1: y(v), y2: y(v), stroke: "var(--border)", "stroke-width": 1 },
      svg,
    );
    svgEl(
      "text",
      { x: padL - 8, y: y(v) + 4, "text-anchor": "end", fill: "var(--dim)", "font-size": 11 },
      svg,
    ).textContent = compactCredits(v);
  }
  const d = points
    .map((p, i) => `${i ? "L" : "M"}${x(p.ts).toFixed(1)},${y(p.balance).toFixed(1)}`)
    .join("");
  svgEl(
    "path",
    { d, fill: "none", stroke: accentColor(), "stroke-width": 2, "stroke-linejoin": "round" },
    svg,
  );
  const last = /** @type {BalancePoint} */ (points[points.length - 1]);
  svgEl("circle", { cx: x(last.ts), cy: y(last.balance), r: 3.5, fill: accentColor() }, svg);
  svgEl(
    "text",
    {
      x: x(last.ts) + 8,
      y: y(last.balance) + 4,
      fill: "var(--text)",
      "font-size": 12,
      "font-weight": 600,
    },
    svg,
  ).textContent = compactCredits(last.balance);
  for (const t of [t0, t1]) {
    svgEl(
      "text",
      {
        x: x(t),
        y: H - 2,
        "text-anchor": t === t0 ? "start" : "end",
        fill: "var(--dim)",
        "font-size": 11,
      },
      svg,
    ).textContent = new Date(t * 1000).toLocaleDateString([], { month: "short", day: "numeric" });
  }
  // crosshair + tooltip
  const cross = svgEl(
    "line",
    { y1: padY, y2: H - padY, stroke: "var(--dim)", "stroke-width": 1, opacity: 0 },
    svg,
  );
  const tip = chartTip();
  svg.addEventListener("mousemove", (ev) => {
    const rect = svg.getBoundingClientRect();
    const mx = ((ev.clientX - rect.left) / rect.width) * W;
    let best = /** @type {BalancePoint} */ (points[0]),
      bd = Infinity;
    for (const p of points) {
      const dd = Math.abs(x(p.ts) - mx);
      if (dd < bd) {
        bd = dd;
        best = p;
      }
    }
    cross.setAttribute("x1", String(x(best.ts)));
    cross.setAttribute("x2", String(x(best.ts)));
    cross.setAttribute("opacity", "0.5");
    tip.classList.remove("hidden");
    tip.textContent = `${new Date(best.ts * 1000).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} · ${fmtNum(best.balance)} cr`;
    tip.style.left = ev.pageX + 14 + "px";
    tip.style.top = ev.pageY - 10 + "px";
  });
  svg.addEventListener("mouseleave", () => {
    cross.setAttribute("opacity", "0");
    tip.classList.add("hidden");
  });
}

/**
 * @param {SVGSVGElement} svg
 * @param {DailyPoint[]} days
 */
export function drawDailyChart(svg, days) {
  clear(svg);
  if (!days.length) {
    chartEmptyNote(
      svg,
      "No trading days recorded yet — sell some cargo and daily profit shows here.",
    );
    return;
  }
  const W = svg.clientWidth || 900,
    H = 200,
    padL = 56,
    padR = 16,
    padY = 16,
    gap = 2;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const vals = days.map((d) => d.profit);
  const vmax = Math.max(0, ...vals),
    vmin = Math.min(0, ...vals);
  const span = vmax - vmin || 1;
  /** @param {number} value */
  const y = (value) => padY + ((vmax - value) / span) * (H - 2 * padY - 14);
  const bw = Math.max(3, (W - padL - padR) / days.length - gap);
  svgEl(
    "line",
    { x1: padL, x2: W - padR, y1: y(0), y2: y(0), stroke: "var(--border)", "stroke-width": 1 },
    svg,
  );
  svgEl(
    "text",
    { x: padL - 8, y: y(vmax) + 4, "text-anchor": "end", fill: "var(--dim)", "font-size": 11 },
    svg,
  ).textContent = compactCredits(vmax);
  const tip = chartTip();
  const maxIdx = vals.indexOf(Math.max(...vals));
  days.forEach((d, i) => {
    const vx = padL + i * ((W - padL - padR) / days.length) + gap / 2;
    const h = Math.max(2, Math.abs(y(d.profit) - y(0)));
    const ry = d.profit >= 0 ? y(d.profit) : y(0);
    const bar = svgEl(
      "rect",
      {
        x: vx,
        y: ry,
        width: bw,
        height: h,
        rx: 3,
        fill: d.profit >= 0 ? "#6fbf73" : "#e05d5d",
      },
      svg,
    );
    if (i === maxIdx && d.profit > 0) {
      svgEl(
        "text",
        {
          x: vx + bw / 2,
          y: ry - 4,
          "text-anchor": "middle",
          fill: "var(--text)",
          "font-size": 11,
          "font-weight": 600,
        },
        svg,
      ).textContent = compactCredits(d.profit);
    }
    bar.addEventListener("mousemove", (ev) => {
      tip.classList.remove("hidden");
      tip.textContent = `${d.date} · ${fmtNum(d.profit)} cr · ${fmtNum(d.tons)} t sold`;
      tip.style.left = ev.pageX + 14 + "px";
      tip.style.top = ev.pageY - 10 + "px";
    });
    bar.addEventListener("mouseleave", () => tip.classList.add("hidden"));
    if (i === 0 || i === days.length - 1) {
      svgEl(
        "text",
        { x: vx + bw / 2, y: H - 2, "text-anchor": "middle", fill: "var(--dim)", "font-size": 10 },
        svg,
      ).textContent = d.date.slice(5);
    }
  });
}

export function clearAnalyticsWorkspace() {
  for (const id of [
    "an-today",
    "an-week",
    "an-period",
    "an-tons",
    "session-trade",
    "session-tons",
  ]) {
    const element = byId(id);
    if (element) element.textContent = "\u2014";
  }
  renderEarnings({});
  for (const id of ["an-balance", "an-daily"]) {
    byId(id)?.replaceChildren();
  }
  const topTable = byId("an-top");
  if (topTable) {
    topTable.classList.add("hidden");
    topTable.querySelector("tbody")?.replaceChildren();
  }
  byId("an-empty")?.classList.remove("hidden");
}

export async function loadAnalytics() {
  const identity = appStore.identity();
  if (!identity.commanderId) {
    clearAnalyticsWorkspace();
    return;
  }
  try {
    const daysInput = /** @type {HTMLInputElement} */ (requireById("an-days"));
    const a = /** @type {AnalyticsWorkspace} */ (
      await analyticsApi.getAnalytics(Number(daysInput.value))
    );
    if (!appStore.isCurrent(identity) || String(a.commander_id || "") !== identity.commanderId)
      return;
    requireById("an-today").textContent = `+${fmtNum(a.today.profit)} cr`;
    requireById("an-week").textContent = `+${fmtNum(a.week.profit)} cr`;
    requireById("an-period").textContent = `+${fmtNum(a.period.profit)} cr`;
    requireById("an-tons").textContent = `${fmtNum(a.period.tons)} t`;
    const sess = a.session || {};
    setText(
      "session-trade",
      sess.trade_profit != null ? "+" + fmtNum(sess.trade_profit) + " cr" : "—",
    );
    setText("session-tons", sess.tons_sold != null ? fmtNum(sess.tons_sold) + " t" : "—");
    renderEarnings(a.earnings || {});
    drawBalanceChart(/** @type {SVGSVGElement} */ (requireById("an-balance")), a.balance || []);
    drawDailyChart(/** @type {SVGSVGElement} */ (requireById("an-daily")), a.daily || []);
    const top = a.top || [];
    requireById("an-empty").classList.toggle("hidden", top.length > 0);
    requireById("an-top").classList.toggle("hidden", top.length === 0);
    const tbody = /** @type {HTMLTableSectionElement} */ (
      requireById("an-top").querySelector("tbody")
    );
    clear(tbody);
    for (const t of top) {
      const tr = document.createElement("tr");
      render(
        tr,
        html`<td>${t.name || t.symbol}</td>
          <td class="num">${fmtNum(t.tons)}</td>
          <td class="num profit-cell">${(t.profit || 0) < 0 ? "" : "+"}${fmtNum(t.profit)}</td>`,
      );
      tbody.appendChild(tr);
    }
  } catch (_error) {
    /* retry on next open */
  }
}
