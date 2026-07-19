import { appStore } from "./store.js";

export const SERVER_VERSION_HEADER = "X-Frameshift-Version";
const VERSION_STORAGE_KEY = "frameshift:server-version";
const VERSION_RELOAD_KEY = "frameshift:version-reload";

/**
 * Build a response observer that reloads the module graph once when the
 * running server version changes. The new version is stored before reloading,
 * so the first request after navigation cannot create a reload loop.
 *
 * @param {{
 *   storage?: Storage|null,
 *   reload?: () => void,
 * }} [dependencies]
 */
export function createServerVersionGuard(dependencies = {}) {
  let storage = dependencies.storage;
  if (storage === undefined) {
    try {
      storage = typeof sessionStorage === "undefined" ? null : sessionStorage;
    } catch {
      storage = null;
    }
  }
  const reload =
    dependencies.reload ??
    (() => {
      if (typeof window !== "undefined") window.location.reload();
    });

  /** @param {Response} response */
  return function observeServerVersion(response) {
    const nextVersion = response.headers.get(SERVER_VERSION_HEADER)?.trim();
    if (!nextVersion || !storage) return;
    try {
      const previousVersion = storage.getItem(VERSION_STORAGE_KEY);
      storage.setItem(VERSION_STORAGE_KEY, nextVersion);
      if (!previousVersion || previousVersion === nextVersion) return;

      const transition = `${previousVersion}->${nextVersion}`;
      if (storage.getItem(VERSION_RELOAD_KEY) === transition) return;
      storage.setItem(VERSION_RELOAD_KEY, transition);
      reload();
    } catch {
      // Storage policy must never make an otherwise valid API call fail.
    }
  };
}

/** A normalized expected API failure. */
export class HttpError extends Error {
  /**
   * @param {string} message
   * @param {{status?: number, payload?: unknown, url?: string}} [details]
   */
  constructor(message, details = {}) {
    super(message);
    this.name = "HttpError";
    this.status = details.status ?? 0;
    this.payload = details.payload ?? null;
    this.url = details.url ?? "";
  }
}

/** An async commander result that arrived after a profile handoff. */
export class StaleResponseError extends Error {
  constructor() {
    super("Commander changed while the request was in flight.");
    this.name = "StaleResponseError";
  }
}

/**
 * @typedef {"none"|"commander"} RequestScope
 */

/**
 * @typedef {RequestInit & {
 *   json?: unknown,
 *   scope?: RequestScope,
 * }} FrameshiftRequestInit
 *
 * @typedef {{
 *   blob: Blob,
 *   filename: string|null,
 *   contentType: string|null,
 *   serverVersion: string|null,
 * }} DownloadArtifact
 *
 * @typedef {{
 *   response: Response,
 *   url: string,
 *   identity: {commanderId: string|null, generation: number}|null,
 *   controller: AbortController|null,
 * }} RequestContext
 */

/**
 * @param {{
 *   fetchImpl?: typeof fetch,
 *   store?: typeof appStore,
 *   versionGuard?: (response: Response) => void,
 * }} [dependencies]
 */
