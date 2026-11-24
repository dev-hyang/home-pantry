import { state } from "./state.js";
import { num, uid } from "./util.js";
import { t } from "./i18n.js";
import { financeAllowed } from "./finance-rules.js";
import { migrateLegacyDebts } from "./debt-rules.js";
import { flagLocalCatChecks, migrateLocalCategories, refineLocalCategories } from "./category-moves.js";
import { guessFor } from "./sub-guess.js";
import { cloudBills } from "./store/cloud-bills.js";
import { cloudFinance } from "./store/cloud-finance.js";
import { cloudHouse } from "./store/cloud-house.js";
import { cloudPantry } from "./store/cloud-pantry.js";
import { cloudPeople } from "./store/cloud-people.js";
import { cloudShops } from "./store/cloud-shops.js";
import { cloudSpend } from "./store/cloud-spend.js";
import { demoBills } from "./store/demo-bills.js";
import { demoFinance } from "./store/demo-finance.js";
import { demoHouse } from "./store/demo-house.js";
import { demoPantry } from "./store/demo-pantry.js";
import { demoPeople } from "./store/demo-people.js";
import { demoShops } from "./store/demo-shops.js";
import { demoSpend } from "./store/demo-spend.js";
import { seedDemo } from "./store/seed-demo.js";

/* 成员资料（迁移 052）：只在 设置 → 家庭与成员 里用，不进 AI 提示词、不进备份（个人数据，只给本家庭看） */
export const PROFILE_COLS = "phone,email,address";
const demoMe = () => ({ user_id: "me", display_name: state.displayName || t("我"), role: "owner", can_finance: false, joined_at: new Date().toISOString(), phone: null, email: null, address: null });
/* ───────────── 数据层：本地演示 ───────────── */
export const DemoStore = {
  mode: "demo", key: "hmh-demo-v3", db: null,
  load() {
    try { this.db = JSON.parse(localStorage.getItem(this.key)); } catch { this.db = null; }
    if (!this.db || !Array.isArray(this.db.items)) this.db = Object.assign(seedDemo(), { _cat063: true, _cat064: true });   // 新演示库已经是新分类，不用迁移、不用确认
    const db = this.db;
    // 2026-11 表改名（迁移 074）：旧演示库 / 旧演示备份里的 bills、bill_payments、medical_bills、medical_payments 换成新键 bills_recurring、bills_recurring_payments、bills_one_time、bills_one_time_payments
    for (const [from, to] of [["bills", "bills_recurring"], ["bill_payments", "bills_recurring_payments"], ["medical_bills", "bills_one_time"], ["medical_payments", "bills_one_time_payments"]]) if (db[from] && !db[to]) { db[to] = db[from]; delete db[from]; }
    db.purchases ||= []; db.assets ||= []; db.maint_logs ||= []; db.seasonal ||= [];
    db.bills_recurring ||= []; db.bills_recurring_payments ||= []; db.bills_one_time ||= []; db.bills_one_time_payments ||= []; db.people ||= []; db.income_records ||= []; db.income_repayments ||= [];
    // 多房产：没有房产的旧演示库补一条默认房产，并把房屋资料 / 设备 / 季节任务挂上去
    if (!Array.isArray(db.properties) || !db.properties.length) {
      db.properties = [{ id: uid(), name: t("我的家"), kind: "other", role: "owner_occupied", status: "owned", address: null, is_default: true, archived: false, notes: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }];
    }
    for (const p of db.properties) p.status ||= (p.role === "tenant" ? "renting" : "owned");
    db.deals ||= []; db.deal_done ||= []; db.deal_overrides ||= []; db.deal_custom ||= []; db.deal_events ||= []; db.deal_plans ||= []; db.plan_candidates ||= []; db.plan_offers ||= []; db.bills_recurring_assessments ||= []; db.bills_recurring_assessment_items ||= []; db.categories ||= []; db.custom_seasonal ||= [];
    const def = db.properties.find((p) => p.is_default) || db.properties[0];
    db.house_profiles ||= {};
    if (db.house_profile) { db.house_profiles[def.id] ||= db.house_profile; delete db.house_profile; }
    for (const a of db.assets) { a.property_id ||= def.id; a.recall ??= null; }   // recall：设备召回状态（云端是迁移 051 的 assets.recall）
    for (const s of db.seasonal) s.property_id ||= def.id;
    // 借贷（迁移 058）：旧演示库里的贷款类账单、需要还的收入，按 058 同一套规则转成贷款（只做一次；source_key 防重复）
    db.debt_accounts ||= []; db.debt_transactions ||= [];
    if (!db._debt058) { migrateLegacyDebts(db, { uid, today: new Date().toISOString().slice(0, 10) }); db._debt058 = true; }
    db.account_balances ||= []; db.asset_valuations ||= []; db.net_worth_snapshots ||= [];   // 净资产（迁移 059）
    if (!db._cat063) { migrateLocalCategories(db); db._cat063 = true; }   // 分类重整（迁移 063 的本机版）
    if (!db._cat064) { flagLocalCatChecks(db); db._cat064 = true; }   // 「请确认分类」标记（迁移 064 的本机版）
    if (!db._cat070) { refineLocalCategories(db, guessFor); db._cat070 = true; }   // 分类细化（迁移 070 的本机版）
    this.persist();
  },
  /* 家庭成员（演示：只有“我”= 家主，user_id 固定为 "me"，和 budget.js 的 myId() 一致）；不放进 state.members，免得名册、分摊等演示数据跟着变 */
  members() { if (!this.db.members?.length) { this.db.members = [demoMe()]; this.persist(); } return this.db.members.map((m) => ({ ...m })); },
  persist() { try { localStorage.setItem(this.key, JSON.stringify(this.db)); } catch { /* 隐私模式下可能不可写，忽略 */ } },
  reset() { this.db = Object.assign(seedDemo(), { _cat063: true, _cat064: true }); this.load(); },

};
Object.assign(DemoStore, demoPantry, demoShops, demoSpend, demoHouse, demoBills, demoFinance, demoPeople);
/* ───────────── 数据层：Supabase 云端 ───────────── */
export const ITEM_FIELDS = ["name", "category", "subcategory", "unit", "quantity", "min_quantity", "location", "expiry_date", "lead_days", "avg_daily_use", "notes", "asset_ids", "property_id", "owner_asset_id"];
export const ASSET_FIELDS = ["property_id", "kind", "type", "name", "location", "brand", "model", "serial", "installed_on", "manufacture_year", "warranty_until", "labor_warranty_until",
  "expected_life_years", "service_interval_months", "purchase_price", "replacement_cost_estimate", "owner", "notes", "vehicle", "units", "recall"];
