/* 被小票替换的对账单整笔：搬进归档（演示库版）、撤销搬回、对账单页的笔数 / 合计仍含它们、重新导入按指纹仍认得 */
import test from "node:test";
import assert from "node:assert/strict";
import "./_dom-stub.mjs";
import "./_win-stub.mjs";
await import("../js/core/store.js");   // 先加载 store.js（它和 demo-spend.js 互相引用，从它进来才不会撞「未初始化」）
const { demoSpend } = await import("../js/core/store/demo-spend.js");
const { demoSuperseded } = await import("../js/core/store/demo-superseded.js");

const mk = () => {
  const s = { ...demoSpend, ...demoSuperseded, persist() {} };
  s.db = { purchases: [
    { id: "L1", name: "Amazon", store: "Amazon", amount: 60, import_batch: "b1", import_key: "k1", purchased_at: "2026-11-02T12:00:00Z" },
    { id: "L2", name: "Netflix", store: "Netflix", amount: 10, import_batch: "b1", import_key: "k2", purchased_at: "2026-11-03T12:00:00Z" },
    { id: "R1", name: "milk", store: "Amazon", amount: 60, purchased_at: "2026-11-02T12:00:00Z" },
  ], income_records: [], purchases_superseded: [] };
  return s;
};

test("替换：整笔从花费里搬走（统计不再算），对账单批次的笔数 / 合计不变", async () => {
  const s = mk();
  const before = await s.batchTotals(["b1"]);
  const r = await s.supersedePurchases(["L1"], ["R1"]);
  assert.deepEqual(r, { n: 1, archived: true });
  assert.equal(s.db.purchases.some((p) => p.id === "L1"), false);
  const after = await s.batchTotals(["b1"]);
  assert.deepEqual(after.spend.b1, before.spend.b1);   // 2 笔 70
  assert.deepEqual(after.sup.b1, { n: 1, sum: 60 });
});
test("重新导入同一份对账单：被替换的那笔指纹仍算已导入", async () => {
  const s = mk(); await s.supersedePurchases(["L1"], []);
  const m = await s.importKeysExist(["k1", "k2", "k3"]);
  assert.equal(m.has("k1"), true); assert.equal(m.has("k3"), false);
});
test("撤销替换：搬回原 id 原内容；归档清单同步减少", async () => {
  const s = mk(); await s.supersedePurchases(["L1"], ["R1"]);
  assert.equal((await s.listSuperseded("b1")).length, 1);
  assert.equal(await s.restoreSuperseded(["L1"]), 1);
  assert.equal(s.db.purchases.find((p) => p.id === "L1").amount, 60);
  assert.equal((await s.listSuperseded("b1")).length, 0);
});
test("撤销整批导入：归档里这批的也一起删", async () => {
  const s = mk(); await s.supersedePurchases(["L1"], []);
  await s.deletePurchasesByBatch("b1");
  assert.equal(s.db.purchases_superseded.length, 0);
  assert.equal(s.db.purchases.some((p) => p.import_batch === "b1"), false);
});
