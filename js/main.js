import { checkConfig } from "./core/config-check.js";
import { alertsOf, enrich, nameHas, openShopFor } from "./core/logic.js";
import { state } from "./core/state.js";
import { CloudStore, DemoStore, Store, setStore } from "./core/store.js";
import { $, armed, catOf, du, esc, fillUnitList, inSpace, listRoute, money, num, setSync, showQty, spaceOf, storedStep, toast } from "./core/util.js";
import { SECTIONS, go, href, isFormSection, parseRoute, routeKey } from "./core/router.js";
import { LANGS, glossaryOf, joinList, lang, loadOpenCC, locale, setGlossary, setLang, t } from "./core/i18n.js";
import { DEFAULT_QUICK, quickList, saveQuick, setTodayPref, shiftAlertSource, viewAlerts, viewToday } from "./today.js";
import { copyAnswer, copyGeneralPrompt, pickTopic, runAiPage, viewAi } from "./ai-page.js";
import { alertCounts, collectAlerts, registerAlerts, withProperty } from "./core/alerts.js";
import { pantryAlertItems } from "./core/logic.js";
import { assetAlertItems, startVehiclePurchase } from "./house/assets.js";
import { seasonAlertItems } from "./house/tasks.js";
import { completeVehicleDeal, dealAlertItems } from "./house/deals.js";
import { billAlertItems } from "./bills/logic.js";
// 提醒总线：各模块的适配器（新增提醒来源只需在这里注册一个函数）
[pantryAlertItems, billAlertItems, budgetAlertItems, escrowAlertItems, dealAlertItems, assetAlertItems, insuranceAlertItems, hoaAlertItems, seasonAlertItems].forEach(registerAlerts);
import { applyTypeDefaults, hoaAlertItems, houseDraft, insuranceAlertItems, readHouseForm, templateItems, viewHouse, viewHouseProfile, viewHouseTemplate } from "./house/views.js";
import { printSheet } from "./settings/print.js";
import { resetScan, scanAction, viewScan } from "./pantry/scan.js";
import { budgetAction, budgetAlertItems, groupForCategory, maybeAutoGenerate, viewBudget } from "./bills/budget.js";
import "./settings/income.js";
import { escrowAlertItems } from "./bills/escrow.js";
import "./bills/finance.js";
import { assetTemplateItems, enrichAssets, leaveAsset, renderAssetList, supplyItem, onAssetFormChange, onMaintFormChange, saveAssetForm, saveMaintForm, viewAssetForm, viewAssetTemplate, viewAssets, viewVehicles } from "./house/assets.js";
import { deleteSeasonTask, saveSeasonForm, seasonalSince, shiftTasksMonth, toggleTask, viewTasks } from "./house/tasks.js";
import { enrichBills } from "./bills/logic.js";
import { applyCloseout, cancelDeal, completeBuy, deleteCustomTask, openDeal, saveDealForm, saveDealTaskForm, startDeal, toggleDealTask, viewDeal } from "./house/deals.js";
import { renderBillList, renderPayList, billTemplateItems, exportBillsCsv, exportIcs, leaveBill, quickVerify, saveBillForm, saveBillPayForm, viewBillForm, viewBillTemplate, viewBillsHistory, viewBillsList, viewBillsOverview } from "./bills/views.js";
import { leaveItem, openItem, saveItemForm, subOptions, viewItemForm } from "./pantry/item-form.js";
import { moveCat, renderInvList, scoreRecipes, viewDashboard, viewInventory, viewMeals, viewShopping } from "./pantry/views.js";
import { viewSettings } from "./settings/views.js";
import { viewAbout } from "./settings/about.js";
import { crumb, viewMenu, viewPropertyList } from "./menu.js";
import { addAiMissing, copyPrompt, runAi } from "./pantry/ai.js";
import { applyCustomCategories, canonName, canonSubs, catFormOf, isCustomCat, newCatKey } from "./core/categories.js";
import { applyCustomLocations, customLocations, deleteLocation, groupOf, saveLocationForm } from "./core/locations.js";
import { aiReady, resetUsage, testModel } from "./core/ai.js";
import { saveAiForm } from "./settings/views.js";
import { cleanStore, download, exportAnnual, rememberStore, renderSpendList, storeDatalist, viewSpend, viewStats } from "./stats/views.js";

const APP_NAME = "爱家小助手";

/* ───────────── 刷新与渲染 ───────────── */
export let refreshing = null;
export async function refresh() {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      // 所有表一次并行读完（云端一轮往返），再在内存里定当前房产；采购花费只有统计和导出用，不挡首屏，渲染后后台再读
      const members = state.membersReady; state.membersReady = null;   // 登录后与这一轮并行去读家庭成员
      const [properties, items, logs, shopping, profiles, assets, maintLogs, seasonalDone, bills, billPayments, deals, dealDone, customCats, customLocs, dealExtras, customSeasonal, terms, budget, incomes] = await Promise.all([
        Store.listProperties(), Store.listItems(), Store.listLogs(), Store.listShopping(), Store.listHouseProfiles(),
        Store.listAssets(), Store.listMaintLogs(), Store.listSeasonal(seasonalSince()), Store.listBills(), Store.listBillPayments(),
        Store.listDeals(), Store.listDealDone(), Store.listCategories(), Store.listLocations(), Store.listDealExtras(),
        Store.listCustomSeasonal().catch((e) => { console.warn("[custom seasonal]", e.message); return []; }),   // 迁移还没执行时读不到：不影响其他功能
        Store.listTerms().catch((e) => { console.warn("[terms]", e.message); return null; }),
        Store.getBudget().catch(() => null),
        Store.listIncomes().catch((e) => { console.warn("[incomes]", e.message); return []; }),
        members]);
      state.budget = budget; state.incomes = incomes;
      state.customSeasonal = customSeasonal;
      if (terms) setGlossary(terms);   // 自定义名称的翻译
      state.properties = properties;
      const live = properties.filter((p) => !p.archived);
      let saved = null; try { saved = localStorage.getItem("hmh-property"); } catch { /* 忽略 */ }
      if (!live.some((p) => p.id === state.propertyId)) state.propertyId = (live.find((p) => p.id === saved) || live.find((p) => p.is_default) || live[0] || properties[0])?.id || null;
      const pid = state.propertyId;
      applyCustomCategories(customCats);   // 自定义分类并入全局分类表，后面的 enrich / 视图都能用
      applyCustomLocations(customLocs);    // 自定义 / 重命名的存放位置并入分组列表
      const houseProfiles = Object.fromEntries(profiles.map((p) => [p.property_id, p]));
      Object.assign(state, { items, logs, shopping, houseProfiles, houseProfile: pid ? houseProfiles[pid] || null : null, assets, maintLogs, seasonalDone, bills, billPayments, deals, dealDone, dealOverrides: dealExtras.overrides, dealCustom: dealExtras.custom });
      state.enriched = enrich(items, logs);
      state.assetsEnriched = enrichAssets(assets, maintLogs);
      state.billsEnriched = enrichBills(bills, billPayments);
      setSync(Store.mode === "demo" ? t("本地演示数据") : t("已同步 {time}", { time: new Date().toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" }) }));
      notifyIfNeeded();
      render(false);
      loadPurchasesSoon();
      maybeAutoGenerate();   // 家主有收入但还没预算：自动生成第一版
    } catch (e) {
      setSync(t("同步失败，点设置页重试"), true);
      toast(t("读取数据失败：{msg}", { msg: e.message }));
    } finally { refreshing = null; }
  })();
  return refreshing;
}

/** 采购花费（近 400 天，可能几千行）只有统计页和导出用：后台读，读完如果正停在统计页就重画 */
let purchasesLoading = false, purchasesAgain = false;
function loadPurchasesSoon() {
  if (purchasesLoading) { purchasesAgain = true; return; }
  purchasesLoading = true;
  Store.listPurchases().then((p) => {
    state.purchases = p;
    const r = state.route;
    if ((r.section === "me" && r.sub === "stats") || (r.section === "bills" && r.sub === "spend")) render(false);
    else { const dl = $("#storeList"); if (dl) dl.outerHTML = storeDatalist(); }   // 采购 / 统计页的商店联想
  }).catch((e) => console.warn("[purchases]", e.message))
    .finally(() => { purchasesLoading = false; if (purchasesAgain) { purchasesAgain = false; loadPurchasesSoon(); } });
}

export let debounceT;
export const refreshSoon = () => { clearTimeout(debounceT); debounceT = setTimeout(refresh, 400); };


/* ───────────── 页面与路由 ───────────── */
/** 库存页当前范围：?space=house 看房屋耗材（房屋模块关闭时只有厨房储藏） */
const invSpace = () => (state.houseEnabled && state.route.q.get("space") === "house" ? "house" : "pantry");
const VIEWS = {
  today:    () => viewToday(),
  alerts:   () => viewAlerts(),
  ai:       () => viewAi(),
  pantry:   { overview: viewDashboard, inventory: () => viewInventory(invSpace()), gear: () => viewInventory("gear"), meals: viewMeals },
  house:    { overview: viewHouse, supplies: () => viewInventory("house"), assets: viewAssets, tasks: viewTasks, vehicles: viewVehicles, deal: viewDeal, profile: viewHouseProfile, pages: () => viewMenu("house"),
              template: viewHouseTemplate, "asset-template": viewAssetTemplate },
  bills:    { overview: viewBillsOverview, list: viewBillsList, history: viewBillsHistory, spend: viewSpend, budget: viewBudget, template: viewBillTemplate },
  shopping: () => viewShopping(),
  scan:     () => viewScan(),
  me:       { stats: viewStats, settings: viewSettings, about: viewAbout },
};
// 正在填写的表单页：实时同步触发的刷新不重画，避免冲掉没保存的内容
const FORM_PAGES = (r) => isFormSection(r) || (r.section === "house" && r.sub === "profile");
// 二级页顶部的面包屑和每个页签的目录页在 js/menu.js（参考家庭学堂“我的”页：一栏一行，点进去）
const offPanel = (title, action, btn) => `<div class="panel empty"><strong>${title}</strong>${t("在“我的 → 设置”里可以重新打开。")}<p><button type="button" class="btn btn-primary" data-action="${action}">${btn}</button></p></div>`;

