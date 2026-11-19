import { state } from "../core/state.js";
import { viewDeals } from "./shops-deals.js";
import { viewFind } from "./shops-find.js";
import { viewList } from "./shops-list.js";
import { viewRuns } from "./shops-runs.js";
import { viewShop } from "./shop-detail.js";
export { bindShops, shopsAction } from "./shops-actions.js";

export function viewShops() {
  const r = state.route;
  if (r.sub === "find") return viewFind();
  if (r.sub === "shop") return viewShop(r.id);
  if (r.sub === "log") return viewRuns();
  if (r.sub === "deals") return viewDeals();
  return viewList();
}
