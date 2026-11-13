/* 常去的商店 + 特价：数据整理、分类、连锁店预设、按 ZIP 找附近门店（OpenStreetMap）、特价和采购清单对上（迁移 067）
 * 外部服务：ZIP → 经纬度用 zippopotam.us，附近门店用 OpenStreetMap 的 Overpass（几个镜像轮流试）。都不用 key，只发 ZIP 或坐标，不发别的。 */
import { state } from "../core/state.js";
import { normName } from "../core/item-match.js";
import { todayISO } from "../core/util.js";

// 分类：照 Flipp 的分法（食品杂货、会员仓储、百货、药房、五金家装、汽车配件…）
export const SHOP_CATS = [
  ["groceries", "食品杂货", "🥬"], ["warehouse", "会员仓储", "📦"], ["department", "百货超市", "🏬"], ["pharmacy", "药房", "💊"],
  ["hardware", "五金家装", "🔨"], ["auto", "汽车配件", "🚗"], ["pet", "宠物", "🐾"], ["electronics", "电子数码", "🔌"], ["home", "家居", "🛋️"], ["other", "其他", "🏪"],
];
// 特价的分类（AI 给英文 id，界面显示中文）
export const DEAL_CATS = { groceries: "食品", produce: "蔬果", meat: "肉类海鲜", dairy: "蛋奶", bakery: "面包烘焙", frozen: "冷冻", drinks: "饮料", snacks: "零食", household: "日用清洁",
  personal: "个人护理", baby: "母婴", pet: "宠物", pharmacy: "药品保健", hardware: "五金", auto: "汽车", electronics: "电子", home: "家居", other: "其他" };
export const dealCatName = (c) => DEAL_CATS[c] || c;
export const shopCat = (id) => SHOP_CATS.find((c) => c[0] === id) || SHOP_CATS[SHOP_CATS.length - 1];

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
export const chainOf = (name) => Object.keys(CHAINS).find((k) => CHAINS[k].re.test(name || "")) || null;
// 第一次打开：常用的这几家（按 ZIP 找最近的门店补上地址；找不到就先只加名字）
export const STARTER = ["jewel", "costco", "aldi", "tonys", "target", "walmart"];

export const flippUrl = (s) => `https://flipp.com/en-us/search/${encodeURIComponent(CHAINS[s.chain]?.name || s.name)}`;
export const adUrl = (s) => s.ad_url || CHAINS[s.chain]?.ad || flippUrl(s);
export const mapUrl = (s) => (s.lat != null && s.lon != null ? `https://www.openstreetmap.org/?mlat=${s.lat}&mlon=${s.lon}#map=16/${s.lat}/${s.lon}`
  : `https://www.google.com/maps/search/${encodeURIComponent([s.name, s.address].filter(Boolean).join(" "))}`);

/* ───────────── 特价：有效期、待更新、对上采购清单 ───────────── */
/** 还在有效期里的特价（没写结束日期的算有效） */
export const liveDeals = (shopId) => (state.shopDeals || []).filter((d) => (!shopId || d.shop_id === shopId) && (!d.valid_to || d.valid_to >= todayISO()));
/** 「每周」更新的商店：最近一个更新日（refresh_dow，默认周三）之后还没更新过 → 待更新 */
export function dealsDue(s) {
  if (!s || s.archived || s.refresh !== "weekly") return false;
  const d = new Date(); d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() - (s.refresh_dow ?? 3) + 7) % 7));
  return !s.deals_at || new Date(s.deals_at) < d;
}
export const lastWeekday = (dow) => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() - dow + 7) % 7)); return d; };

