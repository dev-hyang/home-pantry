import { $, du, esc, fmt, fmtShort, money, num, showQty, stampText, toDisp } from "../core/util.js";
import { FD, changed, clearFiltersBtn } from "../core/clear-filters.js";
import { lang, t } from "../core/i18n.js";
import { crumbNav } from "../core/hub.js";
import { href } from "../core/router.js";
import { pageLimit, pageMoreBtn } from "../core/pager.js";
import { shopAdviceHtml, shopForecastHtml } from "../bills/budget.js";
import { shopDealPicker, shopsStats } from "../shops/lite.js";
import { shopScanHtml } from "./shop-scan.js";
import { state } from "../core/state.js";
import { shopSelText, shopUnit } from "./shop-sync.js";
import { inState, isMine, shopRows } from "./shop-sync-common.js";
import { categoryOptions } from "./meals-sync.js";
import { cardSelectHtml } from "../bills/card-picker.js";
import { cardHintHtml } from "../bills/cards-review.js";
import { storeDatalist } from "../stats/store-lite.js";
import { lpAttr } from "../core/long-press.js";
import { viewShopAdd } from "./shop-add-page.js";

function shopQty(s) {
  const unit = shopUnit(s), d = du(unit), step = Units.step(d);
  const disp = fmt(toDisp(num(s.quantity, 1), unit));
  return `<span class="shop-qty" role="group" aria-label="${esc(t("{name} 数量", { name: s.name }))}">
    <button type="button" data-action="shop-qty" data-id="${s.id}" data-dir="-1" aria-label="${esc(t("{name} 减少 {q} {u}", { name: s.name, q: step, u: t(d) }))}">−</button>
    <input type="number" inputmode="decimal" min="${step}" step="${step}" value="${disp}" data-qty-for="${s.id}" aria-label="${esc(t("{name} 数量", { name: s.name }))}">
    <input type="text" class="unit-in" list="unitList" maxlength="10" value="${esc(t(d))}" data-unit-for="${s.id}" placeholder="${esc(t("单位"))}" aria-label="${esc(t("{name} 单位", { name: s.name }))}">
    <button type="button" data-action="shop-qty" data-id="${s.id}" data-dir="1" aria-label="${esc(t("{name} 增加 {q} {u}", { name: s.name, q: step, u: t(d) }))}">+</button>
  </span>`;
}
const SHOP_SORTS = [["new", "最近加入的在前"], ["old", "加入最久的在前"], ["name", "名称 A → Z"], ["cat", "按分类"]];
const shopCat = (s) => state.items.find((i) => i.id === s.item_id)?.category || s.category || "other";
/* 采购（2026-11-13 重新设计）：#/shopping 是看板首页（几个数字 + 录入入口 + 待买预览），
 * #/shopping/list 是完整清单（搜索 + 状态 / 分类 / 排序下拉，默认加入最久的在前），#/shopping/add 是「加入清单」页（手动 / 拍照）。
 * 看板上的格子带 ?st=… 进清单页：进来时设好状态筛选，再把参数去掉（之后由下拉框说了算） */
