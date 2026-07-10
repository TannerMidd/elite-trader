## Elite Trader v1.11.0 — the new flight panel

The tablet cockpit got a ground-up redesign — and it's now the app's default
view. Plus: the exobiology vault now knows which of your samples are likely
**first logs** and prices in their 5× bonus.

### 🛩️ Flight panel, redesigned (and now the default)
- **New cockpit shell**: a left icon rail for the eight pages, and a
  persistent status strip on every page — current system, station,
  destination, fuel & cargo bars, a live clock and your CMDR name.
- **Every page restyled**: corner-bracketed MFD cards, glowing readouts,
  proper cockpit typography (Chakra Petch + IBM Plex Mono, bundled — works
  offline), a boot splash and subtle scanlines. Swipe navigation, arrange
  mode and everything else work as before.
- **The panel is now what opens first.** ✕ EXIT switches to the classic
  desktop layout (and the app remembers your choice); ◈ PANEL brings it back.
- **Fullscreen is a button now** (⛶ FULL in the rail) instead of being forced
  on entry — browsers often blocked the old automatic attempt anyway.
- On phones and portrait screens the rail becomes a bottom bar.

### 🧬 First-log detection for exobiology (the 5× bonus)
Being the *first commander ever to log a species on a body* pays **5×** at
Vista Genomics. The game only tells you when you sell — Elite Trader now
predicts it the moment you finish sampling:
- **★ FIRST LOG ×5** badges in the unsold-samples vault and on the
  sampling-in-progress card, with the boosted value priced into every total
  (including the BIO SAMPLES tile on the status page).
- How it's judged: the body was **undiscovered when you scanned it** and no
  other commander has reported that genus there via the community data
  network. Hover any ★ for the explanation; it's confirmed on sale.
- The bio-signals table marks **undiscovered bodies with a ★** — land there
  and every species you log is almost certainly a first.
- Sold values were already counted correctly (the game reports the bonus in
  the sale event); the estimates now match them.

### 🐛 Also
- **Unsold samples survive restarts on long expeditions.** Startup now reads
  your journal back to the last Vista Genomics sale (or death), so samples
  completed many sessions ago no longer vanish from the vault.
- Vault entries now name the body they were sampled on reliably (previously
  the label could lag behind where you actually were).
- README screenshots retaken in the new flight-panel design.

---

Run from source (`run.bat` / `run.sh`) or grab the attached `EliteTrader.exe`
(no Python needed). On the packaged app, updates install in place — click
**Update & restart** when it appears.
