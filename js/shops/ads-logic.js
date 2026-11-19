/* 商店：AI 读广告 → 特价、给 Claude 用的入口、以前的价格（近 6 个月已过期的特价）。 */
import { dealKeys, openShopping, weekWindow } from "./deals-logic.js";
import { normName } from "../core/item-match.js";
import { state } from "../core/state.js";
import { todayISO } from "../core/util.js";
import { chainOf, myItemNames, normDealType, restockWatch } from "./logic-common.js";

/* ───────────── AI 读广告 → 特价 ───────────── */
export function dealPrompt(shop, lang) {
  const open = openShopping().map((s) => s.name).slice(0, 80);
  const system = [
    "You read store weekly ads / flyers / deal pages (photos, screenshots, PDFs or pasted text) and return ONLY JSON.",
    "One entry per advertised product. Skip store info, coupons without a product, recipes and banners.",
    "price = the price of ONE item after the deal: \"2 for $5\" → 2.50; \"$3.99/lb\" → 3.99 with unit_label \"/lb\"; BOGO → half the regular price if shown, else the shelf price. Keep the original wording in price_text.",
    "unit_price + unit_label = price per common unit so different sizes compare: per lb for meat / produce / bulk, per oz for packaged food, per fl oz for drinks / liquids, per ct for counts (eggs, rolls). Compute it from size when the size is printed; null if unknown.",
    "size = package size as printed (\"64 fl oz\", \"18 ct\", \"1 lb\"). brand only if printed.",
    `aka = 1–3 short generic names for matching a shopping list, comma separated, including a ${lang === "en" ? "short English" : "simplified Chinese"} name (e.g. \"鸡蛋, eggs\").`,
    "valid_from / valid_to = the ad's dates as YYYY-MM-DD if shown (US order month/day); null if not shown. If items have their OWN dates (e.g. Costco member savings \"valid through 12/7\"), put them on each deal; the top-level dates are for the whole ad.",
    "deal_type = the kind of deal as a comma separated list of: black_friday, cyber_monday, holiday, weekly, instore, online, rollback, clearance, coupon, member, bogo, multi, limited (e.g. \"black_friday,online\" for a Black Friday online-only deal; \"rollback\" for Walmart Rollback; \"coupon\" for digital / clip coupons; \"member\" for club or card prices; \"multi\" for 2 for $5). Use what the ad says; null if nothing special.",
    `category = groceries, produce, meat, dairy, bakery, frozen, drinks, snacks, household, personal, baby, pet, pharmacy, optical, apparel, hardware, auto, electronics, home or other.`,
    `Today is ${todayISO()}.`,
  ].join("\n");
  const user = [
    `Store: ${shop.name}${shop.address ? ` (${shop.address})` : ""}.`,
    open.length ? `Our shopping list (mention these first if they are on sale): ${open.join(", ")}` : "",
    myItemNames().length ? `Our household's own item names (Chinese or English): ${myItemNames().join(", ")}. If a deal is the same kind of thing as one of these (any brand, any size), put that exact name FIRST in aka.` : "",
    'Return exactly: {"valid_from":null,"valid_to":null,"deals":[{"name":"","brand":null,"size":null,"price":null,"price_text":"","regular_price":null,"unit_price":null,"unit_label":null,"aka":"","category":"groceries","deal_type":null,"valid_from":null,"valid_to":null}]}',
  ].filter(Boolean).join("\n");
  return { system, user };
}
/** AI / Claude 给的结果 → 一行行特价（数字、长度都收拾好）；支持 {deals:[…]}、直接数组、{stores:[{deals}]} 里的一家 */
export function cleanDeals(j, fallback = {}) {
  const list = Array.isArray(j) ? j : Array.isArray(j?.deals) ? j.deals : [];
  const n = (v) => { if (v == null || v === "") return null; const x = parseFloat(String(v).replace(/[$,]/g, "")); return Number.isFinite(x) && x >= 0 ? x : null; };
  const d8 = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? String(v) : null);
  const s = (v, max) => (v == null || v === "" ? null : String(v).trim().slice(0, max) || null);
  return list.filter((x) => x && String(x.name || "").trim()).map((x) => ({
    include: true, name: String(x.name).trim().slice(0, 80), brand: s(x.brand, 40), size: s(x.size, 40), price: n(x.price), price_text: s(x.price_text, 40),
    regular_price: n(x.regular_price), unit_price: n(x.unit_price), unit_label: s(x.unit_label, 12), aka: s(x.aka, 120), category: s(x.category, 30),
    valid_from: d8(x.valid_from) || d8(j?.valid_from) || fallback.valid_from || null, valid_to: d8(x.valid_to) || d8(j?.valid_to) || fallback.valid_to || null,
    deal_type: normDealType(x.deal_type ?? x.type) || normDealType(j?.deal_type),
  }));
}
export function parseLooseJson(text) {
  const clean = String(text || "").trim().replace(/^```(?:json)?/i, "").replace(/```\s*$/, "").trim();
  try { return JSON.parse(clean); } catch { /* 再截取 */ }
  const a = clean.search(/[[{]/), b = Math.max(clean.lastIndexOf("}"), clean.lastIndexOf("]"));
  if (a >= 0 && b > a) return JSON.parse(clean.slice(a, b + 1));
  throw new Error("JSON");
}
/* ───────────── 给 Claude（Chrome 侧边栏 / Claude Code 的 pantry-deals 技能）的指令 ─────────────
 * 约定（个人比价、非商业）：用户自己先在 Flipp / 超市网站上打开广告、搜好要的东西；Claude 只读当前打开的标签页，
 * 不自己去点搜索框、填邮编、翻几十页；按正常浏览节奏；结果按下面的 JSON 格式给出，贴回爱家小助手导入（导入前人工核对）。 */
const DEAL_JSON = '{"stores":[{"store":"店名（和上面列的一致）","valid_from":"YYYY-MM-DD","valid_to":"YYYY-MM-DD","deals":[{"name":"","brand":null,"size":"64 fl oz","price":2.5,"price_text":"2 for $5","regular_price":null,"unit_price":0.039,"unit_label":"/fl oz","aka":"牛奶, milk","category":"dairy","deal_type":"multi,coupon","valid_from":null,"valid_to":null}]}]}';
const RULES = [
  "只读我已经打开的标签页（我自己先搜好了）；不要自己去点搜索框、填邮编、翻很多页，按正常浏览节奏，一页最多往下滚几屏。",
  "纯图片的传单就看截图读价格；小字看不清的写 null，不要猜。",
  "price = 单件价：「2 for $5」记 2.50；「$3.99/lb」记 3.99、unit_label 写 /lb；price_text 保留广告原文。",
  "unit_price + unit_label = 统一单价，方便比不同包装：肉、蔬果、散装按 /lb，包装食品按 /oz，饮料和液体按 /fl oz，按个数的按 /ct（鸡蛋、卷纸）。能从规格算就算，算不出写 null。",
  "aka = 1–3 个通用叫法（逗号分开），要有一个中文，例如「鸡蛋, eggs」，用来和我的购物车对上。如果这样东西和上面「我家储藏里的物品名」里的某一个是同一种东西（不管牌子、包装大小），把那个名字原样放在 aka 第一个。",
  "有效期：整份广告统一的日期写在商店那一层的 valid_from / valid_to；每样东西有效期不一样的（比如 Costco 会员特价写着「Valid 11/12 – 12/7」），写在那一条特价自己的 valid_from / valid_to。看不到日期就写 null，不要猜——我的应用会按这家商店的换广告日自动补。",
  "deal_type = 折扣类型，按广告上写的，可以多个、逗号分开，只用这些：black_friday, cyber_monday, holiday, weekly, instore, online, rollback, clearance, coupon, member, bogo, multi, limited（Black Friday、Cyber Monday、节日、周广告、只限店内、只限网上、Walmart Rollback、清仓、电子券 / Clip coupon、会员价 / 会员卡价、买一送一、多件优惠如 2 for $5、限时）。没有特别说明的写 null。",
  "category 用：groceries, produce, meat, dairy, bakery, frozen, drinks, snacks, household, personal, baby, pet, pharmacy, optical, apparel, hardware, auto, electronics, home, other。",
  "先给一张按单价从低到高的表格让我看，最后再给一个 ```json 代码块（格式见下），我会贴回爱家小助手。不要替我在任何网站上点提交。",
];
export function claudePrompt({ shops = [], zip = "", list = [] } = {}) {
  const names = shops.map((s) => `${s.name}${s.address ? `（${s.address}）` : ""}`).join("；");
  return [
    list.length ? `帮我比价：下面是我这周的购物车，请根据我现在打开的几家超市传单标签页，找出每样东西去哪家买最便宜（按单价比），没有特价的就写「没看到」。`
      : `帮我把我打开的超市传单标签页里的特价整理出来。`,
    names ? `商店：${names}。${zip ? `ZIP：${zip}。` : ""}` : (zip ? `ZIP：${zip}。` : ""),
    list.length ? `购物车：${list.join("、")}` : "",
    list.length ? "" : (() => { const w = restockWatch(25), all = [...w.need, ...w.regular].slice(0, 40);
      return `重点：只要吃的、日用品（纸巾、洗涤、清洁）、宝宝用品；电视、家电、工具、玩具、衣服这些跳过。${all.length ? `家里常补的东西优先找：${all.join("、")}。` : ""}`; })(),
    myItemNames().length ? `我家储藏里的物品名（录入 aka 用）：${myItemNames().join("、")}。` : "",
    `今天是 ${todayISO()}。`,
    "规则：", ...RULES.map((r, i) => `${i + 1}. ${r}`),
    `JSON 格式（每家商店一项；比价时只放清单里那几样的特价）：${DEAL_JSON}`,
  ].filter(Boolean).join("\n");
}
/** Claude 给的结果 → 每家商店一组：对上了哪家（按连锁名 / 名称），没对上的单独列出来 */
export function importGroups(j) {
  const groups = Array.isArray(j?.stores) ? j.stores : j?.deals ? [j] : [];
  const shops = (state.shops || []).filter((s) => !s.archived);
  return groups.map((g) => {
    const nm = String(g.store || g.name || "").trim(), ch = chainOf(nm), k = normName(nm);
    const shop = shops.find((s) => ch && s.chain === ch) || shops.find((s) => k && (normName(s.name).includes(k) || k.includes(normName(s.name))));
    return { store: nm, shop, rows: cleanDeals(g, weekWindow(shop)), include: !!shop };   // 没写日期的：每周的店按换广告日补
  }).filter((g) => g.rows.length);
}
/* ───────────── 以前的价格（近 6 个月已过期的特价，各家都算） ───────────── */
// 按「名称 / 通用叫法」完全一样建索引；state.shopDeals 换了或条数变了才重建
let HIDX = { src: null, n: -1, map: null };
function histIndex() {
  const all = state.shopDeals || [];
  if (HIDX.src === all && HIDX.n === all.length) return HIDX.map;
  const today = todayISO(), map = new Map();
  for (const x of all) if (x.valid_to && x.valid_to < today) for (const k of new Set(dealKeys(x))) (map.get(k) || map.set(k, []).get(k)).push(x);
  HIDX = { src: all, n: all.length, map };
  return map;
}
/** 这条特价和以前比：同一单位按单价比（不同包装也能比），没单价时同规格按价格比。没有可比的返回 null。
 *  { by: "unit" | "price", cur, low（最便宜那条）, lowV, isLow（现在是 6 个月最低）, pct（比最低贵百分之几）, list（新的在前） } */
export function priceHistory(d) {
  if (!d) return null;
  const map = histIndex(), seen = new Set(), past = [];
  for (const k of dealKeys(d)) for (const x of map.get(k) || []) if (x.id !== d.id && !seen.has(x.id)) { seen.add(x.id); past.push(x); }
  if (!past.length) return null;
  const sameSize = (x) => d.size && x.size && normName(x.size) === normName(d.size);
  const byUnit = d.unit_price != null && d.unit_label ? past.filter((x) => x.unit_price != null && x.unit_label === d.unit_label) : [];
  const by = byUnit.length ? "unit" : "price", list = byUnit.length ? byUnit : d.price != null ? past.filter((x) => x.price != null && sameSize(x)) : [];
  if (!list.length) return null;
  const v = (x) => +(by === "unit" ? x.unit_price : x.price), cur = v(d);
  const low = list.reduce((m, x) => (v(x) < v(m) ? x : m)), lowV = v(low);
  list.sort((a, b) => String(b.valid_to).localeCompare(String(a.valid_to)));
  return { by, cur, low, lowV, isLow: cur <= lowV + 1e-9, pct: lowV > 0 ? Math.round(((cur - lowV) / lowV) * 100) : 0, list };
}
