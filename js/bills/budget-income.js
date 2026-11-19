/* 预算：收入与预算生成（收入按人私有，预算方案由家主生成），和接入「注意事项」的提醒。 */
import { Store } from "../core/store.js";
import { actualByMonth, clamp, cur, groupsNow, mapLegacy, pct } from "./budget-groups.js";
import { financeOk } from "../core/finance-access.js";
import { href } from "../core/router.js";
import { lastMonths, monthKey } from "../stats/views.js";
import { money, num } from "../core/util.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";

/* ───────────── 收入与预算生成（收入按人私有；预算方案由家主生成并存成快照，全家共用） ───────────── */
export const myId = () => state.user?.id || "me";
/** 演示模式只有一个人，当家主；云端：家主，或家主开了财务权限的家人（迁移 050：开了 = 和家主一样能看、能改收入与预算） */
export const isHouseholdOwner = () => financeOk();
/** 一个人的收入明细：多份收入（主业、兼职…）；旧数据只有一个金额时当作一份 */
export const linesOf = (row) => (row?.lines?.length ? row.lines : row && num(row.income_amount) > 0 ? [{ id: "legacy", label: "", amount: num(row.income_amount), period: row.income_period || "month" }] : []);
export const monthlyOf = (row) => linesOf(row).reduce((s, l) => s + (l.period === "year" ? num(l.amount) / 12 : num(l.amount)), 0);
/** 全家每月收入合计（家主读得到全部；其他成员只会有自己那一行，所以不要拿它当全家数字用） */
export const totalIncomeMonthly = () => state.incomes.reduce((s, i) => s + monthlyOf(i), 0);
/** 按全家月收入和储蓄比例算各类预算建议：收入 − 固定账单 − 储蓄 = 可支配额，按过去 6 个月各二级分类的花费比例分（没有历史用常见比例）。
 *  以前单独一组的「大件家电」不再是预算分组：大额更换记成资本性支出，设备更换基金在「规划」里单独看 */
