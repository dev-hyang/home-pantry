/* 明细金额筛选：档位 / 自定义 → amin（≥）/ amax（<）；顺序是从高到低 */
import test from "node:test";
import assert from "node:assert/strict";
import { AMT_OPTS, amtOk, amtParams } from "../js/core/amount-filter-lib.js";

test("下拉顺序：全部金额、自定义，然后从高到低，< 0 最后", () => {
  assert.deepEqual(AMT_OPTS.map(([v]) => v), ["all", "custom", "1000", "500", "200", "100", "50", "0", "neg"]);
});
test("档位：下限含、上限不含；全部 = 不限", () => {
  assert.deepEqual(amtParams("all"), { amin: null, amax: null });
  assert.deepEqual(amtParams("1000"), { amin: 1000, amax: null });
  assert.deepEqual(amtParams("500"), { amin: 500, amax: 1000 });
  assert.deepEqual(amtParams("0"), { amin: 0, amax: 50 });
  assert.deepEqual(amtParams("neg"), { amin: null, amax: 0 });
  assert.deepEqual(amtParams(undefined), { amin: null, amax: null });
});
test("自定义：可以只填下限 / 只填上限 / 都填；上限是含的（+0.005）；填反了自动对调；没填 = 不限", () => {
  assert.deepEqual(amtParams("custom", "100", ""), { amin: 100, amax: null });
  assert.deepEqual(amtParams("custom", "", "200"), { amin: null, amax: 200.005 });
  assert.deepEqual(amtParams("custom", "50", "75.5"), { amin: 50, amax: 75.505 });
  assert.deepEqual(amtParams("custom", "300", "100"), { amin: 100, amax: 300.005 });
  assert.deepEqual(amtParams("custom", "", ""), { amin: null, amax: null });
  assert.deepEqual(amtParams("custom", "abc", "x"), { amin: null, amax: null });
});
test("筛选：边界和负数", () => {
  const r500 = amtParams("500"), rneg = amtParams("neg"), rc = amtParams("custom", "10", "20");
  assert.equal(amtOk(500, r500), true); assert.equal(amtOk(999.99, r500), true); assert.equal(amtOk(1000, r500), false); assert.equal(amtOk(499.99, r500), false);
  assert.equal(amtOk(-5, rneg), true); assert.equal(amtOk(0, rneg), false);
  assert.equal(amtOk(20, rc), true); assert.equal(amtOk(20.01, rc), false); assert.equal(amtOk(9.99, rc), false);
  assert.equal(amtOk(123, amtParams("all")), true);
});
