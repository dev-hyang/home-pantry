/* 采购方式（购物车按它分组，一页看完所有要买的）：线上订阅（省钱）/ 批量采购（省时）/ 生鲜即买（保鲜）/ 其他。
 * 现在按物品的分类推（不用存数据）：生鲜、肉蛋奶、冷冻 → 生鲜即买（每周一次超市行程）；粮油干货、零食、饮品 → 批量（Costco 一次买够）；
 * 纸品清洁、个人护理、药品健康、母婴、文具、宠物、汽车房屋消耗品 → 线上订阅 / 网购（定期配送，凑折扣）；其余归「其他」。
 * 纯函数、不依赖界面（Node 测试直接引用）。 */
export const BUY_MODES = [
  { id: "online", icon: "📦", name: "线上订阅 / 网购", hint: "省钱 · 可设 Amazon / Staples 等定期配送，凑折扣" },
  { id: "bulk", icon: "🛒", name: "批量采购", hint: "省时 · 耐储存的，去 Costco 一次买够" },
  { id: "fresh", icon: "🥬", name: "生鲜即买", hint: "保鲜 · 每周一次超市行程，现买现吃" },
  { id: "other", icon: "📝", name: "其他", hint: "" },
];
const FRESH = new Set(["fresh", "meat_dairy", "frozen"]);
const BULK = new Set(["dry", "snacks", "drink"]);
const ONLINE = new Set(["daily", "personal_care", "health", "baby", "study", "pet"]);

/** 分类 id（和它所在的空间：pantry / house / gear）→ 采购方式 id */
export function buyModeOf(catId, space = "pantry") {
  if (FRESH.has(catId)) return "fresh";
  if (BULK.has(catId)) return "bulk";
  if (ONLINE.has(catId) || space === "house") return "online";
  return "other";
}
/** 没关联库存、也没有分类的项：按名字里的常见词猜（猜不到返回 other）。只是兜底，关联了库存物品就按分类 */
const NAME_FRESH = /肉|鸡|鸭|牛|猪|羊|排骨|鱼|虾|蟹|贝|菜|瓜|果|莓|蕉|苹|橙|柠檬|蛋|奶|酸奶|奶酪|豆腐|面包|蘑菇|葱|姜|蒜|meat|beef|pork|chicken|fish|shrimp|egg|milk|fruit|veg|salad|bread|lettuce|berry/i;
const NAME_BULK = /米|面粉|意面|面条|大米|油|盐|糖|酱|醋|罐头|坚果|饼干|零食|薯片|水|饮料|咖啡|茶|rice|pasta|flour|oil|snack|nuts|water|coffee|cereal|can/i;
const NAME_ONLINE = /纸|洗|清洁|滤|电池|猫砂|尿|牙|沐浴|洗发|垃圾袋|药|维生素|湿巾|tissue|paper|detergent|soap|filter|battery|diaper|wipes|shampoo|vitamin/i;
export function buyModeByName(name) {
  const n = String(name || "");
  if (NAME_ONLINE.test(n)) return "online";
  if (NAME_FRESH.test(n)) return "fresh";
  if (NAME_BULK.test(n)) return "bulk";
  return "other";
}
export const modeRank = (id) => { const i = BUY_MODES.findIndex((m) => m.id === id); return i < 0 ? BUY_MODES.length : i; };

/** 把行按采购方式分组（组的顺序固定，空组不出现）：[{ mode, rows }] */
export function groupByMode(rows, modeOf) {
  const by = new Map(BUY_MODES.map((m) => [m.id, []]));
  for (const r of rows) (by.get(modeOf(r)) || by.get("other")).push(r);
  return BUY_MODES.map((mode) => ({ mode, rows: by.get(mode.id) })).filter((g) => g.rows.length);
}
