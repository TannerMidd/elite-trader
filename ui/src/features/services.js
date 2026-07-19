import { byId, requireById, setSafeHref } from "../core/dom.js";
import { fmtNum } from "../core/fmt.js";
import { clear, html, render } from "../core/html.js";
import { appStore } from "../core/store.js";
import { isStaleCommanderResponse } from "../api/errors.js";
import { marketApi } from "../api/market.js";
import { systemApi } from "../api/system.js";
import { plotButton } from "../shell/status.js";

let dataSaleRequestId = 0;

let interstellarFactorsRequestId = 0;

/**
 * @typedef {{
 *   station: string,
 *   system: string,
 *   distance?: number|null,
 *   dist_ls?: number|null,
 *   large_pad?: boolean,
 *   carrier?: boolean,
 * }} ServiceStation
 * @typedef {{
 *   reference?: string,
 *   carto?: ServiceStation[],
 *   bio?: ServiceStation[],
 *   stations?: ServiceStation[],
 * }} ServiceSearchResponse
 * @typedef {{
 *   commander_id?: string,
 *   has_loadout?: boolean,
 *   ship_type?: string,
 *   ship_name?: string,
 *   ship_ident?: string,
 *   rebuy?: number|null,
 *   max_jump_range?: number|null,
 *   cargo_capacity?: number|null,
 * }} LoadoutSnapshot
 * @typedef {{edsy_url: string, slef: unknown}} LoadoutResponse
 */

/** @param {string} id */
function element(id) {
  return /** @type {HTMLElement} */ (requireById(id));
}

/** @param {string} id */
function input(id) {
  return /** @type {HTMLInputElement} */ (requireById(id));
}

/** @param {string} id */
function button(id) {
  return /** @type {HTMLButtonElement} */ (requireById(id));
}

function currentJumpRange() {
  const snapshot = appStore.getSnapshot();
  const value =
    snapshot && typeof snapshot === "object" ? Number(Reflect.get(snapshot, "max_jump_range")) : 0;
  return value > 0 ? value : null;
}

/** @param {unknown} error */
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

appStore.onProfileChange(() => {
  dataSaleRequestId += 1;
  interstellarFactorsRequestId += 1;
  for (const id of ["sd-go", "iff-go"]) {
    const control = /** @type {HTMLButtonElement|null} */ (byId(id));
    if (control) control.disabled = false;
  }
  for (const id of ["sd-status", "sd-results", "iff-status", "iff-results"]) {
    byId(id)?.replaceChildren();
  }
  resetLoadoutExport();
});

