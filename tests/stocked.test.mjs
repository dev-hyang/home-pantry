// 入库口径：新物品（created_at）、补货入库（restock 日志）、最近入库 = 较晚的一个：node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import "./_dom-stub.mjs";
import "./_win-stub.mjs";
import { state } from "../js/core/state.js";
import { addedMatch, stockedAt } from "../js/pantry/stocked.js";

const DAY = 864e5, now = Date.parse("2026-11-27T12:00:00Z"), ago = (d) => new Date(now - d * DAY).toISOString();
const item = (id, created) => ({ id, created_at: ago(created) });
state.logs = [
  { item_id: "a", reason: "restock", delta: 2, created_at: ago(3) },
  { item_id: "a", reason: "consume", delta: -1, created_at: ago(1) },   // 用掉不算入库
  { item_id: "b", reason: "restock", delta: 1, created_at: ago(40) },
  { item_id: "c", reason: "restock", delta: -1, created_at: ago(2) },   // 负数不算
];

test("补货入库：近 7 天里点过 + 的算", () => {
  assert.equal(addedMatch(item("a", 100), 7, "restock", now), true);
  assert.equal(addedMatch(item("b", 100), 7, "restock", now), false);
  assert.equal(addedMatch(item("b", 100), 90, "restock", now), true);
});
test("新物品：只看 created_at", () => {
  assert.equal(addedMatch(item("n", 5), 7, "new", now), true);
  assert.equal(addedMatch(item("n", 5), 7, "restock", now), false);
  assert.equal(addedMatch(item("a", 100), 7, "new", now), false);
});
test("全部 = 新物品或补货；用掉和负数不算入库", () => {
  assert.equal(addedMatch(item("n", 5), 7, "all", now), true);
  assert.equal(addedMatch(item("a", 100), 7, "all", now), true);
  assert.equal(addedMatch(item("c", 100), 7, "all", now), false);
});
test("最近入库时间 = 新建和最近补货里较晚的", () => {
  assert.equal(stockedAt(item("a", 100)), now - 3 * DAY);
  assert.equal(stockedAt(item("a", 1)), now - 1 * DAY);
});
