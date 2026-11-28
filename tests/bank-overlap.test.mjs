/* 对账单导入：和已导入批次的重叠提醒 */
import test from "node:test";
import assert from "node:assert/strict";
import { needsAccountHint, overlapBatches, rangeOfRows } from "../js/stats/bank-overlap-lib.js";

const rows = (...d) => d.map((date) => ({ date }));
const batches = [
  { id: "b1", at: "2026-09-02T10:00:00Z", from: "2026-08-01", to: "2026-08-31", last4: "1234", account: "Chase ··1234", n: 40 },
  { id: "b2", at: "2026-10-03T10:00:00Z", from: "2026-09-01", to: "2026-09-30", last4: "1234", account: "Chase ··1234", n: 35 },
  { id: "b3", at: "2026-10-04T10:00:00Z", from: "2026-09-01", to: "2026-09-30", last4: "9999", account: "Amex ··9999", n: 12 },
];

test("文件范围 = 最早 ~ 最晚一笔；没有日期返回 null", () => {
  assert.deepEqual(rangeOfRows(rows("2026-07-03", "2026-09-28", "2026-08-01")), { from: "2026-07-03", to: "2026-09-28", days: 88 });
  assert.equal(rangeOfRows([{ date: "" }, {}]), null);
});

test("季度文件和月批次重叠：只报同一账户的、给出重叠区间", () => {
  const range = rangeOfRows(rows("2026-07-01", "2026-09-30"));
  const hit = overlapBatches(batches, { last4: "1234" }, range);
  assert.deepEqual(hit.map((b) => b.id), ["b2", "b1"]);   // 近的在前
  assert.deepEqual([hit[1].from, hit[1].to], ["2026-08-01", "2026-08-31"]);
});

test("没选账户：和所有批次比；账户名也能对上；没重叠不报", () => {
  const range = rangeOfRows(rows("2026-09-10", "2026-09-20"));
  assert.deepEqual(overlapBatches(batches, { last4: "", name: "" }, range).map((b) => b.id).sort(), ["b2", "b3"]);
  assert.deepEqual(overlapBatches(batches, { name: "Amex ··9999" }, range).map((b) => b.id), ["b3"]);
  assert.deepEqual(overlapBatches(batches, { last4: "1234" }, rangeOfRows(rows("2026-11-01", "2026-11-30"))), []);
});

test("没选账户又跨一个多月才提醒选账户", () => {
  assert.equal(needsAccountHint({}, { days: 90 }), true);
  assert.equal(needsAccountHint({ last4: "1234" }, { days: 90 }), false);
  assert.equal(needsAccountHint({}, { days: 20 }), false);
  assert.equal(needsAccountHint({}, null), false);
});
