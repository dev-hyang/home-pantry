/* 路由：hashchange 处理、离开表单页自动保存、滚动位置。 */
import { $, toast } from "../core/util.js";
import { FD } from "../core/clear-filters.js";
import { Store } from "../core/store.js";
import { applyAllQuery, defaultAllEntry } from "../bills/all-views.js";
import { dirtyFields } from "./unsaved.js";
import { financeOk } from "../core/finance-access.js";
import { href, isFormSection, parseRoute, routeKey } from "../core/router.js";
import { inc } from "../income/logic.js";
import { normRange, setFinRange } from "../core/time-range.js";
import { refresh, resetListPages } from "./data.js";
import { render } from "./render.js";
import { focusEntry } from "./entry-focus.js";
import { resetScan, saveAssetForm, saveBillForm, saveItemForm } from "./lazy-modules.js";
import { resetSectionFilters } from "./page-events.js";
import { saveHouseForm } from "./actions/house-form.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";
import { applyOverviewQuery } from "../bills/overview-state.js";
import { resetFamilyUi } from "../settings/family-lite.js";
import { hydrateModelSelect } from "./lazy-modules.js";
import { ensureFirstYear } from "../stats/spend-roll.js";
import { applySpendDrill } from "../stats/spend-drill.js";

/** 录入购物（2026-11-15 起在 储藏 / 录入购物，#/pantry/scan） */
export const isScanRoute = (r) => r?.section === "pantry" && r?.sub === "scan";
const scrollMem = {};
/** 归档 / 删除默认房产前：先把默认换成另一套在用的房产；没有别的就不让做（至少留一套） */
export async function freeDefault(p) {
  if (!p.is_default) return true;
  const other = state.properties.find((x) => x.id !== p.id && !x.archived);
  if (!other) { toast(t("至少要保留一套房产")); return false; }
  await Store.setDefaultProperty(other.id); return true;
}
const isListRoute = (r) => (r.section === "pantry" && (r.sub === "inventory" || r.sub === "gear"));
/* 离开表单页自动保存：物品 / 设备 / 账单 / 房屋资料表单（data-autosave）有没保存的改动，且不是点“取消 / 保存 / 删除”离开的，
 * 就在后台按原来的校验保存一遍（名称没填等校验不过会提示“没有自动保存”）。保存按钮仍然保留，且在底部常驻。 */
