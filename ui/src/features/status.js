/** @import {ApplicationState} from "../api/contracts/state.js" */
import { colorSign, requireById, setText } from "../core/dom.js";
import {
  compactCredits,
  compactDuration,
  fmtUnknownNumber,
  signedCompactCredits,
} from "../core/fmt.js";
import { clear, html, render } from "../core/html.js";
import { appStore } from "../core/store.js";
import { plotButton } from "../shell/status.js";

/**
 * @typedef {{
 *   start_ts?: number|null,
 *   end_ts?: number|null,
 *   earned?: number|null,
 *   jumps?: number,
 *   ly?: number,
 *   collected?: number,
 * }} SessionView
 * @typedef {{
 *   expiry_ts?: number|null,
 *   kind?: string,
 *   name?: string,
 *   reward?: number,
 *   dest_system?: string,
 *   dest_station?: string,
 *   commodity_symbol?: string,
 *   commodity?: string,
 *   count?: number,
 *   to_deliver?: number,
 *   delivered?: number,
 *   faction?: string,
 * }} MissionView
 * @typedef {Record<string, number|null|undefined>} EarningsView
 */

/** @param {string} id @returns {HTMLElement} */
const $ = (id) => /** @type {HTMLElement} */ (requireById(id));
const fmtNum = fmtUnknownNumber;
const fmtDuration = compactDuration;

/** @param {SessionView|null|undefined} sess */
export function renderSession(sess) {
  sess = sess || {};
  const startTimestamp = sess.start_ts;
  const has = startTimestamp != null;
  // The clock stops at Shutdown (or crash detection) — a session isn't the
  // hours the app sat open, it's the hours the game ran.
  const until = sess.end_ts != null ? sess.end_ts : Date.now() / 1000;
  const dur = startTimestamp != null ? Math.max(0, until - startTimestamp) : null;
  const ended = has && sess.end_ts != null;
  const earned = has ? sess.earned : null;
  // Ignore cr/hr for the first couple of minutes so it doesn't read as ±millions.
  const crhr = dur != null && dur > 120 && earned != null ? earned / (dur / 3600) : null;

  const earnedTxt = signedCompactCredits(earned);
  const crhrTxt =
    crhr == null ? "—" : `${crhr >= 0 ? "+" : "−"}${compactCredits(Math.abs(crhr))} cr/hr`;
  const jumpsTxt = has ? String(sess.jumps || 0) : "—";
  const lyTxt = has ? fmtNum(sess.ly || 0) + " ly" : "—";
  const durTxt = dur != null ? fmtDuration(dur) + (ended ? " · ended" : "") : "";
  const collectedTxt = has && sess.collected ? `≈${compactCredits(sess.collected)} cr` : "—";

  // Flight-panel tiles
  setText("fp-sess-earned", earnedTxt);
  setText("fp-sess-crhr", crhrTxt);
  setText("fp-sess-jumps", jumpsTxt);
  setText("fp-sess-ly", lyTxt);
  setText("fp-sess-collected", collectedTxt);
  setText("fp-sess-since", durTxt ? "· " + durTxt.toUpperCase() : "");
  colorSign("fp-sess-earned", earned);

  // Analytics session card (live parts; trade profit/tons filled by loadAnalytics)
  setText("session-earned", earnedTxt);
  setText("session-crhr", crhrTxt);
  setText("session-duration", durTxt || "—");
  setText("session-jumps", jumpsTxt);
  setText("session-ly", lyTxt);
  setText("session-collected", collectedTxt);
  setText("session-since", durTxt ? "· " + durTxt : "");
  colorSign("session-earned", earned);
  colorSign("session-crhr", crhr);
}

/** @type {Record<string, readonly [string, string]>} */
export const EARNINGS_META = {
  trade: ["Trade", "#6fbf73"],
  mission: ["Missions", "#e0a54a"],
  exploration: ["Exploration", "#5aa9e6"],
  exobiology: ["Exobiology", "#3fb6a8"],
  bounty: ["Bounties & bonds", "#e05d5d"],
  other: ["Other", "#8a8f98"],
};

