/* 借贷（财务 P2，迁移 058）· 计算与写入：贷款的余额、下次还款、逾期；账单缴费时按摊还表拆 本金 / 利息 / Escrow；
 * 亲友借贷的放款 / 还款 / 利息；车辆「贷款中」状态和车贷同步；提醒。
 * 数据量：debt_accounts / debt_transactions 是小表（几笔贷款，每笔最多几百条流水），启动时整表读进内存（state.debts / state.debtTxns），在内存里算。
 * 按摊还表拆分（重新拆分、记一笔缴费、详情页的逐期表）要读这条账单的全部缴费（内存里只有近 400 天的）：按账单 id 读一次（最多几百行），记缴费时只写有变化的几笔。
 * 本息只按摊还表算（第一期还款日、原始本金 / 利率 / 期限，或对账单校准），Escrow = 实付 − 本息 − 额外本金；Escrow 账单只做参考提示（迁移 060）。
 * 规则（分类、方向）在 js/core/debt-rules.js，摊还在 js/core/amortization.js；设计见 docs/design-debt-lending.md。 */
import { state } from "../core/state.js";
import { Store } from "../core/store.js";
import { daysUntil, money, num, todayISO, uid } from "../core/util.js";
import { t } from "../core/i18n.js";
import { href } from "../core/router.js";
import { registerAlerts } from "../core/alerts.js";
import { financeOk } from "../core/finance-access.js";
import { spendChanged } from "../core/spend-data.js";
import * as A from "../core/amortization.js";
import { DEBT_INTEREST_LEAF, DEBT_PRINCIPAL_LEAF, debtCat, interestLeafOf, isClosedStatus, isPersonalDebt, principalLeafOf } from "../core/debt-rules.js";
import { escrowMonthlyFor, monthlyEquivalent } from "./logic.js";
import { schemaFlags } from "../core/store.js";

const r2 = A.r2;
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
const normTxn = (x) => ({ ...x, principal_amount: num(x.principal_amount), interest_amount: num(x.interest_amount), fee_amount: num(x.fee_amount), escrow_amount: num(x.escrow_amount), total: num(x.total), extra_principal: num(x.extra_principal) });
/** 迁移 060 执行了没有（第一期还款日 / Escrow 计划 / 对账单校准 / 额外本金这几列）：没执行时这些字段不显示、不保存 */
export const debt060 = () => Store.mode !== "cloud" || schemaFlags.debt060;
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
/** 拆分缺什么（给详情页提示）：rate / principal / pi / first */
export function splitMissing(d) {
  if (!d || isPersonalDebt(d)) return [];
  const out = [];
  if (d.interest_rate == null) out.push("rate");
  if (!A.balanceAnchor(d, txnsOf(d.id))) out.push("principal");
  if (piOf(d) == null) out.push("pi");
  if (!A.firstDue(d) && !d.opening_balance_on) out.push("first");
  return out;
}
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

/** 预算 / 报表里「均摊月均」：拆分后房贷的本金不算住房消费 → 每月折算减去本金部分（本金估算 = 每期本息 − 当前余额 × 期利率） */
export function billExpenseMonthly(b) {
  const d = debtOfBill(b);
  if (!d || !canSplit(d) || !(b.monthly > 0)) return b.monthly;
  const e = enrichDebt(d); if (e.balance == null || !(e.pi > 0)) return b.monthly;
  const principal = Math.max(0, e.pi - r2(e.balance * e.rate));
  return Math.max(0, r2(b.monthly - monthlyEquivalent({ frequency: e.freq === "semimonthly" ? "biweekly" : e.freq }, principal)));
}

/* ───────────── 账单缴费 ↔ 本金 / 利息拆分 ─────────────
 * 一笔缴费 = 两行花费：主行（bill_payments.purchase_id）= 利息 + Escrow + 滞纳金（分类见 interestLeafOf），本金行 = bill_<分类> + 性质「融资」。
 * 再加一条借贷流水（bill_payment_id 唯一）记拆分，本金行挂在流水的 purchase_id 上。 */
