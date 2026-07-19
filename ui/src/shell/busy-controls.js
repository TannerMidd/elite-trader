let initialized = false;

/**
 * Reflect asynchronous button disabling through aria-busy without requiring
 * every feature handler to duplicate accessibility state.
 */
export function initializeBusyButtonStates() {
  if (initialized) return;
  initialized = true;

  /** @type {WeakSet<HTMLElement>} */
  const completed = new WeakSet();
  /** @param {HTMLElement|null} button */
  const schedule = (button) => {
    if (!button?.matches("button.hb, .ub-btn")) return;
    completed.delete(button);
    requestAnimationFrame(() => {
      const busyButton = /** @type {HTMLElement & {disabled?: boolean}} */ (button);
      if (busyButton.disabled && !completed.has(button)) {
        button.setAttribute("aria-busy", "true");
      }
      completed.delete(button);
    });
  };

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest("button") : null;
    schedule(target instanceof HTMLElement ? target : null);
  });
  document.addEventListener("submit", (event) => {
    const submitter =
      event instanceof SubmitEvent && event.submitter instanceof HTMLElement
        ? event.submitter
        : null;
    const fallback =
      event.target instanceof Element ? event.target.querySelector('button[type="submit"]') : null;
    schedule(submitter || (fallback instanceof HTMLElement ? fallback : null));
  });
  new MutationObserver((records) => {
    for (const { target, oldValue } of records) {
      if (!(target instanceof HTMLElement)) continue;
      const busyButton = /** @type {HTMLElement & {disabled?: boolean}} */ (target);
      if (oldValue !== null || !busyButton.disabled) {
        busyButton.removeAttribute("aria-busy");
        completed.add(busyButton);
      }
    }
  }).observe(document.body, {
    subtree: true,
    attributes: true,
    attributeFilter: ["disabled"],
    attributeOldValue: true,
  });
}
