import { categoryOptions } from "../pantry/views.js";
import { state } from "../core/state.js";
import { Store } from "../core/store.js";
import { askInline } from "../core/ask.js";
import { $, DAY, catOf, du, esc, fmt, money, num, showQty, toast } from "../core/util.js";
import { compare, lang, locale, t } from "../core/i18n.js";
import { memberName } from "../core/logic.js";
import { href } from "../core/router.js";
import { withProperty } from "../core/alerts.js";
import { tabBar, tabHub } from "../core/hub.js";
import { KINDS as MED_KINDS } from "../bills/medical.js";
import { spendSuggestions } from "../core/spend-data.js";
import { budgetBridge } from "../core/budget-bridge.js";
import { SPEND_TABS, activeTab } from "../core/tabs.js";
import { billExpenseMonthly } from "../bills/debt-logic.js";
import { cardHintHtml, cardOptions, cardSelectHtml, payAcctValue, paymentPayLabel } from "../bills/cards-views.js";
import { moreBtn } from "../core/pager.js";
import { serverList } from "../core/server-list.js";
import { compact, cursorOf } from "../core/list-query.js";
import { financeOk } from "../core/finance-access.js";   // 没有财务权限：花费页不显示「导入对账单」
import { BUCKETS, L1S, LEGACY_STAT, NATURES, allLeaves, bucketOf, childrenOf, coversUnknown, defaultNature, effNature, isNode, isTransfer, knownLeafIds, l1Of, l2IdOf, l2List,
  l2Of, leafInfo, leafLabel, leavesOf, natureName, natureOptions, natureParams, nodeOf, parentOf, treeOptions } from "../core/taxonomy.js";
import { aggregate, avg, fullMonths, livingSeries, median, nodeSum, normRow, normalizedMonthly, outflowSeries, rankChildren, series, storeAgg, sum, withHousingSeries } from "./report.js";

/* ── 统计：花费分类树（js/core/taxonomy.js：叶子 → 二级 → 一级 + 经济性质 + 统计口径）──
 * 概览 / 分类 / 商店 / 账单概览的速览都读数据库按月聚合好的紧凑行（迁移 055 的 spend_rollup / spend_rollup_store），
 * 在 report.js 按分类树汇总；明细是 054 的服务器分页（new 排序走 057 的索引快路）。浏览器里不再有整表的花费（迁移 057 去掉了 state.purchases）。 */
/** 全部叶子分类（名称 / 图标 / 颜色）：明细、CSV、打印按 id 找名字 */
export const ALL_CATS = () => allLeaves();
/** 旧接口（收入对比、全部流水用）：叶子 → 二级分类 id；STAT_CATS = 全部二级分类 */
export const statCat = (id) => l2IdOf(id);
export const STAT_CATS = () => l2List();
const isBill = (id) => String(id || "").startsWith("bill_");
/** 统计开关：排除资本性 / 排除投资（概览的趋势线、分类、商店都跟着；默认都排除，和以前「资本性支出默认不进图」一致） */
const statOpts = () => ({ cur: Units.region.currency, exCap: state.stats.exCap !== false, exInv: state.stats.exInv !== false });

/* ── 聚合数据的缓存：按 [from, to) 本地日期读一次，花费变了（spend-rows-changed）标过期，下次画的时候后台重读 ── */
/** 浏览器所在时区：月份、日按本地时间算（和 monthKey 一致） */
const TZ = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; } };
const nextMonth = (m) => { const [y, mo] = m.split("-").map(Number); return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`; };
/** 一组月份 → 覆盖它们的日期范围 { from, to }（含 from 不含 to） */
const spanOfMonths = (ms) => { const s = [...ms].sort(); return { from: `${s[0]}-01`, to: `${nextMonth(s.at(-1))}-01` }; };
const ROLL = new Map();   // key → { rows, busy, stale, err, p }
let rollErrShown = false;
function rollEntry(from, to, store) {
  const key = `${store ? "s" : "r"}|${from}|${to}`;
  let e = ROLL.get(key);
  if (!e || (e.stale && !e.busy)) {
    if (!e) { if (ROLL.size > 24) ROLL.delete(ROLL.keys().next().value); e = { rows: null }; ROLL.set(key, e); }
    e.busy = true; e.stale = false;
    e.p = (store ? Store.spendRollupStore(from, to, TZ()) : Store.spendRollup(from, to, TZ()))
      .then((rows) => { e.rows = (rows || []).map(normRow); e.err = ""; })
      .catch((err) => {
        e.err = err?.message || String(err); e.rows = e.rows || [];
        if (!rollErrShown) { rollErrShown = true; toast(/could not find the function|schema cache|does not exist/i.test(e.err) ? t("花费统计读不出来：数据库还没升级，请先执行 supabase/migrations/055_spend_taxonomy.sql") : t("花费统计读取失败：{msg}", { msg: e.err })); }
      })
      .finally(() => { e.busy = false; window.dispatchEvent(new Event("spend-data-loaded")); });
  }
  return e;
}
/** 聚合行（null = 还在读；读过一次之后过期重读期间先用旧的） */
const rollup = (from, to, store = false) => rollEntry(from, to, store).rows;
/** 等它读完（打印用） */
const rollupAsync = async (from, to, store = false) => { const e = rollEntry(from, to, store); await e.p; return e.rows || []; };
/** 覆盖这些月份的聚合行（预算的实际花费用，规范化后的 { m, c, nat, cur, sum, n }）；还在读返回 null */
export const spendRollupFor = (months) => { const sp = spanOfMonths(months); return rollup(sp.from, sp.to); };
window.addEventListener("spend-rows-changed", () => { for (const e of ROLL.values()) e.stale = true; });
const rollErr = () => [...ROLL.values()].find((e) => e.err)?.err || "";
export const monthKey = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`; };
const MONTH_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const monthLabel = (k) => (lang === "en"
  ? (k.endsWith("-01") ? `${MONTH_EN[0]} ${k.slice(2, 4)}` : MONTH_EN[+k.slice(5) - 1])
  : (k.endsWith("-01") ? t("{yy}年1月", { yy: k.slice(2, 4) }) : t("{m}月", { m: +k.slice(5) })));
export function lastMonths(n) {
  const d = new Date(), out = [];
  for (let i = n - 1; i >= 0; i--) out.push(monthKey(new Date(d.getFullYear(), d.getMonth() - i, 1)));
  return out;
}

/** 趋势图的月份：选了某一年 = 那一年；其余 = 近 12 个月（时间范围更短时也看满 12 个月的走势） */
export const trendMonths = (n = state.stats.months) => (typeof n === "string" && n.startsWith("y:") ? rangeMonths(n) : lastMonths(12));
/** 概览 / 分类 / 速览要用到的全部月份（时间范围 + 对比的前一段 + 趋势），合成一段一次读 */
const baseSpan = (n = state.stats.months) => spanOfMonths([...rangeMonths(n), ...comparePlan(n).b.months, ...trendMonths(n)]);
/** 一组月份的汇总（月份要在 baseSpan 里）；还在读返回 null */
export function spendAgg(months, n = state.stats.months) {
  const sp = baseSpan(n), rows = rollup(sp.from, sp.to);
  return rows ? aggregate(rows, months, statOpts()) : null;
}
/** 打印 / 导出：等数据读完再汇总 */
export async function spendAggAsync(months) { const sp = spanOfMonths(months); return aggregate(await rollupAsync(sp.from, sp.to), months, statOpts()); }

export function consumptionData() {
  const WEEKS = 12, now = Date.now();
  const starts = Array.from({ length: WEEKS }, (_, i) => now - (WEEKS - i) * 7 * DAY);
  const labels = starts.map((x) => { const d = new Date(x); return `${d.getMonth() + 1}/${d.getDate()}`; });
  const wk = (x) => Math.floor((x - starts[0]) / (7 * DAY));
  const itemCat = Object.fromEntries(state.items.map((i) => [i.id, i.category]));
  const freq = {}, perItem = {};
  for (const l of state.logs) {
    if (l.reason !== "consume") continue;
    const w = wk(new Date(l.created_at).getTime());
    if (w < 0 || w >= WEEKS) continue;
    const c = itemCat[l.item_id];
    if (!c) continue;
    (freq[c] ||= Array(WEEKS).fill(0))[w]++;
    perItem[l.item_id] = (perItem[l.item_id] || 0) + 1;
  }
  return { WEEKS, starts, labels, freq, perItem };
}

// 周消耗量 + 每周末库存水位（用当前库存减去之后发生的所有变动倒推）
export function itemSeries(item, starts) {
  const W = starts.length, f = Units.factor(item.unit);
  const used = Array(W).fill(0), level = Array(W).fill(0);
  const logs = state.logs.filter((l) => l.item_id === item.id).map((l) => ({ t: new Date(l.created_at).getTime(), d: num(l.delta), r: l.reason }));
  for (const l of logs) {
    const w = Math.floor((l.t - starts[0]) / (7 * DAY));
    if (l.r === "consume" && w >= 0 && w < W) used[w] += -l.d;
  }
  for (let i = 0; i < W; i++) {
    const end = starts[i] + 7 * DAY;
    const after = logs.filter((l) => l.t > end).reduce((a, l) => a + l.d, 0);
    level[i] = Math.max(0, num(item.quantity) - after);
  }
  return { used: used.map((v) => v * f), level: level.map((v) => v * f), unit: t(du(item.unit)) };
}

/** 时间范围：近 3 / 6 / 9 / 12 个月，或某一年（"y:2025"，从今年到最早有记录的那年）；花费各标签和预算趋势共用（state.stats.months）。
 *  数据都是数据库按月聚合的（spend_rollup），往年不用先读花费 */
export const RANGES = [3, 6, 9, 12];
const thisYear = () => new Date().getFullYear();
export function rangeMonths(n = state.stats.months) {
  if (n === "m") return lastMonths(1);   // 本月
  if (typeof n === "string" && n.startsWith("y:")) { const y = +n.slice(2), last = y === thisYear() ? new Date().getMonth() + 1 : 12; return Array.from({ length: last }, (_, i) => `${y}-${String(i + 1).padStart(2, "0")}`); }
  return lastMonths(+n || 6);
}
export const rangeChipsHtml = () => {
  const y0 = thisYear(), first = state.stats.firstYear || y0, years = Array.from({ length: Math.max(0, Math.min(12, y0 - first + 1)) }, (_, i) => y0 - i);
  const cur = String(state.stats.months);
  return `<select id="statsRange" class="range-sel" aria-label="${t("时间范围")}" data-nosearch><option value="m" ${cur === "m" ? "selected" : ""}>${t("本月")}</option>${RANGES.map((n) => `<option value="${n}" ${cur === String(n) ? "selected" : ""}>${t("近 {n} 个月", { n })}</option>`).join("")}${years.map((y) => `<option value="y:${y}" ${cur === `y:${y}` ? "selected" : ""}>${y === y0 ? t("今年") : t("{y} 年", { y })}</option>`).join("")}</select>`;
};
/** 最早有记录的年份（只查一次），下拉里的往年选项到这一年为止 */
export async function ensureFirstYear() {
  if (state.stats.firstYear) return false;
  const y = await Store.firstPurchaseYear().catch(() => null);
  state.stats.firstYear = y || thisYear(); return true;
}
const monthOpt = (m) => (lang === "en" ? `${MONTH_EN[+m.slice(5) - 1]} ${m.slice(0, 4)}` : t("{y} 年 {m} 月", { y: m.slice(0, 4), m: +m.slice(5) }));
const noSpend = () => `<div class="panel empty"><strong>${t("还没有花费记录")}</strong>${t("在采购清单点“已买到”时填上实际花费，或在“明细”里补记一笔。")}</div>`;

