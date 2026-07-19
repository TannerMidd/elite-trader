/** @import {ApplicationState} from "../api/contracts/state.js" */
import { requireById } from "../core/dom.js";
import { compactCredits } from "../core/fmt.js";
import { clear, html, render } from "../core/html.js";
import { appStore } from "../core/store.js";

/**
 * @typedef {{
 *   faction?: string,
 *   missions?: number,
 *   givers?: number,
 *   reward?: number,
 *   kills_done?: number,
 *   kills_needed?: number,
 *   complete?: boolean,
 * }} MassacreStack
 * @typedef {ApplicationState & {
 *   combat: ApplicationState["combat"] & {massacre?: MassacreStack[]},
 * }} CombatApplicationState
 */

/** @param {string} id @returns {HTMLElement} */
const $ = (id) => /** @type {HTMLElement} */ (requireById(id));

/** @param {CombatApplicationState|null} [snapshot] */
export function renderMassacre(
  snapshot = /** @type {CombatApplicationState|null} */ (appStore.getSnapshot()),
) {
  if (!snapshot) return;
  const card = $("massacre-card");
  const combat = snapshot.combat || {};
  const stacks = combat.massacre || [];
  const show = stacks.length > 0 || (combat.kills || 0) > 0;
  card.classList.toggle("hidden", !show);
  if (!show) return;

  $("massacre-reward").textContent = stacks.length
    ? `≈${compactCredits(stacks.reduce((total, stack) => total + (stack.reward || 0), 0))} cr`
    : "";
  $("combat-session").textContent =
    `This session: ${combat.kills || 0} kills · ` +
    `bounty claims ≈${compactCredits(combat.bounty_cr || 0)} cr · ` +
    `bond claims ≈${compactCredits(combat.bonds_cr || 0)} cr — redeem before you lose them.`;

  const list = $("massacre-list");
  const sig = JSON.stringify(stacks);
  if (list.dataset.sig === sig) return;
  list.dataset.sig = sig;
  clear(list);
  for (const s of stacks) {
    const pct = s.kills_needed ? Math.round(((s.kills_done || 0) / s.kills_needed) * 100) : 0;
    const div = document.createElement("div");
    div.className = "stack" + (s.complete ? " done" : "");
    render(
      div,
      html`<div class="stack-line">
          <b>${s.faction}</b>
          <span class="dim"
            >${s.missions} mission${s.missions === 1 ? "" : "s"} · ${s.givers}
            giver${s.givers === 1 ? "" : "s"}</span
          >
          <span class="profit">≈${compactCredits(s.reward || 0)} cr</span>
        </div>
        <div class="stack-bar"><div style="width:${pct}%"></div></div>
        <div class="stack-sub ${s.complete ? "good" : "dim"}">
          ${
            s.complete
              ? "✓ STACK COMPLETE — hand your missions in"
              : `${s.kills_done} / ${s.kills_needed} kills`
          }
        </div>`,
    );
    list.appendChild(div);
  }
}
