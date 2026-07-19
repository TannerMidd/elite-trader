import { byId, requireById } from "../core/dom.js";
import { fmtNum } from "../core/fmt.js";
import { html, render, renderToString } from "../core/html.js";
import { appStore } from "../core/store.js";
import GalaxyData from "../data/galaxy-data.js";

/** @typedef {NonNullable<ReturnType<typeof GalaxyData.observation>>} GalaxyObservation */
/**
 * @typedef {{
 *   power?: string|null,
 *   rank?: number|null,
 *   merits?: number|null,
 *   session_merits?: number|null,
 *   time_pledged_s?: number|null,
 * }} PowerplayPledge
 * @typedef {{
 *   power?: string|null,
 *   progress?: number|string|null,
 * }} PowerConflictProgress
 * @typedef {{
 *   controlling?: string|null,
 *   state?: string|null,
 *   control_progress?: number|string|null,
 *   reinforcement?: number|string|null,
 *   undermining?: number|string|null,
 *   powers?: string[],
 *   conflict_progress?: PowerConflictProgress[],
 * }} PowerplaySystem
 * @typedef {{
 *   powerplay?: PowerplayPledge|null,
 *   pp_system?: PowerplaySystem|null,
 * }} GalaxyPowerplaySnapshot
 * @typedef {{
 *   current: GalaxyObservation|null,
 *   previous: GalaxyObservation|null,
 * }} GalaxyHistoryComparison
 */

/** @param {unknown} value @returns {number|null} */
export function ppProgressPercent(value) {
  if (value == null || value === "") return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(0, Math.min(100, numeric <= 1 ? numeric * 100 : numeric));
}

