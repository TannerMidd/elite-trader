/**
 * Static markup owned by the trade feature surface.
 *
 * Values from APIs, journals, EDDN, localStorage, and forms never belong in
 * this template; dynamic content is rendered through core/html.js.
 */
export const tradeView = String.raw`<div class="tabpane" id="tab-trade">
    <section class="card" data-arr="routes">
      <div class="card-head">
        <div class="label">TRADE ROUTES <span class="dim">computed locally · anonymous EDDN observations · confidence and conservative range included</span></div>
      </div>
      <form id="route-form" class="route-form">
        <label>Type
          <select id="rf-mode">
            <option value="loop">Loop (2 stations)</option>
            <option value="chain">Multi-hop chain</option>
          </select>
        </label>
        <label>Capital <input type="number" id="rf-capital" min="0" step="any"></label>
        <label>Cargo (t) <input type="number" id="rf-cargo" min="2"></label>
        <label id="rf-radius-wrap" title="How far from you the loop's stations may be. A great loop 4-5 jumps away is worth relocating to - the one-time trip there is not held against it.">Search radius (ly) <input type="number" id="rf-radius" min="5" value="100"></label>
        <label id="rf-maxleg-wrap" title="Max distance between the loop's two stations (each leg may take several jumps)">Max leg (ly) <input type="number" id="rf-maxleg" min="0" value="80"></label>
        <label id="rf-jumprange-wrap" title="Used to estimate jumps per leg for the profit/hour ranking; auto-filled from your ship">Jump range (ly) <input type="number" id="rf-jumprange" min="1" step="any"></label>
        <label id="rf-results-wrap" title="How many loops to list">Results <input type="number" id="rf-results" min="1" max="25" value="8"></label>
        <label id="rf-hop-wrap" class="hidden">Max hop (ly) <input type="number" id="rf-hop" min="1" step="any"></label>
        <label id="rf-hops-wrap" class="hidden">Hops <input type="number" id="rf-hops" min="1" max="10" value="4"></label>
        <label>Min units <input type="number" id="rf-minsupply" min="1" title="Ignore commodities with less stock or demand than this"></label>
        <label>Max star dist (ls) <input type="number" id="rf-lsdist" min="1" value="1000"></label>
        <label>Price age (days) <input type="number" id="rf-age" min="1" value="30"></label>
        <label class="check"><input type="checkbox" id="rf-largepad"> Large pad</label>
        <button type="submit" id="rf-go" class="hb hb-primary">FIND ROUTES</button>
      </form>
      <div id="route-status" class="dim"></div>
      <div id="watch-list"></div>
      <div id="route-results"></div>
    </section>
  </div>`;