const isoAt = (d) => new Date(`${d}T12:00:00`).toISOString();
async function writeSplits(d, bill, items) {
  const main = [], principalRows = [], drop = [], txns = [];
  const cur = bill.currency || Units.region.currency, payee = bill.payee || bill.name || null;
  for (const { p, s } of items) {
    if (!p.purchase_id) continue;
    const old = debtTxns().find((x) => x.bill_payment_id === p.id);
    const total = r2(num(p.amount) + num(p.late_fee)), principal = r2(Math.min(s.principal, total));
    main.push({ id: p.purchase_id, name: bill.name, category: interestLeafOf(bill.category, d.category), amount: r2(total - principal), nature: null });
    let pid = old?.purchase_id || null;
    if (principal > 0) {
      pid ||= uid();
      principalRows.push({ id: pid, item_id: null, name: `${bill.name} · ${t("本金")}`.slice(0, 60), category: principalLeafOf(bill.category), nature: "financing", quantity: null, unit: null,
        store: payee ? String(payee).slice(0, 40) : null, amount: principal, currency: p.currency || cur, purchased_at: isoAt(p.paid_on), card_id: p.card_id || null, property_id: bill.property_id || null });
    } else if (pid) { drop.push(pid); pid = null; }
    txns.push({ id: old?.id, debt_id: d.id, txn_date: p.paid_on, type: principal > 0 ? "principal_repayment" : "interest_payment", principal_amount: principal, interest_amount: s.interest, fee_amount: s.fee,
      escrow_amount: s.escrow, total, bill_payment_id: p.id, purchase_id: pid, income_record_id: null, income_repayment_id: null, split_source: s.source || "schedule", notes: old?.notes || null,
      extra_principal: r2(Math.min(num(s.extra), principal)) });   // 本金含额外本金；extra_principal 记其中标成额外的部分
  }
  if (main.length) await Store.upsertPurchases(main);
  if (principalRows.length) await Store.upsertPurchases(principalRows);
  if (drop.length) await Store.deletePurchases(drop);
  if (txns.length) await Store.upsertDebtTxns(txns);
  state.debtTxns = (await Store.listDebtTxns()).map(normTxn);
  spendChanged();
  return txns.length;
}

/** 取消拆分（贷款解除关联 / 删掉利率）：主行恢复成整笔、原分类，删本金行和拆分流水 */
export async function unsplitDebt(d, bill = billOfDebt(d)) {
  const list = txnsOf(d.id).filter((x) => x.bill_payment_id);
  if (!list.length) return 0;
  const pays = bill ? await Store.listPaymentsOfBill(bill.id) : [];
  const byId = new Map(pays.map((p) => [p.id, p]));
  const main = [];
  for (const x of list) { const p = byId.get(x.bill_payment_id); if (p?.purchase_id && bill) main.push({ id: p.purchase_id, name: bill.name, category: `bill_${bill.category}`, amount: r2(num(p.amount) + num(p.late_fee)), nature: null }); }
  if (main.length) await Store.upsertPurchases(main);
  const drop = list.map((x) => x.purchase_id).filter(Boolean);
  if (drop.length) await Store.deletePurchases(drop);
  await Store.deleteDebtTxns(list.map((x) => x.id));
  state.debtTxns = (await Store.listDebtTxns()).map(normTxn);
  spendChanged();
  return list.length;
}