/** @param {unknown} powerplayState */
export function powerplayStateNote(powerplayState) {
  /** @type {Record<string, string>} */
  const notes = {
    homesystem: "This is the Power's home system.",
    unoccupied: "No Power currently controls this system.",
    acquisition: "An uncontrolled system being worked for acquisition.",
    contested: "Multiple Powers are competing for this system.",
    exploited: "Power-controlled at the Exploited control band.",
    fortified: "Power-controlled at the Fortified control band.",
    stronghold: "Power-controlled at the Stronghold control band.",
  };
  const key = String(powerplayState || "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  return notes[key] || "System state reported by the local journal snapshot.";
}

/** @param {PowerplayPledge} pledge */
function powerplayRewardsTemplate(pledge) {
  const progress = GalaxyData.moduleProgress(pledge.power, pledge.rank, pledge.merits);
  const pips = GalaxyData.MODULE_RANKS.map((rank, index) => {
    const item = progress.order[index];
    const unlocked = pledge.rank != null && Number(pledge.rank) >= rank;
    const title = item ? `${item.module} · rank ${rank}` : `Powerplay module · rank ${rank}`;
    return html`<span class="pp-reward-pip ${unlocked ? "on" : ""}" title="${title}"
      >${rank}</span
    >`;
  });
  let next;
  if (progress.complete) {
    next = html`<b class="good">ALL 12 POWERPLAY MODULES AVAILABLE</b>`;
  } else {
    const moduleName = progress.nextModule ? html`<b>${progress.nextModule}</b> · ` : null;
    const meritsLeft =
      progress.remainingMerits != null
        ? ` · ${fmtNum(progress.remainingMerits)} merits remaining`
        : "";
    next = html`Next: ${moduleName}rank ${progress.nextRank}${meritsLeft}`;
  }
  const bar =
    !progress.complete && progress.fraction != null
      ? html`<div class="pp-reward-bar" title="Progress toward the next module milestone">
          <div style="width:${(progress.fraction * 100).toFixed(1)}%"></div>
        </div>`
      : null;
  return html`<div class="pp-rewards">
    <div class="pp-reward-head">
      <span
        class="label"
        title="Built-in Powerplay 2.0 reward table, verified ${GalaxyData.DATA_AS_OF}; no online lookup"
        >PP2 MODULE TRACK</span
      ><span class="dim">${progress.unlockedCount}/12 unlocked</span>
    </div>
    <div class="pp-reward-pips">${pips}</div>
    ${bar}
    <div class="pp-reward-next">${next}</div>
    <div class="dim pp-reward-note">
      Rank and merits do not decay between cycles while you stay pledged. Leaving or defecting
      resets that Powerplay progression.
    </div>
  </div>`;
}

/** @param {PowerplayPledge} pledge */
export function powerplayRewardsHtml(pledge) {
  return renderToString(powerplayRewardsTemplate(pledge));
}

/**
 * @param {GalaxyPowerplaySnapshot} galaxy
 * @param {GalaxyHistoryComparison} history
 * @param {string|null} [system]
 */
export function renderPowerplay(galaxy, history, system = appStore.getSnapshot()?.system || null) {
  const card = /** @type {HTMLElement|null} */ (byId("powerplay-card"));
  if (!card) return;
  const pledge = galaxy.powerplay;
  const powerplaySystem = galaxy.pp_system;
  requireById("pp-empty").classList.toggle("hidden", !!(pledge || powerplaySystem));
  requireById("pp-pledge").classList.toggle("hidden", !pledge);
  requireById("pp-sys").classList.toggle("hidden", !powerplaySystem);
  requireById("pp-merits").textContent = pledge?.session_merits
    ? `+${fmtNum(pledge.session_merits)} merits this session`
    : "";
  const signature = JSON.stringify([pledge, powerplaySystem]);
  if (card.dataset.sig === signature) return;
  card.dataset.sig = signature;

  if (pledge) {
    const weeks = pledge.time_pledged_s != null ? Math.floor(pledge.time_pledged_s / 604800) : null;
    render(
      requireById("pp-pledge"),
      html`<div class="pp-row">
          <b>${pledge.power || "?"}</b>
          <span
            class="chip"
            title="Your persistent Powerplay 2.0 rank. It rises with lifetime merits for this pledge."
            >RANK ${pledge.rank != null ? pledge.rank : "?"}</span
          >
          <span class="dim">
            · ${fmtNum(pledge.merits || 0)} merits
            ${weeks != null ? ` · pledged ${weeks >= 1 ? weeks + "w" : "under a week"}` : null}
          </span>
        </div>
        ${powerplayRewardsTemplate(pledge)}`,
    );
  }
  if (!powerplaySystem) return;

  const progress = ppProgressPercent(powerplaySystem.control_progress);
  const reinforcement = powerplaySystem.reinforcement;
  const undermining = powerplaySystem.undermining;
  const contenders = GalaxyData.contestingPowers(powerplaySystem);
  const previousPowerplay = history.previous?.powerplay;
  const currentPowerplay = history.current?.powerplay;
  const previousProgress = ppProgressPercent(previousPowerplay?.control_progress);
  const currentProgress = ppProgressPercent(currentPowerplay?.control_progress);
  const progressDelta =
    previousPowerplay &&
    currentPowerplay &&
    previousPowerplay.controlling === currentPowerplay.controlling &&
    previousProgress != null &&
    currentProgress != null
      ? currentProgress - previousProgress
      : null;
  const scores =
    reinforcement != null || undermining != null
      ? html`<div
          class="pp-scores dim"
          title="Raw reinforcement and undermining scores reported by the journal; these are not a forecast."
        >
          <span class="good">▲ ${fmtNum(reinforcement || 0)} reinforcement</span>
          <span>vs</span>
          <span class="warn">▼ ${fmtNum(undermining || 0)} undermining</span>
        </div>`
      : null;
  const conflictProgress = (powerplaySystem.conflict_progress || []).filter((item) => item?.power);
  const conflictProgressTemplate = conflictProgress.length
    ? html`<div class="pp-conflict-progress">
        <div class="label">POWER CONFLICT PROGRESS <span class="dim">journal snapshot</span></div>
        ${conflictProgress.map((item) => {
          const percent = ppProgressPercent(item.progress);
          return html`<div class="pp-conflict-row">
            <span>${item.power}</span>
            <div
              class="pp-mini-bar"
              title="Conflict progress reported by the journal; not a prediction"
            >
              <div style="width:${percent == null ? 0 : percent.toFixed(1)}%"></div>
            </div>
            <b>${percent == null ? "—" : percent.toFixed(1) + "%"}</b>
          </div>`;
        })}
      </div>`
    : null;
  render(
    requireById("pp-sys"),
    html`<div class="label">THIS SYSTEM <span class="dim">${system || ""}</span></div>
      <div class="pp-row">
        <b>${powerplaySystem.controlling || "Uncontrolled"}</b>
        ${
          powerplaySystem.state
            ? html`<span class="chip">${String(powerplaySystem.state).toUpperCase()}</span>`
            : null
        }
        ${
          contenders.length
            ? html`<span class="dim">· other Powers present: ${contenders.join(", ")}</span>`
            : null
        }
      </div>
      <div class="dim pp-state-note">${powerplayStateNote(powerplaySystem.state)}</div>
      ${
        progress != null
          ? html`<div
                class="pp-bar"
                title="Progress within the system's currently reported Powerplay control state; not a simple fortification meter"
              >
                <div style="width:${progress.toFixed(1)}%"></div>
              </div>
              <div class="dim">
                current-state progress ${progress.toFixed(1)}%
                ${
                  progressDelta != null && Math.abs(progressDelta) >= 0.05
                    ? html` ·
                        <span class="${progressDelta >= 0 ? "good" : "warn"}"
                          >${progressDelta >= 0 ? "+" : ""}${progressDelta.toFixed(1)} pp since your
                          prior observation</span
                        >`
                    : null
                }
              </div>`
          : null
      }
      ${scores} ${conflictProgressTemplate}`,
  );
}
