/* ── 财务统一的时间条（设计见 docs/design-payees-time-range.md §2）──
 * 花费（概览 / 分类 / 收款方 / 预算趋势）和收入（收支总览 / 类型 / 付款方 / 收支对比 / 导出）共用一个时间范围，存在本机，切页面不丢。
 * 口径一律按日历月（含本月）。值：
 *   m 本月 · pm 上月 · 3 / 6 / 12 近 N 个月 · y:YYYY 某一年（今年到本月为止）· 3y / 5y 近 3 / 5 年 · all 全部历史 · c:YYYY-MM:YYYY-MM 自定义（按月）
 * 周期（有走势图的页面，2026-11 统一）：auto / month / quarter / year（收支对比另有 biweek 双周），存在本机、各页共用。
 *   规则：一张图最多 24 格（SLOT_CAP）。自动 = 放得下的最细周期（24 个月以内按月，6 年以内按季，再长按年）；
 *   手动选的太密：下拉里那一项灰掉并写明原因，已存的选择这时退回自动，图上提示「按月太密，已改按季」（chartUnit）。
 *   流量（花费、收入、现金流）按周期求和；余额（净资产）取周期里最后一个月（lastByPeriods）。
 *   没过完的周期（本月 / 本季 / 今年至今，或范围从季中、年中开始）标 partial，图上画浅色。 */
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
const UNIT_NAME = { biweek: "双周", month: "月", quarter: "季", year: "年" };
export const unitName = (u) => t(UNIT_NAME[u] || u);
/** 本机存的周期；双周只有收支对比认（别的页面当「月」） */
export const finUnit = ({ biweek = false } = {}) => { const u = read(UKEY, "auto"); if (u === "biweek") return biweek ? u : "month"; return UNITS.some(([k]) => k === u) ? u : "auto"; };
export const setFinUnit = (u) => write(UKEY, u === "biweek" || UNITS.some(([k]) => k === u) ? u : "auto");

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
export const SLOT_CAP = 24;
/** [{ key, label, months, partial }]；月份必须是连续的。partial = 没过完（含本月）或范围只盖住了这个周期的一部分 */
export function periodsOf(months, unit) {
  const out = [], key = (m) => (unit === "year" ? m.slice(0, 4) : unit === "quarter" ? `${m.slice(0, 4)}-Q${Math.ceil(+m.slice(5) / 3)}` : m);
  for (const m of months) { const k = key(m); let p = out.at(-1); if (!p || p.key !== k) { p = { key: k, months: [] }; out.push(p); } p.months.push(m); }
  const full = unit === "year" ? 12 : unit === "quarter" ? 3 : 1, now = thisMonth();
  for (const p of out) {
    p.label = unit === "year" ? p.key : unit === "quarter" ? (lang === "en" ? p.key.replace("-Q", " Q") : `${p.key.slice(2, 4)}年Q${p.key.slice(-1)}`) : null;
    p.partial = p.months.length < full || p.months.includes(now);
  }
  return out;
}
/** 这段时间按某个周期有几格（双周按天数估） */
export const slotCount = (months, u) => (u === "biweek" ? Math.ceil((months.length * 30.44) / 14) : periodsOf(months, u).length);
// 双周：最多 12 个月（约 26 期，发薪日看一年是常用的），其余按格数
export const unitFits = (months, u, cap = SLOT_CAP) => u === "year" || (u === "biweek" ? months.length <= 12 : slotCount(months, u) <= cap);
/** 自动：放得下的最细周期 */
export const autoUnit = (months, cap = SLOT_CAP) => ["month", "quarter"].find((u) => unitFits(months, u, cap)) || "year";
/** 实际画图用的周期：{ unit, fell }；手动选的放不下 → 退回自动，fell = true（want = 原来选的） */
export function chartUnit(months, u = finUnit(), { cap = SLOT_CAP } = {}) {
  if (u === "auto") return { unit: autoUnit(months, cap), fell: false };
  if (unitFits(months, u, cap)) return { unit: u, fell: false };
  return { unit: autoUnit(months, cap), fell: true, want: u };
}
export const effUnit = (months, u = finUnit()) => chartUnit(months, u).unit;
/** 退回自动时的提示 */
export const unitNote = (cu) => (cu.fell ? t("按{a}太密，已改按{b}", { a: unitName(cu.want), b: unitName(cu.unit) }) : "");
/** 走势图的小标题：走势 · 按季 */
export const trendTitle = (unit) => t("走势 · 按{u}", { u: unitName(unit) });
/** 按月的数组（和 months 对齐）→ 按周期求和（流量：花费、收入） */
export const sumByPeriods = (periods, months, values) => { const idx = new Map(months.map((m, i) => [m, i])); return periods.map((p) => Math.round(p.months.reduce((a, m) => a + (values[idx.get(m)] || 0), 0) * 100) / 100); };
/** 余额（净资产、贷款余额）：取周期里最后一个有值的月份，不能相加 */
export const lastByPeriods = (periods, months, values) => { const idx = new Map(months.map((m, i) => [m, i])); return periods.map((p) => { for (let j = p.months.length - 1; j >= 0; j--) { const v = values[idx.get(p.months[j])]; if (v != null) return v; } return null; }); };

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
/** 周期下拉的选项：太密的一项灰掉并写明原因（nocap = 导出用，不限）；biweek = 收支对比多一个双周 */
export function unitOptionsHtml(cur, months, { biweek = false, nocap = false, cap = SLOT_CAP } = {}) {
  const list = [["auto", "自动"], ...(biweek ? [["biweek", "双周"]] : []), ...UNITS.slice(1)];
  return list.map(([k, l]) => {
    const off = !nocap && k !== "auto" && !unitFits(months, k, cap);
    const label = k === "auto" ? t("自动（{u}）", { u: unitName(autoUnit(months, cap)) }) : off ? t("{u}（这段时间太长，不可用）", { u: t(l) }) : t(l);
    return `<option value="${k}" ${cur === k ? "selected" : ""}${off ? " disabled" : ""}>${esc(label)}</option>`;
  }).join("");
}
/** 周期下拉（id=finUnit，main.js 统一处理：存本机、重画）；months = 这页走势图的月份 */
export const unitSelectHtml = (months, opts = {}) => `<label class="tb-field"><span>${t("周期")}</span><select id="finUnit" data-nosearch aria-label="${esc(t("周期"))}">${unitOptionsHtml(finUnit({ biweek: !!opts.biweek }), months, opts)}</select></label>`;
