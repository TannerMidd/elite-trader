/** @import {SurfacePin} from "../../api/contracts/specialists.js" */
/** @import {ExobiologyWorkflowView, MutationRunner} from "./types.js" */
import { specialistsApi } from "../../api/specialists.js";
import { appStore } from "../../core/store.js";
import {
  html,
  render,
  specialistButton,
  specialistElement,
  specialistError,
  specialistForm,
  specialistHumanName,
  specialistInput,
  specialistNumber,
  specialistSelect,
} from "./core.js";

/** @param {number} metres */
export function niceSurfaceRange(metres) {
  const choices = [50, 100, 250, 500, 1000, 2500, 5000, 10_000, 25_000, 50_000, 100_000];
  return choices.find((value) => value >= metres) || Math.ceil(metres / 100_000) * 100_000;
}

/** @param {SurfacePin} pin */
function surfacePinColour(pin) {
  return pin.kind === "organic_sample"
    ? "#6fcf97"
    : pin.source === "manual"
      ? "var(--orange-soft)"
      : "#76a9e8";
}

/** @param {ExobiologyWorkflowView} exobiology */
function renderExobiologyMap(exobiology) {
  const map = exobiology.current_map;
  const position = exobiology.position;
  const mapTarget = specialistElement("sp-exobio-map");
  if (!map) {
    render(
      mapTarget,
      html`<div class="sp-map-empty">
        <b>NO BODY MAP YET</b>
        <span>Land or record a surface sample to establish this local map.</span>
      </div>`,
    );
    specialistElement("sp-exobio-range").textContent = "";
    return;
  }

  const pins = map.pins || [];
  const finiteDistances = pins
    .map((pin) => Number(pin.distance_m))
    .filter((value) => Number.isFinite(value));
  const range = niceSurfaceRange(Math.max(100, ...finiteDistances.map((value) => value * 1.2)));
  /** @param {number|null|undefined} value */
  const project = (value) => Math.max(-43, Math.min(43, ((Number(value) || 0) / range) * 43));
  const pinShapes = pins.map((pin) => {
    const x = project(pin.east_m);
    const y = -project(pin.north_m);
    return html`<g class="sp-map-pin" transform="translate(${x} ${y})">
      <circle r="2" fill="${surfacePinColour(pin)}">
        <title>
          ${pin.label || specialistHumanName(pin.kind)} · ${specialistNumber(pin.distance_m, " m")}
        </title>
      </circle>
    </g>`;
  });
  const liveOnBody = Boolean(position) && (!position?.body || position.body === map.body);
  const headingKnown =
    liveOnBody && position?.heading != null && Number.isFinite(Number(position.heading));
  const heading = headingKnown ? Number(position?.heading) : 0;
  const player = liveOnBody
    ? html`<g class="sp-map-player" transform="rotate(${heading})">
        ${headingKnown ? html`<polygon points="0,-6 3.4,4 0,2 -3.4,4"></polygon>` : ""}
        <circle r="${headingKnown ? 7 : 3}">
          <title>
            Commander${
              headingKnown ? ` · heading ${Math.round(heading)}°` : " · heading unavailable"
            }
          </title>
        </circle>
      </g>`
    : "";
  render(
    mapTarget,
    html`<svg viewBox="-50 -50 100 100" aria-hidden="true" focusable="false">
      <circle class="sp-map-boundary" r="44"></circle>
      <circle class="sp-map-grid" r="22"></circle>
      <path class="sp-map-axis" d="M-44 0H44M0-44V44"></path>
      <text class="sp-map-north" x="0" y="-46">N</text>
      ${pinShapes}${player}
    </svg>`,
  );
  specialistElement("sp-exobio-range").textContent =
    `EDGE ${specialistNumber(range, " m")} · ${pins.length} pins`;
}

