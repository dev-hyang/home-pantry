/* 购物车的同步小件：选中文字、单位、可见条目。 */
import { Store } from "../core/store.js";
import { compare } from "../core/i18n.js";
import { normName } from "../core/item-match.js";
import { state } from "../core/state.js";

export const isMine = (s) => Store.mode === "demo" || s.claimed_by === state.user?.id;
export const inState = (st) => (s) => (st === "all" ? true : st === "bought" ? s.status === "bought"
  : s.status !== "bought" && (st === "open" || (st === "todo" ? s.status === "todo" : s.status === "claimed" && (st === "claimed" || isMine(s)))));
/** 清单页的采购项：状态、分类、搜索（名称、谁认领的）筛选后排序；已买到按买到时间 */
export function shopRows() {
  const f = state.shopFilter, q = normName(f.q || "");
  const cats = new Map(state.items.map((i) => [i.id, i.category]).reverse());   // 建一次，筛选 / 排序时不再逐条查库存
  const catOfRow = (s) => cats.get(s.item_id) || s.category || "other";
  const rows = state.shopping.filter((s) => inState(f.st)(s) && (f.cat === "all" || catOfRow(s) === f.cat)
    && (!q || normName(`${s.name} ${s.claimed_by_name || ""}`).includes(q)));
  const date = (s) => String((s.status === "bought" && s.bought_at) || s.created_at || "");
  const sorter = { new: (a, b) => date(b).localeCompare(date(a)), old: (a, b) => date(a).localeCompare(date(b)), name: (a, b) => compare(a.name, b.name), cat: (a, b) => catOfRow(a).localeCompare(catOfRow(b)) || compare(a.name, b.name) }[f.sort] || (() => 0);
  return rows.sort(sorter);
}