/** 顶部导航、站名按当前语言写入（index.html 里是简体默认值） */
function applyChrome() {
  document.querySelectorAll("#tabs a[data-section]").forEach((a) => {
    const textNode = [...a.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
    if (textNode) textNode.textContent = t(SECTIONS[a.dataset.section]?.name || textNode.textContent.trim());
  });
  const title = $("#appTitle"); if (title) title.textContent = t(APP_NAME);
  $("#tabs").setAttribute("aria-label", t("主导航"));
  renderAppSwitch();
  renderLangSwitch();
}

/* 顶栏右上角的语言快捷切换（登录页也显示）；和 设置 → 语言 存同一个值 */
const LANG_SHORT = [["zh", "简体"], ["zh-Hant", "繁體"], ["en", "EN"]];
function renderLangSwitch() {
  const box = $("#langSwitch"); if (!box) return;
  box.setAttribute("aria-label", t("切换语言"));
  box.innerHTML = LANG_SHORT.map(([k, l]) => `<button type="button" data-lang="${k}" aria-pressed="${lang === k}" title="${LANGS[k]}" aria-label="${LANGS[k]}">${l}</button>`).join("");
}
$("#langSwitch")?.addEventListener("click", (e) => {
  const b = e.target.closest("button[data-lang]"); if (!b || b.getAttribute("aria-pressed") === "true") return;
  changeLang(b.dataset.lang);
});

/* ───────────── 姐妹站点切换（与家庭学堂顶栏一致：站名旁「‹ 上一个」「下一个 ›」两枚小胶囊） ───────────── */
const APP_ID = "home-pantry";
export const sisterApps = () => window.SISTER_APPS || [];
function renderAppSwitch() {
  const box = $("#apps"); if (!box) return;
  const list = sisterApps(), i = list.findIndex((a) => a.id === APP_ID);
  if (list.length < 2 || i < 0) { box.innerHTML = ""; return; }
  const prev = list[(i - 1 + list.length) % list.length], next = list[(i + 1) % list.length];   // 三站循环，和另外两站的顺序一致
  const pill = (a, label) => `<a class="badge app" href="${esc(a.url)}" title="${esc(t("切到{name}", { name: t(a.name) }))}" aria-label="${esc(t("切到{name}", { name: t(a.name) }))}">${label}</a>`;
  box.setAttribute("aria-label", t("切换姐妹站点"));
  box.innerHTML = pill(prev, `‹ ${esc(t(prev.short))}`) + pill(next, `${esc(t(next.short))} ›`);
}

/** force=true：路由变化，整页重画；false：数据刷新，表单页保持不动 */
export function render(force = true) {
  if (!state.enriched) return;
  document.body.classList.remove("gate");
  applyChrome();
  $("#hhName").textContent = state.household?.name || "";
  const r = state.route;
  const navSection = r.section === "item" ? (state.prevRoute?.section || listRoute(spaceOf(state.editingCat))[0])
    : r.section === "asset" ? (state.prevRoute?.section || "house") : r.section === "bill" ? (state.prevRoute?.section || "bills")
    : r.section === "scan" ? "shopping" : r.section === "alerts" || r.section === "ai" ? "today" : r.section;   // 注意事项、小Y问都是首页的子页，底栏高亮「今日」
  document.querySelectorAll("#tabs a[data-section]").forEach((a) => {
    a.hidden = (a.dataset.section === "house" && !state.houseEnabled) || (a.dataset.section === "bills" && !state.billsEnabled);
    if (a.dataset.section === navSection) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  const openShop = state.shopping.filter((s) => s.status !== "bought").length;
  const sc = $("#shopCount"); sc.hidden = !openShop; sc.textContent = openShop;
  const alertN = alertCounts(collectAlerts()).important;   // 紧急 / 今天 / 尽快三档计入标题
  document.title = alertN ? `(${alertN}) ${t(APP_NAME)}` : t(APP_NAME);
  document.body.classList.toggle("editing", FORM_PAGES(r));

  if (!force && FORM_PAGES(r) && $("#main form")) return;
  if (!force && r.section === "scan") return;   // 录入购物：识别中 / 确认页的改动不被后台同步冲掉
  // 数据刷新（切回标签页、家人改动）会重画整页：先把内嵌表单里还没保存的改动记下来，画完再填回去，不让用户白填
  const kept = force ? [] : keepUnsaved(["#dealForm", "#dealTaskForm", "#seasonForm", "#closeoutForm", "#propertyForm", "#maintForm", "#billPayForm"]);
  try { renderBody(r); } finally { restoreUnsaved(kept); }
}
/** 表单里与渲染默认值不同的字段（用户正在填的）；没有改动返回 null */
function dirtyFields(f) {
  const vals = {};
  for (const el of f.elements) {
    if (!el.name) continue;
    if (el.type === "checkbox" || el.type === "radio") { if (el.checked !== el.defaultChecked) vals[el.name] = { checked: el.checked }; }
    else if (el.tagName === "SELECT") { const def = [...el.options].find((o) => o.defaultSelected)?.value ?? el.options[0]?.value; if (el.value !== def) vals[el.name] = { value: el.value }; }
    else if (el.value !== el.defaultValue) vals[el.name] = { value: el.value };
  }
  return Object.keys(vals).length ? vals : null;
}
function keepUnsaved(selectors) {
  return selectors.map((sel) => {
    const f = $(sel); if (!f || f.dataset.saved) return null;
    const vals = dirtyFields(f);
    return vals ? { sel, vals } : null;
  }).filter(Boolean);
}
function restoreUnsaved(kept) {
  for (const k of kept) {
    const f = $(k.sel); if (!f) continue;
    for (const [n, v] of Object.entries(k.vals)) { const el = f.elements[n]; if (!el) continue; if ("checked" in v) el.checked = v.checked; else el.value = v.value; }
    markDirty(f, true);
  }
}
/** 表单有未保存改动：显示“有未保存的修改”，保存按钮加粗提示 */
function markDirty(f, on) {
  f.classList.toggle("is-dirty", on);
  const note = f.querySelector(".dirty-note"); if (note) note.hidden = !on;
}
function renderBody(r) {
  if (r.section === "item") { $("#main").innerHTML = viewItemForm(); return; }
  if (r.section === "asset") { $("#main").innerHTML = viewAssetForm(); return; }
  if (r.section === "bill") { $("#main").innerHTML = viewBillForm(); return; }
  if (r.section === "house" && !state.houseEnabled) { $("#main").innerHTML = offPanel(t("房屋维护模块已关闭"), "house-enable", t("打开房屋维护")); return; }
  if (r.section === "bills" && !state.billsEnabled) { $("#main").innerHTML = offPanel(t("账单模块已关闭"), "bills-enable", t("打开账单")); return; }
  if (r.section === "pantry" && r.sub === "gear" && !state.gearEnabled) { $("#main").innerHTML = crumb(r) + offPanel(t("装备模块已关闭"), "gear-enable", t("打开装备")); return; }
  if (r.sub === "menu") { $("#main").innerHTML = r.section === "house" ? viewPropertyList() : viewMenu(r.section); return; }   // 页签目录页；房屋先列房产
  const v = VIEWS[r.section];
  const view = typeof v === "function" ? v : v[r.sub];
  $("#main").innerHTML = crumb(r) + view();
  if ((r.section === "pantry" && (r.sub === "inventory" || r.sub === "gear")) || (r.section === "house" && r.sub === "supplies")) renderInvList();
}

const scrollMem = {};
const isListRoute = (r) => (r.section === "pantry" && (r.sub === "inventory" || r.sub === "gear")) || (r.section === "house" && r.sub === "supplies");
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
    else Object.assign(state.filter, { cat: "all", status: "all", q: "", loc: "all" });
  }
  if (next.section === "scan" && prev.section !== "scan") resetScan();
  state.route = next;
  render(true);
  const back = leavingItem && state.prevRoute && routeKey(state.prevRoute) === routeKey(next);
  if (leavingItem) state.prevRoute = null;
  if (back) requestAnimationFrame(() => window.scrollTo(0, scrollMem[routeKey(next)] || 0));
  else { window.scrollTo(0, 0); if (!enteringItem) $("#main").focus({ preventScroll: true }); }
  if (next.section === "item") $("#itemForm")?.elements.name.focus({ preventScroll: true });
  if (next.section === "asset") {
    const mf = $("#maintForm[data-focus]");   // 从“记保养”进来：滚到保养记录表单
    if (mf) { mf.scrollIntoView({ block: "start" }); mf.elements.kind.focus({ preventScroll: true }); }
    else if (next.id === "new") $("#assetForm")?.elements.name.focus({ preventScroll: true });
  }
  if (next.section === "bill") {
    const pf = $("#billPayForm[data-focus]");   // 从“记缴费”进来：滚到缴费表单
    if (pf) { pf.scrollIntoView({ block: "start" }); pf.elements.amount.focus({ preventScroll: true }); }
    else if (next.id === "new") $("#billForm")?.elements.name.focus({ preventScroll: true });
  }
  // 表单页保存后回到枢纽（仍在同一 section）也要刷新，枢纽上的完成度才是新的
  if (state.needsRefresh) { state.needsRefresh = false; refresh(); }
}
// 滚动位置由我们自己记忆和恢复，关闭浏览器的自动恢复以免互相干扰
if ("scrollRestoration" in history) history.scrollRestoration = "manual";
window.addEventListener("hashchange", onRoute);

/* ── 底部页签：点别的页签 = 进入该页签首页并恢复默认筛选（多套房产时账单回“全部房产”）；浏览器后退不走这里，筛选照旧。
 * 当前页签：点一下就回该页签首页并恢复默认筛选、回到顶部。 */
function resetSectionFilters(section) {
  switch (section) {
    case "today": setTodayPref({ source: null }); break;
    case "alerts": setTodayPref({ source: null, mine: false, focus: false, mode: "severity" }); break;
    case "pantry": Object.assign(state.filter, { space: "pantry", cat: "all", q: "", status: "all", loc: "all", sort: "default" }); Object.assign(state.shopFilter, { cat: "all", who: "all", sort: "new" }); state.catSort = false; state.catForm = null; state.mealShift = 0; state.slotShift = null; break;
    case "house": Object.assign(state.filter, { cat: "all", q: "", status: "all", loc: "all" }); Object.assign(state.assetFilter, { q: "", type: "all", service: "all", warranty: "all", loc: "all", sort: "alert" }); state.dealFilter = "all"; state.tasksOnlyUndone = false; state.catSort = false; state.catForm = null; state.tasksYM = null; state.seasonForm = null; state.closeout = null; state.editProperty = null; state.deleteProperty = null; break;
    case "bills": Object.assign(state.billsFilter, { property: "all", cat: "all", autopay: "all", q: "", sort: "category" }); Object.assign(state.payFilter, { bill: "all", year: "all", status: "all", sort: "new", limit: 50 }); Object.assign(state.spendFilter, { q: "", cat: "all", store: "all", month: "all", sort: "new", limit: 20 }); break;
    case "me": Object.assign(state.stats, { months: 6, month: null, cat: null, itemId: null }); state.editProperty = null; state.deleteProperty = null; state.editMember = null; state.locForm = null; break;
    default: break;
  }
}
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

const toList = (space) => href(...listRoute(space));

/** 切换语言后整页重画（登录页也要） */
async function changeLang(code) {
  await setLang(code);
  fillUnitList();
  if (state.enriched) render(true);
  else if (document.body.classList.contains("gate")) renderLogin();
}

/* ───────────── 交互（事件委托） ───────────── */
export const main = $("#main");
/* 左右滑动换页：季节任务换月（.tasks-swipe）、注意事项换来源（.swipe-zone[data-swipe=alerts]）；横向够远、纵向很小才算 */
let swipe = null;
main.addEventListener("touchstart", (e) => { const z = e.target.closest(".tasks-swipe, .swipe-zone"); swipe = z && e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY, kind: z.dataset.swipe || "tasks" } : null; }, { passive: true });
main.addEventListener("touchend", (e) => {
  if (!swipe) return;
  const { x, y, kind } = swipe; swipe = null;
  const dx = e.changedTouches[0].clientX - x, dy = e.changedTouches[0].clientY - y;
  if (Math.abs(dx) < 60 || Math.abs(dy) > 50) return;
  if (kind === "alerts") { shiftAlertSource(dx < 0 ? 1 : -1); return render(); }
  if (!document.querySelector(".month-nav")) return;
  shiftTasksMonth(dx < 0 ? 1 : -1); render();
}, { passive: true });
main.addEventListener("input", (e) => {
  if (e.target.id === "invSearch") { state.filter.q = e.target.value; renderInvList(); }
  if (e.target.id === "spendSearch") { state.spendFilter.q = e.target.value; state.spendFilter.limit = 20; renderSpendList(); }
  if (e.target.id === "billSearch") { state.billsFilter.q = e.target.value; renderBillList(); }
  if (e.target.id === "assetSearch") { state.assetFilter.q = e.target.value; renderAssetList(); }
  const df = e.target.closest("#dealForm, #dealTaskForm, #closeoutForm, #propertyForm"); if (df) markDirty(df, true);   // 提示还没保存
});
main.addEventListener("change", async (e) => {
  if (e.target.matches("input[data-qty-for]")) return setShopQty(e.target.dataset.qtyFor, e.target.value);   // 采购清单：直接输入数量
  if (e.target.id === "invStatus") { state.filter.status = e.target.value; renderInvList(); }
  if (e.target.id === "invLoc") { state.filter.loc = e.target.value; renderInvList(); }
  if (e.target.id === "invSort") { state.filter.sort = e.target.value; renderInvList(); }
  if (e.target.id === "billCat") { state.billsFilter.cat = e.target.value; renderBillList(); }
  if (e.target.id === "billSort") { state.billsFilter.sort = e.target.value; renderBillList(); }
  { const k = { payBill: "bill", payYear: "year", payStatus: "status", paySort: "sort" }[e.target.id]; if (k) { state.payFilter[k] = e.target.value; state.payFilter.limit = 50; renderPayList(); } }
  { const k = { shopCat: "cat", shopWho: "who", shopSort: "sort" }[e.target.id]; if (k) { state.shopFilter[k] = e.target.value; render(); } }
  { const k = { assetType: "type", assetService: "service", assetWarranty: "warranty", assetLoc: "loc", assetSort: "sort" }[e.target.id]; if (k) { state.assetFilter[k] = e.target.value; renderAssetList(); } }
  if (e.target.name === "location" && e.target.form?.elements.new_location) {   // 选“＋ 新位置…”：旁边出现输入框
    const inp = e.target.form.elements.new_location, on = e.target.value === "__new__";
    inp.hidden = !on; if (on) inp.focus();
  }
  if (e.target.id === "alertSort") { setTodayPref({ mode: e.target.value }); return render(); }
  if (e.target.closest("#aiSettingsForm") && e.target.name === "provider") {   // 换服务商：清掉上一家残留的模型名 / 地址（否则会把请求发到别家 → 404），重画 key 说明、默认模型、免费额度
    const f = e.target.form; f.elements.model.value = ""; f.elements.base.value = "";
    await saveAiForm(f); return render();
  }
  if (e.target.closest("#itemForm") && e.target.name === "category") {
    const fe = e.target.form.elements;
    fe.subcategory.innerHTML = subOptions(e.target.value);
    if (!fe.item_id.value) fe.location.value = catOf(e.target.value).loc;
    // 换到装备分类时隐藏补货相关字段（保存时也会清掉它们）
    e.target.form.classList.toggle("is-gear", spaceOf(e.target.value) === "gear");
    e.target.form.classList.toggle("is-house", spaceOf(e.target.value) === "house");
  }
  if (e.target.closest("#assetForm") && (e.target.name === "kind" || e.target.name === "type")) return onAssetFormChange(e);
  if (e.target.closest("#maintForm") && e.target.name === "kind") return onMaintFormChange(e);
  if (e.target.closest("#seasonForm") && e.target.name === "mode") { e.target.form.classList.toggle("is-once", e.target.value === "once"); return; }
  if (e.target.closest("#billForm") && e.target.name === "category") { e.target.form.classList.toggle("is-sub", window.BILLS.isSubCat(e.target.value)); return; }   // 订阅 / 会员才显示种类与试用到期
  if (e.target.matches("input[data-task]")) {
    try { await toggleTask(e.target); } catch (err) { toast(t("操作失败：{msg}", { msg: err.message })); }
    return refresh();
  }
  if (e.target.matches("input[data-deal-task]")) {
    try { await toggleDealTask(e.target); } catch (err) { toast(t("操作失败：{msg}", { msg: err.message })); }
    return refresh();
  }
  if (e.target.id === "langSel") return changeLang(e.target.value || null);
  if (e.target.matches("input[data-bill-autopay]")) {   // 清单里的自动扣款开关
    const b = state.bills.find((x) => x.id === e.target.dataset.billAutopay);
    if (!b) return;
    e.target.disabled = true;
    try { await Store.saveBill({ ...b, autopay: e.target.checked, pay_channel: e.target.checked ? "autopay" : (b.pay_channel === "autopay" ? "online" : b.pay_channel) }); toast(e.target.checked ? t("已标为自动扣款，到期前会提醒核对") : t("已改为手动缴费，到期前会提醒缴费")); }
    catch (err) { toast(t("操作失败：{msg}", { msg: err.message })); }
    return refresh();
  }
  if (e.target.id === "billTrend") { state.billsFilter.trend = e.target.value; render(); }
  if (e.target.id === "billsToggle") {
    state.billsEnabled = e.target.checked;
    try { localStorage.setItem("hmh-bills-off", e.target.checked ? "0" : "1"); } catch { /* 忽略 */ }
    toast(e.target.checked ? t("已打开账单") : t("已关闭账单，导航里不再显示")); render();
  }
  if (e.target.id === "regionSel") {
    Units.setRegion(e.target.value || null); fillUnitList();
    state.enriched = enrich(state.items, state.logs); toast(t("已切换为{region}单位", { region: t(Units.region.name) })); render();
  }
  if (e.target.closest("#houseForm")) {
    const d = readHouseForm(e.target.form);
    if (e.target.name === "region") { d.house_type = HOUSE.HOUSE_TYPES[d.region][0].id; applyTypeDefaults(d); d.exterior = []; d.flooring = []; d.roof = null; render(); }
    else if (e.target.name === "house_type") { applyTypeDefaults(d); toast(t("已按房型预选设施，可以再调整")); render(); }
    return;
  }
  if (e.target.id === "houseToggle") {
    state.houseEnabled = e.target.checked;
    try { localStorage.setItem("hmh-house-off", e.target.checked ? "0" : "1"); } catch { /* 忽略 */ }
    toast(e.target.checked ? t("已打开房屋维护") : t("已关闭房屋维护，导航里不再显示")); render();
  }
  if (e.target.id === "gearToggle") {
    state.gearEnabled = e.target.checked;
    try { localStorage.setItem("hmh-gear-off", e.target.checked ? "0" : "1"); } catch { /* 忽略 */ }
    toast(e.target.checked ? t("已打开装备") : t("已关闭装备，导航里不再显示")); render();
  }
  { const k = { spendCat: "cat", spendStore: "store", spendMonth: "month", spendSort: "sort" }[e.target.id]; if (k) { state.spendFilter[k] = e.target.value; state.spendFilter.limit = 20; renderSpendList(); } }
  if (e.target.id === "statsMonth") { state.stats.month = e.target.value; render(); }
  if (e.target.id === "statsItem") { state.stats.itemId = e.target.value; render(); }
  if (e.target.id === "hhSwitch") { localStorage.setItem("hmh-hid", e.target.value); location.reload(); }
});

