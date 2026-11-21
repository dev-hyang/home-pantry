/* 表单控件的 change 事件：下拉、勾选、日期、文件选择等（一个页面一个分支）。 */
import { $, catOf, fillUnitList, fmtDay, num, setDateFormat, spaceOf, toast } from "../../core/util.js";
import * as Backup from "../../core/backup.js";
import { Store } from "../../core/store.js";
import { applyTypeDefaults, onAssetFormChange, onMaintFormChange, payExpNote, readHouseForm, renderAssetList, renderMaintLogs, setDealAiConsent, subOptions, toggleDealTask, toggleTask } from "../lazy-modules.js";
import { changeLang } from "../page-events.js";
import { customChanged, setFinUnit } from "../../core/time-range.js";
import { enrich } from "../../core/logic.js";
import { friendlyErr } from "../errors.js";
import { go, href } from "../../core/router.js";
import { maintFilter } from "../../house/assets-logic.js";
import { natureOptions } from "../../core/taxonomy.js";
import { overviewHref } from "../../bills/trail.js";
import { pageSize, setPageSize } from "../../core/pager.js";
import { payeeChange } from "../../stats/payees.js";
import { refresh, resetListPages } from "../data.js";
import { render } from "../render.js";
import { renderAllList } from "../../bills/all-views.js";
import { saveStatToggles, setSharedRange } from "../actions/stats-prefs.js";
import { setItemQty, setItemUnit, setShopQty, setShopUnit } from "../actions/shopping.js";
import { setMoneyHidden } from "../../core/privacy.js";
import { setTempUnit } from "../../core/weather.js";
import { setTodayPref } from "../../today.js";
import { state } from "../../core/state.js";
import { t } from "../../core/i18n.js";
import { setOverviewRange } from "../../bills/overview-state.js";
import { onKindPick, onPersonPick } from "../lazy-modules.js";
import { renderInvList } from "../lazy-modules.js";
import { resolvePayAccount } from "../../bills/card-picker.js";
import { cardHintHtml, pickResultHtml } from "../../bills/cards-review.js";
import { applyCatalogPick } from "../lazy-modules.js";
import { refreshBackupUi } from "../../settings/backup-ui.js";
import { saveAiForm } from "../../settings/settings-menu.js";
import { hydrateModelSelect, onModelPick, setDevicePerson } from "../lazy-modules.js";
import { renderSpendList, renderSpendRecords, spendRowsLoaded } from "../lazy-modules.js";

export async function onMainChange(e) {
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
  if (e.target.id === "invSpaceSel") { const v = e.target.value; return go(v === "house" ? `${href("pantry", "inventory")}?space=house` : v === "gear" ? href("pantry", "gear") : v === "pantry" ? `${href("pantry", "inventory")}?space=pantry` : href("pantry", "inventory")); }   // 库存范围：和以前的范围芯片同样的地址
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
  if (e.target.closest("#shopForm") && e.target.name === "item_id") {   // 加入已有物品：单位、分类跟着库存里选中的物品
    const o = e.target.selectedOptions[0], f = e.target.form;
    if (f) { f.elements.unit.value = o?.dataset.unit || ""; f.elements.category.value = o?.dataset.cat || ""; }
    return;
  }
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
  if (e.target.id === "finUnit" || e.target.dataset?.finUnit !== undefined) { setFinUnit(e.target.value); render(); }   // 花费 / 预算趋势的时间范围：近 N 个月 / 某一年（数据库按月聚合，往年也一样）
  if (e.target.id === "statsMonth") { state.stats.month = e.target.value; render(); }
  if (e.target.id === "statsItem") { state.stats.itemId = e.target.value; render(); }
  if (e.target.id === "hhSwitch") { localStorage.setItem("hmh-hid", e.target.value); location.reload(); }
}
