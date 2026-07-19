import { describe, expect, it, vi } from "vitest";

import { commanderIdOf, createStore } from "../../../ui/src/core/store.js";

describe("store", () => {
  it("publishes snapshots and commander lifecycle changes", () => {
    const store = createStore();
    const snapshots = vi.fn();
    const profiles = vi.fn();
    store.subscribe(snapshots);
    store.onProfileChange(profiles);

    store.setSnapshot({ commander_id: "alpha", credits: 1 });
    store.setSnapshot({ commander_id: "alpha", credits: 2 });
    store.setSnapshot({ commander_id: "beta", credits: 3 });

    expect(snapshots).toHaveBeenCalledTimes(3);
    expect(profiles).toHaveBeenCalledTimes(2);
    expect(store.identity()).toEqual({ commanderId: "beta", generation: 2 });
  });

  it("invalidates captured identities on clear", () => {
    const store = createStore({ commander_id: "alpha" });
    const identity = store.identity();

    store.clear();

    expect(store.isCurrent(identity)).toBe(false);
    expect(store.getSnapshot()).toBeNull();
  });

  it("normalizes commander IDs", () => {
    expect(commanderIdOf({ commander_id: "  alpha " })).toBe("alpha");
    expect(commanderIdOf({ commander_id: "" })).toBeNull();
    expect(commanderIdOf(null)).toBeNull();
  });
});
