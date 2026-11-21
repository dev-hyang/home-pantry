// 资产账单页的卡片清单：node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import { assetBillCards, belongsTo, isSettled } from "../js/bills/asset-bill-cards.js";

const rec = (o = {}) => ({ id: "r", name: "电费", active: true, ended: false, next_due_on: "2026-11-22", property_id: "p1", ...o });
const one = (o = {}) => ({ id: "o", provider: "装修队", status: "open", due_on: "2026-11-30", property_id: "p1", ...o });

test("只取挂在这个资产上的账单（别的房子的一次性账单不算）", () => {
  const cards = assetBillCards("property:p1", [rec(), rec({ id: "r2", property_id: "p2" })], [one(), one({ id: "o2", property_id: "p2" })]);
  assert.deepEqual(cards.map((c) => c.b.id), ["r", "o"]);
  assert.deepEqual(cards.map((c) => c.kind), ["recurring", "onetime"]);
});
test("排序：要处理的按到期日，已结清 / 停用的排最后，没日期的在要处理里最后", () => {
  const cards = assetBillCards("property:p1", [rec({ id: "late", next_due_on: "2026-12-05" }), rec({ id: "off", active: false, next_due_on: "2026-01-01" }), rec({ id: "nodate", next_due_on: null })],
    [one({ id: "paid", status: "paid" }), one({ id: "soon", due_on: "2026-11-01" })]);
  assert.deepEqual(cards.map((c) => c.b.id), ["soon", "late", "nodate", "off", "paid"]);
});
test("车辆键按 asset_id；person 只匹配一次性", () => {
  assert.ok(belongsTo("asset:a1", { asset_id: "a1" }, "recurring"));
  assert.ok(!belongsTo("person:x", { patient_id: "x" }, "recurring"));
  assert.ok(belongsTo("person:x", { patient_id: "x" }, "onetime"));
  assert.ok(!belongsTo("bogus", { property_id: "p1" }, "onetime"));
});
test("isSettled", () => {
  assert.ok(isSettled({ status: "written_off" }, "onetime"));
  assert.ok(isSettled({ ended: true }, "recurring"));
  assert.ok(!isSettled({ active: true }, "recurring"));
});
test("全部周期性 / 家庭通用 / 车辆 清单", () => {
  const phone = { id: "ph", name: "手机", category: "phone", frequency: "monthly" };
  const reg = { id: "rg", name: "牌照", category: "vehicle_reg" };
  const tax = { id: "tx", name: "房产税", category: "property_tax", property_id: "p1" };
  const ot = { id: "ot", kind: "medical", provider: "医院", status: "open" };
  const ids = (key) => assetBillCards(key, [phone, reg, tax], [ot]).map((c) => c.b.id).sort();
  assert.deepEqual(ids("recurring"), ["ph", "rg", "tx"]);
  assert.deepEqual(ids("general"), ["ph"]);
  assert.deepEqual(ids("vehicle"), ["rg"]);
});
