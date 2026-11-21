/* 库存页的同步小件：分类 / 区块需要补货的数、选中条文字、可见物品、视图切换（别处的点击处理要立刻用到返回值）。 */
import { inSpace } from "../core/util.js";
import { openShopFor } from "../core/logic.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";
import { VIEW_KEY, invSorter, invSpaces, rowMatch } from "./inv-sync-common.js";
import { matchItem } from "./inventory-match.js";

export function setInvView(v) { try { localStorage.setItem(VIEW_KEY, v === "cats" ? "cats" : "rows"); } catch { /* 忽略 */ } }
/** 多选时底部的操作条：已选几项、全选、加入购物车、不提醒、删除 */
export function selBarText() { const n = state.invSel?.size || 0; return n ? t("已选 {n} 项", { n }) : t("点行来选"); }
/** 某个容器里，按当前筛选要补货、还不在购物车里的物品（「全部加入购物车」用） */
/** 分类视图：某个大类里，按当前筛选要补货、还不在购物车里的物品 */
export function catNeed(cat) { return state.enriched.filter((x) => x.category === cat && matchItem(x, { ...state.filter, cat, sub: "all" }) && x.status !== "ok" && !openShopFor(x.id)).sort(invSorter("default")); }
export function secNeed(space) { return state.enriched.filter((x) => inSpace(space)(x) && rowMatch(x) && x.status !== "ok" && !openShopFor(x.id)).sort(invSorter("default")); }
/** 当前筛选下看得见的物品（全选用） */
export function visibleItemIds() {
  return state.enriched.filter((x) => inSpace(state.filter.space || "pantry")(x) && rowMatch(x)).map((x) => x.id);
}
