/** @import {StateAlert} from "../api/contracts/state.js" */

/**
 * Alert-owned mutable lifecycle. Keeping these values together prevents
 * unrelated features from using a generic application-state bag.
 *
 * @param {{
 *   schedule?: (handler: () => void, delay: number) => number,
 *   cancel?: (timer: number) => void,
 * }} [timers]
 */
export function createAlertState(timers = {}) {
  const schedule = timers.schedule ?? ((handler, delay) => window.setTimeout(handler, delay));
  const cancel = timers.cancel ?? ((timer) => window.clearTimeout(timer));

  /** @type {string|null} */
  let fuelSignature = null;
  let latestStateAlertId = 0;
  let stateAlertsInitialized = false;
  /** @type {number|null} */
  let flightToastTimer = null;
  /** @type {string|number|null} */
  let routeAlertTimestamp = null;
  /** @type {number|null} */
  let pollingTimer = null;

  /**
   * @param {string|null} next
   * @returns {boolean}
   */
  function observeFuelSignature(next) {
    if (next === fuelSignature) return false;
    fuelSignature = next;
    return true;
  }

  /**
   * @param {StateAlert[]} alerts
   * @returns {StateAlert[]}
   */
  function consumeStateAlerts(alerts) {
    const maximum = alerts.reduce((current, alert) => Math.max(current, Number(alert.id) || 0), 0);
    if (!stateAlertsInitialized) {
      stateAlertsInitialized = true;
      latestStateAlertId = maximum;
      return [];
    }
    const fresh = alerts
      .filter((alert) => Number(alert.id) > latestStateAlertId)
      .sort((left, right) => Number(left.id) - Number(right.id));
    if (fresh.length) latestStateAlertId = Math.max(latestStateAlertId, maximum);
    return fresh;
  }

  /**
   * @param {string|number|null} next
   * @returns {string|number|null}
   */
  function replaceRouteAlertTimestamp(next) {
    const previous = routeAlertTimestamp;
    routeAlertTimestamp = next;
    return previous;
  }

  /** @param {() => void} hide */
  function scheduleFlightToast(hide) {
    if (flightToastTimer !== null) cancel(flightToastTimer);
    flightToastTimer = schedule(() => {
      flightToastTimer = null;
      hide();
    }, 7000);
  }

  function cancelFlightToast() {
    if (flightToastTimer !== null) cancel(flightToastTimer);
    flightToastTimer = null;
  }

  /**
   * @param {() => void} poll
   * @param {number} [delay]
   */
  function schedulePoll(poll, delay = 15000) {
    cancelPoll();
    pollingTimer = schedule(() => {
      pollingTimer = null;
      poll();
    }, delay);
  }

  function cancelPoll() {
    if (pollingTimer !== null) cancel(pollingTimer);
    pollingTimer = null;
  }

  function reset() {
    cancelPoll();
    cancelFlightToast();
    fuelSignature = null;
    latestStateAlertId = 0;
    stateAlertsInitialized = false;
    routeAlertTimestamp = null;
  }

  return Object.freeze({
    observeFuelSignature,
    consumeStateAlerts,
    replaceRouteAlertTimestamp,
    scheduleFlightToast,
    cancelFlightToast,
    schedulePoll,
    cancelPoll,
    reset,
  });
}

export const alertState = createAlertState();
