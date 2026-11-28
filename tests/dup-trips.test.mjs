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

import { findLump } from "../js/stats/dup-trips.js";
const lump = (o = {}) => ({ id: "L", amount: 87.3, store: "Target", name: "Target", import_batch: "b1", purchased_at: at("2026-11-15"), ...o });
test("反方向：银行导入的整笔 ↔ 这张小票 / 这次缴费", () => {
  const f = (p, c = {}) => findLump([p], { store: "Target", day: "2026-11-12", total: 87.3, ...c });
  assert.equal(f(lump()).id, "L");                                        // 晚 3 天入账 + 商店对上
  assert.equal(f(lump({ amount: 88 })).id, "L");                          // 差 0.7 ≤ 1%
  assert.equal(f(lump({ import_batch: null })), null);                    // 手记的不算
  assert.equal(f(lump({ amount: 95 })), null);                            // 差太多
  assert.equal(f(lump({ purchased_at: at("2026-11-25") })), null);        // 晚 13 天
  assert.equal(f(lump({ card_id: "A" }), { card: "B" }), null);           // 不同的卡
  assert.equal(f(lump({ store: "Costco", name: "Costco", purchased_at: at("2026-11-18") })), null);       // 商店不对且日期超 3.5 天
  assert.equal(f(lump({ store: "Costco", name: "Costco", purchased_at: at("2026-11-13") })).id, "L");   // 商店不对但金额一模一样 + 日期近
});

test("一次拍几张小票（同一个人、几分钟内录入）：不同商店 / 不同日期要分成几批，不能并成一批", () => {
  const rows = [...receipt("a", "2026-11-23", "ALDI", [3.41, 3.39, 1.38]), ...receipt("j", "2026-11-23", "Jewel Osco", [3.99, 7.49, 4.01, 3.47])];
  assert.equal(receiptBatches(rows).length, 2);
  const m = matchTrips([row("r1", "2026-11-24", 18.96, "JEWEL OSCO 3452 CHICAGO IL"), row("r2", "2026-11-25", 8.18, "ALDI 72058")], rows);
  assert.equal(m.get("r1").tier, "strong"); assert.equal(m.get("r1").n, 4); assert.equal(m.get("r2").tier, "strong");
  assert.equal(receiptBatches([...receipt("a", "2026-11-23", "ALDI", [1, 2]), ...receipt("b", "2026-11-24", "ALDI", [3, 4])]).length, 2);
});

/* ── 线上订单（指纹带订单组）──────────────────────── */
import { orderRowKeys } from "../js/pantry/scan-order-key.js";
const order = (ref, day, store, amounts, extra = {}) => orderRowKeys(ref, amounts.length).map((k, i) => ({ id: `${ref}-${i}`, name: `item${i}`, amount: amounts[i], store, purchased_at: at(day), created_at: at(day, i), created_by: "u1", import_key: k, ...extra }));

test("同一天两个订单：按订单号分开成两批，不会并成一批", () => {
  const pool = [...order("112-1111111-1111111", "2026-11-02", "Amazon", [10, 5]), ...order("112-2222222-2222222", "2026-11-02", "Amazon", [20, 8])];
  const b = receiptBatches(pool);
  assert.equal(b.length, 2);
  assert.deepEqual(b.map((x) => x.length), [2, 2]);
});

test("两个订单各对上流水里的一整笔（同一天、同商店）", () => {
  const pool = [...order("112-1111111-1111111", "2026-11-02", "Amazon", [10, 5]), ...order("112-2222222-2222222", "2026-11-02", "Amazon", [20, 8])];
  const rows = [row("a", "2026-11-03", 28, "AMAZON MKTPL*AB12"), row("b", "2026-11-03", 15, "AMAZON.COM*XY99")];
  const m = matchTrips(rows, pool);
  assert.equal(m.get("a").total, 28);
  assert.equal(m.get("b").total, 15);
  assert.equal(m.get("a").tier, "strong");
});

test("分批发货：一个订单在流水里是两笔，合计 = 订单合计，两笔都认成已记录", () => {
  const pool = order("112-3333333-3333333", "2026-11-02", "Amazon", [30, 20, 10]);   // 合计 60
  const rows = [row("s1", "2026-11-03", 35, "AMAZON MKTPL*A"), row("s2", "2026-11-06", 25, "AMAZON MKTPL*B"), row("x", "2026-11-04", 9.99, "NETFLIX")];
  const m = matchTrips(rows, pool);
  assert.equal(m.get("s1").split, 2);
  assert.equal(m.get("s2").split, 2);
  assert.equal(m.get("s1").tier, "strong");
  assert.equal(m.has("x"), false);
});

test("分批发货必须商店也对上：金额凑巧加起来相等但商店不对 = 不配", () => {
  const pool = order("112-4444444-4444444", "2026-11-02", "Amazon", [30, 30]);
  const rows = [row("p", "2026-11-03", 35, "SHELL OIL"), row("q", "2026-11-04", 25, "WHOLE FOODS")];
  assert.equal(matchTrips(rows, pool).size, 0);
});

test("不是订单导入的小票不走分批发货（只有整笔对整笔）", () => {
  const pool = receipt("r", "2026-11-02", "Target", [30, 30]);
  const rows = [row("p", "2026-11-03", 35, "TARGET 0001"), row("q", "2026-11-04", 25, "TARGET 0001")];
  assert.equal(matchTrips(rows, pool).size, 0);
});
