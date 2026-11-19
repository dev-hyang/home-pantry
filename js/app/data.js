/* 读数据：refresh()（所有表一次并行读完）、按表重读（实时同步）、防抖。 */
import * as Backup from "../core/backup.js";
import { Store } from "../core/store.js";
import { applyCustomCategories } from "../core/categories.js";
import { applyCustomLocations } from "../core/locations.js";
import { backupTargetName } from "./actions/backup.js";
import { enrich } from "../core/logic.js";
import { enrichAssets } from "../house/assets-logic.js";
import { enrichBills } from "../bills/logic.js";
import { ensureFirstYear, spendList } from "../stats/views.js";
import { financeOk } from "../core/finance-access.js";
import { incList } from "../income/list.js";
import { loadIncome } from "../income/logic.js";
import { loadLoginAlerts, recordLoginOnce } from "../settings/logins.js";
import { loadNetWorth } from "../bills/nw-logic.js";
import { loadPending } from "./auth/household.js";
import { loadShops } from "../shops/lite.js";
import { locale, setGlossary, t } from "../core/i18n.js";
import { maybeAutoGenerate } from "../bills/budget.js";
import { notifyIfNeeded } from "./actions/export-notify.js";
import { pageSize, resetPages } from "../core/pager.js";
import { propertyActive } from "../core/lifecycle.js";
import { refreshBackupUi } from "../settings/backup-views.js";
import { render } from "./render.js";
import { renderAssetList, renderMaintLogs } from "./lazy-modules.js";
import { seasonalSince } from "../house/tasks-logic.js";
import { setSync, toast } from "../core/util.js";
import { spendChanged } from "../core/spend-data.js";
import { state } from "../core/state.js";
import { loadDebts } from "../bills/debt-logic-common.js";
import { applyMedical, reloadMedical } from "../bills/medical-data.js";
import { renderInvList } from "./lazy-modules.js";

/* ───────────── 刷新与渲染 ───────────── */
/** 次要的表（保养记录、季节任务、缴费记录、库存流水）读得慢时，不让整个页面一起空白：超过 SOFT_MS 就先用旧数据 / 空数据画出来，
 * 读完后在后台补上并重画。这期间由它们推出来的提醒（设备保养、季节任务）先不显示，免得“记录还没到”被当成“从没保养过”而误报。 */
