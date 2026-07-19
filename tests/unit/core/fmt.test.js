import { describe, expect, it } from "vitest";

import {
  ageText,
  compactCredits,
  compactDuration,
  fmtCr,
  fmtDuration,
  fmtNum,
  fmtUnknownNumber,
  shortCr,
  signedCompactCredits,
  signedCr,
} from "../../../ui/src/core/fmt.js";

describe("formatters", () => {
  it("formats credits and numbers consistently", () => {
    expect(fmtNum(1234)).toBe("1,234");
    expect(fmtCr(1234.4)).toBe("1,234 cr");
    expect(signedCr(5)).toBe("+5 cr");
    expect(shortCr(1_250_000)).toBe("1.3M");
    expect(fmtCr(undefined)).toBe("—");
    expect(fmtUnknownNumber(undefined)).toBe("?");
    expect(compactCredits(1_250)).toBe("1k");
    expect(signedCompactCredits(-1_250)).toBe("−1k cr");
  });

  it("formats durations and ages", () => {
    expect(fmtDuration(3661)).toBe("1h 1m");
    expect(fmtDuration(61)).toBe("1m 1s");
    expect(compactDuration(90_061)).toBe("1d 1h");
    expect(ageText(90)).toBe("1m ago");
    expect(ageText(-1)).toBe("unknown");
  });
});
