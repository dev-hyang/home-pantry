/* ── 财务统一的时间条（设计见 docs/design-payees-time-range.md §2）──
 * 花费（概览 / 分类 / 收款方 / 预算趋势）和收入（收支总览 / 类型 / 付款方 / 收支对比 / 导出）共用一个时间范围，存在本机，切页面不丢。
 * 口径一律按日历月（含本月）。值：
 *   m 本月 · pm 上月 · 3 / 6 / 12 近 N 个月 · y:YYYY 某一年（今年到本月为止）· 3y / 5y 近 3 / 5 年 · all 全部历史 · c:YYYY-MM:YYYY-MM 自定义（按月）
 * 周期（有走势图的页面）：auto / month / quarter / year；auto = 24 个月以内按月，6 年以内按季，再长按年。 */
import { lang, t } from "./i18n.js";
import { esc } from "./util.js";

const pad = (n) => String(n).padStart(2, "0");
const ym = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const thisYear = () => new Date().getFullYear();
export const thisMonth = () => ym(new Date());
const addM = (m, k) => { const d = new Date(+m.slice(0, 4), +m.slice(5, 7) - 1 + k, 1); return ym(d); };
/** from..to（YYYY-MM，含两端） */
export function monthsBetween(a, b) { const out = []; for (let m = a; m <= b && out.length < 600; m = addM(m, 1)) out.push(m); return out; }
const lastN = (n) => monthsBetween(addM(thisMonth(), -(n - 1)), thisMonth());

/* ── 共享状态（本机）── */
const KEY = "hmh-fin-range", UKEY = "hmh-fin-unit";
const read = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* 忽略 */ } };
/** 旧值换成新值：近 9 个月 / 近 24 个月去掉了；收支对比以前的 3m / 12m / ytd / lastyear / month / custom */
export function normRange(v) {
  const s = String(v ?? "");
  const map = { 9: "12", 24: "12", "3m": "3", "6m": "6", "12m": "12", "24m": "12", month: "m", ytd: `y:${thisYear()}`, lastyear: `y:${thisYear() - 1}`, custom: "12" };
  if (map[s]) return map[s];
  return rangeOk(s) ? s : "12";
}
export const rangeOk = (v) => ["m", "pm", "3", "6", "12", "3y", "5y", "all"].includes(String(v)) || (/^y:\d{4}$/.test(v) && +v.slice(2) <= thisYear()) || /^c:\d{4}-\d{2}:\d{4}-\d{2}$/.test(v);
export const finRange = () => normRange(read(KEY, "12"));
export const setFinRange = (v) => write(KEY, normRange(v));
export const UNITS = [["auto", "自动"], ["month", "月"], ["quarter", "季"], ["year", "年"]];
export const finUnit = () => { const u = read(UKEY, "auto"); return UNITS.some(([k]) => k === u) ? u : "auto"; };
export const setFinUnit = (u) => write(UKEY, UNITS.some(([k]) => k === u) ? u : "auto");

/* ── 范围 → 月份 / 日期 / 叫法 ── */
/** 这段时间包含的月份（YYYY-MM，旧 → 新）；first = 最早有记录的年份（全部历史从它算起） */
export function rangeMonthsOf(v, { first = thisYear() } = {}) {
  v = normRange(v);
  if (v === "m") return [thisMonth()];
  if (v === "pm") return [addM(thisMonth(), -1)];
  if (v === "3y") return lastN(36);
  if (v === "5y") return lastN(60);
  if (v === "all") return monthsBetween(`${Math.min(first, thisYear())}-01`, thisMonth());
  if (v.startsWith("y:")) { const y = +v.slice(2); return monthsBetween(`${y}-01`, y === thisYear() ? thisMonth() : `${y}-12`); }
  if (v.startsWith("c:")) { let [a, b] = v.slice(2).split(":"); if (a > b) [a, b] = [b, a]; return monthsBetween(a, b > thisMonth() ? thisMonth() : b); }
  return lastN(+v || 12);
}
/** 日期段（含两端）：结束日不超过今天 */
export function rangeWindow(v, opts) {
  const ms = rangeMonthsOf(v, opts), a = ms[0], b = ms.at(-1), today = new Date();
  const end = new Date(+b.slice(0, 4), +b.slice(5, 7), 0), last = end > today ? today : end;
  return { from: `${a}-01`, to: `${last.getFullYear()}-${pad(last.getMonth() + 1)}-${pad(last.getDate())}`, months: ms };
}
const MONTH_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const monthName = (m) => (lang === "en" ? `${MONTH_EN[+m.slice(5) - 1]} ${m.slice(0, 4)}` : t("{y} 年 {m} 月", { y: m.slice(0, 4), m: +m.slice(5) }));
export function rangeLabelOf(v) {
  v = normRange(v);
  if (v === "m") return t("本月");
  if (v === "pm") return t("上月");
  if (v === "3y") return t("近 3 年");
  if (v === "5y") return t("近 5 年");
  if (v === "all") return t("全部历史");
  if (v.startsWith("y:")) { const y = +v.slice(2); return y === thisYear() ? t("今年") : y === thisYear() - 1 ? t("去年") : t("{y} 年", { y }); }
  if (v.startsWith("c:")) { const ms = rangeMonthsOf(v); return ms.length === 1 ? monthName(ms[0]) : `${monthName(ms[0])} – ${monthName(ms.at(-1))}`; }
  return t("近 {n} 个月", { n: +v });
}
/** 对比的上一段（等长）；全部历史 / 自定义不比，返回 null。本月 / 今年至今的「同期」由调用方处理（花费有 dmax） */
export function prevMonthsOf(v) {
  v = normRange(v);
  if (v === "all" || v.startsWith("c:")) return null;
  if (v.startsWith("y:")) return rangeMonthsOf(v).map((m) => `${+m.slice(0, 4) - 1}${m.slice(4)}`);
  const ms = rangeMonthsOf(v), n = ms.length;
  return monthsBetween(addM(ms[0], -n), addM(ms[0], -1));
}

