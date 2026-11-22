/* 税务 · 数字汇总表（二期）：把一个税务年度里和报税有关的数字，从家里已有的记录算出来（或让你手填），按 TurboTax 的填写顺序排好，
 * 每一行带来源链接和「TurboTax 里在哪填」。全是参考值，永远以官方单据（W-2、1099、1098…）为准；不存任何证件号。
 * 自动算的：利息 / 股息 / 卖出收益 / 租金（收入账本）、房贷利息（借贷的利息拆分）、房产税和已缴预缴税（账单缴费）、赠与累计；
 * 手填的：工资和已扣税（W-2）、捐款、医疗、HSA / IRA / 401K 供款等（这些记录里没有可靠来源）。 */
import { state } from "../core/state.js";
import { href } from "../core/router.js";
import { debtById, debtTxns } from "../bills/debt-logic-common.js";
import { lang } from "../core/i18n.js";
import { foreignGiftTotal, yearState } from "./tax-calendar.js";

const z = (zh, en) => ({ zh, en });
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const inYear = (d, y) => String(d || "").slice(0, 4) === String(y);
const incRecs = (y, kinds) => (state.inc?.rec || []).filter((r) => inYear(r.received_on, y) && kinds.includes(r.kind));
const incLink = (y, kind) => `${href("bills", "income")}?tab=records&inc=1&kind=${kind}&from=${y}-01-01&to=${y}-12-31`;
const MORTGAGE_CATS = ["mortgage", "heloc", "home_equity"];

/** 标准扣除额（合并报税）和 SALT 上限：按年份，政策常变，每个数都标待核对；没有数据的年份返回 null */
export const STD_DEDUCTION = { 2024: { mfj: 29200 }, 2025: { mfj: 31500 } };
export const SALT_CAP = { 2024: 10000, 2025: 40000 };
export const RULES_NOTE = z("标准扣除额和 SALT 上限是 2024 / 2025 年的参考值（待核对）；其他年份没有数据，请对着 IRS 官网填。", "Standard deduction and SALT cap are 2024 / 2025 reference values (verify); other years have no data, check IRS.gov.");

export const mortgageInterest = (y) => r2(debtTxns().filter((x) => inYear(x.txn_date, y) && x.type === "interest_payment" && MORTGAGE_CATS.includes(debtById(x.debt_id)?.category)).reduce((s, x) => s + (+x.interest_amount || 0), 0));
const billPaid = (y, cat) => { const ids = new Set((state.bills || []).filter((b) => b.category === cat).map((b) => b.id)); return r2((state.billPayments || []).filter((p) => ids.has(p.bill_id) && inYear(p.paid_on, y) && p.status !== "skipped").reduce((s, p) => s + (+p.amount || 0), 0)); };
const sumAmt = (rows, f = "amount") => r2(rows.reduce((s, r) => s + (+r[f] || 0), 0));

