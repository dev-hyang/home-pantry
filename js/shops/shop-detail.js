/* 单个商店：详情页、更新 / 核对区、这家的特价列表。 */
import { DEAL_TYPES, adUrl, dealCatName, dealMatches, dealTypeName, dealsDue, flippUrl, liveDeals, mapUrl, openShopping, priceHistory, replaceable, shopCat } from "./logic.js";
import { PICK_KEY, localPicks, shopName, unitMoney } from "./lite.js";
import { R } from "./shops-actions.js";
import { Store } from "../core/store.js";
import { aiReady } from "../core/ai.js";
import { attachHTML } from "../core/attach.js";
import { copyBox } from "./shops-find.js";
import { crumbNav } from "../core/hub.js";
import { daysUntil, esc, fmtShort, money, toast } from "../core/util.js";
import { href } from "../core/router.js";
import { lang, t } from "../core/i18n.js";
import { shopForm } from "./shops-list.js";
import { state } from "../core/state.js";
import { DOW, dealUi, distOf, missingPanel, shopHref, ui } from "./shops-common.js";
import { lpAttr } from "../core/long-press.js";
import { dtBlock, dtRow } from "../core/detail-ui.js";
import { viewShopDeal } from "./shop-deal-page.js";
import { fabMenu } from "../core/fab-menu.js";
import { moreMenu } from "../core/more-menu.js";
import { bulkBar, bulkCheck, bulkMenuItem, bulkOn, bulkRegister } from "../core/bulk-select.js";
import { clearActionBtn } from "../core/clear-filters.js";

