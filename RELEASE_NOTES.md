## Elite Trader v1.2.0 — the pilot's-companion update

Everything since v1.1.0, built and play-tested against a live commander session.
This release turns journal data the app was already reading into a set of
at-a-glance companion tools, and gives the whole UI a polish pass.

### 📈 Live session tracker
See what this play session is actually worth: net credits, **credits per hour**,
jumps, distance flown and tons hauled since you launched the game — live on both
the Analytics tab and the flight panel.

### 💰 Earnings by source
Analytics no longer counts trade alone. A unified breakdown shows every income
stream — **trade, missions, bounties, exploration and exobiology** — so you can
see where your money really comes from. Past earnings are backfilled from your
journal history.

### 🎫 Mission board & materials
Active missions in one place: kind, faction, destination (one-click plot),
reward, a **live expiry countdown**, and a **cargo-match warning** when you're
not carrying what a delivery needs. Your engineering **materials** inventory
(raw / manufactured / encoded) is tracked too.

### 🗺️ Route progress tracking
Hit **◈ TRACK** on any neutron plot, Road to Riches route or multi-hop trade
chain and a progress banner follows you as you fly it — current waypoint, a
progress bar, one-tap plot for the next hop. It **auto-advances as you jump** and
survives reloads.

### 🧬 Community-mapped bio signals
Arrive in a system and the genuses other commanders have already mapped appear
immediately (◇, from Spansh) — so you know what's worth landing for before you
even honk. Your own DSS scans always win; heuristic predictions fill the gaps.

### 📊 Price-trend arrows
The station market table shows **▲/▼ arrows** on prices that have moved since the
community last reported them — a quick read on whether to sell here now.

### 🖥️ Flight-panel quick wins
A **one-tap "best loop from here"** finds the top trade loops around you without
touching a single form field, and optional **voice callouts** speak low-fuel
warnings, route confirmations and waypoint arrivals for a mounted display.

### ✨ UI polish
A full motion and interaction pass: page-slide animations and drag-to-follow
swipe gestures in panel mode, hover/pressed/focus states throughout, themed
scrollbars, tabular-aligned numbers, and `prefers-reduced-motion` support.

---

Run from source (`run.bat` / `run.sh`) or grab the attached `EliteTrader.exe`
(no Python needed). First run: build the market database from the Database tab.
