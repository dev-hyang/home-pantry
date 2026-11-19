/* 演示模式的示例数据（第一次打开时种进浏览器）。 */
import { DAY, uid } from "../util.js";
import { t } from "../i18n.js";

   // 方法按领域分在 core/store/ 下，this 仍然是 DemoStore

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
  // 演示物品名按当前语言写入（名称是用户数据，之后不再翻译）
  const add = (zhName, category, subcategory, unit, quantity, min_quantity, location, daily, expiryInDays, price) => {
    const id = uid(), name = t(zhName);
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
      const tm = now - d * DAY + ((d * 7919) % 36000) * 1000;   // 时间稍微错开
      const use = r2(daily * 3);
      logs.push({ id: uid(), item_id: id, delta: -use, reason: "consume", created_at: new Date(tm).toISOString() });
      level += use;
      while (level > cap) {
        const bt = tm - 3 * 3600 * 1000;
        logs.push({ id: uid(), item_id: id, delta: buy, reason: "restock", created_at: new Date(bt).toISOString() });
        purchases.push({ id: uid(), item_id: id, name, category, quantity: buy, unit, amount: r2(buy * price * priceFactor * (0.9 + ((d * 31) % 20) / 100)), currency: cur, purchased_at: new Date(bt).toISOString(),
          store: (STORES[category] || STORES.daily)[((d / 3) | 0) % (STORES[category] || STORES.daily).length] });   // 分类改名后 STORES 没跟着改：找不到就用通用商店，免得新演示库生成失败
        level = Math.max(0, level - buy);
      }
    }
  };
  add("鸡蛋", "meat_dairy", "鸡蛋", "个", 4, 6, "冷藏", 2, 12, 1.2);
  if (us) add("纯牛奶", "meat_dairy", "牛奶酸奶", "gal", 1, 0.5, "冷藏", 0.2, 5, 28);
  else add("纯牛奶", "meat_dairy", "牛奶酸奶", "盒", 2, 1, "冷藏", 1, 5, 6);
  add("番茄", "fresh", "蔬菜", "个", 5, 2, "冷藏", 0.5, 4, 2);
  add("菠菜", "fresh", "蔬菜", "把", 1, 1, "冷藏", 0.3, 2, 5);
  add("西兰花", "fresh", "蔬菜", "个", 2, 1, "冷藏", 0.2, 5, 6);
  add("鲫鱼", "meat_dairy", "水产", "条", 0, 1, "冷藏", 0.15, null, 18);
  add("北豆腐", "fresh", "豆制品", "盒", 1, 1, "冷藏", 0.2, 2, 4);
  add("无糖酸奶", "meat_dairy", "牛奶酸奶", "杯", 6, 2, "冷藏", 1, 9, 5);
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
  add("原味坚果", "snacks", "坚果果干", "袋", 3, 1, "常温", 0.15, 60, 40);
  add("饮用水", "drink", "饮用水", "提", 2, 1, "储物间", 0.25, null, 30);
  add("抽纸", "daily", "纸品", "包", 5, 4, "储物间", 0.4, null, 4);
  add("卷纸", "daily", "纸品", "卷", 12, 6, "卫生间", 0.6, null, 2.5);
  add("洗洁精", "daily", "清洁洗涤", "瓶", 1, 0, "厨房柜", 0.03, null, 15);
  add("垃圾袋", "daily", "厨房耗材", "卷", 2, 1, "厨房柜", 0.07, null, 8);
  add("纸尿裤 NB码", "baby", "纸尿裤", "片", 18, 30, "储物间", 9, null, 1.5);
  add("婴儿湿巾", "baby", "湿巾", "包", 3, 2, "储物间", 0.3, null, 12);
  add("防溢乳垫", "baby", "哺乳耗材", "片", 40, 20, "储物间", 6, null, 0.8);
  add("复合维生素", "health", "维生素营养", "片", 3, 0, "常温", 1, 200, 1.5);
  // 家居耐用品（耐用品）：只有数量和位置，没有消耗记录
  add("床单被罩四件套", "gear_home", "床品被褥", "套", 3, 0, "衣柜", 0, null, 0);
  add("电热毯", "gear_home", "家用电器", "条", 1, 0, "衣柜", 0, null, 0);
  add("旅行婴儿床（Pack and Play）", "gear_baby", "出行用品", "个", 1, 0, "地下室", 0, null, 0);
  add("儿童自行车", "gear_travel", "自行车", "辆", 1, 0, "车库", 0, null, 0);
  add("千斤顶", "gear_car", "应急工具", "个", 1, 0, "车内", 0, null, 0);
  add("搭电线（Jumper）", "gear_car", "应急工具", "套", 1, 0, "车内", 0, null, 0);
  add("修枝剪", "gear_garden", "园艺手工具", "把", 1, 0, "车库", 0, null, 0);
  add("餐盘", "gear_kitchen", "餐具碗盘", "个", 8, 0, "厨房柜", 0, null, 0);
  add("烤盘", "gear_kitchen", "烤盘托盘", "个", 2, 0, "厨房柜", 0, null, 0);
  add("烘焙模具", "gear_kitchen", "烘焙工具", "套", 1, 0, "厨房柜", 0, null, 0);
  return { items, logs, shopping: [], purchases };
}