export const PROPERTY_FIELDS = ["name", "kind", "role", "address", "status", "acquired_on", "purchase_price", "sold_on", "sale_price", "archived", "notes"];
export const INSURANCE_FIELDS = ["insured", "insurance_provider", "insurance_policy", "insurance_from", "insurance_to", "insurance_coverage", "insurance_premium", "insurance_agent", "insurance_phone", "insurance_email", "hoa"];
export const INCOME_FIELDS = ["received_on", "amount", "currency", "orig_amount", "orig_currency", "fee", "source_name", "kind", "channel", "person_id", "account", "import_batch", "repay_required", "repay_due_on", "repay_amount", "notes", "income_amount", "account_id"];
export const MED_FIELDS = ["kind", "subkind", "property_id", "provider", "patient", "patient_id", "guarantor", "guarantor_id", "bill_ref", "claim_ref", "insurer", "plan_type", "service_date", "bill_date", "due_on", "billed_amount", "insurance_paid", "adjustment", "patient_amount", "currency", "status", "hsa_eligible", "visibility", "notes", "asset_id"];
export const CARD_FIELDS = ["name", "issuer", "network", "last4", "holder_person_id", "kind", "expires_on", "opened_on", "annual_fee", "fee_month", "credit_limit", "statement_day", "due_day", "autopay", "bill_id", "catalog_id", "rewards", "bonus", "credits", "rules_as_of", "active", "notes", "balance", "inactive_since"];
export const BILL_FIELDS = ["property_id", "name", "category", "direction", "payee", "account_last4", "login_hint", "pay_url", "pay_channel", "amount_type", "typical_amount", "unit_amount", "parking_amount", "typical_fee", "typical_tax", "currency",
  "frequency", "interval_months", "due_day", "due_dates", "next_due_on", "grace_days", "late_fee_note", "autopay", "autopay_method", "autopay_card_expires", "pay_card_id", "statement_channel",
  "reminder_days", "ends_on", "sub_kind", "trial_ends_on", "assigned_person_id", "essential", "active", "notes", "asset_id"];
