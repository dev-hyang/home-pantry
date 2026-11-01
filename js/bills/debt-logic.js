/* 借贷（财务 P2，迁移 058）· 计算与写入：贷款的余额、下次还款、逾期；账单缴费时按摊还表拆 本金 / 利息 / Escrow；
 * 亲友借贷的放款 / 还款 / 利息；车辆「贷款中」状态和车贷同步；提醒。
 * 数据量：debt_accounts / debt_transactions 是小表（几笔贷款，每笔最多几百条流水），启动时整表读进内存（state.debts / state.debtTxns），在内存里算。
 * 只有「重新拆分历史还款」要读这条账单的全部缴费（内存里只有近 400 天的）：按账单 id 读一次（最多几百行）。
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
const normDebt = (d) => ({ ...d, original_principal: nOrNull(d.original_principal), interest_rate: nOrNull(d.interest_rate), term_months: nOrNull(d.term_months), scheduled_payment: nOrNull(d.scheduled_payment), opening_balance: nOrNull(d.opening_balance) });
const normTxn = (x) => ({ ...x, principal_amount: num(x.principal_amount), interest_amount: num(x.interest_amount), fee_amount: num(x.fee_amount), escrow_amount: num(x.escrow_amount), total: num(x.total) });
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
const freqOf = (d) => (d.payment_frequency && d.payment_frequency !== "none" ? d.payment_frequency : "monthly");

/** 房贷类（挂在房产上）且这套房产有 Escrow 代缴账单：月供里含 Escrow */
export function escrowFor(d, bill = billOfDebt(d)) {
  if (!["mortgage", "heloc", "home_equity"].includes(d.category)) return 0;
  const pid = d.property_id || bill?.property_id || null;
  const m = escrowMonthlyFor(pid);
  return m > 0 ? r2((m * 12) / (A.PERIODS_PER_YEAR[freqOf(d)] || 12)) : 0;   // 折成每期
}
/** 每期本息（不含 Escrow）：本金 + 利率 + 期限都有 → 等额本息公式；否则 每期还款（或账单金额）− Escrow */
export function piOf(d, bill = billOfDebt(d)) {
  const n = A.periodsOf(d.term_months, freqOf(d));
  if (d.original_principal > 0 && d.interest_rate != null && n) return A.payment(d.original_principal, d.interest_rate, n, freqOf(d));
  const total = d.scheduled_payment ?? bill?.est ?? null;
  return total == null ? null : r2(Math.max(0, num(total) - escrowFor(d, bill)));
}
/** 能不能按摊还表拆分：填了利率，并且知道某个时点的本金（原始本金 / 某天的余额 / 放款记录）；亲友借贷不按账单拆 */
export const canSplit = (d) => !!d && !isPersonalDebt(d) && d.interest_rate != null && !!A.balanceAnchor(d, txnsOf(d.id));

/** 贷款的派生信息：余额、已还、下次还款、逾期、预计还清、关联的账单 / 资产 */
export function enrichDebt(d) {
  const txns = txnsOf(d.id), bill = billOfDebt(d), balance = A.outstanding(d, txns), paid = A.paidTotals(d, txns);
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
  return { ...d, txns, bill, balance, paid, pi, rate, freq, nextDue, overdue, status, payoff, left, asset, property, original, escrow: escrowFor(d, bill), split: canSplit(d) };
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
      escrow_amount: s.escrow, total, bill_payment_id: p.id, purchase_id: pid, income_record_id: null, income_repayment_id: null, split_source: s.source || "schedule", notes: old?.notes || null });
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

/** 按摊还表重新拆分这笔贷款的全部历史还款（手动改过的保留）；返回拆了几笔。不能拆（缺利率 / 本金）返回 0 */
export async function resplitDebt(d) {
  const bill = billOfDebt(d); if (!bill || !canSplit(d)) return 0;
  const pays = (await Store.listPaymentsOfBill(bill.id)).filter((p) => p.status !== "skipped" && num(p.amount) > 0 && p.purchase_id);
  const txns = txnsOf(d.id);
  const manual = new Map(txns.filter((x) => x.split_source === "manual" && x.bill_payment_id).map((x) => [x.bill_payment_id, { principal: x.principal_amount, interest: x.interest_amount, escrow: x.escrow_amount, fee: x.fee_amount }]));
  const pi = piOf(d, bill), esc = escrowFor(d, bill);
  const escrowOf = (p, piv) => A.escrowPortion({ paid: num(p.amount), pi: piv, hasEscrow: esc > 0, cap: esc > 0 ? esc * 1.5 : null });
  const splits = A.splitHistory({ debt: d, payments: pays, others: txns.filter((x) => !x.bill_payment_id), manual, escrowOf, pi });
  return writeSplits(d, bill, pays.filter((p) => splits.has(p.id)).map((p) => ({ p, s: splits.get(p.id) })));
}

