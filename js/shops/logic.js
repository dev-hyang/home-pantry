import { state } from "../core/state.js";
import { normName } from "../core/item-match.js";
import { spaceOf } from "../core/util.js";
import { dealKeys } from "./deals-logic.js";
import { CHAINS, DEAL_TYPES } from "./logic-common.js";

// 分类：照 Flipp 的分法（食品杂货、会员仓储、百货、药房、五金家装、汽车配件…）
export const SHOP_CATS = [
  ["groceries", "食品杂货", "🥬"], ["warehouse", "会员仓储", "📦"], ["department", "百货超市", "🏬"], ["pharmacy", "药房", "💊"],
  ["hardware", "五金家装", "🔨"], ["auto", "汽车配件", "🚗"], ["pet", "宠物", "🐾"], ["electronics", "电子数码", "🔌"], ["home", "家居", "🛋️"], ["other", "其他", "🏪"],
];
// 特价的分类（AI 给英文 id，界面显示中文）
export const DEAL_CATS = { groceries: "食品", produce: "蔬果", meat: "肉类海鲜", dairy: "蛋奶", bakery: "面包烘焙", frozen: "冷冻", drinks: "饮料", snacks: "零食", household: "日用清洁",
  personal: "个人护理", baby: "母婴", pet: "宠物", pharmacy: "药品保健", optical: "眼镜光学", apparel: "服装", hardware: "五金", auto: "汽车", electronics: "电子", home: "家居", other: "其他" };
export const dealCatName = (c) => DEAL_CATS[c] || c;
export const dealTypeName = (k) => DEAL_TYPES.find((x) => x[0] === k)?.[1] || k;
export const shopCat = (id) => SHOP_CATS.find((c) => c[0] === id) || SHOP_CATS[SHOP_CATS.length - 1];
// 什么都卖的大店：读特价时只看这几个分区（按网站上的分区名找链接 / 标签），这些分区里的东西都保留；没列出来的分区跳过。
// Costco 2026-11-14 用户定：Grocery、Health & Personal Care、Apparel、Electronics，外加导航「See more」里的 Household、Optical、Pharmacy
export const FOCUS_SECTIONS = {
  walmart: ["Food", "Food savings", "Household essentials savings", "Baby savings"],
  target: ["Grocery", "Household essentials", "Baby"],
  costco: ["Grocery", "Health & Personal Care", "Apparel", "Electronics", "Household (See more)", "Optical (See more)", "Pharmacy (See more)"],
  sams: ["Grocery", "Household", "Baby"],
};
/** 录入特价时对上家里的物品：特价的名称 / 通用叫法（aka）里有一个和储藏物品的名字或别名完全一样，就把物品名放到 aka 最前面。
 *  AI 给的 aka 里本来就有中文通用名（「鸡蛋, eggs」），所以英文网站的特价也能对上中文物品；
 *  不同牌子的同一样东西都带上同一个物品名 → 购物车、以前的价格都按它合并。只认完全一样，不猜（「巧克力牛奶」不会算成「牛奶」）。 */
export function linkItems(rows) {
  const alias = state.itemAliases || [], idx = new Map();
  for (const it of (state.items || []).filter((x) => spaceOf(x.category) !== "gear")) {
    for (const k of [it.name, ...alias.filter((a) => a.item_id === it.id).map((a) => a.alias)].map(normName)) if (k.length >= 2 && !idx.has(k)) idx.set(k, it.name);
  }
  if (!idx.size) return rows;
  return rows.map((r) => {
    const name = dealKeys(r).map((k) => idx.get(k)).find(Boolean);
    if (!name) return r;
    const parts = String(r.aka || "").split(/[,，、]/).map((x) => x.trim()).filter((x) => x && normName(x) !== normName(name));
    let aka = name; for (const p of parts) if (`${aka}, ${p}`.length <= 120) aka += `, ${p}`;
    return { ...r, aka };
  });
}
// 第一次打开：常用的这几家（按 ZIP 找最近的门店补上地址；找不到就先只加名字）
export const STARTER = ["jewel", "costco", "aldi", "tonys", "target", "walmart"];
export const flippUrl = (s) => `https://flipp.com/en-us/search/${encodeURIComponent(CHAINS[s.chain]?.name || s.name)}`;
export const adUrl = (s) => s.ad_url || CHAINS[s.chain]?.ad || flippUrl(s);
export { CHAINS, DEAL_TYPES, chainOf, myItemNames, normDealType, restockWatch } from "./logic-common.js";
export { HIST_DAYS, bestDealFor, dealMatches, dealsDue, dealsFor, histSince, lastWeekday, liveDeals, openShopping, rankDeals, replaceable, weekWindow } from "./deals-logic.js";
export { MAX_MI, miles, nearestChains, rememberPoint, savedZip, searchNearby, zipToPoint } from "./location-logic.js";
export { claudePrompt, cleanDeals, dealPrompt, importGroups, parseLooseJson, priceHistory } from "./ads-logic.js";
export const mapUrl = (s) => (s.lat != null && s.lon != null ? `https://www.openstreetmap.org/?mlat=${s.lat}&mlon=${s.lon}#map=16/${s.lat}/${s.lon}`
  : `https://www.google.com/maps/search/${encodeURIComponent([s.name, s.address].filter(Boolean).join(" "))}`);
