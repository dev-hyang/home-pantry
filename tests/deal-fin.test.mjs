/* 交易付款方式：条件匹配、没选按贷款算、前置依赖在步骤缺失时往前找 */
import test from "node:test";
import assert from "node:assert/strict";
import { finMatches, hasFinancing, isCash, resolveDeps } from "../js/house/deal-fin.js";

test("没选付款方式按贷款算；现金才算现金", () => {
  assert.equal(isCash({}), false); assert.equal(isCash({ financing: "loan" }), false); assert.equal(isCash({ financing: "cash" }), true);
  assert.equal(finMatches("fin:loan", {}), true); assert.equal(finMatches("fin:cash", {}), false);
  assert.equal(finMatches("fin:loan", { financing: "cash" }), false); assert.equal(finMatches("fin:cash", { financing: "cash" }), true);
});
test("买入 / 卖出 / 买车 / 卖车有付款方式，退租和归还没有", () => {
  for (const k of ["buy", "sell", "veh_buy", "veh_sell"]) assert.equal(hasFinancing({ kind: k }), true);
  for (const k of ["move_out", "veh_return"]) assert.equal(hasFinancing({ kind: k }), false);
});
test("依赖：缺失的前置步骤换成它自己的前置步骤（一路往前）", () => {
  const raw = { review: ["earnest"], docs: ["review"], appraisal: ["docs"], commitment: ["appraisal"], insurance: ["commitment"], funds: ["commitment"], closing: ["funds", "commitment", "wire"], wire: ["review"] };
  const cash = new Set(["earnest", "review", "insurance", "funds", "closing", "wire"]);   // 没有 docs / appraisal / commitment
  const d = resolveDeps(raw, cash);
  assert.deepEqual(d.insurance, ["review"]); assert.deepEqual(d.funds, ["review"]);
  assert.deepEqual(d.closing.sort(), ["funds", "review", "wire"]);
  const loan = new Set(Object.keys(raw).concat("earnest"));
  assert.deepEqual(resolveDeps(raw, loan).insurance, ["commitment"]);   // 贷款：不变
});
test("依赖成环不会死循环", () => {
  const d = resolveDeps({ a: ["b"], b: ["a"] }, new Set(["x"]));
  assert.deepEqual(d, { a: [], b: [] });
});
