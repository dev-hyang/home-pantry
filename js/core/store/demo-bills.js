/* 演示模式（数据存在浏览器里）的数据读写：账单、缴费、医疗账单、特别摊派、卡。 */
import { ASSESS_FIELDS, ASSESS_ITEM_FIELDS } from "../store.js";
import { uid } from "../util.js";

export const demoBills = {
  /* 特别摊派（迁移 080）：摊派 → 付款计划（一期一行）；删账单 / 摊派连带删下一级，删缴费记录只是把对应期放回「没缴」 */
  async listAssess() { const c = (k) => (this.db[k] || []).map((x) => ({ ...x })); return { as: c("bills_recurring_assessments"), items: c("bills_recurring_assessment_items") }; },
  saveAssess(a) { return this.savePlanRow("bills_recurring_assessments", ASSESS_FIELDS, a); },
  saveAssessItem(i) { return this.savePlanRow("bills_recurring_assessment_items", ASSESS_ITEM_FIELDS, i); },
  async deleteAssess(id) { this.db.bills_recurring_assessment_items = (this.db.bills_recurring_assessment_items || []).filter((x) => x.assessment_id !== id); this.db.bills_recurring_assessments = (this.db.bills_recurring_assessments || []).filter((x) => x.id !== id); this.persist(); },
  async deleteAssessItem(id) { this.db.bills_recurring_assessment_items = (this.db.bills_recurring_assessment_items || []).filter((x) => x.id !== id); this.persist(); },
  async setItemsPayment(ids, paymentId) { for (const x of this.db.bills_recurring_assessment_items || []) if (ids.includes(x.id)) x.payment_id = paymentId; this.persist(); },
  /* 医疗账单（事件型账单）：账单 + 付款；演示模式没有“私密”之分，全是自己的 */
  async listMedicalBills() { return this.db.bills_one_time.map((x) => ({ ...x })); },
  async saveMedicalBill(b) {
    const now = new Date().toISOString();
    if (b.id) {
      const i = this.db.bills_one_time.findIndex((x) => x.id === b.id); if (i < 0) throw new Error("账单不存在");
      this.db.bills_one_time[i] = { ...this.db.bills_one_time[i], ...b, updated_at: now }; this.persist(); return b.id;
    }
    const id = uid(); this.db.bills_one_time.push({ ...b, id, created_at: now, updated_at: now }); this.persist(); return id;
  },
  async deleteMedicalBill(id) {
    this.db.bills_one_time = this.db.bills_one_time.filter((x) => x.id !== id);
    this.db.bills_one_time_payments = this.db.bills_one_time_payments.filter((p) => p.bill_id !== id); this.persist();
  },
  async listMedicalPayments() { return this.db.bills_one_time_payments.map((x) => ({ ...x })); },
  async addMedicalPayment(p) { const id = uid(); this.db.bills_one_time_payments.push({ ...p, id, created_at: new Date().toISOString() }); this.persist(); return id; },
  async updateMedicalPayment(id, patch) { const i = this.db.bills_one_time_payments.findIndex((x) => x.id === id); if (i >= 0) { this.db.bills_one_time_payments[i] = { ...this.db.bills_one_time_payments[i], ...patch }; this.persist(); } },
  async deleteMedicalPayment(id) { this.db.bills_one_time_payments = this.db.bills_one_time_payments.filter((x) => x.id !== id); this.persist(); },
  /* 信用卡（用卡）：卡档案 + 返现画像 */
  async listCards() { return (this.db.cards || []).map((x) => ({ ...x })); },
  async saveCard(c) {
    const now = new Date().toISOString(); this.db.cards ||= [];
    if (c.id) { const i = this.db.cards.findIndex((x) => x.id === c.id); if (i < 0) throw new Error("卡不存在"); this.db.cards[i] = { ...this.db.cards[i], ...c, updated_at: now }; this.persist(); return c.id; }
    const id = uid(); this.db.cards.push({ ...c, id, created_at: now, updated_at: now }); this.persist(); return id;
  },
  async deleteCard(id) { this.db.cards = (this.db.cards || []).filter((x) => x.id !== id); this.db.account_balances = (this.db.account_balances || []).filter((x) => x.card_id !== id); this.persist(); },
  /* 账单 */
  async listBills() { return this.db.bills_recurring.map((x) => ({ ...x })); },
  async saveBill(b) {
    const now = new Date().toISOString();
    if (b.id) {
      const i = this.db.bills_recurring.findIndex((x) => x.id === b.id);
      if (i < 0) throw new Error("账单不存在");
      this.db.bills_recurring[i] = { ...this.db.bills_recurring[i], ...b, updated_at: now };
    } else { const id = uid(); this.db.bills_recurring.push({ ...b, id, created_at: now, updated_at: now }); this.persist(); return id; }
    this.persist();
    return b.id;
  },
  async addBills(list) {
    const now = new Date().toISOString();
    for (const b of list) this.db.bills_recurring.push({ ...b, id: uid(), created_at: now, updated_at: now });
    this.persist();
  },
  async deleteBill(id) {
    this.db.bills_recurring = this.db.bills_recurring.filter((x) => x.id !== id);
    this.db.bills_recurring_payments = this.db.bills_recurring_payments.filter((p) => p.bill_id !== id);
    const gone = new Set((this.db.bills_recurring_assessments || []).filter((a) => a.bill_id === id).map((a) => a.id));
    this.db.bills_recurring_assessments = (this.db.bills_recurring_assessments || []).filter((a) => a.bill_id !== id);
    this.db.bills_recurring_assessment_items = (this.db.bills_recurring_assessment_items || []).filter((x) => !gone.has(x.assessment_id));
    this.persist();
  },
  async listBillPayments() { return this.db.bills_recurring_payments.map((x) => ({ ...x })); },
  async addBillPayment(p) { const id = uid(); this.db.bills_recurring_payments.push({ ...p, id, created_at: new Date().toISOString() }); this.persist(); return id; },
  async updateBillPayment(id, patch) { const i = this.db.bills_recurring_payments.findIndex((x) => x.id === id); if (i >= 0) { this.db.bills_recurring_payments[i] = { ...this.db.bills_recurring_payments[i], ...patch }; this.persist(); } },
  async deleteBillPayment(id) {
    const p = this.db.bills_recurring_payments.find((x) => x.id === id);
    if (p?.purchase_id) this.db.purchases = this.db.purchases.filter((x) => x.id !== p.purchase_id);
    this.db.bills_recurring_payments = this.db.bills_recurring_payments.filter((x) => x.id !== id);
    this.db.debt_transactions = (this.db.debt_transactions || []).filter((x) => x.bill_payment_id !== id);   // 和数据库的级联删除一致
    for (const x of this.db.bills_recurring_assessment_items || []) if (x.payment_id === id) x.payment_id = null;   // 摊派里对应的期放回「没缴」（on delete set null）
    this.persist();
  },
};
