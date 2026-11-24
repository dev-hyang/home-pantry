/* 账单缴费 ↔ 对账单：缴费记录当查重对象（含医疗、房贷整笔）；强 / 弱 / 不算；一对一；卡排除 */
import test from "node:test";
import assert from "node:assert/strict";
import { matchPayments, paymentPool } from "../js/stats/dup-bills.js";

const bills = [{ id: "b1", name: "Xfinity", payee: "Comcast Xfinity", direction: "payable" }, { id: "b2", name: "房贷", payee: "Wells Fargo Home Mortgage", direction: "payable", pay_card_id: "chk" }, { id: "b3", name: "租金收入", payee: "Tenant", direction: "receivable" }];
const payments = [
  { id: "p1", bill_id: "b1", paid_on: "2026-11-02", amount: 79.99, purchase_id: "x1" },
  { id: "p2", bill_id: "b2", paid_on: "2026-11-01", amount: 2400.55, late_fee: 0, purchase_id: null },
  { id: "p3", bill_id: "b1", paid_on: "2026-10-02", amount: 10, status: "skipped" },
  { id: "p4", bill_id: "b3", paid_on: "2026-11-01", amount: 1500 },
];
const medBills = [{ id: "m1", provider: "City Clinic", kind: "medical" }], medPayments = [{ id: "mp1", bill_id: "m1", paid_on: "2026-11-05", amount: 120 }];
const pool = paymentPool({ bills, payments, medBills, medPayments });
const row = (fk, date, out, desc) => ({ fk, date, out, texts: [desc] });

test("缴费池：跳过的、收款类的不要；缴费合计 = 金额 + 滞纳金 + 手续费…", () => {
  assert.deepEqual(pool.map((p) => p.id).sort(), ["bp:p1", "bp:p2", "mp:mp1"]);
  assert.equal(paymentPool({ bills, payments: [{ id: "q", bill_id: "b1", paid_on: "2026-11-02", amount: 70, late_fee: 5, fee_amount: 4.99 }] })[0].cents, 7999);
});
test("强：自动扣款晚 6 天入账 + 收款方对上（逐行查重 ±3.5 天会漏）", () => {
  assert.equal(matchPayments([row("r", "2026-11-08", 79.99, "COMCAST CABLE COMM")], pool).get("r").tier, "strong");
});
test("强：房贷是一整笔（花费被拆成本金 + 利息，只有缴费记录有合计）", () => {
  const m = matchPayments([row("r", "2026-11-03", 2400.55, "WELLS FARGO HOME MTG")], pool).get("r"); assert.equal(m.tier, "strong"); assert.equal(m.kind, "bill");
});
test("医疗等一次性账单的缴费也能对上", () => {
  const m = matchPayments([row("r", "2026-11-06", 120, "CITY CLINIC 555")], pool).get("r"); assert.equal(m.kind, "med");
});
test("弱：金额差一点（手续费）+ 收款方对上；收款方不对 → 不算；金额差太多 → 不算", () => {
  assert.equal(matchPayments([row("r", "2026-11-03", 81.5, "COMCAST")], pool).get("r").tier, "weak");
  assert.equal(matchPayments([row("r", "2026-11-03", 81.5, "RANDOM SHOP")], pool).get("r"), undefined);
  assert.equal(matchPayments([row("r", "2026-11-03", 95, "COMCAST")], pool).get("r"), undefined);
});
test("日期超出窗口不算；卡不同排除；一对一；已被逐行认领的缴费不再配", () => {
  assert.equal(matchPayments([row("r", "2026-11-20", 79.99, "COMCAST")], pool).get("r"), undefined);
  assert.equal(matchPayments([row("r", "2026-11-03", 2400.55, "WELLS FARGO")], pool, { card: "other" }).get("r"), undefined);
  assert.equal(matchPayments([row("r1", "2026-11-03", 79.99, "COMCAST"), row("r2", "2026-11-04", 79.99, "COMCAST")], pool).size, 1);
  assert.equal(matchPayments([row("r", "2026-11-03", 79.99, "COMCAST")], pool, { usedPurchases: new Set(["x1"]) }).get("r"), undefined);
});
