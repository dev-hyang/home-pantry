/* 录入购物（线上订单）：订单号去重的接线。订单号只在本机：文字里的订单号换成占位符才发给 AI，这里再按占位符序号配回来。
 * 指纹规则见 scan-order-key.js；库里已有同一订单的锚点指纹 = 这个订单录过了（需要迁移 109，没执行就当没有）。 */
import { Store } from "../core/store.js";
import { sc } from "./scan-common.js";
import { redactOrderText } from "./scan-redact.js";
import { orderAnchor, refForReceipt } from "./scan-order-key.js";

/** 识别完：给每张小票配上订单号，并查库里是不是已经录过（录过的默认不录，除非用户勾选「仍然录入」） */
export async function markOrderRefs(receipts) {
  if (sc.kind !== "order" || sc.record === "stock") return;   // 只入库不写花费，没有指纹可言
  const refs = redactOrderText(sc.text).orderRefs;
  if (!refs.length) return;
  for (const rc of receipts) rc.orderRef = refForReceipt(rc.refNo, refs, receipts.length);
  const anchors = receipts.map((rc) => orderAnchor(rc.orderRef)).filter(Boolean);
  if (!anchors.length) return;
  let have; try { have = await Store.importKeysExist(anchors); } catch { return; }   // 查不到就当没录过，照常录
  for (const rc of receipts) if (rc.orderRef && have.has(orderAnchor(rc.orderRef))) { rc.refDup = true; rc.include = false; }
}

/** 记花费：带指纹；数据库还没执行迁移 109（没有 import_key 列）就不带指纹照旧记 */
export async function addKeyed(p) {
  try { return await Store.addPurchase(p); }
  catch (e) {
    if (p.import_key && /import_key/i.test(e.message) && !/duplicate|unique/i.test(e.message)) { const { import_key, ...rest } = p; return Store.addPurchase(rest); }
    throw e;
  }
}
