/** @type {string|null} */
let expandedMarketSymbol = null;

/** @returns {string|null} */
export function getExpandedMarketSymbol() {
  return expandedMarketSymbol;
}

/**
 * Toggle the expanded history chart and return the resulting selection.
 *
 * @param {string|null|undefined} symbol
 * @returns {string|null}
 */
export function toggleExpandedMarketSymbol(symbol) {
  const next = String(symbol || "").trim() || null;
  expandedMarketSymbol = expandedMarketSymbol === next ? null : next;
  return expandedMarketSymbol;
}

export function clearExpandedMarketSymbol() {
  expandedMarketSymbol = null;
}
