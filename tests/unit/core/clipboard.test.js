import { beforeEach, describe, expect, it, vi } from "vitest";

import { copyText } from "../../../ui/src/core/clipboard.js";

describe("clipboard fallback", () => {
  beforeEach(() => {
    document.body.replaceChildren();
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true,
    });
  });

  it("uses the asynchronous clipboard in a secure context", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const button = document.createElement("button");

    await copyText("Sol", button);

    expect(writeText).toHaveBeenCalledWith("Sol");
    expect(button.classList.contains("hb-good")).toBe(true);
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("falls back to a temporary selection when clipboard policy rejects", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: execCommand,
    });

    await copyText("Beagle Point", null);

    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(document.querySelector("textarea")).toBeNull();
  });
});
