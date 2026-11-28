/* 演示模式（数据存在浏览器里）的数据读写：库存、分类、位置、购物车、自定义名称翻译。 */
import { DAY, STATS_LOG_DAYS, num, uid } from "../util.js";
import { normName } from "../item-match.js";

export const demoPantry = {
  undoReady() { return true; },
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
  /* 物品别名（迁移 066）：同一样东西的其他叫法 */
  async listItemAliases() { return (this.db.item_aliases || []).map((x) => ({ ...x })); },
  async setItemAliases(itemId, list) {   // 这件物品的别名整组替换；别的物品已经用了的叫法跳过（一个叫法只对应一件）
    this.db.item_aliases = (this.db.item_aliases || []).filter((x) => x.item_id !== itemId);
    for (const alias of list) if (!this.db.item_aliases.some((x) => normName(x.alias) === normName(alias))) this.db.item_aliases.push({ id: uid(), item_id: itemId, alias, created_at: new Date().toISOString() });
    this.persist();
  },
  async addItemAlias(itemId, alias) { const l = this.db.item_aliases ||= []; if (!l.some((x) => normName(x.alias) === normName(alias))) { l.push({ id: uid(), item_id: itemId, alias, created_at: new Date().toISOString() }); this.persist(); } },
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
  /** 我的 → 家里的数字：某个时间以来的库存日志（近一年） */
  async listLogsSince(iso) { const since = new Date(iso).getTime(); return this.db.logs.filter((l) => new Date(l.created_at).getTime() >= since).map((l) => ({ ...l })); },
  async addItems(list) {
    const now = new Date().toISOString();
    for (const it of list) this.db.items.push({ ...it, id: uid(), created_at: now, updated_at: now });
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
      this.persist(); return it.id;
    }
    if (this.db.items.some((x) => normName(x.name) === normName(it.name))) throw new Error("duplicate key value violates unique constraint \"items_household_name_key_uniq\"");   // 和云端迁移 066 一样
    const id = uid(); this.db.items.push({ ...it, id, created_at: now, updated_at: now });
    this.persist(); return id;
  },
  /** 「请确认分类」：没错 → 清标记 */
  async clearCatCheck(ids) { const set = new Set(ids); for (const it of this.db.items) if (set.has(it.id)) it.cat_check = false; this.persist(); },
  /** 「请确认分类」：改成候选分类；连着的花费、购物车（还是旧分类的）跟着换 */
  async recatItem(id, cat, sub) {
    const it = this.db.items.find((x) => x.id === id); if (!it) throw new Error("物品不存在");
    const old = it.category; Object.assign(it, { category: cat, subcategory: sub, cat_check: false, updated_at: new Date().toISOString() });
    for (const r of [...this.db.purchases, ...this.db.shopping]) if (r.item_id === id && r.category === old) r.category = cat;
    this.persist();
  },
  async deleteItem(id) {
    this.db.items = this.db.items.filter((x) => x.id !== id);
    this.db.logs = this.db.logs.filter((l) => l.item_id !== id);
    this.db.shopping.forEach((s) => { if (s.item_id === id) s.item_id = null; });
    this.persist();
  },
  /** 撤销一次入库（和数据库的 undo_restock 同一套规则） */
  async undoRestock(logId, deduct, actual) {
    const l = this.db.logs.find((x) => String(x.id) === String(logId));
    if (!l || l.reason !== "restock" || l.voided_at) throw new Error("这条记录已经不能撤销");
    const it = this.db.items.find((x) => x.id === l.item_id); if (!it) throw new Error("物品不存在");
    const act = Math.max(0, num(actual)), ded = Math.min(Math.max(0, num(deduct)), l.delta - act, num(it.quantity)), now = new Date().toISOString();
    if (act < 0 || act > l.delta) throw new Error("实际入库数量不对");
    l.voided_at = now;
    if (ded > 0) { it.quantity = Math.round((num(it.quantity) - ded) * 100) / 100; it.updated_at = now; this.db.logs.push({ id: uid(), item_id: it.id, delta: -ded, reason: "adjust", created_at: now }); }
    if (act > 0) this.db.logs.push({ id: uid(), item_id: it.id, delta: act, reason: "restock", created_at: l.created_at, purchase_id: l.purchase_id || null });
    this.persist(); return { quantity: it.quantity, deducted: ded };
  },
  async adjust(id, delta, reason, purchaseId = null) {
    const it = this.db.items.find((x) => x.id === id);
    if (!it) throw new Error("物品不存在");
    const oldq = num(it.quantity), newq = Math.max(0, Math.round((oldq + delta) * 100) / 100);
    it.quantity = newq; it.updated_at = new Date().toISOString();
    if (newq !== oldq) this.db.logs.push({ id: uid(), item_id: id, delta: newq - oldq, reason, created_at: it.updated_at, ...(purchaseId ? { purchase_id: purchaseId } : {}) });
    this.persist();
  },
  /** 不再提醒 / 暂停提醒：until = 'YYYY-MM-DD'（到这天之前不提醒），'9999-12-31' = 一直不提醒，null = 恢复 */
  async setItemMute(id, until) { const it = this.db.items.find((x) => x.id === id); if (!it) throw new Error("物品不存在"); it.alert_mute_until = until || null; this.persist(); },
  async setItemAudience(id, list) { const it = this.db.items.find((x) => x.id === id); if (!it) throw new Error("物品不存在"); it.audience = list; this.persist?.(); },
  /** 采购方式 + 订阅周期（见云端版说明） */
  async setItemBuy(id, mode, every) { const it = this.db.items.find((x) => x.id === id); if (!it) throw new Error("物品不存在"); it.buy_mode = mode || null; it.subscribe_every_days = every || null; this.persist(); },
  /** 库存行的提醒小弹框：只改少货线和提前几天（存储单位）；mute = 同时设成「不再提醒」 */
  async setItemRemind(id, min, lead, mute) { const it = this.db.items.find((x) => x.id === id); if (!it) throw new Error("物品不存在"); it.min_quantity = min; it.lead_days = lead; it.alert_mute_until = mute || null; this.persist(); },
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
