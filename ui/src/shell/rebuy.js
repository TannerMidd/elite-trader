/** @import {ApplicationState} from "../api/contracts/state.js" */
import { compactCredits } from "../core/fmt.js";
import { appStore } from "../core/store.js";

/**
 * @param {HTMLElement|null} element
 * @param {ApplicationState|null} [snapshot]
 */
export function renderRebuy(
  element,
  snapshot = /** @type {ApplicationState|null} */ (appStore.getSnapshot()),
) {
  if (!element) return;
  if (!snapshot?.rebuy) {
    element.textContent = "—";
    element.classList.remove("bad", "low");
    return;
  }
  element.textContent = `${compactCredits(snapshot.rebuy)} cr`;
  const credits = snapshot.credits;
  const coveredOnce = credits != null && credits >= snapshot.rebuy;
  const coveredTwice = credits != null && credits >= snapshot.rebuy * 2;
  element.classList.toggle("bad", credits != null && !coveredOnce);
  element.classList.toggle("low", coveredOnce && !coveredTwice);
  element.title =
    credits == null
      ? "Your ship's insurance cost"
      : !coveredOnce
        ? "REBUY NOT COVERED — you cannot afford to lose this ship"
        : !coveredTwice
          ? "Less than 2 rebuys in the bank"
          : "Insurance covered";
}
