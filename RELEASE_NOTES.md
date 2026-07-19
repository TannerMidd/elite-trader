## Frameshift v2.6.0 — the jump is part of the show

The flight panel now plays a cinematic FSD jump sequence in step with your
ship: the hyperspace countdown, the witchspace tunnel, and the arrival
reveal, driven live from the journal the moment your drive commits to a jump.

### A jump sequence with real flight data

- The countdown screen locks in your destination the way the drive does:
  system name, star class, and whether the arrival star is scoopable.
- The tunnel is a real-time WebGL render with a heads-up display —
  destination and class on one side, transit clock and fuel on the other,
  plus your route position when a route is plotted.
- Arrival flashes into normal space and reveals the system name, the jump
  distance, and what to do next: deploy the scoop at a fuel star, or a clear
  warning when a low tank meets a star with no fuel to give.
- Neutron stars get their own cyan cone-transit look with the ×4 supercharge
  banner. Jumping on critically low fuel turns the sequence red and keeps
  the advice on screen. ("DON'T PANIC.")

### You decide how much spectacle you want

- **Settings → FSD jump sequence** turns the whole thing on or off for the
  device, and a SKIP button on the overlay dismisses any single jump.
- **Reduce jump flashing** caps the bright white flashes at launch and
  arrival, and the sequence calms itself automatically when your device asks
  for reduced motion.
- **Jump effect intensity** scales the tunnel, camera shake, and glow from
  calm to full theatre.
- **◈ PREVIEW JUMP** plays a simulated jump on the spot — no game needed.

### Built for the cockpit tablet

- The tunnel renders at adaptive resolution so tablet GPUs hold their frame
  rate, and the WebGL context exists only while a sequence is playing.
- The sequence rides the panel's existing state link — no new connections —
  and a paired device that reloads mid-jump joins the tunnel in progress.
- A jump that never resolves (a crash mid-jump, a stale session) expires
  quietly instead of leaving the overlay on screen.

### Upgrade notes

- Update normally from any 2.x release. There are no database schema changes
  and no manual migration steps. The sequence is on by default in Panel
  mode; turn it off any time in Settings.
