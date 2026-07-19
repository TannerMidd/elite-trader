import { navigationApi } from "../api/navigation.js";
import { byId } from "../core/dom.js";
import { speak } from "../shell/voice.js";

export let plotBusy = false;

export let plotCancelling = false;

/**
 * @param {string} text
 * @param {boolean} isError
 */
export function setPlotStatus(text, isError) {
  for (const id of ["plot-status", "fp-plot-status"]) {
    const el = byId(id);
    if (!el) continue;
    el.classList.toggle("error", !!isError);
    el.textContent = text;
  }
}

/** @param {boolean} on */
export function setPlotBusy(on) {
  plotBusy = on;
  for (const id of ["plot-btn", "fp-plot-btn"]) {
    const btn = /** @type {HTMLButtonElement|null} */ (byId(id));
    if (!btn) continue;
    btn.textContent = on ? "CANCEL" : "PLOT";
    btn.classList.toggle("hb-danger", on);
    // The swap keeps aria-busy: the control stays live (it now cancels), but
    // assistive tech should still hear that the plot sequence is running.
    if (on) btn.setAttribute("aria-busy", "true");
    else btn.removeAttribute("aria-busy");
  }
}

export async function cancelPlot() {
  if (!plotBusy || plotCancelling) return;
  plotCancelling = true;
  setPlotStatus("Cancelling — releasing keys…", false);
  try {
    await navigationApi.cancelPlot();
  } catch {
    /* the in-flight plot request will still report the outcome */
  }
}

/** @param {string} system */
export async function plotSystem(system) {
  if (!system || plotBusy) return;
  setPlotBusy(true);
  setPlotStatus(
    `Plotting route to ${system} — leave the game window alone. Tap CANCEL to stop.`,
    false,
  );
  try {
    const data = await navigationApi.plotSystem({ system });
    if (data.cancelled) {
      setPlotStatus("Plot cancelled.", false);
      return;
    }
    setPlotStatus(`Sent plot sequence for ${system} — check the game.`, false);
    speak("Route plotted to " + system);
  } catch (err) {
    setPlotStatus(err instanceof Error ? err.message : String(err), true);
  } finally {
    setPlotBusy(false);
    plotCancelling = false;
  }
}
