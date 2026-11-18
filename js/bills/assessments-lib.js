/* 特别摊派（Special Assessment）· 纯逻辑（Node 测试也引用）：
 * 一笔摊派 = 一张付款计划，一期一行 { due_on, amount, kind: installment | payoff, payment_id }。
 * 「前几期分期、最后一次性结清」就是几行 installment + 一行 payoff；缴了的期记着是哪次缴费交的（payment_id），回头能查。 */
const r2 = (v) => Math.round((Number.isFinite(+v) ? +v : 0) * 100) / 100;
export const monthEnd = (iso) => { const [y, m] = String(iso).slice(0, 7).split("-").map(Number); return `${y}-${String(m).padStart(2, "0")}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`; };
const addMonths = (iso, n) => { const [y, m, d] = iso.split("-").map(Number); const t = new Date(y, m - 1 + n, 1), last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`; };

/** 这条账单的摊派，带上排好序的各期和进度 */
export function assessmentsOf(billId, assess = [], items = []) {
  return assess.filter((a) => a.bill_id === billId).map((a) => {
    const rows = items.filter((x) => x.assessment_id === a.id).sort((x, y) => (x.due_on || "").localeCompare(y.due_on || "") || (x.kind === "payoff") - (y.kind === "payoff"));
    const total = r2(rows.reduce((s, x) => s + +x.amount, 0)), paid = r2(rows.filter((x) => x.payment_id).reduce((s, x) => s + +x.amount, 0));
    return { ...a, rows, total, paid, remaining: r2(total - paid), paidN: rows.filter((x) => x.payment_id).length, done: rows.length > 0 && rows.every((x) => x.payment_id) };
  }).sort((x, y) => (x.status === "closed") - (y.status === "closed") || (x.created_at || "").localeCompare(y.created_at || ""));
}
/** 还没缴、到期日不晚于 upto 的各期（进行中的摊派）；upto 省略 = 全部没缴的 */
export function unpaidItems(billId, assess = [], items = [], upto = null) {
  const live = new Set(assess.filter((a) => a.bill_id === billId && a.status !== "closed").map((a) => a.id));
  return items.filter((x) => live.has(x.assessment_id) && !x.payment_id && (!upto || (x.due_on || "") <= upto)).sort((x, y) => (x.due_on || "").localeCompare(y.due_on || ""));
}
/** 头部卡「费用总额」里的摊派部分：本期（到期日所在月底之前）要交的分期 / 一次性结清，分开累计 */
export function assessmentParts(billId, assess, items, periodDue) {
  const list = unpaidItems(billId, assess, items, periodDue ? monthEnd(periodDue) : null);
  const sum = (k) => r2(list.filter((x) => x.kind === k).reduce((s, x) => s + +x.amount, 0));
  return { installment: sum("installment"), payoff: sum("payoff"), ids: list.map((x) => x.id) };
}
/** 生成分期：count 期，每月一期，从 start 起；总额按期数分，零头放最后一期。返回 [{ due_on, amount, kind: "installment" }] */
export function genInstallments({ count, total = null, each = null, start }) {
  const n = Math.max(1, Math.min(120, Math.floor(+count) || 0)); if (!start || !n) return [];
  const sum = total != null ? r2(total) : r2(+each * n), per = Math.floor((sum / n) * 100) / 100;
  return Array.from({ length: n }, (_, i) => ({ due_on: addMonths(start, i), amount: i === n - 1 ? r2(sum - per * (n - 1)) : per, kind: "installment" }));
}
