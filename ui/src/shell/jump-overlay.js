/**
 * DOM for the FSD jump-sequence overlay: one full-viewport layer that hosts
 * the <fsd-tunnel> WebGL element plus the charge, transit-HUD, and arrival
 * readouts. Markup is rendered lazily on the first jump so a disabled or
 * never-used overlay costs nothing. Phase choreography lives in
 * jump-sequence.js; this module only owns elements and their toggles.
 */

import { requireById, setStyleValue } from "../core/dom.js";
import { html, render } from "../core/html.js";

/**
 * @typedef {object} OverlayRefs
 * @property {HTMLElement} root
 * @property {HTMLElement} frame
 * @property {HTMLElement} stage
 * @property {HTMLElement} banner
 * @property {HTMLElement} charge
 * @property {HTMLElement} count
 * @property {HTMLElement} chargeDest
 * @property {HTMLElement} chipClass
 * @property {HTMLElement} chipScoop
 * @property {HTMLElement} chargeFill
 * @property {HTMLElement} chargeWarn
 * @property {HTMLElement} hud
 * @property {HTMLElement} hudDest
 * @property {HTMLElement} hudClass
 * @property {HTMLElement} hudEta
 * @property {HTMLElement} hudFuel
 * @property {HTMLElement} hudRoute
 * @property {HTMLElement} hudFill
 * @property {HTMLElement} arrival
 * @property {HTMLElement} arrivalBox
 * @property {HTMLElement} arrivalName
 * @property {HTMLElement} arrivalNote
 * @property {HTMLElement} arrivalTail
 * @property {HTMLButtonElement} skip
 */

/** @type {OverlayRefs|null} */
let refs = null;
/** @type {HTMLElement|null} */
let tunnel = null;
/** @type {number|undefined} */
let hideTimer;

const OVERLAY_MARKUP = html`
  <div class="fsd-frame" data-phase="off">
    <div id="fsd-stage" class="fsd-stage"></div>
    <i class="fsd-corner fsd-tl" aria-hidden="true"></i>
    <i class="fsd-corner fsd-tr" aria-hidden="true"></i>
    <i class="fsd-corner fsd-bl" aria-hidden="true"></i>
    <i class="fsd-corner fsd-br" aria-hidden="true"></i>
    <div id="fsd-banner" class="fsd-banner hidden"></div>
    <div id="fsd-charge" class="fsd-charge hidden">
      <div class="fsd-charge-head">
        <span class="fsd-charge-title">FRAME SHIFT DRIVE</span>
        <span class="fsd-charge-sub">HYPERSPACE CHARGE SEQUENCE</span>
      </div>
      <div class="fsd-ring">
        <i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i>
        <span id="fsd-count">5</span>
      </div>
      <div class="fsd-charge-dest">
        <span class="fsd-label">DESTINATION</span>
        <span id="fsd-charge-name" class="fsd-charge-name"></span>
        <div class="fsd-chips">
          <span id="fsd-chip-class" class="fsd-chip"></span>
          <span id="fsd-chip-scoop" class="fsd-chip"></span>
        </div>
      </div>
      <div class="fsd-charge-foot">
        <div class="fsd-chargebar"><div id="fsd-charge-fill"></div></div>
        <span class="fsd-mono-dim">ALIGNMENT LOCKED · THROTTLE 100%</span>
        <span id="fsd-charge-warn" class="fsd-charge-warn"></span>
        <span class="fsd-firmware"
          >DRIVE FIRMWARE 42.0.1 · SIRIUS CYBERNETICS CORP · SHARE AND ENJOY</span
        >
      </div>
    </div>
    <div id="fsd-hud" class="fsd-hud hidden">
      <div class="fsd-hud-box fsd-hud-nw">
        <span class="fsd-label">DESTINATION ▸</span>
        <span id="fsd-hud-dest" class="fsd-hud-dest"></span>
        <span id="fsd-hud-class" class="fsd-hud-class"></span>
      </div>
      <div class="fsd-hud-box fsd-hud-ne">
        <span class="fsd-label">TRANSIT</span>
        <span id="fsd-hud-eta" class="fsd-hud-eta">T+0.0 S</span>
        <span id="fsd-hud-fuel" class="fsd-mono-dim"></span>
      </div>
      <div class="fsd-hud-box fsd-hud-sw">
        <span id="fsd-hud-route" class="fsd-hud-route"></span>
        <div class="fsd-routebar"><div id="fsd-hud-fill"></div></div>
      </div>
      <span class="fsd-hud-tag">◆ HYPERSPACE TRANSIT ◆</span>
    </div>
    <div id="fsd-arrival" class="fsd-arrival hidden">
      <div id="fsd-arrival-box" class="fsd-arrival-box hidden">
        <span class="fsd-arrival-label">ARRIVAL CONFIRMED</span>
        <span id="fsd-arrival-name" class="fsd-arrival-name"></span>
        <span id="fsd-arrival-note" class="fsd-arrival-note"></span>
        <span id="fsd-arrival-tail" class="fsd-arrival-tail"></span>
      </div>
    </div>
    <button id="fsd-skip" class="hb hb-utility hb-sm fsd-skip" type="button">⏭ SKIP</button>
  </div>
`;

