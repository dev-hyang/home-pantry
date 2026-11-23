/* 税务口径的「正式借款」判断（debt-rules.js 的 isFormalDebt）：银行类永远算；亲友借贷要有书面借据，并且有利息或还款计划 */
import test from "node:test";
import assert from "node:assert/strict";
import { isFormalDebt } from "../js/core/debt-rules.js";

const p = (o) => ({ category: "personal_lending", ...o });

test("银行类借贷永远是正式的", () => {
  assert.equal(isFormalDebt({ category: "mortgage" }), true);
  assert.equal(isFormalDebt({ category: "auto_loan", agreement: null }), true);
});
test("亲友借贷：没填 / 口头 / 没有 都不算正式", () => {
  assert.equal(isFormalDebt(p({})), false);
  assert.equal(isFormalDebt(p({ agreement: "verbal", interest_rate: 4 })), false);
  assert.equal(isFormalDebt(p({ agreement: "none", scheduled_payment: 500 })), false);
});
test("亲友借贷：有书面借据但没有利息也没有还款计划，不算正式", () => {
  assert.equal(isFormalDebt(p({ agreement: "written" })), false);
  assert.equal(isFormalDebt(p({ agreement: "written", interest_rate: 0, scheduled_payment: null })), false);
});
test("亲友借贷：书面借据 + 利息 / 每期还款 / 到期日 任一项，算正式", () => {
  assert.equal(isFormalDebt(p({ agreement: "written", interest_rate: 4.5 })), true);
  assert.equal(isFormalDebt(p({ agreement: "written", scheduled_payment: 800 })), true);
  assert.equal(isFormalDebt(p({ agreement: "written", maturity_date: "2027-06-30" })), true);
});
test("空对象 / 空值不算正式", () => {
  assert.equal(isFormalDebt(null), false);
  assert.equal(isFormalDebt(undefined), false);
});
