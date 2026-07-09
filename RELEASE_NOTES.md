## Elite Trader v1.10.0 — engineering, combat, price history & station intel

The biggest feature release yet — the first wave of the all-in-one roadmap.

### 🔧 Engineering planner
Pin a blueprint (say, **FSD Increased Range → G5**) and get a live checklist
of every material the full upgrade needs, checked against your inventory:
exact shortfalls, **where each material comes from** (hover), **material-trader
swap suggestions** from your surplus, and the nearest raw/manufactured/encoded
traders one tap from plotting. A voice callout tells you the moment your list
completes. Includes a built-in **"New to engineering?"** primer — no wiki tab
required. ([wiki](../../wiki/Engineering))

### ⚔️ Combat tracker & massacre stacks
Massacre-stack bookkeeping without the spreadsheet: stacks grouped per target
faction with the *correct* math (kills count for every giver at once — the
largest giver sets the target), progress bars, payouts, and a callout when the
stack completes. Plus session kills / bounty / bond claims, and a **rebuy
safety net** — amber under 2× rebuy, red (and spoken) when you can't cover
one. ([wiki](../../wiki/Combat-and-Missions))

### 📈 Price history
Stations you dock at (and watched routes) now build **price history**: a
sparkline column in the station market, and **tap any sparkline for a full
price chart**. WATCH alerts **survive restarts** and re-anchor after firing,
so a collapsing price alerts you once per further 10% step.

### 🛰️ System stations viewer
Every station in any system — orbital and surface — with pads, economy,
faction, services, and a one-tap expand into its full EDDN-fresh market table.

### 🐛 Fixes
- Wide-radius searches (3000+ ly — deep-space life) no longer crash commodity
  search, mining and sell-cargo ("too many SQL variables").
- Outfitting/module search works from systems Spansh doesn't index (fresh
  discoveries) by falling back to your coordinates.
- REBUY shown on the location card and flight panel.

Also: the README got a full rewrite (short + sharp, wiki carries the depth)
and the wiki gained Engineering and Combat & Missions pages.

---

Run from source (`run.bat` / `run.sh`) or grab the attached `EliteTrader.exe`
(no Python needed). On the packaged app, updates install in place — click
**Update & restart** when it appears.
