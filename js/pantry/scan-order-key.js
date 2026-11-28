/* 线上订单去重：订单号 → 每一行花费的指纹（import_key，迁移 109 的列和唯一索引）。纯函数，不碰页面。
 * 订单号永远不发给 AI：文字里的订单号在本机换成占位符 [订单号#n]，AI 只回占位符的序号，再在本机换回订单号。
 * 锚点已经在库里 = 这个订单整张录过。 */
import { hashKey } from "../stats/bank-keys-lib.js";

/* 指纹 = 订单组（订单号的哈希，18 位）+ 行号（4 位 36 进制）= 22 位，符合 import_key 的格式（8–40 位小写字母数字）。
 * 银行对账单的指纹是 18 位；22 位 = 订单行。同一个订单的所有行前 18 位相同，所以以后能把它们归成「同一个订单」（对账单匹配用）。 */
const GROUP_LEN = 18;
const orderGroupOf = (ref) => hashKey(`order¦${ref}`);
const lineSuffix = (i) => i.toString(36).padStart(4, "0");

/** 一个订单的各行指纹：[第 0 行（锚点）, 第 1 行…]（长度 = 行数） */
export function orderRowKeys(ref, n) {
  if (!ref || n < 1) return [];
  const g = orderGroupOf(ref);
  return Array.from({ length: n }, (_, i) => g + lineSuffix(i));
}
/** 只查锚点（第 0 行）就知道这个订单是不是录过 */
export const orderAnchor = (ref) => (ref ? orderGroupOf(ref) + lineSuffix(0) : null);
/** 订单行的指纹 → 订单组；不是订单行（银行导入的 18 位指纹、没有指纹）返回 null */
export const orderGroup = (key) => (typeof key === "string" && key.length === GROUP_LEN + 4 ? key.slice(0, GROUP_LEN) : null);

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
