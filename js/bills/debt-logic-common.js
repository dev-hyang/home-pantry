/* 借贷逻辑各部分共用的小件。从 debt-logic.js 抽出来，各部分依赖这里。 */
import * as A from "../core/amortization.js";
import { Store } from "../core/store.js";
import { escrowMonthlyFor } from "./logic.js";
import { isClosedStatus, isPersonalDebt } from "../core/debt-rules.js";
import { num, todayISO } from "../core/util.js";
import { state } from "../core/state.js";

export const r2 = A.r2;
/** 读借贷两张表；没执行迁移 058（表不存在）或没有财务权限：空，debtsOk = false（借贷页给出提示，其余页面照旧） */
export async function loadDebts() {
  try {
    const [debts, txns] = await Promise.all([Store.listDebts(), Store.listDebtTxns()]);
    state.debts = debts.map(normDebt); state.debtTxns = txns.map(normTxn); state.debtsOk = true; state.debtsErr = "";
  } catch (e) { state.debts = []; state.debtTxns = []; state.debtsOk = false; state.debtsErr = e.message || String(e); }
  return state.debts;
}
const nOrNull = (v) => (v == null || v === "" ? null : num(v));
const normDebt = (d) => ({ ...d, original_principal: nOrNull(d.original_principal), interest_rate: nOrNull(d.interest_rate), term_months: nOrNull(d.term_months), scheduled_payment: nOrNull(d.scheduled_payment), opening_balance: nOrNull(d.opening_balance),
  first_payment_date: d.first_payment_date || null, escrow_schedule: Array.isArray(d.escrow_schedule) ? d.escrow_schedule.filter((x) => x && /^\d{4}-\d{2}$/.test(x.from || "") && num(x.amount) >= 0).map((x) => ({ from: x.from, amount: num(x.amount) })) : [],
  statement_check: d.statement_check && typeof d.statement_check === "object" ? d.statement_check : null });
export const normTxn = (x) => ({ ...x, principal_amount: num(x.principal_amount), interest_amount: num(x.interest_amount), fee_amount: num(x.fee_amount), escrow_amount: num(x.escrow_amount), total: num(x.total), extra_principal: num(x.extra_principal) });
export const debts = () => state.debts || [];
export const debtTxns = () => state.debtTxns || [];
export const debtById = (id) => debts().find((d) => d.id === id) || null;
export const txnsOf = (id) => debtTxns().filter((x) => x.debt_id === id);
/** 这笔贷款对应的周期性账单（还款计划）：bills.debt_id 指过来的 */
export const billOfDebt = (d) => (d ? state.billsEnriched.find((b) => b.debt_id === d.id) || null : null);
export const debtOfBill = (b) => (b?.debt_id ? debtById(b.debt_id) : null);
/** 收入记录转成的借款：放款 / 收回 / 收息流水指向这条收入，或 058 迁移的 source_key = income:<id> */
export function debtOfIncome(recordId) {
  const x = debtTxns().find((y) => y.income_record_id === recordId);
  return x ? debtById(x.debt_id) : debts().find((d) => d.source_key === `income:${recordId}`) || null;
}
const freqOf = A.freqOfDebt;
/** Escrow 参考（只做提示）：房贷类挂的房产上 Escrow 代缴账单（房屋保险 + 房产税 …）÷ 12，折成每期。
 *  银行实际收的 Escrow 会因为缓冲（cushion）、每年的 Escrow 分析和它不一样；从不用它算本息 */
export function escrowFor(d, bill = billOfDebt(d)) {
  if (!["mortgage", "heloc", "home_equity"].includes(d.category)) return 0;
  const pid = d.property_id || bill?.property_id || null;
  const m = escrowMonthlyFor(pid);
  return m > 0 ? r2((m * 12) / (A.PERIODS_PER_YEAR[freqOf(d)] || 12)) : 0;   // 折成每期
}
/** 银行的 Escrow 计划在某天的金额（贷款设置里填的，跟着每年的 Escrow 分析变）；没填 null */
export const bankEscrowAt = (d, date = todayISO()) => A.escrowAt(d?.escrow_schedule, date);
/** 每期本息（不含 Escrow）：对账单校准 / 原始本金 + 利率 + 期限 / 某天余额 + 剩余期数（amortization.piOfDebt）；
 *  都没有时：每期还款（或账单金额）− 银行 Escrow 计划；没有 Escrow 计划又挂着 Escrow 账单的房贷算不出（不从 Escrow 账单倒推） */