/** 摊还引擎的输入：这条账单的全部缴费（按账单 id 读一次，最多几百行）+ 这笔贷款流水里的手动拆分 / 额外本金 */
async function engineInput(d, bill, { overwrite = false, extraPatch = null } = {}) {
  const pays = (await Store.listPaymentsOfBill(bill.id)).filter((p) => p.status !== "skipped" && num(p.amount) > 0 && p.purchase_id);
  const txns = txnsOf(d.id), split = txns.filter((x) => x.bill_payment_id);
  const manual = overwrite ? new Map() : new Map(split.filter((x) => x.split_source === "manual").map((x) => [x.bill_payment_id, { principal: x.principal_amount, interest: x.interest_amount, escrow: x.escrow_amount, fee: x.fee_amount, extra: x.extra_principal }]));
  const extras = new Map(split.filter((x) => x.extra_principal > 0).map((x) => [x.bill_payment_id, x.extra_principal]));
  if (extraPatch) for (const [k, v] of extraPatch) { if (v > 0) extras.set(k, v); else extras.delete(k); }
  return { pays, txns, manual, extras };
}
const runEngine = (d, bill, { pays, txns, manual, extras }) => A.splitBySchedule({ debt: d, payments: pays, others: txns.filter((x) => !x.bill_payment_id), manual, extras, pi: piOf(d, bill) });
/** 已存的拆分流水和算出来的一样（金额、日期、来源、额外本金、本金行都在）：onlyChanged 时跳过 */
function sameSplit(p, s) {
  const x = debtTxns().find((y) => y.bill_payment_id === p.id), total = r2(num(p.amount) + num(p.late_fee)), eq = (a, b) => Math.abs(num(a) - num(b)) < 0.005;
  return !!x && x.txn_date === p.paid_on && eq(x.total, total) && eq(x.principal_amount, s.principal) && eq(x.interest_amount, s.interest) && eq(x.escrow_amount, s.escrow)
    && eq(x.fee_amount, s.fee) && eq(x.extra_principal, s.extra) && x.split_source === s.source && (!!x.purchase_id || !(s.principal > 0));
}
/** 按摊还表重新拆分这笔贷款的全部历史还款；返回写了几笔。不能拆（缺利率 / 本金 / 本息 / 期数起点）返回 0。
 *  overwrite = true：手动改过的也按摊还表重算（标成额外本金的保留）；onlyChanged = true：只写拆分有变化的（记一笔缴费时用，不用每次重写几百行）；
 *  extraPatch：Map(缴费 id → 额外本金)，先改再算 */
export async function resplitDebt(d, { overwrite = false, onlyChanged = false, extraPatch = null } = {}) {
  const bill = billOfDebt(d); if (!bill || !canSplit(d)) return 0;
  const input = await engineInput(d, bill, { overwrite, extraPatch }), res = runEngine(d, bill, input);
  if (!res) return 0;
  const items = input.pays.filter((p) => res.rows.has(p.id)).map((p) => ({ p, s: res.rows.get(p.id) })).filter(({ p, s }) => !onlyChanged || !sameSplit(p, s));
  const n = items.length ? await writeSplits(d, bill, items) : 0;
  await syncDebtStatus(d.id);
  return n;
}
/** 详情页的逐期表：每笔缴费的 日期、实付、本金、利息、Escrow、额外本金、还款后余额、来源、第几期、P + I + E (+ 滞纳金) 对不对得上、
 *  和银行 Escrow 计划的差；saved = 已存的拆分，stale = 已存的和摊还表不一样（要点重新拆分）。读一次缴费表 */
export async function paymentTable(d) {
  const bill = billOfDebt(d); if (!bill || !canSplit(d)) return null;
  const input = await engineInput(d, bill), res = runEngine(d, bill, input);
  if (!res) return null;
  const rows = input.pays.filter((p) => res.rows.has(p.id)).map((p) => {
    const s = res.rows.get(p.id), x = input.txns.find((y) => y.bill_payment_id === p.id) || null, total = r2(num(p.amount) + num(p.late_fee)), exp = bankEscrowAt(d, s.due);
    return { id: p.id, paid_on: p.paid_on, total, ...s, saved: x, stale: !x || !sameSplit(p, s),
      ok: !s.short && Math.abs(r2(s.principal + s.interest + s.escrow + s.fee) - total) < 0.005, expEscrow: exp, escrowDiff: exp != null ? r2(s.escrow - exp) : null };
  }).sort((a, b) => b.paid_on.localeCompare(a.paid_on));
  return { rows, pi: res.pi, first: res.first, balance: res.balance };
}
/** 把一期里多出来的标成额外本金（0 = 取消）：额外本金让余额变少，后面每期的利息都变，所以整段重算 */
export async function setExtraPrincipal(d, paymentId, amount) {
  return resplitDebt(d, { onlyChanged: true, extraPatch: new Map([[paymentId, r2(Math.max(0, num(amount)))]]) });
}
/** 用一张对账单校准（不写库）：statement = { date, principal, interest, balance } → amortization.calibrate 的结果 */
export async function calibrateDebt(d, statement) {
  const bill = billOfDebt(d);
  const input = bill ? await engineInput(d, bill) : { pays: [], txns: txnsOf(d.id), manual: new Map(), extras: new Map() };
  return A.calibrate({ debt: d, statement, payments: input.pays, others: input.txns.filter((x) => !x.bill_payment_id), manual: input.manual, extras: input.extras });
}