const AUTOSAVE = { itemForm: saveItemForm, assetForm: saveAssetForm, billForm: saveBillForm, houseForm: saveHouseForm };
let lastHash = location.hash;
function pendingAutosave() {
  const f = $("#main form[data-autosave]");
  const want = f && AUTOSAVE[f.id] && !f.dataset.afPending && !state.skipAutosave && lastHash !== location.hash && dirtyFields(f);
  state.skipAutosave = false; lastHash = location.hash;
  return want ? f : null;
}
async function autoSave(f) {
  try { if (await AUTOSAVE[f.id](f, { silent: true })) { toast(t("已自动保存")); refresh(); } }
  catch (e) { toast(t("自动保存失败：{msg}", { msg: e.message })); }
}
function onRoute() {
  const prev = state.route, next = parseRoute();
  const fromHash = lastHash;   // 进表单页之前的网址：枢纽页“返回账单 / 返回设备”直接跳回去（history.back 会掉进刚看过的分区页）
  const pend = pendingAutosave();
  if (pend) autoSave(pend);   // 后台保存；表单元素脱离页面后仍能读值
  scrollMem[routeKey(prev)] = window.scrollY;
  const enteringItem = isFormSection(next) && !isFormSection(prev);
  const leavingItem = isFormSection(prev) && !isFormSection(next);
  if (enteringItem) { state.prevRoute = prev; state.prevHash = fromHash; }
  if (next.section === "house" && next.sub === "profile" && !(prev.section === "house" && prev.sub === "profile")) state.houseDraft = null;
  // 房产页面目录 → 账单清单带 ?prop=：进入时按那套房产筛选一次（只在这里套用，之后芯片可以切换）
  // ?prop=all：首页快捷操作进来，每次都回到“全部房产”
  if (next.section === "bills" && next.q.get("prop") && (next.q.get("prop") === "all" || state.properties.some((p) => p.id === next.q.get("prop")))) state.billsFilter.property = next.q.get("prop");
  // 首页提醒带 ?prop=：切到那套房产再进页面
  const wantProp = next.section === "house" ? next.q.get("prop") : null;
  if (wantProp && wantProp !== state.propertyId && state.properties.some((p) => p.id === wantProp)) {
    state.propertyId = wantProp; try { localStorage.setItem("hmh-property", wantProp); } catch { /* 忽略 */ }
    state.houseDraft = null; state.route = next; refresh(); return;
  }
  // 手动点了底部页签：恢复该页签的默认筛选（浏览器后退不会设这个标记，筛选照旧）
  if (state.tabReset) { if (next.section === state.tabReset) resetSectionFilters(next.section); state.tabReset = null; }
  // 注意事项：每次进来都回到“全部”来源和默认排序（从首页格子、链接或后退进来都一样）
  if (next.section === "alerts" && prev.section !== "alerts") resetSectionFilters("alerts");
  // 从目录或别的页进库存类清单：默认回到全部分类（从物品编辑页返回、或概览方块指定了分类时保留）
  if (isListRoute(next) && routeKey(prev) !== routeKey(next) && !isFormSection(prev)) {
    if (state.keepFilter) state.keepFilter = false;
    else Object.assign(state.filter, { cat: "all", status: "all", q: "", loc: "all", owner: "all", ownerScope: false, added: "all", addKind: "all", aud: "all" });
  }
  // 从首页看板 / 别的页点进其他清单页（购物车、设备、账单、缴费记录、医疗、花费）：筛选回到默认再套上链接里的条件
  // （从物品 / 设备 / 账单编辑页返回、或同一页内换标签 / 参数不算）；不然上一次留下的筛选（如「家人认领」）会让看板上的数字和清单对不上
  if (routeKey(prev) !== routeKey(next) && !isFormSection(prev)) {
    const { section: sec, sub } = next;
    if (sec === "shopping" && sub === "list") Object.assign(state.shopFilter, FD.shop);
    else if (sec === "house" && sub === "assets") Object.assign(state.assetFilter, FD.asset);
    else if (sec === "bills" && sub === "all") Object.assign(state.allFilter, FD.all, { sort: "due" });
    else if (sec === "bills" && sub === "spend") Object.assign(state.spendFilter, { q: "", cat: "all", store: "all", stores: null, grp: null, year: "all", mon: "all", months: null, dmax: null, batch: null });
  }
  // 账单概览：每次进来（含同一页上换了网址参数）都按网址套一次：带 ?asset= → 那个资产 + 本月；不带 → 全部资产 + 上次选的范围
  if (next.section === "me" && next.sub === "settings" && prev.section === "me" && prev.sub === "settings" && prev.q.get("person") !== next.q.get("person")) resetFamilyUi();
  if (next.section === "bills" && next.sub === "overview") applyOverviewQuery(next.q, next.id);
  // 全部账单：卡片 / 链接带的条件（?asset= ?status= ?range= ?q= ?type= ?cat= ?pay= ?sort=）每次进来套一次
  if (next.section === "bills" && next.sub === "all") { if (routeKey(prev) !== routeKey(next) && !isFormSection(prev)) defaultAllEntry(next.q); applyAllQuery(next.q); }
  // 房产 / 车辆的消耗品页「看全部」带 ?owner= 进库存：套上归属筛选，再把参数去掉
  if (isListRoute(next) && next.q.get("owner")) {
    Object.assign(state.filter, { owner: next.q.get("owner"), ownerScope: true, space: next.q.get("space") === "house" ? "house" : state.filter.space });
    next.q.delete("owner"); history.replaceState(null, "", `${href(next.section, next.sub)}${next.q.toString() ? `?${next.q}` : ""}`);
  }
  // 概览卡片里的细项（缺货 / 少货 …）带 ?status= 进库存：套上状态筛选，再把参数去掉（刷新、后退不重复套）
  if (isListRoute(next) && next.q.get("status")) {
    Object.assign(state.filter, { space: next.q.get("space") === "house" ? "house" : next.sub === "gear" ? "gear" : next.q.get("space") === "pantry" ? "pantry" : "all", cat: "all", q: "", loc: "all", status: next.q.get("status") });
    next.q.delete("status"); history.replaceState(null, "", `${href(next.section, next.sub)}${next.q.toString() ? `?${next.q}` : ""}`);
  }
  // 概览的「最近入库 / 新物品」卡片带 ?added=7&kind=new 进库存：套上入库时间范围、按最近入库排序，再把参数去掉
  if (isListRoute(next) && next.q.get("added")) {
    const ad = next.q.get("added"), kd = next.q.get("kind");
    Object.assign(state.filter, { space: next.q.get("space") === "house" ? "house" : next.q.get("space") === "pantry" ? "pantry" : "all", cat: "all", q: "", loc: "all", status: "all", added: ["7", "30", "90"].includes(ad) ? ad : "all", addKind: kd === "new" || kd === "restock" ? kd : "all", aud: "all", sort: "stocked" });
    next.q.delete("added"); next.q.delete("kind"); history.replaceState(null, "", `${href(next.section, next.sub)}${next.q.toString() ? `?${next.q}` : ""}`);
  }
  // 概览的「最常购买 / 花费最多」卡片带 ?sort= ?range= 进购买排行：套上排序和时间范围，再把参数去掉
  if (next.section === "pantry" && next.sub === "buys" && (next.q.get("sort") || next.q.get("range"))) {
    const u = (state.buysUi ||= { range: "90", sort: "count", open: {} }), so = next.q.get("sort"), ra = next.q.get("range");
    if (["count", "spend", "recent", "rise", "deals"].includes(so)) u.sort = so;
    if (ra === "90" || ra === "365") u.range = ra;
    next.q.delete("sort"); next.q.delete("range"); history.replaceState(null, "", `${href(next.section, next.sub)}${next.q.toString() ? `?${next.q}` : ""}`);
  }
  if (isScanRoute(next) && !isScanRoute(prev)) resetScan();
  if (!(next.section === "pantry" && (next.sub === "inventory" || next.sub === "gear"))) state.invSel = null;
  if (!(next.section === "shopping" && next.sub === "list")) state.shopSel = null;   // 离开购物车：多选结束   // 离开库存：多选结束
  // 换了页面 / 页签 / 钻取参数：所有列表回到一页（从表单页返回原列表时保留，滚动位置才对得上）
  if ((routeKey(prev) !== routeKey(next) || prev.q?.toString() !== next.q.toString()) && !isFormSection(prev)) resetListPages();
  // 从图表 / 名称钻取来的：套上筛选，再把地址里的筛选参数去掉（刷新或再次进入不会重复套用）
  if (next.section === "bills" && next.sub === "spend" && next.q.get("tab") === "records" && applySpendDrill(next.q)) history.replaceState(null, "", `${href("bills", "spend")}?tab=records`);   // 明细按筛选直接查数据库（批次、往年都在），不用先把记录读进内存
  // 首页快捷操作「记一笔收入」：#/bills/income?tab=records&add=1 → 直接展开记收入表单，再把参数去掉（没有财务权限时 render 里的路由守卫照样挡住）
  if (next.section === "bills" && next.sub === "income" && next.q.get("add") && financeOk()) {
    Object.assign(inc(), { form: { rec: null }, scanOpen: false, _keep: true });
    next.q.delete("add"); next.q.delete("prop"); next.q.set("tab", "records");
    history.replaceState(null, "", `${href("bills", "income")}?tab=records`);
  }
  // 带 ?range= 进财务页（今日「钱 · 本月」→ 收支总览本月）：套用一次共享的时间范围
  if (next.section === "bills" && next.q.get("range") && routeKey(prev) !== routeKey(next)) { const v = normRange(next.q.get("range")); if (v === next.q.get("range")) { state.stats.months = v; setFinRange(v); } }
  state.route = next;
  render(true);
  if (next.section === "house" && next.q.get("todo")) requestAnimationFrame(() => $("#house-todo")?.scrollIntoView({ block: "start" }));   // 今日「家里一览 · 设备与车辆」：直接到「各房产要处理的事」
  if (next.section === "me" && next.sub === "settings" && next.q.get("sec") === "ai") hydrateModelSelect();   // AI 设置：后台查这个 key 实际能用的模型，填进下拉
  if (next.section === "bills" && (next.sub === "spend" || next.sub === "budget")) ensureFirstYear().then((fresh) => { if (fresh) render(false); });   // 时间范围下拉的往年选项：查一次最早年份
  const back = leavingItem && state.prevRoute && routeKey(state.prevRoute) === routeKey(next);
  if (leavingItem) state.prevRoute = null;
  if (back) requestAnimationFrame(() => window.scrollTo(0, scrollMem[routeKey(next)] || 0));
  else { window.scrollTo(0, 0); if (!enteringItem) $("#main").focus({ preventScroll: true }); }
  focusEntry(next);   // 表单页：光标放到第一个要填的格子（页面是懒加载的，加载完 render.js 会再调一次）
  // 表单页保存后回到枢纽（仍在同一 section）也要刷新，枢纽上的完成度才是新的
  if (state.needsRefresh) { state.needsRefresh = false; refresh(); }
}
// 滚动位置由我们自己记忆和恢复，关闭浏览器的自动恢复以免互相干扰
if ("scrollRestoration" in history) history.scrollRestoration = "manual";
window.addEventListener("hashchange", onRoute);
window.addEventListener("spend-data-loaded", () => render(false));
window.addEventListener("hmh-rerender", () => render(false));
