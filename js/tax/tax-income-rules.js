/* 税务 · 收入报税规则表：每一种收入类型（叶子）归到哪个「报税一级」、要不要报、为什么、TurboTax 里在哪填、汇总页有没有这一项。
 * 只是参考，以 IRS / 伊利诺伊税务局官网和 TurboTax 为准；政策常变，标「待核对」的报税前再看一遍。纯数据 + 一个判断函数，不碰页面（页面在 tax-income-card.js）。
 *
 * n（要不要报）：tax = 要报（计入「应税合计」）；maybe = 看情况（单独列出，不计入合计）；no = 一般不用报；info = 不是收入，只看申报线（赠与）。
 * sum：汇总页（tax-numbers.js）里对应哪一行的 id；null = 汇总页没有这一行。 */
import { splitRecord } from "../core/income-taxonomy.js";

const z = (zh, en) => ({ zh, en });

/** 报税一级（顺序 = 页面里的顺序） */
export const TAX_GROUPS = [
  { id: "work",   icon: "💼", name: z("工作收入（W-2）", "Employment (W-2)"), desc: z("工资、奖金、股票薪酬都在雇主给的 W-2 里，按 W-2 填。", "Wages, bonus and stock pay are on the employer's W-2; enter from the W-2.") },
  { id: "invest", icon: "📈", name: z("投资收益", "Investment income"), desc: z("利息、股息、卖出收益；对照银行 / 券商寄来的 1099。", "Interest, dividends and sale gains; match the 1099s from your bank or broker.") },
  { id: "rent",   icon: "🏠", name: z("房租与房产收入", "Rental & property"), desc: z("租金（含车位、储藏间）；扣掉费用和折旧后才交税。", "Rent (incl. parking and storage); taxed on the net after expenses and depreciation.") },
  { id: "side",   icon: "🛠️", name: z("副业 / 稿酬", "Side work & honoraria"), desc: z("副业、稿酬、讲课 / 评审费。对方不寄 1099 也要报。", "Side work, honoraria, speaking or review fees. Report even without a 1099.") },
  { id: "maybe",  icon: "📥", name: z("看情况的入账", "Depends on the facts"), desc: z("要看具体是什么钱，先补对类型；不计入合计。", "Depends on what it is; fix the type first. Not in the total.") },
  { id: "no",     icon: "🧾", name: z("一般不用报", "Usually not reportable"), desc: z("退税、理赔、报销、退款这类，一般不用报。", "Refunds, insurance payouts and reimbursements are usually not reportable.") },
  { id: "gift",   icon: "🎁", name: z("亲友赠与（不是收入）", "Family gifts (not income)"), desc: z("收到赠与不是收入、不交税；非美国人给的合计超过 $10 万才要报 Form 3520。", "A gift is not income or taxed; gifts from non-US persons above $100,000 need Form 3520.") },
];

const W2 = z("W-2 框 1 已包含，抄 W-2 的数，别在这里再单独填一遍", "Already inside W-2 box 1: enter the W-2, don't add this again");
const W2_TT = z("Wages & Income → Jobs & Wages (W-2)", "Wages & Income → Jobs & Wages (W-2)");
const WHY_W2 = z("工资、奖金、加班、提成、股票薪酬都是应税工资，雇主会算进 W-2。", "Wages, bonus, overtime, commission and stock pay are taxable wages the employer puts on your W-2.");
const RENT_TT = z("Wages & Income → Rental properties and royalties (Schedule E)", "Wages & Income → Rental properties and royalties (Schedule E)");
const INT_TT = z("Wages & Income → Interest and dividends → Interest (1099-INT)", "Wages & Income → Interest and dividends → Interest (1099-INT)");
const GAIN_TT = z("Wages & Income → Investment income → Stocks, mutual funds, bonds / Crypto (1099-B / 1099-DA)", "Wages & Income → Investment income → Stocks, mutual funds, bonds / Crypto (1099-B / 1099-DA)");
const SIDE_TT = z("Wages & Income → Self-employment (Schedule C)；一次性、不是做生意的 → Less common income → Miscellaneous income → Other reportable income", "Wages & Income → Self-employment (Schedule C); a one-off that is not a business → Less common income → Miscellaneous income → Other reportable income");
const NOT_INCOME = z("汇总页没有这一行（不是收入，不用填）", "No row on the summary page (not income, nothing to enter)");

