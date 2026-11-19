/* 预算：预算分组，和预算设置里的杂项（存在 cat_budgets 里以下划线开头的行）。 */
import { LEGACY_BUDGET, LEGACY_SPLIT, budgetGroupOf, budgetL2s } from "../core/taxonomy.js";
import { Store } from "../core/store.js";
import { alertsOf } from "../core/logic.js";
import { budgetBridge } from "../core/budget-bridge.js";
import { cached } from "../core/spend-data.js";
import { lastMonths, monthKey, rangeMonths, spendRollupFor } from "../stats/views.js";
import { num, spaceOf } from "../core/util.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";

/* ───────────── 预算分组 ───────────── */
// 固定账单单独算一组（从账单项目的每月折算得来）；其余花费按 二级分类 分组（js/core/taxonomy.js 的 budgetL2s：食品杂货、餐饮、交通、日用个护、维护与服务…），
// 按过去 6 个月的比例分配“可支配额”。转账、资本性、投资不进预算（勾了花费页「排除资本性」以外的，资本性也不进：预算只管日常）。
// 以前的分组键（groceries / dining / big / vehicle…，2026-10 之前存在 cat_budgets 里）读的时候按 LEGACY_BUDGET 换成二级分类，存储不改；以后保存写新键。
const W = { grocery: 0.2, dining: 0.1, essentials: 0.05, home_goods: 0.04, apparel: 0.03, digital: 0.02, shop_misc: 0.03, transport: 0.1, home_maint: 0.1, kids: 0.06, healthcare: 0.05, fun: 0.05, travel: 0.05, living_other: 0.05, personal: 0.04, pets: 0.03, work: 0.03, gov_admin: 0.02, loans_fees: 0.01 };
export const budgetGroups = () => budgetL2s().map((n) => ({ id: n.id, name: n.name, icon: n.icon, color: n.color, w: W[n.id] ?? 0.02 }));
export const BILLS_GROUP = { id: "bills", name: "账单", icon: "🧾", color: "#2f5d8a" };
/* 医疗（事件型医疗账单的付款，叶子 medical）：默认不计入每月“可支配”预算（大额、不可预测，和日常花费分开看）；在 财务 → 收入 → 预算与计划 里可以改成计入，
 * 那时它并进「医疗健康」这一组 */
export const MEDICAL_BUDGET_GROUP = { id: "medical", name: "医疗", icon: "🏥", color: "#c2475f" };
export const medInPool = () => meta("_med_in_pool", false) === true;
export const groupsNow = () => budgetGroups();
export const DRILL_HINT = () => `<p class="muted drill-hint">${t("点预算行或图里的柱子，可以查看对应的花费明细。")}</p>`;
/** 一笔花费归哪一组：bills / medical / 二级分类，或 transfer / capital / investment（这三种不进预算）；nature 空 = 按分类默认 */
export const groupOf = (category, nature = null) => budgetGroupOf(category, nature, { medInPool: medInPool(), inclCapital: state.stats.exCap === false });
   // 花费页去掉了「排除资本性」：资本性也按分类进预算
budgetBridge.groupOf = groupOf;
   // 明细页按预算分组筛选时用
Object.defineProperty(budgetBridge, "groups", { get: () => [BILLS_GROUP, ...budgetGroups(), MEDICAL_BUDGET_GROUP, { id: "capital", name: "资本性支出", icon: "🏦", color: "#4b5563" }], configurable: true });
/** 旧键 → 新键：cat_budgets / _plan.groups 里 2026-10 之前的分组键换算成二级分类（同一个目标的几个旧键相加）；已经有新键的以新键为准。
 *  2026-11 拆开的 food（餐饮 → 食品杂货 + 餐饮）、shopping（购物日用 → 日用个护 / 家居家电 / 服饰鞋包 / 数码电子 / 综合购物）：
 *  旧金额按过去 6 个月这几组的实际花费比例分（splitShares）；存储不改，下次保存预算就写成新键 */
