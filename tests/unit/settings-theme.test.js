import { beforeEach, describe, expect, it } from "vitest";

import {
  applyTheme,
  buildThemeSetting,
  hexToRgb,
  softenAccent,
} from "../../ui/src/features/settings/theme.js";

describe("device-local settings theme", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.replaceChildren();
    document.documentElement.removeAttribute("style");
  });

  it("normalizes preset and custom accent variables", () => {
    expect(hexToRgb("#336699")).toEqual([51, 102, 153]);
    expect(hexToRgb("not-a-color")).toBeNull();
    expect(softenAccent("#000000")).toBe("#595959");

    localStorage.setItem("accentTheme", "#336699");
    applyTheme();

    const style = document.documentElement.style;
    expect(style.getPropertyValue("--orange")).toBe("#336699");
    expect(style.getPropertyValue("--accent-rgb")).toBe("51, 102, 153");
  });

  it("builds accessible preset controls that update the active theme", () => {
    const setting = buildThemeSetting();
    document.body.appendChild(setting);
    const ice = setting.querySelector('[data-theme="ice"]');

    ice.click();

    expect(localStorage.getItem("accentTheme")).toBe("ice");
    expect(ice.getAttribute("aria-pressed")).toBe("true");
    expect(document.documentElement.style.getPropertyValue("--orange")).toBe("#35a7ff");
  });
});
