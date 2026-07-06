## Elite Trader v1.1.0 — the all-in-one update

Everything since v1.0.0, built and play-tested against a live commander session.

### 🖥️ Flight panel mode
Tap **◈ PANEL** and a tablet becomes an Elite-themed cockpit display: glowing
system readout, fuel/cargo gauges, credit & legal tiles, tap-to-replot jump
buttons — and **the entire app is still reachable** through a bottom touch bar
or by swiping between pages, all rescaled for fingers.

### 🔔 Live route alerts
WATCH any trade loop and every incoming EDDN update is checked against it:
sell-price drops, buy-price rises, or demand/stock draining below your load
raise an alert (and a browser notification) before you waste a trip.

### 📈 Profit analytics
Your full journal history feeds a new Analytics tab: profit today / week /
period, a credits-over-time curve, daily profit bars and top commodities.

### 🧭 Guides
Road to Riches (high-value scan/mapping targets in visit order) and a neutron
highway plotter — every waypoint one tap from the in-game galaxy map.

### 🧬 Explore tab
Unsold cartographic data estimates (first-discovery and mapping bonuses) plus
exobiology upgrades: predicted genus candidates for unmapped bodies from
atmosphere/temperature/gravity rules.

### 🏗️ Colonization helper
Construction depots you've visited show remaining needs, delivery payouts, and
the cheapest nearby source for each commodity.

### 🔍 More trading tools
- **WHERE TO SELL?** ranks the best buyers for your current cargo hold
- Outfitting & shipyard search — nearest station selling any module or ship
- Low-fuel warning banner
- **EDDN uploading**: markets you visit are contributed back to the community
  network (`ET_EDDN_UPLOAD=0` opts out)

### 🎯 Autoplot — now confirmed working
The in-game route plotting sequence was rebuilt against EDAPGui's real source:
wait for search autocomplete, commit the selection with a tap, zoom, then hold —
verified against `NavRoute.json` with automatic retries and honest errors.

---

Run from source (`run.bat` / `run.sh`) or grab the attached `EliteTrader.exe`
(no Python needed). First run: build the market database from the Database tab.