export function mapLegacy(obj) {
  const out = {}, src = obj || {}, skip = (k) => (k in LEGACY_BUDGET && LEGACY_BUDGET[k] !== k) || k in LEGACY_SPLIT;
  for (const [k, v] of Object.entries(src)) if (!k.startsWith("_") && !skip(k) && v !== "" && v != null) out[k] = num(v);   // 新键（travel / work 新旧同名）
  for (const [k, v] of Object.entries(src)) {
    const to = LEGACY_BUDGET[k]; if (!to || to === k || v === "" || v == null || to in src) continue;
    out[to] = (out[to] || 0) + num(v);
  }
  for (const [k, tos] of Object.entries(LEGACY_SPLIT)) {
    const v = src[k]; if (v === "" || v == null || tos.some((x) => x in src)) continue;
    const sh = splitShares(tos); let left = Math.round(num(v));
    tos.forEach((x, i) => { const a = i === tos.length - 1 ? left : Math.round(num(v) * sh[i]); left -= a; out[x] = (out[x] || 0) + a; });
  }
  return out;
}
/** 拆分比例：过去 6 个月（不含本月）各组的实际花费；都没有就按默认权重 W */
function splitShares(ids) {
  const abm = actualByMonth(), past = lastMonths(7).slice(0, 6);
  const h = ids.map((id) => past.reduce((s, m) => s + (abm[m]?.[id] || 0), 0)), tot = h.reduce((a, b) => a + b, 0);
  const w = tot > 0 ? h : ids.map((id) => W[id] ?? 0.02), wt = w.reduce((a, b) => a + b, 0) || 1;
  return w.map((x) => x / wt);
}
export const cur = () => Units.region.currency;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : a > 0 ? 999 : 0);
/* ───────────── 预算设置里的杂项（存在 cat_budgets 里以下划线开头的键：大件门槛、发薪日、储蓄目标、订阅标记、分摊占比） ───────────── */
export const meta = (key, def = null) => { const v = state.budget?.cat_budgets?.[key]; return v == null ? def : v; };
export async function saveMeta(patch) {
  const base = state.budget || { income_amount: 0, income_period: "month", savings_pct: 20, cat_budgets: {} };
  state.budget = await Store.saveBudget({ ...base, cat_budgets: { ...(base.cat_budgets || {}), ...patch } });
  document.dispatchEvent(new CustomEvent("budget-saved"));
}
export const underscoreKeys = (o) => Object.fromEntries(Object.entries(o || {}).filter(([k]) => k.startsWith("_")));
/** 大额门槛：美元 / 加元等 300，人民币 2000，可在“各类月预算”里改。以前用来分「大件家电」预算组；现在只在记一笔达到它时问一句要不要标成资本性支出 */
export const bigThreshold = () => num(meta("_big_threshold", null), 0) || (["CNY", "RMB"].includes(cur()) ? 2000 : 300);
export const slots = {}, actions = {};
export const registerSection = (slot, order, fn) => { (slots[slot] ||= []).push({ order, fn }); };
export const registerAction = (name, fn) => { actions[name] = fn; };
export const extras = (slot, ctx) => (slots[slot] || []).sort((a, b) => a.order - b.order).map((x) => { try { return x.fn(ctx) || ""; } catch (e) { console.error("[budget]", slot, e); return ""; } }).join("");
/** 设备更换基金：按“更换估价 ÷ 常见寿命”每月该预存多少（联动 房屋 → 设备保养） */
export function applianceFund() {
  const eq = state.assetsEnriched.filter((a) => a.kind !== "vehicle" && a.property_id);
  const rows = eq.filter((a) => num(a.replacement_cost_estimate) > 0 && num(a.expected_life_years) > 0).map((a) => ({
    id: a.id, name: a.name, cost: num(a.replacement_cost_estimate), life: num(a.expected_life_years), yearsLeft: a.ageYears != null ? num(a.expected_life_years) - a.ageYears : null,
    monthly: num(a.replacement_cost_estimate) / (num(a.expected_life_years) * 12) })).sort((x, y) => (x.yearsLeft ?? 99) - (y.yearsLeft ?? 99));
  return { rows, monthly: rows.reduce((s, r) => s + r.monthly, 0), missing: eq.length - rows.length };
}
/** 物品 / 分类最近几次的买价（数据库 item_purchase_stats，迁移 057）：key = 物品 + 分类 + 币种 */
const PRICES = cached((cur, items, cats) => Store.itemPurchaseStats(cur, items, cats), { max: 8, fallback: [] });
/** 补货预估：库存告急的东西 + 购物车里没买的，按以前买它的花费（最近 3 次的中位数，没有就按同分类最近 10 次）估价（联动 储藏 / 采购）。
 *  买价只查要估的这些物品和分类；还没读回来时 loading = true */
