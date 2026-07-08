## Elite Trader v1.6.1 — cancel a plot in progress & a real auto-update relaunch fix

### ⏹ Cancel a plot in progress
Accidentally hit PLOT? While a route is being plotted the **PLOT button turns
into a CANCEL button** (in both the main view and the tablet flight panel).
Tapping it stops the sequence within a moment and cleanly releases any keys it
was holding, so a mis-tap no longer types into the galaxy map for ~10 seconds.

### 🔄 Auto-update now relaunches itself
Fixed the long-standing issue where an update installed correctly but the app
didn't reopen on its own. Root cause: the relaunched onefile exe was inheriting
the old process's PyInstaller bootloader environment (`_MEIPASS2`), so it tried
to load Python from a temp folder that no longer existed. The updater now
relaunches with a clean environment, which resolves it.

> Note: because the *installed* app is what runs an update, this one update
> (from an older build to v1.6.1) may still need you to reopen `EliteTrader.exe`
> once. Every update **from v1.6.1 onward** will relaunch on its own.

---

Run from source (`run.bat` / `run.sh`) or grab the attached `EliteTrader.exe`
(no Python needed). On the packaged app, updates install in place — click
**Update & restart** when it appears.
