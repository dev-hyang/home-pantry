/* 商店逻辑各部分共用的小件。从 logic.js 抽出来，各部分依赖这里。 */
import { alertsOf } from "../core/logic.js";
import { num, spaceOf } from "../core/util.js";
import { openShopping } from "./deals-logic.js";
import { state } from "../core/state.js";

// 折扣类型（可多个，存成逗号分开的 key）；re = AI / 广告上的各种写法
export const DEAL_TYPES = [
  ["black_friday", "Black Friday", /black\s*friday|黑五/i], ["cyber_monday", "Cyber Monday", /cyber\s*monday|网络星期一/i],
  ["holiday", "节日特价", /holiday|christmas|thanksgiving|easter|4th of july|memorial|labor day|节日|圣诞|感恩节/i], ["weekly", "周广告", /^weekly|weekly ad|周广告/i],
  ["instore", "店内", /in[-\s]?store|店内/i], ["online", "网上", /online|web only|网上|线上/i], ["rollback", "Rollback", /rollback/i],
  ["clearance", "清仓", /clearance|清仓/i], ["coupon", "电子券", /coupon|digital|clip|电子券|优惠券/i], ["member", "会员价", /member|club|card|会员/i],
  ["bogo", "买一送一", /bogo|buy one|b1g1|买一送一/i], ["multi", "多件优惠", /^multi|\d+\s*for\s*\$|mix\s*&?\s*match|多件/i], ["limited", "限时", /limited|lightning|flash|today only|限时/i],
];
/** AI 给的类型（数组或逗号字符串、key 或广告原文）→ 去重的 key 字符串；认不出的丢掉 */
export function normDealType(v) {
  const parts = (Array.isArray(v) ? v : String(v || "").split(/[,，/|]/)).map((x) => String(x).trim()).filter(Boolean);
  const keys = [];
  for (const p of parts) { const k = DEAL_TYPES.find(([key, , re]) => key === p.toLowerCase() || re.test(p))?.[0]; if (k && !keys.includes(k)) keys.push(k); }
  return keys.slice(0, 4).join(",") || null;
}
// 连锁店：名字的认法、分类、本周广告链接（2026-11 核对过能打开的；其余用 Flipp 搜索页）
export const CHAINS = {
  jewel:      { name: "Jewel-Osco", cat: "groceries", re: /jewel/i, ad: "https://www.jewelosco.com/weeklyad" },
  aldi:       { name: "ALDI", cat: "groceries", re: /\baldi\b/i, ad: "https://www.aldi.us/weekly-specials" },
  tonys:      { name: "Tony's Fresh Market", cat: "groceries", re: /tony'?s fresh/i, ad: "https://weekly-ad.tonysfreshmarket.com/" },
  marianos:   { name: "Mariano's", cat: "groceries", re: /mariano/i, ad: "https://www.marianos.com/weeklyad" },
  meijer:     { name: "Meijer", cat: "groceries", re: /meijer/i, ad: "https://www.meijer.com/shopping/weekly-ad.html" },
  wholefoods: { name: "Whole Foods Market", cat: "groceries", re: /whole foods/i, ad: "https://www.wholefoodsmarket.com/sales-flyer" },
  traderjoes: { name: "Trader Joe's", cat: "groceries", re: /trader joe/i, ad: "" },
  caputos:    { name: "Caputo's", cat: "groceries", re: /caputo/i, ad: "" },
  costco:     { name: "Costco", cat: "warehouse", re: /costco/i, ad: "https://www.costco.com/warehouse-savings.html" },
  sams:       { name: "Sam's Club", cat: "warehouse", re: /sam'?s club/i, ad: "https://www.samsclub.com/instant-savings" },
  target:     { name: "Target", cat: "department", re: /\btarget\b/i, ad: "https://www.target.com/weekly-ad" },
  walmart:    { name: "Walmart", cat: "department", re: /walmart/i, ad: "https://www.walmart.com/shop/deals" },
  kohls:      { name: "Kohl's", cat: "department", re: /kohl'?s/i, ad: "" },
  walgreens:  { name: "Walgreens", cat: "pharmacy", re: /walgreens/i, ad: "https://www.walgreens.com/offers/offers.jsp/weeklyad" },
  cvs:        { name: "CVS", cat: "pharmacy", re: /\bcvs\b/i, ad: "https://www.cvs.com/weeklyad" },
  homedepot:  { name: "The Home Depot", cat: "hardware", re: /home depot/i, ad: "https://www.homedepot.com/c/Savings_Center" },
  lowes:      { name: "Lowe's", cat: "hardware", re: /lowe'?s/i, ad: "" },
  menards:    { name: "Menards", cat: "hardware", re: /menards/i, ad: "https://www.menards.com/main/flyer.html" },
  ace:        { name: "Ace Hardware", cat: "hardware", re: /\bace hardware/i, ad: "" },
  autozone:   { name: "AutoZone", cat: "auto", re: /autozone/i, ad: "" },
  oreilly:    { name: "O'Reilly Auto Parts", cat: "auto", re: /o'?reilly/i, ad: "" },
  petsmart:   { name: "PetSmart", cat: "pet", re: /petsmart/i, ad: "" },
  petco:      { name: "Petco", cat: "pet", re: /petco/i, ad: "" },
  bestbuy:    { name: "Best Buy", cat: "electronics", re: /best buy/i, ad: "" },
};
/** 家里常补的东西（读特价时优先找这些）：need = 现在告急的 + 购物车里没买的；regular = 储藏里（不算设备）用得快 / 设了最低库存的，按每天用量排 */
export function restockWatch(limit = 40) {
  const pantry = (state.enriched || []).filter((x) => spaceOf(x.category) !== "gear");
  const need = [...new Set([...alertsOf(pantry).map((x) => x.name), ...openShopping().map((s) => s.name)])].slice(0, limit);
  const regular = pantry.filter((x) => !need.includes(x.name) && (num(x.rate) > 0 || num(x.min_quantity) > 0))
    .sort((a, b) => num(b.rate) - num(a.rate)).map((x) => x.name).slice(0, limit);
  return { need, regular };
}
/** 家里储藏的物品名（不算设备；用得快的在前）：交给 AI / Claude，让它把特价对到我们自己的叫法上（中文英文都行） */
export function myItemNames(limit = 120) {
  return [...new Set((state.enriched || state.items || []).filter((x) => spaceOf(x.category) !== "gear")
    .sort((a, b) => num(b.rate) - num(a.rate)).map((x) => String(x.name || "").trim()).filter(Boolean))].slice(0, limit);
}
export const chainOf = (name) => Object.keys(CHAINS).find((k) => CHAINS[k].re.test(name || "")) || null;
