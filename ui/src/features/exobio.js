import { copyText } from "../core/clipboard.js";
import { byId, requireById } from "../core/dom.js";
import { fmtUnknownNumber } from "../core/fmt.js";
import { clear, html, render } from "../core/html.js";
import { appStore } from "../core/store.js";
import { isStaleCommanderResponse } from "../api/errors.js";
import { marketApi } from "../api/market.js";
import { navigationApi } from "../api/navigation.js";
import { trackButton } from "./routes.js";
import { plotButton } from "../shell/status.js";

/** @type {Set<string>} */
export const exoGenera = new Set();

let exobiologySearchRequestId = 0;

export async function buildExoGenusChips() {
  const wrap = byId("exo-genus-chips");
  if (!wrap) return;
  let genera;
  try {
    genera = (await marketApi.listExobiologyGenera()).genera || [];
  } catch {
    return; // filter is optional; leave the row empty if the list can't load
  }
  clear(wrap);
  genera.forEach((g) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "exo-chip";
    chip.textContent = g;
    chip.setAttribute("aria-pressed", "false");
    chip.addEventListener("click", () => {
      const on = !exoGenera.has(g);
      if (on) exoGenera.add(g);
      else exoGenera.delete(g);
      chip.classList.toggle("on", on);
      chip.setAttribute("aria-pressed", String(on));
      updateExoGenusHint();
    });
    wrap.appendChild(chip);
  });
  updateExoGenusHint();
}

export function updateExoGenusHint() {
  const hint = byId("exo-genus-hint");
  if (hint)
    hint.textContent = exoGenera.size
      ? `only ${[...exoGenera].sort().join(", ")}`
      : "none = every genus";
}

/** @param {Event} ev */
export async function searchExobio(ev) {
  ev.preventDefault();
  const identity = appStore.identity();
  const status = requireById("exo-status");
  const out = requireById("exo-results");
  const go = /** @type {HTMLButtonElement} */ (requireById("exo-go"));
  if (!identity.commanderId) {
    status.classList.add("error");
    status.textContent = "Waiting for the commander profile...";
    return;
  }
  const requestId = ++exobiologySearchRequestId;
  go.disabled = true;
  status.classList.remove("error");
  status.textContent = "Searching Spansh for nearby bio-rich worlds… (~5–15s)";
  clear(out);
  try {
    const params = {
      max_gravity: /** @type {HTMLInputElement} */ (requireById("exo-grav")).value || "0.5",
      min_value: /** @type {HTMLInputElement} */ (requireById("exo-minvalue")).value || "1000000",
      genera: exoGenera.size ? [...exoGenera].join(",") : undefined,
    };
    const data = await navigationApi.findExobiologyRoute(params);
    if (!appStore.isCurrent(identity)) return;
    const systems = data.systems || [];
    if (!systems.length) {
      status.textContent = exoGenera.size
        ? `No landable bodies hosting ${[...exoGenera].sort().join(", ")} found nearby — try clearing genera, raising Max gravity or lowering Min value.`
        : "No landable bodies with biological signals found near you at all — you may be in truly deep space.";
      return;
    }
    const genusNote = exoGenera.size ? `${[...exoGenera].sort().join(", ")} · ` : "";
    const relaxNote = data.relaxed
      ? `Nothing cleared your ${data.relaxed} filter nearby, so here are the closest matching worlds regardless. `
      : "";
    status.textContent =
      relaxNote +
      genusNote +
      `${systems.length} systems in visit order · ≈${fmtUnknownNumber(data.total_value)} cr of exobiology if you sample it all (species nobody has logged yet pay 5×).`;

    const firstSystem = systems[0];
    const lastSystem = systems.at(-1);
    if (!firstSystem || !lastSystem) return;
    const summary = document.createElement("div");
    summary.className = "route-summary";
    render(
      summary,
      html`<span class="profit">≈${fmtUnknownNumber(data.total_value)} cr</span>
        <span>${systems.length} systems</span>
        <span>${firstSystem.distance}–${lastSystem.distance} ly out</span>`,
    );
    summary.appendChild(
      trackButton("exobio", "Exobiology route", () =>
        systems.map((s) => ({
          system: s.system,
          note: `≈${fmtUnknownNumber(s.value)} cr`,
        })),
      ),
    );
    out.appendChild(summary);

    systems.forEach((s, i) => {
      const div = document.createElement("div");
      div.className = "hop";
      div.style.setProperty("--i", String(i));
      const bodies = s.bodies.map(
        (body) =>
          html`<div>
            ${body.body}
            <span class="sub"
              >${body.subtype || ""} · ${body.gravity} g ·
              ${body.dist_ls != null ? `${fmtUnknownNumber(Math.round(body.dist_ls))} ls` : "?"} ·
              ≈${fmtUnknownNumber(body.value)} cr</span
            >
            ${
              body.genuses && body.genuses.length
                ? html`<div class="sub exo-genuses">
                    ${body.genuses.map(
                      (genus, genusIndex) =>
                        html`${genusIndex ? " · " : ""}${
                          exoGenera.has(genus) ? html`<b class="exo-hit">${genus}</b>` : genus
                        }`,
                    )}
                  </div>`
                : ""
            }
          </div>`,
      );
      render(
        div,
        html`<div class="route-line">
            <span class="dim">#${i + 1}</span><b>${s.system}</b>
            <span class="dim">${s.distance} ly</span>
            <span class="profit">≈${fmtUnknownNumber(s.value)} cr</span>
          </div>
          <div class="commodities">${bodies}</div>`,
      );
      const copyBtn = document.createElement("button");
      copyBtn.className = "hb hb-utility hb-icon hb-sm";
      copyBtn.textContent = "⧉";
      copyBtn.title = "Copy system name";
      copyBtn.addEventListener("click", () => void copyText(s.system, copyBtn));
      const line = div.querySelector(".route-line");
      const profit = line?.querySelector(".profit");
      if (!line || !profit) throw new Error("Exobiology route result template is incomplete.");
      line.insertBefore(copyBtn, profit);
      line.insertBefore(plotButton(s.system), profit);
      out.appendChild(div);
    });
  } catch (err) {
    if (isStaleCommanderResponse(err) || !appStore.isCurrent(identity)) return;
    status.classList.add("error");
    status.textContent = err instanceof Error ? err.message : String(err);
  } finally {
    if (requestId === exobiologySearchRequestId) go.disabled = false;
  }
}