/**
 * Render the overlay markup on first use and return the element handles.
 *
 * @returns {OverlayRefs}
 */
export function ensureOverlay() {
  if (refs) return refs;
  const root = /** @type {HTMLElement} */ (requireById("fsd-overlay"));
  render(root, OVERLAY_MARKUP);
  refs = {
    root,
    frame: /** @type {HTMLElement} */ (root.firstElementChild),
    stage: requireById("fsd-stage"),
    banner: requireById("fsd-banner"),
    charge: requireById("fsd-charge"),
    count: requireById("fsd-count"),
    chargeDest: requireById("fsd-charge-name"),
    chipClass: requireById("fsd-chip-class"),
    chipScoop: requireById("fsd-chip-scoop"),
    chargeFill: requireById("fsd-charge-fill"),
    chargeWarn: requireById("fsd-charge-warn"),
    hud: requireById("fsd-hud"),
    hudDest: requireById("fsd-hud-dest"),
    hudClass: requireById("fsd-hud-class"),
    hudEta: requireById("fsd-hud-eta"),
    hudFuel: requireById("fsd-hud-fuel"),
    hudRoute: requireById("fsd-hud-route"),
    hudFill: requireById("fsd-hud-fill"),
    arrival: requireById("fsd-arrival"),
    arrivalBox: requireById("fsd-arrival-box"),
    arrivalName: requireById("fsd-arrival-name"),
    arrivalNote: requireById("fsd-arrival-note"),
    arrivalTail: requireById("fsd-arrival-tail"),
    skip: /** @type {HTMLButtonElement} */ (requireById("fsd-skip")),
  };
  return refs;
}

/**
 * Create (or reuse) the WebGL tunnel element and sync its attributes. The
 * element only exists while a sequence runs, so an idle panel holds no GL
 * context at all.
 *
 * @param {{phase: string, variant: string, intensity: number, progress?: number,
 *   rflash: boolean}} attrs
 */
export function mountTunnel(attrs) {
  const { stage } = ensureOverlay();
  if (!tunnel) {
    tunnel = document.createElement("fsd-tunnel");
    stage.appendChild(tunnel);
  }
  tunnel.setAttribute("variant", attrs.variant);
  tunnel.setAttribute("intensity", attrs.intensity.toFixed(2));
  tunnel.setAttribute("rflash", attrs.rflash ? "1" : "0");
  if (attrs.progress != null) tunnel.setAttribute("progress", attrs.progress.toFixed(2));
  tunnel.setAttribute("phase", attrs.phase);
}

/** Drop the tunnel element (and with it the WebGL context and its rAF loop). */
export function unmountTunnel() {
  tunnel?.remove();
  tunnel = null;
}

/**
 * Reveal the overlay layer, cancelling any pending post-fade teardown.
 *
 * @param {OverlayRefs} overlay
 */
export function showOverlay(overlay) {
  clearTimeout(hideTimer);
  overlay.root.classList.remove("hidden");
  // Commit the un-hide with a forced reflow before starting the fade-in.
  // Deliberately not requestAnimationFrame: a backgrounded panel gets no
  // frames, and the overlay must still be faded in when the screen wakes.
  void overlay.root.offsetWidth;
  overlay.root.classList.add("fsd-on");
}

/**
 * Fade the overlay out, then remove it from the layout entirely.
 *
 * @param {OverlayRefs} overlay
 */
export function hideOverlay(overlay) {
  overlay.root.classList.remove("fsd-on");
  clearTimeout(hideTimer);
  hideTimer = window.setTimeout(() => {
    overlay.root.classList.add("hidden");
    overlay.frame.dataset.phase = "off";
  }, 600);
}

/**
 * Swap the visible phase block. CSS keys off data-phase for dimming; the
 * sub-blocks are plain hidden-toggles so tests can assert on them.
 *
 * @param {OverlayRefs} overlay
 * @param {"charge"|"tunnel"|"arrival"} phase
 */
export function setOverlayPhase(overlay, phase) {
  overlay.frame.dataset.phase = phase;
  overlay.charge.classList.toggle("hidden", phase !== "charge");
  overlay.hud.classList.toggle("hidden", phase !== "tunnel");
  overlay.arrival.classList.toggle("hidden", phase !== "arrival");
  if (phase !== "arrival") overlay.arrivalBox.classList.add("hidden");
  // The variant banner rides the charge and tunnel only; the arrival star
  // deserves an uncluttered sky (its note line carries the same warning).
  if (phase === "arrival") overlay.banner.classList.add("hidden");
}

/**
 * Neutron/critical warning strip across the top of the sequence.
 *
 * @param {OverlayRefs} overlay
 * @param {{text: string, tone: "neutron"|"critical"}|null} banner
 */
export function setOverlayBanner(overlay, banner) {
  overlay.banner.classList.toggle("hidden", !banner);
  overlay.banner.textContent = banner ? banner.text : "";
  overlay.banner.classList.toggle("fsd-banner-neutron", banner?.tone === "neutron");
  overlay.banner.classList.toggle("fsd-banner-critical", banner?.tone === "critical");
}

/**
 * @param {HTMLElement} element
 * @param {string} color
 */
export function tintClassChip(element, color) {
  setStyleValue(element, "color", color);
  setStyleValue(element, "--fsd-chip-color", color);
}
