/**
 * Static markup owned by the galaxy feature surface.
 *
 * Values from APIs, journals, EDDN, localStorage, and forms never belong in
 * this template; dynamic content is rendered through core/html.js.
 */
export const galaxyView = String.raw`<div class="tabpane hidden" id="tab-galaxy">
    <div class="galaxy-scope" role="note">
      <b>LOCAL JOURNAL INTELLIGENCE</b>
      Frameshift records what your game reports when you arrive. It does not claim a live, galaxy-wide BGS or
      Powerplay view; revisit a system to build your own on-device history.
    </div>

    <section class="card" id="powerplay-card" data-arr="powerplay">
      <div class="card-head">
        <div class="label">POWERPLAY <span class="dim">your PP2 pledge &amp; latest local system snapshot &middot; from your journal</span></div>
        <div class="value dim" id="pp-merits"></div>
      </div>
      <div id="pp-pledge" class="hidden"></div>
      <div id="pp-sys" class="hidden"></div>
      <div id="pp-empty" class="dim empty">Not pledged to a power yet. <b>Powerplay</b> is the galaxy's cold war:
        twelve Powers compete for control of inhabited space, and pledged commanders earn <b>merits</b> and
        persistent PP2 ranks by hauling, fighting and exploring for their Power. The first Powerplay module unlocks
        at rank 34 and all twelve are available by rank 97. Pledge from the galaxy map's POWERPLAY tab &mdash;
        progress appears here automatically.</div>
    </section>

    <section class="card" id="factions-card" data-arr="factions">
      <div class="card-head">
        <div class="label">SYSTEM FACTIONS <span class="dim">latest arrival snapshot &middot; influence, states &amp; your reputation</span></div>
        <div class="value dim" id="factions-count"></div>
      </div>
      <div id="factions-list"></div>
      <div id="factions-empty" class="dim empty">No faction data for this system yet — it refreshes every time you
        jump into (or load in) a populated system. Every station and settlement belongs to a <b>minor faction</b>;
        your missions, trade, bounties and exploration data nudge their <b>influence</b> up or down, which decides
        who controls the system. Work for a faction and your <b>reputation</b> with it unlocks better missions.</div>
    </section>

    <section class="card hidden" id="conflicts-card" data-arr="conflicts">
      <div class="card-head">
        <div class="label">LOCAL CONFLICTS <span class="dim">latest arrival snapshot &middot; first to 4 days won takes the stake</span></div>
        <div class="value dim" id="conflicts-count"></div>
      </div>
      <div id="conflicts-list"></div>
    </section>

    <section class="card" id="galaxy-history-card" data-arr="galhistory">
      <div class="card-head">
        <div class="label">LOCAL VISIT HISTORY <span class="dim">change since your previous observation &middot; saved in this browser</span></div>
        <div class="galhistory-actions">
          <div class="value dim" id="galhistory-count"></div>
          <button type="button" class="hb hb-utility hb-sm hb-danger" id="galhistory-clear" title="Delete old Galaxy observations and use the current system as a new baseline">CLEAR</button>
        </div>
      </div>
      <div id="galhistory-summary"></div>
      <div id="galhistory-list"></div>
      <div id="galhistory-empty" class="dim empty">No comparison yet. Frameshift saves one snapshot when the
        journal reports a populated system; return after a BGS tick or Powerplay change to see local deltas.</div>
    </section>

    <section class="card" id="cg-card" data-arr="commgoals">
      <div class="card-head">
        <div class="label">JOINED COMMUNITY GOALS <span class="dim">your journal-reported contribution &amp; reward tier</span></div>
        <div class="value dim" id="cg-count"></div>
      </div>
      <div id="cg-list"></div>
      <div id="cg-empty" class="dim empty">No community goals joined. <b>Community Goals</b> are limited-time,
        galaxy-wide efforts — deliver goods, bounties or exploration data to a named station and everyone who
        chips in gets paid by contribution tier when it ends. Find active goals on
        <a class="extlink" href="https://inara.cz/elite/communitygoals/" target="_blank" rel="noopener">Inara · Community goals ↗</a>,
        sign up at the listed station's mission board, and your progress shows here.</div>
    </section>

    <section class="card hidden" id="squadron-card" data-arr="squadron">
      <div class="card-head">
        <div class="label">SQUADRON <span class="dim">your in-game player group</span></div>
      </div>
      <div id="squadron-info"></div>
    </section>
  </div>`;