/** 记了 / 改了一笔账单缴费：这条账单挂着能拆分的贷款就拆。payment = 缴费记录（含 id、purchase_id） */
export async function splitBillPayment(bill, payment) {
  const d = debtOfBill(bill);
  if (!d || !payment?.purchase_id || payment.status === "skipped" || !(num(payment.amount) > 0)) return false;
  const old = debtTxns().find((x) => x.bill_payment_id === payment.id);
  if (!canSplit(d)) return false;
  // 起点（某天的余额）之前补记的旧账：整段重算；手动改过且金额没变的：保留手动拆分
  if (d.opening_balance_on && payment.paid_on <= d.opening_balance_on) return !!(await resplitDebt(d));
  const total = r2(num(payment.amount) + num(payment.late_fee));
  if (old?.split_source === "manual" && Math.abs(old.total - total) < 0.005) return !!(await writeSplits(d, bill, [{ p: payment, s: { principal: old.principal_amount, interest: old.interest_amount, escrow: old.escrow_amount, fee: old.fee_amount, source: "manual" } }]));
  const others = txnsOf(d.id).filter((x) => x.id !== old?.id && !(x.bill_payment_id && x.txn_date > payment.paid_on));
  const balance = A.outstanding(d, others, payment.paid_on);
  const pi = piOf(d, bill), esc = escrowFor(d, bill);
  const s = A.splitPayment({ balance, rate: A.periodRate(d.interest_rate, freqOf(d)), paid: num(payment.amount), fee: num(payment.late_fee),
    escrow: A.escrowPortion({ paid: num(payment.amount), pi, hasEscrow: esc > 0, cap: esc > 0 ? esc * 1.5 : null }) });
  await writeSplits(d, bill, [{ p: payment, s: { ...s, source: "schedule" } }]);
  await syncDebtStatus(d.id);
  return true;
}
/** 删一笔账单缴费之前：删掉它的本金行（流水随缴费记录级联删除） */
export async function beforeDeletePayment(paymentId) {
  const x = debtTxns().find((y) => y.bill_payment_id === paymentId);
  if (x?.purchase_id) await Store.deletePurchases([x.purchase_id]);
  if (x) { await Store.deleteDebtTxns([x.id]); state.debtTxns = debtTxns().filter((y) => y.id !== x.id); }
}
/** 手动改一期的拆分（按对账单）：split_source = manual，重新拆分时不覆盖 */
export async function overrideSplit(d, paymentId, { principal, interest, escrow }) {
  const bill = billOfDebt(d); if (!bill) return;
  const p = (await Store.listPaymentsOfBill(bill.id)).find((x) => x.id === paymentId); if (!p) return;
  const total = r2(num(p.amount)), pr = r2(Math.max(0, Math.min(total, num(principal)))), es = r2(Math.max(0, Math.min(total - pr, num(escrow))));
  const it = interest === "" || interest == null ? r2(total - pr - es) : r2(Math.max(0, num(interest)));
  await writeSplits(d, bill, [{ p, s: { principal: pr, interest: it, escrow: es, fee: num(p.late_fee), source: "manual" } }]);
  await syncDebtStatus(d.id);
}
/** 撤销手动拆分：回到按摊还表 */
export async function clearOverride(d, paymentId) {
  const x = debtTxns().find((y) => y.bill_payment_id === paymentId);
  if (x) { await Store.upsertDebtTxns([{ ...x, split_source: "schedule" }]); state.debtTxns = debtTxns().map((y) => (y.id === x.id ? { ...y, split_source: "schedule" } : y)); }
  await resplitDebt(debtById(d.id) || d);
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
