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

/* ───────────── 精确到分 ───────────── */
const cents = (v) => Math.round((Number(v) || 0) * 100);
const dayNum = (iso) => Math.round(parse(iso).getTime() / DAY);
/** 贷款的还款频率（不定期 none 按每月） */
export const freqOfDebt = (d) => (d?.payment_frequency && d.payment_frequency !== "none" ? d.payment_frequency : "monthly");

/** 一期利息（分）：余额（分）× 年利率 ÷ 每年期数，四舍五入到分（半分进位）。
 *  用整数算（年利率最多 4 位小数：利息 = 余额 × R ÷ (10⁶ × 每年期数)，R = 年利率 × 10⁴），不受浮点误差影响，和银行对账单逐分一致 */
export function interestCents(balCents, annualPct, freq = "monthly") {
  const R = Math.round((Number(annualPct) || 0) * 10000), b = Math.round(Number(balCents) || 0);
  if (!(R > 0) || !(b > 0)) return 0;
  const num = BigInt(b) * BigInt(R), den = 1000000n * BigInt(PERIODS_PER_YEAR[freq] || 12);
  return Number(num / den + (2n * (num % den) >= den ? 1n : 0n));
}

/** 还款计划：从本金 / 年利率 / 期数（或每期还款）算每一期：[{ n, date, payment, interest, principal, balance }]
 *  first = 第一期还款日（第 n 期 = first 往后 n−1 个周期）；没有就用 start = 放款日（第 1 期 = start 往后一个周期）。
 *  余额按分记，每期利息四舍五入到分；只给了每期还款没给期数的，算到还清为止（最多 maxRows 期） */
export function schedule({ principal, annualRate, periods = null, pay = null, start = null, first = null, freq = "monthly", maxRows = 1200 }) {
  let bal = cents(principal);
  if (!(bal > 0)) return [];
  const pmt = cents(pay != null && Number(pay) > 0 ? pay : payment(principal, annualRate, periods, freq));
  if (!(pmt > 0) || pmt <= interestCents(bal, annualRate, freq)) return [];   // 每期还款不够付利息：永远还不完，不画计划
  const out = [];
  for (let n = 1; bal > 0 && n <= maxRows; n++) {
    const i = interestCents(bal, annualRate, freq);
    let p = pmt - i;
    if (p > bal || (periods && n === Number(periods))) p = bal;   // 最后一期把零头还清
    bal -= p;
    out.push({ n, date: first ? addPeriods(first, freq, n - 1) : addPeriods(start, freq, n), payment: (p + i) / 100, interest: i / 100, principal: p / 100, balance: bal / 100 });
  }
  return out;
}

/** 第一期还款日：填了就用；没填按旧办法 = 放款日往后一个周期；都没有 null */
export const firstDue = (debt, freq = freqOfDebt(debt)) => debt.first_payment_date || (debt.start_date ? addPeriods(debt.start_date, freq, 1) : null);
/** 一个日期对到第几期（1 起）：离它最近的那一期还款日（提前或晚几天交的都算那一期）；在第一期之前的算第 1 期 */
export function dueIndex(first, freq, date) {
  const len = 365.25 / (PERIODS_PER_YEAR[freq] || 12), d = dayNum(date), est = Math.round((d - dayNum(first)) / len);
  let best = 0, gap = Infinity;
  for (let j = Math.max(0, est - 1); j <= Math.max(0, est + 1); j++) { const g = Math.abs(d - dayNum(addPeriods(first, freq, j))); if (g < gap) { best = j; gap = g; } }
  return best + 1;
}
/** 到这一天（含）为止到期了几期 */
export function duesUpTo(first, freq, date) {
  const len = 365.25 / (PERIODS_PER_YEAR[freq] || 12), est = Math.floor((dayNum(date) - dayNum(first)) / len);
  let k = 0;
  for (let j = Math.max(0, est - 2); j <= Math.max(0, est + 2); j++) if (addPeriods(first, freq, j) <= date) k = j + 1;
  return k;
}
/** 银行的 Escrow 计划 [{ from: 'YYYY-MM', amount }] 在某天的金额（最近一条 from ≤ 那个月）；没填 null */
export function escrowAt(list, date) {
  const m = String(date || "").slice(0, 7);
  const hit = (Array.isArray(list) ? list : []).filter((x) => x && x.from && x.from <= m && Number(x.amount) >= 0).sort((a, b) => b.from.localeCompare(a.from))[0];
  return hit ? r2(hit.amount) : null;
}

/** 每期本息（不含 Escrow）：对账单校准（本金 + 利息，银行的四舍五入）> 原始本金 / 利率 / 期限的公式 > 某天的余额 + 剩余期数；都不知道 null。
 *  从不从 Escrow 账单倒推 */