/* ── 周期：把月份按 月 / 季 / 年 分组（走势图）── */
export const autoUnit = (n) => (n <= 24 ? "month" : n <= 72 ? "quarter" : "year");
export const effUnit = (months, u = finUnit()) => (u === "auto" ? autoUnit(months.length) : u);
/** [{ key, label, months }]；月份必须是连续的 */
export function periodsOf(months, unit) {
  const out = [], key = (m) => (unit === "year" ? m.slice(0, 4) : unit === "quarter" ? `${m.slice(0, 4)}-Q${Math.ceil(+m.slice(5) / 3)}` : m);
  for (const m of months) { const k = key(m); let p = out.at(-1); if (!p || p.key !== k) { p = { key: k, months: [] }; out.push(p); } p.months.push(m); }
  for (const p of out) p.label = unit === "year" ? p.key : unit === "quarter" ? (lang === "en" ? p.key.replace("-Q", " Q") : `${p.key.slice(2, 4)}年Q${p.key.slice(-1)}`) : null;
  return out;
}
/** 按月的数组（和 months 对齐）→ 按周期求和 */
export const sumByPeriods = (periods, months, values) => { const idx = new Map(months.map((m, i) => [m, i])); return periods.map((p) => Math.round(p.months.reduce((a, m) => a + (values[idx.get(m)] || 0), 0) * 100) / 100); };

/* ── 控件 ── */
/** 时间范围下拉的选项：本月 · 上月 · 近 3 / 6 / 12 个月 · 今年 · 去年 · 往年… · 近 3 / 5 年 · 全部历史 · 自定义… */
export function rangeOptionsHtml(cur, { first = thisYear() } = {}) {
  cur = normRange(cur);
  const y0 = thisYear(), older = Array.from({ length: Math.max(0, Math.min(10, y0 - 1 - first)) }, (_, i) => y0 - 2 - i);
  const opt = (v, label = rangeLabelOf(v)) => `<option value="${esc(v)}" ${cur === v ? "selected" : ""}>${esc(label)}</option>`;
  const custom = cur.startsWith("c:") ? cur : `c:${addM(thisMonth(), -5)}:${thisMonth()}`;
  return [opt("m"), opt("pm"), opt("3"), opt("6"), opt("12"), opt(`y:${y0}`), opt(`y:${y0 - 1}`), ...older.map((y) => opt(`y:${y}`)), opt("3y"), opt("5y"), opt("all"),
    `<option value="${esc(custom)}" ${cur.startsWith("c:") ? "selected" : ""}>${esc(t("自定义…"))}</option>`].join("");
}
/** 自定义的起止月份：两个下拉（type=month 在 Safari 上不好用） */
export function customHtml(cur, { first = thisYear(), attr = 'data-fin-c' } = {}) {
  if (!String(cur).startsWith("c:")) return "";
  const [a, b] = cur.slice(2).split(":"), all = monthsBetween(`${Math.min(first, thisYear())}-01`, thisMonth()).reverse();
  const sel = (which, v) => `<select ${attr}="${which}" data-nosearch aria-label="${esc(which === "from" ? t("从哪个月") : t("到哪个月"))}">${all.map((m) => `<option value="${m}" ${m === v ? "selected" : ""}>${esc(monthName(m))}</option>`).join("")}</select>`;
  return `<label class="tb-field"><span>${t("从")}</span>${sel("from", a)}</label><label class="tb-field"><span>${t("到")}</span>${sel("to", b)}</label>`;
}
/** 自定义起止变了 → 新的范围值 */
export const customChanged = (cur, which, v) => { let [a, b] = String(cur).slice(2).split(":"); if (which === "from") a = v; else b = v; if (a > b) [a, b] = [b, a]; return `c:${a}:${b}`; };
export const unitOptionsHtml = (cur, months) => UNITS.map(([k, l]) => `<option value="${k}" ${cur === k ? "selected" : ""}>${esc(k === "auto" ? t("自动（{u}）", { u: t(UNITS.find(([x]) => x === autoUnit(months.length))[1]) }) : t(l))}</option>`).join("");
