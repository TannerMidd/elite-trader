/**
 * FSD jump-sequence choreography for the flight panel.
 *
 * The server publishes a `jump` block from the moment the game commits a
 * hyperspace jump (StartJump) until arrival (FSDJump). This module turns that
 * signal into the cinematic overlay: charge countdown → witchspace tunnel →
 * arrival reveal, with neutron-star and low-fuel variants. Everything is
 * gated behind the device-local "FSD jump sequence" setting and only plays in
 * panel mode; the settings page can run a canned preview anywhere.
 */

import { displayValue } from "../core/display-preferences.js";
import { setPercentStyle, setStyleValue } from "../core/dom.js";
import {
  ensureOverlay,
  hideOverlay,
  mountTunnel,
  setOverlayBanner,
  setOverlayPhase,
  showOverlay,
  tintClassChip,
  unmountTunnel,
} from "./jump-overlay.js";

/** @import {ApplicationState, JumpProgress} from "../api/contracts/state.js" */
/** @import {OverlayRefs} from "./jump-overlay.js" */

/**
 * @typedef {ApplicationState & {
 *   nav: ApplicationState["nav"] & {ahead?: {scoopable?: boolean}[]},
 *   jump_history: (ApplicationState["jump_history"][number] & {dist?: number|null})[],
 * }} SequenceSnapshot
 */

/**
 * @typedef {object} JumpSequenceState
 * @property {"charge"|"tunnel"|"arrival"} phase
 * @property {"live"|"preview"} mode
 * @property {"standard"|"neutron"|"critical"} variant
 * @property {string} destination
 * @property {string} starClass
 * @property {boolean} scoopable
 * @property {string|null} fromSystem
 * @property {string} routeLine
 * @property {string} fuelLine
 * @property {number} chargeTotalS
 * @property {number} joinElapsedS
 * @property {number} tunnelOffsetS
 * @property {number} phaseStart
 * @property {number} timer
 * @property {boolean} revealed
 * @property {boolean} fading
 */

// The in-game hyperspace countdown runs ~5 s from StartJump; the witchspace
// transit usually lands in 14–18 s but has no event of its own, so the
// progress bar runs against an estimate and the real FSDJump ends the phase.
const COUNTDOWN_S = 5;
const TUNNEL_ESTIMATE_S = 16;
const TUNNEL_FAILSAFE_S = 75;
const STALE_TRIGGER_S = 30;
const PREVIEW_TUNNEL_S = 8;
const ARRIVAL_REVEAL_S = 1.5;
const ARRIVAL_FADE_S = 4.2;
const ARRIVAL_END_S = 4.9;
const TICK_MS = 120;

/** @type {JumpSequenceState|null} */
let seq = null;
/** @type {number|null} */
let seenToken = null;
/** @type {number|undefined} */
let teardownTimer;

/** Device-local master switch; on unless explicitly disabled in Settings. */
export function jumpSequenceEnabled() {
  return localStorage.getItem("fsdSeq") !== "0";
}

/** Photosensitivity guard: caps the white flashes inside the WebGL tunnel. */
export function reduceJumpFlash() {
  return localStorage.getItem("fsdSeqReduceFlash") === "1";
}

function sequenceIntensity() {
  return Math.min(1, Math.max(0.3, displayValue("fsdSeqIntensity") / 100));
}

/** @type {readonly [RegExp, string, string][]} */
const STAR_STYLES = [
  [/^N/u, "NEUTRON STAR · CONE TRANSIT", "#7de5ff"],
  [/^H/u, "BLACK HOLE", "#c9d2e0"],
  [/^D/u, "WHITE DWARF", "#dfe9ff"],
  [/^(?:L|T$|T\d|Y)/u, "BROWN DWARF · SUBSTELLAR", "#ff9d7a"],
  [/^(?:TTS|AeBe)/u, "PROTO-STAR", "#ffd9a0"],
  [/^[OB]/u, "MAIN SEQUENCE", "#9fc7ff"],
  [/^A/u, "MAIN SEQUENCE", "#dfe9ff"],
  [/^[FG]/u, "MAIN SEQUENCE", "#ffe9b0"],
  [/^[KM]/u, "MAIN SEQUENCE", "#ffb46b"],
];

