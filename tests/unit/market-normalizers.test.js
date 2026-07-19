import { describe, expect, it } from "vitest";

import {
  normalizeJumpEntries,
  normalizeMarketSnapshot,
  normalizePriceSeries,
} from "../../ui/src/features/market-normalizers.js";

describe("market boundary normalizers", () => {
  it("keeps valid price tuples and rejects malformed history rows", () => {
    expect(
      normalizePriceSeries({
        gold: [
          [100, 20, 10, 30, 40],
          ["101", "21", "11"],
          ["bad", 22, 12],
        ],
        malformed: "not-an-array",
      }),
    ).toEqual({
      gold: [
        [100, 20, 10, 30, 40],
        [101, 21, 11],
      ],
    });
  });

  it("extracts the journal market shape without trusting arbitrary fields", () => {
    expect(
      normalizeMarketSnapshot({
        market_id: 42,
        station: "Jameson Memorial",
        is_current_station: true,
        items: [
          {
            name: "Gold",
            symbol: "gold",
            sell: 12_000,
            buy: 10_000,
            demand: 500,
            stock: 200,
            prev_sell: 11_500,
          },
          null,
          "invalid",
        ],
      }),
    ).toEqual({
      market_id: 42,
      station: "Jameson Memorial",
      is_current_station: true,
      items: [
        {
          name: "Gold",
          category: undefined,
          symbol: "gold",
          sell: 12_000,
          buy: 10_000,
          demand: 500,
          stock: 200,
          prev_sell: 11_500,
          prev_buy: null,
        },
      ],
    });
  });

  it("accepts both journal and state-contract jump field names", () => {
    expect(
      normalizeJumpEntries([
        { system: "Sol", dist: 4.2, timestamp: "2026-01-01T00:00:00Z" },
        { system: "Achenar", distance: 12, ts: 123 },
        { system: "", dist: 1 },
        null,
      ]),
    ).toEqual([
      { system: "Sol", dist: 4.2, timestamp: "2026-01-01T00:00:00Z" },
      { system: "Achenar", dist: 12, timestamp: 123 },
    ]);
  });
});
