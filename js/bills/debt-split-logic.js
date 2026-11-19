/* 借贷：账单缴费 ↔ 本金 / 利息拆分。 */
import * as A from "../core/amortization.js";
import { Store } from "../core/store.js";
import { interestLeafOf, principalLeafOf } from "../core/debt-rules.js";
import { num, uid } from "../core/util.js";
import { spendChanged } from "../core/spend-data.js";
import { state } from "../core/state.js";
import { syncDebtStatus } from "./debt-personal-logic.js";
import { t } from "../core/i18n.js";
import { bankEscrowAt, billOfDebt, canSplit, debtById, debtOfBill, debtTxns, normTxn, piOf, r2, txnsOf } from "./debt-logic-common.js";

/* ───────────── 账单缴费 ↔ 本金 / 利息拆分 ─────────────
 * 一笔缴费 = 两行花费：主行（bill_payments.purchase_id）= 利息 + Escrow + 滞纳金（分类见 interestLeafOf），本金行 = bill_<分类> + 性质「融资」。
 * 再加一条借贷流水（bill_payment_id 唯一）记拆分，本金行挂在流水的 purchase_id 上。 */
export const isoAt = (d) => new Date(`${d}T12:00:00`).toISOString();
export async function writeSplits(d, bill, items) {
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
export async function engineInput(d, bill, { overwrite = false, extraPatch = null } = {}) {
  const pays = (await Store.listPaymentsOfBill(bill.id)).filter((p) => p.status !== "skipped" && num(p.amount) > 0 && p.purchase_id);
  const txns = txnsOf(d.id), split = txns.filter((x) => x.bill_payment_id);
  const manual = overwrite ? new Map() : new Map(split.filter((x) => x.split_source === "manual").map((x) => [x.bill_payment_id, { principal: x.principal_amount, interest: x.interest_amount, escrow: x.escrow_amount, fee: x.fee_amount, extra: x.extra_principal }]));
  const extras = new Map(split.filter((x) => x.extra_principal > 0).map((x) => [x.bill_payment_id, x.extra_principal]));
  if (extraPatch) for (const [k, v] of extraPatch) { if (v > 0) extras.set(k, v); else extras.delete(k); }
  return { pays, txns, manual, extras };
}
export const runEngine = (d, bill, { pays, txns, manual, extras }) => A.splitBySchedule({ debt: d, payments: pays, others: txns.filter((x) => !x.bill_payment_id), manual, extras, pi: piOf(d, bill) });
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