main.addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  try {
    if (f.id === "itemForm") return saveItemForm(f);
    if (f.id === "aiForm") { render(); await runAi(f); return render(); }   // 先画“生成中”，再画结果
    if (f.id === "aiPageForm") { const p = runAiPage(f); render(); await p; return render(); }
    if (f.id === "catForm") {   // 自定义分类：新建或改名 / 换图标颜色
      const fe = f.elements, name = fe.name.value.trim();
      if (!name) return toast(t("请填分类名"));
      if (CATEGORIES.some((c) => c.space === fe.space.value && t(c.name) === name && c.id !== state.catForm?.key)) return toast(t("已有同名分类"));
      const cf = state.catForm || {}, editing = !!cf.key, cur = cf.key ? CATEGORIES.find((c) => c.id === cf.key) : null;
      // 内置分类：没改的名称 / 小类还原成内置键（切换语言仍会翻译），改过的按原样存
      const subs = canonSubs(cur, fe.subs.value.split(/[,，、\n]/).map((x) => x.trim()).filter(Boolean).slice(0, 12), t);
      const canon = cur && !cur.custom ? canonName(cur, name, t) : name;
      // 内置分类：key 用内置 id，这一行就是“覆盖”；自建分类：新 key
      const row = { id: cf.id, key: cf.key || newCatKey(), space: fe.space.value, name: canon, icon: fe.icon.value || "📦", color: fe.color.value || "#8a948f", loc: null, subs, hidden: !!cf.hidden, sort: cf.sort ?? CATEGORIES.filter((c) => c.custom).length };
      if (cur && !cur.custom && !cf.hidden) {   // 内置分类保存时和默认完全一样：不留覆盖行（有就删掉），免得标“改过”
        const b = cur.base, same = canon === b.name && row.icon === b.icon && row.color === b.color && JSON.stringify(subs) === JSON.stringify(b.subs);
        if (same) { if (cf.id) await Store.deleteCategory(cf.id); state.catForm = null; toast(t("和默认一样，没有改动")); return refresh(); }
      }
      await Store.saveCategory(row);
      state.catForm = null; if (state.route.section !== "me") state.filter.cat = row.key;
      toast(editing ? t("分类已保存") : t("已添加分类 {name}", { name }));
      return refresh();
    }
    if (f.id === "aiSettingsForm") { await saveAiForm(f); toast(t("AI 设置已保存（只存在本机）")); return render(); }
    if (f.id === "termsForm") {   // 自定义名称的翻译：每行 term + 简体 / English / 繁體；全空的行删掉
      let n = 0;
      for (const tr of f.querySelectorAll("tr[data-term]")) {
        const term = tr.dataset.term, v = (k) => tr.querySelector(`input[name="${k}"]`).value.trim() || null;
        const row = { term, zh: v("zh"), en: v("en"), hant: v("hant") };
        const was = glossaryOf(term) || {};
        if (row.zh === (was.zh || null) && row.en === (was.en || null) && row.hant === (was.hant || null)) continue;
        if (!row.zh && !row.en && !row.hant) { if (was.id) await Store.deleteTerm(term); } else await Store.saveTerm(row);
        n++;
      }
      toast(n ? t("已保存 {n} 条翻译", { n }) : t("没有改动")); return refresh();
    }
    if (f.id === "locForm") {   // 存放位置：新建或重命名（重命名会把用到旧名字的物品、设备一起改）
      const fe = f.elements;
      await saveLocationForm(state, state.locForm || {}, fe.name.value.trim(), fe.grp.value);
      state.locForm = null; return refresh();
    }
    if (f.id === "assetForm") return saveAssetForm(f);
    if (f.id === "maintForm") {
      const btn = f.querySelector('button[type="submit"]'); btn.disabled = true;
      let ok = false;
      try { ok = await saveMaintForm(f); } finally { btn.disabled = false; }
      if (!ok) return;   // 校验没过（如车辆没选保养项目）：保留已填内容
      await refresh(); return render(true);
    }
    if (f.id === "billForm") return saveBillForm(f);
    if (f.id === "billPayForm") {
      const btn = f.querySelector('button[type="submit"]'); btn.disabled = true;
      try { await saveBillPayForm(f); } finally { btn.disabled = false; }
      await refresh(); return render(true);
    }
    if (f.id === "billTemplateForm") {
      const idx = [...f.querySelectorAll('input[name="tpl"]:checked')].map((x) => +x.value);
      if (!idx.length) return toast(t("还没有勾选账单"));
      const list = billTemplateItems(idx);
      await Store.addBills(list);
      toast(t("已建立 {n} 条账单，记得补金额和到期日", { n: list.length }));
      go(href("bills", "list"));
      return refresh();
    }
    if (f.id === "propertyForm") {
      const fe = f.elements, name = fe.name.value.trim();
      if (!name) return toast(t("请填写房产名称"));
      const old = state.properties.find((p) => p.id === fe.property_id.value) || {};
      const saved = await Store.saveProperty({ ...old, id: fe.property_id.value || undefined, name, kind: fe.kind.value, role: fe.role.value, status: fe.status.value || old.status || "owned",
        address: fe.address.value.trim() || null, notes: fe.notes.value.trim() || null });
      state.editProperty = null; toast(t("房产已保存"));
      if (!old.id && saved?.id && state.route?.section === "house") {   // 房屋页新建的：直接切到新房产，接着填资料
        state.propertyId = saved.id; try { localStorage.setItem("hmh-property", saved.id); } catch { /* 忽略 */ }
        state.houseDraft = null;
      }
      return refresh();
    }
    if (f.id === "propertyDeleteForm") {   // 彻底删除已归档房产：输入房产名确认
      const p = state.properties.find((x) => x.id === f.elements.property_id.value);
      if (!p) return;
      if (f.elements.confirm_name.value.trim() !== p.name) return toast(t("输入的名称和房产名不一致"));
      await Store.deleteProperty(p.id);
      state.deleteProperty = null; toast(t("已彻底删除“{name}”及其账单、设备和资料；花费记录保留", { name: p.name })); return refresh();
    }
    if (f.id === "dealForm") { await saveDealForm(f); f.dataset.saved = "1"; return refresh(); }   // 已保存：刷新时不再当作未保存改动
    if (f.id === "dealTaskForm") { await saveDealTaskForm(f); state.dealTaskEdit = null; return refresh(); }
    if (f.id === "seasonForm") { if (await saveSeasonForm(f)) { state.seasonForm = null; return refresh(); } return; }
    if (f.id === "closeoutForm") { await applyCloseout(f); go(href("house", "overview")); return refresh(); }
    if (f.id === "assetTemplateForm") {
      const ids = [...f.querySelectorAll('input[name="tpl"]:checked')].map((x) => x.value);
      if (!ids.length) return toast(t("还没有勾选设备"));
      const list = assetTemplateItems(ids);
      await Store.addAssets(list, state.propertyId);
      toast(t("已生成 {n} 台设备档案", { n: list.length }));
      go(href("house", "assets"));
      return refresh();
    }
    if (f.id === "houseForm") return saveHouseForm(f);
    if (f.id === "templateForm") {
      const keys = [...f.querySelectorAll('input[name="tpl"]:checked')].map((x) => x.value);
      if (!keys.length) return toast(t("还没有勾选耗材"));
      const list = templateItems(keys);
      await Store.addItems(list);
      toast(t("已添加 {n} 项房屋耗材", { n: list.length }));
      Object.assign(state.filter, { space: "house", cat: "all", q: "", status: "all" });
      go(href("house", "supplies"));
      return refresh();
    }
    if (f.getAttribute("id") === "purchaseForm") {
      const e2 = f.elements, name = e2.name.value.trim(), amount = num(e2.amount.value, NaN);
      if (!name || !Number.isFinite(amount) || amount < 0) return toast(t("请填写名称和金额"));
      const day = e2.date.value || new Date().toISOString().slice(0, 10);
      const store = cleanStore(e2.store.value);
      if (store) rememberStore(store);
      await Store.addPurchase({ item_id: null, name, category: e2.category.value, quantity: null, unit: null, store,
        amount: Math.round(amount * 100) / 100, currency: Units.region.currency, purchased_at: new Date(`${day}T12:00:00`).toISOString() });
      toast(t("已记录 {name} {m}", { name, m: money(amount) })); return refresh();
    }
    if (f.id === "shopForm") {
      const name = f.elements.name.value.trim();
      if (!name) return;
      const linked = state.items.find((i) => i.name === name);
      if (linked && openShopFor(linked.id)) return toast(t("{name} 已经在清单里了", { name }));
      await Store.saveShopping({ name, quantity: Math.max(0.1, num(f.elements.quantity.value, 1)), unit: f.elements.unit.value.trim() || (linked ? du(linked.unit) : ""), item_id: linked?.id || null, category: f.elements.category.value || linked?.category || "other" });
      { const est = num(f.elements.estimate?.value, NaN); state.shopAdvice = Number.isFinite(est) && est > 0 ? { name, estimate: est, group: groupForCategory(linked?.category || f.elements.category.value, est) } : null; }
      toast(t("已加入：{name}", { name })); refresh();
    }
    if (f.id === "nameForm") {
      const v = f.elements.display_name.value.trim();
      if (!v) return;
      const { error } = await CloudStore.sb.from("household_members").update({ display_name: v }).eq("household_id", CloudStore.hid).eq("user_id", state.user.id);
      if (error) throw new Error(error.message);
      state.displayName = v; state.members = await CloudStore.listMembers(); toast(t("称呼已保存")); render();
    }
    if (f.classList.contains("member-rename")) {   // 家主改家人的称呼
      const v = f.elements.display_name.value.trim();
      if (!v) return;
      await CloudStore.setMemberName(f.dataset.id, v);
      state.editMember = null; state.members = await CloudStore.listMembers(); toast(t("称呼已保存")); return render();
    }
    if (f.id === "loginForm") return doLogin(f);
    if (f.id === "phoneForm") return doPhoneLogin(f);
    if (f.id === "otpForm") return doVerifyOtp(f);
    if (f.id === "quickForm") return doQuickJoin(f);
    if (f.id === "createHhForm") return doCreateHousehold(f);
    if (f.id === "joinHhForm") return doJoinHousehold(f);
  } catch (err) { toast(t("操作失败：{msg}", { msg: err.message })); }
});

