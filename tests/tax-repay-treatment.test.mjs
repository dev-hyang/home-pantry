/* 标了「需要还」的赠与 / 电汇的税务处理：没关联借贷或借据不正式 → 算赠与；关联了正式借款 → 按借款；当年开关关了 → 按借款 */
import test from "node:test";
import assert from "node:assert/strict";
import { repayTreatmentOf } from "../js/tax/tax-repay.js";

const rec = { id: "r1", kind: "wire", repay_required: true, received_on: "2026-08-01", amount: 29990 };
let ctx = {};
const setup = (debt, cfg = {}) => { ctx = { repayAsGift: cfg.repayAsGift, debts: debt ? [debt] : [], debtTxns: debt ? [{ debt_id: debt.id, income_record_id: "r1" }] : [] }; };
const repayTreatment = (r) => repayTreatmentOf(r, ctx);

test("没标需要还：算赠与", () => { setup(null); assert.equal(repayTreatment({ ...rec, repay_required: false }), "gift"); });
test("标了需要还但没关联借贷：算赠与", () => { setup(null); assert.equal(repayTreatment(rec), "gift"); });
test("关联的亲友借贷借据未填 / 口头：算赠与", () => {
  setup({ id: "d1", category: "personal_lending", agreement: "verbal", interest_rate: 4 }); assert.equal(repayTreatment(rec), "gift");
  setup({ id: "d1", category: "personal_lending" }); assert.equal(repayTreatment(rec), "gift");
});
test("关联的亲友借贷有书面借据 + 利息：按正式借款", () => {
  setup({ id: "d1", category: "personal_lending", agreement: "written", interest_rate: 4 }); assert.equal(repayTreatment(rec), "formal");
});
test("当年关了开关：按借款", () => { setup(null, { repayAsGift: false }); assert.equal(repayTreatment(rec), "toggle"); });
