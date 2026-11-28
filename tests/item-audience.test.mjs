// 药品适用人群：node --test tests/
import "./_dom-stub.mjs";
import "./_win-stub.mjs";
import test from "node:test";
import assert from "node:assert/strict";
const { audienceOf, audienceLabel, sameAudience, audienceField, readAudience, audienceMatch, audienceFilter } = await import("../js/pantry/item-audience.js");

test("只认合法人群，并固定顺序", () => {
  assert.deepEqual(audienceOf({ audience: ["adult", "bogus", "infant"] }), ["infant", "adult"]);
  assert.deepEqual(audienceOf({}), []);
  assert.deepEqual(audienceOf(null), []);
});
test("比较与标签", () => {
  assert.ok(sameAudience(["child"], ["child"]));
  assert.ok(!sameAudience(["child"], ["adult"]));
  assert.ok(!sameAudience([], ["adult"]));
  assert.equal(audienceLabel({ audience: [] }), "");
});
test("表单：只有药品健康显示，已选的勾上", () => {
  assert.match(audienceField({ category: "health", audience: ["child"] }), /value="child" checked/);
  assert.match(audienceField({ category: "health", audience: [] }), /^<div class="span-2 form-field item-audience" role="group" aria-labelledby="audLbl" >/);
  assert.match(audienceField({ category: "veg", audience: [] }), /aria-labelledby="audLbl" hidden>/);
});
test("读表单：非药品健康为空，只取勾选且合法的", () => {
  const f = (cat, vals) => ({ elements: { category: { value: cat } }, querySelectorAll: () => vals.map((value) => ({ value })) });
  assert.deepEqual(readAudience(f("veg", ["adult"])), []);
  assert.deepEqual(readAudience(f("health", ["senior", "x", "infant"])), ["infant", "senior"]);
});

test("库存筛选：全部 / 某个人群 / 药品里还没标的", () => {
  const med = (audience) => ({ category: "health", audience }), veg = { category: "veg", audience: [] };
  assert.ok(audienceMatch(veg, "all") && audienceMatch(veg, undefined));
  assert.ok(audienceMatch(med(["child", "adult"]), "child"));
  assert.ok(!audienceMatch(med(["adult"]), "child"));
  assert.ok(audienceMatch(med([]), "none"));
  assert.ok(!audienceMatch(veg, "none"), "非药品不算「还没标」");
  assert.ok(!audienceMatch(med(["adult"]), "none"));
});
test("筛选下拉：没人标过就不出现，选着的值保留", () => {
  assert.equal(audienceFilter([{ category: "health", audience: [] }], { aud: "all" }), "");
  assert.match(audienceFilter([{ category: "health", audience: ["child"] }], { aud: "all" }), /id="invAud"/);
  assert.match(audienceFilter([], { aud: "child" }), /value="child" selected/);
});