main.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const { action, id } = el.dataset;
  try {
    if (action?.startsWith("scan-")) return scanAction(action, el, { go, refresh });
    if (action?.startsWith("budget-") || action === "shop-advice-close") return budgetAction(action, { refresh, render }, el);
    switch (action) {
      case "add-item": return openItem(null, { space: el.dataset.space });
      case "edit": return openItem(id);
      case "item-cancel": return leaveItem(false);
      case "item-delete":
        if (!armed(el, t("再点一次确认删除"))) return;
        await Store.deleteItem(state.route.id); toast(t("已删除")); return leaveItem(true);
      case "asset-cancel": return leaveAsset(false);
      case "asset-delete":
        if (!armed(el, t("再点一次确认删除"))) return;
        await Store.deleteAsset(state.route.id); toast(t("已删除设备及其保养记录")); return leaveAsset(true);
      case "maint-del":
        if (!armed(el, t("确认删除"))) return;
        await Store.deleteMaintLog(id); toast(t("已删除这条记录")); await refresh(); return render(true);
      case "tasks-prev": shiftTasksMonth(-1); return render();
      case "tasks-next": shiftTasksMonth(1); return render();
      case "tasks-today": state.tasksYM = null; state.seasonForm = null; return render();
      case "season-new": state.seasonForm = { id: null }; render(); $("#seasonForm input[name=name]")?.focus(); return;
      case "season-edit": state.seasonForm = { id: el.dataset.id }; render(); $("#seasonForm input[name=name]")?.focus(); return;
      case "season-cancel": state.seasonForm = null; return render();
      case "season-delete":
        if (!armed(el, t("再点一次确认删除"))) return;
        await deleteSeasonTask(el.dataset.id); state.seasonForm = null; toast(t("已删除这条任务")); return refresh();
      case "today-pref": {
        const k = el.dataset.key;
        if (k === "mode") setTodayPref({ mode: "severity" }); else if (k === "mode-property") setTodayPref({ mode: "property" });
        else setTodayPref({ [k]: !state.today[k] });
        return render();
      }
      case "today-source": setTodayPref({ source: state.today.source === el.dataset.source ? null : el.dataset.source }); return render();
      case "quick-edit": state.quickEdit = !state.quickEdit; state.quickAdd = false; return render();
      case "quick-open": state.quickAdd = !state.quickAdd; return render();
      case "quick-add": { const h = $("#quickSel")?.value; if (h) await saveQuick([...new Set([...quickList(), h])]); state.quickAdd = false; return render(); }
      case "quick-del": await saveQuick(quickList().filter((x) => x !== el.dataset.id)); return render();
      case "quick-move": {
        const list = quickList(), i = list.indexOf(el.dataset.id), j = i + +el.dataset.dir;
        if (i < 0 || j < 0 || j >= list.length) return;
        [list[i], list[j]] = [list[j], list[i]]; await saveQuick(list); return render();
      }
      case "quick-reset": await saveQuick(DEFAULT_QUICK()); toast(t("已恢复默认快捷操作")); return render();
      case "quick-run": if (el.dataset.id === "action:print") go(`${href("me", "settings")}?sec=print`); return;   // 打印：进入 设置 → 打印
      case "print-run": return printSheet(el.dataset.kind, el.dataset.kind === "spend" ? { months: +($("#printRange")?.value || state.stats.months), useFilter: !!el.dataset.filtered } : $("#printProp")?.value || "all");
      case "inv-space": return go(el.dataset.space === "house" ? `${href("pantry", "inventory")}?space=house` : href("pantry", "inventory"));
      case "supply-add": {   // 设备页“相关耗材”：一键把推荐耗材加进库存
        const it = supplyItem(el.dataset.name); if (!it) return;
        await Store.addItems([it]); toast(t("已添加到库存：{name}", { name: it.name })); return refresh();
      }
      case "alerts-prev": shiftAlertSource(-1); return render();
      case "alerts-next": shiftAlertSource(1); return render();
      case "bill-cancel": return leaveBill(false);
      case "bill-delete":
        if (!armed(el, t("再点一次确认删除"))) return;
        await Store.deleteBill(state.route.id); toast(t("已删除账单及其缴费记录")); return leaveBill(true);
      case "billpay-del":
        if (!armed(el, t("确认删除"))) return;
        await Store.deleteBillPayment(id); toast(t("已删除这条记录")); await refresh(); return render(true);
      case "bill-verify": el.disabled = true; await quickVerify(id); return refresh();
      case "bills-ics": return exportIcs();
      case "bills-csv": return exportBillsCsv();
      case "bills-filter": state.billsFilter[el.dataset.key] = el.dataset.val; return render();
      case "bills-prop": state.billsFilter.property = id; return render();
      case "property": {   // 切换当前房产：房屋资料、设备、季节任务随之切换
        if (id === state.propertyId) return;
        state.propertyId = id; try { localStorage.setItem("hmh-property", id); } catch { /* 忽略 */ }
        state.houseDraft = null; return refresh();
      }
      case "house-open": {   // 房产列表 → 这套房产的页面目录
        if (id !== state.propertyId) { state.propertyId = id; try { localStorage.setItem("hmh-property", id); } catch { /* 忽略 */ } state.houseDraft = null; }
        go(href("house", "pages")); return refresh();
      }
      case "property-edit": state.editProperty = id || "new"; return render();
      case "property-cancel": state.editProperty = null; return render();
      case "property-delete": state.deleteProperty = id; render(); $("#propertyDeleteForm input[name=confirm_name]")?.focus(); return;
      case "property-delete-cancel": state.deleteProperty = null; return render();
      case "deal-start": await startDeal(el.dataset.kind, el.dataset.asset || null); return refresh();
      case "deal-cancel": if (!armed(el, t("再点一次确认取消"))) return; await cancelDeal(el.dataset.deal || null); return refresh();
      case "deal-closeout": {
        const d = el.dataset.deal ? state.deals.find((x) => x.id === el.dataset.deal) : openDeal();
        if (!d) return;
        if (d.asset_id) { if (!armed(el, t("再点一次确认完成"))) return; await completeVehicleDeal(d); return refresh(); }
        if (d.kind === "buy") { if (!armed(el, t("再点一次确认已交割"))) return; await completeBuy(); return refresh(); }
        state.closeout = true; return go(`${href("house", "deal")}?sec=closeout`);
      }
      case "veh-buy-start": {   // 先建一辆“选购中”的车，再进它的交易页开始买车流程
        el.disabled = true;
        const aid = await startVehiclePurchase();
        await startDeal("veh_buy", aid);
        await refresh();
        return go(`${href("house", "deal")}?asset=${aid}`);
      }
      case "deal-task-edit": state.dealTaskEdit = { deal: el.dataset.deal, key: el.dataset.key }; render(); $("#dealTaskForm input[name=due_on]")?.focus(); return;
      case "deal-task-new": state.dealTaskEdit = { deal: el.dataset.deal, key: "", stage: el.dataset.stage || "special" }; render(); $("#dealTaskForm input[name=name]")?.focus(); return;
      case "deal-task-cancel": state.dealTaskEdit = null; return render();
      case "deal-due-reset": el.form.elements.due_on.value = el.dataset.plan || ""; return markDirty(el.form, true);   // 只回填输入框，点保存才生效
      case "deal-task-delete":
        if (!armed(el, t("再点一次确认删除"))) return;
        await deleteCustomTask(el.dataset.id); state.dealTaskEdit = null; toast(t("已删除这条事项")); return refresh();
      case "deal-view":
        state.dealView = el.dataset.view === "timeline" ? "timeline" : "list";
        try { localStorage.setItem("hmh-deal-view", state.dealView); } catch { /* 忽略 */ }
        return render();
      case "deal-closeout-cancel": state.closeout = null; return go(href("house", "deal"));
      case "property-default": await Store.setDefaultProperty(id); toast(t("已设为默认房产")); return refresh();
      case "property-archive": {
        const p = state.properties.find((x) => x.id === id);
        if (!p) return;
        if (!p.archived && !armed(el, t("再点一次确认归档"))) return;
        await Store.saveProperty({ ...p, archived: !p.archived }); toast(p.archived ? t("已恢复房产") : t("已归档，账单和房屋资料都保留")); return refresh();
      }
      case "bills-enable":
        state.billsEnabled = true; try { localStorage.setItem("hmh-bills-off", "0"); } catch { /* 忽略 */ }
        return render();
      case "house-enable":
        state.houseEnabled = true; try { localStorage.setItem("hmh-house-off", "0"); } catch { /* 忽略 */ }
        return render();
      case "gear-enable":
        state.gearEnabled = true; try { localStorage.setItem("hmh-gear-off", "0"); } catch { /* 忽略 */ }
        return render();
      case "tpl-all": e.preventDefault(); el.form.querySelectorAll('input[name="tpl"]:not(:disabled)').forEach((x) => { x.checked = el.dataset.on === "1"; }); return;
      case "consume": el.disabled = true; await Store.adjust(id, -storedStep(state.items.find((x) => x.id === id)?.unit), "consume"); return refresh();
      case "restock": el.disabled = true; await Store.adjust(id, storedStep(state.items.find((x) => x.id === id)?.unit), "restock"); return refresh();
      case "inv-sub": state.filter.sub = el.dataset.sub; return render();
      case "cat": state.filter.cat = el.dataset.cat; state.filter.sub = "all"; state.catSort = false; state.catForm = null; return render();
      case "cat-new": state.catForm = { space: el.dataset.space || state.filter.space }; render(); $("#catForm input[name=name]")?.focus(); return;
      case "cat-edit": { const c = CATEGORIES.find((x) => x.id === el.dataset.cat); if (c) state.catForm = catFormOf(c, t); render(); $("#catForm")?.scrollIntoView({ block: "start" }); return; }
      case "cat-cancel": state.catForm = null; return render();
      case "cat-restore": {   // 内置分类：删掉覆盖行，恢复默认名称 / 图标 / 小类
        const c = CATEGORIES.find((x) => x.id === el.dataset.cat); if (!c?.overridden) return;
        await Store.deleteCategory(c.dbId); state.catForm = null; toast(t("已恢复默认")); return refresh();
      }
      case "cat-hide": {   // 内置分类：隐藏（下面没有物品才行）/ 重新显示
        const c = CATEGORIES.find((x) => x.id === el.dataset.cat); if (!c || c.custom) return;
        const on = el.dataset.on === "1";
        if (on && state.items.some((i) => i.category === c.id)) return toast(t("这个分类下还有物品，先把它们改到别的分类"));
        const b = c.base || {}, changed = c.overridden && (c.name !== b.name || c.icon !== b.icon || c.color !== b.color || JSON.stringify(c.subs) !== JSON.stringify(b.subs));
        if (!on && c.dbId && !changed) await Store.deleteCategory(c.dbId);   // 只是隐藏过、没改别的：重新显示就把覆盖行删掉，不留“改过”标记
        else await Store.saveCategory({ id: c.dbId, key: c.id, space: c.space, name: changed ? c.name : null, icon: changed ? c.icon : null, color: changed ? c.color : null, loc: null, subs: changed ? c.subs : [], hidden: on, sort: 0 });
        state.catForm = null; if (on && state.filter.cat === c.id) state.filter.cat = "all"; toast(on ? t("已隐藏分类") : t("已重新显示")); return refresh();
      }
      case "inv-clear": Object.assign(state.filter, { q: "", status: "all", loc: "all" }); return render();
      // 设置 → 存放位置：新建 / 重命名 / 删除
      case "loc-new": state.locForm = { name: "", grp: el.dataset.grp || "custom" }; render(); $("#locForm input[name=name]")?.focus(); return;
      case "loc-edit": {
        const name = el.dataset.name, c = customLocations().find((x) => x.name === name);
        state.locForm = c ? { id: c.id, name: c.name, grp: c.grp, replaces: c.replaces, sort: c.sort, oldName: c.name } : { name, grp: groupOf(name)?.id || "custom", replaces: name, oldName: name };
        render(); $("#locForm input[name=name]")?.focus(); return;
      }
      case "loc-cancel": state.locForm = null; return render();
      case "loc-del": { const c = customLocations().find((x) => x.id === id); if (!c || !armed(el, t("再点一次确认删除"))) return; await deleteLocation(state, c); state.locForm = null; return refresh(); }
      case "house-cancel": state.skipAutosave = true; return;   // 链接本身会跳回分区列表；明确取消就不自动保存
      case "cat-delete": {
        const c = CATEGORIES.find((x) => x.id === el.dataset.cat); if (!c?.custom) return;
        if (state.items.some((i) => i.category === c.id)) return toast(t("这个分类下还有物品，先把它们改到别的分类"));
        if (!armed(el, t("再点一次确认删除"))) return;
        await Store.deleteCategory(c.dbId); state.catForm = null; if (state.filter.cat === c.id) state.filter.cat = "all"; toast(t("已删除分类")); return refresh();
      }
      case "cat-sort": state.catSort = !state.catSort; return render();   // 手机仪表盘：调整方块顺序
      case "cat-move": moveCat(state.filter.space, el.dataset.cat, +el.dataset.dir); return render();
      case "goto-cat": Object.assign(state.filter, { space: el.dataset.space || "pantry", cat: el.dataset.cat, status: "all", q: "" }); state.keepFilter = true; return go(toList(el.dataset.space));
      case "goto-status": Object.assign(state.filter, { space: el.dataset.space || "pantry", cat: "all", status: el.dataset.status, q: "" }); state.keepFilter = true; return go(toList(el.dataset.space));
      case "shop-add-item": return addAlertsToShopping([state.enriched.find((x) => x.id === id)]);
      case "shop-add-alerts": {
        const sp = el.dataset.space || "pantry";
        const pool = sp === "all" ? state.enriched.filter((x) => state.houseEnabled || inSpace("pantry")(x)) : state.enriched.filter(inSpace(sp));
        return addAlertsToShopping(alertsOf(pool));
      }
      case "property-of-bill": return;
      case "shop-claim": await Store.saveShopping({ id, status: "claimed", claimed_by: state.user?.id || null, claimed_by_name: state.displayName }); toast(t("已认领，家人会看到你在买")); return refresh();
      case "shop-unclaim": await Store.saveShopping({ id, status: "todo", claimed_by: null, claimed_by_name: null }); return refresh();
      case "shop-bought": return markBought(id);
      case "shop-qty": return stepShopQty(id, +el.dataset.dir);
      case "shop-del": await Store.deleteShopping(id); return refresh();
      case "shop-clear": await Store.clearBought(); return refresh();
      case "diet": state.diet = el.dataset.diet; state.mealShift = 0; localStorage.setItem("hmh-diet", state.diet); return render();
      case "shuffle": state.mealShift++; state.slotShift = {}; return render();
      case "slot-swap": { const sl = state.slotShift || (state.slotShift = {}); sl[el.dataset.slot] = (sl[el.dataset.slot] || 0) + 1; return render(); }
      case "ai-ask": { state.ai = state.ai || { ask: "", busy: false, result: null, error: null, raw: null }; state.ai.ask = el.dataset.ask; render(); const fm = $("#aiForm"); if (fm) { if (aiReady()) fm.requestSubmit(); else fm.elements.ask.focus(); } return; }
      case "ai-copy": return copyPrompt($("#aiForm"));
      case "ai-again": { const fm = $("#aiForm"); return fm ? fm.requestSubmit() : null; }
      case "ai-add-missing": await addAiMissing(); return refresh();
      // 小Y问整页
      case "ai-topic": { pickTopic(el.dataset.topic); render(); const fm = $("#aiPageForm"); if (fm) { if (aiReady()) fm.requestSubmit(); else fm.elements.q.focus(); } return; }
      case "ai-copy-general": return copyGeneralPrompt($("#aiPageForm"));
      case "ai-copy-answer": return copyAnswer();
      case "ai-usage-reset": resetUsage(el.dataset.provider); toast(t("已重置本机的调用计数")); return render();
      case "ai-clear-adv": { const f = $("#aiSettingsForm"); if (f) { f.elements.model.value = ""; f.elements.base.value = ""; await saveAiForm(f); } toast(t("已清掉，改用内置默认")); return render(); }
      case "ai-test": {
        el.disabled = true; const out = $("#aiTestOut");
        try { await saveAiForm($("#aiSettingsForm")); await testModel(); out.textContent = t("连接成功 ✓"); out.className = "muted ok-text"; }
        catch (err) { out.textContent = t("失败：{msg}", { msg: err.message }); out.className = "form-error"; }
        finally { el.disabled = false; }
        return;
      }
      case "pay-more": state.payFilter.limit += 50; return renderPayList();
      case "deal-filter": state.dealFilter = el.dataset.val; return render();
      case "tasks-undone": state.tasksOnlyUndone = !state.tasksOnlyUndone; return render();
      case "spend-more": state.spendFilter.limit += 20; return renderSpendList();
      case "stats-months": state.stats.months = +el.dataset.months; return render();
      case "stats-cat": state.stats.cat = el.dataset.cat; return render();
      case "purchase-del": if (!armed(el, t("确认删除"))) return; await Store.deletePurchase(id); toast(t("已删除这笔记录")); return refresh();
      case "recipe-missing": return addRecipeMissing(el.dataset.name);
      case "copy-invite": await navigator.clipboard.writeText(state.household.invite_code); return toast(t("邀请码已复制"));
      case "notif": await Notification.requestPermission(); return render();
      case "export": return exportJson();
      case "csv-summary": return exportAnnual("summary");
      case "csv-detail": return exportAnnual("detail");
      case "reload": return refresh();
      case "reset-demo": if (armed(el, t("再点一次确认恢复"))) { DemoStore.reset(); toast(t("已恢复演示数据")); refresh(); } return;
      case "logout": await CloudStore.sb.auth.signOut(); localStorage.removeItem("hmh-hid"); return location.reload();
      case "login-mode": state.loginMode = el.dataset.mode; state.phonePending = null; return renderLogin();
      case "otp-back": state.phonePending = null; return renderLogin();
      case "lang": return changeLang(el.dataset.lang || null);
      case "member-rename": state.editMember = id || null; render(); if (id) $(`.member-rename input`)?.focus(); return;
      case "member-role": {
        const m = state.members.find((x) => x.user_id === id), role = el.dataset.role;
        if (!m) return;
        if (!armed(el, role === "owner" ? t("再点一次设为家主") : t("再点一次取消家主"))) return;
        await CloudStore.setMemberRole(id, role);
        state.members = await CloudStore.listMembers();
        toast(role === "owner" ? t("{name} 已设为家主", { name: m.display_name }) : t("{name} 已取消家主", { name: m.display_name })); return render();
      }
      case "member-remove": {
        const m = state.members.find((x) => x.user_id === id);
        if (!m) return;
        if (!armed(el, t("再点一次确认移出"))) return;
        await CloudStore.removeMember(id);
        state.members = await CloudStore.listMembers();
        toast(t("{name} 已移出家庭", { name: m.display_name })); return render();
      }
      case "rotate-invite": {
        if (!armed(el, t("再点一次确认重置"))) return;
        const { data, error } = await CloudStore.sb.rpc("rotate_invite_code", { p_household: state.household.id });
        if (error) throw new Error(error.message);
        state.household.invite_code = data; toast(t("邀请码已重置，旧邀请码立即失效")); return render();
      }
    }
  } catch (err) { toast(t("操作失败：{msg}", { msg: err.message })); refresh(); }
});

