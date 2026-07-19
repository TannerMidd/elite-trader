import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Minimal snapshot shape the sequence reads. */
const baseSnapshot = (overrides = {}) => ({
  system: "LHS 3746",
  destination: "Maia",
  fuel_main: 20,
  fuel_capacity: 32,
  nav: { ahead: [{}, {}, {}] },
  jump_history: [],
  jump: null,
  ...overrides,
});

const jumpBlock = (overrides = {}) => ({
  system: "Merope",
  star_class: "B",
  scoopable: true,
  taxi: false,
  started_ms: 111,
  elapsed_s: 0,
  ...overrides,
});

/** @type {typeof import("./jump-sequence.js")} */
let mod;

const overlayRoot = () => document.getElementById("fsd-overlay");
const isHidden = (id) => document.getElementById(id)?.classList.contains("hidden");
const tunnelElement = () => document.querySelector("fsd-tunnel");

async function freshModule() {
  vi.resetModules();
  mod = await import("./jump-sequence.js");
}

describe("FSD jump sequence", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    localStorage.clear();
    document.body.className = "panel-mode";
    const host = document.createElement("div");
    host.id = "fsd-overlay";
    host.className = "hidden";
    document.body.append(host);
    await freshModule();
  });

  afterEach(() => {
    vi.useRealTimers();
    overlayRoot()?.remove();
    document.body.className = "";
  });

  it("is enabled by default and honours the device-local switch", () => {
    expect(mod.jumpSequenceEnabled()).toBe(true);
    localStorage.setItem("fsdSeq", "0");
    expect(mod.jumpSequenceEnabled()).toBe(false);
    localStorage.setItem("fsdSeq", "1");
    expect(mod.jumpSequenceEnabled()).toBe(true);
  });

  it("stays idle when the setting is off", () => {
    localStorage.setItem("fsdSeq", "0");
    mod.renderJumpSequence(baseSnapshot({ jump: jumpBlock() }));
    expect(overlayRoot().classList.contains("hidden")).toBe(true);
    expect(overlayRoot().childElementCount).toBe(0);
  });

  it("stays idle outside panel mode", () => {
    document.body.className = "";
    mod.renderJumpSequence(baseSnapshot({ jump: jumpBlock() }));
    expect(overlayRoot().childElementCount).toBe(0);
  });

  it("ignores a jump that is already half over", () => {
    mod.renderJumpSequence(baseSnapshot({ jump: jumpBlock({ elapsed_s: 45 }) }));
    expect(overlayRoot().childElementCount).toBe(0);
  });

  it("plays charge, hands over to the tunnel, and marks the tunnel variant", () => {
    mod.renderJumpSequence(baseSnapshot({ jump: jumpBlock() }));
    expect(overlayRoot().classList.contains("hidden")).toBe(false);
    expect(isHidden("fsd-charge")).toBe(false);
    expect(document.getElementById("fsd-charge-name")?.textContent).toBe("MEROPE");
    expect(document.getElementById("fsd-chip-scoop")?.textContent).toBe("SCOOPABLE");
    expect(tunnelElement()?.getAttribute("phase")).toBe("charge");

    vi.advanceTimersByTime(5300);
    expect(isHidden("fsd-charge")).toBe(true);
    expect(isHidden("fsd-hud")).toBe(false);
    expect(tunnelElement()?.getAttribute("phase")).toBe("tunnel");
    expect(document.getElementById("fsd-hud-route")?.textContent).toContain("ROUTE TO MAIA");

    // The same poll payload must not restart the sequence.
    mod.renderJumpSequence(baseSnapshot({ jump: jumpBlock() }));
    expect(isHidden("fsd-hud")).toBe(false);
  });

  it("selects the neutron variant from the star class and caps flashes on request", () => {
    localStorage.setItem("fsdSeqReduceFlash", "1");
    mod.renderJumpSequence(
      baseSnapshot({ jump: jumpBlock({ star_class: "N", scoopable: false }) }),
    );
    expect(tunnelElement()?.getAttribute("variant")).toBe("neutron");
    expect(tunnelElement()?.getAttribute("rflash")).toBe("1");
    expect(document.getElementById("fsd-banner")?.textContent).toContain("NEUTRON CONE TRANSIT");
  });

  it("selects the critical variant when fuel is low", () => {
    mod.renderJumpSequence(
      baseSnapshot({ fuel_main: 4, jump: jumpBlock({ star_class: "Y", scoopable: false }) }),
    );
    expect(tunnelElement()?.getAttribute("variant")).toBe("critical");
    expect(document.getElementById("fsd-banner")?.textContent).toContain("FUEL CRITICAL");
    expect(document.getElementById("fsd-charge-warn")?.textContent).toBe("DON'T PANIC");
  });

  it("runs the arrival reveal when the poll shows the ship moved", () => {
    mod.renderJumpSequence(baseSnapshot({ jump: jumpBlock() }));
    vi.advanceTimersByTime(6000);
    mod.renderJumpSequence(
      baseSnapshot({
        system: "Merope",
        jump: null,
        jump_history: [{ system: "Merope", dist: 28.6 }],
      }),
    );
    expect(isHidden("fsd-arrival")).toBe(false);
    expect(tunnelElement()?.getAttribute("phase")).toBe("arrival");
    expect(isHidden("fsd-arrival-box")).toBe(true);

    vi.advanceTimersByTime(1700);
    expect(isHidden("fsd-arrival-box")).toBe(false);
    expect(document.getElementById("fsd-arrival-name")?.textContent).toBe("MEROPE");
    expect(document.getElementById("fsd-arrival-tail")?.textContent).toContain("28.6 LY");

    vi.advanceTimersByTime(4000);
    expect(overlayRoot().classList.contains("fsd-on")).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(overlayRoot().classList.contains("hidden")).toBe(true);
    expect(tunnelElement()).toBeNull();
  });

  it("fades out quietly when the jump signal dies without an arrival", () => {
    mod.renderJumpSequence(baseSnapshot({ jump: jumpBlock() }));
    vi.advanceTimersByTime(2000);
    mod.renderJumpSequence(baseSnapshot({ jump: null }));
    expect(overlayRoot().classList.contains("fsd-on")).toBe(false);
    expect(isHidden("fsd-arrival")).toBe(true);
  });

  it("dismisses on skip without replaying the same jump", () => {
    mod.renderJumpSequence(baseSnapshot({ jump: jumpBlock() }));
    document.getElementById("fsd-skip")?.click();
    expect(overlayRoot().classList.contains("fsd-on")).toBe(false);
    mod.renderJumpSequence(baseSnapshot({ jump: jumpBlock() }));
    expect(overlayRoot().classList.contains("fsd-on")).toBe(false);
  });

  it("previews a full canned jump even outside panel mode", () => {
    document.body.className = "";
    mod.previewJumpSequence();
    expect(overlayRoot().classList.contains("hidden")).toBe(false);
    expect(document.getElementById("fsd-charge-name")?.textContent).toBe("MAIA");

    vi.advanceTimersByTime(5300);
    expect(isHidden("fsd-hud")).toBe(false);
    vi.advanceTimersByTime(8200);
    expect(isHidden("fsd-arrival")).toBe(false);
    vi.advanceTimersByTime(6000);
    expect(overlayRoot().classList.contains("hidden")).toBe(true);
  });

  it("describes journal star classes for the destination chips", () => {
    expect(mod.describeStarClass("K")).toEqual({ line: "K · MAIN SEQUENCE", color: "#ffb46b" });
    expect(mod.describeStarClass("N").line).toContain("NEUTRON STAR");
    expect(mod.describeStarClass("TTS").line).toBe("PROTO-STAR");
    expect(mod.describeStarClass("D").line).toBe("WHITE DWARF");
    expect(mod.describeStarClass("").line).toBe("UNCHARTED MASS");
  });
});
