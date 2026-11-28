/* 线上订单去重指纹 */
import test from "node:test";
import assert from "node:assert/strict";
import { orderAnchor, orderRowKeys, refForReceipt } from "../js/pantry/scan-order-key.js";

test("同一个订单号永远得到同一组指纹；第一行就是锚点；符合数据库 import_key 的格式", () => {
  const a = orderRowKeys("112-5961739-3293804", 3), b = orderRowKeys("112-5961739-3293804", 3);
  assert.deepEqual(a, b);
  assert.equal(a[0], orderAnchor("112-5961739-3293804"));
  assert.equal(new Set(a).size, 3);
  for (const k of a) assert.match(k, /^[a-z0-9]{8,40}$/);
});

test("不同订单号的指纹不一样；没有订单号 = 不做指纹", () => {
  assert.notEqual(orderAnchor("112-0000001-0000001"), orderAnchor("112-0000002-0000002"));
  assert.deepEqual(orderRowKeys(null, 3), []);
  assert.equal(orderAnchor(""), null);
});

test("占位符序号 → 订单号；只有一个订单号一张小票时直接配上", () => {
  const refs = ["112-1111111-1111111", "113-2222222-2222222"];
  assert.equal(refForReceipt(2, refs, 2), refs[1]);
  assert.equal(refForReceipt(null, refs, 2), null);   // 两个订单号、AI 没说是哪个：不猜
  assert.equal(refForReceipt(9, refs, 2), null);
  assert.equal(refForReceipt(null, [refs[0]], 1), refs[0]);
});

test("确认入库前给每张有订单号的小票的行写指纹；已录过又强制再录的不写；没订单号的不写", async () => {
  const { keyOrderRows } = await import("../js/pantry/scan-order-key.js");
  const receipts = [{ orderRef: "112-1111111-1111111" }, { orderRef: "113-2222222-2222222", refDup: true }, {}];
  const boxes = receipts.map((_, i) => ({ dataset: { r: i } })), rcOf = (b) => receipts[+b.dataset.r];
  const rows = [{ bi: 0 }, { bi: 0 }, { bi: 1 }, { bi: 2 }];
  keyOrderRows(boxes, rows, rcOf);
  assert.deepEqual(rows.map((r) => !!r.key), [true, true, false, false]);
  assert.equal(rows[0].key, orderAnchor("112-1111111-1111111"));
  assert.notEqual(rows[0].key, rows[1].key);
});

test("订单行的指纹 22 位、前 18 位 = 订单组；银行导入的 18 位指纹不是订单行", async () => {
  const { orderGroup } = await import("../js/pantry/scan-order-key.js");
  const ks = orderRowKeys("112-5555555-5555555", 3);
  assert.ok(ks.every((k) => k.length === 22 && /^[a-z0-9]+$/.test(k)));
  assert.equal(new Set(ks.map(orderGroup)).size, 1);
  assert.equal(orderGroup("abcdefgh1234567890"), null);
  assert.equal(orderGroup(null), null);
});
