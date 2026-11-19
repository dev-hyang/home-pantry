/* 花费统计：图表钻取（点一下跳到明细并套上筛选）和时间范围的「这一段 vs 前一段」。 */
import { LEGACY_STAT, NATURES } from "../core/taxonomy.js";
import { NO_SPEND_FILTER } from "./spend-records.js";
import { aggregate } from "./report.js";
import { esc, money } from "../core/util.js";
import { lang, t } from "../core/i18n.js";
import { lastMonths, monthLabel, rangeMonths, rollup, spendAgg, statOpts, thisYear } from "./spend-roll.js";
import { normRange, prevMonthsOf, rangeLabelOf } from "../core/time-range.js";
import { state } from "../core/state.js";

/* ── 钻取：图表色块、图例、名称、数字卡片都带 data-drill（查询串），点一下跳到 明细 并套上对应筛选（分类 / 商店 / 月份 / 近 N 个月）；
 * 全局点击处理在 main.js，筛选在 applySpendDrill，明细页顶部用筛选条显示并可逐项去掉。 */
/** 预算页的“预算分组”（日常消耗品 / 房屋维护 / 大件家电…）和分类不是一回事（大件按单笔金额分），分组的判断函数由 budget.js 登记在这里，明细按它筛选 */
export const dq = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v != null && v !== "").map(([k, v]) => [k, String(v)])).toString();
const encKeys = (keys) => keys.map(encodeURIComponent).join(",");
export const hitAttrs = (q, label) => (q ? ` data-drill="${esc(q)}" role="link" tabindex="0" aria-label="${esc(label)}"` : "");
export const DRILL_HINT = () => `<p class="muted drill-hint">${t("点图里的色块、图例或名称，可以查看对应的花费明细。")}</p>`;
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
  if (/^\d{4}-\d{2}$/.test(m)) f.range = `c:${m}:${m}`;   // 一个月：时间范围 = 自定义的这一个月
  else if (q.get("mlist")) f.months = q.get("mlist").split(",").filter((x) => /^\d{4}-\d{2}$/.test(x));   // 一组月份：筛选条下面的标签
  else if (q.get("range")) { const n = +q.get("range") || 6; if ([3, 6, 12].includes(n)) f.range = String(n); else f.months = lastMonths(Math.max(1, Math.min(60, n))); }
  else if (/^\d{4}$/.test(q.get("year") || "")) f.range = `y:${q.get("year")}`;   // 年度预算 / 往年：整年（今年就是到今天为止）
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
  n = normRange(n);
  const am = rangeMonths(n), bm = prevMonthsOf(n) || [], k = +n;
  const aDrill = n === "all" ? {} : [3, 6, 12].includes(k) ? { range: k } : am.length === 1 ? { month: am[0] } : { mlist: am.join(",") };
  const aLabel = [3, 6, 12].includes(k) ? t("近 {n} 个月（{r}）", { n: k, r: monthNums(am) }) : am.length === 1 ? monthLabel(am[0]) : `${rangeLabelOf(n)}（${monthNums(am)}）`;
  const bLabel = !bm.length ? "" : [3, 6, 12].includes(k) ? t("前 {n} 个月（{r}）", { n: k, r: monthNums(bm) }) : bm.length === 1 ? monthLabel(bm[0]) : t("前一段（{r}）", { r: monthNums(bm) });
  return { a: { months: am, label: aLabel, drill: aDrill }, b: { months: bm, label: bLabel, drill: bm.length ? { mlist: bm.join(",") } : {} }, avg: "month" };
}
/** 当前时间范围的钻取参数（明细里套上同样的月份） */
export const winDrill = () => comparePlan().a.drill;
/** 一段时间的汇总；dmax = 只算每月 1–N 日（「本月」对比上月同期），这时另读那一小段 */
export function windowAgg(w) {
  if (!w.dmax) return spendAgg(w.months);
  const m = w.months[0], end = new Date(+m.slice(0, 4), +m.slice(5) - 1, w.dmax + 1);   // 超过月底会滚到下个月 1 日，正好是整月
  const rows = rollup(`${m}-01`, `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`);
  return rows ? aggregate(rows, [m], statOpts()) : null;
}
export const LOADING = () => `<p class="muted" role="status">${t("加载中…")}</p>`;
export const kpi = ({ label, value, small = "", drill = null, wide = false }) => `<div class="kpi${wide ? " kpi-wide" : ""}${drill ? " ch-hit-row" : ""}"${drill ? hitAttrs(dq(drill), label) : ""}><span>${label}</span><b>${value}</b><small>${small}${drill ? " ›" : ""}</small></div>`;
export const livHou = (a, b) => `${t("日常")} ${money(a)} <span class="kpi-sub">/ ${t("含住房")} ${money(b)}</span>`;
export const changeTxt = (a, b) => { const c = b > 0 ? Math.round(((a - b) / b) * 100) : null; return c == null ? t("这段时间无记录") : c > 0 ? t("多了 {p}%", { p: Math.abs(c) }) : t("少了 {p}%", { p: Math.abs(c) }); };