export const CATEGORY_FIELDS = ["space", "key", "name", "icon", "color", "loc", "subs", "hidden", "sort"];
export const LOCATION_FIELDS = ["name", "grp", "replaces", "sort"];
export const TERM_FIELDS = ["term", "zh", "en", "hant"];
/* 借贷（迁移 058） */
/** 迁移 060 加的列（第一期还款日、银行 Escrow 计划、对账单校准；流水的额外本金）：库里还没有这些列时写库前去掉（debt060 = false），其余照旧 */
export const DEBT_060 = ["first_payment_date", "escrow_schedule", "statement_check"];
/** 迁移 104 加的列（借款凭证、借据放在哪）：库里还没有时写库前去掉（debt104 = false） */
export const DEBT_104 = ["agreement", "agreement_note"];
export const schemaFlags = { debt060: true, debt104: true };
export const DEBT_FIELDS = ["name", "category", "direction", "counterparty_name", "person_id", "lender_card_id", "original_principal", "currency", "interest_rate", "term_months", "start_date", "maturity_date",
  "payment_frequency", "scheduled_payment", "opening_balance", "opening_balance_on", "status", "property_id", "asset_id", "financing_role", "secured", "link_confirmed", "notes", ...DEBT_060, ...DEBT_104];
/** 按批次汇总：{ spend: { 批次: { n, sum } }, inc: 同上 | null }（sum 是净额：退款是负数） */
export function batchTotalsOf(ids, purchases, incomes, noInc = false) {
  const want = new Set(ids), out = { spend: {}, inc: noInc ? null : {} };
  for (const id of ids) { out.spend[id] = { n: 0, sum: 0 }; if (out.inc) out.inc[id] = { n: 0, sum: 0 }; }
  const add = (bucket, x) => { if (!bucket || !want.has(x.import_batch)) return; const b = bucket[x.import_batch]; b.n++; b.sum = Math.round((b.sum + num(x.amount)) * 100) / 100; };
  for (const p of purchases) add(out.spend, p);
  for (const r of incomes) add(out.inc, r);
  return out;
}
export const DEBT_TXN_FIELDS = ["debt_id", "txn_date", "type", "principal_amount", "interest_amount", "fee_amount", "escrow_amount", "total", "bill_payment_id", "purchase_id", "income_record_id", "income_repayment_id", "split_source", "notes", "extra_principal"];
const r2 = (v) => Math.round(num(v) * 100) / 100;
/** 写库前的贷款行：没给的列补默认（not null 的列不能写 null） */
export function debtRow(d) {
  const r = pick(d, DEBT_FIELDS, {});
  r.name = String(r.name || "").trim().slice(0, 60) || t("贷款");
  r.category ||= "other"; r.direction ||= "payable"; r.status ||= "active"; r.payment_frequency ||= "monthly";
  r.currency ||= Units.region.currency; r.secured = !!r.secured; r.link_confirmed = r.link_confirmed !== false;
  if (r.opening_balance == null || !r.opening_balance_on) { r.opening_balance = null; r.opening_balance_on = null; }   // 两个一起填才有意义（数据库 check）
  if ("escrow_schedule" in r) r.escrow_schedule = Array.isArray(r.escrow_schedule) ? r.escrow_schedule.slice(0, 60) : [];
  if (!schemaFlags.debt060) for (const k of DEBT_060) delete r[k];
  if ("agreement" in r) r.agreement = ["written", "verbal", "none"].includes(r.agreement) ? r.agreement : null;
  if ("agreement_note" in r) r.agreement_note = String(r.agreement_note || "").trim().slice(0, 120) || null;
  if (!schemaFlags.debt104) for (const k of DEBT_104) delete r[k];
  return r;
}
export function debtTxnRow(x) {
  const r = pick(x, DEBT_TXN_FIELDS, {});
  for (const k of ["principal_amount", "interest_amount", "fee_amount", "escrow_amount", "total"]) r[k] = r2(r[k]);
  r.split_source ||= "schedule";
  r.extra_principal = Math.max(0, r2(r.extra_principal));
  if (!schemaFlags.debt060) delete r.extra_principal;
  return r;
}
/* 净资产（迁移 059） */
export const BALANCE_FIELDS = ["card_id", "as_of", "balance", "currency", "source", "notes"];
export const VALUATION_FIELDS = ["property_id", "asset_id", "as_of", "value", "currency", "source", "notes"];
export const SNAPSHOT_FIELDS = ["month", "totals", "assets_total", "liabilities_total", "net_worth", "currency", "source", "meta"];
export function balanceRow(x) {
  const r = pick(x, BALANCE_FIELDS, {});
  r.balance = r2(r.balance); r.currency ||= Units.region.currency; r.source ||= "manual"; r.notes = r.notes ? String(r.notes).slice(0, 300) : null;
  return r;
}
export function valuationRow(x) {
  const r = pick(x, VALUATION_FIELDS, {});
  r.value = r2(r.value); r.currency ||= Units.region.currency; r.source ||= "manual"; r.notes = r.notes ? String(r.notes).slice(0, 300) : null;
  if (r.property_id) r.asset_id = null;   // 恰好挂一处（数据库 check）
  return r;
}
export function snapshotRow(x) {
  const r = pick(x, SNAPSHOT_FIELDS, {});
  for (const k of ["assets_total", "liabilities_total", "net_worth"]) r[k] = r2(r[k]);
  r.totals ||= {}; r.meta ||= {}; r.currency ||= Units.region.currency; r.source = r.source === "manual" ? "manual" : "auto";
  return r;
}
/** 演示库：有 id 就改那一行，没有就按唯一键（同一账户同一天 / 同一资产同一天 / 同一个月）找；改了日期撞上同一天的另一行，那一行让位（和数据库的唯一约束一致） */
export function demoSave(store, table, row, id, sameKey) {
  const now = new Date().toISOString();
  let list = store.db[table] ||= [];
  const target = (id && list.find((x) => x.id === id)) || list.find(sameKey) || null;
  list = store.db[table] = list.filter((x) => x === target || !sameKey(x));
  if (target) { Object.assign(target, row, { updated_at: now }); store.persist(); return target.id; }
  const nid = uid(); list.push({ ...row, id: nid, created_by: "demo", created_at: now, updated_at: now }); store.persist(); return nid;
}
/* 价格旁表（迁移 058）：房产买卖价、交易成交价 / 定金、设备买价 / 更换估价 / 车辆卖出价只放在只有财务权限能读的旁表里。
 * 读：主表 + 旁表合并成原来的样子（界面代码不用改）；没权限的人旁表读出来是空的，价格就是 null。
 * 写：主表不带价格；有财务权限才写旁表。没执行 058（旁表不存在）时照旧写主表。 */
