// 花费概览「最近动态」的计算：node --test tests/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import "./_dom-stub.mjs";
import "./_win-stub.mjs";
import { insights } from "../js/stats/spend-insights-calc.js";

const now = new Date(2026, 10, 27, 12);   // 2026-11-27
const at = (m, d, h = 12) => new Date(2026, m - 1, d, h).toISOString();
const rows = [
  { id: "a", name: "羊肉", amount: 90, purchased_at: at(11, 24), store_txt: "Costco", category: "meat_dairy" },
  { id: "b", name: "牛奶", amount: 10, purchased_at: at(11, 24), store_txt: "costco ", category: "meat_dairy" },
  { id: "c", name: "鸡蛋", amount: 6, purchased_at: at(11, 20), store_txt: "Aldi", category: "meat_dairy" },
  { id: "d", name: "转账", amount: 500, purchased_at: at(11, 25), store_txt: "Bank", category: "meat_dairy", is_xfer: true },
  { id: "e", name: "上周", amount: 40, purchased_at: at(11, 16), store_txt: "Target", category: "meat_dairy" },
  { id: "f", name: "退款", amount: -5, purchased_at: at(11, 26), store_txt: "Aldi", category: "meat_dairy" },
  { id: "g", name: "上月同期", amount: 20, purchased_at: at(10, 10), store_txt: "Aldi", category: "meat_dairy" },
  { id: "h", name: "上月晚些", amount: 300, purchased_at: at(10, 30), store_txt: "Aldi", category: "meat_dairy" },
];
const r = insights(rows, now);

test("近 7 天（11-21 到 11-27）和前 7 天（11-14 到 11-20）", () => {
  assert.equal(r.last7.sum, 90 + 10 - 5); assert.equal(r.last7.n, 3);
  assert.equal(r.prev7.sum, 6 + 40); assert.equal(r.prev7.n, 2);
});
test("转账不算；本月最高的一天、最大一笔、最高收款方（大小写 / 空格合并）", () => {
  assert.deepEqual(r.topDay, { day: "2026-11-24", sum: 100, n: 2 });
  assert.equal(r.biggest.id, "a");
  assert.equal(r.topStore.key, "costco"); assert.equal(r.topStore.sum, 100); assert.equal(r.topStore.n, 2);
});
test("分类：本月至今比上月同期（1–27 日）多花多少；上月 30 日的不算同期", () => {
  assert.equal(r.rising.cur, 90 + 10 + 6 + 40 - 5); assert.equal(r.rising.prev, 20);
  assert.equal(r.rising.delta, 141 - 20);
});
test("没有数据 = 都是空", () => {
  const e = insights([], now); assert.equal(e.topDay, null); assert.equal(e.biggest, null); assert.equal(e.last7.sum, 0);
});
