/* 撤销入库的计算（纯函数，没有界面；界面在 undo-restock.js）。数量都是存储单位，显示时再换成显示单位。
 *   corrected   这次入库之后，已经手动往下调过多少（`adjust` 日志里负数的合计，不含作废的，最多算到入库量）——
 *               例如有 2、误入库 +1、随后手动改回 2：corrected = 1，这次撤销就不用再扣了
 *   defaultDeduct  库存扣回多少（预填）= 入库量 − 实际入库量 − corrected，最少 0，最多不超过现有库存
 *   matchPurchase  这次入库对应哪笔花费：入库时记下的 purchase_id 优先；旧记录按「同一物品、时间差在几分钟内」找，只有唯一一个才算 */
const num = (v) => Number(v) || 0;
const r2 = (v) => Math.round(v * 100) / 100;
export const MATCH_MS = 5 * 60e3;

/** 这件物品能撤销的入库：restock、数量为正、没作废，新的在前 */
export const undoableRestocks = (logs, itemId) => (logs || []).filter((l) => l.item_id === itemId && l.reason === "restock" && num(l.delta) > 0 && !l.voided_at)
  .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)) || String(b.id).localeCompare(String(a.id)));
export function corrected(log, logs) {
  const t0 = new Date(log.created_at).getTime();
  const down = (logs || []).filter((l) => l.item_id === log.item_id && l.reason === "adjust" && num(l.delta) < 0 && !l.voided_at && new Date(l.created_at).getTime() >= t0)
    .reduce((s, l) => s - num(l.delta), 0);
  return r2(Math.min(down, num(log.delta)));
}
export function defaultDeduct({ delta, actual = 0, corrected: c = 0, qty }) {
  return r2(Math.max(0, Math.min(num(delta) - num(actual) - num(c), num(delta) - num(actual), num(qty))));
}
export function matchPurchase(log, purchases) {
  const list = purchases || [];
  if (log.purchase_id) return list.find((p) => p.id === log.purchase_id) || null;
  const t0 = new Date(log.created_at).getTime();
  const near = list.filter((p) => p.item_id === log.item_id && Math.abs(new Date(p.purchased_at).getTime() - t0) <= MATCH_MS);
  return near.length === 1 ? near[0] : null;
}
/** 这笔花费能不能随撤销一起删：不是银行 / 对账单导入的、没刷登记过的卡、是自己记的（本机演示模式没有记账人） */
export const purchaseDeletable = (p, myId) => !!p && !p.import_batch && !p.import_key && !p.card_id && (!p.created_by || !myId || p.created_by === myId);
