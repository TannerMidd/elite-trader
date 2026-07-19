import { copyText } from "../core/clipboard.js";
import { byId, requireById, setStyleValue } from "../core/dom.js";
import { fmtNum } from "../core/fmt.js";
import { clear, html, render } from "../core/html.js";
import { appStore } from "../core/store.js";
import { isStaleCommanderResponse } from "../api/errors.js";
import { navigationApi } from "../api/navigation.js";
import { trackButton } from "./routes.js";
import { plotButton } from "../shell/status.js";

let richesRequestId = 0;

let neutronRequestId = 0;

/**
 * @typedef {{
 *   name?: string,
 *   type?: string,
 *   terraformable?: boolean,
 *   dist_ls?: number|null,
 *   map_value?: number|null,
 *   scan_value?: number|null,
 * }} RichBody
 * @typedef {{system: string, total_value?: number|null, bodies?: RichBody[]}} RichSystem
 * @typedef {{
 *   system: string,
 *   neutron?: boolean,
 *   jumps?: number|null,
 *   distance_jumped?: number|null,
 *   distance_left?: number|null,
 * }} NeutronWaypoint
 * @typedef {{systems?: RichSystem[]}} RichesResponse
 * @typedef {{waypoints?: NeutronWaypoint[], total_jumps?: number|null}} NeutronResponse
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

/** @param {unknown} error */
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

appStore.onProfileChange(() => {
  richesRequestId += 1;
  neutronRequestId += 1;
  for (const id of ["rr-go", "nr-go"]) {
    const control = /** @type {HTMLButtonElement|null} */ (byId(id));
    if (control) control.disabled = false;
  }
  for (const id of ["rr-status", "rr-results", "nr-status"]) byId(id)?.replaceChildren();
  const body = byId("nr-table")?.querySelector("tbody");
  body?.replaceChildren();
});

/** @param {SubmitEvent|{preventDefault(): void}} ev */
export async function planRiches(ev) {
  ev.preventDefault();
  const identity = appStore.identity();
  const status = element("rr-status");
  const out = element("rr-results");
  const go = button("rr-go");
  if (!identity.commanderId) {
    status.classList.add("error");
    status.textContent = "Waiting for the commander profile...";
    return;
  }
  const requestId = ++richesRequestId;
  go.disabled = true;
  status.classList.remove("error");
  status.textContent = "Asking Spansh for high-value bodies… (~10-30s)";
  clear(out);
  try {
    const data = /** @type {RichesResponse} */ (
      await navigationApi.planRichesRoute({
        jump_range: Number(input("rr-range").value) || undefined,
        radius: Number(input("rr-radius").value) || undefined,
        min_value: Number(input("rr-minvalue").value) || undefined,
        max_results: Number(input("rr-max").value) || undefined,
        loop: input("rr-loop").checked,
      })
    );
    if (requestId !== richesRequestId || !appStore.isCurrent(identity)) return;
    const systems = (data.systems || []).filter((s) => (s.bodies || []).length);
    const total = systems.reduce((a, s) => a + (s.total_value || 0), 0);
    status.textContent = systems.length
      ? `${systems.length} systems in visit order · ≈${fmtNum(total)} cr if you map everything (first discovery/footfall pays more).`
      : "Nothing above the value threshold nearby — lower Min value or raise Radius.";
    if (systems.length) {
      status.append(" ");
      status.appendChild(
        trackButton("riches", "Road to Riches", () =>
          systems.map((s) => ({ system: s.system, note: "≈" + fmtNum(s.total_value) + " cr" })),
        ),
      );
    }
    systems.forEach((s, i) => {
      const div = document.createElement("div");
      div.className = "hop";
      setStyleValue(div, "--i", i);
      const bodies = (s.bodies || []).map(
        (b) =>
          html`<div>
            ${b.name}
            <span class="sub"
              >${b.type || "?"}${b.terraformable ? " · terraformable" : ""} ·
              ${b.dist_ls != null ? fmtNum(b.dist_ls) + " ls" : "?"} ·
              ≈${fmtNum(b.map_value || b.scan_value)} cr</span
            >
          </div>`,
      );
      render(
        div,
        html`<div class="route-line">
            <span class="dim">#${i + 1}</span><b>${s.system}</b
            ><span class="profit">≈${fmtNum(s.total_value)} cr</span>
          </div>
          <div class="commodities">${bodies}</div>`,
      );
      const line = div.querySelector(".route-line");
      if (!line) return;
      const copyBtn = document.createElement("button");
      copyBtn.className = "hb hb-utility hb-icon hb-sm";
      copyBtn.textContent = "⧉";
      copyBtn.title = "Copy system name";
      copyBtn.addEventListener("click", () => copyText(s.system, copyBtn));
      line.insertBefore(copyBtn, line.querySelector(".profit"));
      line.insertBefore(plotButton(s.system), line.querySelector(".profit"));
      out.appendChild(div);
    });
  } catch (err) {
    if (
      requestId !== richesRequestId ||
      isStaleCommanderResponse(err) ||
      !appStore.isCurrent(identity)
    )
      return;
    status.classList.add("error");
    status.textContent = errorMessage(err);
  } finally {
    if (requestId === richesRequestId) go.disabled = false;
  }
}

