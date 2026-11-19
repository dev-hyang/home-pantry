/* 商店：特价的有效期、待更新、对上购物车。 */
import { miles, savedZip } from "./location-logic.js";
import { normName } from "../core/item-match.js";
import { spendSuggestions } from "../core/spend-data.js";
import { state } from "../core/state.js";
import { todayISO } from "../core/util.js";
import { chainOf } from "./logic-common.js";

/* ───────────── 特价：有效期、待更新、对上购物车 ───────────── */
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
/** 特价留多久：过期 6 个月内的留着看「以前的价格」，更早的自动删掉 */
export const HIST_DAYS = 183;
export const histSince = () => { const d = new Date(); d.setDate(d.getDate() - HIST_DAYS); return isoDay(d); };
/** 换新一期广告时，这家现有的特价哪些要替换掉：没写到期的、在这一期结束前到期的、新广告里又出现的（同名）。
 *  到期比这一期还晚的（Costco 会员价「到 12/7」这类）新广告里没有就留着。非每周的店：这一期 = 新特价里最晚的到期日；都没日期就全部替换 */
export function replaceable(shop, rows) {
  const names = new Set(rows.map((r) => normName(r.name || "")).filter(Boolean));
  const end = weekWindow(shop).valid_to || rows.map((r) => r.valid_to).filter(Boolean).sort().pop() || null;
  return liveDeals(shop?.id).filter((d) => !end || !d.valid_to || d.valid_to <= end || names.has(normName(d.name)));
}
/** 一条特价的比较键：名称、通用叫法（中英文）、品牌 */
export const dealKeys = (d) => [d.name, ...(String(d.aka || "").split(/[,，、/]/))].map(normName).filter((k) => k.length >= 2);
const hit = (keys, k) => keys.some((x) => x.includes(k) || (k.length >= 3 && k.includes(x)));
/** 这条特价对上了购物车里哪几项（待买 / 正在买）；清单项连着库存物品时，物品的别名也算 */
export function dealMatches(d, open = openShopping()) {
  const keys = dealKeys(d);
  return open.filter((s) => s.keys.some((k) => hit(keys, k)));
}
export function openShopping() {
  const alias = state.itemAliases || [];
  return (state.shopping || []).filter((s) => s.status !== "bought").map((s) => ({ ...s, keys: [s.name, ...alias.filter((a) => a.item_id && a.item_id === s.item_id).map((a) => a.alias)].map(normName).filter((k) => k.length >= 2) }));
}
/** 购物车里某一项现在最便宜的特价（各家都算），没有返回 null */
export function bestDealFor(s) {
  const list = dealsFor(s); if (!list.length) return null;
  return { deal: list[0], shop: (state.shops || []).find((x) => x.id === list[0].shop_id), n: list.length };
}
const itemKeys = (s) => [s.name, ...(state.itemAliases || []).filter((a) => a.item_id && a.item_id === s.item_id).map((a) => a.alias)].map(normName).filter((k) => k.length >= 2);
/** 购物车某一项对得上的全部特价（常去的商店、有效期内），按比价规则排好（第一条 = 默认显示的那条） */
export function dealsFor(s) {
  const keys = itemKeys(s); if (!keys.length) return [];
  const on = new Set((state.shops || []).filter((x) => !x.archived).map((x) => x.id));
  return rankDeals(liveDeals().filter((d) => on.has(d.shop_id) && keys.some((k) => hit(dealKeys(d), k))), s);
}
/** 比价规则（2026-11-14 用户定：单价为主）：
 *  ① 有单价、而且是最常见的那种单位（/oz、/ct…）的按单价排；和最低单价差 5% 以内算「差不多」，这几条再按：
 *     清单上写的牌子 → 常去的商店（近 400 天在那家买的次数）→ 离家近；
 *  ② 只有价格、没单价（或单位不一样）的排在后面，按价格；
 *  ③ 只写了「省 $X」、没有价格的最后，按常去的商店、远近。
 *  返回排好的数组；数组的 why 是第一条为什么排第一：unit / brand / freq / near / price / none */
const TIE = 0.05;
export function rankDeals(list, s = null) {
  const shops = new Map((state.shops || []).map((x) => [x.id, x]));
  const freq = new Map();
  (spendSuggestions().stores || []).forEach((name, i) => { for (const k of [chainOf(name), normName(name)]) if (k && !freq.has(k)) freq.set(k, i); });
  const shopRank = (d) => { const sh = shops.get(d.shop_id); return (sh && (freq.get(sh.chain || "") ?? freq.get(normName(sh.name)))) ?? 999; };
  const pt = savedZip(), dist = (d) => miles(pt, shops.get(d.shop_id)) ?? 999;
  const want = s ? itemKeys(s).join(" ") : "";
  const brand = (d) => (d.brand && want && want.includes(normName(d.brand)) ? 0 : 1);
  const tieKey = (a, b) => brand(a) - brand(b) || shopRank(a) - shopRank(b) || dist(a) - dist(b);
  const labels = {}; for (const d of list) if (d.unit_price != null && d.unit_label) labels[d.unit_label] = (labels[d.unit_label] || 0) + 1;
  const main = Object.keys(labels).sort((a, b) => labels[b] - labels[a])[0];
  const A = list.filter((d) => d.unit_price != null && d.unit_label === main).sort((a, b) => a.unit_price - b.unit_price);
  const best = A[0]?.unit_price;
  const tie = A.filter((d) => d.unit_price <= best * (1 + TIE) + 1e-9).sort(tieKey), restA = A.filter((d) => !tie.includes(d));
  const B = list.filter((d) => !A.includes(d) && d.price != null).sort((a, b) => a.price - b.price || tieKey(a, b));
  const C = list.filter((d) => !A.includes(d) && d.price == null).sort(tieKey);
  const out = [...tie, ...restA, ...B, ...C];
  const top = out[0];
  // 第一条为什么排第一：和「差不多」里的下一条比，是哪一项分出了先后
  const next = tie[1];
  out.why = !top ? "" : !A.includes(top) ? (B.includes(top) ? "price" : "none")
    : !next ? "unit" : brand(top) < brand(next) ? "brand" : shopRank(top) < shopRank(next) ? "freq" : dist(top) < dist(next) ? "near" : "unit";
  return out;
}