/* ── 钻取：图表色块、图例、名称、数字卡片都带 data-drill（查询串），点一下跳到 明细 并套上对应筛选（分类 / 商店 / 月份 / 近 N 个月）；
 * 全局点击处理在 main.js，筛选在 applySpendDrill，明细页顶部用筛选条显示并可逐项去掉。 */
/** 预算页的“预算分组”（日常储备 / 房屋维护 / 大件家电…）和分类不是一回事（大件按单笔金额分），分组的判断函数由 budget.js 登记在这里，明细按它筛选 */
export const dq = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v != null && v !== "").map(([k, v]) => [k, String(v)])).toString();
const encKeys = (keys) => keys.map(encodeURIComponent).join(",");
export const hitAttrs = (q, label) => (q ? ` data-drill="${esc(q)}" role="link" tabindex="0" aria-label="${esc(label)}"` : "");
const DRILL_HINT = () => `<p class="muted drill-hint">${t("点图里的色块、图例或名称，可以查看对应的花费明细。")}</p>`;
export function applySpendDrill(q) {
  if (!["cat", "grp", "nat", "prop", "store", "stores", "month", "mlist", "range", "year", "q", "batch"].some((k) => q.has(k))) return false;
  const f = state.spendFilter;
  Object.assign(f, NO_SPEND_FILTER(), { sort: "new" });
  if (NATURES.some((n) => n.id === q.get("nat"))) f.nat = q.get("nat");   // 只看某种经济性质（资本性 / 投资 / 转账…）
  if (q.get("prop")) f.prop = q.get("prop");
  if (q.get("dmax")) f.dmax = +q.get("dmax") || null;   // 只看每月 1–N 日（「上月同期」对比用）
  if (q.get("batch")) f.batch = q.get("batch");   // 银行导入「查看 / 修改」：只看这一批
  if (q.get("q")) f.q = q.get("q");   // 旅行页「查看明细」：按「【行程名】」搜名称
  if (q.get("grp")) f.grp = q.get("grp");
  if (q.get("cat")) f.cat = LEGACY_STAT[q.get("cat")] || q.get("cat");   // 分类树的节点（一级 / 二级）或叶子；旧书签里的统计分组 id 换成新节点
  if (q.get("store")) f.store = q.get("store");
  if (q.get("stores")) f.stores = q.get("stores").split(",").map(decodeURIComponent);
  const m = q.get("month") || "";
  if (/^\d{4}-\d{2}$/.test(m)) { f.year = m.slice(0, 4); f.mon = m.slice(5, 7); }   // 一个月：就是筛选条上的「年份 + 月份」
  else if (q.get("mlist")) f.months = q.get("mlist").split(",").filter((x) => /^\d{4}-\d{2}$/.test(x));
  else if (q.get("range")) f.months = lastMonths(Math.max(1, Math.min(24, +q.get("range") || 6)));
  else if (/^\d{4}$/.test(q.get("year") || "")) f.year = q.get("year");   // 年度预算 / 往年：整年（今年就是到今天为止）
  return true;
}

/* ── 时间范围的「这一段 vs 前一段」：随时间范围变化，两段时间长度对等 ──
 *   本月      → 本月至今 | 上月同期（1–今天）
 *   近 N 个月 → 近 N 个月 | 再往前的 N 个月
 *   某一年    → 该年（今年到本月）| 前一年同期
 *  数据都来自数据库的按月聚合（spend_rollup），往年也不用先把花费读进浏览器。 */
const monthNums = (ms) => {
  const ym = (m) => `${m.slice(0, 4)}.${+m.slice(5)}`;
  if (ms.length === 1) return monthLabel(ms[0]);
  if (ms[0].slice(0, 4) === ms.at(-1).slice(0, 4)) return `${+ms[0].slice(5)}–${+ms.at(-1).slice(5)}${lang === "en" ? "" : " 月"}`;   // 同一年：8–10 月
  return `${ym(ms[0])}–${ym(ms.at(-1))}`;   // 跨年带上年份，免得「前 12 个月」和「近 12 个月」看起来一样
};
const shiftYear = (m, d) => `${+m.slice(0, 4) + d}${m.slice(4)}`;
export function comparePlan(n = state.stats.months) {
  const now = new Date(), cur = lastMonths(1)[0];
  if (n === "m") { const prev = lastMonths(2)[0]; return { a: { months: [cur], label: t("本月至今"), drill: { month: cur } }, b: { months: [prev], dmax: now.getDate(), label: t("上月同期（1–{d} 日）", { d: now.getDate() }), drill: { month: prev, dmax: now.getDate() } }, avg: "day" }; }
  if (typeof n === "string" && n.startsWith("y:")) {
    const y = +n.slice(2), ms = rangeMonths(n), pm = ms.map((m) => shiftYear(m, -1)), part = ms.length < 12;
    return { a: { months: ms, label: y === thisYear() ? t("本年花费") : t("{y} 年花费", { y }), drill: { year: y } }, b: { months: pm, label: part ? t("{y} 年同期（{r}）", { y: y - 1, r: monthNums(pm) }) : t("{y} 年花费", { y: y - 1 }), drill: { mlist: pm.join(",") } }, avg: "month" };
  }
  const k = +n || 6, all = lastMonths(k * 2), am = all.slice(k), bm = all.slice(0, k);
  return { a: { months: am, label: t("近 {n} 个月（{r}）", { n: k, r: monthNums(am) }), drill: { range: k } }, b: { months: bm, label: t("前 {n} 个月（{r}）", { n: k, r: monthNums(bm) }), drill: { mlist: bm.join(",") } }, avg: "month" };
}
/** 当前时间范围的钻取参数（明细里套上同样的月份） */
const winDrill = () => comparePlan().a.drill;
/** 一段时间的汇总；dmax = 只算每月 1–N 日（「本月」对比上月同期），这时另读那一小段 */
function windowAgg(w) {
  if (!w.dmax) return spendAgg(w.months);
  const m = w.months[0], end = new Date(+m.slice(0, 4), +m.slice(5) - 1, w.dmax + 1);   // 超过月底会滚到下个月 1 日，正好是整月
  const rows = rollup(`${m}-01`, `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`);
  return rows ? aggregate(rows, [m], statOpts()) : null;
}
const LOADING = () => `<p class="muted" role="status">${t("加载中…")}</p>`;
const kpi = ({ label, value, small = "", drill = null, wide = false }) => `<div class="kpi${wide ? " kpi-wide" : ""}${drill ? " ch-hit-row" : ""}"${drill ? hitAttrs(dq(drill), label) : ""}><span>${label}</span><b>${value}</b><small>${small}${drill ? " ›" : ""}</small></div>`;
const livHou = (a, b) => `${t("日常")} ${money(a)} <span class="kpi-sub">/ ${t("含住房")} ${money(b)}</span>`;
const changeTxt = (a, b) => { const c = b > 0 ? Math.round(((a - b) / b) * 100) : null; return c == null ? t("这段时间无记录") : c > 0 ? t("多了 {p}%", { p: Math.abs(c) }) : t("少了 {p}%", { p: Math.abs(c) }); };
/* ── 概览的数字卡片：日常 / 含住房（月均、中位数、均摊）、现金流出（对比前一段）、投资、资本性 ──
 *   日常 = 生活消费里性质是日常消费的；含住房 = 再加上房产住房里日常消费的（房贷、房产税、保险、HOA、维护）；
 *   现金流出 = 除了转账的全部；投资 / 资本性 按经济性质。口径全在 js/core/taxonomy.js 的 bucketOf。
 *   月均、中位数只用过完的月份（时间范围超过一个月时不含本月）；均摊 = 账单按每月折算（年付的摊开）代替缴费那个月的实际金额。 */
function overviewKpis() {
  const plan = comparePlan(), A = windowAgg(plan.a), B = windowAgg(plan.b), cur = Units.region.currency;
  if (!A) return LOADING();
  const L = livingSeries(A), H = withHousingSeries(A), outA = sum(outflowSeries(A)), outB = B ? sum(outflowSeries(B)) : 0;
  let liv;
  if (plan.avg === "day") {
    liv = kpi({ label: t("日常生活成本（本月至今）"), value: livHou(sum(L), sum(H)), wide: true, drill: { cat: "living", nat: "operating", ...plan.a.drill },
      small: B ? t("{label}：日常 {a} / 含住房 {b}", { label: plan.b.label, a: money(sum(livingSeries(B))), b: money(sum(withHousingSeries(B))) }) : "" });
  } else {
    const full = fullMonths(plan.a.months, lastMonths(1)[0]), pick = (arr) => full.map((m) => arr[A.months.indexOf(m)]);
    const billsX = state.billsEnriched.map((b) => (b.debt_id ? { ...b, expMonthly: billExpenseMonthly(b) } : b));   // 贷款账单：本金不算消费（迁移 058）
    const nl = normalizedMonthly(A, full, billsX, "living", cur), nh = nl + normalizedMonthly(A, full, billsX, "housing", cur);
    liv = kpi({ label: full.length < A.months.length ? t("日常生活成本（月均，不含本月）") : t("日常生活成本（月均）"), value: livHou(avg(pick(L)), avg(pick(H))), wide: true, drill: { cat: "living", nat: "operating", ...plan.a.drill },
      small: t("中位数 {a} / {b} · 均摊 {c} / {d}", { a: money(median(pick(L))), b: money(median(pick(H))), c: money(nl), d: money(nh) }) });
  }
  const inv = sum(series(A, (b) => b.investment)), cap = sum(series(A, (b) => b.capital));
  return `<div class="kpis">${liv}
    ${kpi({ label: t("现金流出 · {r}", { r: plan.a.label }), value: money(outA), small: `${t("比{r}", { r: plan.b.label })}${changeTxt(outA, outB)}`, drill: plan.a.drill })}
    ${kpi({ label: t("投资"), value: money(inv), small: t("算现金流出，不算日常"), drill: { nat: "investment", ...plan.a.drill } })}
    ${kpi({ label: t("资本性支出"), value: money(cap), small: t("买房、买车、装修等，不算日常"), drill: { nat: "capital", ...plan.a.drill } })}
  </div>`;
}
/** 账单概览里的花费速览：本月日常 / 含住房、近 6 个月月均（中位数）、本月现金流出；详细的在 财务 → 花费 */
export function spendGlance() {
  const ms = lastMonths(6), A = spendAgg(ms, 6), head = `<div class="section-head"><h2>${t("花费速览")}</h2><div class="head-acts"><a class="btn btn-sm btn-ghost" href="${href("bills", "spend")}">${t("看花费")}</a></div></div>`;
  if (!A) return `<section class="section">${head}${LOADING()}</section>`;
  if (!(sum(outflowSeries(A)) > 0)) return "";
  const cm = ms.at(-1), full = fullMonths(ms, cm), L = livingSeries(A), H = withHousingSeries(A), pick = (arr) => full.map((m) => arr[ms.indexOf(m)]);
  return `<section class="section">${head}<div class="kpis">
    ${kpi({ label: t("本月日常生活"), value: livHou(L.at(-1), H.at(-1)), drill: { cat: "living", nat: "operating", month: cm } })}
    ${kpi({ label: t("近 {n} 个月月均（不含本月）", { n: full.length }), value: livHou(avg(pick(L)), avg(pick(H))), small: t("中位数 {a} / {b}", { a: money(median(pick(L))), b: money(median(pick(H))) }), drill: { cat: "living", nat: "operating", mlist: full.join(",") } })}
    ${kpi({ label: t("本月现金流出"), value: money(outflowSeries(A).at(-1)), small: t("含房贷、税、投资等，不含转账"), drill: { month: cm } })}
  </div></section>`;
}

