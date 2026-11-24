/* 用文件补录交易信息：整理 AI 结果、和现有信息比、生成要写的字段 */
import test from "node:test";
import assert from "node:assert/strict";
import { buildPatch, fieldDiff, tidyDeal } from "../js/core/closing-ai-lib.js";

test("整理：日期要合法、金额非负、公司名截短、乱写的付款方式去掉", () => {
  const r = tidyDeal({ doc_type: "closing_disclosure", closing_date: "2026-06-05", contract_date: "06/01/2026", price: "$525,000.00", earnest_money: -5, lender: " Chase  Home Lending ", title_company: "null", financing: "mortgage", loan_amount: 420000 });
  assert.equal(r.closing_date, "2026-06-05"); assert.equal(r.contract_date, null);   // 格式不对的日期不要
  assert.equal(r.price, 525000); assert.equal(r.earnest_money, null);
  assert.equal(r.lender, "Chase Home Lending"); assert.equal(r.title_company, null);
  assert.equal(r.financing, "loan");   // 没给合法值，但有贷款金额 → 贷款
  assert.equal(tidyDeal({ financing: "CASH" }).financing, "cash");
  assert.equal(tidyDeal(null).doc_type, "other");
});
test("和现有比：空的 = 新，一样 = 一致，两边都有但不同 = 不同；没读到的不列", () => {
  const deal = { closing_on: "2026-06-05", price: 500000, lender: "", agent: "Acme Realty", earnest_money: 5000 };
  const read = tidyDeal({ closing_date: "2026-06-05", price: 525000, lender: "Chase", agent: "acme realty", earnest_money: 5000, title_company: "First American" });
  const rows = Object.fromEntries(fieldDiff(deal, read).map((r) => [r.key, r.state]));
  assert.deepEqual(rows, { closing_on: "same", price: "diff", earnest_money: "same", lender: "new", title_company: "new", agent: "same" });
});
test("没有财务权限：成交价和定金不列", () => {
  const read = tidyDeal({ price: 1, earnest_money: 2, lender: "X" });
  assert.deepEqual(fieldDiff({}, read, { prices: false }).map((r) => r.key), ["lender"]);
});
test("车辆只列车辆的字段；写入只含勾选的、不含一致的", () => {
  const read = tidyDeal({ closing_date: "2026-07-01", price: 30000, lender: "CU", attorney: "Law LLP", financing: "loan" });
  const rows = fieldDiff({ price: 30000 }, read, { veh: true });
  assert.deepEqual(rows.map((r) => r.key).sort(), ["closing_on", "financing", "lender", "price"]);   // 没有 attorney
  assert.deepEqual(buildPatch(rows, new Set(["closing_on", "price", "lender"])), { closing_on: "2026-07-01", lender: "CU" });   // price 一致不写
});
