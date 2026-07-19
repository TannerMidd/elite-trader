import { byId, requireById, setPercentStyle, setStyleValue } from "../core/dom.js";
import { fmtDuration, fmtNum, shortCr } from "../core/fmt.js";
import { clear, escapeHtml, html, render, renderToString } from "../core/html.js";
import { appStore } from "../core/store.js";
import { plotButton } from "../shell/status.js";

/**
 * @typedef {{name?: string, count?: number}} InventoryItem
 * @typedef {{
 *   total?: number,
 *   raw?: InventoryItem[],
 *   manufactured?: InventoryItem[],
 *   encoded?: InventoryItem[],
 * }} MaterialsInventory
 * @typedef {{basic?: number, standard?: number, premium?: number}} SynthesisInventory
 * @typedef {{
 *   progress?: string,
 *   name?: string,
 *   rank?: number,
 *   on_foot?: boolean,
 *   offers?: string,
 *   system?: string,
 * }} Engineer
 * @typedef {{
 *   name?: string,
 *   type?: string,
 *   hot?: boolean,
 *   value?: number|null,
 *   system?: string,
 *   in_transit?: boolean,
 *   transfer_cr?: number|null,
 *   transfer_s?: number|null,
 * }} StoredShip
 * @typedef {{
 *   here?: StoredShip[],
 *   remote?: StoredShip[],
 *   station?: string,
 *   system?: string,
 * }} StoredShips
 * @typedef {{
 *   total?: number,
 *   items?: InventoryItem[],
 *   components?: InventoryItem[],
 *   data?: InventoryItem[],
 *   consumables?: InventoryItem[],
 * }} OdysseyLocker
 * @typedef {{
 *   departure_ts?: number|null,
 *   system?: string,
 *   body?: string,
 * }} CarrierJump
 * @typedef {{
 *   name?: string,
 *   callsign?: string,
 *   balance?: number|null,
 *   fuel_t?: number|null,
 *   free_space?: number|null,
 *   capacity?: number|null,
 *   jump?: CarrierJump|null,
 * }} Carrier
 */

/** @param {unknown} value @returns {MaterialsInventory} */
function materialsInventory(value) {
  return /** @type {MaterialsInventory} */ (value && typeof value === "object" ? value : {});
}

/** @param {unknown} value */
export function renderMaterials(value) {
  const materials = materialsInventory(value);
  const groups = /** @type {HTMLElement} */ (requireById("materials-groups"));
  const total = materials.total || 0;
  requireById("materials-empty").classList.toggle("hidden", total > 0);
  requireById("materials-total").textContent = total ? `${total} items` : "";

  const snapshot = appStore.getSnapshot();
  const synthesis = /** @type {SynthesisInventory|null} */ (
    snapshot?.synth ? /** @type {unknown} */ (snapshot.synth) : null
  );
  const synthesisLine = byId("synth-line");
  if (synthesisLine) {
    synthesisLine.classList.toggle("hidden", !synthesis || !total);
    if (synthesis && total) {
      render(
        synthesisLine,
        html`<b>FSD INJECTION</b> <span class="dim">(jumponium · one-jump range boost)</span> ·
          basic ×${synthesis.basic || 0} <span class="dim">(+25%)</span> · standard
          ×${synthesis.standard || 0} <span class="dim">(+50%)</span> · premium
          ×${synthesis.premium || 0} <span class="dim">(+100%)</span>`,
      );
    }
  }
  const signature = JSON.stringify(materials);
  if (groups.dataset.sig === signature) return;
  groups.dataset.sig = signature;
  clear(groups);

  /** @type {readonly (keyof Pick<MaterialsInventory, "raw"|"manufactured"|"encoded">)[]} */
  const categories = ["raw", "manufactured", "encoded"];
  for (const category of categories) {
    const items = materials[category] || [];
    if (!items.length) continue;
    const column = document.createElement("div");
    column.className = "mat-group";
    render(
      column,
      html`<div class="label">
        ${category.toUpperCase()} <span class="dim">${items.length}</span>
      </div>`,
    );
    const list = document.createElement("ul");
    list.className = "cargo-list";
    for (const item of items) {
      const row = document.createElement("li");
      render(
        row,
        html`<span>${item.name || "?"}</span><span class="count">${item.count || 0}</span>`,
      );
      list.appendChild(row);
    }
    column.appendChild(list);
    groups.appendChild(column);
  }
}

/** @type {Record<string, readonly [string, string]>} */
export const ENG_STAGE_LABEL = {
  Unlocked: ["UNLOCKED", "ready to use — higher grades unlock as you craft with them"],
  Invited: ["INVITED", "visit their workshop once to unlock them"],
  Known: ["KNOWN", "meet their unlock terms first — requirements on Inara"],
};

