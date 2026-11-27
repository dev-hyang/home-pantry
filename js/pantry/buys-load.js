/* 购买排行 / 概览卡片共用的数据：近 90 天、近 12 个月的购买记录各读一次（10 分钟内不重读；花费有变动时标过期）。
 * 读完发 spend-data-loaded，main 会重画当前页面（和财务统计同一个事件）。只读「对得上库存物品」的汇总在 buys-data.js。 */
import { state } from "../core/state.js";
import { Store } from "../core/store.js";
import { DAY } from "../core/util.js";
import { findItem } from "../core/item-match.js";
import { aggregateBuys } from "./buys-data.js";

export const RANGE_DAYS = { 90: 90, 365: 365 };
/* 失败也记时间（at）：10 分钟后再试，不会一直重读 */
const FRESH = 10 * 60e3, C = new Map();   // days → { groups, at, busy, err, stale }
window.addEventListener("spend-rows-changed", () => { for (const e of C.values()) e.stale = true; });
const cur = () => Units.region.currency;
function load(days, e) {
  e.busy = true; e.err = "";
  const to = new Date(Date.now() + DAY).toISOString(), from = new Date(Date.now() - days * DAY).toISOString();
  Store.listPurchasesRange(from, to)
    .then((rows) => { e.groups = aggregateBuys(rows, { items: state.items, resolve: (n) => findItem(n), cats: new Set(state.items.map((i) => i.category)), cur: cur() }); e.at = Date.now(); e.stale = false; })
    .catch((err) => { e.err = err?.message || String(err); e.groups = e.groups || []; e.at = Date.now(); })
    .finally(() => { e.busy = false; window.dispatchEvent(new Event("spend-data-loaded")); });
}
/** 汇总结果；还没读到返回 { groups: null, busy: true }，读完会重画 */
export function buysFor(days) {
  const key = `${Store.mode}|${Store.hid || ""}|${days}`; let e = C.get(key);
  if (!e) C.set(key, e = { groups: null });
  if (!e.busy && (!e.at || e.stale || Date.now() - e.at > FRESH)) load(days, e);
  return e;
}
