/* 库存页的同步小件：分类 / 区块需要补货的数、选中条文字、可见物品、视图切换（别处的点击处理要立刻用到返回值）。 */
import { STATUS, state } from "../core/state.js";
import { compare } from "../core/i18n.js";
import { num } from "../core/util.js";
import { matchItem } from "./inventory-match.js";
import { stockedAt } from "./stocked.js";

/* ── 库存 · 物品视图（2026-11-14，默认）：日常消耗品、汽车房屋消耗品两个大容器，里面每件物品一行，不按分类分组。
 *   点这一行进编辑；行里能直接改数量 / 单位、点 🔔 设成不提醒；手机上左滑删除、右滑加入购物车。
 *   右上「物品 / 分类」切换到原来的分类视图；选择记在本机。 ── */
export const VIEW_KEY = "hmh-inv-view";
/** 物品视图里的几个容器：日常消耗品，开着的话再加汽车房屋消耗品、家居耐用品 */
export const invSpaces = () => ["pantry", ...(state.houseEnabled ? ["house"] : []), ...(state.gearEnabled ? ["gear"] : [])];
/** 物品视图的筛选：分类（从概览货架点进来）+ 搜索 / 状态 / 位置；小类不用 */
export const rowMatch = (it) => matchItem(it, { ...state.filter, sub: "all" });
/** 同一分类内的排序：默认缺货 / 少货在前；其余按名称、数量、保质期、更新时间 */
export const invSorter = (mode) => ({
  name: (a, b) => compare(a.name, b.name),
  qty: (a, b) => num(a.qty) - num(b.qty) || compare(a.name, b.name),
  exp: (a, b) => (a.expiry_date || "9999").localeCompare(b.expiry_date || "9999") || compare(a.name, b.name),
  stocked: (a, b) => stockedAt(b) - stockedAt(a) || compare(a.name, b.name),
  updated: (a, b) => String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || "")),
}[mode] || ((a, b) => STATUS[a.status].rank - STATUS[b.status].rank || compare(a.name, b.name)));
