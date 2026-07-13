## Frameshift v2.1.5 — startup initiation sequence

The journal reconstruction banner is now a proper cockpit power-on sequence
instead of a plain progress strip.

### What you'll see at launch

- A **STARTUP SEQUENCE** panel in the launch-control style: hazard chevrons,
  a status light, and your color theme's accent.
- A three-stage pre-flight checklist that tracks what is really happening:
  **FLIGHT RECORDER** (cataloguing new journals) → **COCKPIT RESTORE**
  (replaying your latest flight logs) → **SYSTEMS CHECK** (cross-checking
  preserved data). Completed stages turn green; the live stage shows its
  counter.
- A log-tape readout showing the timestamp of the journal currently being
  replayed.
- Automatic retries appear as **HOLDING** with an amber light; a hard
  failure becomes **STARTUP FAULT** with the same recovery guidance as
  before.

The sequence itself is unchanged and — since 2.1.3 — fast; this release is
about making those few seconds read like part of the cockpit.

### Notes

- Screen-reader progress announcements and count clamping are preserved.
- The only animation is the status-light pulse, and the reduced-motion
  system preference disables it.
- Update normally from any 2.x release.
