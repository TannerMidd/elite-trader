## Elite Trader v1.3.0 — self-updating

### ⬆ In-app auto-update
Elite Trader now keeps itself up to date. When a newer release is published, the
packaged app shows a **"vX available — Update & restart"** banner; one click
downloads the new build, verifies it, swaps it in place and relaunches — no more
manual re-downloading. Your market database and settings are untouched.

- The running version is shown in the footer.
- Downloads are checksum-verified (SHA-256) from this release forward.
- Only the packaged Windows `EliteTrader.exe` self-updates; running from source
  updates with `git pull` as before. Set `ET_AUTO_UPDATE=0` to disable checks.

**Note:** this is the first version that can self-update, so it's a one-time
manual download — every release after this one will update in place.

---

Run from source (`run.bat` / `run.sh`) or grab the attached `EliteTrader.exe`
(no Python needed). First run: build the market database from the Database tab.
