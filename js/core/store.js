import { state } from "./state.js";
import { normName } from "./item-match.js";
import { $, DAY, STATS_LOG_DAYS, num, uid } from "./util.js";
import { t } from "./i18n.js";
import { financeAllowed } from "./finance-rules.js";
import { migrateLegacyDebts } from "./debt-rules.js";
import { flagLocalCatChecks, migrateLocalCategories } from "./category-moves.js";
import { cardSpend, cardTotals, incRollup, itemPurchaseStats, ledgerRange, ledgerRollup, localPage, localStats, spendFeed, spendRollup, spendSuggest } from "./list-query.js";

/* 成员资料（迁移 052）：只在 设置 → 家庭与成员 里用，不进 AI 提示词、不进备份（个人数据，只给本家庭看） */
const PROFILE_COLS = "phone,email,address";
const demoMe = () => ({ user_id: "me", display_name: state.displayName || t("我"), role: "owner", can_finance: false, joined_at: new Date().toISOString(), phone: null, email: null, address: null });

/* ───────────── 数据层：本地演示 ───────────── */
export const DemoStore = {
  mode: "demo", key: "hmh-demo-v3", db: null,
  load() {
    try { this.db = JSON.parse(localStorage.getItem(this.key)); } catch { this.db = null; }
    if (!this.db || !Array.isArray(this.db.items)) this.db = Object.assign(seedDemo(), { _cat063: true, _cat064: true });   // 新演示库已经是新分类，不用迁移、不用确认
    const db = this.db;
    db.purchases ||= []; db.assets ||= []; db.maint_logs ||= []; db.seasonal ||= [];
    db.bills ||= []; db.bill_payments ||= []; db.medical_bills ||= []; db.medical_payments ||= []; db.people ||= []; db.income_records ||= []; db.income_repayments ||= [];
    // 多房产：没有房产的旧演示库补一条默认房产，并把房屋资料 / 设备 / 季节任务挂上去
    if (!Array.isArray(db.properties) || !db.properties.length) {
      db.properties = [{ id: uid(), name: t("我的家"), kind: "other", role: "owner_occupied", status: "owned", address: null, is_default: true, archived: false, notes: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }];
    }
    for (const p of db.properties) p.status ||= (p.role === "tenant" ? "renting" : "owned");
    db.deals ||= []; db.deal_done ||= []; db.deal_overrides ||= []; db.deal_custom ||= []; db.deal_events ||= []; db.categories ||= []; db.custom_seasonal ||= [];
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
    this.persist();
  },
  /* 家庭成员（演示：只有“我”= 家主，user_id 固定为 "me"，和 budget.js 的 myId() 一致）；不放进 state.members，免得名册、分摊等演示数据跟着变 */
  members() { if (!this.db.members?.length) { this.db.members = [demoMe()]; this.persist(); } return this.db.members.map((m) => ({ ...m })); },
  async listMembers() { return this.members(); },
  demoMember(id) { this.members(); const m = this.db.members.find((x) => x.user_id === id); if (!m) throw new Error(t("没有找到这位成员")); return m; },
  async setMemberProfile(id, p) {
    const name = (p.display_name || "").trim(); if (!name || name.length > 20) throw new Error(t("称呼要 1–20 个字"));
    Object.assign(this.demoMember(id), { display_name: name, phone: p.phone || null, email: p.email || null, address: p.address || null });
    if (id === "me") state.displayName = name;
    this.persist();
  },
  async setMemberFinance(id, on) { this.demoMember(id).can_finance = !!on; this.persist(); },
  async setMemberRole(id, role) {
    const m = this.demoMember(id);
    if (role !== "owner" && m.role === "owner" && this.db.members.filter((x) => x.role === "owner").length < 2) throw new Error(t("最后一位家主不能被取消或移出"));
    m.role = role === "owner" ? "owner" : "member"; this.persist();
  },
  async removeMember(id) {
    const m = this.demoMember(id);
    if (m.role === "owner" && this.db.members.filter((x) => x.role === "owner").length < 2) throw new Error(t("最后一位家主不能被取消或移出"));
    this.db.members = this.db.members.filter((x) => x.user_id !== id); this.persist();
  },
  persist() { try { localStorage.setItem(this.key, JSON.stringify(this.db)); } catch { /* 隐私模式下可能不可写，忽略 */ } },
  reset() { this.db = Object.assign(seedDemo(), { _cat063: true, _cat064: true }); this.load(); },
  async listItems() { return this.db.items.map((x) => ({ ...x })); },
  // 自定义分类
  async listCategories() { return (this.db.categories || []).map((x) => ({ ...x })); },
  async saveCategory(c) {
    const now = new Date().toISOString(); this.db.categories ||= [];
    if (c.id) { const i = this.db.categories.findIndex((x) => x.id === c.id); if (i >= 0) this.db.categories[i] = { ...this.db.categories[i], ...c, updated_at: now }; }
    else this.db.categories.push({ ...c, id: uid(), created_at: now, updated_at: now });
    this.persist();
  },
  async deleteCategory(id) { this.db.categories = (this.db.categories || []).filter((x) => x.id !== id); this.persist(); },
  // 自定义存放位置（重命名时把用到旧名字的物品、设备一起改）
  async listLocations() { return (this.db.locations || []).map((x) => ({ ...x })); },
  /* 物品别名（迁移 066）：同一样东西的其他叫法 */
  async listItemAliases() { return (this.db.item_aliases || []).map((x) => ({ ...x })); },
  async setItemAliases(itemId, list) {   // 这件物品的别名整组替换；别的物品已经用了的叫法跳过（一个叫法只对应一件）
    this.db.item_aliases = (this.db.item_aliases || []).filter((x) => x.item_id !== itemId);
    for (const alias of list) if (!this.db.item_aliases.some((x) => normName(x.alias) === normName(alias))) this.db.item_aliases.push({ id: uid(), item_id: itemId, alias, created_at: new Date().toISOString() });
    this.persist();
  },
  async addItemAlias(itemId, alias) { const l = this.db.item_aliases ||= []; if (!l.some((x) => normName(x.alias) === normName(alias))) { l.push({ id: uid(), item_id: itemId, alias, created_at: new Date().toISOString() }); this.persist(); } },
  async saveLocation(c) {
    const now = new Date().toISOString(); this.db.locations ||= [];
    if (c.id) { const i = this.db.locations.findIndex((x) => x.id === c.id); if (i >= 0) this.db.locations[i] = { ...this.db.locations[i], ...c, updated_at: now }; }
    else this.db.locations.push({ ...c, id: uid(), created_at: now, updated_at: now });
    this.persist();
  },
  async deleteLocation(id) { this.db.locations = (this.db.locations || []).filter((x) => x.id !== id); this.persist(); },
  async renameLocation(oldName, newName) {
    for (const x of [...this.db.items, ...this.db.assets]) if (x.location === oldName) x.location = newName;
    this.persist();
  },
  // 自定义名称的翻译（位置 / 分类 / 小类在其他语言下怎么叫）
  /* 每位成员自己的收入（演示模式只有“我”） */
  async listIncomes() { return (this.db.incomes || []).map((x) => ({ ...x })); },
  async saveIncome(r) {
    this.db.incomes ||= []; const row = { user_id: r.user_id, lines: r.lines, income_amount: incomeTotal(r.lines), income_period: "month", updated_at: new Date().toISOString() }, i = this.db.incomes.findIndex((x) => x.user_id === r.user_id);
    if (i >= 0) this.db.incomes[i] = row; else this.db.incomes.push(row);
    this.persist(); return { ...row };
  },
  async deleteIncome(uid) { this.db.incomes = (this.db.incomes || []).filter((x) => x.user_id !== uid); this.persist(); },
  async getBudget() { return this.db.budget ? { ...this.db.budget } : null; },
  async saveBudget(b) { this.db.budget = { ...b, updated_at: new Date().toISOString() }; this.persist(); return { ...this.db.budget }; },
  async listTerms() { return (this.db.terms || []).map((x) => ({ ...x })); },
  async saveTerm(r) {
    const now = new Date().toISOString(); this.db.terms ||= [];
    const i = this.db.terms.findIndex((x) => x.term === r.term);
    if (i >= 0) this.db.terms[i] = { ...this.db.terms[i], ...r, updated_at: now }; else this.db.terms.push({ ...r, id: uid(), created_at: now, updated_at: now });
    this.persist();
  },
  async deleteTerm(term) { this.db.terms = (this.db.terms || []).filter((x) => x.term !== term); this.persist(); },
  async listLogs() {
    const since = Date.now() - STATS_LOG_DAYS * DAY;
    return this.db.logs.filter((l) => new Date(l.created_at).getTime() >= since);
  },
  /** 我的 → 家里的数字：某个时间以来的库存日志（近一年） */
  async listLogsSince(iso) { const since = new Date(iso).getTime(); return this.db.logs.filter((l) => new Date(l.created_at).getTime() >= since).map((l) => ({ ...l })); },
  /** 服务器分页的本地版（演示模式没有数据库）：筛选 / 排序 / 键集分页 / 统计照 054 的规则在内存里做，见 list-query.js */
  async listPage(kind, f, after, limit) { return localPage(this.db, kind, f, after, limit); },
  async listStats(kind, f, facets = false) { return localStats(this.db, kind, f, facets); },
  /** 统计用的聚合（迁移 055 的 spend_rollup / spend_rollup_store 的本地版） */
  async spendRollup(from, to) { return spendRollup(this.db, from, to); },
  async spendRollupStore(from, to) { return spendRollup(this.db, from, to, true); },
  /** 收款方名单（同 spend_payee_names，迁移 062）：全部历史的笔数、金额、最近一次 */
  async payeeNames() {
    const m = new Map();
    for (const s of spendFeed(this.db, {})) {
      const v = s.store_txt.trim(), k = v.toLowerCase() || "__none__", r = m.get(k) || { store_key: k, store: v, n: 0, sum: 0, last_at: s.purchased_at };
      r.n++; r.sum += +s.amount || 0; if (s.purchased_at > r.last_at) r.last_at = s.purchased_at; if (v && v < r.store) r.store = v; m.set(k, r);
    }
    return [...m.values()];
  },
  /** 批量改名 / 合并（同 rename_payees）：返回改了的行和原值（撤销用） */
  async renamePayees(fromKeys, to) {
    const set = new Set(fromKeys), out = [], name = String(to).trim();
    if (!name) return out;
    for (const p of this.db.purchases) {
      const k = String(p.store || "").trim().toLowerCase(); if (!k || !set.has(k)) continue;
      out.push({ id: p.id, old_store: p.store, old_name: p.name });
      if (String(p.name || "").trim().toLowerCase() === k) p.name = name.slice(0, 60);
      p.store = name.slice(0, 40);
    }
    this.persist(); return out;
  },
  /** 撤销改名：按原值写回 */
  async restorePayees(rows) { const by = new Map(rows.map((r) => [r.id, r])); for (const p of this.db.purchases) { const r = by.get(p.id); if (r) { p.store = r.old_store; p.name = r.old_name; } } this.persist(); },
  /** 收入聚合 / 统一账本（迁移 056 的 inc_rollup / ledger_rollup / ledger_v 的本地版） */
  async incRollup(from, to) { return incRollup(this.db, from, to); },
  async ledgerRollup(from, to, tz, unit = "month", anchor = null) { return ledgerRollup(this.db, from, to, unit, anchor); },
  async ledgerRange(from, to) { return ledgerRange(this.db, from, to); },
  /** 全部花费：只给导出 JSON 用（按需读，平时不读整表） */
  async listPurchases() { return this.db.purchases.map((x) => ({ ...x, category: canonCat(x.category) })); },
  /** 迁移 057 的按需查询（本地版，见 list-query.js） */
  async itemPurchaseStats(cur, items, cats) { return itemPurchaseStats(this.db, cur, items, cats); },
  async spendSuggest(since, limit = 300) { return spendSuggest(this.db, since, limit); },
  async cardSpend(from, to) { return cardSpend(this.db, from, to); },
  async cardTotals() { return cardTotals(this.db); },
  async getPurchase(id) { const p = this.db.purchases.find((x) => x.id === id); return p ? { ...p, category: canonCat(p.category) } : null; },
  async detachCardPurchases(cardId, label) { let n = 0; for (const p of this.db.purchases) if (p.card_id === cardId) { p.card_id = null; p.method = label; n++; } this.persist(); return n; },
  async deleteCardPurchases(cardId) { const n = this.db.purchases.filter((x) => x.card_id === cardId).length; this.db.purchases = this.db.purchases.filter((x) => x.card_id !== cardId); this.persist(); return n; },
  async addItems(list) {
    const now = new Date().toISOString();
    for (const it of list) this.db.items.push({ ...it, id: uid(), created_at: now, updated_at: now });
    this.persist();
  },
  async listPurchasesRange(from, to) {
    return this.db.purchases.filter((p) => p.purchased_at >= from && p.purchased_at < to)
      .sort((a, b) => a.purchased_at.localeCompare(b.purchased_at)).map((x) => ({ ...x, category: canonCat(x.category) }));
  },
  async addPurchase(p) { const id = uid(); this.db.purchases.push({ ...p, id, created_at: new Date().toISOString() }); this.persist(); return id; },
  async deletePurchase(id) { this.db.purchases = this.db.purchases.filter((x) => x.id !== id); this.persist(); },
  async firstPurchaseYear() { const d = this.db.purchases.map((x) => x.purchased_at).sort()[0]; return d ? +String(d).slice(0, 4) : null; },
  async listTaggedPurchases() { return this.db.purchases.filter((x) => x.import_batch).map((x) => ({ id: x.id, import_batch: x.import_batch, purchased_at: x.purchased_at, amount: x.amount, card_id: x.card_id || null, created_at: x.created_at })); },
  async listPurchasesByBatch(batch, ids = []) { const set = new Set(ids); return this.db.purchases.filter((x) => x.import_batch === batch || set.has(x.id)).map((x) => ({ ...x, category: canonCat(x.category) })); },
  /** 「最近导入」的实时笔数 / 合计：只算这几批（当前一页） */
  async batchTotals(ids) { return batchTotalsOf(ids, this.db.purchases, this.db.income_records || []); },
  async deletePurchasesByBatch(batch) { const n = this.db.purchases.filter((x) => x.import_batch === batch).length; this.db.purchases = this.db.purchases.filter((x) => x.import_batch !== batch); this.persist(); return n; },

  /* 房产 */
  async listProperties() { return this.db.properties.map((x) => ({ ...x })); },
  async saveProperty(p) {
    const now = new Date().toISOString();
    if (p.id) {
      const i = this.db.properties.findIndex((x) => x.id === p.id);
      if (i < 0) throw new Error("房产不存在");
      this.db.properties[i] = { ...this.db.properties[i], ...p, updated_at: now };
    } else this.db.properties.push({ status: "owned", ...p, id: uid(), is_default: false, archived: false, created_at: now, updated_at: now });
    this.persist();
    return this.db.properties[p.id ? this.db.properties.findIndex((x) => x.id === p.id) : this.db.properties.length - 1];
  },
  async setDefaultProperty(id) { this.db.properties.forEach((p) => { p.is_default = p.id === id; }); this.persist(); },
  async deleteProperty(id) {
    const db = this.db;
    const billIds = new Set(db.bills.filter((b) => b.property_id === id).map((b) => b.id));
    db.bills = db.bills.filter((b) => !billIds.has(b.id));
    db.bill_payments = db.bill_payments.filter((p) => !billIds.has(p.bill_id));
    const assetIds = new Set(db.assets.filter((a) => a.property_id === id).map((a) => a.id));
    db.assets = db.assets.filter((a) => !assetIds.has(a.id));
    db.maint_logs = db.maint_logs.filter((l) => !assetIds.has(l.asset_id));
    db.seasonal = db.seasonal.filter((s) => s.property_id !== id);
    db.custom_seasonal = (db.custom_seasonal || []).filter((s) => s.property_id !== id);
    delete db.house_profiles[id];
    const dealIds = new Set((db.deals || []).filter((d) => d.property_id === id).map((d) => d.id));
    db.deals = (db.deals || []).filter((d) => !dealIds.has(d.id));
    db.deal_done = (db.deal_done || []).filter((x) => !dealIds.has(x.deal_id));
    db.deal_overrides = (db.deal_overrides || []).filter((x) => !dealIds.has(x.deal_id));
    db.deal_custom = (db.deal_custom || []).filter((x) => !dealIds.has(x.deal_id));
    db.deal_events = (db.deal_events || []).filter((x) => !dealIds.has(x.deal_id));
    db.properties = db.properties.filter((p) => p.id !== id);
    this.persist();
  },
  async endBills(entries) {
    for (const { id, ends_on } of entries) { const b = this.db.bills.find((x) => x.id === id); if (b) { b.ends_on = ends_on; b.updated_at = new Date().toISOString(); } }
    this.persist();
  },
  async listPendingMembers() { return []; },
  async listDeals() { return (this.db.deals || []).map((x) => ({ ...x })); },
  async saveDeal(d) {
    const now = new Date().toISOString(); this.db.deals ||= [];
    if (d.id) {
      const i = this.db.deals.findIndex((x) => x.id === d.id);
      if (i < 0) throw new Error("交易不存在");
      this.db.deals[i] = { ...this.db.deals[i], ...d, updated_at: now }; this.persist(); return d.id;
    }
    const id = uid(); this.db.deals.push({ ...d, id, created_at: now, updated_at: now }); this.persist(); return id;
  },
  async listDealDone() { return (this.db.deal_done || []).map((x) => ({ ...x })); },
  /** done_on：实际完成日期（不传 = 今天；已完成的再传 = 只改日期） */
  async setDealDone(deal_id, task_key, done, done_by_name, done_on) {
    const list = this.db.deal_done ||= [], cur = list.find((x) => x.deal_id === deal_id && x.task_key === task_key);
    if (done && cur) { if (cur.status === "skipped") { cur.status = "done"; cur.done_on = done_on || new Date().toISOString().slice(0, 10); cur.done_by_name = done_by_name; } else if (done_on) cur.done_on = done_on; }
    else {
      this.db.deal_done = list.filter((x) => x !== cur);
      if (done) this.db.deal_done.push({ id: uid(), deal_id, task_key, done_on: done_on || new Date().toISOString().slice(0, 10), done_by_name, created_at: new Date().toISOString() });
    }
    this.persist();
  },
  /** 跳过 / 恢复一个模板事项（这笔交易用不上的步骤）：同一个事项只有一行，要么完成要么跳过（迁移 047） */
  async setDealSkip(deal_id, task_key, skip, by) {
    this.db.deal_done = (this.db.deal_done || []).filter((x) => !(x.deal_id === deal_id && x.task_key === task_key));
    if (skip) this.db.deal_done.push({ id: uid(), deal_id, task_key, status: "skipped", done_on: new Date().toISOString().slice(0, 10), done_by_name: by, created_at: new Date().toISOString() });
    this.persist();
  },
  /** 模板任务的应完成日期调整与备注；日期和备注都空 = 删掉调整（回到推荐日期） */
  async listDealExtras() { return { overrides: (this.db.deal_overrides || []).map((x) => ({ ...x })), custom: (this.db.deal_custom || []).map((x) => ({ ...x })), events: (this.db.deal_events || []).map((x) => ({ ...x })) }; },
  /** 交易进展：实际发生的事（迁移 046） */
  async saveDealEvent(e) {
    const now = new Date().toISOString(); this.db.deal_events ||= [];
    if (e.id) { const i = this.db.deal_events.findIndex((x) => x.id === e.id); if (i < 0) throw new Error("记录不存在"); this.db.deal_events[i] = { ...this.db.deal_events[i], ...e, updated_at: now }; }
    else this.db.deal_events.push({ ...e, id: uid(), created_at: now, updated_at: now });
    this.persist();
  },
  async deleteDealEvent(id) { this.db.deal_events = (this.db.deal_events || []).filter((x) => x.id !== id); this.persist(); },
  async saveDealOverride(deal_id, task_key, due_on, note) {
    const now = new Date().toISOString();
    this.db.deal_overrides = (this.db.deal_overrides || []).filter((x) => !(x.deal_id === deal_id && x.task_key === task_key));
    if (due_on || note) this.db.deal_overrides.push({ id: uid(), deal_id, task_key, due_on: due_on || null, note: note || null, created_at: now, updated_at: now });
    this.persist();
  },
  async saveDealCustom(c) {
    const now = new Date().toISOString(); this.db.deal_custom ||= [];
    if (c.id) {
      const i = this.db.deal_custom.findIndex((x) => x.id === c.id);
      if (i < 0) throw new Error("自定义事项不存在");
      this.db.deal_custom[i] = { ...this.db.deal_custom[i], ...c, updated_at: now };
    } else this.db.deal_custom.push({ ...c, id: uid(), created_at: now, updated_at: now });
    this.persist();
  },
  async deleteDealCustom(id) { this.db.deal_custom = (this.db.deal_custom || []).filter((x) => x.id !== id); this.persist(); },

  /* 房屋资料 / 设备 / 季节任务（按房产） */
  async getHouseProfile(pid) { const p = this.db.house_profiles[pid]; return p ? { ...p } : null; },
  async listHouseProfiles() { return Object.entries(this.db.house_profiles).map(([pid, p]) => ({ ...p, property_id: pid })); },
  async saveHouseProfile(p, pid) { this.db.house_profiles[pid] = { ...p, property_id: pid, updated_at: new Date().toISOString() }; this.persist(); },
  async listAssets() { return this.db.assets.map((x) => ({ ...x })); },
  async saveAsset(a) {
    const now = new Date().toISOString();
    if (a.id) {
      const i = this.db.assets.findIndex((x) => x.id === a.id);
      if (i < 0) throw new Error("设备不存在");
      this.db.assets[i] = { ...this.db.assets[i], ...a, updated_at: now };
      this.persist(); return a.id;
    }
    const id = uid();
    this.db.assets.push({ ...a, id, property_id: a.kind === "vehicle" ? null : a.property_id || state.propertyId, created_at: now, updated_at: now });
    this.persist(); return id;
  },
  async addAssets(list, pid) {
    const now = new Date().toISOString();
    for (const a of list) this.db.assets.push({ ...a, id: uid(), property_id: pid, created_at: now, updated_at: now });
    this.persist();
  },
  async deleteAsset(id) {
    this.db.assets = this.db.assets.filter((x) => x.id !== id);
    this.db.maint_logs = this.db.maint_logs.filter((l) => l.asset_id !== id);
    this.db.asset_valuations = (this.db.asset_valuations || []).filter((v) => v.asset_id !== id);
    this.persist();
  },
  async listMaintLogs() { return this.db.maint_logs.map((x) => ({ ...x })); },
  async addMaintLog(l) { const id = uid(); this.db.maint_logs.push({ ...l, id, created_at: new Date().toISOString() }); this.persist(); return id; },
  async updateMaintLog(id, patch) { const i = this.db.maint_logs.findIndex((x) => x.id === id); if (i >= 0) { this.db.maint_logs[i] = { ...this.db.maint_logs[i], ...patch }; this.persist(); } },
  async deleteMaintLog(id) {
    const l = this.db.maint_logs.find((x) => x.id === id);
    if (l?.purchase_id) this.db.purchases = this.db.purchases.filter((p) => p.id !== l.purchase_id);
    this.db.maint_logs = this.db.maint_logs.filter((x) => x.id !== id);
    this.persist();
  },
  async listSeasonal(sincePeriod) { return this.db.seasonal.filter((s) => s.period >= sincePeriod).map((x) => ({ ...x })); },
  async setSeasonal(task_key, period, done, done_by_name, pid) {
    this.db.seasonal = this.db.seasonal.filter((s) => !(s.task_key === task_key && s.period === period && s.property_id === pid));
    if (done) this.db.seasonal.push({ id: uid(), property_id: pid, task_key, period, done_on: new Date().toISOString().slice(0, 10), done_by_name, created_at: new Date().toISOString() });
    this.persist();
  },
  // 自定义季节任务（每年重复 / 一次性）
  async listCustomSeasonal() { return (this.db.custom_seasonal || []).map((x) => ({ ...x })); },
  async saveCustomSeasonal(c) {
    const now = new Date().toISOString(); this.db.custom_seasonal ||= [];
    if (c.id) { const i = this.db.custom_seasonal.findIndex((x) => x.id === c.id); if (i >= 0) this.db.custom_seasonal[i] = { ...this.db.custom_seasonal[i], ...c, updated_at: now }; }
    else this.db.custom_seasonal.push({ ...c, id: uid(), created_at: now, updated_at: now });
    this.persist();
  },
  async deleteCustomSeasonal(id) {
    this.db.custom_seasonal = (this.db.custom_seasonal || []).filter((x) => x.id !== id);
    this.db.seasonal = this.db.seasonal.filter((s) => s.task_key !== `c_${String(id).replace(/-/g, "")}`);
    this.persist();
  },

  /* 家庭成员 / 孩子 / 宠物名册 */
  async listPeople() { return this.db.people.map((x) => ({ ...x })); },
  async savePerson(p) {
    const key = personKey(p.name);
    if (this.db.people.some((x) => x.id !== p.id && personKey(x.name) === key)) throw new Error(t("名册里已经有“{n}”了", { n: p.name }));
    if (p.id) { const i = this.db.people.findIndex((x) => x.id === p.id); if (i >= 0) this.db.people[i] = { ...this.db.people[i], ...p }; this.persist(); return p.id; }
    const id = uid(); this.db.people.push({ ...p, id, created_at: new Date().toISOString() }); this.persist(); return id;
  },
  async deletePerson(id) { this.db.people = this.db.people.filter((x) => x.id !== id); for (const b of this.db.medical_bills) { if (b.patient_id === id) b.patient_id = null; if (b.guarantor_id === id) b.guarantor_id = null; } this.persist(); },
  async mergePeople(fromId, toId) {
    for (const b of this.db.medical_bills) { if (b.patient_id === fromId) b.patient_id = toId; if (b.guarantor_id === fromId) b.guarantor_id = toId; }
    this.db.people = this.db.people.filter((x) => x.id !== fromId); this.persist();
  },

  /* 医疗账单（事件型账单）：账单 + 付款；演示模式没有“私密”之分，全是自己的 */
  async listMedicalBills() { return this.db.medical_bills.map((x) => ({ ...x })); },
  async saveMedicalBill(b) {
    const now = new Date().toISOString();
    if (b.id) {
      const i = this.db.medical_bills.findIndex((x) => x.id === b.id); if (i < 0) throw new Error("账单不存在");
      this.db.medical_bills[i] = { ...this.db.medical_bills[i], ...b, updated_at: now }; this.persist(); return b.id;
    }
    const id = uid(); this.db.medical_bills.push({ ...b, id, created_at: now, updated_at: now }); this.persist(); return id;
  },
  async deleteMedicalBill(id) {
    this.db.medical_bills = this.db.medical_bills.filter((x) => x.id !== id);
    this.db.medical_payments = this.db.medical_payments.filter((p) => p.bill_id !== id); this.persist();
  },
  async listMedicalPayments() { return this.db.medical_payments.map((x) => ({ ...x })); },
  async addMedicalPayment(p) { const id = uid(); this.db.medical_payments.push({ ...p, id, created_at: new Date().toISOString() }); this.persist(); return id; },
  async updateMedicalPayment(id, patch) { const i = this.db.medical_payments.findIndex((x) => x.id === id); if (i >= 0) { this.db.medical_payments[i] = { ...this.db.medical_payments[i], ...patch }; this.persist(); } },
  async deleteMedicalPayment(id) { this.db.medical_payments = this.db.medical_payments.filter((x) => x.id !== id); this.persist(); },
  /* 收入：演示模式存本机（没有账号，不能做真正的权限隔离，界面上会提示） */
  async listIncomeRecords() { return this.db.income_records.map((x) => ({ ...x })); },
  async saveIncomeRecord(r) {
    const now = new Date().toISOString(), row = pick(r, INCOME_FIELDS, {});
    if (r.id) { const i = this.db.income_records.findIndex((x) => x.id === r.id); if (i < 0) throw new Error("记录不存在"); this.db.income_records[i] = { ...this.db.income_records[i], ...row, updated_at: now }; this.persist(); return r.id; }
    const id = uid(); this.db.income_records.push({ ...row, id, created_by: "demo", created_at: now, updated_at: now }); this.persist(); return id;
  },
  async addIncomeRecords(rows) { const now = new Date().toISOString(); for (const r of rows) this.db.income_records.push({ ...pick(r, INCOME_FIELDS, {}), id: uid(), created_by: "demo", created_at: now, updated_at: now }); this.persist(); },
  async deleteIncomeRecord(id) { this.db.income_records = this.db.income_records.filter((x) => x.id !== id); this.db.income_repayments = this.db.income_repayments.filter((p) => p.record_id !== id); this.persist(); },
  async deleteIncomeByBatch(batch) { const gone = new Set(this.db.income_records.filter((x) => x.import_batch === batch).map((x) => x.id)); this.db.income_records = this.db.income_records.filter((x) => !gone.has(x.id)); this.db.income_repayments = this.db.income_repayments.filter((p) => !gone.has(p.record_id)); this.persist(); },
  async renameIncomeSource(ids, name) { const set = new Set(ids); for (const x of this.db.income_records) if (set.has(x.id)) x.source_name = name; this.persist(); },
  async listIncomeRepayments() { return this.db.income_repayments.map((x) => ({ ...x })); },
  async addIncomeRepayment(p) { const id = uid(); this.db.income_repayments.push({ ...p, id, created_at: new Date().toISOString() }); this.persist(); return id; },
  async deleteIncomeRepayment(id) { this.db.income_repayments = this.db.income_repayments.filter((x) => x.id !== id); this.persist(); },

  /* 信用卡（用卡）：卡档案 + 返现画像 */
  async listCards() { return (this.db.cards || []).map((x) => ({ ...x })); },
  async saveCard(c) {
    const now = new Date().toISOString(); this.db.cards ||= [];
    if (c.id) { const i = this.db.cards.findIndex((x) => x.id === c.id); if (i < 0) throw new Error("卡不存在"); this.db.cards[i] = { ...this.db.cards[i], ...c, updated_at: now }; this.persist(); return c.id; }
    const id = uid(); this.db.cards.push({ ...c, id, created_at: now, updated_at: now }); this.persist(); return id;
  },
  async deleteCard(id) { this.db.cards = (this.db.cards || []).filter((x) => x.id !== id); this.db.account_balances = (this.db.account_balances || []).filter((x) => x.card_id !== id); this.persist(); },

  /* 账单 */
  async listBills() { return this.db.bills.map((x) => ({ ...x })); },
  async saveBill(b) {
    const now = new Date().toISOString();
    if (b.id) {
      const i = this.db.bills.findIndex((x) => x.id === b.id);
      if (i < 0) throw new Error("账单不存在");
      this.db.bills[i] = { ...this.db.bills[i], ...b, updated_at: now };
    } else this.db.bills.push({ ...b, id: uid(), created_at: now, updated_at: now });
    this.persist();
  },
  async addBills(list) {
    const now = new Date().toISOString();
    for (const b of list) this.db.bills.push({ ...b, id: uid(), created_at: now, updated_at: now });
    this.persist();
  },
  async deleteBill(id) {
    this.db.bills = this.db.bills.filter((x) => x.id !== id);
    this.db.bill_payments = this.db.bill_payments.filter((p) => p.bill_id !== id);
    this.persist();
  },
  async listBillPayments() { return this.db.bill_payments.map((x) => ({ ...x })); },
  async addBillPayment(p) { const id = uid(); this.db.bill_payments.push({ ...p, id, created_at: new Date().toISOString() }); this.persist(); return id; },
  async updateBillPayment(id, patch) { const i = this.db.bill_payments.findIndex((x) => x.id === id); if (i >= 0) { this.db.bill_payments[i] = { ...this.db.bill_payments[i], ...patch }; this.persist(); } },
  async updatePurchase(id, patch) { const i = this.db.purchases.findIndex((x) => x.id === id); if (i >= 0) { this.db.purchases[i] = { ...this.db.purchases[i], ...patch }; this.persist(); } },
  async deleteBillPayment(id) {
    const p = this.db.bill_payments.find((x) => x.id === id);
    if (p?.purchase_id) this.db.purchases = this.db.purchases.filter((x) => x.id !== p.purchase_id);
    this.db.bill_payments = this.db.bill_payments.filter((x) => x.id !== id);
    this.db.debt_transactions = (this.db.debt_transactions || []).filter((x) => x.bill_payment_id !== id);   // 和数据库的级联删除一致
    this.persist();
  },
  /* 借贷（迁移 058） */
  async listDebts() { return (this.db.debt_accounts || []).map((x) => ({ ...x })); },
  async saveDebt(d) {
    const now = new Date().toISOString(), row = debtRow(d), list = this.db.debt_accounts ||= [];
    if (d.id) { const i = list.findIndex((x) => x.id === d.id); if (i < 0) throw new Error(t("记录不存在")); list[i] = { ...list[i], ...row, updated_at: now }; this.persist(); return d.id; }
    const id = uid(); list.push({ ...row, id, source_key: null, created_by: "demo", created_at: now, updated_at: now }); this.persist(); return id;
  },
  async deleteDebt(id) {
    const db = this.db;
    db.debt_accounts = (db.debt_accounts || []).filter((x) => x.id !== id);
    db.debt_transactions = (db.debt_transactions || []).filter((x) => x.debt_id !== id);
    for (const b of db.bills) if (b.debt_id === id) b.debt_id = null;
    this.persist();
  },
  async listDebtTxns() { return (this.db.debt_transactions || []).map((x) => ({ ...x })); },
  async upsertDebtTxns(rows) {
    const list = this.db.debt_transactions ||= [], now = new Date().toISOString(), ids = [];
    for (const r of rows) {
      const row = debtTxnRow(r), id = r.id || uid(), i = list.findIndex((x) => x.id === id);
      if (i >= 0) list[i] = { ...list[i], ...row, updated_at: now }; else list.push({ ...row, id, source_key: null, created_at: now, updated_at: now });
      ids.push(id);
    }
    this.persist(); return ids;
  },
  async deleteDebtTxns(ids) { const set = new Set(ids); this.db.debt_transactions = (this.db.debt_transactions || []).filter((x) => !set.has(x.id)); this.persist(); },
  async linkBillDebt(billId, debtId) { const b = this.db.bills.find((x) => x.id === billId); if (b) { b.debt_id = debtId || null; this.persist(); } },
  /* 净资产（迁移 059）：余额历史、估值历史、每月快照 */
  async listBalances() { return (this.db.account_balances || []).map((x) => ({ ...x })); },
  async saveBalance(r) { const row = balanceRow(r); return demoSave(this, "account_balances", row, r.id, (x) => x.card_id === row.card_id && x.as_of === row.as_of); },
  async deleteBalance(id) { this.db.account_balances = (this.db.account_balances || []).filter((x) => x.id !== id); this.persist(); },
  async listValuations() { return (this.db.asset_valuations || []).map((x) => ({ ...x })); },
  async saveValuation(r) { const row = valuationRow(r); return demoSave(this, "asset_valuations", row, r.id, (x) => x.as_of === row.as_of && (row.property_id ? x.property_id === row.property_id : x.asset_id === row.asset_id)); },
  async deleteValuation(id) { this.db.asset_valuations = (this.db.asset_valuations || []).filter((x) => x.id !== id); this.persist(); },
  async listSnapshots() { return (this.db.net_worth_snapshots || []).map((x) => ({ ...x })); },
  /** auto：本月还没有才新建；已有且也是 auto 才更新（manual 的不覆盖）。否则（手动保存 / 重建）直接覆盖这个月 */
  async saveSnapshot(s, { auto = false } = {}) {
    const row = snapshotRow(s), old = (this.db.net_worth_snapshots || []).find((x) => x.month === row.month);
    if (auto && old && old.source !== "auto") return;
    demoSave(this, "net_worth_snapshots", row, old?.id || null, (x) => x.month === row.month);
  },
  async deleteSnapshot(id) { this.db.net_worth_snapshots = (this.db.net_worth_snapshots || []).filter((x) => x.id !== id); this.persist(); },
  async listPaymentsOfBill(billId) { return this.db.bill_payments.filter((p) => p.bill_id === billId).map((x) => ({ ...x })); },
  /** 批量写花费：带 id 的已有行只改给出的字段，没有的新建（还款拆分用） */
  async upsertPurchases(rows) {
    for (const r of rows) { const i = this.db.purchases.findIndex((x) => x.id === r.id); if (i >= 0) this.db.purchases[i] = { ...this.db.purchases[i], ...r }; else this.db.purchases.push({ created_at: new Date().toISOString(), ...r, id: r.id || uid() }); }
    this.persist();
  },
  async deletePurchases(ids) { const set = new Set(ids); this.db.purchases = this.db.purchases.filter((x) => !set.has(x.id)); this.persist(); },

  async saveItem(it) {
    const now = new Date().toISOString();
    if (it.id) {
      const i = this.db.items.findIndex((x) => x.id === it.id);
      if (i < 0) throw new Error("物品不存在");
      const d = Math.round((num(it.quantity) - num(this.db.items[i].quantity)) * 100) / 100;
      if (d) this.db.logs.push({ id: uid(), item_id: it.id, delta: d, reason: "adjust", created_at: now });
      this.db.items[i] = { ...this.db.items[i], ...it, updated_at: now };
      this.persist(); return it.id;
    }
    if (this.db.items.some((x) => normName(x.name) === normName(it.name))) throw new Error("duplicate key value violates unique constraint \"items_household_name_key_uniq\"");   // 和云端迁移 066 一样
    const id = uid(); this.db.items.push({ ...it, id, created_at: now, updated_at: now });
    this.persist(); return id;
  },
  /** 「请确认分类」：没错 → 清标记 */
  async clearCatCheck(ids) { const set = new Set(ids); for (const it of this.db.items) if (set.has(it.id)) it.cat_check = false; this.persist(); },
  /** 「请确认分类」：改成候选分类；连着的花费、采购清单（还是旧分类的）跟着换 */
  async recatItem(id, cat, sub) {
    const it = this.db.items.find((x) => x.id === id); if (!it) throw new Error("物品不存在");
    const old = it.category; Object.assign(it, { category: cat, subcategory: sub, cat_check: false, updated_at: new Date().toISOString() });
    for (const r of [...this.db.purchases, ...this.db.shopping]) if (r.item_id === id && r.category === old) r.category = cat;
    this.persist();
  },
  async deleteItem(id) {
    this.db.items = this.db.items.filter((x) => x.id !== id);
    this.db.logs = this.db.logs.filter((l) => l.item_id !== id);
    this.db.shopping.forEach((s) => { if (s.item_id === id) s.item_id = null; });
    this.persist();
  },
  async adjust(id, delta, reason) {
    const it = this.db.items.find((x) => x.id === id);
    if (!it) throw new Error("物品不存在");
    const oldq = num(it.quantity), newq = Math.max(0, Math.round((oldq + delta) * 100) / 100);
    it.quantity = newq; it.updated_at = new Date().toISOString();
    if (reason === "restock" && it.alert_mute_until) it.alert_mute_until = null;   // 又买了：说明想要，恢复提醒
    if (newq !== oldq) this.db.logs.push({ id: uid(), item_id: id, delta: newq - oldq, reason, created_at: it.updated_at });
    this.persist();
  },
  /** 不再提醒 / 暂停提醒：until = 'YYYY-MM-DD'（到这天之前不提醒），'9999-12-31' = 一直不提醒，null = 恢复 */
  async setItemMute(id, until) { const it = this.db.items.find((x) => x.id === id); if (!it) throw new Error("物品不存在"); it.alert_mute_until = until || null; this.persist(); },
  async listShopping() { return this.db.shopping.map((x) => ({ ...x })); },
  async saveShopping(row) {
    if (row.id) {
      const i = this.db.shopping.findIndex((x) => x.id === row.id);
      if (i >= 0) this.db.shopping[i] = { ...this.db.shopping[i], ...row };
    } else {
      if (row.item_id && this.db.shopping.some((s) => s.item_id === row.item_id && s.status !== "bought")) return; // 与云端唯一索引行为一致
      this.db.shopping.push({ status: "todo", ...row, id: uid(), created_at: new Date().toISOString() });
    }
    this.persist();
  },
  async deleteShopping(id) { this.db.shopping = this.db.shopping.filter((x) => x.id !== id); this.persist(); },
  async clearBought() { this.db.shopping = this.db.shopping.filter((x) => x.status !== "bought"); this.persist(); },
};

