import "./core/autosize.js";
import { initPrivacy, setMoneyHidden, setPrivacyRoute } from "./core/privacy.js";
import { findItem, normName } from "./core/item-match.js";
import { saveShopScan, shopScanAction } from "./pantry/shop-scan.js";
import { alertsOf, enrich, openShopFor } from "./core/logic.js";
import { state } from "./core/state.js";
import { CloudStore, DemoStore, Store } from "./core/store.js";
import { $, MUTE_FOREVER, applyDraft, armed, catOf, fillUnitList, fmtDate, fmtDay, formDraft, setDateFormat, inSpace, isGear, money, num, spaceOf, storedStep, toast, confirmDelete } from "./core/util.js";
import { go, goBack, href } from "./core/router.js";
import { debounce, pageMore, pageSize, setPageSize } from "./core/pager.js";
import { overviewHref } from "./bills/trail.js";
import { setOverviewRange } from "./bills/overview-views.js";
import { exportAllCsv, renderAllList, verifyBillIds } from "./bills/all-views.js";
import { ignoreSuggestion, linkBillAsset } from "./bills/asset-ui.js";
import { deleteMedBill, personAddCancel, personAddDo, personMerge, personMergeCancel, personMergeOpen, personUse, onPersonPick, deleteMedPay, onKindPick, saveMedBillForm, saveMedPayForm } from "./bills/medical-views.js";
import { myName, deviceLinkDo, deviceLinkNew, removePerson, savePersonForm, setDevicePerson } from "./settings/family-people.js";
import { ackLoginDo, loginsMore } from "./settings/logins.js";
import { initCompactFilters, watchStick } from "../shared/compact-filters.js";
import { miniBarEl } from "./minibar.js";
import { initSwipeRows } from "./swipe-rows.js";
import { ownerMatch } from "./pantry/owner.js";
import { initIncome } from "./income/views.js";
import { initQuickDrag } from "./quick-drag.js";
import { initSelectSearch } from "./select-search.js";
import { aiDraftCard, applyCatalogPick, cardHintHtml, deleteCard, payAcctValue, pickResultHtml, purchasePayFields, rememberCard, resolvePayAccount, runCleanup, saveCardForm, setCardActive, viewCards } from "./bills/cards-views.js";
import "./bills/cards.js";
import { glossaryOf, t } from "./core/i18n.js";
import { DEFAULT_QUICK, initTodayRender, quickList, saveQuick, setTodayPref } from "./today.js";
import { enableWeather, setTempUnit } from "./core/weather.js";
import { registerAlerts } from "./core/alerts.js";
import { pantryAlertItems } from "./core/logic.js";
import { billAlertItems } from "./bills/logic.js";
import { printSheet } from "./settings/print.js";
import { bindShops, shopsAction } from "./shops/views.js";
import { bigThreshold, budgetAction, budgetAlertItems, groupForCategory } from "./bills/budget.js";
import { effNature, l1IdOf, l2IdOf, natureOptions } from "./core/taxonomy.js";
import "./settings/income.js";
import { escrowAlertItems } from "./bills/escrow.js";
import "./bills/finance.js";
import "./bills/finance-alerts.js";
import { initNetWorth } from "./bills/net-worth.js";
import { shopSelText, shopVisibleIds } from "./pantry/views.js";
import { catNeed, moveCat, renderInvList, secNeed, selBarText, setFold, setInvView, visibleItemIds, renderShopList } from "./pantry/views.js";
import { canManageHome, famMembers, familyHref, meId, profileErr, readMemberForm, reloadMembers } from "./settings/members.js";
import { refreshBackupUi } from "./settings/backup-views.js";
import * as Backup from "./core/backup.js";
import * as Ask from "./core/ask.js";
import { isRetired, maintFilter } from "./house/assets-logic.js";
import { addAiMissing, copyPrompt, runAi } from "./pantry/ai.js";
import { canonName, canonSubs, catFormOf, newCatKey } from "./core/categories.js";
import { customLocations, deleteLocation, groupOf, saveLocationForm } from "./core/locations.js";
import { aiReady, aiSettings, clearModelMarks, dismissAiChanges, resetUsage, testModel } from "./core/ai.js";
import { hydrateModelSelect, onModelPick, saveAiForm } from "./settings/views.js";
import { applySpendDrill, cleanStore, clearSpendFilter, exportAnnual, exportSpendList, patchSpendRow, rememberStore, renderSpendList, renderSpendRecords, spendList, spendRowsLoaded } from "./stats/views.js";
import { customChanged, setFinUnit } from "./core/time-range.js";
import { payeeAction, payeeChange, payeeInput } from "./stats/payees.js";
import { matchOpenShopping, showPurchaseDup } from "./stats/dup-check.js";
import { initHomeStats } from "./stats/home-stats.js";
import { PAGE_RENDER, refresh, resetListPages } from "./app/data.js";
import { addAlertsToShopping, addRecipeMissing, markBought, removeFromShopping, setItemQty, setItemUnit, setShopQty, setShopUnit, stepShopQty } from "./app/actions/shopping.js";
import { afterLogin, doCreateHousehold, doJoinHousehold, dupNameCheck, waitTimer } from "./app/auth/household.js";
import { analyze, applyCloseout, applyTypeDefaults, askConfirm, askRemind, assetTemplateItems, backfillPayments, billTemplateItems, cancelDeal, completeBuy, completeVehicleDeal, copyAnswer, copyGeneralPrompt, dealTasks, deleteBillPay, deleteCustomTask, deleteDealEvent, deleteSeasonTask, fixAction, leaveAsset, leaveBill, leaveItem, onAssetFormChange, onMaintFormChange, openDeal, openItem, payExpNote, pickSpace, pickSupplyAdd, pickTopic, planAction, quickVerify, readHouseForm, recallAction, renderAssetList, renderMaintLogs, runAiPage, runDealAi, runFix, saveAssessForm, saveAssetForm, saveBillForm, saveBillPayForm, saveCandForm, saveDealEventForm, saveDealForm, saveDealTaskForm, saveItemForm, saveMaintForm, saveOfferForm, savePlanForm, saveRecallForm, saveSeasonForm, scanAction, setDealAiConsent, shiftAlertSource, shiftTasksMonth, startDeal, subOptions, supplyItem, templateItems, toggleDealSkip, toggleDealTask, togglePlanCheck, toggleTask, unitRow, updateHoaTotal } from "./app/lazy-modules.js";
import { boot } from "./app/boot.js";
import { changeLang, toList } from "./app/page-events.js";
import { doBackup, doRestore } from "./app/actions/backup.js";
import { doLogin, doPhoneLogin, doQuickJoin, doVerifyOtp, renderLogin } from "./app/auth/login.js";
import { exportJson } from "./app/actions/export-notify.js";
import { freeDefault } from "./app/route.js";
import { friendlyErr } from "./app/errors.js";
import { markDirty } from "./app/unsaved.js";
import { render } from "./app/render.js";
import { saveHouseForm } from "./app/actions/house-form.js";
import { saveStatToggles, setSharedRange } from "./app/actions/stats-prefs.js";
import { uiKind } from "./app/chrome.js";
import "./app/lazy-modules.js";
import "./app/lazy-init.js";
import "./app/page-table.js";
import "./app/route.js";
import "./app/page-events.js";
import "./app/auth/login.js";
import "./app/auth/household.js";

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});
// 提醒总线：各模块的适配器（新增提醒来源只需在这里注册一个函数）
[pantryAlertItems, billAlertItems, budgetAlertItems, escrowAlertItems].forEach(registerAlerts);
/* ───────────── 交互（事件委托） ───────────── */
export const main = $("#main");
// 手机：列表页的“搜索 + 一排下拉框”收成一行（搜索框 + 筛选按钮），滑动时固定在顶栏 / 路径下面；路径条（面包屑）也固定
initCompactFilters({ root: main, ui: uiKind });
miniBarEl();
   // 手机上滚动后固定的站名窄条（js/minibar.js）
document.addEventListener("toggle", (e) => { const d = e.target; if (d?.matches?.("details.pv-card[data-fold]")) setFold(d.dataset.fold, d.open); }, true);
   // 储藏概览大卡片折叠 / 展开：记在本机
initSwipeRows({ kinds: ["asset", "rs", "item", "income", "budget-goal", "med-pay", "person", "bill-pay", "maint", "shop", "purchase", "card", "store", "deal"], altKinds: ["asset", "card", "deal", "shop", "item", "rs"], del: () => t("删除"), release: () => t("松手删除"), alt: () => t("停用"), altRelease: () => t("松手停用") });
initIncome({ render, refresh });
initNetWorth({ render });
initHomeStats(render);
initTodayRender(() => render());
   // 今日天气取回来后重画
initPrivacy({ toast });
 setPrivacyRoute(() => state.route);
   // 金额遮挡：外出 / 在家两种模式；表格 / 图表局部重画时按当前页面再标   // 我的 → 家里的数字：近一年日志读完后重画
initSelectSearch();
   // 选项很多的下拉（分类等）变成可搜索的（js/select-search.js）
initQuickDrag({ isEditing: () => !!state.quickEdit, enter: () => { state.quickEdit = true; state.quickAdd = false; render(); }, save: async (ids) => { try { await saveQuick(ids); } catch (e) { toast(t("保存失败：{msg}", { msg: e.message })); } render(); } });
   // 今日页快捷操作：长按进入编辑并拖动排序   // 银行 / 信用卡 CSV 导入（花费 → 银行导入）