const SOFT_MS = 3000, SOFT = Symbol("soft");
const pendingAny = () => Object.values(state.pending).some(Boolean);
function soft(key, p, fallback, apply) {
  return Promise.race([p, new Promise((r) => setTimeout(() => r(SOFT), SOFT_MS))]).then((v) => {
    if (v !== SOFT) return v;
    state.pending[key] = true; setSync(t("部分数据还在加载…"), false);
    p.then((r) => { apply(r); state.pending[key] = false; if (!pendingAny()) { setSync(t("已同步 {time}", { time: new Date().toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" }) }), false, true); notifyIfNeeded(); } render(false); })
      .catch((e) => { state.pending[key] = false; console.warn("[late]", key, e.message); });
    return fallback;
  });
}
export let refreshing = null;
export async function refresh() {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      // 所有表一次并行读完（云端一轮往返），再在内存里定当前房产；采购花费只有统计和导出用，不挡首屏，渲染后后台再读
      const members = state.membersReady; state.membersReady = null;   // 登录后与这一轮并行去读家庭成员
      Store.listItemAliases().then((r) => { state.itemAliases = r || []; }).catch(() => { state.itemAliases = state.itemAliases || []; });   // 物品别名（迁移 066）：不挡首屏
      const [properties, items, logs, shopping, profiles, assets, maintLogs, seasonalDone, bills, billPayments, deals, dealDone, customCats, customLocs, dealExtras, customSeasonal, terms, budget, incomes, people, medBills, medPays, , cards, planData, assessData] = await Promise.all([
        Store.listProperties(), Store.listItems(),
        soft("logs", Store.listLogs(), state.logs || [], (r) => { state.logs = r; state.enriched = enrich(state.items, r); }),
        Store.listShopping(), Store.listHouseProfiles(),
        Store.listAssets(),
        soft("maint", Store.listMaintLogs(), state.maintLogs || [], (r) => { state.maintLogs = r; state.assetsEnriched = enrichAssets(state.assets, r); }),
        soft("seasonal", Store.listSeasonal(seasonalSince()), state.seasonalDone || [], (r) => { state.seasonalDone = r; }),
        Store.listBills(),
        soft("payments", Store.listBillPayments(), state.billPayments || [], (r) => { state.billPayments = r; state.billsEnriched = enrichBills(state.bills, r); }),
        Store.listDeals(), Store.listDealDone(), Store.listCategories(), Store.listLocations(), Store.listDealExtras(),
        Store.listCustomSeasonal().catch((e) => { console.warn("[custom seasonal]", e.message); return []; }),   // 迁移还没执行时读不到：不影响其他功能
        Store.listTerms().catch((e) => { console.warn("[terms]", e.message); return null; }),
        Store.getBudget().catch(() => null),
        Store.listIncomes().catch((e) => { console.warn("[incomes]", e.message); return []; }),
        Store.listPeople().catch(() => []),   // 家庭成员名册（迁移 029）；没建表时是空的
        Store.listMedicalBills().catch((e) => { console.warn("[medical]", e.message); return []; }),   // 还没执行迁移 027 时读不到：不影响其他功能
        Store.listMedicalPayments().catch(() => []),
        members,
        Store.listCards().catch((e) => { console.warn("[cards]", e.message); return []; }),
        Store.listPlans().catch((e) => { console.warn("[plans]", e.message); return { plans: [], cands: [], offers: [] }; }),
        Store.listAssess().catch(() => ({ as: [], items: [] }))]);   // 迁移 078 没执行时读不到：计划页显示空   // 迁移 032 没执行时读不到：不影响其他功能
      state.budget = budget; state.incomes = incomes;
      state.plans = planData.plans; state.planCands = planData.cands; state.planOffers = planData.offers;
      state.assess = assessData.as; state.assessItems = assessData.items;
      state.customSeasonal = customSeasonal;
      if (terms) setGlossary(terms);   // 自定义名称的翻译
      state.properties = properties;
      const live = properties.filter((p) => !p.archived), inUse = properties.filter(propertyActive);
      let saved = null; try { saved = localStorage.getItem("hmh-property"); } catch { /* 忽略 */ }
      // 正在看的房产（含已卖出的历史房产）保留；否则优先选在用的：上次选的 → 默认 → 第一套
      if (!live.some((p) => p.id === state.propertyId)) state.propertyId = (inUse.find((p) => p.id === saved) || inUse.find((p) => p.is_default) || inUse[0] || live.find((p) => p.id === saved) || live[0] || properties[0])?.id || null;
      const pid = state.propertyId;
      applyCustomCategories(customCats);   // 自定义分类并入全局分类表，后面的 enrich / 视图都能用
      applyCustomLocations(customLocs);    // 自定义 / 重命名的存放位置并入分组列表
      const houseProfiles = Object.fromEntries(profiles.map((p) => [p.property_id, p]));
      Object.assign(state, { items, logs, shopping, houseProfiles, houseProfile: pid ? houseProfiles[pid] || null : null, assets, maintLogs, seasonalDone, bills, billPayments, deals, dealDone, dealOverrides: dealExtras.overrides, dealCustom: dealExtras.custom, dealEvents: dealExtras.events || [] });
      state.enriched = enrich(items, logs);
      state.assetsEnriched = enrichAssets(assets, maintLogs);
      state.billsEnriched = enrichBills(bills, billPayments);
      state.people = people; applyMedical(medBills, medPays);
      loadIncome().then(() => { if (state.route?.section === "bills" && ["income", "statements"].includes(state.route?.sub)) render(false); });   // 收入（迁移 042）单独读：行级安全只给家主 / 已允许的人全家的；读不到不影响别的功能
      state.cards = cards || [];
      // 借贷（迁移 058）、净资产（迁移 059）：只有财务权限读得到；表不存在时借贷页 / 净资产页给提示。两样都读完再画（净资产要用贷款余额）
      Promise.all([loadDebts(), loadNetWorth()]).then(() => { if (state.route?.section === "bills" || state.route?.section === "today") render(false); });
      loadPending();
      recordLoginOnce().then(loadLoginAlerts).then(() => render(false)).catch(() => {});   // 登录记录（迁移 086）：记这台设备，再读待确认的可疑登录
      loadShops().then(() => { if (["shops", "shopping", "pantry"].includes(state.route?.section)) render(false); });   // 常去的商店与特价（迁移 067）：不挡首屏
      ensureFirstYear().then((fresh) => { if (fresh && state.route?.section === "bills") render(false); });   // 「全部历史」的起始年：数据读好了再查（刷新页面时路由先到，那时查不到）
      setSync(Store.mode === "demo" ? t("本地演示数据") : t("已同步 {time}", { time: new Date().toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" }) }), false, Store.mode !== "demo");
      if (!pendingAny()) notifyIfNeeded();
      render(false);
      spendChanged();   // 花费不再整表读进来（迁移 057）：统计聚合、明细、联想、卡的用量等标过期，画到的时候按需重读
      maybeAutoGenerate();   // 家主有收入但还没预算：自动生成第一版
      if (financeOk()) Backup.runScheduled().then((r) => { if (!r) return; if (r.ok.length) toast(t("已自动备份（{to}）", { to: r.ok.map(backupTargetName).join("、") })); if (r.needGesture) toast(t("定时备份要写进文件夹，去 设置 → 备份与恢复 点一下「继续备份」")); refreshBackupUi(); if (state.route?.section === "me") render(false); });   // 定时备份到期了就在后台做一次
    } catch (e) {
      setSync(t("同步失败，点设置页重试"), true);
      toast(t("读取数据失败：{msg}", { msg: e.message }));
    } finally { refreshing = null; }
  })();
  return refreshing;
}
/* 列表分批显示（js/core/pager.js）：「继续加载」后只重画这些列表；没列在这里的整页重画 */
export const PAGE_RENDER = { inv: () => renderInvList(), assets: () => renderAssetList(), maint: () => renderMaintLogs() };
/** 所有列表回到一页（换页面、改了每页条数）：新列表的计数清掉，自带 limit 的几个列表也改回一页；服务器分页的三张列表下次画时重读第一页 */
export function resetListPages() {
  resetPages();
  const n = pageSize(); spendList.stale(); incList.stale();
  if (state.inc) state.inc.slimit = null;
  if (state.stmt) state.stmt.limit = n;
}
/* ── 实时同步按表重读：家人改了哪张表，就只重读那张表（和由它推出来的 enrich），不再整轮读 24 张表。
 * 下面没列的表（房产、房屋资料、自定义分类 / 位置 / 翻译——会影响当前房产和全局分类表）照旧整轮 refresh。 */
const reloadAssess = () => Store.listAssess().then((x) => { state.assess = x.as; state.assessItems = x.items; });
const reloadPlans = () => Store.listPlans().then((x) => { state.plans = x.plans; state.planCands = x.cands; state.planOffers = x.offers; });
const reloadDealExtras = () => Store.listDealExtras().then((x) => { state.dealOverrides = x.overrides; state.dealCustom = x.custom; state.dealEvents = x.events || []; });
const TABLE_RELOAD = {
  items: () => Promise.all([Store.listItems(), Store.listLogs()]).then(([items, logs]) => { state.items = items; state.logs = logs; state.enriched = enrich(items, logs); }),   // 加减库存同时写 stock_logs（没订阅），一起重读
  shopping_list: () => Store.listShopping().then((r) => { state.shopping = r; }),
  item_aliases: () => Store.listItemAliases().then((r) => { state.itemAliases = r || []; }),
  purchases: () => { spendChanged(); },   // 只把花费相关的缓存标过期（统计聚合、明细、联想、卡的用量…），重画时按需重读，不再整表重读
  assets: () => Store.listAssets().then((r) => { state.assets = r; state.assetsEnriched = enrichAssets(r, state.maintLogs); }),
  maintenance_logs: () => Store.listMaintLogs().then((r) => { state.maintLogs = r; state.assetsEnriched = enrichAssets(state.assets, r); }),
  seasonal_tasks: () => Store.listSeasonal(seasonalSince()).then((r) => { state.seasonalDone = r; }),
  custom_seasonal_tasks: () => Store.listCustomSeasonal().then((r) => { state.customSeasonal = r; }),
  bills_recurring: () => Store.listBills().then((r) => { state.bills = r; state.billsEnriched = enrichBills(r, state.billPayments); }),
  bills_recurring_payments: () => Store.listBillPayments().then((r) => { state.billPayments = r; state.billsEnriched = enrichBills(state.bills, r); }),
  bills_one_time: () => reloadMedical(), bills_one_time_payments: () => reloadMedical(),
  income_records: () => loadIncome(), income_repayments: () => loadIncome(),
  debt_accounts: () => loadDebts(), debt_transactions: () => loadDebts(),
  account_balances: () => loadNetWorth(), asset_valuations: () => loadNetWorth(), net_worth_snapshots: () => loadNetWorth(),
  property_deals: () => Store.listDeals().then((r) => { state.deals = r; }),
  deal_task_done: () => Store.listDealDone().then((r) => { state.dealDone = r; }),
  bills_recurring_assessments: reloadAssess, bills_recurring_assessment_items: reloadAssess,
  deal_plans: reloadPlans, plan_candidates: reloadPlans, plan_offers: reloadPlans,
  deal_task_overrides: reloadDealExtras, deal_custom_tasks: reloadDealExtras, deal_events: reloadDealExtras,
};
const changedTables = new Set();
let fullPending = false;
async function refreshTables() {
  const tables = [...changedTables], full = fullPending; changedTables.clear(); fullPending = false;
  if (full || tables.some((x) => !TABLE_RELOAD[x])) return refresh();
  if (refreshing) await refreshing.catch(() => {});   // 整轮读还在进行：等它完，再补读这几张表
  const jobs = [...new Set(tables.map((x) => TABLE_RELOAD[x]))];   // 同一个重读函数（例如交易的三张附表）只跑一次
  try {
    await Promise.all(jobs.map((f) => f()));
    setSync(t("已同步 {time}", { time: new Date().toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" }) }), false, true);
    if (!pendingAny()) notifyIfNeeded();
    render(false);
  } catch (e) { console.warn("[realtime]", tables.join(","), e.message); return refresh(); }   // 按表读失败：退回整轮刷新
}
export let debounceT;
/** payload = 实时同步的变更（带 table）：只重读那张表；不带（切回前台等）= 整轮刷新。仍然 400ms 防抖，连着几条变更合成一次 */
export const refreshSoon = (payload) => {
  if (payload?.table) changedTables.add(payload.table); else fullPending = true;
  clearTimeout(debounceT); debounceT = setTimeout(refreshTables, 400);
};