/** @param {EarningsView|null|undefined} e */
export function renderEarnings(e) {
  const box = $("earnings-breakdown");
  e = e || {};
  const cats = Object.keys(EARNINGS_META).filter((k) => (e[k] || 0) > 0);
  cats.sort((a, b) => (e[b] || 0) - (e[a] || 0));
  const total = cats.reduce((s, k) => s + (e[k] || 0), 0);
  $("earnings-empty").classList.toggle("hidden", cats.length > 0);
  clear(box);
  for (const k of cats) {
    const [label, color] = EARNINGS_META[k] || [k, "#8a8f98"];
    const val = e[k] || 0;
    const pct = total ? (val / total) * 100 : 0;
    const row = document.createElement("div");
    row.className = "earn-row";
    render(
      row,
      html`<div class="earn-head">
          <span class="earn-dot" style="background:${color}"></span>
          <span class="earn-label">${label}</span>
          <span class="earn-val">+${fmtNum(val)} cr</span>
          <span class="earn-pct">${pct.toFixed(0)}%</span>
        </div>
        <div class="earn-bar">
          <div style="width:${pct}%;background:${color}"></div>
        </div>`,
    );
    box.appendChild(row);
  }
}

/**
 * @param {MissionView[]|null|undefined} missions
 * @param {ApplicationState|null} [snapshot]
 */
export function renderMissions(
  missions,
  snapshot = /** @type {ApplicationState|null} */ (appStore.getSnapshot()),
) {
  missions = missions || [];
  const list = $("missions-list");
  $("missions-empty").classList.toggle("hidden", missions.length > 0);
  $("missions-count").textContent = missions.length ? missions.length + " active" : "";

  // Soonest deadline first — the card's own legend says "red = expiring
  // soon", so that's what belongs on top (journal order buries it).
  missions = [...missions].sort((a, b) => (a.expiry_ts || Infinity) - (b.expiry_ts || Infinity));

  /** @type {Record<string, number>} */
  const cargo = {};
  for (const c of snapshot?.cargo_inventory || [])
    cargo[(c.symbol || "").toLowerCase()] = c.count || 0;
  // Re-render on mission/cargo change, and once a minute so countdowns tick.
  const sig =
    JSON.stringify(missions) +
    "|" +
    JSON.stringify(snapshot?.cargo_inventory || []) +
    "|" +
    Math.floor(Date.now() / 60000);
  if (list.dataset.sig === sig) return;
  list.dataset.sig = sig;
  clear(list);

  for (const m of missions) {
    const rem = m.expiry_ts ? m.expiry_ts - Date.now() / 1000 : null;
    const expired = rem != null && rem <= 0;
    const soon = rem != null && rem > 0 && rem < 3600;
    // With depot tracking, what matters aboard is the REMAINING amount, not
    // the original mission total (148 already delivered ≠ still owed).
    const need = m.commodity_symbol
      ? m.to_deliver != null && m.delivered != null
        ? Math.max(0, m.to_deliver - m.delivered)
        : m.count || 0
      : 0;
    const commoditySymbol = m.commodity_symbol || "";
    const have = need ? cargo[commoditySymbol] || 0 : 0;
    const short = need && have < need;

    const div = document.createElement("div");
    div.className = "mission";
    const kindClass = String(m.kind || "").replace(/[^a-z0-9_-]/gi, "");
    render(
      div,
      html`<div class="mission-top">
          <span class="mission-kind kind-${kindClass}">${m.kind}</span>
          <b>${m.name}</b>
          <span class="mission-reward">+${fmtNum(m.reward)} cr</span>
        </div>
        <div class="mission-sub">
          ${
            m.dest_system
              ? html`<span class="arrow">→</span> ${m.dest_station || "?"}, <b>${m.dest_system}</b>`
              : false
          }
          ${
            m.commodity
              ? html`·
                  <span class="${short ? "warn" : ""}">
                    ${short ? "⚠ " : ""}${fmtNum(have)}/${fmtNum(need)} ${m.commodity}
                  </span>`
              : false
          }
          ${
            m.to_deliver
              ? html`·
                  <span class="${(m.delivered || 0) >= m.to_deliver ? "good" : ""}">
                    ${fmtNum(m.delivered || 0)}/${fmtNum(m.to_deliver)} delivered
                  </span>`
              : false
          }
          ${m.faction ? html`· ${m.faction}` : false}
          ${
            rem != null
              ? html`·
                  <span class="${expired ? "warn" : soon ? "soon" : "dim"}">
                    ${expired ? "EXPIRED" : "expires " + fmtDuration(rem)}
                  </span>`
              : false
          }
        </div>`,
    );
    if (m.dest_system) {
      // After the auto-margined reward, so the ◎ joins the right-edge cluster
      // instead of floating mid-row wherever the mission name ends.
      div.querySelector(".mission-top")?.appendChild(plotButton(m.dest_system));
    }
    list.appendChild(div);
  }
}
