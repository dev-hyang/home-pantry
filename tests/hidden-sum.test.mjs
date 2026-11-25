import test from "node:test";
import assert from "node:assert/strict";
globalThis.document ??= { documentElement: {} };
globalThis.window ??= {};
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
const { aggregate, hiddenSum, storeAgg } = await import("../js/stats/report.js");

const rows = [
  { m: "2026-11", c: "bill_mortgage", nat: null, cur: "USD", sum: 1000, n: 1 },
  { m: "2026-11", c: "project", nat: null, cur: "USD", sum: 5000, n: 2, sk: "acme", store: "Acme Reno" },
  { m: "2026-11", c: "capital_invest", nat: null, cur: "USD", sum: 300, n: 1 },
];
test("被「排除资本性 / 投资」挡掉的金额按节点汇总", () => {
  const A = aggregate(rows, ["2026-11"], { exCap: true, exInv: true });
  assert.deepEqual(hiddenSum(A, "all"), { cap: 5000, inv: 300 });
  assert.deepEqual(hiddenSum(A, "housing"), { cap: 5000, inv: 0 });
  assert.deepEqual(hiddenSum(A, "home_improve"), { cap: 5000, inv: 0 });
  assert.deepEqual(hiddenSum(A, "living"), { cap: 0, inv: 0 });
  const B = aggregate(rows, ["2026-11"], { exCap: false, exInv: true });
  assert.deepEqual(hiddenSum(B, "all"), { cap: 0, inv: 300 });
});
test("商店汇总：开关挡掉的资本性金额记在 hid 里", () => {
  const list = storeAgg(rows, ["2026-11"], { exCap: true, exInv: true });
  assert.equal(list.length, 1);   // 只剩房贷那一行
  assert.deepEqual(list.hid, { cap: 5000, inv: 300 });
  assert.equal(storeAgg(rows, ["2026-11"], { exCap: false, exInv: true })[0].name, "Acme Reno");
});
