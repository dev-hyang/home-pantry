/* 账单 → 预算：按收入、固定账单和储蓄目标给出月度 / 年度预算建议，对比实际花费，超预算提醒，大额购物规划（一次付清 / 分期 / 预存到促销日）。
 * 实际花费来自 purchases（账单缴费也记在里面，分类 bill_*）；收入和预算存在 household_budgets（迁移 022；演示模式存本机）。 */
import { state } from "../core/state.js";
import { Store } from "../core/store.js";
import { $, esc, money, num, spaceOf, toast } from "../core/util.js";
import { lang, t } from "../core/i18n.js";
import { alertsOf } from "../core/logic.js";
import { href } from "../core/router.js";
import { lastMonths, monthKey, monthLabel, statCat } from "../stats/views.js";

/* ───────────── 预算分组 ───────────── */
// 固定账单单独算（从账单项目的每月折算得来）；其余花费分成这几组，按过去 6 个月的比例分配“可支配额”
export const GROUPS = [
  { id: "groceries", name: "日常储备", icon: "🥫", color: "#3f8f5a", w: 0.55 },
  { id: "house", name: "房屋维护", icon: "🏠", color: "#b07a1a", w: 0.15 },
  { id: "big", name: "大件家电", icon: "🧊", color: "#a0522d", w: 0.1 },   // 单笔 ≥ 门槛的购买（不含账单、维修保养）；有设备更换估价时按设备寿命预存
  { id: "vehicle", name: "车辆", icon: "🚗", color: "#3b7fc4", w: 0.1 },
  { id: "gear", name: "装备", icon: "🧳", color: "#7563c0", w: 0.05 },
  { id: "other", name: "其他", icon: "🧺", color: "#8a948f", w: 0.05 },
];
const BILLS_GROUP = { id: "bills", name: "账单", icon: "🧾", color: "#2f5d8a" };
export const groupOf = (category, amount = 0) => {
  const s = statCat(category);
  if (s === "bills") return "bills";
  if (s !== "vehicle" && category !== "house_maint" && amount >= bigThreshold()) return "big";   // 大件：单笔大额，但账单、车辆、维修保养不算
  return ["house", "vehicle", "gear", "other"].includes(s) ? s : "groceries";
};
const cur = () => Units.region.currency;
const amountOf = (p) => (p.amount != null && (!p.currency || p.currency === cur()) ? num(p.amount) : 0);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : a > 0 ? 999 : 0);

/* ───────────── 预算设置里的杂项（存在 cat_budgets 里以下划线开头的键：大件门槛、发薪日、储蓄目标、订阅标记、分摊占比） ───────────── */
export const meta = (key, def = null) => { const v = state.budget?.cat_budgets?.[key]; return v == null ? def : v; };
export async function saveMeta(patch) {
  const base = state.budget || { income_amount: 0, income_period: "month", savings_pct: 20, cat_budgets: {} };
  state.budget = await Store.saveBudget({ ...base, cat_budgets: { ...(base.cat_budgets || {}), ...patch } });
  document.dispatchEvent(new CustomEvent("budget-saved"));
}
const underscoreKeys = (o) => Object.fromEntries(Object.entries(o || {}).filter(([k]) => k.startsWith("_")));
/** 大件门槛：美元 / 加元等 300，人民币 2000，可在“各类月预算”里改 */
export const bigThreshold = () => num(meta("_big_threshold", null), 0) || (["CNY", "RMB"].includes(cur()) ? 2000 : 300);

const slots = {}, actions = {};
export const registerSection = (slot, order, fn) => { (slots[slot] ||= []).push({ order, fn }); };
export const registerAction = (name, fn) => { actions[name] = fn; };
const extras = (slot, ctx) => (slots[slot] || []).sort((a, b) => a.order - b.order).map((x) => { try { return x.fn(ctx) || ""; } catch (e) { console.error("[budget]", slot, e); return ""; } }).join("");

/** 设备更换基金：按“更换估价 ÷ 常见寿命”每月该预存多少（联动 房屋 → 设备保养） */
export function applianceFund() {
  const eq = state.assetsEnriched.filter((a) => a.kind !== "vehicle" && a.property_id);
  const rows = eq.filter((a) => num(a.replacement_cost_estimate) > 0 && num(a.expected_life_years) > 0).map((a) => ({
    id: a.id, name: a.name, cost: num(a.replacement_cost_estimate), life: num(a.expected_life_years), yearsLeft: a.ageYears != null ? num(a.expected_life_years) - a.ageYears : null,
    monthly: num(a.replacement_cost_estimate) / (num(a.expected_life_years) * 12) })).sort((x, y) => (x.yearsLeft ?? 99) - (y.yearsLeft ?? 99));
  return { rows, monthly: rows.reduce((s, r) => s + r.monthly, 0), missing: eq.length - rows.length };
}

