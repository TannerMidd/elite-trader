import { describe, expect, it, vi } from "vitest";

import {
  HttpError,
  StaleResponseError,
  createHttpClient,
  createServerVersionGuard,
} from "../../../ui/src/core/http.js";
import { createStore } from "../../../ui/src/core/store.js";

function delayedJsonResponse(payload, status = 200) {
  let releaseBody = () => {
    throw new Error("Response body was released before consumption started.");
  };
  let bodyStartedResolve;
  const bodyStarted = new Promise((resolve) => {
    bodyStartedResolve = resolve;
  });
  let started = false;
  const body = new ReadableStream({
    pull(controller) {
      if (started) return;
      started = true;
      bodyStartedResolve();
      return new Promise((resolve) => {
        releaseBody = () => {
          controller.enqueue(new TextEncoder().encode(JSON.stringify(payload)));
          controller.close();
          resolve();
        };
      });
    },
  });
  return {
    bodyStarted,
    releaseBody: () => releaseBody(),
    response: new Response(body, {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  };
}

describe("HTTP client", () => {
  it("normalizes JSON requests and commander headers", async () => {
    const store = createStore({ commander_id: "alpha" });
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    const client = createHttpClient({ fetchImpl, store });

    await expect(
      client.json("/api/example", {
        method: "POST",
        json: { value: 1 },
        scope: "commander",
      }),
    ).resolves.toEqual({ ok: true });

    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe("/api/example");
    expect(options.cache).toBe("no-store");
    expect(options.credentials).toBe("same-origin");
    expect(options.headers.get("X-Frameshift-Commander")).toBe("alpha");
    expect(options.body).toBe('{"value":1}');
  });

  it("normalizes backend user-facing errors", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: "Try another system." }), {
          status: 422,
          headers: { "Content-Type": "application/json" },
        }),
    );
    const client = createHttpClient({ fetchImpl, store: createStore() });

    await expect(client.json("/api/example")).rejects.toMatchObject({
      name: "HttpError",
      message: "Try another system.",
      status: 422,
    });
  });

  it("preserves download filename, content type, and server version", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response("archive", {
          status: 200,
          headers: {
            "Content-Disposition": "attachment; filename*=UTF-8''support%20bundle.zip",
            "Content-Type": "application/zip",
            "X-Frameshift-Version": "2.5.0",
          },
        }),
    );
    const client = createHttpClient({
      fetchImpl,
      store: createStore(),
      versionGuard: vi.fn(),
    });

    const artifact = await client.download("/api/diagnostics/bundle", { method: "POST" });

    expect(artifact.filename).toBe("support bundle.zip");
    expect(artifact.contentType).toBe("application/zip");
    expect(artifact.serverVersion).toBe("2.5.0");
    expect(client.serverVersion()).toBe("2.5.0");
    await expect(artifact.blob.text()).resolves.toBe("archive");
  });

  it("reloads once per observed server-version transition", () => {
    const values = new Map();
    const storage = {
      getItem: vi.fn((key) => values.get(key) ?? null),
      setItem: vi.fn((key, value) => values.set(key, value)),
    };
    const reload = vi.fn();
    const observe = createServerVersionGuard({ storage, reload });
    const response = (version) =>
      new Response(null, { headers: { "X-Frameshift-Version": version } });

    observe(response("2.4.0"));
    observe(response("2.5.0"));
    observe(response("2.5.0"));

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("rejects cross-origin and non-API URLs", async () => {
    const client = createHttpClient({
      fetchImpl: vi.fn(),
      store: createStore(),
    });
    await expect(client.json("https://evil.example/steal")).rejects.toThrow(TypeError);
    await expect(client.json("/icon.svg")).rejects.toThrow(TypeError);
  });

  it("invalidates commander work across a profile handoff", async () => {
    const store = createStore({ commander_id: "alpha" });
    let finish;
    const responseReady = new Promise((resolve) => {
      finish = resolve;
    });
    const fetchImpl = vi.fn(() => responseReady);
    const client = createHttpClient({ fetchImpl, store });
    const pending = client.json("/api/scoped", { scope: "commander" });

    store.setSnapshot({ commander_id: "beta" });
    finish(
      new Response(JSON.stringify({ old: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(pending).rejects.toBeInstanceOf(StaleResponseError);
  });

  it("invalidates commander work when the profile changes after headers but before the body", async () => {
    const store = createStore({ commander_id: "alpha" });
    const delayed = delayedJsonResponse({ commander_id: "alpha", private: true });
    const client = createHttpClient({
      fetchImpl: vi.fn(async () => delayed.response),
      store,
    });

    const pending = client.json("/api/scoped", { scope: "commander" });
    await delayed.bodyStarted;
    store.setSnapshot({ commander_id: "beta" });
    delayed.releaseBody();

    await expect(pending).rejects.toBeInstanceOf(StaleResponseError);
  });

  it("prefers a stale-profile error when an error body completes after a handoff", async () => {
    const store = createStore({ commander_id: "alpha" });
    const delayed = delayedJsonResponse({ error: "Alpha-only failure detail." }, 409);
    const client = createHttpClient({
      fetchImpl: vi.fn(async () => delayed.response),
      store,
    });

    const pending = client.json("/api/scoped", { scope: "commander" });
    await delayed.bodyStarted;
    store.setSnapshot({ commander_id: "beta" });
    delayed.releaseBody();

    await expect(pending).rejects.toBeInstanceOf(StaleResponseError);
  });

  it("requires a commander for scoped requests", async () => {
    const client = createHttpClient({
      fetchImpl: vi.fn(),
      store: createStore(),
    });
    await expect(client.json("/api/scoped", { scope: "commander" })).rejects.toBeInstanceOf(
      HttpError,
    );
  });
});
