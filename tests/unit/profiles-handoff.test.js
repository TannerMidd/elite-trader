import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  listProfiles: vi.fn(),
  activateProfile: vi.fn(),
}));

vi.mock("../../ui/src/api/profiles.js", () => ({
  profilesApi: {
    listProfiles: apiMocks.listProfiles,
    activateProfile: apiMocks.activateProfile,
  },
}));

vi.mock("../../ui/src/features/security.js", () => ({
  securityStatus: { scopes: ["admin"] },
}));

import { appStore } from "../../ui/src/core/store.js";
import { loadProfiles } from "../../ui/src/features/profiles.js";

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function overview(name, id) {
  return {
    profiles: [
      {
        id,
        name,
        galaxy_mode: "live",
        created_at: "2026-07-18T00:00:00Z",
        last_seen_at: "2026-07-18T12:00:00Z",
        active: true,
        tables: {},
        rows: 4,
      },
    ],
    active_commander_id: id,
    adopted_by: null,
    unattributed: { tables: {}, rows: 0 },
  };
}

describe("profile list commander handoffs", () => {
  beforeEach(() => {
    apiMocks.listProfiles.mockReset();
    apiMocks.activateProfile.mockReset();
    window.alert = vi.fn();
    document.body.innerHTML = `
      <section id="profiles-card" class="hidden">
        <div id="profiles-unattributed"></div>
        <div id="profiles-list"></div>
      </section>
    `;
    appStore.clear();
  });

  it("suppresses a previous commander's late profile overview", async () => {
    const alpha = deferred();
    apiMocks.listProfiles.mockReturnValueOnce(alpha.promise);
    appStore.setSnapshot({ commander_id: "alpha" });

    const pending = loadProfiles();
    appStore.setSnapshot({ commander_id: "beta" });
    alpha.resolve(overview("ALPHA PRIVATE", "alpha"));
    await pending;

    expect(document.body.textContent).not.toContain("ALPHA PRIVATE");

    apiMocks.listProfiles.mockResolvedValueOnce(overview("CMDR Beta", "beta"));
    await loadProfiles();
    expect(document.querySelector("#profiles-list").textContent).toContain("CMDR Beta");
  });

  it("disables offline profile selection while live and surfaces a raced 409", async () => {
    const data = overview("CMDR Alpha", "alpha");
    data.profiles.push({
      id: "beta",
      name: "CMDR Beta",
      galaxy_mode: "live",
      created_at: "2026-07-18T00:00:00Z",
      last_seen_at: "2026-07-18T11:00:00Z",
      active: false,
      tables: {},
      rows: 2,
    });
    apiMocks.listProfiles.mockResolvedValue(data);

    appStore.setSnapshot({ commander_id: "alpha", game_running: true });
    await loadProfiles();
    let activate = /** @type {HTMLButtonElement} */ (
      document.querySelector("#profiles-list button")
    );
    expect(activate.disabled).toBe(true);
    expect(activate.title).toContain("Close Elite Dangerous");

    appStore.setSnapshot({ commander_id: "alpha", game_running: false });
    await loadProfiles();
    activate = /** @type {HTMLButtonElement} */ (document.querySelector("#profiles-list button"));
    apiMocks.activateProfile.mockRejectedValueOnce(
      new Error("Close Elite Dangerous before viewing another commander."),
    );
    activate.click();
    await vi.waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(
        "Close Elite Dangerous before viewing another commander.",
      );
    });
  });
});
