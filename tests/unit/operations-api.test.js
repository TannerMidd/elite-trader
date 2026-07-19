import { describe, expect, it, vi } from "vitest";

import { createOperationsApi, isStaleOperationsError } from "../../ui/src/api/operations.js";
import { StaleResponseError } from "../../ui/src/core/http.js";

function clientStub() {
  return {
    json: vi.fn().mockResolvedValue({}),
    blob: vi.fn(),
    download: vi.fn().mockResolvedValue({
      blob: new Blob(["payload"]),
      filename: "frameshift-operations.json",
      contentType: "application/json",
      serverVersion: "test",
    }),
    text: vi.fn(),
    request: vi.fn(),
    serverVersion: vi.fn(),
  };
}

describe("operations API boundary", () => {
  it("owns objective query and identifier encoding", async () => {
    const client = clientStub();
    const api = createOperationsApi(client);

    await api.listObjectives({ statuses: ["open", "blocked"] });
    await api.updateObjective("objective / 7", { status: "done" });
    await api.dismissObjective("objective / 7");

    expect(client.json).toHaveBeenNthCalledWith(1, "/api/objectives?statuses=open%2Cblocked", {
      scope: "commander",
    });
    expect(client.json).toHaveBeenNthCalledWith(2, "/api/objectives/objective%20%2F%207", {
      method: "PATCH",
      json: { status: "done" },
      scope: "commander",
    });
    expect(client.json).toHaveBeenNthCalledWith(3, "/api/objectives/objective%20%2F%207", {
      method: "DELETE",
      scope: "commander",
    });
  });

  it("separates board collection, detail, and record mutations", async () => {
    const client = clientStub();
    const api = createOperationsApi(client);

    await api.listBoards();
    await api.getBoard("board alpha");
    await api.createRecord({ action: "reserve", board_id: "board alpha" });
    await api.updateRecord("reservations", "record / 9", { status: "fulfilled" });
    await api.removeRecord("reservations", "record / 9");

    expect(client.json).toHaveBeenNthCalledWith(1, "/api/operations", {
      scope: "commander",
    });
    expect(client.json).toHaveBeenNthCalledWith(2, "/api/operations?board_id=board+alpha", {
      scope: "commander",
    });
    expect(client.json).toHaveBeenNthCalledWith(3, "/api/operations", {
      method: "POST",
      json: { action: "reserve", board_id: "board alpha" },
      scope: "commander",
    });
    expect(client.json).toHaveBeenNthCalledWith(
      4,
      "/api/operations/reservations/record%20%2F%209",
      {
        method: "PATCH",
        json: { status: "fulfilled" },
        scope: "commander",
      },
    );
    expect(client.json).toHaveBeenNthCalledWith(
      5,
      "/api/operations/reservations/record%20%2F%209",
      {
        method: "DELETE",
        scope: "commander",
      },
    );
  });

  it("keeps exchange transport and payload shape behind named methods", async () => {
    const client = clientStub();
    const api = createOperationsApi(client);
    const documentValue = { format: "frameshift.operations", version: 1 };

    await expect(api.exportBoards("board alpha")).resolves.toMatchObject({
      filename: "frameshift-operations.json",
      contentType: "application/json",
    });
    await api.importBoards(documentValue);

    expect(client.download).toHaveBeenCalledWith("/api/operations/export?board_id=board+alpha", {
      scope: "commander",
    });
    expect(client.json).toHaveBeenCalledWith("/api/operations/import", {
      method: "POST",
      json: { document: documentValue },
      scope: "commander",
    });
  });

  it("exposes stale-response classification without leaking transport types into OPS", () => {
    expect(isStaleOperationsError(new StaleResponseError())).toBe(true);
    expect(isStaleOperationsError(new Error("network unavailable"))).toBe(false);
  });
});
