import { describe, expect, it, vi } from "vitest";

import { createAlertState } from "../../ui/src/features/alert-state.js";

describe("alert-owned lifecycle state", () => {
  it("seeds existing alerts and emits only newer alert IDs", () => {
    const state = createAlertState();

    expect(state.consumeStateAlerts([{ id: 4 }, { id: 2 }])).toEqual([]);
    expect(state.consumeStateAlerts([{ id: 4 }, { id: 5 }, { id: 3 }])).toEqual([{ id: 5 }]);
  });

  it("owns and cancels polling and toast timers as one resettable lifecycle", () => {
    let nextTimer = 0;
    const callbacks = new Map();
    const cancel = vi.fn((timer) => callbacks.delete(timer));
    const state = createAlertState({
      schedule: (callback) => {
        nextTimer += 1;
        callbacks.set(nextTimer, callback);
        return nextTimer;
      },
      cancel,
    });

    state.schedulePoll(vi.fn());
    state.scheduleFlightToast(vi.fn());
    expect(state.replaceRouteAlertTimestamp(100)).toBeNull();
    expect(state.replaceRouteAlertTimestamp(101)).toBe(100);
    state.reset();

    expect(cancel).toHaveBeenCalledTimes(2);
    expect(callbacks.size).toBe(0);
    expect(state.replaceRouteAlertTimestamp(200)).toBeNull();
    expect(state.observeFuelSignature("fuel|Sol")).toBe(true);
    expect(state.observeFuelSignature("fuel|Sol")).toBe(false);
  });
});
