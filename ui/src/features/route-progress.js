import { byId, requireById, setPercentStyle } from "../core/dom.js";
import { clear, html, render } from "../core/html.js";
import { appStore } from "../core/store.js";
import { plotButton } from "../shell/status.js";
import { speak } from "../shell/voice.js";
import {
  changeActiveRouteIndex,
  clearActiveRoute,
  getActiveRoute,
  saveActiveRoute,
  startActiveRoute,
  syncActiveRoute,
} from "./route-state.js";

/** @typedef {{system: string, note?: string}} RouteWaypoint */

/** @param {unknown} first @param {unknown} second */
export function sysEq(first, second) {
  return (
    String(first ?? "")
      .trim()
      .toLowerCase() ===
    String(second ?? "")
      .trim()
      .toLowerCase()
  );
}

/**
 * @param {string} kind
 * @param {string} label
 * @param {RouteWaypoint[]|null|undefined} waypoints
 */
export function trackRoute(kind, label, waypoints) {
  if (!startActiveRoute(kind, label, waypoints)) return;
  syncRouteToPosition();
  saveActiveRoute();
  renderRouteProgress();
  const wrap = /** @type {HTMLElement|null} */ (byId("route-progress"));
  wrap?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

/** @param {number} delta */
export function advanceRoute(delta) {
  if (!changeActiveRouteIndex(delta)) return;
  saveActiveRoute();
  renderRouteProgress();
}

export function stopRoute() {
  clearActiveRoute();
  saveActiveRoute();
  renderRouteProgress();
}

export function syncRouteToPosition() {
  const snapshot = appStore.getSnapshot();
  const system = snapshot && typeof snapshot === "object" ? Reflect.get(snapshot, "system") : null;
  const result = syncActiveRoute(system);
  if (!result) return false;
  if (result.complete) {
    speak("Route complete.");
  } else if (result.next) {
    speak(
      `Waypoint ${result.route.index} of ${result.route.waypoints.length} reached. ` +
        `Next, ${result.next.system}.`,
    );
  }
  return true;
}

export function renderRouteProgress() {
  renderPanelRouteLine();
  const wrap = /** @type {HTMLElement|null} */ (byId("route-progress"));
  if (!wrap) return;
  const route = getActiveRoute();
  if (!route) {
    wrap.classList.add("hidden");
    clear(wrap);
    return;
  }
  const total = route.waypoints.length;
  const done = Math.min(route.index, total);
  const complete = done >= total;
  const target = complete ? null : (route.waypoints[done] ?? null);
  const percent = total ? Math.round((done / total) * 100) : 0;

  wrap.classList.remove("hidden");
  render(
    wrap,
    html`<div class="rp-main">
        <span class="rp-badge">◈ ROUTE</span>
        <span class="rp-label">${route.label}</span>
        <span class="rp-count">${done}/${total}${complete ? " · done" : ""}</span>
        ${
          target
            ? html`<span class="rp-next"
                >NEXT
                <b>${target.system}</b
                >${target.note ? html`<span class="dim">${target.note}</span>` : false}</span
              >`
            : html`<span class="rp-next rp-done">Arrived — route complete 🎉</span>`
        }
      </div>
      <div class="rp-bar"><div style="width:${percent}%"></div></div>`,
  );

  const main = /** @type {HTMLElement|null} */ (wrap.querySelector(".rp-main"));
  if (!main) return;
  if (target) {
    const next = main.querySelector(".rp-next");
    main.insertBefore(plotButton(target.system), next?.nextSibling ?? null);
    const skip = document.createElement("button");
    skip.className = "hb hb-utility rp-skip";
    skip.textContent = "✓ done";
    skip.title = "Mark this waypoint reached";
    skip.addEventListener("click", () => advanceRoute(1));
    main.appendChild(skip);
  }
  if (done > 0 && !complete) {
    const back = document.createElement("button");
    back.className = "hb hb-utility rp-back";
    back.textContent = "↩";
    back.title = "Step back one waypoint";
    back.addEventListener("click", () => advanceRoute(-1));
    main.appendChild(back);
  }
  const stop = document.createElement("button");
  stop.className = "hb hb-utility hb-icon hb-sm hb-danger rp-stop";
  stop.textContent = "✕";
  stop.title = "Stop tracking this route";
  stop.setAttribute("aria-label", "Stop tracking route");
  stop.addEventListener("click", stopRoute);
  main.appendChild(stop);
}

export function renderPanelRouteLine() {
  const line = /** @type {HTMLElement|null} */ (byId("fp-routeline"));
  if (!line) return;
  const route = getActiveRoute();
  if (!route?.waypoints.length) {
    line.classList.add("hidden");
    return;
  }
  const total = route.waypoints.length;
  const done = Math.min(route.index, total);
  line.classList.remove("hidden");
  setPercentStyle(
    /** @type {HTMLElement} */ (requireById("fp-route-fill")),
    "width",
    total ? Math.round((done / total) * 100) : 0,
  );
  const text = /** @type {HTMLElement} */ (requireById("fp-route-text"));
  text.textContent =
    done >= total
      ? "ROUTE COMPLETE"
      : `WAYPOINT ${done + 1} / ${total} · ${route.waypoints[done]?.system.toUpperCase() ?? ""}`;
}

/**
 * @param {string} kind
 * @param {string} label
 * @param {() => RouteWaypoint[]} waypoints
 */
export function trackButton(kind, label, waypoints) {
  const button = document.createElement("button");
  button.className = "hb hb-utility trackbtn";
  button.type = "button";
  button.textContent = "◈ TRACK";
  button.title = "Follow this route step by step (marks your progress as you jump)";
  button.addEventListener("click", () => trackRoute(kind, label, waypoints()));
  return button;
}
