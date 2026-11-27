// 购买排行的汇总口径：node --test tests/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import "./_dom-stub.mjs";
import "./_win-stub.mjs";
import { aggregateBuys, sortBuys, buysTotals } from "../js/pantry/buys-data.js";

const items = [{ id: "egg", name: "鸡蛋", category: "dairy", unit: "个" }, { id: "milk", name: "牛奶", category: "dairy", unit: "盒" }];
const p = (o) => ({ currency: "USD", category: "dairy", purchased_at: "2026-11-01T12:00:00Z", ...o });
const rows = [
  p({ item_id: "egg", name: "鸡蛋", amount: 6, quantity: 12, unit: "个", store: "Costco", purchased_at: "2026-10-01T12:00:00Z" }),
  p({ item_id: "egg", name: "鸡蛋", amount: 6, quantity: 12, unit: "个", store: "Costco", purchased_at: "2026-10-15T12:00:00Z" }),
  p({ item_id: "egg", name: "鸡蛋", amount: 9, quantity: 12, unit: "个", store: "Safeway", purchased_at: "2026-11-10T12:00:00Z" }),
  p({ item_id: "egg", name: "鸡蛋", amount: -3, quantity: null, purchased_at: "2026-11-11T12:00:00Z" }),   // 退款
  p({ name: "牛奶 ", amount: 4, quantity: 1, unit: "盒", store: "Aldi" }),                                    // 没有 item_id：按名字对上
  p({ name: "餐厅", amount: 50, category: "dining" }),                                                         // 对不上库存：不统计
  p({ item_id: "egg", name: "鸡蛋", amount: 5, currency: "CNY" }),                                              // 别的币种：不统计
];
const opts = { items, resolve: (n) => items.find((i) => i.name === String(n).trim()) || null, cats: new Set(["dairy"]), cur: "USD" };

test("按物品汇总：次数、花费（退款减掉）、数量", () => {
  const g = aggregateBuys(rows, opts), egg = g.find((x) => x.id === "egg");
  assert.equal(egg.n, 3); assert.equal(egg.spend, 18); assert.equal(egg.qty, 36); assert.equal(egg.unit, "个");
  assert.equal(egg.lastStore, "Safeway");
});
test("名字能对上物品的归到同一件；对不上库存的不算；别的币种不算", () => {
  const g = aggregateBuys(rows, opts);
  assert.equal(g.length, 2); assert.equal(g.find((x) => x.id === "milk").n, 1);
});
test("单价：平均、最低、最近一次比之前贵多少", () => {
  const egg = aggregateBuys(rows, opts).find((x) => x.id === "egg");
  assert.ok(Math.abs(egg.avgUnit - 21 / 36) < 1e-9); assert.equal(egg.minUnit, 0.5); assert.equal(egg.lastUnit, 0.75);
  assert.ok(Math.abs(egg.change - 0.5) < 1e-9);
});
test("排序与合计", () => {
  const g = aggregateBuys(rows, opts);
  assert.equal(sortBuys(g, "count")[0].id, "egg"); assert.equal(sortBuys(g, "spend")[0].id, "egg"); assert.equal(sortBuys(g, "rise")[0].id, "egg");
  assert.deepEqual(buysTotals(g), { kinds: 2, times: 4, spend: 22 });
});
