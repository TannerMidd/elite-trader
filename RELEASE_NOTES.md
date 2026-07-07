## Elite Trader v1.5.1 — auto-update relaunch fix

Fixes the one remaining auto-update glitch: after installing an update the app
could close but fail to reopen ("Failed to load Python DLL"), because it tried to
relaunch the new exe a split-second too early. The updater now waits briefly for
the old process to finish tearing down before relaunching, and keeps a one-file
backup so a bad launch is recoverable.

> The v1.5.0 → v1.5.1 update itself predates this fix, so it may still need you
> to open EliteTrader.exe once by hand after it swaps. Every update from v1.5.1
> onward reopens on its own.

---

Run from source (`run.bat` / `run.sh`) or grab the attached `EliteTrader.exe`
(no Python needed).
