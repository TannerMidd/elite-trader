/** @import {TradeRouteResponse} from "./route-results.js" */

import { byId, requireById } from "../core/dom.js";
import { fmtNum } from "../core/fmt.js";
import { clear, html, render } from "../core/html.js";
import { appStore } from "../core/store.js";
import { isStaleCommanderResponse } from "../api/errors.js";
import { marketApi } from "../api/market.js";
import { plotButton } from "../shell/status.js";
import { speak } from "../shell/voice.js";
import { renderLoops, renderRoutes } from "./route-results.js";
import { routeFormWasTouched } from "./route-state.js";

let bestLoopRequest = 0;
let routeSearchRequest = 0;

/** @param {string} id */
function element(id) {
  return /** @type {HTMLElement} */ (requireById(id));
}

/** @param {string} id */
function input(id) {
  return /** @type {HTMLInputElement} */ (requireById(id));
}

/** @param {string} id */
function select(id) {
  return /** @type {HTMLSelectElement} */ (requireById(id));
}

/** @param {string} id */
function button(id) {
  return /** @type {HTMLButtonElement} */ (requireById(id));
}

/** @param {unknown} error */
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

appStore.onProfileChange(() => {
  bestLoopRequest += 1;
  routeSearchRequest += 1;
  for (const id of ["fp-bestloop", "rf-go"]) {
    const control = /** @type {HTMLButtonElement|null} */ (byId(id));
    if (control) control.disabled = false;
  }
  for (const id of ["fp-loop-status", "fp-loop-results", "route-status", "route-results"]) {
    byId(id)?.replaceChildren();
  }
});

export async function findBestLoop() {
  const btn = button("fp-bestloop");
  const status = element("fp-loop-status");
  const out = element("fp-loop-results");
  const requestId = ++bestLoopRequest;
  const identity = appStore.identity();
  if (!identity.commanderId) {
    status.classList.add("error");
    status.textContent = "Waiting for the commander profile...";
    return;
  }
  btn.disabled = true;
  status.classList.remove("error");
  status.textContent = "Finding the best loop from here… (~3–10s)";
  clear(out);
  try {
    const data = /** @type {TradeRouteResponse} */ (
      await marketApi.findTradeRoute({
        mode: "loop",
        results: 3,
        min_supply:
          Number(Reflect.get(appStore.getSnapshot() || {}, "cargo_capacity")) || undefined,
      })
    );
    if (requestId !== bestLoopRequest || !appStore.isCurrent(identity)) return;
    const loops = data.loops || [];
    if (!loops.length) {
      status.textContent =
        "No profitable loop found near you right now — try the Trade tab for wider settings.";
      return;
    }
    status.textContent = `Top ${loops.length} loop${loops.length > 1 ? "s" : ""} within 100 ly, best profit/hour:`;
    loops.forEach((loop) => {
      const div = document.createElement("div");
      div.className = "fp-loop";
      render(
        div,
        html`<div class="fp-loop-line">
            <b>${loop.a.station}</b> <span class="dim">${loop.a.system}</span>
            <span class="fp-loop-arrow">⇄</span>
            <b>${loop.b.station}</b> <span class="dim">${loop.b.system}</span>
          </div>
          <div class="fp-loop-sub">
            ${
              loop.profit_per_hour != null
                ? html`<b class="good">+${fmtNum(loop.profit_per_hour)} cr/hr</b>`
                : html`<b class="good">+${fmtNum(loop.profit)} cr/trip</b>`
            }
            · +${fmtNum(loop.profit)} cr/trip · ${loop.distance} ly apart · start
            ${loop.a.from_player} ly away
          </div>`,
      );
      const line = div.querySelector(".fp-loop-line");
      if (!line) return;
      line.appendChild(plotButton(loop.a.system));
      line.appendChild(plotButton(loop.b.system));
      out.appendChild(div);
    });
    const best = loops[0];
    if (best) speak(`Best loop found. ${best.a.station} to ${best.b.station}.`);
  } catch (error) {
    if (
      requestId !== bestLoopRequest ||
      isStaleCommanderResponse(error) ||
      !appStore.isCurrent(identity)
    ) {
      return;
    }
    status.classList.add("error");
    status.textContent = errorMessage(error);
  } finally {
    if (requestId === bestLoopRequest) btn.disabled = false;
  }
}