/** @param {SubmitEvent|{preventDefault(): void}} ev */
export async function planNeutron(ev) {
  ev.preventDefault();
  const identity = appStore.identity();
  const status = element("nr-status");
  const table = /** @type {HTMLTableElement} */ (requireById("nr-table"));
  const tbody = /** @type {HTMLTableSectionElement} */ (table.querySelector("tbody"));
  const go = button("nr-go");
  if (!identity.commanderId) {
    status.classList.add("error");
    status.textContent = "Waiting for the commander profile...";
    return;
  }
  const requestId = ++neutronRequestId;
  go.disabled = true;
  status.classList.remove("error");
  status.textContent = "Plotting neutron route… (~10-30s)";
  try {
    const data = /** @type {NeutronResponse} */ (
      await navigationApi.planNeutronRoute({
        to: input("nr-to").value.trim(),
        jump_range: Number(input("nr-range").value) || undefined,
        efficiency: Number(input("nr-eff").value) || undefined,
      })
    );
    if (requestId !== neutronRequestId || !appStore.isCurrent(identity)) return;
    const wps = data.waypoints || [];
    status.textContent = `${data.total_jumps} jumps total across ${wps.length} waypoints — plot each waypoint as you reach the previous one.`;
    // Pre-flight fuel check: neutron stars can't be scooped, so flag legs
    // longer than the tank's estimated jump budget (worst recent burn).
    const snapshot = appStore.getSnapshot();
    const nav = snapshot && typeof snapshot === "object" ? Reflect.get(snapshot, "nav") : null;
    const fuelPerJump =
      nav && typeof nav === "object" ? Number(Reflect.get(nav, "fuel_per_jump")) : 0;
    const fuelCapacity =
      snapshot && typeof snapshot === "object" ? Number(Reflect.get(snapshot, "fuel_capacity")) : 0;
    const tankJumps =
      fuelPerJump > 0 && fuelCapacity > 0 ? Math.floor(fuelCapacity / fuelPerJump) : null;
    if (wps.length && tankJumps) {
      status.append(
        ` ⛽ Your tank ≈${tankJumps} jumps at recent burn — neutron stars can't be scooped, so top off before flagged legs.`,
      );
    }
    if (wps.length) {
      status.append(" ");
      status.appendChild(
        trackButton("neutron", "Neutron: " + (input("nr-to").value.trim() || "route"), () =>
          wps.map((w) => ({ system: w.system, note: w.neutron ? "☄ neutron" : "" })),
        ),
      );
    }
    clear(tbody);
    wps.forEach((w, i) => {
      const dryLeg = tankJumps != null && w.jumps != null && w.jumps >= tankJumps;
      const tr = document.createElement("tr");
      render(
        tr,
        html`<td>${i + 1}</td>
          <td>
            ${w.system} ${w.neutron ? html`<span class="orange">☄ neutron</span>` : false}
            ${
              dryLeg
                ? html`<span
                    class="warn"
                    title="Reaching this waypoint takes about a full tank at your recent burn rate. Top off first and refuel at a normal (KGB FOAM) star along the way."
                    >⚠ ${w.jumps}-jump leg — top off</span
                  >`
                : false
            }
          </td>
          <td class="num">
            ${w.distance_jumped != null ? Number(w.distance_jumped).toFixed(1) : ""}
          </td>
          <td class="num">${w.distance_left != null ? Number(w.distance_left).toFixed(0) : ""}</td>
          <td class="num">${w.jumps ?? ""}</td>`,
      );
      const td = document.createElement("td");
      const copyBtn = document.createElement("button");
      copyBtn.className = "hb hb-utility hb-icon hb-sm";
      copyBtn.textContent = "⧉";
      copyBtn.title = "Copy system name";
      copyBtn.addEventListener("click", () => copyText(w.system, copyBtn));
      td.appendChild(copyBtn);
      td.appendChild(plotButton(w.system));
      tr.appendChild(td);
      tbody.appendChild(tr);
    });
    table.classList.toggle("hidden", wps.length === 0);
  } catch (err) {
    if (
      requestId !== neutronRequestId ||
      isStaleCommanderResponse(err) ||
      !appStore.isCurrent(identity)
    )
      return;
    status.classList.add("error");
    status.textContent = errorMessage(err);
  } finally {
    if (requestId === neutronRequestId) go.disabled = false;
  }
}
