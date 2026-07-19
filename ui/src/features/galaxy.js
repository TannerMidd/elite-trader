import { appStore } from "../core/store.js";
import { byId, requireById } from "../core/dom.js";
import { fmtDuration, fmtNum } from "../core/fmt.js";
import { clear, html, render } from "../core/html.js";
import GalaxyData from "../data/galaxy-data.js";
import { plotButton } from "../shell/status.js";
import {
  clearLoadedGalaxyHistory,
  galaxyHistoryKey,
  getGalaxyHistory,
  getGalaxyHistoryCommander,
  loadGalaxyHistory,
  resetGalaxyHistoryWorkspace,
  saveGalaxyHistory,
  updateGalaxyHistory,
} from "./galaxy-history.js";
import { renderGalaxyHistory } from "./galaxy-history-panel.js";
import {
  powerplayRewardsHtml,
  powerplayStateNote,
  ppProgressPercent,
  renderPowerplay,
} from "./galaxy-powerplay.js";

export {
  galaxyHistoryKey,
  getGalaxyHistory,
  getGalaxyHistoryCommander,
  loadGalaxyHistory,
  powerplayRewardsHtml,
  powerplayStateNote,
  ppProgressPercent,
  resetGalaxyHistoryWorkspace,
  renderGalaxyHistory,
  renderPowerplay,
  saveGalaxyHistory,
  updateGalaxyHistory,
};

/** @typedef {Parameters<typeof GalaxyData.observation>[1]} GalaxyObservationInput */
/** @typedef {ReturnType<typeof updateGalaxyHistory>} GalaxyHistoryView */
/**
 * @typedef {{
 *   name?: string|null,
 *   influence?: number|string|null,
 *   government?: string|null,
 *   allegiance?: string|null,
 *   my_reputation?: number|null,
 *   active_states?: string[],
 *   pending_states?: string[],
 *   recovering_states?: string[],
 * }} GalaxyFaction
 * @typedef {{
 *   name?: string|null,
 *   won_days?: number|null,
 *   stake?: string|null,
 * }} ConflictFaction
 * @typedef {{
 *   war_type?: string|null,
 *   status?: string|null,
 *   faction1?: ConflictFaction|null,
 *   faction2?: ConflictFaction|null,
 * }} GalaxyConflict
 * @typedef {{
 *   cgid?: string|number|null,
 *   title?: string|null,
 *   expiry?: string|null,
 *   complete?: boolean,
 *   percentile?: number|null,
 *   market?: string|null,
 *   system?: string|null,
 *   contribution?: number|null,
 *   tier?: string|number|null,
 *   contributors?: number|null,
 * }} CommunityGoal
 * @typedef {CommunityGoal & {remaining_s: number|null}} TimedCommunityGoal
 * @typedef {{name?: string|null, rank?: number|null}} Squadron
 * @typedef {GalaxyObservationInput & {
 *   factions?: GalaxyFaction[],
 *   conflicts?: GalaxyConflict[],
 *   community_goals?: CommunityGoal[],
 *   squadron?: Squadron|null,
 *   powerplay?: {
 *     power?: string|null,
 *     rank?: number|null,
 *     merits?: number|null,
 *     session_merits?: number|null,
 *     time_pledged_s?: number|null,
 *   }|null,
 *   pp_system?: {
 *     controlling?: string|null,
 *     state?: string|null,
 *     control_progress?: number|string|null,
 *     reinforcement?: number|string|null,
 *     undermining?: number|string|null,
 *     powers?: string[],
 *     conflict_progress?: {power?: string|null, progress?: number|string|null}[],
 *   }|null,
 * }} GalaxySnapshot
 */

export function renderGalaxy() {
  const snapshot = appStore.getSnapshot();
  if (!snapshot) return;
  const galaxy = /** @type {GalaxySnapshot} */ (/** @type {unknown} */ (snapshot.galaxy || {}));
  const history = updateGalaxyHistory(galaxy, snapshot);
  renderPowerplay(galaxy, history, snapshot.system);
  renderFactions(galaxy, history);
  renderConflicts(galaxy);
  renderGalaxyHistory(history);
  renderCommunityGoals(galaxy);
  renderSquadron(galaxy);
}

