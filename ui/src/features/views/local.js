/**
 * Static markup owned by the local feature surface.
 *
 * Values from APIs, journals, EDDN, localStorage, and forms never belong in
 * this template; dynamic content is rendered through core/html.js.
 */
export const localView = String.raw`<div class="tabpane hidden" id="tab-local">
    <section class="card hidden" id="fc-card" data-arr="carrier">
      <div class="card-head">
        <div class="label">FLEET CARRIER <span class="dim" id="fc-ident"></span></div>
        <div class="value orange" id="fc-balance"></div>
      </div>
      <div class="fc-row" id="fc-fuel-row">
        <span class="dim">TRITIUM</span>
        <div class="seedbar fc-fuelbar"><div id="fc-fuel-fill"></div></div>
        <span id="fc-fuel-text">—</span>
        <span class="dim" id="fc-space"></span>
      </div>
      <div id="fc-jump" class="fc-jump hidden"></div>
      <div class="dim" id="fc-note">Tritium fuels carrier jumps (up to 500 ly each). Restock from your cargo hold
        at the carrier's TRITIUM DEPOT, and keep the reserve topped up before long expeditions.</div>
    </section>

    <section class="card" id="missions-card" data-arr="missions">
      <div class="card-head">
        <div class="label">ACTIVE MISSIONS <span class="dim">from your journal · red = expiring soon · ⚠ = cargo not aboard</span></div>
        <div class="value orange" id="missions-count"></div>
      </div>
      <div id="missions-list"></div>
      <div id="missions-empty" class="dim empty">No active missions — accept some at a station's mission board and they'll show here.</div>
    </section>

    <section class="card hidden" id="massacre-card" data-arr="massacre">
      <div class="card-head">
        <div class="label">MASSACRE STACKS <span class="dim">kills count toward every giver's missions at once · the largest giver sets the target</span></div>
        <div class="value orange" id="massacre-reward"></div>
      </div>
      <div class="dim" id="combat-session"></div>
      <div id="massacre-list"></div>
    </section>
    <div class="two-col" data-arr="marketjumps">
      <section class="card" data-arr="market">
        <div class="card-head">
          <div class="label" id="market-title">STATION MARKET</div>
          <input type="search" id="market-filter" placeholder="filter…">
        </div>
        <div class="table-wrap">
          <table id="market-table">
            <thead>
              <tr>
                <th data-sort="name">Commodity</th>
                <th data-sort="sell" class="num">Sell</th>
                <th data-sort="buy" class="num">Buy</th>
                <th data-sort="demand" class="num">Demand</th>
                <th data-sort="stock" class="num">Stock</th>
                <th class="num" title="Sell-price history recorded for this station (your visits + live community reports)">History</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
          <div id="market-empty" class="dim empty">No market data yet — open the commodities screen at a station.</div>
        </div>
      </section>

      <section class="card" data-arr="jumpscargo">
        <div class="label">JUMP HISTORY</div>
        <ul id="jumps" class="jumps"></ul>
        <div id="jumps-empty" class="dim empty">No jumps recorded yet this session.</div>
        <div class="card-head cargo-label">
          <div class="label">CARGO HOLD</div>
          <button id="cargo-sell-btn" class="hb hb-primary hb-sm">WHERE TO SELL?</button>
        </div>
        <ul id="cargo-list" class="cargo-list"></ul>
        <div id="cargo-empty" class="dim empty">Cargo hold is empty.</div>
        <div id="cargo-sell-status" class="dim"></div>
        <div id="cargo-sell-results"></div>
      </section>
    </div>


    <section class="card" id="ships-card" data-arr="ships">
      <div class="card-head">
        <div class="label">YOUR SHIPS <span class="dim">current + stored fleet · refreshed each shipyard visit</span></div>
        <div class="value dim" id="ships-count"></div>
      </div>
      <div id="ships-list"></div>
      <div id="ships-empty" class="dim empty">Open any station's shipyard once and your whole fleet appears here —
        which ship is where, what it's worth, and what a transfer costs.</div>
    </section>
    <section class="card" id="sysstations-card" data-arr="sysstations">
      <div class="label">SYSTEM STATIONS <span class="dim">every station's facts &amp; market · Spansh + your local DB</span></div>
      <form id="ss-form" class="route-form">
        <label>System <input type="text" id="ss-system" placeholder="current system" autocomplete="off"></label>
        <button type="submit" id="ss-go" class="hb hb-primary">VIEW</button>
      </form>
      <div id="ss-status" class="dim"></div>
      <div id="ss-list"></div>
    </section>

    <section class="card" id="colonisation-card" data-arr="colonisation">
      <div class="label">COLONIZATION PROJECTS <span class="dim">construction depots you've visited · what's still needed and where to buy it</span></div>
      <div id="colonisation-list"></div>
      <div id="colonisation-empty" class="dim empty">No tracked construction projects yet. The game only shares a
        depot's shopping list while you're docked at the construction site itself — the "Construction Site" or
        colonisation ship, not just any station in a colonising system. Dock there once and this card fills in
        with what's still needed, what each delivery pays, and the nearest places to buy it.</div>
    </section>
    <section class="card" id="iff-card" data-arr="iff">
      <div class="label">PAY OFF BOUNTIES &amp; FINES <span class="dim">nearest Interstellar Factors contact · via Spansh</span></div>
      <form id="iff-form" class="route-form">
        <button type="submit" id="iff-go" class="hb hb-primary">FIND NEAREST</button>
      </form>
      <div id="iff-status" class="dim">Picked up a bounty or a fine? An <b>Interstellar Factors</b> contact clears
        your record from any station that hosts one (for a 25% cut) — no trip back to the issuing faction's space.
        Your current legal state shows in the LEGAL readout up top.</div>
      <div id="iff-results"></div>
    </section>


  </div>`;
