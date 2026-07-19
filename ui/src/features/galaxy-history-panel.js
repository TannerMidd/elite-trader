import { byId, requireById } from "../core/dom.js";
import { fmtDuration } from "../core/fmt.js";
import { clear, html, render } from "../core/html.js";
import GalaxyData from "../data/galaxy-data.js";

/** @typedef {NonNullable<ReturnType<typeof GalaxyData.observation>>} GalaxyObservation */
/**
 * @typedef {{
 *   entries: readonly GalaxyObservation[],
 *   current: GalaxyObservation|null,
 *   previous: GalaxyObservation|null,
 * }} GalaxyHistoryView
 */

/** @param {GalaxyHistoryView} history */
export function renderGalaxyHistory(history) {
  const summary = byId("galhistory-summary");
  const list = byId("galhistory-list");
  if (!summary || !list) return;
  const { current, previous } = history;
  requireById("galhistory-count").textContent = history.entries.length
    ? `${history.entries.length} observation${history.entries.length === 1 ? "" : "s"} here`
    : "";
  requireById("galhistory-empty").classList.toggle("hidden", !!previous);
  const signature = JSON.stringify(history.entries);
  if (list instanceof HTMLElement && list.dataset.sig === signature) return;
  if (list instanceof HTMLElement) list.dataset.sig = signature;
  clear(summary);
  clear(list);

  if (current && previous) {
    const elapsed = (Date.parse(current.observed_at) - Date.parse(previous.observed_at)) / 1000;
    const deltas = GalaxyData.factionDeltas(current, previous).filter(
      (item) => Math.abs(item.delta) >= 0.005,
    );
    const changes = deltas
      .slice(0, 5)
      .map(
        (item) =>
          html`<span class="history-delta ${item.delta >= 0 ? "good" : "warn"}"
            ><b>${item.name}</b> ${item.delta >= 0 ? "+" : ""}${item.delta.toFixed(1)} pp</span
          >`,
      );
    if (current.controlling_faction !== previous.controlling_faction) {
      changes.unshift(
        html`<span class="history-delta warn"
          >Control changed: <b>${previous.controlling_faction || "none"}</b> →
          <b>${current.controlling_faction || "none"}</b></span
        >`,
      );
    }
    if (
      current.powerplay &&
      previous.powerplay &&
      current.powerplay.state !== previous.powerplay.state
    ) {
      changes.unshift(
        html`<span class="history-delta"
          >Powerplay state: <b>${previous.powerplay.state || "none"}</b> →
          <b>${current.powerplay.state || "none"}</b></span
        >`,
      );
    }
    render(
      summary,
      html`<div class="history-summary-head">
          CHANGE SINCE PREVIOUS OBSERVATION
          <span class="dim">${elapsed >= 0 ? fmtDuration(elapsed) + " ago" : "earlier"}</span>
        </div>
        ${
          changes.length
            ? html`<div class="history-deltas">${changes}</div>`
            : html`<div class="dim">
                No material faction influence, control or Powerplay-state change observed.
              </div>`
        }`,
    );
  }

  for (const entry of history.entries.slice(-5).reverse()) {
    const when = new Date(entry.observed_at);
    const timestamp = Number.isNaN(when.getTime()) ? "time unknown" : when.toLocaleString();
    const detail = [
      entry.controlling_faction ? `${entry.controlling_faction} controls` : null,
      entry.powerplay?.state ? `PP ${entry.powerplay.state}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    const row = document.createElement("div");
    row.className = "galhistory-row";
    render(
      row,
      html`<b>${entry.system}</b
        ><span class="dim">${timestamp}</span>${detail ? html`<span>${detail}</span>` : null}`,
    );
    list.appendChild(row);
  }
}
