/* 收入（进账）：类型（规则在 js/core/income-taxonomy.js）、查看权限、还款余额、周期分桶。纯逻辑，不画界面。
 * 收入存在 income_records（迁移 042），不和花费（purchases）混在一起：purchases 里的负数已经表示退款 / 报销，全家成员都读得到。
 * 一笔入账只会进其中一张表：商家退款 = 负花费（留在花费里），工资 / 电汇 / 个人转入 = 收入；自己账户之间的转账两边都不算。 */
import { state } from "../core/state.js";
import { Store } from "../core/store.js";
import { meta } from "../bills/budget.js";
import { esc, num, todayISO } from "../core/util.js";
import { t } from "../core/i18n.js";
import { financeOk } from "../core/finance-access.js";
import { pageSize } from "../core/pager.js";
import { debtOfIncome, enrichDebt } from "../bills/debt-logic.js";
import { isClosedStatus } from "../core/debt-rules.js";
import { INC_L1S, customIncomeKinds, incKindOptions, incL1Of, incLeaf, incLeafLabel, incLeaves, normParent, recognized as recognizedOf } from "../core/income-taxonomy.js";

/* ───────────── 收入类型：一级 → 叶子（规则全在 js/core/income-taxonomy.js，这里只是给界面用的薄包装） ─────────────
 * 记录上存的还是叶子 id（income_records.kind，不改写）；一级（工作收入 / 投资收益 / 房产收入 / 其他收入 / 资本与资产流入）由分类表推出来。
 * 一级在界面里的 id 带 "g:" 前缀（g:employment…），和叶子区分：筛选、钻取都用它；旧链接里的 g:work 这类按旧大类换算。
 * 自定义类型存在预算设置 _income_kinds（{ id, name, icon, parent }），parent = 一级 id（旧的大类读的时候换算）。 */
export { GAIN_KINDS, INC_L1S, capitalKinds, effKind, isIncomeKind, recognized, splitRecord } from "../core/income-taxonomy.js";
export const customKinds = () => customIncomeKinds();
/** 全部叶子，按一级排好（每个带 group = 一级 id） */
export const kindList = () => incLeaves().map((k) => ({ ...k, group: k.l1 }));
/** 一级（id 带 "g:" 前缀）；income = 算不算收入 */
export const groupList = () => INC_L1S.map((g) => ({ id: `g:${g.id}`, gid: g.id, name: g.name, icon: g.icon, color: g.color, income: g.income, custom: false, isGroup: true }));
/** 筛选值规整：旧的 g:work / g:invest… → 新一级 */
export const normKindSel = (sel) => (String(sel).startsWith("g:") ? `g:${normParent(String(sel).slice(2))}` : sel || "all");
export const groupOf = (kindId) => groupList().find((g) => g.gid === incL1Of(kindId));
export const kindOf = (id) => (String(id).startsWith("g:") ? groupList().find((g) => g.id === normKindSel(id)) : null) || { ...incLeaf(id), group: incLeaf(id).l1 };
/** 显示用：「一级 · 叶子」（已翻译）；一级 id 只显示一级名 */
export const kindLabel = (id) => { const k = kindOf(id); return k.isGroup ? t(k.name) : incLeafLabel(id); };
/** 筛选：all / 一级（g:xxx）/ 叶子 */
export const kindMatch = (sel, kind) => { const s = normKindSel(sel); return !s || s === "all" || (s.startsWith("g:") ? incL1Of(kind) === s.slice(2) : kind === s); };
/** 统计时用哪个 key：合并显示时归到一级 */
export const statKind = (kind, merge) => (merge ? groupOf(kind).id : kind);
/** 合并 / 不合并时图表里出现的项（顺序固定） */
export const statKinds = (merge) => (merge ? groupList() : kindList());
/** 类型下拉：按一级分组（optgroup）；groups = 每组前面多一个「全部 X」（筛选用），all = 最前面「全部」 */
export const kindOptionsHtml = (sel, o = {}) => incKindOptions(normKindSel(sel), o);
export const CHANNELS = [["ach", "银行转账 / ACH"], ["wire", "电汇"], ["zelle", "Zelle / Venmo"], ["check", "支票"], ["cash", "现金"], ["other", "其他"]];

