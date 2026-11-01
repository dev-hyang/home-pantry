/* ───────────── 净资产（财务 P3，迁移 059）· 计算规则 ─────────────
 * 纯函数：不碰 DOM、不读 state，node 里能直接 import 测试。设计见 docs/design-net-worth.md。
 * 输入全是启动时整表读进内存的小表：卡与账户 + 余额历史、房产、车辆 / 设备、估值历史、借贷两张表——不需要任何聚合 RPC。
 *
 * 净资产 = 资产合计 − 负债合计，只算家庭币种；别的币种的余额 / 估值 / 贷款单列（otherCur），不换算。
 * 资产：账户最新余额（按种类分桶）、房产（最新估值；没有就按购入价，标出来）、车辆（最新估值；没有就不算）、其他设备（只有估过值的）、
 *       应收 = 借出（receivable）的贷款的未还本金。
 * 负债：借入（payable）的贷款的未还本金（摊还表余额，js/core/amortization.js 的 outstanding）、信用卡欠款（余额历史）、
 *       没有对应贷款记录的「贷款」种类账户（余额历史）、资产账户的透支。
 * 不重复：一个「贷款」种类的账户如果是某笔贷款的 lender_card_id，就只按贷款算（摊还表余额是唯一来源），账户上记的余额不算。
 * 截至某天（asOf）：余额 / 估值取那天及以前最新的一行；贷款余额只算那天及以前的流水；房产 / 车辆按买入 / 卖出日期判断那天是否持有。 */
import { outstanding } from "../core/amortization.js";

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const n = (v) => (v == null || v === "" ? null : Number(v));

export const ASSET_BUCKETS = ["cash", "investments", "retirement", "hsa", "properties", "vehicles", "other_assets", "receivables"];
export const LIAB_BUCKETS = ["mortgage", "auto_loans", "other_loans", "credit_cards", "other_liabilities"];
/** 能记余额的账户种类 → 分桶。借记卡（钱在支票账户里）、礼品卡（余额 = 面值 − 花费，见设计文档）不记 */
export const ACCT_BUCKET = { checking: "cash", savings: "cash", cash: "cash", wallet: "cash", brokerage: "investments", retirement: "retirement", hsa: "hsa", credit: "credit_cards", loan: "other_loans" };
export const BALANCE_KINDS = Object.keys(ACCT_BUCKET);
export const isLiabilityKind = (kind) => kind === "credit" || kind === "loan";
/** 贷款类型 → 负债分桶：房贷 / HELOC / 房屋净值贷款 = 房贷；车贷；亲友借款 = 其他负债；其余（学生贷款、个人贷款、信用额度、其他）= 其他贷款 */
export const debtBucket = (cat) => (["mortgage", "heloc", "home_equity"].includes(cat) ? "mortgage" : cat === "auto_loan" ? "auto_loans" : cat === "personal_lending" ? "other_liabilities" : "other_loans");
const CLOSED = ["paid_off", "written_off", "closed"];

