import { describe, expect, it, vi } from "vitest";

import { createEngineeringApi } from "../../ui/src/api/engineering.js";
import { createExtensionsApi } from "../../ui/src/api/extensions.js";
import { createMarketApi } from "../../ui/src/api/market.js";
import { createNavigationApi } from "../../ui/src/api/navigation.js";
import { createOperationsApi } from "../../ui/src/api/operations.js";
import { withQuery } from "../../ui/src/api/query.js";
import { createSecurityApi } from "../../ui/src/api/security.js";
import { createSettingsApi } from "../../ui/src/api/settings.js";
import { createSpecialistsApi } from "../../ui/src/api/specialists.js";
import { createSystemApi } from "../../ui/src/api/system.js";
import { createUpdateApi } from "../../ui/src/api/update.js";
import { HttpError } from "../../ui/src/core/http.js";

function clientStub() {
  const json = vi.fn().mockResolvedValue({});
  const blob = vi.fn().mockResolvedValue(new Blob(["payload"]));
  const download = vi.fn().mockResolvedValue({
    blob: new Blob(["payload"]),
    filename: "payload.bin",
    contentType: "application/octet-stream",
    serverVersion: "test",
  });
  const text = vi.fn().mockResolvedValue("payload");
  const request = vi.fn().mockResolvedValue(new Response());
  return { json, blob, download, text, request };
}

describe("API query construction", () => {
  it("encodes values, omits nullish values, and comma-joins arrays", () => {
    expect(
      withQuery("/api/history/events", {
        system: "Shinrarta Dezhra",
        categories: ["travel", "market"],
        limit: 0,
        ascending: false,
        since: null,
      }),
    ).toBe(
      "/api/history/events?system=Shinrarta+Dezhra&categories=travel%2Cmarket&limit=0&ascending=false",
    );
  });
});