/** @param {GalaxySnapshot} galaxy @param {GalaxyHistoryView} history */
export function renderFactions(galaxy, history) {
  const list = /** @type {HTMLElement|null} */ (byId("factions-list"));
  if (!list) return;
  const factions = galaxy.factions || [];
  requireById("factions-empty").classList.toggle("hidden", factions.length > 0);
  requireById("factions-count").textContent = factions.length
    ? `${factions.length} factions · ${galaxy.controlling_faction || "?"} controls`
    : "";
  const deltas = GalaxyData.factionDeltas(history.current, history.previous);
  const deltaByFaction = new Map(deltas.map((item) => [item.name, item.delta]));
  const signature = JSON.stringify([factions, galaxy.controlling_faction, deltas]);
  if (list.dataset.sig === signature) return;
  list.dataset.sig = signature;
  clear(list);

  for (const faction of factions) {
    const influence = Number(faction.influence) || 0;
    const controls = faction.name === galaxy.controlling_faction;
    const reputation = GalaxyData.reputationBand(faction.my_reputation);
    const delta = deltaByFaction.get(faction.name || null);
    /** @type {[string, string][]} */
    const states = [];
    for (const state of faction.active_states || []) states.push([state, ""]);
    for (const state of faction.pending_states || []) states.push([state, " (pending)"]);
    for (const state of faction.recovering_states || []) states.push([state, " (recovering)"]);
    const row = document.createElement("div");
    row.className = "fact-row";
    const reputationClass =
      reputation && ["bad", "dim", "good"].includes(reputation.className)
        ? reputation.className
        : "dim";
    const detail = [
      faction.government || null,
      faction.allegiance || null,
      states.length ? states.map(([state, tag]) => state + tag).join(", ") : null,
    ]
      .filter(Boolean)
      .join(" · ");
    render(
      row,
      html`<div class="fact-top">
          <b>${faction.name || "?"}</b>
          ${
            controls
              ? html`<span
                  class="chip"
                  title="Currently controls this system — owns the main station and sets security"
                  >CONTROLS</span
                >`
              : null
          }
          ${
            reputation
              ? html`<span
                  class="chip ${reputationClass}"
                  title="Your personal reputation with this faction"
                  >${reputation.label}</span
                >`
              : null
          }
          ${
            delta != null && Math.abs(delta) >= 0.005
              ? html`<span
                  class="fact-delta ${delta >= 0 ? "good" : "warn"}"
                  title="Influence change in percentage points since this browser's previous observation"
                  >${delta >= 0 ? "+" : ""}${delta.toFixed(1)} pp</span
                >`
              : null
          }
          <span class="fact-inf">${(influence * 100).toFixed(1)}%</span>
        </div>
        <div class="fact-bar">
          <div style="width:${Math.min(100, influence * 100).toFixed(1)}%"></div>
        </div>
        ${detail ? html`<div class="dim">${detail}</div>` : null}`,
    );
    list.appendChild(row);
  }
}

/** @param {GalaxySnapshot} galaxy */
export function renderConflicts(galaxy) {
  const card = /** @type {HTMLElement|null} */ (byId("conflicts-card"));
  if (!card) return;
  const conflicts = galaxy.conflicts || [];
  card.classList.toggle("hidden", !conflicts.length);
  if (!conflicts.length) return;
  requireById("conflicts-count").textContent =
    conflicts.length === 1 ? "1 conflict" : `${conflicts.length} conflicts`;
  const list = /** @type {HTMLElement} */ (requireById("conflicts-list"));
  const signature = JSON.stringify(conflicts);
  if (list.dataset.sig === signature) return;
  list.dataset.sig = signature;
  clear(list);

  for (const conflict of conflicts) {
    const faction1 = conflict.faction1 || {};
    const faction2 = conflict.faction2 || {};
    const isElection = String(conflict.war_type || "")
      .toLowerCase()
      .includes("election");
    const row = document.createElement("div");
    row.className = "conflict-row";
    /** @param {ConflictFaction} faction @param {ConflictFaction} other */
    const side = (faction, other) =>
      html`<b>${faction.name || "?"}</b>
        <span class="${(faction.won_days || 0) > (other.won_days || 0) ? "good" : "dim"}"
          >${faction.won_days || 0}</span
        >
        ${
          faction.stake
            ? html`<span class="dim conflict-stake" title="What this side loses if it's defeated"
                >stakes ${faction.stake}</span
              >`
            : null
        }`;
    render(
      row,
      html`<div class="conflict-head">
          <span class="chip">${String(conflict.war_type || "war").toUpperCase()}</span>
          <span class="dim"
            >${
              conflict.status === "active"
                ? "days won — first to 4 of 7 wins"
                : conflict.status || ""
            }</span
          >
        </div>
        <div class="conflict-sides">
          ${side(faction1, faction2)}<span class="dim conflict-vs">vs</span
          >${side(faction2, faction1)}
        </div>
        ${
          isElection
            ? html`<div class="dim conflict-guidance">
                <b>Election:</b> support a side with missions, trade, exploration data and other
                non-combat BGS actions. Elections have no conflict zones or combat bonds.
              </div>`
            : html`<div class="dim conflict-guidance">
                <b>${conflict.war_type || "War"}:</b> support a side in conflict zones, with combat
                bonds and with appropriate missions.
              </div>`
        }`,
    );
    list.appendChild(row);
  }
}

