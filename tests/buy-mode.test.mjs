// 采购方式分组：node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import { buyModeByName, buyModeOf, groupByMode, modeRank } from "../js/pantry/buy-mode.js";

test("按分类推采购方式", () => {
  assert.equal(buyModeOf("fresh"), "fresh");
  assert.equal(buyModeOf("meat_dairy"), "fresh");
  assert.equal(buyModeOf("frozen"), "fresh");
  assert.equal(buyModeOf("dry"), "bulk");
  assert.equal(buyModeOf("drink"), "bulk");
  assert.equal(buyModeOf("daily"), "online");
  assert.equal(buyModeOf("pet"), "online");
  assert.equal(buyModeOf("hvac_filter", "house"), "online");   // 汽车房屋消耗品
  assert.equal(buyModeOf("other"), "other");
  assert.equal(buyModeOf(undefined), "other");
});
test("分组：顺序固定、空组不出现", () => {
  const rows = [{ id: 1, m: "fresh" }, { id: 2, m: "online" }, { id: 3, m: "fresh" }, { id: 4, m: "zzz" }];
  const g = groupByMode(rows, (r) => r.m);
  assert.deepEqual(g.map((x) => x.mode.id), ["online", "fresh", "other"]);
  assert.deepEqual(g[1].rows.map((r) => r.id), [1, 3]);
});
test("modeRank", () => { assert.ok(modeRank("online") < modeRank("bulk") && modeRank("bulk") < modeRank("fresh")); });
test("没关联库存：按名字猜", () => {
  assert.equal(buyModeByName("Costco里脊肉"), "fresh");
  assert.equal(buyModeByName("意面"), "bulk");
  assert.equal(buyModeByName("洗衣液"), "online");
  assert.equal(buyModeByName("地下室HeavyDuty置物架"), "other");
});
