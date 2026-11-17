/* 账单「期」（instance）：把周期性账单按需展开成一期一行，一次性账单一张一行，统一成同一种行，供 账单概览 / 全部账单 用。
 * 纯函数、不依赖界面和全局状态（Node 测试直接引用）；设计见 docs/design-bills-overview.md §5、§13。
 *
 * 要点
 * - **不存、不预先生成**：每一期是调用时从账单规则 + 缴费记录算出来的；数据库里只有规则和真实缴费。
 *   改规则 → 没缴的期立刻按新规则；已缴的期不变；记错了 → 删缴费记录，这一期自动退回待缴（花费由 deleteBillPay 同步删）。
 * - 周期性：已有缴费记录的期（含 skipped）按记录；没缴的期从 next_due_on 起往后推（next_due_on 之前的月份不凭空造逾期）。
 *   只展开范围 [from, to] 内的期 + 逾期的期（逾期不受范围限制）；每张账单最多 MAX_PERIODS 期，逾期最多 OVERDUE_CAP 期（超出记在 meta.truncated）。
 * - 金额恒等：每行 amount = paid + balance，所以 合计 = 已缴 + 剩余。
 * - Escrow 代缴、应收（receivable）、停用且没有记录的账单：Escrow 行带 escrow:true 不计入合计；应收直接不出行。 */
import { addDays, advanceDue } from "./dates.js";

export const MAX_PERIODS = 36;       // 每张账单在一个范围里最多展开多少期
export const OVERDUE_CAP = 3;        // 每张账单最多展开多少期逾期（再多的是陈年没记录，不凭空造一串）
export const SOON_DAYS = 7;          // 「即将到期」窗口
const r2 = (n) => Math.round(n * 100) / 100;
const num = (v, d = 0) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };
const has = (v) => v != null && v !== "";

/** 医疗 / 车辆 / 项目等归属的「资产键」：筛选器按它匹配（一行可能有多个键，如 装修项目挂在某套房产上） */
export const VEHICLE_CATS = ["insurance_auto", "car_loan", "vehicle_reg", "toll", "parking"];
export function assetKeys(b, kind) {
  const keys = [];
  if (b.property_id) keys.push(`property:${b.property_id}`);
  if (b.asset_id) keys.push(`asset:${b.asset_id}`);
  if (kind === "onetime") {
    if (b.kind === "medical") keys.push("medical", ...(b.patient_id ? [`person:${b.patient_id}`] : []));
    else if (["pet", "legal", "project", "travel"].includes(b.kind)) keys.push(b.kind);
  } else if (VEHICLE_CATS.includes(b.category)) keys.push("vehicle");
  if (!keys.length) keys.push("general");
  return keys;
}

/** 从 YYYY-MM 到 YYYY-MM（含）的起止日；只给一个月就是那个月 */
export function monthBounds(m0, m1 = m0) {
  const [y, m] = m1.split("-").map(Number), last = new Date(y, m, 0).getDate();
  return { from: `${m0}-01`, to: `${m1}-${String(last).padStart(2, "0")}` };
}

/** 没缴的一期的状态（相对今天）：escrow / verify（自动扣款待核对）/ overdue / due / soon / pending */
export function unpaidStatus({ dueOn, autopay = false, escrow = false, graceDays = 0 }, today, soonDays = SOON_DAYS) {
  if (escrow) return "escrow";
  if (!dueOn) return "pending";
  const days = Math.round((new Date(`${dueOn}T12:00:00`) - new Date(`${today}T12:00:00`)) / 86400000);
  if (autopay) return days <= 3 ? "verify" : "pending";
  if (days < -num(graceDays)) return "overdue";
  if (days <= 0) return "due";
  return days <= soonDays ? "soon" : "pending";
}

