import { describe, expect, it } from "vitest";

import galaxy from "../../ui/src/data/galaxy-data.js";

describe("bundled Galaxy knowledge", () => {
  it("ships the complete twelve-Power reward table", () => {
    expect(Object.keys(galaxy.POWER_MODULES)).toHaveLength(12);
    expect(galaxy.DATA_AS_OF).toBe("2026-07");
    for (const modules of Object.values(galaxy.POWER_MODULES)) {
      expect(modules).toHaveLength(12);
      expect(new Set(modules)).toHaveLength(12);
    }
    expect(galaxy.canonicalPower("A. Lavigny-Duval")).toBe("Arissa Lavigny-Duval");
    expect(galaxy.canonicalPower("li yong rui")).toBe("Li Yong-Rui");
  });

  it("maps reputation at every journal boundary", () => {
    expect(galaxy.reputationBand(-90.01).label).toBe("HOSTILE");
    expect(galaxy.reputationBand(-90).label).toBe("UNFRIENDLY");
    expect(galaxy.reputationBand(-35).label).toBe("NEUTRAL");
    expect(galaxy.reputationBand(4).label).toBe("CORDIAL");
    expect(galaxy.reputationBand(35).label).toBe("FRIENDLY");
    expect(galaxy.reputationBand(90).label).toBe("ALLIED");
  });

  it("deduplicates contenders and computes module milestones", () => {
    expect(
      galaxy.contestingPowers({
        controlling: "A. Lavigny-Duval",
        powers: ["A. Lavigny-Duval", "Aisling Duval", "Aisling Duval"],
      }),
    ).toEqual(["Aisling Duval"]);

    expect(galaxy.moduleProgress("Aisling Duval", 33, 246_000)).toMatchObject({
      unlockedCount: 0,
      nextRank: 34,
      nextModule: "Prismatic Shield Generator",
      remainingMerits: 1000,
    });
    expect(galaxy.moduleProgress("Aisling Duval", 34, 247_000)).toMatchObject({
      unlockedCount: 1,
      nextRank: 39,
      nextModule: "Imperial Hammer",
    });
    expect(galaxy.moduleProgress("Aisling Duval", 97, 751_000)).toMatchObject({
      unlockedCount: 12,
      complete: true,
    });
    expect(galaxy.moduleProgress("Aisling Duval", null, null)).toMatchObject({
      nextRank: 34,
      fraction: null,
    });
  });

  it("stores only material observations and calculates influence deltas", () => {
    const baseGalaxy = {
      controlling_faction: "Faction A",
      factions: [{ name: "Faction A", influence: 0.4, state: "Boom" }],
      pp_system: {
        controlling: "Aisling Duval",
        state: "Fortified",
        control_progress: 0.45,
      },
      conflicts: [],
    };
    const first = galaxy.observation("Test", baseGalaxy, "2026-01-01T00:00:00Z");
    let history = galaxy.appendObservation([], first);
    history = galaxy.appendObservation(
      history,
      galaxy.observation("Test", baseGalaxy, "2026-01-02T00:00:00Z"),
    );
    expect(history).toHaveLength(1);

    const changed = galaxy.observation(
      "Test",
      {
        ...baseGalaxy,
        factions: [{ name: "Faction A", influence: 0.415, state: "Boom" }],
      },
      "2026-01-03T00:00:00Z",
    );
    history = galaxy.appendObservation(history, changed);
    expect(history).toHaveLength(2);
    expect(galaxy.factionDeltas(changed, first)[0].delta).toBeCloseTo(1.5);
  });
});
