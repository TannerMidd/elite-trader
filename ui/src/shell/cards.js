import { byId } from "../core/dom.js";

/** @param {Element} el */
export const arrKey = (el) => (el instanceof HTMLElement ? el.dataset.arr || "" : "");

/**
 * @param {HTMLElement} pane
 * @returns {Element[]}
 */
export function arrContainers(pane) {
  return [pane, ...pane.querySelectorAll(".two-col")];
}

export function applyCardOrders() {
  document.querySelectorAll(".tabpane").forEach((pane) => {
    if (!(pane instanceof HTMLElement)) return;
    /** @type {string[]|null} */
    let saved = null;
    try {
      saved = /** @type {string[]|null} */ (
        JSON.parse(localStorage.getItem("cardOrder:" + pane.id) ?? "null")
      );
    } catch {
      return;
    }
    if (!Array.isArray(saved) || !saved.length) return;
    for (const container of arrContainers(pane)) {
      // Orderable units: keyed cards and keyed grid blocks (.two-col).
      const units = [...container.children].filter((el) => arrKey(el));
      if (units.length < 2) continue;
      // Re-place sorted units into the same DOM slots so unkeyed siblings stay put.
      const slots = units.map(() => document.createComment("card-slot"));
      units.forEach((el, i) => {
        const slot = slots[i];
        if (slot) container.replaceChild(slot, el);
      });
      /** @param {Element} el */
      const pos = (el) => {
        const i = saved.indexOf(arrKey(el));
        return i === -1 ? 1e9 : i;
      };
      const sorted = [...units].sort((a, b) => pos(a) - pos(b));
      slots.forEach((slot, i) => {
        const unit = sorted[i];
        if (unit) container.replaceChild(unit, slot);
      });
    }
  });
}

/** @param {HTMLElement} pane */
export function saveCardOrder(pane) {
  const keys = [...pane.querySelectorAll("[data-arr]")].map(arrKey);
  localStorage.setItem("cardOrder:" + pane.id, JSON.stringify(keys));
}

export function migrateEngineeringLayout() {
  const moved = ["engineers", "materials", "odyssey", "engplanner"];
  try {
    const localHidden =
      /** @type {string[]|null} */ (
        JSON.parse(localStorage.getItem("cardHidden:tab-local") ?? "null")
      ) || [];
    const carried = localHidden.filter((k) => moved.includes(k));
    if (carried.length) {
      const engHidden = new Set(
        /** @type {string[]|null} */ (
          JSON.parse(localStorage.getItem("cardHidden:tab-engineering") ?? "null")
        ) || [],
      );
      carried.forEach((k) => engHidden.add(k));
      localStorage.setItem("cardHidden:tab-engineering", JSON.stringify([...engHidden]));
      localStorage.setItem(
        "cardHidden:tab-local",
        JSON.stringify(localHidden.filter((k) => !moved.includes(k))),
      );
    }
    const localOrder = /** @type {string[]|null} */ (
      JSON.parse(localStorage.getItem("cardOrder:tab-local") ?? "null")
    );
    if (Array.isArray(localOrder) && localOrder.some((k) => moved.includes(k))) {
      localStorage.setItem(
        "cardOrder:tab-local",
        JSON.stringify(localOrder.filter((k) => !moved.includes(k))),
      );
    }
  } catch {
    /* fresh device — nothing to migrate */
  }
}

/**
 * @param {string} paneId
 * @returns {string[]}
 */
export function hiddenCardKeys(paneId) {
  try {
    const v = /** @type {unknown} */ (
      JSON.parse(localStorage.getItem("cardHidden:" + paneId) ?? "null")
    );
    return Array.isArray(v) ? /** @type {string[]} */ (v) : [];
  } catch {
    return [];
  }
}

/**
 * @param {HTMLElement} pane
 * @param {HTMLElement} card
 * @param {boolean} hide
 */
export function setCardHidden(pane, card, hide) {
  const keys = new Set(hiddenCardKeys(pane.id));
  if (hide) keys.add(arrKey(card));
  else keys.delete(arrKey(card));
  localStorage.setItem("cardHidden:" + pane.id, JSON.stringify([...keys]));
  applyCardVisibility();
  syncEyeButton(card);
}

