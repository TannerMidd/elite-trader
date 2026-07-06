# Elite Trader

A lightweight companion app for **Elite Dangerous** that reads the game's journal
files live and turns them into a personal trading platform: it always knows where
you are, finds the most profitable trade loops near you from its **own local market
database** (the same open data Inara and Spansh are built on), and can plot a route
to any system **directly in the in-game galaxy map** with one click.

Runs as a desktop app on your gaming PC and simultaneously serves the same UI to
any phone, tablet or PC on your home network.

## Features

- **Live status** — current system, station, credits, fuel, cargo; updates ~2 s
  after anything happens in game. Copy buttons everywhere.
- **Trade routes (local engine)** — Inara-style 2-station round-trip loops, ranked
  by **estimated profit per hour** (travel-time model: jumps, supercruise distance,
  docking overhead), with full per-commodity breakdowns: units, buy/sell price,
  stock, demand, profit per unit. Loops don't have to start where you are — a
  better loop several jumps away outranks a mediocre one next door. Search radius,
  max leg length, jump range, minimum stock/demand and result count are all
  configurable, and your settings persist. A multi-hop chain mode is also
  available.
- **Commodity search** — where to buy or sell any commodity near you, best price
  first, with distance, supply/demand and price age.
- **Autoplot** — click the ◎ next to any system and the app opens the in-game
  galaxy map, types the system into search and plots the route (like EDCopilot).
  Verified against the game's `NavRoute.json`, so it reports honestly if the plot
  didn't take.
- **Station market** — sortable/filterable price table for the station you're
  docked at.
- **Jump history & cargo hold** — your recent travels and what you're carrying.
- **Quick links** — Inara / EDSM / Spansh pages pre-filled with your current
  system (footer), optionally opened inside the app window.

## Quick start (Windows)

Requires Python 3.10+.

```
git clone <this repo>
cd elite-trader
run.bat
```

`run.bat` creates a virtual environment, installs dependencies and starts the app.
The desktop window opens; the LAN URL (e.g. `http://192.168.1.65:8666`) is printed
at startup for other devices. `run.bat --headless` runs the server without a window.

Allow the Windows Firewall prompt on **Private networks** if you want LAN access.

## Quick start (Linux / Steam Deck)

The game runs under Steam Proton; the app runs natively with Python 3.10+:

```
git clone <this repo>
cd elite-trader
chmod +x run.sh
./run.sh --headless
```

Then open the printed URL in any browser (same machine or LAN). Notes:

- **Journals and bindings are auto-detected** inside the Proton prefix
  (`~/.local/share/Steam/steamapps/compatdata/359320/pfx/...` and the `~/.steam`
  variants). If your Steam library lives elsewhere, point `ED_JOURNAL_DIR` at the
  journal folder inside the prefix.
- **Headless + browser is the recommended mode.** The desktop window works too,
  but pywebview needs GTK/WebKit system packages
  (e.g. Debian/Ubuntu: `sudo apt install python3-gi gir1.2-gtk-3.0 gir1.2-webkit2-4.1`).
- **Autoplot is Windows-only for now** (it injects keystrokes into the game
  client); the plot buttons report this cleanly on Linux. Everything else — live
  status, the local trade engine, commodity search, EDDN updates — works fully.
- The prebuilt exe is Windows-only; on Linux run from source as above.

## Standalone exe

`build_exe.bat` produces `dist\EliteTrader.exe` — a single file that runs without
Python. It stores its database in a `data\` folder next to the exe. Share the exe
with friends who don't want to install anything (they still need Elite Dangerous
and, for the desktop window, Windows 11's built-in WebView2 runtime).

### Releases

Grab `EliteTrader.exe` from the [Releases](../../releases) page — every release
also includes a source archive automatically.

To cut a release (maintainer): tag and push, and GitHub Actions builds the exe,
smoke-tests it and publishes the release with the exe attached:

```
git tag v1.0.0
git push origin v1.0.0
```

## First run: build the market database

The trade engine needs local market data. Open the **Database** tab and click
**Build Database** once:

1. Downloads Spansh's daily galaxy dump (~4 GB, deleted after import).
2. Imports every station market into `data/market.db` (~1.5 GB SQLite,
   ~470k stations, ~36M prices; takes ~15 minutes).
3. From then on the **EDDN** live feed keeps prices fresh in real time while the
   app runs — whenever any player in the galaxy docks somewhere, your database
   learns the new prices within seconds.

Until the database is built, trade routes fall back to the Spansh API. Rebuild
whenever you like from the same button.

## Autoplot requirements

The plot buttons drive the game with emulated keystrokes, using your own key
bindings. These game actions need **keyboard** keys bound (controller-only binds
won't work): *Galaxy Map*, *UI Up*, *UI Right*, *UI Select*, *UI Back*. Leave the
game window alone for ~10 seconds while a plot runs. Timing constants live at the
top of `elite/autoplot.py` if the sequence outruns your PC. Plotting to the system
you are currently in always fails (the game refuses it).

## Configuration

| Env var          | Meaning                          | Default |
|------------------|----------------------------------|---------|
| `ET_PORT`        | HTTP port                        | `8666`  |
| `ET_DATA_DIR`    | Database folder                  | `data/` next to the app |
| `ED_JOURNAL_DIR` | Journal folder override          | `%USERPROFILE%\Saved Games\Frontier Developments\Elite Dangerous` |
| `ED_BINDINGS_DIR`| Key bindings folder override     | `%LOCALAPPDATA%\...\Options\Bindings` |

## Security note

The web server has **no authentication** — anyone on your network can see your
in-game location and credits. Fine on a home LAN; do **not** port-forward it to
the internet.

## Data sources & credits

- **[EDDN](https://github.com/EDCD/EDDN)** — the community's live market data
  relay; this app is a consumer.
- **[Spansh](https://spansh.co.uk)** — daily galaxy dumps used to seed the
  database, and the fallback route API.
- Links to **[Inara](https://inara.cz)** and **[EDSM](https://www.edsm.net)**.
- Not affiliated with Frontier Developments. Elite Dangerous is a trademark of
  Frontier Developments plc.
