## Elite Trader v1.14.0 — the field companion update

Five new tools that close the gaps between this app and the games' best
standalone helpers — plus a fix for the disappearing interface-size settings.

### 🧬 Exobiology — sampling navigator
- **Live sample-distance readout.** While a genetic scan is in progress, the
  sampling card now shows how far you've moved from your previous samples —
  "310 m of 500 m needed · KEEP MOVING" — and flips to **✓ CLEAR TO SAMPLE**
  (with a spoken callout) the moment you've cleared the genus's colony
  distance from *every* earlier sample. No more guessing, no more third
  samples that refuse to register.

### 🔧 Your ship, in a ship builder
- **Open in EDSY** — the Ship Builds card now starts with *your current
  ship*: one tap opens your live loadout (modules, engineering and all) in
  EDSY to plan the next upgrade.
- **Copy SLEF** — copies the community-standard loadout JSON; paste it into
  the import box on Coriolis or Inara.

### ⚖️ Pay off bounties & fines
- New **Interstellar Factors finder** on the Local page: the nearest stations
  that clear your bounties and fines (for a 25% cut), with jump estimates at
  your ship's range and one-tap route plotting.

### 📦 Smarter mission board
- Haulage missions now show **live depot progress** — "148/540 delivered" —
  including deliveries made by wingmates on wing missions.
- The **cargo warning compares against what's still owed**, not the original
  mission total.
- When a mission **redirects** (all cargo delivered → report to the reward
  stop), the board's destination follows.

### 🧪 Jumponium readiness
- The materials card counts how many **FSD injections** you can synthesize
  right now — basic (+25%), standard (+50%), premium (+100%).
- When the fuel guard warns of a strand risk, it now also tells you if a
  range boost is ready — a bigger jump can reach a scoopable star in fewer
  jumps of fuel.

### 🛠 Fixes
- **Interface-size settings now stick in the desktop window.** The embedded
  window ran in private mode, silently wiping the display sliders (and every
  other per-device preference) each launch. Browsers and tablets were never
  affected. Thanks to **CMDR Drago** for the report — o7.
- Empty analytics charts now say why they're empty instead of showing a
  blank box.
- "≈ Jumps" shows 0 for stations in your current system; small copy fixes
  ("1 body scanned").
