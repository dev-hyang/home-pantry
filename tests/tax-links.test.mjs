/* 买卖清单的链接行：金额以花费记录为准；记录没读到用备份；记录被删不计入；已链接的不再出现在选择器里 */
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
