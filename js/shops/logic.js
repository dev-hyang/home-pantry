/* 常去的商店 + 特价：数据整理、分类、连锁店预设、按 ZIP 找附近门店（OpenStreetMap）、特价和采购清单对上（迁移 067）
 * 外部服务：ZIP → 经纬度用 zippopotam.us，附近门店用 OpenStreetMap 的 Overpass（几个镜像，最全但常忙）；同时用 Photon（连不上再用 Nominatim）按连锁店名字先找出常见连锁店。都不用 key，只发 ZIP 或坐标，不发别的。 */
import { state } from "../core/state.js";
import { normName } from "../core/item-match.js";
import { num, spaceOf, todayISO } from "../core/util.js";
import { alertsOf } from "../core/logic.js";

// 分类：照 Flipp 的分法（食品杂货、会员仓储、百货、药房、五金家装、汽车配件…）
export const SHOP_CATS = [
  ["groceries", "食品杂货", "🥬"], ["warehouse", "会员仓储", "📦"], ["department", "百货超市", "🏬"], ["pharmacy", "药房", "💊"],
  ["hardware", "五金家装", "🔨"], ["auto", "汽车配件", "🚗"], ["pet", "宠物", "🐾"], ["electronics", "电子数码", "🔌"], ["home", "家居", "🛋️"], ["other", "其他", "🏪"],
];
// 特价的分类（AI 给英文 id，界面显示中文）
export const DEAL_CATS = { groceries: "食品", produce: "蔬果", meat: "肉类海鲜", dairy: "蛋奶", bakery: "面包烘焙", frozen: "冷冻", drinks: "饮料", snacks: "零食", household: "日用清洁",
  personal: "个人护理", baby: "母婴", pet: "宠物", pharmacy: "药品保健", hardware: "五金", auto: "汽车", electronics: "电子", home: "家居", other: "其他" };
