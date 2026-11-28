/* 订单文字发给 AI 之前的本机脱敏 */
import test from "node:test";
import assert from "node:assert/strict";
import { redactOrderText, droppedTotal } from "../js/pantry/scan-redact.js";

const sample = [
  "Hello Jane,",
  "Order placed November 2, 2026",
  "Order # 112-5961739-3293804",
  "Ship to",
  "Jane Doe",
  "123 Main Street Apt 4",
  "Springfield, IL 62704",
  "United States",
  "Total $69.49",
  "Ferrero Rocher Premium Chocolate Bar, 8 Pack",
  "$23.43",
  "Payment method: Visa ending in 1234",
  "Questions? jane.doe@example.com or (555) 123-4567",
  "Tracking TBA123456789012",
].join("\n");

test("地址块、姓名、电话、邮箱、卡尾号、订单号都被抹掉，商品和价格保留", () => {
  const r = redactOrderText(sample);
  for (const bad of ["Jane", "Doe", "123 Main", "Springfield", "62704", "jane.doe@", "555", "1234", "TBA1234", "112-5961739"]) assert.ok(!r.text.includes(bad), `不该残留：${bad}`);
  for (const ok of ["November 2, 2026", "Total $69.49", "Ferrero Rocher Premium Chocolate Bar", "$23.43"]) assert.ok(r.text.includes(ok), `应保留：${ok}`);
  assert.deepEqual(r.orderRefs, ["112-5961739-3293804"]);
  assert.ok(droppedTotal(r.dropped) >= 6);
});

test("地址块遇到金额 / 别的字段就停，不吃掉后面的商品行", () => {
  const r = redactOrderText("Ship to\nJane Doe\nTotal $10.00\nSoap\n$3.00");
  assert.equal(r.text, "Total $10.00\nSoap\n$3.00");
});

test("没有个人信息的文字原样保留；空输入不报错", () => {
  const t = "Dish soap refill 2 x $6.49\nTax $1.04";
  assert.equal(redactOrderText(t).text, t);
  assert.equal(redactOrderText("").text, "");
  assert.equal(redactOrderText(null).text, "");
});

test("价格里的小数和日期不会被当成电话 / 卡号", () => {
  const t = "Order placed 11/02/2026\nItem $1,234.56\nQty 2";
  assert.equal(redactOrderText(t).text, t);
});

test("同一个订单号出现多次只记一次；多个订单号都记下", () => {
  const r = redactOrderText("Order # 112-1111111-2222222\nOrder # 112-1111111-2222222\nOrder # 113-3333333-4444444");
  assert.deepEqual(r.orderRefs, ["112-1111111-2222222", "113-3333333-4444444"]);
  assert.ok(!/\d{3}-\d{7}-\d{7}/.test(r.text));
  assert.equal(r.text, ["Order # [订单号#1]", "Order # [订单号#1]", "Order # [订单号#2]"].join("\n"));   // 占位符按订单号出现顺序编号
});
