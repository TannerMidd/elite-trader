## Elite Trader v1.8.0 — vital voice callouts (fuel scooping & more)

Voice callouts now warn you about the things that actually end deep-space trips.
Toggle them with **🔊 VOICE** in the flight panel; every callout also flashes a
banner or toast so it works with sound off.

### ⛽ Fuel-scoop planning along your route
The app reads your plotted route (NavRoute) and each star's class, learns your
real fuel-per-jump from your last jumps, and watches for the classic strander —
a run of non-scoopable stars (brown/white dwarfs, neutron stars…) your tank
can't clear:

- **"Scoop now"** (critical) — you're sitting on a fuel star but the *next* one
  is farther than your fuel can reach. Top off before you leave.
- **"Top off, N dry jumps ahead"** — leaving a scoopable star into a stretch
  with no fuel stars.
- **"Strand risk / no fuel star ahead"** — already low with no reachable
  scoopable star; time to replot.
- **Low-fuel** warning at 25% (route or not). Quiet while docked.

Scoopable = the KGB-FOAM classes (O B A F G K M) plus proto-stars.

### 🚨 Other vital callouts
- **Interdiction** — "Interdiction detected. Evade or submit." the instant
  you're pulled from supercruise.
- **Hull damage** — spoken at 75% / 50% / 25% as your hull drops.
- **First discovery** — "…is undiscovered." when you jump into a system no
  commander has scanned before.

---

Run from source (`run.bat` / `run.sh`) or grab the attached `EliteTrader.exe`
(no Python needed). On the packaged app, updates install in place — click
**Update & restart** when it appears.