const SHOP_STATES = [["open", "全部未买"], ["todo", "尚未认领"], ["claimed", "已认领"], ["mine", "我认领的"], ["bought", "已买到"], ["all", "全部（含已买到）"]];
const whoName = (s) => s.claimed_by_name || (isMine(s) ? t("我") : t("家人"));
const listHref = (st) => href("shopping", "list", st && st !== "open" ? `?st=${st}` : "");
function shopToolbar() {
  const f = state.shopFilter, opt = (v, l, c) => `<option value="${esc(v)}" ${c === v ? "selected" : ""}>${esc(l)}</option>`;
  const cats = [...new Set(state.shopping.map(shopCat))];
  const n = (st) => state.shopping.filter(inState(st)).length;
  return `<div class="toolbar shop-toolbar">
    <label class="shop-q"><span class="sr-only">${t("搜索购物车")}</span><input type="search" id="shopQ" value="${esc(f.q || "")}" placeholder="${esc(t("搜索要买的东西"))}" autocomplete="off"></label>
    <select id="shopSt" aria-label="${t("按状态筛选")}">${SHOP_STATES.map(([v, l]) => opt(v, `${t(l)}${lang === "en" ? ` (${n(v)})` : `（${n(v)}）`}`, f.st)).join("")}</select>
    <select id="shopCat" data-search aria-label="${t("按分类筛选")}">${opt("all", t("全部分类"), f.cat)}${cats.map((c) => opt(c, `${(window.CATEGORIES.find((x) => x.id === c) || OTHER_CAT).icon || ""} ${t((window.CATEGORIES.find((x) => x.id === c) || OTHER_CAT).name)}`.trim(), f.cat)).join("")}</select>
    <select id="shopSort" aria-label="${t("排序")}">${SHOP_SORTS.map(([v, l]) => opt(v, t(l), f.sort)).join("")}</select>${clearFiltersBtn("shop", changed(f, FD.shop))}</div>`;
}
/** 清单本身（搜索框输入时只重画这一块，光标不跳） */
function shopListBody() {
  const f = state.shopFilter, rows = shopRows(), key = `shop:${f.st}`, lim = pageLimit(key, JSON.stringify(f));
  const empty = f.q ? t("没找到「{q}」。", { q: f.q }) : { open: t("没有待买的东西。"), todo: t("都有人认领了。"), claimed: t("点“我来买”认领，家人就不会重复买。"), mine: t("你还没有认领要买的东西。"), bought: t("买到后自动加回库存。"), all: t("购物车是空的。") }[f.st] || "";
  const bought = f.st === "bought" || f.st === "all" ? state.shopping.some((s) => s.status === "bought") : false;
  return `<div class="shop-list-meta" data-n="${rows.length}">${bought ? `<button type="button" class="btn btn-sm btn-ghost" data-action="shop-clear">${t("清空已买到")}</button>` : ""}</div>
    ${rows.length ? `<ul class="shop-list">${rows.slice(0, lim).map(shopRowHtml).join("")}</ul>${pageMoreBtn(key, rows.length, lim)}` : `<p class="muted shops-empty">${esc(empty)}</p>`}`;
}
export function renderShopList() { const box = $("#shopListBox"); if (box) box.innerHTML = shopListBody(); shopCount(); }
/** 购物车标题旁的「n 项」：跟着筛选 / 搜索变 */
function shopCount() { const n = $("#shopListBox .shop-list-meta")?.dataset.n, el = $("#shopN"); if (el && n != null) el.textContent = t("{n} 项", { n }); }
/* 从别的应用带来的采购项（2026-11，牧羊人的饮食模版「加进爱家购物车」）：#/shopping?add=燕麦|糙米|…&from=DASH 低钠
 * 牧羊人是另一个 Supabase 项目，只能把名字放在网址里带过来；这里列出来勾选确认后才加，已在清单里（待买 / 在买）的默认不勾 */
