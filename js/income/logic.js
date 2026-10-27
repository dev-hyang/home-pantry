/* 收入（进账）：类型、查看权限、还款余额、周期分桶。纯逻辑，不画界面。
 * 收入存在 income_records（迁移 042），不和花费（purchases）混在一起：purchases 里的负数已经表示退款 / 报销，全家成员都读得到。
 * 一笔入账只会进其中一张表：商家退款 = 负花费（留在花费里），工资 / 电汇 / 个人转入 = 收入；自己账户之间的转账两边都不算。 */
import { state } from "../core/state.js";
import { Store } from "../core/store.js";
import { meta } from "../bills/budget.js";
import { num, todayISO } from "../core/util.js";

/* ───────────── 收入类型（内置 + 自定义） ───────────── */
// [id, 名称, 图标, 颜色]
export const KINDS = [["payroll", "工资", "💼", "#2c6a57"], ["bonus", "奖金 / 年终", "🎁", "#3f8f5a"], ["package", "薪酬福利包", "📦", "#5a9a7a"], ["wire", "国际电汇", "🌐", "#3b7fc4"],
  ["zelle", "Zelle / Venmo 转入", "👥", "#7563c0"], ["interest", "利息 / 分红", "🏦", "#b07a1a"], ["rental", "租金收入", "🏠", "#a0522d"], ["tax_refund", "退税", "🧾", "#6b7280"],
  ["reimburse", "报销", "💵", "#d4694c"], ["insurance", "保险理赔", "🛡️", "#c75a85"], ["gift", "个人赠与", "🎀", "#c0603a"], ["sale", "出售所得", "🏷️", "#8a5fb0"],
  ["cashback", "返现 / 奖励", "💳", "#3f6c8f"], ["other", "其他", "📥", "#8a948f"]];
const CUSTOM_COLORS = ["#2f8f9d", "#9a6b3c", "#b0527a", "#6a8f2f", "#4f5fc0", "#c08a1a"];
export const customKinds = () => (meta("_income_kinds", []) || []).filter((k) => k && /^c_[a-z0-9]{1,20}$/.test(k.id));
export const kindList = () => [...KINDS.map(([id, name, icon, color]) => ({ id, name, icon, color, custom: false })), ...customKinds().map((k, i) => ({ id: k.id, name: k.name, icon: k.icon || "🏷️", color: CUSTOM_COLORS[i % CUSTOM_COLORS.length], custom: true }))];
export const kindOf = (id) => kindList().find((k) => k.id === id) || { id, name: id || "其他", icon: "📥", color: "#8a948f", custom: false };
export const CHANNELS = [["ach", "银行转账 / ACH"], ["wire", "电汇"], ["zelle", "Zelle / Venmo"], ["check", "支票"], ["cash", "现金"], ["other", "其他"]];

/* ───────────── 状态与权限 ───────────── */
export const inc = () => (state.inc ||= { rec: [], rep: [], acc: [], loaded: false, ok: true, err: "", form: null, open: null, q: "", kind: "all", person: "all", year: "all", limit: 40, tab: {}, ai: {}, renameKey: null, repayFor: null });
export const isOwnerNow = () => Store.mode === "demo" || state.members.some((m) => m.user_id === state.user?.id && m.role === "owner");
export const myAccess = () => inc().acc.find((a) => a.user_id === state.user?.id) || null;
/** 能不能看全家的收入：家主，或家主已允许。其余人数据库只给他们自己记的那几条 */
export const canSeeAll = () => isOwnerNow() || myAccess()?.status === "granted";
export const myPersonId = () => state.people.find((p) => p.member_user_id === state.user?.id)?.id || null;
export const adults = () => state.people.filter((p) => (p.kind || "adult") === "adult");
export const personName = (id) => state.people.find((p) => p.id === id)?.name || "";
export const memberLabel = (userId) => state.members.find((m) => m.user_id === userId)?.display_name || "";

/** 读收入、还款、权限；表还没建（迁移 042 没执行）时记下错误，界面提示 */
export async function loadIncome() {
  const I = inc();
  try {
    const [rec, rep, acc] = await Promise.all([Store.listIncomeRecords(), Store.listIncomeRepayments(), Store.listIncomeAccess().catch(() => [])]);
    I.rec = rec.map((r) => ({ ...r, amount: num(r.amount) })); I.rep = rep.map((p) => ({ ...p, amount: num(p.amount) })); I.acc = acc; I.ok = true; I.err = "";
  } catch (e) { I.ok = false; I.err = e.message || String(e); }
  I.loaded = true;
}