/* ───────────── 状态与权限 ───────────── */
export const inc = () => (state.inc ||= { rec: [], rep: [], loaded: false, ok: true, err: "", form: null, open: null, q: "", kind: "all", acct: "all", person: "all", year: "all", limit: pageSize(), tab: {}, ai: {}, renameKey: null, repayFor: null, merge: mergeSaved() });
/* 「同一个一级合并显示」记在本机（和花费的合并开关一样） */
const MERGE_KEY = "hmh-inc-merge";
function mergeSaved() { try { return localStorage.getItem(MERGE_KEY) === "1"; } catch { return false; } }
export const setIncMerge = (on) => { inc().merge = !!on; try { localStorage.setItem(MERGE_KEY, on ? "1" : "0"); } catch { /* 隐私模式下忽略 */ } };
/* 迁移 050 起收入归「财务权限」管：家主和家主开了财务权限的家人看、改全家的收入（和家主一样）；没开的人连收入页都进不来。
 * 原来的「收入 → 权限」申请 / 批准（income_access）被它取代，界面和读取都已去掉（表留在数据库里，不删数据）。 */
export const isOwnerNow = () => financeOk();
/** 能不能看全家的收入 */
export const canSeeAll = () => financeOk();
export const myPersonId = () => state.people.find((p) => p.member_user_id === state.user?.id)?.id || null;
export const adults = () => state.people.filter((p) => (p.kind || "adult") === "adult");
export const personName = (id) => state.people.find((p) => p.id === id)?.name || "";
export const memberLabel = (userId) => state.members.find((m) => m.user_id === userId)?.display_name || "";

/** 读收入、还款；表还没建（迁移 042 没执行）时记下错误，界面提示 */
export async function loadIncome() {
  const I = inc();
  try {
    const [rec, rep] = await Promise.all([Store.listIncomeRecords(), Store.listIncomeRepayments()]);
    I.rec = rec.map((r) => ({ ...r, amount: num(r.amount), income_amount: r.income_amount == null ? null : num(r.income_amount) })); I.rep = rep.map((p) => ({ ...p, amount: num(p.amount) })); I.ok = true; I.err = "";
    window.dispatchEvent(new Event("income-data-changed"));   // 收支总览的聚合缓存（views.js）标过期
  } catch (e) { I.ok = false; I.err = e.message || String(e); }
  I.loaded = true;
  window.dispatchEvent(new Event("income-rows-changed"));   // 明细是服务器分页（views.js 的 incList）：统计 + 第一页重读
}

