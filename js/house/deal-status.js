/* 房产状态怎么跟着交易走（纯函数，不碰页面 / 数据库）。一套房可以同时有一笔进行中的买入和一笔进行中的卖出（迁移 108）：
 *  · 卖出优先：只要有卖出在进行，状态就是「卖出中」（selling）；
 *  · 没有卖出但有买入在进行 = 买入中（buying）；退租（move_out）不改状态；
 *  · 都没有 = 退回这类交易开始之前的状态。 */
/** 开始一笔交易后的状态 */
export function statusAfterStart(p, kind) {
  if (kind === "sell") return "selling";
  if (kind === "buy") return p.status === "selling" ? "selling" : "buying";
  return p.status;
}
/** 取消一笔交易后的状态；restKinds = 取消之后这套房还在进行的交易类型 */
export function statusAfterCancel(p, kind, restKinds) {
  if (restKinds.includes("sell")) return "selling";
  if (restKinds.includes("buy")) return "buying";
  return kind === "buy" ? (p.acquired_on ? "owned" : "looking") : kind === "sell" ? "owned" : "renting";
}
/** 买入交割后的状态：卖出还在进行就仍是「卖出中」，否则持有 */
export const statusAfterBuyClosed = (sellOpen) => (sellOpen ? "selling" : "owned");
