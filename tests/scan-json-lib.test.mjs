/* 订单 JSON 导入：校验与整理 */
import test from "node:test";
import assert from "node:assert/strict";
import { parseOrders, parseOrdersText, partOf } from "../js/pantry/scan-json-lib.js";

const sample = { v: 1, source: "amazon", from: "2026-10-01", to: "2026-10-31", part: "1/2", orders: [
  { order_ref: "112-5961739-3293804", date: "2026-10-12", store: "Amazon", currency: "USD", total: 69.49, card_last4: "1234",
    lines: [{ name: "Chocolate bar", qty: 1, amount: 23.43 }, { name: "Instant Pot accessories", qty: 2, amount: "$28.49" }, { name: "Tax", fee: "tax", amount: 4.92 }, { name: "", amount: 1 }] },
  { order_ref: "bad ref!", date: "not-a-date", lines: [{ name: "Soap", amount: 6.49 }] },
  { order_ref: "x", date: "2026-10-13", lines: [] },
] };

test("整理成识别结果的形状：商品、税费行、金额字符串、没名字的行丢掉", () => {
  const r = parseOrders(sample);
  assert.equal(r.receipts.length, 2);
  assert.equal(r.skipped, 1);
  assert.deepEqual(r.receipts[0].lines.map((l) => [l.name, l.qty, l.amount, l.fee || null]), [["Chocolate bar", 1, 23.43, null], ["Instant Pot accessories", 2, 28.49, null], ["Tax", 1, 4.92, "tax"]]);
  assert.equal(r.receipts[0].total, 69.49);
  assert.deepEqual(r.meta[0], { orderRef: "112-5961739-3293804", cardLast4: "1234" });
});

test("订单号格式不对 = 不去重；日期不对 = null（页面上用今天并标红）；商店默认 Amazon", () => {
  const r = parseOrders(sample);
  assert.equal(r.meta[1].orderRef, null);
  assert.equal(r.receipts[1].date, null);
  assert.equal(r.receipts[1].store, "Amazon");
});

test("不是我们的格式 / 太多订单 / 没有商品：报清楚的错", () => {
  assert.throws(() => parseOrders({ orders: [] }), /格式不对/);
  assert.throws(() => parseOrders({ v: 1, orders: Array.from({ length: 201 }, () => ({})) }), /最多 200/);
  assert.throws(() => parseOrders({ v: 1, orders: [{ lines: [] }] }), /没有读到/);
});

test("文本：容忍代码块和前后说明；截断的 JSON 报错", () => {
  assert.equal(parseOrdersText("```json\n" + JSON.stringify(sample) + "\n```").v, 1);
  assert.equal(parseOrdersText("下面是 JSON：" + JSON.stringify(sample) + " 完").v, 1);
  assert.throws(() => parseOrdersText(JSON.stringify(sample).slice(0, 80)), /读不出/);
  assert.throws(() => parseOrdersText("   "), /还没有内容/);
});

test("part：2/3 → 第几份 / 共几份", () => {
  assert.deepEqual(partOf("2/3"), { n: 2, m: 3 });
  assert.equal(partOf("3/2"), null);
  assert.equal(partOf(""), null);
});
