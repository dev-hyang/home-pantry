/* 演示模式（数据存在浏览器里）的数据读写：常去的商店和特价。 */
import { uid } from "../util.js";

export const demoShops = {
  /* 常去的商店 + 特价（迁移 067）：演示模式存在本地 */
  async listShops() { return (this.db.shops || []).map((x) => ({ ...x })); },
  async listDealRuns() { return (this.db.dealRuns || []).slice().sort((a, b) => String(b.run_at).localeCompare(String(a.run_at))).slice(0, 200).map((x) => ({ ...x })); },
  async addDealRun(r) { this.db.dealRuns ||= []; const row = { source: "manual", status: "ok", stores: [], ...r, id: uid(), run_at: r.run_at || new Date().toISOString() }; this.db.dealRuns.push(row); this.persist(); return { ...row }; },
  async saveShop(r) {
    this.db.shops ||= []; const now = new Date().toISOString();
    if (r.id) { const i = this.db.shops.findIndex((x) => x.id === r.id); if (i >= 0) this.db.shops[i] = { ...this.db.shops[i], ...r, updated_at: now }; this.persist(); return { ...this.db.shops[i] }; }
    const row = { refresh: "weekly", refresh_dow: 3, archived: false, category: "groceries", ...r, id: uid(), created_at: now, updated_at: now }; this.db.shops.push(row); this.persist(); return { ...row };
  },
  async deleteShop(id) { this.db.shops = (this.db.shops || []).filter((x) => x.id !== id); this.db.shopDeals = (this.db.shopDeals || []).filter((x) => x.shop_id !== id); this.persist(); },
  async listShopDeals(since) { return (this.db.shopDeals || []).filter((d) => !d.valid_to || d.valid_to >= since).map((x) => ({ ...x })); },
  async addShopDeals(rows) { this.db.shopDeals ||= []; const now = new Date().toISOString(); const out = rows.map((r) => ({ source: "photo", ...r, id: uid(), created_at: now })); this.db.shopDeals.push(...out); this.persist(); return out.map((x) => ({ ...x })); },
  async saveShopDeal(r) { const i = (this.db.shopDeals || []).findIndex((x) => x.id === r.id); if (i >= 0) this.db.shopDeals[i] = { ...this.db.shopDeals[i], ...r }; this.persist(); },
  async deleteShopDeals(ids) { const set = new Set(ids); this.db.shopDeals = (this.db.shopDeals || []).filter((x) => !set.has(x.id)); this.persist(); },
  async purgeShopDeals(before) { this.db.shopDeals = (this.db.shopDeals || []).filter((x) => !x.valid_to || x.valid_to >= before); this.persist(); },
};