export const dealCatName = (c) => DEAL_CATS[c] || c;
// 折扣类型（可多个，存成逗号分开的 key）；re = AI / 广告上的各种写法
export const DEAL_TYPES = [
  ["black_friday", "Black Friday", /black\s*friday|黑五/i], ["cyber_monday", "Cyber Monday", /cyber\s*monday|网络星期一/i],
  ["holiday", "节日特价", /holiday|christmas|thanksgiving|easter|4th of july|memorial|labor day|节日|圣诞|感恩节/i], ["weekly", "周广告", /^weekly|weekly ad|周广告/i],
  ["instore", "店内", /in[-\s]?store|店内/i], ["online", "网上", /online|web only|网上|线上/i], ["rollback", "Rollback", /rollback/i],
  ["clearance", "清仓", /clearance|清仓/i], ["coupon", "电子券", /coupon|digital|clip|电子券|优惠券/i], ["member", "会员价", /member|club|card|会员/i],
  ["bogo", "买一送一", /bogo|buy one|b1g1|买一送一/i], ["multi", "多件优惠", /^multi|\d+\s*for\s*\$|mix\s*&?\s*match|多件/i], ["limited", "限时", /limited|lightning|flash|today only|限时/i],
];
export const dealTypeName = (k) => DEAL_TYPES.find((x) => x[0] === k)?.[1] || k;
/** AI 给的类型（数组或逗号字符串、key 或广告原文）→ 去重的 key 字符串；认不出的丢掉 */
export function normDealType(v) {
  const parts = (Array.isArray(v) ? v : String(v || "").split(/[,，/|]/)).map((x) => String(x).trim()).filter(Boolean);
  const keys = [];
  for (const p of parts) { const k = DEAL_TYPES.find(([key, , re]) => key === p.toLowerCase() || re.test(p))?.[0]; if (k && !keys.includes(k)) keys.push(k); }
  return keys.slice(0, 4).join(",") || null;
}
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
// 什么都卖的大店（Walmart、Target…）：读特价时只看这几个分区，跳过电视、家电、玩具、衣服这些（按网站上的分区名找链接 / 标签）
export const FOCUS_SECTIONS = {
  walmart: ["Food", "Food savings", "Household essentials savings", "Baby savings"],
  target: ["Grocery", "Household essentials", "Baby"],
  costco: ["Grocery", "Household", "Baby"],
  sams: ["Grocery", "Household", "Baby"],
};
/** 家里常补的东西（读特价时优先找这些）：need = 现在告急的 + 采购清单里没买的；regular = 储藏里（不算设备）用得快 / 设了最低库存的，按每天用量排 */
export function restockWatch(limit = 40) {
  const pantry = (state.enriched || []).filter((x) => spaceOf(x.category) !== "gear");
  const need = [...new Set([...alertsOf(pantry).map((x) => x.name), ...openShopping().map((s) => s.name)])].slice(0, limit);
  const regular = pantry.filter((x) => !need.includes(x.name) && (num(x.rate) > 0 || num(x.min_quantity) > 0))
    .sort((a, b) => num(b.rate) - num(a.rate)).map((x) => x.name).slice(0, limit);
  return { need, regular };
}
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
const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/** 每周换广告的商店：这一期的起止日期（最近一个换广告日 → 再过 6 天）。广告上没写日期时用它补；不是每周的（Costco、季节 / 节日）不补 */
export function weekWindow(s) {
  if (!s || s.refresh !== "weekly") return {};
  const from = lastWeekday(s.refresh_dow ?? 3), to = new Date(from); to.setDate(to.getDate() + 6);
  return { valid_from: isoDay(from), valid_to: isoDay(to) };
}

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
// Overpass 公共服务器常常忙（502 / 504）：先同时问前两个，谁先回用谁；都不行再问后两个。每次最多等 25 秒。
const MIRRORS = ["https://maps.mail.ru/osm/tools/overpass/api/interpreter", "https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
async function getJson(url, init = {}, ms = 20000) {
  const c = new AbortController(), timer = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(url, { ...init, signal: c.signal }); if (!r.ok) throw new Error(`HTTP ${r.status}`); return await r.json(); }
  finally { clearTimeout(timer); }
}
/** 以 pt 为中心、半边 mi 英里的方框 [南, 西, 北, 东]；方框查询比 around 轻很多，距离再在本机算 */
function bbox(pt, mi) {
  const dLat = mi / 69, dLon = mi / (69 * Math.cos((pt.lat * Math.PI) / 180));
  return [pt.lat - dLat, pt.lon - dLon, pt.lat + dLat, pt.lon + dLon].map((x) => +x.toFixed(4));
}
const addrOf = (no, street, city, st, zip) => [[no, street].filter(Boolean).join(" "), city, [st, zip].filter(Boolean).join(" ")].filter(Boolean).join(", ").slice(0, 200);
function shopRow(pt, { id, name, brand, shop, lat, lon, address, zip, phone, website }) {
  const chain = chainOf(brand || name);
  return { osm_id: id, name: String((chain && CHAINS[chain].re.test(name || "") ? CHAINS[chain].name : name) || "").slice(0, 60), chain,
    category: (chain && CHAINS[chain].cat) || OSM_CAT[shop] || "other", address, zip: zip || null, lat, lon,
    phone: String(phone || "").slice(0, 30) || null, website: String(website || "").slice(0, 500) || null, dist: miles(pt, { lat, lon }) };
}
async function overpass(pt, mi, cats) {
  const [s, w, n, e] = bbox(pt, mi);
  const q = `[out:json][timeout:25];nwr["shop"~"^(${OSM_BY_CAT(cats).join("|")})$"]["name"](${s},${w},${n},${e});out center tags 800;`;
  const ask = (url) => getJson(url, { method: "POST", body: new URLSearchParams({ data: q }) }, 25000).then((j) => (j?.elements ? j.elements : Promise.reject(new Error("bad"))));
  let els;
  try { els = await Promise.any(MIRRORS.slice(0, 2).map(ask)); } catch { els = await Promise.any(MIRRORS.slice(2).map(ask)); }
  return els.map((e) => {
    const g = e.tags || {};
    return shopRow(pt, { id: `${e.type[0]}${e.id}`, name: g.name, brand: g.brand, shop: g.shop, lat: e.lat ?? e.center?.lat, lon: e.lon ?? e.center?.lon,
      address: addrOf(g["addr:housenumber"], g["addr:street"], g["addr:city"], g["addr:state"], g["addr:postcode"]), zip: g["addr:postcode"],
      phone: g.phone || g["contact:phone"], website: g.website || g["contact:website"] });
  });
}
/** 备用：Photon（komoot 的 OpenStreetMap 搜索，免费、不用 key）按连锁店名字在方框里搜。只认得 CHAINS 里的连锁店，所以只当后备 */
async function photonChain(pt, mi, key) {
  const [s, w, n, e] = bbox(pt, mi);
  const u = `https://photon.komoot.io/api/?q=${encodeURIComponent(CHAINS[key].name)}&bbox=${w},${s},${e},${n}&lat=${pt.lat}&lon=${pt.lon}&limit=10&osm_tag=shop`;
  const j = await getJson(u, {}, 10000);
  return (j.features || []).map((f) => {
    const p = f.properties || {}, [lon, lat] = f.geometry?.coordinates || [];
    return shopRow(pt, { id: `${String(p.osm_type || "x")[0].toLowerCase()}${p.osm_id}`, name: p.name, shop: p.osm_value, lat, lon,
      address: addrOf(p.housenumber, p.street, p.city, p.state, p.postcode), zip: p.postcode });
  }).filter((x) => x.chain === key);
}
async function photonChains(pt, mi, keys) {
  const out = [];
  for (let i = 0; i < keys.length; i += 4) {   // 一次最多 4 个请求，别一下子压给公共服务
    const got = await Promise.allSettled(keys.slice(i, i + 4).map((k) => photonChain(pt, mi, k)));
    if (got.every((g) => g.status === "rejected")) { if (!out.length) throw got[0].reason; break; }   // 这一批全连不上（服务器挂了 / 网络挡了）：后面的不用再试
    got.forEach((g) => g.status === "fulfilled" && out.push(...g.value));
  }
  return out;
}
/** 再后备：Nominatim（OpenStreetMap 官方搜索）按连锁店名字搜。它要求一秒最多一次请求，所以一家一家慢慢问 */
async function nominatimChains(pt, mi, keys) {
  const [s, w, n, e] = bbox(pt, mi), out = [];
  for (const [i, k] of keys.entries()) {
    if (i) await new Promise((r) => setTimeout(r, 1100));
    const u = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=10&bounded=1&viewbox=${w},${n},${e},${s}&q=${encodeURIComponent(CHAINS[k].name)}`;
    let j; try { j = await getJson(u, {}, 10000); } catch (err) { if (!i) throw err; continue; }   // 第一家就连不上：别再问了
    for (const p of j || []) {
      if (p.category !== "shop") continue;
      const a = p.address || {};
      const row = shopRow(pt, { id: `${String(p.osm_type || "x")[0]}${p.osm_id}`, name: p.name, shop: p.type, lat: +p.lat, lon: +p.lon,
        address: addrOf(a.house_number, a.road, a.city || a.town || a.village, a.state, a.postcode), zip: a.postcode });
      if (row.chain === k) out.push(row);
    }
  }
  return out;
}
/** 常见连锁店：先问 Photon，连不上再问 Nominatim */
async function quickChains(pt, mi, keys) {
  try { const r = await photonChains(pt, mi, keys); if (r.length) return r; } catch { /* 换 Nominatim */ }
  return nominatimChains(pt, mi, keys);
}
export const MAX_MI = 30;
// 同一个地方、范围、分类，一周内不重复问地图服务（存在本机，最多记 6 次）
const NEAR_KEY = "hmh-shop-near", WEEK = 7 * 864e5;
const nearCache = () => { try { return JSON.parse(localStorage.getItem(NEAR_KEY) || "{}") || {}; } catch { return {}; } };
function putNear(key, rows) {
  try { const c = nearCache(); c[key] = { at: Date.now(), rows }; const keys = Object.keys(c).sort((a, b) => c[b].at - c[a].at).slice(0, 6);
    localStorage.setItem(NEAR_KEY, JSON.stringify(Object.fromEntries(keys.map((k) => [k, c[k]])))); } catch { /* 存不下就算了 */ }
}
const tidy = (rows, mi) => { const seen = new Set(); return rows.filter((x) => x.name && x.lat != null && x.dist <= mi && !seen.has(x.osm_id) && seen.add(x.osm_id)).sort((a, b) => a.dist - b.dist); };
/** 附近的门店：半径（英里）内、选中分类的，按距离排好。
 * 先问 Overpass（什么店都有）；它忙的时候改用 Photon 只找常见连锁店，结果带 partial = true。fresh = true 跳过本机缓存。 */
export async function searchNearby(pt, radiusMi, cats, { fresh = false, onQuick = null } = {}) {
  const mi = Math.min(MAX_MI, Math.max(1, Math.round(radiusMi) || 10));
  const key = `${pt.lat.toFixed(2)},${pt.lon.toFixed(2)}|${mi}|${[...(cats || [])].sort().join(",")}`;
  const hit = nearCache()[key];
  if (!fresh && hit && Date.now() - hit.at < WEEK) return Object.assign(hit.rows, { cached: hit.at, partial: !!hit.partial });
  // 同时开始：常见连锁店（快，几秒）+ Overpass 全部门店（慢，忙的时候会 502 / 504）；连锁店先给页面显示，Overpass 到了再换成完整的
  const keys = Object.keys(CHAINS).filter((k) => !cats?.length || cats.includes(CHAINS[k].cat));
  const quick = quickChains(pt, mi, keys).then((r) => { const t = Object.assign(tidy(r, mi), { partial: true }); if (t.length && onQuick) onQuick(t); return t; }).catch(() => []);
  let rows, partial = false;
  try { rows = tidy(await overpass(pt, mi, cats), mi); }
  catch { rows = await quick; partial = true; if (!rows.length) throw new Error("overpass"); }
  if (!partial) putNear(key, rows);
  return Object.assign(rows, { partial });
}
/** 第一次打开时加的那几家：直接用 Photon 按名字找最近的门店（每家一个轻量请求，比整片区域查询快、也不容易碰上服务器忙） */
export async function nearestChains(pt, keys, mi = 20) {
  let rows = [];
  try { rows = tidy(await quickChains(pt, mi, keys), mi); } catch { /* Photon、Nominatim 都连不上：下面改问 Overpass */ }
  if (keys.some((k) => !rows.some((r) => r.chain === k))) {   // 缺的几家用 Overpass 补（一次查完这几类店，再按连锁店挑最近的）
    const cats = [...new Set(keys.map((k) => CHAINS[k].cat))];
    try { rows = rows.concat(await searchNearby(pt, mi, cats)); } catch { if (!rows.length) throw new Error("overpass"); }
  }
  rows.sort((a, b) => a.dist - b.dist);
  return keys.map((k) => rows.find((r) => r.chain === k)).filter(Boolean);
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
    "valid_from / valid_to = the ad's dates as YYYY-MM-DD if shown (US order month/day); null if not shown. If items have their OWN dates (e.g. Costco member savings \"valid through 12/7\"), put them on each deal; the top-level dates are for the whole ad.",
    "deal_type = the kind of deal as a comma separated list of: black_friday, cyber_monday, holiday, weekly, instore, online, rollback, clearance, coupon, member, bogo, multi, limited (e.g. \"black_friday,online\" for a Black Friday online-only deal; \"rollback\" for Walmart Rollback; \"coupon\" for digital / clip coupons; \"member\" for club or card prices; \"multi\" for 2 for $5). Use what the ad says; null if nothing special.",
    `category = groceries, produce, meat, dairy, bakery, frozen, drinks, snacks, household, personal, baby, pet, pharmacy, hardware, auto, electronics, home or other.`,
    `Today is ${todayISO()}.`,
  ].join("\n");
  const user = [
    `Store: ${shop.name}${shop.address ? ` (${shop.address})` : ""}.`,
    open.length ? `Our shopping list (mention these first if they are on sale): ${open.join(", ")}` : "",
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
  "aka = 1–3 个通用叫法（逗号分开），要有一个中文，例如「鸡蛋, eggs」，用来和我的采购清单对上。",
  "有效期：整份广告统一的日期写在商店那一层的 valid_from / valid_to；每样东西有效期不一样的（比如 Costco 会员特价写着「Valid 11/12 – 12/7」），写在那一条特价自己的 valid_from / valid_to。看不到日期就写 null，不要猜——我的应用会按这家商店的换广告日自动补。",
  "deal_type = 折扣类型，按广告上写的，可以多个、逗号分开，只用这些：black_friday, cyber_monday, holiday, weekly, instore, online, rollback, clearance, coupon, member, bogo, multi, limited（Black Friday、Cyber Monday、节日、周广告、只限店内、只限网上、Walmart Rollback、清仓、电子券 / Clip coupon、会员价 / 会员卡价、买一送一、多件优惠如 2 for $5、限时）。没有特别说明的写 null。",
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
    list.length ? "" : (() => { const w = restockWatch(25), all = [...w.need, ...w.regular].slice(0, 40);
      return `重点：只要吃的、日用品（纸巾、洗涤、清洁）、宝宝用品；电视、家电、工具、玩具、衣服这些跳过。${all.length ? `家里常补的东西优先找：${all.join("、")}。` : ""}`; })(),
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