export function applyCardVisibility() {
  document.querySelectorAll(".tabpane").forEach((pane) => {
    if (!(pane instanceof HTMLElement)) return;
    const hidden = new Set(hiddenCardKeys(pane.id));
    let anyVisible = false,
      anyHidden = false;
    pane
      .querySelectorAll("section.card[data-arr], .two-col[data-arr] > section.card[data-arr]")
      .forEach((card) => {
        const off = hidden.has(arrKey(card));
        card.classList.toggle("user-hidden", off);
        if (off) anyHidden = true;
        else if (!card.classList.contains("hidden")) anyVisible = true;
      });
    // If the whole page was hidden away, leave a way back.
    let note = pane.querySelector(".all-hidden-note");
    if (!anyVisible && anyHidden) {
      if (!note) {
        note = document.createElement("div");
        note.className = "dim empty all-hidden-note";
        note.textContent =
          "Every card on this page is hidden — tap ⇅ ARRANGE, then ⊕ SHOW to bring them back.";
        pane.appendChild(note);
      }
    } else if (note) {
      note.remove();
    }
  });
}

/** @param {HTMLElement} card */
export function syncEyeButton(card) {
  const eye = /** @type {HTMLElement|null} */ (card.querySelector(".arr-eye"));
  if (!eye) return;
  const off = card.classList.contains("user-hidden");
  eye.textContent = off ? "⊕ SHOW" : "⊘ HIDE";
  eye.title = off
    ? "Show this card again on this device"
    : "Hide this card on this device (restore it any time in arrange mode)";
}

/** @param {boolean} on */
export function setArrangeMode(on) {
  document.body.classList.toggle("arranging", on);
  for (const btn of [byId("arrange-btn"), byId("fp-arrange")]) {
    if (!btn) continue;
    btn.classList.toggle("on", on);
    btn.setAttribute("aria-pressed", String(on));
  }
  const arrangeButton = byId("arrange-btn");
  if (arrangeButton) arrangeButton.textContent = on ? "✓ DONE" : "⇅ ARRANGE";
  document.querySelectorAll(".arr-handle, .arr-eye").forEach((h) => h.remove());
  if (!on) return;
  document.querySelectorAll(".tabpane section.card[data-arr]").forEach((card) => {
    if (!(card instanceof HTMLElement)) return;
    const h = document.createElement("button");
    h.type = "button";
    h.className = "arr-handle";
    h.textContent = "⠿ DRAG";
    h.setAttribute("aria-label", "Drag to reorder this card");
    h.addEventListener("pointerdown", (ev) => startCardDrag(ev, card));
    card.appendChild(h);
    const eye = document.createElement("button");
    eye.type = "button";
    eye.className = "arr-eye";
    eye.addEventListener("click", () => {
      const pane = card.closest(".tabpane");
      if (pane instanceof HTMLElement) {
        setCardHidden(pane, card, !card.classList.contains("user-hidden"));
      }
    });
    card.appendChild(eye);
    syncEyeButton(card);
  });
}

/**
 * @param {PointerEvent} ev
 * @param {HTMLElement} card
 */
export function startCardDrag(ev, card) {
  ev.preventDefault();
  card.classList.add("arr-drag");
  const pane = card.closest(".tabpane");

  // Listen on the document: reordering moves the card (and its handle) in the
  // DOM, which drops pointer capture mid-drag — document-level listeners keep
  // receiving the pointer no matter where the card lands.
  /** @param {PointerEvent} mv */
  const onMove = (mv) => {
    if (mv.pointerId !== ev.pointerId) return;
    const container = card.parentElement;
    if (!container) return;
    for (const sib of container.children) {
      if (sib === card || !arrKey(sib) || sib.classList.contains("hidden")) continue;
      const r = sib.getBoundingClientRect();
      if (
        mv.clientX < r.left ||
        mv.clientX > r.right ||
        mv.clientY < r.top ||
        mv.clientY > r.bottom
      )
        continue;
      // Pointer is over a sibling unit. Swap only once the pointer crosses its
      // midpoint (on the axis the two are separated along) — plain edge-entry
      // swapping oscillates when the sibling is taller than the drag step.
      const cr = card.getBoundingClientRect();
      const horiz =
        Math.abs(r.left + r.right - (cr.left + cr.right)) >
        Math.abs(r.top + r.bottom - (cr.top + cr.bottom));
      const mid = horiz ? (r.left + r.right) / 2 : (r.top + r.bottom) / 2;
      const pos = horiz ? mv.clientX : mv.clientY;
      const sibBefore =
        (card.compareDocumentPosition(sib) & Node.DOCUMENT_POSITION_PRECEDING) !== 0;
      if (sibBefore && pos < mid) container.insertBefore(card, sib);
      else if (!sibBefore && pos > mid) container.insertBefore(card, sib.nextSibling);
      break;
    }
  };
  /** @param {PointerEvent} up */
  const onUp = (up) => {
    if (up.pointerId !== ev.pointerId) return;
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);
    document.removeEventListener("pointercancel", onUp);
    card.classList.remove("arr-drag");
    if (pane instanceof HTMLElement) saveCardOrder(pane);
  };
  document.addEventListener("pointermove", onMove);
  document.addEventListener("pointerup", onUp);
  document.addEventListener("pointercancel", onUp);
}