export function renderEngineers() {
  const list = /** @type {HTMLElement|null} */ (byId("engineers-list"));
  if (!list) return;
  const engineers = /** @type {Engineer[]} */ (
    /** @type {unknown} */ (appStore.getSnapshot()?.engineers || [])
  );
  requireById("engineers-empty").classList.toggle("hidden", engineers.length > 0);
  const unlocked = engineers.filter((engineer) => engineer.progress === "Unlocked").length;
  requireById("engineers-count").textContent = engineers.length
    ? `${unlocked} of ${engineers.length} unlocked`
    : "";
  const signature = JSON.stringify(engineers);
  if (list.dataset.sig === signature) return;
  list.dataset.sig = signature;
  clear(list);

  for (const stage of ["Unlocked", "Invited", "Known"]) {
    const rows = engineers.filter((engineer) => engineer.progress === stage);
    if (!rows.length) continue;
    const [label, description] = ENG_STAGE_LABEL[stage] || [stage, ""];
    const section = document.createElement("div");
    section.className = "eng-stage";
    render(
      section,
      html`<div class="label">
        ${label} <span class="dim">${rows.length} · ${description}</span>
      </div>`,
    );
    for (const engineer of rows) {
      const row = document.createElement("div");
      row.className = "eng-row";
      const rank = Math.max(0, Math.min(5, Math.trunc(engineer.rank || 0)));
      const pips =
        stage === "Unlocked" && rank
          ? html`<span class="eng-pips" title="Grade ${rank} of 5 unlocked"
              >${"●".repeat(rank)}${"○".repeat(5 - rank)} G${rank}</span
            >`
          : "";
      render(
        row,
        html`<b>${engineer.name || "?"}</b>${
            engineer.on_foot
              ? html` <span
                  class="chip"
                  title="Odyssey on-foot engineer — upgrades suits and hand weapons"
                  >ON-FOOT</span
                >`
              : ""
          }
          ${pips}
          <span class="dim"
            >${engineer.offers || ""}${
              engineer.system ? (engineer.offers ? " · " : "") + engineer.system : ""
            }</span
          >`,
      );
      if (engineer.system) row.appendChild(plotButton(engineer.system));
      section.appendChild(row);
    }
    list.appendChild(section);
  }
}

export function renderStoredShips() {
  const list = /** @type {HTMLElement|null} */ (byId("ships-list"));
  if (!list) return;
  const snapshot = appStore.getSnapshot();
  const stored = /** @type {StoredShips|null} */ (
    snapshot?.stored_ships ? /** @type {unknown} */ (snapshot.stored_ships) : null
  );
  const shipsHere = stored?.here || [];
  const remote = stored?.remote || [];
  requireById("ships-empty").classList.toggle("hidden", !!stored);
  const total = shipsHere.length + remote.length + 1;
  requireById("ships-count").textContent = stored ? `${total} ships` : "";
  const signature = JSON.stringify([
    stored,
    snapshot?.ship_type,
    snapshot?.ship_name,
    snapshot?.system,
  ]);
  if (list.dataset.sig === signature) return;
  list.dataset.sig = signature;
  clear(list);
  if (!stored) return;

  /**
   * @param {string} title
   * @param {string} subtitle
   * @param {ReturnType<typeof html>|string} tags
   * @param {string|null|undefined} system
   */
  const addRow = (title, subtitle, tags, system) => {
    const row = document.createElement("div");
    row.className = "ship-row";
    render(row, html`<b>${title}</b><span class="dim">${subtitle}${tags}</span>`);
    if (system) row.appendChild(plotButton(system));
    list.appendChild(row);
  };

  const flying = [snapshot?.ship_name, snapshot?.ship_type ? `(${snapshot.ship_type})` : null]
    .filter(Boolean)
    .join(" ");
  addRow(
    flying || "Current ship",
    `with you now${snapshot?.system ? ` · ${snapshot.system}` : ""}`,
    "",
    null,
  );
  for (const ship of shipsHere) {
    addRow(
      shipTitleText(ship),
      `stored at ${stored.station || "this station"} · ${stored.system || ""}`,
      shipTagsTemplate(ship),
      null,
    );
  }
  for (const ship of remote) {
    const subtitle =
      `${ship.system || "?"}` +
      (ship.in_transit
        ? " · in transit"
        : ship.transfer_cr != null
          ? ` · transfer ${shortCr(ship.transfer_cr)} cr · ${fmtDuration(ship.transfer_s)}`
          : "");
    addRow(shipTitleText(ship), subtitle, shipTagsTemplate(ship), ship.system);
  }
  const note = document.createElement("div");
  note.className = "dim";
  note.textContent = `As of your shipyard visit at ${stored.station || "?"} — transfers are paid at any shipyard and the ship flies itself to you.`;
  list.appendChild(note);
}

/** @param {StoredShip} ship */
export function shipTitle(ship) {
  return escapeHtml(shipTitleText(ship));
}

