/** @import {ApplicationState} from "../api/contracts/state.js" */
import { requireById } from "../core/dom.js";
import { html, render } from "../core/html.js";
import { appStore } from "../core/store.js";
import { settingsApi } from "../api/settings.js";
import { activateTab } from "../shell/tabs.js";
import { setPanelPage } from "../shell/panel.js";

/**
 * @typedef {{
 *   phase?: string,
 *   total_mb?: number,
 *   downloaded_mb?: number,
 *   systems_done?: number,
 *   stations_done?: number,
 *   error?: string,
 * }} DatabaseSeedStatus
 * @typedef {{
 *   ready?: boolean,
 *   seeding?: DatabaseSeedStatus,
 *   stations?: number,
 *   commodity_rows?: number,
 *   db_size_mb?: number,
 *   seeded_at?: string,
 *   eddn?: {connected?: boolean, markets_updated?: number},
 *   eddn_upload?: {enabled?: boolean, uploads?: number, last_error?: string},
 * }} MarketDatabaseStatus
 */

/** @param {string} id @returns {HTMLElement} */
const $ = (id) => /** @type {HTMLElement} */ (requireById(id));

export async function seedDb() {
  if (
    !confirm(
      "Download ~3.9 GB from spansh.co.uk and build the local market database?\n(Takes a while; the app stays usable meanwhile.)",
    )
  )
    return;
  try {
    await settingsApi.seedMarketDatabase();
  } catch (err) {
    $("db-status").textContent = err instanceof Error ? err.message : String(err);
  }
  nudgeDbStatus(); // single poll chain — never fork a second timer loop
}

/** @type {number|null} */
export let dbPollTimer = null;

export async function pollDbStatus() {
  // Don't hammer this: fast only while a build runs, relaxed while the
  // Database page is actually on screen, and barely at all otherwise —
  // the DB stats page is the only consumer.
  let seeding = false;
  try {
    const s = /** @type {MarketDatabaseStatus} */ (await settingsApi.getMarketDatabaseStatus());
    renderDbStatus(s);
    seeding = !!(
      s.seeding &&
      (s.seeding.phase === "downloading" || s.seeding.phase === "importing")
    );
  } catch (_error) {
    /* retry next tick */
  }
  const dbVisible = !document.hidden && $("db-status").offsetParent !== null;
  dbPollTimer = window.setTimeout(pollDbStatus, seeding ? 1500 : dbVisible ? 15000 : 120000);
}

export function nudgeDbStatus() {
  // Opening the Database page shouldn't wait out a 2-minute idle timer.
  if (dbPollTimer !== null) window.clearTimeout(dbPollTimer);
  void pollDbStatus();
}

/**
 * @param {MarketDatabaseStatus} status
 * @param {ApplicationState|null} [snapshot]
 */
export function renderSetupBanner(
  status,
  snapshot = /** @type {ApplicationState|null} */ (appStore.getSnapshot()),
) {
  const el = $("setup-banner");
  const seeding = status.seeding || {};
  const busy = seeding.phase === "downloading" || seeding.phase === "importing";
  const show =
    !status.ready &&
    !busy &&
    localStorage.getItem("dbSetupDismissed") !== "1" &&
    snapshot?.journal_dir_found !== false; // one problem at a time
  el.classList.toggle("hidden", !show);
  if (!show || el.dataset.built) return;
  el.dataset.built = "1";
  render(
    el,
    html`<span class="ub-badge">⚑ FIRST-TIME SETUP</span>
      <span class="ub-text"
        >Build the <b>local market database</b> to unlock trade loops, commodity search and mining
        <span class="dim"
          >(one-time ~3.9 GB download, ~15 min — EDDN keeps it fresh afterwards)</span
        ></span
      >`,
  );
  const go = document.createElement("button");
  go.className = "ub-btn";
  go.textContent = "TAKE ME THERE";
  go.addEventListener("click", () => {
    if (document.body.classList.contains("panel-mode")) setPanelPage("database");
    else activateTab("database");
    $("seed-btn").scrollIntoView({ behavior: "smooth", block: "center" });
  });
  const dismiss = document.createElement("button");
  dismiss.className = "ub-dismiss";
  dismiss.textContent = "✕";
  dismiss.title =
    "Hide this reminder on this device — you can build the database any time from the Settings page";
  dismiss.setAttribute("aria-label", "Dismiss setup reminder");
  dismiss.addEventListener("click", () => {
    localStorage.setItem("dbSetupDismissed", "1");
    el.classList.add("hidden");
  });
  el.appendChild(go);
  el.appendChild(dismiss);
}

/** @param {MarketDatabaseStatus} status */
export function renderDbStatus(status) {
  renderSetupBanner(status);
  const el = $("db-status");
  const bar = $("seed-bar");
  const fill = $("seed-fill");
  const btn = /** @type {HTMLButtonElement} */ ($("seed-btn"));
  const seeding = status.seeding || {};

  if (seeding.phase === "downloading") {
    btn.disabled = true;
    bar.classList.remove("hidden");
    const pct = seeding.total_mb
      ? Math.round((100 * (seeding.downloaded_mb || 0)) / seeding.total_mb)
      : 0;
    fill.style.width = pct + "%";
    el.textContent = `Downloading dump… ${seeding.downloaded_mb} / ${seeding.total_mb} MB (${pct}%)`;
    return;
  }
  if (seeding.phase === "importing") {
    btn.disabled = true;
    bar.classList.remove("hidden");
    fill.style.width = "100%";
    el.textContent = `Importing… ${(seeding.systems_done || 0).toLocaleString()} systems, ${(seeding.stations_done || 0).toLocaleString()} station markets so far`;
    return;
  }
  btn.disabled = false;
  bar.classList.add("hidden");
  if (seeding.phase === "error") {
    el.textContent = "Build failed: " + seeding.error;
    return;
  }
  if (!status.ready) {
    el.textContent =
      "Not built yet — routes fall back to the Spansh API. Click Build to enable the local engine.";
    return;
  }
  btn.textContent = "REBUILD DATABASE";
  const eddn = status.eddn || {};
  const eddnTxt = eddn.connected
    ? `EDDN live (${(eddn.markets_updated || 0).toLocaleString()} markets updated this session)`
    : "EDDN reconnecting…";
  const up = status.eddn_upload || {};
  const upTxt = up.enabled
    ? ` · contributing back: ${up.uploads || 0} market${up.uploads === 1 ? "" : "s"} uploaded${up.last_error ? " (last attempt failed)" : ""}`
    : " · uploading disabled";
  el.textContent =
    `${(status.stations || 0).toLocaleString()} stations · ${(status.commodity_rows || 0).toLocaleString()} price rows · ` +
    `${status.db_size_mb} MB · seeded ${status.seeded_at || "?"} · ${eddnTxt}${upTxt}`;
}
