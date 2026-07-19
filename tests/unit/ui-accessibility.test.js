import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { pairingTrapKeydown, setPairingModalOpen } from "../../ui/src/features/security.js";
import { renderJournalRebuild } from "../../ui/src/features/alerts.js";

describe("pairing modal accessibility", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = `
      <button id="return-focus">OPEN</button>
      <main id="application"></main>
      <div id="pairing-gate" class="hidden" aria-hidden="true">
        <div class="pairing-panel" tabindex="-1">
          <button id="pairing-retry">RETRY</button>
          <button id="pairing-other">OTHER</button>
        </div>
      </div>
    `;
  });

  afterEach(() => {
    setPairingModalOpen(false);
    vi.useRealTimers();
  });

  it("moves focus into the gate, traps Tab, and restores background state", () => {
    const returnFocus = document.querySelector("#return-focus");
    const application = document.querySelector("#application");
    const gate = document.querySelector("#pairing-gate");
    const retry = document.querySelector("#pairing-retry");
    const other = document.querySelector("#pairing-other");
    returnFocus.focus();

    setPairingModalOpen(true);
    vi.runAllTimers();

    expect(gate.classList.contains("hidden")).toBe(false);
    expect(gate.getAttribute("aria-hidden")).toBe("false");
    expect(application.inert).toBe(true);
    expect(application.getAttribute("aria-hidden")).toBe("true");
    expect(document.activeElement).toBe(retry);

    other.focus();
    const tab = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    });
    pairingTrapKeydown(tab);
    expect(tab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(retry);

    setPairingModalOpen(false);
    expect(application.inert).toBe(false);
    expect(application.hasAttribute("aria-hidden")).toBe(false);
    expect(document.activeElement).toBe(returnFocus);
  });
});

describe("journal reconstruction status", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="banner"></div>';
  });

  it("clamps progress, keeps stable DOM, and explains retry and fault states", () => {
    const banner = document.querySelector("#banner");
    const complete = {
      phase: "history",
      completed: 9,
      total: 6,
      attempt: 0,
      retrying: false,
    };
    renderJournalRebuild(banner, complete);

    expect(banner.querySelector(".bs-title").textContent).toBe("STARTUP SEQUENCE");
    expect(banner.querySelector(".bs-bar").getAttribute("aria-valuenow")).toBe("6");
    expect(banner.querySelector(".bs-fill").style.width).toBe("100%");
    const stableHead = banner.firstElementChild;

    renderJournalRebuild(banner, complete);
    expect(banner.firstElementChild).toBe(stableHead);

    renderJournalRebuild(banner, {
      ...complete,
      completed: 2,
      attempt: 3,
      retrying: true,
    });
    expect(banner.querySelector(".bs-title").textContent).toBe("STARTUP SEQUENCE — HOLDING");
    expect(banner.querySelector(".bs-sub").textContent).toContain(
      "retrying automatically (attempt 3)",
    );

    renderJournalRebuild(banner, {
      ...complete,
      phase: "error",
      completed: 2,
      attempt: 3,
    });
    expect(banner.querySelector(".bs-title").textContent).toBe("STARTUP FAULT");
    expect(banner.querySelector(".bs-sub").textContent).toContain(
      "could not be reconstructed safely",
    );
    expect(banner.querySelector(".bs-meter")).toBeNull();
  });
});
