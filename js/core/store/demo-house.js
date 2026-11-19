/* 演示模式（数据存在浏览器里）的数据读写：房产、设备、保养、季节任务、交易、买卖计划、房屋资料。 */
import { PLAN_CAND_FIELDS, PLAN_FIELDS, PLAN_OFFER_FIELDS } from "../store.js";
import { state } from "../state.js";
import { uid } from "../util.js";

export const demoHouse = {
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
    for (const k of ["bills_recurring", "bills_one_time", "purchases", "debt_accounts"]) (db[k] || []).forEach((r) => { if (r.property_id === id) r.property_id = null; });   // 账单 / 花费 / 借贷只是不再关联房产，记录保留
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
    for (const { id, ends_on } of entries) { const b = this.db.bills_recurring.find((x) => x.id === id); if (b) { b.ends_on = ends_on; b.updated_at = new Date().toISOString(); } }
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
  /* 买卖计划（迁移 078）：计划 → 候选 → 出价记录；删上一级时连带删下一级 */
  async listPlans() { const c = (k) => (this.db[k] || []).map((x) => ({ ...x })); return { plans: c("deal_plans"), cands: c("plan_candidates"), offers: c("plan_offers") }; },
  async savePlanRow(table, fields, r) {
    const now = new Date().toISOString(); this.db[table] ||= [];
    const row = {}; fields.forEach((k) => { row[k] = r[k] ?? null; });
    if (r.id) { const i = this.db[table].findIndex((x) => x.id === r.id); if (i < 0) throw new Error("记录不存在"); this.db[table][i] = { ...this.db[table][i], ...row, updated_at: now }; this.persist(); return r.id; }
    const id = uid(); this.db[table].push({ ...row, id, created_at: now, updated_at: now }); this.persist(); return id;
  },
  savePlan(p) { return this.savePlanRow("deal_plans", PLAN_FIELDS, p); },
  savePlanCand(c) { return this.savePlanRow("plan_candidates", PLAN_CAND_FIELDS, c); },
  savePlanOffer(o) { return this.savePlanRow("plan_offers", PLAN_OFFER_FIELDS, o); },
  async deletePlan(id) {
    const cs = new Set((this.db.plan_candidates || []).filter((x) => x.plan_id === id).map((x) => x.id));
    this.db.plan_offers = (this.db.plan_offers || []).filter((x) => !cs.has(x.candidate_id));
    this.db.plan_candidates = (this.db.plan_candidates || []).filter((x) => x.plan_id !== id);
    this.db.deal_plans = (this.db.deal_plans || []).filter((x) => x.id !== id); this.persist();
  },
  async deletePlanCand(id) { this.db.plan_offers = (this.db.plan_offers || []).filter((x) => x.candidate_id !== id); this.db.plan_candidates = (this.db.plan_candidates || []).filter((x) => x.id !== id); this.persist(); },
  async deletePlanOffer(id) { this.db.plan_offers = (this.db.plan_offers || []).filter((x) => x.id !== id); this.persist(); },
  async deleteDealEvent(id) { this.db.deal_events = (this.db.deal_events || []).filter((x) => x.id !== id); this.persist(); },
  /** 删除一条交易记录（历史交易行的删除）：连同它的清单、时间线、自定义项；不动房产 / 车辆现在的状态，也不动已记入花费的款项 */
  async deleteDeal(id) {
    this.db.deals = (this.db.deals || []).filter((x) => x.id !== id);
    for (const k of ["deal_done", "deal_overrides", "deal_custom", "deal_events"]) this.db[k] = (this.db[k] || []).filter((x) => x.deal_id !== id);
    this.persist();
  },
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
};
