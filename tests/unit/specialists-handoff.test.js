import { expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  getSnapshot: vi.fn(),
}));

vi.mock("../../ui/src/api/specialists.js", () => ({
  specialistsApi: {
    getSnapshot: apiMocks.getSnapshot,
  },
}));

import { appStore } from "../../ui/src/core/store.js";
import { loadSpecialists, resetSpecialists } from "../../ui/src/features/specialists/index.js";
import { specialistsView } from "../../ui/src/features/views/specialists.js";

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

it("does not commit a previous commander's late specialist snapshot", async () => {
  const parsed = new DOMParser().parseFromString(specialistsView, "text/html");
  document.body.replaceChildren(...parsed.body.children);
  appStore.clear();
  appStore.setSnapshot({ commander_id: "alpha" });
  resetSpecialists(appStore.getSnapshot());

  const response = deferred();
  apiMocks.getSnapshot.mockReturnValueOnce(response.promise);
  const pending = loadSpecialists();

  appStore.setSnapshot({ commander_id: "beta" });
  response.resolve({
    commander_id: "alpha",
    mining: {
      active: false,
      session: {
        active: false,
        started_ts: 1,
        duration_s: 1,
        refined_t: 0,
        refined: [],
        cargo_yield: [{ symbol: "ore", name: "ALPHA PRIVATE YIELD", count: 1 }],
        prospected_materials: [],
        limpets: {},
        attributed_revenue_cr: 0,
        net_after_limpet_cash_cr: 0,
      },
      last_cargo: {},
    },
    combat: {
      active: false,
      session: null,
      target: null,
      readiness: { score: 0, level: "", checklist: {}, ammo: {} },
      synthesis_lifetime: {},
    },
    carrier: {},
    exobiology: {},
  });
  await pending;

  expect(document.body.textContent).not.toContain("ALPHA PRIVATE YIELD");
});