/** 记了 / 改了一笔账单缴费：这条账单挂着能拆分的贷款就拆。payment = 缴费记录（含 id、purchase_id） */
export async function splitBillPayment(bill, payment) {
  const d = debtOfBill(bill);
  if (!d || !payment?.purchase_id || payment.status === "skipped" || !(num(payment.amount) > 0)) return false;
  const old = debtTxns().find((x) => x.bill_payment_id === payment.id);
  if (!canSplit(d)) return false;
  // 手动改过的这一期金额变了：改回按摊还表（金额没变的保留手动）。然后整段按摊还表算（期数按日期对，补记旧账、改日期都对），只写有变化的几笔
  const total = r2(num(payment.amount) + num(payment.late_fee));
  if (old?.split_source === "manual" && Math.abs(old.total - total) >= 0.005) {
    await Store.upsertDebtTxns([{ ...old, split_source: "schedule" }]);
    state.debtTxns = debtTxns().map((y) => (y.id === old.id ? { ...y, split_source: "schedule" } : y));
  }
  return (await resplitDebt(d, { onlyChanged: true })) > 0;
}
/** 删一笔账单缴费之前：删掉它的本金行（流水随缴费记录级联删除） */
export async function beforeDeletePayment(paymentId) {
  const x = debtTxns().find((y) => y.bill_payment_id === paymentId);
  if (x?.purchase_id) await Store.deletePurchases([x.purchase_id]);
  if (x) { await Store.deleteDebtTxns([x.id]); state.debtTxns = debtTxns().filter((y) => y.id !== x.id); }
}
/** 手动改一期的拆分（按对账单）：split_source = manual，重新拆分时不覆盖（除非选了覆盖）。principal = 本金（不含额外），extra = 额外本金；
 *  额外本金改变后面的余额，所以写完整段重算（手动的这一期原样保留，只写有变化的） */
export async function overrideSplit(d, paymentId, { principal, interest, escrow, extra = 0 }) {
  const bill = billOfDebt(d); if (!bill) return;
  const p = (await Store.listPaymentsOfBill(bill.id)).find((x) => x.id === paymentId); if (!p) return;
  const total = r2(num(p.amount)), ex = r2(Math.max(0, Math.min(total, num(extra)))), pr = r2(Math.max(0, Math.min(total - ex, num(principal))));
  const es = r2(Math.max(0, Math.min(total - pr - ex, num(escrow))));
  const it = interest === "" || interest == null ? r2(total - pr - ex - es) : r2(Math.max(0, num(interest)));
  await writeSplits(d, bill, [{ p, s: { principal: r2(pr + ex), extra: ex, interest: it, escrow: es, fee: num(p.late_fee), source: "manual" } }]);
  await resplitDebt(debtById(d.id) || d, { onlyChanged: true });
}
/** 撤销手动拆分：回到按摊还表（标成额外本金的保留） */
export async function clearOverride(d, paymentId) {
  const x = debtTxns().find((y) => y.bill_payment_id === paymentId);
  if (x) { await Store.upsertDebtTxns([{ ...x, split_source: "schedule" }]); state.debtTxns = debtTxns().map((y) => (y.id === x.id ? { ...y, split_source: "schedule" } : y)); }
  await resplitDebt(debtById(d.id) || d, { onlyChanged: true });
}