export function piOfDebt(debt) {
  const freq = freqOfDebt(debt), sc = debt.statement_check, n = periodsOf(debt.term_months, freq);
  if (sc && Number(sc.principal) > 0 && sc.interest != null && sc.interest !== "") return r2(Number(sc.principal) + Number(sc.interest));
  if (debt.interest_rate == null) return null;
  if (debt.original_principal > 0 && n) return payment(debt.original_principal, debt.interest_rate, n, freq);
  const F = firstDue(debt, freq);
  if (debt.opening_balance > 0 && debt.opening_balance_on && n && F) { const left = n - duesUpTo(F, freq, debt.opening_balance_on); if (left > 0) return payment(debt.opening_balance, debt.interest_rate, left, freq); }
  return null;
}

/** 按摊还表逐期拆分（重新拆分 / 记缴费 / 算余额）——本息只看摊还表，和 Escrow 账单无关：
 *  · 每笔缴费按日期对到最近的一期（第 k 期还款日 = 第一期还款日往后 k−1 个周期；早几天、晚几天都对得上）；同一期两笔的，后一笔顺延到下一期；
 *  · 第 k 期利息 = 期初余额 × 期利率（四舍五入到分），本金 = 本息 − 利息；Escrow = 实付 − 本息 − 额外本金（滞纳金另记）；
 *  · 标成额外本金的（extras）、不挂缴费的还本 / 调整让余额变少，之后每期的利息跟着变；没记缴费的期按计划（假定按时还了）；
 *  · 实付不够本息（short）：先付利息再付本金，Escrow 0；手动改过的（manual）原样用。
 *  debt：interest_rate、payment_frequency、term_months、first_payment_date / start_date、original_principal 或 opening_balance(_on)、statement_check
 *  payments：[{ id, paid_on, amount（不含滞纳金）, late_fee }]；others：不挂缴费的流水；manual：Map(id → { principal（含额外）, interest, escrow, fee, extra })
 *  extras：Map(id → 额外本金)；pi：每期本息（默认 piOfDebt）；untilK：至少算到第几期（校准用）
 *  返回 { rows: Map(id → { k, due, interest, principal（含额外本金）, extra, escrow, fee, balance, source, short }), trace: Map(k → 计划行), balance, pi, first, k0 }；
 *  不能拆（缺利率、本息、本金起点或第一期还款日）返回 null */
export function splitBySchedule({ debt, payments = [], others = [], manual = new Map(), extras = new Map(), pi = null, untilK = 0 }) {
  if (debt.interest_rate == null) return null;
  const freq = freqOfDebt(debt), rate = debt.interest_rate, PI = cents(pi ?? piOfDebt(debt)), n = periodsOf(debt.term_months, freq);
  if (!(PI > 0)) return null;
  const evts = others.filter((x) => !x.bill_payment_id);
  const anchor = balanceAnchor(debt, evts); if (!anchor) return null;
  const opening = !!anchor.after;
  const first = firstDue(debt, freq) || (opening ? addPeriods(anchor.after, freq, 1) : null);
  if (!first) return null;
  const pays = payments.filter((p) => p.paid_on && Number(p.amount) > 0).slice().sort((a, b) => a.paid_on.localeCompare(b.paid_on) || String(a.id).localeCompare(String(b.id)));
  const byK = new Map();
  let prev = 0;
  for (const p of pays) { let k = dueIndex(first, freq, p.paid_on); if (k <= prev) k = prev + 1; prev = k; byK.set(k, p); }
  // 起点：opening = 那天的余额（那天及以前的缴费已经算在里面），original = 第 0 期（放款）
  let k0 = 0;
  if (opening) { k0 = duesUpTo(first, freq, anchor.after); for (const [k, p] of byK) if (p.paid_on <= anchor.after && k > k0) k0 = k; }
  const evAt = new Map();
  for (const x of evts) {
    if (opening && x.txn_date <= anchor.after) continue;
    const kd = Math.max(k0, duesUpTo(first, freq, x.txn_date));
    if (!evAt.has(kd)) evAt.set(kd, []);
    evAt.get(kd).push(x);
  }
  const rows = new Map(), trace = new Map();
  const one = (p, i, sp, bal, k, due) => {
    const m = manual.get(p.id), amt = cents(p.amount), base = { k, due, fee: r2(p.late_fee) };
    if (m) { const P = cents(m.principal), left = Math.max(0, bal - P); return [{ ...base, interest: r2(m.interest), principal: P / 100, extra: r2(m.extra || 0), escrow: r2(m.escrow), fee: r2(m.fee ?? p.late_fee), balance: left / 100, source: "manual", short: false }, left]; }
    if (amt < sp + i) { const I = Math.min(amt, i), P = Math.min(bal, amt - I); return [{ ...base, interest: I / 100, principal: P / 100, extra: 0, escrow: 0, balance: (bal - P) / 100, source: "schedule", short: true }, bal - P]; }
    const x = Math.max(0, Math.min(cents(extras.get(p.id) || 0), amt - sp - i, bal - sp)), left = bal - sp - x;
    return [{ ...base, interest: i / 100, principal: (sp + x) / 100, extra: x / 100, escrow: (amt - sp - i - x) / 100, balance: left / 100, source: "schedule", short: false }, left];
  };
  const schedP = (bal, i, k) => { let sp = Math.max(0, PI - i); if (sp > bal || (n && k >= n)) sp = bal; return sp; };
  // 往后
  let bal = cents(anchor.base);
  const applyEv = (k) => { for (const x of evAt.get(k) || []) bal = Math.max(0, bal + cents(balanceEffect(x))); };
  applyEv(k0);
  const lastK = Math.max(k0, untilK, ...byK.keys(), ...evAt.keys());
  for (let k = k0 + 1; k <= lastK; k++) {
    const i = interestCents(bal, rate, freq), sp = schedP(bal, i, k), due = addPeriods(first, freq, k - 1);
    trace.set(k, { k, due, before: bal / 100, interest: i / 100, principal: sp / 100, balance: (bal - sp) / 100 });
    const p = byK.get(k);
    if (p) { const [row, left] = one(p, i, sp, bal, k, due); rows.set(p.id, row); bal = left; } else bal -= sp;   // 没记缴费的一期：按计划
    applyEv(k);
  }
  // 往前（只有 opening 起点）：起点当天及以前的缴费已经反映在起点余额里；倒推期初 B：B − (本息 − 利息(B)) − 额外 = 期末
  if (opening && byK.size) {
    const minK = Math.min(...byK.keys()), r = periodRate(rate, freq);
    let b = cents(anchor.base);
    for (let k = k0; k >= minK && k >= 1; k--) {
      const p = byK.get(k), m = p ? manual.get(p.id) : null, x = p && !m ? cents(extras.get(p.id) || 0) : 0, due = addPeriods(first, freq, k - 1);
      let before;
      if (m) before = b + cents(m.principal);
      else { before = Math.round((b + x + PI) / (1 + r)); for (let it = 0; it < 3; it++) before = b + x + PI - interestCents(before, rate, freq); }
      if (p) { const i = interestCents(before, rate, freq); const [row] = one(p, i, schedP(before, i, k), before, k, due); rows.set(p.id, { ...row, balance: b / 100 }); }
      b = before;
    }
  }
  return { rows, trace, balance: Math.max(0, bal) / 100, pi: PI / 100, first, k0 };
}

