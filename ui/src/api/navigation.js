import { http } from "../core/http.js";
import { withQuery } from "./query.js";

/** @import {CancelPlotResponse, ExobiologyRouteQuery, ExobiologyRouteResponse, NeutronRouteRequest, NeutronRouteResponse, PlotSystemRequest, PlotSystemResponse, RichesRouteRequest, RichesRouteResponse} from "./contracts/navigation.js" */

/** @param {typeof http} [client] */
export function createNavigationApi(client = http) {
  /** @param {PlotSystemRequest} request @returns {Promise<PlotSystemResponse>} */
  function plotSystem(request) {
    return client.json("/api/plot", { method: "POST", json: request });
  }

  /** @returns {Promise<CancelPlotResponse>} */
  function cancelPlot() {
    return client.json("/api/plot/cancel", { method: "POST" });
  }

  /** @param {RichesRouteRequest} request @returns {Promise<RichesRouteResponse>} */
  function planRichesRoute(request) {
    return client.json("/api/riches", {
      method: "POST",
      json: request,
      scope: "commander",
    });
  }

  /** @param {NeutronRouteRequest} request @returns {Promise<NeutronRouteResponse>} */
  function planNeutronRoute(request) {
    return client.json("/api/neutron", {
      method: "POST",
      json: request,
      scope: "commander",
    });
  }

  /** @param {ExobiologyRouteQuery} query @returns {Promise<ExobiologyRouteResponse>} */
  function findExobiologyRoute(query) {
    return client.json(withQuery("/api/exobio-route", query), {
      scope: "commander",
    });
  }

  return Object.freeze({
    plotSystem,
    cancelPlot,
    planRichesRoute,
    planNeutronRoute,
    findExobiologyRoute,
  });
}

export const navigationApi = createNavigationApi();
