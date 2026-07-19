/** Device-local display preferences shared by shell and settings features. */

export const DISPLAY_DEFAULTS = Object.freeze({
  uiScale: 100,
  stripScale: 100,
  helperScale: 100,
  voiceVolume: 100,
  fsdSeqIntensity: 85,
});

/**
 * @param {keyof typeof DISPLAY_DEFAULTS} key
 * @param {Storage} [storage]
 * @returns {number}
 */
export function displayValue(key, storage = localStorage) {
  const value = Number.parseInt(storage.getItem(key) ?? "", 10);
  return Number.isFinite(value) ? value : DISPLAY_DEFAULTS[key];
}

/**
 * @param {Storage} [storage]
 * @returns {number}
 */
export function voiceVolume(storage = localStorage) {
  return Math.max(0, Math.min(1, displayValue("voiceVolume", storage) / 100));
}
