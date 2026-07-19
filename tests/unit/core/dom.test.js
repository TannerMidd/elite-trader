import { describe, expect, it } from "vitest";

import { safeUrl, setPercentStyle, setSafeHref, setStyleValue } from "../../../ui/src/core/dom.js";

describe("DOM safety helpers", () => {
  it("allows relative and HTTP(S) links", () => {
    expect(safeUrl("/api/state", "https://frameshift.test/")).toBe("/api/state");
    expect(safeUrl("https://inara.cz/elite", "https://frameshift.test/")).toBe(
      "https://inara.cz/elite",
    );
    expect(() => safeUrl("javascript:alert(1)", "https://frameshift.test/")).toThrow(TypeError);

    const anchor = document.createElement("a");
    setSafeHref(anchor, "/docs");
    expect(anchor.getAttribute("href")).toBe("/docs");
  });

  it("clamps percentage styles and blocks style injection", () => {
    const element = document.createElement("div");
    setPercentStyle(element, "width", 140);
    expect(element.style.width).toBe("100%");
    setStyleValue(element, "--accent", "#ff7700");
    expect(element.style.getPropertyValue("--accent")).toBe("#ff7700");
    expect(() => setStyleValue(element, "backgroundImage", "url(evil)")).toThrow(TypeError);
  });
});
