## Elite Trader v1.7.0 — filter the Exobiology route by genus

### ⬡ Pick the genera you actually want
The **Exobiology Route** now has a row of genus chips (Stratum, Bacterium,
Osseus, …). Tap one or more **before** you plot, and the route only returns
landable worlds that host those genera — no more wading past every signal on
the way to the species you're farming.

- Select any combination of genera; the route restricts to bodies hosting at
  least one of them.
- The genus pick is treated as an explicit choice, so it's never quietly
  relaxed — only the value/gravity filters loosen as a fallback, and the search
  scans further out because a single genus is sparser than "any bio".
- Matching genera are highlighted in each body's list, and the status line
  shows which filter is active.
- No chips selected = every genus, exactly as before.

---

Run from source (`run.bat` / `run.sh`) or grab the attached `EliteTrader.exe`
(no Python needed). On the packaged app, updates install in place — click
**Update & restart** when it appears.