/* ── 周期性：一张账单 → 若干期；返回 { rows, truncated } ── */
function recurringRows(b, { from, to, today }) {
  if (b.direction === "receivable") return { rows: [], truncated: 0 };   // 应收（房东租金）不是支出
  const rows = [], cur = b.currency || null, escrow = b.pay_channel === "escrow";
  const mk = (extra) => ({ kind: "recurring", billId: b.id, key: `r:${b.id}:${extra.dueOn || extra.paymentId}`, name: b.name, category: b.category, payee: b.payee || "", property_id: b.property_id || null, asset_id: b.asset_id || null,
    currency: cur, autopay: !!b.autopay, escrow, assets: assetKeys(b, "recurring"), ...extra });
  const inRange = (d) => !!d && d >= from && d <= to;
  const taken = new Set();   // 已被缴费记录占用的到期日（含 skipped）

  for (const p of b.pays || []) {
    const dueOn = p.due_on || p.paid_on || null;
    if (dueOn) taken.add(dueOn);
    if (!inRange(dueOn)) continue;
    if (p.status === "skipped") { rows.push(mk({ paymentId: p.id, dueOn, status: "skipped", amount: 0, paid: 0, balance: 0, counted: false, payment: p })); continue; }
    const paid = r2(num(p.amount) + num(p.late_fee));
    rows.push(mk({ paymentId: p.id, dueOn, paidOn: p.paid_on || null, status: "paid", amount: paid, paid, balance: 0, counted: !escrow, payment: p, lateFee: num(p.late_fee) }));
  }

  // 没缴的期：从 next_due_on 起往后推（它之前的月份不凭空造逾期）。停用 / 已结束的账单不再有新的期
  let truncated = 0;
  if (b.active && !b.ended && b.next_due_on) {
    const est = has(b.est) ? num(b.est) : null, isEst = !(b.amount_type === "fixed" && has(b.typical_amount));
    const late = [], future = [];
    let d = b.next_due_on, guard = 0;
    while (d && d <= to && guard++ < 400) {
      if (b.ends_on && d > b.ends_on) break;
      if (!taken.has(d)) {
        const status = unpaidStatus({ dueOn: d, autopay: b.autopay, escrow, graceDays: b.grace_days }, today);
        const row = mk({ dueOn: d, status, amount: est ?? 0, paid: 0, balance: est ?? 0, amountIsEst: isEst, amountUnknown: est == null, counted: !escrow });
        if (status === "overdue" || (b.autopay && d < today && !escrow)) late.push(row);   // 逾期 / 自动扣款过了日子还没核对：不受范围限制
        else if (inRange(d)) future.push(row);
      }
      d = advanceDue(b, d);
    }
    // 陈年没记录的不凭空造一串：只留最近的 OVERDUE_CAP 期，其余记入 truncated
    if (late.length > OVERDUE_CAP) { truncated += late.length - OVERDUE_CAP; late.splice(0, late.length - OVERDUE_CAP); }
    if (future.length > MAX_PERIODS) { truncated += future.length - MAX_PERIODS; future.length = MAX_PERIODS; }
    rows.push(...late, ...future);
  }
  return { rows, truncated };
}

/* ── 一次性：一张账单 → 一行 ── */
const ONETIME_DONE = ["paid", "written_off"];
function onetimeRow(b, { from, to, today }) {
  const hasDue = !!b.due_on, dueOn = b.due_on || b.bill_date || b.service_date || null;
  const owed = b.owed == null ? null : num(b.owed), paid = r2(num(b.paid)), balance = owed == null ? 0 : Math.max(0, r2(owed - paid));
  let status = b.status;                       // paid / partial / disputed / collections / written_off / awaiting_insurance
  if (b.open && ["open", "partial"].includes(status)) {
    const s = hasDue ? unpaidStatus({ dueOn }, today) : "pending";
    status = s === "pending" ? (status === "partial" ? "partial" : "pending") : s;   // 逾期 / 今天 / 即将 优先于「部分已付」；到期还远的保留「部分已付」
  } else if (status === "open") status = "pending";
  const overdueNow = status === "overdue";
  if (!(dueOn && dueOn >= from && dueOn <= to) && !overdueNow) return null;
  const counted = status !== "written_off";
  return { kind: "onetime", billId: b.id, key: `o:${b.id}`, name: b.provider || "", who: b.patient || "", category: b.kind, subkind: b.subkind || null, payee: b.provider || "", property_id: b.property_id || null, asset_id: b.asset_id || null,
    currency: b.currency || null, autopay: false, escrow: false, assets: assetKeys(b, "onetime"), dueOn, hasDue, status, amount: owed == null ? paid : r2(paid + balance), paid, balance, amountUnknown: owed == null, amountIsEst: false, counted,
    isPrivate: b.visibility === "private", bill: b };
}

/**
 * 展开成行。recurring = enrichBills 的结果（要有 pays / est / ended）；onetime = enrichMedical 的结果。
 * opts：{ from, to, today, canSee(b) }；canSee 在**数据这一步**滤掉没权限看的私密账单（合计不泄露）。
 * 返回 { rows, truncated }：truncated = 被封顶没展开的期数（界面可以提示「还有 N 期没显示」）。
 */
export function billInstances({ recurring = [], onetime = [] } = {}, { from, to, today, canSee = () => true } = {}) {
  const rows = []; let truncated = 0;
  for (const b of recurring) { const r = recurringRows(b, { from, to, today }); rows.push(...r.rows); truncated += r.truncated; }
  for (const b of onetime) { if (!canSee(b)) continue; const r = onetimeRow(b, { from, to, today }); if (r) rows.push(r); }
  return { rows, truncated };
}

