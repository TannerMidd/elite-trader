## Frameshift v2.4.0 — the Holo Bracket controls

Every button in the app now speaks one design language, and the pages put
their most-used cards and orderings first.

### One button system

Buttons read as light projected onto glass: translucent faces, thin frames,
and breathing corner brackets that mark what matters. Four tiers — solid
primary for the one action a card exists for, translucent secondary, quiet
ghost for cancel/dismiss, and compact mono utility for in-table chrome.
Every press answers with a 350ms face flash, before any network round-trip.

- Busy buttons pulse and say what they're doing; disabled ones go dashed.
- Toggles (VOICE, FULL, tabs, the specialist switcher) light up with solid
  brackets and a glow when active.
- The desktop tabs and specialist switcher are segmented groups — the
  active segment is the only one wearing brackets.
- Honors reduced-motion, Windows High Contrast, and your color theme.

### Cockpit switches

Checkboxes are now flight switches: a squared, accent-framed housing with a
paddle that slides and lights orange when the circuit is on. The Settings
toggles share the same look, and everything scales up to touch size in
panel mode.

### Tidier rows

The ◎ plot buttons that trailed each row at a different position now park
in a clean right-edge column — engineers, ships, traders, missions,
community goals, alerts.

### Smarter defaults

- Search results show their sort up front in the column headers: buying
  lists cheapest first, selling richest first, outfitting nearest first.
  Click any header to override; your choice sticks for the session.
- System stations list real ports by arrival distance — fleet carriers
  sink to the bottom instead of drowning the list.
- Active missions sort soonest-deadline first, matching the card's own
  "red = expiring soon" legend.
- Pages lead with their most-used cards: LOCAL puts the station market and
  jump history above the fold, TRADE puts commodity search ahead of the
  mining advisor, ENGINEERING puts the workshop above the materials table.
  Your own card arrangements and hidden cards are untouched — the new
  layout only applies where you haven't customized.

### Upgrade notes

- Update normally from any 2.x release. No database changes.