/* ───────────── 付款方 ───────────── */
export const skey = (s) => String(s ?? "").trim().replace(/\s+/g, " ").toLowerCase();
/** 银行流水描述里认出付款方：「Zelle payment from JOHN SMITH 123」→ JOHN SMITH；「ACME CORP DIRECT DEP」→ ACME CORP */
export function senderName(desc) {
  const raw = String(desc || "").replace(/\s+/g, " ").trim();
  let s = raw; const m = s.match(/\b(?:from|frm)\s+(.+)$/i); if (m) s = m[1];
  s = s.replace(/\b(?:direct dep(?:osit)?|payroll|ppd|ccd|web|ach|ref|conf(?:irmation)?|transaction|trn|indn|co\.? id|orig(?:inator)?|id)\b.*$/i, "");
  const clean = (x) => x.replace(/[#*]?\s*\b\d{4,}\b.*$/, "").replace(/[^\p{L}\p{N}&.,'’\- ]+/gu, " ").replace(/\s+/g, " ").trim();
  return (clean(s) || clean(raw) || raw).slice(0, 60);
}
const GUESS = [["payroll", /payroll|direct dep|salary|paychex|\badp\b|gusto|工资|薪资/i], ["bonus", /bonus|奖金/i], ["wire", /wire|swift|international|电汇|汇入/i],
  ["zelle", /zelle|venmo|cash ?app|apple cash|paypal|转入/i], ["interest", /interest|dividend|利息|分红/i], ["tax_refund", /\birs\b|treas ?310|tax ref|退税/i],
  ["insurance", /insurance|claim|理赔/i], ["rental", /\brent\b|租金/i], ["reimburse", /reimburs|expense|报销/i]];
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
  const total = num(r.repay_amount) || r.amount, paid = repaidOf(r.id), left = Math.max(0, Math.round((total - paid) * 100) / 100);
  const overdue = !!r.repay_due_on && r.repay_due_on < todayISO() && left > 0;
  return { total, paid, left, overdue, status: left <= 0.004 ? "paid" : overdue ? "overdue" : paid > 0 ? "partial" : "open" };
}
export const openRepayments = () => inc().rec.map((r) => ({ r, s: repayState(r) })).filter((x) => x.s && x.s.status !== "paid").sort((a, b) => (a.r.repay_due_on || "9999").localeCompare(b.r.repay_due_on || "9999"));

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

export const RANGES = [["12m", "近 12 个月"], ["24m", "近 24 个月"], ["ytd", "今年"], ["lastyear", "去年"], ["3y", "近 3 年"], ["5y", "近 5 年"], ["all", "全部历史"], ["custom", "自定义"]];
/** 时间窗口 → { from, to }（含）；全部历史从最早一笔收入算起 */
export function windowOf(range, c = {}) {
  const today = todayISO(), y = +today.slice(0, 4), ago = (months) => { const d = new Date(); d.setMonth(d.getMonth() - months); d.setDate(d.getDate() + 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  if (range === "ytd") return { from: `${y}-01-01`, to: today };
  if (range === "lastyear") return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
  if (range === "24m") return { from: ago(24), to: today };
  if (range === "3y") return { from: ago(36), to: today };
  if (range === "5y") return { from: ago(60), to: today };
  if (range === "all") { const first = inc().rec.map((r) => r.received_on).sort()[0]; return { from: first || ago(12), to: today }; }
  if (range === "custom" && c.from && c.to && c.from <= c.to) return { from: c.from, to: c.to };
  return { from: ago(12), to: today };
}

/* ───────────── 筛选与汇总 ───────────── */
export const personOk = (r, person) => person === "all" || (person === "none" ? !r.person_id : r.person_id === person);
export const incomeIn = (from, to, person = "all") => inc().rec.filter((r) => r.received_on >= from && r.received_on <= to && personOk(r, person));
export const sumOf = (rows) => Math.round(rows.reduce((a, r) => a + r.amount, 0) * 100) / 100;
export function groupSum(rows, keyFn) {
  const m = new Map();
  for (const r of rows) { const k = keyFn(r), x = m.get(k) || { key: k, n: 0, total: 0, first: r.received_on, last: r.received_on, rows: [] }; x.n++; x.total += r.amount; x.rows.push(r); if (r.received_on < x.first) x.first = r.received_on; if (r.received_on > x.last) x.last = r.received_on; m.set(k, x); }
  return [...m.values()].map((x) => ({ ...x, total: Math.round(x.total * 100) / 100 })).sort((a, b) => b.total - a.total);
}
/** 两条收入看起来是同一笔：日期差 ≤ 3 天、金额一样、付款方相近（银行导入和手动记重复时提醒） */
export function similarIncome(row, ignoreId = null) {
  const t0 = new Date(`${row.received_on}T12:00:00`).getTime(), k = skey(row.source_name);
  return inc().rec.find((r) => r.id !== ignoreId && Math.abs(r.amount - row.amount) < 0.005 && Math.abs(new Date(`${r.received_on}T12:00:00`).getTime() - t0) <= 3.5 * 864e5
    && (!k || !skey(r.source_name) || skey(r.source_name).includes(k) || k.includes(skey(r.source_name)))) || null;
}
