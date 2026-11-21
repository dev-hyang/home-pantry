// 账户分组：node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import { GROUPS, INVEST_SECTIONS, groupOfKind, summarizeRows } from "../js/bills/acct-groups.js";

test("种类 → 分组", () => {
  assert.equal(groupOfKind("credit"), "credit");
  assert.equal(groupOfKind("debit"), "bank");
  assert.equal(groupOfKind("checking"), "bank");
  assert.equal(groupOfKind("brokerage"), "invest");
  assert.equal(groupOfKind("education"), "invest");
  assert.equal(groupOfKind("kid"), "invest");
  assert.equal(groupOfKind("fsa"), "invest");
  assert.equal(groupOfKind("wallet"), "wallet");
  assert.equal(groupOfKind("gift"), "wallet");
  assert.equal(groupOfKind("loan"), null);
  assert.equal(groupOfKind("whatever"), "credit");
});
test("每种账户种类都在一个分组里，投资的每个种类都在某一块里", () => {
  const all = Object.values(GROUPS).flatMap((g) => g.kinds);
  assert.equal(new Set(all).size, all.length);
  for (const k of GROUPS.invest.kinds) assert.ok(INVEST_SECTIONS.some((s) => s.kinds.includes(k)), k);
});
test("小结：合计只算记了余额的，需要更新 = 没记或太久", () => {
  const rows = [{ balance: 100, side: "a" }, { balance: 50.5, side: "a", stale: true }, { balance: null, side: "a", missing: true }, { balance: 30, side: "a", viaDebt: true }];
  assert.deepEqual(summarizeRows(rows), { total: 150.5, n: 4, needUpdate: 2 });
});
