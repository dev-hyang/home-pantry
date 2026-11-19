/* 借贷：亲友借贷（不挂账单的还款）、还清 ↔ 车辆「贷款中」状态同步、提醒。 */
import { DEBT_INTEREST_LEAF, DEBT_PRINCIPAL_LEAF, debtCat, isClosedStatus } from "../core/debt-rules.js";
import { Store } from "../core/store.js";
import { daysUntil, money, todayISO } from "../core/util.js";
import { engineInput, isoAt, runEngine, writeSplits } from "./debt-split-logic.js";
import { financeOk } from "../core/finance-access.js";
import { href } from "../core/router.js";
import { registerAlerts } from "../core/alerts.js";
import { spendChanged } from "../core/spend-data.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";
import { billOfDebt, canSplit, debtById, debtOfIncome, debtTxns, debts, debtsEnriched, enrichDebt, loadDebts, normTxn, r2 } from "./debt-logic-common.js";

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
