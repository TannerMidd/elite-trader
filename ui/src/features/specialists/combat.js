/** @import {CombatHistoryRow, CombatWorkflowView, MutationRunner} from "./types.js" */
import { specialistsApi } from "../../api/specialists.js";
import { setStyleValue } from "../../core/dom.js";
import {
  fmtCr,
  fmtDuration,
  html,
  render,
  renderSpecialistHistory,
  setText,
  specialistButton,
  specialistDuration,
  specialistElement,
  specialistHumanName,
  specialistNumber,
} from "./core.js";

/** @type {Readonly<Record<string, string>>} */
const READINESS_LEVEL_NAMES = Object.freeze({
  not_ax_equipped: "NO AX WEAPONS OBSERVED",
  limited: "LIMITED AX TOOLING",
  scout_or_support_ready: "SCOUT / SUPPORT TOOLING PRESENT",
  interceptor_tooling_present: "INTERCEPTOR TOOLING PRESENT",
});

/** @type {Readonly<Record<string, string>>} */
const CHECKLIST_LABELS = Object.freeze({
  ax_weapons: "AX weapons",
  heat_sinks: "Heat sinks",
  xeno_scanners: "Xeno scanner",
  flak: "Remote-release flak",
  shutdown_neutralisers: "Shutdown neutraliser",
  caustic_sinks: "Caustic sinks",
  repair_or_decon: "Repair / decon limpets",
  hull_reinforcement: "Hull reinforcement",
  module_reinforcement: "Module reinforcement",
});

/**
 * @param {CombatWorkflowView} combat
 * @param {CombatHistoryRow[]} history
 */
export function renderCombatSpecialist(combat, history) {
  const readiness = combat.readiness || {};
  specialistElement("sp-combat-level").textContent =
    READINESS_LEVEL_NAMES[String(readiness.level || "")] || "NO LOADOUT OBSERVED";
  const score = Math.max(0, Math.min(100, Number(readiness.score) || 0));
  const scoreElement = specialistElement("sp-combat-score");
  setStyleValue(scoreElement, "--score", `${score * 3.6}deg`);
  const scoreText = scoreElement.querySelector("b");
  if (scoreText) scoreText.textContent = String(score);

  render(
    specialistElement("sp-combat-checklist"),
    html`${Object.entries(CHECKLIST_LABELS).map(([key, label]) => {
      const present = Boolean(readiness.checklist?.[key]);
      return html`<span class="${present ? "present" : "missing"}"
        ><i>${present ? "✓" : "—"}</i>${label}</span
      >`;
    })}`,
  );

  const ammo = readiness.ammo?.by_module || [];
  render(
    specialistElement("sp-combat-ammo"),
    html`${ammo.map(
      (row) =>
        html`<tr>
          <td>${specialistHumanName(row.item)}</td>
          <td>${row.slot || "—"}</td>
          <td class="num">${specialistNumber(row.clip || 0)}</td>
          <td class="num">${specialistNumber(row.hopper || 0)}</td>
          <td class="num">${specialistNumber(row.total || 0)}</td>
        </tr>`,
    )}`,
  );
  specialistElement("sp-combat-ammo-empty").classList.toggle("hidden", ammo.length > 0);

  const session = combat.session;
  const active = Boolean(combat.active);
  const badge = specialistElement("sp-combat-state");
  badge.textContent = active ? "SESSION ACTIVE" : session ? "LAST SESSION" : "IDLE";
  badge.className = `sp-state ${active ? "active" : "idle"}`;
  specialistButton("sp-combat-start").disabled = active;
  specialistButton("sp-combat-end").disabled = !active;
  const target = combat.target;
  const unredeemed = session
    ? Math.max(0, (session.bounty_cr || 0) + (session.bond_cr || 0) - (session.redeemed_cr || 0))
    : 0;
  specialistElement("sp-combat-message").textContent = target?.ship
    ? `Target observation: ${target.ship}${target.is_thargoid ? " · THARGOID" : ""}.`
    : active
      ? `${fmtCr(unredeemed)} in session claims may still need redemption.`
      : "A session also starts automatically on a kill, attack or damage event.";
  setText("sp-combat-duration", fmtDuration(specialistDuration(session, active)));
  setText("sp-combat-kills", session ? specialistNumber(session.kills || 0) : "—");
  setText("sp-combat-ax-kills", session ? specialistNumber(session.ax_kills || 0) : "—");
  setText("sp-combat-bounties", session ? fmtCr(session.bounty_cr || 0) : "—");
  setText("sp-combat-bonds", session ? fmtCr(session.bond_cr || 0) : "—");
  setText("sp-combat-damage", session ? specialistNumber(session.damage_events || 0) : "—");

  /**
   * @param {Record<string, number>|null|undefined} values
   * @param {string} empty
   */
  const renderChips = (values, empty) =>
    html`${
      Object.entries(values || {}).length
        ? Object.entries(values || {}).map(
            ([name, count]) =>
              html`<span>${specialistHumanName(name)}<b>×${specialistNumber(count)}</b></span>`,
          )
        : html`<span class="dim">${empty}</span>`
    }`;
  render(
    specialistElement("sp-combat-ax-types"),
    renderChips(session?.ax_kills_by_type, "No AX kills in this session."),
  );
  render(
    specialistElement("sp-combat-synthesis"),
    renderChips(session?.synthesis, "No combat synthesis in this session."),
  );
  renderSpecialistHistory("sp-combat-history", history, (item) => ({
    title: `${item.kills || 0} kills · ${item.ax_kills || 0} AX · ${fmtCr(
      (item.bounty_cr || 0) + (item.bond_cr || 0),
    )} claims`,
    subtitle: `${item.damage_events || 0} damage events · ${Object.values(
      item.synthesis || {},
    ).reduce((sum, count) => sum + count, 0)} synthesis · ${fmtDuration(item.duration_s)}`,
  }));
}

/** @param {MutationRunner} runMutation */
export function initCombatSpecialist(runMutation) {
  const start = specialistButton("sp-combat-start");
  start.addEventListener("click", () => {
    void runMutation({
      perform: () => specialistsApi.startCombatSession(),
      button: start,
      successMessage: "Combat session started.",
    });
  });
  const end = specialistButton("sp-combat-end");
  end.addEventListener("click", () => {
    void runMutation({
      perform: () => specialistsApi.endCombatSession("manual"),
      button: end,
      successMessage: "Combat session archived.",
    });
  });
}