/** 房屋资料分区表单：保存后第一次填房型去推荐耗材，其余回分区列表；silent=true 为离开页面时自动保存（不跳转） */
async function saveHouseForm(f, { silent = false } = {}) {
  const d = readHouseForm(f), y = d.year_built, thisYear = new Date().getFullYear();
  if (y != null && (y < 1850 || y > thisYear)) {
    const msg = t("建成年份需要在 1850 到 {y} 之间。", { y: thisYear });
    if (silent) toast(t("没有自动保存：{msg}", { msg })); else f.querySelector("#houseFormError").textContent = msg;
    return false;
  }
  const first = !state.houseProfile;
  await Store.saveHouseProfile(d, state.propertyId);
  const prop = state.properties.find((p) => p.id === state.propertyId);   // 地址存在房产上
  if (prop && (prop.address || "") !== (d.address || "")) await Store.saveProperty({ ...prop, address: d.address || null });
  state.houseProfile = { ...d }; state.houseDraft = null;
  if (silent) return true;
  state.skipAutosave = true;
  toast(t("房屋资料已保存"));
  const hasHouseItems = state.items.some(inSpace("house"));
  go(first && f.dataset.sec === "type" && !hasHouseItems ? href("house", "template") : href("house", "profile"));
  refresh();
  return true;
}

