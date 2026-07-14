## Frameshift v2.1.7 — search anywhere, keep your settings

Four small changes aimed at the things you do every session.

### Your search settings survive a restart

Every search form now remembers what you set — commodity search (mode,
radius, min units, large pad, even the last commodity), the mining advisor,
outfitting, the neutron plotter, road to riches, exobiology filters. Set
"radius 100, large pad" once and it's still there tomorrow. Trade-route
settings already persisted; now everything does.

### Search near any system, not just where you're parked

Commodity search, the mining advisor and outfitting search each gained a
**Near** box (with the same autocomplete as every other system field). Leave
it empty and searches work exactly as before — around you. Type a system and
you're shopping around your carrier's destination, tomorrow's expedition
stop, or home before you fly back. Distances in the results are measured
from that system.

The Near box deliberately resets on restart: a search silently pinned to
last week's system would be worse than retyping it.

### Every result table sorts

The mining advisor and outfitting results now sort by any column header,
just like commodity search — closest buyer first, best price first, station
A-Z. First click means the useful direction; click again to reverse.

### Copy from any result row

Commodity, mining and outfitting rows now have a ⧉ copy button next to ◎
plot — grab the system name for wing chat or the in-game galaxy map without
autoplotting.

### Fixes

- The commodity SEARCH button now disables while a search is running, so a
  double-tap can't fire the search twice.
