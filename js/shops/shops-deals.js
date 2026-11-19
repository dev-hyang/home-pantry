/* 特价一览：以商品为主（各家的特价放在一起比），列表 / 卡片两种看法。 */
import { DEAL_TYPES, dealCatName, dealMatches, dealTypeName, dealsFor, liveDeals, openShopping, priceHistory, rankDeals } from "./logic.js";
import { WHY, pickedDeal, priceTxt, shopName, unitMoney } from "./lite.js";
import { crumbNav } from "../core/hub.js";
import { esc, fmtShort, money } from "../core/util.js";
import { href } from "../core/router.js";
import { lang, t } from "../core/i18n.js";
import { normName } from "../core/item-match.js";
import { state } from "../core/state.js";
import { typeTags } from "./shop-detail.js";
import { shopHref, ui } from "./shops-common.js";
import { clearActionBtn } from "../core/clear-filters.js";

/* ───────────── 特价一览：以商品为主（各家的特价放在一起比），列表 / 卡片两种看法；?item= 只看购物车的某一项 ───────────── */
const DV_SORTS = [["best", "推荐"], ["unit", "按单价"], ["price", "按价格"], ["soon", "快到期的在前"], ["shop", "按商店"]];
export function dvUi() {
  const u = ui();
  if (!u.dv) { let mode = "group"; try { mode = localStorage.getItem("hp-dv-mode") || "group"; } catch { /* 忽略 */ } u.dv = { q: "", shop: "", cat: "", type: "", f: "all", sort: "best", mode, hash: "" }; }
  const v = u.dv;
  if (v.hash !== location.hash) {   // 从别处点进来（看板的「对上清单」、清单的「比一比」）：按链接上的条件重新开始
    v.hash = location.hash; const q = state.route.q;
    Object.assign(v, { q: q.get("q") || "", shop: "", cat: "", type: "", f: q.get("f") === "list" ? "list" : "all", sort: q.get("item") ? "best" : q.get("f") === "list" ? "best" : "unit" });
  }
  return v;
}
export function viewDeals() {
  const v = dvUi(), itemId = state.route.q.get("item"), item = itemId ? (state.shopping || []).find((x) => x.id === itemId) : null;
  const on = new Map((state.shops || []).filter((x) => !x.archived).map((x) => [x.id, x])), open = openShopping();
  const base = item ? dealsFor(item) : liveDeals().filter((d) => on.has(d.shop_id));
  const hits = new Map(base.map((d) => [d.id, item ? [] : dealMatches(d, open)]));
  const typeOf = (d) => String(d.deal_type || "").split(",").filter(Boolean);
  const q = v.q.trim().toLowerCase();
  let list = base.filter((d) => (!v.shop || d.shop_id === v.shop) && (!v.cat || d.category === v.cat) && (!v.type || typeOf(d).includes(v.type))
    && (item || v.f !== "list" || hits.get(d.id).length) && (!q || `${d.name} ${d.brand || ""} ${d.aka || ""} ${on.get(d.shop_id)?.name || ""}`.toLowerCase().includes(q)));
  const unitCmp = (a, b) => (a.unit_price == null) - (b.unit_price == null) || (a.unit_label || "").localeCompare(b.unit_label || "") || (a.unit_price ?? 1e9) - (b.unit_price ?? 1e9);
  const sorters = { unit: unitCmp, price: (a, b) => (a.price ?? 1e9) - (b.price ?? 1e9), soon: (a, b) => String(a.valid_to || "9999").localeCompare(String(b.valid_to || "9999")), shop: (a, b) => shopName(a.shop_id).localeCompare(shopName(b.shop_id)) || unitCmp(a, b) };
  if (v.sort === "best") list = item ? list : (v.f === "list" ? groupByItem(list, hits) : rankDeals(list)); else list = [...list].sort(sorters[v.sort] || unitCmp);
  const picked = item ? pickedDeal(item, base) : null, top = item ? base[0] : null;
  const shopsWith = [...new Set(base.map((d) => d.shop_id))].map((id) => on.get(id)).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
  const cats = [...new Set(base.map((d) => d.category).filter(Boolean))].sort(), types = DEAL_TYPES.map(([k]) => k).filter((k) => base.some((d) => typeOf(d).includes(k)));
  const cnt = (n) => (lang === "en" ? ` (${n})` : `（${n}）`);
  const crumbs = item ? [{ href: href("shopping"), label: t("采购") }, { label: t("「{name}」的特价", { name: item.name }) }]
    : [{ href: href("shopping"), label: t("采购") }, { href: href("shops", "list"), label: t("常去的商店") }, { label: t("特价一览"), icon: "🏷" }];
  const act = (d) => {
    if (item) { const on2 = picked ? picked.id === d.id : false; return `<button type="button" class="btn btn-sm ${on2 ? "btn-primary" : ""}" data-action="shops-pick" data-item="${item.id}" data-deal="${d.id}" aria-pressed="${on2}">${on2 ? `✓ ${t("已选这家")}` : t("用这家")}</button>`; }
    const m = hits.get(d.id) || [];
    return m.length ? `<span class="tag tag-hot">${t("清单里有：{n}", { n: m.map((x) => esc(x.name)).join("、") })}</span>` : `<button type="button" class="btn btn-sm btn-ghost" data-action="shops-tolist" data-deal="${d.id}">＋ ${t("清单")}</button>`;
  };
  const badge = (d) => (item && !picked && top && d.id === top.id ? `<span class="tag tag-ok" title="${esc(t(WHY[base.why] || WHY.unit))}">★ ${t("默认")}</span>` : priceHistory(d)?.isLow ? `<span class="tag tag-ok">${t("6 个月最低")}</span>` : "");
  const unitTxt = (d) => (d.unit_price != null ? `${unitMoney(+d.unit_price)}<small>${esc(d.unit_label || "")}</small>` : `<small class="muted">—</small>`);
  const isOn = (d) => (picked ? picked.id === d.id : item && top && d.id === top.id);
  const row = (d) => `<li class="dv-row ${isOn(d) ? "is-pick" : ""}">
      <span class="dv-nm"><b>${esc(d.name)}</b>${d.deal_type ? `<span class="deal-types">${typeTags(d.deal_type)}</span>` : ""}<small>${[d.brand, d.size].filter(Boolean).map(esc).join(" · ")} ${badge(d)}</small></span>
      <a class="dv-shop" href="${shopHref(on.get(d.shop_id) || { id: d.shop_id })}">${esc(shopName(d.shop_id))}</a>
      <span class="dv-pr"><b>${esc(priceTxt(d))}</b>${d.price != null && d.price_text && d.price_text.replace(/\s/g, "") !== money(d.price).replace(/\s/g, "") ? `<small>${esc(d.price_text)}</small>` : ""}</span>
      <span class="dv-unit">${unitTxt(d)}</span>
      <span class="dv-to muted">${d.valid_to ? t("到 {d}", { d: fmtShort(d.valid_to) }) : ""}</span>
      <span class="dv-act">${act(d)}</span></li>`;
  const card = (d) => `<article class="dv-card ${isOn(d) ? "is-pick" : ""}">
      <div class="dv-c-top"><a class="dv-shop" href="${shopHref(on.get(d.shop_id) || { id: d.shop_id })}">${esc(shopName(d.shop_id))}</a><span class="dv-to muted">${d.valid_to ? t("到 {d}", { d: fmtShort(d.valid_to) }) : ""}</span></div>
      <b class="dv-c-nm">${esc(d.name)}</b><small class="muted">${[d.brand, d.size].filter(Boolean).map(esc).join(" · ")}</small>
      ${d.deal_type ? `<span class="deal-types">${typeTags(d.deal_type)}</span>` : ""}
      <div class="dv-c-pr"><b>${esc(priceTxt(d))}</b><span class="dv-unit">${unitTxt(d)}</span></div>
      <div class="dv-c-foot">${badge(d)}<span class="dv-act">${act(d)}</span></div></article>`;
  const filtered = v.q || v.shop || v.cat || v.type || (!item && v.f === "list");
  const mode = item && v.mode === "group" ? "list" : v.mode;   // 单个商品的页面本来就是一组：按商品分组没意义，用列表
  const groups = mode === "group" ? groupDeals(list, hits) : null;
  const gRow = (d) => `<li class="${isOn(d) ? "is-pick" : ""}"><a class="dv-shop" href="${shopHref(on.get(d.shop_id) || { id: d.shop_id })}">${esc(shopName(d.shop_id))}</a>
      <span class="dv-g-nm">${esc(d.name)}${d.size ? ` <small>${esc(d.size)}</small>` : ""}</span>
      <b class="dv-g-pr">${esc(priceTxt(d))}</b><span class="dv-unit">${unitTxt(d)}</span><span class="dv-to muted">${d.valid_to ? t("到 {d}", { d: fmtShort(d.valid_to) }) : ""}</span></li>`;
  const gCard = (g) => { const m = g.hits; const first = g.deals[0];
    return `<section class="dv-group panel" aria-label="${esc(g.label)}"><div class="dv-g-head"><b>${esc(g.label)}</b><span class="muted">${t("{n} 家", { n: new Set(g.deals.map((d) => d.shop_id)).size })}</span>
      <span class="dv-g-act">${m.length ? `<span class="tag tag-hot">${t("清单里有：{n}", { n: m.map((x) => esc(x.name)).join("、") })}</span>` : `<button type="button" class="btn btn-sm btn-ghost" data-action="shops-tolist" data-deal="${first.id}">＋ ${t("清单")}</button>`}</span></div>
      <ul class="dv-g-list">${g.deals.map(gRow).join("")}</ul></section>`; };
  return `<section class="section shops-page dv-page">
    ${crumbNav(crumbs)}
    <div class="section-head"><h2>${item ? t("「{name}」的特价", { name: esc(item.name) }) : t("特价一览")}</h2>
      <p>${item ? (base.length ? `${t("{n} 家有特价。", { n: new Set(base.map((d) => d.shop_id)).size })}${picked ? t("卡片上显示的是你选的这家。") : t("卡片上默认显示 ★ 那条（{why}）；点「用这家」换成你选的。", { why: t(WHY[base.why] || WHY.unit) })}` : t("现在没有对得上的特价。")) : t("各家有效期内的特价放在一起比；单价相同单位才好比。")}</p></div>
    ${base.length ? `<div class="dv-modebar"><div class="dv-mode" role="group" aria-label="${esc(t("显示方式"))}">${item ? "" : `<button type="button" class="btn btn-sm ${mode === "group" ? "btn-dark" : "btn-ghost"}" data-action="shops-dv-mode" data-v="group" aria-pressed="${mode === "group"}">🧺 ${t("按商品")}</button>`}<button type="button" class="btn btn-sm ${mode === "list" ? "btn-dark" : "btn-ghost"}" data-action="shops-dv-mode" data-v="list" aria-pressed="${mode === "list"}">☰ ${t("列表")}</button><button type="button" class="btn btn-sm ${mode === "cards" ? "btn-dark" : "btn-ghost"}" data-action="shops-dv-mode" data-v="cards" aria-pressed="${mode === "cards"}">▦ ${t("卡片")}</button></div></div>
    <div class="toolbar shops-toolbar dv-toolbar">
      <label class="shops-q"><span class="sr-only">${t("搜索特价")}</span><input type="search" data-dv-q value="${esc(v.q)}" placeholder="${esc(t("搜索商品、牌子、商店"))}" autocomplete="off"></label>
      ${item ? "" : `<select data-dv-f data-nosearch aria-label="${esc(t("筛选特价"))}"><option value="all" ${v.f === "all" ? "selected" : ""}>${t("全部特价")}${cnt(base.length)}</option><option value="list" ${v.f === "list" ? "selected" : ""}>${t("对上清单")}${cnt(base.filter((d) => hits.get(d.id).length).length)}</option></select>`}
      ${shopsWith.length > 1 ? `<select data-dv-shop data-nosearch aria-label="${esc(t("商店"))}"><option value="">${t("全部商店")}</option>${shopsWith.map((s) => `<option value="${s.id}" ${v.shop === s.id ? "selected" : ""}>${esc(s.name)}${cnt(base.filter((d) => d.shop_id === s.id).length)}</option>`).join("")}</select>` : ""}
      ${cats.length > 1 ? `<select data-dv-cat data-nosearch aria-label="${esc(t("分类"))}"><option value="">${t("全部分类")}</option>${cats.map((c) => `<option value="${esc(c)}" ${v.cat === c ? "selected" : ""}>${esc(t(dealCatName(c)))}</option>`).join("")}</select>` : ""}
      ${types.length ? `<select data-dv-type data-nosearch aria-label="${esc(t("折扣类型"))}"><option value="">${t("全部折扣类型")}</option>${types.map((k) => `<option value="${k}" ${v.type === k ? "selected" : ""}>${esc(t(dealTypeName(k)))}</option>`).join("")}</select>` : ""}
      <select data-dv-sort data-nosearch aria-label="${esc(t("排序"))}">${DV_SORTS.map(([k, l]) => `<option value="${k}" ${v.sort === k ? "selected" : ""}>${t(l)}</option>`).join("")}</select>
      ${filtered ? `${clearActionBtn("shops-dv-reset")}` : ""}
    </div>
    <p class="muted dv-count">${groups ? t("{g} 样商品 · {n} 条特价", { g: groups.length, n: list.length }) : t("{n} 条", { n: list.length })}</p>
    ${!list.length ? `<p class="muted">${t("没有符合条件的特价。")}</p>` : groups ? `<div class="dv-groups">${groups.map(gCard).join("")}</div>` : mode === "cards" ? `<div class="dv-cards">${list.map(card).join("")}</div>`
      : `<div class="panel dv-panel"><div class="dv-th" aria-hidden="true"><span>${t("商品")}</span><span>${t("商店")}</span><span>${t("价格")}</span><span>${t("单价")}</span><span>${t("有效期")}</span><span></span></div><ul class="dv-list">${list.map(row).join("")}</ul></div>`}`
      : `<div class="panel"><p class="muted" style="margin:0">${item ? t("这一项现在没有对得上的特价。") : t("还没有特价。到商店页更新一次特价就会出现在这里。")}</p></div>`}
  </section>`;
}
/** 按商品分组：同一样东西（aka 的第一个叫法——录入时对上家里物品的就是物品名，否则是 AI 给的通用名，如「巧克力」）的各家特价放一组，
 *  组内按比价规则排；对上购物车的组在前，其余按名称。返回 [{ label, deals, hits }] */
