// 特别摊派的纯逻辑测试：node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import { assessmentsOf, isPaid, paidOn, unpaidItems, genInstallments } from "../js/bills/assessments-lib.js";

const item = (o = {}) => ({ id: "i", assessment_id: "a1", due_on: "2026-12-01", amount: 100, kind: "installment", payment_id: null, settled_on: null, ...o });

test("isPaid：有缴费关联或标了已缴", () => {
  assert.equal(isPaid(item()), false);
  assert.equal(isPaid(item({ payment_id: "p1" })), true);
  assert.equal(isPaid(item({ settled_on: "2026-11-01" })), true);
});

test("paidOn：优先用缴费记录的日期，其次已缴日期，都没有是空串", () => {
  const pays = [{ id: "p1", paid_on: "2026-11-05" }];
  assert.equal(paidOn(item({ payment_id: "p1", settled_on: "2026-11-09" }), pays), "2026-11-05");
  assert.equal(paidOn(item({ payment_id: "p9", settled_on: "2026-11-09" }), pays), "2026-11-09");   // 缴费记录不在内存里（太久远）：退回已缴日期
  assert.equal(paidOn(item({ settled_on: "2026-11-09" }), pays), "2026-11-09");
  assert.equal(paidOn(item(), pays), "");
});

test("assessmentsOf：进度、剩余、是否缴清", () => {
  const as = [{ id: "a1", bill_id: "b1", status: "active", created_at: "1" }];
  const items = [item({ id: "1", amount: 100, payment_id: "p1" }), item({ id: "2", amount: 100, due_on: "2027-01-01" }), item({ id: "3", amount: 300, kind: "payoff", due_on: "2027-02-01" })];
  const [a] = assessmentsOf("b1", as, items);
  assert.equal(a.total, 500); assert.equal(a.paid, 100); assert.equal(a.remaining, 400); assert.equal(a.paidN, 1); assert.equal(a.done, false);
  assert.deepEqual(unpaidItems("b1", as, items).map((x) => x.id), ["2", "3"]);
});

test("genInstallments：总额除不尽的零头放最后一期", () => {
  const rows = genInstallments({ count: 3, total: 100, start: "2026-12-31" });
  assert.deepEqual(rows.map((x) => x.amount), [33.33, 33.33, 33.34]);
  assert.deepEqual(rows.map((x) => x.due_on), ["2026-12-31", "2027-01-31", "2027-02-28"]);
});
