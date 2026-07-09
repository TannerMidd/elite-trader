## Elite Trader v1.9.0 — cockpit everywhere, arrange mode & painless setup

### 🖥️ Every flight-panel page is a cockpit display now
Panel mode used to look right only on the status screen. Now all eight pages
share the same MFD design language — orange rails, glowing letter-spaced
labels, solid chunky controls, touch-sized tables — so the whole app looks like
it belongs on your dashboard.

### 🧩 Arrange mode
Tap **⇅ ARRANGE** (next to the tabs, or the floating ⇅ in panel mode) and every
card collapses to a compact header with a drag handle. Drag pages into the
order that suits how you play — bio signals on top of Explore, jump history
first in Local. Layouts are remembered **per page, per device**. (Explore now
defaults to bio signals first, too.)

### 🛠️ Journal setup that just works
- Auto-detection now resolves a **relocated Saved Games folder** via the
  Windows known-folder API.
- New **Settings → Journal folder** field with live validation ("✓ 60 journal
  files found") — applies immediately, no restart, no environment variables.
- If the folder doesn't exist yet (app installed before the game's first run),
  the app **recovers by itself** the moment it appears.
- The "journal not found" banner now has an **OPEN SETTINGS** button instead of
  telling you to set an env var.

### 📄 Release notes in the app
Clicking **release notes** on the update banner now opens the notes right in
the app instead of your browser (this text you're reading, for instance).

### 🐛 Fixes
- **SRV / Nomad no longer triggers false "low fuel" callouts** — Status.json
  reports the vehicle's tiny tank while you're driving; the app now keeps the
  ship's reading until you're back aboard (fixes the fuel gauge during SRV
  trips as well).

---

Run from source (`run.bat` / `run.sh`) or grab the attached `EliteTrader.exe`
(no Python needed). On the packaged app, updates install in place — click
**Update & restart** when it appears.
