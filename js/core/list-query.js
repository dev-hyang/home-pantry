/* ───────────── 服务器分页的查询约定（迁移 054 的 spend_* / pay_* / inc_* RPC） ─────────────
 * 三个列表（花费明细 spend、账单付款 pay、收入流水 inc）共用一套排序和键集（cursor）：
 *   sort = new（日期新 → 旧）/ old（旧 → 新）/ high（金额大 → 小）/ low（小 → 大）/ name（名称键 A → Z），同值再按 日期 desc, id desc；
 *   每行带 sort_d（日期）、sort_a（金额）、sort_n（名称键），「继续加载」把上一页最后一行的这几个值 + id 作为 after 传回去，数据库从它后面接着读。
 * 筛选条件是一个对象（jsonb），只带生效的项（JSON 的 null 在 SQL 里不是 null，见 compact）。
 * 云端全在 SQL 里做；本地演示（DemoStore）没有数据库，用这里的 JS 版本照同样的规则筛选、排序、分页、汇总。
 * 迁移 056 的 inc_rollup / ledger_v / ledger_rollup 也有本地版（规则直接用前端的分类表，SQL 那边是它的镜像）。 */
import { effNature, l1IdOf } from "./taxonomy.js";
import { incL1Of, incomeDirection, incomeLedgerType, splitRecord } from "./income-taxonomy.js";

/** 上一页最后一行 → 下一页的起点 */
export const cursorOf = (r) => ({ d: r.sort_d, id: String(r.id), a: r.sort_a == null ? 0 : +r.sort_a, n: r.sort_n ?? "" });
/** 去掉没生效的项（null / undefined / 空串）：传给数据库的筛选对象只带真正要过滤的 */
export const compact = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v != null && v !== ""));

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
/** 和 SQL 的 order by 一致的比较函数（sort_d 是 ISO 字符串，按字符串比就是按时间比） */
export function sorter(sort) {
  const recent = (x, y) => cmp(String(y.sort_d), String(x.sort_d)) || cmp(String(y.id), String(x.id));   // 日期 desc, id desc
  return {
    old: (x, y) => cmp(String(x.sort_d), String(y.sort_d)) || cmp(String(x.id), String(y.id)),
    high: (x, y) => cmp(+y.sort_a, +x.sort_a) || recent(x, y),
    low: (x, y) => cmp(+x.sort_a, +y.sort_a) || recent(x, y),
    name: (x, y) => cmp(String(x.sort_n), String(y.sort_n)) || recent(x, y),
  }[sort] || recent;
}
/** 一页：按排序排好，跳过 after（含）之前的，多取 1 行给调用方判断还有没有下一页 */
export function pageOf(rows, sort, after, limit) {
  const by = sorter(sort), list = [...rows].sort(by);
  const c = after ? { sort_d: after.d, id: after.id, sort_a: after.a, sort_n: after.n } : null;
  return (c ? list.filter((r) => by(c, r) < 0) : list).slice(0, Math.max(1, Math.min(500, limit || 20)) + 1);
}

