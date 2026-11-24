/* 买入 / 卖出可以同时进行时，房产状态怎么算：卖出优先 */
import test from "node:test";
import assert from "node:assert/strict";
import { statusAfterBuyClosed, statusAfterCancel, statusAfterStart } from "../js/house/deal-status.js";

test("开始交易：卖出 → 卖出中；买入 → 买入中，但卖出已在进行就仍是卖出中；退租不改", () => {
  assert.equal(statusAfterStart({ status: "owned" }, "sell"), "selling");
  assert.equal(statusAfterStart({ status: "looking" }, "buy"), "buying");
  assert.equal(statusAfterStart({ status: "selling" }, "buy"), "selling");
  assert.equal(statusAfterStart({ status: "renting" }, "move_out"), "renting");
});
test("取消：还有卖出 → 卖出中；只剩买入 → 买入中；都没了 → 退回开始前", () => {
  const p = { status: "selling", acquired_on: "2026-06-05" };
  assert.equal(statusAfterCancel(p, "buy", ["sell"]), "selling");
  assert.equal(statusAfterCancel(p, "sell", ["buy"]), "buying");
  assert.equal(statusAfterCancel(p, "sell", []), "owned");
  assert.equal(statusAfterCancel({ status: "buying", acquired_on: null }, "buy", []), "looking");
  assert.equal(statusAfterCancel({ status: "buying", acquired_on: "2026-06-05" }, "buy", []), "owned");
  assert.equal(statusAfterCancel({ status: "renting" }, "move_out", []), "renting");
  assert.equal(statusAfterCancel(p, "sell", ["buy", "sell"]), "selling");   // 卖出优先
});
test("买入交割：卖出还在进行就仍是卖出中，否则持有", () => {
  assert.equal(statusAfterBuyClosed(true), "selling");
  assert.equal(statusAfterBuyClosed(false), "owned");
});