/** 默认顺序：没缴的按到期日从早到晚（逾期自然在最前），已缴 / 跳过的放最后按到期日新→旧 */
export const DONE_STATUS = ["paid", "skipped", "written_off"];
export function sortByDue(rows) {
  const done = (r) => (DONE_STATUS.includes(r.status) ? 1 : 0);
  return [...rows].sort((a, b) => done(a) - done(b) || (done(a) ? (b.dueOn || "").localeCompare(a.dueOn || "") : (a.dueOn || "9999").localeCompare(b.dueOn || "9999")) || String(a.name).localeCompare(String(b.name)));
}

/**
 * 六张卡的口径（设计 §5）。rows 是 billInstances 的结果；cur = 当前币种（只汇总这一种）。
 * 恒等式：total.amount = paid.amount + remaining.amount（每行 amount = paid + balance）。
 * 已缴金额含「部分已付」里已付的部分；已缴笔数只数已结清的，部分已付单列。
 */
export function summarize(rows, { cur, today, soonDays = SOON_DAYS } = {}) {
  const S = { total: { n: 0, amount: 0 }, paid: { n: 0, amount: 0 }, partial: { n: 0 }, overdue: { n: 0, amount: 0 }, soon: { n: 0, amount: 0 }, remaining: { n: 0, amount: 0 },
    escrow: { n: 0, amount: 0 }, otherCurrency: 0, estimatedN: 0, unknownN: 0, skippedN: 0 };
  for (const r of rows) {
    if (r.status === "skipped") { S.skippedN++; continue; }
    if (r.escrow) { S.escrow.n++; S.escrow.amount = r2(S.escrow.amount + r.amount); continue; }
    if (r.counted === false) continue;
    if (cur && (r.currency || cur) !== cur) { S.otherCurrency++; continue; }
    S.total.n++; S.total.amount = r2(S.total.amount + r.amount);
    S.paid.amount = r2(S.paid.amount + r.paid);
    if (r.status === "paid") S.paid.n++;
    else {
      if (r.status === "partial" || (r.paid > 0 && r.balance > 0)) S.partial.n++;
      S.remaining.n++; S.remaining.amount = r2(S.remaining.amount + r.balance);
      if (r.amountIsEst) S.estimatedN++;
      if (r.amountUnknown) S.unknownN++;
      if (r.status === "overdue") { S.overdue.n++; S.overdue.amount = r2(S.overdue.amount + r.balance); }
      if (["due", "soon"].includes(r.status) && r.dueOn && r.dueOn <= addDays(today, soonDays)) { S.soon.n++; S.soon.amount = r2(S.soon.amount + r.balance); }
    }
  }
  return S;
}

/** 下一笔：今天起（含）最近一笔没缴的（不限范围，调用时传一段够长的行）；没有就 null */
export function nextDue(rows, { today, cur } = {}) {
  const open = rows.filter((r) => !DONE_STATUS.includes(r.status) && !r.escrow && r.counted !== false && r.dueOn && r.dueOn >= today && (!cur || (r.currency || cur) === cur));
  return open.length ? sortByDue(open)[0] : null;
}

