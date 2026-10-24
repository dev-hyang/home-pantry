import { state } from "./state.js";
import { $, DAY, STATS_LOG_DAYS, num, uid } from "./util.js";
import { t } from "./i18n.js";

/* ───────────── 数据层：本地演示 ───────────── */
export const DemoStore = {
  mode: "demo", key: "hmh-demo-v3", db: null,
  load() {
    try { this.db = JSON.parse(localStorage.getItem(this.key)); } catch { this.db = null; }
    if (!this.db || !Array.isArray(this.db.items)) this.db = seedDemo();
    const db = this.db;
    db.purchases ||= []; db.assets ||= []; db.maint_logs ||= []; db.seasonal ||= [];
    db.bills ||= []; db.bill_payments ||= []; db.medical_bills ||= []; db.medical_payments ||= []; db.people ||= [];
    // 多房产：没有房产的旧演示库补一条默认房产，并把房屋资料 / 设备 / 季节任务挂上去
    if (!Array.isArray(db.properties) || !db.properties.length) {
      db.properties = [{ id: uid(), name: t("我的家"), kind: "other", role: "owner_occupied", status: "owned", address: null, is_default: true, archived: false, notes: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }];
    }
    for (const p of db.properties) p.status ||= (p.role === "tenant" ? "renting" : "owned");
    db.deals ||= []; db.deal_done ||= []; db.deal_overrides ||= []; db.deal_custom ||= []; db.categories ||= []; db.custom_seasonal ||= [];
    const def = db.properties.find((p) => p.is_default) || db.properties[0];
    db.house_profiles ||= {};
    if (db.house_profile) { db.house_profiles[def.id] ||= db.house_profile; delete db.house_profile; }
    for (const a of db.assets) a.property_id ||= def.id;
    for (const s of db.seasonal) s.property_id ||= def.id;
    this.persist();
  },
  persist() { try { localStorage.setItem(this.key, JSON.stringify(this.db)); } catch { /* 隐私模式下可能不可写，忽略 */ } },
  reset() { this.db = seedDemo(); this.load(); },
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
  async listPurchases() { return this.db.purchases.map((x) => ({ ...x, category: canonCat(x.category) })); },
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
    db.properties = db.properties.filter((p) => p.id !== id);
    this.persist();
  },
  async endBills(entries) {
    for (const { id, ends_on } of entries) { const b = this.db.bills.find((x) => x.id === id); if (b) { b.ends_on = ends_on; b.updated_at = new Date().toISOString(); } }
    this.persist();
  },
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
    if (done && cur) { if (done_on) cur.done_on = done_on; }
    else {
      this.db.deal_done = list.filter((x) => x !== cur);
      if (done) this.db.deal_done.push({ id: uid(), deal_id, task_key, done_on: done_on || new Date().toISOString().slice(0, 10), done_by_name, created_at: new Date().toISOString() });
    }
    this.persist();
  },
  /** 模板任务的应完成日期调整与备注；日期和备注都空 = 删掉调整（回到推荐日期） */
  async listDealExtras() { return { overrides: (this.db.deal_overrides || []).map((x) => ({ ...x })), custom: (this.db.deal_custom || []).map((x) => ({ ...x })) }; },
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

  /* 信用卡（用卡）：卡档案 + 返现画像 */
  async listCards() { return (this.db.cards || []).map((x) => ({ ...x })); },
  async saveCard(c) {
    const now = new Date().toISOString(); this.db.cards ||= [];
    if (c.id) { const i = this.db.cards.findIndex((x) => x.id === c.id); if (i < 0) throw new Error("卡不存在"); this.db.cards[i] = { ...this.db.cards[i], ...c, updated_at: now }; this.persist(); return c.id; }
    const id = uid(); this.db.cards.push({ ...c, id, created_at: now, updated_at: now }); this.persist(); return id;
  },
  async deleteCard(id) { this.db.cards = (this.db.cards || []).filter((x) => x.id !== id); this.persist(); },

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
    this.persist();
  },

  async saveItem(it) {
    const now = new Date().toISOString();
    if (it.id) {
      const i = this.db.items.findIndex((x) => x.id === it.id);
      if (i < 0) throw new Error("物品不存在");
      const d = Math.round((num(it.quantity) - num(this.db.items[i].quantity)) * 100) / 100;
      if (d) this.db.logs.push({ id: uid(), item_id: it.id, delta: d, reason: "adjust", created_at: now });
      this.db.items[i] = { ...this.db.items[i], ...it, updated_at: now };
    } else {
      this.db.items.push({ ...it, id: uid(), created_at: now, updated_at: now });
    }
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
  add("原味坚果", "dry", "零食坚果", "袋", 3, 1, "常温", 0.15, 60, 40);
  add("饮用水", "drink", "饮用水", "提", 2, 1, "储物间", 0.25, null, 30);
  add("抽纸", "daily", "纸品", "包", 5, 4, "储物间", 0.4, null, 4);
  add("卷纸", "daily", "纸品", "卷", 12, 6, "卫生间", 0.6, null, 2.5);
  add("洗洁精", "daily", "清洁用品", "瓶", 1, 0, "厨房柜", 0.03, null, 15);
  add("垃圾袋", "daily", "厨房耗材", "卷", 2, 1, "厨房柜", 0.07, null, 8);
  add("纸尿裤 NB码", "baby", "纸尿裤", "片", 18, 30, "储物间", 9, null, 1.5);
  add("婴儿湿巾", "baby", "湿巾", "包", 3, 2, "储物间", 0.3, null, 12);
  add("防溢乳垫", "baby", "哺乳用品", "片", 40, 20, "储物间", 6, null, 0.8);
  add("复合维生素", "health", "维生素营养", "片", 3, 0, "常温", 1, 200, 1.5);
  // 装备（耐用品）：只有数量和位置，没有消耗记录
  add("床单被罩四件套", "gear_home", "床上用品", "套", 3, 0, "衣柜", 0, null, 0);
  add("电热毯", "gear_home", "季节电器", "条", 1, 0, "衣柜", 0, null, 0);
  add("旅行婴儿床（Pack and Play）", "gear_travel", "旅行婴儿用品", "个", 1, 0, "地下室", 0, null, 0);
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
  "expected_life_years", "service_interval_months", "purchase_price", "replacement_cost_estimate", "owner", "notes", "vehicle"];
