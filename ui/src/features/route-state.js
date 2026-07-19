import { appStore } from "../core/store.js";

/**
 * @typedef {{system: string, note?: string}} RouteWaypoint
 * @typedef {{
 *   kind: string,
 *   label: string,
 *   waypoints: RouteWaypoint[],
 *   index: number,
 * }} ActiveRoute
 * @typedef {{
 *   route: ActiveRoute,
 *   complete: boolean,
 *   next: RouteWaypoint|null,
 * }} RouteSync
 */

/** @type {ActiveRoute|null} */
let activeRoute = null;
/** @type {string|null} */
let activeRouteCommander = null;
let routeFormTouched = false;

/** @param {unknown} [snapshot] */
export function profileStorageId(snapshot = appStore.getSnapshot()) {
  if (!snapshot || typeof snapshot !== "object") return null;
  const value = String(Reflect.get(snapshot, "commander_id") ?? "").trim();
  return value || null;
}

/** @param {string} commanderId */
export function activeRouteKey(commanderId) {
  return `activeRoute:v2:${encodeURIComponent(commanderId)}`;
}

/** @param {unknown} value @returns {ActiveRoute|null} */
function normalizeActiveRoute(value) {
  if (!value || typeof value !== "object") return null;
  const rawWaypoints = Reflect.get(value, "waypoints");
  if (!Array.isArray(rawWaypoints)) return null;
  const waypoints = rawWaypoints.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const system = String(Reflect.get(candidate, "system") ?? "").trim();
    if (!system) return [];
    const note = String(Reflect.get(candidate, "note") ?? "").trim();
    return [{ system, ...(note ? { note } : {}) }];
  });
  if (!waypoints.length) return null;
  const rawIndex = Number(Reflect.get(value, "index"));
  return {
    kind: String(Reflect.get(value, "kind") ?? "route"),
    label: String(Reflect.get(value, "label") ?? "Tracked route"),
    waypoints,
    index: Math.max(0, Math.min(waypoints.length, Number.isFinite(rawIndex) ? rawIndex : 0)),
  };
}

/** @returns {ActiveRoute|null} */
export function getActiveRoute() {
  return activeRoute;
}

/** @returns {string|null} */
export function getActiveRouteCommander() {
  return activeRouteCommander;
}

export function clearRouteWorkspace() {
  activeRoute = null;
  activeRouteCommander = null;
  routeFormTouched = false;
}

/** @param {string|null|undefined} commanderId @param {Storage} [storage] */
export function loadActiveRoute(commanderId, storage = localStorage) {
  activeRouteCommander = commanderId || null;
  activeRoute = null;
  if (!commanderId) return;
  const key = activeRouteKey(commanderId);
  try {
    let raw = storage.getItem(key);
    if (raw == null) {
      raw = storage.getItem("activeRoute");
      if (raw != null) {
        storage.setItem(key, raw);
        storage.removeItem("activeRoute");
      }
    }
    activeRoute = normalizeActiveRoute(JSON.parse(raw || "null"));
  } catch {
    activeRoute = null;
  }
}

/** @param {Storage} [storage] */
export function saveActiveRoute(storage = localStorage) {
  const commanderId = profileStorageId();
  if (!commanderId || activeRouteCommander !== commanderId) return;
  const key = activeRouteKey(commanderId);
  if (activeRoute) storage.setItem(key, JSON.stringify(activeRoute));
  else storage.removeItem(key);
}

/**
 * @param {string} kind
 * @param {string} label
 * @param {RouteWaypoint[]|null|undefined} waypoints
 */
export function startActiveRoute(kind, label, waypoints) {
  const normalized = normalizeActiveRoute({ kind, label, waypoints, index: 0 });
  const commanderId = profileStorageId();
  if (!normalized || !commanderId) return null;
  activeRouteCommander = commanderId;
  activeRoute = normalized;
  return activeRoute;
}

/** @param {number} delta */
export function changeActiveRouteIndex(delta) {
  if (!activeRoute) return null;
  activeRoute.index = Math.max(
    0,
    Math.min(activeRoute.waypoints.length, activeRoute.index + delta),
  );
  return activeRoute;
}

export function clearActiveRoute() {
  activeRoute = null;
}

/** @param {unknown} currentSystem @returns {RouteSync|null} */
export function syncActiveRoute(currentSystem) {
  const route = activeRoute;
  if (!route) return null;
  const system = String(currentSystem ?? "")
    .trim()
    .toLowerCase();
  if (!system) return null;
  let reached = -1;
  route.waypoints.forEach((waypoint, index) => {
    if (index >= route.index && waypoint.system.trim().toLowerCase() === system) {
      reached = index;
    }
  });
  if (reached < 0 || reached + 1 <= route.index) return null;
  route.index = reached + 1;
  const complete = route.index >= route.waypoints.length;
  return {
    route,
    complete,
    next: complete ? null : (route.waypoints[route.index] ?? null),
  };
}

export function markRouteFormTouched() {
  routeFormTouched = true;
}

export function routeFormWasTouched() {
  return routeFormTouched;
}

appStore.onProfileChange(clearRouteWorkspace);