/* ── 「全部账单」页的时间范围、筛选、排序（纯函数，页面和测试共用）── */
/** 账单页自己的时间选项（含未来：下月 / 未来 30 天；不动花费 / 收入共用的 time-range.js） */
export const BILL_RANGES = [["m", "本月"], ["pm", "上月"], ["nm", "下月"], ["30d", "未来 30 天"], ["3", "近 3 个月"], ["y", "今年"], ["all", "全部"]];
export const rangeOk = (v) => BILL_RANGES.some(([k]) => k === v) || /^\d{4}-(0[1-9]|1[0-2])$/.test(String(v));   // 也认某一个月（YYYY-MM，概览走势图的柱子链进来）
const ymOf = (iso) => iso.slice(0, 7);
const shiftMonth = (m, k) => { const d = new Date(+m.slice(0, 4), +m.slice(5, 7) - 1 + k, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
/** 范围 → { from, to }（含两端的日期）；today = 今天（YYYY-MM-DD） */
export function rangeBounds(range, today) {
  const m = ymOf(today);
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(String(range))) return monthBounds(range);
  switch (range) {
    case "pm": return monthBounds(shiftMonth(m, -1));
    case "nm": return monthBounds(shiftMonth(m, 1));
    case "30d": return { from: today, to: addDays(today, 30) };
    case "3": return monthBounds(shiftMonth(m, -2), m);
    case "y": return { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` };
    case "all": return { from: "2000-01-01", to: addDays(today, 365) };
    default: return monthBounds(m);
  }
}
/** 状态筛选的分组（页面的「状态」下拉和卡片链接共用同一份口径） */
export const STATUS_GROUPS = {
  unpaid: (r) => !DONE_STATUS.includes(r.status) && !r.escrow,
  overdue: (r) => r.status === "overdue",
  soon: (r) => r.status === "due" || r.status === "soon",
  pending: (r) => r.status === "pending",
  verify: (r) => r.status === "verify",
  partial: (r) => r.status === "partial",
  paid: (r) => r.status === "paid",
  other: (r) => ["awaiting_insurance", "disputed", "collections"].includes(r.status),
};
const PAY_MODES = { auto: (r) => r.autopay, manual: (r) => r.kind === "recurring" && !r.autopay && !r.escrow, escrow: (r) => r.escrow };
/** 行的分类键：周期性 r:<分类>，一次性 o:<种类>（两边都有叫 pet 的，所以带前缀） */
export const catKey = (r) => `${r.kind === "onetime" ? "o" : "r"}:${r.category}`;
/** f = { q, asset, type, cat, status, pay }，"all" / 空 = 不限 */
export function filterRows(rows, f = {}) {
  const q = String(f.q || "").trim().toLowerCase();
  return rows.filter((r) => (!q || `${r.name} ${r.payee} ${r.who || ""}`.toLowerCase().includes(q))
    && (!f.asset || f.asset === "all" || r.assets.includes(f.asset))
    && (!f.type || f.type === "all" || r.kind === f.type)
    && (!f.cat || f.cat === "all" || catKey(r) === f.cat)
    && (!f.status || f.status === "all" || (STATUS_GROUPS[f.status] || (() => true))(r))
    && (!f.pay || f.pay === "all" || (PAY_MODES[f.pay] || (() => true))(r)));
}
/** 排序：due（默认，没缴的到期近的在前）/ amount（高 → 低）/ name */
export function sortRows(rows, mode = "due") {
  if (mode === "amount") return [...rows].sort((a, b) => b.amount - a.amount || String(a.name).localeCompare(String(b.name)));
  if (mode === "name") return [...rows].sort((a, b) => String(a.name).localeCompare(String(b.name)) || (a.dueOn || "").localeCompare(b.dueOn || ""));
  return sortByDue(rows);
}

/* ── 账单概览（dashboard）用：按资产汇总、按月走势 ── */
/** 按「主资产」汇总：每行取它的第一个资产键（房产 > 具体资产 > 医疗 / 项目 > 车辆 > 通用，见 assetKeys）；返回 [{ key, n, total, paid, remaining }]，应付大的在前。
 *  只算计入合计的行（和六张卡同一口径：不含 Escrow、跳过、非当前币种）。 */
export function assetBreakdown(rows, { cur } = {}) {
  const m = new Map();
  for (const r of rows) {
    if (r.status === "skipped" || r.escrow || r.counted === false || (cur && (r.currency || cur) !== cur)) continue;
    const key = r.assets[0] || "general", g = m.get(key) || { key, n: 0, total: 0, paid: 0, remaining: 0 };
    g.n++; g.total = r2(g.total + r.amount); g.paid = r2(g.paid + r.paid); g.remaining = r2(g.remaining + r.balance); m.set(key, g);
  }
  return [...m.values()].sort((a, b) => b.total - a.total || a.key.localeCompare(b.key));
}
/** 按月走势：months = ["2026-06", …]；每月 { m, due（应付）, paid（已付）, n }。只算计入合计的行，按到期月归。 */
export function monthlySeries(rows, months, { cur } = {}) {
  const out = months.map((m) => ({ m, due: 0, paid: 0, n: 0 })), at = new Map(out.map((o) => [o.m, o]));
  for (const r of rows) {
    if (r.status === "skipped" || r.escrow || r.counted === false || !r.dueOn || (cur && (r.currency || cur) !== cur)) continue;
    const o = at.get(r.dueOn.slice(0, 7)); if (!o) continue;
    o.n++; o.due = r2(o.due + r.amount); o.paid = r2(o.paid + r.paid);
  }
  return out;
}
/** 走势图要看的月份：前 back 个月到后 fwd 个月（含本月） */
export function seriesMonths(today, back = 5, fwd = 2) {
  const m = today.slice(0, 7), out = [];
  for (let k = -back; k <= fwd; k++) out.push(shiftMonth(m, k));
  return out;
}
