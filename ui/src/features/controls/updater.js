import { requireById } from "../../core/dom.js";

let initialized = false;

function closeNotes() {
  requireById("notes-modal").classList.add("hidden");
}

/** Own release-note dialog dismissal behavior. */
export function initializeUpdaterControls() {
  if (initialized) return;
  initialized = true;
  requireById("notes-close").addEventListener("click", closeNotes);
  requireById("notes-modal").addEventListener("click", (event) => {
    if (event.target === event.currentTarget) closeNotes();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeNotes();
  });
}