export const monthEnd = (m) => { const [y, mo] = m.split("-").map(Number); return `${m}-${String(new Date(Date.UTC(y, mo, 0)).getUTCDate()).padStart(2, "0")}`; };
export const prevMonth = (m) => { const [y, mo] = m.split("-").map(Number); return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`; };
const addDays = (d, k) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + k); return x.toISOString().slice(0, 10); };

/** 一组带 as_of 的行里，截至 asOf（含）最新的一行；同一天按 updated_at 取后写的 */
export function latestAsOf(rows, asOf) {
  let best = null;
  for (const r of rows) {
    if (!r?.as_of || (asOf && r.as_of > asOf)) continue;
    if (!best || r.as_of > best.as_of || (r.as_of === best.as_of && String(r.updated_at || "") > String(best.updated_at || ""))) best = r;
  }
  return best;
}

/** 那天还持有这套房产吗：租住 / 看房 / 已退租不算；买入日之后、卖出日之前；没有日期时看状态 */
export function heldProperty(p, asOf) {
  if (!p || p.role === "tenant" || ["looking", "renting", "moved_out"].includes(p.status)) return false;
  if (p.acquired_on && p.acquired_on > asOf) return false;
  if (!p.acquired_on && p.status === "buying") return false;
  if (p.sold_on) return p.sold_on > asOf;
  return p.status !== "sold" && !p.archived;
}
/** 那天还拥有这辆车吗：选购中 / 租赁 / 已归还不算（租赁的车不是资产）；买入日（installed_on）之后、卖出日之前 */
export function heldVehicle(a, asOf) {
  const st = a?.vehicle?.status || "owned";
  if (!a || ["looking", "leased", "returned"].includes(st)) return false;
  if (a.installed_on && a.installed_on > asOf) return false;
  if (a.vehicle?.disposed_on) return a.vehicle.disposed_on > asOf;
  return st !== "sold";
}
/** 那天这个账户还开着吗：在用；或停用日期在那天之后 */
const openAt = (c, asOf) => c.active !== false || (!!c.inactive_since && c.inactive_since > asOf);

/**
 * 算一次净资产。
 * @param {object} d  { cards, balances, properties, assets, valuations, debts, txns }
 * @param {object} o  { asOf: 'YYYY-MM-DD', cur: 'USD', today, staleDays = 60, live = true（按现在的状态：已结清的贷款不算；false = 重建过去某月） }
 */
export function computeNetWorth(d, { asOf, cur, today = asOf, staleDays = 60, live = true } = {}) {
  const assets = Object.fromEntries(ASSET_BUCKETS.map((k) => [k, 0])), liabilities = Object.fromEntries(LIAB_BUCKETS.map((k) => [k, 0]));
  const accounts = [], equity = [], debtRows = [], otherCur = [], unknownDebts = [];
  const add = (side, bucket, v) => { (side === "a" ? assets : liabilities)[bucket] = r2((side === "a" ? assets : liabilities)[bucket] + v); };
  const debts = d.debts || [], txns = d.txns || [];
  const staleBefore = addDays(today, -staleDays);

  // ── 账户：最新余额 ──
  const byCard = new Map();
  for (const b of d.balances || []) { if (!byCard.has(b.card_id)) byCard.set(b.card_id, []); byCard.get(b.card_id).push(b); }
  const debtCards = new Set(debts.map((x) => x.lender_card_id).filter(Boolean));
  for (const c of d.cards || []) {
    const bucket = ACCT_BUCKET[c.kind]; if (!bucket || !openAt(c, asOf)) continue;
    const last = latestAsOf(byCard.get(c.id) || [], asOf), liab = isLiabilityKind(c.kind);
    const row = { card: c, bucket, side: liab ? "l" : "a", balance: last ? n(last.balance) : null, as_of: last?.as_of || null, currency: last?.currency || cur,
      stale: !!last && live && last.as_of < staleBefore, missing: !last, viaDebt: false, counted: false };
    if (c.kind === "loan" && debtCards.has(c.id)) { row.viaDebt = true; accounts.push(row); continue; }   // 贷款记录是唯一来源，账户余额不算
    accounts.push(row);
    if (!last) continue;
    if (row.currency !== cur) { otherCur.push({ kind: "account", name: c.name, amount: row.balance, currency: row.currency, side: row.side }); continue; }
    row.counted = true;
    if (!liab && row.balance < 0) add("l", "other_liabilities", -row.balance);   // 透支 = 负债
    else add(row.side, bucket, row.balance);
  }

  // ── 贷款：未还本金 ──
  const owedOn = { property: new Map(), asset: new Map() };
  for (const x of debts) {
    if (x.start_date && x.start_date > asOf) continue;
    if (CLOSED.includes(x.status) && (live || !txns.some((y) => y.debt_id === x.id && y.txn_date > asOf))) continue;   // 已结清：现在不算；重建过去时，那天以后还有流水才算
    const bal = outstanding(x, txns, asOf);
    const recv = x.direction === "receivable", side = recv ? "a" : "l", bucket = recv ? "receivables" : debtBucket(x.category);
    const row = { debt: x, side, bucket, balance: bal, currency: x.currency || cur };
    debtRows.push(row);
    if (bal == null) { unknownDebts.push(x); continue; }
    if (row.currency !== cur) { otherCur.push({ kind: "debt", name: x.name, amount: bal, currency: row.currency, side }); continue; }
    add(side, bucket, bal);
    if (!recv && bal > 0) {
      if (x.property_id) owedOn.property.set(x.property_id, [...(owedOn.property.get(x.property_id) || []), row]);
      else if (x.asset_id) owedOn.asset.set(x.asset_id, [...(owedOn.asset.get(x.asset_id) || []), row]);
    }
  }

  // ── 房产 / 车辆 / 其他设备：估值 → 净值 ──
  const valsOf = { property: new Map(), asset: new Map() };
  for (const v of d.valuations || []) {
    const [m, id] = v.property_id ? [valsOf.property, v.property_id] : [valsOf.asset, v.asset_id];
    if (!id) continue; if (!m.has(id)) m.set(id, []); m.get(id).push(v);
  }
  const pushEquity = (kind, item, bucket, last, fallback) => {
    const loans = (kind === "property" ? owedOn.property : owedOn.asset).get(item.id) || [];
    const valCur = last?.currency || cur;
    const value = last ? n(last.value) : fallback, source = last ? "valuation" : fallback != null ? "purchase" : null;
    const loan = r2(loans.reduce((s, r) => s + r.balance, 0));
    const row = { kind, item, bucket, value, source, valueAsOf: last?.as_of || null, valueSource: last?.source || null, currency: valCur, loans, loanBalance: loan,
      equity: value != null && valCur === cur ? r2(value - loan) : null };
    equity.push(row);
    if (value == null) return;
    if (valCur !== cur) { otherCur.push({ kind, name: item.name, amount: value, currency: valCur, side: "a" }); return; }
    add("a", bucket, value);
  };
  for (const p of d.properties || []) {
    if (!heldProperty(p, asOf)) continue;
    const pp = n(p.purchase_price);
    pushEquity("property", p, "properties", latestAsOf(valsOf.property.get(p.id) || [], asOf), pp != null && pp > 0 ? pp : null);
  }
  for (const a of d.assets || []) {
    if (a.kind === "vehicle") { if (heldVehicle(a, asOf)) pushEquity("vehicle", a, "vehicles", latestAsOf(valsOf.asset.get(a.id) || [], asOf), null); continue; }
    const last = latestAsOf(valsOf.asset.get(a.id) || [], asOf);
    if (last) pushEquity("asset", a, "other_assets", last, null);   // 设备只有估过值才算（家电不当资产记）
  }

  const assetsTotal = r2(Object.values(assets).reduce((s, v) => s + v, 0)), liabilitiesTotal = r2(Object.values(liabilities).reduce((s, v) => s + v, 0));
  return { asOf, cur, assets, liabilities, assetsTotal, liabilitiesTotal, netWorth: r2(assetsTotal - liabilitiesTotal),
    accounts, equity, debts: debtRows, otherCur, unknownDebts,
    stale: accounts.filter((a) => a.stale && !a.viaDebt), missing: accounts.filter((a) => a.missing && !a.viaDebt),
    byPurchase: equity.filter((e) => e.source === "purchase").length, unvalued: equity.filter((e) => e.value == null).length };
}

/** 计算结果 → 快照行（每月一行） */
export function toSnapshot(res, month, source = "auto", meta = {}) {
  return { month, totals: { ...res.assets, ...res.liabilities }, assets_total: res.assetsTotal, liabilities_total: res.liabilitiesTotal, net_worth: res.netWorth, currency: res.cur, source,
    meta: { as_of: res.asOf, by_purchase: res.byPurchase, unvalued: res.unvalued, stale: res.stale.length, missing: res.missing.length, unknown_debts: res.unknownDebts.length, other_cur: res.otherCur.length, ...meta } };
}
/** 自动快照要不要写：本月没有 → 写；本月是 auto 且数字变了 → 更新；manual 的不动；什么都没登记（全是 0、没有账户 / 房产 / 贷款）不写 */
export function snapshotNeeded(existing, snap, hasData) {
  if (!hasData) return false;
  if (!existing) return true;
  if (existing.source !== "auto") return false;
  const same = (a, b) => Math.abs((Number(a) || 0) - (Number(b) || 0)) < 0.005;
  return !(same(existing.net_worth, snap.net_worth) && same(existing.assets_total, snap.assets_total) && same(existing.liabilities_total, snap.liabilities_total)
    && Object.keys(snap.totals).every((k) => same(existing.totals?.[k], snap.totals[k])));
}

/** 趋势：只取家庭币种的快照，按月排；live = 本月的实时结果（本月的快照用实时数字替换，保证 KPI 和曲线一致） */
export function trendPoints(snapshots, cur, { live = null, month = null, from = null } = {}) {
  const map = new Map();
  for (const s of snapshots || []) if ((s.currency || cur) === cur) map.set(s.month, { month: s.month, nw: Number(s.net_worth) || 0, assets: Number(s.assets_total) || 0, liabilities: Number(s.liabilities_total) || 0, source: s.source });
  if (live && month) map.set(month, { month, nw: live.netWorth, assets: live.assetsTotal, liabilities: live.liabilitiesTotal, source: "live" });
  return [...map.values()].filter((p) => !from || p.month >= from).sort((a, b) => a.month.localeCompare(b.month));
}
/** 和上个月比：上个月没有快照返回 null（不拿更早的月份冒充「环比」） */
export function monthChange(points, month) {
  const cur = points.find((p) => p.month === month), prev = points.find((p) => p.month === prevMonth(month));
  return cur && prev ? r2(cur.nw - prev.nw) : null;
}
/**
 * 财富增长 vs 消费：每个有快照的月份——净资产变化（和上个月的快照比，缺上个月 = null）、收入、消费（日常 + 住房）、储蓄（收入 − 消费）。
 * flow = { [month]: { income, consumption } }（来自 report.js 的 householdFlow 口径）。
 * 「其他变化」= 净资产变化 − 储蓄：市值涨跌、估值更新、没记账的现金流，一眼看出财富增长是攒出来的还是涨出来的。
 */
export function growthRows(points, flow = {}) {
  const byM = new Map(points.map((p) => [p.month, p]));
  return points.map((p) => {
    const prev = byM.get(prevMonth(p.month)), f = flow[p.month] || null;
    const delta = prev ? r2(p.nw - prev.nw) : null;
    const savings = f ? r2((f.income || 0) - (f.consumption || 0)) : null;
    return { month: p.month, nw: p.nw, delta, income: f ? r2(f.income || 0) : null, consumption: f ? r2(f.consumption || 0) : null, savings, other: delta != null && savings != null ? r2(delta - savings) : null };
  });
}
