import { beforeEach, describe, expect, it, vi } from "vitest";

const marketMocks = vi.hoisted(() => ({
  findCargoBuyers: vi.fn(),
  recoverCargo: vi.fn(),
  findColonisationSources: vi.fn(),
  activateTab: vi.fn(),
  setPanelPage: vi.fn(),
}));

vi.mock("../../ui/src/api/market.js", () => ({
  marketApi: {
    findCargoBuyers: marketMocks.findCargoBuyers,
    recoverCargo: marketMocks.recoverCargo,
    findColonisationSources: marketMocks.findColonisationSources,
  },
}));
vi.mock("../../ui/src/main.js", () => ({
  activateTab: marketMocks.activateTab,
}));
vi.mock("../../ui/src/shell/panel.js", () => ({
  setPanelPage: marketMocks.setPanelPage,
}));
vi.mock("../../ui/src/shell/status.js", () => ({
  plotButton: (system) => {
    const button = document.createElement("button");
    button.textContent = system;
    return button;
  },
}));
vi.mock("../../ui/src/features/commodities.js", () => ({
  confidenceAgeLabel: () => "fresh",
  confidenceBadge: () => null,
  creditRangeBadge: () => null,
}));

import { appStore } from "../../ui/src/core/store.js";
import {
  colonisationSourceCacheKey,
  findCargoSell,
  recoverCargo,
  resetColonisationWorkspace,
} from "../../ui/src/features/colonisation.js";

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("cargo and colonisation profile isolation", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="cargo-sell-status"></div>
      <div id="cargo-sell-results"></div>
      <div id="colonisation-list"></div>
      <div id="colonisation-empty"></div>
    `;
    appStore.clear();
    resetColonisationWorkspace();
    vi.clearAllMocks();
  });

  it("keys colonisation source caches by commander generation", () => {
    appStore.setSnapshot({ commander_id: "alpha" });
    const alphaKey = colonisationSourceCacheKey(42);
    appStore.setSnapshot({ commander_id: "beta" });
    const betaKey = colonisationSourceCacheKey(42);

    expect(alphaKey).not.toBe(betaKey);
    expect(alphaKey).toContain("alpha");
    expect(betaKey).toContain("beta");
  });

  it("discards delayed cargo buyers after a commander handoff", async () => {
    const response = deferred();
    appStore.setSnapshot({ commander_id: "alpha" });
    marketMocks.findCargoBuyers.mockReturnValue(response.promise);

    const pending = findCargoSell();
    appStore.setSnapshot({ commander_id: "beta" });
    resetColonisationWorkspace();
    response.resolve({
      results: [{ station: "ALPHA PRIVATE BUYER", system: "Sol", items: [] }],
    });
    await pending;

    expect(document.body.textContent).not.toContain("ALPHA PRIVATE BUYER");
  });

  it("discards delayed recovery advice after a commander handoff", async () => {
    const response = deferred();
    const button = document.createElement("button");
    button.textContent = "RECOVER";
    document.body.appendChild(button);
    appStore.setSnapshot({ commander_id: "alpha" });
    marketMocks.recoverCargo.mockReturnValue(response.promise);

    const pending = recoverCargo(42, button);
    appStore.setSnapshot({ commander_id: "beta" });
    resetColonisationWorkspace();
    response.resolve({
      recommended: { station: "ALPHA DIVERSION", system: "Achenar", items: [] },
      alternatives: [],
    });
    await pending;

    expect(document.body.textContent).not.toContain("ALPHA DIVERSION");
    expect(marketMocks.activateTab).not.toHaveBeenCalled();
    expect(marketMocks.setPanelPage).not.toHaveBeenCalled();
  });
});
