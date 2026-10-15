import { state } from "./state.js";
import { $, DAY, STATS_LOG_DAYS, num, uid } from "./util.js";

/* ───────────── 数据层：本地演示 ───────────── */
export const DemoStore = {
  mode: "demo", key: "hmh-demo-v3", db: null,
  load() {
    try { this.db = JSON.parse(localStorage.getItem(this.key)); } catch { this.db = null; }
    if (!this.db || !Array.isArray(this.db.items)) this.db = seedDemo();
    this.db.purchases ||= [];
    this.persist();
  },
  persist() { try { localStorage.setItem(this.key, JSON.stringify(this.db)); } catch { /* 隐私模式下可能不可写，忽略 */ } },
  reset() { this.db = seedDemo(); this.persist(); },
  async listItems() { return this.db.items.map((x) => ({ ...x })); },
  async listLogs() {
    const since = Date.now() - STATS_LOG_DAYS * DAY;
    return this.db.logs.filter((l) => new Date(l.created_at).getTime() >= since);
  },
  async listPurchases() { return this.db.purchases.map((x) => ({ ...x })); },
  async getHouseProfile() { return this.db.house_profile ? { ...this.db.house_profile } : null; },
  async saveHouseProfile(p) { this.db.house_profile = { ...p, updated_at: new Date().toISOString() }; this.persist(); },
  async addItems(list) {
    const now = new Date().toISOString();
    for (const it of list) this.db.items.push({ ...it, id: uid(), created_at: now, updated_at: now });
    this.persist();
  },
  async listPurchasesRange(from, to) {
    return this.db.purchases.filter((p) => p.purchased_at >= from && p.purchased_at < to)
      .sort((a, b) => a.purchased_at.localeCompare(b.purchased_at)).map((x) => ({ ...x }));
  },
  async addPurchase(p) { this.db.purchases.push({ ...p, id: uid(), created_at: new Date().toISOString() }); this.persist(); },
  async deletePurchase(id) { this.db.purchases = this.db.purchases.filter((x) => x.id !== id); this.persist(); },
  async saveItem(it) {
    const now = new Date().toISOString();
    if (it.id) {
      const i = this.db.items.findIndex((x) => x.id === it.id);
      if (i < 0) throw new Error("物品不存在");
      const d = Math.round((num(it.quantity) - num(this.db.items[i].quantity)) * 100) / 100;
      if (d) this.db.logs.push({ id: uid(), item_id: it.id, delta: d, reason: "adjust", created_at: now });
      this.db.items[i] = { ...this.db.items[i], ...it, updated_at: now };
    } else {
      this.db.items.push({ ...it, id: uid(), created_at: now, updated_at: now });
    }
    this.persist();
  },
  async deleteItem(id) {
    this.db.items = this.db.items.filter((x) => x.id !== id);
    this.db.logs = this.db.logs.filter((l) => l.item_id !== id);
    this.db.shopping.forEach((s) => { if (s.item_id === id) s.item_id = null; });
    this.persist();
  },
  async adjust(id, delta, reason) {
    const it = this.db.items.find((x) => x.id === id);
    if (!it) throw new Error("物品不存在");
    const oldq = num(it.quantity), newq = Math.max(0, Math.round((oldq + delta) * 100) / 100);
    it.quantity = newq; it.updated_at = new Date().toISOString();
    if (newq !== oldq) this.db.logs.push({ id: uid(), item_id: id, delta: newq - oldq, reason, created_at: it.updated_at });
    this.persist();
  },
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

export function seedDemo() {
  const now = Date.now();
  const us = Units.region.system === "us";
  const cur = Units.region.currency;
  const priceFactor = { CNY: 1, USD: 0.22, CAD: 0.3 }[cur] || 1;  // 演示用的粗略价格换算
  const r2 = (v) => Math.round(v * 100) / 100;
  const items = [], logs = [], purchases = [];
  // 演示用商店：按分类大致分配
  const STORES = us
    ? { fresh: ["H Mart", "Trader Joe's", "Costco"], frozen: ["Costco", "H Mart"], dry: ["Costco", "H Mart", "Amazon"], drink: ["Costco"], daily: ["Target", "Costco", "Amazon"], baby: ["Amazon", "Target"], health: ["Costco", "Amazon"] }
    : { fresh: ["盒马", "美团买菜", "楼下菜市场"], frozen: ["山姆", "盒马"], dry: ["山姆", "京东"], drink: ["山姆", "京东"], daily: ["京东", "山姆"], baby: ["京东", "天猫"], health: ["京东"] };
  // price：每单位价格（人民币，演示数据）
  const add = (name, category, subcategory, unit, quantity, min_quantity, location, daily, expiryInDays, price) => {
    const id = uid();
    items.push({
      id, name, category, subcategory, unit, quantity, min_quantity, location, lead_days: 3,
      expiry_date: expiryInDays == null ? null : new Date(now + expiryInDays * DAY).toISOString().slice(0, 10),
      avg_daily_use: null, notes: "", created_at: new Date(now - 190 * DAY).toISOString(), updated_at: new Date().toISOString(),
    });
    if (!(daily > 0)) return;
    // 从今天的库存倒推：每 3 天消耗一次；倒推时库存超过合理上限，说明那之前补过一次货
    const cap = Math.max(min_quantity * 2, daily * 14, 1);
    const buy = Math.max(1, Math.ceil(cap));
    let level = quantity;
    for (let d = 3; d <= 180; d += 3) {
      const t = now - d * DAY + ((d * 7919) % 36000) * 1000;   // 时间稍微错开
      const use = r2(daily * 3);
      logs.push({ id: uid(), item_id: id, delta: -use, reason: "consume", created_at: new Date(t).toISOString() });
      level += use;
      while (level > cap) {
        const bt = t - 3 * 3600 * 1000;
        logs.push({ id: uid(), item_id: id, delta: buy, reason: "restock", created_at: new Date(bt).toISOString() });
        purchases.push({ id: uid(), item_id: id, name, category, quantity: buy, unit, amount: r2(buy * price * priceFactor * (0.9 + ((d * 31) % 20) / 100)), currency: cur, purchased_at: new Date(bt).toISOString(),
          store: STORES[category][((d / 3) | 0) % STORES[category].length] });
        level = Math.max(0, level - buy);
      }
    }
  };
  add("鸡蛋", "fresh", "蛋奶", "个", 4, 6, "冷藏", 2, 12, 1.2);
  if (us) add("纯牛奶", "fresh", "蛋奶", "gal", 1, 0.5, "冷藏", 0.2, 5, 28);
  else add("纯牛奶", "fresh", "蛋奶", "盒", 2, 1, "冷藏", 1, 5, 6);
  add("番茄", "fresh", "蔬菜", "个", 5, 2, "冷藏", 0.5, 4, 2);
  add("菠菜", "fresh", "蔬菜", "把", 1, 1, "冷藏", 0.3, 2, 5);
  add("西兰花", "fresh", "蔬菜", "个", 2, 1, "冷藏", 0.2, 5, 6);
  add("鲫鱼", "fresh", "水产", "条", 0, 1, "冷藏", 0.15, null, 18);
  add("北豆腐", "fresh", "豆制品", "盒", 1, 1, "冷藏", 0.2, 2, 4);
  add("无糖酸奶", "fresh", "蛋奶", "杯", 6, 2, "冷藏", 1, 9, 5);
  add("苹果", "fresh", "水果", "个", 6, 2, "冷藏", 1, 14, 3);
  add("冷冻虾仁", "frozen", "冷冻水产", "袋", 2, 1, "冷冻", 0.1, 90, 35);
  if (us) add("牛腩", "frozen", "冷冻肉禽", "lb", 2, 1, "冷冻", 0.1, 60, 40);
  else add("牛腩", "frozen", "冷冻肉禽", "kg", 1, 0.5, "冷冻", 0.05, 60, 90);
  add("速冻水饺", "frozen", "速冻面点", "袋", 2, 1, "冷冻", 0.1, 120, 25);
  if (us) {
    add("大米", "dry", "米面杂粮", "lb", 15, 5, "厨房柜", 0.6, null, 4);
    add("杂粮（糙米）", "dry", "米面杂粮", "lb", 3, 1, "厨房柜", 0.2, null, 7);
  } else {
    add("大米", "dry", "米面杂粮", "kg", 6, 2, "厨房柜", 0.3, null, 8);
    add("杂粮（糙米）", "dry", "米面杂粮", "kg", 1.5, 0.5, "厨房柜", 0.1, null, 15);
  }
  add("燕麦片", "dry", "米面杂粮", "袋", 2, 1, "厨房柜", 0.06, 180, 20);
  add("食用油", "dry", "食用油", "瓶", 1, 0, "厨房柜", 0.06, null, 70);
  add("生抽", "dry", "调味品", "瓶", 1, 0, "厨房柜", 0.03, null, 15);
  add("原味坚果", "dry", "零食坚果", "袋", 3, 1, "常温", 0.15, 60, 40);
  add("饮用水", "drink", "饮用水", "提", 2, 1, "储物间", 0.25, null, 30);
  add("抽纸", "daily", "纸品", "包", 5, 4, "储物间", 0.4, null, 4);
  add("卷纸", "daily", "纸品", "卷", 12, 6, "卫生间", 0.6, null, 2.5);
  add("洗洁精", "daily", "清洁用品", "瓶", 1, 0, "厨房柜", 0.03, null, 15);
  add("垃圾袋", "daily", "厨房耗材", "卷", 2, 1, "厨房柜", 0.07, null, 8);
  add("纸尿裤 NB码", "baby", "纸尿裤", "片", 18, 30, "储物间", 9, null, 1.5);
  add("婴儿湿巾", "baby", "湿巾", "包", 3, 2, "储物间", 0.3, null, 12);
  add("防溢乳垫", "baby", "哺乳用品", "片", 40, 20, "储物间", 6, null, 0.8);
  add("复合维生素", "health", "维生素营养", "片", 3, 0, "常温", 1, 200, 1.5);
  // 装备（耐用品）：只有数量和位置，没有消耗记录
  add("床单被罩四件套", "gear_home", "床上用品", "套", 3, 0, "衣柜", 0, null, 0);
  add("电热毯", "gear_home", "季节电器", "条", 1, 0, "衣柜", 0, null, 0);
  add("旅行婴儿床（Pack and Play）", "gear_travel", "旅行婴儿用品", "个", 1, 0, "地下室", 0, null, 0);
  add("儿童自行车", "gear_travel", "自行车", "辆", 1, 0, "车库", 0, null, 0);
  add("千斤顶", "gear_car", "应急工具", "个", 1, 0, "车内", 0, null, 0);
  add("搭电线（Jumper）", "gear_car", "应急工具", "套", 1, 0, "车内", 0, null, 0);
  add("修枝剪", "gear_garden", "园艺手工具", "把", 1, 0, "车库", 0, null, 0);
  return { items, logs, shopping: [], purchases };
}

/* ───────────── 数据层：Supabase 云端 ───────────── */
export const ITEM_FIELDS = ["name", "category", "subcategory", "unit", "quantity", "min_quantity", "location", "expiry_date", "lead_days", "avg_daily_use", "notes"];
export const CloudStore = {
  mode: "cloud", sb: null, hid: null, channel: null,
  must({ data, error }) { if (error) throw new Error(error.message); return data; },
  async listItems() { return this.must(await this.sb.from("items").select("*").eq("household_id", this.hid).order("name")); },
  async listLogs() {
    const since = new Date(Date.now() - STATS_LOG_DAYS * DAY).toISOString();
    return this.must(await this.sb.from("stock_logs").select("item_id,delta,reason,created_at")
      .eq("household_id", this.hid).gte("created_at", since).order("created_at").limit(10000));
  },
  async listPurchases() {
    const since = new Date(Date.now() - 400 * DAY).toISOString();
    return this.must(await this.sb.from("purchases").select("*").eq("household_id", this.hid)
      .gte("purchased_at", since).order("purchased_at", { ascending: false }).limit(5000));
  },
  async addPurchase(p) { this.must(await this.sb.from("purchases").insert({ ...p, household_id: this.hid })); },
  async getHouseProfile() {
    return this.must(await this.sb.from("house_profiles").select("*").eq("household_id", this.hid).maybeSingle());
  },
  async saveHouseProfile(p) {
    const row = { household_id: this.hid, region: p.region, house_type: p.house_type, year_built: p.year_built ?? null,
      features: p.features || [], exterior: p.exterior || [], roof: p.roof || null, flooring: p.flooring || [], updated_by: state.user.id };
    this.must(await this.sb.from("house_profiles").upsert(row, { onConflict: "household_id" }));
  },
  async addItems(list) {
    const rows = list.map((it) => { const r = { household_id: this.hid, updated_by: state.user.id }; ITEM_FIELDS.forEach((k) => { r[k] = it[k] ?? null; }); return r; });
    this.must(await this.sb.from("items").insert(rows));
  },
  async listPurchasesRange(from, to) {
    return this.must(await this.sb.from("purchases").select("*").eq("household_id", this.hid)
      .gte("purchased_at", from).lt("purchased_at", to).order("purchased_at").limit(10000));
  },
  async deletePurchase(id) { this.must(await this.sb.from("purchases").delete().eq("id", id)); },
  async saveItem(it) {
    const row = { household_id: this.hid, updated_by: state.user.id };
    ITEM_FIELDS.forEach((k) => { row[k] = it[k]; });
    if (it.id) {
      const old = state.items.find((x) => x.id === it.id);
      this.must(await this.sb.from("items").update(row).eq("id", it.id));
      const d = old ? Math.round((num(it.quantity) - num(old.quantity)) * 100) / 100 : 0;
      if (d) this.must(await this.sb.from("stock_logs").insert({ household_id: this.hid, item_id: it.id, delta: d, reason: "adjust", created_by: state.user.id }));
    } else this.must(await this.sb.from("items").insert(row));
  },
  async deleteItem(id) { this.must(await this.sb.from("items").delete().eq("id", id)); },
  async adjust(id, delta, reason) { this.must(await this.sb.rpc("adjust_stock", { p_item_id: id, p_delta: delta, p_reason: reason })); },
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
  async listMembers() {
    return this.must(await this.sb.from("household_members").select("user_id,display_name,role").eq("household_id", this.hid));
  },
  subscribe(onChange) {
    if (this.channel) this.sb.removeChannel(this.channel);
    const f = { schema: "public", filter: `household_id=eq.${this.hid}` };
    this.channel = this.sb.channel(`hh-${this.hid}`)
      .on("postgres_changes", { event: "*", table: "items", ...f }, onChange)
      .on("postgres_changes", { event: "*", table: "shopping_list", ...f }, onChange)
      .on("postgres_changes", { event: "*", table: "purchases", ...f }, onChange)
      .on("postgres_changes", { event: "*", table: "house_profiles", ...f }, onChange)
      .subscribe();
  },
};

export let Store = DemoStore;
// ES 模块导入的绑定是只读的，切换数据层统一走这里
export function setStore(s) { Store = s; }