// 「⋯」更多操作菜单：点别处或点菜单里的某项就收起（原生 details 不会自己收）
document.addEventListener("click", (e) => { document.querySelectorAll("details.act-more[open]").forEach((d) => { if (!d.contains(e.target) || e.target.closest(".act-item")) d.open = false; }); }, true);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") document.querySelectorAll("details.act-more[open]").forEach((d) => { d.open = false; d.querySelector("summary")?.focus(); }); });
watchStick({ header: () => document.querySelector(window.matchMedia("(max-width: 440px)").matches ? "#minibar" : ".topbar"), path: ".crumb" });
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
const searchSoon = debounce((fn) => fn());
document.addEventListener("click", (e) => { const d = document.querySelector("details.bill-fab[open]"); if (d && !d.contains(e.target)) d.open = false; });
main.addEventListener("input", (e) => {
  // 搜索框：筛选条件马上记下，列表停下 ~200ms 再重画（不是每敲一个字都重画整张列表）
  if (e.target.id === "invSearch") { state.filter.q = e.target.value; searchSoon(renderInvList); }
  if (e.target.id === "shopQ") { state.shopFilter.q = e.target.value; searchSoon(renderShopList); }   // 购物车搜索：只重画清单那块
  if (e.target.id === "maintSearch") { maintFilter.q = e.target.value; searchSoon(renderMaintLogs); }
  if (e.target.id === "spendSearch") { state.spendFilter.q = e.target.value; searchSoon(renderSpendList); }   // 停下 ~200ms 再查数据库
  if (payeeInput(e, searchSoon)) return;   // 收款方：搜索、合并后的名字
  if (e.target.id === "allSearch") { state.allFilter.q = e.target.value; searchSoon(renderAllList); }
  if (e.target.id === "assetSearch") { state.assetFilter.q = e.target.value; searchSoon(renderAssetList); }
  if (e.target.id === "offQ") {   // 停用的卡搜索：只重画那张列表，输入框不丢焦点
    (state.offFilter ||= { q: "", kind: "all", sort: "since" }).q = e.target.value;
    const panel = e.target.closest("details");
    searchSoon(() => { const ul = panel?.querySelector("ul.card-list"); if (!ul) return; const tmp = document.createElement("div"); tmp.innerHTML = viewCards(); const fresh = tmp.querySelector("details.ref-panel ul.card-list"); if (fresh) ul.replaceWith(fresh); });   // 整页 viewCards() 较重：停下再算
  }
  const df = e.target.closest("#dealForm, #dealTaskForm, #dealEventForm, #closeoutForm, #propertyForm, #planForm, #candForm, #offerForm"); if (df) markDirty(df, true);   // 提示还没保存
  if (e.target.matches("textarea[data-grow]")) autoGrow(e.target);
  const hf = e.target.closest("#houseForm"); if (hf && /^hoa_(dues|sa_)/.test(e.target.name || "")) updateHoaTotal(hf);   // HOA 金额 / 评估字段一改，每月总计卡马上重算
});
/** 说明 / 备注框：随内容长高（空着一行），接近上限时显示计数 */
function autoGrow(el) {
  el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`;
  const c = el.nextElementSibling; if (c?.classList.contains("grow-count")) { const max = +el.maxLength || 0; c.hidden = !(max && el.value.length >= max * 0.8); c.textContent = `${el.value.length}/${max}`; }
}
main.addEventListener("change", async (e) => {
  if (e.target.dataset?.dealSel) {   // 交易时间线：完成情况 / 阶段 / 显示 / 排序（下拉框）
    const v = e.target.value, k = e.target.dataset.dealSel;
    if (k === "filter") state.dealFilter = v; else if (k === "stage") state.dealStage = v; else if (k === "act") state.dealActFilter = v;
    else if (k === "sort") { state.dealSort = v === "asc" ? "asc" : "desc"; try { localStorage.setItem("hmh-deal-sort", state.dealSort); } catch { /* 忽略 */ } }
    return render(false);
  }
  if (e.target.matches("#spendList input[data-sel]")) {   // 多选删除：勾一笔
    const S = state.spendSel; if (!S) return; if (e.target.checked) S.add(e.target.dataset.sel); else S.delete(e.target.dataset.sel);
    const n = spendRowsLoaded().filter((p) => S.has(p.id)).length, c = $("#selCount"); if (c) c.textContent = t("已选 {n} 笔", { n }); const d = $('[data-action="spend-sel-del"]'); if (d) d.disabled = !n; return;
  }
  if (e.target.closest("#backupForm")) {   // 备份设置：改了就存（存本机）
    const f = e.target.closest("#backupForm"), targets = [...f.querySelectorAll('input[name="target"]:checked')].map((x) => x.value);
    Backup.saveSettings({ every: f.elements.every.value, days: Math.max(1, +f.elements.days.value || 14), targets, provider: f.elements.provider?.value || "any", gdPath: (f.elements.gdPath?.value || "").trim(), dbxPath: (f.elements.dbxPath?.value || "").trim() });
    const box = f.querySelector("[data-backup-days]"); if (box) box.hidden = f.elements.every.value !== "custom";
    if (e.target.name === "gdPath" || e.target.name === "dbxPath") refreshBackupUi();   // 路径改了：列表换到新文件夹
    if (["every", "provider", "target", "gdPath", "dbxPath"].includes(e.target.name)) return render(false);
    return;
  }
  if (e.target.id === "backupFile") {   // 选了备份文件：先看一眼，确认后才恢复
    const file = e.target.files?.[0]; if (!file) return;
    try { const d = JSON.parse(await file.text()); state.backupPreview = { ...Backup.inspect(d), data: d, from: file.name }; }
    catch { state.backupPreview = { ok: false, why: t("不是有效的 JSON 文件") }; }
    e.target.value = ""; return render(false);
  }
  if (e.target.id === "cardReviewMonth") { state.cardReviewMonth = e.target.value; return render(); }
  if (e.target.matches('#cardForm select[name="catalog"]')) return applyCatalogPick(e.target.value);   // 用卡：选了目录，按目录重画表单
  if (e.target.closest("#cardPickForm")) { const fe = e.target.form.elements; Object.assign(state.cardPick, { cat: fe.cat.value, merchant: fe.merchant.value.trim(), amount: fe.amount.value, abroad: fe.abroad.checked }); const o = $("#cardPickOut"); if (o) o.innerHTML = pickResultHtml(); return; }
  if (e.target.matches("input[data-store-for]")) { const li = e.target.closest(".shop-item"), s = state.shopping.find((x) => x.id === e.target.dataset.storeFor), h = li?.querySelector(".card-hint-slot"); if (h && s) h.innerHTML = cardHintHtml(s.category || state.items.find((i) => i.id === s.item_id)?.category, e.target.value); }   // 填了在哪买：刷新用卡建议
  if (e.target.name === "category" && e.target.form?.elements.nature && (e.target.closest("#purchaseForm") || e.target.closest("#spendEditForm"))) { const ns = e.target.form.elements.nature, v = ns.value; ns.innerHTML = natureOptions(v, { leaf: e.target.value }); }   // 换了分类：「按分类默认（…）」跟着变
  if (e.target.closest("#purchaseForm") && (e.target.name === "category" || e.target.name === "store" || e.target.name === "amount")) { const fe = e.target.form.elements, h = $("#purchaseCardHint"); if (h) h.innerHTML = cardHintHtml(fe.category.value, fe.store.value, fe.amount.value === "" ? null : num(fe.amount.value)); }
  if (e.target.matches("[data-inv-qty]")) return setItemQty(e.target.dataset.invQty, e.target.value);   // 库存物品行：直接改数量
  if (e.target.matches("[data-inv-unit]")) return setItemUnit(e.target.dataset.invUnit, e.target.value);   // 库存物品行：改单位（下拉或「其他…」手填）
  if (e.target.matches("input[data-qty-for]")) return setShopQty(e.target.dataset.qtyFor, e.target.value);
  if (e.target.matches("input[data-unit-for]")) return setShopUnit(e.target.dataset.unitFor, e.target.value);   // 购物车：改单位   // 购物车：直接输入数量
  if (e.target.id === "invCatSel") { Object.assign(state.filter, { cat: e.target.value, sub: "all" }); state.catSort = false; state.catForm = null; render(); }
  if (e.target.id === "invSubSel") { state.filter.sub = e.target.value; render(); }
  if (e.target.id === "invStatus") { state.filter.status = e.target.value; renderInvList(); }
  if (e.target.id === "invOwner") { state.filter.owner = e.target.value; renderInvList(); }
  if (e.target.id === "invLoc") { state.filter.loc = e.target.value; renderInvList(); }
  if (e.target.id === "invSort") { state.filter.sort = e.target.value; renderInvList(); }
  if (e.target.id === "ovRange") { setOverviewRange(e.target.value); render(); }
  if (e.target.dataset?.linkPerson) { try { await setDevicePerson(e.target.dataset.linkPerson, e.target.value || null); toast(t("已保存")); } catch (err) { toast(t("保存失败：{msg}", { msg: err.message })); } render(true); return; }   // 设备资料页：属于哪位家庭成员
  if (e.target.id === "ovAsset") { state.ovFilter.keepRange = true; go(overviewHref(e.target.value)); }   // 换资产 = 换路径（#/bills/overview/<资产键>），时间范围保持
  { const k = { allRange: "range", allAsset: "asset", allType: "type", allCat: "cat", allStatus: "status", allPay: "pay", allSort: "sort" }[e.target.id];
    if (k) { state.allFilter[k] = e.target.value; if (k === "range") render(); else renderAllList(); } }
  if (e.target.name === "kindPick") return onKindPick(e);
  if (e.target.matches?.("#medBillForm select[name=patient_id], #medBillForm select[name=guarantor_id]")) return onPersonPick(e);
  if (e.target.id === "medReportYear") { state.medYear = e.target.value; render(); }
  { const k = { maintKind: "kind", maintYear: "year" }[e.target.id]; if (k) { maintFilter[k] = e.target.value; renderMaintLogs(); } }
  { const k = { shopSt: "st", shopCat: "cat", shopSort: "sort" }[e.target.id]; if (k) { state.shopFilter[k] = e.target.value; render(); } }
  { const k = { assetType: "type", assetService: "service", assetWarranty: "warranty", assetLoc: "loc", assetSort: "sort" }[e.target.id]; if (k) { state.assetFilter[k] = e.target.value; renderAssetList(); } }
  { const k = { giftIssuer: "issuer", giftSort: "sort", giftUsed: "used" }[e.target.id]; if (k) { (state.giftFilter ||= { issuer: "all", sort: "balance", used: false })[k] = k === "used" ? e.target.checked : e.target.value; return render(false); } }   // 礼品卡的筛选 / 排序
  { const k = { offKind: "kind", offSort: "sort" }[e.target.id]; if (k) { (state.offFilter ||= { q: "", kind: "all", sort: "since" })[k] = e.target.value; return render(false); } }   // 停用的卡：种类 / 排序
  if (e.target.id === "cleanRecent") { state.cardCleanupRecent = e.target.checked; return render(false); }
  if (e.target.name === "location" && e.target.form?.elements.new_location) {   // 选“＋ 新位置…”：旁边出现输入框
    const inp = e.target.form.elements.new_location, on = e.target.value === "__new__";
    inp.hidden = !on; if (on) inp.focus();
  }
  if (e.target.id === "alertSource") { setTodayPref({ source: e.target.value === "all" ? null : e.target.value }); return render(); }
  if (e.target.id === "alertSort") { setTodayPref({ mode: e.target.value }); return render(); }
  if (e.target.closest("#aiSettingsForm") && e.target.name === "provider") {   // 换服务商：清掉上一家残留的模型名 / 地址（否则会把请求发到别家 → 404），重画 key 说明、默认模型、免费额度
    const f = e.target.form; f.elements.model.value = ""; f.elements.base.value = ""; if (f.elements.rpm) { f.elements.rpm.value = ""; f.elements.rpd.value = ""; }   // 上限是按服务商 / 模型的，一起清
    await saveAiForm(f); render(); return hydrateModelSelect();
  }
  if (e.target.closest("#aiSettingsForm") && e.target.name === "modelSel") {   // 选了模型：带入上限、自动保存
    return onModelPick(e.target);
  }
  if (e.target.closest("#itemForm") && e.target.name === "category") {
    const fe = e.target.form.elements;
    fe.subcategory.innerHTML = subOptions(e.target.value);
    if (!fe.item_id.value) fe.location.value = catOf(e.target.value).loc;
    // 换到家居耐用品分类时隐藏补货相关字段（保存时也会清掉它们）
    e.target.form.classList.toggle("is-gear", spaceOf(e.target.value) === "gear");
    e.target.form.classList.toggle("is-house", spaceOf(e.target.value) === "house");
  }
  if (e.target.closest("#assetForm") && (e.target.name === "kind" || e.target.name === "type")) return onAssetFormChange(e);
  if (e.target.closest("#maintForm") && e.target.name === "kind") return onMaintFormChange(e);
  if (e.target.closest("#seasonForm") && e.target.name === "mode") { e.target.form.classList.toggle("is-once", e.target.value === "once"); return; }
  if (e.target.closest("#billForm") && (e.target.name === "unit_amount" || e.target.name === "parking_amount")) { const f = e.target.form; f.elements.typical_amount.value = (Math.round((num(f.elements.unit_amount.value) + num(f.elements.parking_amount.value)) * 100) / 100).toFixed(2); f.elements.amount_type.value = "fixed"; return; }   // HOA：通常金额 = 单元费 + 车位费
  if (e.target.closest("#billForm") && e.target.name === "category") { e.target.form.classList.toggle("is-sub", window.BILLS.isSubCat(e.target.value)); e.target.form.classList.toggle("is-hoa", e.target.value === "hoa"); return; }   // 订阅 / 会员才显示种类与试用到期
  if (e.target.matches("input[data-task]")) {
    try { await toggleTask(e.target); } catch (err) { toast(t("操作失败：{msg}", { msg: friendlyErr(err.message) })); }
    return refresh();
  }
  if (e.target.matches("input[data-deal-task]")) {
    try { await toggleDealTask(e.target); } catch (err) { toast(t("操作失败：{msg}", { msg: friendlyErr(err.message) })); }
    return refresh();
  }
  if (e.target.matches("input[data-deal-ai]")) { setDealAiConsent(e.target.checked); return render(); }
  if (e.target.id === "langSel") return changeLang(e.target.value || null);
  if (e.target.matches("select[data-bill-pay]")) {   // 清单里的「怎么付」：自动扣款 · 某张卡 / 账户，或手动（可选默认账户 / 现金）
    const b = state.bills.find((x) => x.id === e.target.dataset.billPay);
    if (!b) return;
    const [mode, acct] = e.target.value.split(":"), autopay = mode === "auto";
    const pay = acct ? resolvePayAccount(acct, b.autopay_method) : { card_id: null, method: null };   // 卡 / 账户 / 现金 / 纸质支票 / 礼品卡 / 其他（保留原说明）
    const patch = { ...b, autopay, pay_channel: autopay ? "autopay" : (b.pay_channel === "autopay" ? "online" : b.pay_channel), pay_card_id: pay.card_id, autopay_method: pay.card_id ? null : pay.method };
    e.target.disabled = true;
    try { await Store.saveBill(patch); toast(autopay ? t("已标为自动扣款，到期前会提醒核对") : t("已改为手动缴费，到期前会提醒缴费")); }
    catch (err) { toast(t("操作失败：{msg}", { msg: friendlyErr(err.message) })); }
    return refresh();
  }
  if (e.target.matches('#cardForm select[name="kind"]')) {   // 用卡表单：换种类，只显示这种类有的字段
    const k = e.target.value;
    for (const el of e.target.form.querySelectorAll("[data-kind]")) el.hidden = !el.dataset.kind.split(" ").includes(k);
    return;
  }
  if (e.target.matches("select[data-pay-acct]")) {   // 付款账户下拉：选了「其他」才显示说明框
    const form = e.target.closest("form"), box = form?.querySelector("[data-pay-other]"); if (box) box.hidden = e.target.value !== "other";
    const exp = form?.querySelector("[data-pay-exp]"), note = form?.querySelector("[data-pay-exp-note]"), card = state.cards.find((c) => c.id === e.target.value);   // 账单表单：选了卡就不用填有效期
    if (exp) exp.hidden = !!card; if (note) { note.hidden = !card; note.textContent = payExpNote(card); }
    return;
  }
  if (e.target.id === "billTrend") { state.billsFilter.trend = e.target.value; render(); }
  if (e.target.id === "billsToggle") {
    state.billsEnabled = e.target.checked;
    try { localStorage.setItem("hmh-bills-off", e.target.checked ? "0" : "1"); } catch { /* 忽略 */ }
    toast(e.target.checked ? t("已打开财务") : t("已关闭财务，导航里不再显示")); render();
  }
  if (e.target.id === "moneyModeSel") { setMoneyHidden(e.target.value === "hide"); toast(e.target.value === "hide" ? t("已切回遮挡（外出）：点单个金额看 10 秒") : t("已切到常显示（在家）：页面在后台超过 30 分钟会自动切回遮挡")); }
  if (e.target.id === "tempUnitSel") { setTempUnit(e.target.value); toast(t("已保存")); render(); }   // 今日天气的温度单位（js/core/weather.js）
  if (e.target.id === "dateFmtSel") { setDateFormat(e.target.value); toast(t("日期显示为 {ex}", { ex: fmtDay(new Date()) })); render(); }
  if (e.target.id === "pageSizeSel") { setPageSize(e.target.value); resetListPages(); toast(t("列表每次显示 {n} 条", { n: pageSize() })); render(); }
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
    toast(e.target.checked ? t("已打开家居耐用品") : t("已关闭家居耐用品，导航里不再显示")); render();
  }
  { const k = { spendCat: "cat", spendNat: "nat", spendProp: "prop", spendStore: "store", spendRange: "range", spendSort: "sort" }[e.target.id]; if (k) { const f = state.spendFilter; f[k] = e.target.value; if (k === "store") f.stores = null; if (k === "cat") f.grp = null; if (k === "range") { f.months = null; f.dmax = null; f.year = "all"; f.mon = "all"; renderSpendRecords(); } renderSpendList(); } }   // 手动选了商店 / 年份 / 月份：去掉图表钻取带来的“一组商店 / 近 N 个月”；回到第一页重新查
  if (e.target.dataset?.action === "stats-excap") { state.stats.exCap = e.target.checked; saveStatToggles(); render(); }   // 花费统计：排除资本性 / 排除投资（概览趋势、分类、商店一起变）
  if (e.target.dataset?.action === "stats-exinv") { state.stats.exInv = e.target.checked; saveStatToggles(); render(); }
  if (e.target.id === "statsStoreL1") { state.stats.storeL1 = e.target.value; render(); }
  if (payeeChange(e)) return;
  if (e.target.id === "statsRange") { setSharedRange(e.target.value); render(); }   // 财务统一的时间范围（js/core/time-range.js）：花费、预算趋势、收入共用
  if (e.target.dataset?.spendC) { const f = state.spendFilter; f.range = customChanged(f.range, e.target.dataset.spendC, e.target.value); f.months = null; f.dmax = null; renderSpendRecords(); renderSpendList(); }   // 明细的自定义起止月份
  if (e.target.dataset?.finC) { setSharedRange(customChanged(state.stats.months, e.target.dataset.finC, e.target.value)); render(); }   // 自定义的起止月份
  if (e.target.id === "finUnit") { setFinUnit(e.target.value); render(); }   // 花费 / 预算趋势的时间范围：近 N 个月 / 某一年（数据库按月聚合，往年也一样）
  if (e.target.id === "statsMonth") { state.stats.month = e.target.value; render(); }
  if (e.target.id === "statsItem") { state.stats.itemId = e.target.value; render(); }
  if (e.target.id === "hhSwitch") { localStorage.setItem("hmh-hid", e.target.value); location.reload(); }
});
// 记录性质的日期框带 max（不能晚于今天）：选择器里已经灰掉；表单多是 novalidate，手动输入的未来日期在这里统一拦住。
// 到期日、预约、计划这些能选未来的日期框不带 max，不受影响。
document.addEventListener("submit", (e) => {
  const late = [...e.target.querySelectorAll('input[type="date"][max], input[type="month"][max]')].find((el) => el.validity.rangeOverflow);
  if (!late) return;
  e.preventDefault(); e.stopImmediatePropagation();
  toast(t("日期不能晚于 {d}", { d: late.max })); late.focus();
}, true);
main.addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  try {
    if (f.id === "itemForm") return saveItemForm(f);
    if (f.id === "aiForm") { render(); await runAi(f); return render(); }   // 先画“生成中”，再画结果
    if (f.id === "aiPageForm") { const p = runAiPage(f); render(); await p; return render(); }
    if (f.id === "fixForm") { const p = runFix(); render(); await p; return render(); }   // 出了问题？先画“诊断中”，再画结果
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
      if (fe.parent && !(cur && !cur.custom)) row.parent = fe.parent.value || null;   // 自建分类：花费统计里挂在哪个二级分类下（空 = 按空间默认）
      if (cur && !cur.custom && !cf.hidden) {   // 内置分类保存时和默认完全一样：不留覆盖行（有就删掉），免得标“改过”
        const b = cur.base, same = canon === b.name && row.icon === b.icon && row.color === b.color && JSON.stringify(subs) === JSON.stringify(b.subs);
        if (same) { if (cf.id) await Store.deleteCategory(cf.id); state.catForm = null; toast(t("和默认一样，没有改动")); return refresh(); }
      }
      await Store.saveCategory(row);
      state.catForm = null; if (state.route.section !== "me") state.filter.cat = row.key;
      toast(editing ? t("分类已保存") : t("已添加分类 {name}", { name }));
      return refresh();
    }
    if (f.id === "aiSettingsForm") { await saveAiForm(f); toast(t("AI 设置已保存（只存在本机）")); render(); return hydrateModelSelect(); }
    if (f.id === "termsForm") {   // 自定义名称的翻译：每行 term + 简体 / English / 繁體；全空的行删掉
      let n = 0;
      for (const tr of f.querySelectorAll("[data-term]")) {
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
    if (f.id === "recallForm" || f.id === "recallFixForm" || f.id === "recallRefundForm") return saveRecallForm(f, { refresh, render });   // 设备召回：登记 / 修好了 / 退款
    if (f.id === "maintForm") {
      const btn = f.querySelector('button[type="submit"]'); btn.disabled = true;
      let ok = false;
      try { ok = await saveMaintForm(f); } finally { btn.disabled = false; }
      if (!ok) return;   // 校验没过（如车辆没选保养项目）：保留已填内容
      await refresh(); return go(`${href("asset", f.elements.asset_id.value)}?sec=log`, { replace: true });   // 记完 / 改完回到记录列表
    }
    if (f.id === "spendEditForm") {   // 花费记录就地编辑
      const e2 = f.elements, name = e2.name.value.trim(), amount = e2.amount.value === "" ? null : Math.round(num(e2.amount.value) * 100) / 100;   // 负数 = 退款 / 报销，照存
      if (!name) return toast(t("请填写名称"));
      const store = cleanStore(e2.store.value), day = e2.date.value, patch = { name, category: e2.category.value, amount, store };
      if (e2.card_id) Object.assign(patch, purchasePayFields(e2.card_id.value, spendList.rows.find((x) => x.id === f.dataset.id)));   // 原来的付款方式：用明细读到的那一行   // 卡 → card_id；现金 / 支票 / 礼品卡 / 其他 → method
      if (day) patch.purchased_at = new Date(`${day}T12:00:00`).toISOString();
      if (e2.nature) patch.nature = e2.nature.value || null;   // 经济性质：空 = 按分类默认（迁移 055）
      if (e2.property_id) patch.property_id = e2.property_id.value || null;
      await Store.updatePurchase(f.dataset.id, patch);
      const row = spendList.rows.find((x) => x.id === f.dataset.id), bp = e2.card_id && (state.billPayments.find((x) => x.purchase_id === f.dataset.id) || (row?.pay_id ? { id: row.pay_id, card_id: undefined } : null));   // 这笔是账单缴费记的花费：改了卡，缴费记录同步
      if (bp && (bp.card_id || null) !== (patch.card_id || null)) await Store.updateBillPayment(bp.id, { card_id: patch.card_id || null }).catch(() => {});
      if (store) rememberStore(store);
      patchSpendRow(f.dataset.id, patch);   // 先改明细里读到的那一行，页面立刻是新的
      if (state.spendDrafts) delete state.spendDrafts[f.dataset.id];
      state.spendEdit = null; toast(t("已保存修改")); render(); return refresh();
    }
    if (f.id === "billForm") return saveBillForm(f);
    if (f.id === "medBillForm") return saveMedBillForm(f);
    if (f.id === "cardForm") return saveCardForm(f);
    if (f.id === "medPayForm") return saveMedPayForm(f);
    if (f.id === "billPayForm") {
      const btn = f.querySelector('button[type="submit"]'); btn.disabled = true;
      const billId = f.elements.bill_id.value;
      try { await saveBillPayForm(f); } finally { btn.disabled = false; }
      await refresh();
      return go(`${href("bill", billId)}?sec=pay`, { replace: true });   // 记完 / 改完都回到全部缴费记录
    }
    if (f.id === "personForm") { const isNew = !f.dataset.id; if (await savePersonForm(f)) { await refresh(); if (isNew) return go(familyHref(), { replace: true }); render(true); } return; }   // 家庭成员详情页：保存基本资料
    if (f.id === "assessForm") {
      const billId = f.dataset.bill; if (!(await saveAssessForm(f))) return;
      await refresh(); return go(`${href("bill", billId)}?sec=assess`, { replace: true });
    }
    if (f.id === "billTemplateForm") {
      const idx = [...f.querySelectorAll('input[name="tpl"]:checked')].map((x) => +x.value);
      if (!idx.length) return toast(t("还没有勾选账单"));
      const list = billTemplateItems(idx);
      await Store.addBills(list);
      toast(t("已建立 {n} 条账单，记得补金额和到期日", { n: list.length }));
      go(href("bills", "all"));
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
    if (f.id === "dealForm") {   // 交易信息保存后回交易首页（清单）；保留 ?asset= / ?deal=
      await saveDealForm(f); f.dataset.saved = "1"; state.dealView = "list"; await refresh();
      const q = new URLSearchParams(state.route.q); q.delete("sec"); return go(`${href("house", "deal")}${q.toString() ? `?${q}` : ""}`, { replace: true });
    }   // 已保存：刷新时不再当作未保存改动
    if (f.id === "planForm") { const pid = await savePlanForm(f); state.planEdit = null; await refresh(); if (!f.elements.rec_id.value) go(`${href("house", "plan")}?p=${pid}`); return; }
    if (f.id === "candForm") { await saveCandForm(f); state.planEdit = null; return refresh(); }
    if (f.id === "offerForm") { await saveOfferForm(f); state.planEdit = null; return refresh(); }
    if (f.id === "dealEventForm") { await saveDealEventForm(f); state.dealEventEdit = null; return refresh(); }
    if (f.id === "dealTaskForm") { await saveDealTaskForm(f); state.dealTaskEdit = null; return refresh(); }
    if (f.id === "seasonForm") { if (await saveSeasonForm(f)) { state.seasonForm = null; return refresh(); } return; }
    if (f.id === "closeoutForm") { await applyCloseout(f); go(href("house", "overview")); return refresh(); }
    if (f.id === "assetTemplateForm") {
      const ids = [...f.querySelectorAll('input[name="tpl"]:checked')].map((x) => x.value);
      if (!ids.length) return toast(t("还没有勾选设备"));
      const have = new Set((state.assets || []).filter((a) => a.property_id === state.propertyId && !isRetired(a)).map((a) => normName(a.name)));
      const all = await assetTemplateItems(ids), list = all.filter((x) => !have.has(normName(x.name)));   // 这套房产已有同名的跳过
      if (list.length) await Store.addAssets(list, state.propertyId);
      toast(t("已生成 {n} 台设备档案", { n: list.length }) + (all.length > list.length ? t("；{m} 台已经有了，跳过", { m: all.length - list.length }) : ""));
      go(href("house", "assets"));
      return refresh();
    }
    if (f.id === "houseForm") return saveHouseForm(f);
    if (f.id === "templateForm") {
      const keys = [...f.querySelectorAll('input[name="tpl"]:checked')].map((x) => x.value);
      if (!keys.length) return toast(t("还没有勾选耗材"));
      const all = (await templateItems(keys)).map((x) => ({ ...x, property_id: state.propertyId || null })), list = all.filter((x) => !findItem(x.name));   // 推荐的消耗品归属当前这套房产   // 已有同名（忽略大小写、空格、全角半角）的跳过，重复点不会建第二件
      if (list.length) await Store.addItems(list);
      toast(t("已添加 {n} 项汽车房屋消耗品", { n: list.length }) + (all.length > list.length ? t("；{m} 项库存里已有，跳过", { m: all.length - list.length }) : ""));
      Object.assign(state.filter, { space: "house", cat: "all", q: "", status: "all" });
      go(href("house", "supplies"));
      return refresh();
    }
    if (f.getAttribute("id") === "purchaseForm") {
      const e2 = f.elements, item = e2.name.value.trim(), amount = num(e2.amount.value, NaN);
      if (!item || !Number.isFinite(amount) || amount < 0) return toast(t("请填写名称和金额"));
      const name = TRIP.tag(e2.trip?.value.trim(), item);   // 旅行：名称写成「【行程】项目」，按行程汇总用
      const signed = e2.refund?.checked ? -amount : amount;   // “退款 / 报销”：记成负数，统计里按净额算
      const day = e2.date.value || new Date().toISOString().slice(0, 10);
      const store = cleanStore(e2.store.value);
      const dups = await showPurchaseDup(f);   // 疑似重复：第一次点只提醒，内容没改再点一次才记
      if (dups.length && f.dataset.dupAck !== "1") { f.dataset.dupAck = "1"; return toast(t("可能重复了（见表单下面的提醒）。确认不是，再点一次“记一笔”。")); }
      f.dataset.dupAck = "";
      if (store) rememberStore(store);
      const payV = e2.card_id?.value || ""; rememberCard(payV);
      // 经济性质：空 = 按分类默认（迁移 055）。以前的「大件」门槛现在只是记的时候问一句：金额较大、算进日常的，要不要标成资本性支出
      const cat = e2.category.value;
      let nature = e2.nature?.value || null;
      if (!nature && signed >= bigThreshold() && effNature(cat, null) === "operating" && ["home_goods", "digital", "apparel", "shop_misc", "home_maint", "transport"].includes(l2IdOf(cat)) && confirm(t("金额较大（{a}），标为资本性支出？\n资本性支出（大件、装修、买车…）不算进日常生活成本，现金流出里照样有。", { a: money(signed) }))) nature = "capital";
      // 关联房产：选了就记；没选、分类在「房产住房」下、家里只有一套房的，自动挂上这套
      const props = state.properties.filter((p) => !p.archived), property_id = e2.property_id?.value || (l1IdOf(cat) === "housing" && props.length === 1 ? props[0].id : null);
      const linkItem = findItem(item);   // 名称和已有物品写法一样：关联上这件（不新建物品、不加库存）
      await Store.addPurchase({ item_id: linkItem?.id || null, name, category: cat, quantity: null, unit: null, store,
        amount: Math.round(signed * 100) / 100, currency: Units.region.currency, purchased_at: new Date(`${day}T12:00:00`).toISOString(), ...purchasePayFields(payV),
        ...(nature ? { nature } : {}), ...(property_id ? { property_id } : {}) });
      const cart = signed > 0 ? matchOpenShopping({ name: item, at: new Date(`${day}T12:00:00`) }) : null;   // 购物车里有同名的未买项：顺手标成已买到
      if (cart) await Store.saveShopping({ id: cart.id, status: "bought", bought_at: new Date(`${day}T12:00:00`).toISOString(), amount: Math.round(signed * 100) / 100, claimed_by_name: cart.claimed_by_name || state.displayName });
      toast(t("已记录 {name} {m}", { name, m: money(signed) }) + (cart ? t("；购物车里的「{n}」已标成已买到", { n: cart.name }) : "")); return refresh();
    }
    if (f.id === "shopScanForm") return saveShopScan(refresh);
    if (f.id === "shopForm") {
      const name = f.elements.name.value.trim();
      if (!name) return;
      const linked = findItem(name);   // 写法一样就算同一件（以前要一字不差）
      const openSame = state.shopping.find((s) => s.status !== "bought" && (linked ? s.item_id === linked.id : normName(s.name) === normName(name)));
      if (openSame) return toast(t("{name} 已经在清单里了", { name: openSame.name }));
      await Store.saveShopping({ name, quantity: Math.max(0.1, num(f.elements.quantity.value, 1)), unit: Units.normalize(f.elements.unit.value) || linked?.unit || Units.guess(name) || "", item_id: linked?.id || null, category: f.elements.category.value || linked?.category || "other" });   // 没填单位：已有物品用它的，新的按名字猜（牛奶 → 瓶）
      { const est = num(f.elements.estimate?.value, NaN); state.shopAdvice = Number.isFinite(est) && est > 0 ? { name, estimate: est, group: groupForCategory(linked?.category || f.elements.category.value, est) } : null; }
      toast(t("已加入：{name}", { name }));
      if (state.route.sub === "add") { f.reset(); f.elements.name.focus(); }   // 加入清单页：清空表单接着加
      refresh();
    }
    if (f.id === "memberForm") {   // 成员资料：本人改自己的，家主改任何人的（数据库函数同样校验，迁移 052）
      const err = $("#memberErr"); if (err) err.textContent = "";
      try {
        const p = readMemberForm(f), id = f.dataset.id;
        dupNameCheck(p.display_name, id);
        await Store.setMemberProfile(id, p);
        if (id === meId()) state.displayName = p.display_name;
        await reloadMembers();
      } catch (ex) { if (err) { err.textContent = profileErr(friendlyErr(ex.message)); return; } throw ex; }
      toast(t("资料已保存")); return go(familyHref(), { replace: true });
    }
    if (f.id === "loginForm") return doLogin(f);
    if (f.id === "phoneForm") return doPhoneLogin(f);
    if (f.id === "otpForm") return doVerifyOtp(f);
    if (f.id === "quickForm") return doQuickJoin(f);
    if (f.id === "createHhForm") return doCreateHousehold(f);
    if (f.id === "joinHhForm") return doJoinHousehold(f);
  } catch (err) { toast(t("操作失败：{msg}", { msg: friendlyErr(err.message) })); }
});
/* 图表色块、图例、名称、数字卡片：点一下（或 Enter / 空格）看对应的花费明细 */
function drillTo(qs) {
  if (qs.startsWith("inc=1")) return go(`${href("bills", "income")}?tab=records&${qs}`);   // 收入图表（带 inc=1）：到 收入 → 明细，筛选由 income/views.js 的 applyIncomeDrill 套上
  if (state.billsEnabled) return go(`${href("bills", "spend")}?tab=records&${qs}`);
  applySpendDrill(new URLSearchParams(qs)); render(); $("#spendRecords")?.scrollIntoView({ block: "start" });   // 账单模块关闭：明细就在统计页下面
}
/* 购物车多选：点行或勾选框选中 / 取消，只更新这一行和底部操作条 */
function pickShop(id, on) {
  if (!state.shopSel) return;
  if (on) state.shopSel.add(id); else state.shopSel.delete(id);
  const row = document.querySelector(`[data-row-sel-shop="${CSS.escape(id)}"]`);
  if (row) { row.classList.toggle("is-picked", on); const c = row.querySelector(".shop-chk"); if (c) c.checked = on; }
  const n = document.querySelector(".shop-selbar .inv-seln"); if (n) n.textContent = shopSelText();
  const b = document.querySelector('[data-action="shop-sel-remove"]'); if (b) b.disabled = !state.shopSel.size;
}
main.addEventListener("change", (e) => { if (e.target.matches?.(".shop-chk")) pickShop(e.target.dataset.id, e.target.checked); });
main.addEventListener("click", (e) => {
  const row = e.target.closest?.("[data-row-sel-shop]"); if (!row || e.target.closest("a, button, input, select, textarea, label, details")) return;
  pickShop(row.dataset.rowSelShop, !state.shopSel?.has(row.dataset.rowSelShop));
});
/* 库存多选：点行（或勾选框）选中 / 取消，只更新这一行和底部操作条，不重画整页 */
function pickRow(id, on) {
  if (!state.invSel) return;
  if (on) state.invSel.add(id); else state.invSel.delete(id);
  const row = document.querySelector(`.inv-row[data-id="${CSS.escape(id)}"]`);
  if (row) { row.classList.toggle("is-picked", on); const c = row.querySelector(".inv-chk"); if (c) c.checked = on; }
  const n = document.querySelector(".inv-seln"); if (n) n.textContent = selBarText();
  document.querySelectorAll('.inv-selbar [data-action^="inv-sel-"]:not([data-action="inv-sel-all"])').forEach((b) => { b.disabled = !state.invSel.size; });
}
main.addEventListener("change", (e) => { if (e.target.matches?.(".inv-chk")) pickRow(e.target.dataset.selId, e.target.checked); });
main.addEventListener("click", (e) => {
  const row = e.target.closest?.("[data-row-sel]"); if (!row || e.target.closest("a, button, input, select, textarea, label")) return;
  if (e.target.closest(".inv-link")) return;
  pickRow(row.dataset.rowSel, !state.invSel?.has(row.dataset.rowSel));
});
/* 点行进编辑（2026-11-14）：带 data-row-open 的行，点到行里任何不是按钮 / 链接 / 输入框的地方，就打开它的编辑页 */
main.addEventListener("click", (e) => {
  const row = e.target.closest?.("[data-row-open]"); if (!row || e.defaultPrevented) return;
  if (e.target.closest("a, button, input, select, textarea, label, summary, [data-action]")) return;
  if (window.getSelection?.().toString()) return;   // 在选字，不跳
  location.hash = row.dataset.rowOpen.replace(/^#/, "");
});
/* 其余列表（账单、设备、花费、补货提醒、分类视图的物品卡…）同样点行就进编辑：行里只有一个「名称」链接 / 编辑按钮时，
 * 点行里任何不是按钮 / 链接 / 输入框的地方，等于点了它。行里有好几个名称链接的（不知道该去哪）不处理 */
const ROW_PRIMARY = 'a.link-name, a.asset-name, .item-title > button[data-action="edit"], .grow > button.link-name[data-action="edit"]';
main.addEventListener("click", (e) => {
  if (e.defaultPrevented || e.target.closest?.("[data-row-open], [data-row-sel], a, button, input, select, textarea, label, summary, [data-action], [data-drill], form, .crumb, nav")) return;
  const row = e.target.closest?.("li, article.item"); if (!row || !main.contains(row)) return;
  if (window.getSelection?.().toString()) return;
  const cands = [...row.querySelectorAll(ROW_PRIMARY)].filter((el) => el.closest("li, article.item") === row);
  if (cands.length === 1) cands[0].click();
});
main.addEventListener("click", (e) => { const d = e.target.closest?.("[data-drill]"); if (d) { e.preventDefault(); drillTo(d.dataset.drill); } });
main.addEventListener("keydown", (e) => { if (e.key !== "Enter" && e.key !== " ") return; const d = e.target.closest?.("[data-drill]"); if (d && !(d instanceof HTMLButtonElement)) { e.preventDefault(); drillTo(d.dataset.drill); } });
main.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const { action, id } = el.dataset;
  try {
    if (action?.startsWith("scan-")) return scanAction(action, el, { go, refresh });
    if (action?.startsWith("shops-")) return shopsAction(action, el, { render, go, refresh });
    if (action?.startsWith("shopscan-")) return shopScanAction(action, el, { render: () => render(false) });   // 拍照加入购物车（js/pantry/shop-scan.js）   // 常去的商店与特价（js/shops/views.js）
    if (action?.startsWith("fix-")) return fixAction(action, el, { refresh, render, go });   // 出了问题？诊断与配件
    if (action?.startsWith("recall-")) return recallAction(action, el, { refresh, render });   // 设备召回：清除标记 / 重新打开
    if (action?.startsWith("budget-") || action === "shop-advice-close") return budgetAction(action, { refresh, render }, el);
    if (action?.startsWith("payee-")) return payeeAction(action, el, { render });   // 花费 → 收款方（js/stats/payees.js）
    switch (action) {
      case "add-item": return openItem(null, { space: el.dataset.space });
      case "edit": return openItem(id);
      case "item-cancel": return leaveItem(false);
      case "item-delete":
        if (!confirmDelete(t("删除这个物品？"))) return;
        await Store.deleteItem(state.route.id); toast(t("已删除")); return leaveItem(true);
      case "asset-cancel": return leaveAsset(false);
      case "asset-delete":
        if (!confirmDelete(t("删除这台设备和它的保养记录？"))) return;
        await Store.deleteAsset(state.route.id); toast(t("已删除设备及其保养记录")); return leaveAsset(true);
      case "asset-row-del": {   // 设备列表里右滑删除（先确认；在这里问，取消时手势会把行弹回去）
        const ar = state.assets.find((x) => x.id === id);
        if (!window.confirm(t("删除设备「{name}」和它的保养记录？", { name: ar?.name || "" }))) return;
        await Store.deleteAsset(id); toast(t("已删除设备及其保养记录")); await refresh(); return render(true);
      }
      case "maint-del":
        if (!confirmDelete(t("删除这条保养记录？"))) return;
        await Store.deleteMaintLog(id); toast(t("已删除这条记录")); await refresh(); return render(true);
      case "tasks-prev": shiftTasksMonth(-1); return render();
      case "tasks-next": shiftTasksMonth(1); return render();
      case "tasks-today": state.tasksYM = null; state.seasonForm = null; return render();
      case "season-new": state.seasonForm = { id: null }; render(); $("#seasonForm input[name=name]")?.focus(); return;
      case "season-edit": state.seasonForm = { id: el.dataset.id }; render(); $("#seasonForm input[name=name]")?.focus(); return;
      case "season-cancel": state.seasonForm = null; return render();
      case "season-delete":
        if (!confirmDelete(t("删除这条任务？"))) return;
        await deleteSeasonTask(el.dataset.id); state.seasonForm = null; toast(t("已删除这条任务")); return refresh();
      case "wx-enable": { el.disabled = true; const ok = await enableWeather(() => render()); if (!ok) { el.disabled = false; toast(t("没拿到位置：浏览器里允许定位后再点一次")); } return; }   // 今日日期旁的天气（js/core/weather.js）
      case "today-view": setTodayPref({ view: el.dataset.v }); return render();   // 待办 | 注意事项：按模块 / 按优先级
      case "today-pref": {
        const k = el.dataset.key;
        if (k === "mode") setTodayPref({ mode: "severity" }); else if (k === "mode-property") setTodayPref({ mode: "property" });
        else setTodayPref({ [k]: !state.today[k] });
        return render();
      }
      case "today-source": setTodayPref({ source: state.today.source === el.dataset.source ? null : el.dataset.source }); return render();
      case "quick-edit": state.quickEdit = !state.quickEdit; state.quickAdd = false; state.quickSwap = null; return render();
      case "quick-open": if (state.quickSwap) state.quickSwap = null; else state.quickAdd = !state.quickAdd; return render();   // 「取消」：关掉改成 / 添加面板
      case "quick-swap": state.quickSwap = state.quickSwap === el.dataset.id ? null : el.dataset.id; state.quickAdd = false; return render();   // 编辑模式点格子：改成别的快捷操作
      case "quick-swap-do": { const h = $("#quickSel")?.value, list = quickList(), i = list.indexOf(el.dataset.id); if (h && i >= 0) { list[i] = h; await saveQuick([...new Set(list)]); } state.quickSwap = null; return render(); }
      case "quick-add": { const h = $("#quickSel")?.value; if (h) await saveQuick([...new Set([...quickList(), h])]); state.quickAdd = false; return render(); }
      case "quick-del": await saveQuick(quickList().filter((x) => x !== el.dataset.id)); return render();
      case "quick-reset": await saveQuick(DEFAULT_QUICK()); toast(t("已恢复默认快捷操作")); return render();
      case "quick-run": if (el.dataset.id === "action:print") go(`${href("me", "settings")}?sec=print`); return;   // 打印：进入 设置 → 打印
      case "print-run": return printSheet(el.dataset.kind, el.dataset.kind === "spend" ? { months: +($("#printRange")?.value || +state.stats.months || 6), useFilter: !!el.dataset.filtered } : $("#printProp")?.value || "all");
      case "inv-space": return go(el.dataset.space === "house" ? `${href("pantry", "inventory")}?space=house` : el.dataset.space === "gear" ? href("pantry", "gear") : href("pantry", "inventory"));
      case "unit-add": { const host = $("#unitRows"); if (host) { host.insertAdjacentHTML("beforeend", unitRow()); host.lastElementChild.querySelector("select")?.focus(); } return; }   // 固定装置：再加一处位置
      case "unit-del": { const row = el.closest(".unit-row"), host = row?.parentElement; if (row && host) { row.remove(); if (!host.children.length) host.insertAdjacentHTML("beforeend", unitRow()); } return; }
      case "supply-add": {   // 设备页“相关耗材”：一键把推荐耗材加进库存
        const it = await supplyItem(el.dataset.name); if (!it) return;
        const have = findItem(it.name); if (have) { toast(t("库存里已有「{name}」", { name: have.name })); return go(href("item", have.id)); }
        await Store.addItems([it]); toast(t("已添加到库存：{name}", { name: it.name })); return refresh();
      }
      case "alerts-prev": shiftAlertSource(-1); return render();
      case "alerts-next": shiftAlertSource(1); return render();
      case "ov-group": state.ovFilter.group = el.dataset.group === "cycle" ? "cycle" : "asset"; return render();   // 账单概览：账单分组切换（按资产 / 按周期）
      case "login-ack": await ackLoginDo(id); return render(true);   // 登录记录：是我们家人
      case "logins-more": await loginsMore(); return;   // 登录记录：再往前 6 天
      case "person-del-page": {   // 家庭成员详情页的「删除」：名下没有设备时才有这个按钮
        if (!confirmDelete(t("删除这位家庭成员？相关账单里的名字会保留，但不再关联到这个人。"))) return;
        await Store.deletePerson(id); state.people = await Store.listPeople(); toast(t("已删除")); return go(familyHref(), { replace: true });
      }
      case "person-remove": await removePerson(id); await refresh(); return render(true);
      case "person-new-cancel": return go(familyHref(), { replace: true });
      case "device-link": await deviceLinkDo(); return render(true);   // 这台设备是谁？→ 选已有的人
      case "device-link-new": await deviceLinkNew(); return render(true);   // …或新建一个人
      case "bill-cancel": return leaveBill(false);
      case "assess-cancel": return go(`${href("bill", state.route.id)}?sec=assess`, { replace: true });
      case "assess-del": {
        if (!confirmDelete(t("删除这笔摊派和它的付款计划？已缴的缴费记录保留。"))) return;
        await Store.deleteAssess(id); toast(t("已删除")); await refresh(); return go(`${href("bill", state.route.id)}?sec=assess`, { replace: true });
      }
      case "billpay-cancel": return go(`${href("bill", state.route.id)}?sec=pay`, { replace: true });   // 缴费表单取消：回全部缴费记录
      case "bill-delete":
        if (!confirmDelete(t("删除这个账单和它的缴费记录？"))) return;
        await Store.deleteBill(state.route.id); toast(t("已删除账单及其缴费记录")); return leaveBill(true);
      case "billpay-del":
        if (!confirmDelete(t("删除这条缴费记录？"))) return;
        { const back = await deleteBillPay(id); toast(back ? t("已删除这条记录，到期日回到 {d}", { d: fmtDate(back) }) : t("已删除这条记录")); }
        await refresh(); return render(true);
      case "bill-verify": el.disabled = true; await quickVerify(id); return refresh();
      case "bill-link-asset": el.disabled = true; try { await linkBillAsset(id, el.dataset.asset); toast(t("已挂到这辆车上")); } catch (err) { toast(t("操作失败：{msg}", { msg: friendlyErr(err.message) })); } return refresh();
      case "bill-link-ignore": ignoreSuggestion(id); return render(true);
      case "billpay-backfill": el.disabled = true; try { await backfillPayments(el.dataset.id); } catch (err) { toast(t("补标失败：{msg}", { msg: friendlyErr(err.message) })); } return refresh();
      case "all-verify": {   // 批量「已核对」：只对自动扣款、过了日子还没记录的账单；每张记一条「已核对」缴费，可在账单的缴费记录里单独删
        const ids = verifyBillIds(); if (!ids.length) return;
        if (!window.confirm(t("把这 {n} 张自动扣款账单标为已核对？每张记一条“已核对”缴费（金额按通常金额 / 最近均值），记错了可以在账单的缴费记录里单独删除。", { n: ids.length }))) return;
        el.disabled = true; let done = 0;
        try { for (const bid of ids) { await quickVerify(bid); done++; } } catch (err) { toast(t("操作失败：{msg}", { msg: friendlyErr(err.message) })); }
        if (done) toast(t("已核对 {n} 张账单", { n: done }));
        return refresh();
      }
      case "all-csv": { const n = exportAllCsv(); return toast(t("已导出 {n} 期账单", { n })); }
      case "property": {   // 切换当前房产：房屋资料、设备、季节任务随之切换
        if (id === state.propertyId) return;
        state.propertyId = id; try { localStorage.setItem("hmh-property", id); } catch { /* 忽略 */ }
        state.houseDraft = null; return refresh();
      }
      case "house-open": {   // 房产列表 → 这套房产的概览
        if (id !== state.propertyId) { state.propertyId = id; try { localStorage.setItem("hmh-property", id); } catch { /* 忽略 */ } state.houseDraft = null; }
        go(href("house", "overview")); return refresh();
      }
      case "property-edit": if (!id && !canManageHome()) return toast(t("只有家主可以新增房产")); state.editProperty = id || "new"; return render();
      case "property-cancel": state.editProperty = null; return render();
      case "property-delete": {   // 删除房产（家主）：先弹确认，说清楚哪些记录保留（只是不再关联房产）、哪些随房产一起删
        if (!canManageHome()) return toast(t("只有家主可以删除房产"));
        const p = state.properties.find((x) => x.id === id); if (!p) return;
        if (!(await freeDefault(p))) return;
        if (!window.confirm(t("删除“{name}”？\n\n账单、花费记录和借贷会保留，只是不再关联这套房产（房产 ID 变成空）。\n房屋资料、设备与保养记录、季节任务、交易、估值会跟着房产一起删除，不能恢复。\n\n只是不再持有或租住的话，建议用“归档”：所有数据都保留，可随时恢复。", { name: p.name }))) return;
        await Store.deleteProperty(p.id); toast(t("已删除“{name}”", { name: p.name }));
        await refresh(); if (state.route?.section === "house") go(href("house")); return;
      }
      case "deal-start": await startDeal(el.dataset.kind, el.dataset.asset || null); return refresh();
      case "deal-delete": {   // 历史交易行：删除这条交易记录（左滑 / 行内按钮）
        if (!confirmDelete(t("删除这条历史交易？只删除这条交易记录和它的清单、时间线；不会改动房产 / 车辆现在的状态，也不会删除已记入花费的款项。"))) return;
        const id = el.dataset.deal; try { await Store.deleteDeal(id); } catch (err) { return toast(t("操作失败：{msg}", { msg: friendlyErr(err.message) })); }
        toast(t("已删除这条历史交易"));
        if (state.route?.q?.get("deal") === id) { const q = new URLSearchParams(state.route.q); q.delete("deal"); q.delete("sec"); go(`${href("house", "deal")}${q.toString() ? `?${q}` : ""}`, { replace: true }); }
        return refresh();
      }
      case "deal-cancel": if (!armed(el, t("再点一次确认取消"))) return; await cancelDeal(el.dataset.deal || null); return refresh();
      case "deal-closeout": {
        const d = el.dataset.deal ? state.deals.find((x) => x.id === el.dataset.deal) : await openDeal();
        if (!d) return;
        if (d.asset_id) { if (!armed(el, t("再点一次确认完成"))) return; await completeVehicleDeal(d); return refresh(); }
        if (d.kind === "buy") { if (!armed(el, t("再点一次确认已交割"))) return; await completeBuy(); return refresh(); }
        state.closeout = true; return go(`${href("house", "deal")}?sec=closeout`);
      }
      case "plan-new": case "plan-edit": case "plan-cancel": case "plan-status": case "plan-delete": case "cand-new": case "cand-edit": case "cand-delete": case "cand-win": case "offer-new": case "offer-edit": case "offer-delete":
        return planAction(action, el, { render, refresh, go });   // 买卖计划（迁移 078）
      case "plan-check": return togglePlanCheck(el.dataset.kind, el.dataset.stage, Number(el.dataset.idx), el.checked);   // 看房 / 看车清单：只存这台设备
      case "plan-open-property": {   // 买卖计划 → 卖房：先切到这套房产，再进它的交易页
        if (id !== state.propertyId) { state.propertyId = id; try { localStorage.setItem("hmh-property", id); } catch { /* 忽略 */ } state.houseDraft = null; }
        go(href("house", "deal")); return refresh();
      }
      case "deal-task-skip": await toggleDealSkip(el.dataset.deal, el.dataset.key, el.dataset.skip === "1"); state.dealTaskEdit = null; return refresh();
      case "deal-task-edit": state.dealTaskEdit = { deal: el.dataset.deal, key: el.dataset.key }; render(); $("#dealTaskForm input[name=due_on]")?.focus(); return;
      case "deal-task-new": state.dealTaskEdit = { deal: el.dataset.deal, key: "", stage: el.dataset.stage || "special" }; render(); $("#dealTaskForm input[name=name]")?.focus(); return;
      case "deal-task-cancel": state.dealTaskEdit = null; return render();
      case "deal-due-reset": el.form.elements.due_on.value = el.dataset.plan || ""; return markDirty(el.form, true);   // 只回填输入框，点保存才生效
      case "deal-task-delete":
        if (!confirmDelete(t("删除这条自定义事项？"))) return;
        await deleteCustomTask(el.dataset.id); state.dealTaskEdit = null; toast(t("已删除这条事项")); return refresh();
      case "deal-event-new": state.dealEventEdit = { deal: el.dataset.deal, id: "", key: el.dataset.key || "" }; render(); { const f = $("#dealEventForm"); f?.scrollIntoView({ block: "center" }); f?.elements.title?.focus(); } return;
      case "deal-event-edit": { const ev = state.dealEvents.find((x) => x.id === el.dataset.id); if (!ev) return; state.dealEventEdit = { deal: ev.deal_id, id: ev.id, key: "" }; render(); { const f = $("#dealEventForm"); f?.scrollIntoView({ block: "center" }); f?.elements.title?.focus(); } return; }
      case "deal-event-cancel": state.dealEventEdit = null; return render();
      case "deal-event-delete": if (!confirmDelete(t("删除这条进展记录？"))) return; await deleteDealEvent(el.dataset.id); state.dealEventEdit = null; toast(t("已删除")); return refresh();
      case "deal-ai-run": { const d = state.deals.find((x) => x.id === el.dataset.deal); if (!d) return; const p = runDealAi(d, await analyze(d, await dealTasks(d))); render(); await p; return render(); }
      case "deal-view":
        state.dealView = ["plan", "actual", "compare"].includes(el.dataset.view) ? el.dataset.view : "list";
        try { localStorage.setItem("hmh-deal-view", state.dealView); } catch { /* 忽略 */ }
        return render();
      case "deal-closeout-cancel": state.closeout = null; return go(href("house", "deal"));
      case "property-default": await Store.setDefaultProperty(id); toast(t("已设为默认房产")); return refresh();
      case "property-archive": {
        const p = state.properties.find((x) => x.id === id);
        if (!p) return;
        if (!canManageHome()) return toast(t("只有家主可以归档或恢复房产"));
        if (!p.archived && !el.closest(".act-menu") && !armed(el, t("再点一次确认归档"))) return;
        if (!p.archived && !(await freeDefault(p))) return;
        await Store.saveProperty({ ...p, archived: !p.archived }); toast(p.archived ? t("已恢复房产") : t("已归档，账单和房屋资料都保留；可在房屋首页「已归档的房产」恢复")); await refresh(); if (!p.archived && state.route?.section === "house") go(href("house")); return;
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
      // 耐用品（家居耐用品，如厨房用品）坏了一件：数量减 1，并把换新的一件加进购物车（买到后自动加回库存）
      case "gear-broke": {
        const it = state.enriched.find((x) => x.id === id); if (!it || !isGear(it) || it.qty <= 0) return;
        if (!confirm(t("“{name}”坏了一件？数量会减 1，并加入购物车换新（买到后自动加回库存）。", { name: it.name }))) return;
        el.disabled = true;
        await Store.adjust(id, -1, "adjust");
        if (!openShopFor(id)) await Store.saveShopping({ item_id: id, name: it.name, quantity: 1, unit: it.unit, category: it.category });
        toast(t("{name} 少了一件，已加入购物车换新", { name: it.name }));
        return refresh();
      }
      case "inv-view": setInvView(el.dataset.view); state.invSel = null; return render();
      case "supply-add-pick": { const c = await pickSupplyAdd(); if (c) go(c === "manual" ? `${href("item", "new")}?space=house${el.dataset.scope || ""}` : href("house", "template")); return; }   // 消耗品空白页的 ＋：手动添加 / 按房屋设备资料推荐
      case "add-item-pick": { const sp = await pickSpace(); if (sp) go(`${href("item", "new")}?space=${sp}`); return; }   // ＋ 添加物品：先选放在哪一类
      case "inv-cat-shop": return addAlertsToShopping(catNeed(el.dataset.cat));   // 分类视图每个大类的「全部加入购物车」
      case "inv-sec-shop": return addAlertsToShopping(secNeed(el.dataset.space));   // 物品视图每个容器的「全部加入购物车」
      case "inv-select": state.invSel = state.invSel ? null : new Set(); return render();
      case "inv-sel-all": { const ids = visibleItemIds(), all = ids.every((x) => state.invSel?.has(x)); state.invSel = new Set(all ? [] : ids); return render(); }
      case "inv-sel-shop": { const list = [...(state.invSel || [])].map((x) => state.enriched.find((i) => i.id === x)).filter(Boolean); state.invSel = null; return addAlertsToShopping(list); }
      case "inv-sel-mute": {
        const ids = [...(state.invSel || [])]; if (!ids.length) return;
        el.disabled = true; for (const x of ids) await Store.setItemMute(x, MUTE_FOREVER);
        toast(t("{n} 件设为不提醒", { n: ids.length })); state.invSel = null; return refresh();
      }
      case "inv-sel-del": {
        const ids = [...(state.invSel || [])]; if (!ids.length) return;
        const names = ids.map((x) => state.items.find((i) => i.id === x)?.name).filter(Boolean);
        if (!confirmDelete(t("删除这 {n} 件物品？\n{names}", { n: ids.length, names: names.slice(0, 8).join("、") + (names.length > 8 ? " …" : "") }))) return;
        el.disabled = true; for (const x of ids) await Store.deleteItem(x);
        toast(t("已删除 {n} 件物品", { n: ids.length })); state.invSel = null; return refresh();
      }
      case "item-remind": {   // 库存行上的「不提醒 / 🔔 …」标签：弹小框只改少货线和提前几天
        const it = state.enriched.find((x) => x.id === id); if (!it) return;
        const on = (Number(it.min_quantity) > 0 || Number(it.lead_days) > 0) && !(it.alert_mute_until && String(it.alert_mute_until) > new Date().toISOString().slice(0, 10));
        const r = await askRemind({ ...it, noRemind: !on }); if (!r) return;
        try {
          if (r.off) { await Store.setItemRemind(id, 0, 0, MUTE_FOREVER); toast(t("{name} 不再提醒", { name: it.name })); }
          else { await Store.setItemRemind(id, r.min, r.lead, null); toast(t("{name} 已设置提醒", { name: it.name })); }
        } catch (e) { return toast(e.message); }
        return refresh();
      }
      case "inv-del": { const it = state.items.find((x) => x.id === id); if (!it || !confirmDelete(t("删除「{name}」？", { name: it.name }))) return; await Store.deleteItem(id); toast(t("已删除 {name}", { name: it.name })); return refresh(); }
      case "inv-shop": {   // 右滑加入购物车（先确认数量和单位，见 addAlertsToShopping）
        const it = state.enriched.find((x) => x.id === id); if (!it) return;
        if (openShopFor(id)) { toast(t("{name} 已经在购物车里", { name: it.name })); return; }
        return addAlertsToShopping([it]);
      }
      case "consume": el.disabled = true; await Store.adjust(id, -storedStep(state.items.find((x) => x.id === id)?.unit), "consume"); return refresh();
      case "restock": el.disabled = true; await Store.adjust(id, storedStep(state.items.find((x) => x.id === id)?.unit), "restock"); return refresh();
      case "inv-sub": state.filter.sub = el.dataset.sub; return render();
      case "cat": state.filter.cat = el.dataset.cat; state.filter.sub = "all"; state.catSort = false; state.catForm = null; return render();
      case "cat-new": state.catForm = { space: el.dataset.space || state.filter.space }; render(); $("#catForm input[name=name]")?.focus(); return;
      case "cat-edit": { const c = CATEGORIES.find((x) => x.id === el.dataset.cat); if (c) state.catForm = catFormOf(c, t); render(); $("#catForm")?.scrollIntoView({ block: "start" }); return; }
      case "nav-back": return goBack(el.dataset.href);
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
      case "inv-clear": Object.assign(state.filter, { q: "", status: "all", loc: "all", owner: "all" }); return render();
      // 设置 → 存放位置：新建 / 重命名 / 删除
      case "loc-new": state.locForm = { name: "", grp: el.dataset.grp || "custom" }; render(); $("#locForm input[name=name]")?.focus(); return;
      case "loc-edit": {
        const name = el.dataset.name, c = customLocations().find((x) => x.name === name);
        state.locForm = c ? { id: c.id, name: c.name, grp: c.grp, replaces: c.replaces, sort: c.sort, oldName: c.name } : { name, grp: groupOf(name)?.id || "custom", replaces: name, oldName: name };
        render(); $("#locForm input[name=name]")?.focus(); return;
      }
      case "loc-cancel": state.locForm = null; return render();
      case "loc-del": { const c = customLocations().find((x) => x.id === id); if (!c || !confirmDelete(t("删除这个位置？"))) return; await deleteLocation(state, c); state.locForm = null; return refresh(); }
      case "house-cancel": state.skipAutosave = true; state.houseDraft = null; return;   // 链接本身会跳回分区列表；明确取消就不自动保存
      case "cat-delete": {
        const c = CATEGORIES.find((x) => x.id === el.dataset.cat); if (!c?.custom) return;
        if (state.items.some((i) => i.category === c.id)) return toast(t("这个分类下还有物品，先把它们改到别的分类"));
        if (!confirmDelete(t("删除这个分类？"))) return;
        await Store.deleteCategory(c.dbId); state.catForm = null; if (state.filter.cat === c.id) state.filter.cat = "all"; toast(t("已删除分类")); return refresh();
      }
      case "cat-sort": state.catSort = !state.catSort; return render();   // 手机仪表盘：调整方块顺序
      case "cat-move": moveCat(state.filter.space, el.dataset.cat, +el.dataset.dir); return render();
      case "goto-cat": Object.assign(state.filter, { space: el.dataset.space || "pantry", cat: el.dataset.cat, status: "all", q: "", owner: el.dataset.owner || "all" }); state.keepFilter = true; return go(toList(el.dataset.space));
      case "goto-status": Object.assign(state.filter, { space: el.dataset.space || "pantry", cat: "all", status: el.dataset.status, q: "" }); state.keepFilter = true; return go(toList(el.dataset.space));
      case "shop-add-item": return addAlertsToShopping([state.enriched.find((x) => x.id === id)]);
      case "shop-remove-item": return removeFromShopping([id]);
      case "shop-select": state.shopSel = state.shopSel ? null : new Set(); return render();   // 购物车：多选
      case "shop-sel-all": { const ids = shopVisibleIds(), all = ids.length && ids.every((x) => state.shopSel?.has(x)); state.shopSel = new Set(all ? [] : ids); return render(); }
      case "shop-sel-remove": {
        const rows = state.shopping.filter((s) => state.shopSel?.has(s.id)); if (!rows.length) return;
        const names = rows.map((s) => s.name), shown = names.slice(0, 3).join("、") + (names.length > 3 ? t("等 {n} 件", { n: names.length }) : "");
        if (!(await askConfirm({ title: t("移出购物车"), body: t("{names} 将被移出购物车，请确认", { names: shown }), ok: t("移出"), danger: true }))) return;
        for (const s of rows) await Store.deleteShopping(s.id);
        state.shopSel = null; toast(t("已移出购物车：{names}", { names: shown })); return refresh();
      }   // 该补货了：移出购物车（先确认）
      case "cat-check-ok": case "cat-check-all": {   // 「请确认分类」：没错 → 清标记（迁移 064）
        const ids = action === "cat-check-all" ? state.items.filter((x) => x.cat_check).map((x) => x.id) : [id];
        el.disabled = true;
        try { await Store.clearCatCheck(ids); } catch (e) { el.disabled = false; return toast(e.message); }
        if (ids.length > 1) toast(t("已确认 {n} 件", { n: ids.length }));
        return refresh();
      }
      case "cat-check-alt": {   // 「请确认分类」：改成候选分类，连着的花费、购物车跟着换
        const it = state.items.find((x) => x.id === id); if (!it) return;
        el.disabled = true;
        try { await Store.recatItem(id, el.dataset.cat, el.dataset.sub); } catch (e) { el.disabled = false; return toast(e.message); }
        toast(t("{name} 已改到 {cat}", { name: it.name, cat: t(catOf(el.dataset.cat).name) }));
        return refresh();
      }
      case "discard": {   // 过期扔掉：剩下的全部记成 discard（迁移 065；没跑迁移时云端会报错，提示先执行）
        const it = state.items.find((x) => x.id === id); if (!it || !(num(it.quantity) > 0)) return;
        el.disabled = true;
        try { await Store.adjust(id, -num(it.quantity), "discard"); } catch (e) { el.disabled = false; return toast(/invalid reason/.test(e.message) ? t("要先在 Supabase 执行迁移 065，才能记「扔掉」") : e.message); }
        toast(t("已记下：{name} 过期扔掉了；「我的 → 家里的数字」里能看到浪费", { name: it.name }));
        return refresh();
      }
      case "mute-item": {   // 注意事项里的“不再提醒”：一直不提醒，直到下次补货入库或在编辑页恢复
        const it = state.items.find((x) => x.id === id); if (!it) return;
        el.disabled = true;
        try { await Store.setItemMute(id, MUTE_FOREVER); toast(t("{name} 不再提醒了；下次补货入库，或在编辑页里可以恢复", { name: it.name })); } catch (e) { el.disabled = false; return toast(e.message); }
        return refresh();
      }
      case "shop-add-alerts": {
        const sp = el.dataset.space || "pantry";
        const pool = sp === "all" ? state.enriched.filter((x) => state.houseEnabled || inSpace("pantry")(x)) : state.enriched.filter(inSpace(sp));
        return addAlertsToShopping(alertsOf(el.dataset.owner ? pool.filter((x) => ownerMatch(x, el.dataset.owner, true)) : pool));
      }
      case "property-of-bill": return;
      case "shop-import": {   // 牧羊人带来的采购项（#/shopping?add=…）：勾了的逐个加，按名字对上库存物品就关联
        const names = [...document.querySelectorAll("#shopImport input[type=checkbox]:checked")].map((x) => x.value);
        for (const name of names) { const it = findItem(name); if (state.shopping.some((s) => s.status !== "bought" && (it ? s.item_id === it.id : normName(s.name) === normName(name)))) continue; await Store.saveShopping({ name, quantity: 1, unit: it?.unit || "", item_id: it?.id || null, category: it?.category || "other" }); }
        toast(names.length ? t("已加进购物车：{n} 项", { n: names.length }) : t("没有勾选"));
        go(href("shopping"), { replace: true }); return refresh();
      }
      case "shop-import-cancel": go(href("shopping"), { replace: true }); return render(true);
      case "shop-claim": await Store.saveShopping({ id, status: "claimed", claimed_by: state.user?.id || null, claimed_by_name: myName() }); toast(t("已认领，家人会看到你在买")); return refresh();
      case "shop-unclaim": await Store.saveShopping({ id, status: "todo", claimed_by: null, claimed_by_name: null }); return refresh();
      case "shop-bought": {   // 右滑「已买到」先确认（替身按钮带 data-confirm）；直接点「已买到」按钮不弹框
        if (el.dataset.confirm) { const s = state.shopping.find((x) => x.id === id); if (!window.confirm(t("「{name}」已经买到了？", { name: s?.name || "" }))) return; }
        return markBought(id);
      }
      case "shop-qty": return stepShopQty(id, +el.dataset.dir);
      case "shop-del": if (!confirmDelete(t("从购物车删除这一项？"))) return; await Store.deleteShopping(id); return refresh();
      case "shop-clear": await Store.clearBought(); return refresh();
      case "diet": state.diet = el.dataset.diet; state.mealShift = 0; localStorage.setItem("hmh-diet", state.diet); return render();
      case "shuffle": state.mealShift++; state.slotShift = {}; return render();
      case "slot-swap": { const sl = state.slotShift || (state.slotShift = {}); sl[el.dataset.slot] = (sl[el.dataset.slot] || 0) + 1; return render(); }
      case "ai-ask": { state.ai = state.ai || { ask: "", busy: false, result: null, error: null, raw: null }; state.ai.ask = el.dataset.ask; render(); const fm = $("#aiForm"); if (fm) { if (aiReady()) fm.requestSubmit(); else fm.elements.ask.focus(); } return; }
      case "ai-copy": return copyPrompt($("#aiForm"));
      case "ai-again": { const fm = $("#aiForm"); return fm ? fm.requestSubmit() : null; }
      case "ai-add-missing": await addAiMissing(); return refresh();
      // 咩咩咩整页
      case "ai-topic": { pickTopic(el.dataset.topic); render(); const fm = $("#aiPageForm"); if (fm) { if (aiReady()) fm.requestSubmit(); else fm.elements.q.focus(); } return; }
      case "ai-copy-general": return copyGeneralPrompt($("#aiPageForm"));
      case "ai-copy-answer": return copyAnswer();
      case "ai-notice-dismiss": dismissAiChanges(el.dataset.provider); document.getElementById("modelNotices")?.querySelector(".notice-box")?.remove(); return;
      case "ai-models-refresh": {
        if (!aiSettings().key.trim() && aiSettings().provider !== "openrouter") return toast(t("先填好并保存 API key，才能查这个 key 能用的模型"));
        toast(t("正在查…")); const ok = await hydrateModelSelect({ refresh: true });
        return toast(ok ? t("已刷新") : t("没查到新列表（网络或 key 有问题），先用上次的"));
      }
      case "ai-marks-clear": clearModelMarks(); toast(t("已清除，下次会重新试这些模型")); return render();
      case "ai-usage-reset": resetUsage(el.dataset.provider); toast(t("已重置本机的调用计数")); return render();
      case "ai-clear-adv": { const f = $("#aiSettingsForm"); if (f) { f.elements.model.value = ""; f.elements.base.value = ""; if (f.elements.rpm) { f.elements.rpm.value = ""; f.elements.rpd.value = ""; } await saveAiForm(f); } toast(t("已清掉，改用内置默认")); return render(); }
      case "ai-test": {
        el.disabled = true; const out = $("#aiTestOut");
        try { await saveAiForm($("#aiSettingsForm")); await testModel(); out.textContent = t("连接成功 ✓"); out.className = "muted ok-text"; }
        catch (err) { out.textContent = t("失败：{msg}", { msg: err.message }); out.className = "form-error"; }
        finally { el.disabled = false; }
        return;
      }
      case "spend-edit": { state.spendEdit = id; renderSpendList(); const dr = state.spendDrafts?.[id], f = $("#spendEditForm"); if (dr && f) applyDraft(f, dr); return; }   // 之前收起时留的草稿填回去
      case "spend-edit-collapse": { const f = $("#spendEditForm"); if (f) (state.spendDrafts = state.spendDrafts || {})[f.dataset.id] = formDraft(f); state.spendEdit = null; return renderSpendList(); }   // 收起但留着草稿
      case "trip-reclass": {   // 旅行页的归类建议：把以前记成“其他”的花费归到某个旅行类型
        await Store.updatePurchase(id, { category: el.dataset.cat });
        toast(t("已归类")); render(); return refresh();
      }
      case "spend-copy": {   // 花费「复制一笔」：收起编辑，展开「记一笔」并填好这笔的内容（日期今天、不是退款）
        const p = spendList.rows.find((x) => x.id === id); if (!p) return;
        state.spendEdit = null; state.spendAddOpen = true; render();
        requestAnimationFrame(() => {
          const f = $("#purchaseForm"); if (!f) return;
          const set = (k, v) => { const el = f.elements[k]; if (el && v != null && v !== "") { el.value = v; el.dispatchEvent(new Event("change", { bubbles: true })); } };
          set("name", p.name); set("category", p.category); set("trip", p.trip); set("amount", p.amount != null ? Math.abs(num(p.amount)).toFixed(2) : ""); set("store", p.store);
          set("card_id", payAcctValue(p.card_id, p.method)); set("nature", p.nature || ""); set("property_id", p.property_id || "");
          f.scrollIntoView({ block: "center", behavior: "smooth" }); f.elements.amount?.focus({ preventScroll: true });
          toast(t("已带上「{name}」，改一下金额或日期再记", { name: p.name }));
        });
        return;
      }
      case "spend-open": { state.spendOpen = state.spendOpen === id ? null : id; return renderSpendList(); }   // 花费明细一行的 ▾：编辑 / 复制 / 删除
      case "spend-edit-cancel": { if (state.spendDrafts && state.spendEdit) delete state.spendDrafts[state.spendEdit]; state.spendEdit = null; return renderSpendList(); }
      case "page-more": { const k = el.dataset.page; pageMore(k); const fn = PAGE_RENDER[k.split(":")[0]]; return fn ? fn() : render(false); }   // 「继续加载」：能只重画列表的就只重画列表
      case "deal-filter": state.dealFilter = el.dataset.val; return render();
      case "tasks-undone": state.tasksOnlyUndone = !state.tasksOnlyUndone; return render();
      case "spend-chip-clear": clearSpendFilter(el.dataset.k); return renderSpendRecords();
      case "med-del": if (!confirmDelete(t("删除这张医疗账单？"))) return; return deleteMedBill(el.dataset.id);
      case "card-ai": return aiDraftCard(el.closest("form"));
      case "card-del": state.cardDelete = el.dataset.id; render(); document.getElementById("cardDelTitle")?.scrollIntoView({ block: "center" }); return;   // 先问花费记录怎么办
      case "card-del-keep": el.disabled = true; await deleteCard(el.dataset.id, { purchases: "keep" }); return refresh();
      case "card-del-all": el.disabled = true; await deleteCard(el.dataset.id, { purchases: "delete" }); return refresh();
      case "card-del-cancel": state.cardDelete = null; return render();
      case "card-cleanup-open": state.cardCleanup = true; render(); document.getElementById("cleanTitle")?.scrollIntoView({ block: "center" }); return;
      case "card-cleanup-cancel": state.cardCleanup = false; state.cardCleanupRecent = false; return render();
      case "card-cleanup-run": el.disabled = true; await runCleanup(); return refresh();
      case "card-deact": el.disabled = true; await setCardActive(el.dataset.id, false); return refresh();
      case "card-react": el.disabled = true; await setCardActive(el.dataset.id, true); return refresh();
      case "med-pay-del": if (!confirmDelete(t("删除这条付款记录？"))) return; return deleteMedPay(el.dataset.id);
      case "person-add-do": return personAddDo();
      case "person-add-cancel": return personAddCancel();
      case "person-use": return personUse(el.dataset.id);
      case "person-merge-open": return personMergeOpen(el.dataset.id);
      case "person-merge-cancel": return personMergeCancel();
      case "person-merge": return personMerge(el.dataset.id);
      case "spend-more": return spendList.more();   // 「继续加载」：向数据库要下一页
      case "spend-csv": return exportSpendList();
      case "spend-sel-toggle": state.spendSel = state.spendSel ? null : new Set(); state.spendEdit = null; return render();
      case "spend-sel-all": { const S = state.spendSel || (state.spendSel = new Set()); spendRowsLoaded().forEach((p) => S.add(p.id)); return renderSpendList(); }   // 已经读到的（要更多先「继续加载」）
      case "spend-sel-none": state.spendSel = new Set(); return renderSpendList();
      case "spend-sel-del": {   // 多选删除：只删当前筛选结果里选中的
        const S = state.spendSel; if (!S?.size) return;
        const list = spendRowsLoaded().filter((p) => S.has(p.id)), sum = list.reduce((a, p) => a + (p.amount != null ? num(p.amount) : 0), 0);
        if (!list.length || !confirm(t("删除选中的 {n} 笔花费（合计 {m}）？删了就找不回来，建议先备份。", { n: list.length, m: money(sum) }))) return;
        el.disabled = true; let fail = 0;
        for (let i = 0; i < list.length; i += 6) await Promise.all(list.slice(i, i + 6).map((p) => Store.deletePurchase(p.id).catch(() => { fail++; })));
        const gone = new Set(list.map((p) => p.id)); spendList.rows = spendList.rows.filter((p) => !gone.has(p.id)); state.spendSel = null;
        toast(fail ? t("删了 {n} 笔，{k} 笔失败", { n: list.length - fail, k: fail }) : t("已删除 {n} 笔", { n: list.length })); render(); return refresh();
      }
      case "stats-months": setSharedRange(String(el.dataset.months)); return render();
      case "spend-add-toggle": { state.spendAddOpen = !state.spendAddOpen; render(); if (state.spendAddOpen) requestAnimationFrame(() => $("#purchaseForm")?.elements.name.focus({ preventScroll: true })); return; }
      case "stats-node": state.stats.node = el.dataset.node || null; state.stats.byTrip = false; render(); return requestAnimationFrame(() => document.querySelector(".node-crumb")?.scrollIntoView({ block: "nearest" }));   // 分类页：点进下一层 / 面包屑回上层
      case "stats-trips": state.stats.byTrip = !state.stats.byTrip; return render();   // 分类 → 旅行：按行程看
      case "purchase-del":   // 以前是「点两次」：左滑只替它点一次，所以滑了删不掉；现在用确认框
        if (!confirmDelete(t("删除这笔花费？"))) return;
        await Store.deletePurchase(id);
        spendList.rows = spendList.rows.filter((p) => p.id !== id); renderSpendList();   // 先从已读到的列表里拿掉（和多选删除一样），随后的重读再对一遍
        toast(t("已删除这笔记录")); return refresh();
      case "recipe-missing": return addRecipeMissing(el.dataset.name);
      case "copy-invite": await navigator.clipboard.writeText(state.household.invite_code); return toast(t("邀请码已复制"));
      case "notif": await Notification.requestPermission(); return render();
      case "export": return exportJson();
      case "backup-now": case "backup-continue": return doBackup(Backup.settings().targets.length ? Backup.settings().targets : ["download"], el);
      case "backup-download": return doBackup(["download"], el);
      case "backup-pick-folder": try { await Backup.pickFolder(); toast(t("已记住这个文件夹")); } catch (err) { if (err.name !== "AbortError") toast(t("选文件夹失败：{msg}", { msg: err.message })); } refreshBackupUi(); return render(false);
      case "backup-forget-folder": await Backup.forgetFolder(); refreshBackupUi(); return render(false);
      case "backup-pick-sql": try { await Backup.pickSqlFolder(); toast(t("以后每次写云盘文件夹时会把 .sql 一起拷进 sql/ 子目录")); } catch (err) { if (err.name !== "AbortError") toast(t("选文件夹失败：{msg}", { msg: err.message })); } refreshBackupUi(); return render(false);
      case "backup-forget-sql": await Backup.forgetSqlFolder(); refreshBackupUi(); return render(false);
      case "backup-grant": { const st = await Backup.folderStatus(); if (st.handle) { try { await st.handle.requestPermission({ mode: "readwrite" }); } catch { /* 用户取消 */ } } refreshBackupUi(); return render(false); }
      case "backup-relist": { el.disabled = true; try { const S0 = Backup.SOURCES[el.dataset.src], r = await (S0.relist || S0.list)(); state.backupUi = { ...(state.backupUi || {}), lists: { ...(state.backupUi?.lists || {}), [el.dataset.src]: r }, errs: { ...(state.backupUi?.errs || {}), [el.dataset.src]: "" } }; } catch (err) { toast(t("读取失败：{msg}", { msg: err.message === "NEED_GESTURE" ? t("需要重新登录 Google") : err.message })); } return render(false); }
      case "ask-toggle": Ask.toggleAsk(el.dataset.ask); return render(false);
      case "ask-run": return Ask.runAsk(el.dataset.ask);
      case "ask-copy": return Ask.copyAskPrompt(el.dataset.ask);
      case "ask-copy-answer": return Ask.copyAskAnswer(el.dataset.ask);
      case "backup-src": state.backupSrc = el.dataset.src; return render(false);
      case "backup-dl": try { const d = await Backup.SOURCES[el.dataset.src].read(el.dataset.id); Backup.download(Backup.toBlob(d), el.dataset.name); } catch (err) { toast(t("下载失败：{msg}", { msg: err.message })); } return;
      case "backup-use": try { const d = await Backup.SOURCES[el.dataset.src].read(el.dataset.id); state.backupPreview = { ...Backup.inspect(d), data: d, from: el.dataset.name }; } catch (err) { toast(t("读取失败：{msg}", { msg: err.message })); } return render(false);
      case "backup-rm": if (!confirm(t("删除备份 {n}？", { n: el.dataset.name }))) return; try { await Backup.SOURCES[el.dataset.src].del(el.dataset.id); } catch (err) { toast(t("删除失败：{msg}", { msg: err.message })); } refreshBackupUi(); return render(false);
      case "backup-gd-on": el.disabled = true; try { await Backup.DR.gdConnect(); Backup.saveSettings({ targets: [...new Set([...Backup.settings().targets, "gdrive"])] }); toast(t("已连接 Google Drive")); } catch (err) { toast(t("连接 Google Drive 失败：{msg}", { msg: err.message })); } refreshBackupUi(); return render(false);
      case "backup-gd-pick": try { const fo = await Backup.DR.gdPickFolder(); if (fo) { Backup.saveSettings({ gdId: fo.id, gdName: fo.name }); toast(t("以后备份放到「{n}」", { n: fo.name })); } } catch (err) { toast(t("选文件夹失败：{msg}", { msg: err.message })); } refreshBackupUi(); return render(false);
      case "backup-gd-clear": Backup.saveSettings({ gdId: "", gdName: "" }); refreshBackupUi(); return render(false);
      case "backup-gd-off": Backup.DR.gdDisconnect(); Backup.saveSettings({ targets: Backup.settings().targets.filter((x) => x !== "gdrive") }); refreshBackupUi(); return render(false);
      case "backup-dbx-on": try { await Backup.DR.dbxConnect(); } catch (err) { toast(t("连接 Dropbox 失败：{msg}", { msg: err.message })); } return;
      case "backup-dbx-off": await Backup.DR.dbxDisconnect(); Backup.saveSettings({ targets: Backup.settings().targets.filter((x) => x !== "dropbox") }); refreshBackupUi(); return render(false);
      case "backup-restore-cancel": state.backupPreview = null; return render(false);
      case "backup-restore-confirm": return doRestore(el);
      case "csv-summary": return exportAnnual("summary");
      case "csv-detail": return exportAnnual("detail");
      case "reload": return refresh();
      case "reload-page": return location.reload();   // 页面代码没下载下来（断网）：重试
      case "reset-demo": if (armed(el, t("再点一次确认恢复"))) { DemoStore.reset(); toast(t("已恢复演示数据")); refresh(); } return;
      case "logout": await CloudStore.sb.auth.signOut(); localStorage.removeItem("hmh-hid"); return location.reload();
      case "login-mode": state.loginMode = el.dataset.mode; state.phonePending = null; return renderLogin();
      case "otp-back": state.phonePending = null; return renderLogin();
      case "lang": return changeLang(el.dataset.lang || null);
      case "member-role": {
        const m = famMembers().find((x) => x.user_id === id), role = el.dataset.role;
        if (!m) return;
        if (!armed(el, role === "owner" ? t("再点一次设为家主") : t("再点一次取消家主"))) return;
        await Store.setMemberRole(id, role);
        await reloadMembers();
        toast(role === "owner" ? t("{name} 已设为家主", { name: m.display_name }) : t("{name} 已取消家主", { name: m.display_name })); return render();
      }
      case "member-finance": {   // 家主开 / 关某位家人的财务权限（对账单、收入、预算、用卡）
        const m = famMembers().find((x) => x.user_id === id), on = el.dataset.on === "1";
        if (!m) return;
        if (on && !confirm(t("给 {name} 开财务权限？开了就能看、能改对账单、收入、预算和用卡。", { name: m.display_name }))) return;
        try { await Store.setMemberFinance(id, on); } catch (err) { toast(err.message); return; }
        await reloadMembers();
        toast(on ? t("{name} 现在能看、能改对账单、收入、预算和用卡", { name: m.display_name }) : t("已收回 {name} 的财务权限", { name: m.display_name })); render(); $(".tgl")?.focus(); return;   // 重画后把焦点放回开关（键盘 / 读屏）
      }
      case "member-remove": {
        const m = famMembers().find((x) => x.user_id === id);
        if (!m) return;
        if (!armed(el, t("再点一次确认移出"))) return;
        await Store.removeMember(id);
        await reloadMembers();
        toast(t("{name} 已移出家庭", { name: m.display_name })); return render(true);
      }
      case "rotate-invite": {
        if (!armed(el, t("再点一次确认重置"))) return;
        const { data, error } = await CloudStore.sb.rpc("rotate_invite_code", { p_household: state.household.id });
        if (error) throw new Error(error.message);
        state.household.invite_code = data;
        const { data: hh } = await CloudStore.sb.from("households").select("invite_expires_at").eq("id", state.household.id).single();
        state.household.invite_expires_at = hh?.invite_expires_at || null;
        toast(t("已生成新邀请码（7 天内有效），旧邀请码立即失效")); return render();
      }
      case "close-invite": {
        if (!armed(el, t("再点一次关闭邀请"))) return;
        await CloudStore.closeInvite(); state.household.invite_expires_at = new Date().toISOString();
        toast(t("已关闭邀请：现在谁也不能用邀请码加入了")); return render();
      }
      case "member-approve": {
        await CloudStore.approveMember(id);
        state.members = await CloudStore.listMembers(); state.pendingMembers = await CloudStore.listPendingMembers();
        toast(t("已批准，对方现在可以进入了")); return render();
      }
      case "member-reject": {
        if (!armed(el, t("再点一次确认拒绝"))) return;
        await CloudStore.removeMember(id); state.pendingMembers = await CloudStore.listPendingMembers();
        toast(t("已拒绝这个申请")); return render();
      }
      case "join-recheck": return afterLogin();
      case "join-cancel": {
        await CloudStore.sb.from("household_members").delete().eq("household_id", el.dataset.hid).eq("user_id", state.user.id);
        clearInterval(waitTimer); return afterLogin();
      }
    }
  } catch (err) { toast(t("操作失败：{msg}", { msg: friendlyErr(err.message) })); refresh(); }
});
boot();
bindShops((force) => render(force !== false));
