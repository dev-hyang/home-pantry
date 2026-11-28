/* 演示模式（数据存在浏览器里）的数据读写：花费、收入 / 花费聚合、收款方、卡用量。 */
import { batchTotalsOf } from "../store.js";
import { cardSpend, cardTotals, incRollup, itemPurchaseStats, ledgerRange, ledgerRollup, localPage, localStats, spendFeed, spendRollup, spendSuggest } from "../list-query.js";
import { uid } from "../util.js";

export const demoSpend = {
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
  async listPurchasesRange(from, to) {
    return this.db.purchases.filter((p) => p.purchased_at >= from && p.purchased_at < to)
      .sort((a, b) => a.purchased_at.localeCompare(b.purchased_at)).map((x) => ({ ...x, category: canonCat(x.category) }));
  },
  async importKeysExist(keys) {
    const want = new Set(keys), out = new Map();
    for (const x of [...this.db.purchases, ...(this.db.purchases_superseded || []), ...this.db.income_records]) if (x.import_key && want.has(x.import_key)) out.set(x.import_key, x.id);
    return out;
  },
  async addPurchase(p) { const id = uid(); this.db.purchases.push({ ...p, id, created_at: new Date().toISOString() }); this.persist(); return id; },
  async deletePurchase(id) { this.db.purchases = this.db.purchases.filter((x) => x.id !== id); this.persist(); },
  async firstPurchaseYear() { const d = this.db.purchases.map((x) => x.purchased_at).sort()[0]; return d ? +String(d).slice(0, 4) : null; },
  async listTaggedPurchases() { return this.db.purchases.filter((x) => x.import_batch).map((x) => ({ id: x.id, import_batch: x.import_batch, purchased_at: x.purchased_at, amount: x.amount, card_id: x.card_id || null, created_at: x.created_at })); },
  async listPurchasesByBatch(batch, ids = []) { const set = new Set(ids); return this.db.purchases.filter((x) => x.import_batch === batch || set.has(x.id)).map((x) => ({ ...x, category: canonCat(x.category) })); },
  /** 「最近导入」的实时笔数 / 合计：只算这几批（当前一页） */
  async batchTotals(ids) {
    const sup = (this.db.purchases_superseded || []).filter((s) => ids.includes(s.import_batch)).map((s) => ({ import_batch: s.import_batch, amount: s.amount }));
    const r = batchTotalsOf(ids, [...this.db.purchases, ...sup], this.db.income_records || []); r.sup = batchTotalsOf(ids, sup, [], true).spend; return r;
  },
  async deletePurchasesByBatch(batch) { await this.deleteSupersededByBatch(batch); const n = this.db.purchases.filter((x) => x.import_batch === batch).length; this.db.purchases = this.db.purchases.filter((x) => x.import_batch !== batch); this.persist(); return n; },
  async updatePurchase(id, patch) { const i = this.db.purchases.findIndex((x) => x.id === id); if (i >= 0) { this.db.purchases[i] = { ...this.db.purchases[i], ...patch }; this.persist(); } },
  async listPaymentsOfBill(billId) { return this.db.bills_recurring_payments.filter((p) => p.bill_id === billId).map((x) => ({ ...x })); },
  /** 批量写花费：带 id 的已有行只改给出的字段，没有的新建（还款拆分用） */
  async upsertPurchases(rows) {
    for (const r of rows) { const i = this.db.purchases.findIndex((x) => x.id === r.id); if (i >= 0) this.db.purchases[i] = { ...this.db.purchases[i], ...r }; else this.db.purchases.push({ created_at: new Date().toISOString(), ...r, id: r.id || uid() }); }
    this.persist();
  },
  async deletePurchases(ids) { const set = new Set(ids); this.db.purchases = this.db.purchases.filter((x) => !set.has(x.id)); this.persist(); },
};
