import { voiceVolume } from "../core/display-preferences.js";
import { byId } from "../core/dom.js";
import { settingsApi } from "../api/settings.js";

export let voiceOn = localStorage.getItem("voice") === "1";

export let ttsReady = false;

export const neuralVoiceEnabled = () => ttsReady && localStorage.getItem("neuralVoice") !== "0";

/** @type {HTMLAudioElement|null} */
export let calloutAudio = null;

/** @type {string|null} */
export let calloutObjectUrl = null;

/** @param {string} text */
export async function playNeural(text) {
  if (calloutAudio) calloutAudio.pause(); // don't stack stale callouts
  if (calloutObjectUrl) URL.revokeObjectURL(calloutObjectUrl);
  const blob = await settingsApi.synthesizeSpeech(text);
  calloutObjectUrl = URL.createObjectURL(blob);
  const audio = new Audio(calloutObjectUrl);
  calloutAudio = audio;
  audio.volume = voiceVolume();
  audio.addEventListener(
    "ended",
    () => {
      if (calloutObjectUrl) URL.revokeObjectURL(calloutObjectUrl);
      calloutObjectUrl = null;
    },
    { once: true },
  );
  return audio.play();
}

/**
 * @param {string} text
 * @param {boolean} [force]
 */
export function speak(text, force) {
  if ((!voiceOn && !force) || !text) return;
  if (neuralVoiceEnabled()) {
    try {
      playNeural(text).catch(() => speakBrowser(text));
      return;
    } catch {
      /* fall through to the browser voice */
    }
  }
  speakBrowser(text);
}

/** @param {string} text */
export function speakBrowser(text) {
  if (!("speechSynthesis" in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05;
    u.pitch = 1;
    u.volume = voiceVolume();
    window.speechSynthesis.cancel(); // don't queue stale callouts
    window.speechSynthesis.speak(u);
  } catch {
    /* speech is a nicety */
  }
}

export async function loadTtsStatus() {
  try {
    const data = await settingsApi.getTextToSpeechStatus();
    ttsReady = !!data.ready;
    return data;
  } catch {
    return null;
  }
}

/**
 * @param {boolean} on
 * @param {boolean} [announce]
 */
export function setVoice(on, announce) {
  voiceOn = on;
  localStorage.setItem("voice", on ? "1" : "0");
  const btn = byId("fp-voice");
  if (btn) {
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    btn.textContent = on ? "🔊 VOICE" : "🔈 VOICE";
  }
  if (on && announce) speak("Voice callouts on.", true);
}