export function restockForecast() {
  const median = (a) => { const x = [...a].sort((p, q) => p - q); return x.length ? (x.length % 2 ? x[(x.length - 1) / 2] : (x[x.length / 2 - 1] + x[x.length / 2]) / 2) : null; };
  const need = new Map();
  for (const it of alertsOf(state.enriched.filter((x) => spaceOf(x.category) !== "gear"))) need.set(it.id, { name: it.name, itemId: it.id, cat: it.category, src: "stock" });
  for (const s of state.shopping.filter((x) => x.status !== "bought")) {
    const key = s.item_id || `n:${s.name}`;
    if (!need.has(key)) { const it = state.items.find((i) => i.id === s.item_id); need.set(key, { name: s.name, itemId: s.item_id, cat: it?.category || s.category || "other", src: "list" }); }
  }
  const items = [...new Set([...need.values()].map((r) => r.itemId).filter(Boolean))].sort(), cats = [...new Set([...need.values()].map((r) => r.cat).filter(Boolean))].sort();
  const stats = need.size ? PRICES.get(`${cur()}|${items.join(",")}|${cats.join(",")}`, cur(), items, cats) : [];
  const byItem = new Map(), byCat = new Map();
  for (const s of stats || []) (s.kind === "item" ? byItem : byCat).set(s.key, (s.amts || []).map(Number));
  const rows = [...need.values()].map((r) => ({ ...r, est: median(byItem.get(String(r.itemId)) || []) ?? median(byCat.get(r.cat) || []) })).sort((a, b) => (b.est ?? -1) - (a.est ?? -1));
  const byGroup = {}; for (const r of rows) if (r.est != null) { const g = groupOf(r.cat); byGroup[g] = (byGroup[g] || 0) + r.est; }   // 按二级分类：餐饮 / 维护与服务 / 购物日用…
  return { rows, total: rows.reduce((s, r) => s + (r.est || 0), 0), unknown: rows.filter((r) => r.est == null).length, byGroup, loading: stats == null };
}
/** 本月账单：已缴、还要交（含已逾期的）、逾期笔数 */
export function billsThisMonth() {
  const now = new Date(), m = monthKey(now), today = now.toISOString().slice(0, 10);
  const open = state.billsEnriched.filter((b) => b.active && !b.ended && !b.escrow && b.direction !== "receivable" && b.next_due_on && (b.currency || cur()) === cur() && (b.next_due_on.startsWith(m) || b.next_due_on < today));
  return { paid: actualByMonth()[m]?.bills || 0, due: open.reduce((s, b) => s + num(b.est), 0), dueN: open.length, overdueN: open.filter((b) => b.next_due_on < today).length };
}
/** 预算要看的月份：近 7 个月（过去 6 个月 + 本月）、今年（年度进度）、花费页的时间范围（趋势图）——合成一段一次读 */
function budgetMonths() {
  const now = lastMonths(1)[0], ms = [...lastMonths(7), `${now.slice(0, 4)}-01`, ...rangeMonths(state.stats.months === "m" ? 3 : state.stats.months)].sort();
  const out = []; for (let m = ms[0]; m <= now; m = nextM(m)) out.push(m);
  return out;
}
const nextM = (m) => { const [y, mo] = m.split("-").map(Number); return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`; };
let abmMemo = { rows: null, key: "", out: {} };
/** 各月各组的实际花费 { "2026-10": { bills, food, home_maint, medical, … } }：数据库的按月聚合（spend_rollup）按预算分组再加一遍；
 *  只算本币（没填币种的当本币），退款（负数）照减；聚合还在读时返回 {}（读完会重画） */
export function actualByMonth() {
  const rows = spendRollupFor(budgetMonths()); if (!rows) return {};
  const key = [cur(), medInPool(), state.stats.exCap].join("|");
  if (abmMemo.rows === rows && abmMemo.key === key) return abmMemo.out;
  const out = {};
  for (const r of rows) {
    if (!r.sum || (r.cur && r.cur !== cur())) continue;
    const g = groupOf(r.c, r.nat);
    if (g === "transfer" || g === "capital" || g === "investment") continue;   // 转账、资本性、投资不算进预算的实际花费
    ((out[r.m] ||= {})[g] = (out[r.m][g] || 0) + r.sum);
  }
  abmMemo = { rows, key, out };
  return out;
}