/* 花费页分为 5 个标签（概览 / 明细 / 分类 / 商店 / 导出打印），一次只画一块；旅行不再单独一个标签：分类 → 生活消费 → 旅行 里可以按行程看。
 * 统计页（账单模块关闭时）仍用 "all"：全部连在一起 */
const spendHref = (id) => `${href("bills", "spend")}${id === "overview" ? "" : `?tab=${id}`}`;
/** 花费图的「问咩咩」：为什么涨、怎么控（带每月日常 / 现金流出和日常的前三类） */
function spendAsk(A) {
  const { months } = A, L = livingSeries(A), O = outflowSeries(A), top = rankChildren(A, l2List("living").map((n) => n.id)).slice(0, 3);
  const liv = {}; for (const m of months) for (const [k, v] of Object.entries(A.liv[m] || {})) liv[k] = (liv[k] || 0) + v;
  const top3 = Object.entries(liv).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${t(nodeOf(k)?.name || k)} ${money(v)}`);
  return { id: `spend-${months[0]}-${months.at(-1)}`, title: t("{r}的花费", { r: rangeLabel() }), question: t("这段时间花费为什么变多了？主要在哪几类？怎么控制？"),
    context: () => [t("按月日常生活成本：{s}", { s: months.map((m, i) => `${monthLabel(m)} ${money(L[i])}`).join("，") }), t("按月现金流出：{s}", { s: months.map((m, i) => `${monthLabel(m)} ${money(O[i])}`).join("，") }),
      t("日常里前三类：{s}", { s: (top3.length ? top3 : top.map((x) => `${t(nodeOf(x.id)?.name)} ${money(x.v)}`)).join("，") }), t("家庭人数 {n}", { n: state.members?.length || 1 })] };
}
const bucketOf_ = (id) => BUCKETS.find((b) => b.id === id);
function spendOverviewTab(withHub = false) {
  const ms = rangeMonths(), A = spendAgg(ms), tm = trendMonths(), T = spendAgg(tm), o = statOpts();
  const notes = A ? [A.xfer.n ? t("另有 {n} 笔转账（{a}）不算花费，明细里能看到。", { n: A.xfer.n, a: money(A.xfer.sum) }) : "", A.otherCur ? t("另有 {n} 笔非 {cur} 记录未计入。", { n: A.otherCur, cur: Units.region.currency }) : ""].filter(Boolean) : [];
  let body = "";
  if (A && T) {
    const has = sum(outflowSeries(T)) > 0 || sum(outflowSeries(A)) > 0;
    if (!has) body = rollErr() ? `<div class="panel empty"><strong>${t("花费统计读不出来")}</strong>${esc(rollErr())}</div>` : noSpend();
    else {
      const B = (id) => bucketOf_(id), tmDrill = (typeof state.stats.months === "string" && state.stats.months.startsWith("y:")) ? winDrill() : { range: 12 };
      // 每条虚线带上它的钻取条件：财务 = 财务及其他 · 日常性质；资本性 / 投资按经济性质（和上面 KPI 卡片的链接一致）
      const lines = [{ name: t(B("financial").name), color: B("financial").color, values: series(T, (b) => b.financial), q: { cat: "financial", nat: "operating" } },
        ...(o.exCap ? [] : [{ name: t(B("capital").name), color: B("capital").color, values: series(T, (b) => b.capital), q: { nat: "capital" } }]),
        ...(o.exInv ? [] : [{ name: t(B("investment").name), color: B("investment").color, values: series(T, (b) => b.investment), q: { nat: "investment" } }])];
      const trend = Charts.bars({ title: t("每月花费：日常 + 住房（柱），财务 / 资本性 / 投资（虚线）"), labels: tm.map(monthLabel), fmt: money,
        series: [{ name: t(B("living").name), color: B("living").color, values: livingSeries(T) }, { name: t(B("housing").name), color: B("housing").color, values: series(T, (b) => b.housing) }], lines,
        drill: (k, i) => dq({ cat: k === 0 ? "living" : "housing", nat: "operating", month: tm[i] }), legendDrill: (k) => (k < 2 ? dq({ cat: k === 0 ? "living" : "housing", nat: "operating", ...tmDrill }) : dq({ ...lines[k - 2].q, ...tmDrill })),
        lineDrill: (j, i) => dq({ ...lines[j].q, month: tm[i] }) });
      const liv = l2List("living").map((n) => ({ name: `${n.icon} ${t(n.name)}`, color: n.color, value: Math.round(ms.reduce((s, m) => s + (A.liv[m]?.[n.id] || 0), 0) * 100) / 100, drill: dq({ cat: n.id, nat: "operating", ...winDrill() }) }));
      body = `<div class="panel chart-panel"><h3>${t("每月花了多少")}</h3><p class="muted" style="margin:0 0 6px;font-size:13px">${t("柱子 = 日常 + 住房（合起来就是「含住房」）；虚线是不算日常的部分。上面的开关可以把资本性、投资也画出来。")}</p>${trend}${DRILL_HINT()}${askInline(spendAsk(T))}</div>
        <div class="panel chart-panel"><h3>${t("日常生活花在哪（{r}）", { r: rangeLabel() })}</h3>${Charts.hbars({ items: liv, fmt: money, title: t("日常生活按类别"), empty: t("这段时间没有日常生活花费") })}${DRILL_HINT()}</div>`;
    }
  } else body = LOADING();
  return `${overviewKpis()}
    ${notes.map((x) => `<p class="muted" style="font-size:13px">${esc(x)}</p>`).join("")}
    ${body}
    ${withHub ? tabHub(SPEND_TABS, spendHref, t("其他功能")) : ""}`;
}

/* ── 分类：一级 → 二级 → 叶子 逐层点进去（面包屑回上层）；每层有子类排行（带占比）和选中节点的月度柱状图（按子类堆叠）。
 * 跟着时间范围、月份、「排除资本性 / 投资」开关；转账不在这里（不是花费），在明细里看。 */
const nodeName = (id) => { const n = nodeOf(id); return n ? `${n.icon} ${t(n.name)}` : `${leafInfo(id).icon || ""} ${t(leafInfo(id).name)}`.trim(); };
function nodeCrumb(node) {
  const path = [];
  for (let x = node; x; x = parentOf(x)) path.unshift(x);
  const btn = (id, label) => `<button type="button" class="linkbtn" data-action="stats-node" data-node="${esc(id)}">${esc(label)}</button>`;
  return `<nav class="node-crumb" aria-label="${esc(t("分类层级"))}">${node ? btn("", t("全部分类")) : `<b aria-current="page">${t("全部分类")}</b>`}${path.map((id, i) => `<span class="sep" aria-hidden="true">›</span>${i === path.length - 1 ? `<b aria-current="page">${esc(nodeName(id))}</b>` : btn(id, nodeName(id))}`).join("")}</nav>`;
}
const MAX_SERIES = 7;
function spendCategoryTab() {
  const st = state.stats, ms = rangeMonths(), sel = st.month && ms.includes(st.month) ? st.month : "";
  const node = st.node && (isNode(st.node) || allLeaves().some((c) => c.id === st.node)) ? st.node : "";
  const A = spendAgg(ms); if (!A) return `${nodeCrumb(node)}${LOADING()}`;
  const kids = node ? childrenOf(node) : L1S.filter((l) => l.id !== "transfer");
  const leaf = node && !isNode(node), mDrill = sel ? { month: sel } : winDrill();
  const ranked = rankChildren(A, kids.map((k) => k.id), sel || null), byId = new Map(kids.map((k) => [k.id, k]));
  const total = node ? nodeSum(A, node, sel || null) : sum(ranked.map((x) => x.v));
  const items = ranked.map(({ id, v }) => { const k = byId.get(id), sub = isNode(id);
    return { name: `${k.icon || ""} ${t(k.name)}`.trim(), value: v, color: k.color, ...(sub ? { btn: `data-action="stats-node" data-node="${esc(id)}" aria-label="${esc(t("看「{n}」的细分", { n: t(k.name) }))}"` } : { drill: dq({ cat: id, ...mDrill }) }) }; });
  // 月度柱状图：选中节点按子类堆叠（子类多时前 7 个 + 其他）；只看一个月时画近 6 个月，看得出走势
  const cm = ms.length > 1 ? ms : lastMonths(6), C = spendAgg(cm);
  let chart = "";
  if (C) {
    const ids = leaf ? [node] : rankChildren(C, kids.map((k) => k.id)).map((x) => x.id), top = ids.slice(0, MAX_SERIES), rest = ids.slice(MAX_SERIES);
    const ser = top.map((id) => { const k = byId.get(id) || leafInfo(id); return { id, name: t(k.name), color: k.color || "#8a948f", values: cm.map((m) => nodeSum(C, id, m)) }; });
    if (rest.length) ser.push({ id: node, name: t("其他"), color: "#8a948f", values: cm.map((m) => rest.reduce((s, id) => s + nodeSum(C, id, m), 0)) });
    chart = ser.length ? Charts.bars({ title: t("{cat}每月花费", { cat: node ? nodeName(node) : t("全部分类") }), labels: cm.map(monthLabel), fmt: money, series: ser,
      drill: (k, i) => dq({ cat: ser[k].id || "", month: cm[i] }), legendDrill: (k) => (ser[k].id ? dq({ cat: ser[k].id, ...(ms.length > 1 ? winDrill() : { range: 6 }) }) : null) }) : "";
  } else chart = LOADING();
  const trips = node === "travel" ? `<div class="form-actions"><button type="button" class="btn btn-sm" data-action="stats-trips" aria-expanded="${st.byTrip ? "true" : "false"}">🧳 ${st.byTrip ? t("收起按行程") : t("按行程看")}</button></div>${st.byTrip ? tripsPanel() : ""}` : "";
  return `${nodeCrumb(node)}
    <div class="panel chart-panel"><div class="row"><h3 style="margin:0">${node ? esc(nodeName(node)) : t("全部分类")}</h3><b class="num">${money(total)}</b></div>
      <p class="muted" style="margin:2px 0 8px;font-size:13px">${sel ? monthLabel(sel) : rangeLabel()}${leaf ? "" : ` · ${t("点名称看下一层，点条看明细")}`}</p>
      ${leaf ? "" : Charts.hbars({ items, fmt: money, total, title: t("子类排行"), empty: t("这段时间没有花费") })}
      <div class="form-actions"><button type="button" class="btn btn-sm" data-drill="${esc(dq({ cat: node || "", ...mDrill }))}">${t("查看明细")} ›</button></div></div>
    ${trips}
    <div class="panel chart-panel"><h3>${t("每月走势")}</h3>${chart}${DRILL_HINT()}</div>`;
}

/* ── 旅行按行程：花费名称「【行程】项目」按行程汇总（旅途中的吃饭、加油、门票只要带了行程名也算进这趟）。
 * 数据库按名称搜「【」读出带行程的花费（不读整表）；以前记成“其他”、看着像旅行的给出归类建议。 */
const TRIPS = { rows: null, other: null, busy: false, err: "" };
window.addEventListener("spend-rows-changed", () => { TRIPS.rows = null; });
/** 按筛选把花费流水读出来（每页 500 行，最多 max 行）：行程、年度报表、打印、返现复盘、月度复盘都用它，不读整表 */
export async function fetchSpendPages(f, max) {
  const out = []; let after = null;
  while (out.length < max) {
    const raw = (await Store.listPage("spend", f, after, 500)) || [], page = raw.slice(0, 500);
    out.push(...page); if (raw.length <= 500 || !page.length) break;
    after = cursorOf(page.at(-1));
  }
  return out;
}
function loadTrips() {
  if (TRIPS.busy || TRIPS.rows) return;
  TRIPS.busy = true;
  const base = spendBase();
  Promise.all([fetchSpendPages({ ...base, q: "【" }, 3000), fetchSpendPages({ ...base, known: knownLeafIds(), lo: ["other"], hi: ["other"] }, 300)])
    .then(([a, b]) => { TRIPS.rows = a.map((r) => ({ ...r, category: canonCat(r.category) })); TRIPS.other = b; TRIPS.err = ""; })
    .catch((e) => { TRIPS.rows = []; TRIPS.other = []; TRIPS.err = e.message; })
    .finally(() => { TRIPS.busy = false; window.dispatchEvent(new Event("spend-data-loaded")); });
}
const tripsOf = (list) => {
  const map = new Map();
  for (const p of list) {
    if (p.amount == null || isTransfer(p.category, p.nature)) continue;
    const { trip } = TRIP.parse(p.name); if (!trip) continue;
    const g = map.get(trip) || { trip, total: 0, n: 0, first: p.purchased_at, last: p.purchased_at, byCat: {} };
    g.total += num(p.amount); g.n++; g.byCat[p.category] = (g.byCat[p.category] || 0) + num(p.amount);
    if (p.purchased_at < g.first) g.first = p.purchased_at; if (p.purchased_at > g.last) g.last = p.purchased_at;
    map.set(trip, g);
  }
  return [...map.values()].sort((a, b) => String(b.last).localeCompare(String(a.last)));
};
/** 记一笔时「行程」的候选：近 400 天用过的行程名（数据库 spend_suggest，迁移 057） */
const tripDatalist = () => `<datalist id="tripList">${spendSuggestions().trips.map((x) => `<option value="${esc(x)}">`).join("")}</datalist>`;
function tripsPanel() {
  loadTrips();
  if (!TRIPS.rows) return `<div class="panel">${LOADING()}</div>`;
  const trips = tripsOf(TRIPS.rows);
  // 补入以前的：以前记成“其他”、名称或商店里带机票 / 酒店 / 门票 / 加油…关键词的，给出归类建议，点一下归到对应类型（不会自动改）
  const sugg = (TRIPS.other || []).filter((p) => !p.virtual && p.amount != null && TRIP.guess(p.name, p.store)).slice(0, 12);
  const suggHtml = sugg.length ? `<div class="panel"><h3 style="font-size:15px;margin:0 0 4px">${t("以前的花费里，可能是旅行")}</h3><p class="muted" style="margin:0 0 6px;font-size:13px">${t("名称或商店里带机票、酒店、门票、加油…的“其他”花费；点一下归到对应类型（可在明细里再改，也可以给名称加上「【行程名】」）。")}</p>
    <ul class="restock-list">${sugg.map((p) => { const id = TRIP.guess(p.name, p.store), c = leafInfo(id);
      return `<li><div class="grow"><span class="name">${esc(p.name)}</span><small>${esc(String(p.purchased_at).slice(0, 10))}${p.store ? ` · ${esc(p.store)}` : ""} · ${money(num(p.amount))}</small></div><button type="button" class="btn btn-sm" data-action="trip-reclass" data-id="${esc(p.id)}" data-cat="${id}">${t("归为")} ${c.icon} ${esc(t(c.name.split("（")[0]))}</button></li>`; }).join("")}</ul></div>` : "";
  const card = (g) => `<div class="panel trip-card"><div class="row"><div class="v"><b>🧳 ${esc(g.trip)}</b>
      <div class="muted" style="font-size:12.5px">${esc(String(g.first).slice(0, 10))}${String(g.first).slice(0, 10) !== String(g.last).slice(0, 10) ? ` → ${esc(String(g.last).slice(0, 10))}` : ""} · ${t("{n} 笔", { n: g.n })}</div></div>
      <b class="num">${money(g.total)}</b></div>
    <ul class="trip-cats">${Object.entries(g.byCat).sort((a, b) => b[1] - a[1]).map(([id, v]) => `<li><span>${esc(leafLabel(id))}</span><b class="num">${money(v)}</b></li>`).join("")}</ul>
    <div class="form-actions" style="margin-top:6px"><a class="btn btn-sm" href="${href("bills", "spend")}?tab=records&add=1&cat=travel_other&trip=${encodeURIComponent(g.trip)}">＋ ${t("记一笔")}</a><button type="button" class="btn btn-sm btn-ghost" data-drill="${esc(dq({ q: `【${g.trip}】` }))}">${t("查看明细")} ›</button></div></div>`;
  return `<p class="muted" style="font-size:13px">${t("按行程汇总这趟出门的全部花费：机票、住宿、租车这类选「旅行」下的分类；旅途中的吃饭、加油、门票照常选外出就餐 / 燃油 / 娱乐——只要填了行程名，都会算进这趟。")}</p>
    ${TRIPS.err ? `<p class="form-error">${esc(TRIPS.err)}</p>` : ""}
    ${trips.length ? trips.map(card).join("") : `<div class="panel empty"><strong>${t("还没有行程")}</strong>${t("记一笔花费时在「行程」里写个名字（例如 东京 2026），这笔就归到这趟。以前的旅行也可以补记，日期选当时的。")}<p><a class="btn btn-primary btn-sm" href="${href("bills", "spend")}?tab=records&add=1&cat=travel_flight">${t("记一笔旅行花费")}</a></p></div>`}
    ${suggHtml}`;
}

/* ── 记一笔：分类按 一级 · 二级 分组；经济性质（默认按分类）；有房产时可以选关联哪套房 ── */
const activeProps = () => (state.properties || []).filter((p) => !p.archived);
/** 房产下拉的选项；空 = 不关联 */
export const propertyOptions = (sel) => `<option value="" ${!sel ? "selected" : ""}>${t("不关联房产")}</option>${activeProps().map((p) => `<option value="${esc(p.id)}" ${p.id === sel ? "selected" : ""}>${esc(p.name)}</option>`).join("")}`;
function spendRecordsTab() {
  const today = new Date().toISOString().slice(0, 10), q = state.route?.q;
  const preCat = q?.get("cat") || "", preTrip = q?.get("trip") || "";   // 从「按行程」进来：分类预选旅行、行程预填
  const open = !!state.spendAddOpen || !!q?.get("add");   // 表单默认收着，点「手动记一笔」或从「记一笔花费」按钮进来才展开
  return `<section class="section">
      <div class="section-head"><h2>${t("记一笔花费")}</h2><p>${t("没走采购清单的，在这里记")}</p></div>
      <div class="entry-ways" role="group" aria-label="${esc(t("三种记法"))}">
        <button type="button" class="way ${open ? "is-cur" : ""}" data-action="spend-add-toggle" aria-expanded="${open ? "true" : "false"}"><span class="way-ico" aria-hidden="true">✍️</span><span>${t("手动记一笔")}</span></button>
        <a class="way" href="${href("scan")}"><span class="way-ico" aria-hidden="true">📷</span><span>${t("拍小票识别")}</span></a>
        ${financeOk() ? `<a class="way" href="${href("bills", "statements")}"><span class="way-ico" aria-hidden="true">🏦</span><span>${t("导入对账单")}</span></a>` : ""}</div>
      ${storeDatalist()}
      ${open ? "" : "<!-- 表单收着 -->"}
      <form id="purchaseForm" class="panel add-row purchase-row" ${open ? "" : "hidden"}>
        <input class="pr-name" name="name" required maxlength="60" placeholder="${t("买了什么，例如：超市采购")}" aria-label="${t("名称")}">
        <select class="pr-cat" name="category" aria-label="${t("分类")}">${categoryOptions(preCat || undefined, { spend: true })}</select>
        <input class="pr-trip" name="trip" maxlength="30" list="tripList" value="${esc(preTrip)}" placeholder="${t("行程（旅行）")}" aria-label="${t("所属行程")}">${tripDatalist()}
        <input class="pr-amt" name="amount" type="number" min="0" step="0.01" inputmode="decimal" required placeholder="${t("金额（{cur}）", { cur: Units.region.currency })}" aria-label="${t("金额")}">
        <input class="pr-store" name="store" maxlength="40" list="storeList" value="${esc(lastStore())}" placeholder="${t("商店（可不填）")}" aria-label="${t("商店")}">
        <input class="pr-date" name="date" type="date" value="${today}" max="${today}" aria-label="${t("日期")}">
        ${cardSelectHtml("card_id", undefined, 'class="pr-card"')}
        <select class="pr-nat" name="nature" data-nosearch aria-label="${t("经济性质")}" title="${esc(t("日常消费 / 资本性 / 投资 / 融资 / 转账：决定算进哪些统计；一般按分类默认就行"))}">${natureOptions("", { leaf: preCat || "fresh" })}</select>
        ${activeProps().length ? `<select class="pr-prop" name="property_id" data-nosearch aria-label="${t("关联房产")}">${propertyOptions("")}</select>` : ""}
        <label class="check-inline pr-refund" title="${esc(t("退货退款、报销收回：记成负数，统计里按净额算"))}"><input type="checkbox" name="refund"><span>${t("退款 / 报销")}</span></label>
        <button class="btn btn-primary pr-go" type="submit">${t("记一笔")}</button>
      </form>
      <p id="purchaseDupHint" class="dup-hint" role="status" hidden></p>
      <p id="purchaseCardHint" class="card-hint-line">${cardHintHtml("fresh", lastStore(), null)}</p>
      <p class="muted cat-hint">${t("分类怎么选：先找一级（生活消费 / 房产住房 / 投资理财 / 财务及其他 / 转账），再找二级。买房买车、装修这类几年一次的大额，性质选「资本性支出」；信用卡还款、自己账户之间转账选「转账」，不算花费。")}</p>
    </section>
    <section class="section" id="spendRecords">${spendRecordsHtml()}</section>`;
}
export function spendExportTab() {
  return `${viewAnnualExport()}
    <section class="section">
      <div class="section-head"><h2>${t("打印")}</h2><p>${t("浏览器的打印窗口里也可以另存为 PDF")}</p></div>
      <div class="panel export-grid">
        <label class="export-pick"><span>${t("时间范围")}</span><select id="printRange" data-nosearch>${[3, 6, 12].map((n) => `<option value="${n}" ${n === +state.stats.months ? "selected" : ""}>${t("近 {n} 个月", { n })}</option>`).join("")}</select></label>
        <div class="export-btns"><button type="button" class="btn btn-primary btn-sm" data-action="print-run" data-kind="spend">${t("打印花费统计")}</button></div>
      </div>
      <p class="muted" style="margin:6px 0 0;font-size:13px">${t("要打印筛选后的明细，到“明细”标签里点“打印”。")}</p>
    </section>`;
}

/** 时间条：时间范围 + 月份（分类 / 商店页才有；默认「整段」= 和时间范围一致）+ 排除资本性 / 投资 的开关，放在标签下面、内容上面，一眼能看到。
 *  tab 为空 = 只有时间范围（预算趋势页用，同一个范围值） */
export function timeBarHtml(tab) {
  if (!tab) return `<div class="time-bar"><label class="tb-field"><span>${t("时间范围")}</span>${rangeChipsHtml()}</label></div>`;
  const ms = rangeMonths(), withMonth = tab === "category" || tab === "stores" || tab === "all";
  const m = state.stats.month && ms.includes(state.stats.month) ? state.stats.month : "";
  const monthSel = withMonth && ms.length > 1 ? `<label class="tb-field"><span>${t("月份")}</span><select id="statsMonth" aria-label="${t("选择月份")}" data-nosearch><option value="" ${m ? "" : "selected"}>${t("整段（{r}）", { r: rangeLabel() })}</option>${[...ms].reverse().map((x) => `<option value="${x}" ${x === m ? "selected" : ""}>${monthOpt(x)}</option>`).join("")}</select></label>` : "";
  const o = statOpts(), tg = (act, on, label, tip) => `<label class="check-inline" title="${esc(tip)}"><input type="checkbox" data-action="${act}" ${on ? "checked" : ""}><span>${label}</span></label>`;
  return `<div class="time-bar"><label class="tb-field"><span>${t("时间范围")}</span>${rangeChipsHtml()}</label>${monthSel}
    ${tg("stats-excap", o.exCap, t("排除资本性"), t("买房卖房、买车整付、装修：几年一次、金额巨大，默认不画进图里；去掉勾可以一起看"))}
    ${tg("stats-exinv", o.exInv, t("排除投资"), t("转入投资账户、买基金股票：钱还是家里的，默认不画进图里；去掉勾可以一起看"))}</div>`;
}
/** 当前时间范围的叫法：近 6 个月 / 今年 / 2025 年 */
export function rangeLabel(n = state.stats.months) {
  if (n === "m") return t("本月");
  if (typeof n === "string" && n.startsWith("y:")) { const y = +n.slice(2); return y === thisYear() ? t("今年") : t("{y} 年", { y }); }
  return t("近 {n} 个月", { n: +n || 6 });
}

export function viewSpend() {
  const r = state.route, onSpendPage = r?.section === "bills" && r?.sub === "spend";
  let tab = onSpendPage ? activeTab(r) : "all";
  if (onSpendPage && r.q?.get("tab") === "trips") {   // 以前的「旅行」标签（书签 / 旧链接）：改到 分类 → 旅行 → 按行程
    Object.assign(state.stats, { node: "travel", byTrip: true }); tab = "category";
    history.replaceState(null, "", `${href("bills", "spend")}?tab=category`);
  }
  const ranged = tab === "overview" || tab === "category" || tab === "stores" || tab === "all";
  const body = {
    overview: () => spendOverviewTab(onSpendPage), category: spendCategoryTab, stores: () => viewStoreStats(rangeMonths()) || noSpend(),
    records: spendRecordsTab, export: spendExportTab,
    all: () => `${spendOverviewTab()}${spendCategoryTab()}${viewStoreStats(rangeMonths())}${viewAnnualExport()}${spendRecordsTab()}`,
  }[tab]();
  return `
    <section class="section">
      <div class="section-head"><h2>${t("花费")}</h2><div class="head-acts">${onSpendPage ? `<a class="btn btn-primary btn-sm" href="${href("bills", "spend")}?tab=records&add=1">${t("记一笔花费")}</a>` : ""}</div></div>
      ${onSpendPage ? tabBar(SPEND_TABS, tab, spendHref, t("花费内容")) : ""}
      ${ranged ? timeBarHtml(tab) : ""}
      ${body}
    </section>`;
}

export function viewUsage() {
  const st = state.stats;
  // 消耗趋势
  const cd = consumptionData();
  const freqCats = CATEGORIES.filter((c) => cd.freq[c.id]);
  const freqChart = freqCats.length ? Charts.bars({
    title: t("每周使用记录次数（按分类）"), labels: cd.labels, fmt: (v) => t("{n} 次", { n: Math.round(v) }), showTotals: false,
    series: freqCats.map((c) => ({ name: t(c.name), color: c.color, values: cd.freq[c.id] })),
  }) : "";
  const ranked = state.items.filter((i) => cd.perItem[i.id]).sort((a, b) => cd.perItem[b.id] - cd.perItem[a.id]);
  const selItem = state.items.find((i) => i.id === st.itemId && cd.perItem[i.id]) || ranked[0];
  let itemChart = "";
  if (selItem) {
    const ser = itemSeries(selItem, cd.starts);
    const c = catOf(selItem.category);
    itemChart = Charts.line({
      title: t("{name}每周用量与库存", { name: selItem.name }), labels: cd.labels, fmt: (v) => `${fmt(v)} ${ser.unit}`,
      barSeries: { name: t("每周用量（{u}）", { u: ser.unit }), color: c.color, values: ser.used },
      series: [{ name: t("周末库存（{u}）", { u: ser.unit }), color: "var(--ink)", values: ser.level }],
    });
  }
  return `
    ${state.billsEnabled ? `<div class="panel cta-panel"><div><b>${t("花费统计搬到了 财务 → 花费")}</b><p class="muted">${t("每月花了多少、分类占比、商店、年度报表、补记和花费记录都在那里；这里只看库存的使用趋势。")}</p></div>
      <a class="btn btn-primary" href="#/bills/spend">${t("去看花费")}</a></div>` : ""}
    <section class="section">
      <div class="section-head"><h2>${t("消耗趋势")}</h2><p>${t("最近 12 周，来自家人点“−”的记录")}</p></div>
      ${selItem ? `
      <div class="panel chart-panel"><div class="chart-head"><h3>${t("单品用量与库存")}</h3>
        <select id="statsItem" aria-label="${t("选择物品")}">${ranked.map((i) => `<option value="${i.id}" ${i.id === selItem.id ? "selected" : ""}>${esc(i.name)}（${t("{n} 次", { n: cd.perItem[i.id] })}）</option>`).join("")}</select></div>
        ${itemChart}</div>
      <div class="panel chart-panel"><h3>${t("各分类使用频率")}</h3><p class="muted" style="margin:0 0 6px;font-size:13px">${t("按记录次数统计，不同物品单位不同，不能直接相加数量。")}</p>${freqChart}</div>`
      : `<div class="panel empty"><strong>${t("还没有使用记录")}</strong>${t("在库存页用掉东西时点一下 −，这里就会出现趋势。")}</div>`}
    </section>
    `;
}

/** 我的 → 统计：账单模块开着时只看用量趋势（花费在 财务 → 花费）；关掉账单时花费和用量都在这里 */
export function viewStats() {
  return state.billsEnabled ? viewUsage() : viewSpend() + viewUsage();
}

/* ── 花费记录：搜索 + 分类树 / 性质 / 房产 / 商店 / 年份 / 月份筛选 + 排序，按月分组带小计；服务器分页（迁移 054 / 055），任何一年、全部年份都能看 ──
 * 筛选、排序、合计、月小计都在数据库里做（spend_page / spend_stats），这里只把界面上的筛选翻译成筛选对象（spendParams）；
 * 分类树、预算分组这类只有前端认识的规则（js/core/taxonomy.js）先在这里展开成叶子分类表，数据库只查表。转账照样列出（带标记），合计不算。
 * 筛选条和 收入 → 明细 同一套：搜索 + 下拉一行（手机收成「筛选」按钮），图表钻取带来的其他条件在下面一行标签里，可逐项去掉。 */
export const SPEND_SORTS = [["new", "时间：新 → 旧"], ["old", "时间：旧 → 新"], ["high", "金额：高 → 低"], ["low", "金额：低 → 高"], ["name", "名称 A → Z"]];
/** 银行导入的一批：{ 批次记录, 旧批次的花费 id 集合 }（记录在预算设置里） */
const batchOf = (id) => { const b = (state.budget?.cat_budgets?._bank_batches || []).find((x) => x.id === id); return b ? { b, ids: new Set(b.ids || []) } : null; };
/** 事件型账单（医疗 / 宠物 / 法律 / 项目 / 旅行）的显示名：数据库拼虚拟花费名称用（spend_feed） */
const medNames = () => Object.fromEntries(Object.entries(MED_KINDS).map(([k, v]) => [k, t(v.name)]));
/** 花费流水查询的基本参数（时区、本币、事件型账单的名称、分类的默认性质 / 转账）：别的模块按需读花费时在它上面加筛选 */
export const spendBase = (sort = "new") => ({ tz: TZ(), cur: Units.region.currency, med: medNames(), sort, ...natureParams() });
/** 分类节点 / 叶子是否包含这个叶子（"bills" = 全部账单、"billfam_*" = 账单的一个大类：旧钻取链接） */
function catHas(sel, id) {
  if (sel === "bills") return isBill(id);
  if (String(sel).startsWith("billfam_")) return isBill(id) && BILLS_GROUP.familyOf(id) === sel;
  return leavesOf(sel).includes(id);
}
/** 分类 + 预算分组 + 性质筛选 → 数据库的筛选参数（在这里先求交集）：
 *  known = 认识的分类（含旧别名）；lo = hi = 命中的叶子（054 的「大件门槛」已不用，big = 0）；unk = 不认识的分类算不算（lo / hi：普通的，blo / bhi：bill_ 开头的；不认识的算 生活消费 → 其他）；
 *  nat = 命中的实际性质。预算分组（钻取来的 grp）：资本性组 = 性质是资本性的全部；其余按「日常消费」时的归组，只看日常消费 / 融资 */
function catFilter(f) {
  const out = {}, sel = f.cat !== "all" ? f.cat : null, G = budgetBridge.groupOf, grp = f.grp;
  let nat = f.nat && f.nat !== "all" ? [f.nat] : null;
  if (sel || grp) {
    const inGrp = (id) => !grp || !G || grp === "capital" || (grp === "!bills" ? !["bills", "transfer", "investment"].includes(G(id, "operating")) : G(id, "operating") === grp);
    const known = knownLeafIds(), hit = known.filter((id) => (!sel || catHas(sel, id)) && inGrp(id));
    const unkOk = (id) => (!sel || coversUnknown(sel) || (sel === "bills" && isBill(id))) && inGrp(id);
    Object.assign(out, { known, lo: hit, hi: hit, big: 0, unk: [["lo", "zz_unknown"], ["hi", "zz_unknown"], ["blo", "bill_zz_unknown"], ["bhi", "bill_zz_unknown"]].filter(([, id]) => unkOk(id)).map(([k]) => k) });
    if (grp) { const g = grp === "capital" ? ["capital"] : ["operating", "financing"]; nat = nat ? nat.filter((x) => g.includes(x)) : g; if (!nat.length) nat = ["__none__"]; }
  }
  if (nat) out.nat = nat;
  return out;
}
const monthStart = (m) => new Date(+m.slice(0, 4), +m.slice(5, 7) - 1, 1);
/** 年份 / 钻取的月份 → 时间戳范围（本地时间）：只用来让数据库少扫，真正的筛选是 year / mon / months */
function spanOf(f) {
  if (f.months?.length) { const s = [...f.months].sort(), e = monthStart(s.at(-1)); return { from: monthStart(s[0]).toISOString(), to: new Date(e.getFullYear(), e.getMonth() + 1, 1).toISOString() }; }
  if (f.year !== "all") { const y = +f.year; return { from: new Date(y, 0, 1).toISOString(), to: new Date(y + 1, 0, 1).toISOString() }; }
  return {};
}
/** 当前筛选 → 数据库的筛选对象（只带生效的项）；natx / xfer 每次都带：数据库靠它们认出转账（合计不算）和各分类的默认性质 */
export function spendParams() {
  const f = state.spendFilter, bt = f.batch ? batchOf(f.batch) : null;
  let stores = f.stores?.length ? [...f.stores] : null;   // “其他商店”：一组商店
  if (f.store !== "all") stores = stores ? stores.filter((k) => k === f.store) : [f.store];
  return compact({ tz: TZ(), cur: Units.region.currency, med: medNames(), sort: f.sort || "new", ...natureParams(), ...catFilter(f),
    year: f.year !== "all" ? f.year : null, mon: f.mon !== "all" ? f.mon : null, months: f.months?.length ? f.months : null, dmax: f.dmax || null, ...spanOf(f),
    stores, q: f.q.trim().toLowerCase() || null, batch: f.batch || null, batch_ids: bt?.ids.size ? [...bt.ids] : null, prop: f.prop && f.prop !== "all" ? f.prop : null });
}
/** 明细列表：读到的几页 + 当前筛选的统计；虚拟的医疗付款 id 加 med: 前缀（不会当成真实花费去删 / 改；cursor 用的是加前缀之前的原始行） */
export const spendList = serverList("spend", {
  host: "#spendList",
  map: (r) => ({ ...r, id: r.virtual ? `med:${r.id}` : r.id, category: canonCat(r.category) }),
  draw: (facetsChanged) => (facetsChanged && document.activeElement?.id !== "spendSearch" ? renderSpendRecords() : renderSpendList()),
});
/** 花费变了（实时同步、自己记 / 改 / 删、医疗付款变了）：明细的统计 + 第一页重读（mergeMedical 发出 spend-rows-changed） */
export const reloadSpendList = () => spendList.reload();
window.addEventListener("spend-rows-changed", reloadSpendList);
/** 就地编辑保存后：先改已读到的那一行，页面立刻是新的（随后的重读会再对一遍） */
export const patchSpendRow = (id, patch) => { spendList.rows = spendList.rows.map((x) => (x.id === id ? { ...x, ...patch } : x)); };
/** 每次画列表建一次查找表（分类、账单），每行不再线性查找 */
function spendLookups() {
  const first = (rows, key) => new Map(rows.map((x) => [key(x), x]).reverse());   // 重复的键保留第一条（和原来的 find 一样）
  return { cats: first(ALL_CATS(), (c) => c.id), bills: first(state.bills, (b) => b.id) };
}
function spendRow(p, L = spendLookups()) {
  const d = new Date(p.purchased_at), sameYear = d.getFullYear() === new Date().getFullYear();
  if (state.spendEdit === p.id) return spendEditRow(p);
  // 转账：数据库已判断（is_xfer）；性质和分类默认不一样时标出来；关联了房产（多套房时）也写出来
  const xfer = p.is_xfer ?? isTransfer(p.category, p.nature), nat = p.nature && p.nature !== defaultNature(p.category) ? p.nature : null;
  const tags = (xfer ? ` <span class="badge xfer-badge">${t("转账 · 不算花费")}</span>` : "") + (nat && !xfer ? ` <span class="badge" style="background:var(--surface-2)">${esc(t(natureName(nat)))}</span>` : "");
  const prop = p.property_id && !p.pay_id && state.properties.length > 1 ? state.properties.find((x) => x.id === p.property_id)?.name : "";
  // 账单缴费记的花费（数据库顺带带回关联的缴费记录 pay_id）：名称链接到那条缴费记录的编辑页（改那里，花费会同步）；其余的在这一行里就地编辑
  const bill = p.pay_id ? L.bills.get(p.pay_bill_id) : null;
  const title = p.virtual === "medical" ? `<a class="link-name" href="${href("bills", "onetime")}?bill=${p.bill_id}" title="${esc(t("到医疗账单里看 / 改"))}">${esc(p.name)}</a>`
    : bill ? `<a class="link-name" href="${href("bill", bill.id)}?sec=pay&edit=${p.pay_id}" title="${esc(t("点一下编辑"))}">${esc(withProperty(bill.property_id, p.name))}</a>`
    : `<button type="button" class="link-name linkbtn" data-action="spend-edit" data-id="${p.id}" title="${esc(t("点一下编辑"))}">${esc(p.name)}</button>${state.spendDrafts?.[p.id] ? ` <span class="badge b-soon">${t("草稿")}</span>` : ""}`;
  const sel = state.spendSel && !p.virtual ? `<input type="checkbox" class="sel" data-sel="${p.id}" aria-label="${esc(t("选中 {name}", { name: p.name }))}" ${state.spendSel.has(p.id) ? "checked" : ""}>` : "";
  return `<li data-swipe-del="purchase">${sel}
    <span class="badge" style="background:var(--surface-2)">${esc(d.toLocaleDateString(locale(), sameYear ? { month: "numeric", day: "numeric" } : { year: "2-digit", month: "numeric", day: "numeric" }))}</span>
    <div class="grow"><span class="name">${title}${tags}</span><small>${esc(leafLabel(p.category))}${prop ? `，🏠 ${esc(prop)}` : ""}${storeOf(p) ? `，${esc(storeOf(p))}` : ""}${p.quantity ? `，${showQty(p.quantity, p.unit || "")}` : ""}${paymentPayLabel(p) ? `，${esc(paymentPayLabel(p))}` : ""}${p.created_by && state.members.length > 1 ? `，${esc(memberName(p.created_by) || "")}` : ""}</small></div>
    <b>${p.amount != null && num(p.amount) < 0 ? `<span class="badge b-ok">${t("退款")}</span> ` : ""}${p.amount != null ? esc(Units.money(num(p.amount), p.currency || Units.region.currency)) : `<span class="muted">${t("未填金额")}</span>`}</b>
    ${p.virtual ? "" : `<button type="button" class="btn btn-sm btn-ghost swipe-src" data-action="purchase-del" data-id="${p.id}" aria-label="${esc(t("删除 {name} 这笔记录", { name: p.name }))}">${t("删除")}</button>`}</li>`;
}
/** 就地编辑：名称、分类、经济性质、关联房产、金额、商店、日期（数量和单位不动） */
function spendEditRow(p) {
  const day = String(p.purchased_at).slice(0, 10), opts = categoryOptions(p.category, { withOther: true, spend: true });   // 当前分类已在选项里时会自动选中
  const hasCat = opts.includes(`value="${p.category}"`);
  const d = new Date(p.purchased_at);
  // 顶上保留这一行的摘要，再点它就收起（不保存）
  const head = `<button type="button" class="ix-main spend-head" data-action="spend-edit-collapse" aria-expanded="true" title="${esc(t("再点一下收起"))}"><span class="grow"><span class="name">${esc(p.name)}</span><small>${esc(`${d.toLocaleDateString(locale(), { year: "numeric", month: "numeric", day: "numeric" })} · ${leafLabel(p.category)}`.trim())}</small></span><b>${p.amount != null ? esc(Units.money(num(p.amount), p.currency || Units.region.currency)) : ""}</b><span aria-hidden="true">▴</span></button>`;
  return `<li class="spend-edit">${head}<form id="spendEditForm" data-id="${p.id}" class="form-grid" novalidate>
    <label class="span-2">${t("名称")}<input name="name" required maxlength="60" value="${esc(p.name)}"></label>
    <label>${t("分类")}<select name="category">${hasCat ? "" : `<option value="${esc(p.category)}" selected>${esc(t(leafInfo(p.category).name))}</option>`}${opts}</select></label>
    <label>${t("经济性质")}<select name="nature" data-nosearch>${natureOptions(p.nature || "", { leaf: p.category })}</select><small>${t("决定算进哪些统计；一般按分类默认")}</small></label>
    ${activeProps().length ? `<label>${t("关联房产")}<select name="property_id" data-nosearch>${propertyOptions(p.property_id || "")}</select></label>` : ""}
    <label>${t("金额（{cur}）", { cur: p.currency || Units.region.currency })}<input name="amount" type="number" step="0.01" inputmode="decimal" value="${p.amount != null ? num(p.amount).toFixed(2) : ""}"><small>${t("退款 / 报销填负数")}</small></label>
    <label>${t("商店 / 收款方")}<input name="store" maxlength="40" list="storeList" value="${esc(p.store || "")}"></label>
    <label>${t("日期")}<input name="date" type="date" max="${new Date().toISOString().slice(0, 10)}" value="${esc(day)}"></label>
    ${state.billsEnabled ? `<label>${t("怎么付的")}<select name="card_id">${cardOptions(payAcctValue(p.card_id, p.method))}</select></label>` : ""}
    <div class="form-actions span-2"><button type="submit" class="btn btn-primary btn-sm">${t("保存修改")}</button><button type="button" class="btn btn-sm btn-ghost" data-action="spend-edit-cancel">${t("取消")}</button></div></form></li>`;
}
const monthName = (m) => (lang === "en" ? `${MONTH_EN[+m.slice(5) - 1]} ${m.slice(0, 4)}` : t("{y} 年 {m} 月", { y: m.slice(0, 4), m: +m.slice(5) }));
/** 筛选条下面的标签：下拉里看不到的条件（图表钻取带来的预算分组、一组商店、一段月份、导入批次）一项一个，点标签去掉那一项。
 *  分类 / 商店 / 年份 / 月份 / 搜索就在上面的筛选条里，不再重复（和收入明细一样） */
function activeFilterChips() {
  const f = state.spendFilter, out = [];
  const storeName = (k) => (k === "__none__" ? t(STORE_NONE.name) : knownStores().find((x) => storeKey(x) === k) || (spendList.facets?.stores || []).find((x) => storeKey(x) === k) || k);
  if (f.grp) { const g = budgetBridge.groups.find((x) => x.id === f.grp); out.push(["grp", f.grp === "!bills" ? t("不含账单的花费") : g ? `${g.icon} ${t(g.name)}` : f.grp]); }
  if (f.stores?.length) { const n = f.stores.map(storeName); out.push(["stores", n.length <= 3 ? n.join("、") : t("{a} 等 {n} 家", { a: n.slice(0, 2).join("、"), n: n.length })]); }
  if (f.months?.length) {
    const m0 = f.months[0], whole = m0.endsWith("-01") && f.months.every((m) => m.startsWith(m0.slice(0, 4)));
    const label = f.months.length === 1 ? monthName(m0) : whole ? t("{y} 年", { y: m0.slice(0, 4) }) : `${monthName([...f.months].sort()[0])} → ${monthName([...f.months].sort().at(-1))}`;
    out.push(["months", f.dmax ? `${label}（${t("每月 1–{d} 日", { d: f.dmax })}）` : label]);
  } else if (f.dmax) out.push(["months", t("每月 1–{d} 日", { d: f.dmax })]);
  if (f.batch) { const bt = batchOf(f.batch); out.push(["batch", t("导入批次：{name}", { name: bt ? (bt.b.account || bt.b.file || t("银行导入")) + (bt.b.from ? ` · ${bt.b.from} → ${bt.b.to || bt.b.from}` : bt.b.at ? ` · ${String(bt.b.at).slice(0, 10)}` : "") : f.batch })]); }
  return out;
}
function spendChipsHtml() {
  const chips = activeFilterChips(); if (!chips.length) return "";
  return `<div class="filter-chips" role="group" aria-label="${t("当前筛选")}"><span class="muted">${t("当前筛选")}</span>${chips.map(([k, label]) => `<button type="button" class="chip fchip" data-action="spend-chip-clear" data-k="${k}" aria-label="${esc(t("去掉筛选：{x}", { x: label }))}">${esc(label)} <span aria-hidden="true">✕</span></button>`).join("")}${chips.length > 1 ? `<button type="button" class="btn btn-sm btn-ghost" data-action="spend-chip-clear" data-k="all">${t("清除全部")}</button>` : ""}</div>`;
}
const NO_SPEND_FILTER = () => ({ q: "", cat: "all", grp: null, nat: "all", prop: "all", store: "all", stores: null, year: "all", mon: "all", months: null, dmax: null, batch: null });
export function clearSpendFilter(k) {
  const f = state.spendFilter;
  if (k === "all") Object.assign(f, NO_SPEND_FILTER());
  else if (k === "grp") f.grp = null; else if (k === "batch") f.batch = null; else if (k === "stores") f.stores = null; else if (k === "months") { f.months = null; f.dmax = null; }
}
/** 筛选条、各个下拉和搜索框都按当前筛选重画（点掉标签后下拉也跟着回到“全部”） */
export function renderSpendRecords() { const h = $("#spendRecords"); if (h) h.innerHTML = spendRecordsHtml(); }

/** 列表本体 + 合计；搜索 / 筛选变化只重画这一块（输入框不丢焦点）。月小计、合计来自 spend_stats（整组筛选结果，不只是已读到的几页） */
function spendListHtml() {
  const f = state.spendFilter, L = spendList.sync(spendParams()), st = L.stats || {};
  if (!L.rows.length) {
    if (L.busy) return `<p class="muted" role="status">${t("加载中…")}</p>`;
    return L.err ? `<div class="empty"><strong>${t("没读到花费记录")}</strong>${esc(L.err)}</div>` : `<div class="empty"><strong>${t("没有符合条件的记录")}</strong>${t("换个关键词或筛选试试。")}</div>`;
  }
  const byDate = f.sort === "new" || f.sort === "old", months = st.months || {}, Lk = spendLookups();
  let out = "", cur = null;
  for (const p of L.rows) {
    if (byDate) {
      const m = monthKey(p.purchased_at);
      if (m !== cur) { cur = m; const inM = months[m] || { n: 0, sum: 0 }; out += `<li class="rec-month"><b>${esc(monthName(m))}</b><span class="muted">${esc(t("{n} 笔", { n: inM.n }))} · ${esc(money(num(inM.sum)))}</span></li>`; }
    }
    out += spendRow(p, Lk);
  }
  const S = state.spendSel, own = L.rows.filter((p) => !p.virtual), delN = S ? own.filter((p) => S.has(p.id)).length : 0;
  const selBar = S ? `<div class="sel-bar" role="region" aria-label="${esc(t("多选删除"))}"><b id="selCount">${t("已选 {n} 笔", { n: delN })}</b>
      <button type="button" class="btn btn-sm btn-ghost" data-action="spend-sel-all">${t("全选当前显示的 {n} 笔", { n: own.length })}</button>
      <button type="button" class="btn btn-sm btn-ghost" data-action="spend-sel-none">${t("清空")}</button>
      <button type="button" class="btn btn-sm btn-danger-ghost" data-action="spend-sel-del" ${delN ? "" : "disabled"}>${t("删除所选")}</button>
      <button type="button" class="btn btn-sm btn-ghost" data-action="spend-sel-toggle">${t("退出多选")}</button>
      <small class="muted" style="flex-basis:100%">${t("先用上面的筛选（年份、月份、商店、分类、批次）缩小范围，再全选；删除前会再确认一次。")}</small></div>` : "";
  const xNote = st.xn ? `；${t("其中 {n} 笔转账（{a}）不算进合计", { n: st.xn, a: money(num(st.xsum)) })}` : "";
  return `${selBar}<div class="muted small" style="margin:0 0 6px">${t("{n} 笔，合计 {m}", { n: st.n ?? "…", m: money(num(st.sum)) })}${xNote}</div><ul class="restock-list rec-list${S ? " selecting" : ""}">${out}</ul>
    ${L.busy ? `<p class="muted" role="status" style="text-align:center">${t("加载中…")}</p>` : moreBtn(L.hasMore, 'data-action="spend-more"')}`;
}
export function renderSpendList() {
  const host = $("#spendList"); if (!host) return;
  host.innerHTML = spendListHtml();
  const chips = $("#spendChips"); if (chips) chips.innerHTML = spendChipsHtml();
}
/** 多选删除用：已经读到的（不含虚拟的医疗付款） */
export const spendRowsLoaded = () => spendList.rows.filter((p) => !p.virtual);
/** 导出 / 打印：按当前筛选把结果读出来（不只是已显示的几页） */
export const fetchSpendRows = (max) => spendList.fetchAll(max);
function spendRecordsHtml() {
  const f = state.spendFilter, fc = spendList.facets || {};
  if (fc.years && !fc.years.length) return `<div class="section-head"><h2>${t("花费记录")}</h2></div><div class="panel empty"><strong>${t("还没有花费记录")}</strong>${t("采购清单点“已买到”、录入购物或上面的补记，都会出现在这里。")}</div>`;
  // 下拉选项：数据库读到的（全部年份）+ 联想里近 400 天的商店，在第一次统计读回来之前也有东西可选
  const y0 = new Date().getFullYear(), first = Math.min(state.stats.firstYear || y0, ...(fc.years || []).map(Number));
  const years = [...new Set([...(fc.years || []), ...Array.from({ length: Math.max(1, y0 - first + 1) }, (_, i) => String(y0 - i))])].sort().reverse();
  const stores = [...new Map([...knownStores(), ...(fc.stores || [])].map((x) => [storeKey(x), x])).values()].sort(compare);
  const used = new Set((fc.cats || []).map(canonCat));   // 分类树：一级、二级总在，叶子只列有记录的（和选中的）
  const opt = (v, label, cur) => `<option value="${esc(v)}" ${cur === v ? "selected" : ""}>${esc(label)}</option>`;
  return `<div class="section-head"><h2>${t("花费记录")}</h2></div>
    <div class="panel">
      <div class="toolbar ix-toolbar">
        <input type="search" id="spendSearch" placeholder="${t("搜索名称或商店")}" value="${esc(f.q)}" aria-label="${t("搜索花费记录")}">
        <select id="spendCat" aria-label="${t("按分类筛选")}">${opt("all", t("全部分类"), f.cat)}${f.cat === "bills" || String(f.cat).startsWith("billfam_") ? opt(f.cat, t("账单"), f.cat) : ""}${treeOptions(f.cat, used)}</select>
        <select id="spendNat" data-nosearch aria-label="${t("按经济性质筛选")}">${opt("all", t("全部性质"), f.nat || "all")}${NATURES.map((n) => opt(n.id, t(n.name), f.nat)).join("")}</select>
        ${activeProps().length > 1 || (f.prop && f.prop !== "all") ? `<select id="spendProp" data-nosearch aria-label="${t("按房产筛选")}">${opt("all", t("全部房产"), f.prop || "all")}${activeProps().map((p) => opt(p.id, p.name, f.prop)).join("")}${opt("none", t("没关联房产"), f.prop)}</select>` : ""}
        <select id="spendStore" aria-label="${t("按商店筛选")}">${opt("all", t("全部商店 / 收款方"), f.store)}${stores.map((x) => opt(storeKey(x), x, f.store)).join("")}${opt("__none__", t("未填写商店"), f.store)}</select>
        <select id="spendYear" data-nosearch aria-label="${t("按年份筛选")}">${opt("all", t("全部年份"), f.year)}${years.map((y) => opt(y, y, f.year)).join("")}</select>
        <select id="spendMon" data-nosearch aria-label="${t("按月份筛选")}">${opt("all", t("全部月份"), f.mon)}${Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map((m) => opt(m, t("{m} 月", { m: +m }), f.mon)).join("")}</select>
        <select id="spendSort" data-nosearch aria-label="${t("排序")}">${SPEND_SORTS.map(([v, l]) => opt(v, t(l), f.sort)).join("")}</select>
      </div>
      <div id="spendChips">${spendChipsHtml()}</div>
      <div class="ix-tools"><button type="button" class="btn btn-sm btn-ghost" data-action="spend-sel-toggle">${state.spendSel ? t("退出多选") : t("多选删除")}</button><button type="button" class="btn btn-sm btn-ghost" data-action="print-run" data-kind="spend" data-filtered="1">${t("打印")}</button><button type="button" class="btn btn-sm btn-ghost" data-action="spend-csv">${t("导出当前列表 CSV")}</button></div>
      <div id="spendList" style="margin-top:8px">${spendListHtml()}</div>
      <p class="muted" style="margin:8px 0 0;font-size:12.5px">${t("删一笔：手机上把那一行向左滑；电脑上鼠标移到行上，右边出现「删除」。要删很多笔用「多选删除」。")}</p>
    </div>`;
}
/** 导出当前列表（按筛选，不只是已显示的几页）：列和年度报表的明细一样 */
export async function exportSpendList() {
  let list;
  try { list = await fetchSpendRows(20000); } catch (e) { return toast(t("读取列表失败：{msg}", { msg: e.message })); }
  if (!list.length) return toast(t("没有可导出的记录"));
  const hh = (state.household?.name || t("家庭")).replace(/[\\/:*?"<>|（）()\s]/g, "");
  download(`${hh}-${t("花费明细")}.csv`, toCsv(spendDetailRows(list)));
  toast(t("已导出 {n} 笔明细", { n: list.length }));
}

/* ── 商店统计与年度报表 ── */
export const STORE_COLORS = ["#2c6a57", "#d4694c", "#3b7fc4", "#b07a1a", "#7563c0", "#c75a85"];
export const STORE_REST = { name: "其他商店", color: "#8a948f" }, STORE_NONE = { name: "未填写商店", color: "#c3cbc6" };
export const cleanStore = (v) => (v || "").trim().replace(/\s+/g, " ").slice(0, 40) || null;
export const lastStore = () => { try { return localStorage.getItem("hmh-last-store") || ""; } catch { return ""; } };
export const rememberStore = (v) => { try { localStorage.setItem("hmh-last-store", v); } catch { /* 忽略 */ } };
// 商店名大小写、空格不同视为同一家（Costco 与 costco）
export const storeKey = (v) => (v || "").trim().toLowerCase();
/** 商店名：按记下来的（账单缴费时就是当时的收款方，中途换了收款方，历史不改写）；没记的账单 / 订阅 / 保险用账单的收款方（没填就用账单名），统计里就不会都归到“未填写商店” */
export function storeOf(p) {
  const s = (p.store || "").trim(); if (s) return s;
  if (!String(p.category || "").startsWith("bill_")) return "";
  const b = state.bills.find((x) => x.name === p.name);
  return (b?.payee || "").trim() || String(p.name || "").trim();
}
/** 用过的商店（近 400 天，按次数取前 300 个，数据库 spend_suggest；规则同 storeOf），按名称排 */
export function knownStores() {
  const m = new Map();
  for (const n of spendSuggestions().stores) if (n && !m.has(storeKey(n))) m.set(storeKey(n), n);
  return [...m.values()].sort(compare);
}
export const storeDatalist = () => `<datalist id="storeList">${knownStores().map((x) => `<option value="${esc(x)}">`).join("")}</datalist>`;

/** 商店 / 收款方：排行（横条里按二级分类分段，看得出在这家主要买什么）+ 表格；可按一级分类筛（默认 = 现金流出，不含转账）。
 *  数据来自 spend_rollup_store（按 月 × 商店 × 分类 × 性质 聚合），不读花费明细。month = 只看某个月 */
const STORE_TOP = 12;
export function viewStoreStats(months, month = state.stats.month) {
  const sel = month && months.includes(month) ? month : "", sp = spanOfMonths(months), rows = rollup(sp.from, sp.to, true), o = statOpts();
  const l1 = L1S.some((x) => x.id === state.stats.storeL1 && x.id !== "transfer") ? state.stats.storeL1 : "all";
  const l1Sel = `<label class="tb-field"><span>${t("只看")}</span><select id="statsStoreL1" data-nosearch aria-label="${t("按一级分类筛选商店")}"><option value="all" ${l1 === "all" ? "selected" : ""}>${t("全部花费（不含转账）")}</option>${L1S.filter((x) => x.id !== "transfer").map((x) => `<option value="${x.id}" ${x.id === l1 ? "selected" : ""}>${x.icon} ${esc(t(x.name))}</option>`).join("")}</select></label>`;
  const head = `<div class="section-head"><h2>${t("按商店 / 收款方统计")}</h2><p>${sel ? monthLabel(sel) : rangeLabel()}${t("；账单、订阅、保险按收款方；名称不区分大小写")}</p></div><div class="time-bar">${l1Sel}</div>`;
  if (!rows) return `<section class="section">${head}${LOADING()}</section>`;
  const list = storeAgg(rows, months, { sel, l1, ...o });
  if (!list.length) return `<section class="section">${head}<div class="panel empty"><strong>${t("这段时间没有符合条件的花费")}</strong></div></section>`;
  const named = list.filter((a) => a.key !== "__none__"), none = list.find((a) => a.key === "__none__"), top = named.slice(0, STORE_TOP), rest = named.slice(STORE_TOP);
  const groups = top.map((a) => ({ ...a, keys: [a.key] }));
  if (rest.length) groups.push(rest.reduce((g, v) => { g.total += v.total; g.count += v.count; g.keys.push(v.key); for (const [k, x] of Object.entries(v.byL2)) g.byL2[k] = (g.byL2[k] || 0) + x; return g; },
    { name: t(STORE_REST.name), total: 0, count: 0, byL2: {}, keys: [], members: rest, isRest: true }));
  if (none) groups.push({ ...none, name: t(STORE_NONE.name), keys: ["__none__"] });
  const total = groups.reduce((a, g) => a + g.total, 0);
  // 点一个商店 / “其他商店”：跳到明细，套上这家（或这一组）商店 + 一级分类；month 为空 = 整个时间范围
  const gDrill = (g) => dq({ ...(g.keys.length === 1 ? { store: g.keys[0] } : { stores: encKeys(g.keys) }), ...(l1 !== "all" ? { cat: l1 } : {}), ...(sel ? { month: sel } : winDrill()) });
  const bars = Charts.hbars({ title: t("在哪里花得最多"), fmt: money, total,
    items: groups.map((g) => ({ name: g.isRest ? `${g.name}（${t("{n} 家", { n: g.members.length })}）` : g.name, value: Math.round(g.total * 100) / 100, color: "#8a948f", drill: gDrill(g),
      parts: Object.entries(g.byL2).map(([k, v]) => { const n = nodeOf(k); return { name: `${n?.icon || ""} ${t(n?.name || k)}`.trim(), value: v, color: n?.color || "#8a948f" }; }) })) });
  const trs = groups.map((g) => `<tr><th scope="row"><button type="button" class="link-name linkbtn" data-drill="${esc(gDrill(g))}" title="${esc(t("查看明细"))}">${esc(g.name)}</button>${g.isRest ? ` <small class="muted">${t("{n} 家", { n: g.members.length })}</small>` : ""}
    <td>${g.count}</td><td>${esc(money(g.total))}</td><td>${esc(money(g.total / g.count))}</td><td>${total ? Math.round((g.total / total) * 100) : 0}%</td></tr>`).join("");
  // “其他商店”里到底有哪些：展开列出每一家，每家也能点进明细
  const rg = groups.find((g) => g.isRest);
  const restDetail = rg ? `<details class="rest-detail"><summary><span class="rd-text"><b>${t("“其他商店”包含 {n} 家", { n: rg.members.length })}</b><small>${t("花费较少的商店合并在一起；点开看每一家，再点收起")}</small></span><span class="mch" aria-hidden="true">›</span></summary>
    <ul class="rest-list">${rg.members.map((v) => `<li class="ch-hit-row"${hitAttrs(gDrill({ keys: [v.key] }), v.name)}><span class="grow">${esc(v.name)}</span><small class="muted">${t("{n} 笔", { n: v.count })}</small><b>${esc(money(v.total))}</b><u aria-hidden="true">›</u></li>`).join("")}</ul></details>` : "";
  return `<section class="section">${head}
    <div class="panel chart-panel"><h3>${t("在哪里花得最多")}</h3><p class="muted" style="margin:0 0 8px;font-size:13px">${t("每条按二级分类分段：看得出在这家主要买什么。")}</p>${bars}
      <details class="ch-table"><summary>${t("查看数据表")}</summary><div class="ch-scroll"><table class="store-table"><thead><tr><th scope="col">${t("商店 / 收款方")}</th><th scope="col">${t("次数")}</th><th scope="col">${t("合计")}</th><th scope="col">${t("平均每次")}</th><th scope="col">${t("占比")}</th></tr></thead><tbody>${trs}</tbody></table></div></details>
      ${restDetail}${DRILL_HINT()}
    </div>
  </section>`;
}

export function viewAnnualExport() {
  const y = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => y - i);
  return `<section class="section">
    <div class="section-head"><h2>${t("年度花费报表")}</h2><p>${t("导出 CSV，可用 Excel、Numbers 或 Google 表格打开")}</p></div>
    <div class="panel export-grid">
      <label class="export-pick"><span>${t("年份")}</span><select id="csvYear" data-nosearch>${years.map((v) => `<option value="${v}">${t("{y} 年", { y: v })}</option>`).join("")}</select></label>
      <div class="export-btns"><button type="button" class="btn btn-primary btn-sm" data-action="csv-summary">${t("导出汇总（月份 × 分类、商店）")}</button>
      <button type="button" class="btn btn-sm" data-action="csv-detail">${t("导出明细（每一笔）")}</button></div>
    </div>
  </section>`;
}

// CSV：加 UTF-8 BOM（Excel 打开中文不乱码）；以 = + - @ 开头的文本加 ' 前缀，防止表格公式注入
export function csvCell(v) {
  if (v == null) return "";
  if (typeof v === "number") return String(v);
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export const toCsv = (rows) => "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");

export function download(name, text, type = "text/csv;charset=utf-8") {
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export const ymd = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

/** 花费明细 CSV 的表头 + 每一笔（年度报表的明细、明细页「导出当前列表」共用） */
/** 一级 / 二级 / 叶子分类、经济性质（空 = 按分类默认，写出实际用的）、关联房产 都写成列，方便在表格里透视 */
function spendDetailRows(list) {
  const propName = (id) => (id ? state.properties.find((x) => x.id === id)?.name || "" : "");
  return [[t("日期"), t("物品"), t("一级分类"), t("二级分类"), t("分类"), t("经济性质"), t("商店 / 收款方"), t("数量"), t("单位"), t("金额"), t("货币"), t("付款方式"), t("关联房产"), t("关联库存")],
    ...list.map((p) => { const [a, b, c] = [l1Of(p.category), l2Of(p.category), leafInfo(p.category)];
      return [ymd(p.purchased_at), p.name, t(a.name), t(b.name), t(c.name), t(natureName(effNature(p.category, p.nature))), storeOf(p), p.quantity == null ? "" : num(p.quantity), p.unit ? t(p.unit) : "",
        p.amount == null ? "" : num(p.amount), p.currency || "", paymentPayLabel(p), propName(p.property_id), p.item_id ? t("是") : t("否")]; })];
}
export async function exportAnnual(kind) {
  const year = +($("#csvYear")?.value || new Date().getFullYear());
  // 按本地时间：当年 1 月 1 日 0 点到次年 1 月 1 日 0 点
  const from = new Date(year, 0, 1).toISOString(), to = new Date(year + 1, 0, 1).toISOString();
  let list;   // 按年份筛选的花费流水（含医疗等事件型账单的付款），旧 → 新；数据库分页读，不读整表
  try { list = (await fetchSpendPages({ ...spendBase("old"), year: String(year), from, to }, 50000)).map((r) => ({ ...r, category: canonCat(r.category) })); }
  catch (e) { return toast(t("读取列表失败：{msg}", { msg: e.message })); }
  if (!list.length) return toast(t("{y} 年没有采购记录", { y: year }));
  const r2 = (v) => Math.round(v * 100) / 100;
  const hh = state.household?.name || t("家庭");
  const fileBase = `${hh.replace(/[\\/:*?"<>|（）()\s]/g, "")}-${year}`;

  if (kind === "detail") {
    download(`${fileBase}-${t("采购明细")}.csv`, toCsv(spendDetailRows(list)));
    return toast(t("已导出 {n} 笔明细", { n: list.length }));
  }

  // 汇总：只统计当前地区货币，其他币种和未填金额的笔数在文末说明
  const cur = Units.region.currency;
  const valid = list.filter((p) => p.amount != null && (!p.currency || p.currency === cur));
  const skipped = list.filter((p) => p.amount != null && p.currency && p.currency !== cur).length;
  const noAmount = list.filter((p) => p.amount == null).length;
  // 月份 × 统计口径（日常 / 住房 / 财务 / 资本性 / 投资，合起来 = 现金流出），再月份 × 二级分类；转账不算，文末写笔数
  const cats = STAT_CATS(), bk = BUCKETS;
  const grid = Array.from({ length: 12 }, () => Object.fromEntries(cats.map((c) => [c.id, 0])));
  const bgrid = Array.from({ length: 12 }, () => Object.fromEntries(bk.map((b) => [b.id, 0])));
  const stores = new Map(); let xferN = 0;
  for (const p of valid) {
    const m = new Date(p.purchased_at).getMonth(), b = bucketOf(p.category, p.nature);
    if (!b) { xferN++; continue; }
    bgrid[m][b] += num(p.amount);
    const c = statCat(p.category);
    grid[m][c] += num(p.amount);
    const k = storeKey(storeOf(p)) || "__none__";
    const st = stores.get(k) || { name: storeOf(p) || t(STORE_NONE.name), count: 0, total: 0 };
    st.count++; st.total += num(p.amount); stores.set(k, st);
  }
  const used = cats.filter((c) => grid.some((g) => g[c.id] > 0));
  const catYear = (id) => grid.reduce((a, g) => a + g[id], 0);
  const yearTotal = bgrid.reduce((a, g) => a + Object.values(g).reduce((x, y) => x + y, 0), 0);
  const rows = [
    [t("{hh} {y} 年采购花费汇总", { hh, y: year })],
    [t("货币：{cur}", { cur }), t("导出时间：{d}", { d: new Date().toLocaleString(locale()) })],
    [],
    [t("月份"), ...bk.map((b) => t(b.name)), t("现金流出合计"), t("日常 + 住房")],
  ];
  bgrid.forEach((g, i) => rows.push([t("{m}月", { m: i + 1 }), ...bk.map((b) => r2(g[b.id])), r2(Object.values(g).reduce((x, y) => x + y, 0)), r2(g.living + g.housing)]));
  rows.push([t("全年"), ...bk.map((b) => r2(bgrid.reduce((a, g) => a + g[b.id], 0))), r2(yearTotal), r2(bgrid.reduce((a, g) => a + g.living + g.housing, 0))], []);
  rows.push([t("月份"), ...used.map((c) => `${t(nodeOf(l2List().find((x) => x.id === c.id)?.p)?.name || "")} · ${t(c.name)}`), t("合计")]);
  grid.forEach((g, i) => rows.push([t("{m}月", { m: i + 1 }), ...used.map((c) => r2(g[c.id])), r2(used.reduce((a, c) => a + g[c.id], 0))]));
  rows.push([t("全年"), ...used.map((c) => r2(catYear(c.id))), r2(yearTotal)]);
  rows.push([t("占比"), ...used.map((c) => (yearTotal ? `${r2((catYear(c.id) / yearTotal) * 100)}%` : "")), "100%"]);
  rows.push([], [t("商店"), t("次数"), t("合计"), t("平均每次"), t("占比")]);
  [...stores.values()].sort((a, b) => b.total - a.total).forEach((st) =>
    rows.push([st.name, st.count, r2(st.total), r2(st.total / st.count), yearTotal ? `${r2((st.total / yearTotal) * 100)}%` : ""]));
  if (skipped || noAmount || xferN) rows.push([], [t("说明：{a}{b}明细表中仍可查看。", { a: (skipped ? t("{n} 笔非 {cur} 记录未计入；", { n: skipped, cur }) : "") + (xferN ? t("{n} 笔转账不算花费；", { n: xferN }) : ""), b: noAmount ? t("{n} 笔未填金额；", { n: noAmount }) : "" })]);
  download(`${fileBase}-${t("花费汇总")}.csv`, toCsv(rows));
  toast(t("已导出 {y} 年汇总，共 {n} 笔", { y: year, n: valid.length }));
}