export const importNames = () => { const raw = state.route?.q?.get("add"); return raw ? [...new Set(raw.split("|").map((s) => s.trim().slice(0, 60)).filter(Boolean))].slice(0, 40) : []; };
export { shopSelText, shopUnit, shopVisibleIds } from "./shop-sync.js";
function shopImportHtml() {
  const names = importNames(); if (!names.length) return "";
  const open = new Set(state.shopping.filter((s) => s.status !== "bought").map((s) => String(s.name).trim().toLowerCase()));
  const from = state.route.q.get("from") || "";
  return `<div class="panel shop-import" id="shopImport" role="region" aria-label="${esc(t("从别的应用带来的采购项"))}">
    <b>🐑 ${from ? t("来自牧羊人 · {n}", { n: from }) : t("来自牧羊人")}</b><p class="muted" style="margin:4px 0 8px;font-size:13px">${t("勾选要买的，再点「加进购物车」。已经在清单里的默认不勾。")}</p>
    <div class="shop-import-list">${names.map((n) => { const dup = open.has(n.toLowerCase()); return `<label class="check-inline"><input type="checkbox" value="${esc(n)}" ${dup ? "" : "checked"}><span>${esc(n)}${dup ? ` <small class="muted">${t("已在清单里")}</small>` : ""}</span></label>`; }).join("")}</div>
    <div class="form-actions" style="margin-top:8px"><button type="button" class="btn btn-primary btn-sm" data-action="shop-import">${t("加进购物车")}</button><button type="button" class="btn btn-ghost btn-sm" data-action="shop-import-cancel">${t("不用了")}</button></div></div>`;
}
function shopRowHtml(s) {
  const mine = isMine(s);
  let acts = "";
  if (s.status === "todo") acts = `<button type="button" class="btn btn-sm btn-dark" data-action="shop-claim" data-id="${s.id}">${t("我来买")}</button>
    <button type="button" class="btn btn-sm btn-primary" data-action="shop-bought" data-id="${s.id}">${t("已买到")}</button>`;
  if (s.status === "claimed") acts = `${mine ? `<button type="button" class="btn btn-sm btn-ghost" data-action="shop-unclaim" data-id="${s.id}">${t("取消认领")}</button>` : ""}
    <button type="button" class="btn btn-sm btn-primary" data-action="shop-bought" data-id="${s.id}">${t("已买到")}</button>`;
  const priceBox = s.status === "bought" ? (s.amount != null ? `<div class="muted" style="font-size:12px">${t("花费 {m}", { m: money(num(s.amount)) })}</div>` : "")
    : `<div class="price-in">
        <input type="number" min="0" step="0.01" inputmode="decimal" data-price-for="${s.id}" data-keep="price-${s.id}" placeholder="${esc(t("花费 {sym}（可不填）", { sym: Units.money(0).replace(/[\d.,\s]/g, "") }))}" aria-label="${esc(t("{name} 实际花费", { name: s.name }))}">
        <input type="text" maxlength="40" list="storeList" data-store-for="${s.id}" data-keep="store-${s.id}" placeholder="${t("在哪买（可不填）")}" aria-label="${esc(t("{name} 购买商店", { name: s.name }))}">
        ${cardSelectHtml("card_id", undefined, `data-card-for="${s.id}" data-keep="card-${s.id}"`)}
      </div>`;
  const when = s.status === "bought" && s.bought_at ? t("{d} 买到", { d: fmtShort(s.bought_at) }) : s.created_at ? t("{d} 加入", { d: fmtShort(s.created_at) }) : "";
  // 左滑删除；没买到的还能右滑「已买到」（先确认）。右滑替下面隐藏的 swipe-alt-src 点一下（带 data-confirm，按钮本身点了不弹框）
  const sel = state.shopSel, picked = sel?.has(s.id);
  const swipe = sel ? ` data-row-sel-shop="${s.id}"` : ` data-swipe-del="shop"${s.status === "bought" ? "" : ` data-swipe-alt="shop" data-swipe-alt-label="${esc(t("已买到"))}" data-swipe-alt-go="${esc(t("松手买到"))}"`}`;   // 多选时不滑动，点行 = 勾选
  // 2026-11-15 卡片排版：上面 名称 + 「xx-xx 加入」；名称下 💳 建议用哪张卡 / 谁在买 / 特价；花费·在哪买·付款方式折叠成「记一笔花费（可选）」
  // （字段都还在：点「已买到」时照旧拿来记花费，特价选店也照旧填「在哪买」）；最下面一行 左：我来买 / 已买到，右：数量 − n 单位 +
  const cat = s.category || state.items.find((i) => i.id === s.item_id)?.category;
  const spend = s.status === "bought" ? priceBox
    : `<details class="si-spend"><summary>💰 ${t("记一笔花费（可选）")}</summary>${priceBox}</details>`;
  return `<li class="shop-item ${s.status === "bought" ? "done" : ""}${picked ? " is-picked" : ""}"${swipe}${sel ? "" : ` ${lpAttr([s.status === "todo" ? { label: t("我来买"), action: "shop-claim", data: { id: s.id }, first: true } : null, s.status === "claimed" && mine ? { label: t("取消认领"), action: "shop-unclaim", data: { id: s.id }, first: true } : null, s.status === "bought" ? null : { label: t("已买到"), action: "shop-bought", data: { id: s.id } }, { label: t("删除"), action: "shop-del", data: { id: s.id }, danger: true }], s.name)}`}>
    <div class="si-top">${sel ? `<input type="checkbox" class="shop-chk" data-id="${s.id}" ${picked ? "checked" : ""} aria-label="${esc(t("选择 {name}", { name: s.name }))}">` : ""}<b class="si-name">${esc(s.name)}</b>${when ? `<small class="si-when muted" title="${esc(stampText(s))}">${when}</small>` : ""}
      <button type="button" class="btn btn-sm btn-ghost swipe-src" data-action="shop-del" data-id="${s.id}" aria-label="${esc(t("删除 {name}", { name: s.name }))}">${t("删除")}</button>${s.status === "bought" ? "" : `<button type="button" class="btn btn-sm btn-ghost swipe-alt-src" data-action="shop-bought" data-id="${s.id}" data-confirm="1" aria-label="${esc(t("{name} 已买到", { name: s.name }))}">${t("已买到")}</button>`}</div>
    ${s.status === "bought" ? "" : `<div class="card-hint-slot">${cardHintHtml(cat, "")}</div>`}
    ${s.status === "claimed" ? `<div class="who">🛍 ${t("{who} 正在买", { who: esc(whoName(s)) })}</div>` : ""}
    ${s.status === "bought" ? (s.claimed_by_name ? `<div class="who">✅ ${t("{who} 买到的", { who: esc(s.claimed_by_name) })}</div>` : "") : shopDealPicker(s)}
    ${s.item_id ? "" : `<div class="muted si-note">${t("未关联库存，买到后需手动入库")}</div>`}
    ${spend}
    <div class="si-bottom">${acts ? `<div class="acts">${acts}</div>` : "<span></span>"}<div class="si-qty">${s.status === "bought" ? showQty(num(s.quantity, 1), shopUnit(s)) : shopQty(s)}</div></div>
  </li>`;
}
/** 看板上的数字：未买（尚未认领 / 已认领 / 谁认领了几样）、近 30 天买到和花费 */
function shopStats() {
  const open = state.shopping.filter((s) => s.status !== "bought"), claimed = open.filter((s) => s.status === "claimed");
  const since = Date.now() - 30 * 864e5;
  const recent = state.shopping.filter((s) => s.status === "bought" && Date.parse(s.bought_at || s.created_at || 0) >= since);
  const byWho = new Map();
  for (const s of claimed) { const w = whoName(s); byWho.set(w, (byWho.get(w) || 0) + 1); }
  return { open: open.length, todo: open.length - claimed.length, claimed: claimed.length, byWho,
    recent: recent.length, spent: recent.reduce((a, s) => a + num(s.amount, 0), 0), priced: recent.some((s) => s.amount != null) };
}
const tile = (to, icon, label, big, sub) => `<a class="panel sd-tile" href="${to}">
  <span class="sd-top"><span class="sd-ico" aria-hidden="true">${icon}</span><span class="sd-lbl">${label}</span><span class="mch" aria-hidden="true">›</span></span>
  <span class="sd-big">${big}</span><span class="sd-sub">${sub}</span></a>`;
