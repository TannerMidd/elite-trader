/**
 * Static markup owned by the specialists feature surface.
 *
 * Values from APIs, journals, EDDN, localStorage, and forms never belong in
 * this template; dynamic content is rendered through core/html.js.
 */
export const specialistsView = String.raw`<div class="tabpane hidden" id="tab-specialists">
    <div class="sp-scope" role="note">
      <b>LOCAL SPECIALIST CONSOLE</b>
      Mining, combat, carrier and surface records come from your own journal and explicit inputs. Everything stays
      on this machine; no account, API key or online service is involved.
    </div>

    <div class="sp-switcher hb-group" role="tablist" aria-label="Specialist workflow">
      <button type="button" role="tab" class="hb" aria-pressed="true" data-specialist="mining" aria-controls="sp-workflow-mining" aria-selected="true">
        <span aria-hidden="true">◆</span><b>MINING</b><small>yield &amp; limpets</small>
      </button>
      <button type="button" role="tab" class="hb" aria-pressed="false" data-specialist="combat" aria-controls="sp-workflow-combat" aria-selected="false">
        <span aria-hidden="true">⌁</span><b>COMBAT / AX</b><small>readiness &amp; claims</small>
      </button>
      <button type="button" role="tab" class="hb" aria-pressed="false" data-specialist="carrier" aria-controls="sp-workflow-carrier" aria-selected="false">
        <span aria-hidden="true">▰</span><b>CARRIER</b><small>runway &amp; tritium</small>
      </button>
      <button type="button" role="tab" class="hb" aria-pressed="false" data-specialist="exobiology" aria-controls="sp-workflow-exobiology" aria-selected="false">
        <span aria-hidden="true">⌾</span><b>EXOBIO</b><small>surface navigator</small>
      </button>
    </div>
    <div id="sp-global-status" class="sp-global-status dim" role="status">Loading local specialist records…</div>

    <div class="sp-workflow" id="sp-workflow-mining" role="tabpanel">
      <section class="card" data-arr="specialist-mining-run">
        <div class="card-head">
          <div class="label">MINING RUN <span class="dim">journal-counted yield · no guessed sale attribution</span></div>
          <div class="sp-head-actions">
            <span id="sp-mining-state" class="sp-state idle">IDLE</span>
            <button id="sp-mining-start" class="hb hb-primary hb-sm" type="button">START RUN</button>
            <button id="sp-mining-end" class="hb hb-utility" type="button" disabled>END RUN</button>
          </div>
        </div>
        <div id="sp-mining-message" class="dim">A run also starts automatically when the journal reports mining activity.</div>
        <div class="sp-stat-grid">
          <div class="sp-stat"><span>ELAPSED</span><b id="sp-mining-duration">—</b></div>
          <div class="sp-stat"><span>REFINED</span><b id="sp-mining-refined">—</b></div>
          <div class="sp-stat"><span>YIELD RATE</span><b id="sp-mining-rate">—</b></div>
          <div class="sp-stat"><span>PROSPECTED</span><b id="sp-mining-prospected">—</b></div>
          <div class="sp-stat"><span>CORE CRACKS</span><b id="sp-mining-cracked">—</b></div>
          <div class="sp-stat"><span>RUN REVENUE</span><b id="sp-mining-revenue">—</b></div>
        </div>
      </section>

      <div class="two-col sp-two-col" data-arr="specialist-mining-detail">
        <section class="card" data-arr="specialist-mining-yield">
          <div class="label">REFINERY YIELD <span class="dim">tonnes confirmed by MiningRefined</span></div>
          <div class="table-wrap sp-table-wrap">
            <table>
              <thead><tr><th>Commodity</th><th class="num">Refined</th><th class="num">Cargo Δ</th><th class="num">Sold</th></tr></thead>
              <tbody id="sp-mining-yield"></tbody>
            </table>
          </div>
          <div id="sp-mining-yield-empty" class="dim empty">No refined tonnes in this run yet.</div>
        </section>

        <section class="card" data-arr="specialist-mining-prospectors">
          <div class="label">PROSPECTOR QUALITY <span class="dim">best and average content observed</span></div>
          <div class="table-wrap sp-table-wrap">
            <table>
              <thead><tr><th>Material</th><th class="num">Sightings</th><th class="num">Best</th><th class="num">Average</th></tr></thead>
              <tbody id="sp-mining-targets"></tbody>
            </table>
          </div>
          <div id="sp-mining-targets-empty" class="dim empty">Fire a prospector to begin measuring rock quality.</div>
        </section>
      </div>

      <section class="card" data-arr="specialist-mining-economics">
        <div class="label">LIMPET ECONOMICS <span class="dim">inventory + launches · cost only when a purchase price was observed</span></div>
        <div id="sp-mining-limpets" class="sp-fact-grid"></div>
      </section>

      <section class="card" data-arr="specialist-mining-history">
        <div class="label">RECENT MINING RUNS <span class="dim">durable per commander</span></div>
        <div id="sp-mining-history" class="sp-history"></div>
      </section>
    </div>

    <div class="sp-workflow hidden" id="sp-workflow-combat" role="tabpanel">
      <section class="card" data-arr="specialist-ax-readiness">
        <div class="card-head">
          <div class="label">COMBAT / AX READINESS <span class="dim">facts from the latest journal snapshots</span></div>
          <div id="sp-combat-level" class="sp-readiness-level">NO LOADOUT OBSERVED</div>
        </div>
        <div class="sp-readiness-layout">
          <div class="sp-readiness-score">
            <div class="sp-score-ring" id="sp-combat-score"><b>0</b><span>/ 100</span></div>
            <div class="dim">AX tooling index, not a guarantee of survivability</div>
          </div>
          <div>
            <div id="sp-combat-checklist" class="sp-checklist"></div>
            <div class="sp-observation-note">
              <b>AMMUNITION IS AN OBSERVATION</b>
              Elite does not journal weapon fire. Counts below are from the <b>latest Loadout observation</b>, not live ammo.
            </div>
          </div>
        </div>
        <div class="table-wrap sp-table-wrap">
          <table>
            <thead><tr><th>Observed module</th><th>Slot</th><th class="num">Clip</th><th class="num">Hopper</th><th class="num">Observed total</th></tr></thead>
            <tbody id="sp-combat-ammo"></tbody>
          </table>
        </div>
        <div id="sp-combat-ammo-empty" class="dim empty">No ammunition-bearing AX module was present in the latest Loadout observation.</div>
      </section>

      <section class="card" data-arr="specialist-combat-session">
        <div class="card-head">
          <div class="label">COMBAT SESSION <span class="dim">kills, claims, damage and synthesis from your journal</span></div>
          <div class="sp-head-actions">
            <span id="sp-combat-state" class="sp-state idle">IDLE</span>
            <button id="sp-combat-start" class="hb hb-primary hb-sm" type="button">START SESSION</button>
            <button id="sp-combat-end" class="hb hb-utility" type="button" disabled>END SESSION</button>
          </div>
        </div>
        <div id="sp-combat-message" class="dim">A session also starts automatically on a kill, attack or damage event.</div>
        <div class="sp-stat-grid">
          <div class="sp-stat"><span>ELAPSED</span><b id="sp-combat-duration">—</b></div>
          <div class="sp-stat"><span>KILLS</span><b id="sp-combat-kills">—</b></div>
          <div class="sp-stat"><span>AX KILLS</span><b id="sp-combat-ax-kills">—</b></div>
          <div class="sp-stat"><span>BOUNTIES</span><b id="sp-combat-bounties">—</b></div>
          <div class="sp-stat"><span>BONDS</span><b id="sp-combat-bonds">—</b></div>
          <div class="sp-stat"><span>DAMAGE EVENTS</span><b id="sp-combat-damage">—</b></div>
        </div>
        <div class="sp-session-detail-grid">
          <div><div class="label">AX KILLS BY TYPE</div><div id="sp-combat-ax-types" class="sp-chip-list"></div></div>
          <div><div class="label">SYNTHESIS USED</div><div id="sp-combat-synthesis" class="sp-chip-list"></div></div>
        </div>
      </section>

      <section class="card" data-arr="specialist-combat-history">
        <div class="label">RECENT COMBAT SESSIONS <span class="dim">claims remain unredeemed until the game reports redemption</span></div>
        <div id="sp-combat-history" class="sp-history"></div>
      </section>
    </div>

    <div class="sp-workflow hidden" id="sp-workflow-carrier" role="tabpanel">
      <section class="card" data-arr="specialist-carrier-overview">
        <div class="card-head">
          <div class="label">FLEET CARRIER CONTROL <span class="dim">owner journal snapshots + explicit planning inputs</span></div>
          <div id="sp-carrier-identity" class="value dim">NO OWNER SNAPSHOT</div>
        </div>
        <div id="sp-carrier-message" class="dim">Open Carrier Management in game to supply an authoritative status snapshot.</div>
        <div class="sp-stat-grid">
          <div class="sp-stat"><span>CARRIER BALANCE</span><b id="sp-carrier-balance">—</b></div>
          <div class="sp-stat"><span>UPKEEP RESERVE</span><b id="sp-carrier-reserve">—</b></div>
          <div class="sp-stat"><span>RESERVE RUNWAY</span><b id="sp-carrier-runway">—</b></div>
          <div class="sp-stat"><span>TRITIUM TANK</span><b id="sp-carrier-tank">—</b></div>
          <div class="sp-stat"><span>CARGO USED</span><b id="sp-carrier-space">—</b></div>
          <div class="sp-stat"><span>BUY EXPOSURE</span><b id="sp-carrier-exposure">—</b></div>
        </div>
      </section>

      <div class="two-col sp-two-col" data-arr="specialist-carrier-finance">
        <section class="card" data-arr="specialist-carrier-upkeep">
          <div class="label">UPKEEP RUNWAY <span class="dim">weekly upkeep is an explicit commander input</span></div>
          <form id="sp-carrier-config-form" class="sp-form">
            <label>Weekly upkeep (cr)
              <input id="sp-carrier-weekly" type="number" min="0" step="100000" placeholder="Enter from carrier management" required>
            </label>
            <label>Reserve target (weeks)
              <input id="sp-carrier-target-weeks" type="number" min="0" max="520" value="8" required>
            </label>
            <button class="hb hb-primary" type="submit">SAVE LOCAL INPUT</button>
          </form>
          <div id="sp-carrier-upkeep-note" class="dim">Frameshift never invents a weekly upkeep value.</div>
        </section>

        <section class="card" data-arr="specialist-carrier-inventory">
          <div class="label">CARRIER CARGO <span class="dim">explicit inventory · one line per commodity</span></div>
          <form id="sp-carrier-inventory-form" class="sp-form">
            <label class="sp-grow">Commodity inventory
              <textarea id="sp-carrier-inventory-input" rows="4" placeholder="Tritium | 850&#10;Palladium | 120"></textarea>
            </label>
            <button class="hb hb-primary" type="submit">SAVE INVENTORY</button>
          </form>
          <div id="sp-carrier-inventory-source" class="dim"></div>
          <div id="sp-carrier-inventory" class="sp-chip-list"></div>
        </section>
      </div>

      <section class="card" data-arr="specialist-carrier-route">
        <div class="card-head">
          <div class="label">TRITIUM ROUTE <span class="dim">every leg and fuel figure is explicit</span></div>
          <button id="sp-carrier-add-leg" class="hb hb-utility" type="button">+ ADD LEG</button>
        </div>
        <form id="sp-carrier-route-form" class="sp-form">
          <div id="sp-carrier-legs" class="sp-route-legs"></div>
          <div class="sp-route-options">
            <label>Fallback tritium / jump (t)
              <input id="sp-carrier-per-jump" type="number" min="0" step="0.1" placeholder="Used when a leg is blank">
            </label>
            <label>Arrival reserve (t)
              <input id="sp-carrier-route-reserve" type="number" min="0" step="1" value="0">
            </label>
            <button class="hb hb-primary" type="submit">CHECK ROUTE</button>
          </div>
        </form>
        <div id="sp-carrier-route-result" class="sp-route-result dim">Add systems and exact leg distances; Frameshift checks observed range and tritium coverage.</div>
      </section>

      <section class="card" data-arr="specialist-carrier-orders">
        <div class="label">MARKET ORDERS <span class="dim">latest owner-side CarrierTradeOrder observations</span></div>
        <div class="table-wrap sp-table-wrap">
          <table>
            <thead><tr><th>Commodity</th><th>Side</th><th class="num">Quantity</th><th class="num">Price</th><th class="num">Exposure / stock</th></tr></thead>
            <tbody id="sp-carrier-orders"></tbody>
          </table>
        </div>
        <div id="sp-carrier-orders-empty" class="dim empty">No active carrier market order has been observed.</div>
      </section>
    </div>

    <div class="sp-workflow hidden" id="sp-workflow-exobiology" role="tabpanel">
      <section class="card" data-arr="specialist-exobio-map">
        <div class="card-head">
          <div class="label">SURFACE NAVIGATOR <span class="dim">body-local map · north-up · journal + Status.json</span></div>
          <div class="sp-head-actions">
            <span id="sp-exobio-body" class="value dim">NO SURFACE POSITION</span>
            <button id="sp-exobio-export" class="hb hb-utility" type="button" disabled>EXPORT GEOJSON</button>
          </div>
        </div>
        <div class="sp-map-layout">
          <div>
            <div id="sp-exobio-map" class="sp-surface-map" role="img" aria-label="Local surface map centered on the commander"></div>
            <div class="sp-map-meta"><span id="sp-exobio-coords">Latitude / longitude unavailable</span><span id="sp-exobio-range"></span></div>
          </div>
          <aside class="sp-sampling-card" id="sp-sampling-card">
            <div class="label">GENETIC SAMPLER</div>
            <div id="sp-sampling-name" class="sp-sampling-name">No organism in progress</div>
            <div id="sp-sampling-progress" class="dim">Start a sample in game to arm clearance guidance.</div>
            <div id="sp-sampling-clearance" class="sp-clearance unknown">CLEARANCE UNKNOWN</div>
          </aside>
        </div>
        <div class="sp-map-legend" aria-label="Surface map legend">
          <span><i class="player"></i>YOU / HEADING</span><span><i class="sample"></i>ORGANIC SAMPLE</span>
          <span><i class="manual"></i>MANUAL PIN</span><span><i class="journal"></i>LANDING / CODEX</span>
        </div>
      </section>

      <section class="card" data-arr="specialist-exobio-pins">
        <div class="card-head">
          <div class="label">SURFACE PINS <span class="dim">saved per body and commander</span></div>
          <div id="sp-exobio-pin-count" class="value dim"></div>
        </div>
        <form id="sp-exobio-pin-form" class="sp-form sp-pin-form">
          <label class="sp-grow">Label
            <input id="sp-exobio-pin-label" type="text" maxlength="120" placeholder="Parked ship, promising valley, return point…" required>
          </label>
          <label>Kind
            <select id="sp-exobio-pin-kind">
              <option value="waypoint">Waypoint</option>
              <option value="ship">Ship / SRV</option>
              <option value="target">Search target</option>
              <option value="hazard">Hazard</option>
            </select>
          </label>
          <button id="sp-exobio-pin-add" class="hb hb-primary" type="submit">PIN CURRENT POSITION</button>
        </form>
        <div id="sp-exobio-pin-status" class="dim">Pins require a live latitude and longitude from Status.json.</div>
        <div id="sp-exobio-pins" class="sp-pin-list"></div>
      </section>
    </div>
  </div>`;
