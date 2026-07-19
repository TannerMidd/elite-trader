import { beforeEach, describe, expect, it } from "vitest";

import {
  DISPLAY_DEFAULTS,
  displayValue,
  voiceVolume,
} from "../../../ui/src/core/display-preferences.js";

describe("display preferences", () => {
  beforeEach(() => localStorage.clear());

  it("uses stable defaults and reads numeric device overrides", () => {
    expect(displayValue("uiScale")).toBe(DISPLAY_DEFAULTS.uiScale);
    localStorage.setItem("uiScale", "115");
    expect(displayValue("uiScale")).toBe(115);
  });

  it("normalizes voice volume at the shared shell boundary", () => {
    localStorage.setItem("voiceVolume", "65");
    expect(voiceVolume()).toBe(0.65);
    localStorage.setItem("voiceVolume", "500");
    expect(voiceVolume()).toBe(1);
    localStorage.setItem("voiceVolume", "-10");
    expect(voiceVolume()).toBe(0);
  });
});
