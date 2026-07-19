/** Desktop tab presentation, independent of feature activation side effects. */

/** @type {(name: string) => void} */
let onTabActivated = () => {};

/**
 * Composition installs feature-specific activation behavior without making
 * this shell module depend on feature implementations.
 *
 * @param {(name: string) => void} listener
 */
export function configureTabActivation(listener) {
  if (typeof listener !== "function") {
    throw new TypeError("Tab activation requires a callback.");
  }
  onTabActivated = listener;
}

/** @param {HTMLElement} element */
export function paneEnter(element) {
  element.classList.remove("pane-enter");
  void element.offsetWidth;
  element.classList.add("pane-enter");
  element.addEventListener("animationend", () => element.classList.remove("pane-enter"), {
    once: true,
  });
}

/**
 * @param {string} name
 * @param {boolean} [enter]
 */
export function activateTab(name, enter = true) {
  document.querySelectorAll("#tabs [data-tab]").forEach((element) => {
    const button = /** @type {HTMLElement} */ (element);
    button.setAttribute("aria-pressed", String(button.dataset.tab === name));
  });
  document.querySelectorAll(".tabpane").forEach((element) => {
    const pane = /** @type {HTMLElement} */ (element);
    const show = pane.id === `tab-${name}`;
    const wasHidden = pane.classList.contains("hidden");
    pane.classList.toggle("hidden", !show);
    if (show && wasHidden && enter) paneEnter(pane);
    if (!show) pane.classList.remove("pane-enter", "slide-in-left", "slide-in-right");
  });
  localStorage.setItem("activeTab", name);
  onTabActivated(name);
}

export function initializeTabs() {
  document.querySelectorAll("#tabs [data-tab]").forEach((element) => {
    const button = /** @type {HTMLElement} */ (element);
    button.addEventListener("click", () => {
      if (button.dataset.tab) activateTab(button.dataset.tab);
    });
  });
  const saved = localStorage.getItem("activeTab");
  if (saved && document.getElementById(`tab-${saved}`)) activateTab(saved);
}
