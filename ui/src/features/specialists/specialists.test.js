import { describe, expect, it, vi } from "vitest";

import {
  initCarrierSpecialist,
  parseCarrierInventoryText,
  renderCarrierSpecialist,
} from "./carrier.js";
import { initCombatSpecialist, renderCombatSpecialist } from "./combat.js";
import {
  normaliseSpecialistSnapshot,
  specialistDuration,
  specialistHumanName,
  specialistNumber,
} from "./core.js";
import {
  initExobiologySpecialist,
  niceSurfaceRange,
  renderExobiologySpecialist,
} from "./exobiology.js";
import { initMiningSpecialist, renderMiningSpecialist } from "./mining.js";
import { specialistsView } from "../views/specialists.js";

function mountSpecialistsView() {
  const parsed = new DOMParser().parseFromString(specialistsView, "text/html");
  document.body.replaceChildren(...parsed.body.children);
}

describe("specialist response compatibility", () => {
  it("normalises current and legacy response envelopes", () => {
    const direct = { mining: { active: true } };
    expect(normaliseSpecialistSnapshot(direct)).toBe(direct);

    expect(
      normaliseSpecialistSnapshot({
        snapshot: { mining: { active: false } },
        histories: { mining: [{ refined_t: 12 }] },
      }),
    ).toEqual({
      mining: { active: false },
      history: { mining: [{ refined_t: 12 }] },
    });
    expect(normaliseSpecialistSnapshot(null)).toEqual({});
  });
});

describe("specialist display helpers", () => {
  it("derives live duration without mutating the session", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-18T12:00:10Z"));
    const session = { started_ts: 1_784_376_000 };
    expect(specialistDuration(session, true)).toBe(10);
    expect(session).toEqual({ started_ts: 1_784_376_000 });
    vi.useRealTimers();
  });

  it("keeps legacy labels and number formatting", () => {
    expect(specialistHumanName("hpt_shutdown_neutraliser")).toBe("Shutdown Neutraliser");
    expect(specialistNumber(null)).toBe("—");
    expect(specialistNumber(12.345, " t")).toBe("12.35 t");
  });

  it("rounds surface maps to the established range ladder", () => {
    expect(niceSurfaceRange(101)).toBe(250);
    expect(niceSurfaceRange(100_001)).toBe(200_000);
  });
});

describe("carrier inventory input", () => {
  it("normalises supported delimiters and floors tonnes", () => {
    expect(parseCarrierInventoryText("Tritium | 850.9\nPalladium, 120\nVoid Opals\t3")).toEqual([
      { symbol: "tritium", name: "Tritium", count: 850 },
      { symbol: "palladium", name: "Palladium", count: 120 },
      { symbol: "void_opals", name: "Void Opals", count: 3 },
    ]);
  });

  it("rejects incomplete and negative rows", () => {
    expect(() => parseCarrierInventoryText("Tritium")).toThrow("use Commodity | tonnes");
    expect(() => parseCarrierInventoryText("Tritium | -1")).toThrow("zero or greater");
  });
});

describe("specialist view control contract", () => {
  it("initializes every workflow against the production Specialists markup", () => {
    mountSpecialistsView();
    const runMutation = vi.fn(async () => true);

    expect(() => {
      initMiningSpecialist(runMutation);
      initCombatSpecialist(runMutation);
      initCarrierSpecialist(runMutation);
      initExobiologySpecialist(runMutation, () => ({}));
      renderCarrierSpecialist({
        inventory: {
          tritium: { symbol: "tritium", name: "Tritium", count: 850 },
        },
      });
    }).not.toThrow();

    const inventory = document.querySelector("#sp-carrier-inventory-input");
    expect(inventory).toBeInstanceOf(HTMLTextAreaElement);
    expect(inventory.value).toContain("Tritium | 850");
  });

  it("renders workflow, route, order, and map payloads as inert text", () => {
    mountSpecialistsView();
    const attack = '<img src=x onerror="globalThis.__specialistXss=true">';

    renderMiningSpecialist(
      {
        session: {
          cargo_yield: [{ symbol: "ore", name: attack, count: 2 }],
          prospected_materials: [],
        },
      },
      [],
    );
    renderCombatSpecialist(
      {
        readiness: {
          score: 25,
          checklist: {},
          ammo: { by_module: [{ item: attack, slot: attack, total: 4 }] },
        },
        target: { ship: attack },
      },
      [],
    );
    renderCarrierSpecialist({
      carrier_id: 1,
      name: attack,
      inventory: {},
      route: {
        leg_count: 1,
        total_distance_ly: 20,
        valid: false,
        issues: [{ leg: 1, reason: attack }],
      },
      orders: {
        items: [
          {
            symbol: "tritium",
            name: attack,
            side: "buy",
            quantity: 3,
            price_cr: 50_000,
          },
        ],
      },
    });
    renderExobiologySpecialist({
      position: { lat: 1, lon: 2, body: attack },
      current_map: {
        body: attack,
        pins: [{ id: "pin-1", label: attack, kind: "waypoint", lat: 1, lon: 2 }],
      },
    });

    expect(document.querySelector("img, script")).toBeNull();
    expect(document.body.textContent).toContain(attack);
    expect(globalThis.__specialistXss).toBeUndefined();
  });
});
