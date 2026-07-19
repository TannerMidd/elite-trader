import { requireById } from "../../core/dom.js";
import { persistForm } from "../../core/form-persistence.js";
import { copyText } from "../../core/clipboard.js";
import { findCargoSell } from "../colonisation.js";
import {
  initSuggest,
  searchCommodity,
  sortCommodityTable,
  sortableHeaders,
} from "../commodities.js";
import { seedDb } from "../database.js";
import { marketSort, renderMarket } from "../market.js";
import { toggleExpandedMarketSymbol } from "../market-state.js";
import { searchMining, sortMiningTable } from "../mining.js";
import { findInterstellarFactors, findSellPoints, loadoutSlef } from "../services.js";
import { searchStations, sortStationTable } from "../stations.js";
import { loadSystemStations } from "../system-stations.js";

let initialized = false;

/** Own market/search forms, sorting, and result-table delegation. */
export function initializeMarketControls() {
  if (initialized) return;
  initialized = true;

  const marketHeaders = /** @type {NodeListOf<HTMLTableCellElement>} */ (
    document.querySelectorAll("#market-table th")
  );
  marketHeaders.forEach((header) => {
    header.addEventListener("click", () => {
      const key = header.dataset.sort;
      if (!key) return;
      marketSort.dir = marketSort.key === key ? -marketSort.dir : key === "name" ? 1 : -1;
      marketSort.key = key;
      document
        .querySelectorAll("#market-table th")
        .forEach((candidate) => candidate.classList.toggle("sorted", candidate === header));
      renderMarket();
    });
  });
  requireById("market-filter").addEventListener("input", renderMarket);
  requireById("market-table").addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const cell = event.target.closest(".spark-click");
    if (!(cell instanceof HTMLElement)) return;
    toggleExpandedMarketSymbol(cell.dataset.sym);
    renderMarket();
  });

  requireById("cs-form").addEventListener("submit", searchCommodity);
  sortableHeaders("cs-table", sortCommodityTable);
  initSuggest();
  requireById("mining-form").addEventListener("submit", searchMining);
  sortableHeaders("mining-table", sortMiningTable);
  requireById("os-form").addEventListener("submit", searchStations);
  sortableHeaders("os-table", sortStationTable);
  requireById("cargo-sell-btn").addEventListener("click", findCargoSell);
  requireById("sd-form").addEventListener("submit", findSellPoints);
  requireById("iff-form").addEventListener("submit", findInterstellarFactors);
  requireById("build-slef").addEventListener(
    "click",
    (event) => loadoutSlef && copyText(loadoutSlef, event.currentTarget),
  );
  requireById("ss-form").addEventListener("submit", loadSystemStations);
  requireById("seed-btn").addEventListener("click", seedDb);

  // "Near" overrides intentionally reset on launch so stale locations never
  // silently survive a new session.
  persistForm("cs-form", "csForm", ["cs-query", "cs-mode", "cs-radius", "cs-min", "cs-largepad"]);
  persistForm("mining-form", "miningForm", ["mn-radius", "mn-minprice", "mn-age", "mn-largepad"]);
  persistForm("os-form", "osForm", ["os-query", "os-type"]);
  persistForm("sd-form", "sellDataForm", ["sd-carriers"]);
}
