import { beforeEach, describe, expect, it } from "vitest";

import {
  galaxyHistoryKey,
  getGalaxyHistory,
  getGalaxyHistoryCommander,
  loadGalaxyHistory,
  resetGalaxyHistoryWorkspace,
} from "../../ui/src/features/galaxy-history.js";
import {
  clearExpandedMarketSymbol,
  getExpandedMarketSymbol,
  toggleExpandedMarketSymbol,
} from "../../ui/src/features/market-state.js";

describe("feature-owned browser state", () => {
  beforeEach(() => {
    localStorage.clear();
    loadGalaxyHistory(null);
    clearExpandedMarketSymbol();
  });

  it("keeps Galaxy observations isolated by stable commander ID", () => {
    const alphaHistory = [
      {
        system: "Sol",
        observed_at: "2026-01-01T00:00:00Z",
        signature: "alpha-sol",
      },
    ];
    localStorage.setItem(galaxyHistoryKey("alpha"), JSON.stringify(alphaHistory));

    loadGalaxyHistory("alpha", "Shared Name");
    expect(getGalaxyHistoryCommander()).toBe("alpha");
    expect(getGalaxyHistory()).toEqual(alphaHistory);

    loadGalaxyHistory("beta", "Shared Name");
    expect(getGalaxyHistoryCommander()).toBe("beta");
    expect(getGalaxyHistory()).toEqual([]);
  });

  it("treats malformed Galaxy storage as an empty profile history", () => {
    localStorage.setItem(galaxyHistoryKey("alpha"), "{not-json");

    expect(() => loadGalaxyHistory("alpha")).not.toThrow();
    expect(getGalaxyHistory()).toEqual([]);
  });

  it("resets the Galaxy workspace without erasing persisted history", () => {
    const history = [{ system: "Sol", observed_at: "2026-01-01T00:00:00Z" }];
    localStorage.setItem(galaxyHistoryKey("alpha"), JSON.stringify(history));
    loadGalaxyHistory("alpha");

    resetGalaxyHistoryWorkspace();

    expect(getGalaxyHistoryCommander()).toBeNull();
    expect(getGalaxyHistory()).toEqual([]);
    expect(JSON.parse(localStorage.getItem(galaxyHistoryKey("alpha")))).toEqual(history);
  });

  it("owns expanded market history independently of the legacy runtime", () => {
    expect(toggleExpandedMarketSymbol("gold")).toBe("gold");
    expect(getExpandedMarketSymbol()).toBe("gold");
    expect(toggleExpandedMarketSymbol("silver")).toBe("silver");
    expect(toggleExpandedMarketSymbol("silver")).toBeNull();
    expect(getExpandedMarketSymbol()).toBeNull();
  });
});