/** 每种收入类型的规则：leaf id → { g 一级, n, why 为什么, tt TurboTax 在哪填, sum 汇总行 id, sumNote 汇总说明（没有汇总行时） } */
export const TAX_RULES = {
  payroll:  { g: "work", n: "tax", why: WHY_W2, tt: W2_TT, sum: "wages", sumNote: W2 },
  bonus:    { g: "work", n: "tax", why: WHY_W2, tt: W2_TT, sum: "wages", sumNote: W2 },
  overtime: { g: "work", n: "tax", why: WHY_W2, tt: W2_TT, sum: "wages", sumNote: W2 },
  commission: { g: "work", n: "tax", why: WHY_W2, tt: W2_TT, sum: "wages", sumNote: W2 },
  rsu:      { g: "work", n: "tax", why: z("股票薪酬归属时按当时市价算工资，已在 W-2 框 1；卖出时的涨跌另算资本利得。", "RSUs are wages at vesting value and are in W-2 box 1; later gain or loss on sale is a capital gain."), tt: z("Wages & Income → Jobs & Wages (W-2)；卖出另填 1099-B", "Wages & Income → Jobs & Wages (W-2); the sale goes on the 1099-B"), sum: "wages", sumNote: W2 },
  package:  { g: "work", n: "tax", why: z("雇主给的现金类福利、可抵现的福利是应税工资；纯医疗 / 退休供款一般不算。", "Cash-like employer perks are taxable wages; plain health or retirement contributions usually are not."), tt: W2_TT, sum: "wages", sumNote: W2 },
  other_employment: { g: "work", n: "tax", why: z("给雇主打工的其他收入。发 W-2 就在 W-2 里；按外包（1099-NEC）付的，要当副业收入报。", "Other pay from an employer. On a W-2 it is already there; if paid as a contractor (1099-NEC) it is self-employment income."), tt: z("W-2 → Jobs & Wages；外包 → Self-employment (Schedule C)", "W-2 → Jobs & Wages; contractor → Self-employment (Schedule C)"), sum: "wages", sumNote: W2 },

  interest:      { g: "invest", n: "tax", why: z("利息是应税收入；银行不到 $10 可能不寄 1099-INT，仍要报。", "Interest is taxable; a bank may skip the 1099-INT under $10, but it is still reportable."), tt: INT_TT, sum: "interest" },
  bank_interest: { g: "invest", n: "tax", why: z("存款利息是应税收入；银行不到 $10 可能不寄 1099-INT，仍要报。", "Savings interest is taxable; a bank may skip the 1099-INT under $10, but it is still reportable."), tt: INT_TT, sum: "interest" },
  bond_interest: { g: "invest", n: "tax", why: z("债券利息联邦应税；美国国债利息联邦税要报、伊州免税（待核对）。", "Bond interest is federally taxable; US Treasury interest is federal-taxable but Illinois-exempt (verify)."), tt: INT_TT, sum: "interest" },
  dividends: { g: "invest", n: "tax", why: z("股息 / 基金分红是应税收入，券商寄 1099-DIV。", "Dividends and fund payouts are taxable; the broker sends a 1099-DIV."), tt: z("Wages & Income → Interest and dividends → Dividends (1099-DIV)", "Wages & Income → Interest and dividends → Dividends (1099-DIV)"), sum: "dividends" },
  fund_dist: { g: "invest", n: "tax", why: z("基金分配（股息 / 资本利得分配）应税，对照 1099-DIV。", "Fund distributions (dividends / capital-gain distributions) are taxable; match the 1099-DIV."), tt: z("Wages & Income → Interest and dividends → Dividends (1099-DIV)", "Wages & Income → Interest and dividends → Dividends (1099-DIV)"), sum: "dividends" },
  capital_gain: { g: "invest", n: "tax", why: z("卖出的已实现收益要报资本利得；这里只算你填了的「已实现收益」，成本基础以 1099-B 为准。", "Realised gains from sales are reportable capital gains; only the gain you filled in is counted, cost basis comes from the 1099-B."), tt: GAIN_TT, sum: "gains" },
  stock_sale: { g: "invest", n: "tax", why: z("卖股票 / 基金：只有「已实现收益」算收入，本金不算；每笔卖出都要在 1099-B 里报。", "Stock or fund sales: only the realised gain counts, not principal; every sale is reported from the 1099-B."), tt: GAIN_TT, sum: "gains" },
  sale: { g: "invest", n: "tax", why: z("出售所得：只有高于成本的部分才算收益；自用二手物品卖亏了不用报。", "Sale proceeds: only the part above cost is a gain; personal items sold at a loss are not reported."), tt: z("Wages & Income → Less common income → Miscellaneous income → Other reportable income（有收益才填）", "Wages & Income → Less common income → Miscellaneous income → Other reportable income (only with a gain)"), sum: "gains" },
  property_sale: { g: "invest", n: "tax", why: z("卖房：自住满 2 年夫妻合计 $50 万以内的收益可免税；在「买卖房」页单独算。", "Home sale: gain up to $500k (joint) can be excluded after living there 2 of 5 years; worked out in the Sales tab."), tt: z("Wages & Income → Investment income → Sale of home (1099-S)", "Wages & Income → Investment income → Sale of home (1099-S)"), sum: null, sumNote: z("汇总页没有这一行，去「买卖房」页看", "No row on the summary page; see the Sales tab") },

  rental:         { g: "rent", n: "tax", why: z("租金是应税收入，扣掉费用和折旧后的净额才交税。", "Rent is taxable; you pay on the net after expenses and depreciation."), tt: RENT_TT, sum: "rental" },
  parking_income: { g: "rent", n: "tax", why: z("出租车位的钱和租金一样，是应税收入。", "Renting out a parking spot is taxable rental income."), tt: RENT_TT, sum: "rental" },
  storage_income: { g: "rent", n: "tax", why: z("出租储藏间的钱和租金一样，是应税收入。", "Renting out storage space is taxable rental income."), tt: RENT_TT, sum: "rental" },
  other_property: { g: "rent", n: "tax", why: z("房产带来的其他收入（押金没收、违约金等）一般按租金收入报。", "Other property income (forfeited deposits, fees) is usually reported as rent."), tt: RENT_TT, sum: "rental" },
  property_reimb: { g: "rent", n: "maybe", why: z("出租房费用的报销 / 返还要冲减对应费用；自住房的不算收入。", "Reimbursement of rental expenses reduces those expenses; for your own home it is not income."), tt: z("Schedule E 的费用里冲减；自住房不填", "Offset against Schedule E expenses; nothing for your own home"), sum: null, sumNote: NOT_INCOME },

  side_business: { g: "side", n: "tax", why: z("副业、稿酬、讲课 / 评审费都是应税收入，对方不寄 1099 也要报：寄不寄 1099 是对方的义务（低于门槛可以不寄），不影响你要不要报。净额 ≥ $400 还要交自雇税。", "Side work, honoraria and speaking/review fees are taxable whether or not you get a 1099: issuing one is the payer's duty (they may skip it below the threshold). Net ≥ $400 also owes self-employment tax."), tt: SIDE_TT, sum: "selfEmp" },
  honorarium: { g: "side", n: "tax", why: z("稿酬 / 酬金 / 讲课 / 评审费是应税收入。对方不寄 1099 也要报：寄 1099 是对方的义务（低于门槛可以不寄），不影响你要不要报。净额 ≥ $400 还要交自雇税。", "Honoraria and speaking/review fees are taxable. Report them even with no 1099: issuing one is the payer's duty (they may skip it below the threshold). Net ≥ $400 also owes self-employment tax."), tt: SIDE_TT, sum: "selfEmp" },
  other:     { g: "maybe", n: "maybe", why: z("没分清是什么钱。别人付给你的劳务 / 稿酬是应税的，退款 / 垫付归还不是；先补一下类型。", "Unclear what this is. Payment for work or a writing fee is taxable; a refund or repaid advance is not. Fix the type first."), tt: z("劳务类 → Other reportable income；其他不填", "Work payment → Other reportable income; otherwise nothing"), sum: null, sumNote: z("汇总页没有这一行；判断是应税后，改成「副业收入」才会进汇总", "No row on the summary page; once it is taxable, change it to Side business to include it") },
  zelle:     { g: "maybe", n: "maybe", why: z("Zelle / Venmo 转入本身不是收入：朋友还钱、分摊不用报；收的是服务费就是副业收入。", "A Zelle/Venmo transfer is not income by itself: friends repaying or splitting is not reportable; fees for services are side income."), tt: z("服务费 → Self-employment；其余不填", "Service fees → Self-employment; otherwise nothing"), sum: null, sumNote: z("汇总页没有这一行；是服务费的话改成「副业收入」", "No row on the summary page; for service fees change it to Side business") },
  cashback:  { g: "maybe", n: "maybe", why: z("刷卡返现一般算折扣不用报；开户 / 办卡奖金、推荐奖励要报，银行会寄 1099-INT 或 1099-MISC。", "Card cash back is usually a rebate, not income; sign-up bonuses and referral rewards are taxable (1099-INT / 1099-MISC)."), tt: z("收到 1099 → 对应的 Interest 或 Other reportable income", "With a 1099 → Interest or Other reportable income"), sum: null, sumNote: z("汇总页没有这一行；开户奖金的话看 1099-INT", "No row on the summary page; for account bonuses check the 1099-INT") },
  gov_benefit: { g: "maybe", n: "maybe", why: z("失业金（1099-G）联邦要报；儿童福利、食品补助等多数不用报。", "Unemployment pay (1099-G) is federally taxable; child benefits and food aid are mostly not."), tt: z("Wages & Income → Unemployment (1099-G)", "Wages & Income → Unemployment (1099-G)"), sum: null, sumNote: z("汇总页没有这一行；有 1099-G 时对着填", "No row on the summary page; enter from the 1099-G if you have one") },

  tax_refund:     { g: "no", n: "no", why: z("联邦退税不是收入；州退税（1099-G）只有上年逐项扣除时扣过州税才要报。", "A federal refund is not income; a state refund (1099-G) matters only if you itemized last year and deducted state tax."), tt: z("有 1099-G 且上年逐项扣除 → State and local refunds", "With a 1099-G and itemizing last year → State and local refunds"), sum: null, sumNote: NOT_INCOME },
  insurance:      { g: "no", n: "no", why: z("保险理赔是补偿损失，一般不算收入；超过实际损失的部分才可能要报。", "An insurance payout makes up a loss and is not income; only the part above the actual loss might be."), tt: z("一般不填", "Usually nothing"), sum: null, sumNote: NOT_INCOME },
  reimburse:      { g: "no", n: "no", why: z("雇主按报销制度报给你的花费不是收入（不进 W-2）；超出实际花费的部分才算。", "Employer reimbursement of business costs under an accountable plan is not income (not on the W-2)."), tt: z("不填", "Nothing to enter"), sum: null, sumNote: NOT_INCOME },
  expense_refund: { g: "no", n: "no", why: z("买东西的退款只是把花的钱拿回来，不是收入。", "A purchase refund just returns money you spent; it is not income."), tt: z("不填", "Nothing to enter"), sum: null, sumNote: NOT_INCOME },
  returned_principal: { g: "no", n: "no", why: z("本金返还是拿回自己的钱，不是收入。", "Returned principal is your own money back, not income."), tt: z("不填", "Nothing to enter"), sum: null, sumNote: NOT_INCOME },

  gift: { g: "gift", n: "info", why: z("收到赠与不是收入，收礼人不交税。只有非美国人给的合计超过 $10 万才要报 Form 3520（申报，不是交税）。", "A gift is not income and the recipient pays no tax. Only gifts from non-US persons above $100,000 a year need Form 3520 (a filing, not a tax)."), tt: z("Federal Taxes → Other tax situations → Report Foreign Gifts (Form 3520)；没超过不填", "Federal Taxes → Other tax situations → Report foreign gifts (Form 3520); nothing if under the limit"), sum: "gifts" },
  wire: { g: "gift", n: "info", why: z("国际电汇只是钱到账，不一定是收入：是亲友赠与就按赠与看；是工资 / 稿酬 / 卖东西的钱，要改成对应类型。", "An international wire is only money arriving: if it is a family gift treat it as a gift; if it is pay, a fee or a sale, change the type."), tt: z("赠与 → Form 3520（超 $10 万）；其他 → 对应类型", "Gift → Form 3520 (over $100k); otherwise per its real type"), sum: "gifts" },
};