export function seedDemo() {
  const now = Date.now();
  const us = Units.region.system === "us";
  const cur = Units.region.currency;
  const priceFactor = { CNY: 1, USD: 0.22, CAD: 0.3 }[cur] || 1;  // 演示用的粗略价格换算
  const r2 = (v) => Math.round(v * 100) / 100;
  const items = [], logs = [], purchases = [];
  // 演示用商店：按分类大致分配
  const STORES = us
    ? { fresh: ["H Mart", "Trader Joe's", "Costco"], frozen: ["Costco", "H Mart"], dry: ["Costco", "H Mart", "Amazon"], drink: ["Costco"], daily: ["Target", "Costco", "Amazon"], baby: ["Amazon", "Target"], health: ["Costco", "Amazon"] }
    : { fresh: ["盒马", "美团买菜", "楼下菜市场"], frozen: ["山姆", "盒马"], dry: ["山姆", "京东"], drink: ["山姆", "京东"], daily: ["京东", "山姆"], baby: ["京东", "天猫"], health: ["京东"] };
  // price：每单位价格（人民币，演示数据）
  // 演示物品名按当前语言写入（名称是用户数据，之后不再翻译）
  const add = (zhName, category, subcategory, unit, quantity, min_quantity, location, daily, expiryInDays, price) => {
    const id = uid(), name = t(zhName);
    items.push({
      id, name, category, subcategory, unit, quantity, min_quantity, location, lead_days: 3,
      expiry_date: expiryInDays == null ? null : new Date(now + expiryInDays * DAY).toISOString().slice(0, 10),
      avg_daily_use: null, notes: "", created_at: new Date(now - 190 * DAY).toISOString(), updated_at: new Date().toISOString(),
    });
    if (!(daily > 0)) return;
    // 从今天的库存倒推：每 3 天消耗一次；倒推时库存超过合理上限，说明那之前补过一次货
    const cap = Math.max(min_quantity * 2, daily * 14, 1);
    const buy = Math.max(1, Math.ceil(cap));
    let level = quantity;
    for (let d = 3; d <= 180; d += 3) {
      const tm = now - d * DAY + ((d * 7919) % 36000) * 1000;   // 时间稍微错开
      const use = r2(daily * 3);
      logs.push({ id: uid(), item_id: id, delta: -use, reason: "consume", created_at: new Date(tm).toISOString() });
      level += use;
      while (level > cap) {
        const bt = tm - 3 * 3600 * 1000;
        logs.push({ id: uid(), item_id: id, delta: buy, reason: "restock", created_at: new Date(bt).toISOString() });
        purchases.push({ id: uid(), item_id: id, name, category, quantity: buy, unit, amount: r2(buy * price * priceFactor * (0.9 + ((d * 31) % 20) / 100)), currency: cur, purchased_at: new Date(bt).toISOString(),
          store: STORES[category][((d / 3) | 0) % STORES[category].length] });
        level = Math.max(0, level - buy);
      }
    }
  };
  add("鸡蛋", "fresh", "蛋奶", "个", 4, 6, "冷藏", 2, 12, 1.2);
  if (us) add("纯牛奶", "fresh", "蛋奶", "gal", 1, 0.5, "冷藏", 0.2, 5, 28);
  else add("纯牛奶", "fresh", "蛋奶", "盒", 2, 1, "冷藏", 1, 5, 6);
  add("番茄", "fresh", "蔬菜", "个", 5, 2, "冷藏", 0.5, 4, 2);
  add("菠菜", "fresh", "蔬菜", "把", 1, 1, "冷藏", 0.3, 2, 5);
  add("西兰花", "fresh", "蔬菜", "个", 2, 1, "冷藏", 0.2, 5, 6);
  add("鲫鱼", "fresh", "水产", "条", 0, 1, "冷藏", 0.15, null, 18);
  add("北豆腐", "fresh", "豆制品", "盒", 1, 1, "冷藏", 0.2, 2, 4);
  add("无糖酸奶", "fresh", "蛋奶", "杯", 6, 2, "冷藏", 1, 9, 5);
  add("苹果", "fresh", "水果", "个", 6, 2, "冷藏", 1, 14, 3);
  add("冷冻虾仁", "frozen", "冷冻水产", "袋", 2, 1, "冷冻", 0.1, 90, 35);
  if (us) add("牛腩", "frozen", "冷冻肉禽", "lb", 2, 1, "冷冻", 0.1, 60, 40);
  else add("牛腩", "frozen", "冷冻肉禽", "kg", 1, 0.5, "冷冻", 0.05, 60, 90);
  add("速冻水饺", "frozen", "速冻面点", "袋", 2, 1, "冷冻", 0.1, 120, 25);
  if (us) {
    add("大米", "dry", "米面杂粮", "lb", 15, 5, "厨房柜", 0.6, null, 4);
    add("杂粮（糙米）", "dry", "米面杂粮", "lb", 3, 1, "厨房柜", 0.2, null, 7);
  } else {
    add("大米", "dry", "米面杂粮", "kg", 6, 2, "厨房柜", 0.3, null, 8);
    add("杂粮（糙米）", "dry", "米面杂粮", "kg", 1.5, 0.5, "厨房柜", 0.1, null, 15);
  }
  add("燕麦片", "dry", "米面杂粮", "袋", 2, 1, "厨房柜", 0.06, 180, 20);
  add("食用油", "dry", "食用油", "瓶", 1, 0, "厨房柜", 0.06, null, 70);
  add("生抽", "dry", "调味品", "瓶", 1, 0, "厨房柜", 0.03, null, 15);
  add("原味坚果", "drink", "零食坚果", "袋", 3, 1, "常温", 0.15, 60, 40);
  add("饮用水", "drink", "饮用水", "提", 2, 1, "储物间", 0.25, null, 30);
  add("抽纸", "daily", "纸品", "包", 5, 4, "储物间", 0.4, null, 4);
  add("卷纸", "daily", "纸品", "卷", 12, 6, "卫生间", 0.6, null, 2.5);
  add("洗洁精", "daily", "清洁洗涤", "瓶", 1, 0, "厨房柜", 0.03, null, 15);
  add("垃圾袋", "daily", "厨房耗材", "卷", 2, 1, "厨房柜", 0.07, null, 8);
  add("纸尿裤 NB码", "baby", "纸尿裤", "片", 18, 30, "储物间", 9, null, 1.5);
  add("婴儿湿巾", "baby", "湿巾", "包", 3, 2, "储物间", 0.3, null, 12);
  add("防溢乳垫", "baby", "哺乳耗材", "片", 40, 20, "储物间", 6, null, 0.8);
  add("复合维生素", "health", "维生素营养", "片", 3, 0, "常温", 1, 200, 1.5);
  // 装备（耐用品）：只有数量和位置，没有消耗记录
  add("床单被罩四件套", "gear_home", "床上用品", "套", 3, 0, "衣柜", 0, null, 0);
  add("电热毯", "gear_home", "家用电器", "条", 1, 0, "衣柜", 0, null, 0);
  add("旅行婴儿床（Pack and Play）", "gear_baby", "出行用品", "个", 1, 0, "地下室", 0, null, 0);
  add("儿童自行车", "gear_travel", "自行车", "辆", 1, 0, "车库", 0, null, 0);
  add("千斤顶", "gear_car", "应急工具", "个", 1, 0, "车内", 0, null, 0);
  add("搭电线（Jumper）", "gear_car", "应急工具", "套", 1, 0, "车内", 0, null, 0);
  add("修枝剪", "gear_garden", "园艺手工具", "把", 1, 0, "车库", 0, null, 0);
  add("餐盘", "gear_kitchen", "餐具碗盘", "个", 8, 0, "厨房柜", 0, null, 0);
  add("烤盘", "gear_kitchen", "烤盘托盘", "个", 2, 0, "厨房柜", 0, null, 0);
  add("烘焙模具", "gear_kitchen", "烘焙工具", "套", 1, 0, "厨房柜", 0, null, 0);
  return { items, logs, shopping: [], purchases };
}