/**
 * Human line + tint for a journal star class ("K", "N", "TTS", …).
 *
 * @param {string} starClass
 * @returns {{line: string, color: string}}
 */
export function describeStarClass(starClass) {
  const cls = starClass.trim().toUpperCase();
  if (!cls) return { line: "UNCHARTED MASS", color: "var(--dim)" };
  for (const [pattern, kind, color] of STAR_STYLES) {
    if (pattern.test(cls)) {
      const line = kind.includes("·") || !/^[OBAFGKM]/u.test(cls) ? kind : `${cls} · ${kind}`;
      return { line, color };
    }
  }
  return { line: `${cls} CLASS`, color: "var(--orange-soft)" };
}

/** @param {SequenceSnapshot} snapshot */
function fuelPercent(snapshot) {
  const capacity = snapshot.fuel_capacity || 0;
  if (capacity <= 0 || snapshot.fuel_main == null) return 100;
  return (snapshot.fuel_main / capacity) * 100;
}

/**
 * One renderer call per state poll (~1.5 s), from the shell.
 *
 * @param {ApplicationState|null} [snapshot]
 */
export function renderJumpSequence(snapshot) {
  if (!snapshot) return;
  const snap = /** @type {SequenceSnapshot} */ (snapshot);
  const jump = snap.jump ?? null;
  if (seq) {
    if (seq.mode === "preview" || seq.phase === "arrival") return;
    if (!jump) {
      // The jump block cleared: either the FSDJump landed (system moved) or
      // the signal expired without an arrival — fade out, no celebration.
      if (snap.system && snap.system !== seq.fromSystem) beginArrival(snap);
      else endSequence();
    }
    return;
  }
  if (!jump || jump.started_ms === seenToken) return;
  if (!jumpSequenceEnabled() || !document.body.classList.contains("panel-mode")) return;
  if (jump.elapsed_s > STALE_TRIGGER_S) return;
  seenToken = jump.started_ms;
  beginSequence(jump, snap);
}

/**
 * @param {JumpProgress} jump
 * @param {SequenceSnapshot} snapshot
 */
function beginSequence(jump, snapshot) {
  const starClass = (jump.star_class || "").trim();
  const fuelPct = fuelPercent(snapshot);
  const variant =
    starClass.toUpperCase() === "N" ? "neutron" : fuelPct < 25 ? "critical" : "standard";
  const ahead = snapshot.nav?.ahead || [];
  const jumpsLeft = ahead.length > 1 ? ahead.length - 1 : 0;
  const routeLine = snapshot.destination
    ? `ROUTE TO ${snapshot.destination.toUpperCase()}` +
      (jumpsLeft ? ` · ${jumpsLeft} JUMP${jumpsLeft === 1 ? "" : "S"} LEFT` : "")
    : "DIRECT JUMP";
  start({
    mode: "live",
    variant,
    destination: (jump.system || "UNKNOWN DESTINATION").toUpperCase(),
    starClass,
    scoopable: !!jump.scoopable,
    fromSystem: snapshot.system,
    routeLine,
    fuelLine: snapshot.fuel_main != null ? `FUEL ${snapshot.fuel_main.toFixed(1)} T` : "",
    chargeTotalS: Math.max(0, COUNTDOWN_S - jump.elapsed_s),
    joinElapsedS: jump.elapsed_s,
    fuelPct,
  });
}

/** Canned standard jump for the Settings preview button; runs in any mode. */
export function previewJumpSequence() {
  if (seq) return;
  start({
    mode: "preview",
    variant: "standard",
    destination: "MAIA",
    starClass: "B",
    scoopable: true,
    fromSystem: null,
    routeLine: "SIMULATED JUMP · SETTINGS PREVIEW",
    fuelLine: "FUEL 32.0 T",
    chargeTotalS: COUNTDOWN_S,
    joinElapsedS: 0,
    fuelPct: 100,
  });
}

/**
 * @param {{mode: "live"|"preview", variant: "standard"|"neutron"|"critical",
 *   destination: string, starClass: string, scoopable: boolean,
 *   fromSystem: string|null, routeLine: string, fuelLine: string,
 *   chargeTotalS: number, joinElapsedS: number, fuelPct: number}} plan
 */
