/**
 * Static markup owned by the guides feature surface.
 *
 * Values from APIs, journals, EDDN, localStorage, and forms never belong in
 * this template; dynamic content is rendered through core/html.js.
 */
export const guidesView = String.raw`<div class="tabpane hidden" id="tab-guides">
    <div class="guides-intro dim">Curated routes, planners and references. Everything below is one tap from plotting in the galaxy map.</div>

    <section class="card" id="exobio-card" data-arr="exobio">
      <div class="label">⬡ EXOBIOLOGY ROUTE <span class="dim">the live "Billionaire's Boulevard" — nearest landable, low-gravity worlds packed with high-value biology · via Spansh</span></div>
      <form id="exo-form" class="route-form">
        <label title="Lower gravity = easier to land and drive the SRV">Max gravity (g) <input type="number" id="exo-grav" min="0.1" max="2" step="0.05" value="0.5"></label>
        <label title="Only show bodies worth at least this much in exobiology data">Min value (cr) <input type="number" id="exo-minvalue" min="0" step="any" value="3000000"></label>
        <button type="submit" id="exo-go" class="hb hb-primary">FIND ROUTE</button>
        <div class="exo-genus-filter">
          <span class="egf-label">Genera <span class="dim" id="exo-genus-hint">none = every genus</span></span>
          <div class="egf-chips" id="exo-genus-chips"></div>
        </div>
      </form>
      <div id="exo-status" class="dim"></div>
      <div id="exo-results"></div>
    </section>

    <section class="card" data-arr="riches">
      <div class="label">ROAD TO RICHES <span class="dim">high-value scan/mapping targets near you · via Spansh</span></div>
      <form id="rr-form" class="route-form">
        <label>Jump range (ly) <input type="number" id="rr-range" min="1" step="any"></label>
        <label>Radius (ly) <input type="number" id="rr-radius" min="5" value="50"></label>
        <label>Min value <input type="number" id="rr-minvalue" min="0" value="300000" step="any"></label>
        <label>Systems <input type="number" id="rr-max" min="1" max="100" value="25"></label>
        <label class="check"><input type="checkbox" id="rr-loop" checked> Loop back</label>
        <button type="submit" id="rr-go" class="hb hb-primary">PLAN ROUTE</button>
      </form>
      <div id="rr-status" class="dim"></div>
      <div id="rr-results"></div>
    </section>

    <section class="card" data-arr="neutron">
      <div class="label">NEUTRON PLOTTER <span class="dim">long-range travel via neutron highway · via Spansh</span></div>
      <form id="nr-form" class="route-form">
        <label>Destination <input type="text" id="nr-to" placeholder="e.g. Colonia" autocomplete="off"></label>
        <label>Jump range (ly) <input type="number" id="nr-range" min="1" step="any"></label>
        <label>Efficiency % <input type="number" id="nr-eff" min="1" max="100" value="60"></label>
        <button type="submit" id="nr-go" class="hb hb-primary">PLOT</button>
      </form>
      <div id="nr-status" class="dim"></div>
      <div class="table-wrap">
        <table id="nr-table" class="hidden">
          <thead><tr><th>#</th><th>Waypoint</th><th class="num">Jump (ly)</th><th class="num">Remaining (ly)</th><th class="num">Jumps</th><th></th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </section>

    <section class="card" data-arr="refguides">
      <div class="label">REFERENCE GUIDES <span class="dim">the community's best resources, one click away</span></div>
      <div class="guide-grid">
        <div class="guide-item">
          <b>Engineering unlocks</b>
          <p>Which engineer upgrades which modules, how to gain access, and the materials each blueprint needs.</p>
          <a class="extlink" href="https://inara.cz/elite/engineers/" target="_blank" rel="noopener">Inara · Engineers ↗</a>
        </div>
        <div class="guide-item">
          <b>Material traders</b>
          <p>Trade raw / manufactured / encoded materials up and across grades to cover engineering shortfalls.</p>
          <a class="extlink" href="https://elite-dangerous.fandom.com/wiki/Material_trader" target="_blank" rel="noopener">Wiki · Material Traders ↗</a>
        </div>
        <div class="guide-item">
          <b>Guardian sites &amp; modules</b>
          <p>Farm Guardian blueprints and unlock Guardian FSD boosters, weapons and module reinforcements.</p>
          <a class="extlink" href="https://canonn.science/" target="_blank" rel="noopener">Canonn Research ↗</a>
        </div>
        <div class="guide-item">
          <b>Pre-engineered &amp; tech broker</b>
          <p>Tech-broker and reward modules that arrive pre-modified — including big flat jump-range gains.</p>
          <a class="extlink" href="https://elite-dangerous.fandom.com/wiki/Technology_broker" target="_blank" rel="noopener">Wiki · Tech Broker ↗</a>
        </div>
      </div>
    </section>

    <section class="card" data-arr="builds">
      <div class="label">SHIP BUILDS <span class="dim">starting points by role · open in a ship builder</span></div>
      <div class="guide-grid">
        <div class="guide-item" id="build-current">
          <b>⬢ Your current ship</b>
          <p id="build-current-desc">Open your live loadout in a ship builder to plan the next module or
          engineering upgrade — fills in when the game reports a loadout (launch or switch ships).</p>
          <a class="extlink hidden" id="build-edsy" target="_blank" rel="noopener">Open in EDSY ↗</a>
          <button class="hb hb-utility hb-sm hidden" id="build-slef" type="button"
            title="Copy your loadout as SLEF JSON — paste it into the import box on Coriolis or Inara">⧉ Copy SLEF</button>
        </div>
        <div class="guide-item">
          <b>Exploration</b>
          <p>Max jump range, fuel scoop, DSS, AFMU, SRV. Diamondback Explorer / Krait Phantom / Anaconda.</p>
          <a class="extlink" href="https://edsy.org/" target="_blank" rel="noopener">EDSY ↗</a>
          <a class="extlink" href="https://coriolis.io/" target="_blank" rel="noopener">Coriolis ↗</a>
        </div>
        <div class="guide-item">
          <b>Exobiology</b>
          <p>A light, low-footprint ship that lands easily + SRV + DSS; Artemis suit for the genetic sampler.</p>
          <a class="extlink" href="https://edsy.org/" target="_blank" rel="noopener">EDSY ↗</a>
        </div>
        <div class="guide-item">
          <b>Mining</b>
          <p>Lasers or seismic/sub-surface tools, collector &amp; prospector limpets, refinery, cargo. Python / Type-8 / Cutter.</p>
          <a class="extlink" href="https://edsy.org/" target="_blank" rel="noopener">EDSY ↗</a>
        </div>
        <div class="guide-item">
          <b>Trading</b>
          <p>Maximum cargo with usable jump range and the right pad size. Type-9 / Type-8 / Cutter / Python.</p>
          <a class="extlink" href="https://edsy.org/" target="_blank" rel="noopener">EDSY ↗</a>
        </div>
        <div class="guide-item">
          <b>Combat (PvE)</b>
          <p>Balanced shields/hull, engineered weapons, shield cell banks. Krait Mk II / Fer-de-Lance / Chieftain.</p>
          <a class="extlink" href="https://coriolis.io/" target="_blank" rel="noopener">Coriolis ↗</a>
        </div>
        <div class="guide-item">
          <b>Community builds</b>
          <p>Browse and copy proven loadouts shared by other commanders.</p>
          <a class="extlink" href="https://inara.cz/elite/shipyard/" target="_blank" rel="noopener">Inara · Shipyard ↗</a>
        </div>
      </div>
    </section>
  </div>`;
