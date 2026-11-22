/* 演示模式（数据存在浏览器里）的数据读写：收入记录、预算、借贷、账户余额、净资产。 */
import { INCOME_FIELDS, balanceRow, debtRow, debtTxnRow, demoSave, incomeTotal, pick, snapshotRow, valuationRow } from "../store.js";
import { t } from "../i18n.js";
import { uid } from "../util.js";

export const demoFinance = {
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
    for (const b of db.bills_recurring) if (b.debt_id === id) b.debt_id = null;
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
  async linkBillDebt(billId, debtId) { const b = this.db.bills_recurring.find((x) => x.id === billId); if (b) { b.debt_id = debtId || null; this.persist(); } },
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
};