/** 采购清单改数量：按显示单位 ±一步（kg 0.5、lb 1、个 1…），最少一步；存回时换回原单位 */
export async function stepShopQty(id, dir) {
  const s = state.shopping.find((x) => x.id === id); if (!s) return;
  const unit = s.unit || "", step = Units.step(du(unit)), f = Units.factor(unit);
  const disp = Math.max(step, Math.round((num(s.quantity, 1) * f + dir * step) * 100) / 100);
  await Store.saveShopping({ id, quantity: Math.round((disp / f) * 10000) / 10000 });
  refresh();
}
/** 采购清单直接输入数量（显示单位）；空或 ≤ 0 就回到原值 */
export async function setShopQty(id, value) {
  const s = state.shopping.find((x) => x.id === id); if (!s) return;
  const disp = num(value), f = Units.factor(s.unit || "");
  if (!(disp > 0)) return render();
  await Store.saveShopping({ id, quantity: Math.round((disp / f) * 10000) / 10000 });
  refresh();
}

export async function addAlertsToShopping(list) {
  let added = 0;
  for (const it of list) {
    if (!it || openShopFor(it.id)) continue;
    await Store.saveShopping({ item_id: it.id, name: it.name, quantity: it.suggest, unit: it.unit, category: it.category });
    added++;
  }
  toast(added ? t("已加入采购清单 {n} 项", { n: added }) : t("这些都已经在清单里了"));
  refresh();
}

