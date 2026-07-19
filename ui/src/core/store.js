/**
 * Observable application-state store.
 *
 * The server snapshot remains immutable by convention. Features subscribe to
 * snapshots, while commander/profile lifecycle changes have their own channel
 * so asynchronous work can be invalidated deterministically.
 */

/** @import {ApplicationState} from "../api/contracts/state.js" */

/**
 * @typedef {object} CommanderIdentity
 * @property {string|null} commanderId
 * @property {number} generation
 */

/**
 * @template T
 * @typedef {object} ProfileChange
 * @property {CommanderIdentity} previous
 * @property {CommanderIdentity} current
 * @property {T|null} snapshot
 */

/**
 * @template T
 * @typedef {(snapshot: T|null, previous: T|null) => void} SnapshotListener
 */

/**
 * @template T
 * @typedef {(change: ProfileChange<T>) => void} ProfileListener
 */

/**
 * Extract the stable commander discriminator used by the backend.
 *
 * @param {unknown} snapshot
 * @returns {string|null}
 */
export function commanderIdOf(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return null;
  const value = Reflect.get(snapshot, "commander_id");
  const commanderId = String(value ?? "").trim();
  return commanderId || null;
}

/**
 * @template T
 * @param {T|null} [initialSnapshot]
 */
export function createStore(initialSnapshot = null) {
  /** @type {T|null} */
  let snapshot = initialSnapshot;
  let generation = 0;
  /** @type {Set<SnapshotListener<T>>} */
  const snapshotListeners = new Set();
  /** @type {Set<ProfileListener<T>>} */
  const profileListeners = new Set();

  /** @returns {CommanderIdentity} */
  const identity = () =>
    Object.freeze({
      commanderId: commanderIdOf(snapshot),
      generation,
    });

  /**
   * Publish one complete `/api/state` image.
   *
   * @param {T} nextSnapshot
   * @returns {ProfileChange<T>|null}
   */
  function setSnapshot(nextSnapshot) {
    if (!nextSnapshot || typeof nextSnapshot !== "object") {
      throw new TypeError("A state snapshot must be a non-null object.");
    }

    const previousSnapshot = snapshot;
    const previousIdentity = identity();
    snapshot = nextSnapshot;
    const nextCommanderId = commanderIdOf(nextSnapshot);
    /** @type {ProfileChange<T>|null} */
    let profileChange = null;

    if (previousIdentity.commanderId !== nextCommanderId) {
      generation += 1;
      profileChange = Object.freeze({
        previous: previousIdentity,
        current: identity(),
        snapshot: nextSnapshot,
      });
      for (const listener of [...profileListeners]) listener(profileChange);
    }

    for (const listener of [...snapshotListeners]) {
      listener(snapshot, previousSnapshot);
    }
    return profileChange;
  }

  /**
   * Clear authenticated state and invalidate every commander-scoped request.
   *
   * @returns {ProfileChange<T>}
   */
  function clear() {
    const previousSnapshot = snapshot;
    const previousIdentity = identity();
    snapshot = null;
    generation += 1;
    const profileChange = Object.freeze({
      previous: previousIdentity,
      current: identity(),
      snapshot: null,
    });
    for (const listener of [...profileListeners]) listener(profileChange);
    for (const listener of [...snapshotListeners]) {
      listener(null, previousSnapshot);
    }
    return profileChange;
  }

  /**
   * @param {SnapshotListener<T>} listener
   * @param {{immediate?: boolean}} [options]
   * @returns {() => void}
   */
  function subscribe(listener, options = {}) {
    if (typeof listener !== "function") {
      throw new TypeError("A store subscriber must be a function.");
    }
    snapshotListeners.add(listener);
    if (options.immediate) listener(snapshot, null);
    return () => snapshotListeners.delete(listener);
  }

  /**
   * @param {ProfileListener<T>} listener
   * @returns {() => void}
   */
  function onProfileChange(listener) {
    if (typeof listener !== "function") {
      throw new TypeError("A profile subscriber must be a function.");
    }
    profileListeners.add(listener);
    return () => profileListeners.delete(listener);
  }

  /**
   * @param {CommanderIdentity|null|undefined} candidate
   * @returns {boolean}
   */
  function isCurrent(candidate) {
    if (!candidate) return false;
    const current = identity();
    return (
      candidate.generation === current.generation && candidate.commanderId === current.commanderId
    );
  }

  return Object.freeze({
    getSnapshot: () => snapshot,
    identity,
    isCurrent,
    setSnapshot,
    clear,
    subscribe,
    onProfileChange,
  });
}

/** @typedef {ReturnType<typeof createStore<ApplicationState>>} AppStore */

/** @type {AppStore} */
export const appStore = createStore();