/* 工作收入这一组：你记的是税后到账，不是应税工资；每条说明前面都先写这一句 */
const TAKE_HOME = z("你记的是税后到账，不是应税工资，报税以 W-2 为准。", "What you record is take-home pay, not taxable wages; the W-2 is what you file from.");
for (const r of Object.values(TAX_RULES)) if (r.g === "work") r.why = z(`${TAKE_HOME.zh}${r.why.zh}`, `${TAKE_HOME.en} ${r.why.en}`);

/** 这笔该怎么看：{ rule（没规则的类型返回 null，不列）, n, amount（计入的金额）, why, tt, sum, sumNote, tag（额外一句话，没有就空） }
 *  规则按类型；再按这一笔自己的情况调整：需要还 → 当借款；赠与人是美国人 → 不用申报；卖出没填已实现收益 → 先不算。 */
/** treat = 这笔标了「需要还」的税务处理（tax-calendar.js repayTreatment 算好传进来；没传 = "gift"） */
export function assessRecord(r, { treat = "gift" } = {}) {
  const rule = TAX_RULES[r.kind];
  if (!rule) return null;
  const split = splitRecord(r), amount = rule.g === "gift" || rule.n === "no" ? +r.amount || 0 : split.income;   // 赠与 / 不用报的显示到账金额；要报的显示认定收入
  const base = { rule, n: rule.n, amount, why: rule.why, tt: rule.tt, sum: rule.sum, sumNote: rule.sumNote, tag: null, group: rule.g };
  if (r.kind === "gift" && r.gift_donor === "us") return { ...base, tag: z("美国人给的：不用报 3520", "US donor: no Form 3520") };
  if (r.repay_required && treat === "gift" && rule.g === "gift") return { ...base, tag: z("有借款标记：税务上先按赠与算（你的借贷还款记录不受影响）", "Marked as a loan: counted as a gift for tax (your loan repayment records are unchanged)"), why: z("你在家里的账上标了「需要还」，但税务看实质：没有正式借据、利息和还款安排的「借款」，IRS 可能当赠与，所以先按赠与计入 Form 3520 的合计。要按真借款处理：在借贷里把「借款凭证」填成「有书面借据」，并写上利息或还款计划，这笔会自动改按借款；或取消卡片底部的勾选（整年都不算）。", "You marked it as repayable in your own books, but tax looks at substance: a “loan” with no formal note, interest or repayment schedule may be treated as a gift by the IRS, so it counts toward the Form 3520 total. To treat it as a genuine loan: in Loans set the agreement to “written note” and add interest or a repayment plan, and it switches to a loan automatically; or untick the box at the bottom of the card (whole year).") };
  if (r.repay_required) return { ...base, n: "no", amount: +r.amount || 0, group: "no", tag: treat === "formal" ? z("有正式借据：按借款，不计入赠与", "Formal loan: treated as a loan, not a gift") : z("需要还：当借款", "Must repay: treated as a loan"), why: z("需要还的钱是借款，不是收入，也不是赠与。", "Money you must repay is a loan, not income or a gift."), tt: z("不填", "Nothing to enter"), sum: null, sumNote: NOT_INCOME };
  if (r.kind === "gift" && !r.gift_donor) return { ...base, tag: z("没标赠与人：先按非美国人", "Donor not set: counted as non-US") };
  if (["stock_sale", "sale", "property_sale"].includes(r.kind) && (r.income_amount == null || r.income_amount === "")) return { ...base, n: "maybe", tag: z("没填已实现收益：未计入", "No gain filled in: not counted") };
  return base;
}
