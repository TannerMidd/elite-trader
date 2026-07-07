## Elite Trader v1.4.1 — reliable auto-update

### 🔧 Auto-update now actually installs
The in-app updater in v1.3.0/v1.4.0 could download the new version, close the
app, and then fail to swap it in or relaunch — leaving `EliteTrader.new.exe`
behind. That's fixed: the installer now retries the swap until the old exe is
fully released and relaunches reliably, and update checks are more robust (they
re-check every 30 minutes instead of every 6 hours, retry on transient errors,
and there's a **"Check for updates now"** button in Settings).

> **One-time manual step:** because the broken installer is baked into
> v1.3.0/v1.4.0, updating *from* those versions in-app will still hit the old
> bug. Please **download this `EliteTrader.exe` manually one more time** and
> replace your copy. From v1.4.1 onward, updates install themselves in place.

### 🧹 No leftover processes
Launching a second copy no longer starts a competing server that fights over the
port, and the app now always shuts its server down cleanly on close or error —
so nothing is left running in the background.

---

Run from source (`run.bat` / `run.sh`) or grab the attached `EliteTrader.exe`
(no Python needed). First run: build the market database from the Database tab.
