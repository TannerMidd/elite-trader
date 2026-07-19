import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  testManifestAgainstHistory: vi.fn(),
}));

vi.mock("../../ui/src/api/extensions.js", () => ({
  extensionsApi: {
    testManifestAgainstHistory: apiMocks.testManifestAgainstHistory,
  },
}));

vi.mock("../../ui/src/features/extensions.js", () => ({
  loadLocalServices: vi.fn(),
}));

import { appStore } from "../../ui/src/core/store.js";
import {
  resetExtensionBuilderHistory,
  xbOpen,
  xbTest,
} from "../../ui/src/features/extension-builder.js";

function deferred() {
  let reject;
  let resolve;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function mountBuilder() {
  document.body.innerHTML = `
    <form id="xb-form" class="hidden">
      <input id="xb-name">
      <span id="xb-id"></span>
      <div id="xb-rules"></div>
      <button id="xb-test" type="button">Test</button>
      <button id="xb-save" type="submit">Save</button>
      <div id="xb-status"></div>
      <div id="xb-results" class="hidden"></div>
    </form>
  `;
  xbOpen({
    name: "Docking preview",
    rules: [
      {
        event: "Docked",
        action: {
          type: "alert",
          level: "info",
          text: "Docked at {StationName}",
        },
      },
    ],
  });
}

describe("extension-builder commander history handoffs", () => {
  beforeEach(() => {
    apiMocks.testManifestAgainstHistory.mockReset();
    appStore.clear();
    mountBuilder();
  });

  it("does not start a history replay without an established commander", async () => {
    await xbTest();

    expect(apiMocks.testManifestAgainstHistory).not.toHaveBeenCalled();
    expect(document.querySelector("#xb-status").textContent).toContain(
      "Waiting for a commander profile",
    );
    expect(document.querySelector("#xb-test").disabled).toBe(false);
    expect(document.querySelector("#xb-results").classList.contains("hidden")).toBe(true);
  });

  it("clears a handoff and ignores the old commander's late response", async () => {
    const alphaResponse = deferred();
    apiMocks.testManifestAgainstHistory.mockReturnValueOnce(alphaResponse.promise);
    appStore.setSnapshot({ commander_id: "alpha" });

    const alphaTest = xbTest();
    expect(document.querySelector("#xb-status").textContent).toContain("Replaying");
    expect(document.querySelector("#xb-test").disabled).toBe(true);

    appStore.setSnapshot({ commander_id: "beta" });
    resetExtensionBuilderHistory();

    expect(document.querySelector("#xb-status").textContent).toBe("");
    expect(document.querySelector("#xb-results").children).toHaveLength(0);
    expect(document.querySelector("#xb-results").classList.contains("hidden")).toBe(true);
    expect(document.querySelector("#xb-test").disabled).toBe(false);

    alphaResponse.resolve({
      scanned: 1,
      matches: [
        {
          event_type: "Docked",
          timestamp: "2026-07-18T12:00:00Z",
          action: { type: "alert", level: "critical", text: "ALPHA PRIVATE HISTORY" },
        },
      ],
    });
    await alphaTest;

    expect(document.body.textContent).not.toContain("ALPHA PRIVATE HISTORY");
    expect(document.querySelector("#xb-status").textContent).toBe("");
    expect(document.querySelector("#xb-test").disabled).toBe(false);
  });

  it("does not let a superseded response overwrite or unlock the newest replay", async () => {
    const firstResponse = deferred();
    const secondResponse = deferred();
    apiMocks.testManifestAgainstHistory
      .mockReturnValueOnce(firstResponse.promise)
      .mockReturnValueOnce(secondResponse.promise);
    appStore.setSnapshot({ commander_id: "alpha" });

    const firstTest = xbTest();
    const secondTest = xbTest();

    firstResponse.resolve({
      scanned: 1,
      matches: [
        {
          event_type: "Docked",
          timestamp: "2026-07-18T12:00:00Z",
          action: { type: "alert", level: "warn", text: "SUPERSEDED RESULT" },
        },
      ],
    });
    await firstTest;

    expect(document.body.textContent).not.toContain("SUPERSEDED RESULT");
    expect(document.querySelector("#xb-status").textContent).toContain("Replaying");
    expect(document.querySelector("#xb-test").disabled).toBe(true);

    secondResponse.resolve({ scanned: 25, matches: [] });
    await secondTest;

    expect(document.querySelector("#xb-status").textContent).toContain(
      "Scanned your last 25 events — no matches.",
    );
    expect(document.querySelector("#xb-test").disabled).toBe(false);
  });
});
