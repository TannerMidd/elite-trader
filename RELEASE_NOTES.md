## Elite Trader v1.12.0 — launch control & the explorer's update

Deep-space explorers get a way home, a guard for their unsold fortune, and an
honest session clock. The panel learns to start the game itself — and can now
speak with a human voice.

### 🛰️ For explorers deep in the black
- **WHERE TO SELL YOUR DATA** (Explore page): the "get me home" search —
  nearest ports with **Universal Cartographics** (map data) and **Vista
  Genomics** (bio samples), sorted by distance from wherever you are, with
  jump estimates at your ship's range. Fleet carriers are included (they can
  fit both services) and clearly flagged — they move, so treat their position
  as a lead. Works even from undiscovered systems.
- **DATA AT RISK guard**: a destroyed ship loses every unsold scan and sample
  aboard. When your unsold pile is worth many times your rebuy, a chip
  appears on the status page and one-shot voice callouts fire as it crosses
  10× / 25× / 50× — the nudge to go bank it before the galaxy takes it back.
- **COLLECTED session metric**: exploration sessions finally have a number —
  the estimated value of scans and samples gathered this session (first
  discoveries and first logs counted at their bonus rates).
- **The session clock stops when the game does.** Duration and cr/hr now
  measure play time, not how long the app sat open overnight.

### 🚀 Launch control
- When Elite Dangerous isn't running, every page shows a **FLIGHT SYSTEMS ·
  STANDBY** panel with a **▲ LAUNCH ELITE DANGEROUS** ignition button — tap
  it from the tablet and the game starts on your PC (Steam, or the Frontier
  launcher). A staged T-0 sequence tracks the handoff, a **LAUNCH CONFIRMED**
  callout fires when journal telemetry arrives, and pressing again aborts
  the wait. Plotting while the game is off now says so instead of failing
  cryptically.

### 🗣️ Neural voice (experimental)
- Optional human-sounding callouts: a one-time download installs **Piper
  TTS** — running entirely on your PC, offline, nothing sent anywhere — and
  every device on your LAN hears the same voice. **Six voices** to choose
  from (British, Scottish, American · female and male) with a TEST button to
  audition them. Off by default while experimental: Settings → Neural voice.

### 🖥️ Also
- **CRT effects** (scanlines + readout flicker) are now off by default and
  opt-in per device — they could shimmer on some displays.
- Empty market/mining results now point deep-space explorers at the
  sell-your-data search; the exobiology route teaches "first log" correctly;
  trade-loop searches no longer claim to ask Spansh (they're local).
- Layout and QA fixes across the panel (launch double-tap grace, arrange
  button clearance, and more).

---

Run from source (`run.bat` / `run.sh`) or grab the attached `EliteTrader.exe`
(no Python needed). On the packaged app, updates install in place — click
**Update & restart** when it appears.
