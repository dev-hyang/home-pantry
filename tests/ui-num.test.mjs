import test from "node:test";
import assert from "node:assert/strict";
import { numAttrs as num, NUM_KINDS } from "../js/core/ui-num.js";

test("预设属性", () => {
  assert.equal(num("money"), 'type="number" data-num="money" inputmode="decimal" min="0" step="0.01"');
  assert.match(num("int"), /inputmode="numeric" min="0" step="1"/);
});
test("覆盖与去掉", () => {
  assert.match(num("money", { min: 0.01 }), /min="0.01"/);
  assert.doesNotMatch(num("int", { step: null }), /step=/);
  assert.match(num("int", { min: 1, max: 31 }), /min="1" step="1" max="31"/);
});
test("不认识的类型按 qty", () => { assert.match(num("zzz"), /data-num="qty"/); assert.ok(NUM_KINDS.qty); });
