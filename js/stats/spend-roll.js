/* 花费统计的数据：分类树、聚合数据的缓存（spend_rollup 按日期段读一次，花费变了标过期）。 */
import { DAY, du, esc, num, toast } from "../core/util.js";
import { Store } from "../core/store.js";
import { aggregate, normRow } from "./report.js";
import { allLeaves, l2IdOf, l2List } from "../core/taxonomy.js";
import { chartUnit, customHtml, lastByPeriods, periodsOf, rangeMonthsOf, rangeOptionsHtml, sumByPeriods, trendTitle, unitNote, unitToggleHtml } from "../core/time-range.js";
import { comparePlan } from "./spend-drill.js";
import { lang, t } from "../core/i18n.js";
import { state } from "../core/state.js";

/* ── 统计：花费分类树（js/core/taxonomy.js：叶子 → 二级 → 一级 + 经济性质 + 统计口径）──
 * 概览 / 分类 / 商店 / 账单概览的速览都读数据库按月聚合好的紧凑行（迁移 055 的 spend_rollup / spend_rollup_store），
 * 在 report.js 按分类树汇总；明细是 054 的服务器分页（new 排序走 057 的索引快路）。浏览器里不再有整表的花费（迁移 057 去掉了 state.purchases）。 */
/** 全部叶子分类（名称 / 图标 / 颜色）：明细、CSV、打印按 id 找名字 */
export const ALL_CATS = () => allLeaves();
/** 旧接口（收入对比、全部流水用）：叶子 → 二级分类 id；STAT_CATS = 全部二级分类 */
export const statCat = (id) => l2IdOf(id);
export const STAT_CATS = () => l2List();
export const isBill = (id) => String(id || "").startsWith("bill_");
/** 统计开关：排除资本性 / 排除投资（概览的趋势线、分类、商店都跟着；默认都排除，和以前「资本性支出默认不进图」一致） */
export const statOpts = () => ({ cur: Units.region.currency, exCap: state.stats.exCap !== false, exInv: state.stats.exInv !== false });
/* ── 聚合数据的缓存：按 [from, to) 本地日期读一次，花费变了（spend-rows-changed）标过期，下次画的时候后台重读 ── */
/** 浏览器所在时区：月份、日按本地时间算（和 monthKey 一致） */
export const TZ = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; } };
const nextMonth = (m) => { const [y, mo] = m.split("-").map(Number); return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`; };
/** 一组月份 → 覆盖它们的日期范围 { from, to }（含 from 不含 to） */
export const spanOfMonths = (ms) => { const s = [...ms].sort(); return { from: `${s[0]}-01`, to: `${nextMonth(s.at(-1))}-01` }; };
const ROLL = new Map();
   // key → { rows, busy, stale, err, p }
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
export const rollup = (from, to, store = false) => rollEntry(from, to, store).rows;
/** 等它读完（打印用） */
const rollupAsync = async (from, to, store = false) => { const e = rollEntry(from, to, store); await e.p; return e.rows || []; };
/** 覆盖这些月份的聚合行（预算的实际花费用，规范化后的 { m, c, nat, cur, sum, n }）；还在读返回 null */
export const spendRollupFor = (months) => { const sp = spanOfMonths(months); return rollup(sp.from, sp.to); };
window.addEventListener("spend-rows-changed", () => { for (const e of ROLL.values()) e.stale = true; });
export const rollErr = () => [...ROLL.values()].find((e) => e.err)?.err || "";
export const monthKey = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`; };
export const MONTH_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const monthLabel = (k) => (lang === "en"
  ? (k.endsWith("-01") ? `${MONTH_EN[0]} ${k.slice(2, 4)}` : MONTH_EN[+k.slice(5) - 1])
  : (k.endsWith("-01") ? t("{yy}年1月", { yy: k.slice(2, 4) }) : t("{m}月", { m: +k.slice(5) })));
export function lastMonths(n) {
  const d = new Date(), out = [];
  for (let i = n - 1; i >= 0; i--) out.push(monthKey(new Date(d.getFullYear(), d.getMonth() - i, 1)));
  return out;
}
/** 趋势图的月份：时间范围有 6 个月以上就画这段；更短（本月、上月、近 3 个月）也看满近 12 个月的走势 */
export const trendMonths = (n = state.stats.months) => { const ms = rangeMonths(n); return ms.length >= 6 ? ms : lastMonths(12); };
/** 走势图按周期（月 / 季 / 年，js/core/time-range.js 的统一规则）分组，财务各页的走势图都用它：
 *  labels、agg（按月数组 → 按周期求和，流量）、last（余额：取周期最后一个月）、partial（不完整的周期，图上浅色）、
 *  when / win（每根柱子的钻取：花费明细的月份 / 收入明细的日期段）、title（走势 · 按季）、note（选的太密退回自动时的提示） */
