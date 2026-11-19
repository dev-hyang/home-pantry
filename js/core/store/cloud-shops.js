/* 云端模式（Supabase）的数据读写：常去的商店和特价。 */
import { SHOP_FIELDS, dealRow, pick } from "../store.js";

export const cloudShops = {
  /* 常去的商店 + 特价（迁移 067）。特价只读还没过期太久的（since = 今天往前几周），老的留在库里供以后查价 */
  async listShops() { return this.must(await this.sb.from("shops").select("*").eq("household_id", this.hid).order("name")); },
  /** 特价更新记录（迁移 068）：最近 200 次 */
  async listDealRuns() { return this.must(await this.sb.from("shop_deal_runs").select("*").eq("household_id", this.hid).order("run_at", { ascending: false }).limit(200)); },
  async addDealRun(r) { return this.must(await this.sb.from("shop_deal_runs").insert({ source: r.source || "manual", status: r.status || "ok", stores: r.stores || [], note: r.note || null, household_id: this.hid }).select().single()); },
  async saveShop(r) {
    const row = pick(r, SHOP_FIELDS);
    if (r.auto_update === undefined || r.auto_update === null) delete row.auto_update;   // 没执行迁移 068 时这一列不存在：没设过就不送
    if (r.id) return this.must(await this.sb.from("shops").update(row).eq("id", r.id).select().single());
    // 新建：没给的字段不送（送 null 会撞上 refresh / refresh_dow / archived / category 的 not null，返回 400），让数据库用默认值
    const ins = Object.fromEntries(Object.entries(row).filter(([k]) => r[k] !== undefined && r[k] !== null));
    return this.must(await this.sb.from("shops").insert({ refresh: "weekly", refresh_dow: 3, archived: false, category: "groceries", ...ins, household_id: this.hid }).select().single());
  },
  async deleteShop(id) { this.must(await this.sb.from("shops").delete().eq("id", id)); },
  async listShopDeals(since) { return this.pageAll(() => this.sb.from("shop_deals").select("*").eq("household_id", this.hid).or(`valid_to.is.null,valid_to.gte.${since}`).order("id")); },
  async addShopDeals(rows) {
    const out = [];
    for (let i = 0; i < rows.length; i += 200) out.push(...(this.must(await this.sb.from("shop_deals").insert(rows.slice(i, i + 200).map((r) => ({ ...dealRow(r), household_id: this.hid }))).select()) || []));
    return out;
  },
  async saveShopDeal(r) { this.must(await this.sb.from("shop_deals").update(dealRow(r)).eq("id", r.id)); },
  async deleteShopDeals(ids) { for (let i = 0; i < ids.length; i += 100) this.must(await this.sb.from("shop_deals").delete().in("id", ids.slice(i, i + 100))); },
  /** 过期超过 6 个月的特价：删掉（以前的价格只看近 6 个月） */
  async purgeShopDeals(before) { this.must(await this.sb.from("shop_deals").delete().eq("household_id", this.hid).lt("valid_to", before)); },
};
