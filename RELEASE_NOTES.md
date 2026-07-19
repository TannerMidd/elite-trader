## Frameshift v2.5.0 — a modern, safer cockpit core

This release rebuilds the application underneath the cockpit without changing
the local-first experience. The legacy frontend monolith is gone; every pane
now runs through a small, explicit module with guarded data and rendering
boundaries.

### Faster, cleaner cockpit foundation

- The frontend is now a native ES-module graph split by feature, with a tiny
  startup shell and layered styles. There is still no bundler, CDN, runtime
  package, or cloud account.
- Desktop and Panel mode share one typed application state while keeping their
  presentation and controls independently testable.
- Browser assets revalidate safely after an update, and a running client
  reloads once if it detects a newer backend version.
- The existing Holo Bracket controls, themes, saved layouts, paired devices,
  and touch-first Panel experience are preserved.

### Commander data stays with the right commander

- Every commander-owned request carries a stable commander identity. Work
  still in flight is cancelled and ignored when profiles change.
- Archived commanders are now explicitly offline viewers. Frameshift rejects
  switching away from the journal commander while Elite Dangerous is live,
  preventing the UI, analytics, and tracked-market data from splitting across
  profiles.
- Profile activation and journal handoffs now share one serialized transition,
  and live journal activity always reasserts its commander before updates are
  recorded.

### Safer rendering and transport

- Dynamic cockpit content is escaped through one reviewed rendering boundary.
- Feature code can only reach same-origin Frameshift API routes through named,
  typed clients; it cannot bypass the transport policy or embed ad-hoc API
  calls.
- The server now checks commander metadata for every commander-scoped route and
  continues to enforce a self-only script policy.

### Release-grade browser coverage

- Unit and DOM behavior run against the real module graph.
- Complete Chromium journeys cover desktop behavior, while WebKit journeys
  exercise the iPad-sized Panel experience.
- Every Python test file runs in its own deterministic process, and the
  packaged executable must serve a coherent, cache-safe module graph before a
  release can publish.

### Upgrade notes

- Update normally from any 2.x release. There are no database schema changes
  and no manual migration steps.
