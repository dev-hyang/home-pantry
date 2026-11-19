import { Store } from "../core/store.js";
import * as A from "../core/amortization.js";
import { isPersonalDebt } from "../core/debt-rules.js";
import { monthlyEquivalent } from "./logic.js";
import { schemaFlags } from "../core/store.js";
import "./debt-personal-logic.js";
import { canSplit, debtOfBill, enrichDebt, piOf, r2, txnsOf } from "./debt-logic-common.js";

/** 迁移 060 执行了没有（第一期还款日 / Escrow 计划 / 对账单校准 / 额外本金这几列）：没执行时这些字段不显示、不保存 */
export const debt060 = () => Store.mode !== "cloud" || schemaFlags.debt060;
export { bankEscrowAt, billOfDebt, canSplit, debtById, debtOfBill, debtOfIncome, debtTxns, debts, debtsEnriched, enrichDebt, escrowFor, loadDebts, piOf, txnsOf } from "./debt-logic-common.js";
export { beforeDeletePayment, calibrateDebt, clearOverride, overrideSplit, paymentTable, resplitDebt, setExtraPrincipal, splitBillPayment, unsplitDebt } from "./debt-split-logic.js";
export { debtAlertItems, debtHref, deleteDebtTxn, ensureBorrowDebt, payOffForAsset, recordDebtTxn, relinkPaymentPurchase, syncDebtStatus, syncVehicle, updateDebtTxn } from "./debt-personal-logic.js";
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
/** 预算 / 报表里「均摊月均」：拆分后房贷的本金不算住房消费 → 每月折算减去本金部分（本金估算 = 每期本息 − 当前余额 × 期利率） */
export function billExpenseMonthly(b) {
  const d = debtOfBill(b);
  if (!d || !canSplit(d) || !(b.monthly > 0)) return b.monthly;
  const e = enrichDebt(d); if (e.balance == null || !(e.pi > 0)) return b.monthly;
  const principal = Math.max(0, e.pi - r2(e.balance * e.rate));
  return Math.max(0, r2(b.monthly - monthlyEquivalent({ frequency: e.freq === "semimonthly" ? "biweekly" : e.freq }, principal)));
}