/** 补货预估：库存告急的东西 + 采购清单里没买的，按以前买它的花费（最近 3 次的中位数，没有就按同分类）估价（联动 储藏 / 采购） */
export function restockForecast() {
  const buys = [...state.purchases].filter((p) => p.amount != null && num(p.amount) > 0 && (!p.currency || p.currency === cur())).sort((a, b) => String(b.purchased_at).localeCompare(String(a.purchased_at)));
  const median = (a) => { const x = [...a].sort((p, q) => p - q); return x.length ? (x.length % 2 ? x[(x.length - 1) / 2] : (x[x.length / 2 - 1] + x[x.length / 2]) / 2) : null; };
  const byItem = new Map(), byCat = new Map();
  for (const p of buys) {
    if (p.item_id) { const l = byItem.get(p.item_id) || []; if (l.length < 3) { l.push(num(p.amount)); byItem.set(p.item_id, l); } }
    const c = byCat.get(p.category) || []; if (c.length < 10) { c.push(num(p.amount)); byCat.set(p.category, c); }
  }
  const need = new Map();
  for (const it of alertsOf(state.enriched.filter((x) => spaceOf(x.category) !== "gear"))) need.set(it.id, { name: it.name, itemId: it.id, cat: it.category, src: "stock" });
  for (const s of state.shopping.filter((x) => x.status !== "bought")) {
    const key = s.item_id || `n:${s.name}`;
    if (!need.has(key)) { const it = state.items.find((i) => i.id === s.item_id); need.set(key, { name: s.name, itemId: s.item_id, cat: it?.category || s.category || "other", src: "list" }); }
  }
  const rows = [...need.values()].map((r) => ({ ...r, est: median(byItem.get(r.itemId) || []) ?? median(byCat.get(r.cat) || []) })).sort((a, b) => (b.est ?? -1) - (a.est ?? -1));
  const byGroup = {}; for (const r of rows) if (r.est != null) { const g = spaceOf(r.cat) === "house" ? "house" : "groceries"; byGroup[g] = (byGroup[g] || 0) + r.est; }
  return { rows, total: rows.reduce((s, r) => s + (r.est || 0), 0), unknown: rows.filter((r) => r.est == null).length, byGroup };
}

/** 本月账单：已缴、还要交（含已逾期的）、逾期笔数 */
export function billsThisMonth() {
  const now = new Date(), m = monthKey(now), today = now.toISOString().slice(0, 10);
  const open = state.billsEnriched.filter((b) => b.active && !b.ended && !b.escrow && b.direction !== "receivable" && b.next_due_on && (b.currency || cur()) === cur() && (b.next_due_on.startsWith(m) || b.next_due_on < today));
  return { paid: actualByMonth()[m]?.bills || 0, due: open.reduce((s, b) => s + num(b.est), 0), dueN: open.length, overdueN: open.filter((b) => b.next_due_on < today).length };
}

/** 各月各组的实际花费 { "2026-10": { bills, groceries, house, … } } */
export function actualByMonth() {
  const out = {};
  for (const p of state.purchases) {
    const a = amountOf(p); if (!a) continue;
    const m = monthKey(p.purchased_at), g = groupOf(p.category, a);
    ((out[m] ||= {})[g] = (out[m][g] || 0) + a);
  }
  return out;
}

/* ───────────── 收入与预算生成（收入按人私有；预算方案由家主生成并存成快照，全家共用） ───────────── */
export const myId = () => state.user?.id || "me";
/** 演示模式只有一个人，当家主；云端按 household_members.role */
export const isHouseholdOwner = () => Store.mode !== "cloud" || state.members.some((m) => m.user_id === state.user?.id && m.role === "owner");
/** 一个人的收入明细：多份收入（主业、兼职…）；旧数据只有一个金额时当作一份 */
export const linesOf = (row) => (row?.lines?.length ? row.lines : row && num(row.income_amount) > 0 ? [{ id: "legacy", label: "", amount: num(row.income_amount), period: row.income_period || "month" }] : []);
export const monthlyOf = (row) => linesOf(row).reduce((s, l) => s + (l.period === "year" ? num(l.amount) / 12 : num(l.amount)), 0);
/** 全家每月收入合计（家主读得到全部；其他成员只会有自己那一行，所以不要拿它当全家数字用） */
export const totalIncomeMonthly = () => state.incomes.reduce((s, i) => s + monthlyOf(i), 0);

