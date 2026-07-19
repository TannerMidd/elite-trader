import { http } from "../core/http.js";
import { withQuery } from "./query.js";

/** @import {CargoRecoveryRequest, CargoRecoveryResponse, CargoSellQuery, CargoSellResponse, ColonisationSourcesResponse, CommodityListResponse, CommoditySearchQuery, CommoditySearchResponse, DataSaleStationsResponse, ExobiologyGeneraResponse, InterstellarFactorsResponse, MiningHotspotsResponse, MiningQuery, MiningResponse, PriceHistoryResponse, StationMarketResponse, StationSearchQuery, StationSearchResponse, SuggestionResponse, TradeRouteRequest, TradeRouteResponse} from "./contracts/market.js" */

/** @param {typeof http} [client] */
export function createMarketApi(client = http) {
  /** @returns {Promise<CommodityListResponse>} */
  function listCommodities() {
    return client.json("/api/commodities");
  }

  /**
   * @param {string} kind
   * @param {string} query
   * @returns {Promise<SuggestionResponse>}
   */
  function suggest(kind, query) {
    return client.json(withQuery("/api/suggest", { kind, q: query }));
  }

  /** @param {CommoditySearchQuery} query @returns {Promise<CommoditySearchResponse>} */
  function searchCommodities(query) {
    return client.json(withQuery("/api/commodity-search", query), {
      scope: "commander",
    });
  }

  /** @param {TradeRouteRequest} request @returns {Promise<TradeRouteResponse>} */
  function findTradeRoute(request) {
    return client.json("/api/trade-route", {
      method: "POST",
      json: request,
      scope: "commander",
    });
  }

  /** @param {MiningQuery} query @returns {Promise<MiningResponse>} */
  function findMiningLocations(query) {
    return client.json(withQuery("/api/mining", query), {
      scope: "commander",
    });
  }

  /**
   * @param {string} mineral
   * @param {string} [system]
   * @returns {Promise<MiningHotspotsResponse>}
   */
  function findMiningHotspots(mineral, system) {
    return client.json(withQuery("/api/mining/hotspots", { mineral, system }), {
      scope: "commander",
    });
  }

  /** @param {string|number} marketId @returns {Promise<StationMarketResponse>} */
  function getStationMarket(marketId) {
    return client.json(withQuery("/api/station-market", { market_id: marketId }));
  }

  /** @param {string|number} marketId @returns {Promise<PriceHistoryResponse>} */
  function getPriceHistory(marketId) {
    return client.json(withQuery("/api/price-history", { market_id: marketId }));
  }

  /** @param {StationSearchQuery} query @returns {Promise<StationSearchResponse>} */
  function searchStations(query) {
    return client.json(withQuery("/api/station-search", query), {
      scope: "commander",
    });
  }

  /**
   * @param {boolean} includeCarriers
   * @param {string} [system]
   * @returns {Promise<DataSaleStationsResponse>}
   */
  function findDataSaleStations(includeCarriers, system) {
    return client.json(withQuery("/api/sell-data", { carriers: includeCarriers ? 1 : 0, system }), {
      scope: "commander",
    });
  }

  /** @param {string} [system] @returns {Promise<InterstellarFactorsResponse>} */
  function findInterstellarFactors(system) {
    return client.json(withQuery("/api/interstellar-factors", { system }), {
      scope: "commander",
    });
  }

  /** @param {CargoSellQuery} query @returns {Promise<CargoSellResponse>} */
  function findCargoBuyers(query) {
    return client.json(withQuery("/api/cargo-sell", query), { scope: "commander" });
  }

  /** @param {CargoRecoveryRequest} request @returns {Promise<CargoRecoveryResponse>} */
  function recoverCargo(request) {
    return client.json("/api/cargo-recovery", {
      method: "POST",
      json: request,
      scope: "commander",
    });
  }

  /**
   * @param {string|number} marketId
   * @param {number} [radius]
   * @returns {Promise<ColonisationSourcesResponse>}
   */
  function findColonisationSources(marketId, radius = 50) {
    return client.json(withQuery("/api/colonisation-sources", { market_id: marketId, radius }), {
      scope: "commander",
    });
  }

  /** @returns {Promise<ExobiologyGeneraResponse>} */
  function listExobiologyGenera() {
    return client.json("/api/exobio-genera");
  }

  return Object.freeze({
    listCommodities,
    suggest,
    searchCommodities,
    findTradeRoute,
    findMiningLocations,
    findMiningHotspots,
    getStationMarket,
    getPriceHistory,
    searchStations,
    findDataSaleStations,
    findInterstellarFactors,
    findCargoBuyers,
    recoverCargo,
    findColonisationSources,
    listExobiologyGenera,
  });
}

export const marketApi = createMarketApi();
