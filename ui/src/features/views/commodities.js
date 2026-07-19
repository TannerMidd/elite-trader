/**
 * Static markup owned by the commodities feature surface.
 *
 * Values from APIs, journals, EDDN, localStorage, and forms never belong in
 * this template; dynamic content is rendered through core/html.js.
 */
export const commoditiesView = String.raw`<div class="tabpane hidden" id="tab-commodities">
    <section class="card" data-arr="comsearch">
      <div class="label">COMMODITY SEARCH <span class="dim">local database · where to buy or sell near you</span></div>
      <form id="cs-form" class="route-form">
        <label>Commodity
          <input type="text" id="cs-query" list="commodity-list" placeholder="e.g. Gold" autocomplete="off">
          <datalist id="commodity-list"></datalist>
        </label>
        <label>I want to
          <select id="cs-mode">
            <option value="sell">Sell (best price)</option>
            <option value="buy">Buy (cheapest)</option>
          </select>
        </label>
        <label>Radius (ly) <input type="number" id="cs-radius" min="1" value="50"></label>
        <label>Min units <input type="number" id="cs-min" min="1" value="100"></label>
        <label title="Search around another system instead — your carrier's destination, tomorrow's expedition stop…">Near <input type="text" id="cs-near" placeholder="current system" autocomplete="off"></label>
        <label class="check"><input type="checkbox" id="cs-largepad"> Large pad</label>
        <button type="submit" id="cs-go" class="hb hb-primary">SEARCH</button>
      </form>
      <div id="cs-status" class="dim"></div>
      <div class="table-wrap">
        <table id="cs-table" class="hidden"><!-- commodity results -->
          <thead>
            <tr>
              <th class="sortable" data-sort="station">Station</th><th class="sortable" data-sort="system">System</th>
              <th class="num sortable" data-sort="price">Price</th><th class="num sortable" data-sort="units">Units</th>
              <th class="num sortable" data-sort="jump">Jump</th><th class="num sortable" data-sort="dist_ls">Star dist</th>
              <th class="num sortable" data-sort="updated">Updated</th><th></th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    </section>
    <section class="card" id="mining-card" data-arr="mining">
      <div class="label">MINING <span class="dim">what's worth mining near you now · best sell price from live data · tap ◇ for nearest hotspots</span></div>
      <form id="mining-form" class="route-form">
        <label>Radius (ly) <input type="number" id="mn-radius" min="1" value="50"></label>
        <label>Min price (cr) <input type="number" id="mn-minprice" min="0" value="50000" title="Hide minerals selling below this"></label>
        <label>Price age (days) <input type="number" id="mn-age" min="1" value="30"></label>
        <label title="Search around another system instead — your carrier's destination, tomorrow's expedition stop…">Near <input type="text" id="mn-near" placeholder="current system" autocomplete="off"></label>
        <label class="check"><input type="checkbox" id="mn-largepad"> Large pad</label>
        <button type="submit" id="mn-go" class="hb hb-primary">FIND</button>
      </form>
      <div id="mining-status" class="dim"></div>
      <div class="table-wrap">
        <table id="mining-table" class="hidden">
          <thead>
            <tr>
              <th class="sortable" data-sort="mineral">Mineral</th><th class="sortable" data-sort="method">Method</th><th class="num sortable" data-sort="sell">Sell</th>
              <th class="sortable" data-sort="station">Best buyer</th><th class="num sortable" data-sort="jump">Jump</th><th class="num sortable" data-sort="demand">Demand</th><th></th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    </section>


    <section class="card" data-arr="outfitting">
      <div class="label">OUTFITTING &amp; SHIPYARDS <span class="dim">nearest stations selling a module or ship · via Spansh</span></div>
      <form id="os-form" class="route-form">
        <label>Search for
          <input type="text" id="os-query" placeholder="e.g. 6A Fuel Scoop / Python" autocomplete="off">
        </label>
        <label>Type
          <select id="os-type">
            <option value="module">Module</option>
            <option value="ship">Ship</option>
          </select>
        </label>
        <label title="Search around another system instead — your carrier's destination, tomorrow's expedition stop…">Near <input type="text" id="os-near" placeholder="current system" autocomplete="off"></label>
        <button type="submit" id="os-go" class="hb hb-primary">SEARCH</button>
      </form>
      <div id="os-status" class="dim"></div>
      <div class="table-wrap">
        <table id="os-table" class="hidden">
          <thead><tr><th class="sortable" data-sort="station">Station</th><th class="sortable" data-sort="system">System</th><th class="num sortable" data-sort="jump">Jump</th><th class="num sortable" data-sort="dist_ls">Star dist</th><th class="sortable" data-sort="pad">Pad</th><th></th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </section>
  </div>`;