/** 用一张对账单校准：statement = { date（这一期的还款日）, principal, interest, balance（还款后余额，可空）}；ctx = splitBySchedule 的其他参数。
 *  返回 { k, expected（摊还表上这一期）, diff, ok, pi（对账单的本息）, piCalc（按公式的本息）, impliedBefore / impliedAfter（由利息倒推的余额）, hints[] }
 *  hints：{ code, ... }：pi_mismatch / shift（和第 k±1 期一致，第一期还款日差一个周期）/ extra_before（余额比计划少：之前有额外本金）/ no_schedule / before_anchor */
export function calibrate({ debt, statement, ...ctx }) {
  const freq = freqOfDebt(debt), P = r2(statement.principal), I = r2(statement.interest), r = periodRate(debt.interest_rate, freq);
  const out = { k: null, expected: null, diff: null, ok: false, pi: r2(P + I), piCalc: piOfDebt({ ...debt, statement_check: null }), impliedBefore: null, impliedAfter: null, hints: [] };
  if (r > 0 && I > 0) { out.impliedBefore = r2(I / r); out.impliedAfter = r2(out.impliedBefore - P); }
  if (out.piCalc != null && Math.abs(out.piCalc - out.pi) > 0.005) out.hints.push({ code: "pi_mismatch", calc: out.piCalc, stmt: out.pi });
  const first = firstDue(debt, freq);
  if (!first || !statement.date) { out.hints.push({ code: "no_schedule" }); return out; }
  const k = dueIndex(first, freq, statement.date);
  out.k = k;
  const res = splitBySchedule({ debt: { ...debt, statement_check: null }, ...ctx, untilK: k + 1 });
  const row = res?.trace.get(k);
  if (!row) { out.hints.push({ code: res ? "before_anchor" : "no_schedule" }); return out; }
  out.expected = row;
  out.diff = { principal: r2(P - row.principal), interest: r2(I - row.interest), balance: statement.balance != null && statement.balance !== "" ? r2(Number(statement.balance) - row.balance) : null };
  out.ok = Math.abs(out.diff.principal) < 0.005 && Math.abs(out.diff.interest) < 0.005 && (out.diff.balance == null || Math.abs(out.diff.balance) < 0.005);
  if (!out.ok) {
    for (const j of [k - 1, k + 1]) { const t = res.trace.get(j); if (t && Math.abs(t.principal - P) < 0.005 && Math.abs(t.interest - I) < 0.005) out.hints.push({ code: "shift", k: j, by: j - k }); }
    if (Math.abs(out.diff.interest) >= 0.005 && out.impliedBefore != null && out.impliedBefore < row.before - 1) out.hints.push({ code: "extra_before", amount: r2(row.before - out.impliedBefore) });
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
