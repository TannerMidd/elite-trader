import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  findMaterialTraders: vi.fn(),
  findTradeRoute: vi.fn(),
}));

vi.mock("../../ui/src/api/engineering.js", () => ({
  engineeringApi: {
    findMaterialTraders: apiMocks.findMaterialTraders,
  },
}));

vi.mock("../../ui/src/api/market.js", () => ({
  marketApi: {
    findTradeRoute: apiMocks.findTradeRoute,
  },
}));

import { StaleResponseError } from "../../ui/src/core/http.js";
import { appStore } from "../../ui/src/core/store.js";
import { findTraders } from "../../ui/src/features/engineering.js";
import { findBestLoop, findRoutes } from "../../ui/src/features/routes.js";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function publishCommander(commanderId, system) {
  appStore.setSnapshot({
    cargo_capacity: 64,
    commander_id: commanderId,
    system,
  });
}

function mountBestLoop() {
  document.body.innerHTML = `
    <button id="fp-bestloop" type="button">Find loop</button>
    <div id="fp-loop-status"></div>
    <div id="fp-loop-results"></div>
  `;
}

function mountRouteForm() {
  document.body.innerHTML = `
    <form>
      <button id="rf-go" type="submit">Find route</button>
      <div id="route-status"></div>
      <div id="route-results"></div>
      <select id="rf-mode"><option value="route" selected>Route</option></select>
      <input id="rf-capital" value="1000000">
      <input id="rf-cargo" value="64">
      <input id="rf-radius" value="100">
      <input id="rf-maxleg" value="50">
      <input id="rf-jumprange" value="30">
      <input id="rf-results" value="3">
      <input id="rf-minsupply" value="64">
      <input id="rf-hop" value="30">
      <input id="rf-hops" value="5">
      <input id="rf-lsdist" value="2000">
      <input id="rf-age" value="7">
      <input id="rf-largepad" type="checkbox">
    </form>
  `;
}

describe("commander handoff UI guards", () => {
  beforeEach(() => {
    apiMocks.findMaterialTraders.mockReset();
    apiMocks.findTradeRoute.mockReset();
    document.body.replaceChildren();
    appStore.clear();
  });

  it("does not let an old best-loop response overwrite a new commander's search", async () => {
    mountBestLoop();
    publishCommander("alpha", "Sol");
    const alphaResponse = deferred();
    const betaResponse = deferred();
    apiMocks.findTradeRoute
      .mockReturnValueOnce(alphaResponse.promise)
      .mockReturnValueOnce(betaResponse.promise);

    const alphaSearch = findBestLoop();
    publishCommander("beta", "Achenar");
    expect(document.querySelector("#fp-bestloop").disabled).toBe(false);
    expect(document.querySelector("#fp-loop-status").textContent).toBe("");
    const betaSearch = findBestLoop();

    alphaResponse.resolve({ loops: [] });
    await alphaSearch;

    expect(document.querySelector("#fp-loop-status").textContent).toContain(
      "Finding the best loop",
    );
    expect(document.querySelector("#fp-bestloop").disabled).toBe(true);
    expect(document.querySelector("#fp-loop-results").children).toHaveLength(0);

    betaResponse.resolve({ loops: [] });
    await betaSearch;
    expect(document.querySelector("#fp-loop-status").textContent).toContain("No profitable loop");
    expect(document.querySelector("#fp-bestloop").disabled).toBe(false);
  });

  it("does not let an old route response overwrite a new commander's search", async () => {
    mountRouteForm();
    publishCommander("alpha", "Sol");
    const alphaResponse = deferred();
    const betaResponse = deferred();
    apiMocks.findTradeRoute
      .mockReturnValueOnce(alphaResponse.promise)
      .mockReturnValueOnce(betaResponse.promise);

    const alphaSearch = findRoutes({ preventDefault: vi.fn() });
    publishCommander("beta", "Achenar");
    expect(document.querySelector("#rf-go").disabled).toBe(false);
    expect(document.querySelector("#route-status").textContent).toBe("");
    const betaSearch = findRoutes({ preventDefault: vi.fn() });

    alphaResponse.resolve({ hops: [], mode: "route", source: "local" });
    await alphaSearch;

    expect(document.querySelector("#route-status").textContent).toContain("Planning the chain");
    expect(document.querySelector("#rf-go").disabled).toBe(true);
    expect(document.querySelector("#route-results").children).toHaveLength(0);

    betaResponse.resolve({ hops: [], mode: "route", source: "local" });
    await betaSearch;
    expect(document.querySelector("#route-status").textContent).toContain("No profitable route");
    expect(document.querySelector("#rf-go").disabled).toBe(false);
  });

  it("does not turn stale material-trader failures into another commander's rows", async () => {
    document.body.innerHTML = '<div id="engplan-traders"></div>';
    publishCommander("alpha", "Sol");
    const alphaResponses = [deferred(), deferred(), deferred()];
    const betaResponses = [deferred(), deferred(), deferred()];
    for (const response of [...alphaResponses, ...betaResponses]) {
      apiMocks.findMaterialTraders.mockReturnValueOnce(response.promise);
    }

    const alphaSearch = findTraders();
    publishCommander("beta", "Achenar");
    expect(document.querySelector("#engplan-traders").textContent).toBe("");
    const betaSearch = findTraders();

    alphaResponses[0].reject(new StaleResponseError());
    alphaResponses[1].resolve({ traders: [] });
    alphaResponses[2].resolve({ traders: [] });
    await alphaSearch;

    expect(document.querySelector("#engplan-traders").textContent).toContain(
      "Finding material traders",
    );
    expect(document.querySelectorAll(".ep-trader")).toHaveLength(0);

    for (const response of betaResponses) response.resolve({ traders: [] });
    await betaSearch;
    expect(document.querySelectorAll(".ep-trader")).toHaveLength(3);
    expect(document.querySelector("#engplan-traders").textContent).not.toContain(
      "Trader search failed",
    );
  });
});