/* ───────────── 付款方 ───────────── */
export const skey = (s) => String(s ?? "").trim().replace(/\s+/g, " ").toLowerCase();
/** 银行流水描述里认出付款方：「Zelle payment from JOHN SMITH 123」→ JOHN SMITH；「ACME CORP DIRECT DEP」→ ACME CORP */
export function senderName(desc) {
  const raw = String(desc || "").replace(/\s+/g, " ").trim();
  let s = raw; const m = s.match(/\b(?:from|frm)\s+(.+)$/i); if (m) s = m[1];
  s = s.replace(/\b(?:direct dep(?:osit)?|payroll|ppd|ccd|web|ach|ref|conf(?:irmation)?|transaction|trn|indn|co\.? id|orig(?:inator)?|id)\b.*$/i, "");
  // 流水号（JPM99A1B、WFCT0XYZ123 这类纯字母数字混杂、5 位以上的词）也去掉：否则同一个人每笔都是新付款方，记住的类型 / 分类对不上
  const ref = (w) => /^[a-z0-9]{5,}$/i.test(w) && /\d/.test(w) && /[a-z]/i.test(w);
  const clean = (x) => x.replace(/[#*]?\s*\b\d{4,}\b.*$/, "").replace(/[^\p{L}\p{N}&.,'’\- ]+/gu, " ").split(" ").filter((w) => !ref(w)).join(" ").replace(/\s+/g, " ").trim();
  return (clean(s) || clean(raw) || raw).slice(0, 60);
}
/* 银行流水描述 → 类型（按顺序，先命中的算）：券商 / 储蓄转入、贷款到账、利息、股息这类先认，免得被「转入」「interest」笼统归走 */
const GUESS = [["loan_proceeds", /loan (?:proceeds|disb|funding|deposit)|disbursement|贷款(?:到账|发放)|借款到账/i],
  ["xfer_invest", /fidelity|schwab|vanguard|robinhood|e\*?trade|brokerage|wealthfront|betterment|from (?:brokerage|invest)|券商|证券转入|投资账户转入/i],
  ["xfer_savings", /from (?:sav|savings)|savings transfer|from share|储蓄转入|定期转入/i],
  ["payroll", /payroll|direct dep|salary|paychex|\badp\b|gusto|工资|薪资/i], ["bonus", /bonus|奖金/i], ["commission", /commission|佣金|提成/i],
  ["dividends", /dividend|div pay|分红|股息/i], ["bank_interest", /interest (?:paid|payment|earned)|int(?:erest)? pd|\binterest\b|利息/i],
  ["tax_refund", /\birs\b|treas ?310|tax ref|state refund|退税/i], ["gov_benefit", /\bssa\b|social sec|unemploy|stimulus|benefit pay|补助|福利金/i],
  ["insurance", /insurance|claim|理赔/i], ["rental", /\brent\b|租金/i], ["reimburse", /reimburs|expense rep|报销/i], ["cashback", /cash ?back|reward|返现/i],
  ["wire", /wire|swift|international|电汇|汇入/i], ["zelle", /zelle|venmo|cash ?app|apple cash|paypal|转入/i]];
export const guessKind = (desc) => (GUESS.find(([, re]) => re.test(desc)) || ["other"])[0];
export const guessChannel = (desc) => (/wire|swift|电汇/i.test(desc) ? "wire" : /zelle|venmo|cash ?app|apple cash|paypal/i.test(desc) ? "zelle" : "ach");
/** 之前记住的「付款方 → 类型」（银行导入时你改过的）；和花费的归类规则分开存 */
export const incomeRules = () => meta("_income_rules", {}) || {};

/** 常用付款方（按次数），记录表单的联想列表 */
export function knownSenders() {
  const c = new Map();
  for (const r of inc().rec) { const k = skey(r.source_name), x = c.get(k) || { name: r.source_name, n: 0 }; x.n++; c.set(k, x); }
  return [...c.values()].sort((a, b) => b.n - a.n).map((x) => x.name);
}

/* ───────────── 还款（个人赠与 / 借款） ───────────── */
export const repaidOf = (recId) => inc().rep.filter((p) => p.record_id === recId).reduce((a, p) => a + p.amount, 0);
/** 需要还的收入：总额、已还、余额、状态（open / partial / overdue / paid）；不用还的返回 null */
export function repayState(r) {
  if (!r.repay_required) return null;
  // 迁移 058 起「需要还」的收入转成了个人借款：余额、已还按借贷流水算（还款也在 财务 → 借贷 里记），debt = 那笔借款
  const debt = state.debtsOk ? debtOfIncome(r.id) : null;
  if (debt) {
    const e = enrichDebt(debt), total = e.original ?? (num(r.repay_amount) || r.amount), left = e.balance ?? total, paid = Math.max(0, Math.round((total - left) * 100) / 100);
    const overdue = e.overdue && left > 0;
    return { total, paid, left, overdue, debt: debt.id, status: left <= 0.004 || isClosedStatus(debt.status) ? "paid" : overdue ? "overdue" : paid > 0 ? "partial" : "open" };
  }
  const total = num(r.repay_amount) || r.amount, paid = repaidOf(r.id), left = Math.max(0, Math.round((total - paid) * 100) / 100);
  const overdue = !!r.repay_due_on && r.repay_due_on < todayISO() && left > 0;
  return { total, paid, left, overdue, status: left <= 0.004 ? "paid" : overdue ? "overdue" : paid > 0 ? "partial" : "open" };
}
export const openRepayments = () => inc().rec.map((r) => ({ r, s: repayState(r) })).filter((x) => x.s && x.s.status !== "paid" && !x.s.debt)   // 转成借款的由借贷页提醒，这里不重复.sort((a, b) => (a.r.repay_due_on || "9999").localeCompare(b.r.repay_due_on || "9999"));

/* ───────────── 周期 ───────────── */
export const UNITS = [["biweek", "双周"], ["month", "月"], ["quarter", "季度"], ["year", "年"]];
export const biweekAnchor = () => meta("_income_cfg", {})?.anchor || "2024-01-01";   // 双周的起点（发薪日对得上就对得上；默认一个周一，可在报表里改）
const dayNum = (s) => Math.floor(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 864e5);
const fromDay = (n) => new Date(n * 864e5).toISOString().slice(0, 10);
export function bucketKey(d, unit) {
  if (unit === "year") return d.slice(0, 4);
  if (unit === "quarter") return `${d.slice(0, 4)}-Q${Math.ceil(+d.slice(5, 7) / 3)}`;
  if (unit === "month") return d.slice(0, 7);
  const a = dayNum(biweekAnchor()); return fromDay(a + Math.floor((dayNum(d) - a) / 14) * 14);
}
/** from..to（含）之间按顺序出现的周期 */
export function periodKeys(from, to, unit) {
  const out = [], seen = new Set();
  for (let n = dayNum(from); n <= dayNum(to); n++) { const k = bucketKey(fromDay(n), unit); if (!seen.has(k)) { seen.add(k); out.push(k); } }
  return out;
}
export const periodLabel = (k, unit) => (unit === "quarter" ? k.replace("-Q", " Q") : unit === "biweek" ? k.slice(2) : k);

export const RANGES = [["month", "本月"], ["3m", "近 3 个月"], ["6m", "近 6 个月"], ["12m", "近 12 个月"], ["24m", "近 24 个月"], ["ytd", "今年"], ["lastyear", "去年"], ["3y", "近 3 年"], ["5y", "近 5 年"], ["all", "全部历史"], ["custom", "自定义"]];
/** 时间窗口 → { from, to }（含）；全部历史从最早一笔收入算起 */
export function windowOf(range, c = {}) {
  const today = todayISO(), y = +today.slice(0, 4), ago = (months) => { const d = new Date(); d.setMonth(d.getMonth() - months); d.setDate(d.getDate() + 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  if (range === "month") return { from: `${today.slice(0, 7)}-01`, to: today };
  if (range === "3m") return { from: ago(3), to: today };
  if (range === "6m") return { from: ago(6), to: today };
  if (range === "ytd") return { from: `${y}-01-01`, to: today };
  if (range === "lastyear") return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
  if (range === "24m") return { from: ago(24), to: today };
  if (range === "3y") return { from: ago(36), to: today };
  if (range === "5y") return { from: ago(60), to: today };
  if (range === "all") { const first = inc().rec.map((r) => r.received_on).sort()[0]; return { from: first || ago(12), to: today }; }
  if (range === "custom" && c.from && c.to && c.from <= c.to) return { from: c.from, to: c.to };
  return { from: ago(12), to: today };
}

/* ── 概览 / 类型页的时间范围：和花费页同一套下拉——本月、近 3 / 6 / 9 / 12 个月（按自然月，含本月）、今年、往年（有收入的最早一年起，最多 12 年） ──
 * 值：m / 3 / 6 / 9 / 12 / y:2025 */
export const SPAN_MONTHS = [3, 6, 9, 12];
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const firstIncomeYear = () => { const y0 = new Date().getFullYear(), f = inc().rec.map((r) => r.received_on).sort()[0]; return f ? Math.min(y0, +f.slice(0, 4)) : y0; };
export const spanOk = (v) => v === "m" || SPAN_MONTHS.includes(+v) || (/^y:\d{4}$/.test(String(v)) && +String(v).slice(2) <= new Date().getFullYear());
export function spanWindow(v) {
  const today = todayISO(), now = new Date();
  if (v === "m") return { from: `${today.slice(0, 7)}-01`, to: today };
  if (String(v).startsWith("y:")) { const y = +String(v).slice(2); return { from: `${y}-01-01`, to: y === now.getFullYear() ? today : `${y}-12-31` }; }
  const n = SPAN_MONTHS.includes(+v) ? +v : 12; return { from: iso(new Date(now.getFullYear(), now.getMonth() - (n - 1), 1)), to: today };
}
/** 上一段同样长的时间（比上期多 / 少）：本月 → 上月同期；近 N 个月 → 再往前 N 个自然月；某一年 → 前一年同期 */
export function spanPrev(v) {
  const now = new Date(), w = spanWindow(v);
  if (v === "m") { const last = new Date(now.getFullYear(), now.getMonth(), 0); return { from: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: iso(new Date(last.getFullYear(), last.getMonth(), Math.min(now.getDate(), last.getDate()))) }; }
  if (String(v).startsWith("y:")) return { from: `${+w.from.slice(0, 4) - 1}${w.from.slice(4)}`, to: `${+w.to.slice(0, 4) - 1}${w.to.slice(4)}` };
  const n = SPAN_MONTHS.includes(+v) ? +v : 12, start = new Date(+w.from.slice(0, 4), +w.from.slice(5, 7) - 1, 1);
  return { from: iso(new Date(start.getFullYear(), start.getMonth() - n, 1)), to: iso(new Date(start.getFullYear(), start.getMonth(), 0)) };
}
export const spanLabel = (v) => (v === "m" ? t("本月") : String(v).startsWith("y:") ? (+String(v).slice(2) === new Date().getFullYear() ? t("今年") : t("{y} 年", { y: +String(v).slice(2) })) : t("近 {n} 个月", { n: +v }));
export function spanOptionsHtml(cur) {
  const y0 = new Date().getFullYear(), years = Array.from({ length: Math.max(1, Math.min(12, y0 - firstIncomeYear() + 1)) }, (_, i) => y0 - i);
  const opt = (v) => `<option value="${v}" ${String(cur) === String(v) ? "selected" : ""}>${esc(spanLabel(v))}</option>`;
  return [opt("m"), ...SPAN_MONTHS.map(opt), ...years.map((y) => opt(`y:${y}`))].join("");
}

/* ───────────── 筛选与汇总 ───────────── */
export const personOk = (r, person) => person === "all" || (person === "none" ? !r.person_id : r.person_id === person);
export const incomeIn = (from, to, person = "all") => inc().rec.filter((r) => r.received_on >= from && r.received_on <= to && personOk(r, person));
/** 到账合计（现金流入，含资本流入） */
export const sumOf = (rows) => Math.round(rows.reduce((a, r) => a + r.amount, 0) * 100) / 100;
/** 认定收入合计（规则见 js/core/income-taxonomy.js：借款、资本流入不算，填了「其中已实现收益」的只算那部分） */
export const incSumOf = (rows) => Math.round(rows.reduce((a, r) => a + recognizedOf(r), 0) * 100) / 100;
/** 分组汇总：total = 认定收入（排序按它），cash = 到账合计，cap = 资本流入（cash − total） */
export function groupSum(rows, keyFn) {
  const m = new Map();
  for (const r of rows) { const k = keyFn(r), x = m.get(k) || { key: k, n: 0, total: 0, cash: 0, first: r.received_on, last: r.received_on, rows: [] }; x.n++; x.total += recognizedOf(r); x.cash += r.amount; x.rows.push(r); if (r.received_on < x.first) x.first = r.received_on; if (r.received_on > x.last) x.last = r.received_on; m.set(k, x); }
  const r2 = (v) => Math.round(v * 100) / 100;
  return [...m.values()].map((x) => ({ ...x, total: r2(x.total), cash: r2(x.cash), cap: r2(x.cash - x.total) })).sort((a, b) => b.total - a.total || b.cash - a.cash);
}
/** 两条收入看起来是同一笔：日期差 ≤ 3 天、金额一样、付款方相近（银行导入和手动记重复时提醒） */
export function similarIncome(row, ignoreId = null) {
  const t0 = new Date(`${row.received_on}T12:00:00`).getTime(), k = skey(row.source_name);
  return inc().rec.find((r) => r.id !== ignoreId && Math.abs(r.amount - row.amount) < 0.005 && Math.abs(new Date(`${r.received_on}T12:00:00`).getTime() - t0) <= 3.5 * 864e5
    && (!k || !skey(r.source_name) || skey(r.source_name).includes(k) || k.includes(skey(r.source_name)))) || null;
}
