/* 常去的商店里「启动时就要用」的几个小函数：读商店和特价（刷新数据时）、储藏页里每件物品旁边的特价提示和选择器、商店统计。商店页本身（shops/views.js）点开才加载。 */
import { Store } from "../core/store.js";
import { dealMatches, dealsDue, dealsFor, histSince, liveDeals, openShopping } from "./logic.js";
import { esc, fmtShort, money } from "../core/util.js";
import { href } from "../core/router.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";

/** 过期超过 6 个月的特价：每台设备一天最多删一次（后台进行，失败不影响页面） */
function purgeOld(before) {
  const key = "hp-deal-purge", today = new Date().toISOString().slice(0, 10);
  try { if (localStorage.getItem(key) === today) return; localStorage.setItem(key, today); } catch { return; }
  Store.purgeShopDeals?.(before).catch((e) => console.warn("[shops] purge", e.message));
}
/* ───────────── 数据：和其他表一起刷新，读不到（还没执行 067）时给提示 ───────────── */
export async function loadShops() {
  try {
    const since = histSince();   // 过期 6 个月内的也读：特价旁边显示「以前的价格」
    purgeOld(since);
    const [shops, deals] = await Promise.all([Store.listShops(), Store.listShopDeals(since)]);
    state.shops = shops || []; state.shopDeals = deals || []; state.shopsMissing = false;
    try { state.dealRuns = await Store.listDealRuns(); state.runsMissing = false; } catch { state.dealRuns = []; state.runsMissing = true; }
  } catch (e) {
    if (/shops|shop_deals|does not exist|schema cache/i.test(e.message || "")) { state.shopsMissing = true; state.shops = []; state.shopDeals = []; }
    else console.warn("[shops]", e.message);
  }
}
/** 单价常常不到一毛（$0.023 /fl oz）：小于 1 时多留一位小数，不然都显示成 $0.02 */
export const unitMoney = (v) => (v >= 1 ? money(v) : money(0).replace(/0([.,])00/, `0$1${v.toFixed(3).slice(2)}`));
export const shopName = (id) => (state.shops || []).find((x) => x.id === id)?.name || "?";
/* ───────────── 购物车里用到的小块 ───────────── */
/** 清单某一项现在最便宜的特价：「🏷 ALDI $2.49 · 到 11/18」 */
export function shopDealLine(s) {
  if (!state.shops?.length) return "";
  const list = dealsFor(s); if (!list.length) return "";
  const d = pickedDeal(s, list) || list[0];
  return `<a class="shop-deal-line" href="${dealsHref(s.id)}">🏷 ${esc(shopName(d.shop_id))} ${d.price != null ? money(d.price) : esc(d.price_text || "")}${d.size ? ` <small>${esc(d.size)}</small>` : ""}${d.valid_to ? ` · ${t("到 {d}", { d: fmtShort(d.valid_to) })}` : ""}${list.length > 1 ? ` · ${t("另有 {n} 家", { n: list.length - 1 })}` : ""}</a>`;
}
/* ───────────── 购物车的特价：选用哪一家（下拉）+ 比一比（特价一览，只看这一项） ───────────── */
const dealsHref = (itemId) => `${href("shops", "deals")}${itemId ? `?item=${encodeURIComponent(itemId)}` : ""}`;
export const PICK_KEY = "hp-deal-pick";
   // 没执行 069（没有 deal_id 列）时，选的那家先记在这台设备上
export const localPicks = () => { try { return JSON.parse(localStorage.getItem(PICK_KEY) || "{}") || {}; } catch { return {}; } };
/** 这一项选用的那条特价（还在有效期、还对得上才算）；没选返回 null */
export function pickedDeal(s, list = dealsFor(s)) { const id = s.deal_id || localPicks()[s.id]; return (id && list.find((d) => d.id === id)) || null; }
export const priceTxt = (d) => (d.price != null ? money(d.price) : d.price_text || "—");
const dealLabel = (d) => [shopName(d.shop_id), priceTxt(d), d.unit_price != null ? `${unitMoney(+d.unit_price)}${d.unit_label || ""}` : "", d.size || "", d.valid_to ? t("到 {d}", { d: fmtShort(d.valid_to) }) : ""].filter(Boolean).join(" · ");
export const WHY = { unit: "单价最低", brand: "单价差不多，是清单上写的牌子", freq: "单价差不多，你常去这家", near: "单价差不多，离家更近", price: "没有单价，按价格最低", none: "只写了「省多少」，按常去的商店排" };
/** 购物车一行里的特价：下拉选一家（默认按比价规则的第一条）+「比一比」进特价一览 */
export function shopDealPicker(s) {
  if (!state.shops?.length || s.status === "bought") return "";
  const list = dealsFor(s); if (!list.length) return "";
  const pick = pickedDeal(s, list), cur = pick || list[0];
  return `<div class="deal-pick"><span class="deal-pick-ico" aria-hidden="true">🏷</span>
    <select data-deal-pick="${s.id}" data-nosearch aria-label="${esc(t("{name} 的特价：选一家", { name: s.name }))}" title="${esc(pick ? t("你选的这家") : t("默认：{why}", { why: t(WHY[list.why] || WHY.unit) }))}">${list.map((d, i) => `<option value="${d.id}" ${d.id === cur.id ? "selected" : ""}>${esc(dealLabel(d))}${i === 0 ? " ★" : ""}</option>`).join("")}</select>
    <a class="deal-pick-all" href="${dealsHref(s.id)}">${t("比一比 {n}", { n: list.length })} ›</a></div>`;
}
/** 采购看板上「常去的商店与特价」那一格的数字：几家常去、几条在有效期的特价、几条对上清单、几家待更新 */
export function shopsStats() {
  const shops = (state.shops || []).filter((s) => !s.archived), ids = new Set(shops.map((s) => s.id));
  const live = liveDeals().filter((d) => ids.has(d.shop_id)), open = openShopping();
  // 2026-11-14：看板上数的是「清单上有几样东西有特价」（不是特价条数），并列出是哪几样
  const items = open.filter((s) => dealsFor(s).length);
  return { shops: shops.length, deals: live.length, hits: open.length ? live.filter((d) => dealMatches(d, open).length).length : 0, items: items.length, itemNames: items.map((s) => s.name), due: shops.filter(dealsDue).length, dueNames: shops.filter(dealsDue).map((x) => x.name) };
}