/** 一条特价的比较键：名称、通用叫法（中英文）、品牌 */
const dealKeys = (d) => [d.name, ...(String(d.aka || "").split(/[,，、/]/))].map(normName).filter((k) => k.length >= 2);
const hit = (keys, k) => keys.some((x) => x.includes(k) || (k.length >= 3 && k.includes(x)));
/** 这条特价对上了采购清单里哪几项（待买 / 正在买）；清单项连着库存物品时，物品的别名也算 */
export function dealMatches(d, open = openShopping()) {
  const keys = dealKeys(d);
  return open.filter((s) => s.keys.some((k) => hit(keys, k)));
}
export function openShopping() {
  const alias = state.itemAliases || [];
  return (state.shopping || []).filter((s) => s.status !== "bought").map((s) => ({ ...s, keys: [s.name, ...alias.filter((a) => a.item_id && a.item_id === s.item_id).map((a) => a.alias)].map(normName).filter((k) => k.length >= 2) }));
}
/** 采购清单里某一项现在最便宜的特价（各家都算），没有返回 null */
export function bestDealFor(s) {
  const keys = [s.name, ...(state.itemAliases || []).filter((a) => a.item_id && a.item_id === s.item_id).map((a) => a.alias)].map(normName).filter((k) => k.length >= 2);
  if (!keys.length) return null;
  const shops = new Map((state.shops || []).filter((x) => !x.archived).map((x) => [x.id, x]));
  const list = liveDeals().filter((d) => shops.has(d.shop_id) && keys.some((k) => hit(dealKeys(d), k)));
  if (!list.length) return null;
  list.sort((a, b) => (a.price ?? 1e9) - (b.price ?? 1e9));
  return { deal: list[0], shop: shops.get(list[0].shop_id), n: list.length };
}