/* ───────────── 亲友借贷 / 不挂账单的还款 ─────────────
 * kind：lend（借出 / 借入到账 = 放款）、repay（还款：借入 = 我还给对方，借出 = 对方还我）、extra（额外还本，贷款）
 * cash = true：同时记现金那一面（花费 / 收入），false = 只记借贷流水（对账单已经导入过那笔钱了） */
export async function recordDebtTxn(d, { kind, date, principal = 0, interest = 0, cash = true, card_id = null, account_id = null, notes = null }) {
  const who = d.counterparty_name || d.name, cur = d.currency || Units.region.currency, at = isoAt(date);
  const P = r2(principal), I = r2(interest), rows = [];
  const spend = async (name, category, amount, nature) => (cash && amount > 0 ? Store.addPurchase({ item_id: null, name: name.slice(0, 60), category, quantity: null, unit: null, store: String(who).slice(0, 40), amount, currency: cur, purchased_at: at, nature, ...(card_id ? { card_id } : {}) }) : null);
  const income = async (kind_, amount) => (cash && amount > 0 ? Store.saveIncomeRecord({ received_on: date, amount, currency: cur, source_name: String(who).slice(0, 80), kind: kind_, person_id: d.person_id || null, account_id: account_id || null, repay_required: false, notes: notes || null }) : null);
  const recv = d.direction === "receivable";
  if (kind === "lend") {
    if (recv) rows.push({ type: "disbursement", principal_amount: P, total: P, purchase_id: await spend(t("借给 {n}", { n: who }), DEBT_PRINCIPAL_LEAF, P, "financing") });
    else rows.push({ type: "disbursement", principal_amount: P, total: P, income_record_id: await income("loan_proceeds", P) });
  } else {
    if (P > 0) rows.push(recv ? { type: "principal_repayment", principal_amount: P, total: P, income_record_id: await income("returned_principal", P) }
      : { type: "principal_repayment", principal_amount: P, total: P, purchase_id: await spend(t("还款给 {n}", { n: who }), DEBT_PRINCIPAL_LEAF, P, "financing") });
    if (I > 0) rows.push(recv ? { type: "interest_income", interest_amount: I, total: I, income_record_id: await income("interest", I) }
      : { type: "interest_payment", interest_amount: I, total: I, purchase_id: await spend(t("利息 · {n}", { n: who }), DEBT_INTEREST_LEAF, I, null) });
  }
  if (!rows.length) return 0;
  await Store.upsertDebtTxns(rows.map((r) => ({ debt_id: d.id, txn_date: date, split_source: "manual", notes, ...r })));
  state.debtTxns = (await Store.listDebtTxns()).map(normTxn);
  if (cash) spendChanged();
  await syncDebtStatus(d.id);
  return rows.length;
}
/** 删一条借贷流水；它记下的现金那一面（花费 / 收入）一起删（cash = true 时） */
export async function deleteDebtTxn(id, { cash = true } = {}) {
  const x = debtTxns().find((y) => y.id === id); if (!x) return;
  if (x.bill_payment_id) throw new Error(t("这条是账单缴费的拆分：去账单的缴费记录里改或删"));
  await Store.deleteDebtTxns([id]);
  if (cash && x.purchase_id) await Store.deletePurchase(x.purchase_id);
  if (cash && x.income_record_id && !(x.type === "disbursement" && debtById(x.debt_id)?.source_key === `income:${x.income_record_id}`)) await Store.deleteIncomeRecord(x.income_record_id);   // 迁移来的原始收入记录不删
  state.debtTxns = debtTxns().filter((y) => y.id !== id);
  spendChanged();
  await syncDebtStatus(x.debt_id);
}

