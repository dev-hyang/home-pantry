/* ───────────── 花费统计的汇总（只做加法，规则全在 js/core/taxonomy.js） ─────────────
 * 输入是数据库 spend_rollup / spend_rollup_store 的紧凑行（迁移 055：按 月 × 分类 × 性质 × 房产 × 币种 聚合，含医疗等事件型账单的付款），
 * 在这里按分类树和统计桶再汇总一遍：概览、分类、商店、账单概览的速览、打印都用这里的结果，不再读 state.purchases。
 * 收入一侧（inc_rollup，迁移 056）和收支总览（householdFlow）也在这里汇总，规则在 js/core/income-taxonomy.js。
 * 这里不碰 DOM、不读 state，方便单独测试。 */
import { bucketOf, counted, isNode, l1IdOf, l2IdOf, leavesOf, nodeOf } from "../core/taxonomy.js";
import { splitAmounts } from "../core/income-taxonomy.js";

const r2 = (v) => Math.round(v * 100) / 100;
const canon = (id) => (window.canonCat ? window.canonCat(id) : id);

/** 数据库的行 → { m, c, nat, prop, cur, sum, n }（商店行多 sk / store） */
export const normRow = (x) => ({ m: x.month, c: canon(x.category), nat: x.nature || null, prop: x.property_id || null, cur: x.currency || "", sum: +x.sum || 0, n: +x.n || 0,
  ...(x.store_key != null ? { sk: x.store_key, store: x.store || "" } : {}) });

const zeroBuckets = () => ({ living: 0, housing: 0, financial: 0, capital: 0, investment: 0 });
/** 一段月份的汇总：
 *  bucket[m]  = 各统计桶（不受开关影响：日常 / 住房 / 财务 / 资本性 / 投资；转账不在里面）
 *  l2[m], leaf[m] = 按二级分类 / 叶子（受「排除资本性 / 排除投资」开关影响，分类页和预算式的图用）
 *  bills[m]   = 各桶里账单类（bill_*）的部分（算「均摊」用）；liv[m] = 日常生活桶按二级分类
 *  n[m]       = 笔数（不含转账）；xfer = 转账 { n, sum }；otherCur = 其他币种的笔数 */
export function aggregate(rows, months, { cur = "", exCap = false, exInv = false } = {}) {
  const set = new Set(months), out = { months, bucket: {}, bills: {}, liv: {}, l2: {}, leaf: {}, n: {}, xfer: { n: 0, sum: 0 }, otherCur: 0 };
  for (const m of months) { out.bucket[m] = zeroBuckets(); out.bills[m] = zeroBuckets(); out.liv[m] = {}; out.l2[m] = {}; out.leaf[m] = {}; out.n[m] = 0; }
  for (const r of rows) {
    if (!set.has(r.m)) continue;
    if (cur && r.cur && r.cur !== cur) { out.otherCur += r.n; continue; }
    const b = bucketOf(r.c, r.nat);
    if (!b) { out.xfer.n += r.n; out.xfer.sum = r2(out.xfer.sum + r.sum); continue; }
    out.bucket[r.m][b] += r.sum; out.n[r.m] += r.n;
    if (String(r.c).startsWith("bill_")) out.bills[r.m][b] += r.sum;
    if (b === "living") { const k = l2IdOf(r.c); out.liv[r.m][k] = (out.liv[r.m][k] || 0) + r.sum; }   // 日常生活按二级分类（概览的构成）
    if (!counted(r.c, r.nat, { exCap, exInv })) continue;
    const l2 = l2IdOf(r.c);
    out.l2[r.m][l2] = (out.l2[r.m][l2] || 0) + r.sum;
    out.leaf[r.m][r.c] = (out.leaf[r.m][r.c] || 0) + r.sum;
  }
  return out;
}
/** 某个月（或整段：m 为空）某个节点（一级 / 二级 / 叶子）的合计，按 l2 / leaf 表（受开关影响） */
export function nodeSum(agg, id, m = null) {
  const ms = m ? [m] : agg.months;
  let s = 0;
  for (const k of ms) {
    if (!agg.l2[k]) continue;
    if (id === "all") s += Object.values(agg.l2[k]).reduce((a, v) => a + v, 0);
    else if (isNode(id) && agg.l2[k][id] != null) s += agg.l2[k][id];
    else if (isNode(id)) s += Object.entries(agg.l2[k]).filter(([l2]) => l1OfL2(l2) === id).reduce((a, [, v]) => a + v, 0);
    else s += leavesOf(id).reduce((a, x) => a + (agg.leaf[k][x] || 0), 0);
  }
  return s;
}
const l1OfL2 = (l2) => nodeOf(l2)?.p;
/** 每个月的一个数：f(bucket, m) */
export const series = (agg, f) => agg.months.map((m) => f(agg.bucket[m], m));
export const sum = (arr) => arr.reduce((a, b) => a + b, 0);
export const avg = (arr) => (arr.length ? sum(arr) / arr.length : 0);
export function median(arr) {
  const x = [...arr].sort((a, b) => a - b), n = x.length;
  return n ? (n % 2 ? x[(n - 1) / 2] : (x[n / 2 - 1] + x[n / 2]) / 2) : 0;
}
/** 日常 / 含住房：每个月的值；含住房 = 日常 + 住房（房产住房下性质是日常消费的） */
export const livingSeries = (agg) => series(agg, (b) => b.living);
export const withHousingSeries = (agg) => series(agg, (b) => b.living + b.housing);
/** 现金流出 = 五个桶之和（转账不在桶里） */
export const outflowSeries = (agg) => series(agg, (b) => b.living + b.housing + b.financial + b.capital + b.investment);
/** 算月均 / 中位数用的月份：一段时间超过一个月时不含还没过完的本月（否则月均被拉低） */
export const fullMonths = (months, thisMonth) => (months.length > 1 ? months.filter((m) => m !== thisMonth) : months);
/** 均摊月均：账单按「每月折算」（年付、半年付的摊到每个月）代替实际缴费那个月的金额，其余照实际算
 *  bills = 账单（有 monthly 每月折算、category、currency；expMonthly = 拆分后算消费的部分：房贷的本金不算住房，迁移 058）；bucket = living / housing */