function start(plan) {
  clearTimeout(teardownTimer);
  const overlay = ensureOverlay();
  overlay.skip.onclick = () => endSequence();
  seq = {
    phase: "charge",
    mode: plan.mode,
    variant: plan.variant,
    destination: plan.destination,
    starClass: plan.starClass,
    scoopable: plan.scoopable,
    fromSystem: plan.fromSystem,
    routeLine: plan.routeLine,
    fuelLine: plan.fuelLine,
    chargeTotalS: plan.chargeTotalS,
    joinElapsedS: plan.joinElapsedS,
    tunnelOffsetS: 0,
    phaseStart: Date.now(),
    timer: 0,
    revealed: false,
    fading: false,
  };
  const star = describeStarClass(plan.starClass);
  overlay.chargeDest.textContent = plan.destination;
  overlay.chipClass.textContent = star.line;
  tintClassChip(overlay.chipClass, star.color);
  overlay.chipScoop.textContent = plan.scoopable ? "SCOOPABLE" : "NON-SCOOPABLE";
  overlay.chipScoop.classList.toggle("fsd-chip-good", plan.scoopable);
  overlay.chipScoop.classList.toggle("fsd-chip-bad", !plan.scoopable);
  overlay.chargeWarn.textContent = plan.variant === "critical" ? "DON'T PANIC" : "DO NOT DISENGAGE";
  overlay.chargeWarn.classList.toggle("fsd-warn-good", plan.variant === "critical");
  overlay.hudDest.textContent = plan.destination;
  overlay.hudClass.textContent = star.line;
  tintClassChip(overlay.hudClass, star.color);
  overlay.hudRoute.textContent = plan.routeLine;
  overlay.hudFuel.textContent = plan.fuelLine;
  setOverlayBanner(overlay, sequenceBanner(plan));
  setStyleValue(overlay.frame, "--fsd-shake", `${(4.4 - sequenceIntensity() * 1.6).toFixed(1)}s`);
  showOverlay(overlay);
  if (seq.chargeTotalS > 0.4) enterCharge(overlay);
  else enterTunnel(overlay);
  seq.timer = window.setInterval(() => tick(overlay), TICK_MS);
}

/**
 * @param {{variant: string, scoopable: boolean, fuelPct: number}} plan
 * @returns {{text: string, tone: "neutron"|"critical"}|null}
 */
function sequenceBanner(plan) {
  if (plan.variant === "neutron") {
    return { text: "⚡ NEUTRON CONE TRANSIT · FSD SUPERCHARGED ×4", tone: "neutron" };
  }
  if (plan.variant === "critical") {
    const detail = plan.scoopable
      ? "SCOOP IMMEDIATELY ON ARRIVAL"
      : "DESTINATION HAS NO FUEL SOURCE";
    return { text: `⚠ FUEL CRITICAL · ${detail}`, tone: "critical" };
  }
  return null;
}

/** @param {OverlayRefs} overlay */
function enterCharge(overlay) {
  if (!seq) return;
  seq.phase = "charge";
  seq.phaseStart = Date.now();
  setOverlayPhase(overlay, "charge");
  mountTunnel(tunnelAttrs("charge", 0));
}

/** @param {OverlayRefs} overlay */
function enterTunnel(overlay) {
  if (!seq) return;
  // Joining mid-jump (page reload, slow poll): the bar reflects time already
  // spent in witchspace, not just time the overlay has been watching it.
  seq.tunnelOffsetS = Math.max(0, seq.joinElapsedS - COUNTDOWN_S);
  seq.phase = "tunnel";
  seq.phaseStart = Date.now();
  setOverlayPhase(overlay, "tunnel");
  mountTunnel(tunnelAttrs("tunnel"));
}

