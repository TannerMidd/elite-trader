## Elite Trader v1.4.0 — mining & settings

### ⛏️ Mining advisor
A new Mining card (Commodities tab) covers the whole loop from your own live
data plus Spansh's ring maps:

- **What to mine** — every mineable commodity ranked by the best sell price near
  you right now, tagged **core** or **laser**, with the closest buyer and its
  demand.
- **Where to mine it** — tap ◇ on any mineral to find the **nearest ring
  hotspots** (overlap count, distance, arrival ls, reserve level), each one tap
  from plotting there.
- **Where to sell it** — the best buyer is right in the row.

### ⚙️ Settings panel
No more hunting for environment-variable flags — a new Settings card (Database
tab) with toggles that take effect immediately:

- **Exclude surface stations** — hide planetary outposts, ports and settlements
  from trade routes, searches and mining, for orbital-only pilots.
- **Exclude fleet carriers** from route and market results.
- **Contribute market data (EDDN)** and **automatic updates**, previously only
  settable via flags.

### 🛡️ Fewer antivirus false positives
The packaged exe now carries a proper Windows version resource, which lowers the
heuristic score some antivirus/SmartScreen checks apply to unsigned binaries.
(Code signing remains the definitive fix.)

---

Run from source (`run.bat` / `run.sh`) or grab the attached `EliteTrader.exe`
(no Python needed). First run: build the market database from the Database tab.
On the packaged app, updates from here install in place — just click
**Update & restart** when it appears.
