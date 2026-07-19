/**
 * Static markup owned by the analytics feature surface.
 *
 * Values from APIs, journals, EDDN, localStorage, and forms never belong in
 * this template; dynamic content is rendered through core/html.js.
 */
export const analyticsView = String.raw`<div class="tabpane hidden" id="tab-analytics">
    <section class="card" id="session-card" data-arr="session">
      <div class="card-head">
        <div class="label">THIS SESSION <span class="dim" id="session-since"></span></div>
        <div class="value good" id="session-crhr">—</div>
      </div>
      <div class="stats an-tiles session-tiles">
        <div class="stat"><div class="label">EARNED</div><div class="value" id="session-earned">—</div></div>
        <div class="stat" title="Estimated value of scans and bio samples gathered this session — banked when you sell them"><div class="label">COLLECTED</div><div class="value" id="session-collected">—</div></div>
        <div class="stat"><div class="label">DURATION</div><div class="value" id="session-duration">—</div></div>
        <div class="stat"><div class="label">JUMPS</div><div class="value" id="session-jumps">—</div></div>
        <div class="stat"><div class="label">DISTANCE</div><div class="value" id="session-ly">—</div></div>
        <div class="stat"><div class="label">TRADE PROFIT</div><div class="value good" id="session-trade">—</div></div>
        <div class="stat"><div class="label">TONS SOLD</div><div class="value" id="session-tons">—</div></div>
      </div>
    </section>

    <section class="card" data-arr="earnings">
      <div class="label">EARNINGS BY SOURCE <span class="dim">all income this period · trade profit + missions, bounties, exploration &amp; exobiology</span></div>
      <div id="earnings-breakdown" class="earnings"></div>
      <div id="earnings-empty" class="dim empty">No earnings recorded in this period yet.</div>
    </section>

    <section class="card" data-arr="trading">
      <div class="card-head">
        <div class="label">TRADING PERFORMANCE <span class="dim">from your journal history · sell profit = sale − average paid</span></div>
        <select id="an-days">
          <option value="7">7 days</option>
          <option value="30" selected>30 days</option>
          <option value="90">90 days</option>
          <option value="365">1 year</option>
        </select>
      </div>
      <div class="stats an-tiles">
        <div class="stat"><div class="label">PROFIT TODAY</div><div class="value" id="an-today">—</div></div>
        <div class="stat"><div class="label">PROFIT 7 DAYS</div><div class="value" id="an-week">—</div></div>
        <div class="stat"><div class="label">PROFIT PERIOD</div><div class="value" id="an-period">—</div></div>
        <div class="stat"><div class="label">TONS SOLD</div><div class="value" id="an-tons">—</div></div>
      </div>
    </section>
    <section class="card" data-arr="balance">
      <div class="label">CREDIT BALANCE OVER TIME</div>
      <div class="chart-wrap"><svg id="an-balance" width="100%" height="220"></svg></div>
    </section>
    <section class="card" data-arr="daily">
      <div class="label">DAILY TRADING PROFIT</div>
      <div class="chart-wrap"><svg id="an-daily" width="100%" height="200"></svg></div>
    </section>
    <section class="card" data-arr="topcomm">
      <div class="label">TOP COMMODITIES BY PROFIT</div>
      <div class="table-wrap">
        <table id="an-top" class="hidden">
          <thead><tr><th>Commodity</th><th class="num">Tons sold</th><th class="num">Profit</th></tr></thead>
          <tbody></tbody>
        </table>
        <div id="an-empty" class="dim empty">No trades recorded yet — buy and sell something and this fills in.</div>
      </div>
    </section>
  </div>`;