export async function addRecipeMissing(recipeName) {
  const r = scoreRecipes().find((x) => x.name === recipeName);
  if (!r) return;
  const openNames = new Set(state.shopping.filter((s) => s.status !== "bought").map((s) => s.name));
  let added = 0;
  for (const p of r.parts.filter((x) => !x.item)) {
    const existing = state.items.find((i) => nameHas(i.name, p.kw));
    const name = existing?.name || t(p.kw[0]);
    if (openNames.has(name) || (existing && openShopFor(existing.id))) continue;
    await Store.saveShopping({ name, quantity: 1, unit: existing?.unit || "", item_id: existing?.id || null, category: existing?.category || "fresh" });
    added++;
  }
  toast(added ? t("“{recipe}”缺的 {n} 样已加入清单", { recipe: t(recipeName), n: added }) : t("缺的食材已经在清单里了"));
  refresh();
}

export async function markBought(id) {
  const s = state.shopping.find((x) => x.id === id);
  if (!s) return;
  const priceEl = document.querySelector(`[data-price-for="${CSS.escape(id)}"]`);
  const amount = priceEl && priceEl.value !== "" ? Math.round(Math.max(0, num(priceEl.value)) * 100) / 100 : null;
  const store = cleanStore(document.querySelector(`[data-store-for="${CSS.escape(id)}"]`)?.value);
  if (store) rememberStore(store);
  const item = state.items.find((i) => i.id === s.item_id);
  const qty = num(s.quantity, 1), now = new Date().toISOString();
  await Store.saveShopping({ id, status: "bought", bought_at: now, amount, claimed_by_name: s.claimed_by_name || state.displayName });
  await Store.addPurchase({
    item_id: item?.id || null, name: s.name, category: item?.category || s.category || "other",
    quantity: qty, unit: s.unit || item?.unit || null, amount, currency: Units.region.currency, purchased_at: now, store,
  });
  if (item) {
    // 采购单位与库存单位不同（例如库存按 kg，买的时候填 lb）时自动换算
    const add = !s.unit || s.unit === item.unit ? qty : Units.convert(qty, s.unit, item.unit);
    if (add == null) toast(t("{name} 已买到；单位 {u1} 与库存单位 {u2} 无法换算，请手动更新库存", { name: s.name, u1: t(s.unit), u2: t(item.unit) }));
    else { await Store.adjust(item.id, Math.round(add * 100) / 100, "restock"); toast(t("{name} 已入库 +{q}，记得更新保质期", { name: s.name, q: showQty(add, item.unit) })); }
  } else toast(t("{name} 已买到", { name: s.name }) + (amount != null ? t("，花费 {m}", { m: money(amount) }) : ""));
  refresh();
}

