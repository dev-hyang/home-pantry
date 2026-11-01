/* 贷款摊还（财务 P2）：固定利率等额本息的还款计划、一笔还款拆成 本金 / 利息 / Escrow / 滞纳金、按历史还款逐笔拆分、未还本金。
 * 纯函数，不碰 DOM / state，node 里能直接 import 测试（日期都是 'YYYY-MM-DD' 字符串，按本地正午算，不受时区影响）。
 * 金额一律四舍五入到分；每期利息 = 期初本金 × 期利率（年利率 ÷ 每年期数），常见的房贷 / 车贷都是这么算的（按日计息的以对账单为准，可手动改）。 */

export const PERIODS_PER_YEAR = { weekly: 52, biweekly: 26, semimonthly: 24, monthly: 12, quarterly: 4, semiannual: 2, annual: 1 };
const DAY = 86400000;
export const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (iso) => new Date(`${iso}T12:00:00`);

/** 期利率（小数）：年利率 % ÷ 每年期数；不定期（none）按每月 */
export const periodRate = (annualPct, freq = "monthly") => (Number(annualPct) || 0) / 100 / (PERIODS_PER_YEAR[freq] || 12);
/** 期限（月）→ 期数 */
export const periodsOf = (termMonths, freq = "monthly") => (termMonths ? Math.round((Number(termMonths) * (PERIODS_PER_YEAR[freq] || 12)) / 12) : null);

/** 等额本息每期还款（本金 + 利息）；利率 0 = 本金平均分；缺数返回 null */
export function payment(principal, annualPct, n, freq = "monthly") {
  const P = Number(principal), N = Number(n);
  if (!(P > 0) || !(N > 0)) return null;
  const r = periodRate(annualPct, freq);
  return r2(r === 0 ? P / N : (P * r) / (1 - (1 + r) ** -N));
}

/** 第 k 期的日期：从 start 往后 k 个周期（月份按 start 的日子，月末截断） */
export function addPeriods(start, freq, k) {
  if (!start) return null;
  const d = parse(start);
  if (freq === "weekly") return ymd(new Date(d.getTime() + 7 * k * DAY));
  if (freq === "biweekly") return ymd(new Date(d.getTime() + 14 * k * DAY));
  if (freq === "semimonthly") { const m = Math.floor(k / 2), half = k % 2; const base = addPeriods(start, "monthly", m); return half ? ymd(new Date(parse(base).getTime() + 15 * DAY)) : base; }
  const months = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 }[freq] || 1;
  const day = d.getDate(), first = new Date(d.getFullYear(), d.getMonth() + months * k, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return ymd(new Date(first.getFullYear(), first.getMonth(), Math.min(day, last)));
}

/** 还款计划：从本金 / 年利率 / 期数（或每期还款）/ 起始日算每一期：[{ n, date, payment, interest, principal, balance }]
 *  start = 放款日（第 1 期是 start 往后一个周期）；只给了每期还款没给期数的，算到还清为止（最多 maxRows 期） */
export function schedule({ principal, annualRate, periods = null, pay = null, start, freq = "monthly", maxRows = 1200 }) {
  let bal = r2(principal);
  if (!(bal > 0)) return [];
  const r = periodRate(annualRate, freq);
  const pmt = pay != null && Number(pay) > 0 ? r2(pay) : payment(bal, annualRate, periods, freq);
  if (!(pmt > 0)) return [];
  if (r > 0 && pmt <= r2(bal * r)) return [];   // 每期还款不够付利息：永远还不完，不画计划
  const out = [];
  for (let n = 1; bal > 0.004 && n <= maxRows; n++) {
    const interest = r2(bal * r);
    let principalPart = r2(pmt - interest);
    if (principalPart > bal || (periods && n === Number(periods))) principalPart = bal;   // 最后一期把零头还清
    bal = r2(bal - principalPart);
    out.push({ n, date: addPeriods(start, freq, n), payment: r2(principalPart + interest), interest, principal: principalPart, balance: bal });
  }
  return out;
}