export function clearGalaxyHistory() {
  if (
    !window.confirm(
      "Clear the Galaxy observations saved in this browser and make the current system a new baseline?",
    )
  ) {
    return;
  }
  const snapshot = appStore.getSnapshot();
  if (getGalaxyHistoryCommander() == null) {
    loadGalaxyHistory(snapshot?.commander_id, snapshot?.commander);
  }
  clearLoadedGalaxyHistory();
  for (const id of ["galaxy-history-card", "galhistory-list", "powerplay-card"]) {
    const element = /** @type {HTMLElement|null} */ (byId(id));
    if (element) element.dataset.sig = "";
  }
  if (snapshot) renderGalaxy();
}

/** @param {GalaxySnapshot} galaxy */
export function renderCommunityGoals(galaxy) {
  const list = /** @type {HTMLElement|null} */ (byId("cg-list"));
  if (!list) return;
  const now = Date.now() / 1000;
  /** @type {TimedCommunityGoal[]} */
  const goals = (galaxy.community_goals || []).map((goal) => {
    const expiry = goal.expiry ? Date.parse(goal.expiry) / 1000 : null;
    return { ...goal, remaining_s: expiry != null ? expiry - now : null };
  });
  const live = goals.filter(
    (goal) => !goal.complete && (goal.remaining_s == null || goal.remaining_s > -86400),
  );
  requireById("cg-empty").classList.toggle("hidden", live.length > 0);
  requireById("cg-count").textContent = live.length
    ? live.length === 1
      ? "1 active"
      : `${live.length} active`
    : "";
  const signature = JSON.stringify(
    goals.map((goal) => [
      goal.cgid,
      goal.contribution,
      goal.tier,
      Math.floor((goal.remaining_s || 0) / 60),
    ]),
  );
  if (list.dataset.sig === signature) return;
  list.dataset.sig = signature;
  clear(list);

  for (const goal of live) {
    const row = document.createElement("div");
    row.className = "cg-row";
    const percentile =
      goal.percentile != null
        ? html`<span
            class="chip"
            title="Your contribution rank among every participating commander — lower band = bigger reward"
            >TOP ${goal.percentile}%</span
          >`
        : null;
    render(
      row,
      html`<div class="fact-top">
          <b>${goal.title || "Community goal"}</b>${percentile}
          ${
            goal.remaining_s != null
              ? html`<span class="dim cg-expiry"
                  >${
                    goal.remaining_s <= 0 ? "ended" : "ends in " + fmtDuration(goal.remaining_s)
                  }</span
                >`
              : null
          }
        </div>
        <div class="dim">
          ${goal.market || "?"} · ${goal.system || "?"}
          ${goal.contribution != null ? ` · your contribution ${fmtNum(goal.contribution)}` : null}
          ${goal.tier ? ` · tier ${String(goal.tier)} reached` : null}
          ${goal.contributors ? ` · ${fmtNum(goal.contributors)} commanders` : null}
        </div>`,
    );
    const heading = row.querySelector(".fact-top");
    if (goal.system && heading) heading.appendChild(plotButton(goal.system));
    list.appendChild(row);
  }
}

/** @param {GalaxySnapshot} galaxy */
export function renderSquadron(galaxy) {
  const card = /** @type {HTMLElement|null} */ (byId("squadron-card"));
  if (!card) return;
  const squadron = galaxy.squadron;
  card.classList.toggle("hidden", !squadron);
  if (!squadron) return;
  const info = /** @type {HTMLElement} */ (requireById("squadron-info"));
  const signature = JSON.stringify(squadron);
  if (info.dataset.sig === signature) return;
  info.dataset.sig = signature;
  render(
    info,
    html`<div class="pp-row">
      <b>${squadron.name || "?"}</b>
      ${squadron.rank != null ? html`<span class="chip">RANK ${squadron.rank}</span>` : null}
      <span class="dim">
        · squadron chat, goals and leaderboards live in the game's right-hand panel
      </span>
    </div>`,
  );
}