const FIN = {
  properties:     { table: "property_financials", key: "property_id", cols: ["purchase_price", "sale_price"] },
  property_deals: { table: "deal_financials",     key: "deal_id",     cols: ["price", "earnest_money"] },
  assets:         { table: "asset_financials",    key: "asset_id",    cols: ["purchase_price", "replacement_cost_estimate", "sale_price"] },   // sale_price → vehicle.sale_price
};
const canFinance = () => financeAllowed({ mode: "cloud", userId: state.user?.id, members: state.members });
export const DEAL_FIELDS = ["property_id", "asset_id", "kind", "contract_on", "review_deadline", "financing_deadline", "closing_on", "price", "earnest_money", "attorney", "lender", "agent", "title_company", "inspector", "financing", "notes", "outcome", "closed_at", "baseline"];
export const PLAN_FIELDS = ["kind", "title", "status", "budget", "notes"];
   // 买卖计划（迁移 078）
export const PLAN_CAND_FIELDS = ["plan_id", "name", "address", "url", "price", "status", "score", "pros", "cons", "details", "notes"];
export const ASSESS_FIELDS = ["bill_id", "name", "status", "notes"];
export const ASSESS_ITEM_FIELDS = ["assessment_id", "due_on", "amount", "kind", "payment_id", "settled_on"];
export const PLAN_OFFER_FIELDS = ["candidate_id", "offered_on", "amount", "counter_amount", "conditions", "outcome"];
export const DEAL_EVENT_FIELDS = ["deal_id", "happened_on", "title", "note", "contact", "task_keys", "created_by_name"];
export const DEAL_CUSTOM_FIELDS = ["deal_id", "name", "stage", "priority", "due_on", "note", "done_on", "done_by_name", "skipped"];
export const CUSTOM_SEASONAL_FIELDS = ["property_id", "name", "note", "months", "due_on", "done_on", "done_by_name"];
/** 一个人所有收入折合每月的合计（存在旧的 income_amount 列里，兼容旧版） */
export const incomeTotal = (lines) => Math.round((lines || []).reduce((s, l) => s + (l.period === "year" ? num(l.amount) / 12 : num(l.amount)), 0) * 100) / 100;
/** 名字比较用的键：忽略大小写和多余空格（数据库的唯一索引同一个规则） */
export const personKey = (n) => String(n || "").trim().replace(/\s+/g, " ").toLowerCase();
export const personError = (e) => (/household_people_name_idx|duplicate key/i.test(e.message || "") ? t("名册里已经有这个名字了（忽略大小写和空格）") : /household_people|does not exist|schema cache/i.test(e.message || "") ? t("还没执行数据库迁移 029（家庭成员名册），先在 Supabase 里执行 supabase/migrations/029_people.sql") : e.message);
export const SHOP_FIELDS = ["name", "chain", "category", "address", "zip", "lat", "lon", "phone", "ad_url", "website", "refresh", "refresh_dow", "archived", "osm_id", "deals_at", "notes", "auto_update"];
const SHOP_DEAL_FIELDS = ["shop_id", "name", "brand", "size", "price", "price_text", "regular_price", "unit_price", "unit_label", "aka", "category", "valid_from", "valid_to", "source", "notes", "deal_type"];
/** 特价一行：deal_type 是迁移 068 加的列，没值就不送（没执行 068 时送了会报错） */
export const dealRow = (r) => { const row = pick(r, SHOP_DEAL_FIELDS); if (!r.deal_type) delete row.deal_type; return row; };
export const pick = (obj, fields, extra) => { const r = { ...extra }; fields.forEach((k) => { r[k] = obj[k] ?? null; }); return r; };
/** 每页行数：和 Supabase 默认的 max-rows（1000）一样；项目里把 max-rows 调小的话这里也要跟着调小，否则读到第一页就会以为读完了 */
const PAGE_ROWS = 1000;
export const CloudStore = {
  mode: "cloud", sb: null, hid: null, channel: null,
  must({ data, error }) { if (error) throw new Error(error.message); return data; },
  /** 分页读完：Supabase（PostgREST）每次请求最多返回 max-rows 行（默认 1000），.limit(10000) 并不能突破——超过的行被悄悄截掉。
   *  build() 每次新建同一个查询（必须带确定的排序，最后加 id 兜底），按 .range() 每页 1000 行读到不满一页为止；cap = 最多读多少行（防失控） */
  async pageAll(build, cap = 50000) {
    const out = [];
    for (let from = 0; from < cap; from += PAGE_ROWS) {
      const rows = this.must(await build().range(from, Math.min(from + PAGE_ROWS, cap) - 1)) || [];
      out.push(...rows);
      if (rows.length < PAGE_ROWS) break;
    }
    return out;
  },
  /** 服务器分页（迁移 054 的 *_page / *_stats RPC）：kind = spend / pay / inc；f = 筛选（只带生效的项）；after = 上一页最后一行的排序键（第一页为空）；
   *  返回最多 limit + 1 行（多 1 行 = 还有下一页），不数总行数；统计（合计、笔数、月小计…）另由 listStats 一次聚合 */
  /** 统计用的聚合（迁移 055）：按 月 × 分类 × 性质 × 房产 × 币种（商店版再加商店）聚合好的紧凑行；from / to = 本地日期（含 from，不含 to），tz = 浏览器时区。
   *  行数可能过 1000（PostgREST 的 max-rows），按固定顺序分页读全 */

  /* 房产 */
  /* 价格旁表（迁移 058，见上面的 FIN）。finOff = 旁表不存在（没执行 058）：价格照旧在主表 */
  finOff: false,
  async finRows(base) {
    if (this.finOff) return null;
    const r = await this.sb.from(FIN[base].table).select("*").eq("household_id", this.hid);
    if (r.error) { if (/does not exist|schema cache|relation/i.test(r.error.message || "")) { this.finOff = true; return null; } console.warn("[financials]", r.error.message); return []; }
    return r.data || [];
  },
  /** 主表行 + 旁表的价格（车辆卖出价放回 vehicle.sale_price）；fin = null（没执行 058）原样返回 */
  mergeFin(base, rows, fin) {
    if (!fin) return rows;
    const { key, cols } = FIN[base], by = new Map(fin.map((f) => [f[key], f]));
    return rows.map((r) => {
      const f = by.get(r.id) || {}, out = { ...r };
      for (const c of cols) {
        if (base === "assets" && c === "sale_price") { if (out.vehicle && typeof out.vehicle === "object") out.vehicle = { ...out.vehicle, sale_price: f.sale_price ?? null }; }
        else out[c] = f[c] ?? null;
      }
      return out;
    });
  },
  /** 写主表前去掉价格（执行过 058 时）；返回要写进旁表的值（没财务权限 = null：不写） */
  splitFin(base, row, src) {
    if (this.finOff) return null;
    const vals = {};
    for (const c of FIN[base].cols) {
      if (base === "assets" && c === "sale_price") {
        vals.sale_price = src.vehicle?.sale_price ?? null;
        if (row.vehicle && typeof row.vehicle === "object") { const { sale_price: _drop, ...v } = row.vehicle; row.vehicle = v; }
      } else { vals[c] = row[c] ?? null; delete row[c]; }
    }
    return canFinance() ? vals : null;
  },
  async writeFin(base, id, vals) {
    if (!vals || !id) return;
    const { table, key } = FIN[base];
    this.must(await this.sb.from(table).upsert({ ...vals, [key]: id, household_id: this.hid }, { onConflict: key }));
  },

  /** 一段时间的花费（现在只有银行导入「找回早期批次」按批次的日期窗口用；统计 / 对比都读聚合）。必须分页：原来一次 .limit(10000) 实际只回 1000 行（max-rows），又是按日期从旧到新排——
   *  「近 5 年」超过 1000 笔时只读到最早的 1000 笔，最近几年全被截掉，所以比「近 3 年」的花费还少 */
  subscribe(onChange) {
    if (this.channel) this.sb.removeChannel(this.channel);
    const f = { schema: "public", filter: `household_id=eq.${this.hid}` };
    let ch = this.sb.channel(`hh-${this.hid}`);
    for (const table of ["items", "shopping_list", "purchases", "house_profiles", "assets", "maintenance_logs", "seasonal_tasks", "properties", "bills_recurring", "bills_recurring_payments", "bills_recurring_assessments", "bills_recurring_assessment_items", "bills_one_time", "bills_one_time_payments", "income_records", "income_repayments", "income_access", "debt_accounts", "debt_transactions", "account_balances", "asset_valuations", "net_worth_snapshots", "property_deals", "deal_task_done", "deal_task_overrides", "deal_custom_tasks", "deal_events", "deal_plans", "plan_candidates", "plan_offers", "custom_seasonal_tasks", "custom_categories", "custom_locations", "custom_terms", "shops", "shop_deals", "shop_deal_runs"]) {
      ch = ch.on("postgres_changes", { event: "*", table, ...f }, onChange);
    }
    this.channel = ch.subscribe();
  },
};
Object.assign(CloudStore, cloudPantry, cloudShops, cloudSpend, cloudHouse, cloudBills, cloudFinance, cloudPeople);
   // 方法按领域分在 core/store/ 下，this 仍然是 CloudStore

export let Store = DemoStore;
export { seedDemo } from "./store/seed-demo.js";
// ES 模块导入的绑定是只读的，切换数据层统一走这里
export function setStore(s) { Store = s; }