/* ───────────── JS 版的筛选（只给本地演示用；规则和 054 的 SQL 一一对应） ───────────── */
const has = (arr, v) => Array.isArray(arr) && arr.includes(v);
const isArr = Array.isArray;
const pad2 = (n) => String(n).padStart(2, "0");
const localMonth = (iso) => { const d = new Date(iso); return { lm: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`, dd: d.getDate() }; };
const skey = (s) => String(s ?? "").trim().replace(/\s+/g, " ").toLowerCase();
const round2 = (v) => Math.round(v * 100) / 100;

/** 花费流水：purchases + 事件型账单的付款（同 spend_feed） */
export function spendFeed(db, f = {}) {
  const firstBy = (rows, key) => { const m = new Map(); for (const x of rows) { const k = key(x); if (k != null && !m.has(k)) m.set(k, x); } return m; };
  const pays = firstBy([...(db.bill_payments || [])].sort((a, b) => cmp(String(a.created_at), String(b.created_at))), (x) => x.purchase_id || null);
  const billByName = firstBy([...(db.bills || [])].sort((a, b) => cmp(String(a.created_at), String(b.created_at))), (x) => x.name);
  const med = f.med || {}, out = [];
  for (const p of db.purchases || []) {
    const s = String(p.store || "").trim(), bill = String(p.category || "").startsWith("bill_");
    const store_txt = s || (bill ? String(billByName.get(p.name)?.payee || "").trim() || String(p.name || "").trim() : "");
    const bp = pays.get(p.id);
    out.push({ ...p, virtual: null, bill_id: null, pay_id: bp?.id || null, pay_bill_id: bp?.bill_id || null, store_txt, nature: p.nature || null, property_id: p.property_id || null, ...localMonth(p.purchased_at) });
  }
  const mbills = new Map((db.medical_bills || []).map((b) => [b.id, b]));
  for (const mp of db.medical_payments || []) {
    const b = mbills.get(mp.bill_id); if (!b) continue;
    const name = b.kind === "travel" ? (b.patient ? `【${String(b.patient).trim().slice(0, 30)}】${String(b.provider).trim()}`.slice(0, 60) : b.provider) : `${med[b.kind] || med.medical || b.kind} · ${b.provider}`;
    const category = b.kind === "pet" ? "pet_care" : b.kind === "travel" ? `travel_${b.subkind || "other"}` : b.kind || "medical";
    out.push({ id: mp.id, virtual: "medical", bill_id: b.id, pay_id: null, pay_bill_id: null, item_id: null, name, category, store: b.provider, store_txt: String(b.provider || "").trim(),
      quantity: null, unit: null, amount: mp.amount, method: null, currency: mp.currency || b.currency, purchased_at: new Date(`${mp.paid_on}T12:00:00`).toISOString(),
      lm: String(mp.paid_on).slice(0, 7), dd: +String(mp.paid_on).slice(8, 10), created_by: mp.paid_by, created_at: mp.created_at, card_id: mp.card_id || null, import_batch: null, nature: null, property_id: null });
  }
  return out;
}
/** 花费：按筛选过滤（同 spend_filtered），每行补上 store_key、排序键、实际性质 nat_eff 和是不是转账 is_xfer（迁移 055） */
export function spendFiltered(db, f = {}) {
  return spendFeed(db, f).map((s) => {
    const amt = s.amount != null && (!s.currency || s.currency === f.cur) ? +s.amount : 0, nat_eff = s.nature || f.natx?.[s.category] || "operating";
    return { ...s, store_key: s.store_txt.trim().toLowerCase() || "__none__", sort_d: s.purchased_at, sort_a: amt, sort_n: String(s.name || "").toLowerCase(), nat_eff, is_xfer: nat_eff === "transfer" || has(f.xfer, s.category) };
  }).filter((s) => {
    if (f.from && s.purchased_at < f.from) return false;
    if (f.to && s.purchased_at >= f.to) return false;
    if (f.year && s.lm.slice(0, 4) !== f.year) return false;
    if (f.mon && s.lm.slice(5, 7) !== f.mon) return false;
    if (isArr(f.months) && !f.months.includes(s.lm)) return false;
    if (f.dmax && s.dd > +f.dmax) return false;
    if (f.batch && !(s.import_batch === f.batch || has(f.batch_ids, String(s.id)))) return false;
    if (isArr(f.stores) && !f.stores.includes(s.store_key)) return false;
    if (f.q && !`${s.name}${s.store_txt}`.toLowerCase().includes(f.q)) return false;
    if (isArr(f.nat) && !f.nat.includes(s.nat_eff)) return false;
    if (f.prop && !(f.prop === "none" ? !s.property_id : s.property_id === f.prop)) return false;
    if (isArr(f.known)) {
      const hi = s.sort_a >= (+f.big || 0), bill = String(s.category).startsWith("bill_");
      const hit = has(hi ? f.hi : f.lo, s.category) || (!f.known.includes(s.category) && has(f.unk, `${bill ? "b" : ""}${hi ? "hi" : "lo"}`));
      if (!hit) return false;
    }
    return true;
  });
}
export function spendStats(db, f, facets) {
  const rows = spendFiltered(db, f), months = {};
  for (const s of rows) { const m = (months[s.lm] ||= { n: 0, sum: 0 }); m.n++; if (!s.is_xfer) m.sum = round2(m.sum + s.sort_a); }   // 转账照样列出、计笔数，合计不算
  const xf = rows.filter((s) => s.is_xfer);
  const out = { n: rows.length, own: rows.filter((s) => !s.virtual).length, sum: round2(rows.filter((s) => !s.is_xfer).reduce((a, s) => a + s.sort_a, 0)), xn: xf.length, xsum: round2(xf.reduce((a, s) => a + s.sort_a, 0)), months, facets: null };
  if (facets) {
    const all = spendFeed(db, f), stores = new Map();
    for (const s of all) { const v = s.store_txt.trim(), k = v.toLowerCase(); if (v && (!stores.has(k) || v < stores.get(k))) stores.set(k, v); }
    out.facets = { years: [...new Set(all.map((s) => s.lm.slice(0, 4)))].sort().reverse(), cats: [...new Set(all.map((s) => s.category))], stores: [...stores.values()].sort((a, b) => cmp(a.toLowerCase(), b.toLowerCase())) };
  }
  return out;
}

/** 统计用的聚合（同 spend_rollup / spend_rollup_store）：from / to = 本地日期 YYYY-MM-DD（含 from，不含 to），空 = 不限；store = 商店版 */
export function spendRollup(db, from, to, store = false) {
  const lo = from ? new Date(`${from}T00:00:00`).toISOString() : null, hi = to ? new Date(`${to}T00:00:00`).toISOString() : null, map = new Map();
  for (const s of spendFeed(db, {})) {
    if (s.amount == null || (lo && s.purchased_at < lo) || (hi && s.purchased_at >= hi)) continue;
    const sk = store ? s.store_txt.trim().toLowerCase() || "__none__" : null;
    const k = [s.lm, sk, s.category, s.nature || "", store ? "" : s.property_id || "", s.currency || ""].join("|");
    const r = map.get(k) || (store ? { month: s.lm, store_key: sk, store: s.store_txt.trim(), category: s.category, nature: s.nature || null, currency: s.currency || null, sum: 0, n: 0 }
      : { month: s.lm, category: s.category, nature: s.nature || null, property_id: s.property_id || null, currency: s.currency || null, sum: 0, n: 0 });
    r.sum = round2(r.sum + +s.amount); r.n++; map.set(k, r);
  }
  return [...map.values()];
}

/** 账单付款（同 pay_filtered） */
export function payFiltered(db, f = {}) {
  const bills = new Map((db.bills || []).map((b) => [b.id, b])), pur = new Map((db.purchases || []).map((p) => [p.id, p]));
  return (db.bill_payments || []).filter((p) => (!f.bill || p.bill_id === f.bill) && (!f.year || String(p.paid_on).startsWith(f.year)) && (!f.status || p.status === f.status))
    .map((p) => ({ ...p, pur_store: p.purchase_id ? pur.get(p.purchase_id)?.store ?? null : null, sort_d: p.paid_on, sort_a: p.amount == null ? 0 : +p.amount, sort_n: String(bills.get(p.bill_id)?.name || "").toLowerCase() }));
}
export function payStats(db, f, facets) {
  const rows = payFiltered(db, f), ok = (p) => p.status !== "skipped" && (p.currency || f.cur) === f.cur;
  const y = String(f.kpi_year || new Date().getFullYear()), ky = (db.bill_payments || []).filter((p) => ok(p) && String(p.paid_on).startsWith(y));
  return { n: rows.length, sum: round2(rows.filter(ok).reduce((a, p) => a + +(p.amount || 0), 0)),
    kpi: { n: ky.length, sum: round2(ky.reduce((a, p) => a + +(p.amount || 0), 0)), late: round2(ky.reduce((a, p) => a + +(p.late_fee || 0), 0)) },
    facets: facets ? { years: [...new Set((db.bill_payments || []).map((p) => String(p.paid_on).slice(0, 4)))].sort().reverse(), bills: [...new Set((db.bill_payments || []).map((p) => p.bill_id))] } : null };
}

/** 收入流水（同 inc_filtered） */
export function incFiltered(db, f = {}) {
  const rank = (k) => String(f.krank?.[k] ?? 999).padStart(4, "0");
  return (db.income_records || []).filter((r) => {
    if (isArr(f.kinds) && !(f.kinds.includes(r.kind) || (f.kunk === true && !has(f.known, r.kind)))) return false;
    if (f.person && !(f.person === "none" ? !r.person_id : r.person_id === f.person)) return false;
    if (f.year && !String(r.received_on).startsWith(f.year)) return false;
    if (f.mon && String(r.received_on).slice(5, 7) !== f.mon) return false;
    if (f.batch && r.import_batch !== f.batch) return false;
    if (f.from && r.received_on < f.from) return false;
    if (f.to && r.received_on > f.to) return false;
    if (isArr(f.ex) && f.ex.includes(r.kind)) return false;
    if (f.acct && !(f.acct === "none" ? !r.account_id : r.account_id === f.acct)) return false;
    if (f.q && !(skey(`${r.source_name} ${r.notes || ""} ${r.account || ""} ${r.kind}`).includes(f.q) || has(f.qkinds, r.kind))) return false;
    return true;
  }).map((r) => ({ ...r, sort_d: r.received_on, sort_a: +r.amount, sort_n: rank(r.kind) }));
}
export function incStats(db, f, facets) {
  const rows = incFiltered(db, f);
  const inc = (r) => (r.repay_required ? 0 : r.income_amount != null ? Math.min(+r.income_amount, +r.amount) : has(f.capk, r.kind) ? 0 : +r.amount);   // 同 inc_stats 的 income_sum
  const sum = round2(rows.reduce((a, r) => a + +r.amount, 0)), income_sum = round2(rows.reduce((a, r) => a + inc(r), 0));
  return { n: rows.length, sum, income_sum, cap_sum: round2(sum - income_sum), facets: facets ? { years: [...new Set((db.income_records || []).map((r) => String(r.received_on).slice(0, 4)))].sort().reverse() } : null };
}

/** 收入聚合（同 inc_rollup）：from / to = 日期 YYYY-MM-DD（含 from，不含 to） */
export function incRollup(db, from, to) {
  const map = new Map();
  for (const r of db.income_records || []) {
    if ((from && r.received_on < from) || (to && r.received_on >= to)) continue;
    const k = [String(r.received_on).slice(0, 7), r.kind, r.person_id || "", r.account_id || "", r.currency || "", !!r.repay_required].join("|");
    const x = map.get(k) || { month: String(r.received_on).slice(0, 7), kind: r.kind, person_id: r.person_id || null, account_id: r.account_id || null, currency: r.currency || null, repay: !!r.repay_required, amount_sum: 0, income_sum: 0, dflt_sum: 0, n: 0 };
    const a = +r.amount || 0, set = r.income_amount != null;
    x.amount_sum = round2(x.amount_sum + a); x.n++;
    if (!r.repay_required) { if (set) x.income_sum = round2(x.income_sum + Math.min(+r.income_amount, a)); else x.dflt_sum = round2(x.dflt_sum + a); }
    map.set(k, x);
  }
  return [...map.values()];
}
/** 统一账本（同 ledger_v）：花费 + 事件型账单的付款 + 收入；amount 带符号（流入 +）；day = 本地日期 */
export function ledgerFeed(db) {
  const out = [];
  for (const s of spendFeed(db, {})) {
    if (s.amount == null) continue;
    const cat = window.canonCat ? window.canonCat(s.category) : s.category, l1 = l1IdOf(cat), nat = effNature(cat, s.nature), amt = +s.amount;
    const xfer = nat === "transfer" || l1 === "transfer";
    const type = xfer ? "transfer" : nat === "capital" ? "asset_purchase" : nat === "investment" || l1 === "wealth" ? "investment" : nat === "financing" ? "loan" : "expense";
    out.push({ source: s.virtual ? "medical" : "purchase", id: s.id, household_id: s.household_id || null, occurred_at: s.purchased_at, occurred_on: s.virtual ? s.purchased_at.slice(0, 10) : null, day: s.virtual ? s.purchased_at.slice(0, 10) : `${s.lm}-${pad2(s.dd)}`,
      name: s.name, counterparty: s.store_txt || null, amount: -amt, currency: s.currency, type, cash_flow_direction: xfer ? "internal" : amt < 0 ? "inflow" : "outflow",
      category: cat, l1, nature: s.nature || null, repay_required: false, income_amount: 0, expense_amount: nat === "operating" && (l1 === "living" || l1 === "housing") ? amt : 0,
      account_id: s.card_id || null, property_id: s.property_id || null, person_id: null, created_by: s.created_by || null, import_batch: s.import_batch || null });
  }
  for (const r of db.income_records || []) {
    out.push({ source: "income", id: r.id, household_id: r.household_id || null, occurred_at: new Date(`${r.received_on}T12:00:00Z`).toISOString(), occurred_on: r.received_on, day: r.received_on,
      name: r.source_name, counterparty: r.source_name, amount: +r.amount, currency: r.currency, type: incomeLedgerType(r), cash_flow_direction: incomeDirection(r),
      category: r.kind, l1: incL1Of(r.kind), nature: null, repay_required: !!r.repay_required, income_amount: splitRecord(r).income, expense_amount: 0,
      account_id: r.account_id || null, property_id: null, person_id: r.person_id || null, created_by: r.created_by || null, import_batch: r.import_batch || null });
  }
  return out;
}
/** 一段本地日期的账本行（同 Store.ledgerRange 在云端读 ledger_v）：新 → 旧 */
export const ledgerRange = (db, from, to) => ledgerFeed(db).filter((x) => (!from || x.day >= from) && (!to || x.day < to)).sort((a, b) => cmp(String(b.occurred_at), String(a.occurred_at)) || cmp(String(b.id), String(a.id)));
/** 账本聚合（同 ledger_rollup）：unit = month / biweek（anchor 起每 14 天一段） */
export function ledgerRollup(db, from, to, unit = "month", anchor = null) {
  const dayN = (d) => Math.floor(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 864e5), a0 = dayN(anchor || "2024-01-01"), map = new Map();
  for (const x of ledgerRange(db, from, to)) {
    const period = unit === "biweek" ? new Date((a0 + Math.floor((dayN(x.day) - a0) / 14) * 14) * 864e5).toISOString().slice(0, 10) : x.day.slice(0, 7);
    const k = [period, x.source, x.type, x.cash_flow_direction, x.category, x.nature || "", x.repay_required, x.person_id || "", x.currency || ""].join("|");
    const r = map.get(k) || { period, source: x.source, type: x.type, direction: x.cash_flow_direction, category: x.category, nature: x.nature, repay: x.repay_required, person_id: x.person_id, currency: x.currency, amount_sum: 0, income_sum: 0, expense_sum: 0, n: 0 };
    r.amount_sum = round2(r.amount_sum + x.amount); r.income_sum = round2(r.income_sum + x.income_amount); r.expense_sum = round2(r.expense_sum + x.expense_amount); r.n++; map.set(k, r);
  }
  return [...map.values()];
}

/** 本地演示的一页 / 统计：kind = spend / pay / inc */
const FILTERED = { spend: spendFiltered, pay: payFiltered, inc: incFiltered }, STATS = { spend: spendStats, pay: payStats, inc: incStats };
export const localPage = (db, kind, f, after, limit) => (kind === "spend" && !NON_NEW.has(f.sort) ? spendPageNew(db, f, after, limit) : pageOf(FILTERED[kind](db, f), f.sort, after, limit));
export const localStats = (db, kind, f, facets) => STATS[kind](db, f, facets);

/* ───────────── 迁移 057：「新 → 旧」快路 + 按需查询（本地演示版，规则同 SQL） ───────────── */
const NON_NEW = new Set(["old", "high", "low", "name"]);
/** 花费的「新 → 旧」（同 057 的 spend_page 快路）：purchases、事件型账单的付款两支各自跳过 cursor、取 n+1，再合并排好取 n+1。
 *  全局的前 n+1 行一定在两支各自的前 n+1 行里，所以和 pageOf(全部) 逐行一样（校验脚本对过） */
export function spendPageNew(db, f, after, limit) {
  const rows = spendFiltered(db, f), branch = (v) => pageOf(rows.filter((r) => !!r.virtual === v), "new", after, limit);
  return pageOf([...branch(false), ...branch(true)], "new", null, limit);
}
const localDay = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
const inDays = (iso, from, to) => { const d = localDay(iso); return (!from || d >= from) && (!to || d < to); };
const newest = (a, b) => cmp(String(b.purchased_at), String(a.purchased_at)) || cmp(String(b.id), String(a.id));

/** 家庭分摊（同 spend_by_member）：本地日期 [from, to)，只算金额 > 0 */
export function spendByMember(db, from, to) {
  const map = new Map();
  for (const s of spendFeed(db, {})) {
    if (!(+s.amount > 0) || !inDays(s.purchased_at, from, to)) continue;
    const k = [s.lm, s.created_by || "", s.currency || ""].join("|");
    const r = map.get(k) || { month: s.lm, created_by: s.created_by || null, currency: s.currency || null, sum: 0, n: 0 };
    r.sum = round2(r.sum + +s.amount); r.n++; map.set(k, r);
  }
  return [...map.values()];
}
/** 补货预估（同 item_purchase_stats）：物品最近 3 次买价 / 次数 / 最近一次 / 平均间隔天数，分类最近 10 次买价 */
export function itemPurchaseStats(db, cur, items = [], cats = []) {
  const ok = (db.purchases || []).filter((p) => +p.amount > 0 && (!cur || p.currency === cur)).sort(newest), out = [];
  for (const id of new Set(items || [])) {
    const l = ok.filter((p) => p.item_id === id); if (!l.length) continue;
    const last = l[0].purchased_at, first = l.at(-1).purchased_at;
    out.push({ kind: "item", key: String(id), amts: l.slice(0, 3).map((p) => +p.amount), n: l.length, last_at: last, last_store: String(l[0].store || "").trim() || null,
      avg_days: l.length > 1 ? Math.round(((new Date(last) - new Date(first)) / 864e5 / (l.length - 1)) * 10) / 10 : null });
  }
  for (const c of new Set(cats || [])) {
    const l = ok.filter((p) => p.category === c).slice(0, 10); if (!l.length) continue;
    out.push({ kind: "cat", key: c, amts: l.map((p) => +p.amount), n: l.length, last_at: null, last_store: null, avg_days: null });
  }
  return out;
}
/** 查重（同 spend_dup_match）：rows = [{ k, d: 本地日期, a: 金额 }]，每条 ±days 天内金额相同的 purchases（不含事件型账单的付款） */
export function spendDupMatch(db, rows = [], days = 3.5) {
  const out = [];
  for (const c of (rows || []).slice(0, 2000)) {
    if (c?.k == null || !c.d || c.a == null) continue;
    const t0 = new Date(`${c.d}T12:00:00`).getTime();
    for (const p of db.purchases || []) {
      if (p.amount == null || Math.abs(+p.amount - +c.a) >= 0.005 || Math.abs(new Date(p.purchased_at).getTime() - t0) > days * 864e5) continue;
      out.push({ k: c.k, id: p.id, name: p.name, store: p.store ?? null, amount: +p.amount, purchased_at: p.purchased_at, created_by: p.created_by || null });
    }
  }
  return out.sort((a, b) => cmp(a.k, b.k) || cmp(String(b.purchased_at), String(a.purchased_at)) || cmp(String(a.id), String(b.id)));
}
/** 输入框联想（同 spend_suggest）：since 之后用过的商店（按次数）和行程名（按最近） */
export function spendSuggest(db, since = null, limit = 300) {
  const st = new Map(), tr = new Map();
  for (const s of spendFeed(db, {})) {
    if (since && s.purchased_at < since) continue;
    const v = s.store_txt.trim();
    if (v) { const k = v.toLowerCase(), x = st.get(k) || { store: v, n: 0, last: "" }; x.n++; if (s.purchased_at > x.last) { x.last = s.purchased_at; x.store = v; } st.set(k, x); }
    const m = s.amount != null && String(s.name || "").match(/^【([^】]{1,30})】/), trip = m ? m[1].trim() : "";
    if (trip && !(tr.get(trip) >= s.purchased_at)) tr.set(trip, s.purchased_at);
  }
  return { stores: [...st.values()].sort((a, b) => b.n - a.n || cmp(b.last, a.last)).slice(0, Math.max(1, Math.min(1000, limit || 300))).map((x) => x.store),
    trips: [...tr].sort((a, b) => cmp(b[1], a[1])).slice(0, 60).map(([x]) => x) };
}
/** 卡的用量（同 card_spend）：卡 × 本地日期 × 分类 × 商店 */
export function cardSpend(db, from, to) {
  const map = new Map();
  for (const p of db.purchases || []) {
    if (!p.card_id || p.amount == null || !inDays(p.purchased_at, from, to)) continue;
    const day = localDay(p.purchased_at), store = String(p.store || "").trim(), k = [p.card_id, day, p.category, store].join("|");
    const r = map.get(k) || { card_id: p.card_id, day, category: p.category, store, sum: 0, n: 0 };
    r.sum = round2(r.sum + +p.amount); r.n++; map.set(k, r);
  }
  return [...map.values()];
}
/** 每张卡名下的花费（同 card_totals）：笔数、合计、有花费的本地月份 */
export function cardTotals(db) {
  const map = new Map();
  for (const p of db.purchases || []) {
    if (!p.card_id) continue;
    const r = map.get(p.card_id) || { card_id: p.card_id, n: 0, sum: 0, months: new Set() };
    r.n++; if (p.amount != null) r.sum = round2(r.sum + +p.amount); r.months.add(localMonth(p.purchased_at).lm); map.set(p.card_id, r);
  }
  return [...map.values()].map((r) => ({ ...r, months: [...r.months].sort() }));
}