export function createHttpClient(dependencies = {}) {
  const fetchImpl = dependencies.fetchImpl ?? globalThis.fetch;
  const store = dependencies.store ?? appStore;
  const versionGuard = dependencies.versionGuard ?? createServerVersionGuard();
  if (typeof fetchImpl !== "function") {
    throw new TypeError("A fetch implementation is required.");
  }
  /** @type {Set<AbortController>} */
  const scopedControllers = new Set();
  /** @type {string|null} */
  let currentServerVersion = null;

  store.onProfileChange(() => {
    for (const controller of scopedControllers) controller.abort();
    scopedControllers.clear();
  });

  /**
   * @param {string|URL} input
   * @returns {string}
   */
  function apiUrl(input) {
    const value = String(input);
    const base =
      typeof window === "undefined" ? "http://frameshift.local/" : window.location.origin;
    const url = new URL(value, base);
    const expectedOrigin = new URL(base).origin;
    if (url.origin !== expectedOrigin || !url.pathname.startsWith("/api/")) {
      throw new TypeError("HTTP client accepts same-origin /api/ URLs only.");
    }
    return `${url.pathname}${url.search}${url.hash}`;
  }

  /**
   * @param {RequestContext} context
   */
  function assertCurrent(context) {
    if (context.identity && !store.isCurrent(context.identity)) {
      throw new StaleResponseError();
    }
  }

  /**
   * @param {RequestContext} context
   * @param {unknown} error
   * @returns {never}
   */
  function throwContextError(context, error) {
    if (context.identity && !store.isCurrent(context.identity)) {
      throw new StaleResponseError();
    }
    throw error;
  }

  /**
   * @param {RequestContext} context
   */
  function finishRequest(context) {
    if (context.controller) scopedControllers.delete(context.controller);
  }

  /**
   * @param {string|URL} input
   * @param {FrameshiftRequestInit} [options]
   * @returns {Promise<RequestContext>}
   */
  async function beginRequest(input, options = {}) {
    const url = apiUrl(input);
    const scope = options.scope ?? "none";
    const identity = scope === "commander" ? store.identity() : null;
    if (scope === "commander" && !identity?.commanderId) {
      throw new HttpError("Wait for the commander profile before accessing local commander data.", {
        url,
      });
    }

    const controller = scope === "commander" ? new AbortController() : null;
    if (controller) scopedControllers.add(controller);

    const headers = new Headers(options.headers);
    if (identity?.commanderId) {
      headers.set("X-Frameshift-Commander", identity.commanderId);
    }
    let body = options.body;
    if (Object.hasOwn(options, "json")) {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(options.json);
    }

    try {
      const response = await fetchImpl(url, {
        ...options,
        body,
        cache: "no-store",
        credentials: "same-origin",
        headers,
        signal: controller?.signal ?? options.signal,
      });
      currentServerVersion =
        response.headers.get(SERVER_VERSION_HEADER)?.trim() || currentServerVersion;
      versionGuard(response);
      /** @type {RequestContext} */
      const context = { response, url, identity, controller };
      assertCurrent(context);
      return context;
    } catch (error) {
      if (controller) scopedControllers.delete(controller);
      if (identity && !store.isCurrent(identity)) {
        throw new StaleResponseError();
      }
      throw error;
    }
  }

  /**
   * Low-level callers receive a headers-ready response. Typed body helpers
   * below deliberately retain the commander request until consumption ends.
   *
   * @param {string|URL} input
   * @param {FrameshiftRequestInit} [options]
   * @returns {Promise<Response>}
   */
  async function request(input, options = {}) {
    const context = await beginRequest(input, options);
    try {
      assertCurrent(context);
      return context.response;
    } finally {
      finishRequest(context);
    }
  }

  /**
   * @param {Response} response
   * @param {string} url
   * @returns {Promise<never>}
   */
  async function throwResponseError(response, url) {
    /** @type {unknown} */
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    const message =
      payload && typeof payload === "object" && typeof Reflect.get(payload, "error") === "string"
        ? String(Reflect.get(payload, "error"))
        : `Frameshift request failed (${response.status}).`;
    throw new HttpError(message, { status: response.status, payload, url });
  }

  /**
   * @template T
   * @param {string|URL} input
   * @param {FrameshiftRequestInit} [options]
   * @returns {Promise<T>}
   */
  async function json(input, options = {}) {
    const context = await beginRequest(input, options);
    try {
      const { response, url } = context;
      if (!response.ok) await throwResponseError(response, url);
      const value =
        response.status === 204 ? null : await /** @type {Promise<T>} */ (response.json());
      assertCurrent(context);
      return /** @type {T} */ (value);
    } catch (error) {
      throwContextError(context, error);
    } finally {
      finishRequest(context);
    }
  }

  /**
   * @param {string|URL} input
   * @param {FrameshiftRequestInit} [options]
   * @returns {Promise<Blob>}
   */
  async function blob(input, options = {}) {
    const context = await beginRequest(input, options);
    try {
      const { response, url } = context;
      if (!response.ok) await throwResponseError(response, url);
      const value = await response.blob();
      assertCurrent(context);
      return value;
    } catch (error) {
      throwContextError(context, error);
    } finally {
      finishRequest(context);
    }
  }

  /**
   * @param {string|null} value
   * @returns {string|null}
   */
  function downloadFilename(value) {
    if (!value) return null;
    const encoded = value.match(/filename\*\s*=\s*UTF-8''([^;]+)/i)?.[1];
    if (encoded) {
      try {
        return decodeURIComponent(encoded.trim().replace(/^"|"$/g, ""));
      } catch {
        // Fall back to the plain filename parameter below.
      }
    }
    const plain = value.match(/filename\s*=\s*(?:"([^"]+)"|([^;]+))/i);
    return (plain?.[1] ?? plain?.[2] ?? "").trim() || null;
  }

  /**
   * @param {string|URL} input
   * @param {FrameshiftRequestInit} [options]
   * @returns {Promise<DownloadArtifact>}
   */
  async function download(input, options = {}) {
    const context = await beginRequest(input, options);
    try {
      const { response, url } = context;
      if (!response.ok) await throwResponseError(response, url);
      const value = {
        blob: await response.blob(),
        filename: downloadFilename(response.headers.get("Content-Disposition")),
        contentType: response.headers.get("Content-Type"),
        serverVersion: response.headers.get(SERVER_VERSION_HEADER),
      };
      assertCurrent(context);
      return value;
    } catch (error) {
      throwContextError(context, error);
    } finally {
      finishRequest(context);
    }
  }

  /**
   * @param {string|URL} input
   * @param {FrameshiftRequestInit} [options]
   * @returns {Promise<string>}
   */
  async function text(input, options = {}) {
    const context = await beginRequest(input, options);
    try {
      const { response, url } = context;
      if (!response.ok) await throwResponseError(response, url);
      const value = await response.text();
      assertCurrent(context);
      return value;
    } catch (error) {
      throwContextError(context, error);
    } finally {
      finishRequest(context);
    }
  }

  function serverVersion() {
    return currentServerVersion;
  }

  return Object.freeze({ request, json, blob, download, text, serverVersion });
}

export const http = createHttpClient();