function computeGroups(totalM, savingsPct) {
  const bills = state.billsEnriched.filter((x) => x.active && !x.ended && x.direction !== "receivable" && (x.currency || cur()) === cur());
  const billsM = bills.reduce((s, x) => s + x.monthly, 0);
  const pool = Math.max(0, totalM - billsM - totalM * savingsPct / 100);
  const abm = actualByMonth(), past = lastMonths(7).slice(0, 6);   // 过去 6 个月（不含本月）
  const GS = groupsNow();
  const hist = Object.fromEntries(GS.map((g) => [g.id, past.reduce((s, m) => s + (abm[m]?.[g.id] || 0), 0) / 6]));
  const histTotal = Object.values(hist).reduce((a, c) => a + c, 0);
  const raw = Object.fromEntries(GS.map((g) => [g.id, histTotal > 0 ? Math.max(0.01, hist[g.id] / histTotal) : g.w])), rawSum = Object.values(raw).reduce((x, y) => x + y, 0) || 1;
  const groups = Object.fromEntries(GS.map((g) => [g.id, Math.round((pool * raw[g.id]) / rawSum)]));
  return { groups, fromFund: false, hasHistory: histTotal > 0 };
}
export async function saveBudgetBase(patch) {
  const base = state.budget || { income_amount: 0, income_period: "month", savings_pct: 20, cat_budgets: {} };
  state.budget = await Store.saveBudget({ ...base, ...patch });
  document.dispatchEvent(new CustomEvent("budget-saved"));
}
/** 家主：按当前全家收入生成（或重新生成）预算；改过的各类金额保留 */
export async function generatePlan() {
  if (!isHouseholdOwner()) throw new Error(t("只有家主能生成预算"));
  const total = totalIncomeMonthly(); if (!(total > 0)) throw new Error(t("先在 财务 → 收入 → 预算与计划 里填收入"));
  const base = state.budget || { savings_pct: 20, cat_budgets: {} }, pctv = clamp(num(base.savings_pct, 20), 0, 90), c = computeGroups(total, pctv);
  state.incomePrompt = false;
  await saveBudgetBase({ savings_pct: pctv, cat_budgets: { ...(base.cat_budgets || {}), _plan: { groups: c.groups, fromFund: c.fromFund, hasHistory: c.hasHistory, savings_pct: pctv, generated_at: new Date().toISOString() } } });
}
let autoTried = false;
/** 家主打开应用时：有收入、还没有预算就自动生成第一版（只试一次） */
export function maybeAutoGenerate() {
  if (autoTried || !isHouseholdOwner() || state.budget?.cat_budgets?._plan || !(totalIncomeMonthly() > 0)) return;
  autoTried = true; generatePlan().catch((e) => console.warn("[budget auto]", e.message));
}
/** 家主：有成员在上次生成预算之后更新了收入，且还没点“保持现有预算” */
export function staleIncomes() {
  const snap = state.budget?.cat_budgets?._plan; if (!snap || !isHouseholdOwner()) return 0;
  const after = String(snap.dismissed_at || snap.generated_at || "");
  return state.incomes.filter((i) => String(i.updated_at || "") > after).length;
}
/** “要不要重新生成预算”的提示条（家主刚改了收入，或有人更新了收入） */
export function incomeBanner() {
  if (!isHouseholdOwner() || !state.budget?.cat_budgets?._plan) return "";
  const n = staleIncomes(); if (!state.incomePrompt && !n) return "";
  return `<div class="panel cta-panel bud-banner"><div><b>${state.incomePrompt && !n ? t("收入或预算比例改了，要按新的重新生成预算吗？") : t("有 {n} 位成员更新了收入，要重新生成预算吗？", { n })}</b>
    <p class="muted">${t("你改过的各类金额会保留。")}</p></div>
    <div class="head-acts"><button type="button" class="btn btn-primary btn-sm" data-action="budget-generate">${t("重新生成")}</button><button type="button" class="btn btn-sm btn-ghost" data-action="budget-keep">${t("保持现有预算")}</button></div></div>`;
}
/** 预算方案：读家主生成的快照（各类建议金额）+ 用户改过的金额；收入和储蓄只有家主算得出来 */
export function budgetPlan() {
  if (!financeOk()) return null;   // 没有财务权限：预算整块看不到（打印、购物车的预算提示、超预算提醒都跟着消失）
  const b = state.budget, snap = b?.cat_budgets?._plan;
  if (!snap?.groups) return null;
  const owner = isHouseholdOwner(), income = owner && totalIncomeMonthly() > 0 ? totalIncomeMonthly() : null;
  const bills = state.billsEnriched.filter((x) => x.active && !x.ended && x.direction !== "receivable" && (x.currency || cur()) === cur());
  const billsM = bills.reduce((s, x) => s + x.monthly, 0), essentialM = bills.filter((x) => x.essential).reduce((s, x) => s + x.monthly, 0);
  const savingsPct = clamp(num(snap.savings_pct ?? b.savings_pct, 20), 0, 90), savings = income != null ? (income * savingsPct) / 100 : null;
  const over = mapLegacy(b.cat_budgets), sug = mapLegacy(snap.groups);   // 旧分组键（日常消耗品 / 大件家电…）读的时候换成二级分类
  const abm = actualByMonth(), past = lastMonths(7).slice(0, 6);
  const groups = groupsNow().map((g) => {
    const hist = past.reduce((s, m) => s + (abm[m]?.[g.id] || 0), 0) / 6;
    const suggested = sug[g.id] != null ? num(sug[g.id]) : Math.round(hist), custom = over[g.id] != null;
    return { ...g, hist, suggested, custom, budget: custom ? num(over[g.id]) : suggested, fromFund: false };
  });
  const variable = groups.reduce((s, g) => s + g.budget, 0);
  return { income, owner, billsM, essentialM, savingsPct, savings, pool: variable, groups, variable, totalBudget: billsM + variable, left: income != null ? income - billsM - savings - variable : null, hasHistory: !!snap.hasHistory, generatedAt: snap.generated_at };
}
/** 本月进度：每组已花、预算、占比；pace = 本月已过去的比例 */
export function monthProgress(plan = budgetPlan()) {
  if (!plan) return null;
  const now = new Date(), m = monthKey(now), a = actualByMonth()[m] || {};
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(), pace = now.getDate() / days;
  const rows = plan.groups.map((g) => ({ ...g, spent: a[g.id] || 0 }));
  const spent = rows.reduce((s, r) => s + r.spent, 0);
  return { month: m, pace, rows, spent, variable: plan.variable, bills: a.bills || 0, medical: a.medical || 0 };
}
/* ───────────── 提醒（接入首页“注意事项”） ───────────── */
export function budgetAlertItems() {
  if (!state.billsEnabled) return [];
  const plan = budgetPlan(); if (!plan || plan.variable <= 0) return [];
  const mp = monthProgress(plan), items = [], link = href("bills", "budget");
  const mk = (title, spent, budget, sev, label) => ({ source: "budget", severity: sev, must: false, due: null, daysLeft: null, title, detail: t("已花 {a} / 预算 {b}", { a: money(spent), b: money(budget) }), href: link,
    badge: { label, cls: sev <= 2 ? "b-out" : "b-soon" }, actions: [{ type: "link", href: link, label: t("看预算"), cls: "btn-ghost" }] });
  const r = pct(mp.spent, mp.variable);
  if (r >= 100) items.push(mk(`💰 ${t("本月花费超预算")}`, mp.spent, mp.variable, 2, t("超预算")));
  else if (r >= 85) items.push(mk(`💰 ${t("本月预算快用完了")}`, mp.spent, mp.variable, 3, t("快用完")));
  for (const g of mp.rows.filter((x) => x.budget > 0 && x.spent > x.budget).slice(0, 2)) items.push(mk(`${g.icon} ${t("{g}超预算", { g: t(g.name) })}`, g.spent, g.budget, 3, t("超预算")));
  return items;
}
