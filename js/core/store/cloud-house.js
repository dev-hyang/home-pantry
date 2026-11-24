/* 云端模式（Supabase）的数据读写：房产、设备、保养、季节任务、交易、买卖计划、房屋资料。 */
import { ASSET_FIELDS, CUSTOM_SEASONAL_FIELDS, DEAL_CUSTOM_FIELDS, DEAL_EVENT_FIELDS, DEAL_FIELDS, INSURANCE_FIELDS, PLAN_CAND_FIELDS, PLAN_FIELDS, PLAN_OFFER_FIELDS, PROPERTY_FIELDS, pick } from "../store.js";
import { state } from "../state.js";
import { uid } from "../util.js";

export const cloudHouse = {
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
  /** 删除房产：账单 / 花费 / 借贷的 property_id 由数据库置空（记录保留）；资料 / 设备 / 季节任务 / 交易级联删除 */
  async deleteProperty(id) {
    this.must(await this.sb.from("properties").delete().eq("id", id));
  },
  /** 批量给账单写结束日期（退出向导） */
  async endBills(entries) {
    for (const { id, ends_on } of entries) this.must(await this.sb.from("bills_recurring").update({ ends_on, updated_by: state.user.id }).eq("id", id));
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
    if (res.error && /financing/i.test(res.error.message) && "financing" in row) { const { financing, ...rest } = row; res = await run(rest); }   // 迁移 110 还没执行：不存付款方式，交易照常保存
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
  /* 买卖计划（迁移 078）：计划 → 候选 → 出价记录（删上一级由数据库级联删下一级）；还没执行迁移时读不到，计划页显示空 */
  async listPlans() {
    const q = (t) => this.sb.from(t).select("*").eq("household_id", this.hid).order("created_at");
    const [p, c, o] = await Promise.all([q("deal_plans"), q("plan_candidates"), q("plan_offers")]);
    if (p.error || c.error || o.error) { console.warn("[plans]", (p.error || c.error || o.error).message); return { plans: [], cands: [], offers: [] }; }
    return { plans: p.data, cands: c.data, offers: o.data };
  },
  async savePlanRow(table, fields, r) {
    const row = pick(r, fields, { household_id: this.hid });
    if (r.id) { this.must(await this.sb.from(table).update(row).eq("id", r.id)); return r.id; }
    return this.must(await this.sb.from(table).insert({ ...row, created_by: state.user.id }).select("id").single()).id;
  },
  savePlan(p) { return this.savePlanRow("deal_plans", PLAN_FIELDS, p); },
  savePlanCand(c) { return this.savePlanRow("plan_candidates", PLAN_CAND_FIELDS, c); },
  savePlanOffer(o) { return this.savePlanRow("plan_offers", PLAN_OFFER_FIELDS, o); },
  async deletePlan(id) { this.must(await this.sb.from("deal_plans").delete().eq("id", id)); },
  async deletePlanCand(id) { this.must(await this.sb.from("plan_candidates").delete().eq("id", id)); },
  async deletePlanOffer(id) { this.must(await this.sb.from("plan_offers").delete().eq("id", id)); },
  async deleteDealEvent(id) { this.must(await this.sb.from("deal_events").delete().eq("id", id)); },
  async deleteDeal(id) { this.must(await this.sb.from("property_deals").delete().eq("id", id)); },   // 子表（清单 / 覆盖 / 自定义 / 时间线 / 成交价旁表）都是 on delete cascade
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
};
