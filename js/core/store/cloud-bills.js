/* 云端模式（Supabase）的数据读写：账单、缴费、医疗账单、特别摊派、卡。 */
import { ASSESS_FIELDS, ASSESS_ITEM_FIELDS, BILL_FIELDS, CARD_FIELDS, MED_FIELDS, pick } from "../store.js";
import { DAY } from "../util.js";
import { state } from "../state.js";

export const cloudBills = {
  /* 特别摊派（迁移 080）：还没执行迁移时读不到，按没有摊派处理 */
  async listAssess() {
    const q = (t) => this.sb.from(t).select("*").eq("household_id", this.hid).order("created_at");
    const [a, i] = await Promise.all([q("bills_recurring_assessments"), q("bills_recurring_assessment_items")]);
    if (a.error || i.error) { console.warn("[assess]", (a.error || i.error).message); return { as: [], items: [] }; }
    return { as: a.data, items: i.data };
  },
  saveAssess(a) { return this.savePlanRow("bills_recurring_assessments", ASSESS_FIELDS, a); },
  saveAssessItem(i) { return this.savePlanRow("bills_recurring_assessment_items", ASSESS_ITEM_FIELDS, i); },
  async deleteAssess(id) { this.must(await this.sb.from("bills_recurring_assessments").delete().eq("id", id)); },
  async deleteAssessItem(id) { this.must(await this.sb.from("bills_recurring_assessment_items").delete().eq("id", id)); },
  async setItemsPayment(ids, paymentId) { if (ids.length) this.must(await this.sb.from("bills_recurring_assessment_items").update({ payment_id: paymentId }).in("id", ids)); },
  /* 医疗账单：RLS 按 visibility 过滤（私密的只有创建人和家主读得到）；还没执行迁移 027 时表不存在，由调用方当作空 */
  async listMedicalBills() { return this.pageAll(() => this.sb.from("bills_one_time").select("*").eq("household_id", this.hid).order("service_date", { ascending: false, nullsFirst: false }).order("id")); },   // 分页读，超过 1000 张也不丢
  async saveMedicalBill(b) {
    const row = pick(b, MED_FIELDS, { household_id: this.hid });
    const run = () => (b.id ? this.sb.from("bills_one_time").update(row).eq("id", b.id) : this.sb.from("bills_one_time").insert(row).select("id").single());
    let r = await run();
    if (r.error && /asset_id/i.test(r.error.message) && !row.asset_id) { delete row.asset_id; r = await run(); }   // 还没执行迁移 077 且没挂资产：照旧保存
    const out = this.must(r);
    return b.id || out.id;
  },
  async deleteMedicalBill(id) { this.must(await this.sb.from("bills_one_time").delete().eq("id", id)); },   // 付款级联删除
  async listMedicalPayments() { return this.pageAll(() => this.sb.from("bills_one_time_payments").select("*").eq("household_id", this.hid).order("paid_on", { ascending: false }).order("id")); },
  async addMedicalPayment(p) { return this.must(await this.sb.from("bills_one_time_payments").insert({ ...p, household_id: this.hid, paid_by: state.user.id }).select("id").single()).id; },
  async updateMedicalPayment(id, patch) { this.must(await this.sb.from("bills_one_time_payments").update(patch).eq("id", id)); },
  async deleteMedicalPayment(id) { this.must(await this.sb.from("bills_one_time_payments").delete().eq("id", id)); },
  /* 信用卡（迁移 032） */
  async listCards() { return this.must(await this.sb.from("cards").select("*").eq("household_id", this.hid).order("created_at")); },
  async saveCard(c) {
    const row = pick(c, CARD_FIELDS, { household_id: this.hid }); row.rewards ||= {}; row.credits ||= []; row.annual_fee ??= 0; row.network ||= "other"; row.kind ||= "credit"; row.active ??= true; row.autopay ??= false;
    if (c.id) { this.must(await this.sb.from("cards").update(row).eq("id", c.id)); return c.id; }
    return this.must(await this.sb.from("cards").insert(row).select("id").single()).id;
  },
  async deleteCard(id) { this.must(await this.sb.from("cards").delete().eq("id", id)); },
  /* 账单 */
  async listBills() { return this.must(await this.sb.from("bills_recurring").select("*").eq("household_id", this.hid).order("next_due_on")); },
  async saveBill(b) {
    const row = pick(b, BILL_FIELDS, { household_id: this.hid, updated_by: state.user.id });
    row.due_dates ||= []; row.reminder_days ||= [7, 1];
    const run = async () => (b.id ? this.sb.from("bills_recurring").update(row).eq("id", b.id) : this.sb.from("bills_recurring").insert(row).select("id").single());
    let r = await run();
    if (r.error && /pay_card_id/i.test(r.error.message) && !row.pay_card_id) { delete row.pay_card_id; r = await run(); }   // 还没执行迁移 036 且没选付款账户：照旧保存
    if (r.error && /asset_id/i.test(r.error.message) && !row.asset_id) { delete row.asset_id; r = await run(); }   // 还没执行迁移 076 且没挂资产：照旧保存
    const out = this.must(r);
    return b.id || out?.id;   // 新建返回新账单的 id（向导 / AI 创建完直接进详情页要用）；更新照旧
  },
  async addBills(list) {
    const rows = list.map((b) => { const r = pick(b, BILL_FIELDS, { household_id: this.hid, updated_by: state.user.id }); r.due_dates ||= []; r.reminder_days ||= [7, 1]; return r; });
    this.must(await this.sb.from("bills_recurring").insert(rows));
  },
  async deleteBill(id) { this.must(await this.sb.from("bills_recurring").delete().eq("id", id)); },   // 缴费记录级联删除；关联的 purchases 保留
  async listBillPayments() {
    const since = new Date(Date.now() - 400 * DAY).toISOString().slice(0, 10);
    return this.pageAll(() => this.sb.from("bills_recurring_payments").select("*").eq("household_id", this.hid).gte("paid_on", since).order("paid_on", { ascending: false }).order("id"));   // 分页：近 400 天超过 1000 笔时最早的不会被截掉
  },
  async addBillPayment(p) {
    return this.must(await this.sb.from("bills_recurring_payments").insert({ ...p, household_id: this.hid, paid_by: state.user.id }).select("id").single()).id;
  },
  async updateBillPayment(id, patch) { this.must(await this.sb.from("bills_recurring_payments").update(patch).eq("id", id)); },
  async deleteBillPayment(id) {
    // 内存里只有近 400 天的缴费；缴费记录列表能翻到更早的（服务器分页），那时到数据库里查它关联的花费，一起删
    const p = state.billPayments.find((x) => x.id === id) || this.must(await this.sb.from("bills_recurring_payments").select("purchase_id").eq("id", id).maybeSingle());
    this.must(await this.sb.from("bills_recurring_payments").delete().eq("id", id));
    if (p?.purchase_id) this.must(await this.sb.from("purchases").delete().eq("id", p.purchase_id));
  },
};
