// 特别摊派的纯逻辑测试：node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import { assessmentsOf, isPaid, paidOn, unpaidItems, genInstallments, settleMerge, nextInstallment } from "../js/bills/assessments-lib.js";

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

const CTX = { paidOn: "2026-11-19", paymentId: "pay1" };

test("settleMerge：一次都没缴，全部没缴的期合并成一行结清，金额 = 全部余额", () => {
  const items = [item({ id: "1", amount: 100 }), item({ id: "2", amount: 100, due_on: "2027-01-01" }), item({ id: "3", amount: 100.5, due_on: "2027-02-01" })];
  const m = settleMerge(items, "a1", ["1", "2", "3"], CTX);
  assert.deepEqual(m.removeIds, ["1", "2", "3"]);
  assert.deepEqual(m.payoff, { assessment_id: "a1", due_on: "2026-11-19", amount: 300.5, kind: "payoff", payment_id: "pay1", settled_on: null });
});

test("settleMerge：已缴了一部分，只合并剩下没缴的，已缴的不动", () => {
  const items = [item({ id: "1", amount: 100, payment_id: "p0" }), item({ id: "2", amount: 100 }), item({ id: "3", amount: 100 })];
  const m = settleMerge(items, "a1", ["2", "3"], CTX);
  assert.deepEqual(m.removeIds, ["2", "3"]); assert.equal(m.payoff.amount, 200);
});

test("settleMerge：没有全选（少勾了一期）、别的摊派的期、没有没缴的期，都不合并", () => {
  const items = [item({ id: "1" }), item({ id: "2" }), item({ id: "9", assessment_id: "a2" })];
  assert.equal(settleMerge(items, "a1", ["1"], CTX), null);                 // 少勾了第 2 期
  assert.equal(settleMerge(items, "a1", ["1", "2", "9"], CTX), null);       // 多勾了别的摊派的期
  assert.equal(settleMerge([item({ payment_id: "p" })], "a1", [], CTX), null);   // 都已缴
});

test("settleMerge：只剩一行结清时不用合并（照常关联）", () => {
  assert.equal(settleMerge([item({ id: "1", kind: "payoff", amount: 500 })], "a1", ["1"], CTX), null);
});

test("nextInstallment：最后一期往后一个月，金额取最近一期分期", () => {
  const rows = [item({ due_on: "2026-11-30", amount: 100 }), item({ due_on: "2026-12-30", amount: 120 }), item({ due_on: "2027-01-30", amount: 900, kind: "payoff" })];
  assert.deepEqual(nextInstallment(rows), { due_on: "2027-02-28", amount: 120, kind: "installment" });
  assert.deepEqual(nextInstallment([]), { due_on: null, amount: null, kind: "installment" });
});