export function seedRouteForm() {
  if (routeFormWasTouched()) return;
  const snapshot = appStore.getSnapshot();
  if (!snapshot) return;
  const credits = Number(Reflect.get(snapshot, "credits"));
  const cargoCapacity = Number(Reflect.get(snapshot, "cargo_capacity"));
  const maxJumpRange = Number(Reflect.get(snapshot, "max_jump_range"));
  if (Number.isFinite(credits) && !input("rf-capital").value) {
    input("rf-capital").value = String(credits);
  }
  if (Number.isFinite(cargoCapacity) && !input("rf-cargo").value) {
    input("rf-cargo").value = String(cargoCapacity);
  }
  if (Number.isFinite(maxJumpRange)) {
    for (const id of ["rf-hop", "rf-jumprange", "rr-range", "nr-range"]) {
      if (!input(id).value) input(id).value = maxJumpRange.toFixed(1);
    }
  }
  if (cargoCapacity > 0 && !input("rf-minsupply").value) {
    input("rf-minsupply").value = String(cargoCapacity);
  }
}

/** @param {SubmitEvent|{preventDefault(): void}} event */
export async function findRoutes(event) {
  event.preventDefault();
  const go = button("rf-go");
  const status = element("route-status");
  const results = element("route-results");
  const requestId = ++routeSearchRequest;
  const identity = appStore.identity();
  if (!identity.commanderId) {
    status.classList.add("error");
    status.textContent = "Waiting for the commander profile...";
    return;
  }
  go.disabled = true;
  status.classList.remove("error");
  const searchMode = select("rf-mode").value;
  const snapshot = appStore.getSnapshot();
  const currentSystem =
    snapshot && typeof snapshot === "object" ? String(Reflect.get(snapshot, "system") ?? "") : "";
  status.textContent =
    searchMode === "loop"
      ? "Searching your local market database… (~3-10s)"
      : "Planning the chain… (local database, or Spansh when it isn't built · ~10-30s)";
  clear(results);
  try {
    const data = /** @type {TradeRouteResponse} */ (
      await marketApi.findTradeRoute({
        mode: searchMode,
        capital: Number(input("rf-capital").value) || undefined,
        max_cargo: Number(input("rf-cargo").value) || undefined,
        radius: Number(input("rf-radius").value) || undefined,
        max_leg: Number(input("rf-maxleg").value) || undefined,
        jump_range: Number(input("rf-jumprange").value) || undefined,
        results: Number(input("rf-results").value) || undefined,
        min_supply: Number(input("rf-minsupply").value) || undefined,
        max_hop_distance: Number(input("rf-hop").value) || undefined,
        max_hops: Number(input("rf-hops").value) || undefined,
        max_system_distance: Number(input("rf-lsdist").value) || undefined,
        max_price_age_days: Number(input("rf-age").value) || undefined,
        requires_large_pad: input("rf-largepad").checked,
      })
    );
    if (requestId !== routeSearchRequest || !appStore.isCurrent(identity)) return;
    const source =
      data.source === "local" ? "local database" : "Spansh API (local DB not built yet)";
    if (data.mode === "loop") {
      const loops = data.loops || [];
      renderLoops(loops);
      status.textContent = loops.length
        ? `Best ${loops.length} loops within ${input("rf-radius").value} ly of ${currentSystem}, ranked by estimated profit/hour.`
        : "No profitable loop found with those settings.";
    } else {
      const hops = data.hops || [];
      renderRoutes(hops);
      status.textContent = hops.length
        ? `Route found (${hops.length} hop${hops.length > 1 ? "s" : ""}) from ${currentSystem} via ${source}.`
        : `No profitable route for those settings (via ${source}).`;
    }
  } catch (error) {
    if (
      requestId !== routeSearchRequest ||
      isStaleCommanderResponse(error) ||
      !appStore.isCurrent(identity)
    ) {
      return;
    }
    status.classList.add("error");
    status.textContent = errorMessage(error);
  } finally {
    if (requestId === routeSearchRequest) go.disabled = false;
  }
}
