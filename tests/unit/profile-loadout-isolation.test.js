import { beforeEach, describe, expect, it, vi } from "vitest";

const systemMocks = vi.hoisted(() => ({
  getLoadoutExport: vi.fn(),
}));

vi.mock("../../ui/src/api/system.js", () => ({
  systemApi: {
    getLoadoutExport: systemMocks.getLoadoutExport,
  },
}));

import { appStore } from "../../ui/src/core/store.js";
import {
  loadoutSlef,
  refreshLoadoutExport,
  resetLoadoutExport,
} from "../../ui/src/features/services.js";

function loadoutSnapshot(commanderId, shipName) {
  return {
    commander_id: commanderId,
    has_loadout: true,
    ship_type: "krait_mkii",
    ship_name: shipName,
    ship_ident: commanderId.toUpperCase(),
    rebuy: 1_000_000,
    max_jump_range: 42,
    cargo_capacity: 64,
  };
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("loadout export profile isolation", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <p id="build-current-desc"></p>
      <a id="build-edsy" class="hidden"></a>
      <button id="build-slef" class="hidden"></button>
    `;
    appStore.clear();
    resetLoadoutExport();
    systemMocks.getLoadoutExport.mockReset();
  });

  it("clears ship artifacts through the feature reset hook", async () => {
    appStore.setSnapshot(loadoutSnapshot("alpha", "Alpha Ship"));
    systemMocks.getLoadoutExport.mockResolvedValue({
      edsy_url: "https://edsy.org/#/alpha",
      slef: "[alpha]",
    });

    await refreshLoadoutExport();
    expect(document.getElementById("build-edsy").getAttribute("href")).toBe(
      "https://edsy.org/#/alpha",
    );
    expect(loadoutSlef).toBe("[alpha]");

    resetLoadoutExport();

    expect(document.getElementById("build-edsy").classList).toContain("hidden");
    expect(document.getElementById("build-edsy").hasAttribute("href")).toBe(false);
    expect(document.getElementById("build-slef").classList).toContain("hidden");
    expect(loadoutSlef).toBe("");
  });

  it("does not commit a delayed response after a commander handoff", async () => {
    const response = deferred();
    appStore.setSnapshot(loadoutSnapshot("alpha", "Alpha Ship"));
    systemMocks.getLoadoutExport.mockReturnValue(response.promise);

    const pending = refreshLoadoutExport();
    appStore.setSnapshot(loadoutSnapshot("beta", "Beta Ship"));
    resetLoadoutExport();
    response.resolve({
      edsy_url: "https://edsy.org/#/alpha",
      slef: "[alpha]",
    });
    await pending;

    expect(document.getElementById("build-edsy").classList).toContain("hidden");
    expect(document.getElementById("build-edsy").hasAttribute("href")).toBe(false);
    expect(loadoutSlef).toBe("");
  });
});