export function normalizedMonthly(agg, months, bills, bucket, cur = "") {
  if (!months.length) return 0;
  const nonBill = avg(months.map((m) => (agg.bucket[m]?.[bucket] || 0) - (agg.bills[m]?.[bucket] || 0)));
  const billM = (bills || []).filter((b) => b.active !== false && !b.ended && !b.escrow && b.direction !== "receivable" && (!cur || (b.currency || cur) === cur) && bucketOf(`bill_${b.category}`, null) === bucket)
    .reduce((a, b) => a + (+(b.expMonthly ?? b.monthly) || 0), 0);
  return nonBill + billM;
}
/** 子节点在一段时间里的合计（排行用），从大到小；只留 > 0 的 */
export const rankChildren = (agg, ids, m = null) => ids.map((id) => ({ id, v: r2(nodeSum(agg, id, m)) })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);

/** 商店汇总：rows = 商店行；sel = 只看某个月（空 = 整段）；l1 = 只看某个一级分类（all = 现金流出，不含转账） */
export function storeAgg(rows, months, { sel = "", cur = "", l1 = "all", exCap = false, exInv = false } = {}) {
  const set = new Set(sel ? [sel] : months), map = new Map();
  for (const r of rows) {
    if (!set.has(r.m) || (cur && r.cur && r.cur !== cur)) continue;
    if (!counted(r.c, r.nat, { exCap, exInv })) continue;
    if (l1 !== "all" && l1IdOf(r.c) !== l1) continue;
    const k = r.sk || "__none__", a = map.get(k) || { key: k, name: "", total: 0, count: 0, byL2: {} };
    if (!a.name && r.store) a.name = r.store;
    a.total += r.sum; a.count += r.n;
    const l2 = l2IdOf(r.c); a.byL2[l2] = (a.byL2[l2] || 0) + r.sum;
    map.set(k, a);
  }
  return [...map.values()].filter((a) => a.count).sort((a, b) => b.total - a.total);
}

/* ───────────── 收入与收支总览的汇总（规则全在 js/core/income-taxonomy.js） ─────────────
 * 输入是数据库 inc_rollup 的紧凑行（迁移 056：按 月 × 类型 × 成员 × 入账账户 × 币种 × 是否需要还 聚合，
 * income_sum = 填了「其中已实现收益」的认定额，dflt_sum = 没填的到账金额）；收入 / 资本流入怎么拆在 splitAmounts 里。 */
/** 数据库的行 → { m, kind, person, acct, cur, repay, amount, set, dflt, n } */
export const normIncRow = (x) => ({ m: x.month, kind: x.kind, person: x.person_id || null, acct: x.account_id || null, cur: x.currency || "", repay: !!x.repay,
  amount: +x.amount_sum || 0, set: +x.income_sum || 0, dflt: +x.dflt_sum || 0, n: +x.n || 0 });
/** 一段月份的收入汇总：
 *  income[m] = 认定收入；l1[m][一级] / leaf[m]["一级|类型"] = 认定收入按一级 / 叶子（卖股票的收益记在 投资收益|stock_sale 下）
 *  cap[m] = 资本流入（不算收入）；capLeaf[m][叶子]；cash[m] = 到账合计；n[m] = 笔数；otherCur = 其他币种的笔数
 *  person：all / none（没指定成员的）/ 成员 id */
