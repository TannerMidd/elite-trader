import { raw, render } from "../core/html.js";
import { tradeView } from "../features/views/trade.js";
import { commoditiesView } from "../features/views/commodities.js";
import { bioView } from "../features/views/bio.js";
import { guidesView } from "../features/views/guides.js";
import { analyticsView } from "../features/views/analytics.js";
import { localView } from "../features/views/local.js";
import { engineeringView } from "../features/views/engineering.js";
import { opsView } from "../features/views/ops.js";
import { specialistsView } from "../features/views/specialists.js";
import { galaxyView } from "../features/views/galaxy.js";
import { databaseView } from "../features/views/database.js";

const applicationMarkup = [
  String.raw`

<div id="pairing-gate" class="pairing-gate hidden" role="dialog" aria-modal="true" aria-labelledby="pairing-title">
  <div class="pairing-panel" tabindex="-1">
    <img src="icon.svg" alt="" width="58" height="58">
    <div class="label">SECURE COCKPIT LINK</div>
    <h1 id="pairing-title">Pairing this device…</h1>
    <p id="pairing-message" class="dim">Exchanging the one-time link. No account or password is required.</p>
    <button id="pairing-retry" class="hb hb-primary hidden">TRY AGAIN</button>
  </div>
</div>

<header class="topbar">
  <div class="brand"><img class="brand-mark" src="icon.svg" alt="" width="26" height="26"><b>FRAME<span>SHIFT</span></b></div>
  <div class="pilot">
    <span id="commander">—</span>
    <span class="dim" id="ship">—</span>
    <button id="panel-toggle" class="hb hb-utility" title="Switch to the touch-friendly tablet flight panel">◈ PANEL</button>
  </div>
</header>

<div id="banner" class="banner hidden" role="status" aria-live="polite"></div>
<div id="flight-toast" class="flight-toast hidden"></div>
<div id="alert-strip" class="alert-strip hidden"></div>
<div id="update-banner" class="update-banner hidden"></div>
<div id="setup-banner" class="update-banner setup-banner hidden"></div>
<div id="galaxy-mode-banner" class="galaxy-mode-banner hidden" role="status"></div>

<div id="notes-modal" class="notes-modal hidden" role="dialog" aria-modal="true" aria-labelledby="notes-title">
  <div class="notes-box">
    <div class="notes-head">
      <b id="notes-title">Release notes</b>
      <button id="notes-close" class="hb hb-utility hb-icon hb-sm" title="Close" aria-label="Close">✕</button>
    </div>
    <div id="notes-body" class="notes-body"></div>
    <div class="notes-foot">
      <a id="notes-external" class="extlink" target="_blank" rel="noopener">Open on GitHub ↗</a>
    </div>
  </div>
</div>
<header id="fp-strip" aria-label="Ship status">
  <div class="fps-sweep" aria-hidden="true"></div>
  <div class="fps-block fps-system-block">
    <span class="fps-label">CURRENT SYSTEM</span>
    <span class="fps-system" id="fp-strip-system">—</span>
  </div>
  <div class="fps-block">
    <span class="fps-label">STATION</span>
    <span class="fps-value" id="fp-strip-station">—</span>
  </div>
  <div class="fps-block hidden" id="fp-strip-dest-block">
    <span class="fps-label">DESTINATION</span>
    <span class="fps-value fps-dest" id="fp-strip-dest"></span>
  </div>
  <div class="fps-right">
    <div class="fps-mini">
      <div class="fps-mini-head"><span>FUEL</span><span id="fp-strip-fuel">—</span></div>
      <div class="fps-minibar"><div id="fp-strip-fuel-fill"></div></div>
    </div>
    <div class="fps-mini">
      <div class="fps-mini-head"><span>CARGO</span><span id="fp-strip-cargo">—</span></div>
      <div class="fps-minibar"><div id="fp-strip-cargo-fill"></div></div>
    </div>
    <span class="fps-clock" id="fp-clock">--:--:--</span>
    <span class="fps-cmdr" id="fp-cmdr"></span>
  </div>
</header>

<div id="game-offline">
  <div class="go-status">
    <span class="go-dot" aria-hidden="true"></span>
    <div class="go-lines">
      <span class="go-title">FLIGHT SYSTEMS · STANDBY</span>
      <span class="go-sub" id="launch-status">Game offline — showing your last session's data</span>
    </div>
  </div>
  <button id="launch-game" class="hb hb-primary hb-lg go-launch" title="Starts Elite Dangerous on the PC running Frameshift — works from a tablet too">
    <span class="go-launch-label" id="launch-label">▲ LAUNCH ELITE DANGEROUS</span>
  </button>
  <div class="go-seq" aria-hidden="true"><div></div></div>
</div>

<div id="route-progress" class="route-progress hidden"></div>

<div id="flight-panel" class="hidden">
  <div class="fp-cmd">
    <div class="fp-cmd-main">
      <div class="fp-system-label">CURRENT SYSTEM <span class="fp-blink" aria-hidden="true"></span><i class="fp-fade-rule" aria-hidden="true"></i></div>
      <div class="fp-system" id="fp-system">—</div>
      <div class="fp-chiprow">
        <span class="fp-dockchip" id="fp-station">—</span>
        <span class="fp-sub fp-dest" id="fp-dest"></span>
      </div>
      <div class="fp-routeline hidden" id="fp-routeline">
        <span class="fp-route-label">ROUTE ⏵</span>
        <div class="fp-routebar"><div id="fp-route-fill"></div></div>
        <span class="fp-routetext" id="fp-route-text"></span>
      </div>
    </div>
    <div class="fp-telemetry">
      <div class="fp-tel-head">SHIP TELEMETRY<span id="fp-ship-type"></span></div>
      <div class="fp-tel-tiles">
        <div class="fp-tel"><div class="fp-label">CREDITS</div><div class="fp-value orange" id="fp-credits">—</div></div>
        <div class="fp-tel"><div class="fp-label">REBUY</div><div class="fp-value" id="fp-rebuy" title="Your ship's insurance cost">—</div><div class="fp-tel-sub" id="fp-rebuy-covers"></div></div>
        <div class="fp-tel"><div class="fp-label">LEGAL</div><div class="fp-value" id="fp-legal">—</div></div>
      </div>
    </div>
  </div>

  <div id="fp-risk" class="fp-risk hidden" title="Everything a rebuy screen would erase: unsold scans + bio samples. Sell at Universal Cartographics / Vista Genomics to bank it — WHERE TO SELL YOUR DATA on the Explore page finds the nearest.">
    <span class="fp-risk-tag">⚠ DATA AT RISK</span>
    <span id="fp-risk-text"></span>
    <span class="fp-risk-hint">SELL AT UNIVERSAL CARTOGRAPHICS / VISTA GENOMICS ⏵</span>
  </div>

  <div class="fp-grid">
    <div class="fp-main">
      <form id="fp-plot-form" class="fp-plotrow">
        <input type="text" id="fp-plot-input" placeholder="PLOT ROUTE TO SYSTEM…" autocomplete="off">
        <button type="submit" id="fp-plot-btn" class="hb hb-primary hb-lg">◎ PLOT</button>
      </form>
      <div id="fp-plot-status" class="fp-sub fp-status"></div>

      <button id="fp-bestloop" class="hb hb-lg fp-bestloop-btn">◈ BEST LOOP FROM HERE</button>
      <div id="fp-loop-status" class="fp-sub fp-status"></div>
      <div id="fp-loop-results" class="fp-loops"></div>

      <div class="fp-rule"><span>◷ RECENT JUMPS · TAP TO RE-PLOT</span><i></i></div>
      <div class="fp-jumps" id="fp-jumps"></div>
    </div>

    <div class="fp-side">
      <div class="fp-gauge">
        <div class="fp-gauge-head"><span class="fp-label">FUEL</span><span class="fp-gvalue" id="fp-fuel">—</span></div>
        <div class="fp-bar"><div id="fp-fuel-fill"></div></div>
        <div class="fp-gauge-note" id="fp-fuel-note"></div>
      </div>
      <div class="fp-gauge">
        <div class="fp-gauge-head"><span class="fp-label">CARGO</span><span class="fp-gvalue" id="fp-cargo">—</span></div>
        <div class="fp-bar"><div id="fp-cargo-fill"></div></div>
        <div class="fp-gauge-note" id="fp-cargo-note"></div>
      </div>
      <div class="fp-unbanked">
        <div class="fp-rule"><span>UNBANKED DATA</span><i></i></div>
        <div class="fp-unb-row"><span class="fp-label" id="fp-explo-label">EXPLO DATA</span><span class="fp-value orange" id="fp-explo">—</span></div>
        <div class="fp-unb-row"><span class="fp-label" id="fp-bio-label">BIO SAMPLES</span><span class="fp-value orange" id="fp-bio">—</span></div>
      </div>
    </div>
  </div>

  <div class="fp-rule"><span>◷ THIS SESSION <span id="fp-sess-since"></span></span><i></i></div>
  <div class="fp-tiles fp-tiles-row">
    <div class="fp-tile"><div class="fp-label">EARNED</div><div class="fp-value" id="fp-sess-earned">—</div></div>
    <div class="fp-tile" title="Estimated value of scans and bio samples gathered this session — banked when you sell them"><div class="fp-label">COLLECTED</div><div class="fp-value" id="fp-sess-collected">—</div></div>
    <div class="fp-tile"><div class="fp-label">CR / HR</div><div class="fp-value" id="fp-sess-crhr">—</div></div>
    <div class="fp-tile"><div class="fp-label">JUMPS</div><div class="fp-value" id="fp-sess-jumps">—</div></div>
    <div class="fp-tile"><div class="fp-label">DISTANCE</div><div class="fp-value" id="fp-sess-ly">—</div></div>
  </div>

  <div class="fp-footer">
    <span class="fp-foot-accent" aria-hidden="true">⌖</span><span id="fp-link">LINK STABLE</span>
    <span class="fp-foot-sep" aria-hidden="true">/</span><span id="fp-telemetry-at">TELEMETRY —</span>
    <span class="fp-foot-right">FRAMESHIFT FLIGHT PANEL · STATUS</span>
  </div>
</div>

<button id="fp-arrange" class="fp-arrange" title="Customize this page: drag cards to reorder, ⊘ hides cards you don't use. Saved on this device." aria-pressed="false">⇅</button>

<nav id="fp-nav" aria-label="Flight panel pages">
  <div class="fp-nav-brand"><img src="icon.svg" alt="" width="42" height="42"></div>
  <div class="fp-nav-pages">
    <button data-page="status" class="active" aria-current="page"><span class="fp-ni" aria-hidden="true">◈</span><span class="fp-nl">STATUS</span></button>
    <button data-page="trade"><span class="fp-ni" aria-hidden="true">⇄</span><span class="fp-nl">TRADE</span></button>
    <button data-page="commodities"><span class="fp-ni" aria-hidden="true">▦</span><span class="fp-nl">MARKET</span></button>
    <button data-page="bio"><span class="fp-ni" aria-hidden="true">⬡</span><span class="fp-nl">EXPLORE</span></button>
    <button data-page="guides"><span class="fp-ni" aria-hidden="true">✦</span><span class="fp-nl">GUIDES</span></button>
    <button data-page="analytics"><span class="fp-ni" aria-hidden="true">∿</span><span class="fp-nl">STATS</span></button>
    <button data-page="engineering"><span class="fp-ni" aria-hidden="true">⌬</span><span class="fp-nl">ENG</span></button>
    <button data-page="galaxy"><span class="fp-ni" aria-hidden="true">⚑&#xFE0E;</span><span class="fp-nl">GALAXY</span></button>
    <button data-page="ops"><span class="fp-ni" aria-hidden="true">◎</span><span class="fp-nl">OPS</span></button>
    <button data-page="specialists"><span class="fp-ni" aria-hidden="true">▦</span><span class="fp-nl">ROLES</span></button>
    <button data-page="local"><span class="fp-ni" aria-hidden="true">⌖</span><span class="fp-nl">LOCAL</span></button>
    <button data-page="database"><span class="fp-ni" aria-hidden="true">⚙&#xFE0E;</span><span class="fp-nl">SETTINGS</span></button>
  </div>
  <div class="fp-nav-foot">
    <button id="fp-voice" class="hb hb-utility" aria-pressed="false" title="Speak callouts (fuel scooping, low fuel, interdiction, hull damage, first discovery, waypoints)">🔊 VOICE</button>
    <button id="fp-full" class="hb hb-utility" aria-pressed="false" title="Expand to fullscreen">⛶ FULL</button>
    <button id="panel-exit" class="hb hb-utility" title="Switch to the desktop layout">✕ EXIT</button>
  </div>
</nav>

<div id="fp-scan" aria-hidden="true"></div>
<div id="fp-vignette" aria-hidden="true"></div>
<div id="fsd-overlay" class="hidden" aria-hidden="true"></div>

<div id="fp-boot" class="hidden" aria-hidden="true">
  <img src="icon.svg" alt="" width="72" height="72">
  <div class="fp-boot-title">FRAMESHIFT · FLIGHT PANEL</div>
  <div class="fp-boot-bar"><div></div></div>
  <div class="fp-boot-sub">SYSTEMS ONLINE</div>
</div>

<main>
  <section class="card location">
    <div class="loc-main">
      <div class="label">CURRENT SYSTEM</div>
      <div class="system-row">
        <h1 id="system">—</h1>
        <button class="hb hb-utility hb-icon hb-sm" data-copy-target="system" title="Copy system name" aria-label="Copy system name">⧉</button>
      </div>
      <div class="station-row">
        <span id="station-status" class="dim">—</span>
        <button class="hb hb-utility hb-icon hb-sm hidden" id="station-copy" title="Copy station name" aria-label="Copy station name">⧉</button>
      </div>
      <div class="dest-row dim" id="destination-row"></div>
      <form id="plot-form" class="plot-form">
        <input type="text" id="plot-input" placeholder="Plot route to system…" autocomplete="off">
        <button type="submit" id="plot-btn" class="hb hb-primary hb-sm">PLOT</button>
      </form>
      <div id="plot-status" class="dim"></div>
    </div>
    <div class="stats">
      <div class="stat"><div class="label">CREDITS</div><div class="value orange" id="credits">—</div></div>
      <div class="stat"><div class="label">FUEL</div><div class="value" id="fuel">—</div></div>
      <div class="stat"><div class="label">CARGO</div><div class="value" id="cargo">—</div></div>
      <div class="stat"><div class="label">LEGAL</div><div class="value" id="legal">—</div></div>
      <div class="stat"><div class="label">REBUY</div><div class="value" id="rebuy" title="Your ship's insurance cost">—</div></div>
    </div>
  </section>

  <nav class="tabs hb-group" id="tabs">
    <button class="hb hb-sm" aria-pressed="true" data-tab="trade">TRADE ROUTES</button>
    <button class="hb hb-sm" aria-pressed="false" data-tab="commodities">COMMODITIES</button>
    <button class="hb hb-sm" aria-pressed="false" data-tab="bio">EXPLORE</button>
    <button class="hb hb-sm" aria-pressed="false" data-tab="guides">GUIDES</button>
    <button class="hb hb-sm" aria-pressed="false" data-tab="analytics">ANALYTICS</button>
    <button class="hb hb-sm" aria-pressed="false" data-tab="engineering">ENGINEERING</button>
    <button class="hb hb-sm" aria-pressed="false" data-tab="galaxy">GALAXY</button>
    <button class="hb hb-sm" aria-pressed="false" data-tab="ops">OPS</button>
    <button class="hb hb-sm" aria-pressed="false" data-tab="specialists">SPECIALISTS</button>
    <button class="hb hb-sm" aria-pressed="false" data-tab="local">LOCAL</button>
    <button class="hb hb-sm" aria-pressed="false" data-tab="database">⚙&#xFE0E; SETTINGS</button>
    <button class="hb hb-utility tab-arrange" id="arrange-btn" title="Customize this page: drag cards to reorder, ⊘ hides cards you don't use. Saved on this device." aria-pressed="false">⇅ ARRANGE</button>
  </nav>

  `,
  tradeView,
  String.raw`

  `,
  commoditiesView,
  String.raw`

  `,
  bioView,
  String.raw`

  `,
  guidesView,
  String.raw`

  `,
  analyticsView,
  String.raw`

  `,
  localView,
  String.raw`

  `,
  engineeringView,
  String.raw`

  `,
  opsView,
  String.raw`

  `,
  specialistsView,
  String.raw`

  `,
  galaxyView,
  String.raw`

  `,
  databaseView,
  String.raw`
</main>

<footer>
  <div class="footer-row">
    <span class="dim">External lookups:</span>
    <div class="linkrow footer-links" id="links"></div>
    <label class="inapp-toggle hidden" id="inapp-toggle-wrap" title="Show Inara/EDSM results in a window inside the app instead of your browser">
      <input type="checkbox" id="inapp-toggle"> open in app
    </label>
  </div>
  <div class="dim">Frameshift <span id="app-version"></span> · journal refreshes every ~2s · trade data: community EDDN feed + Spansh galaxy dump</div>
</footer>
`,
].join("");

/** Mount the application-owned static shell before feature initialization. */
export function mountApplicationView() {
  const root = document.getElementById("app-root");
  if (!root) throw new Error("The Frameshift application mount is missing.");
  render(root, raw(applicationMarkup));
}
