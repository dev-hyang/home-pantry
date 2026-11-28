/* 云端模式（Supabase）的数据读写：花费、收入 / 花费聚合、收款方、卡用量。 */
import { batchTotalsOf } from "../store.js";
import { uid } from "../util.js";

export const cloudSpend = {
  async listPage(kind, f, after, limit) { return this.must(await this.sb.rpc(`${kind}_page`, { p_household: this.hid, p_f: f, p_after: after || null, p_limit: limit })) || []; },
  async listStats(kind, f, facets = false) { return this.must(await this.sb.rpc(`${kind}_stats`, { p_household: this.hid, p_f: f, p_facets: !!facets })) || {}; },
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
  /** 这些导入指纹（迁移 109）哪些已经在花费 / 收入里：返回 Map(指纹 → 记录 id)；还没执行迁移 = 空 */
  async importKeysExist(keys) {
    const out = new Map();
    for (let i = 0; i < keys.length; i += 100) {
      const part = keys.slice(i, i + 100);
      for (const table of ["purchases", "purchases_superseded", "income_records"]) {   // 被小票替换的整笔也算「已导入过」，重新导入同一份对账单不会又加回来
        const r = await this.sb.from(table).select("id,import_key").eq("household_id", this.hid).in("import_key", part);
        if (r.error && table === "purchases_superseded") continue;   // 还没执行迁移 114
        if (r.error) { if (/import_key/i.test(r.error.message)) return out; throw new Error(r.error.message); }
        for (const x of r.data) out.set(x.import_key, x.id);
      }
    }
    return out;
  },
  async addPurchase(p) { return this.must(await this.sb.from("purchases").insert({ ...p, household_id: this.hid }).select("id").single()).id; },
  async updatePurchase(id, patch) { this.must(await this.sb.from("purchases").update(patch).eq("id", id)); },
  /** 一条账单的全部缴费（内存里只有近 400 天的）：重新拆分历史还款用；一笔贷款最多几百期 */
  async listPaymentsOfBill(billId) { return this.pageAll(() => this.sb.from("bills_recurring_payments").select("*").eq("household_id", this.hid).eq("bill_id", billId).order("paid_on").order("id")); },
  /** 批量写花费（upsert）：同一批的行要有相同的列；已有行只改给出的列 */
  async upsertPurchases(rows) {
    const out = rows.map((r) => ({ ...r, id: r.id || uid(), household_id: this.hid }));
    for (let i = 0; i < out.length; i += 200) this.must(await this.sb.from("purchases").upsert(out.slice(i, i + 200)));
  },
  async deletePurchases(ids) { for (let i = 0; i < ids.length; i += 100) this.must(await this.sb.from("purchases").delete().in("id", ids.slice(i, i + 100))); },
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
    const [sp, inc, sup] = await Promise.all([rows("purchases"), rows("income_records").catch(() => null), this.supersededOfBatches(ids)]);
    const r = batchTotalsOf(ids, [...sp, ...sup], inc || [], !inc);   // 被小票替换的整笔也算在这一批里：对账单的笔数 / 合计和导入时一样，才能核对
    r.sup = batchTotalsOf(ids, sup, [], true).spend;   // 其中已被小票替换的：{ 批次: { n, sum } }
    return r;
  },
  /** 撤销一批银行导入（迁移 034 的 import_batch 列）；返回删掉几笔 */
  async deletePurchasesByBatch(batch) { await this.deleteSupersededByBatch(batch); const r = this.must(await this.sb.from("purchases").delete().eq("household_id", this.hid).eq("import_batch", batch).select("id")); return (r || []).length; },
};
