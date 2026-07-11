## Elite Trader v1.13.1 — FIND SOURCES actually finds sources

Patch release for the colonisation card, hot on v1.13.0's heels.

### 🏗️ Fixes
- **FIND SOURCES answers in seconds, not a minute.** The per-commodity
  market searches now run in parallel — ten sequential ~3-second lookups
  used to leave the button on SEARCHING… so long it read as broken.
- **Results no longer vanish.** While you're docked at a construction site
  the game re-sends the depot snapshot every few seconds, and each refresh
  rebuilt the card — flashing the layout and wiping any sources you'd
  fetched. The card now only rebuilds when something real changes
  (progress, deliveries, a new project), fetched sources survive rebuilds,
  and the button becomes REFRESH once results are in.
