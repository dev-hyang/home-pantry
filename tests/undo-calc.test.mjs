// 撤销入库的计算：node --test tests/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { corrected, defaultDeduct, matchPurchase, purchaseDeletable, undoableRestocks } from "../js/pantry/undo-calc.js";

const T = (h) => new Date(2026, 10, 27, h).toISOString();
const logs = [
  { id: 1, item_id: "a", reason: "restock", delta: 1, created_at: T(9) },
  { id: 2, item_id: "a", reason: "adjust", delta: -1, created_at: T(10) },
  { id: 3, item_id: "a", reason: "consume", delta: -1, created_at: T(11) },
  { id: 4, item_id: "a", reason: "restock", delta: 6, created_at: T(8), voided_at: T(12) },
  { id: 5, item_id: "b", reason: "adjust", delta: -3, created_at: T(10) },
  { id: 6, item_id: "a", reason: "adjust", delta: -1, created_at: T(7) },   // 入库之前的调整：不算
];
test("能撤销的入库：不含作废的、不含别的物品", () => {
  assert.deepEqual(undoableRestocks(logs, "a").map((l) => l.id), [1]);
});
test("入库之后手动调低的合计（不含用掉 consume、入库之前的、别的物品），最多算到入库量", () => {
  assert.equal(corrected(logs[0], logs), 1);
  assert.equal(corrected({ ...logs[0], delta: 0.5 }, logs), 0.5);
});
test("预填的扣回：有 2、误入库 +1、随后改回 → 0；还没改过 → 1；打错数量 12 实际 2 → 10；不超过库存", () => {
  assert.equal(defaultDeduct({ delta: 1, actual: 0, corrected: 1, qty: 2 }), 0);
  assert.equal(defaultDeduct({ delta: 1, actual: 0, corrected: 0, qty: 3 }), 1);
  assert.equal(defaultDeduct({ delta: 12, actual: 2, corrected: 0, qty: 14 }), 10);
  assert.equal(defaultDeduct({ delta: 6, actual: 0, corrected: 0, qty: 1 }), 1);
});
test("找花费：purchase_id 优先；旧记录按同物品 + 几分钟内，唯一才算", () => {
  const ps = [{ id: "p1", item_id: "a", purchased_at: T(9) }, { id: "p2", item_id: "a", purchased_at: new Date(new Date(T(9)).getTime() + 60e3).toISOString() }, { id: "p3", item_id: "b", purchased_at: T(9) }];
  assert.equal(matchPurchase({ ...logs[0], purchase_id: "p2" }, ps).id, "p2");
  assert.equal(matchPurchase(logs[0], ps), null);   // p1、p2 都在 5 分钟内：不唯一，不猜
  assert.equal(matchPurchase({ ...logs[0], item_id: "b" }, ps).id, "p3");
});
test("花费能不能一起删：导入的、刷卡的、别人记的不行", () => {
  assert.equal(purchaseDeletable({ created_by: "me" }, "me"), true);
  assert.equal(purchaseDeletable({ import_batch: "x" }, "me"), false);
  assert.equal(purchaseDeletable({ card_id: "c" }, "me"), false);
  assert.equal(purchaseDeletable({ created_by: "other" }, "me"), false);
  assert.equal(purchaseDeletable(null, "me"), false);
});
