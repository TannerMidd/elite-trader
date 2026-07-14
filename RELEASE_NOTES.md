## Frameshift v2.2.0 — build your own extensions

### Extension builder (experimental)

Settings has a new card: **EXTENSION BUILDER**. Make Frameshift react to the
game exactly the way you want — no code, no files, no manual.

- **Pick a game event** from a plain-English list (hyperspace jump, bounty
  awarded, mission completed, body scanned, cargo sold…) or type any journal
  event name.
- **Add conditions** with simple operators: *equals*, *is one of*,
  *is at least*, *is at most*, *is present / absent*. `Reward is at least
  100000` reads the way you'd say it.
- **Choose what happens** — a cockpit alert (INFO / WARN / CRITICAL, with an
  optional voice callout) or a suggested objective for Mission Control.
  Write `{FieldName}` in the message and the live value drops in:
  `Bounty {Reward} cr — {Target}`.
- **Test before you save.** One button replays your rule against your own
  last 1,000 journal events and shows exactly what would have fired, message
  rendered. No guessing whether a condition is right.
- **Templates** get you started in one tap: big-bounty callout, low fuel
  after jump, mission payout tracker, first-discovery follow-up.

Saved extensions activate immediately, appear in the pack list with edit and
remove buttons, and are ordinary declarative packs on your own disk —
reviewable, portable, and unable to execute code by design. The builder can
never create or overwrite a process-adapter pack.

### Also in this release

- The extensions and diagnostics readouts on the Settings page now load
  independently, so the pack list no longer waits behind the (slower)
  database health probe.

### Upgrade notes

- Update normally from any 2.x release. No database changes.
