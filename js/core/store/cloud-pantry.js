/* 云端模式（Supabase）的数据读写：库存、分类、位置、购物车、自定义名称翻译。 */
import { CATEGORY_FIELDS, ITEM_FIELDS, LOCATION_FIELDS, TERM_FIELDS, pick } from "../store.js";
import { DAY, STATS_LOG_DAYS, num } from "../util.js";
import { state } from "../state.js";

export const cloudPantry = {
  async listItems() { return this.pageAll(() => this.sb.from("items").select("*").eq("household_id", this.hid).order("name").order("id")); },
  async listCategories() { return this.must(await this.sb.from("custom_categories").select("*").eq("household_id", this.hid).order("sort").order("created_at")); },
  async saveCategory(c) {
    const row = pick(c, CATEGORY_FIELDS, { household_id: this.hid, updated_by: state.user.id });
    if (c.parent !== undefined) row.parent = c.parent || null;   // 自建分类挂在哪个二级花费分类下（迁移 055）；不传就不动这一列
    if (c.id) this.must(await this.sb.from("custom_categories").update(row).eq("id", c.id));
    else this.must(await this.sb.from("custom_categories").insert(row));
  },
  async deleteCategory(id) { this.must(await this.sb.from("custom_categories").delete().eq("id", id)); },
  async listItemAliases() { return this.must(await this.sb.from("item_aliases").select("id,item_id,alias").eq("household_id", this.hid)); },
  async setItemAliases(itemId, list) {
    this.must(await this.sb.from("item_aliases").delete().eq("household_id", this.hid).eq("item_id", itemId));
    if (list.length) this.must(await this.sb.from("item_aliases").upsert(list.map((alias) => ({ household_id: this.hid, item_id: itemId, alias })), { onConflict: "household_id,alias_key", ignoreDuplicates: true }));
  },
  async addItemAlias(itemId, alias) { this.must(await this.sb.from("item_aliases").upsert({ household_id: this.hid, item_id: itemId, alias }, { onConflict: "household_id,alias_key", ignoreDuplicates: true })); },
  async listLocations() { return this.must(await this.sb.from("custom_locations").select("*").eq("household_id", this.hid).order("sort").order("created_at")); },
  async saveLocation(c) {
    const row = pick(c, LOCATION_FIELDS, { household_id: this.hid, updated_by: state.user.id });
    if (c.id) this.must(await this.sb.from("custom_locations").update(row).eq("id", c.id));
    else this.must(await this.sb.from("custom_locations").insert(row));
  },
  async deleteLocation(id) { this.must(await this.sb.from("custom_locations").delete().eq("id", id)); },
  async renameLocation(oldName, newName) {
    this.must(await this.sb.from("items").update({ location: newName }).eq("household_id", this.hid).eq("location", oldName));
    this.must(await this.sb.from("assets").update({ location: newName }).eq("household_id", this.hid).eq("location", oldName));
  },
  async listTerms() { return this.must(await this.sb.from("custom_terms").select("*").eq("household_id", this.hid)); },
  async saveTerm(r) { this.must(await this.sb.from("custom_terms").upsert(pick(r, TERM_FIELDS, { household_id: this.hid, updated_by: state.user.id }), { onConflict: "household_id,term" })); },
  async deleteTerm(term) { this.must(await this.sb.from("custom_terms").delete().eq("household_id", this.hid).eq("term", term)); },
  /** 我的 → 家里的数字：某个时间以来的库存日志（近一年，带记录人）；只在打开那一页时读，按 1000 行一页 */
  async listLogsSince(iso) {
    return this.pageAll(() => this.sb.from("stock_logs").select("id,item_id,delta,reason,created_by,created_at").eq("household_id", this.hid).gte("created_at", iso).order("created_at").order("id"), 20000);
  },
  async listLogs() {
    const since = new Date(Date.now() - STATS_LOG_DAYS * DAY).toISOString();
    return this.pageAll(() => this.sb.from("stock_logs").select("id,item_id,delta,reason,created_at")
      .eq("household_id", this.hid).gte("created_at", since).order("created_at").order("id"));   // 分页：.limit(10000) 实际只回 1000 行，90 天里超过的最新记录会被截掉
  },
  async addItems(list) {
    const rows = list.map((it) => {
      const r = pick(it, ITEM_FIELDS, { household_id: this.hid, updated_by: state.user.id });
      if (r.asset_ids == null) delete r.asset_ids;   // 这一列非空、有默认值：没有关联设备时不传，让数据库填 []（传 null 会违反约束）
      return r;
    });
    this.must(await this.sb.from("items").insert(rows));
  },
  async saveItem(it) {
    const row = { household_id: this.hid, updated_by: state.user.id };
    ITEM_FIELDS.forEach((k) => { row[k] = it[k]; });
    if (it.id) {
      const old = state.items.find((x) => x.id === it.id);
      this.must(await this.sb.from("items").update(row).eq("id", it.id));
      const d = old ? Math.round((num(it.quantity) - num(old.quantity)) * 100) / 100 : 0;
      if (d) this.must(await this.sb.from("stock_logs").insert({ household_id: this.hid, item_id: it.id, delta: d, reason: "adjust", created_by: state.user.id }));
      return it.id;
    }
    return this.must(await this.sb.from("items").insert(row).select("id").single()).id;   // 新建：返回 id（添加物品时接着记花费）
  },
  async deleteItem(id) { this.must(await this.sb.from("items").delete().eq("id", id)); },
  /** 「请确认分类」（迁移 064 的 items.cat_check）：没错 → 清标记 */
  async clearCatCheck(ids) { if (ids.length) this.must(await this.sb.from("items").update({ cat_check: false }).eq("household_id", this.hid).in("id", ids)); },
  /** 「请确认分类」：改成候选分类；连着的花费、购物车（还是旧分类的）跟着换 */
  async recatItem(id, cat, sub) {
    const old = state.items.find((x) => x.id === id)?.category;
    this.must(await this.sb.from("items").update({ category: cat, subcategory: sub, cat_check: false, updated_by: state.user.id }).eq("id", id));
    if (old && old !== cat) for (const table of ["purchases", "shopping_list"]) this.must(await this.sb.from(table).update({ category: cat }).eq("household_id", this.hid).eq("item_id", id).eq("category", old));
  },
  async adjust(id, delta, reason) {
    this.must(await this.sb.rpc("adjust_stock", { p_item_id: id, p_delta: delta, p_reason: reason }));
  },
  /** 不再提醒 / 暂停提醒（见本机版说明）；没执行迁移 030 时会提示先执行 */
  async setItemMute(id, until) {
    const r = await this.sb.from("items").update({ alert_mute_until: until || null }).eq("id", id);
    if (r.error && /alert_mute_until/.test(r.error.message || "")) throw new Error("数据库还没升级：请先执行 migrations/030_item_alert_mute.sql");
    this.must(r);
  },
  /** 库存行的提醒小弹框：只改少货线和提前几天（存储单位）；mute = 同时设成「不再提醒」 */
  async setItemRemind(id, min, lead, mute) {
    const r = await this.sb.from("items").update({ min_quantity: min, lead_days: lead, alert_mute_until: mute || null, updated_by: state.user.id }).eq("id", id);
    if (r.error && /alert_mute_until/.test(r.error.message || "")) throw new Error("数据库还没升级：请先执行 migrations/030_item_alert_mute.sql");
    this.must(r);
  },
  async listShopping() { return this.must(await this.sb.from("shopping_list").select("*").eq("household_id", this.hid).order("created_at")); },
  async saveShopping(row) {
    if (row.id) {
      const { id, ...patch } = row;
      this.must(await this.sb.from("shopping_list").update(patch).eq("id", id));
    } else {
      const { error } = await this.sb.from("shopping_list").insert({ ...row, household_id: this.hid });
      if (error && error.code !== "23505") throw new Error(error.message); // 23505 = 家人已加过，忽略
    }
  },
  async deleteShopping(id) { this.must(await this.sb.from("shopping_list").delete().eq("id", id)); },
  async clearBought() { this.must(await this.sb.from("shopping_list").delete().eq("household_id", this.hid).eq("status", "bought")); },
};
