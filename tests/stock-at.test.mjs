// 补录购物的入库时间：node --test tests/
import "./_dom-stub.mjs";
import "./_win-stub.mjs";
import test from "node:test";
import assert from "node:assert/strict";
const { pastAt } = await import("../js/pantry/stock-at.js");

test("以前的购买日 → 返回那天中午；今天和以后 → null", () => {
  const noon = (d) => new Date(`${d}T12:00:00`).toISOString();
  assert.equal(pastAt(noon("2026-10-18"), "2026-11-28"), noon("2026-10-18"));
  assert.equal(pastAt(noon("2026-11-27"), "2026-11-28"), noon("2026-11-27"));
  assert.equal(pastAt(noon("2026-11-28"), "2026-11-28"), null);
  assert.equal(pastAt(noon("2026-12-01"), "2026-11-28"), null);
  assert.equal(pastAt("坏的", "2026-11-28"), null);
  assert.equal(pastAt(undefined, "2026-11-28"), null);
});
