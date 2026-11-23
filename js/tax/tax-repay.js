/* 税务 · 标了「需要还」的赠与 / 电汇，税务上算不算赠与（纯函数，不碰页面和 state；tax-calendar.js 的 repayTreatment 把当前数据传进来）。
 *  · 没标「需要还」：算赠与（"gift"）；
 *  · 当年关了「标了需要还的也按赠与算」：按借款（"toggle"）；
 *  · 关联的借贷是正式借款（debt-rules.js isFormalDebt：银行类，或亲友借贷有书面借据 + 利息 / 还款计划）：按借款（"formal"）；
 *  · 其余（没关联借贷 / 借据未填 / 口头 / 没有借据）：算赠与——没有正式借据和还款安排的「借款」，IRS 可能当赠与。 */
import { isFormalDebt } from "../core/debt-rules.js";

export function repayTreatmentOf(r, { repayAsGift, debts = [], debtTxns = [] } = {}) {
  if (!r.repay_required) return "gift";
  if (repayAsGift === false) return "toggle";
  const tx = debtTxns.find((x) => x.income_record_id === r.id);
  const debt = tx ? debts.find((d) => d.id === tx.debt_id) : debts.find((d) => d.source_key === `income:${r.id}`);
  return isFormalDebt(debt) ? "formal" : "gift";
}
