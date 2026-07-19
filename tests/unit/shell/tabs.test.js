import { beforeEach, describe, expect, it, vi } from "vitest";

import { activateTab, configureTabActivation, initializeTabs } from "../../../ui/src/shell/tabs.js";

describe("shell tab navigation", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = `
      <nav id="tabs">
        <button data-tab="trade"></button>
        <button data-tab="analytics"></button>
      </nav>
      <section id="tab-trade" class="tabpane"></section>
      <section id="tab-analytics" class="tabpane hidden"></section>
    `;
    configureTabActivation(() => {});
  });

  it("owns shell visibility and delegates feature activation", () => {
    const activated = vi.fn();
    configureTabActivation(activated);

    activateTab("analytics", false);

    expect(document.querySelector('[data-tab="analytics"]')?.getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(document.querySelector("#tab-trade")?.classList.contains("hidden")).toBe(true);
    expect(document.querySelector("#tab-analytics")?.classList.contains("hidden")).toBe(false);
    expect(localStorage.getItem("activeTab")).toBe("analytics");
    expect(activated).toHaveBeenCalledOnce();
    expect(activated).toHaveBeenCalledWith("analytics");
  });

  it("restores the saved tab through the same activation contract", () => {
    const activated = vi.fn();
    configureTabActivation(activated);
    localStorage.setItem("activeTab", "analytics");

    initializeTabs();

    expect(document.querySelector("#tab-analytics")?.classList.contains("hidden")).toBe(false);
    expect(activated).toHaveBeenCalledWith("analytics");
  });
});