/* ───────────── 单个商店 ───────────── */
export const dealHref = (s, d) => `${shopHref(s)}?deal=${encodeURIComponent(d.id)}`;
export function viewShop(id) {
  const s = (state.shops || []).find((x) => x.id === id);
  const base = [{ href: href("shopping"), label: t("采购") }, { href: href("shops", "list"), label: t("常去的商店") }];
  if (id === "new") return `<section class="section shops-page shop-page form-page">${crumbNav([...base, { label: t("添加商店") }])}${shopForm(null, { page: true })}</section>`;   // 添加商店：单独的页面（分步 + 确认），不在商店列表上展开
  if (!s) return `<section class="section shops-page">${crumbNav([...base, { label: t("商店") }])}<p class="muted">${state.shops ? t("这家商店不在了。") : t("加载中…")}</p></section>`;
  const [, cn, icon] = shopCat(s.category), d = distOf(s), du = dealUi(s.id), deals = liveDeals(s.id), q = state.route.q;
  if (q.get("deal")) return viewShopDeal(s, q.get("deal"), q.get("edit") === "1");   // 一条特价的详情 / 编辑页（shop-deal-page.js）
  if (q.get("add") === "1" || q.get("update") === "1") return `<section class="section shops-page shop-page form-page">${crumbNav([...base, { href: shopHref(s), label: s.name, icon }, { label: du.manual ? t("手动加一条特价") : t("录入特价") }])}
    <div class="panel deal-upd">${du.rows ? reviewHtml(s, du) : updateHtml(s, du)}</div></section>`;   // 新增页：拍广告 / 粘贴 / 手动，保存后回商店
  if (q.get("edit") === "1") return `<section class="section shops-page shop-page form-page">${crumbNav([...base, { href: shopHref(s), label: s.name, icon }, { label: t("编辑商店") }])}${shopForm(s, { page: true })}</section>`;   // 编辑：单独的表单页（取消 / 保存置顶）
  const edit = (sec) => `${shopHref(s)}?edit=1&sec=${sec}`;
  const refreshTxt = s.refresh === "weekly" ? t("每{d}换广告", { d: t(DOW[s.refresh_dow ?? 3]) }) : t("需要时手动更新");
  const tags = `${s.archived ? `<span class="tag">${t("不去了")}</span> ` : ""}${dealsDue(s) ? `<b class="warn-txt">${t("本周待更新")}</b>` : ""}`;
  const tools = state.runsMissing || Store.mode === "demo" ? null : { label: `🤖 ${t("用脚本更新")}`, href: `pantrydeals://run?shop=${encodeURIComponent(s.id)}` };
  const menu = moreMenu([{ label: `${t("本周广告")} ↗`, href: adUrl(s), external: true, first: true }, { label: "Flipp ↗", href: flippUrl(s), external: true }, tools,
    s.archived ? { label: t("加回常去"), action: "shops-unarchive", data: { id: s.id } } : { label: t("不去了"), action: "shops-archive", data: { id: s.id } }, { label: t("删除"), action: "shops-del", data: { id: s.id }, danger: true }]);
  const basic = dtBlock(t("基本信息"), edit("basic"), [dtRow(t("分类"), `${icon} ${esc(t(cn))}`), dtRow(t("地址"), s.address ? `<a href="${esc(mapUrl(s))}" target="_blank" rel="noopener">${esc(s.address)}</a>${d != null ? ` · ${t("{n} 英里", { n: d.toFixed(1) })}` : ""}` : ""),
    dtRow(t("电话"), s.phone ? `<a href="tel:${esc(s.phone)}">${esc(s.phone)}</a>` : ""), dtRow(t("备注"), esc(s.notes || ""))]);
  const upd = dtBlock(t("特价更新"), edit("update"), [dtRow(t("更新频率"), esc(refreshTxt)), dtRow(t("自动更新"), s.auto_update && s.refresh === "weekly" ? `🤖 ${t("{d}自动更新", { d: t(DOW[s.refresh_dow ?? 3]) })}` : ""), dtRow(t("上次更新"), s.deals_at ? esc(fmtShort(s.deals_at)) : ""), dtRow(t("广告链接"), s.ad_url ? `<a href="${esc(s.ad_url)}" target="_blank" rel="noopener">${t("本周广告")} ↗</a>` : "")]);
  const fab = fabMenu([{ label: t("录入特价"), icon: "🏷", desc: t("拍广告、截图或粘贴文字"), href: `${shopHref(s)}?add=1` }, { label: t("手动加一条特价"), icon: "✍️", data: { action: "shops-manual", id: s.id } }], { label: t("添加") });
  return `<section class="section shops-page shop-page">
    ${crumbNav([...base, { label: s.name, icon }])}
    ${missingPanel()}
    <div class="section-head"><div class="sh-title"><h2>${icon} ${esc(s.name)}</h2><p>${tags}</p></div><div class="head-acts">${menu}</div></div>
    ${basic}${upd}
    ${dealsHtml(s, du, deals)}
    ${fab}
  </section>`;
}
function updateHtml(s, du) {
  const id = `shopdeal-${s.id}`, ready = aiReady();
  return `<div class="deal-in">
    ${attachHTML(id, { t, esc, textLabel: t("广告文字，或 Claude 整理好的结果（JSON）"), ph: t("在 Flipp 或超市网站上先搜好、打开这家本周的广告，再截图或复制文字贴到这里"), rows: 3,
      hint: `${t("小技巧：先自己在页面上搜出要的东西（鸡蛋、牛奶…），再截图让 AI 读，最快也最省额度。")}${ready ? "" : ` ${t("没填 AI key 时，只能导入 Claude 整理好的 JSON。")}`}` })}
    <div class="form-actions"><button type="button" class="btn btn-primary" data-action="shops-read" data-id="${s.id}" ${du.busy ? "disabled" : ""}>${du.busy ? t("正在读…（几十秒）") : t("读出特价")}</button>
      <button type="button" class="btn btn-ghost" data-action="shops-claude-copy" data-id="${s.id}">📋 ${t("复制给 Claude 的指令")}</button>
      <button type="button" class="btn btn-ghost" data-action="shops-manual" data-id="${s.id}">＋ ${t("手动加一条")}</button><a class="btn btn-ghost" href="${shopHref(s)}">${t("取消")}</a></div>
    ${ui().copyText ? copyBox() : ""}
    ${du.error ? `<p class="form-error" role="alert">${esc(du.error)}</p>` : ""}
  </div>`;
}
function reviewHtml(s, du) {
  const rows = du.rows, has = replaceable(s, rows.filter((r) => r.include && r.name)).length, keep = liveDeals(s.id).length - has;
  const cell = (r, i, name, val, attrs = "") => `<input name="${name}" data-i="${i}" value="${esc(val ?? "")}" ${attrs} aria-label="${esc(t(COLS[name] || name))}">`;
  return `<form class="deal-review" id="dealReviewForm" data-id="${s.id}">
    <p class="muted">${t("核对一下：价格是单件价（2 for $5 记 2.50），单价用来比不同包装。不要的取消勾选。")}</p>
    <div class="deal-rv-head" aria-hidden="true"><span></span><span>${t("名称")}</span><span>${t("规格")}</span><span>${t("价格")}</span><span>${t("广告原文")}</span><span>${t("单价")}</span><span>${t("到期")}</span></div>
    <ul class="deal-rv-list">${rows.map((r, i) => `<li class="deal-rv">
      <label class="check-inline"><input type="checkbox" name="inc" data-i="${i}" ${r.include ? "checked" : ""}><span class="sr-only">${t("保存这一条")}</span></label>
      ${cell(r, i, "name", r.name, 'maxlength="80" required')}${cell(r, i, "size", r.size, 'maxlength="40"')}
      ${cell(r, i, "price", r.price, 'type="number" min="0" step="0.01" inputmode="decimal"')}${cell(r, i, "price_text", r.price_text, 'maxlength="40"')}
      <span class="deal-up">${cell(r, i, "unit_price", r.unit_price, 'type="number" min="0" step="0.0001" inputmode="decimal"')}${cell(r, i, "unit_label", r.unit_label, 'maxlength="12" placeholder="/lb"')}</span>
      ${cell(r, i, "valid_to", r.valid_to, 'type="date"')}
      ${r.deal_type ? `<span class="deal-rv-tags">${typeTags(r.deal_type)}</span>` : ""}
    </li>`).join("")}</ul>
    ${has ? `<label class="check-inline"><input type="checkbox" name="replace" ${du.replace ? "checked" : ""}><span>${t("替换这家现有的 {n} 条特价（新一周的广告选这个）", { n: has })}${keep > 0 ? ` <small class="muted">${t("另有 {n} 条到期更晚、这次没出现，会留着", { n: keep })}</small>` : ""}</span></label>` : ""}
    <div class="form-actions"><button type="submit" class="btn btn-primary">${t("保存 {n} 条", { n: rows.filter((r) => r.include).length })}</button>
      <button type="button" class="btn btn-ghost" data-action="shops-addrow" data-id="${s.id}">＋ ${t("再加一行")}</button>
      <button type="button" class="btn btn-ghost" data-action="shops-discard" data-id="${s.id}">${t("放弃")}</button></div>
  </form>`;
}
/** 折扣类型的小标签（Black Friday、店内、网上、Rollback…） */
export const typeTags = (v) => String(v || "").split(",").filter(Boolean).map((k) => `<span class="tag deal-type dt-${esc(k)}">${esc(t(dealTypeName(k)))}</span>`).join("");
const COLS = { name: "名称", size: "规格", price: "价格", price_text: "广告原文", unit_price: "单价", unit_label: "单位", valid_to: "到期" };
/** 以前的价格：一行小结（点开看明细）。现在是 6 个月最低 → 绿色；比以前最低贵 → 写出以前最低是多少、哪家、哪天 */
const histVal = (h, x) => (h.by === "unit" ? `${unitMoney(+x.unit_price)}${esc(x.unit_label || "")}` : money(+x.price));
function histBtn(d, du) {
  const h = priceHistory(d); if (!h) return "";
  const open = du.hist === d.id;
  const txt = h.isLow ? `<span class="tag tag-ok">${t("6 个月最低")}</span> <span>${t("以前 {n} 次", { n: h.list.length })}</span>`
    : `<span>${t("以前最低 {v}（{s} {d}）", { v: histVal(h, h.low), s: esc(shopName(h.low.shop_id)), d: fmtShort(h.low.valid_to) })}</span>${h.pct > 0 ? ` <b class="warn-txt">+${h.pct}%</b>` : ""}`;
  return `<button type="button" class="deal-hist-btn" data-action="shops-hist" data-deal="${d.id}" aria-expanded="${open}">📈 ${txt} <span aria-hidden="true">${open ? "▴" : "▾"}</span></button>`;
}
export function histList(d) {
  const h = priceHistory(d); if (!h) return "";
  return `<ul class="deal-hist" aria-label="${esc(t("以前的价格"))}">${h.list.slice(0, 10).map((x) => `<li class="${x.id === h.low.id ? "is-low" : ""}">
    <span class="dh-when">${x.valid_from ? `${fmtShort(x.valid_from)}–` : ""}${fmtShort(x.valid_to)}</span><span class="dh-shop">${esc(shopName(x.shop_id))}</span>
    <span class="dh-nm">${esc(x.name)}${x.size ? ` <small>${esc(x.size)}</small>` : ""}</span><b class="dh-v">${histVal(h, x)}</b></li>`).join("")}</ul>
    ${h.list.length > 10 ? `<p class="muted dh-more">${t("只列最近 10 次，共 {n} 次", { n: h.list.length })}</p>` : ""}`;
}
/** 折扣类型：下拉多选（关着时像普通下拉，显示已选的；点开是一列勾选框）。可以选几个，比如 Black Friday + 网上 */
export const dtSummary = (keys) => (keys.length ? keys.map((k) => t(dealTypeName(k))).join("、") : t("没有特别类型"));
function dealTypeDrop(value, labelId) {
  const on = String(value || "").split(",").filter(Boolean);
  return `<details class="dt-drop"><summary aria-labelledby="${labelId}" aria-describedby="${labelId}-v"><span class="dt-val" id="${labelId}-v">${esc(dtSummary(on))}</span></summary>
    <div class="dt-menu" role="group" aria-labelledby="${labelId}">${DEAL_TYPES.map(([k, l]) => `<label class="dt-opt"><input type="checkbox" name="deal_type" value="${k}" ${on.includes(k) ? "checked" : ""}><span>${esc(t(l))}</span></label>`).join("")}</div></details>`;
}
/** 编辑一条特价的表单（单独的编辑页用，pantry shops/shop-deal-page.js）；page 时取消是回详情的链接 */
export function dealEditFormHtml(d, s) {
  return `<form class="panel deal-edit" id="dealEditForm" data-id="${d.id}">
      <div class="form-grid"><label class="span-2">${t("名称")}<input name="name" maxlength="80" required value="${esc(d.name)}"></label><label>${t("规格")}<input name="size" maxlength="40" value="${esc(d.size || "")}"></label>
      <label>${t("价格")}<input name="price" type="number" min="0" step="0.01" value="${d.price ?? ""}"></label><label>${t("广告原文")}<input name="price_text" maxlength="40" value="${esc(d.price_text || "")}"></label>
      <label>${t("单价")}<input name="unit_price" type="number" min="0" step="0.0001" value="${d.unit_price ?? ""}"></label><label>${t("单位")}<input name="unit_label" maxlength="12" value="${esc(d.unit_label || "")}"></label>
      <label>${t("到期")}<input name="valid_to" type="date" value="${esc(d.valid_to || "")}"></label><label class="span-2">${t("通用叫法")}<input name="aka" maxlength="120" value="${esc(d.aka || "")}" placeholder="${esc(t("鸡蛋, eggs"))}"></label>
      ${state.runsMissing ? "" : `<div class="span-2 dt-field"><span class="dt-lbl" id="dtLbl-${d.id}">${t("折扣类型")}</span>${dealTypeDrop(d.deal_type, `dtLbl-${d.id}`)}</div>`}</div>
      <div class="form-actions"><a class="btn btn-ghost" href="${shopHref(s)}?deal=${encodeURIComponent(d.id)}">${t("取消")}</a><button class="btn btn-primary" type="submit">${t("保存")}</button></div></form>`;
}
function dealsHtml(s, du, deals) {
  const open = openShopping(), q = du.q.trim().toLowerCase(), soon = (d) => d.valid_to && daysUntil(d.valid_to) <= 2;
  const cats = [...new Set(deals.map((d) => d.category).filter(Boolean))].sort();
  const typeOf = (d) => String(d.deal_type || "").split(",").filter(Boolean);
  const types = DEAL_TYPES.map(([k]) => k).filter((k) => deals.some((d) => typeOf(d).includes(k)));
  let list = deals.filter((d) => (du.filter === "list" ? dealMatches(d, open).length : du.filter === "soon" ? soon(d) : true) && (!du.cat || d.category === du.cat) && (!du.type || typeOf(d).includes(du.type))
    && (!q || `${d.name} ${d.brand || ""} ${d.aka || ""}`.toLowerCase().includes(q)));
  const by = { unit: (a, b) => (a.unit_price == null) - (b.unit_price == null) || (a.unit_label || "").localeCompare(b.unit_label || "") || (a.unit_price ?? 1e9) - (b.unit_price ?? 1e9), price: (a, b) => (a.price ?? 1e9) - (b.price ?? 1e9), name: (a, b) => a.name.localeCompare(b.name) };
  list = [...list].sort(by[du.sort] || by.unit);
  const hits = deals.filter((d) => dealMatches(d, open).length).length;
  const pick = !!bulkOn("shopdeal");
  bulkRegister("shopdeal", { ids: () => list.map((d) => d.id), del: async (id) => { await Store.deleteShopDeals([id]); state.shopDeals = (state.shopDeals || []).filter((x) => x.id !== id); } });
  const row = (d) => {
    const m = dealMatches(d, open);
    // 手机：没有按钮，向左滑删除、向右滑加入清单（都先确认），点名称修改；电脑：按钮照旧（悬停 / Tab 也能用），点名称同样修改
    const swipe = `data-swipe-del="deal"${m.length ? "" : ` data-swipe-alt="deal" data-swipe-alt-label="${esc(t("加入清单"))}" data-swipe-alt-go="${esc(t("松手加入清单"))}"`}`;
    return `<li class="deal-row ${m.length ? "is-hit" : ""}${pick ? " is-pick" : ""}" ${pick ? "data-row-chk" : `${swipe} data-row-open="${esc(dealHref(s, d))}" ${lpAttr([{ label: t("详情"), href: dealHref(s, d), first: true }, { label: t("编辑"), href: `${dealHref(s, d)}&edit=1` }, m.length ? null : { label: t("加入清单"), action: "shops-tolist", data: { deal: d.id } }, { label: t("删除"), action: "shops-deal-del", data: { deal: d.id }, danger: true }, bulkMenuItem("shopdeal", d.id)], d.name)}`}>
      <span class="deal-nm">${pick ? bulkCheck("shopdeal", d.id) : ""}${pick ? `<b>${esc(d.name)}</b>` : `<a class="deal-nm-btn" href="${dealHref(s, d)}"><b>${esc(d.name)}</b></a>`}${d.deal_type ? `<span class="deal-types">${typeTags(d.deal_type)}</span>` : ""}<small>${[d.brand, d.size].filter(Boolean).map(esc).join(" · ")}${m.length ? ` <span class="tag tag-hot">${t("清单里有：{n}", { n: m.map((x) => esc(x.name)).join("、") })}</span>` : ""}</small></span>
      <span class="deal-pr"><b>${d.price != null ? money(d.price) : esc(d.price_text || "—")}</b>${d.price_text && d.price != null && d.price_text.replace(/\s/g, "") !== money(d.price).replace(/\s/g, "") ? `<small>${esc(d.price_text)}</small>` : ""}${d.regular_price ? `<small class="muted"><s>${money(d.regular_price)}</s></small>` : ""}</span>
      <span class="deal-unit">${d.unit_price != null ? `${unitMoney(d.unit_price)}<small>${esc(d.unit_label || "")}</small>` : `<small class="muted">—</small>`}</span>
      <span class="deal-to ${soon(d) ? "warn-txt" : "muted"}">${d.valid_to ? t("到 {d}", { d: fmtShort(d.valid_to) }) : ""}</span>
      <span class="deal-acts">${m.length ? "" : `<button type="button" class="btn btn-sm btn-ghost swipe-alt-src" data-action="shops-tolist" data-deal="${d.id}">＋ ${t("清单")}</button>`}
        <button type="button" class="btn btn-sm btn-ghost swipe-src" data-action="shops-deal-del" data-deal="${d.id}" aria-label="${esc(t("删除 {name}", { name: d.name }))}">×</button></span>
    </li>`;
  };
  return `<div class="panel deal-list-panel">
    <div class="deal-list-head"><b>${t("本周特价")}</b> <span class="muted">${deals.length ? t("{n} 项 · 对上清单 {m} 项", { n: deals.length, m: hits }) : t("还没有")}</span></div>
    ${deals.length ? `<div class="toolbar shops-toolbar deal-toolbar">
      <label class="shops-q"><span class="sr-only">${t("搜索特价")}</span><input type="search" data-deal-q="${s.id}" value="${esc(du.q)}" placeholder="${esc(t("搜索特价"))}" autocomplete="off"></label>
      <select data-deal-filter="${s.id}" data-nosearch aria-label="${esc(t("筛选特价"))}">${[["all", t("全部特价"), deals.length], ["list", t("对上清单"), hits], ["soon", t("快过期"), deals.filter(soon).length]].map(([k, l, n]) => `<option value="${k}" ${du.filter === k ? "selected" : ""}>${esc(l)}${lang === "en" ? ` (${n})` : `（${n}）`}</option>`).join("")}</select>
      ${types.length ? `<select data-deal-type="${s.id}" data-nosearch aria-label="${esc(t("折扣类型"))}"><option value="">${t("全部折扣类型")}</option>${types.map((k) => `<option value="${k}" ${du.type === k ? "selected" : ""}>${esc(t(dealTypeName(k)))}${lang === "en" ? ` (${deals.filter((d) => typeOf(d).includes(k)).length})` : `（${deals.filter((d) => typeOf(d).includes(k)).length}）`}</option>`).join("")}</select>` : ""}
      ${cats.length > 1 ? `<select data-deal-cat="${s.id}" data-nosearch aria-label="${esc(t("分类"))}"><option value="">${t("全部分类")}</option>${cats.map((c) => `<option value="${esc(c)}" ${du.cat === c ? "selected" : ""}>${esc(t(dealCatName(c)))}</option>`).join("")}</select>` : ""}
      <select data-deal-sort="${s.id}" data-nosearch aria-label="${esc(t("排序"))}">${[["unit", "按单价"], ["price", "按价格"], ["name", "按名称"]].map(([k, l]) => `<option value="${k}" ${du.sort === k ? "selected" : ""}>${t(l)}</option>`).join("")}</select>
      ${du.q || du.cat || du.type || (du.filter && du.filter !== "all") ? `${clearActionBtn("shops-dreset", `data-id="${s.id}"`)}` : ""}
    </div>
    ${bulkBar("shopdeal")}
    <div class="deal-th" aria-hidden="true"><span>${t("商品")}</span><span>${t("价格")}</span><span>${t("单价")}</span><span>${t("有效期")}</span><span></span></div>
    ${list.length ? `<ul class="deal-list">${list.map(row).join("")}</ul>` : `<p class="muted">${t("没有符合条件的特价。")}</p>`}` : `<p class="muted">${t("更新一次特价，这里就会列出本周在打折的东西。")}</p>`}
  </div>`;
}
function setLocalPick(itemId, dealId) { try { const m = localPicks(); if (dealId) m[itemId] = dealId; else delete m[itemId]; localStorage.setItem(PICK_KEY, JSON.stringify(m)); } catch { /* 忽略 */ } }
/** 选用一条特价：存到这一项上（069 的 deal_id，全家看得到）；没执行 069 时先记在这台设备。「在哪买」还空着就顺手填上商店名 */
export async function pickDeal(itemId, dealId, { rerender = false } = {}) {
  const s = (state.shopping || []).find((x) => x.id === itemId); if (!s) return;
  try { await Store.saveShopping({ id: itemId, deal_id: dealId || null }); s.deal_id = dealId || null; setLocalPick(itemId, null); }
  catch (e) {
    if (!/deal_id/.test(e.message || "")) { toast(t("保存失败：{msg}", { msg: e.message })); return; }
    setLocalPick(itemId, dealId); toast(t("已记在这台设备上。在 Supabase 执行 migrations/069_shopping_deal_pick.sql 后，全家都能看到你选的这家。"));
  }
  const d = (state.shopDeals || []).find((x) => x.id === dealId), st = document.querySelector(`[data-store-for="${CSS.escape(itemId)}"]`);
  if (d && st && !st.value.trim()) st.value = shopName(d.shop_id);
  if (rerender) R?.();
}
