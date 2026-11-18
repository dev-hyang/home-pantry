/* 一笔缴费实际花了多少：本期金额 + 特别摊派 + 手续费 + 税 + 滞纳金。纯函数（Node 测试也引用）。
 * 贷款账单的缴费（摊还表拆分）仍按 本期金额 + 滞纳金 算：它们没有手续费 / 税 / 摊派。 */
const n = (v) => (Number.isFinite(+v) ? +v : 0);
export const payExtras = (p) => Math.round((n(p?.assessment_amount) + n(p?.fee_amount) + n(p?.tax_amount)) * 100) / 100;
export const payTotal = (p) => Math.round((n(p?.amount) + n(p?.late_fee) + payExtras(p)) * 100) / 100;
