/* 对账单导入指纹：同样的输入永远同样的指纹；账户不同指纹不同；字符集和长度符合数据库约束 */
import test from "node:test";
import assert from "node:assert/strict";
import { acctKeyOf, hashKey, importKeyOf } from "../js/stats/bank-keys-lib.js";

test("哈希：稳定、18 位、只有小写字母和数字（符合 import_key 的约束）", () => {
  const k = hashKey("2026-11-20|45.67|TARGET 12345 MPLS#1");
  assert.equal(k, hashKey("2026-11-20|45.67|TARGET 12345 MPLS#1"));
  assert.match(k, /^[a-z0-9]{18}$/);
  assert.notEqual(k, hashKey("2026-11-20|45.67|TARGET 12345 MPLS#2"));
});
test("哈希：一批相近的输入没有撞的", () => {
  const seen = new Set(); for (let i = 0; i < 5000; i++) seen.add(hashKey(`2026-11-${(i % 28) + 1}|${(i * 7.31).toFixed(2)}|SHOP ${i}#1`));
  assert.equal(seen.size, 5000);
});
test("账户身份：尾号优先，其次 id，没选为空", () => {
  assert.equal(acctKeyOf({ mode: "none" }), "");
  assert.equal(acctKeyOf({ mode: "id", id: "card:abc", last4: "0934" }), "0934");
  assert.equal(acctKeyOf({ mode: "id", id: "card:abc", last4: "" }), "card:abc");
  assert.equal(acctKeyOf({ mode: "new", last4: "1234" }), "1234");
  assert.equal(acctKeyOf({ mode: "new", last4: "" }), "");
});
test("指纹：同一行不同账户不同；同账户同一行相同", () => {
  const fk = "2026-11-20|45.67|TARGET#1";
  assert.equal(importKeyOf("0934", fk), importKeyOf("0934", fk));
  assert.notEqual(importKeyOf("0934", fk), importKeyOf("1111", fk));
  assert.notEqual(importKeyOf("", fk), importKeyOf("0934", fk));
});