/* ───────────── 数据层：Supabase 云端 ───────────── */
export const ITEM_FIELDS = ["name", "category", "subcategory", "unit", "quantity", "min_quantity", "location", "expiry_date", "lead_days", "avg_daily_use", "notes", "asset_ids"];
export const ASSET_FIELDS = ["property_id", "kind", "type", "name", "location", "brand", "model", "serial", "installed_on", "manufacture_year", "warranty_until", "labor_warranty_until",
  "expected_life_years", "service_interval_months", "purchase_price", "replacement_cost_estimate", "owner", "notes", "vehicle", "units", "recall"];
export const PROPERTY_FIELDS = ["name", "kind", "role", "address", "status", "acquired_on", "purchase_price", "sold_on", "sale_price", "archived", "notes"];
export const INSURANCE_FIELDS = ["insured", "insurance_provider", "insurance_policy", "insurance_from", "insurance_to", "insurance_coverage", "insurance_premium", "insurance_agent", "insurance_phone", "insurance_email", "hoa"];
export const INCOME_FIELDS = ["received_on", "amount", "currency", "orig_amount", "orig_currency", "fee", "source_name", "kind", "channel", "person_id", "account", "import_batch", "repay_required", "repay_due_on", "repay_amount", "notes", "income_amount", "account_id"];
export const MED_FIELDS = ["kind", "subkind", "provider", "patient", "patient_id", "guarantor", "guarantor_id", "bill_ref", "claim_ref", "insurer", "service_date", "bill_date", "due_on", "billed_amount", "insurance_paid", "adjustment", "patient_amount", "currency", "status", "hsa_eligible", "visibility", "notes"];
export const CARD_FIELDS = ["name", "issuer", "network", "last4", "holder_user_id", "kind", "expires_on", "opened_on", "annual_fee", "fee_month", "credit_limit", "statement_day", "due_day", "autopay", "bill_id", "catalog_id", "rewards", "bonus", "credits", "rules_as_of", "active", "notes", "balance", "inactive_since"];
export const BILL_FIELDS = ["property_id", "name", "category", "direction", "payee", "account_last4", "login_hint", "pay_url", "pay_channel", "amount_type", "typical_amount", "currency",
  "frequency", "interval_months", "due_day", "due_dates", "next_due_on", "grace_days", "late_fee_note", "autopay", "autopay_method", "autopay_card_expires", "pay_card_id", "statement_channel",
  "reminder_days", "ends_on", "sub_kind", "trial_ends_on", "assigned_to", "essential", "active", "notes"];