function groupDeals(list, hits) {
  const m = new Map();
  for (const d of list) {
    const label = String(d.aka || "").split(/[,，、]/).map((x) => x.trim()).find(Boolean) || d.name, k = normName(label);
    if (!m.has(k)) m.set(k, { label, deals: [] });
    m.get(k).deals.push(d);
  }
  const open = new Map(openShopping().map((s) => [s.id, s]));
  return [...m.values()].map((g) => {
    const hs = new Map(); for (const d of g.deals) for (const s of hits.get(d.id) || []) hs.set(s.id, s);
    const deals = rankDeals(g.deals, [...hs.values()][0] || null);
    return { label: g.label, deals, hits: [...hs.values()].filter((s) => open.has(s.id)) };
  }).sort((a, b) => (b.hits.length > 0) - (a.hits.length > 0) || a.label.localeCompare(b.label));
}
/** 「对上清单」的推荐排序：按清单的每一项分组，组内按比价规则（每组第一条就是那一项默认显示的） */
function groupByItem(list, hits) {
  const ids = new Set(list.map((d) => d.id)), seen = new Set(), out = [];
  for (const s of openShopping()) for (const d of dealsFor(s)) if (ids.has(d.id) && !seen.has(d.id)) { seen.add(d.id); out.push(d); }
  for (const d of list) if (!seen.has(d.id)) out.push(d);
  return out;
}