/** 汇总表的行：{ id, group, name, auto（自动算的数；手填行没有）, manual, src（来源链接）, note, tt（TurboTax 里在哪填） } */
export function taxRows(y) {
  const gains = incRecs(y, ["capital_gain", "stock_sale", "sale"]), noGain = gains.filter((r) => r.kind !== "capital_gain" && r.income_amount == null).length;
  const g = foreignGiftTotal(y);
  return [
    { id: "wages", group: "income", name: z("工资总额（W-2 框 1 合计）", "Wages (W-2 box 1 total)"), manual: true, tt: z("Wages & Income → W-2", "Wages & Income → W-2"), note: z("到账金额不等于工资总额，不能自动推，抄 W-2", "Take-home pay is not gross wages; copy it from the W-2") },
    { id: "fedWh", group: "income", name: z("联邦已扣税（W-2 框 2 合计）", "Federal tax withheld (W-2 box 2 total)"), manual: true, tt: z("Wages & Income → W-2", "Wages & Income → W-2") },
    { id: "stWh", group: "income", name: z("州已扣税（W-2 框 17 合计）", "State tax withheld (W-2 box 17 total)"), manual: true, tt: z("Wages & Income → W-2；IL-1040", "Wages & Income → W-2; IL-1040") },
    { id: "interest", group: "income", name: z("利息（银行 / 债券）", "Interest (bank / bonds)"), auto: sumAmt(incRecs(y, ["interest", "bank_interest", "bond_interest"])), src: incLink(y, "g:investment"), tt: z("Wages & Income → Interest (1099-INT)", "Wages & Income → Interest (1099-INT)"), note: z("对照每张 1099-INT；利息很少银行可能不寄，仍要报", "Match each 1099-INT; tiny amounts are still reportable") },
    { id: "dividends", group: "income", name: z("股息 / 基金分配", "Dividends / fund distributions"), auto: sumAmt(incRecs(y, ["dividends", "fund_dist"])), src: incLink(y, "g:investment"), tt: z("Wages & Income → Dividends (1099-DIV)", "Wages & Income → Dividends (1099-DIV)") },
    { id: "gains", group: "income", name: z("卖出的已实现收益（股票 / 基金 / 加密）", "Realised gains from sales (stocks / funds / crypto)"), auto: sumAmt(gains, "income_amount"), src: incLink(y, "g:capital"), tt: z("Wages & Income → Investment income → Stocks / Crypto (1099-B / 1099-DA)", "Wages & Income → Investment income → Stocks / Crypto (1099-B / 1099-DA)"), note: noGain ? z(`有 ${noGain} 笔卖出记录没填「其中已实现收益」，这里没算进去；成本基础以 1099-B 为准`, `${noGain} sale record(s) have no realised gain filled in and are not counted; cost basis comes from the 1099-B`) : z("成本基础以 1099-B 为准", "Cost basis comes from the 1099-B") },
    { id: "rental", group: "income", name: z("租金收入", "Rental income"), auto: sumAmt(incRecs(y, ["rental"])), src: incLink(y, "rental"), tt: z("Wages & Income → Rental properties (Schedule E)", "Wages & Income → Rental properties (Schedule E)"), note: z("费用和折旧另算，不在这里", "Expenses and depreciation are separate, not here") },
    { id: "gifts", group: "info", name: z("境外亲友赠与（不是收入，看 Form 3520 门槛）", "Gifts from non-US donors (not income; Form 3520 threshold)"), auto: g.loaded ? g.total : null, src: `${href("bills", "tax")}?y=${y}`, tt: z("不填；超过门槛才报 Form 3520", "Not entered; Form 3520 only above the threshold") },
    { id: "mortgageInt", group: "deduction", name: z("房贷利息", "Mortgage interest"), auto: mortgageInterest(y), src: href("bills", "debts"), tt: z("Deductions & Credits → Mortgage interest (1098)", "Deductions & Credits → Mortgage interest (1098)"), note: z("来自借贷的本息拆分；以 1098 为准，两者差一点很正常", "From the loan's interest split; the 1098 is authoritative, small differences are normal") },
    { id: "propTax", group: "deduction", name: z("房产税（账单里缴的）", "Property tax (paid through bills)"), auto: billPaid(y, "property_tax"), src: `${href("bills", "all")}`, tt: z("Deductions & Credits → Property taxes", "Deductions & Credits → Property taxes"), note: z("走 Escrow 代缴的部分在 1098 里，不在账单缴费里；两边都看", "Escrow-paid tax appears on the 1098, not in bill payments; check both") },
    { id: "stateTax", group: "deduction", name: z("州所得税已缴（预缴 + 去年补缴）", "State income tax paid (estimates + last year's balance)"), manual: true, tt: z("Deductions & Credits → State and local taxes", "Deductions & Credits → State and local taxes") },
    { id: "charity", group: "deduction", name: z("捐款", "Charitable donations"), manual: true, tt: z("Deductions & Credits → Charitable donations", "Deductions & Credits → Charitable donations"), note: z("只有逐项扣除才用得上", "Only matters if you itemize") },
    { id: "medical", group: "deduction", name: z("医疗支出（自付）", "Medical expenses (out of pocket)"), manual: true, tt: z("Deductions & Credits → Medical expenses", "Deductions & Credits → Medical expenses"), note: z("要超过 AGI 的一定比例才有用，这里只记数", "Only helps above a share of AGI; recorded for reference") },
    { id: "hsa", group: "contrib", name: z("HSA 供款（本人 + 雇主）", "HSA contributions (you + employer)"), manual: true, tt: z("Deductions & Credits → HSA (Form 8889)", "Deductions & Credits → HSA (Form 8889)"), note: z("对照 5498-SA / 工资单；家庭限额夫妻合用", "Match 5498-SA / pay stubs; the family limit is shared") },
    { id: "ira", group: "contrib", name: z("IRA 供款", "IRA contributions"), manual: true, tt: z("Deductions & Credits → Retirement (IRA)", "Deductions & Credits → Retirement (IRA)") },
    { id: "k401", group: "contrib", name: z("401K 供款（本人）", "401K deferrals (you)"), manual: true, tt: z("已在 W-2 框 12 里；这里只记数", "Already in W-2 box 12; recorded for reference") },
    { id: "estPaid", group: "paid", name: z("已缴预缴税（账单里的所得税缴费）", "Estimated tax paid (income-tax bill payments)"), auto: billPaid(y, "income_tax"), src: href("bills", "all"), tt: z("Federal Taxes → Estimated tax payments", "Federal Taxes → Estimated tax payments"), note: z("联邦和州合在一起；按缴款确认单分开填", "Federal and state together; split them using the payment confirmations") },
  ];
}
export const GROUP_NAMES = { income: z("收入", "Income"), info: z("只作参考", "For information"), deduction: z("扣除", "Deductions"), contrib: z("供款", "Contributions"), paid: z("已缴税", "Tax paid") };

