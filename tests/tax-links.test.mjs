/* 买卖清单的链接行：金额以花费记录为准；记录没读到用备份；记录被删不计入；已链接的不再出现在选择器里 */
import "./_dom-stub.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { ui } from "../js/tax/tax-ui.js";
import { linkedRefs, pickable, resolveLink } from "../js/tax/tax-links-lib.js";

const row = { link: "spend", ref: "a", desc: "旧名", amount: 100, on: "2026-01-01" };
const noXfer = () => false;
test("还没读到记录：用备份", () => { ui.spend.clear(); assert.equal(resolveLink(row, "p1").amount, 100); });
test("读到了：金额和名称跟记录走", () => { ui.spend.set("p1", { rows: [{ id: "a", name: "换屋顶", amount: 250.5, purchased_at: "2026-03-02T12:00:00Z" }] }); const r = resolveLink(row, "p1"); assert.equal(r.amount, 250.5); assert.equal(r.desc, "换屋顶"); });
test("记录被删：不计入", () => { ui.spend.set("p1", { rows: [] }); const r = resolveLink(row, "p1"); assert.equal(r.missing, true); assert.equal(r.amount, 0); });
test("读失败：退回备份", () => { ui.spend.set("p1", { rows: [], err: "x" }); assert.equal(resolveLink(row, "p1").amount, 100); });
test("选择器：去掉已链接 / 转账 / 虚拟行 / 零金额", () => {
  ui.spend.set("p1", { rows: [{ id: "a", amount: 1, purchased_at: "2026-01-01" }, { id: "b", amount: 2, purchased_at: "2026-02-01" }, { id: "c", amount: 3, category: "x", purchased_at: "2026-03-01", virtual: "medical" }, { id: "d", amount: 0, purchased_at: "2026-04-01" }, { id: "e", amount: 5, category: "t", purchased_at: "2026-05-01" }] });
  assert.deepEqual(pickable("p1", linkedRefs({ buyItems: [row] }, ["buyItems"]), (c) => c === "t").map((r) => r.id), ["b"]);
});

import { state } from "../js/core/state.js";
import { linkRows, pickableIncome } from "../js/tax/tax-links-lib.js";
const irow = { link: "income", ref: "i1", desc: "旧", amount: 40, on: "2026-01-01" };
test("收入链接：没读到收入用备份；读到了跟记录走；删了不计入", () => {
  state.inc = { loaded: false, rec: [] }; assert.equal(resolveLink(irow, "p1").amount, 40);
  state.inc = { loaded: true, rec: [{ id: "i1", amount: 55.5, source_name: "title 退款", received_on: "2026-02-03", property_id: "p1" }] };
  const r = resolveLink(irow, "p1"); assert.equal(r.amount, 55.5); assert.equal(r.desc, "title 退款");
  state.inc = { loaded: true, rec: [] }; assert.equal(resolveLink(irow, "p1").missing, true);
});
test("收入选择器：列所有没被链接的收入，关联这套房的排前面；linkRows 生成链接行", () => {
  state.inc = { loaded: true, rec: [{ id: "a", amount: 10, received_on: "2026-01-01", property_id: "p1", source_name: "A" }, { id: "b", amount: 20, received_on: "2026-02-01", property_id: "p2" }, { id: "c", amount: 30, received_on: "2026-03-01", property_id: "p1", source_name: "C" }] };
  assert.deepEqual(pickableIncome("p1", new Set(["a"])).map((r) => r.id), ["c", "b"]);
  assert.deepEqual(linkRows("income", "p1", new Set(["c"])), [{ link: "income", ref: "c", desc: "C", amount: 30, on: "2026-03-01" }]);
});

import { bucketOk } from "../js/tax/tax-links-lib.js";
test("金额档位：从高到低；按绝对值；下限含、上限不含", () => {
  assert.equal(bucketOk("all", 5), true); assert.equal(bucketOk("1000", 1000), true); assert.equal(bucketOk("1000", 999.99), false);
  assert.equal(bucketOk("500", 999.99), true); assert.equal(bucketOk("500", 1000), false); assert.equal(bucketOk("0", -49.5), true); assert.equal(bucketOk("0", 50), false);
});

import { dupInfo, similarName } from "../js/tax/tax-links-lib.js";
test("名字像不像：包含 / 共有词；无关的不像", () => {
  assert.equal(similarName("Title - Settlement Fee", "Settlement fee"), true);
  assert.equal(similarName("律师费", "律师费用"), true);
  assert.equal(similarName("Recording Fee", "Appraisal"), false);
});
test("AI 查重：金额相同才算；名字也像 = strong；被删的不算", () => {
  const rows = [{ desc: "Settlement fee", amount: 900 }, { desc: "其他", amount: 250.5 }, { desc: "gone", amount: 70, missing: true }];
  assert.deepEqual(dupInfo({ desc: "Title - Settlement Fee", amount: 900 }, rows).strong, true);
  assert.equal(dupInfo({ desc: "Notary", amount: 250.5 }, rows).strong, false);
  assert.equal(dupInfo({ desc: "x", amount: 70 }, rows), null);
  assert.equal(dupInfo({ desc: "x", amount: 901 }, rows), null);
});