/** @param {SequenceSnapshot|null} snapshot */
function beginArrival(snapshot) {
  if (!seq) return;
  const overlay = ensureOverlay();
  const arrived = snapshot?.system || seq.destination;
  const entry = snapshot?.jump_history?.[0];
  const dist =
    entry && entry.system === snapshot?.system ? entry.dist : seq.mode === "preview" ? 34.2 : null;
  const fuelPct = snapshot ? fuelPercent(snapshot) : 100;
  seq.phase = "arrival";
  seq.phaseStart = Date.now();
  seq.revealed = false;
  seq.fading = false;
  overlay.arrivalName.textContent = arrived.toUpperCase();
  const note = arrivalNote(fuelPct);
  overlay.arrivalNote.textContent = note.text;
  setStyleValue(overlay.arrivalNote, "color", note.color);
  overlay.arrivalTail.textContent =
    `JUMP COMPLETE${dist != null ? ` · ${dist.toFixed(1)} LY` : ""}` +
    (seq.variant === "neutron" ? " · NORMALITY RESTORED" : " · FSD COOLDOWN 10 S");
  setOverlayPhase(overlay, "arrival");
  mountTunnel(tunnelAttrs("arrival"));
}

/** @param {number} fuelPct */
function arrivalNote(fuelPct) {
  if (!seq) return { text: "", color: "var(--dim)" };
  if (seq.variant === "neutron") {
    return { text: "FSD SUPERCHARGED · RANGE ×4 ON NEXT JUMP", color: "#7de5ff" };
  }
  if (seq.scoopable) {
    return { text: "FUEL SCOOPING AVAILABLE · DEPLOY SCOOP", color: "var(--good)" };
  }
  if (fuelPct < 25) {
    return { text: "⚠ NO FUEL SOURCE HERE · PLOT TO A SCOOPABLE STAR", color: "var(--bad)" };
  }
  return { text: "NO FUEL SOURCE AT THIS STAR", color: "var(--dim)" };
}

/**
 * @param {"charge"|"tunnel"|"arrival"} phase
 * @param {number} [progress]
 */
function tunnelAttrs(phase, progress) {
  return {
    phase,
    variant: seq ? seq.variant : "standard",
    intensity: sequenceIntensity(),
    progress,
    rflash: reduceJumpFlash(),
  };
}

/** @param {OverlayRefs} overlay */
function tick(overlay) {
  if (!seq) return;
  const elapsed = (Date.now() - seq.phaseStart) / 1000;
  if (seq.phase === "charge") {
    const remain = seq.chargeTotalS - elapsed;
    const engaged = remain <= 0.4;
    overlay.count.textContent = engaged ? "ENGAGE" : String(Math.max(1, Math.ceil(remain)));
    overlay.count.classList.toggle("fsd-engage", engaged);
    const progress = seq.chargeTotalS > 0 ? Math.min(1, elapsed / seq.chargeTotalS) : 1;
    setPercentStyle(overlay.chargeFill, "width", progress * 100);
    mountTunnel(tunnelAttrs("charge", progress));
    if (remain <= 0) enterTunnel(overlay);
  } else if (seq.phase === "tunnel") {
    const transit = seq.tunnelOffsetS + elapsed;
    overlay.hudEta.textContent = `T+${transit.toFixed(1)} S`;
    setPercentStyle(overlay.hudFill, "width", Math.min(95, (transit / TUNNEL_ESTIMATE_S) * 100));
    if (seq.mode === "preview" && elapsed >= PREVIEW_TUNNEL_S) beginArrival(null);
    else if (seq.mode === "live" && elapsed >= TUNNEL_FAILSAFE_S) endSequence();
  } else if (seq.phase === "arrival") {
    if (elapsed >= ARRIVAL_REVEAL_S && !seq.revealed) {
      seq.revealed = true;
      overlay.arrivalBox.classList.remove("hidden");
    }
    if (elapsed >= ARRIVAL_FADE_S && !seq.fading) {
      seq.fading = true;
      hideOverlay(overlay);
    }
    if (elapsed >= ARRIVAL_END_S) endSequence();
  }
}

/** Stop the clock, fade the layer out, and free the WebGL element. */
function endSequence() {
  if (!seq) return;
  clearInterval(seq.timer);
  seq = null;
  const overlay = ensureOverlay();
  hideOverlay(overlay);
  clearTimeout(teardownTimer);
  teardownTimer = window.setTimeout(unmountTunnel, 700);
}
