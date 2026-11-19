/* 财务 → 账单概览的「当前范围」状态：从网址 / 本机记忆读出时间范围和筛选、改范围。启动时就要用（路由解析、刷新），概览页本身（overview-views.js）点开才加载。 */
import { BILL_RANGES } from "./instances.js";
import { state } from "../core/state.js";

const RANGE_KEY = "hmh-bills-range";
/** 范围记在本机（独立于花费 / 收入共用的时间条）；资产不记，每次进来都是全部资产 */
export function loadOverviewRange() {
  try { const v = localStorage.getItem(RANGE_KEY); if (v && BILL_RANGES.some(([k]) => k === v)) state.ovFilter.range = v; } catch { /* 忽略 */ }
}
/** 网址是 #/bills/overview/<资产键>（房屋 / 车辆页的「账单」入口、面包屑第三级、下拉里选一个）→ 按那个资产筛，时间默认本月（可用 ?range= 改；在页面里换资产保持当前范围）；没带资产 = 全部资产 + 上次选的范围。旧的 ?asset=… 也认 */
export function applyOverviewQuery(q, id = null) {
  const a = id || q?.get("asset"), r = q?.get("range");
  if (a && /^(property:|asset:|person:)[\w-]+$|^(vehicle|medical|pet|project|legal|travel|general)$/.test(a)) {
    state.ovFilter.asset = a; state.ovFilter.range = r && BILL_RANGES.some(([k]) => k === r) ? r : state.ovFilter.keepRange ? state.ovFilter.range : "m"; state.ovFilter.keepRange = false;
  } else { state.ovFilter.asset = "all"; loadOverviewRange(); if (r && BILL_RANGES.some(([k]) => k === r)) state.ovFilter.range = r; }
}
export const applyOverviewRoute = (r) => { if (r?.section === "bills" && r.sub === "overview") applyOverviewQuery(r.q, r.id); };
export function setOverviewRange(v) { state.ovFilter.range = v; try { localStorage.setItem(RANGE_KEY, v); } catch { /* 忽略 */ } }
