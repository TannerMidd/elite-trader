/**
 * @typedef {[number, number, number, number?, number?]} PricePoint
 * @typedef {Record<string, PricePoint[]>} PriceSeriesMap
 * @typedef {{
 *   name?: string,
 *   category?: string,
 *   symbol?: string,
 *   sell?: number,
 *   buy?: number,
 *   demand?: number,
 *   stock?: number,
 *   prev_sell?: number|null,
 *   prev_buy?: number|null,
 * }} MarketItem
 * @typedef {{
 *   market_id?: string|number|null,
 *   station?: string|null,
 *   is_current_station?: boolean,
 *   items?: MarketItem[],
 * }} MarketSnapshot
 * @typedef {{system?: string, dist?: number|null, timestamp?: string|number|null}} JumpEntry
 */

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isUnknownRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** @param {unknown} value @returns {number|undefined} */
function optionalNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/** @param {unknown} value @returns {string|undefined} */
function optionalString(value) {
  return typeof value === "string" ? value : undefined;
}

/** @param {unknown} value @returns {PricePoint|null} */
function normalizePricePoint(value) {
  if (!Array.isArray(value) || value.length < 3) return null;
  const timestamp = Number(value[0]);
  const sell = Number(value[1]);
  const buy = Number(value[2]);
  if (![timestamp, sell, buy].every(Number.isFinite)) return null;
  const demand = Number(value[3]);
  const stock = Number(value[4]);
  if (value.length >= 5 && Number.isFinite(demand) && Number.isFinite(stock)) {
    return [timestamp, sell, buy, demand, stock];
  }
  if (value.length >= 4 && Number.isFinite(demand)) {
    return [timestamp, sell, buy, demand];
  }
  return [timestamp, sell, buy];
}

/** @param {unknown} value @returns {PriceSeriesMap} */
export function normalizePriceSeries(value) {
  if (!isUnknownRecord(value)) return {};
  /** @type {PriceSeriesMap} */
  const series = {};
  for (const [symbol, candidate] of Object.entries(value)) {
    if (!Array.isArray(candidate)) continue;
    const points = candidate.flatMap((point) => {
      const normalized = normalizePricePoint(point);
      return normalized ? [normalized] : [];
    });
    if (points.length) series[symbol] = points;
  }
  return series;
}

/** @param {unknown} value @returns {MarketItem|null} */
function normalizeMarketItem(value) {
  if (!isUnknownRecord(value)) return null;
  return {
    name: optionalString(value.name),
    category: optionalString(value.category),
    symbol: optionalString(value.symbol),
    sell: optionalNumber(value.sell),
    buy: optionalNumber(value.buy),
    demand: optionalNumber(value.demand),
    stock: optionalNumber(value.stock),
    prev_sell: optionalNumber(value.prev_sell) ?? null,
    prev_buy: optionalNumber(value.prev_buy) ?? null,
  };
}

/** @param {unknown} value @returns {MarketSnapshot|null} */
export function normalizeMarketSnapshot(value) {
  if (!isUnknownRecord(value)) return null;
  const marketId =
    typeof value.market_id === "string" || typeof value.market_id === "number"
      ? value.market_id
      : null;
  const items = Array.isArray(value.items)
    ? value.items.flatMap((item) => {
        const normalized = normalizeMarketItem(item);
        return normalized ? [normalized] : [];
      })
    : [];
  return {
    market_id: marketId,
    station: typeof value.station === "string" ? value.station : null,
    is_current_station:
      typeof value.is_current_station === "boolean" ? value.is_current_station : false,
    items,
  };
}

/** @param {unknown} value @returns {JumpEntry[]} */
export function normalizeJumpEntries(value) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    if (!isUnknownRecord(candidate)) return [];
    const system = optionalString(candidate.system)?.trim();
    if (!system) return [];
    const distance = optionalNumber(candidate.dist) ?? optionalNumber(candidate.distance) ?? null;
    const rawTimestamp = candidate.timestamp ?? candidate.ts;
    const timestamp =
      typeof rawTimestamp === "string" || typeof rawTimestamp === "number" ? rawTimestamp : null;
    return [{ system, dist: distance, timestamp }];
  });
}
