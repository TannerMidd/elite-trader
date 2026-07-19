/** @import {MiningLimpetSummary} from "../../api/contracts/specialists.js" */
/** @import {MiningHistoryRow, MiningWorkflowView, MutationRunner} from "./types.js" */
import { specialistsApi } from "../../api/specialists.js";
import {
  fmtCr,
  fmtDuration,
  html,
  render,
  renderSpecialistFacts,
  renderSpecialistHistory,
  setText,
  specialistButton,
  specialistDuration,
  specialistElement,
  specialistHumanName,
  specialistNumber,
} from "./core.js";

/**
 * @param {MiningWorkflowView} mining
 * @param {MiningHistoryRow[]} history
 */
export function renderMiningSpecialist(mining, history) {
  const session = mining.session;
  const active = Boolean(mining.active);
  const badge = specialistElement("sp-mining-state");
  badge.textContent = active ? "RUN ACTIVE" : session ? "LAST RUN" : "IDLE";
  badge.className = `sp-state ${active ? "active" : "idle"}`;
  specialistButton("sp-mining-start").disabled = active;
  specialistButton("sp-mining-end").disabled = !active;
  specialistElement("sp-mining-message").textContent = active
    ? [session?.system, session?.body || session?.ring].filter(Boolean).join(" · ") ||
      "Mining activity is being recorded from the journal."
    : session?.end_reason
      ? `Last run ended: ${specialistHumanName(session.end_reason)}.`
      : "A run also starts automatically when the journal reports mining activity.";

  setText("sp-mining-duration", fmtDuration(specialistDuration(session, active)));
  setText("sp-mining-refined", session ? specialistNumber(session.refined_t, " t") : "—");
  setText(
    "sp-mining-rate",
    session?.tons_per_hour == null ? "—" : `${specialistNumber(session.tons_per_hour)} t/hr`,
  );
  setText(
    "sp-mining-prospected",
    session ? specialistNumber(session.asteroids_prospected || 0) : "—",
  );
  setText("sp-mining-cracked", session ? specialistNumber(session.asteroids_cracked || 0) : "—");
  setText("sp-mining-revenue", session ? fmtCr(session.attributed_revenue_cr || 0) : "—");

  const yields = session?.cargo_yield || session?.refined || [];
  render(
    specialistElement("sp-mining-yield"),
    html`${yields.map(
      (row) =>
        html`<tr>
          <td>${row.name || row.symbol}</td>
          <td class="num">${specialistNumber(row.count, " t")}</td>
          <td class="num">
            ${row.cargo_delta == null ? "—" : specialistNumber(row.cargo_delta, " t")}
          </td>
          <td class="num">${row.sold_t == null ? "—" : specialistNumber(row.sold_t, " t")}</td>
        </tr>`,
    )}`,
  );
  specialistElement("sp-mining-yield-empty").classList.toggle("hidden", yields.length > 0);

  const targets = session?.prospected_materials || [];
  render(
    specialistElement("sp-mining-targets"),
    html`${targets.map(
      (row) =>
        html`<tr>
          <td>${row.name || row.symbol}</td>
          <td class="num">${specialistNumber(row.sightings || 0)}</td>
          <td class="num">${specialistNumber(row.best_pct, "%")}</td>
          <td class="num">${specialistNumber(row.average_pct, "%")}</td>
        </tr>`,
    )}`,
  );
  specialistElement("sp-mining-targets-empty").classList.toggle("hidden", targets.length > 0);

  /** @type {Partial<MiningLimpetSummary>} */
  const limpets = session?.limpets || {};
  renderSpecialistFacts("sp-mining-limpets", [
    [
      "Prospectors used",
      session ? specialistNumber(limpets.prospectors_used || 0) : "—",
      "journal launches / prospected rocks",
    ],
    [
      "Collectors launched",
      session ? specialistNumber(limpets.collectors_launched || 0) : "—",
      "journal launches",
    ],
    [
      "Estimated used",
      session ? specialistNumber(limpets.estimated_used || 0) : "—",
      limpets.inventory_accounting == null ? "launch events only" : "inventory cross-check",
    ],
    [
      "Remaining",
      limpets.remaining == null ? "—" : specialistNumber(limpets.remaining),
      "latest Cargo snapshot",
    ],
    [
      "Cost / tonne",
      limpets.cost_per_tonne_cr == null ? "—" : fmtCr(limpets.cost_per_tonne_cr),
      limpets.cost_source || "purchase price not observed",
    ],
    [
      "Net after limpet cash",
      session ? fmtCr(session.net_after_limpet_cash_cr || 0) : "—",
      "attributed sales − buys + returns",
    ],
  ]);

  renderSpecialistHistory("sp-mining-history", history, (item) => ({
    title: `${specialistNumber(item.refined_t || 0, " t")} refined · ${
      item.tons_per_hour == null
        ? "rate unavailable"
        : `${specialistNumber(item.tons_per_hour)} t/hr`
    }`,
    subtitle: `${item.asteroids_prospected || 0} rocks · ${fmtCr(
      item.attributed_revenue_cr || 0,
    )} attributed revenue · ${fmtDuration(item.duration_s)}`,
  }));
}

/** @param {MutationRunner} runMutation */
export function initMiningSpecialist(runMutation) {
  const start = specialistButton("sp-mining-start");
  start.addEventListener("click", () => {
    void runMutation({
      perform: () => specialistsApi.startMiningRun(),
      button: start,
      successMessage: "Mining run started.",
    });
  });
  const end = specialistButton("sp-mining-end");
  end.addEventListener("click", () => {
    void runMutation({
      perform: () => specialistsApi.endMiningRun("manual"),
      button: end,
      successMessage: "Mining run archived.",
    });
  });
}
