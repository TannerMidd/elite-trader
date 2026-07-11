## Elite Trader v1.13.4 — the CPU diet

Profiling found one function eating ~half a CPU core around the clock. It's
gone. The app should now sit near 0% when you're not asking it for anything.

### ⚡ Performance
- **95% of the app's CPU use was a single status check.** Every device
  polled `/api/marketdb/status` every 5 seconds, and each poll counted all
  36 million price rows in the local database — a multi-second full-table
  scan, running near-constantly, overlapping with itself. The counts are
  now cached for five minutes (they're informational), refreshed live only
  while a database build is running.
- **Every route/market search paid the same tax** — the "is the database
  ready?" check used those full counts too. It's now an O(1) existence
  check, which also shaves seconds off trade routes, commodity searches
  and colonisation FIND SOURCES.
- **The UI polls database stats far less**: every 15s while the Database
  page is on screen, every 2 minutes otherwise, instantly on opening the
  page, and 1.5s only during a build.
- Measured before/after with two devices connected: ~51% of a core → ~0%
  idle. Live EDDN ingest and journal watching (the actual work) were never
  the problem — they cost ~2%.