export function incAggregate(rows, months, { cur = "", person = "all" } = {}) {
  const set = new Set(months), out = { months, income: {}, l1: {}, leaf: {}, cap: {}, capLeaf: {}, cash: {}, n: {}, otherCur: 0 };
  for (const m of months) { out.income[m] = 0; out.l1[m] = {}; out.leaf[m] = {}; out.cap[m] = 0; out.capLeaf[m] = {}; out.cash[m] = 0; out.n[m] = 0; }
  for (const r of rows) {
    if (!set.has(r.m)) continue;
    if (person !== "all" && (person === "none" ? r.person : r.person !== person)) continue;
    if (cur && r.cur && r.cur !== cur) { out.otherCur += r.n; continue; }
    const s = splitAmounts(r), m = r.m;
    out.cash[m] += r.amount; out.n[m] += r.n;
    if (s.income) { out.income[m] += s.income; out.l1[m][s.l1] = (out.l1[m][s.l1] || 0) + s.income; const k = `${s.l1}|${r.kind}`; out.leaf[m][k] = (out.leaf[m][k] || 0) + s.income; }
    if (s.cap) { out.cap[m] += s.cap; out.capLeaf[m][s.capLeaf] = (out.capLeaf[m][s.capLeaf] || 0) + s.cap; }
  }
  return out;
}
/** 收入汇总里某个节点（all / 一级 / "一级|叶子" / 叶子）在一段月份（或某个月）的认定收入；capital 一级 = 资本流入 */
export function incNodeSum(agg, id, m = null) {
  let s = 0;
  for (const k of m ? [m] : agg.months) {
    if (!agg.l1[k]) continue;
    if (id === "all") s += agg.income[k];
    else if (id === "capital") s += agg.cap[k];
    else if (String(id).includes("|")) s += String(id).startsWith("capital|") ? agg.capLeaf[k][id.slice(8)] || 0 : agg.leaf[k][id] || 0;
    else s += agg.l1[k][id] || 0;
  }
  return r2(s);
}
/** 收支总览：一段月份里收入（认定）、消费（日常 / 住房）、财务、资本性、投资、资本流入，和由它们算出的指标
 *  净现金流 = 收入 − 消费（日常 + 住房，投资之前）；储蓄率 = 净现金流 ÷ 收入；投资率 = 投资（性质 = 投资的现金流出）÷ 收入；
 *  剩余现金 = 收入 − 日常 − 住房 − 财务及其他 − 资本性支出 − 投资（资本流入不算，单独列出） */
/** 资本流入里「从储蓄账户转入」：自己账户之间挪钱，不算进账面净现金流（转出那一边本来就不算支出） */
export const OWN_XFER = "xfer_savings";
export function householdFlow(inc, sp, months) {
  const tot = (f) => r2(months.reduce((a, m) => a + (f(m) || 0), 0));
  const income = tot((m) => inc.income[m]), capIn = tot((m) => inc.cap[m]);
  const b = (k) => tot((m) => sp?.bucket[m]?.[k]);
  const living = b("living"), housing = b("housing"), financial = b("financial"), capital = b("capital"), investment = b("investment");
  // 2026-11-03 口径（用户定）：
  //   surplus 日常结余 = 收入 − 日常 − 住房
  //   incNet  收入结余 = 收入 − 全部流出（日常、住房、财务及其他、资本性、投资）
  //   net     净现金流（账面）= 全部流入 − 全部流出 = 收入结余 + 资本流入。资本流入（卖房卖股本金、借款、本金返还、从投资账户转回…）不算收入，但账面上钱是进来了。
  //           「从储蓄账户转入」不算：那是自己账户之间挪钱，转出去时（转账类）也没算支出，只算一边会虚增。
  //   储蓄率 = 存下来的（含投资）÷ 收入 =（收入 − 消费 − 财务及其他 − 资本性）÷ 收入，只看收入，不看资本流入。
  const consumption = r2(living + housing), surplus = r2(income - consumption), saved = r2(surplus - financial - capital), incNet = r2(saved - investment);
  const capOwn = tot((m) => inc.capLeaf?.[m]?.[OWN_XFER] || 0), capBook = r2(capIn - capOwn), net = r2(incNet + capBook);
  return { income, capIn, capBook, capOwn, living, housing, consumption, financial, capital, investment, surplus, saved, incNet, net, remaining: incNet,
    savingsRate: income > 0 ? saved / income : null, investRate: income > 0 ? investment / income : null };
}
