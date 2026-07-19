# UI cascade layout

`index.css` is the only stylesheet loaded by `index.html`. The logical
folders are `tokens`, `base`, `components`, `features`, `themes`,
`panel`, and `motion`.

The declared cascade order is:

`reset -> tokens -> base -> components -> features -> panel -> themes -> motion`

`reset` is reserved for a future explicit reset. `../holo-buttons.css` belongs
to `components`. Import order inside each layer is intentional, verified in
CI, and must not be alphabetized mechanically. Changes to layer or import order
require the canonical desktop/panel screenshot pass and a non-default theme
check.

Use `index.css` as the source of truth for cascade order and place new rules in
the narrowest matching feature or component sheet.
