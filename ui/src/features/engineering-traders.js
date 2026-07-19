/** @import {MaterialTradersResponse} from "../api/contracts/engineering.js" */

import { byId, requireById } from "../core/dom.js";
import { clear, html, render } from "../core/html.js";
import { appStore } from "../core/store.js";
import { isStaleCommanderResponse } from "../api/errors.js";
import { engineeringApi } from "../api/engineering.js";
import { plotButton } from "../shell/status.js";

let traderSearchRequest = 0;

export function clearEngineeringTraderSearch() {
  traderSearchRequest += 1;
  byId("engplan-traders")?.replaceChildren();
}

appStore.onProfileChange(clearEngineeringTraderSearch);

export async function findTraders() {
  const out = /** @type {HTMLElement} */ (requireById("engplan-traders"));
  const requestId = ++traderSearchRequest;
  const identity = appStore.identity();
  if (!identity.commanderId) {
    render(out, html`<div class="dim">Waiting for the commander profile...</div>`);
    return;
  }
  render(out, html`<div class="dim">Finding material traders near you… (~5s)</div>`);
  try {
    const kinds = ["raw", "manufactured", "encoded"];
    const results = await Promise.all(
      kinds.map(async (kind) => {
        try {
          const result = await engineeringApi.findMaterialTraders(kind);
          return { ...result, error: "" };
        } catch (error) {
          if (isStaleCommanderResponse(error)) throw error;
          return {
            kind,
            reference: null,
            traders: [],
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }),
    );
    if (requestId !== traderSearchRequest || !appStore.isCurrent(identity)) return;
    clear(out);
    results.forEach((result, index) => {
      const kind = kinds[index] || "unknown";
      const trader = result.traders[0];
      const div = document.createElement("div");
      div.className = "ep-trader";
      if (!trader) {
        render(
          div,
          html`<b>${kind.toUpperCase()}</b>
            <span class="dim">${result.error || "none found"}</span>`,
        );
      } else {
        render(
          div,
          html`<b>${kind.toUpperCase()}</b> ${trader.station}
            <span class="dim"
              >${trader.system} · ${trader.distance} ly${trader.large_pad ? " · L pad" : ""}</span
            >`,
        );
        div.appendChild(plotButton(trader.system));
      }
      out.appendChild(div);
    });
  } catch (error) {
    if (
      requestId !== traderSearchRequest ||
      isStaleCommanderResponse(error) ||
      !appStore.isCurrent(identity)
    ) {
      return;
    }
    render(out, html`<div class="dim">Trader search failed — try again.</div>`);
  }
}