/** 一笔还款的拆分：期初本金 balance、期利率 rate、实付 paid（不含滞纳金）、其中 Escrow escrow、滞纳金 fee。
 *  先扣 Escrow，剩下的先付利息、再还本金；不够付利息时只算利息（本金 0）。返回 { interest, principal, escrow, fee, balance（还款后） } */
export function splitPayment({ balance, rate, paid, escrow = 0, fee = 0 }) {
  const b = Math.max(0, r2(balance)), esc = Math.min(Math.max(0, r2(escrow)), Math.max(0, r2(paid)));
  const pi = Math.max(0, r2(paid - esc));
  const interest = Math.min(pi, r2(b * rate));
  const principal = r2(pi - interest);   // 还清后多付的也算本金（是要退回的钱，不是消费）；余额不低于 0
  return { interest: r2(interest), principal, escrow: esc, fee: r2(fee), balance: r2(Math.max(0, b - principal)) };
}

/** Escrow 部分：有 Escrow 代缴账单的房贷，实付 − 本息 = Escrow（上限 cap，防止把多还的本金算成 Escrow）；其余 0 */
export function escrowPortion({ paid, pi, hasEscrow, cap = null }) {
  if (!hasEscrow || !(pi > 0)) return 0;
  const e = Math.max(0, r2(paid - pi));
  return cap != null && cap > 0 ? Math.min(e, r2(cap)) : e;
}

/** 借贷流水对余额的影响（正 = 增加未还本金） */
export function balanceEffect(x) {
  const p = Number(x.principal_amount) || 0;
  switch (x.type) {
    case "disbursement": return p;
    case "principal_repayment": case "write_off": return -p;
    case "adjustment": return p;   // 带符号
    default: return 0;
  }
}

/** 余额的起点：opening（中途开始记：某天之后的流水才算）或 original（有放款流水时以放款为准，原始本金只在没有放款记录时用）
 *  返回 { base, after }：after = 只算这一天之后的流水（opening），null = 全部流水都算 */
export function balanceAnchor(debt, txns) {
  if (debt.opening_balance != null && debt.opening_balance_on) return { base: Number(debt.opening_balance), after: debt.opening_balance_on };
  const hasDisb = txns.some((x) => x.type === "disbursement");
  if (hasDisb) return { base: 0, after: null };
  if (debt.original_principal != null) return { base: Number(debt.original_principal), after: null };
  return null;
}

/** 未还本金（截至 asOf，含这一天；空 = 全部）：起点 ± 之后的流水；起点不知道（没填本金、没放款记录）返回 null */
export function outstanding(debt, txns, asOf = null) {
  const list = txns.filter((x) => x.debt_id === debt.id && (!asOf || x.txn_date <= asOf));
  const a = balanceAnchor(debt, list); if (!a) return null;
  let bal = a.base;
  for (const x of list) if (!a.after || x.txn_date > a.after) bal += balanceEffect(x);
  return r2(Math.max(0, bal));
}

/** 已还本金合计、已付利息合计（统计用） */
export function paidTotals(debt, txns) {
  let principal = 0, interest = 0, escrow = 0, fee = 0;
  for (const x of txns) {
    if (x.debt_id !== debt.id) continue;
    if (x.type === "principal_repayment") principal += Number(x.principal_amount) || 0;
    interest += Number(x.interest_amount) || 0; escrow += Number(x.escrow_amount) || 0; fee += Number(x.fee_amount) || 0;
  }
  return { principal: r2(principal), interest: r2(interest), escrow: r2(escrow), fee: r2(fee) };
}

/** 按历史还款逐笔拆分（重新拆分 / 回填）：
 *  debt：贷款（interest_rate、payment_frequency、opening_balance / opening_balance_on 或 original_principal / start_date）
 *  payments：账单缴费 [{ id, paid_on, amount, late_fee }]（顺序不限）
 *  others：这笔贷款不挂缴费的流水（额外还本、放款、调整、核销），按日期参与余额
 *  manual：Map(缴费 id → { principal, interest, escrow, fee })：手动改过的，原样用
 *  escrowOf(payment, pi)：这一期的 Escrow（没有 = 0）；pi = 每期本息
 *  返回 Map(缴费 id → { interest, principal, escrow, fee, balance, source })；利率或本金起点不知道时返回空 Map（不拆） */
