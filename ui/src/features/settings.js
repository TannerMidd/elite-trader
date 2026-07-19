/** @import {SettingsInfo, SettingsValues} from "../api/contracts/settings.js" */
import { settingsApi } from "../api/settings.js";
import { requireById } from "../core/dom.js";
import { clear, html, render } from "../core/html.js";
import { checkForUpdatesNow } from "./updater.js";
import {
  buildCrtSetting,
  buildDisplaySettings,
  buildVoiceVolumeSetting,
} from "./settings/display.js";
import { buildJournalDirSetting } from "./settings/journal.js";
import { saveSetting } from "./settings/persistence.js";
import { buildThemeSetting } from "./settings/theme.js";
import { buildTtsSetting } from "./settings/tts.js";

export {
  DISPLAY_DEFAULTS,
  applyCrtFx,
  applyDisplaySettings,
  buildCrtSetting,
  buildDisplaySettings,
  buildSliderSetting,
  buildVoiceVolumeSetting,
  displayVal,
  voiceVolume,
} from "./settings/display.js";
export { buildJournalDirSetting } from "./settings/journal.js";
export { saveSetting } from "./settings/persistence.js";
export {
  THEME_PRESETS,
  accentColor,
  applyTheme,
  buildThemeSetting,
  currentTheme,
  hexToRgb,
  softenAccent,
} from "./settings/theme.js";
export { buildTtsSetting } from "./settings/tts.js";

/**
 * @typedef {object} SettingDefinition
 * @property {string} key
 * @property {string} label
 * @property {string} desc
 * @property {keyof SettingsInfo} [requires]
 */

/** @type {readonly SettingDefinition[]} */
export const SETTINGS_DEFS = Object.freeze([
  {
    key: "exclude_surface",
    label: "Exclude surface stations",
    desc: "Hide planetary outposts, ports and settlements from trade routes, searches and mining — orbital stations only.",
  },
  {
    key: "exclude_carriers",
    label: "Exclude fleet carriers",
    desc: "Keep fleet carriers out of the market database and its results — carriers move, so listed positions go stale. Untick to collect carrier markets from the live feed too (rebuild the database to include them from the start).",
  },
  {
    key: "eddn_upload",
    label: "Contribute market data (EDDN)",
    desc: "Upload only commodity markets you dock at back to the community feed this app is built on. Anonymous and enabled by default.",
  },
  {
    key: "eddn_extended_upload",
    label: "Contribute exploration & navigation observations (EDDN)",
    desc: "Optional broader contribution: routes, scans, biological signals, exact Codex/settlement coordinates, docking outcomes, outfitting, shipyard and carrier-material observations. Anonymous; off until you opt in.",
  },
  {
    key: "auto_update",
    label: "Automatic updates",
    desc: "Check for new releases and offer a one-click update.",
    requires: "auto_update_supported",
  },
]);

let settingsRequest = 0;

export async function loadSettings() {
  const request = ++settingsRequest;
  try {
    const data = await settingsApi.getSettings();
    if (request !== settingsRequest) return;
    renderSettings(data.settings || {}, data.info || {});
  } catch {
    // Background polling retries while the server is unavailable.
  }
}

/**
 * @param {SettingsValues} values
 * @param {Partial<SettingsInfo>} info
 */
export function renderSettings(values, info) {
  const list = /** @type {HTMLElement} */ (requireById("settings-list"));
  clear(list);
  list.append(
    buildThemeSetting(),
    buildTtsSetting(),
    buildVoiceVolumeSetting(),
    buildCrtSetting(),
    ...buildDisplaySettings(),
  );
  for (const definition of SETTINGS_DEFS) {
    const supported = !definition.requires || Boolean(info[definition.requires]);
    const row = document.createElement("label");
    row.className = "setting" + (supported ? "" : " disabled");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(values[definition.key]);
    checkbox.disabled = !supported;
    checkbox.addEventListener("change", () => {
      void saveSetting(definition.key, checkbox.checked, row);
    });
    const toggle = document.createElement("span");
    toggle.className = "switch";
    const text = document.createElement("div");
    text.className = "setting-text";
    render(
      text,
      html`<b>${definition.label}</b>
        <div class="dim">${definition.desc}${supported ? "" : " Packaged Windows app only."}</div>`,
    );
    row.append(checkbox, toggle, text);
    list.appendChild(row);
  }
  list.appendChild(buildJournalDirSetting(values));

  if (info.auto_update_supported) {
    const wrap = document.createElement("div");
    wrap.className = "update-check-row";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "hb hb-primary hb-sm";
    button.textContent = "Check for updates now";
    const status = document.createElement("span");
    status.className = "dim";
    button.addEventListener("click", () => void checkForUpdatesNow(button, status));
    wrap.append(button, status);
    list.appendChild(wrap);
  }

  render(
    requireById("settings-info"),
    html`Frameshift
    v${info.version || "?"}${
      info.journal_dir ? html` · journal: <span class="path">${info.journal_dir}</span>` : ""
    }${info.data_dir ? html` · data: <span class="path">${info.data_dir}</span>` : ""}`,
  );
}
