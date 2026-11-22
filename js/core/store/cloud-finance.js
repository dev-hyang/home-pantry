/* 云端模式（Supabase）的数据读写：收入记录、预算、借贷、账户余额、净资产。 */
import { INCOME_FIELDS, balanceRow, debtRow, debtTxnRow, incomeTotal, pick, schemaFlags, snapshotRow, valuationRow } from "../store.js";
import { state } from "../state.js";

export const cloudFinance = {
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
  /* 收入（迁移 042）：行级安全按「家主 / 已允许 / 自己记的」过滤；表不存在时由调用方当作空 */
  async listIncomeRecords() { return this.pageAll(() => this.sb.from("income_records").select("*").eq("household_id", this.hid).order("received_on", { ascending: false }).order("id"), 20000); },   // 分页：超过 1000 笔时最早的不会被截掉
  async saveIncomeRecord(r) {
    const row = pick(r, INCOME_FIELDS, { household_id: this.hid });
    if (r.gift_donor !== undefined) row.gift_donor = r.gift_donor;   // 迁移 103；只有赠与记录才送这一列（没执行 103 时别的收入照常能存）
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
  async linkBillDebt(billId, debtId) { this.must(await this.sb.from("bills_recurring").update({ debt_id: debtId || null }).eq("id", billId)); },
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
};