export function trendPeriods(months, { u } = {}) {
  const cu = chartUnit(months, u), unit = cu.unit, ps = periodsOf(months, unit), today = new Date();
  const endOf = (m) => { const d = new Date(+m.slice(0, 4), +m.slice(5, 7), 0), e = d > today ? today : d; return `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, "0")}-${String(e.getDate()).padStart(2, "0")}`; };
  return { unit, n: ps.length, labels: ps.map((p) => (unit === "month" ? monthLabel(p.key) : p.label)), partial: ps.map((p) => p.partial),
    agg: (vals) => (unit === "month" ? vals : sumByPeriods(ps, months, vals)), last: (vals) => (unit === "month" ? vals : lastByPeriods(ps, months, vals)),
    when: (i) => (ps[i].months.length === 1 ? { month: ps[i].months[0] } : { mlist: ps[i].months.join(",") }),
    win: (i) => ({ from: `${ps[i].months[0]}-01`, to: endOf(ps[i].months.at(-1)) }),
    title: trendTitle(unit), note: unitNote(cu), months };
}
/** 走势图面板的标题行：标题 + 右边周期小切换（unit:false 不放，预算页按月）+ 退回自动时的一行小字 */
export const trendHead = (title, TP, { unit = true } = {}) => `<div class="chart-head"><h3>${esc(title)}</h3>${unit ? unitToggleHtml(TP.months) : ""}</div>${TP.note ? `<p class="muted small trend-note" role="status">${esc(TP.note)}</p>` : ""}`;
export const PER_TITLE = { month: "每月花了多少", quarter: "每季度花了多少", year: "每年花了多少" };
export const perWord = (unit) => t({ month: "每月", quarter: "每季度", year: "每年", biweek: "每双周" }[unit] || "每月");
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
/** 时间范围：财务统一的时间条（js/core/time-range.js）——本月、上月、近 3 / 6 / 12 个月、今年、去年、往年、近 3 / 5 年、全部历史、自定义；
 *  花费各标签、预算趋势和收入页共用（state.stats.months，存在本机）。数据都是数据库按月聚合的（spend_rollup），往年不用先读花费 */
export const thisYear = () => new Date().getFullYear();
export const rangeMonths = (n = state.stats.months) => rangeMonthsOf(n, { first: state.stats.firstYear || thisYear() });
export const rangeChipsHtml = () => `<select id="statsRange" class="range-sel" aria-label="${t("时间范围")}" data-nosearch>${rangeOptionsHtml(state.stats.months, { first: state.stats.firstYear || thisYear() })}</select>`;
/** 自定义范围的起止月份（选了「自定义…」才有） */
export const customBar = () => customHtml(state.stats.months, { first: state.stats.firstYear || thisYear(), attr: "data-fin-c" });
/** 最早有记录的年份：「全部历史」从这一年算起，下拉里的往年选项也到这一年为止。
 *  刷新页面时路由先到、登录 / 家庭还没就绪，这时查询会失败或查不到——以前当成「今年」记住了，全部历史就只剩今年。
 *  现在：没就绪、出错都不记，下次画花费页再查；查到了才记（没有任何花费也记成今年）。 */
let fyBusy = null;
const storeReady = () => Store.mode !== "cloud" || !!Store.hid;
export function ensureFirstYear() {
  if (state.stats.firstYear) return Promise.resolve(false);
  if (!storeReady()) return Promise.resolve(false);
  return (fyBusy ||= Store.firstPurchaseYear()
    .then((y) => { state.stats.firstYear = Math.min(y || thisYear(), thisYear()); return true; })
    .catch(() => false)
    .finally(() => { fyBusy = null; }));
}
export const monthOpt = (m) => (lang === "en" ? `${MONTH_EN[+m.slice(5) - 1]} ${m.slice(0, 4)}` : t("{y} 年 {m} 月", { y: m.slice(0, 4), m: +m.slice(5) }));
export const noSpend = () => `<div class="panel empty"><strong>${t("还没有花费记录")}</strong>${t("在购物车点“已买到”时填上实际花费，或在“明细”里补记一笔。")}</div>`;