/** 一行当前用的数：手填优先，没有手填用自动算的（没有就 null） */
export const valueOf = (y, row) => { const m = yearState(y).nums?.[row.id]; return m != null && m !== "" ? Number(m) : row.auto ?? null; };
/** 去年同一项的数（去年自己的手填 / 自动算；没有这一项返回 null）——和去年对比、导出用 */
export const prevValue = (y, id) => { const r = taxRows(y - 1).find((x) => x.id === id); return r ? valueOf(y - 1, r) : null; };
/** 标准扣除 vs 逐项扣除（合并报税）：逐项 = 房贷利息 + min(房产税 + 州税, SALT 上限) + 捐款（医疗不算：要超过 AGI 的比例才可扣） */
export function deductionCompare(y) {
  const v = (id) => valueOf(y, taxRows(y).find((r) => r.id === id)) || 0, std = STD_DEDUCTION[y]?.mfj ?? null, cap = SALT_CAP[y] ?? null;
  const salt = v("propTax") + v("stateTax"), saltUsed = cap == null ? salt : Math.min(salt, cap), itemized = r2(v("mortgageInt") + saltUsed + v("charity"));
  return { std, cap, salt, saltUsed, itemized, better: std == null ? null : itemized > std ? "itemized" : "standard", diff: std == null ? null : r2(itemized - std) };
}

/** 导出这一年的汇总表（CSV，Excel 能直接打开；带 BOM 防乱码）：分组、项目、数、来源（自动 / 手填）、是否已核对、TurboTax 里在哪填、去年的数、备注 */
export function summaryCsv(y) {
  const en = lang === "en", pick = (o) => (o ? (en ? o.en : o.zh) : ""), esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`, st = yearState(y);
  const head = en ? ["Group", "Item", "Amount", "Origin", "Checked", "TurboTax", "Prior year", "Note"] : ["分组", "项目", "数", "来源", "已核对", "TurboTax 里在哪填", "去年", "备注"];
  const lines = [head, ...taxRows(y).map((r) => { const v = valueOf(y, r), pv = prevValue(y, r.id), manual = st.nums?.[r.id] != null && st.nums?.[r.id] !== "";
    return [pick(GROUP_NAMES[r.group]), pick(r.name), v ?? "", r.manual || manual ? (en ? "typed" : "手填") : (en ? "automatic" : "自动算"), st.ok?.[r.id] ? (en ? "yes" : "是") : "", pick(r.tt), pv ?? "", pick(r.note)]; })];
  return "\ufeff" + lines.map((l) => l.map(esc).join(",")).join("\r\n");
}
