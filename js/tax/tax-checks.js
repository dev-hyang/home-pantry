/* 税务 · 账户检查：从「卡与账户」里已有的账户（HSA、FSA、529、孩子账户、退休、券商、加密…）和税务设置推出需要留意的事，
 * 最典型的是 HSA 和普通医疗 FSA 不能同时供款（自己的或配偶单位的 FSA 都算）。税务页的「账户与开户」和提醒都读这里。
 * 这个文件会随首页一起加载，所以只放判断和短标题；长说明在 tax-content-accounts.js（进税务页才下载）。参考用，不是税务建议。 */
import { state } from "../core/state.js";
import { acctOf, setupOf } from "./tax-calendar.js";

const z = (zh, en) => ({ zh, en });
/** FSA 的几种：只有「普通医疗」和没标记的会和 HSA 冲突 */
export const FSA_TYPES = { general: z("普通医疗 FSA", "General-purpose health FSA"), limited: z("只限牙科 / 视力（limited-purpose）", "Limited-purpose (dental / vision only)"), dependent: z("看护 FSA（孩子 / 家人看护）", "Dependent-care FSA"), commuter: z("通勤福利（公交 / 停车）", "Commuter benefits (transit / parking)") };
const live = (kind) => (state.cards || []).filter((c) => c.kind === kind && c.active !== false);
const NEEDS_TYPE = (c) => !["limited", "dependent", "commuter"].includes(acctOf(c.id).fsaType);

/** 检查结果：{ id, level: "warn" | "info", kind（账户类型，用来在页面里对应指南）, title, body, accts? } */
export function accountChecks() {
  const out = [], hsa = live("hsa"), fsa = live("fsa"), flags = setupOf().flags;
  const risky = fsa.filter(NEEDS_TYPE);
  if (hsa.length && (risky.length || flags.generalFsa)) {
    out.push({ id: "hsa-fsa", level: "warn", kind: "hsa", accts: risky.map((c) => c.id), title: z("HSA 和普通医疗 FSA 不能同时供款", "HSA and a general-purpose health FSA cannot both be funded"),
      body: z("你们有 HSA，同时有（或还没确认类型的）FSA，或者配偶单位有普通医疗 FSA。普通医疗 FSA 也能报销你的医疗费，所以从那个 FSA 生效的月份起 HSA 就不能再供款；硬供会算超额供款：补税并每年罚 6%，要在报税截止日前把超额部分取出来。先在下面把每个 FSA 的类型标出来；只限牙科 / 视力、看护、通勤这三种不冲突。", "You have an HSA and also an FSA (or one whose type is not confirmed), or a spouse's employer offers a general-purpose health FSA. A general-purpose FSA can reimburse your medical costs too, so from the month it starts you cannot contribute to the HSA; doing so is an excess contribution (added to income plus a 6% yearly excise tax) and must be withdrawn before the filing deadline. Mark the type of each FSA below; limited-purpose, dependent-care and commuter FSAs do not conflict.") });
  } else if (hsa.length) {
    out.push({ id: "hsa-ok", level: "info", kind: "hsa", title: z("HSA：确认你们符合供款条件", "HSA: confirm you are eligible to contribute"),
      body: z("要有符合条件的高免赔额保险（HDHP），且没有别的非 HDHP 保险、没上 Medicare、没有普通医疗 FSA / HRA（配偶单位的也算）。家庭限额夫妻共用，不是各一份；每年的限额待核对。", "You need qualifying high-deductible coverage and no other non-HDHP coverage, no Medicare, and no general-purpose health FSA / HRA (a spouse's counts). The family limit is shared by the couple, not one each; check the yearly limit.") });
  }
  if (hsa.length > 1) out.push({ id: "hsa-two", level: "info", kind: "hsa", title: z("夫妻各有一个 HSA：限额合起来算", "Two HSAs: one combined limit"), body: z("家庭保险下夫妻的 HSA 供款合计不能超过家庭限额，可以分着存；55 岁以上每人各有额外的补缴额度，但要存在各自名下的 HSA。", "Under family coverage both spouses' contributions together cannot exceed the family limit and can be split; the over-55 catch-up is per person and must go into that person's own HSA.") });
  if (fsa.length && !hsa.length && risky.length) out.push({ id: "fsa-type", level: "info", kind: "fsa", accts: risky.map((c) => c.id), title: z("标一下 FSA 的类型", "Mark the type of your FSA"), body: z("是普通医疗、只限牙科 / 视力、看护，还是通勤福利？以后想开 HSA 时要靠它判断能不能供款。", "Is it general-purpose health, limited-purpose, dependent-care or commuter? You will need it to decide whether you can fund an HSA later.") });
  if (live("education").length) out.push({ id: "529", level: "info", kind: "education", title: z("529：伊利诺伊供款扣除和赠与额度", "529: Illinois deduction and gift limits"), body: z("联邦不能抵扣供款，但增长免税；伊利诺伊对 IL 的 529 计划供款有州所得税扣除（有限额，待核对）。供款算赠与，每人每个孩子每年有免申报额度。", "No federal deduction, but growth is tax-free; Illinois gives a state deduction for contributions to Illinois plans (capped, verify). Contributions count as gifts, with a yearly no-filing amount per donor per child.") });
  if (live("kid").length) out.push({ id: "kid", level: "info", kind: "kid", title: z("孩子的投资账户：先看是哪一种", "Child investment account: know which type it is"), body: z("Trump account、UTMA / UGMA 的规则很不一样：UTMA 是孩子的钱、有「孩子的投资收入税」，Trump account 是新制度（细则待核对）。开户前先去「账户与开户」看对比。", "Trump accounts and UTMA / UGMA work very differently: UTMA money belongs to the child and is subject to the kiddie tax; the Trump account is a new scheme (details to verify). Read the comparison in Accounts before opening one.") });
  if (live("crypto").length) out.push({ id: "crypto", level: "info", kind: "crypto", title: z("加密货币账户：每次卖出 / 换币都是应税事件", "Crypto account: every sale or swap is taxable"), body: z("1040 首页有数字资产的问题，要如实回答；交易所导出完整记录，保存买入价和日期。", "The 1040 asks about digital assets on page 1; export the full history and keep cost and dates.") });
  if (live("brokerage").length && !flags.stocks) out.push({ id: "brokerage", level: "info", kind: "brokerage", title: z("有券商账户：打开「买卖股票」标记", "Brokerage account: turn on “stocks”"), body: z("在「今年」页的家庭情况里打开，才会提醒 1099-B 和卖出收益。", "Turn it on under Household in This year so 1099-B and sale gains are tracked.") });
  if (live("retirement").length) out.push({ id: "retirement", level: "info", kind: "retirement", title: z("退休账户：供款额度和 Roth / 传统的选择", "Retirement accounts: limits and Roth vs traditional"), body: z("401K 在工资里自动扣，IRA 另有额度；Roth 有收入上限，传统 IRA 的扣除看有没有工作单位计划和收入。额度和上限每年变，待核对。", "401K deferrals come out of pay and IRAs have their own limit; Roth has income limits and the traditional IRA deduction depends on workplace coverage and income. Limits change yearly, verify.") });
  return out;
}
export const warnChecks = () => accountChecks().filter((c) => c.level === "warn");
