/* 用文件（购房合同 / Closing Disclosure / 结算单 / 购车协议）补录交易信息的纯逻辑（不碰页面 / AI / 数据库，方便测试）：
 *  · tidyDeal：把 AI 返回的 JSON 整理成干净的字段（日期要合法、金额非负、公司名截短、付款方式只认 loan / cash）
 *  · fieldDiff：和这笔交易现有的信息一项项比：新 = 现在是空的（默认勾上）、不同 = 两边都有但不一样（默认不勾，要你确认）、一致 = 不用写
 *  · buildPatch：把勾选的项写成要保存的字段 */
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || "") && !Number.isNaN(Date.parse(v));
const num = (v) => { const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, "")); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null; };
const txt = (v) => { const s = String(v ?? "").trim().replace(/\s+/g, " "); return s && !/^(null|n\/a|none|unknown)$/i.test(s) ? s.slice(0, 120) : null; };

/** 每类交易能补录哪些字段：[交易字段, AI 返回的字段, 中文名]。房产买卖多几个日期和机构；车辆少一些 */
export const DEAL_AI_FIELDS = {
  property: [["contract_on", "contract_date", "合同日"], ["closing_on", "closing_date", "交割日"], ["review_deadline", "review_deadline", "律师审查截止"], ["financing_deadline", "financing_deadline", "贷款条款截止"],
    ["price", "price", "成交价"], ["earnest_money", "earnest_money", "定金"], ["financing", "financing", "付款方式"], ["lender", "lender", "贷款行 / 贷款经纪"], ["title_company", "title_company", "产权公司"], ["agent", "agent", "经纪人"], ["attorney", "attorney", "律师"]],
  vehicle: [["contract_on", "contract_date", "签约 / 成交日"], ["closing_on", "closing_date", "提车 / 交车日"], ["price", "price", "成交价"], ["earnest_money", "earnest_money", "定金"], ["financing", "financing", "付款方式"], ["lender", "lender", "贷款行"], ["agent", "agent", "车行 / 对方"]],
};
export const DOC_TYPES = ["closing_disclosure", "settlement_statement", "purchase_contract", "bill_of_sale", "other"];

/** AI 返回 → 干净字段；没读到的是 null。loan_amount > 0 而 financing 没给 = 贷款 */
export function tidyDeal(raw) {
  const d = raw && typeof raw === "object" ? raw : {};
  const loanAmt = num(d.loan_amount);
  let financing = ["loan", "cash"].includes(String(d.financing || "").toLowerCase()) ? String(d.financing).toLowerCase() : null;
  if (!financing && loanAmt > 0) financing = "loan";
  return {
    doc_type: DOC_TYPES.includes(d.doc_type) ? d.doc_type : "other",
    contract_date: isDate(d.contract_date) ? d.contract_date : null, closing_date: isDate(d.closing_date) ? d.closing_date : null,
    review_deadline: isDate(d.review_deadline) ? d.review_deadline : null, financing_deadline: isDate(d.financing_deadline) ? d.financing_deadline : null,
    price: num(d.price), earnest_money: num(d.earnest_money), loan_amount: loanAmt, financing,
    lender: txt(d.lender), title_company: txt(d.title_company), agent: txt(d.agent), attorney: txt(d.attorney),
  };
}
const empty = (v) => v == null || v === "";
/** 和现有交易信息比。deal = 现有交易；read = tidyDeal 的结果；opts.veh = 车辆交易；opts.prices = 有没有权限看 / 改价格 */
export function fieldDiff(deal, read, { veh = false, prices = true } = {}) {
  return DEAL_AI_FIELDS[veh ? "vehicle" : "property"].filter(([k]) => prices || !["price", "earnest_money"].includes(k))
    .map(([key, from, label]) => {
      const cur = deal[key] ?? null, got = read[from] ?? null; if (empty(got)) return null;
      const same = typeof got === "number" ? Math.abs(Number(cur) - got) < 0.005 : String(cur ?? "").trim().toLowerCase() === String(got).trim().toLowerCase();
      return { key, label, cur: empty(cur) ? null : cur, read: got, state: empty(cur) ? "new" : same ? "same" : "diff" };
    }).filter(Boolean);
}
/** 勾选的项 → 要保存的字段（只有 new / diff 的能写；一致的不用写） */
export function buildPatch(rows, checked) {
  const patch = {}; for (const r of rows) if (checked.has(r.key) && r.state !== "same") patch[r.key] = r.read; return patch;
}
