/**
 * Copy text from both secure desktop contexts and plain-HTTP LAN devices.
 *
 * @param {string} text
 * @param {EventTarget|null} trigger
 * @returns {Promise<void>}
 */
export async function copyText(text, trigger = null) {
  const button = trigger instanceof HTMLElement ? trigger : null;
  const markComplete = () => {
    if (!button) return;
    button.classList.add("hb-good");
    setTimeout(() => button.classList.remove("hb-good"), 900);
  };

  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      markComplete();
      return;
    } catch {
      // Browser policy can still reject a nominally secure context. The
      // selection fallback below remains available for that case.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand("copy");
    markComplete();
  } finally {
    textarea.remove();
  }
}
