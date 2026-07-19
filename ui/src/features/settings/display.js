import { DISPLAY_DEFAULTS, displayValue, voiceVolume } from "../../core/display-preferences.js";
import { setStyleValue } from "../../core/dom.js";
import { html, render } from "../../core/html.js";
import {
  jumpSequenceEnabled,
  previewJumpSequence,
  reduceJumpFlash,
} from "../../shell/jump-sequence.js";
import { speak } from "../../shell/voice.js";

/**
 * @typedef {object} SliderSetting
 * @property {keyof typeof DISPLAY_DEFAULTS} key
 * @property {string} label
 * @property {string} desc
 * @property {number} min
 * @property {number} max
 * @property {number} step
 * @property {string} unit
 * @property {(value: number) => void} [onRelease]
 */

export { DISPLAY_DEFAULTS, voiceVolume };
export const displayVal = displayValue;

export function applyCrtFx() {
  document.body.classList.toggle("crt-fx", localStorage.getItem("crtFx") === "1");
}

export function applyDisplaySettings() {
  document.body.style.zoom = String(displayVal("uiScale") / 100);
  const root = document.documentElement;
  setStyleValue(root, "--strip-scale", displayVal("stripScale") / 100);
  setStyleValue(root, "--helper-scale", displayVal("helperScale") / 100);
}

/** @param {SliderSetting} setting */
export function buildSliderSetting({ key, label, desc, min, max, step, unit, onRelease }) {
  const row = document.createElement("label");
  row.className = "setting";
  const input = document.createElement("input");
  input.type = "range";
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(displayVal(key));
  const text = document.createElement("div");
  text.className = "setting-text";
  const title = document.createElement("b");
  const value = document.createElement("span");
  value.className = "range-val";
  const sync = () => {
    value.textContent = ` ${input.value}${unit}`;
  };
  title.textContent = label;
  title.appendChild(value);
  const hint = document.createElement("div");
  hint.className = "dim";
  hint.textContent = desc + " Double-click the slider to reset.";
  text.append(title, hint);
  sync();
  input.addEventListener("input", () => {
    localStorage.setItem(key, input.value);
    sync();
    applyDisplaySettings();
  });
  if (onRelease) input.addEventListener("change", () => onRelease(Number(input.value)));
  input.addEventListener("dblclick", () => {
    input.value = String(DISPLAY_DEFAULTS[key]);
    localStorage.setItem(key, input.value);
    sync();
    applyDisplaySettings();
  });
  row.append(input, text);
  return row;
}

export function buildDisplaySettings() {
  return [
    buildSliderSetting({
      key: "uiScale",
      label: "Interface size",
      unit: "%",
      min: 80,
      max: 140,
      step: 5,
      desc: "Zooms the whole app on this device — every page, desktop and panel mode alike.",
    }),
    buildSliderSetting({
      key: "stripScale",
      label: "Status bar text",
      unit: "%",
      min: 100,
      max: 160,
      step: 5,
      desc: "Size of the top status strip in panel mode: system, station, fuel, cargo, clock.",
    }),
    buildSliderSetting({
      key: "helperScale",
      label: "Helper text",
      unit: "%",
      min: 100,
      max: 150,
      step: 5,
      desc: "Size of the small grey hints and descriptions, like this one.",
    }),
  ];
}

export function buildVoiceVolumeSetting() {
  return buildSliderSetting({
    key: "voiceVolume",
    label: "Voice volume",
    unit: "%",
    min: 0,
    max: 100,
    step: 5,
    desc: "Callout loudness on this device — applies to the neural and browser voices alike.",
    onRelease: (value) => {
      if (value > 0) speak(`Voice volume ${value} percent.`, true);
    },
  });
}

export function buildCrtSetting() {
  const row = document.createElement("label");
  row.className = "setting";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = localStorage.getItem("crtFx") === "1";
  checkbox.addEventListener("change", () => {
    localStorage.setItem("crtFx", checkbox.checked ? "1" : "0");
    applyCrtFx();
  });
  const toggle = document.createElement("span");
  toggle.className = "switch";
  const text = document.createElement("div");
  text.className = "setting-text";
  render(
    text,
    html`<b>CRT effects</b>
      <div class="dim">
        Retro scanlines and readout flicker in the flight panel. Saved on this device only — they
        can shimmer on some screens.
      </div>`,
  );
  row.append(checkbox, toggle, text);
  return row;
}

/**
 * @param {string} key
 * @param {boolean} checked
 * @param {import("../../core/html.js").TemplateResult} label
 */
function buildLocalToggle(key, checked, label) {
  const row = document.createElement("label");
  row.className = "setting";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = checked;
  checkbox.addEventListener("change", () => {
    localStorage.setItem(key, checkbox.checked ? "1" : "0");
  });
  const toggle = document.createElement("span");
  toggle.className = "switch";
  const text = document.createElement("div");
  text.className = "setting-text";
  render(text, label);
  row.append(checkbox, toggle, text);
  return row;
}

export function buildJumpSequenceSettings() {
  const master = buildLocalToggle(
    "fsdSeq",
    jumpSequenceEnabled(),
    html`<b>FSD jump sequence</b>
      <div class="dim">
        Cinematic charge countdown, witchspace tunnel and arrival flash in the flight panel whenever
        your ship jumps. Neutron stars and critically low fuel get their own look. Saved on this
        device only.
      </div>`,
  );
  const flash = buildLocalToggle(
    "fsdSeqReduceFlash",
    reduceJumpFlash(),
    html`<b>Reduce jump flashing</b>
      <div class="dim">
        Caps the bright white flashes at launch and arrival — kinder for photosensitive commanders
        and night flying. The sequence also calms itself when this device asks for reduced motion.
      </div>`,
  );
  const intensity = buildSliderSetting({
    key: "fsdSeqIntensity",
    label: "Jump effect intensity",
    unit: "%",
    min: 30,
    max: 100,
    step: 5,
    desc: "How hard the tunnel, camera shake and glow go during the jump sequence.",
  });
  const preview = document.createElement("div");
  preview.className = "setting fsd-preview-row";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "hb hb-utility hb-sm";
  button.textContent = "◈ PREVIEW JUMP";
  button.addEventListener("click", () => previewJumpSequence());
  const hint = document.createElement("div");
  hint.className = "dim";
  hint.textContent = "Plays a simulated hyperspace jump right now — no game needed.";
  preview.append(button, hint);
  return [master, flash, intensity, preview];
}