export const CATEGORY_FIELDS = ["space", "key", "name", "icon", "color", "loc", "subs", "hidden", "sort"];
export const LOCATION_FIELDS = ["name", "grp", "replaces", "sort"];
export const TERM_FIELDS = ["term", "zh", "en", "hant"];
/* 借贷（迁移 058） */
/** 迁移 060 加的列（第一期还款日、银行 Escrow 计划、对账单校准；流水的额外本金）：库里还没有这些列时写库前去掉（debt060 = false），其余照旧 */
export const DEBT_060 = ["first_payment_date", "escrow_schedule", "statement_check"];
export const schemaFlags = { debt060: true };
export const DEBT_FIELDS = ["name", "category", "direction", "counterparty_name", "person_id", "lender_card_id", "original_principal", "currency", "interest_rate", "term_months", "start_date", "maturity_date",
  "payment_frequency", "scheduled_payment", "opening_balance", "opening_balance_on", "status", "property_id", "asset_id", "financing_role", "secured", "link_confirmed", "notes", ...DEBT_060];
/** 按批次汇总：{ spend: { 批次: { n, sum } }, inc: 同上 | null }（sum 是净额：退款是负数） */
function batchTotalsOf(ids, purchases, incomes, noInc = false) {
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
function debtRow(d) {
  const r = pick(d, DEBT_FIELDS, {});
  r.name = String(r.name || "").trim().slice(0, 60) || t("贷款");
  r.category ||= "other"; r.direction ||= "payable"; r.status ||= "active"; r.payment_frequency ||= "monthly";
  r.currency ||= Units.region.currency; r.secured = !!r.secured; r.link_confirmed = r.link_confirmed !== false;
  if (r.opening_balance == null || !r.opening_balance_on) { r.opening_balance = null; r.opening_balance_on = null; }   // 两个一起填才有意义（数据库 check）
  if ("escrow_schedule" in r) r.escrow_schedule = Array.isArray(r.escrow_schedule) ? r.escrow_schedule.slice(0, 60) : [];
  if (!schemaFlags.debt060) for (const k of DEBT_060) delete r[k];
  return r;
}
function debtTxnRow(x) {
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
function balanceRow(x) {
  const r = pick(x, BALANCE_FIELDS, {});
  r.balance = r2(r.balance); r.currency ||= Units.region.currency; r.source ||= "manual"; r.notes = r.notes ? String(r.notes).slice(0, 300) : null;
  return r;
}
function valuationRow(x) {
  const r = pick(x, VALUATION_FIELDS, {});
  r.value = r2(r.value); r.currency ||= Units.region.currency; r.source ||= "manual"; r.notes = r.notes ? String(r.notes).slice(0, 300) : null;
  if (r.property_id) r.asset_id = null;   // 恰好挂一处（数据库 check）
  return r;
}
function snapshotRow(x) {
  const r = pick(x, SNAPSHOT_FIELDS, {});
  for (const k of ["assets_total", "liabilities_total", "net_worth"]) r[k] = r2(r[k]);
  r.totals ||= {}; r.meta ||= {}; r.currency ||= Units.region.currency; r.source = r.source === "manual" ? "manual" : "auto";
  return r;
}
/** 演示库：有 id 就改那一行，没有就按唯一键（同一账户同一天 / 同一资产同一天 / 同一个月）找；改了日期撞上同一天的另一行，那一行让位（和数据库的唯一约束一致） */
function demoSave(store, table, row, id, sameKey) {
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
export const DEAL_FIELDS = ["property_id", "asset_id", "kind", "contract_on", "review_deadline", "financing_deadline", "closing_on", "price", "earnest_money", "attorney", "lender", "agent", "title_company", "inspector", "notes", "outcome", "closed_at", "baseline"];
export const DEAL_EVENT_FIELDS = ["deal_id", "happened_on", "title", "note", "contact", "task_keys", "created_by_name"];
export const DEAL_CUSTOM_FIELDS = ["deal_id", "name", "stage", "priority", "due_on", "note", "done_on", "done_by_name", "skipped"];
export const CUSTOM_SEASONAL_FIELDS = ["property_id", "name", "note", "months", "due_on", "done_on", "done_by_name"];
/** 一个人所有收入折合每月的合计（存在旧的 income_amount 列里，兼容旧版） */
const incomeTotal = (lines) => Math.round((lines || []).reduce((s, l) => s + (l.period === "year" ? num(l.amount) / 12 : num(l.amount)), 0) * 100) / 100;
/** 名字比较用的键：忽略大小写和多余空格（数据库的唯一索引同一个规则） */
export const personKey = (n) => String(n || "").trim().replace(/\s+/g, " ").toLowerCase();
const personError = (e) => (/household_people_name_idx|duplicate key/i.test(e.message || "") ? t("名册里已经有这个名字了（忽略大小写和空格）") : /household_people|does not exist|schema cache/i.test(e.message || "") ? t("还没执行数据库迁移 029（家庭成员名册），先在 Supabase 里执行 supabase/migrations/029_people.sql") : e.message);
const pick = (obj, fields, extra) => { const r = { ...extra }; fields.forEach((k) => { r[k] = obj[k] ?? null; }); return r; };

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
  async listPage(kind, f, after, limit) { return this.must(await this.sb.rpc(`${kind}_page`, { p_household: this.hid, p_f: f, p_after: after || null, p_limit: limit })) || []; },
  async listStats(kind, f, facets = false) { return this.must(await this.sb.rpc(`${kind}_stats`, { p_household: this.hid, p_f: f, p_facets: !!facets })) || {}; },
  /** 统计用的聚合（迁移 055）：按 月 × 分类 × 性质 × 房产 × 币种（商店版再加商店）聚合好的紧凑行；from / to = 本地日期（含 from，不含 to），tz = 浏览器时区。
   *  行数可能过 1000（PostgREST 的 max-rows），按固定顺序分页读全 */
  async spendRollup(from, to, tz) { return this.pageAll(() => this.sb.rpc("spend_rollup", { p_household: this.hid, p_from: from || null, p_to: to || null, p_tz: tz }).order("month").order("category").order("nature").order("property_id").order("currency")); },
  /** 收入聚合（迁移 056）：按 月 × 类型 × 成员 × 账户 × 币种 × 是否需要还；income_sum = 填了「其中已实现收益」的认定额，dflt_sum = 没填的到账金额 */
  async incRollup(from, to, tz) { return this.pageAll(() => this.sb.rpc("inc_rollup", { p_household: this.hid, p_from: from || null, p_to: to || null, p_tz: tz }).order("month").order("kind").order("person_id").order("account_id").order("currency").order("repay")); },
  /** 账本聚合（迁移 056）：周期（month / biweek）× 来源 × 类型 × 方向 × 分类 × 性质 */
  async ledgerRollup(from, to, tz, unit = "month", anchor = null) { return this.pageAll(() => this.sb.rpc("ledger_rollup", { p_household: this.hid, p_from: from || null, p_to: to || null, p_tz: tz, p_unit: unit, p_anchor: anchor }).order("period").order("source").order("type").order("direction").order("category").order("nature").order("repay").order("person_id").order("currency")); },
  /** 统一账本 ledger_v 的一段（本地日期 [from, to)，新 → 旧）：对财务 → 全部流水 */
  async ledgerRange(from, to) {
    const lo = new Date(`${from}T00:00:00`).toISOString(), hi = new Date(`${to}T00:00:00`).toISOString();
    return this.pageAll(() => this.sb.from("ledger_v").select("*").eq("household_id", this.hid).gte("occurred_at", lo).lt("occurred_at", hi).order("occurred_at", { ascending: false }).order("id", { ascending: false }), 20000);
  },
  /** 收款方名单（迁移 062）：没执行迁移时返回 null（页面照常，只是没有「最近一次」和整理功能） */
  async payeeNames(tz) { try { return await this.pageAll(() => this.sb.rpc("spend_payee_names", { p_household: this.hid, p_tz: tz }).order("store_key")); } catch (e) { if (/spend_payee_names|function|schema cache/i.test(e.message || "")) return null; throw e; } },
  async renamePayees(fromKeys, to) { return this.must(await this.sb.rpc("rename_payees", { p_household: this.hid, p_from: fromKeys, p_to: to })) || []; },
  /** 撤销改名：按（原收款方, 原名称）分组，每组一次 update（几十组以内） */
  async restorePayees(rows) {
    const groups = new Map();
    for (const r of rows) { const k = JSON.stringify([r.old_store, r.old_name]); (groups.get(k) || groups.set(k, []).get(k)).push(r.id); }
    for (const [k, ids] of groups) { const [store, name] = JSON.parse(k); for (let i = 0; i < ids.length; i += 100) this.must(await this.sb.from("purchases").update({ store, name }).eq("household_id", this.hid).in("id", ids.slice(i, i + 100))); }
  },
  async spendRollupStore(from, to, tz) { return this.pageAll(() => this.sb.rpc("spend_rollup_store", { p_household: this.hid, p_from: from || null, p_to: to || null, p_tz: tz }).order("month").order("store_key").order("category").order("nature").order("currency")); },
  async listItems() { return this.pageAll(() => this.sb.from("items").select("*").eq("household_id", this.hid).order("name").order("id")); },
  async listCategories() { return this.must(await this.sb.from("custom_categories").select("*").eq("household_id", this.hid).order("sort").order("created_at")); },
  async saveCategory(c) {
    const row = pick(c, CATEGORY_FIELDS, { household_id: this.hid, updated_by: state.user.id });
    if (c.parent !== undefined) row.parent = c.parent || null;   // 自建分类挂在哪个二级花费分类下（迁移 055）；不传就不动这一列
    if (c.id) this.must(await this.sb.from("custom_categories").update(row).eq("id", c.id));
    else this.must(await this.sb.from("custom_categories").insert(row));
  },
  async deleteCategory(id) { this.must(await this.sb.from("custom_categories").delete().eq("id", id)); },
  async listItemAliases() { return this.must(await this.sb.from("item_aliases").select("id,item_id,alias").eq("household_id", this.hid)); },
  async setItemAliases(itemId, list) {
    this.must(await this.sb.from("item_aliases").delete().eq("household_id", this.hid).eq("item_id", itemId));
    if (list.length) this.must(await this.sb.from("item_aliases").upsert(list.map((alias) => ({ household_id: this.hid, item_id: itemId, alias })), { onConflict: "household_id,alias_key", ignoreDuplicates: true }));
  },
  async addItemAlias(itemId, alias) { this.must(await this.sb.from("item_aliases").upsert({ household_id: this.hid, item_id: itemId, alias }, { onConflict: "household_id,alias_key", ignoreDuplicates: true })); },
  async listLocations() { return this.must(await this.sb.from("custom_locations").select("*").eq("household_id", this.hid).order("sort").order("created_at")); },
  async saveLocation(c) {
    const row = pick(c, LOCATION_FIELDS, { household_id: this.hid, updated_by: state.user.id });
    if (c.id) this.must(await this.sb.from("custom_locations").update(row).eq("id", c.id));
    else this.must(await this.sb.from("custom_locations").insert(row));
  },
  async deleteLocation(id) { this.must(await this.sb.from("custom_locations").delete().eq("id", id)); },
  async renameLocation(oldName, newName) {
    this.must(await this.sb.from("items").update({ location: newName }).eq("household_id", this.hid).eq("location", oldName));
    this.must(await this.sb.from("assets").update({ location: newName }).eq("household_id", this.hid).eq("location", oldName));
  },
  /** 预算（收入、储蓄比例、各类预算）：每个家庭一行；迁移 022 还没执行时读不到，当作还没设置 */
  /** 收入：行级安全保证本人只能读到自己的，家主能读到全家的（迁移 023） */
  async listIncomes() { return this.must(await this.sb.from("member_incomes").select("*").eq("household_id", this.hid)); },
  async saveIncome(r) {
    const row = { household_id: this.hid, user_id: r.user_id, lines: r.lines, income_amount: incomeTotal(r.lines), income_period: "month", updated_at: new Date().toISOString() };
    return this.must(await this.sb.from("member_incomes").upsert(row, { onConflict: "household_id,user_id" }).select().single());
  },
  async deleteIncome(uid) { this.must(await this.sb.from("member_incomes").delete().eq("household_id", this.hid).eq("user_id", uid)); },
  async getBudget() {
    const r = await this.sb.from("household_budgets").select("*").eq("household_id", this.hid).maybeSingle();
    if (r.error) { console.warn("[budget]", r.error.message); return null; }
    return r.data;
  },
  async saveBudget(b) {
    const row = { household_id: this.hid, income_amount: b.income_amount ?? 0, income_period: b.income_period || "month", savings_pct: b.savings_pct ?? 20, cat_budgets: b.cat_budgets || {}, updated_by: state.user.id };   // 收入已挪到 member_incomes，这两列只为兼容旧表保留
    return this.must(await this.sb.from("household_budgets").upsert(row, { onConflict: "household_id" }).select().single());
  },
  async listTerms() { return this.must(await this.sb.from("custom_terms").select("*").eq("household_id", this.hid)); },
  async saveTerm(r) { this.must(await this.sb.from("custom_terms").upsert(pick(r, TERM_FIELDS, { household_id: this.hid, updated_by: state.user.id }), { onConflict: "household_id,term" })); },
  async deleteTerm(term) { this.must(await this.sb.from("custom_terms").delete().eq("household_id", this.hid).eq("term", term)); },
  /** 我的 → 家里的数字：某个时间以来的库存日志（近一年，带记录人）；只在打开那一页时读，按 1000 行一页 */
  async listLogsSince(iso) {
    return this.pageAll(() => this.sb.from("stock_logs").select("id,item_id,delta,reason,created_by,created_at").eq("household_id", this.hid).gte("created_at", iso).order("created_at").order("id"), 20000);
  },
  async listLogs() {
    const since = new Date(Date.now() - STATS_LOG_DAYS * DAY).toISOString();
    return this.pageAll(() => this.sb.from("stock_logs").select("id,item_id,delta,reason,created_at")
      .eq("household_id", this.hid).gte("created_at", since).order("created_at").order("id"));   // 分页：.limit(10000) 实际只回 1000 行，90 天里超过的最新记录会被截掉
  },
  /** 全部花费：只给导出 JSON 用（按需读）。平时的页面不再读整表：统计 / 预算读聚合，明细分页，联想 / 查重 / 卡的用量都是定点查询（迁移 057） */
  async listPurchases() {
    return (await this.pageAll(() => this.sb.from("purchases").select("*").eq("household_id", this.hid)
      .order("purchased_at", { ascending: false }).order("id"))).map((x) => ({ ...x, category: canonCat(x.category) }));   // 旧分类按别名表换成新的（迁移 035 跑过就没差别）
  },
  /* ── 迁移 057 的按需查询 ── */
  /** 家庭分摊：按 月 × 记账人 × 币种 的正数花费 */
  /** 补货预估：物品最近几次买价、分类最近 10 次买价 */
  async itemPurchaseStats(cur, items, cats) { return this.must(await this.sb.rpc("item_purchase_stats", { p_household: this.hid, p_cur: cur || null, p_items: items || [], p_cats: cats || [] })) || []; },
  /** 查重：rows = [{ k, d, a }]，返回每条 ±days 天内金额相同的已有花费 */
  /** 商店 / 行程联想 */
  async spendSuggest(since, limit = 300) { return this.must(await this.sb.rpc("spend_suggest", { p_household: this.hid, p_since: since || null, p_limit: limit })) || {}; },
  /** 卡的用量（卡 × 本地日期 × 分类 × 商店）/ 每张卡名下的笔数、合计、月份 */
  async cardSpend(from, to, tz) { return this.pageAll(() => this.sb.rpc("card_spend", { p_household: this.hid, p_from: from || null, p_to: to || null, p_tz: tz }).order("card_id").order("day").order("category").order("store")); },
  async cardTotals(tz) { return this.must(await this.sb.rpc("card_totals", { p_household: this.hid, p_tz: tz })) || []; },
  /** 一笔花费（编辑缴费 / 保养记录时读它的付款方式、收款方） */
  async getPurchase(id) { const r = this.must(await this.sb.from("purchases").select("*").eq("id", id).maybeSingle()); return r ? { ...r, category: canonCat(r.category) } : null; },
  /** 删除卡：名下花费改成文字付款方式 / 一起删；返回几笔 */
  async detachCardPurchases(cardId, label) { return (this.must(await this.sb.from("purchases").update({ card_id: null, method: label }).eq("household_id", this.hid).eq("card_id", cardId).select("id")) || []).length; },
  async deleteCardPurchases(cardId) { return (this.must(await this.sb.from("purchases").delete().eq("household_id", this.hid).eq("card_id", cardId).select("id")) || []).length; },
  async addPurchase(p) { return this.must(await this.sb.from("purchases").insert({ ...p, household_id: this.hid }).select("id").single()).id; },

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
  async listProperties() {
    const [rows, fin] = await Promise.all([this.sb.from("properties").select("*").eq("household_id", this.hid).order("created_at").then((r) => this.must(r)), this.finRows("properties")]);
    return this.mergeFin("properties", rows, fin);
  },
  async saveProperty(p) {
    const row = pick(p, PROPERTY_FIELDS, { household_id: this.hid, updated_by: state.user.id });
    if (row.archived == null) row.archived = false;
    if (!row.status) row.status = "owned";
    const fin = this.splitFin("properties", row, p);
    if (p.id) { this.must(await this.sb.from("properties").update(row).eq("id", p.id)); await this.writeFin("properties", p.id, fin); return { ...p, ...row, ...(fin || {}) }; }
    const out = this.must(await this.sb.from("properties").insert(row).select().single());   // 返回新行，房屋页新建后直接切过去
    await this.writeFin("properties", out.id, fin);
    return { ...out, ...(fin || {}) };
  },
  async setDefaultProperty(id) {
    this.must(await this.sb.from("properties").update({ is_default: false }).eq("household_id", this.hid).eq("is_default", true));
    this.must(await this.sb.from("properties").update({ is_default: true }).eq("id", id));
  },
  /** 彻底删除：先删挂着的账单（缴费记录级联），再删房产（资料 / 设备 / 季节任务 / 交易级联）；purchases 保留 */
  async deleteProperty(id) {
    this.must(await this.sb.from("bills").delete().eq("household_id", this.hid).eq("property_id", id));
    this.must(await this.sb.from("properties").delete().eq("id", id));
  },
  /** 批量给账单写结束日期（退出向导） */
  async endBills(entries) {
    for (const { id, ends_on } of entries) this.must(await this.sb.from("bills").update({ ends_on, updated_by: state.user.id }).eq("id", id));
  },

  /* 房产 / 车辆交易（同一张 property_deals 表：property_id 或 asset_id 二选一） */
  async listDeals() {
    const [rows, fin] = await Promise.all([this.sb.from("property_deals").select("*").eq("household_id", this.hid).order("created_at", { ascending: false }).then((r) => this.must(r)), this.finRows("property_deals")]);
    return this.mergeFin("property_deals", rows, fin);
  },
  async saveDeal(d) {
    const row = pick(d, DEAL_FIELDS, { household_id: this.hid, updated_by: state.user.id });
    const fin = this.splitFin("property_deals", row, d);   // 成交价 / 定金进旁表（迁移 058）
    if (state.noBaselineCol) delete row.baseline;
    const run = async (r) => (d.id ? this.sb.from("property_deals").update(r).eq("id", d.id) : this.sb.from("property_deals").insert(r).select("id").single());
    let res = await run(row);
    if (res.error && /baseline/i.test(res.error.message) && "baseline" in row) { state.noBaselineCol = true; const { baseline, ...rest } = row; res = await run(rest); }   // 迁移 046 还没执行：不存基线，交易照常保存
    const out = this.must(res);
    await this.writeFin("property_deals", d.id || out.id, fin);
    return d.id || out.id;
  },
  async listDealDone() { return this.must(await this.sb.from("deal_task_done").select("*").eq("household_id", this.hid)); },
  async setDealDone(deal_id, task_key, done, done_by_name, done_on) {
    if (done) {
      done_by_name = (done_by_name || "").slice(0, 20) || null;   // 列约束 ≤ 20 个字符，超了数据库会 400
      const was = state.dealDone.find((d) => d.deal_id === deal_id && d.task_key === task_key);
      if (was?.status === "skipped") { this.must(await this.sb.from("deal_task_done").update({ status: "done", done_by: state.user.id, done_by_name, done_on: done_on || new Date().toISOString().slice(0, 10) }).eq("deal_id", deal_id).eq("task_key", task_key)); return; }   // 原来是「已跳过」：改成已完成
      const { error } = await this.sb.from("deal_task_done").insert({ household_id: this.hid, deal_id, task_key, done_by: state.user.id, done_by_name, ...(done_on ? { done_on } : {}) });
      if (error && error.code !== "23505") throw new Error(error.message);
      if (error && done_on) this.must(await this.sb.from("deal_task_done").update({ done_on }).eq("deal_id", deal_id).eq("task_key", task_key));   // 已经勾过：只改实际完成日期
    } else this.must(await this.sb.from("deal_task_done").delete().eq("deal_id", deal_id).eq("task_key", task_key));
  },
  /** 跳过 / 恢复一个模板事项（迁移 047 加的 status 列；没执行时这里会报错提示）*/
  async setDealSkip(deal_id, task_key, skip, by) {
    by = (by || "").slice(0, 20) || null;
    this.must(await this.sb.from("deal_task_done").delete().eq("deal_id", deal_id).eq("task_key", task_key));
    if (skip) this.must(await this.sb.from("deal_task_done").insert({ household_id: this.hid, deal_id, task_key, status: "skipped", done_by: state.user.id, done_by_name: by }));
  },
  /** 迁移 017 还没执行时读不到这两张表：不影响交易页其余功能 */
  async listDealExtras() {
    const [o, c] = await Promise.all([
      this.sb.from("deal_task_overrides").select("*").eq("household_id", this.hid),
      this.sb.from("deal_custom_tasks").select("*").eq("household_id", this.hid).order("created_at")]);
    const ev = await this.sb.from("deal_events").select("*").eq("household_id", this.hid).order("happened_on").order("created_at");   // 迁移 046 没执行：读不到，只是没有进展记录
    if (ev.error) console.warn("[deal events]", ev.error.message);
    if (o.error || c.error) { console.warn("[deal extras]", (o.error || c.error).message); return { overrides: [], custom: [], events: ev.data || [] }; }
    return { overrides: o.data, custom: c.data, events: ev.error ? [] : ev.data };
  },
  async saveDealOverride(deal_id, task_key, due_on, note) {
    if (!due_on && !note) return this.must(await this.sb.from("deal_task_overrides").delete().eq("deal_id", deal_id).eq("task_key", task_key));
    this.must(await this.sb.from("deal_task_overrides").upsert({ household_id: this.hid, deal_id, task_key, due_on: due_on || null, note: note || null, updated_by: state.user.id }, { onConflict: "deal_id,task_key" }));
  },
  async saveDealCustom(c) {
    const row = pick(c, DEAL_CUSTOM_FIELDS, { household_id: this.hid, updated_by: state.user.id });
    row.done_by = c.done_on ? state.user.id : null;
    if (row.done_by_name) row.done_by_name = String(row.done_by_name).slice(0, 20);
    if (c.skipped === undefined) delete row.skipped;   // 迁移 047 没执行时，不带这一列照常保存
    if (c.id) this.must(await this.sb.from("deal_custom_tasks").update(row).eq("id", c.id));
    else this.must(await this.sb.from("deal_custom_tasks").insert(row));
  },
  async deleteDealCustom(id) { this.must(await this.sb.from("deal_custom_tasks").delete().eq("id", id)); },
  async saveDealEvent(e) {
    const row = pick(e, DEAL_EVENT_FIELDS, { household_id: this.hid });
    if (row.created_by_name) row.created_by_name = String(row.created_by_name).slice(0, 20);
    if (e.id) this.must(await this.sb.from("deal_events").update(row).eq("id", e.id));
    else this.must(await this.sb.from("deal_events").insert({ ...row, created_by: state.user.id }));
  },
  async deleteDealEvent(id) { this.must(await this.sb.from("deal_events").delete().eq("id", id)); },

  /* 房屋资料 / 设备 / 季节任务（按房产） */
  async getHouseProfile(pid) {
    return this.must(await this.sb.from("house_profiles").select("*").eq("property_id", pid).maybeSingle());
  },
  async listHouseProfiles() { return this.must(await this.sb.from("house_profiles").select("*").eq("household_id", this.hid)); },
  async saveHouseProfile(p, pid) {
    const row = { property_id: pid, household_id: this.hid, region: p.region, house_type: p.house_type, year_built: p.year_built ?? null,
      features: p.features || [], exterior: p.exterior || [], roof: p.roof || null, flooring: p.flooring || [], updated_by: state.user.id };
    for (const k of INSURANCE_FIELDS) row[k] = p[k] ?? (k === "insured" ? false : null);
    row.emergency = p.emergency ?? null; row.hoa = p.hoa ?? null; row.ownership = p.ownership ?? null;   // jsonb：HOA（含费用拆分、出租规则、诉讼）、产权税务车位（迁移 038）
    let r = await this.sb.from("house_profiles").upsert(row, { onConflict: "property_id" });
    if (r.error && /ownership/i.test(r.error.message) && !row.ownership) { delete row.ownership; r = await this.sb.from("house_profiles").upsert(row, { onConflict: "property_id" }); }   // 还没执行迁移 038 且没填产权那块：照旧保存
    this.must(r);
  },
  async listAssets() {
    const [rows, fin] = await Promise.all([this.pageAll(() => this.sb.from("assets").select("*").eq("household_id", this.hid).order("name").order("id")), this.finRows("assets")]);
    return this.mergeFin("assets", rows, fin);
  },
  async saveAsset(a) {
    const row = pick(a, ASSET_FIELDS, { household_id: this.hid, updated_by: state.user.id });
    if (row.kind === "vehicle") row.property_id = null;   // 车辆挂在家庭上
    else if (!row.property_id) row.property_id = state.propertyId;
    // 召回（迁移 051）：调用方没带 recall 就不写这一列——改档案不会把召回状态冲掉，没执行迁移时也照常保存
    if (!("recall" in a) || (!a.id && !a.recall)) delete row.recall;
    const fin = this.splitFin("assets", row, a);   // 买价 / 更换估价 / 车辆卖出价进旁表（迁移 058）
    if (a.id) { await this.assetWrite([row], () => this.sb.from("assets").update(row).eq("id", a.id)); await this.writeFin("assets", a.id, fin); return a.id; }
    const id = (await this.assetWrite([row], () => this.sb.from("assets").insert(row).select("id").single())).id;
    await this.writeFin("assets", id, fin);
    return id;
  },
  async addAssets(list, pid) {
    const rows = list.map((a) => pick({ ...a, property_id: pid }, ASSET_FIELDS, { household_id: this.hid, updated_by: state.user.id }));
    rows.forEach((r) => { if (!r.recall) delete r.recall; });
    // 价格进旁表：有价格的行先在本地定好 id，主表写完再按 id 写旁表（生成设备的模板一般没有价格）
    const fins = rows.map((r, i) => { const f = this.splitFin("assets", r, list[i]); if (f && Object.values(f).some((v) => v != null)) { r.id = uid(); return [r.id, f]; } return null; }).filter(Boolean);
    if (fins.length) rows.forEach((r) => { r.id ||= uid(); });   // 一批插入的列要一致
    await this.assetWrite(rows, () => this.sb.from("assets").insert(rows));
    for (const [id, f] of fins) await this.writeFin("assets", id, f);
  },
  /** 还没执行迁移 051（assets.recall）：要清空召回就去掉这一列重试；要写召回则提示先执行迁移 */
  async assetWrite(rows, run) {
    let r = await run();
    if (r.error && /recall/i.test(r.error.message || "")) {
      if (rows.some((x) => x.recall)) throw new Error(t("还没执行数据库迁移 051（设备召回），先在 Supabase 里执行 supabase/migrations/051_asset_recall.sql"));
      rows.forEach((x) => delete x.recall);
      r = await run();
    }
    return this.must(r);
  },
  async deleteAsset(id) { this.must(await this.sb.from("assets").delete().eq("id", id)); },   // 保养记录随外键级联删除
  async listMaintLogs() {
    return this.pageAll(() => this.sb.from("maintenance_logs").select("*").eq("household_id", this.hid).order("done_on", { ascending: false }).order("id"));   // 分页读，超过 1000 条也不丢
  },
  async addMaintLog(l) {
    return this.must(await this.sb.from("maintenance_logs").insert({ ...l, household_id: this.hid, created_by: state.user.id }).select("id").single()).id;
  },
  async updateMaintLog(id, patch) { this.must(await this.sb.from("maintenance_logs").update(patch).eq("id", id)); },
  async deleteMaintLog(id) {
    const l = state.maintLogs.find((x) => x.id === id);
    this.must(await this.sb.from("maintenance_logs").delete().eq("id", id));
    if (l?.purchase_id) this.must(await this.sb.from("purchases").delete().eq("id", l.purchase_id));
  },
  async listSeasonal(sincePeriod) {
    return this.must(await this.sb.from("seasonal_tasks").select("*").eq("household_id", this.hid).gte("period", sincePeriod));
  },
  async setSeasonal(task_key, period, done, done_by_name, pid) {
    if (done) {
      const { error } = await this.sb.from("seasonal_tasks").insert({ household_id: this.hid, property_id: pid, task_key, period, done_by: state.user.id, done_by_name });
      if (error && error.code !== "23505") throw new Error(error.message);   // 23505 = 家人已经勾过
    } else this.must(await this.sb.from("seasonal_tasks").delete().eq("property_id", pid).eq("task_key", task_key).eq("period", period));
  },
  /** 自定义季节任务；迁移 019 还没执行时读不到表，不影响模板任务 */
  async listCustomSeasonal() {
    const r = await this.sb.from("custom_seasonal_tasks").select("*").eq("household_id", this.hid).order("created_at");
    if (r.error) { console.warn("[custom seasonal]", r.error.message); return []; }
    return r.data;
  },
  async saveCustomSeasonal(c) {
    const row = pick(c, CUSTOM_SEASONAL_FIELDS, { household_id: this.hid, updated_by: state.user.id });
    row.done_by = c.done_on ? state.user.id : null;
    if (c.id) this.must(await this.sb.from("custom_seasonal_tasks").update(row).eq("id", c.id));
    else this.must(await this.sb.from("custom_seasonal_tasks").insert(row));
  },
  async deleteCustomSeasonal(id) {
    this.must(await this.sb.from("custom_seasonal_tasks").delete().eq("id", id));
    this.must(await this.sb.from("seasonal_tasks").delete().eq("household_id", this.hid).eq("task_key", `c_${String(id).replace(/-/g, "")}`));
  },

  /* 家庭成员 / 孩子 / 宠物名册（迁移 029）：同一个家庭里“看起来一样”的名字由数据库唯一索引拦住 */
  async listPeople() { return this.must(await this.sb.from("household_people").select("*").eq("household_id", this.hid).order("created_at")); },
  async savePerson(p) {
    const row = { name: String(p.name).trim().slice(0, 40), kind: p.kind || "adult", birth: p.birth || null, member_user_id: p.member_user_id || null, household_id: this.hid };
    if (p.id) { const { error } = await this.sb.from("household_people").update(row).eq("id", p.id); if (error) throw new Error(personError(error)); return p.id; }
    const { data, error } = await this.sb.from("household_people").insert(row).select("id").single(); if (error) throw new Error(personError(error)); return data.id;
  },
  async deletePerson(id) { this.must(await this.sb.from("household_people").delete().eq("id", id)); },   // 账单里的 patient_id 自动置空，名字文字仍保留
  async mergePeople(fromId, toId) {
    this.must(await this.sb.from("medical_bills").update({ patient_id: toId }).eq("patient_id", fromId));
    this.must(await this.sb.from("medical_bills").update({ guarantor_id: toId }).eq("guarantor_id", fromId));
    this.must(await this.sb.from("household_people").delete().eq("id", fromId));
  },

  /* 医疗账单：RLS 按 visibility 过滤（私密的只有创建人和家主读得到）；还没执行迁移 027 时表不存在，由调用方当作空 */
  async listMedicalBills() { return this.pageAll(() => this.sb.from("medical_bills").select("*").eq("household_id", this.hid).order("service_date", { ascending: false, nullsFirst: false }).order("id")); },   // 分页读，超过 1000 张也不丢
  async saveMedicalBill(b) {
    const row = pick(b, MED_FIELDS, { household_id: this.hid });
    if (b.id) { this.must(await this.sb.from("medical_bills").update(row).eq("id", b.id)); return b.id; }
    return this.must(await this.sb.from("medical_bills").insert(row).select("id").single()).id;
  },
  async deleteMedicalBill(id) { this.must(await this.sb.from("medical_bills").delete().eq("id", id)); },   // 付款级联删除
  async listMedicalPayments() { return this.pageAll(() => this.sb.from("medical_payments").select("*").eq("household_id", this.hid).order("paid_on", { ascending: false }).order("id")); },
  async addMedicalPayment(p) { return this.must(await this.sb.from("medical_payments").insert({ ...p, household_id: this.hid, paid_by: state.user.id }).select("id").single()).id; },
  async updateMedicalPayment(id, patch) { this.must(await this.sb.from("medical_payments").update(patch).eq("id", id)); },
  async deleteMedicalPayment(id) { this.must(await this.sb.from("medical_payments").delete().eq("id", id)); },
  /* 收入（迁移 042）：行级安全按「家主 / 已允许 / 自己记的」过滤；表不存在时由调用方当作空 */
  async listIncomeRecords() { return this.pageAll(() => this.sb.from("income_records").select("*").eq("household_id", this.hid).order("received_on", { ascending: false }).order("id"), 20000); },   // 分页：超过 1000 笔时最早的不会被截掉
  async saveIncomeRecord(r) {
    const row = pick(r, INCOME_FIELDS, { household_id: this.hid });
    if (r.id) { this.must(await this.sb.from("income_records").update(row).eq("id", r.id)); return r.id; }
    return this.must(await this.sb.from("income_records").insert(row).select("id").single()).id;
  },
  async addIncomeRecords(rows) {   // 银行导入：一批一起写
    for (let i = 0; i < rows.length; i += 200) this.must(await this.sb.from("income_records").insert(rows.slice(i, i + 200).map((r) => pick(r, INCOME_FIELDS, { household_id: this.hid }))));
  },
  async deleteIncomeRecord(id) { this.must(await this.sb.from("income_records").delete().eq("id", id)); },   // 还款记录级联删除
  async deleteIncomeByBatch(batch) { this.must(await this.sb.from("income_records").delete().eq("household_id", this.hid).eq("import_batch", batch)); },
  async renameIncomeSource(ids, name) { for (let i = 0; i < ids.length; i += 100) this.must(await this.sb.from("income_records").update({ source_name: name }).in("id", ids.slice(i, i + 100))); },
  async listIncomeRepayments() { return this.pageAll(() => this.sb.from("income_repayments").select("*").eq("household_id", this.hid).order("paid_on", { ascending: false }).order("id"), 5000); },
  async addIncomeRepayment(p) {
    const ins = (row) => this.sb.from("income_repayments").insert({ ...row, household_id: this.hid, paid_by: state.user.id }).select("id").single();
    let r = await ins(p);
    if (r.error && /purchase_id/i.test(r.error.message) && p.purchase_id) { const { purchase_id, ...rest } = p; r = await ins(rest); }   // 迁移 043 还没执行：不记关联，花费照记
    return this.must(r).id;
  },
  async deleteIncomeRepayment(id) { this.must(await this.sb.from("income_repayments").delete().eq("id", id)); },
  /* 信用卡（迁移 032） */
  async listCards() { return this.must(await this.sb.from("cards").select("*").eq("household_id", this.hid).order("created_at")); },
  async saveCard(c) {
    const row = pick(c, CARD_FIELDS, { household_id: this.hid }); row.rewards ||= {}; row.credits ||= []; row.annual_fee ??= 0; row.network ||= "other"; row.kind ||= "credit"; row.active ??= true; row.autopay ??= false;
    if (c.id) { this.must(await this.sb.from("cards").update(row).eq("id", c.id)); return c.id; }
    return this.must(await this.sb.from("cards").insert(row).select("id").single()).id;
  },
  async deleteCard(id) { this.must(await this.sb.from("cards").delete().eq("id", id)); },

  /* 账单 */
  async listBills() { return this.must(await this.sb.from("bills").select("*").eq("household_id", this.hid).order("next_due_on")); },
  async saveBill(b) {
    const row = pick(b, BILL_FIELDS, { household_id: this.hid, updated_by: state.user.id });
    row.due_dates ||= []; row.reminder_days ||= [7, 1];
    const run = async () => (b.id ? this.sb.from("bills").update(row).eq("id", b.id) : this.sb.from("bills").insert(row));
    let r = await run();
    if (r.error && /pay_card_id/i.test(r.error.message) && !row.pay_card_id) { delete row.pay_card_id; r = await run(); }   // 还没执行迁移 036 且没选付款账户：照旧保存
    this.must(r);
  },
  async addBills(list) {
    const rows = list.map((b) => { const r = pick(b, BILL_FIELDS, { household_id: this.hid, updated_by: state.user.id }); r.due_dates ||= []; r.reminder_days ||= [7, 1]; return r; });
    this.must(await this.sb.from("bills").insert(rows));
  },
  async deleteBill(id) { this.must(await this.sb.from("bills").delete().eq("id", id)); },   // 缴费记录级联删除；关联的 purchases 保留
  async listBillPayments() {
    const since = new Date(Date.now() - 400 * DAY).toISOString().slice(0, 10);
    return this.pageAll(() => this.sb.from("bill_payments").select("*").eq("household_id", this.hid).gte("paid_on", since).order("paid_on", { ascending: false }).order("id"));   // 分页：近 400 天超过 1000 笔时最早的不会被截掉
  },
  async addBillPayment(p) {
    return this.must(await this.sb.from("bill_payments").insert({ ...p, household_id: this.hid, paid_by: state.user.id }).select("id").single()).id;
  },
  async updateBillPayment(id, patch) { this.must(await this.sb.from("bill_payments").update(patch).eq("id", id)); },
  async updatePurchase(id, patch) { this.must(await this.sb.from("purchases").update(patch).eq("id", id)); },
  async deleteBillPayment(id) {
    // 内存里只有近 400 天的缴费；缴费记录列表能翻到更早的（服务器分页），那时到数据库里查它关联的花费，一起删
    const p = state.billPayments.find((x) => x.id === id) || this.must(await this.sb.from("bill_payments").select("purchase_id").eq("id", id).maybeSingle());
    this.must(await this.sb.from("bill_payments").delete().eq("id", id));
    if (p?.purchase_id) this.must(await this.sb.from("purchases").delete().eq("id", p.purchase_id));
  },
  /* 借贷（迁移 058）：两张小表，启动时整表读进内存（一个家庭几笔贷款，流水最多每笔几百条） */
  async listDebts() {
    const rows = await this.pageAll(() => this.sb.from("debt_accounts").select("*").eq("household_id", this.hid).order("created_at").order("id"));
    // 迁移 060 有没有执行：有行就看列在不在，没行试读一次那一列（失败 = 没执行，写库时去掉 060 的列）
    if (rows.length) schemaFlags.debt060 = "first_payment_date" in rows[0];
    else { const r = await this.sb.from("debt_accounts").select("first_payment_date").limit(1); schemaFlags.debt060 = !r.error; }
    return rows;
  },
  async saveDebt(d) {
    const row = { ...debtRow(d), household_id: this.hid };
    if (d.id) { this.must(await this.sb.from("debt_accounts").update(row).eq("id", d.id)); return d.id; }
    return this.must(await this.sb.from("debt_accounts").insert(row).select("id").single()).id;
  },
  async deleteDebt(id) { this.must(await this.sb.from("debt_accounts").delete().eq("id", id)); },   // 流水级联删除；账单的 debt_id 置空；花费 / 收入不动
  async listDebtTxns() { return this.pageAll(() => this.sb.from("debt_transactions").select("*").eq("household_id", this.hid).order("txn_date", { ascending: false }).order("id")); },
  async upsertDebtTxns(rows) {
    const out = rows.map((r) => ({ ...debtTxnRow(r), id: r.id || uid(), household_id: this.hid }));
    for (let i = 0; i < out.length; i += 200) this.must(await this.sb.from("debt_transactions").upsert(out.slice(i, i + 200)));
    return out.map((r) => r.id);
  },
  async deleteDebtTxns(ids) { for (let i = 0; i < ids.length; i += 100) this.must(await this.sb.from("debt_transactions").delete().in("id", ids.slice(i, i + 100))); },
  async linkBillDebt(billId, debtId) { this.must(await this.sb.from("bills").update({ debt_id: debtId || null }).eq("id", billId)); },
  /* 净资产（迁移 059）：三张小表（每个账户每次更新一行、每处资产每次估值一行、每月一行快照），只有财务权限读得到，启动时整表读进内存 */
  async listBalances() { return this.pageAll(() => this.sb.from("account_balances").select("*").eq("household_id", this.hid).order("as_of", { ascending: false }).order("id")); },
  async saveBalance(r) {
    const row = { ...balanceRow(r), household_id: this.hid };
    if (r.id) { this.must(await this.sb.from("account_balances").update(row).eq("id", r.id)); return r.id; }
    return this.must(await this.sb.from("account_balances").upsert(row, { onConflict: "card_id,as_of" }).select("id").single()).id;   // 同一账户同一天：改那一行
  },
  async deleteBalance(id) { this.must(await this.sb.from("account_balances").delete().eq("id", id)); },
  async listValuations() { return this.pageAll(() => this.sb.from("asset_valuations").select("*").eq("household_id", this.hid).order("as_of", { ascending: false }).order("id")); },
  /** 同一资产同一天的唯一索引是部分索引（property_id / asset_id 各一个），PostgREST 的 onConflict 用不上：调用方先在内存里找同一天的行，带 id 来改 */
  async saveValuation(r) {
    const row = { ...valuationRow(r), household_id: this.hid };
    if (r.id) { this.must(await this.sb.from("asset_valuations").update(row).eq("id", r.id)); return r.id; }
    return this.must(await this.sb.from("asset_valuations").insert(row).select("id").single()).id;
  },
  async deleteValuation(id) { this.must(await this.sb.from("asset_valuations").delete().eq("id", id)); },
  async listSnapshots() { return this.pageAll(() => this.sb.from("net_worth_snapshots").select("*").eq("household_id", this.hid).order("month").order("id")); },
  /** auto：本月还没有才新建（ignoreDuplicates），已有的只在它也是 auto 时更新——别的设备刚手动保存的不会被盖掉；否则直接覆盖这个月 */
  async saveSnapshot(s, { auto = false } = {}) {
    const row = { ...snapshotRow(s), household_id: this.hid }, T = () => this.sb.from("net_worth_snapshots");
    if (!auto) { this.must(await T().upsert(row, { onConflict: "household_id,month" })); return; }
    const made = this.must(await T().upsert(row, { onConflict: "household_id,month", ignoreDuplicates: true }).select("id")) || [];
    if (!made.length) this.must(await T().update(row).eq("household_id", this.hid).eq("month", row.month).eq("source", "auto"));
  },
  async deleteSnapshot(id) { this.must(await this.sb.from("net_worth_snapshots").delete().eq("id", id)); },
  /** 一条账单的全部缴费（内存里只有近 400 天的）：重新拆分历史还款用；一笔贷款最多几百期 */
  async listPaymentsOfBill(billId) { return this.pageAll(() => this.sb.from("bill_payments").select("*").eq("household_id", this.hid).eq("bill_id", billId).order("paid_on").order("id")); },
  /** 批量写花费（upsert）：同一批的行要有相同的列；已有行只改给出的列 */
  async upsertPurchases(rows) {
    const out = rows.map((r) => ({ ...r, id: r.id || uid(), household_id: this.hid }));
    for (let i = 0; i < out.length; i += 200) this.must(await this.sb.from("purchases").upsert(out.slice(i, i + 200)));
  },
  async deletePurchases(ids) { for (let i = 0; i < ids.length; i += 100) this.must(await this.sb.from("purchases").delete().in("id", ids.slice(i, i + 100))); },

  async addItems(list) {
    const rows = list.map((it) => {
      const r = pick(it, ITEM_FIELDS, { household_id: this.hid, updated_by: state.user.id });
      if (r.asset_ids == null) delete r.asset_ids;   // 这一列非空、有默认值：没有关联设备时不传，让数据库填 []（传 null 会违反约束）
      return r;
    });
    this.must(await this.sb.from("items").insert(rows));
  },
  /** 一段时间的花费（现在只有银行导入「找回早期批次」按批次的日期窗口用；统计 / 对比都读聚合）。必须分页：原来一次 .limit(10000) 实际只回 1000 行（max-rows），又是按日期从旧到新排——
   *  「近 5 年」超过 1000 笔时只读到最早的 1000 笔，最近几年全被截掉，所以比「近 3 年」的花费还少 */
  async listPurchasesRange(from, to) {
    return (await this.pageAll(() => this.sb.from("purchases").select("*").eq("household_id", this.hid)
      .gte("purchased_at", from).lt("purchased_at", to).order("purchased_at").order("id"))).map((x) => ({ ...x, category: canonCat(x.category) }));
  },
  async deletePurchase(id) { this.must(await this.sb.from("purchases").delete().eq("id", id)); },
  /** 最早一笔花费的年份（花费页时间范围下拉的往年选项到这一年为止） */
  async firstPurchaseYear() { const r = this.must(await this.sb.from("purchases").select("purchased_at").eq("household_id", this.hid).order("purchased_at").limit(1)); return r?.[0] ? +String(r[0].purchased_at).slice(0, 4) : null; },
  /** 找回批次：所有带批次标记的花费（只取几列，不限日期），按 import_batch 重建丢失的批次记录 */
  async listTaggedPurchases() {
    return this.pageAll(() => this.sb.from("purchases").select("id,import_batch,purchased_at,amount,card_id,created_at").eq("household_id", this.hid).not("import_batch", "is", null).order("purchased_at").order("id"));
  },
  /** 银行导入「查看 / 修改」：这一批的全部花费（不限近 400 天）——按 import_batch 列，旧批次按 id 列表 */
  async listPurchasesByBatch(batch, ids = []) {
    const q = async (f) => (await this.pageAll(() => f(this.sb.from("purchases").select("*").eq("household_id", this.hid)).order("purchased_at").order("id"))).map((x) => ({ ...x, category: canonCat(x.category) }));   // 分页：一批超过 1000 笔也读全
    const byTag = await q((b) => b.eq("import_batch", batch)).catch((e) => { if (/import_batch/i.test(e.message || "")) return []; throw e; });   // 没跑迁移 034 就只靠 id 列表
    if (!ids.length) return byTag;
    const have = new Set(byTag.map((x) => x.id)), rest = ids.filter((i) => !have.has(i)), more = [];
    for (let i = 0; i < rest.length; i += 200) more.push(...await q((b) => b.in("id", rest.slice(i, i + 200))));
    return [...byTag, ...more];
  },
  /** 「最近导入」的实时笔数 / 合计：只读当前一页这几批的两列（import_batch, amount），不读全部花费；收入没权限 / 没迁移时 inc = null */
  async batchTotals(ids) {
    if (!ids.length) return { spend: {}, inc: {} };
    const rows = (table) => this.pageAll(() => this.sb.from(table).select("import_batch,amount").eq("household_id", this.hid).in("import_batch", ids).order("import_batch"));
    const [sp, inc] = await Promise.all([rows("purchases"), rows("income_records").catch(() => null)]);
    return batchTotalsOf(ids, sp, inc || [], !inc);
  },
  /** 撤销一批银行导入（迁移 034 的 import_batch 列）；返回删掉几笔 */
  async deletePurchasesByBatch(batch) { const r = this.must(await this.sb.from("purchases").delete().eq("household_id", this.hid).eq("import_batch", batch).select("id")); return (r || []).length; },
  async saveItem(it) {
    const row = { household_id: this.hid, updated_by: state.user.id };
    ITEM_FIELDS.forEach((k) => { row[k] = it[k]; });
    if (it.id) {
      const old = state.items.find((x) => x.id === it.id);
      this.must(await this.sb.from("items").update(row).eq("id", it.id));
      const d = old ? Math.round((num(it.quantity) - num(old.quantity)) * 100) / 100 : 0;
      if (d) this.must(await this.sb.from("stock_logs").insert({ household_id: this.hid, item_id: it.id, delta: d, reason: "adjust", created_by: state.user.id }));
      return it.id;
    }
    return this.must(await this.sb.from("items").insert(row).select("id").single()).id;   // 新建：返回 id（添加物品时接着记花费）
  },
  async deleteItem(id) { this.must(await this.sb.from("items").delete().eq("id", id)); },
  /** 「请确认分类」（迁移 064 的 items.cat_check）：没错 → 清标记 */
  async clearCatCheck(ids) { if (ids.length) this.must(await this.sb.from("items").update({ cat_check: false }).eq("household_id", this.hid).in("id", ids)); },
  /** 「请确认分类」：改成候选分类；连着的花费、采购清单（还是旧分类的）跟着换 */
  async recatItem(id, cat, sub) {
    const old = state.items.find((x) => x.id === id)?.category;
    this.must(await this.sb.from("items").update({ category: cat, subcategory: sub, cat_check: false, updated_by: state.user.id }).eq("id", id));
    if (old && old !== cat) for (const table of ["purchases", "shopping_list"]) this.must(await this.sb.from(table).update({ category: cat }).eq("household_id", this.hid).eq("item_id", id).eq("category", old));
  },
  async adjust(id, delta, reason) {
    this.must(await this.sb.rpc("adjust_stock", { p_item_id: id, p_delta: delta, p_reason: reason }));
    if (reason === "restock" && state.items.find((x) => x.id === id)?.alert_mute_until) await this.sb.from("items").update({ alert_mute_until: null }).eq("id", id);   // 又买了：恢复提醒（还没执行迁移 030 时这行不会有值，也不会走到这里）
  },
  /** 不再提醒 / 暂停提醒（见本机版说明）；没执行迁移 030 时会提示先执行 */
  async setItemMute(id, until) {
    const r = await this.sb.from("items").update({ alert_mute_until: until || null }).eq("id", id);
    if (r.error && /alert_mute_until/.test(r.error.message || "")) throw new Error("数据库还没升级：请先执行 migrations/030_item_alert_mute.sql");
    this.must(r);
  },
  async listShopping() { return this.must(await this.sb.from("shopping_list").select("*").eq("household_id", this.hid).order("created_at")); },
  async saveShopping(row) {
    if (row.id) {
      const { id, ...patch } = row;
      this.must(await this.sb.from("shopping_list").update(patch).eq("id", id));
    } else {
      const { error } = await this.sb.from("shopping_list").insert({ ...row, household_id: this.hid });
      if (error && error.code !== "23505") throw new Error(error.message); // 23505 = 家人已加过，忽略
    }
  },
  async deleteShopping(id) { this.must(await this.sb.from("shopping_list").delete().eq("id", id)); },
  async clearBought() { this.must(await this.sb.from("shopping_list").delete().eq("household_id", this.hid).eq("status", "bought")); },
  async listMembers() {   // 只列正式成员（迁移 049 起新加入的人先是「待批准」）；没执行 049 时没有 status 列，退回原来的读法
    const base = "user_id,display_name,role,joined_at";
    const q = (cols, active) => { let b = this.sb.from("household_members").select(cols).eq("household_id", this.hid); if (active) b = b.eq("status", "active"); return b.order("joined_at"); };
    let r = await q(`${base},can_finance,${PROFILE_COLS}`, true);   // 电话 / 邮箱 / 地址：成员资料（迁移 052）
    state.noProfileCols = !!(r.error && /phone|email|address|can_finance|status|does not exist|schema cache/i.test(r.error.message));
    if (state.noProfileCols) r = await q(`${base},can_finance`, true);   // 没执行 052：资料字段在界面上灰掉，提示先执行迁移
    if (r.error && /can_finance/i.test(r.error.message)) r = await q(base, true);   // can_finance：财务权限（迁移 050）；没执行 050：普通成员按「没有财务权限」处理
    if (r.error && /status/i.test(r.error.message)) r = await q(base, false);
    return this.must(r);
  },
  /** 家主给某位成员开 / 关财务权限（security definer RPC，迁移 050） */
  async setMemberFinance(userId, on) {
    const r = await this.sb.rpc("set_member_finance", { p_household: this.hid, p_user: userId, p_on: !!on });
    if (r.error && /set_member_finance|could not find the function|schema cache/i.test(r.error.message || "")) throw new Error(t("数据库还没升级：请先执行 migrations/050_finance_access.sql"));
    this.must(r);
  },
  /** 等家主批准的加入申请（读不到 = 没有） */
  async listPendingMembers() {
    const r = await this.sb.from("household_members").select("user_id,display_name,joined_at").eq("household_id", this.hid).eq("status", "pending").order("joined_at");
    return r.error ? [] : r.data;
  },
  async approveMember(userId) { this.must(await this.sb.rpc("approve_member", { p_household: this.hid, p_user: userId })); },
  async closeInvite() { this.must(await this.sb.rpc("close_invite", { p_household: this.hid })); },
  /* 家主管理（security definer RPC，见 migrations/004、005） */
  async setMemberRole(userId, role) { this.must(await this.sb.rpc("set_member_role", { p_household: this.hid, p_user: userId, p_role: role })); },
  async removeMember(userId) { this.must(await this.sb.rpc("remove_member", { p_household: this.hid, p_user: userId })); },
  async setMemberName(userId, name) { this.must(await this.sb.rpc("set_member_name", { p_household: this.hid, p_user: userId, p_name: name })); },
  /** 改成员资料（称呼 + 电话 / 邮箱 / 地址）：本人改自己的、家主改任何人的，数据库函数里校验（迁移 052）。没执行 052 时只改称呼（迁移 005 的 set_member_name） */
  async setMemberProfile(userId, p) {
    if (state.noProfileCols) return this.setMemberName(userId, p.display_name);
    const r = await this.sb.rpc("set_member_profile", { p_household: this.hid, p_user: userId, p_name: p.display_name, p_phone: p.phone || null, p_email: p.email || null, p_address: p.address || null });
    if (r.error && /set_member_profile|could not find the function|schema cache/i.test(r.error.message || "")) throw new Error(t("数据库还没升级：请先执行 migrations/052_member_profile.sql"));
    this.must(r);
  },
  subscribe(onChange) {
    if (this.channel) this.sb.removeChannel(this.channel);
    const f = { schema: "public", filter: `household_id=eq.${this.hid}` };
    let ch = this.sb.channel(`hh-${this.hid}`);
    for (const table of ["items", "shopping_list", "purchases", "house_profiles", "assets", "maintenance_logs", "seasonal_tasks", "properties", "bills", "bill_payments", "medical_bills", "medical_payments", "income_records", "income_repayments", "income_access", "debt_accounts", "debt_transactions", "account_balances", "asset_valuations", "net_worth_snapshots", "property_deals", "deal_task_done", "deal_task_overrides", "deal_custom_tasks", "deal_events", "custom_seasonal_tasks", "custom_categories", "custom_locations", "custom_terms"]) {
      ch = ch.on("postgres_changes", { event: "*", table, ...f }, onChange);
    }
    this.channel = ch.subscribe();
  },
};

export let Store = DemoStore;
// ES 模块导入的绑定是只读的，切换数据层统一走这里
export function setStore(s) { Store = s; }