/** 改一条不挂缴费的借贷流水（日期、类型、金额、备注、关联的花费 / 收入）：只改流水本身，关联的那笔花费 / 收入不动 */
export async function updateDebtTxn(x, patch) {
  if (x.bill_payment_id) throw new Error(t("这条是账单缴费的拆分：去账单的缴费记录里改或删"));
  await Store.upsertDebtTxns([{ ...x, ...patch, id: x.id }]);
  state.debtTxns = (await Store.listDebtTxns()).map(normTxn);
  await syncDebtStatus(x.debt_id);
}
/** 房贷每期还款「关联一笔花费」：缴费改指向已有的那笔花费（多半是对账单导入的同一笔钱），原来自动记的那笔删掉；
 *  然后按摊还表重写这一期：关联的花费变成主行（利息 + Escrow，分类见 interestLeafOf），本金照旧另一行——和记缴费同一套，不重复计算 */
export async function relinkPaymentPurchase(d, paymentId, purchaseId) {
  const bill = billOfDebt(d); if (!bill || !purchaseId) return false;
  const pays = await Store.listPaymentsOfBill(bill.id), p = pays.find((x) => x.id === paymentId);
  if (!p || p.purchase_id === purchaseId) return false;
  const old = p.purchase_id;
  await Store.updateBillPayment(p.id, { purchase_id: purchaseId });
  state.billPayments = (state.billPayments || []).map((x) => (x.id === p.id ? { ...x, purchase_id: purchaseId } : x));
  if (old) await Store.deletePurchase(old);
  if (canSplit(d)) {
    const input = await engineInput(d, bill), res = runEngine(d, bill, input), s = res?.rows.get(p.id);
    if (s) await writeSplits(d, bill, [{ p: { ...p, purchase_id: purchaseId }, s }]);
  } else spendChanged();
  return true;
}

/** 收入里勾了「需要还」：和 058 迁移同一套规则建一笔个人借入（已有就更新金额 / 到期日），放款流水指回这条收入 */
export async function ensureBorrowDebt(r) {
  if (!r?.id) return null;
  const principal = r.repay_amount || r.amount, have = debtOfIncome(r.id);
  const base = { name: String(r.source_name || "").slice(0, 60), category: "personal_lending", direction: "payable", counterparty_name: r.source_name, person_id: r.person_id || null,
    original_principal: principal, currency: r.currency, start_date: r.received_on, maturity_date: r.repay_due_on || null, payment_frequency: "none" };
  const id = await Store.saveDebt(have ? { ...have, ...base } : { ...base, status: "active", notes: r.notes || null });
  const disb = debtTxns().find((x) => x.debt_id === id && x.type === "disbursement" && x.income_record_id === r.id);
  await Store.upsertDebtTxns([{ id: disb?.id, debt_id: id, txn_date: r.received_on, type: "disbursement", principal_amount: principal, total: r.amount, income_record_id: r.id, split_source: "schedule" }]);
  await loadDebts();
  return id;
}

/* ───────────── 状态同步：还清 ↔ 车辆「贷款中」 ───────────── */
/** 余额到 0 → 已还清；还清的又有了余额（删了还款）→ 还款中。车贷：还款中 ↔ 车辆「贷款中」，还清 → 车辆「持有」并写贷款结清日期 */
export async function syncDebtStatus(id) {
  const d = debtById(id); if (!d) return;
  const e = enrichDebt(d);
  let status = d.status;
  if (e.balance === 0 && ["active", "overdue"].includes(d.status)) status = "paid_off";
  else if (e.balance > 0 && d.status === "paid_off") status = "active";
  if (status !== d.status) { await Store.saveDebt({ ...d, status }); state.debts = debts().map((x) => (x.id === id ? { ...x, status } : x)); }
  await syncVehicle({ ...d, status });
}
export async function syncVehicle(d) {
  if (d.category !== "auto_loan" || !d.asset_id || d.link_confirmed === false) return false;
  const a = state.assets.find((x) => x.id === d.asset_id); if (!a || a.kind !== "vehicle") return false;
  const v = { ...(a.vehicle || {}) }, st = v.status || "owned";
  const otherActive = debts().some((x) => x.id !== d.id && x.category === "auto_loan" && x.asset_id === a.id && !isClosedStatus(x.status));
  if (!isClosedStatus(d.status) && st === "owned") v.status = "financed";
  else if (isClosedStatus(d.status) && st === "financed" && !otherActive) { v.status = "owned"; v.loan_end ||= todayISO(); }
  else return false;
  await Store.saveAsset({ ...a, vehicle: v });
  state.assets = state.assets.map((x) => (x.id === a.id ? { ...x, vehicle: v } : x));
  return true;
}
/** 卖房 / 卖车交割：挂在这处资产上、还在还的贷款标为已还清（卖房款还清贷款）。返回改了几笔 */
export async function payOffForAsset({ property_id = null, asset_id = null, on = todayISO() }) {
  if (!state.debtsOk) return 0;
  const list = debts().filter((d) => d.direction === "payable" && !isClosedStatus(d.status) && ((property_id && d.property_id === property_id) || (asset_id && d.asset_id === asset_id)));
  for (const d of list) await Store.saveDebt({ ...d, status: "paid_off", notes: [d.notes, t("{d} 资产卖出时结清", { d: on })].filter(Boolean).join("\n").slice(0, 1000) });
  if (list.length) await loadDebts();
  return list.length;
}