export function splitHistory({ debt, payments, others = [], manual = new Map(), escrowOf = () => 0, pi = null }) {
  const out = new Map();
  if (debt.interest_rate == null) return out;
  const rate = periodRate(debt.interest_rate, debt.payment_frequency === "none" ? "monthly" : debt.payment_frequency);
  const pays = payments.filter((p) => p.paid_on && Number(p.amount) > 0).slice().sort((a, b) => a.paid_on.localeCompare(b.paid_on) || String(a.id).localeCompare(String(b.id)));
  const extra = others.filter((x) => !x.bill_payment_id);
  const anchor = balanceAnchor(debt, extra); if (!anchor) return out;
  const opening = !!anchor.after, start = opening ? anchor.after : debt.start_date || null;
  const one = (p, b) => {
    const m = manual.get(p.id);
    if (m) return { interest: r2(m.interest), principal: r2(m.principal), escrow: r2(m.escrow), fee: r2(m.fee ?? p.late_fee), balance: r2(Math.max(0, b - r2(m.principal))), source: "manual" };
    return { ...splitPayment({ balance: b, rate, paid: r2(p.amount), escrow: escrowOf(p, pi), fee: r2(p.late_fee) }), source: "schedule" };
  };
  // 往后：opening 起点 = 那天之后的还款和流水；original 起点 = 起始日当天及以后（没填起始日 = 全部）
  const after = (d) => (opening ? d > start : !start || d >= start);
  const evts = [...pays.filter((p) => after(p.paid_on)).map((p) => ({ d: p.paid_on, k: 1, p })), ...extra.filter((x) => !opening || x.txn_date > start).map((x) => ({ d: x.txn_date, k: 0, x }))]
    .sort((a, b) => a.d.localeCompare(b.d) || a.k - b.k);   // 同一天：先放款 / 调整，再还款
  let b = anchor.base;
  for (const e of evts) {
    if (e.x) { b = r2(Math.max(0, b + balanceEffect(e.x))); continue; }
    const s = one(e.p, b); out.set(e.p.id, s); b = s.balance;
  }
  // 往前（只有 opening 起点）：起点当天及以前的还款已经反映在起点余额里，倒推：期初 = (期末 + 本息) ÷ (1 + 期利率)
  if (opening) {
    let bal = anchor.base;
    for (const p of pays.filter((x) => x.paid_on <= start).reverse()) {
      const m = manual.get(p.id);
      if (m) { out.set(p.id, { interest: r2(m.interest), principal: r2(m.principal), escrow: r2(m.escrow), fee: r2(m.fee ?? p.late_fee), balance: bal, source: "manual" }); bal = r2(bal + r2(m.principal)); continue; }
      const paid = r2(p.amount), esc = Math.min(paid, escrowOf(p, pi)), piPaid = r2(paid - esc);
      const before = r2((bal + piPaid) / (1 + rate)), interest = Math.min(piPaid, r2(before * rate));
      out.set(p.id, { interest, principal: r2(piPaid - interest), escrow: r2(esc), fee: r2(p.late_fee), balance: bal, source: "schedule" });
      bal = before;
    }
  }
  return out;
}

/** 剩余期数：余额、期利率、每期本息（还不完返回 null） */
export function remainingPeriods(balance, rate, pi) {
  const b = Number(balance), p = Number(pi);
  if (!(b > 0)) return 0;
  if (!(p > 0)) return null;
  if (rate === 0) return Math.ceil(b / p);
  if (p <= b * rate) return null;
  const pp = p + 0.005;   // 每期还款四舍五入到分：容半分钱，不然 30 年的房贷会多出一期零头
  return Math.ceil(-Math.log(1 - (b * rate) / pp) / Math.log(1 + rate));
}
