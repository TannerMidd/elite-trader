/** @import {TextToSpeechStatus} from "../../api/contracts/settings.js" */
import { settingsApi } from "../../api/settings.js";
import { clear, html, render } from "../../core/html.js";
import { loadTtsStatus, playNeural } from "../../shell/voice.js";

/** @returns {HTMLElement} */
export function buildTtsSetting() {
  const wrap = document.createElement("div");
  wrap.className = "tts-wrap";
  let requestSequence = 0;

  /** @param {TextToSpeechStatus|null} status */
  const renderTts = (status) => {
    clear(wrap);
    const text = document.createElement("div");
    text.className = "setting-text";
    const select = document.createElement("select");
    select.className = "tts-voices";
    for (const voice of status?.voices || []) {
      const option = document.createElement("option");
      option.value = voice.name;
      option.textContent = `${voice.label} ${voice.installed ? "· installed" : `· ~${voice.mb} MB download`}`;
      option.selected = status?.voice === voice.name;
      select.appendChild(option);
    }
    select.disabled = !!(status?.downloading || status?.supported === false);
    select.addEventListener("change", async () => {
      select.disabled = true;
      try {
        await settingsApi.selectTextToSpeechVoice(select.value);
      } catch {
        // The refreshed server status carries the actionable error.
      }
      await refresh();
    });

    if (status?.ready) {
      const row = document.createElement("label");
      row.className = "setting";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = localStorage.getItem("neuralVoice") !== "0";
      checkbox.addEventListener("change", () =>
        localStorage.setItem("neuralVoice", checkbox.checked ? "1" : "0"),
      );
      const toggle = document.createElement("span");
      toggle.className = "switch";
      render(
        text,
        html`<b>Neural voice</b>
          <div class="dim">
            Human-sounding callouts, synthesized on this PC by Piper. The voice is shared by every
            device; this on/off switch is per device.
          </div>`,
      );
      row.append(checkbox, toggle, text);
      const test = document.createElement("button");
      test.type = "button";
      test.className = "hb hb-primary hb-sm";
      test.textContent = "TEST";
      test.title = "Play a sample callout with the neural voice (even while the switch is off)";
      test.addEventListener("click", () =>
        playNeural("Neural voice online. All systems nominal. o7").catch(() => {}),
      );
      wrap.append(row, select, test);
      return;
    }

    const row = document.createElement("div");
    row.className = "setting tts-static";
    if (status?.downloading) {
      render(
        text,
        html`<b>Neural voice</b>
          <div class="dim">
            Downloading the voice… ${Math.round((status.progress || 0) * 100)}% — callouts switch
            over automatically when it finishes.
          </div>`,
      );
      row.appendChild(text);
      wrap.appendChild(row);
      window.setTimeout(() => {
        if (wrap.isConnected) void refresh();
      }, 2000);
      return;
    }
    render(
      text,
      html`<b>Neural voice</b>
        <div class="dim">
          Replace the robotic browser voice with a human-sounding one, synthesized locally on this
          PC — every device on your LAN hears it. One-time download (Piper TTS + the voice you
          pick), fully offline
          afterwards.${
            status?.error ? html` <span class="bad-text">${status.error}</span>` : ""
          }${status?.supported === false ? " Not available on this platform." : ""}
        </div>`,
    );
    row.appendChild(text);
    const download = document.createElement("button");
    download.type = "button";
    download.className = "hb hb-primary hb-sm";
    download.textContent = "DOWNLOAD VOICE";
    download.disabled = status?.supported === false;
    download.addEventListener("click", async () => {
      download.disabled = true;
      try {
        await settingsApi.downloadTextToSpeechVoice();
      } catch {
        // The refreshed server status carries the actionable error.
      }
      await refresh();
    });
    wrap.append(row, select, download);
  };

  async function refresh() {
    const request = ++requestSequence;
    const status = await loadTtsStatus();
    if (request !== requestSequence || !wrap.isConnected) return;
    renderTts(status);
  }

  queueMicrotask(() => void refresh());
  return wrap;
}