/** @param {StoredShip} ship */
export function shipTags(ship) {
  return renderToString(shipTagsTemplate(ship));
}

/** @param {StoredShip} ship */
function shipTitleText(ship) {
  return [ship.name, ship.type ? (ship.name ? `(${ship.type})` : ship.type) : null]
    .filter(Boolean)
    .join(" ");
}

/** @param {StoredShip} ship */
function shipTagsTemplate(ship) {
  return html`${
    ship.hot
      ? html` ·
          <span
            class="warn"
            title="This ship is wanted — landing at a normal station risks fines or worse. Clean it at an Interstellar Factors contact."
            >⚠ HOT</span
          >`
      : ""
  }${ship.value != null ? ` · ${shortCr(ship.value)} cr` : ""}`;
}

export function renderOdysseyLocker() {
  const card = /** @type {HTMLElement|null} */ (byId("odyssey-card"));
  if (!card) return;
  const locker = /** @type {OdysseyLocker|null} */ (
    appStore.getSnapshot()?.ship_locker
      ? /** @type {unknown} */ (appStore.getSnapshot()?.ship_locker)
      : null
  );
  card.classList.toggle("hidden", !locker?.total);
  if (!locker?.total) return;
  requireById("odyssey-total").textContent = `${locker.total} items`;
  const groups = /** @type {HTMLElement} */ (requireById("odyssey-groups"));
  const signature = JSON.stringify(locker);
  if (groups.dataset.sig === signature) return;
  groups.dataset.sig = signature;
  clear(groups);

  /** @type {readonly [keyof Pick<OdysseyLocker, "items"|"components"|"data"|"consumables">, string][]} */
  const categories = [
    ["items", "GOODS"],
    ["components", "ASSETS"],
    ["data", "DATA"],
    ["consumables", "CONSUMABLES"],
  ];
  for (const [key, label] of categories) {
    const items = locker[key] || [];
    if (!items.length) continue;
    const column = document.createElement("div");
    column.className = "mat-group";
    render(
      column,
      html`<div class="label">${label} <span class="dim">${items.length}</span></div>`,
    );
    const list = document.createElement("ul");
    list.className = "cargo-list";
    for (const item of items) {
      const row = document.createElement("li");
      render(
        row,
        html`<span>${item.name || "?"}</span><span class="count">${item.count || 0}</span>`,
      );
      list.appendChild(row);
    }
    column.appendChild(list);
    groups.appendChild(column);
  }
}

export const FC_FUEL_MAX = 1000;

export function renderCarrier() {
  const card = /** @type {HTMLElement|null} */ (byId("fc-card"));
  if (!card) return;
  const carrier = /** @type {Carrier|null} */ (
    appStore.getSnapshot()?.carrier
      ? /** @type {unknown} */ (appStore.getSnapshot()?.carrier)
      : null
  );
  card.classList.toggle("hidden", !carrier);
  if (!carrier) return;
  requireById("fc-ident").textContent = [carrier.name, carrier.callsign]
    .filter(Boolean)
    .join(" · ");
  requireById("fc-balance").textContent =
    carrier.balance != null ? `${shortCr(carrier.balance)} cr` : "";
  const fuel = carrier.fuel_t;
  const percent = fuel != null ? Math.round((fuel / FC_FUEL_MAX) * 100) : 0;
  const fill = /** @type {HTMLElement} */ (requireById("fc-fuel-fill"));
  setPercentStyle(fill, "width", percent);
  setStyleValue(fill, "background", fuel != null && fuel < 135 ? "var(--bad)" : "var(--good)");
  requireById("fc-fuel-text").textContent =
    fuel != null ? `${fmtNum(fuel)} / ${FC_FUEL_MAX} t` : "—";
  requireById("fc-space").textContent =
    carrier.free_space != null
      ? `· FREE SPACE ${fmtNum(carrier.free_space)} t${
          carrier.capacity ? " of " + fmtNum(carrier.capacity) : ""
        }`
      : "";

  const jumpElement = requireById("fc-jump");
  const jump = carrier.jump;
  jumpElement.classList.toggle("hidden", !jump);
  if (!jump) return;
  const remaining = jump.departure_ts ? jump.departure_ts - Date.now() / 1000 : null;
  render(
    jumpElement,
    html`<span class="fc-jump-badge">◈ JUMP SCHEDULED</span> → <b>${jump.system || "?"}</b>${
        jump.body ? html` <span class="dim">${jump.body}</span>` : ""
      }${
        remaining != null
          ? html` ·
              <span class="${remaining <= 0 ? "dim" : "soon"}"
                >${remaining <= 0 ? "departing…" : "departs in " + fmtDuration(remaining)}</span
              >`
          : ""
      }`,
  );
  if (jump.system) jumpElement.appendChild(plotButton(jump.system));
}