/** @param {ExobiologyWorkflowView|null|undefined} exobiology */
export function renderExobiologySpecialist(exobiology) {
  const workflow = exobiology || {};
  const map = workflow.current_map;
  const position = workflow.position;
  specialistElement("sp-exobio-body").textContent =
    map?.body || position?.body || "NO SURFACE POSITION";
  specialistElement("sp-exobio-coords").textContent = position
    ? `${Number(position.lat).toFixed(5)}°, ${Number(position.lon).toFixed(5)}°${
        position.heading == null ? "" : ` · HDG ${Math.round(position.heading)}°`
      }${position.alt_m == null ? "" : ` · ALT ${specialistNumber(position.alt_m, " m")}`}`
    : "Latitude / longitude unavailable";
  specialistButton("sp-exobio-export").disabled = !map;
  specialistButton("sp-exobio-pin-add").disabled = !position;
  renderExobiologyMap(workflow);

  const sampling = workflow.sampling;
  const clearance = sampling?.clearance;
  specialistElement("sp-sampling-name").textContent = sampling
    ? sampling.variant || sampling.species || sampling.genus || "Organism in progress"
    : "No organism in progress";
  specialistElement("sp-sampling-progress").textContent = sampling
    ? `Sample ${sampling.progress || 0} / 3${
        sampling.colony_m
          ? ` · required spacing ${specialistNumber(sampling.colony_m, " m")}`
          : " · spacing unknown"
      }`
    : "Start a sample in game to arm clearance guidance.";
  const clearanceElement = specialistElement("sp-sampling-clearance");
  clearanceElement.className = "sp-clearance unknown";
  if (!sampling || !clearance) {
    clearanceElement.textContent = sampling ? "WAITING FOR POSITION" : "CLEARANCE NOT ARMED";
  } else if (clearance.clear === true) {
    clearanceElement.className = "sp-clearance clear";
    clearanceElement.textContent = `CLEAR TO SAMPLE · ${specialistNumber(clearance.min_dist_m, " m")}`;
  } else if (clearance.clear === false) {
    clearanceElement.className = "sp-clearance blocked";
    const remaining = Math.max(
      0,
      Number(sampling.colony_m || 0) - Number(clearance.min_dist_m || 0),
    );
    clearanceElement.textContent =
      `MOVE ${specialistNumber(remaining, " m")} FARTHER · ` +
      `${specialistNumber(clearance.min_dist_m, " m")} CLEAR`;
  } else {
    clearanceElement.textContent =
      `${specialistNumber(clearance.min_dist_m, " m")} FROM NEAREST SAMPLE · ` +
      "REQUIRED SPACING UNKNOWN";
  }

  const pins = map?.pins || [];
  const pinTotal = Number(map?.pins_total ?? pins.length);
  specialistElement("sp-exobio-pin-count").textContent =
    `${pinTotal} PIN${pinTotal === 1 ? "" : "S"}` +
    (pinTotal > pins.length ? ` / ${pins.length} MOST RECENT SHOWN` : "");
  render(
    specialistElement("sp-exobio-pins"),
    pins.length
      ? html`${pins
          .slice()
          .reverse()
          .map((pin) => {
            const bearing =
              pin.bearing_deg == null
                ? "bearing unknown"
                : `${Math.round(pin.bearing_deg)}° · ${specialistNumber(pin.distance_m, " m")}`;
            const relative =
              pin.relative_bearing_deg == null
                ? ""
                : ` · ${pin.relative_bearing_deg < 0 ? "left" : "right"} ${Math.abs(
                    Math.round(pin.relative_bearing_deg),
                  )}°`;
            return html`<div class="sp-pin-row">
              <i
                class="${
                  pin.kind === "organic_sample"
                    ? "sample"
                    : pin.source === "manual"
                      ? "manual"
                      : "journal"
                }"
              ></i>
              <div>
                <b>${pin.label || specialistHumanName(pin.kind)}</b>
                <span>${bearing + relative} · ${pin.source || "journal"}</span>
              </div>
              ${
                pin.source === "manual"
                  ? html`<button
                      type="button"
                      class="hb hb-utility sp-pin-delete"
                      data-pin-id="${pin.id}"
                    >
                      REMOVE
                    </button>`
                  : ""
              }
            </div>`;
          })}`
      : html`<div class="dim empty">No pins on this body yet.</div>`,
  );
  specialistElement("sp-exobio-pin-status").textContent = position
    ? "Manual pins use the current Status.json latitude and longitude. Journal sample pins cannot be removed here."
    : "Pins require a live latitude and longitude from Status.json.";
}

/** @param {() => ExobiologyWorkflowView} getWorkflow */
async function exportExobiologyGeoJson(getWorkflow) {
  const button = specialistButton("sp-exobio-export");
  const identity = appStore.identity();
  button.disabled = true;
  try {
    const blob = await specialistsApi.exportExobiologyGeoJson();
    if (!appStore.isCurrent(identity)) return;
    const url = URL.createObjectURL(blob);
    const body = getWorkflow().current_map?.body || "surface-map";
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${String(body).replace(/[^a-z0-9_-]+/gi, "-")}.geojson`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    const status = specialistElement("sp-global-status");
    status.textContent = "Surface pins exported as portable GeoJSON.";
    status.classList.remove("error");
  } catch (error) {
    if (!appStore.isCurrent(identity)) return;
    const status = specialistElement("sp-global-status");
    status.textContent = specialistError(error, "GeoJSON export failed.");
    status.classList.add("error");
  } finally {
    if (appStore.isCurrent(identity)) button.disabled = !getWorkflow().current_map;
  }
}

/**
 * @param {MutationRunner} runMutation
 * @param {() => ExobiologyWorkflowView} getWorkflow
 */
export function initExobiologySpecialist(runMutation, getWorkflow) {
  specialistForm("sp-exobio-pin-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button =
      event instanceof SubmitEvent && event.submitter instanceof HTMLButtonElement
        ? event.submitter
        : null;
    const added = await runMutation({
      perform: () =>
        specialistsApi.addExobiologyPin({
          label: specialistInput("sp-exobio-pin-label").value.trim(),
          kind: specialistSelect("sp-exobio-pin-kind").value,
        }),
      button,
      successMessage: "Current surface position pinned locally.",
    });
    if (added) specialistInput("sp-exobio-pin-label").value = "";
  });
  specialistElement("sp-exobio-pins").addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest(".sp-pin-delete");
    if (!(button instanceof HTMLButtonElement)) return;
    void runMutation({
      perform: () => specialistsApi.removeExobiologyPin(button.dataset.pinId || ""),
      button,
      successMessage: "Manual surface pin removed.",
    });
  });
  specialistButton("sp-exobio-export").addEventListener("click", () => {
    void exportExobiologyGeoJson(getWorkflow);
  });
}
