/* 商店：位置（ZIP → 经纬度，按距离找门店）。 */
import { CHAINS, chainOf } from "./logic.js";

/* ───────────── 位置：ZIP → 经纬度，按距离找门店 ───────────── */
const R_MI = 3958.8;
export function miles(a, b) {
  if (a?.lat == null || b?.lat == null) return null;
  const r = (x) => (x * Math.PI) / 180, dLat = r(b.lat - a.lat), dLon = r(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_MI * Math.asin(Math.sqrt(h));
}
const ZIP_KEY = "hmh-shop-zip";
export function savedZip() { try { return JSON.parse(localStorage.getItem(ZIP_KEY) || "null"); } catch { return null; } }
   // { zip, lat, lon, place }
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
