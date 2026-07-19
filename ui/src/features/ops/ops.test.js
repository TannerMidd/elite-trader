import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStore } from "../../core/store.js";
import { validateOperationsDocument } from "./exchange.js";
import { alternativeReason } from "./planner.js";
import {
  configureOpsRuntime,
  formatOpsDuration,
  getOpsApi,
  getOpsState,
  loadOpsBoardId,
  opsActivityName,
  opsBoardStorageKey,
  resetOpsState,
  setActiveBoardId,
} from "./shared.js";

describe("OPS feature invariants", () => {
  beforeEach(() => {
    localStorage.clear();
    configureOpsRuntime({
      store: createStore({ commander_id: "alpha", commander: "Alpha" }),
      storage: localStorage,
      root: document,
    });
  });

  it("migrates the legacy board key into commander-scoped storage once", () => {
    localStorage.setItem("opsBoardId", "legacy-board");

    expect(loadOpsBoardId("alpha")).toBe("legacy-board");
    expect(localStorage.getItem("opsBoardId")).toBeNull();
    expect(localStorage.getItem("opsBoardId:v2:alpha")).toBe("legacy-board");
    expect(loadOpsBoardId("beta")).toBe("");
  });

  it("keeps board selection scoped to the current commander", () => {
    resetOpsState("alpha");
    setActiveBoardId("board-a");
    expect(localStorage.getItem(opsBoardStorageKey("alpha"))).toBe("board-a");

    resetOpsState("beta");
    expect(getOpsState().activeBoardId).toBe("");
  });

  it("preserves legacy duration and activity labels", () => {
    expect(formatOpsDuration(59)).toBe("59s");
    expect(formatOpsDuration(3_661)).toBe("1h 1m");
    expect(formatOpsDuration(Number.NaN)).toBe("—");
    expect(opsActivityName("surface_scan")).toBe("Surface Scan");
  });

  it("explains dependency and budget alternatives deterministically", () => {
    const dependency = { id: "dep", title: "Acquire permit" };
    const nodes = new Map([["dep", dependency]]);
    const task = { depends_on: ["dep"], estimated_minutes: 10 };

    expect(alternativeReason(task, { remaining_minutes: 20 }, new Set(), nodes)).toBe(
      "Its required bundle also includes Acquire permit.",
    );
    expect(alternativeReason(task, { remaining_minutes: 5 }, new Set(["dep"]), nodes)).toBe(
      "Needs about 10 minutes; 5 remain after selected work.",
    );
  });

  it("accepts only the supported operations exchange envelope", () => {
    const documentValue = {
      format: "frameshift.operations",
      version: 1,
      records: {
        boards: [{ id: "board-a", title: "Wing operation" }],
        objectives: [{ id: "objective-a", board_id: "board-a", payload: { wing: ["alpha"] } }],
      },
    };
    expect(validateOperationsDocument(documentValue)).toBe(documentValue);
    expect(() =>
      validateOperationsDocument({ format: "frameshift.operations", version: 2 }),
    ).toThrow("not a supported Frameshift operations export");
    expect(() => validateOperationsDocument(["frameshift.operations", 1])).toThrow(
      "not a supported Frameshift operations export",
    );
    expect(() =>
      validateOperationsDocument({
        format: "frameshift.operations",
        version: 1,
        records: { boards: ["not a board record"] },
      }),
    ).toThrow("not a supported Frameshift operations export");
    expect(() =>
      validateOperationsDocument({
        format: "frameshift.operations",
        version: 1,
        records: { boards: [{ id: "board-a", invalid: undefined }] },
      }),
    ).toThrow("not a supported Frameshift operations export");
  });

  it("retains the injectable transport seam through the named operations client", async () => {
    const client = {
      json: vi.fn().mockResolvedValue({ timings: {} }),
    };
    configureOpsRuntime({ client });

    await getOpsApi().getTimings();

    expect(client.json).toHaveBeenCalledWith("/api/timings", { scope: "commander" });
  });
});
