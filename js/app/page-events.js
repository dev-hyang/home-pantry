/* 页面级的小事件：切页签清筛选、各页「清除筛选」按钮、新账单创建后的跳转、切语言。 */
import { $, fillUnitList, listRoute, toast } from "../core/util.js";
import { FD, changed, clearUrlParams, onClearFilters } from "../core/clear-filters.js";
import { clearSpendFilter, renderSpendRecords } from "../stats/views.js";
import { go, href } from "../core/router.js";
import { maintFilter } from "../house/assets-logic.js";
import { refresh, resetListPages } from "./data.js";
import { render } from "./render.js";
import { renderLogin } from "./auth/login.js";
import { saveStatToggles } from "./actions/stats-prefs.js";
import { setFinRange, setFinUnit } from "../core/time-range.js";
import { setLang, t } from "../core/i18n.js";
import { setTodayPref } from "../today.js";
import { state } from "../core/state.js";

   // 异步读完（备份页的文件夹 / 云端列表）后重画一次   // 对比用的前一段花费从云端读回来了

/* ── 底部页签：点别的页签 = 进入该页签首页并恢复默认筛选（多套房产时账单回“全部房产”）；浏览器后退不走这里，筛选照旧。
 * 当前页签：点一下就回该页签首页并恢复默认筛选、回到顶部。 */
export function resetSectionFilters(section) {
  switch (section) {
    case "today": setTodayPref({ source: null }); break;
    case "alerts": setTodayPref({ source: null, mine: false, focus: false, mode: "severity" }); break;
    case "pantry": Object.assign(state.filter, { space: "pantry", cat: "all", q: "", status: "all", loc: "all", sort: "default" }); Object.assign(state.shopFilter, { st: "open", cat: "all", q: "", sort: "new" }); state.catSort = false; state.catForm = null; state.mealShift = 0; state.slotShift = null; break;
    case "house": Object.assign(state.filter, { cat: "all", q: "", status: "all", loc: "all" }); Object.assign(state.assetFilter, { q: "", type: "all", service: "all", warranty: "all", loc: "all", sort: "alert" }); state.dealFilter = "all"; state.dealStage = "all"; state.dealActFilter = "all"; state.tasksOnlyUndone = false; state.catSort = false; state.catForm = null; state.tasksYM = null; state.seasonForm = null; state.closeout = null; state.editProperty = null; state.deleteProperty = null; break;
    case "bills": state.spendAddOpen = false; state.ovFilter.asset = "all"; Object.assign(state.allFilter, FD.all, { sort: "due" }); Object.assign(state.billsFilter, { property: "all", cat: "all", autopay: "all", channel: "all", q: "", sort: "category" }); Object.assign(state.medFilter, { q: "", kind: "all", patient: "all", provider: "all", status: "all", year: "all" }); Object.assign(state.payFilter, { bill: "all", year: "all", status: "all", sort: "new" }); Object.assign(state.spendFilter, { q: "", cat: "all", store: "all", stores: null, grp: null, year: "all", mon: "all", months: null, dmax: null, batch: null, sort: "new" }); state.spendEdit = null; state.spendSel = null; break;
    case "me": Object.assign(state.stats, { month: null, cat: null, itemId: null }); state.editProperty = null; state.deleteProperty = null; state.locForm = null; break;
    default: break;
  }
}
/* ── 清除筛选（各页工具条上同一个按钮，js/core/clear-filters.js）：恢复这一页的默认筛选（排序不动）、分页回到第一页、网址里的筛选参数去掉 ── */
const clearAnd = (fn) => () => { fn(); resetListPages(); render(false); };
onClearFilters("inv", clearAnd(() => { Object.assign(state.filter, FD.inv); clearUrlParams(["cat", "status"]); }), () => changed(state.filter, FD.inv));
onClearFilters("shop", clearAnd(() => Object.assign(state.shopFilter, FD.shop)), () => changed(state.shopFilter, FD.shop));
onClearFilters("maint", clearAnd(() => Object.assign(maintFilter, FD.maint)), () => changed(maintFilter, FD.maint));
onClearFilters("asset", clearAnd(() => Object.assign(state.assetFilter, FD.asset)), () => changed(state.assetFilter, FD.asset));
onClearFilters("deal", clearAnd(() => { state.dealFilter = "all"; state.dealStage = "all"; state.dealActFilter = "all"; }));
   // 排序不动
// 新建账单完成（向导 / AI 扫描）：先把数据读回来，再进这张账单的详情页（?new=1 = 显示「已创建」提示条；?ai=1 = 「AI 识别创建」）
document.addEventListener("bill-created", async (e) => {
  const { id, via, kind } = e.detail || {}; if (!id) return;
  state.skipAutosave = true; await refresh(); toast(via === "ai" ? t("已根据扫描创建账单，请核对") : t("已创建账单"));
  if (kind === "onetime") go(`${href("otbill", id)}?${via === "ai" ? "ai" : "new"}=1`, { replace: true });   // 一次性账单：进它自己的详情页（?new=1 已创建 / ?ai=1 由扫描创建）
  else go(`${href("bill", id)}?${via === "ai" ? "ai" : "new"}=1`, { replace: true });
});
onClearFilters("all", clearAnd(() => { Object.assign(state.allFilter, FD.all); clearUrlParams("*"); }), () => changed(state.allFilter, FD.all));
onClearFilters("spend", () => { clearSpendFilter("all"); resetListPages(); renderSpendRecords(); }, () => changed(state.spendFilter, FD.spend));
onClearFilters("stats", clearAnd(() => { Object.assign(state.stats, FD.stats); setFinRange(state.stats.months); setFinUnit("auto"); saveStatToggles(); clearUrlParams(["node", "month", "cat", "item"]); }));
onClearFilters("gift", clearAnd(() => Object.assign((state.giftFilter ||= { sort: "balance" }), FD.gift)));
onClearFilters("off", clearAnd(() => Object.assign((state.offFilter ||= { sort: "since" }), FD.off)), () => changed(state.offFilter, FD.off));
onClearFilters("alerts", clearAnd(() => setTodayPref({ source: null, mine: false })));
$("#tabs").addEventListener("click", (e) => {
  const a = e.target.closest("a[data-section]"); if (!a) return;
  const sec = a.dataset.section, root = a.getAttribute("href");
  if (a.getAttribute("aria-current") === "page") {   // 当前页签：点一下就回该页签首页，并恢复默认筛选、回到顶部
    e.preventDefault();
    resetSectionFilters(sec);
    if (location.hash === root) { render(true); window.scrollTo(0, 0); } else go(root);
    return;
  }
  state.tabReset = sec;   // 进入后在 onRoute 里恢复默认筛选
});
export const toList = (space) => href(...listRoute(space));
/** 切换语言后整页重画（登录页也要） */
export async function changeLang(code) {
  await setLang(code);
  fillUnitList();
  if (state.enriched) render(true);
  else if (document.body.classList.contains("gate")) renderLogin();
}
