/** @import {ApplicationState} from "../api/contracts/state.js" */
import { copyText } from "../core/clipboard.js";
import { requireById } from "../core/dom.js";
import { compactCredits } from "../core/fmt.js";
import { clear, html, render } from "../core/html.js";
import { appStore } from "../core/store.js";
import { plotSystem } from "../features/plot.js";
import { renderRebuy } from "./rebuy.js";

/**
 * @typedef {ApplicationState & {
 *   nav: ApplicationState["nav"] & {
 *     ahead?: {scoopable?: boolean}[],
 *     jumps_of_fuel?: number|null,
 *   },
 *   exploration: ApplicationState["exploration"] & {count?: number},
 *   jump_history: (ApplicationState["jump_history"][number] & {dist?: number|null})[],
 * }} PanelApplicationState
 */

/**
 * Panel markup is mounted as one required shell contract before rendering.
 *
 * @param {string} id
 * @returns {HTMLElement}
 */
const $ = (id) => /** @type {HTMLElement} */ (requireById(id));

/**
 * @param {string} _match
 * @param {string} numerals
 */
const expandMarkNumerals = (_match, numerals) => " MK " + numerals.toUpperCase();

/** @param {PanelApplicationState|null} [snapshot] */
export function renderPanel(
  snapshot = /** @type {PanelApplicationState|null} */ (appStore.getSnapshot()),
) {
  if (!document.body.classList.contains("panel-mode")) return;
  if (!snapshot) return;
  const stationTxt =
    snapshot.docked && snapshot.station
      ? `DOCKED · ${snapshot.station}`
      : snapshot.body && snapshot.body !== snapshot.system
        ? `IN SPACE · ${snapshot.body}`
        : "IN SPACE";

  $("fp-cmdr").textContent = snapshot.commander ? `CMDR ${snapshot.commander}` : "";
  $("fp-system").textContent = snapshot.system || "—";
  const stationChip = $("fp-station");
  stationChip.textContent = snapshot.docked ? `◆ ${stationTxt}` : stationTxt;
  stationChip.classList.toggle("inspace", !snapshot.docked);
  $("fp-dest").textContent = snapshot.destination ? `DESTINATION · ${snapshot.destination}` : "";
  // Named ship first; otherwise the model, mending raw journal type strings
  // like "Diamondbackxl" / "Cobramkiii" into readable labels.
  const shipName = (snapshot.ship_name || "").trim();
  const shipType = (snapshot.ship_type || "")
    .trim()
    .replace(/mk\s*(i+v?|vi*)$/i, expandMarkNumerals)
    .replace(/xl$/i, " XL");
  $("fp-ship-type").textContent = (shipName || shipType).toUpperCase();

  const fuelPct =
    (snapshot.fuel_capacity || 0) > 0
      ? Math.min(
          100,
          ((snapshot.fuel_main || 0) / /** @type {number} */ (snapshot.fuel_capacity)) * 100,
        )
      : 0;
  const fuelTxt =
    snapshot.fuel_main != null
      ? `${snapshot.fuel_main.toFixed(1)} / ${(snapshot.fuel_capacity || 0).toFixed(0)} t`
      : "—";
  const fill = $("fp-fuel-fill");
  fill.style.width = fuelPct + "%";
  fill.style.background = fuelPct < 25 ? "var(--bad)" : "";
  $("fp-fuel").textContent = fuelTxt;

  // Fuel note: jumps of fuel at recent burn + whether there's a scoop here/next
  const nav = snapshot.nav || {};
  const ahead = nav.ahead || [];
  /** @type {string[]} */
  const fuelNotes = [];
  if (nav.jumps_of_fuel != null) fuelNotes.push(`≈${nav.jumps_of_fuel} JUMPS AT CURRENT BURN`);
  const scoop = ahead[0]?.scoopable
    ? "SCOOPABLE STAR IN SYSTEM"
    : ahead[1]?.scoopable
      ? "NEXT STAR IS SCOOPABLE"
      : "";
  render(
    $("fp-fuel-note"),
    html`<span>${fuelNotes.join(" · ")}</span
      >${scoop ? html`<span class="good">${scoop}</span>` : false}`,
  );

  const cargoPct =
    (snapshot.cargo_capacity || 0) > 0
      ? Math.min(
          100,
          ((snapshot.cargo_tons || 0) / /** @type {number} */ (snapshot.cargo_capacity)) * 100,
        )
      : 0;
  const cargoTxt =
    snapshot.cargo_tons != null
      ? `${Math.round(snapshot.cargo_tons)} / ${snapshot.cargo_capacity || 0} t`
      : "—";
  $("fp-cargo-fill").style.width = cargoPct + "%";
  $("fp-cargo").textContent = cargoTxt;
  $("fp-cargo-note").textContent =
    (snapshot.cargo_capacity || 0) > 0
      ? snapshot.cargo_tons
        ? `${Math.max(0, /** @type {number} */ (snapshot.cargo_capacity) - Math.round(snapshot.cargo_tons))} T FREE`
        : "HOLD EMPTY · READY FOR LOOP CARGO"
      : "";

  // Persistent status strip (visible on every panel page)
  $("fp-strip-system").textContent = snapshot.system || "—";
  $("fp-strip-station").textContent = stationTxt;
  $("fp-strip-dest-block").classList.toggle("hidden", !snapshot.destination);
  // Jumps left on the in-game route: nav.ahead includes the current system.
  const jumpsLeft = ahead.length > 1 ? ahead.length - 1 : 0;
  $("fp-strip-dest").textContent = snapshot.destination
    ? snapshot.destination + (jumpsLeft ? ` · ${jumpsLeft} JUMP${jumpsLeft === 1 ? "" : "S"}` : "")
    : "";
  const stripFuel = $("fp-strip-fuel-fill");
  stripFuel.style.width = fuelPct + "%";
  stripFuel.style.background = fuelPct < 25 ? "var(--bad)" : "";
  $("fp-strip-fuel").textContent = fuelTxt.replace(/ /g, "");
  $("fp-strip-cargo-fill").style.width = cargoPct + "%";
  $("fp-strip-cargo").textContent = cargoTxt.replace(/ /g, "");

  // Data-at-risk chip: unsold scans + samples vs. the ship's rebuy. Same
  // thresholds as the server's voice callout (10x warn, 50x critical).
  const atRisk = (snapshot.exploration?.total || 0) + (snapshot.bio?.vault?.total || 0);
  const rebuy = snapshot.rebuy || 0;
  const risky = rebuy > 0 && atRisk >= 20e6 && atRisk >= rebuy * 10;
  $("fp-risk").classList.toggle("hidden", !risky);
  if (risky) {
    $("fp-risk").classList.toggle("crit", atRisk >= rebuy * 50);
    $("fp-risk-text").textContent =
      `≈${compactCredits(atRisk)} cr unbanked · ${(atRisk / rebuy).toFixed(1).replace(/\.0$/, "")}× your rebuy`;
  }

  $("fp-credits").textContent = snapshot.credits != null ? compactCredits(snapshot.credits) : "—";
  const legal = $("fp-legal");
  legal.textContent = (snapshot.legal_state || "—").toUpperCase();
  legal.style.color =
    snapshot.legal_state && snapshot.legal_state !== "Clean" ? "var(--bad)" : "var(--good)";
  renderRebuy($("fp-rebuy"), snapshot);
  // The telemetry tiles drop the "cr" unit — the column head says it once.
  $("fp-rebuy").textContent = $("fp-rebuy").textContent.replace(/ cr$/, "");
  const covers = $("fp-rebuy-covers");
  if (rebuy > 0 && snapshot.credits != null) {
    const ratio = snapshot.credits / rebuy;
    covers.textContent = `COVERS ${ratio >= 10 ? Math.round(ratio) : ratio.toFixed(1)}×`;
    covers.className = "fp-tel-sub" + (ratio < 1 ? " bad" : ratio < 2 ? " thin" : "");
  } else {
    covers.textContent = "";
  }
  const ex = snapshot.exploration || {};
  $("fp-explo").textContent = ex.count ? `≈${compactCredits(ex.total || 0)}` : "—";
  $("fp-explo-label").textContent = "EXPLO DATA" + (ex.count ? ` · ${ex.count} BODIES` : "");
  const vault = snapshot.bio?.vault || { items: [], total: 0 };
  const species = (vault.items || []).length;
  $("fp-bio").textContent = species ? `≈${compactCredits(vault.total)}` : "—";
  $("fp-bio-label").textContent = "BIO SAMPLES" + (species ? ` · ${species} SPECIES` : "");
  $("fp-telemetry-at").textContent =
    "TELEMETRY " + new Date().toLocaleTimeString([], { hour12: false });
  $("fp-link").textContent = "LINK STABLE";

  const jumps = /** @type {(ApplicationState["jump_history"][number] & {dist?: number|null})[]} */ (
    snapshot.jump_history || []
  ).slice(0, 4);
  const jl = $("fp-jumps");
  const sig = JSON.stringify(jumps);
  if (jl.dataset.sig !== sig) {
    jl.dataset.sig = sig;
    clear(jl);
    for (const j of jumps) {
      const system = j.system;
      if (!system) continue;
      const b = document.createElement("button");
      b.className = "fp-jump";
      render(
        b,
        html`<span>${system}</span
          ><span class="fp-jump-dist">${j.dist != null ? j.dist.toFixed(1) + " ly" : ""}</span>`,
      );
      b.addEventListener("click", () => plotSystem(system));
      jl.appendChild(b);
    }
  }
}

/** @param {string} system */
export function plotButton(system) {
  const btn = document.createElement("button");
  btn.className = "hb hb-utility hb-icon hb-sm";
  btn.type = "button";
  btn.title = "Plot route in game to " + system;
  btn.setAttribute("aria-label", btn.title);
  btn.textContent = "◎";
  btn.addEventListener("click", () => plotSystem(system));
  return btn;
}

/** @param {string} system */
export function copySystemButton(system) {
  const btn = document.createElement("button");
  btn.className = "hb hb-utility hb-icon hb-sm";
  btn.type = "button";
  btn.title = "Copy system name";
  btn.setAttribute("aria-label", btn.title);
  btn.textContent = "⧉";
  btn.addEventListener("click", () => copyText(system, btn));
  return btn;
}
