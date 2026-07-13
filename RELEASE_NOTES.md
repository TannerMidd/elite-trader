## Frameshift v2.1.3 — fast startup

Starting Frameshift no longer spends minutes "restoring recent journals."
On the same mechanical hard drive used for testing, a cold start that took
over six minutes now publishes the live cockpit in about forty seconds, and
warm starts are quicker still. Solid-state installs see proportionally faster
results.

### What was wrong

Version 2.1 made commander history durable: every replayed journal event can
write analytics, timings and workflow state to `commander.db`. Three habits
of that new storage layer multiplied badly on spinning disks:

- every database connection re-ran a schema check that ended in a disk
  flush, and the journal replay opens thousands of short-lived connections;
- every tiny write was individually flushed to disk (`synchronous=FULL`),
  turning a replay into thousands of physical disk waits;
- the startup replay, the one-time history sweep and finalization each paid
  those costs event by event.

### What changed

- Opening `commander.db` is now write-free once the database is current; the
  schema/upgrade transaction runs only when a version marker says it must.
- Commander storage uses SQLite's WAL journal with `synchronous=NORMAL` —
  the standard pairing. Commits cannot corrupt the database; only an
  operating-system crash can lose the newest moments, and everything stored
  here is rebuilt from your journals anyway.
- Journal reconstruction (startup replay, history sweep, finalization) now
  borrows one shared database connection instead of opening one per event.

### Upgrade notes

- Update normally from any 2.x release. No settings, database or pairing
  changes are required.
- The one-time history sweep introduced in 2.1 also benefits: if your
  machine has not finished it yet, it will complete several times faster.