/** 按全家月收入和储蓄比例算各类预算建议：收入 − 固定账单 − 储蓄 = 可支配额，大件按设备寿命预存，其余按过去 6 个月的花费比例分 */
function computeGroups(totalM, savingsPct) {
  const bills = state.billsEnriched.filter((x) => x.active && !x.ended && x.direction !== "receivable" && (x.currency || cur()) === cur());
  const billsM = bills.reduce((s, x) => s + x.monthly, 0);
  const pool = Math.max(0, totalM - billsM - totalM * savingsPct / 100);
  const abm = actualByMonth(), past = lastMonths(7).slice(0, 6);   // 过去 6 个月（不含本月）
  const hist = Object.fromEntries(GROUPS.map((g) => [g.id, past.reduce((s, m) => s + (abm[m]?.[g.id] || 0), 0) / 6]));
  const histTotal = Object.values(hist).reduce((a, c) => a + c, 0);
  const fund = applianceFund(), useFund = fund.monthly > 0;
  const bigSug = useFund ? Math.min(Math.round(fund.monthly), Math.round(pool * 0.35)) : 0, poolRest = pool - bigSug;
  const gs = GROUPS.filter((g) => !(useFund && g.id === "big")), hist2 = gs.reduce((s, g) => s + hist[g.id], 0);
  const raw = Object.fromEntries(gs.map((g) => [g.id, hist2 > 0 ? Math.max(0.03, hist[g.id] / hist2) : g.w])), rawSum = Object.values(raw).reduce((x, y) => x + y, 0) || 1;
  const groups = Object.fromEntries(GROUPS.map((g) => [g.id, useFund && g.id === "big" ? bigSug : Math.round((poolRest * raw[g.id]) / rawSum)]));
  return { groups, fromFund: useFund, hasHistory: histTotal > 0 };
}
export async function saveBudgetBase(patch) {
  const base = state.budget || { income_amount: 0, income_period: "month", savings_pct: 20, cat_budgets: {} };
  state.budget = await Store.saveBudget({ ...base, ...patch });
  document.dispatchEvent(new CustomEvent("budget-saved"));
}
/** 家主：按当前全家收入生成（或重新生成）预算；改过的各类金额保留 */
export async function generatePlan() {
  if (!isHouseholdOwner()) throw new Error(t("只有家主能生成预算"));
  const total = totalIncomeMonthly(); if (!(total > 0)) throw new Error(t("先在 设置 → 收入与预算 里填收入"));
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
  const b = state.budget, snap = b?.cat_budgets?._plan;
  if (!snap?.groups) return null;
  const owner = isHouseholdOwner(), income = owner && totalIncomeMonthly() > 0 ? totalIncomeMonthly() : null;
  const bills = state.billsEnriched.filter((x) => x.active && !x.ended && x.direction !== "receivable" && (x.currency || cur()) === cur());
  const billsM = bills.reduce((s, x) => s + x.monthly, 0), essentialM = bills.filter((x) => x.essential).reduce((s, x) => s + x.monthly, 0);
  const savingsPct = clamp(num(snap.savings_pct ?? b.savings_pct, 20), 0, 90), savings = income != null ? (income * savingsPct) / 100 : null;
  const over = b.cat_budgets || {};
  const abm = actualByMonth(), past = lastMonths(7).slice(0, 6);
  const groups = GROUPS.map((g) => {
    const suggested = num(snap.groups[g.id]), custom = over[g.id] != null && over[g.id] !== "";
    return { ...g, hist: past.reduce((s, m) => s + (abm[m]?.[g.id] || 0), 0) / 6, suggested, custom, budget: custom ? num(over[g.id]) : suggested, fromFund: !!snap.fromFund && g.id === "big" };
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
  return { month: m, pace, rows, spent, variable: plan.variable, bills: a.bills || 0 };
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

/* ───────────── 促销日与省钱渠道（日期按规则推算；个别日期每年由商家公布，标“约”） ───────────── */
const nthWeekday = (y, m, wd, n) => { const d = new Date(y, m, 1); d.setDate(1 + ((wd - d.getDay() + 7) % 7) + (n - 1) * 7); return d; };
const lastWeekday = (y, m, wd) => { const d = new Date(y, m + 1, 0); d.setDate(d.getDate() - ((d.getDay() - wd + 7) % 7)); return d; };
export function saleEvents(from = new Date(), n = 6) {
  const out = [];
  for (const y of [from.getFullYear(), from.getFullYear() + 1]) {
    const bf = new Date(nthWeekday(y, 10, 4, 4)); bf.setDate(bf.getDate() + 1);
    const cm = new Date(bf); cm.setDate(cm.getDate() + 3);
    out.push(
      { name: "总统日（Presidents' Day）", date: nthWeekday(y, 1, 1, 3) },
      { name: "618", date: new Date(y, 5, 18), note: "国内电商年中大促，海淘 / 代购常跟着促销" },
      { name: "阵亡将士纪念日（Memorial Day）", date: lastWeekday(y, 4, 1), note: "家具、床垫、家电、户外用品常有促销" },
      { name: "Prime Day", date: new Date(y, 6, 15), approx: true, note: "通常在 7 月，具体日期以亚马逊公告为准" },
      { name: "劳动节（Labor Day）", date: nthWeekday(y, 8, 1, 1), note: "家电、割草机、户外用品常有促销" },
      { name: "国庆（10/1）", date: new Date(y, 9, 1), note: "国内电商国庆促销" },
      { name: "Prime 秋季大促（Big Deal Days）", date: new Date(y, 9, 8), approx: true, note: "通常在 10 月上旬，以亚马逊公告为准" },
      { name: "双十一（11/11）", date: new Date(y, 10, 11) },
      { name: "黑五（Black Friday）", date: bf, note: "全年最集中的折扣：电子、家电、家居" },
      { name: "网络星期一（Cyber Monday）", date: cm },
      { name: "节后清仓（Boxing Day）", date: new Date(y, 11, 26), note: "圣诞后清仓，冬季衣物和装饰" },
    );
  }
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return out.filter((e) => e.date >= today).sort((a, b) => a.date - b.date).slice(0, n);
}
const DEAL_SITES = [
  { name: "北美省钱快报 Dealmoon", url: "https://www.dealmoon.com", note: "北美折扣汇总、返利和优惠码" },
  { name: "Slickdeals", url: "https://slickdeals.net", note: "美国最大的折扣社区，看帖里的热度和评论" },
  { name: "Rakuten 返利", url: "https://www.rakuten.com", note: "先从返利页进商家再下单，按比例返现" },
  { name: "RetailMeNot / 优惠码", url: "https://www.retailmenot.com", note: "结账前查有没有优惠码" },
  { name: "CamelCamelCamel", url: "https://camelcamelcamel.com", note: "查亚马逊商品的历史价格，判断是不是真折扣" },
  { name: "Ibotta", url: "https://ibotta.com", note: "超市日用品的购物返现" },
];
const fmtDate = (d) => d.toLocaleDateString(lang === "en" ? "en-US" : "zh-CN", { year: "numeric", month: "long", day: "numeric" });

/* ───────────── 大额购物规划：一次付清 / 分期 / 预存 ───────────── */
export function planPurchase({ price, group, event }) {
  const plan = budgetPlan(), mp = monthProgress(plan);
  const g = mp?.rows.find((r) => r.id === group) || null;
  const remaining = g ? g.budget - g.spent : null;
  const out = { price, group: g, remaining, now: null, installments: [], saving: null };
  if (g) out.now = remaining >= price ? { ok: true, left: remaining - price } : { ok: false, over: price - remaining, overPct: pct(price - remaining, g.budget) };
  out.installments = [3, 6, 12].map((n) => ({ n, each: price / n, ofBudget: g && g.budget > 0 ? pct(price / n, g.budget) : null }));
  if (event) {
    const days = Math.round((event.date - new Date()) / 86400000), months = Math.floor(days / 30);
    out.saving = months >= 1 ? { event, days, months, each: Math.ceil(price / months), ofBudget: g && g.budget > 0 ? pct(price / months, g.budget) : null } : { event, days, months: 0 };
  }
  return out;
}
const ofB = (p) => (p == null || p > 300 ? "" : t("（约占预算 {p}%）", { p }));   // 比预算大几倍时不再写离谱的百分比
function adviceHtml(r) {
  const g = r.group;
  const now = r.now ? (r.now.ok ? `<li>✅ ${t("一次付清：{g}本月预算还剩 {a}，买完剩 {b}。", { g: esc(t(g.name)), a: money(r.remaining), b: money(r.now.left) })}</li>`
    : `<li>⚠️ ${t("一次付清：会让{g}本月超出 {a}{p}。", { g: esc(t(g.name)), a: money(r.now.over), p: r.now.overPct > 300 ? "" : t("（预算的 {p}%）", { p: r.now.overPct }) })}</li>`) : `<li>${t("一次付清：{a}（先在上面填收入，才能对比预算）。", { a: money(r.price) })}</li>`;
  const inst = `<li>🧾 ${t("分期：")}${r.installments.map((x) => t("{n} 期每月 {a}{p}", { n: x.n, a: money(x.each), p: ofB(x.ofBudget) })).join("；")}。<small class="muted">${t("只有商家真正 0% 的分期才按这个算；有利息或手续费要加进去，信用卡分期尤其要看清。")}</small></li>`;
  const sv = r.saving ? (r.saving.months >= 1
    ? `<li>🐖 ${t("预存：距 {e}（{d}）还有约 {m} 个月，每月预存 {a}{p}就够了。", { e: esc(t(r.saving.event.name)), d: fmtDate(r.saving.event.date), m: r.saving.months, a: money(r.saving.each), p: ofB(r.saving.ofBudget) })}${r.saving.event.note ? ` <small class="muted">${esc(t(r.saving.event.note))}</small>` : ""}</li>`
    : `<li>${t("预存：距 {e} 不到一个月，来不及预存，建议一次付清或分期。", { e: esc(t(r.saving.event.name)) })}</li>`) : "";
  return `<ul class="tips bud-advice">${now}${inst}${sv}</ul>`;
}
const sitesHtml = () => `<ul class="bud-sites">${DEAL_SITES.map((s) => `<li><a class="link-name" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(t(s.name))}</a><small class="muted">${esc(t(s.note))}</small></li>`).join("")}</ul>
  <p class="muted" style="font-size:12.5px;margin:6px 0 0">${t("名称和网址可能变化，以官网为准；返利和优惠码的规则、有效期各家不同。")}</p>`;

/** 购物清单里填了预估金额时的提示（点“加入清单”后显示在清单上方） */
export function shopAdviceHtml() {
  const a = state.shopAdvice; if (!a) return "";
  const plan = budgetPlan();
  if (!plan) return `<div class="panel bud-tip"><b>💰 ${esc(a.name)} · ${money(a.estimate)}</b><p class="muted" style="margin:4px 0 0">${t("填上月收入就能看预算提示：")} <a href="${href("bills", "budget")}">${t("去设置预算")}</a></p></div>`;
  const ev = saleEvents(new Date(), 1)[0];
  const r = planPurchase({ price: a.estimate, group: a.group, event: ev });
  return `<div class="panel bud-tip"><div class="section-head" style="margin-bottom:4px"><h3 style="font-size:15px">💰 ${esc(a.name)} · ${money(a.estimate)}</h3><button type="button" class="btn btn-sm btn-ghost" data-action="shop-advice-close">${t("知道了")}</button></div>
    ${adviceHtml(r)}<a class="btn btn-sm btn-ghost" href="${href("bills", "budget")}">${t("打开预算规划")}</a></div>`;
}
export const groupForCategory = (category, amount = 0) => (category ? groupOf(category, amount) : amount >= bigThreshold() ? "big" : "groceries");   // 没选分类的购物项，多半是日常用品

/** 采购清单页顶部：清单 + 告急库存预估要花多少，对比本月预算 */
export function shopForecastHtml() {
  const plan = budgetPlan(); if (!plan) return "";
  const fc = restockForecast(), mp = monthProgress(plan), g = mp.rows.find((r) => r.id === "groceries");
  if (!fc.rows.length || !(fc.total > 0)) return "";
  return `<p class="muted bud-line">💰 ${t("清单和告急库存预计 {a}；日常储备本月还剩 {b}。", { a: money(fc.total), b: money(Math.max(0, g.budget - g.spent)) })} <a href="${href("bills", "budget")}">${t("看预算")}</a></p>`;
}

/* ───────────── 页面 ───────────── */
const bar = (spent, budget, pace) => {
  const p = pct(spent, budget), cls = p >= 100 ? "over" : p >= 85 ? "warn" : "";
  return `<div class="bud-bar ${cls}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(100, p)}"><i style="width:${Math.min(100, p)}%"></i>${pace != null ? `<u style="left:${Math.round(pace * 100)}%" title="${t("本月已过去的比例")}"></u>` : ""}</div>`;
};
const row = (g, spent, budget, pace, extra = "") => `<div class="bud-row"><div class="bud-head"><b>${g.icon} ${esc(t(g.name))}</b><span>${money(spent)} / ${money(budget)} · ${pct(spent, budget)}%</span></div>${bar(spent, budget, pace)}
  <small class="${spent > budget ? "down" : "muted"}">${spent > budget ? t("超出 {a}", { a: money(spent - budget) }) : t("还剩 {a}", { a: money(budget - spent) })}${extra}</small></div>`;

export function viewBudget() {
  const plan = budgetPlan(), b = state.budget || {};
  const rangeChips = [6, 12].map((n) => `<button type="button" class="chip" data-action="stats-months" data-months="${n}" aria-pressed="${state.stats.months === n}">${t("近 {n} 个月", { n })}</button>`).join("");
  const owner = isHouseholdOwner(), mine = state.incomes.find((i) => i.user_id === myId()), settingsHref = `${href("me", "settings")}?sec=income`;
  if (!plan) {
    const body = owner
      ? (totalIncomeMonthly() > 0
        ? `<div class="panel cta-panel"><div><b>${t("收入已经设置了，还没有预算")}</b><p class="muted">${t("按全家收入、固定账单和储蓄比例生成第一版。")}</p></div><button type="button" class="btn btn-primary" data-action="budget-generate">${t("生成预算")}</button></div>`
        : `<div class="panel cta-panel"><div><b>${t("还没有预算：先设置收入")}</b><p class="muted">${t("在 设置 → 收入与预算 填你的收入（每个人只能看到自己的），预算会自动生成。")}</p></div><a class="btn btn-primary" href="${settingsHref}">${t("去设置收入")}</a></div>`)
      : `<div class="panel cta-panel"><div><b>${mine ? t("家主还没有生成预算") : t("还没有预算")}</b><p class="muted">${mine ? t("你的收入已经填好了，等家主生成预算就能在这里看到。") : t("先在 设置 → 收入与预算 填你自己的收入；预算由家主按全家收入生成。")}</p></div>${mine ? "" : `<a class="btn btn-primary" href="${settingsHref}">${t("去设置收入")}</a>`}</div>`;
    return `<section class="section"><div class="section-head"><h2>${t("预算")}</h2></div>${body}
      <p class="muted">${t("预算 = 全家收入 − 固定账单 − 储蓄，剩下的“可支配额”按过去的花费比例分给各类；超了会在首页提醒。")}</p></section>`;
  }

  const mp = monthProgress(plan), cm = mp.month;
  const months = lastMonths(state.stats.months), abm = actualByMonth();
  const ser = [BILLS_GROUP, ...GROUPS];
  const totals = months.map((m) => ser.reduce((s, g) => s + (abm[m]?.[g.id] || 0), 0));
  const stacked = Charts.bars({ title: t("每月花费构成（账单 vs 其他）"), labels: months.map(monthLabel), fmt: money,
    series: [{ name: t("账单"), color: BILLS_GROUP.color, values: months.map((m) => abm[m]?.bills || 0) },
      { name: t("其他花费"), color: "#d4694c", values: months.map((m) => ser.slice(1).reduce((s, g) => s + (abm[m]?.[g.id] || 0), 0)) }] });
  const vs = Charts.line({ title: t("实际花费 vs 预算 vs 收入"), labels: months.map(monthLabel), fmt: money,
    barSeries: { name: t("实际花费"), color: "#d4694c", values: totals },
    series: [{ name: t("预算合计"), color: "var(--pine)", values: months.map(() => plan.totalBudget) }, ...(plan.income != null ? [{ name: t("月收入"), color: "var(--ink)", values: months.map(() => plan.income) }] : [])] });

  // 年度：今年已过的月份 × 月预算
  const now = new Date(), yr = now.getFullYear(), elapsed = now.getMonth() + (now.getDate() / new Date(yr, now.getMonth() + 1, 0).getDate());
  const ytd = (g) => Object.entries(abm).filter(([m]) => m.startsWith(`${yr}-`)).reduce((s, [, v]) => s + (v[g] || 0), 0);
  const yrRows = [{ ...BILLS_GROUP, budget: plan.billsM }, ...plan.groups].map((g) => ({ g, spent: ytd(g.id), budget: g.budget * 12, proj: elapsed > 0.3 ? (ytd(g.id) / elapsed) * 12 : null }));
  const yrSpent = yrRows.reduce((s, r) => s + r.spent, 0), yrBudget = plan.totalBudget * 12, yrProj = elapsed > 0.3 ? (yrSpent / elapsed) * 12 : null;
  const events = saleEvents(new Date(), 6), ctx = { plan, mp };
  const efLow = Math.round(plan.essentialM * 3), efHigh = Math.round(plan.essentialM * 6);

  return `
    <section class="section">
      <div class="section-head"><h2>${t("预算")}</h2><div class="head-acts"><button type="button" class="btn btn-sm btn-ghost" data-action="print-run" data-kind="budget">${t("打印")}</button></div></div>
      ${incomeBanner()}
      <div class="kpis">
        ${plan.income != null ? `<div class="kpi"><span>${t("月收入（全家）")}</span><b>${money(plan.income)}</b><small>${t("年收入 {a}", { a: money(plan.income * 12) })}</small></div>` : ""}
        <div class="kpi"><span>${t("固定账单")}</span><b>${money(plan.billsM)}</b><small>${plan.income != null ? `${t("占收入 {p}%", { p: pct(plan.billsM, plan.income) })} · ` : ""}${t("必要 {a}", { a: money(plan.essentialM) })}</small></div>
        ${plan.savings != null ? `<div class="kpi"><span>${t("计划储蓄")}</span><b>${money(plan.savings)}</b><small>${plan.savingsPct}%</small></div>` : ""}
        <div class="kpi"><span>${t("每月可支配")}</span><b>${money(plan.pool)}</b><small>${plan.hasHistory ? t("按过去 6 个月花费比例分配") : t("还没有历史花费，先按常见比例分配")}</small></div>
      </div>
      ${plan.income != null && plan.pool <= 0 ? `<p class="form-error">${t("固定账单和储蓄已经用完了收入，没有可支配额：先看看账单能不能压缩，或降低储蓄比例。")}</p>` : ""}
    </section>

    ${extras("top", ctx)}
    <section class="section">
      <div class="section-head"><h2>${t("本月预算")}</h2><p>${t("竖线是本月已过去的进度；条越过竖线说明花得比时间快")}</p></div>
      <div class="panel">
        ${row(BILLS_GROUP, mp.bills, plan.billsM, mp.pace, "")}
        ${mp.rows.map((r) => row(r, r.spent, r.budget, mp.pace)).join("")}
        <div class="bud-total">${row({ icon: "💰", name: "可支配花费合计" }, mp.spent, mp.variable, mp.pace)}</div>
      </div>
    </section>

    ${extras("month", ctx)}
    <section class="section">
      <div class="section-head"><h2>${t("各类月预算")}</h2><p>${t("可以改，留空 = 用建议值")}</p></div>
      <form id="budgetCatsForm" class="panel">
        <div class="form-grid">${plan.groups.map((g) => `<label>${g.icon} ${esc(t(g.name))}（${t("建议 {a}", { a: money(g.suggested) })}${g.fromFund ? t("，按设备寿命") : ""}）<input name="cat_${g.id}" type="number" min="0" step="1" inputmode="decimal" value="${g.custom ? esc(g.budget) : ""}" placeholder="${g.suggested}" ${plan.owner ? "" : "disabled"}></label>`).join("")}</div>
        <label style="display:block;margin-top:10px;font-size:13px;font-weight:700">${t("“大件”门槛（{cur}，单笔达到它就记为大件家电）", { cur: cur() })}<input name="big_threshold" type="number" min="1" step="1" inputmode="numeric" value="${meta("_big_threshold", "") || ""}" placeholder="${bigThreshold()}" style="max-width:160px;display:block;margin-top:4px" ${plan.owner ? "" : "disabled"}></label>
        <p class="${plan.left != null && plan.left < -1 ? "form-error" : "muted"}" style="margin:8px 0 0;font-size:13px">${!plan.owner ? t("只有家主能调整预算比例和各类金额。") : plan.left < -1 ? t("各类预算加起来超出可支配额 {a}，实际会吃掉储蓄。", { a: money(-plan.left) }) : t("账单、各类预算和储蓄加起来还剩 {a} 没分配。", { a: money(Math.max(0, plan.left)) })}</p>
        ${plan.owner ? `<div class="form-actions"><button type="submit" class="btn btn-primary btn-sm">${t("保存预算")}</button><button type="button" class="btn btn-sm btn-ghost" data-action="budget-reset">${t("恢复建议值")}</button><a class="btn btn-sm btn-ghost" href="${settingsHref}">${t("调整收入和比例")}</a></div>` : ""}</form>
    </section>

    <section class="section">
      <div class="section-head"><h2>${t("预算 vs 实际")}</h2><div class="seg" role="group" aria-label="${t("时间范围")}" style="margin:0">${rangeChips}</div></div>
      <div class="panel chart-panel"><h3>${t("账单和实际花费的关系")}</h3><p class="muted" style="margin:0 0 6px;font-size:13px">${t("按缴费日记账；年付账单缴费的那个月会特别高，看年度更准。")}</p>${stacked}</div>
      <div class="panel chart-panel"><h3>${t("每月：实际 vs 预算 vs 收入")}</h3>${vs}</div>
    </section>

    <section class="section">
      <div class="section-head"><h2>${t("{y} 年度预算", { y: yr })}</h2><p>${t("预算 = 月预算 × 12；预计全年按今年已花的速度推算")}</p></div>
      <div class="panel">
        ${yrRows.map((r) => row(r.g, r.spent, r.budget, elapsed / 12, r.proj != null ? ` · ${t("预计全年 {a}", { a: money(r.proj) })}` : "")).join("")}
        <div class="bud-total">${row({ icon: "📅", name: "年度合计" }, yrSpent, yrBudget, elapsed / 12, yrProj != null ? ` · ${t("预计全年 {a}", { a: money(yrProj) })}` : "")}</div>
        ${plan.income != null ? `<p class="muted" style="margin:8px 0 0;font-size:13px">${t("年收入 {i}，计划储蓄 {s}；预计全年花费 {p} 时，结余约 {r}。", { i: money(plan.income * 12), s: money(plan.savings * 12), p: yrProj != null ? money(yrProj) : "—", r: yrProj != null ? money(plan.income * 12 - yrProj) : "—" })}</p>` : ""}
      </div>
    </section>

    ${extras("annual", ctx)}
    <section class="section">
      <div class="section-head"><h2>${t("大额购物规划")}</h2><p>${t("想买一件贵的东西：看预算够不够，要不要分期，或者每月预存等促销日")}</p></div>
      <form id="planForm" class="panel">
        <div class="form-grid">
          <label>${t("想买什么（可不填）")}<input name="name" maxlength="60" placeholder="${t("例如：洗碗机、沙发")}"></label>
          <label>${t("价格（{cur}）", { cur: cur() })}<input name="price" type="number" min="1" step="1" inputmode="decimal" required></label>
          <label>${t("算进哪一类")}<select name="group">${plan.groups.map((g) => `<option value="${g.id}" ${g.id === "house" ? "selected" : ""}>${g.icon} ${esc(t(g.name))}</option>`).join("")}</select></label>
          <label>${t("打算在什么时候买")}<select name="event"><option value="">${t("尽快")}</option>${events.map((e, i) => `<option value="${i}">${esc(t(e.name))} · ${esc(fmtDate(e.date))}${e.approx ? t("（约）") : ""}</option>`).join("")}</select></label>
        </div>
        <div class="form-actions"><button type="submit" class="btn btn-primary btn-sm">${t("帮我规划")}</button></div>
        <div id="planOut" aria-live="polite"></div></form>
      <div class="panel"><h3 style="font-size:15px;margin:0 0 6px">${t("省钱渠道")}</h3>${sitesHtml()}</div>
    </section>

    ${extras("plan", ctx)}
    <section class="section">
      <div class="section-head"><h2>${t("应急金")}</h2></div>
      <div class="panel"><p style="margin:0">${plan.essentialM > 0 ? t("按必要账单每月 {m} 算，建议备 3–6 个月的应急金：{a} – {b}。", { m: money(plan.essentialM), a: money(efLow), b: money(efHigh) }) : t("在账单里把必要的项目标成“必要支出”，这里就能算建议的应急金（3–6 个月）。")}</p>
        <p class="muted" style="margin:6px 0 0;font-size:13px">${t("应急金不放在可支配额里，也不要拿去买大件。")}</p></div>
    </section>`;
}

/* ───────────── 交互 ───────────── */
document.addEventListener("submit", async (e) => {
  const f = e.target;
  if (f.id === "budgetCatsForm" && !isHouseholdOwner()) { e.preventDefault(); return; }
  if (false) {
  } else if (f.id === "budgetCatsForm") {
    e.preventDefault();
    try {
      const cb = underscoreKeys(state.budget?.cat_budgets); for (const g of GROUPS) { const v = f.elements[`cat_${g.id}`].value; if (v !== "") cb[g.id] = Math.max(0, Math.round(num(v))); }
      const th = f.elements.big_threshold?.value; if (th !== "" && num(th, 0) > 0) cb._big_threshold = Math.round(num(th)); else delete cb._big_threshold;
      state.budget = await Store.saveBudget({ ...state.budget, cat_budgets: cb });
      toast(t("预算已保存")); document.dispatchEvent(new CustomEvent("budget-saved"));
    } catch (err) { toast(budgetError(err)); }
  } else if (f.id === "planForm") {
    e.preventDefault();
    const price = num(f.elements.price.value, 0); if (price <= 0) return;
    const ev = f.elements.event.value === "" ? null : saleEvents(new Date(), 6)[+f.elements.event.value];
    const name = f.elements.name.value.trim();
    $("#planOut").innerHTML = `<div class="bud-tip" style="margin-top:10px"><b>${name ? `${esc(name)} · ` : ""}${money(price)}</b>${adviceHtml(planPurchase({ price, group: f.elements.group.value, event: ev }))}</div>`;
  }
});
const budgetError = (err) => (/household_budgets|relation .* does not exist|schema cache/i.test(err.message || "") ? t("还没执行数据库迁移 022（household_budgets 表），先在 Supabase 里执行 supabase/migrations/022_budgets.sql") : t("保存失败：{msg}", { msg: err.message }));
/** main.js 里的点击入口 */
export async function budgetAction(action, ctx, el) {
  if (actions[action]) { try { return await actions[action](el, ctx); } catch (e) { toast(budgetError(e)); return; } }
  if (action === "budget-reset") { try { state.budget = await Store.saveBudget({ ...state.budget, cat_budgets: underscoreKeys(state.budget?.cat_budgets) }); toast(t("已恢复建议值")); ctx.render(); } catch (e) { toast(budgetError(e)); } }
  if (action === "budget-generate") { try { await generatePlan(); toast(t("预算已生成")); } catch (e) { toast(budgetError(e)); } return; }
  if (action === "budget-keep") { state.incomePrompt = false; try { const snap = state.budget?.cat_budgets?._plan; if (snap) await saveMeta({ _plan: { ...snap, dismissed_at: new Date().toISOString() } }); else ctx.render(); } catch (e) { toast(budgetError(e)); } return; }
  if (action === "shop-advice-close") { state.shopAdvice = null; ctx.render(); }
}