export const PROPERTY_FIELDS = ["name", "kind", "role", "address", "status", "acquired_on", "purchase_price", "sold_on", "sale_price", "archived", "notes"];
export const INSURANCE_FIELDS = ["insured", "insurance_provider", "insurance_policy", "insurance_from", "insurance_to", "insurance_coverage", "insurance_premium", "insurance_agent", "insurance_phone", "insurance_email", "hoa"];
export const MED_FIELDS = ["kind", "subkind", "provider", "patient", "patient_id", "guarantor", "guarantor_id", "bill_ref", "claim_ref", "insurer", "service_date", "bill_date", "due_on", "billed_amount", "insurance_paid", "adjustment", "patient_amount", "currency", "status", "hsa_eligible", "visibility", "notes"];
export const CARD_FIELDS = ["name", "issuer", "network", "last4", "holder_user_id", "kind", "expires_on", "opened_on", "annual_fee", "fee_month", "credit_limit", "statement_day", "due_day", "autopay", "bill_id", "catalog_id", "rewards", "bonus", "credits", "rules_as_of", "active", "notes"];
export const BILL_FIELDS = ["property_id", "name", "category", "direction", "payee", "account_last4", "login_hint", "pay_url", "pay_channel", "amount_type", "typical_amount", "currency",
  "frequency", "interval_months", "due_day", "due_dates", "next_due_on", "grace_days", "late_fee_note", "autopay", "autopay_method", "autopay_card_expires", "statement_channel",
  "reminder_days", "ends_on", "sub_kind", "trial_ends_on", "assigned_to", "essential", "active", "notes"];
export const CATEGORY_FIELDS = ["space", "key", "name", "icon", "color", "loc", "subs", "hidden", "sort"];
export const LOCATION_FIELDS = ["name", "grp", "replaces", "sort"];
export const TERM_FIELDS = ["term", "zh", "en", "hant"];
export const DEAL_FIELDS = ["property_id", "asset_id", "kind", "contract_on", "review_deadline", "financing_deadline", "closing_on", "price", "earnest_money", "attorney", "lender", "agent", "title_company", "inspector", "notes", "outcome", "closed_at"];
export const DEAL_CUSTOM_FIELDS = ["deal_id", "name", "stage", "priority", "due_on", "note", "done_on", "done_by_name"];
export const CUSTOM_SEASONAL_FIELDS = ["property_id", "name", "note", "months", "due_on", "done_on", "done_by_name"];
/** 一个人所有收入折合每月的合计（存在旧的 income_amount 列里，兼容旧版） */
const incomeTotal = (lines) => Math.round((lines || []).reduce((s, l) => s + (l.period === "year" ? num(l.amount) / 12 : num(l.amount)), 0) * 100) / 100;
/** 名字比较用的键：忽略大小写和多余空格（数据库的唯一索引同一个规则） */
export const personKey = (n) => String(n || "").trim().replace(/\s+/g, " ").toLowerCase();
const personError = (e) => (/household_people_name_idx|duplicate key/i.test(e.message || "") ? t("名册里已经有这个名字了（忽略大小写和空格）") : /household_people|does not exist|schema cache/i.test(e.message || "") ? t("还没执行数据库迁移 029（家庭成员名册），先在 Supabase 里执行 supabase/migrations/029_people.sql") : e.message);
const pick = (obj, fields, extra) => { const r = { ...extra }; fields.forEach((k) => { r[k] = obj[k] ?? null; }); return r; };

