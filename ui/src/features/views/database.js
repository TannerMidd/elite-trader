/**
 * Static markup owned by the database feature surface.
 *
 * Values from APIs, journals, EDDN, localStorage, and forms never belong in
 * this template; dynamic content is rendered through core/html.js.
 */
export const databaseView = String.raw`<div class="tabpane hidden" id="tab-database">
    <section class="card" id="settings-card" data-arr="settings">
      <div class="label">SETTINGS <span class="dim">saved on this machine · changes take effect immediately</span></div>
      <div id="settings-list" class="settings-list"></div>
      <div id="settings-info" class="dim settings-info"></div>
    </section>

    <section class="card" id="security-card" data-arr="security">
      <div class="card-head">
        <div class="label">PAIRED DEVICES <span class="dim">zero-account LAN security · localhost stays automatic</span></div>
        <button id="pairing-refresh" class="hb hb-primary hb-sm">NEW ONE-TIME LINK</button>
      </div>
      <div id="security-state" class="dim">Checking device security…</div>
      <div id="pairing-share" class="pairing-share hidden">
        <div class="pairing-qr-wrap">
          <img id="pairing-qr" class="pairing-qr hidden" alt="Scan to pair this device">
          <div class="dim">Scan from the tablet, or open the one-time link below.</div>
        </div>
        <label>Open this once on a tablet or second computer
          <div class="pairing-link-row">
            <input id="pairing-link" type="text" readonly aria-label="One-time pairing link">
            <button id="pairing-copy" class="hb hb-utility" type="button">COPY</button>
          </div>
        </label>
        <div class="dim" id="pairing-expiry"></div>
      </div>
      <div id="paired-devices" class="paired-devices"></div>
    </section>

    <section class="card" id="profiles-card" data-arr="profiles">
      <div class="card-head">
        <div class="label">COMMANDER PROFILES <span class="dim">who owns this machine's local history</span></div>
        <button id="profiles-refresh" class="hb hb-utility hb-sm" type="button">REFRESH</button>
      </div>
      <div class="dim profiles-primer">Frameshift keeps analytics, watches and workflow history per commander,
        matched from your journal. History recorded before v2.1 — or by a test/borrowed account — can end up
        under the wrong owner. Repair it here: everything is local, and nothing in-game is ever touched.</div>
      <div id="profiles-unattributed" class="profiles-unattributed hidden"></div>
      <div id="profiles-list" class="profiles-list dim">Checking profiles…</div>
    </section>

    <section class="card" id="local-services-card" data-arr="localservices">
      <div class="card-head">
        <div class="label">LOCAL HEALTH &amp; EXTENSIONS <span class="dim">private diagnostics · permissioned local packs</span></div>
        <div class="service-actions">
          <button id="extensions-reload" class="hb hb-utility hb-sm" type="button">RELOAD PACKS</button>
          <button id="diagnostics-bundle" class="hb hb-primary hb-sm" type="button">SUPPORT BUNDLE</button>
        </div>
      </div>
      <div id="local-health" class="dim">Checking local services…</div>
      <div id="extensions-status" class="extensions-status"></div>
    </section>

    <section class="card" id="ext-builder-card" data-arr="extbuilder">
      <div class="card-head">
        <div class="label">EXTENSION BUILDER <span class="exp-tag" title="New in this build — freshly commissioned and still being tuned. Everything it saves is a plain local pack you can remove anytime.">◇ EXPERIMENTAL</span> <span class="dim">your own alerts &amp; objective suggestions from game events · no code needed</span></div>
        <button id="xb-new" class="hb hb-primary hb-sm" type="button">＋ NEW EXTENSION</button>
      </div>
      <div class="dim xb-primer">Pick a game event, add conditions if you want them, and choose what happens —
        a cockpit alert (with optional voice callout) or a suggested objective. Test it against your own recent
        flight history before saving; a saved extension starts working immediately and appears in the pack list above.
        Start from a template:</div>
      <div id="xb-templates" class="xb-templates"></div>
      <form id="xb-form" class="xb-form hidden" autocomplete="off">
        <div class="xb-toprow">
          <label>Name <input id="xb-name" type="text" maxlength="80" placeholder="e.g. Big bounty callout" required></label>
          <div class="xb-idline dim">saves as <span id="xb-id" class="mono">—</span></div>
        </div>
        <div id="xb-rules"></div>
        <button type="button" id="xb-add-rule" class="hb hb-utility hb-sm">＋ ADD ANOTHER RULE</button>
        <div class="xb-actions">
          <button type="button" id="xb-test" class="hb hb-utility">▶ TEST AGAINST MY HISTORY</button>
          <button type="submit" id="xb-save" class="hb hb-primary">SAVE &amp; ACTIVATE</button>
          <button type="button" id="xb-cancel" class="hb hb-ghost">CANCEL</button>
        </div>
        <div id="xb-status" class="dim"></div>
        <div id="xb-results" class="xb-results hidden"></div>
      </form>
    </section>

    <section class="card" data-arr="marketdb">
      <div class="card-head">
        <div class="label">MARKET DATABASE <span class="dim">powers trade routes, commodity search &amp; mining · seeded from the Spansh dump, then live-updated by EDDN</span></div>
        <button id="seed-btn" class="hb hb-primary hb-sm">BUILD DATABASE (~3.9 GB download)</button>
      </div>
      <div id="db-status" class="dim">Checking…</div>
      <div class="seedbar hidden" id="seed-bar"><div id="seed-fill"></div></div>
    </section>
  </div>`;
