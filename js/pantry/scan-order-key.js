/* 线上订单去重：订单号 → 每一行花费的指纹（import_key，迁移 109 的列和唯一索引）。纯函数，不碰页面。
 * 订单号永远不发给 AI：文字里的订单号在本机换成占位符 [订单号#n]，AI 只回占位符的序号，再在本机换回订单号。
 * 同一个订单：第一行用「锚点」指纹，其余行用「订单号 + 行号」指纹；锚点已经在库里 = 这个订单整张录过。 */
import { hashKey } from "../stats/bank-keys-lib.js";

/** 一个订单的各行指纹：[锚点, 第 1 行, 第 2 行…]（长度 = 行数，第一行用锚点） */
export function orderRowKeys(ref, n) {
  if (!ref || n < 1) return [];
  return Array.from({ length: n }, (_, i) => hashKey(`order¦${ref}¦${i === 0 ? "A" : `L${i}`}`));
}
/** 只查锚点就知道这个订单是不是录过 */
export const orderAnchor = (ref) => (ref ? hashKey(`order¦${ref}¦A`) : null);

/** AI 回的占位符序号 → 订单号；只有一个订单号、一张小票、AI 没给序号时，直接配上。refs = 文字里按出现顺序的订单号 */
export function refForReceipt(n, refs, receiptCount) {
  if (Number.isInteger(n) && n >= 1 && n <= refs.length) return refs[n - 1];
  return refs.length === 1 && receiptCount === 1 ? refs[0] : null;
}

/** 确认入库前：给每张有订单号的小票的各行写上指纹（已录过又选了「仍然录入」的不写，否则撞唯一索引） */
export function keyOrderRows(boxes, rows, rcOf) {
  boxes.forEach((b, bi) => {
    const rc = rcOf(b); if (!rc?.orderRef || rc.refDup) return;
    const mine = rows.filter((x) => x.bi === bi);
    orderRowKeys(rc.orderRef, mine.length).forEach((k, i) => { mine[i].key = k; });
  });
}