/* ───────────── 位置：ZIP → 经纬度，按距离找门店 ───────────── */
const R_MI = 3958.8;
export function miles(a, b) {
  if (a?.lat == null || b?.lat == null) return null;
  const r = (x) => (x * Math.PI) / 180, dLat = r(b.lat - a.lat), dLon = r(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_MI * Math.asin(Math.sqrt(h));
}
const ZIP_KEY = "hmh-shop-zip";
export function savedZip() { try { return JSON.parse(localStorage.getItem(ZIP_KEY) || "null"); } catch { return null; } }   // { zip, lat, lon, place }
function saveZip(z) { try { localStorage.setItem(ZIP_KEY, JSON.stringify(z)); } catch { /* 忽略 */ } }
/** 美国 ZIP → { zip, lat, lon, place }（zippopotam.us，免费、不用 key） */
export async function zipToPoint(zip) {
  const z = String(zip || "").trim();
  if (!/^\d{5}$/.test(z)) throw new Error("ZIP");
  const old = savedZip(); if (old?.zip === z && old.lat != null) return old;
  const r = await fetch(`https://api.zippopotam.us/us/${z}`);
  if (!r.ok) throw new Error("ZIP");
  const j = await r.json(), p = j.places?.[0]; if (!p) throw new Error("ZIP");
  const out = { zip: z, lat: +p.latitude, lon: +p.longitude, place: `${p["place name"]}, ${p["state abbreviation"]}` };
  saveZip(out); return out;
}
export function rememberPoint(p) { saveZip(p); }

// OpenStreetMap 的 shop 标签 → 我们的分类
const OSM_CAT = { supermarket: "groceries", greengrocer: "groceries", butcher: "groceries", seafood: "groceries", wholesale: "warehouse", department_store: "department",
  general: "department", variety_store: "department", chemist: "pharmacy", hardware: "hardware", doityourself: "hardware", car_parts: "auto", tyres: "auto", pet: "pet", electronics: "electronics", furniture: "home", houseware: "home", interior_decoration: "home" };
const OSM_BY_CAT = (cats) => Object.entries(OSM_CAT).filter(([, c]) => !cats?.length || cats.includes(c)).map(([k]) => k);
const MIRRORS = ["https://overpass-api.de/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
/** 附近的门店：半径（英里）内、选中分类的，按距离排好；公共服务器忙的时候换一个镜像再试 */
export async function searchNearby(pt, radiusMi, cats) {
  const m = Math.round(Math.min(25, Math.max(1, radiusMi)) * 1609.34);
  const tags = OSM_BY_CAT(cats).join("|");
  const q = `[out:json][timeout:40];(nwr["shop"~"^(${tags})$"]["name"](around:${m},${pt.lat},${pt.lon}););out center tags 400;`;
  let lastErr = null;
  for (const url of MIRRORS) {
    try {
      const r = await fetch(url, { method: "POST", body: new URLSearchParams({ data: q }) });
      if (!r.ok) { lastErr = new Error(`HTTP ${r.status}`); continue; }
      const j = await r.json().catch(() => null); if (!j?.elements) { lastErr = new Error("bad"); continue; }
      return j.elements.map((e) => {
        const g = e.tags || {}, lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon;
        const name = g.brand && /^(Jewel-Osco|Aldi|Target|Walmart|Costco)$/i.test(g.brand) ? (g.brand === "Aldi" ? "ALDI" : g.brand) : g.name;
        const chain = chainOf(g.brand || g.name);
        const address = [[g["addr:housenumber"], g["addr:street"]].filter(Boolean).join(" "), g["addr:city"], [g["addr:state"], g["addr:postcode"]].filter(Boolean).join(" ")].filter(Boolean).join(", ");
        return { osm_id: `${e.type[0]}${e.id}`, name: String(name || "").slice(0, 60), chain, category: (chain && CHAINS[chain].cat) || OSM_CAT[g.shop] || "other",
          address: address.slice(0, 200), zip: g["addr:postcode"] || null, lat, lon, phone: (g.phone || g["contact:phone"] || "").slice(0, 30) || null,
          website: (g.website || g["contact:website"] || "").slice(0, 500) || null, dist: miles(pt, { lat, lon }) };
      }).filter((x) => x.name && x.lat != null).sort((a, b) => a.dist - b.dist);
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error("overpass");
}

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
    "valid_from / valid_to = the ad's dates as YYYY-MM-DD if shown (US order month/day); null if not shown.",
    `category = groceries, produce, meat, dairy, bakery, frozen, drinks, snacks, household, personal, baby, pet, pharmacy, hardware, auto, electronics, home or other.`,
    `Today is ${todayISO()}.`,
  ].join("\n");
  const user = [
    `Store: ${shop.name}${shop.address ? ` (${shop.address})` : ""}.`,
    open.length ? `Our shopping list (mention these first if they are on sale): ${open.join(", ")}` : "",
    'Return exactly: {"valid_from":null,"valid_to":null,"deals":[{"name":"","brand":null,"size":null,"price":null,"price_text":"","regular_price":null,"unit_price":null,"unit_label":null,"aka":"","category":"groceries","valid_to":null}]}',
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
const DEAL_JSON = '{"stores":[{"store":"店名（和上面列的一致）","valid_from":"YYYY-MM-DD","valid_to":"YYYY-MM-DD","deals":[{"name":"","brand":null,"size":"64 fl oz","price":2.5,"price_text":"2 for $5","regular_price":null,"unit_price":0.039,"unit_label":"/fl oz","aka":"牛奶, milk","category":"dairy"}]}]}';
const RULES = [
  "只读我已经打开的标签页（我自己先搜好了）；不要自己去点搜索框、填邮编、翻很多页，按正常浏览节奏，一页最多往下滚几屏。",
  "纯图片的传单就看截图读价格；小字看不清的写 null，不要猜。",
  "price = 单件价：「2 for $5」记 2.50；「$3.99/lb」记 3.99、unit_label 写 /lb；price_text 保留广告原文。",
  "unit_price + unit_label = 统一单价，方便比不同包装：肉、蔬果、散装按 /lb，包装食品按 /oz，饮料和液体按 /fl oz，按个数的按 /ct（鸡蛋、卷纸）。能从规格算就算，算不出写 null。",
  "aka = 1–3 个通用叫法（逗号分开），要有一个中文，例如「鸡蛋, eggs」，用来和我的采购清单对上。",
  "category 用：groceries, produce, meat, dairy, bakery, frozen, drinks, snacks, household, personal, baby, pet, pharmacy, hardware, auto, electronics, home, other。",
  "先给一张按单价从低到高的表格让我看，最后再给一个 ```json 代码块（格式见下），我会贴回爱家小助手。不要替我在任何网站上点提交。",
];
export function claudePrompt({ shops = [], zip = "", list = [] } = {}) {
  const names = shops.map((s) => `${s.name}${s.address ? `（${s.address}）` : ""}`).join("；");
  return [
    list.length ? `帮我比价：下面是我这周的采购清单，请根据我现在打开的几家超市传单标签页，找出每样东西去哪家买最便宜（按单价比），没有特价的就写「没看到」。`
      : `帮我把我打开的超市传单标签页里的特价整理出来。`,
    names ? `商店：${names}。${zip ? `ZIP：${zip}。` : ""}` : (zip ? `ZIP：${zip}。` : ""),
    list.length ? `采购清单：${list.join("、")}` : "",
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
    return { store: nm, shop, rows: cleanDeals(g), include: !!shop };
  }).filter((g) => g.rows.length);
}