export const CloudStore = {
  mode: "cloud", sb: null, hid: null, channel: null,
  must({ data, error }) { if (error) throw new Error(error.message); return data; },
  async listItems() { return this.must(await this.sb.from("items").select("*").eq("household_id", this.hid).order("name")); },
  async listCategories() { return this.must(await this.sb.from("custom_categories").select("*").eq("household_id", this.hid).order("sort").order("created_at")); },
  async saveCategory(c) {
    const row = pick(c, CATEGORY_FIELDS, { household_id: this.hid, updated_by: state.user.id });
    if (c.id) this.must(await this.sb.from("custom_categories").update(row).eq("id", c.id));
    else this.must(await this.sb.from("custom_categories").insert(row));
  },
  async deleteCategory(id) { this.must(await this.sb.from("custom_categories").delete().eq("id", id)); },
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
  async listLogs() {
    const since = new Date(Date.now() - STATS_LOG_DAYS * DAY).toISOString();
    return this.must(await this.sb.from("stock_logs").select("item_id,delta,reason,created_at")
      .eq("household_id", this.hid).gte("created_at", since).order("created_at").limit(10000));
  },
  async listPurchases() {
    const since = new Date(Date.now() - 400 * DAY).toISOString();
    return this.must(await this.sb.from("purchases").select("*").eq("household_id", this.hid)
      .gte("purchased_at", since).order("purchased_at", { ascending: false }).limit(5000)).map((x) => ({ ...x, category: canonCat(x.category) }));   // 旧分类按别名表换成新的（迁移 035 跑过就没差别）
  },
  async addPurchase(p) { return this.must(await this.sb.from("purchases").insert({ ...p, household_id: this.hid }).select("id").single()).id; },

  /* 房产 */
  async listProperties() { return this.must(await this.sb.from("properties").select("*").eq("household_id", this.hid).order("created_at")); },
  async saveProperty(p) {
    const row = pick(p, PROPERTY_FIELDS, { household_id: this.hid, updated_by: state.user.id });
    if (row.archived == null) row.archived = false;
    if (!row.status) row.status = "owned";
    if (p.id) { this.must(await this.sb.from("properties").update(row).eq("id", p.id)); return { ...p, ...row }; }
    return this.must(await this.sb.from("properties").insert(row).select().single());   // 返回新行，房屋页新建后直接切过去
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
  async listDeals() { return this.must(await this.sb.from("property_deals").select("*").eq("household_id", this.hid).order("created_at", { ascending: false })); },
  async saveDeal(d) {
    const row = pick(d, DEAL_FIELDS, { household_id: this.hid, updated_by: state.user.id });
    if (d.id) this.must(await this.sb.from("property_deals").update(row).eq("id", d.id));
    else return this.must(await this.sb.from("property_deals").insert(row).select("id").single()).id;
    return d.id;
  },
  async listDealDone() { return this.must(await this.sb.from("deal_task_done").select("*").eq("household_id", this.hid)); },
  async setDealDone(deal_id, task_key, done, done_by_name, done_on) {
    if (done) {
      const { error } = await this.sb.from("deal_task_done").insert({ household_id: this.hid, deal_id, task_key, done_by: state.user.id, done_by_name, ...(done_on ? { done_on } : {}) });
      if (error && error.code !== "23505") throw new Error(error.message);
      if (error && done_on) this.must(await this.sb.from("deal_task_done").update({ done_on }).eq("deal_id", deal_id).eq("task_key", task_key));   // 已经勾过：只改实际完成日期
    } else this.must(await this.sb.from("deal_task_done").delete().eq("deal_id", deal_id).eq("task_key", task_key));
  },
  /** 迁移 017 还没执行时读不到这两张表：不影响交易页其余功能 */
  async listDealExtras() {
    const [o, c] = await Promise.all([
      this.sb.from("deal_task_overrides").select("*").eq("household_id", this.hid),
      this.sb.from("deal_custom_tasks").select("*").eq("household_id", this.hid).order("created_at")]);
    if (o.error || c.error) { console.warn("[deal extras]", (o.error || c.error).message); return { overrides: [], custom: [] }; }
    return { overrides: o.data, custom: c.data };
  },
  async saveDealOverride(deal_id, task_key, due_on, note) {
    if (!due_on && !note) return this.must(await this.sb.from("deal_task_overrides").delete().eq("deal_id", deal_id).eq("task_key", task_key));
    this.must(await this.sb.from("deal_task_overrides").upsert({ household_id: this.hid, deal_id, task_key, due_on: due_on || null, note: note || null, updated_by: state.user.id }, { onConflict: "deal_id,task_key" }));
  },
  async saveDealCustom(c) {
    const row = pick(c, DEAL_CUSTOM_FIELDS, { household_id: this.hid, updated_by: state.user.id });
    row.done_by = c.done_on ? state.user.id : null;
    if (c.id) this.must(await this.sb.from("deal_custom_tasks").update(row).eq("id", c.id));
    else this.must(await this.sb.from("deal_custom_tasks").insert(row));
  },
  async deleteDealCustom(id) { this.must(await this.sb.from("deal_custom_tasks").delete().eq("id", id)); },

  /* 房屋资料 / 设备 / 季节任务（按房产） */
  async getHouseProfile(pid) {
    return this.must(await this.sb.from("house_profiles").select("*").eq("property_id", pid).maybeSingle());
  },
  async listHouseProfiles() { return this.must(await this.sb.from("house_profiles").select("*").eq("household_id", this.hid)); },
  async saveHouseProfile(p, pid) {
    const row = { property_id: pid, household_id: this.hid, region: p.region, house_type: p.house_type, year_built: p.year_built ?? null,
      features: p.features || [], exterior: p.exterior || [], roof: p.roof || null, flooring: p.flooring || [], updated_by: state.user.id };
    for (const k of INSURANCE_FIELDS) row[k] = p[k] ?? (k === "insured" ? false : null);
    row.emergency = p.emergency ?? null;
    this.must(await this.sb.from("house_profiles").upsert(row, { onConflict: "property_id" }));
  },
  async listAssets() { return this.must(await this.sb.from("assets").select("*").eq("household_id", this.hid).order("name")); },
  async saveAsset(a) {
    const row = pick(a, ASSET_FIELDS, { household_id: this.hid, updated_by: state.user.id });
    if (row.kind === "vehicle") row.property_id = null;   // 车辆挂在家庭上
    else if (!row.property_id) row.property_id = state.propertyId;
    if (a.id) { this.must(await this.sb.from("assets").update(row).eq("id", a.id)); return a.id; }
    return this.must(await this.sb.from("assets").insert(row).select("id").single()).id;
  },
  async addAssets(list, pid) {
    const rows = list.map((a) => pick({ ...a, property_id: pid }, ASSET_FIELDS, { household_id: this.hid, updated_by: state.user.id }));
    this.must(await this.sb.from("assets").insert(rows));
  },
  async deleteAsset(id) { this.must(await this.sb.from("assets").delete().eq("id", id)); },   // 保养记录随外键级联删除
  async listMaintLogs() {
    return this.must(await this.sb.from("maintenance_logs").select("*").eq("household_id", this.hid).order("done_on", { ascending: false }).limit(5000));
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
  async listMedicalBills() { return this.must(await this.sb.from("medical_bills").select("*").eq("household_id", this.hid).order("service_date", { ascending: false, nullsFirst: false }).limit(2000)); },
  async saveMedicalBill(b) {
    const row = pick(b, MED_FIELDS, { household_id: this.hid });
    if (b.id) { this.must(await this.sb.from("medical_bills").update(row).eq("id", b.id)); return b.id; }
    return this.must(await this.sb.from("medical_bills").insert(row).select("id").single()).id;
  },
  async deleteMedicalBill(id) { this.must(await this.sb.from("medical_bills").delete().eq("id", id)); },   // 付款级联删除
  async listMedicalPayments() { return this.must(await this.sb.from("medical_payments").select("*").eq("household_id", this.hid).order("paid_on", { ascending: false }).limit(5000)); },
  async addMedicalPayment(p) { return this.must(await this.sb.from("medical_payments").insert({ ...p, household_id: this.hid, paid_by: state.user.id }).select("id").single()).id; },
  async updateMedicalPayment(id, patch) { this.must(await this.sb.from("medical_payments").update(patch).eq("id", id)); },
  async deleteMedicalPayment(id) { this.must(await this.sb.from("medical_payments").delete().eq("id", id)); },
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
    if (b.id) this.must(await this.sb.from("bills").update(row).eq("id", b.id));
    else this.must(await this.sb.from("bills").insert(row));
  },
  async addBills(list) {
    const rows = list.map((b) => { const r = pick(b, BILL_FIELDS, { household_id: this.hid, updated_by: state.user.id }); r.due_dates ||= []; r.reminder_days ||= [7, 1]; return r; });
    this.must(await this.sb.from("bills").insert(rows));
  },
  async deleteBill(id) { this.must(await this.sb.from("bills").delete().eq("id", id)); },   // 缴费记录级联删除；关联的 purchases 保留
  async listBillPayments() {
    const since = new Date(Date.now() - 400 * DAY).toISOString().slice(0, 10);
    return this.must(await this.sb.from("bill_payments").select("*").eq("household_id", this.hid).gte("paid_on", since).order("paid_on", { ascending: false }).limit(5000));
  },
  async addBillPayment(p) {
    return this.must(await this.sb.from("bill_payments").insert({ ...p, household_id: this.hid, paid_by: state.user.id }).select("id").single()).id;
  },
  async updateBillPayment(id, patch) { this.must(await this.sb.from("bill_payments").update(patch).eq("id", id)); },
  async updatePurchase(id, patch) { this.must(await this.sb.from("purchases").update(patch).eq("id", id)); },
  async deleteBillPayment(id) {
    const p = state.billPayments.find((x) => x.id === id);
    this.must(await this.sb.from("bill_payments").delete().eq("id", id));
    if (p?.purchase_id) this.must(await this.sb.from("purchases").delete().eq("id", p.purchase_id));
  },

  async addItems(list) {
    const rows = list.map((it) => {
      const r = pick(it, ITEM_FIELDS, { household_id: this.hid, updated_by: state.user.id });
      if (r.asset_ids == null) delete r.asset_ids;   // 这一列非空、有默认值：没有关联设备时不传，让数据库填 []（传 null 会违反约束）
      return r;
    });
    this.must(await this.sb.from("items").insert(rows));
  },
  async listPurchasesRange(from, to) {
    return this.must(await this.sb.from("purchases").select("*").eq("household_id", this.hid)
      .gte("purchased_at", from).lt("purchased_at", to).order("purchased_at").limit(10000)).map((x) => ({ ...x, category: canonCat(x.category) }));
  },
  async deletePurchase(id) { this.must(await this.sb.from("purchases").delete().eq("id", id)); },
  /** 最早一笔花费的年份（花费页时间范围下拉的往年选项到这一年为止） */
  async firstPurchaseYear() { const r = this.must(await this.sb.from("purchases").select("purchased_at").eq("household_id", this.hid).order("purchased_at").limit(1)); return r?.[0] ? +String(r[0].purchased_at).slice(0, 4) : null; },
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
    } else this.must(await this.sb.from("items").insert(row));
  },
  async deleteItem(id) { this.must(await this.sb.from("items").delete().eq("id", id)); },
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
  async listMembers() {
    return this.must(await this.sb.from("household_members").select("user_id,display_name,role,joined_at").eq("household_id", this.hid).order("joined_at"));
  },
  /* 家主管理（security definer RPC，见 migrations/004、005） */
  async setMemberRole(userId, role) { this.must(await this.sb.rpc("set_member_role", { p_household: this.hid, p_user: userId, p_role: role })); },
  async removeMember(userId) { this.must(await this.sb.rpc("remove_member", { p_household: this.hid, p_user: userId })); },
  async setMemberName(userId, name) { this.must(await this.sb.rpc("set_member_name", { p_household: this.hid, p_user: userId, p_name: name })); },
  subscribe(onChange) {
    if (this.channel) this.sb.removeChannel(this.channel);
    const f = { schema: "public", filter: `household_id=eq.${this.hid}` };
    let ch = this.sb.channel(`hh-${this.hid}`);
    for (const table of ["items", "shopping_list", "purchases", "house_profiles", "assets", "maintenance_logs", "seasonal_tasks", "properties", "bills", "bill_payments", "medical_bills", "medical_payments", "property_deals", "deal_task_done", "deal_task_overrides", "deal_custom_tasks", "custom_seasonal_tasks", "custom_categories", "custom_locations", "custom_terms"]) {
      ch = ch.on("postgres_changes", { event: "*", table, ...f }, onChange);
    }
    this.channel = ch.subscribe();
  },
};

export let Store = DemoStore;
// ES 模块导入的绑定是只读的，切换数据层统一走这里
export function setStore(s) { Store = s; }
