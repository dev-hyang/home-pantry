/* 小票 ↔ 对账单整笔：合计对上 + 商店 / 卡 / 日期；强 / 弱 / 不算；一对一 */
import test from "node:test";
import assert from "node:assert/strict";
import { matchTrips, receiptBatches, storeClose } from "../js/stats/dup-trips.js";

const at = (d, min = 0) => new Date(`${d}T12:${String(min).padStart(2, "0")}:00`).toISOString();
const receipt = (id0, day, store, amounts, extra = {}) => amounts.map((a, i) => ({ id: `${id0}${i}`, name: `item${i}`, amount: a, store, purchased_at: at(day), created_at: at(day, i), created_by: "u1", ...extra }));
const row = (fk, date, out, desc) => ({ fk, date, out, texts: [desc] });

test("商店名：去掉数字符号后互相包含（至少 3 个字符）", () => {
  assert.equal(storeClose("TARGET 00012345 MPLS MN", "Target"), true);
  assert.equal(storeClose("SQ *BLUE BOTTLE", "Blue Bottle Coffee"), false);   // 互相都不包含
  assert.equal(storeClose("AB", "AB"), false);
});
test("同一次录入的几行是一张小票；换人或隔很久是另一张", () => {
  const rows = [...receipt("a", "2026-11-12", "Target", [10, 20]), ...receipt("b", "2026-11-12", "Target", [5, 5], { created_by: "u2" })];
  assert.equal(receiptBatches(rows).length, 2);
});
test("强：合计一样 + 商店对上，流水晚 3 天入账（pending）", () => {
  const pool = receipt("a", "2026-11-12", "Target", [40.1, 30.2, 17], {}), m = matchTrips([row("r1", "2026-11-15", 87.3, "TARGET 00012345 MPLS")], pool);
  assert.equal(m.get("r1").tier, "strong"); assert.equal(m.get("r1").n, 3);
});
test("强：流水晚 6 天，商店 + 合计都对上也算；只有合计、没有商店 → 不算", () => {
  const pool = receipt("a", "2026-11-12", "Target", [50, 37.3]);
  assert.equal(matchTrips([row("r1", "2026-11-18", 87.3, "TARGET 123")], pool).get("r1").tier, "strong");
  assert.equal(matchTrips([row("r1", "2026-11-18", 87.3, "UNKNOWN SHOP")], pool).get("r1"), undefined);
});
test("弱：合计差 3%（小费 / 折扣）且商店对上；差太多不算", () => {
  const pool = receipt("a", "2026-11-12", "Olive Garden", [40, 40]);
  assert.equal(matchTrips([row("r1", "2026-11-13", 82.4, "OLIVE GARDEN #55")], pool).get("r1").tier, "weak");
  assert.equal(matchTrips([row("r1", "2026-11-13", 100, "OLIVE GARDEN #55")], pool).get("r1"), undefined);
});
test("卡：小票记在别的卡上 = 排除；同一张卡不影响匹配", () => {
  const pool = receipt("a", "2026-11-12", "Target", [50, 37.3], { card_id: "cardA" });
  assert.equal(matchTrips([row("r1", "2026-11-13", 87.3, "TARGET")], pool, { card: "cardB" }).get("r1"), undefined);
  assert.equal(matchTrips([row("r1", "2026-11-13", 87.3, "TARGET")], pool, { card: "cardA" }).get("r1").tier, "strong");
});
test("一对一：两笔流水只配上一张小票，另一笔不配", () => {
  const pool = receipt("a", "2026-11-12", "Target", [50, 37.3]);
  const m = matchTrips([row("r1", "2026-11-13", 87.3, "TARGET"), row("r2", "2026-11-14", 87.3, "TARGET")], pool);
  assert.equal(m.size, 1); assert.equal(m.get("r1").tier, "strong");
});
test("已经被逐行对上的花费、银行导入的行、单行小票都不参与", () => {
  const pool = [...receipt("a", "2026-11-12", "Target", [50, 37.3]), ...receipt("c", "2026-11-12", "Target", [87.3], { import_batch: "b1" })];
  assert.equal(matchTrips([row("r1", "2026-11-13", 87.3, "TARGET")], pool, { used: new Set(["a0"]) }).get("r1"), undefined);
});