describe("domain API clients", () => {
  it("preserves endpoint-specific response envelopes at the API boundary", async () => {
    const client = clientStub();
    const state = {
      commander: "Test",
      commander_id: "cmdr-test",
      links: [{ label: "Inara", url: "https://inara.cz/" }],
    };
    const manifest = {
      id: "demo",
      api_version: 1,
      name: "Demo",
      version: "1",
      permissions: ["read:journal"],
      rules: [],
    };
    const update = {
      current: "1.0.0",
      latest: "1.1.0",
      available: true,
      notes_url: "https://example.test/release",
      notes: "Release notes",
      notes_title: "Frameshift 1.1.0",
      size: 1024,
      supported: true,
      verification: "SHA-256",
      error: null,
    };
    const progress = {
      phase: "downloading",
      error: null,
      downloaded_mb: 1,
      total_mb: 4,
      pct: 25,
    };
    client.json
      .mockResolvedValueOnce(state)
      .mockResolvedValueOnce({ manifest })
      .mockResolvedValueOnce(update)
      .mockResolvedValueOnce(progress);

    const system = createSystemApi(client);
    const extensions = createExtensionsApi(client);
    const updater = createUpdateApi(client);

    await expect(system.getState()).resolves.toBe(state);
    await expect(extensions.getManifest("demo")).resolves.toEqual({ manifest });
    await expect(updater.checkForUpdate(true)).resolves.toBe(update);
    await expect(updater.getUpdateStatus()).resolves.toBe(progress);

    expect(client.json).toHaveBeenNthCalledWith(1, "/api/state");
    expect(client.json).toHaveBeenNthCalledWith(2, "/api/extensions/demo/manifest");
    expect(client.json).toHaveBeenNthCalledWith(3, "/api/update/check?force=1");
    expect(client.json).toHaveBeenNthCalledWith(4, "/api/update/status");
  });

  it("encodes device identifiers and sends typed JSON changes", async () => {
    const client = clientStub();
    const api = createSecurityApi(client);

    await api.updateDevice("tablet / bridge", { name: "Cockpit", scopes: ["read"] });

    expect(client.json).toHaveBeenCalledWith("/api/security/devices/tablet%20%2F%20bridge", {
      method: "PATCH",
      json: { name: "Cockpit", scopes: ["read"] },
    });
  });

  it("marks engineering state and mutations as commander-scoped", async () => {
    const client = clientStub();
    const api = createEngineeringApi(client);

    await api.getWorkshop();
    await api.setPinnedBlueprint({ action: "unpin", id: "fsd-5" });

    expect(client.json).toHaveBeenNthCalledWith(1, "/api/engineering", {
      scope: "commander",
    });
    expect(client.json).toHaveBeenNthCalledWith(2, "/api/engineering/pin", {
      method: "POST",
      json: { action: "unpin", id: "fsd-5" },
      scope: "commander",
    });
  });

  it("scopes history-backed extension tests but not supplied sample events", async () => {
    const client = clientStub();
    const api = createExtensionsApi(client);
    const manifest = { id: "demo" };
    const sampleEvent = { event: "Docked" };

    await api.testManifestAgainstHistory(manifest);
    await api.testManifestWithSample(manifest, sampleEvent);

    expect(client.json).toHaveBeenNthCalledWith(1, "/api/extensions/test", {
      method: "POST",
      json: { manifest },
      scope: "commander",
    });
    expect(client.json).toHaveBeenNthCalledWith(2, "/api/extensions/test", {
      method: "POST",
      json: { manifest, sample_event: sampleEvent },
    });
  });

  it("uses commander-scoped blob transport for operations exports", async () => {
    const client = clientStub();
    const api = createOperationsApi(client);

    await api.exportBoards("board alpha");

    expect(client.download).toHaveBeenCalledWith("/api/operations/export?board_id=board+alpha", {
      scope: "commander",
    });
  });

  it("scopes state-derived ship and cargo requests to the current commander", async () => {
    const client = clientStub();
    const system = createSystemApi(client);
    const market = createMarketApi(client);

    await system.getLoadoutExport();
    await market.findCargoBuyers({ radius: 50 });
    await market.recoverCargo({ failed_market_id: 42 });
    await market.findColonisationSources(73, 25);

    expect(client.json).toHaveBeenNthCalledWith(1, "/api/loadout-export", {
      scope: "commander",
    });
    expect(client.json).toHaveBeenNthCalledWith(2, "/api/cargo-sell?radius=50", {
      scope: "commander",
    });
    expect(client.json).toHaveBeenNthCalledWith(3, "/api/cargo-recovery", {
      method: "POST",
      json: { failed_market_id: 42 },
      scope: "commander",
    });
    expect(client.json).toHaveBeenNthCalledWith(
      4,
      "/api/colonisation-sources?market_id=73&radius=25",
      { scope: "commander" },
    );
  });

  it("scopes snapshot-defaulted discovery searches to the active commander", async () => {
    const client = clientStub();
    const market = createMarketApi(client);
    const system = createSystemApi(client);

    await market.searchCommodities({ q: "gold" });
    await market.findMiningLocations({ radius: 25 });
    await market.findMiningHotspots("Painite", "Sol");
    await market.searchStations({ q: "Fuel Scoop" });
    await market.findDataSaleStations(true, "Sol");
    await market.findInterstellarFactors("Sol");
    await system.getSystemStations("Sol");

    expect(client.json).toHaveBeenNthCalledWith(1, "/api/commodity-search?q=gold", {
      scope: "commander",
    });
    expect(client.json).toHaveBeenNthCalledWith(2, "/api/mining?radius=25", {
      scope: "commander",
    });
    expect(client.json).toHaveBeenNthCalledWith(
      3,
      "/api/mining/hotspots?mineral=Painite&system=Sol",
      { scope: "commander" },
    );
    expect(client.json).toHaveBeenNthCalledWith(4, "/api/station-search?q=Fuel+Scoop", {
      scope: "commander",
    });
    expect(client.json).toHaveBeenNthCalledWith(5, "/api/sell-data?carriers=1&system=Sol", {
      scope: "commander",
    });
    expect(client.json).toHaveBeenNthCalledWith(6, "/api/interstellar-factors?system=Sol", {
      scope: "commander",
    });
    expect(client.json).toHaveBeenNthCalledWith(7, "/api/system-stations?system=Sol", {
      scope: "commander",
    });
  });

  it("scopes snapshot-defaulted planners and uses the exobiology system query contract", async () => {
    const client = clientStub();
    const navigation = createNavigationApi(client);

    await navigation.planRichesRoute({ radius: 50 });
    await navigation.planNeutronRoute({ to: "Colonia" });
    await navigation.findExobiologyRoute({ system: "Sol", max_gravity: 0.5 });

    expect(client.json).toHaveBeenNthCalledWith(1, "/api/riches", {
      method: "POST",
      json: { radius: 50 },
      scope: "commander",
    });
    expect(client.json).toHaveBeenNthCalledWith(2, "/api/neutron", {
      method: "POST",
      json: { to: "Colonia" },
      scope: "commander",
    });
    expect(client.json).toHaveBeenNthCalledWith(3, "/api/exobio-route?system=Sol&max_gravity=0.5", {
      scope: "commander",
    });
  });

  it("marks every specialist mutation and download as commander-scoped", async () => {
    const client = clientStub();
    const api = createSpecialistsApi(client);

    await api.startMiningRun();
    await api.removeExobiologyPin("pin / 7");
    await api.exportExobiologyGeoJson("A 1");

    expect(client.json).toHaveBeenNthCalledWith(1, "/api/specialists/mining/start", {
      method: "POST",
      json: {},
      scope: "commander",
    });
    expect(client.json).toHaveBeenNthCalledWith(
      2,
      "/api/specialists/exobiology/pins/pin%20%2F%207",
      { method: "DELETE", scope: "commander" },
    );
    expect(client.blob).toHaveBeenCalledWith("/api/specialists/exobiology/geojson?body=A+1", {
      scope: "commander",
    });
  });

  it("keeps rejected journal paths as displayable validation results", async () => {
    const client = clientStub();
    const payload = {
      path: "Z:\\private",
      auto: false,
      exists: null,
      files: 0,
      unchecked: true,
      error: "Path is outside an allowed journal location.",
    };
    client.json.mockRejectedValueOnce(new HttpError(payload.error, { status: 400, payload }));
    const api = createSettingsApi(client);

    await expect(api.validateJournalDirectory(payload.path)).resolves.toEqual(payload);
  });

  it("uses blob transport for binary speech responses", async () => {
    const client = clientStub();
    const api = createSettingsApi(client);

    await api.synthesizeSpeech("Landing gear deployed.");

    expect(client.blob).toHaveBeenCalledWith("/api/speak", {
      method: "POST",
      json: { text: "Landing gear deployed." },
    });
  });
});