/* ───────────── 提醒 ───────────── */
/** 亲友借贷 / 不挂账单的贷款：到期日一个月内、逾期（贷款月供本身的提醒走账单）；迁移猜的车辆待确认 */
export function debtAlertItems() {
  if (!state.billsEnabled || !state.debtsOk || !financeOk()) return [];
  const out = [];
  for (const e of debtsEnriched()) {
    if (isClosedStatus(e.status) || e.bill) continue;
    const due = e.maturity_date; if (!due || (e.balance != null && e.balance <= 0)) continue;
    const d = daysUntil(due); if (d > 30) continue;
    const sev = d < 0 ? 0 : d <= 7 ? 2 : 3, recv = e.direction === "receivable", who = e.counterparty_name || e.name, link = debtHref(e.id);
    const left = e.balance != null ? money(e.balance) : "";
    out.push({ source: "debt", severity: sev, must: sev === 0 && !recv, due, daysLeft: d,
      title: `${debtCat(e.category).icon} ${recv ? (d < 0 ? t("{who} 借的钱已逾期", { who }) : t("{who} 借的钱快到期", { who })) : d < 0 ? t("还款已逾期：{who}", { who }) : t("还款快到期：{who}", { who })}`,
      detail: [d < 0 ? t("逾期 {d} 天", { d: -d }) : t("{d} 天后到期", { d }), left && (recv ? t("对方还欠 {a}", { a: left }) : t("还差 {a}", { a: left }))].filter(Boolean).join(" · "),
      href: link, badge: { label: d < 0 ? t("逾期") : t("{d} 天", { d }), cls: sev === 0 ? "b-out" : sev === 2 ? "b-soon" : "b-ok" },
      actions: [{ type: "link", href: link, label: recv ? t("记收款") : t("去还款"), cls: "btn-ghost" }] });
  }
  const pending = debts().filter((d) => d.asset_id && d.link_confirmed === false && !isClosedStatus(d.status));
  if (pending.length) out.push({ source: "debt", severity: 3, must: false, due: null, daysLeft: null, title: `🚙 ${t("确认车贷对应的车辆")}`,
    detail: t("{n} 笔车贷是按名字猜的车辆，确认后资产页才按它算", { n: pending.length }), href: debtHref(pending[0].id), badge: { label: t("待确认"), cls: "b-soon" }, actions: [{ type: "link", href: debtHref(pending[0].id), label: t("去确认"), cls: "btn-ghost" }] });
  return out;
}
registerAlerts(debtAlertItems);

/** 链接：借贷页、某笔贷款 */
export const debtHref = (id = null, extra = "") => `${href("bills", "debts")}${id ? `?id=${encodeURIComponent(id)}${extra}` : extra ? `?${extra.replace(/^&/, "")}` : ""}`;
