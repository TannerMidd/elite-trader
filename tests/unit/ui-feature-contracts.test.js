import { beforeEach, describe, expect, it } from "vitest";

import { CS_SORT_COLUMNS, bumpSort, sortedRows } from "../../ui/src/features/commodities.js";
import { engineeringGradeText, engineeringMatches } from "../../ui/src/features/engineering.js";
import {
  galaxyHistoryKey,
  getGalaxyHistory,
  getGalaxyHistoryCommander,
  loadGalaxyHistory,
  powerplayStateNote,
  ppProgressPercent,
} from "../../ui/src/features/galaxy.js";
import {
  activeRouteKey,
  clearRouteWorkspace,
  confidenceAgeText,
  confidenceHtml,
  creditRangeHtml,
  getActiveRoute,
  loadActiveRoute,
} from "../../ui/src/features/routes.js";
import { MN_SORT_COLUMNS } from "../../ui/src/features/mining.js";
import { OS_SORT_COLUMNS } from "../../ui/src/features/stations.js";
import { panelModeOnLaunch } from "../../ui/src/shell/panel.js";

describe("panel preference behavior", () => {
  it("defaults fresh devices to Panel while respecting both saved choices", () => {
    const storage = (value) => ({
      getItem: () => value,
    });

    expect(panelModeOnLaunch(storage(null))).toBe(true);
    expect(panelModeOnLaunch(storage("1"))).toBe(true);
    expect(panelModeOnLaunch(storage("0"))).toBe(false);
    expect(
      panelModeOnLaunch({
        getItem() {
          throw new Error("storage denied");
        },
      }),
    ).toBe(true);
  });
});

describe("search ordering behavior", () => {
  const rows = [
    { station: "Zulu", sell_price: 52_000, buy_price: 50_000 },
    { station: "Alpha", sell_price: 48_000, buy_price: 44_000 },
  ];

  it("sorts without mutating API results and follows column defaults", () => {
    const sorted = sortedRows(rows, CS_SORT_COLUMNS, { key: "station", dir: 1 }, "sell");

    expect(sorted.map((row) => row.station)).toEqual(["Alpha", "Zulu"]);
    expect(rows.map((row) => row.station)).toEqual(["Zulu", "Alpha"]);
    expect(bumpSort(null, "units", CS_SORT_COLUMNS)).toEqual({
      key: "units",
      dir: -1,
    });
    expect(bumpSort({ key: "station", dir: 1 }, "station", CS_SORT_COLUMNS)).toEqual({
      key: "station",
      dir: -1,
    });
  });

  it("uses the shared sorter for mining and station result columns", () => {
    const mining = [
      { name: "Painite", sell_price: 600_000 },
      { name: "Platinum", sell_price: 250_000 },
    ];
    expect(
      sortedRows(mining, MN_SORT_COLUMNS, { key: "sell", dir: -1 }).map((row) => row.name),
    ).toEqual(["Painite", "Platinum"]);

    const stations = [
      { station: "Far", distance: 40 },
      { station: "Near", distance: 3 },
    ];
    expect(
      sortedRows(stations, OS_SORT_COLUMNS, { key: "jump", dir: 1 }).map((row) => row.station),
    ).toEqual(["Near", "Far"]);
  });
});

describe("route risk presentation", () => {
  it("renders bounded confidence and conservative ranges", () => {
    expect(confidenceAgeText(90)).toBe("2m old");
    expect(confidenceAgeText(172_800)).toBe("2d old");

    const markup = confidenceHtml({
      band: "unexpected",
      score: 42.4,
      source: "local market",
      age_s: 90,
      reasons: ["thin <supply>"],
    });
    expect(markup).toContain('class="confidence confidence-low"');
    expect(markup).toContain("LOW 42");
    expect(markup).toContain("thin &lt;supply&gt;");
    expect(creditRangeHtml({ low: 1000, observed: 1500 })).toContain("conservative 1,000–1,500 cr");
  });
});

describe("engineering catalog behavior", () => {
  const blueprint = {
    id: "fsd-range",
    kind: "ship-engineering",
    kind_label: "Ship engineering",
    display_name: "Frame Shift Drive · Increased Range",
    module: "Frame Shift Drive",
    name: "increased_range",
    engineers: ["Felicity Farseer"],
  };

  it("matches every search term across labels, modules, and engineers", () => {
    expect(engineeringMatches(blueprint, "felicity range", "ship-engineering")).toBe(true);
    expect(engineeringMatches(blueprint, "felicity armor", "ship-engineering")).toBe(false);
    expect(engineeringMatches(blueprint, "range", "odyssey-upgrade")).toBe(false);
    expect(
      engineeringGradeText({
        kind: "ship-engineering",
        current_grade: 2,
        target_grade: 5,
      }),
    ).toBe("G2 → G5");
  });
});

describe("profile-scoped browser persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    clearRouteWorkspace();
    loadGalaxyHistory(null);
  });

  it("migrates an unscoped route once and never leaks it to another commander", () => {
    const legacyRoute = {
      waypoints: [{ system: "Sol" }],
      index: 0,
    };
    localStorage.setItem("activeRoute", JSON.stringify(legacyRoute));

    loadActiveRoute("alpha");
    expect(getActiveRoute()).toEqual({
      ...legacyRoute,
      kind: "route",
      label: "Tracked route",
    });
    expect(localStorage.getItem("activeRoute")).toBeNull();
    expect(JSON.parse(localStorage.getItem(activeRouteKey("alpha")))).toEqual(legacyRoute);

    loadActiveRoute("beta");
    expect(getActiveRoute()).toBeNull();
  });

  it("migrates display-name Galaxy history into a commander ID key", () => {
    const history = [{ system: "Sol", observed_at: "2026-01-01T00:00:00Z" }];
    const legacyKey = `galaxyHistory:v1:${encodeURIComponent("Same Name")}`;
    localStorage.setItem(legacyKey, JSON.stringify(history));

    loadGalaxyHistory("alpha", "Same Name");
    expect(getGalaxyHistory()).toEqual(history);
    expect(getGalaxyHistoryCommander()).toBe("alpha");
    expect(localStorage.getItem(legacyKey)).toBeNull();
    expect(JSON.parse(localStorage.getItem(galaxyHistoryKey("alpha")))).toEqual(history);

    loadGalaxyHistory("beta", "Same Name");
    expect(getGalaxyHistory()).toEqual([]);
    expect(getGalaxyHistoryCommander()).toBe("beta");
  });
});

describe("Galaxy display helpers", () => {
  it("clamps progress and explains known and unknown control states", () => {
    expect(ppProgressPercent(0.45)).toBe(45);
    expect(ppProgressPercent(140)).toBe(100);
    expect(ppProgressPercent(-1)).toBe(0);
    expect(powerplayStateNote("Stronghold")).toContain("Stronghold");
    expect(powerplayStateNote("future-state")).toContain("local journal snapshot");
  });
});
