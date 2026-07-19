import { beforeEach, describe, expect, it } from "vitest";

import {
  commodityTableHtml,
  confidenceHtml,
  renderLoops,
  renderRoutes,
} from "../../ui/src/features/routes.js";
import { xbOpen } from "../../ui/src/features/extension-builder.js";
import { renderExtensionRows } from "../../ui/src/features/extensions.js";
import { renderConflicts, renderFactions, renderPowerplay } from "../../ui/src/features/galaxy.js";
import { stationRow } from "../../ui/src/features/system-stations.js";
import { mdToHtml, renderMarkdown } from "../../ui/src/features/updater.js";

const attack = `<img src=x onerror="globalThis.__frameshiftXss = true">`;

describe("route and market rendering safety", () => {
  beforeEach(() => {
    document.body.replaceChildren();
    delete globalThis.__frameshiftXss;
    const results = document.createElement("div");
    results.id = "route-results";
    document.body.appendChild(results);
  });

  it("renders loop station, commodity, and confidence strings as text", () => {
    renderLoops([
      {
        a: { station: attack, system: `Sol ${attack}`, from_player: 3, dist_ls: 12 },
        b: { station: `Jameson ${attack}`, system: attack, dist_ls: 24 },
        confidence: {
          band: "high",
          score: 90,
          source: attack,
          age_s: 20,
          reasons: [attack],
        },
        outbound: {
          commodities: [
            {
              name: attack,
              amount: 4,
              buy_price: 100,
              supply: 20,
              sell_price: 300,
              demand: 30,
              profit: 800,
            },
          ],
          confidence: null,
          profit: 800,
        },
        inbound: {
          commodities: [],
          confidence: null,
          profit: 0,
        },
        profit: 800,
        distance: 4,
      },
    ]);

    const results = document.querySelector("#route-results");
    expect(results.querySelector("img, script")).toBeNull();
    expect(results.textContent).toContain(attack);
    expect(globalThis.__frameshiftXss).toBeUndefined();
  });

  it("renders chain route and commodity API strings without creating elements", () => {
    renderRoutes([
      {
        from_station: attack,
        from_system: `Origin ${attack}`,
        to_station: `Destination ${attack}`,
        to_system: attack,
        distance: 10,
        to_dist_ls: 25,
        profit: 500,
        commodities: [
          {
            name: attack,
            amount: 2,
            buy_price: 100,
            supply: 5,
            sell_price: 350,
            demand: 10,
          },
        ],
        confidence: {
          band: "medium",
          score: 50,
          source: attack,
          age_s: 60,
          reasons: [attack],
        },
      },
    ]);

    const results = document.querySelector("#route-results");
    expect(results.querySelector("img, script")).toBeNull();
    expect(results.textContent).toContain(attack);
    expect(commodityTableHtml([{ name: attack }])).toContain("&lt;img");
    expect(confidenceHtml({ band: "high", source: attack, reasons: [attack] })).toContain(
      "&lt;img",
    );
  });

  it("keeps station and service strings in text nodes", () => {
    const row = stationRow({
      station: attack,
      type: attack,
      body: attack,
      economy: attack,
      faction: attack,
      services: [attack],
    });
    document.body.appendChild(row);

    expect(row.querySelector("img, script")).toBeNull();
    expect(row.textContent).toContain(attack);
  });
});

describe("release-note rendering safety", () => {
  it("builds supported Markdown with DOM nodes while escaping embedded HTML", () => {
    const target = document.createElement("div");
    renderMarkdown(
      target,
      `# Notes\n- ${attack}\n[docs](https://example.com/release)\n[bad](javascript:alert(1))`,
    );

    expect(target.querySelector("img, script")).toBeNull();
    expect(target.textContent).toContain(attack);
    expect(target.querySelectorAll("a")).toHaveLength(1);
    expect(target.querySelector("a").href).toBe("https://example.com/release");
    expect(mdToHtml(attack)).toContain("&lt;img");
  });
});

describe("feature renderer safety", () => {
  beforeEach(() => {
    document.body.replaceChildren();
    delete globalThis.__frameshiftXss;
  });

  it("keeps extension metadata in text and attribute values", () => {
    const status = document.createElement("div");
    status.id = "extensions-status";
    document.body.appendChild(status);

    renderExtensionRows({
      loaded: [
        {
          id: attack,
          name: `Pack ${attack}`,
          version: attack,
          permissions: [attack],
          mode: "declarative",
          fingerprint: attack,
        },
      ],
      errors: [],
    });

    expect(status.querySelector("img, script")).toBeNull();
    expect(status.textContent).toContain(attack);
    expect(status.querySelector("[data-extension-id]").dataset.extensionId).toBe(attack);
    expect(globalThis.__frameshiftXss).toBeUndefined();
  });

  it("keeps extension-builder seed fields in form values", () => {
    for (const [tag, id] of [
      ["input", "xb-name"],
      ["div", "xb-form"],
      ["div", "xb-status"],
      ["div", "xb-results"],
      ["div", "xb-rules"],
      ["div", "xb-id"],
    ]) {
      const element = document.createElement(tag);
      element.id = id;
      document.body.appendChild(element);
    }

    xbOpen({
      name: attack,
      rules: [
        {
          event: "",
          customEvent: attack,
          conditions: [{ field: attack, op: "eq", value: attack }],
          action: { type: "alert", level: "warn", text: attack, voice: true },
        },
      ],
    });

    const rules = document.querySelector("#xb-rules");
    expect(rules.querySelector("img, script")).toBeNull();
    expect(rules.querySelector('[data-xb="custom-event"]').value).toBe(attack);
    expect(rules.querySelector('[data-xb="cond-field"]').value).toBe(attack);
    expect(rules.querySelector('[data-xb="cond-value"]').value).toBe(attack);
    expect(rules.querySelector('[data-xb="action-text"]').value).toBe(attack);
    expect(globalThis.__frameshiftXss).toBeUndefined();
  });

  it("keeps journal-provided galaxy strings in text nodes", () => {
    for (const id of [
      "factions-list",
      "factions-empty",
      "factions-count",
      "conflicts-card",
      "conflicts-count",
      "conflicts-list",
      "powerplay-card",
      "pp-empty",
      "pp-pledge",
      "pp-sys",
      "pp-merits",
    ]) {
      const element = document.createElement("div");
      element.id = id;
      document.body.appendChild(element);
    }

    renderFactions(
      {
        controlling_faction: attack,
        factions: [
          {
            name: attack,
            influence: 0.5,
            government: attack,
            allegiance: attack,
            active_states: [attack],
          },
        ],
      },
      { current: null, previous: null },
      attack,
    );
    renderConflicts({
      conflicts: [
        {
          war_type: attack,
          status: attack,
          faction1: { name: attack, won_days: 1, stake: attack },
          faction2: { name: `Other ${attack}`, won_days: 0, stake: attack },
        },
      ],
    });
    renderPowerplay(
      {
        powerplay: { power: attack, rank: 1, merits: 2 },
        pp_system: {
          controlling: attack,
          state: attack,
          powers: [attack, `Other ${attack}`],
          conflict_progress: [{ power: attack, progress: 0.5 }],
        },
      },
      { current: null, previous: null },
    );

    expect(document.querySelector("img, script")).toBeNull();
    expect(document.body.textContent).toContain(attack);
    expect(globalThis.__frameshiftXss).toBeUndefined();
  });
});
