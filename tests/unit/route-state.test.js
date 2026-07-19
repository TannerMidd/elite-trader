import { beforeEach, describe, expect, it } from "vitest";

import { appStore } from "../../ui/src/core/store.js";
import {
  activeRouteKey,
  changeActiveRouteIndex,
  clearRouteWorkspace,
  getActiveRoute,
  getActiveRouteCommander,
  loadActiveRoute,
  markRouteFormTouched,
  routeFormWasTouched,
  saveActiveRoute,
  startActiveRoute,
  syncActiveRoute,
} from "../../ui/src/features/route-state.js";

describe("route-owned workspace state", () => {
  beforeEach(() => {
    localStorage.clear();
    appStore.clear();
    clearRouteWorkspace();
  });

  it("migrates legacy persistence into one commander-owned key", () => {
    localStorage.setItem(
      "activeRoute",
      JSON.stringify({ waypoints: [{ system: "Sol" }], index: 0 }),
    );

    loadActiveRoute("alpha");

    expect(getActiveRouteCommander()).toBe("alpha");
    expect(getActiveRoute()).toMatchObject({
      kind: "route",
      label: "Tracked route",
      waypoints: [{ system: "Sol" }],
      index: 0,
    });
    expect(localStorage.getItem("activeRoute")).toBeNull();
    expect(localStorage.getItem(activeRouteKey("alpha"))).not.toBeNull();

    loadActiveRoute("beta");
    expect(getActiveRoute()).toBeNull();
    expect(getActiveRouteCommander()).toBe("beta");
  });

  it("tracks, advances, synchronizes, and persists without a generic runtime bag", () => {
    appStore.setSnapshot({ commander_id: "alpha", system: "Sol" });
    startActiveRoute("chain", "Trade chain", [
      { system: "Sol", note: "Start" },
      { system: "Achenar", note: "Finish" },
    ]);

    expect(syncActiveRoute("sol")).toMatchObject({
      complete: false,
      next: { system: "Achenar" },
    });
    expect(changeActiveRouteIndex(-1)?.index).toBe(0);
    expect(changeActiveRouteIndex(1)?.index).toBe(1);

    saveActiveRoute();
    expect(JSON.parse(localStorage.getItem(activeRouteKey("alpha")))).toMatchObject({
      kind: "chain",
      label: "Trade chain",
      index: 1,
    });
  });

  it("clears all in-memory route state on commander handoff", () => {
    appStore.setSnapshot({ commander_id: "alpha" });
    startActiveRoute("route", "Alpha route", [{ system: "Sol" }]);
    markRouteFormTouched();
    expect(routeFormWasTouched()).toBe(true);

    appStore.setSnapshot({ commander_id: "beta" });

    expect(getActiveRoute()).toBeNull();
    expect(getActiveRouteCommander()).toBeNull();
    expect(routeFormWasTouched()).toBe(false);
  });
});