/** @param {SubmitEvent|{preventDefault(): void}} ev */
export async function findSellPoints(ev) {
  ev.preventDefault();
  const identity = appStore.identity();
  const btn = button("sd-go");
  const status = element("sd-status");
  const out = element("sd-results");
  if (!identity.commanderId) {
    status.classList.add("error");
    status.textContent = "Waiting for the commander profile...";
    return;
  }
  const requestId = ++dataSaleRequestId;
  btn.disabled = true;
  status.classList.remove("error");
  status.textContent = "Searching outward from your position… (~5s)";
  clear(out);
  try {
    const data = /** @type {ServiceSearchResponse} */ (
      await marketApi.findDataSaleStations(input("sd-carriers").checked)
    );
    if (requestId !== dataSaleRequestId || !appStore.isCurrent(identity)) return;
    const sections = /** @type {const} */ ([
      ["carto", "UNIVERSAL CARTOGRAPHICS", "sells your exploration map data"],
      ["bio", "VISTA GENOMICS", "sells your bio samples"],
    ]);
    status.textContent = `Nearest ports from ${data.reference || "your position"}:`;
    for (const [key, title, blurb] of sections) {
      const rows = data[key] || [];
      const sec = document.createElement("div");
      sec.className = "sd-section";
      render(sec, html`<div class="label">${title} <span class="dim">${blurb}</span></div>`);
      if (!rows.length) {
        const empty = document.createElement("div");
        empty.className = "dim empty";
        empty.textContent = "None found — widen the search by including fleet carriers.";
        sec.appendChild(empty);
        out.appendChild(sec);
        continue;
      }
      const wrap = document.createElement("div");
      wrap.className = "table-wrap";
      const range = currentJumpRange();
      const table = document.createElement("table");
      render(
        table,
        html`<thead>
          <tr>
            <th>Station</th>
            <th>System</th>
            <th class="num">Jump</th>
            ${
              range
                ? html`<th
                    class="num"
                    title="At your ship's ${range.toFixed(1)} ly jump range — before neutron boosts"
                  >
                    ≈ Jumps
                  </th>`
                : ""
            }
            <th class="num">Star dist</th>
            <th>Pad</th>
            <th></th>
          </tr>
        </thead>`,
      );
      const tbody = document.createElement("tbody");
      for (const s of rows) {
        const tr = document.createElement("tr");
        render(
          tr,
          html`<td>
              ${s.station}${
                s.carrier
                  ? html` <span
                      class="chip"
                      title="Fleet carriers move — this position may be stale. Check before committing to the trip."
                      >CARRIER</span
                    >`
                  : ""
              }
            </td>
            <td class="dim">${s.system}</td>
            <td class="num">${fmtNum(s.distance)} ly</td>
            ${
              range
                ? html`<td class="num">
                    ${(s.distance || 0) > 0 ? Math.max(1, Math.ceil((s.distance || 0) / range)) : 0}
                  </td>`
                : ""
            }
            <td class="num">${s.dist_ls != null ? fmtNum(Math.round(s.dist_ls)) + " ls" : "—"}</td>
            <td>${s.large_pad ? "L" : "M/S"}</td>`,
        );
        const td = document.createElement("td");
        td.className = "num";
        td.appendChild(plotButton(s.system));
        tr.appendChild(td);
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      wrap.appendChild(table);
      sec.appendChild(wrap);
      out.appendChild(sec);
    }
  } catch (err) {
    if (
      requestId !== dataSaleRequestId ||
      isStaleCommanderResponse(err) ||
      !appStore.isCurrent(identity)
    )
      return;
    status.classList.add("error");
    status.textContent = errorMessage(err);
  } finally {
    if (requestId === dataSaleRequestId) btn.disabled = false;
  }
}

/** @param {SubmitEvent|{preventDefault(): void}} ev */
export async function findInterstellarFactors(ev) {
  ev.preventDefault();
  const identity = appStore.identity();
  const btn = button("iff-go");
  const status = element("iff-status");
  const out = element("iff-results");
  if (!identity.commanderId) {
    status.classList.add("error");
    status.textContent = "Waiting for the commander profile...";
    return;
  }
  const requestId = ++interstellarFactorsRequestId;
  btn.disabled = true;
  status.classList.remove("error");
  status.textContent = "Searching outward from your position… (~5s)";
  clear(out);
  try {
    const data = /** @type {ServiceSearchResponse} */ (await marketApi.findInterstellarFactors());
    if (requestId !== interstellarFactorsRequestId || !appStore.isCurrent(identity)) return;
    const rows = data.stations || [];
    if (!rows.length) {
      status.textContent = "None found nearby — try again from a more populated system.";
      return;
    }
    status.textContent = `Nearest Interstellar Factors from ${data.reference || "your position"}:`;
    const range = currentJumpRange();
    const wrap = document.createElement("div");
    wrap.className = "table-wrap";
    const table = document.createElement("table");
    render(
      table,
      html`<thead>
        <tr>
          <th>Station</th>
          <th>System</th>
          <th class="num">Jump</th>
          ${
            range
              ? html`<th class="num" title="At your ship's ${range.toFixed(1)} ly jump range">
                  ≈ Jumps
                </th>`
              : ""
          }
          <th class="num">Star dist</th>
          <th>Pad</th>
          <th></th>
        </tr>
      </thead>`,
    );
    const tbody = document.createElement("tbody");
    for (const s of rows) {
      const tr = document.createElement("tr");
      render(
        tr,
        html`<td>${s.station}</td>
          <td class="dim">${s.system}</td>
          <td class="num">${fmtNum(s.distance)} ly</td>
          ${
            range
              ? html`<td class="num">
                  ${(s.distance || 0) > 0 ? Math.max(1, Math.ceil((s.distance || 0) / range)) : 0}
                </td>`
              : ""
          }
          <td class="num">${s.dist_ls != null ? fmtNum(Math.round(s.dist_ls)) + " ls" : "—"}</td>
          <td>${s.large_pad ? "L" : "M/S"}</td>`,
      );
      const td = document.createElement("td");
      td.className = "num";
      td.appendChild(plotButton(s.system));
      tr.appendChild(td);
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    wrap.appendChild(table);
    out.appendChild(wrap);
  } catch (err) {
    if (
      requestId !== interstellarFactorsRequestId ||
      isStaleCommanderResponse(err) ||
      !appStore.isCurrent(identity)
    )
      return;
    status.classList.add("error");
    status.textContent = errorMessage(err);
  } finally {
    if (requestId === interstellarFactorsRequestId) btn.disabled = false;
  }
}

/** @type {string|null} */
export let loadoutSig = null;

/** @type {string} */
export let loadoutSlef = "";

const LOADOUT_WAITING_TEXT =
  "Open your live loadout in a ship builder to plan the next module or engineering upgrade — fills in when the game reports a loadout (launch or switch ships).";

/**
 * Clear every commander-owned loadout artifact from the document.
 *
 * This hook is intentionally safe before the Guides pane is mounted so the
 * profile lifecycle can call it unconditionally.
 */
export function resetLoadoutExport() {
  loadoutSig = null;
  loadoutSlef = "";
  const link = /** @type {HTMLAnchorElement|null} */ (byId("build-edsy"));
  const button = /** @type {HTMLButtonElement|null} */ (byId("build-slef"));
  const description = /** @type {HTMLElement|null} */ (byId("build-current-desc"));
  link?.classList.add("hidden");
  link?.removeAttribute("href");
  button?.classList.add("hidden");
  if (description) description.textContent = LOADOUT_WAITING_TEXT;
}

/**
 * @param {LoadoutSnapshot} snapshot
 * @param {{commanderId: string|null, generation: number}} identity
 */
function loadoutSignature(snapshot, identity) {
  return [
    identity.commanderId,
    identity.generation,
    snapshot.ship_type,
    snapshot.ship_name,
    snapshot.ship_ident,
    snapshot.rebuy,
    snapshot.max_jump_range,
    snapshot.cargo_capacity,
  ].join("|");
}

export async function refreshLoadoutExport() {
  const a = /** @type {HTMLAnchorElement|null} */ (byId("build-edsy"));
  if (!a) return;
  const btn = /** @type {HTMLButtonElement} */ (requireById("build-slef"));
  const desc = element("build-current-desc");
  const snapshot = /** @type {LoadoutSnapshot|null} */ (appStore.getSnapshot());
  const identity = appStore.identity();
  if (!snapshot?.has_loadout || !identity.commanderId) {
    resetLoadoutExport();
    return;
  }
  const sig = loadoutSignature(snapshot, identity);
  if (sig === loadoutSig) return;
  loadoutSig = sig;
  try {
    const data = /** @type {LoadoutResponse} */ (await systemApi.getLoadoutExport());
    if (!appStore.isCurrent(identity) || loadoutSig !== sig) return;
    const currentSnapshot = /** @type {LoadoutSnapshot|null} */ (appStore.getSnapshot());
    if (!currentSnapshot?.has_loadout || loadoutSignature(currentSnapshot, identity) !== sig) {
      return;
    }
    const label = [
      snapshot.ship_name || snapshot.ship_type,
      snapshot.ship_ident ? "(" + snapshot.ship_ident + ")" : "",
    ]
      .filter(Boolean)
      .join(" ");
    desc.textContent =
      `${label || "Your ship"} — open the live build in EDSY to plan the next ` +
      "module or engineering upgrade, or copy SLEF and paste it into Coriolis / Inara.";
    setSafeHref(a, data.edsy_url);
    a.classList.remove("hidden");
    loadoutSlef = typeof data.slef === "string" ? data.slef : JSON.stringify(data.slef, null, 2);
    btn.classList.remove("hidden");
  } catch {
    if (appStore.isCurrent(identity) && loadoutSig === sig) {
      loadoutSig = null; // retry on the next state change
    }
  }
}
