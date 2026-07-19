/** @import {SettingsValues} from "../../api/contracts/settings.js" */
import { settingsApi } from "../../api/settings.js";
import { html, render } from "../../core/html.js";
import { saveSetting } from "./persistence.js";

/** @param {SettingsValues} values */
export function buildJournalDirSetting(values) {
  const wrap = document.createElement("div");
  wrap.className = "setting setting-journal";
  render(
    wrap,
    html`<div class="setting-text">
      <b>Journal folder</b>
      <div class="dim">
        Where Elite Dangerous writes its journal. Leave blank to auto-detect. Takes effect
        immediately.
      </div>
    </div>`,
  );
  const row = document.createElement("div");
  row.className = "journal-dir-row";
  const input = document.createElement("input");
  input.type = "text";
  input.id = "journal-dir-input";
  input.placeholder = "auto-detect";
  input.value = typeof values.journal_dir === "string" ? values.journal_dir : "";
  input.setAttribute("spellcheck", "false");
  const save = document.createElement("button");
  save.type = "button";
  save.className = "hb hb-primary hb-sm";
  save.textContent = "SAVE";
  const status = document.createElement("div");
  status.className = "dim journal-dir-status";

  /** @type {number|null} */
  let timer = null;
  let sequence = 0;
  const validate = async () => {
    const request = ++sequence;
    try {
      const validation = await settingsApi.validateJournalDirectory(input.value.trim());
      if (request !== sequence || !wrap.isConnected) return;
      status.classList.toggle("error", !validation.exists && !validation.unchecked);
      status.textContent = validation.unchecked
        ? `– can't check ${validation.path} from here (outside your user profile); SAVE still applies it`
        : validation.exists
          ? `✓ ${validation.files} journal file${validation.files === 1 ? "" : "s"} in ${validation.path}` +
            (validation.auto ? " (auto-detected)" : "")
          : `✗ folder not found: ${validation.path}`;
    } catch {
      // The next edit or settings reload retries a temporarily unavailable server.
    }
  };
  input.addEventListener("input", () => {
    if (timer !== null) window.clearTimeout(timer);
    timer = window.setTimeout(() => void validate(), 350);
  });
  save.addEventListener("click", async () => {
    await saveSetting("journal_dir", input.value.trim(), wrap);
    await validate();
  });
  row.append(input, save);
  wrap.append(row, status);
  queueMicrotask(() => void validate());
  return wrap;
}
