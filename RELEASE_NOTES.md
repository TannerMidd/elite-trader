## Frameshift v2.0.0 — new name, whole galaxy

**Elite Trader is now Frameshift.** The app long ago outgrew its trading
roots — it navigates, explores, engineers and fights too — so the name now
matches what it is: the companion computer for everything your Frame Shift
Drive points at. **Nothing changes for you**: your data, settings, layouts and
themes carry over untouched, auto-update keeps working (your exe file keeps
its old name until you re-download — that's fine), and the GitHub project
redirects from the old address.

### ⚑ New GALAXY page — the background sim, finally on deck
- **Powerplay 2.0** — your pledge, rating and merits (with a session tally),
  plus the current system's power status on every jump: controlling power,
  control-progress bar, reinforcement vs undermining this cycle.
- **System factions (BGS)** — influence bars, active/pending/recovering
  states, controlling faction, and your reputation with each — refreshed the
  moment you jump in.
- **Conflicts** — wars and elections: who's fighting whom, what station or
  settlement is staked, and the days-won score.
- **Community goals** — goals you've joined, with your contribution, reward
  tier, percentile band and expiry countdown.
- **Squadron** — your squadron and rank, when the game reports one.
- Every card teaches: if a section is empty, it explains that corner of the
  galaxy's politics instead of showing a blank.

### 🛡 Trust & safety hardening
- **EDDN uploads now carry your game version**, so the network can tell Live
  data from Legacy — and the live price feed now **filters out Legacy-galaxy
  messages** instead of letting them poison Live prices.
- **The web server now rejects cross-site browser requests** (and DNS-rebinding
  Host tricks): a random web page can no longer poke your companion's API.
  Tablets and everything else on your LAN work exactly as before.
- **Database rebuilds are now crash-proof**: the new database is built to the
  side and swapped in only when it's complete — a mid-rebuild crash can no
  longer leave you with a gutted market database.
- **"Exclude fleet carriers" now tells the truth**: the setting controls what
  the database collects (live feed and rebuilds), not just what searches show.

### 🛠 Under the hood
- Releases now run the full test suite before building.
- The release publishes the exe under both names (`Frameshift.exe` and
  `EliteTrader.exe`) so every existing install keeps auto-updating.