function viewShopHome() {
  const st = shopStats(), sh = shopsStats();
  const who = [...st.byWho].map(([w, n]) => `${esc(w)} ${n}`).join(" · ");
  return `<section class="section shop-home">
    <div class="section-head"><h2>${t("采购")}</h2></div>
    ${shopImportHtml()}
    <div class="sd-acts" role="group" aria-label="${esc(t("录入"))}">
      <div class="sd-grp"><span class="sd-grp-t">${t("买回来了，录入库存")}</span>
        <a class="btn" href="${href("pantry", "scan")}">🧾 ${t("拍小票 / 网购订单入库")}</a></div>
    </div>
    ${shopAdviceHtml()}
    <div class="sd-grid sd-n5">
      ${tile(listHref("open"), "🛒", t("待购买"), `${st.open}<small>${t("项")}</small>`, `<span class="nw">${t("{n} 尚未认领", { n: st.todo })}</span> · <span class="nw">${t("{n} 已认领", { n: st.claimed })}</span>`)}
      ${tile(listHref("claimed"), "🛍", t("家人认领"), `${st.claimed}<small>${t("项")}</small>`, st.claimed ? who : t("点“我来买”认领，家人就不会重复买。"))}
      ${tile(href("shops", "list"), "🏪", t("常去的商店"), sh.shops ? `${sh.shops}<small>${t("家")}</small>` : "—",
        sh.shops ? (sh.due ? `<em>${t("{n} 家待更新", { n: sh.due })}</em><span class="sd-hitnames">${esc(sh.dueNames.slice(0, 4).join("、"))}${sh.due > 4 ? "…" : ""}</span>` : t("特价都是最新的")) : t("放进常去的超市，看本周特价、哪家最便宜"))}
      ${tile(sh.items ? `${href("shops", "deals")}?f=list` : href("shops", "deals"), "🏷", t("商店特价一览"), sh.shops ? `${sh.items}<small>${t("样清单上的有特价")}</small>` : "—",
        sh.shops ? [sh.items ? `<span class="sd-hitnames">${esc(sh.itemNames.slice(0, 4).join("、"))}${sh.items > 4 ? "…" : ""}</span>` : "", t("{n} 家", { n: sh.shops }), t("特价 {n} 项", { n: sh.deals }), sh.due ? `<em>${t("{n} 家待更新", { n: sh.due })}</em>` : ""].filter(Boolean).map((x) => `<span class="nw">${x}</span>`).join(" · ") : t("放进常去的超市，看本周特价、哪家最便宜"))}
      ${tile(listHref("bought"), "✅", t("近 30 天买到"), `${st.recent}<small>${t("项")}</small>`, st.priced ? t("花费 {m}", { m: money(st.spent) }) : t("买到后自动加回库存。"))}
    </div>
    ${shopForecastHtml()}
  </section>`;
}
function viewShopList() {
  const st = state.route?.q?.get("st");
  if (st && SHOP_STATES.some(([k]) => k === st)) { state.shopFilter.st = st; state.route.q.delete("st"); history.replaceState(null, "", href("shopping", "list")); }
  return `<section class="section shop-list-page">
    ${crumbNav([{ href: href("shopping"), label: t("采购") }, { label: t("购物车"), icon: "🛒" }])}
    <div class="section-head"><h2>${t("购物车")} <span class="muted shop-n" id="shopN">${t("{n} 项", { n: shopRows().length })}</span></h2>
      <div class="head-acts"><button type="button" class="btn btn-sm ${state.shopSel ? "btn-primary" : "btn-ghost"}" data-action="shop-select" aria-pressed="${!!state.shopSel}">${state.shopSel ? t("完成") : `☑ ${t("多选")}`}</button></div></div>
    ${state.shopSel ? "" : `<p class="muted rs-hint shop-hint"><span class="rs-hint-touch">${t("← 左滑删除 · 右滑标成已买到 →")}</span><span class="rs-hint-mouse">${t("在一项上往左拖删除，往右拖标成已买到；也可以点下面的按钮")}</span></p>`}
    ${shopToolbar()}
    ${storeDatalist()}
    <div id="shopListBox">${shopListBody()}</div>
    ${state.shopSel ? "" : `<a class="fab" href="${href("shopping", "add")}" aria-label="${esc(t("添加要买的东西"))}" title="${esc(t("添加要买的东西"))}"><span aria-hidden="true">＋</span></a>`}
    ${state.shopSel ? `<div class="inv-selbar shop-selbar" role="toolbar" aria-label="${esc(t("多选操作"))}">
      <span class="inv-seln" aria-live="polite">${esc(shopSelText())}</span>
      <button type="button" class="btn btn-sm btn-ghost" data-action="shop-sel-all">${t("全选")}</button><span class="spacer"></span>
      <button type="button" class="btn btn-sm btn-danger-ghost" data-action="shop-sel-remove" ${state.shopSel.size ? "" : "disabled"}>${t("移出购物车")}</button></div>` : ""}
  </section>`;
}
/** 采购：#/shopping（看板）、#/shopping/list、#/shopping/add；储藏 → 采购（#/pantry/shopping）也是看板 */
export function viewShopping() {
  const sub = state.route?.section === "shopping" ? state.route.sub : "home";
  return sub === "list" ? viewShopList() : sub === "add" ? viewShopAdd() : viewShopHome();
}