export function piOf(d, bill = billOfDebt(d)) {
  const pi = A.piOfDebt(d); if (pi != null) return pi;
  const total = d.scheduled_payment ?? bill?.est ?? null; if (total == null) return null;
  const esc = bankEscrowAt(d);
  if (esc == null && escrowFor(d, bill) > 0) return null;
  return r2(Math.max(0, num(total) - (esc || 0)));
}
/** 能不能按摊还表拆分：填了利率、知道每期本息和某个时点的本金（原始本金 / 某天的余额 / 放款记录），还对得上期数（第一期还款日 / 起始日 / 某天的余额）；亲友借贷不按账单拆 */
export const canSplit = (d) => !!d && !isPersonalDebt(d) && d.interest_rate != null && !!A.balanceAnchor(d, txnsOf(d.id)) && piOf(d) != null && !!(A.firstDue(d) || d.opening_balance_on);
/** 已有拆分流水 → 摊还引擎的输入（缴费 = 流水本身）：算余额用，不用读缴费表 */
const engineFromTxns = (d, txns) => {
  const split = txns.filter((x) => x.bill_payment_id);
  return A.splitBySchedule({ debt: d, pi: piOf(d),
    payments: split.map((x) => ({ id: x.bill_payment_id, paid_on: x.txn_date, amount: r2(x.total - x.fee_amount), late_fee: x.fee_amount })),
    others: txns.filter((x) => !x.bill_payment_id),
    manual: new Map(split.filter((x) => x.split_source === "manual").map((x) => [x.bill_payment_id, { principal: x.principal_amount, interest: x.interest_amount, escrow: x.escrow_amount, fee: x.fee_amount, extra: x.extra_principal }])),
    extras: new Map(split.filter((x) => x.extra_principal > 0).map((x) => [x.bill_payment_id, x.extra_principal])) });
};
/** 贷款的派生信息：余额、已还、下次还款、逾期、预计还清、关联的账单 / 资产 */
export function enrichDebt(d) {
  const txns = txnsOf(d.id), bill = billOfDebt(d), split = canSplit(d), paid = A.paidTotals(d, txns);
  // 能按摊还表拆的：余额 = 摊还表走到最后一笔缴费（中间没记的期按计划）再算上额外还本；否则 = 起点 ± 流水
  const eng = split && txns.some((x) => x.bill_payment_id) ? engineFromTxns(d, txns) : null;
  const balance = eng ? eng.balance : A.outstanding(d, txns);
  const freq = freqOf(d), rate = A.periodRate(d.interest_rate, freq), pi = piOf(d, bill);
  const closed = isClosedStatus(d.status);
  const nextDue = closed ? null : bill && bill.active && !bill.ended ? bill.next_due_on : d.maturity_date && balance !== 0 ? d.maturity_date : null;
  const overdue = !closed && ((bill && bill.status === "overdue") || (!bill && !!d.maturity_date && d.maturity_date < todayISO() && (balance == null || balance > 0)) || d.status === "overdue");
  const status = closed ? d.status : overdue ? "overdue" : "active";
  const left = balance != null && d.interest_rate != null ? A.remainingPeriods(balance, rate, pi) : null;
  const payoff = left != null && !closed ? A.addPeriods(todayISO(), freq, left) : null;
  const asset = d.asset_id ? state.assetsEnriched?.find((a) => a.id === d.asset_id) || state.assets.find((a) => a.id === d.asset_id) || null : null;
  const property = d.property_id ? state.properties.find((p) => p.id === d.property_id) || null : null;
  const original = d.original_principal ?? (txns.filter((x) => x.type === "disbursement").reduce((s, x) => s + x.principal_amount, 0) || null);
  const escrowBank = bankEscrowAt(d), escrowRef = escrowFor(d, bill);
  return { ...d, txns, bill, balance, paid, pi, rate, freq, nextDue, overdue, status, payoff, left, asset, property, original, escrow: escrowBank ?? escrowRef, escrowBank, escrowRef, split, first: A.firstDue(d, freq) };
}
export const debtsEnriched = () => debts().map(enrichDebt);