export async function exportJson() {
  try { state.purchases = await Store.listPurchases(); } catch { /* 用已有的 */ }   // 采购花费是后台读的，导出前确保是最新的完整数据
  const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), household: state.household?.name, items: state.items, shopping: state.shopping, purchases: state.purchases,
    properties: state.properties, house_profile: state.houseProfile, assets: state.assets, maintenance_logs: state.maintLogs, seasonal_tasks: state.seasonalDone,
    bills: state.bills, bill_payments: state.billPayments, property_deals: state.deals, deal_task_done: state.dealDone, deal_task_overrides: state.dealOverrides, deal_custom_tasks: state.dealCustom }, null, 2)], { type: "application/json" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `pantry-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function notifyIfNeeded() {
  // 浏览器通知：紧急和今天两档有新增时弹一次，内容带房产名
  const urgent = collectAlerts().filter((x) => x.severity <= 1);
  const prev = state.lastAlertCount;
  state.lastAlertCount = urgent.length;
  if (prev === null ? urgent.length === 0 : urgent.length <= prev) return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try { new Notification(t(APP_NAME), { body: t("{n} 件事要马上处理：{list}", { n: urgent.length, list: joinList(urgent.slice(0, 4).map((x) => withProperty(x.property_id, x.title))) }) }); } catch { /* 部分移动浏览器只允许 Service Worker 通知 */ }
}

/* ───────────── 云端：登录与家庭 ───────────── */
export function gate(html) { document.body.classList.add("gate"); applyChrome(); $("#hhName").textContent = ""; $("#main").innerHTML = html; }

/* 登录：邮箱魔法链接（默认）；手机号短信验证码（config.js 里 PHONE_LOGIN = true 且 Supabase 已接短信服务商时显示） */
const COUNTRY_CODES = [["+1", "美国 / 加拿大 +1"], ["+86", "中国大陆 +86"], ["+852", "香港 +852"], ["+886", "台湾 +886"], ["+65", "新加坡 +65"], ["+61", "澳大利亚 +61"], ["+44", "英国 +44"], ["+81", "日本 +81"]];
const phoneLoginOn = () => !!window.APP_CONFIG?.PHONE_LOGIN;
const quickJoinOn = () => window.APP_CONFIG?.QUICK_JOIN !== false;

export function renderLogin(msg = "") {
  const modes = [["email", "邮箱"], phoneLoginOn() && ["phone", "手机号"], quickJoinOn() && ["quick", "邀请码直接进入"]].filter(Boolean);
  const mode = modes.some(([m]) => m === state.loginMode) ? state.loginMode : "email";
  const tabs = modes.length > 1 ? `<div class="seg" role="group" aria-label="${t("登录方式")}">${modes.map(([m, l]) =>
    `<button type="button" class="chip" data-action="login-mode" data-mode="${m}" aria-pressed="${mode === m}">${t(l)}</button>`).join("")}</div>` : "";
  let body;
  if (mode === "quick") {
    body = `<p class="muted">${t("家人已经建好家庭的话，填邀请码直接进入，不用收邮件或短信。手机号只用来标识是谁，不会发送验证码。")}</p>
      <form id="quickForm">
        <input type="tel" name="phone" required inputmode="tel" autocomplete="tel" placeholder="${t("手机号")}" aria-label="${t("手机号")}">
        <input name="display_name" maxlength="20" placeholder="${t("我的称呼（可不填），例如：爸爸")}" aria-label="${t("我的称呼")}">
        <input name="code" required maxlength="12" placeholder="${t("邀请码")}" autocapitalize="characters" aria-label="${t("邀请码")}">
        <button class="btn btn-primary" type="submit">${t("进入家庭")}</button></form>
      <p class="muted" style="font-size:12px">${t("这种方式的身份保存在本设备浏览器里，清除浏览器数据或换手机后需要重新用邀请码进入。创建家庭请用邮箱登录。")}</p>`;
  } else if (mode === "phone" && state.phonePending) {
    body = `<p class="muted">${t("验证码已发送到 {phone}，请输入短信里的 6 位数字。", { phone: esc(state.phonePending) })}</p>
      <form id="otpForm"><input name="token" required inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{4,8}" maxlength="8" placeholder="${t("验证码")}" aria-label="${t("验证码")}">
        <button class="btn btn-primary" type="submit">${t("登录")}</button>
        <button class="btn btn-ghost" type="button" data-action="otp-back">${t("换个号码 / 重新发送")}</button></form>`;
  } else if (mode === "phone") {
    const def = Units.region.system === "us" ? "+1" : "+86";
    body = `<p class="muted">${t("输入手机号，我们会发一条短信验证码，无需密码。")}</p>
      <form id="phoneForm" class="phone-form">
        <select name="cc" aria-label="${t("国家或地区代码")}">${COUNTRY_CODES.map(([c, l]) => `<option value="${c}" ${c === def ? "selected" : ""}>${t(l)}</option>`).join("")}</select>
        <input type="tel" name="phone" required inputmode="tel" autocomplete="tel-national" placeholder="${t("手机号")}" aria-label="${t("手机号")}">
        <button class="btn btn-primary" type="submit">${t("发送验证码")}</button></form>`;
  } else {
    body = `<p class="muted">${t("输入邮箱，我们会发一封登录链接，点开即可登录，无需密码。")}</p>
      <form id="loginForm"><input type="email" name="email" required autocomplete="email" placeholder="you@example.com" aria-label="${t("邮箱")}">
        <button class="btn btn-primary" type="submit">${t("发送登录链接")}</button></form>`;
  }
  gate(`<div class="panel gate-card"><h2>${t("登录")}</h2>${tabs}${body}<p class="muted" role="status">${esc(msg)}</p></div>`);
  setSync(t("未登录"));
}

export async function doLogin(f) {
  const email = f.elements.email.value.trim();
  if (!email) return;
  f.querySelector("button").disabled = true;
  const { error } = await CloudStore.sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.href.split("#")[0] } });
  if (error) { f.querySelector("button").disabled = false; return toast(t("发送失败：{msg}", { msg: error.message })); }
  renderLogin(t("登录链接已发送到 {email}，请在本设备打开邮件。", { email }));
}

/** 手机号：拼成 E.164（+国家码+数字）后发短信验证码 */
export async function doPhoneLogin(f) {
  const digits = f.elements.phone.value.replace(/\D/g, "");
  if (digits.length < 6 || digits.length > 15) return toast(t("请输入正确的手机号"));
  const phone = `${f.elements.cc.value}${digits}`;
  f.querySelector("button").disabled = true;
  const { error } = await CloudStore.sb.auth.signInWithOtp({ phone });
  if (error) {
    f.querySelector("button").disabled = false;
    const m = /provider|not enabled|unsupported/i.test(error.message) ? t("Supabase 还没开启手机号登录或没有接入短信服务商，请先按 README 配置，或改用邮箱登录。") : t("发送失败：{msg}", { msg: error.message });
    return toast(m);
  }
  state.phonePending = phone;
  renderLogin();
}

/** 邀请码直接进入：匿名登录后用邀请码加入家庭（加入动作在 boot 的 start() 里完成，避免和 SIGNED_IN 事件打架） */
export async function doQuickJoin(f) {
  const digits = f.elements.phone.value.replace(/\D/g, "");
  const code = f.elements.code.value.trim();
  if (digits.length < 6 || digits.length > 15) return toast(t("请输入正确的手机号"));
  if (!code) return toast(t("请输入邀请码"));
  const name = f.elements.display_name.value.trim() || t("尾号{d}", { d: digits.slice(-4) });
  f.querySelector("button").disabled = true;
  state.pendingJoin = { code, name };
  const { error } = await CloudStore.sb.auth.signInAnonymously({ options: { data: { phone_label: digits, display_name: name } } });
  if (error) {
    state.pendingJoin = null; f.querySelector("button").disabled = false;
    return toast(/anonymous/i.test(error.message) ? t("Supabase 还没开启匿名登录（Allow anonymous sign-ins），请先按 README 开启，或改用邮箱登录。") : t("进入失败：{msg}", { msg: error.message }));
  }
}

export async function doVerifyOtp(f) {
  const token = f.elements.token.value.trim();
  if (!token || !state.phonePending) return;
  f.querySelector("button").disabled = true;
  const { error } = await CloudStore.sb.auth.verifyOtp({ phone: state.phonePending, token, type: "sms" });
  if (error) { f.querySelector("button").disabled = false; return toast(/expired|invalid/i.test(error.message) ? t("验证码不对或已过期，请重新发送") : t("登录失败：{msg}", { msg: error.message })); }
  state.phonePending = null;   // 成功后 onAuthStateChange 会收到 SIGNED_IN
}

export function renderOnboarding() {
  const anon = !!state.user?.is_anonymous;   // 邀请码直接进入的匿名账号：只能加入，不能创建家庭
  gate(`<div class="panel gate-card"><h2>${t("加入你的家庭")}</h2>
    <p class="muted">${anon ? t("用家人给的邀请码加入。") : t("第一次使用请创建家庭；家人已经创建过的话，用邀请码加入。")}</p>
    <form id="joinHhForm"><input name="code" required maxlength="12" placeholder="${t("邀请码")}" autocapitalize="characters" aria-label="${t("邀请码")}">
      <input name="display_name" required maxlength="20" placeholder="${t("我的称呼，例如：爸爸")}" aria-label="${t("我的称呼")}" value="${esc(state.user?.user_metadata?.display_name || "")}">
      <button class="btn btn-dark" type="submit">${t("用邀请码加入")}</button></form>
    <hr>
    ${anon ? `<p class="muted">${t("创建新家庭需要用邮箱登录，这样家庭有一个能找回的主人。")}<button type="button" class="btn btn-sm btn-ghost" data-action="logout">${t("改用邮箱登录")}</button></p>`
      : `<form id="createHhForm"><input name="name" required maxlength="50" placeholder="${t("家庭名称，例如：小月亮的家")}" aria-label="${t("家庭名称")}">
      <input name="display_name" required maxlength="20" placeholder="${t("我的称呼，例如：妈妈")}" aria-label="${t("我的称呼")}">
      <button class="btn btn-primary" type="submit">${t("创建家庭")}</button></form>`}</div>`);
  setSync(t("已登录"));
}

export async function doCreateHousehold(f) {
  if (state.user?.is_anonymous) return toast(t("创建家庭请先用邮箱登录"));
  const { data, error } = await CloudStore.sb.rpc("create_household", { p_name: f.elements.name.value.trim(), p_display_name: f.elements.display_name.value.trim() });
  if (error) return toast(t("创建失败：{msg}", { msg: error.message }));
  localStorage.setItem("hmh-hid", data); afterLogin();
}

export async function doJoinHousehold(f) {
  const { data, error } = await CloudStore.sb.rpc("join_household", { p_code: f.elements.code.value.trim(), p_display_name: f.elements.display_name.value.trim() });
  if (error) return toast(error.message.includes("invalid") ? t("邀请码不正确，请向家人确认") : t("加入失败：{msg}", { msg: error.message }));
  localStorage.setItem("hmh-hid", data); afterLogin();
}

export async function afterLogin() {
  const sb = CloudStore.sb;
  const { data, error } = await sb.from("household_members")
    .select("household_id, display_name, households(id, name, invite_code, created_by)").eq("user_id", state.user.id);
  if (error) return toast(t("读取家庭失败：{msg}", { msg: error.message }));
  if (!data.length) return renderOnboarding();
  state.households = data.map((d) => d.households).filter(Boolean);
  const saved = localStorage.getItem("hmh-hid");
  const mine = data.find((d) => d.household_id === saved) || data[0];
  state.household = mine.households;
  state.displayName = mine.display_name;
  CloudStore.hid = mine.household_id;
  localStorage.setItem("hmh-hid", CloudStore.hid);
  state.membersReady = CloudStore.listMembers().then((m) => { state.members = m; return m; });   // 和 refresh 的数据读取并行
  CloudStore.subscribe(refreshSoon);
  await refresh();
}



/* ───────────── 启动 ───────────── */
export async function boot() {
  window.__hmhBooted = true;   // 告诉 index.html 的启动自检：主脚本已经运行
  if (lang === "zh-Hant") await loadOpenCC();   // 繁體：先把转换库拉下来再渲染，避免先简后繁闪一下
  applyChrome();
  fillUnitList();
  document.addEventListener("budget-saved", () => render());
  document.addEventListener("visibilitychange", () => { if (!document.hidden && state.enriched) refreshSoon(); });
  // 跨过手机 / 宽屏分界（旋转 iPad、拖窗口）：库存页在方块仪表盘和分类导航之间切换
  window.matchMedia("(max-width: 640px)").addEventListener("change", () => { const r = state.route; if (state.enriched && ((r.section === "pantry" && (r.sub === "inventory" || r.sub === "gear")) || (r.section === "house" && r.sub === "supplies"))) render(true); });

  const cfg = checkConfig();
  state.configIssue = cfg.issue || null;
  if (cfg.mode === "blocked") {
    setSync(t("配置有安全问题"), true);
    $("#main").innerHTML = `<div class="panel" role="alert" style="border:2px solid var(--out)"><b>${t("已停止连接云端")}</b><p>${esc(t(cfg.issue))}</p></div>`;
    return;
  }
  if (cfg.mode === "cloud") {
    if (!window.supabase) { setSync(t("云端库加载失败"), true); return toast(t("无法加载 Supabase SDK，请检查网络后刷新")); }
    setStore(CloudStore);
    CloudStore.sb = window.supabase.createClient(cfg.url, cfg.key);
    let started = false;
    const start = async (session) => {
      if (started || !session) return;
      started = true; state.user = session.user;
      // 邀请码直接进入：匿名登录成功后先加入家庭，再走正常流程
      if (state.pendingJoin) {
        const { code, name } = state.pendingJoin; state.pendingJoin = null;
        const { data, error } = await CloudStore.sb.rpc("join_household", { p_code: code, p_display_name: name });
        if (error) {
          started = false;
          await CloudStore.sb.auth.signOut();   // 加入失败就不保留这个匿名身份
          return renderLogin(error.message.includes("invalid") ? t("邀请码不正确，请向家人确认。") : t("加入失败：{msg}", { msg: error.message }));
        }
        localStorage.setItem("hmh-hid", data);
      }
      afterLogin();
    };
    CloudStore.sb.auth.onAuthStateChange((evt, session) => {
      if (evt === "SIGNED_IN") start(session);
      if (evt === "SIGNED_OUT") { started = false; if (!state.pendingJoin) renderLogin(); }
    });
    const { data: { session } } = await CloudStore.sb.auth.getSession();
    state.route = parseRoute();
    if (session) start(session); else renderLogin();
  } else {
    setStore(DemoStore);
    DemoStore.load();
    state.household = { name: t("演示家庭（数据仅存于本浏览器）") };
    state.route = parseRoute();
    await refresh();
  }
}
boot();
