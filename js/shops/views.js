/* 采购 → 常去的商店（迁移 067）
 *   #/shops/list         商店列表：搜索、分类筛选、常去 / 不去了、排序；手动添加、编辑、不去了（可加回来）、删除
 *   #/shops/find         按 ZIP 或当前位置找附近的门店（5 / 10 / 15 / 20 英里），一键加入
 *   #/shops/shop/<id>    单个商店：本周广告链接、更新特价（拍广告 / 贴文字 → AI 读；贴 Claude 整理的 JSON 直接导入）、特价列表
 * 布局：电脑上商店卡片多列、特价是表格；手机上单列卡片、特价一条一张卡，按钮在卡片底部。 */
import { state } from "../core/state.js";
import { Store } from "../core/store.js";
import { $, confirmDelete, esc, fmtShort, money, toast, daysUntil } from "../core/util.js";
import { lang, t } from "../core/i18n.js";
import { href } from "../core/router.js";
import { crumbNav } from "../core/hub.js";
import { aiReady, askText } from "../core/ai.js";
import { attachHTML, attachPayload, attachReset } from "../core/attach.js";
import { DEAL_TYPES, FOCUS_SECTIONS, claudePrompt, histSince, linkItems, myItemNames, priceHistory, replaceable, dealCatName, dealTypeName, importGroups, weekWindow } from "./logic.js";
import { CHAINS, MAX_MI, SHOP_CATS, STARTER, adUrl, bestDealFor, chainOf, cleanDeals, dealMatches, dealPrompt, dealsDue, flippUrl, liveDeals, mapUrl, miles, nearestChains, openShopping, parseLooseJson, rememberPoint, restockWatch, savedZip, searchNearby, shopCat, zipToPoint } from "./logic.js";

const DOW = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const ui = () => (state.shopUi ||= { q: "", cat: "", status: "active", sort: "name", edit: null, find: { zip: savedZip()?.zip || "", radius: 10, cats: ["groceries", "warehouse", "department"], results: null, busy: false, error: "", pt: savedZip() }, deal: {} });
const dealUi = (id) => (ui().deal[id] ||= { busy: false, error: "", rows: null, replace: true, filter: "all", cat: "", sort: "unit", q: "", edit: null });
const home = () => ui().find.pt || savedZip();
const distOf = (s) => miles(home(), s);
const shopHref = (s) => `${href("shops", "shop")}/${encodeURIComponent(s.id)}`;

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

export function viewShops() {
  const r = state.route;
  if (r.sub === "find") return viewFind();
  if (r.sub === "shop") return viewShop(r.id);
  if (r.sub === "log") return viewRuns();
  return viewList();
}
const missingPanel = () => (state.shopsMissing ? `<div class="panel cta-panel"><div><b>${t("数据库还没升级")}</b><p class="muted">${t("请在 Supabase 的 SQL Editor 执行 migrations/067_shops_deals.sql，商店和特价才能保存。")}</p></div></div>` : "");

/* ───────────── 列表 ───────────── */
function viewList() {
  const u = ui(), all = state.shops || [];
  const pool = all.filter((s) => (u.status === "archived" ? s.archived : !s.archived));
  const q = u.q.trim().toLowerCase();
  let list = pool.filter((s) => (!u.cat || s.category === u.cat) && (!q || `${s.name} ${s.address || ""} ${s.notes || ""}`.toLowerCase().includes(q)));
  const dealN = (s) => liveDeals(s.id).length;
  const sorters = { name: (a, b) => a.name.localeCompare(b.name), dist: (a, b) => (distOf(a) ?? 1e9) - (distOf(b) ?? 1e9), deals: (a, b) => dealN(b) - dealN(a), updated: (a, b) => String(b.deals_at || "").localeCompare(String(a.deals_at || "")) };
  list = [...list].sort(sorters[u.sort] || sorters.name);
  const due = all.filter(dealsDue);
  const catCount = (c) => pool.filter((s) => s.category === c).length;
  const gridOn = all.length > 0 && u.status !== "archived";   // 常去的商店：网格最后一张是「＋ 添加商店」空白卡，点开后表单就在那个位置
  const chips = [["", t("全部"), "", pool.length], ...SHOP_CATS.filter(([c]) => catCount(c)).map(([c, n, i]) => [c, t(n), i, catCount(c)])];
  return `<section class="section shops-page">
    ${crumbNav([{ href: href("shopping"), label: t("采购") }, { label: t("常去的商店"), icon: "🏪" }])}
    ${missingPanel()}
    <div class="section-head"><h2>${t("常去的商店")}</h2><p>${t("每家的本周广告、特价都在这里；采购清单会标出哪家在打折。")}</p>
      <div class="head-acts"><button type="button" class="btn btn-sm" data-action="shops-claude" aria-expanded="${!!u.claude}">🤖 ${t("用 Claude 整理")}</button><a class="btn btn-sm" href="${href("shops", "find")}">📍 ${t("找附近的商店")}</a><a class="btn btn-sm" href="${href("shops", "log")}">📜 ${t("更新记录")}</a><button type="button" class="btn btn-sm btn-primary" data-action="shops-new" aria-expanded="${u.edit === "new"}" aria-controls="shopEditForm">${u.edit === "new" ? "－" : "＋"} ${t("手动添加")}</button></div></div>
    ${u.edit === "new" && !gridOn ? shopForm(null) : ""}
    ${u.claude ? claudePanel() : ""}
    ${due.length && u.status === "active" ? `<div class="panel shops-due" role="status">🗓️ ${t("{n} 家本周的特价还没更新：{names}", { n: due.length, names: due.map((s) => esc(s.name)).join("、") })}</div>` : ""}
    ${all.length ? `<div class="toolbar shops-toolbar">
      <label class="shops-q"><span class="sr-only">${t("搜索商店")}</span><input type="search" data-shops-q value="${esc(u.q)}" placeholder="${esc(t("搜索名称、地址"))}" autocomplete="off"></label>
      <select data-shops-status data-nosearch aria-label="${esc(t("显示哪些商店"))}">${[["active", t("常去"), all.filter((s) => !s.archived).length], ["archived", t("不去了"), all.filter((s) => s.archived).length]].map(([k, l, n]) => `<option value="${k}" ${u.status === k ? "selected" : ""}>${esc(l)}${lang === "en" ? ` (${n})` : `（${n}）`}</option>`).join("")}</select>
      <select data-shops-cat data-nosearch aria-label="${esc(t("按分类筛选"))}">${chips.map(([c, l, i, n]) => `<option value="${c}" ${u.cat === c ? "selected" : ""}>${i ? `${i} ` : ""}${esc(c ? l : t("全部分类"))}${lang === "en" ? ` (${n})` : `（${n}）`}</option>`).join("")}</select>
      <select data-shops-sort data-nosearch aria-label="${esc(t("排序"))}">${[["name", "按名称"], ["dist", "按距离"], ["deals", "按特价多少"], ["updated", "按最近更新"]].map(([k, l]) => `<option value="${k}" ${u.sort === k ? "selected" : ""}>${t(l)}</option>`).join("")}</select>
      ${u.q || u.cat || u.status !== "active" || u.sort !== "name" ? `<button type="button" class="btn btn-sm btn-ghost" data-action="shops-reset">${t("清除筛选")}</button>` : ""}
    </div>` : ""}
    ${gridOn ? `<div class="shop-grid">${list.map(shopCard).join("")}${u.edit === "new" ? `<div class="shop-new-slot">${shopForm(null)}</div>` : newCard()}</div>${list.length ? "" : `<p class="muted shops-empty">${t("没有符合条件的商店。")}</p>`}`
      : all.length ? `<p class="muted shops-empty">${u.status === "archived" ? t("没有收起来的商店。") : t("没有符合条件的商店。")}</p>` : starterPanel()}
  </section>`;
}
function starterPanel() {
  const f = ui().find;
  return `<div class="panel shops-starter">
    <b>${t("先把常去的几家放进来")}</b>
    <p class="muted">${t("Jewel-Osco、Costco、ALDI、Tony's Fresh Market、Target、Walmart。填 ZIP 会加最近的那家门店（含地址）；不填就先只加名字。")}</p>
    <div class="shops-starter-row"><label><span class="sr-only">ZIP</span><input data-shops-zip inputmode="numeric" maxlength="5" placeholder="ZIP" value="${esc(f.zip)}"></label>
      <button type="button" class="btn btn-primary" data-action="shops-starter" ${f.busy ? "disabled" : ""}>${f.busy ? t("正在找最近的门店…") : t("加入这 6 家")}</button></div>
    ${f.error ? `<p class="form-error">${esc(f.error)}</p>` : ""}
  </div>`;
}
function shopCard(s) {
  const [, cn, icon] = shopCat(s.category), deals = liveDeals(s.id), open = openShopping();
  const hits = deals.filter((d) => dealMatches(d, open).length).length, d = distOf(s), due = dealsDue(s);
  const upd = s.deals_at ? t("{d} 更新", { d: fmtShort(s.deals_at) }) : t("还没有特价");
  return `<article class="shop-card ${s.archived ? "is-off" : ""}" data-swipe-del="store">
    <a class="shop-main" href="${shopHref(s)}"><span class="shop-ico" aria-hidden="true">${icon}</span>
      <span class="shop-txt"><b>${esc(s.name)}</b><small>${d != null ? `${t("{n} 英里", { n: d.toFixed(1) })} · ` : ""}${esc(s.address || t("没填地址"))}</small></span><span class="mch" aria-hidden="true">›</span></a>
    <div class="shop-meta"><span class="tag">${esc(t(cn))}</span>${s.refresh === "weekly"
        ? `<span class="tag"${s.auto_update ? ` title="${esc(t("换广告那天由 Claude 定时任务自动更新"))}"` : ""}>${s.auto_update ? `🤖 ` : ""}${t("每{d}换广告", { d: t(DOW[s.refresh_dow ?? 3]) })}</span>`
        : ""}
      ${deals.length ? `<span class="tag tag-ok">${t("特价 {n} 项", { n: deals.length })}</span>` : ""}${hits ? `<span class="tag tag-hot">${t("对上清单 {n}", { n: hits })}</span>` : ""}
      ${due ? `<span class="tag tag-warn">${t("本周待更新")}</span>` : `<span class="muted">${upd}</span>`}</div>
    <div class="shop-acts">${s.archived
      ? `<button type="button" class="btn btn-sm btn-primary" data-action="shops-unarchive" data-id="${s.id}">${t("加回常去")}</button><button type="button" class="btn btn-sm btn-ghost" data-action="shops-del" data-id="${s.id}">${t("删除")}</button>`
      : `<a class="btn btn-sm btn-ghost" href="${esc(adUrl(s))}" target="_blank" rel="noopener">${t("本周广告")} ↗</a><a class="btn btn-sm" href="${shopHref(s)}?update=1">${t("更新特价")}</a>`}
      <button type="button" class="btn btn-sm btn-ghost swipe-src" data-action="shops-del" data-id="${s.id}" aria-label="${esc(t("删除 {name}", { name: s.name }))}">${t("删除")}</button></div>
  </article>`;   // 向左滑删除（js/swipe-rows.js 替这个隐藏按钮点一下，照旧弹确认框）
}
/** 网格最后的空白卡：点一下展开「添加商店」表单（和右上角「手动添加」是同一个） */
function newCard() {
  return `<button type="button" class="shop-card shop-new" data-action="shops-new" aria-expanded="false" aria-controls="shopEditForm"><span class="shop-new-plus" aria-hidden="true">＋</span><b>${t("添加商店")}</b><small>${t("名称、地址、每周几换广告")}</small></button>`;
}
function shopForm(s) {
  const v = s || { category: "groceries", refresh: "weekly", refresh_dow: 3 };
  return `<form class="panel shop-form" id="shopEditForm" data-id="${esc(s?.id || "")}" aria-label="${esc(s ? t("编辑商店") : t("添加商店"))}">
    <div class="form-grid">
      <label class="span-2">${t("名称")}<input name="name" required maxlength="60" value="${esc(v.name || "")}" placeholder="${esc(t("例如：ALDI"))}" list="shopChains"></label>
      <label>${t("分类")}<select name="category" data-nosearch>${SHOP_CATS.map(([c, n, i]) => `<option value="${c}" ${v.category === c ? "selected" : ""}>${i} ${esc(t(n))}</option>`).join("")}</select></label>
      <label>${t("ZIP")}<input name="zip" maxlength="10" inputmode="numeric" value="${esc(v.zip || "")}"></label>
      <label class="span-2">${t("地址")}<input name="address" maxlength="200" value="${esc(v.address || "")}" placeholder="${esc(t("门牌、街道、城市"))}"></label>
      <label class="span-2">${t("本周广告链接（可不填）")}<input name="ad_url" type="url" maxlength="500" value="${esc(v.ad_url || "")}" placeholder="${esc(t("不填：用这家连锁店的广告页，没有就用 Flipp 搜索"))}"></label>
      <label>${t("电话")}<input name="phone" maxlength="30" value="${esc(v.phone || "")}"></label>
      <label>${t("更新特价")}<select name="refresh" data-nosearch><option value="weekly" ${v.refresh === "weekly" ? "selected" : ""}>${t("每周")}</option><option value="manual" ${v.refresh === "manual" ? "selected" : ""}>${t("需要时手动")}</option></select></label>
      <label>${t("每周哪天换广告")}<select name="refresh_dow" data-nosearch>${DOW.map((d, i) => `<option value="${i}" ${+v.refresh_dow === i ? "selected" : ""}>${t(d)}</option>`).join("")}</select></label>
      <label class="span-2 check-inline shop-auto"><input type="checkbox" name="auto_update" ${v.auto_update ? "checked" : ""}><span>🤖 ${t("换广告那天自动更新（Claude 定时任务每天早上看一次，到了这家的换广告日就读广告、自动录入；只对「每周」的商店生效，季节 / 节日类的保持手动）")}</span></label>
      <label class="span-2">${t("备注")}<input name="notes" maxlength="300" value="${esc(v.notes || "")}" placeholder="${esc(t("会员卡、营业时间、哪个门口好停车…"))}"></label>
    </div>
    <datalist id="shopChains">${Object.values(CHAINS).map((c) => `<option value="${esc(c.name)}">`).join("")}</datalist>
    <div class="form-actions"><button class="btn btn-primary" type="submit">${t("保存")}</button><button type="button" class="btn btn-ghost" data-action="shops-edit-cancel">${t("取消")}</button>
      ${s ? `${s.archived ? "" : `<button type="button" class="btn btn-ghost" data-action="shops-archive" data-id="${s.id}">${t("不去了")}</button>`}<button type="button" class="btn btn-ghost btn-danger" data-action="shops-del" data-id="${s.id}">${t("删除")}</button>` : ""}</div>
  </form>`;
}

/* ───────────── 找附近的商店 ───────────── */
function viewFind() {
  const f = ui().find, have = new Map((state.shops || []).filter((s) => s.osm_id).map((s) => [s.osm_id, s]));
  const fq = (f.q || "").trim().toLowerCase(), res = f.results && f.results.filter((x) => !fq || `${x.name} ${x.address}`.toLowerCase().includes(fq));   // 结果里再按名称 / 地址筛
  return `<section class="section shops-page">
    ${crumbNav([{ href: href("shopping"), label: t("采购") }, { href: href("shops", "list"), label: t("常去的商店") }, { label: t("找附近的商店"), icon: "📍" }])}
    ${missingPanel()}
    <form class="panel shops-find" id="shopsFindForm" aria-label="${esc(t("找附近的商店"))}">
      <div class="shops-find-row">
        <label>${t("ZIP")}<input name="zip" data-shops-zip inputmode="numeric" maxlength="5" value="${esc(f.zip)}" placeholder="60103"></label>
        <button type="button" class="btn btn-ghost" data-action="shops-locate">📍 ${t("用当前位置")}</button>
        <button type="submit" class="btn btn-primary" ${f.busy ? "disabled" : ""}>${f.busy ? t("正在找…") : t("搜索")}</button>
      </div>
      <div class="shops-find-opts"><span class="pick-lbl">${t("范围")}</span><div class="chips" role="group" aria-label="${esc(t("范围"))}">${[5, 10, 15, 20].map((m) => `<button type="button" class="chip" data-action="shops-radius" data-v="${m}" aria-pressed="${f.radius === m}">${t("{n} 英里", { n: m })}</button>`).join("")}
        <label class="find-mi"><span class="sr-only">${t("自己填范围（英里）")}</span><input type="number" data-find-radius min="1" max="${MAX_MI}" step="1" inputmode="numeric" value="${[5, 10, 15, 20].includes(f.radius) ? "" : f.radius}" placeholder="${esc(t("自己填"))}"><span aria-hidden="true">${t("英里")}</span></label></div></div>
      <div class="shops-find-opts"><span class="pick-lbl">${t("分类")}</span><div class="chips" role="group" aria-label="${esc(t("分类"))}">${SHOP_CATS.filter(([c]) => c !== "other").map(([c, n, i]) => `<button type="button" class="chip" data-action="shops-fcat" data-v="${c}" aria-pressed="${f.cats.includes(c)}">${i} ${esc(t(n))}</button>`).join("")}</div></div>
      ${f.pt ? `<p class="muted" style="margin:0;font-size:12.5px">${t("中心：{p}", { p: esc(f.pt.place || `${f.pt.lat.toFixed(3)}, ${f.pt.lon.toFixed(3)}`) })} · ${t("门店数据来自 OpenStreetMap，可能不全；没找到的可以手动添加。")}</p>` : ""}
      ${f.error ? `<p class="form-error" role="alert">${esc(f.error)}</p>` : ""}
    </form>
    ${f.results?.length ? `<div class="shops-bar"><label class="shops-q"><span class="sr-only">${t("在结果里筛选")}</span><input type="search" data-find-q value="${esc(f.q || "")}" placeholder="${esc(t("在结果里筛选：名称、街道、城市"))}" autocomplete="off"></label></div>` : ""}
    ${f.results?.partial && f.busy ? `<p class="shops-note" role="status">⏳ ${t("先列出附近的常见连锁店，正在找更多门店…")}</p>`
      : f.results?.partial ? `<p class="shops-note" role="status">${t("地图服务这会儿忙，先列出附近的常见连锁店；小店要等它不忙时再搜一次。")} <button type="button" class="btn btn-sm btn-ghost" data-action="shops-find-fresh">${t("再搜一次")}</button></p>`
      : f.results?.cached ? `<p class="muted shops-count">${t("这是 {d} 搜过的结果（一周内不重复问地图服务）。", { d: fmtShort(new Date(f.results.cached).toISOString()) })} <button type="button" class="btn btn-sm btn-ghost" data-action="shops-find-fresh">${t("重新搜索")}</button></p>` : ""}
    ${res ? (res.length ? `<p class="muted shops-count">${fq ? t("{n} / {m} 家", { n: res.length, m: f.results.length }) : t("找到 {n} 家", { n: res.length })}</p><ul class="panel find-list">${res.map((x) => {
      const mine = have.get(x.osm_id), [, cn, icon] = shopCat(x.category);
      const btn = mine ? (mine.archived ? `<button type="button" class="btn btn-sm" data-action="shops-unarchive" data-id="${mine.id}">${t("加回常去")}</button>` : `<a class="btn btn-sm btn-ghost" href="${shopHref(mine)}">${t("已加入")} ›</a>`)
        : `<button type="button" class="btn btn-sm btn-primary" data-action="shops-add-osm" data-osm="${esc(x.osm_id)}">＋ ${t("加入")}</button>`;
      return `<li class="find-row"><span class="shop-ico" aria-hidden="true">${icon}</span><span class="shop-txt"><b>${esc(x.name)}</b><small>${esc(t(cn))} · ${t("{n} 英里", { n: x.dist.toFixed(1) })}${x.address ? ` · ${esc(x.address)}` : ""}</small></span>${btn}</li>`;
    }).join("")}</ul>` : `<p class="muted shops-empty">${t("这个范围里没找到。放大范围或多选几个分类再试。")}</p>`) : ""}
  </section>`;
}

/* ───────────── 用 Claude 整理（Chrome 侧边栏）：复制指令 → 贴回 JSON → 按商店导入 ───────────── */
function claudePanel() {
  const u = ui(), imp = u.imp;
  return `<div class="panel shops-claude">
    <b>🤖 ${t("用 Claude 整理特价")}</b>
    <ol class="shops-steps">
      <li>${t("在 Flipp 或超市网站上打开这几家本周的广告（一家一个标签页），自己先搜好要的东西。")}</li>
      <li>${t("复制下面的指令，粘贴给 Chrome 侧边栏里的 Claude；它只读你打开的页面，不会自己去翻。")}</li>
      <li>${t("把 Claude 最后给的 JSON 贴到下面，点「看看能导入什么」，核对后导入。")}</li>
    </ol>
    <div class="form-actions"><button type="button" class="btn btn-sm" data-action="shops-claude-copy" data-mode="all">📋 ${t("复制「整理特价」指令")}</button>
      <button type="button" class="btn btn-sm" data-action="shops-claude-copy" data-mode="list">📋 ${t("复制「按采购清单比价」指令")}</button></div>
    ${u.copyText ? copyBox() : ""}
    <label class="att-text"><span>${t("Claude 给的 JSON")}</span><textarea id="shopsImportText" data-autosize rows="3" placeholder='{"stores":[{"store":"ALDI","deals":[…]}]}'>${esc(u.impText || "")}</textarea></label>
    ${imp ? (imp.length ? `<ul class="shops-imp">${imp.map((g, i) => `<li><label class="check-inline"><input type="checkbox" data-imp="${i}" ${g.include ? "checked" : ""} ${g.shop ? "" : "disabled"}>
        <span><b>${esc(g.store || t("没写店名"))}</b> · ${t("{n} 条", { n: g.rows.length })}${g.shop ? (g.shop.name !== g.store ? ` → ${esc(g.shop.name)}` : "") : ` <span class="warn-txt">${t("常去里没有这家，先添加再导入")}</span>`}</span></label></li>`).join("")}</ul>
      <label class="check-inline"><input type="checkbox" id="shopsImpReplace" ${u.impReplace !== false ? "checked" : ""}><span>${t("替换这几家现有的特价（新一周的广告选这个）")}</span></label>
      <div class="form-actions"><button type="button" class="btn btn-primary" data-action="shops-import-save">${t("导入勾选的")}</button><button type="button" class="btn btn-ghost" data-action="shops-import-cancel">${t("取消")}</button></div>`
      : `<p class="form-error">${t("没读出任何一家的特价，检查一下贴的是不是 Claude 最后那段 JSON。")}</p>`)
    : `<div class="form-actions"><button type="button" class="btn btn-primary" data-action="shops-import-parse">${t("看看能导入什么")}</button></div>`}
    ${u.impError ? `<p class="form-error" role="alert">${esc(u.impError)}</p>` : ""}
  </div>`;
}
const copyBox = () => `<details class="shops-copy" open><summary>${t("没能自动复制，请手动全选复制")}</summary><textarea readonly rows="6">${esc(ui().copyText)}</textarea></details>`;

/* ───────────── 单个商店 ───────────── */
function viewShop(id) {
  const s = (state.shops || []).find((x) => x.id === id);
  const base = [{ href: href("shopping"), label: t("采购") }, { href: href("shops", "list"), label: t("常去的商店") }];
  if (!s) return `<section class="section shops-page">${crumbNav([...base, { label: t("商店") }])}<p class="muted">${state.shops ? t("这家商店不在了。") : t("加载中…")}</p></section>`;
  const [, cn, icon] = shopCat(s.category), d = distOf(s), du = dealUi(s.id), deals = liveDeals(s.id);
  const openUpd = du.rows || du.busy || state.route.q.get("update") === "1" || !deals.length;
  const refreshTxt = (s.refresh === "weekly" ? t("每{d}换广告", { d: t(DOW[s.refresh_dow ?? 3]) }) : t("需要时手动更新")) + (s.auto_update && s.refresh === "weekly" ? ` · 🤖 ${t("{d}自动更新", { d: t(DOW[s.refresh_dow ?? 3]) })}` : "");
  return `<section class="section shops-page shop-page">
    ${crumbNav([...base, { label: s.name, icon }])}
    ${missingPanel()}
    ${ui().edit === s.id ? shopForm(s) : `<div class="panel shop-head">
      <div class="shop-head-main"><span class="shop-ico big" aria-hidden="true">${icon}</span><div>
        <b class="shop-title">${esc(s.name)}</b>${s.archived ? ` <span class="tag">${t("不去了")}</span>` : ""}
        <p class="muted">${esc(t(cn))}${s.address ? ` · <a href="${esc(mapUrl(s))}" target="_blank" rel="noopener">${esc(s.address)}</a>` : ""}${d != null ? ` · ${t("{n} 英里", { n: d.toFixed(1) })}` : ""}${s.phone ? ` · <a href="tel:${esc(s.phone)}">${esc(s.phone)}</a>` : ""}</p>
        <p class="muted">${refreshTxt}${s.deals_at ? ` · ${t("上次更新 {d}", { d: fmtShort(s.deals_at) })}` : ""}${dealsDue(s) ? ` · <b class="warn-txt">${t("本周待更新")}</b>` : ""}${s.notes ? ` · ${esc(s.notes)}` : ""}</p></div></div>
      <div class="shop-head-acts"><a class="btn btn-sm btn-primary" href="${esc(adUrl(s))}" target="_blank" rel="noopener">${t("本周广告")} ↗</a>
        <a class="btn btn-sm" href="${esc(flippUrl(s))}" target="_blank" rel="noopener">Flipp ↗</a>
        ${state.runsMissing || Store.mode === "demo" ? "" : `<a class="btn btn-sm" href="pantrydeals://run?shop=${encodeURIComponent(s.id)}" data-autorun title="${esc(t("只能在装了 pantry-deals 脚本的笔记本上用"))}">🤖 ${t("用脚本更新")}</a>`}
        <button type="button" class="btn btn-sm btn-ghost" data-action="shops-edit" data-id="${s.id}">${t("编辑")}</button>
        ${s.archived ? `<button type="button" class="btn btn-sm" data-action="shops-unarchive" data-id="${s.id}">${t("加回常去")}</button>` : ""}</div>
      ${state.runsMissing || Store.mode === "demo" ? "" : `<p class="muted autorun-hint">💻 ${t("「用脚本更新」只能在装了 pantry-deals 脚本的笔记本上用：Chrome 会先问要不要打开 PantryDeals，点「打开」后笔记本上会弹出一个窗口，读这家的广告并录入（几分钟）。完成后看 📜 更新记录。手机上点了没有反应。")}</p>`}
    </div>`}
    <details class="panel deal-upd" ${openUpd ? "open" : ""}><summary><b>${t("更新特价")}</b> <span class="muted">${t("拍广告、截图或粘贴文字，AI 读成特价清单；确认后保存")}</span></summary>
      ${du.rows ? reviewHtml(s, du) : updateHtml(s, du)}
    </details>
    ${dealsHtml(s, du, deals)}
  </section>`;
}
function updateHtml(s, du) {
  const id = `shopdeal-${s.id}`, ready = aiReady();
  return `<div class="deal-in">
    ${attachHTML(id, { t, esc, textLabel: t("广告文字，或 Claude 整理好的结果（JSON）"), ph: t("在 Flipp 或超市网站上先搜好、打开这家本周的广告，再截图或复制文字贴到这里"), rows: 3,
      hint: `${t("小技巧：先自己在页面上搜出要的东西（鸡蛋、牛奶…），再截图让 AI 读，最快也最省额度。")}${ready ? "" : ` ${t("没填 AI key 时，只能导入 Claude 整理好的 JSON。")}`}` })}
    <div class="form-actions"><button type="button" class="btn btn-primary" data-action="shops-read" data-id="${s.id}" ${du.busy ? "disabled" : ""}>${du.busy ? t("正在读…（几十秒）") : t("读出特价")}</button>
      <button type="button" class="btn btn-ghost" data-action="shops-claude-copy" data-id="${s.id}">📋 ${t("复制给 Claude 的指令")}</button>
      <button type="button" class="btn btn-ghost" data-action="shops-manual" data-id="${s.id}">＋ ${t("手动加一条")}</button></div>
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
/** 单价常常不到一毛（$0.023 /fl oz）：小于 1 时多留一位小数，不然都显示成 $0.02 */
const unitMoney = (v) => (v >= 1 ? money(v) : money(0).replace(/0([.,])00/, `0$1${v.toFixed(3).slice(2)}`));
/** 折扣类型的小标签（Black Friday、店内、网上、Rollback…） */
const typeTags = (v) => String(v || "").split(",").filter(Boolean).map((k) => `<span class="tag deal-type dt-${esc(k)}">${esc(t(dealTypeName(k)))}</span>`).join("");
const COLS = { name: "名称", size: "规格", price: "价格", price_text: "广告原文", unit_price: "单价", unit_label: "单位", valid_to: "到期" };

/** 以前的价格：一行小结（点开看明细）。现在是 6 个月最低 → 绿色；比以前最低贵 → 写出以前最低是多少、哪家、哪天 */
const histVal = (h, x) => (h.by === "unit" ? `${unitMoney(+x.unit_price)}${esc(x.unit_label || "")}` : money(+x.price));
const shopName = (id) => (state.shops || []).find((x) => x.id === id)?.name || "?";
function histBtn(d, du) {
  const h = priceHistory(d); if (!h) return "";
  const open = du.hist === d.id;
  const txt = h.isLow ? `<span class="tag tag-ok">${t("6 个月最低")}</span> <span>${t("以前 {n} 次", { n: h.list.length })}</span>`
    : `<span>${t("以前最低 {v}（{s} {d}）", { v: histVal(h, h.low), s: esc(shopName(h.low.shop_id)), d: fmtShort(h.low.valid_to) })}</span>${h.pct > 0 ? ` <b class="warn-txt">+${h.pct}%</b>` : ""}`;
  return `<button type="button" class="deal-hist-btn" data-action="shops-hist" data-deal="${d.id}" aria-expanded="${open}">📈 ${txt} <span aria-hidden="true">${open ? "▴" : "▾"}</span></button>`;
}
function histList(d) {
  const h = priceHistory(d); if (!h) return "";
  return `<ul class="deal-hist" aria-label="${esc(t("以前的价格"))}">${h.list.slice(0, 10).map((x) => `<li class="${x.id === h.low.id ? "is-low" : ""}">
    <span class="dh-when">${x.valid_from ? `${fmtShort(x.valid_from)}–` : ""}${fmtShort(x.valid_to)}</span><span class="dh-shop">${esc(shopName(x.shop_id))}</span>
    <span class="dh-nm">${esc(x.name)}${x.size ? ` <small>${esc(x.size)}</small>` : ""}</span><b class="dh-v">${histVal(h, x)}</b></li>`).join("")}</ul>
    ${h.list.length > 10 ? `<p class="muted dh-more">${t("只列最近 10 次，共 {n} 次", { n: h.list.length })}</p>` : ""}`;
}

/** 折扣类型：下拉多选（关着时像普通下拉，显示已选的；点开是一列勾选框）。可以选几个，比如 Black Friday + 网上 */
const dtSummary = (keys) => (keys.length ? keys.map((k) => t(dealTypeName(k))).join("、") : t("没有特别类型"));
function dealTypeDrop(value, labelId) {
  const on = String(value || "").split(",").filter(Boolean);
  return `<details class="dt-drop"><summary aria-labelledby="${labelId}" aria-describedby="${labelId}-v"><span class="dt-val" id="${labelId}-v">${esc(dtSummary(on))}</span></summary>
    <div class="dt-menu" role="group" aria-labelledby="${labelId}">${DEAL_TYPES.map(([k, l]) => `<label class="dt-opt"><input type="checkbox" name="deal_type" value="${k}" ${on.includes(k) ? "checked" : ""}><span>${esc(t(l))}</span></label>`).join("")}</div></details>`;
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
  const row = (d) => {
    const m = dealMatches(d, open), ed = du.edit === d.id;
    if (ed) return `<li class="deal-row editing"><form class="deal-edit" id="dealEditForm" data-id="${d.id}">
      <div class="form-grid"><label class="span-2">${t("名称")}<input name="name" maxlength="80" required value="${esc(d.name)}"></label><label>${t("规格")}<input name="size" maxlength="40" value="${esc(d.size || "")}"></label>
      <label>${t("价格")}<input name="price" type="number" min="0" step="0.01" value="${d.price ?? ""}"></label><label>${t("广告原文")}<input name="price_text" maxlength="40" value="${esc(d.price_text || "")}"></label>
      <label>${t("单价")}<input name="unit_price" type="number" min="0" step="0.0001" value="${d.unit_price ?? ""}"></label><label>${t("单位")}<input name="unit_label" maxlength="12" value="${esc(d.unit_label || "")}"></label>
      <label>${t("到期")}<input name="valid_to" type="date" value="${esc(d.valid_to || "")}"></label><label class="span-2">${t("通用叫法")}<input name="aka" maxlength="120" value="${esc(d.aka || "")}" placeholder="${esc(t("鸡蛋, eggs"))}"></label>
      ${state.runsMissing ? "" : `<div class="span-2 dt-field"><span class="dt-lbl" id="dtLbl-${d.id}">${t("折扣类型")}</span>${dealTypeDrop(d.deal_type, `dtLbl-${d.id}`)}</div>`}</div>
      <div class="form-actions"><button class="btn btn-primary btn-sm" type="submit">${t("保存")}</button><button type="button" class="btn btn-ghost btn-sm" data-action="shops-deal-cancel" data-id="${s.id}">${t("取消")}</button></div></form></li>`;
    // 手机：没有按钮，向左滑删除、向右滑加入清单（都先确认），点名称修改；电脑：按钮照旧（悬停 / Tab 也能用），点名称同样修改
    const swipe = `data-swipe-del="deal"${m.length ? "" : ` data-swipe-alt="deal" data-swipe-alt-label="${esc(t("加入清单"))}" data-swipe-alt-go="${esc(t("松手加入清单"))}"`}`;
    return `<li class="deal-row ${m.length ? "is-hit" : ""}" ${swipe}>
      <span class="deal-nm"><button type="button" class="deal-nm-btn" data-action="shops-deal-edit" data-deal="${d.id}" data-id="${s.id}" title="${esc(t("点一下修改"))}"><b>${esc(d.name)}</b></button>${d.deal_type ? `<span class="deal-types">${typeTags(d.deal_type)}</span>` : ""}<small>${[d.brand, d.size].filter(Boolean).map(esc).join(" · ")}${m.length ? ` <span class="tag tag-hot">${t("清单里有：{n}", { n: m.map((x) => esc(x.name)).join("、") })}</span>` : ""}</small>${histBtn(d, du)}</span>
      <span class="deal-pr"><b>${d.price != null ? money(d.price) : esc(d.price_text || "—")}</b>${d.price_text && d.price != null && d.price_text.replace(/\s/g, "") !== money(d.price).replace(/\s/g, "") ? `<small>${esc(d.price_text)}</small>` : ""}${d.regular_price ? `<small class="muted"><s>${money(d.regular_price)}</s></small>` : ""}</span>
      <span class="deal-unit">${d.unit_price != null ? `${unitMoney(d.unit_price)}<small>${esc(d.unit_label || "")}</small>` : `<small class="muted">—</small>`}</span>
      <span class="deal-to ${soon(d) ? "warn-txt" : "muted"}">${d.valid_to ? t("到 {d}", { d: fmtShort(d.valid_to) }) : ""}</span>
      <span class="deal-acts">${m.length ? "" : `<button type="button" class="btn btn-sm btn-ghost swipe-alt-src" data-action="shops-tolist" data-deal="${d.id}">＋ ${t("清单")}</button>`}
        <button type="button" class="btn btn-sm btn-ghost" data-action="shops-deal-edit" data-deal="${d.id}" data-id="${s.id}" aria-label="${esc(t("修改 {name}", { name: d.name }))}">${t("改")}</button>
        <button type="button" class="btn btn-sm btn-ghost swipe-src" data-action="shops-deal-del" data-deal="${d.id}" aria-label="${esc(t("删除 {name}", { name: d.name }))}">×</button></span>
      ${du.hist === d.id ? histList(d) : ""}
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
      ${du.q || du.cat || du.type || (du.filter && du.filter !== "all") ? `<button type="button" class="btn btn-sm btn-ghost" data-action="shops-dreset" data-id="${s.id}">${t("清除筛选")}</button>` : ""}
    </div>
    <div class="deal-th" aria-hidden="true"><span>${t("商品")}</span><span>${t("价格")}</span><span>${t("单价")}</span><span>${t("有效期")}</span><span></span></div>
    ${list.length ? `<ul class="deal-list">${list.map(row).join("")}</ul>` : `<p class="muted">${t("没有符合条件的特价。")}</p>`}` : `<p class="muted">${t("更新一次特价，这里就会列出本周在打折的东西。")}</p>`}
  </div>`;
}

/* ───────────── 采购清单里用到的小块 ───────────── */
/** 清单某一项现在最便宜的特价：「🏷 ALDI $2.49 · 到 11/18」 */
export function shopDealLine(s) {
  if (!state.shops?.length) return "";
  const b = bestDealFor(s); if (!b) return "";
  const d = b.deal;
  return `<a class="shop-deal-line" href="${shopHref(b.shop)}">🏷 ${esc(b.shop.name)} ${d.price != null ? money(d.price) : esc(d.price_text || "")}${d.size ? ` <small>${esc(d.size)}</small>` : ""}${d.valid_to ? ` · ${t("到 {d}", { d: fmtShort(d.valid_to) })}` : ""}${b.n > 1 ? ` · ${t("另有 {n} 家", { n: b.n - 1 })}` : ""}</a>`;
}
/** 采购看板上「常去的商店与特价」那一格的数字：几家常去、几条在有效期的特价、几条对上清单、几家待更新 */
export function shopsStats() {
  const shops = (state.shops || []).filter((s) => !s.archived), ids = new Set(shops.map((s) => s.id));
  const live = liveDeals().filter((d) => ids.has(d.shop_id)), open = openShopping();
  return { shops: shops.length, deals: live.length, hits: open.length ? live.filter((d) => dealMatches(d, open).length).length : 0, due: shops.filter(dealsDue).length };
}

/* ───────────── 更新记录（迁移 068）：什么时候、怎么录的、哪几家、加了几条、失败原因 ───────────── */
const RUN_SRC = { auto: ["🤖", "每周自动更新"], claude: ["🧩", "Claude 整理导入"], photo: ["📷", "拍广告 / 截图"], paste: ["📋", "粘贴文字"], manual: ["✍️", "手动"] };
const RUN_ST = { ok: ["tag-ok", "成功"], partial: ["tag-warn", "部分失败"], failed: ["tag-hot", "失败"] };
function viewRuns() {
  const u = ui(), lf = (u.log ||= { src: "", shop: "" });
  const runs = (state.dealRuns || []).filter((r) => (!lf.src || r.source === lf.src) && (!lf.shop || (r.stores || []).some((x) => x.shop_id === lf.shop)));
  const autos = (state.shops || []).filter((x) => !x.archived && x.auto_update && x.refresh === "weekly");
  const lastAuto = (state.dealRuns || []).find((r) => r.source === "auto");
  const opt = (v, l, c) => `<option value="${esc(v)}" ${c === v ? "selected" : ""}>${esc(l)}</option>`;
  return `<section class="section shops-page">
    ${crumbNav([{ href: href("shopping"), label: t("采购") }, { href: href("shops", "list"), label: t("常去的商店") }, { label: t("更新记录"), icon: "📜" }])}
    ${state.runsMissing ? `<div class="panel cta-panel"><div><b>${t("数据库还没升级")}</b><p class="muted">${t("请在 Supabase 的 SQL Editor 执行 migrations/068_shop_deal_runs.sql，才能记录每次更新、打开每周自动更新。")}</p></div></div>` : ""}
    <div class="panel runs-auto">
      <b>🤖 ${t("每周自动更新")}</b>
      <p class="muted">${autos.length ? t("Claude 定时任务每天早上 10 点看一次，到了换广告日就更新这家：{names}", { names: autos.map((x) => `${esc(x.name)}（${t(DOW[x.refresh_dow ?? 3])}）`).join("、") }) : t("还没有商店打开「换广告那天自动更新」。在商店的编辑里打开（只对每周换广告的商店）。")}</p>
      <p class="muted">${lastAuto ? t("上次自动更新：{d}", { d: fmtWhen(lastAuto.run_at) }) : t("还没有自动更新过。")} · ${t("电脑要开着、Chrome 要开着并登录爱家小助手，任务才能跑。")}</p>
    </div>
    <div class="toolbar shops-toolbar">
      <select data-run-src data-nosearch aria-label="${esc(t("按方式筛选"))}">${opt("", t("全部方式"), lf.src)}${Object.entries(RUN_SRC).map(([k, [i, l]]) => opt(k, `${i} ${t(l)}`, lf.src)).join("")}</select>
      <select data-run-shop data-nosearch aria-label="${esc(t("按商店筛选"))}">${opt("", t("全部商店"), lf.shop)}${(state.shops || []).map((x) => opt(x.id, x.name, lf.shop)).join("")}</select>
    </div>
    ${runs.length ? `<ul class="run-list">${runs.map((r) => {
      const [ic, sl] = RUN_SRC[r.source] || ["•", r.source], [cls, stl] = RUN_ST[r.status] || RUN_ST.ok;
      return `<li class="panel run-row"><div class="run-top"><b>${ic} ${t(sl)}</b><span class="tag ${cls}">${t(stl)}</span><span class="muted run-at">${fmtWhen(r.run_at)}</span></div>
        <ul class="run-stores">${(r.stores || []).map((x) => `<li>${x.shop_id && shopById(x.shop_id) ? `<a href="${shopHref(shopById(x.shop_id))}">${esc(x.name)}</a>` : esc(x.name || "?")}
          ${x.error ? `<span class="run-err">✕ ${esc(x.error)}</span>` : `<span class="muted">${t("加了 {n} 条", { n: x.added ?? 0 })}${x.replaced ? ` · ${t("替换 {m} 条", { m: x.replaced })}` : ""}</span>`}</li>`).join("")}</ul>
        ${r.note ? `<p class="muted run-note">${esc(r.note)}</p>` : ""}</li>`;
    }).join("")}</ul>` : `<p class="muted shops-empty">${t("还没有更新记录。以后每次录入特价（自动、导入、拍照、手动）都会记在这里。")}</p>`}
  </section>`;
}
const fmtWhen = (iso) => { try { return new Date(iso).toLocaleString(lang === "en" ? "en-US" : "zh-CN", { month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" }); } catch { return iso; } };

/* ───────────── 给每周定时任务（Claude Code 的 /pantry-deals auto）用的入口 ─────────────
 * 定时任务在已登录的爱家小助手标签页里调用：
 *   await hmhDeals.autoShops()          → 打开了自动更新、而且到了换广告日还没更新的商店（dealsDue；定时任务每天跑，周日换广告的周日更新）
 *                                          （含地址、ZIP、家里的 ZIP、广告链接、Flipp 链接、这一期起止日期）
 *   await hmhDeals.importAuto(json)     → json = {"stores":[…同 Claude 整理的格式…], "failed":[{"store":"","reason":""}], "note":""}
 *                                          每家先删掉现有的有效特价再存新的（特价本身记 source = claude——shop_deals 不认 auto）；没写日期的按换广告日补；写一条 source = auto 的更新记录；返回每家的结果
 * 只认 auto_update 打开的商店，别的店名一律跳过（记在记录里），所以任务不会改到手动维护的商店。
 * 例外：商店页上手动点「🤖 用脚本更新」（pantrydeals://run?shop=<id>）→ 脚本跑 /pantry-deals auto <id>，
 *   这时 autoShops({ id }) 只返回那一家、importAuto(json, { only: id }) 只录那一家——不管它开没开自动更新（是你自己点的）。 */
function installAutoHook() {
  window.hmhDeals = {
    async autoShops({ id = null } = {}) {
      await loadShops();
      const watch = restockWatch(), item_names = myItemNames();   // 每家都一样：家里告急的 / 清单上的 / 常补的，读广告时优先找；物品名用来填 aka
      return (state.shops || []).filter((x) => (id ? x.id === id : !x.archived && x.auto_update && x.refresh === "weekly" && dealsDue(x)))
        .map((x) => ({ id: x.id, name: x.name, chain: x.chain, address: x.address, zip: x.zip || null, home_zip: savedZip()?.zip || null, ad_url: adUrl(x), flipp_url: flippUrl(x), refresh_dow: x.refresh_dow ?? 3, ...weekWindow(x), due: dealsDue(x), deals_at: x.deals_at,
          sections: FOCUS_SECTIONS[x.chain] || null, watch, item_names }));
    },
    async importAuto(j, { only = null } = {}) {
      if (typeof j === "string") j = parseLooseJson(j);
      await loadShops();
      const autos = new Set(only ? [only] : (state.shops || []).filter((x) => !x.archived && x.auto_update && x.refresh === "weekly").map((x) => x.id));
      const log = [];
      for (const g of importGroups(j)) {
        if (!g.shop || !autos.has(g.shop.id)) { log.push({ shop_id: g.shop?.id || null, name: g.store, added: 0, replaced: 0, error: t("不是自动更新的商店，跳过") }); continue; }
        try { log.push({ shop_id: g.shop.id, name: g.shop.name, ...(await applyDeals(g.shop, g.rows, { source: "claude", replace: true })) }); }
        catch (e) { log.push({ shop_id: g.shop.id, name: g.shop.name, added: 0, replaced: 0, error: String(e.message).slice(0, 200) }); }
      }
      for (const f of Array.isArray(j?.failed) ? j.failed : []) {
        const shop = (state.shops || []).find((x) => x.name === f.store || (chainOf(f.store) && x.chain === chainOf(f.store)));
        log.push({ shop_id: shop?.id || null, name: String(f.store || "?").slice(0, 60), added: 0, replaced: 0, error: String(f.reason || "failed").slice(0, 200) });
      }
      if (!log.length) log.push({ shop_id: null, name: "—", added: 0, replaced: 0, error: t("没有读到任何特价") });
      const note = [only ? t("在商店页手动触发") : "", j?.note ? String(j.note) : ""].filter(Boolean).join(" · ").slice(0, 500) || null;
      const run = await logRun("auto", log, note);
      R?.(false);
      return { ok: !!run || state.runsMissing, logged: !!run, stores: log };
    },
  };
}

/* ───────────── 操作 ───────────── */
const shopById = (id) => (state.shops || []).find((s) => s.id === id);
function upsertLocal(row) { const i = state.shops.findIndex((x) => x.id === row.id); if (i >= 0) state.shops[i] = row; else state.shops.push(row); }
async function addShop(row) { const saved = await Store.saveShop(row); upsertLocal(saved); return saved; }
function formRow(f) {
  const g = (n) => f.elements[n]?.value.trim() || null;
  const name = g("name"), chain = chainOf(name);
  return { name, chain, category: g("category") || "groceries", zip: g("zip"), address: g("address"), ad_url: g("ad_url"), phone: g("phone"), refresh: g("refresh") || "weekly", refresh_dow: +(g("refresh_dow") ?? 3), notes: g("notes"),
    ...(state.runsMissing ? {} : { auto_update: !!f.elements.auto_update?.checked && (g("refresh") || "weekly") === "weekly" }) };   // 没执行 068 时不送这一列
}

export async function shopsAction(action, el, { render, go, refresh }) {
  const u = ui(), id = el.dataset.id;
  switch (action) {
    case "shops-new": {   // 再点一次收起来
      if (u.edit === "new") { u.edit = null; render(); return; }
      u.edit = "new"; render(); const f = $("#shopEditForm"); f?.scrollIntoView({ block: "nearest", behavior: "smooth" }); f?.elements.name.focus({ preventScroll: true }); return;
    }
    case "shops-edit": u.edit = id; render(); return;
    case "shops-edit-cancel": u.edit = null; render(); return;
    case "shops-status": u.status = el.dataset.v; render(); return;
    case "shops-cat": u.cat = el.dataset.v; render(); return;
    case "shops-reset": Object.assign(u, { q: "", cat: "", status: "active", sort: "name" }); render(); return;
    case "shops-radius": u.find.radius = +el.dataset.v; render(); return;
    case "shops-find-fresh": if (u.find.pt) { u.find.fresh = true; runFind(render); } return;
    case "shops-fcat": { const c = el.dataset.v, cs = u.find.cats; u.find.cats = cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]; render(); return; }
    case "shops-archive": { const s = shopById(id); if (!s) return; upsertLocal(await Store.saveShop({ ...s, archived: true })); u.edit = null; toast(t("{name} 已收进「不去了」，随时可以加回来", { name: s.name })); render(); return; }
    case "shops-unarchive": { const s = shopById(id); if (!s) return; upsertLocal(await Store.saveShop({ ...s, archived: false })); toast(t("{name} 已加回常去", { name: s.name })); render(); return; }
    case "shops-del": {
      const s = shopById(id); if (!s) return;
      if (!confirmDelete(t("删除「{name}」和它的 {n} 条特价？只是不想去了的话，用「不去了」就行，还能加回来。", { name: s.name, n: (state.shopDeals || []).filter((d) => d.shop_id === id).length }))) return;
      await Store.deleteShop(id); state.shops = state.shops.filter((x) => x.id !== id); state.shopDeals = state.shopDeals.filter((d) => d.shop_id !== id); u.edit = null;
      toast(t("已删除 {name}", { name: s.name })); if (state.route.sub === "shop") go(href("shops", "list"), { replace: true }); else render(); return;
    }
    case "shops-locate": {
      if (!navigator.geolocation) { u.find.error = t("这个浏览器拿不到位置，请填 ZIP。"); return render(); }
      u.find.busy = true; u.find.error = ""; render();
      navigator.geolocation.getCurrentPosition(async (p) => { u.find.pt = { zip: "", lat: p.coords.latitude, lon: p.coords.longitude, place: t("当前位置") }; u.find.busy = false; await runFind(render); },
        () => { u.find.busy = false; u.find.error = t("没拿到位置（可能没允许），请填 ZIP。"); render(); }, { timeout: 15000, maximumAge: 600000 });
      return;
    }
    case "shops-add-osm": {
      const x = (u.find.results || []).find((r) => r.osm_id === el.dataset.osm); if (!x) return;
      el.disabled = true;
      const { dist, ...row } = x; const saved = await addShop(row);
      toast(t("已加入 {name}", { name: saved.name })); render(); return;
    }
    case "shops-starter": return starter(render);
    case "shops-claude": u.claude = !u.claude; u.copyText = ""; render(); return;
    case "shops-claude-copy": {
      const one = id ? shopById(id) : null, shops = one ? [one] : (state.shops || []).filter((s) => !s.archived);
      const list = el.dataset.mode === "list" ? openShopping().map((s) => s.name) : [];
      if (el.dataset.mode === "list" && !list.length) { toast(t("采购清单是空的。")); return; }
      const text = claudePrompt({ shops, zip: home()?.zip || "", list });
      try { await navigator.clipboard.writeText(text); u.copyText = ""; toast(t("已复制：在 Chrome 侧边栏里粘贴给 Claude")); }
      catch { u.copyText = text; }
      render(); return;
    }
    case "shops-import-parse": {
      u.impText = $("#shopsImportText")?.value || ""; u.impError = "";
      try { u.imp = importGroups(parseLooseJson(u.impText)); } catch { u.imp = null; u.impError = t("这段不是 JSON。把 Claude 最后 ```json 里的内容整段贴过来。"); }
      render(); return;
    }
    case "shops-import-cancel": u.imp = null; u.impText = ""; u.impError = ""; render(); return;
    case "shops-import-save": return importSave(render);
    case "shops-read": return readDeals(id, render);
    case "shops-manual": { const du = dealUi(id); du.rows = [{ include: true, name: "", size: null, price: null, price_text: null, unit_price: null, unit_label: null, valid_from: weekWindow(shopById(id)).valid_from || null, valid_to: weekWindow(shopById(id)).valid_to || null, aka: null, category: null }]; du.manual = true; du.replace = false; render(); return; }
    case "shops-addrow": { const du = dealUi(id); keepReview(du); du.rows.push({ include: true, name: "" }); render(); return; }
    case "shops-discard": { const du = dealUi(id); du.rows = null; du.error = ""; render(); return; }
    case "shops-dfilter": dealUi(id).filter = el.dataset.v; render(); return;
    case "shops-dreset": Object.assign(dealUi(id), { q: "", cat: "", type: "", filter: "all" }); render(); return;
    case "shops-deal-edit": dealUi(id).edit = el.dataset.deal; render(); return;
    case "shops-hist": { const d = (state.shopDeals || []).find((x) => x.id === el.dataset.deal); if (!d) return; const du = dealUi(d.shop_id); du.hist = du.hist === d.id ? null : d.id; render(); return; }
    case "shops-deal-cancel": dealUi(id).edit = null; render(); return;
    case "shops-deal-del": {
      const d = (state.shopDeals || []).find((x) => x.id === el.dataset.deal); if (!d) return;
      if (!confirmDelete(t("删除特价「{name}」？", { name: d.name }))) return;
      await Store.deleteShopDeals([d.id]); state.shopDeals = state.shopDeals.filter((x) => x.id !== d.id); render(); return;
    }
    case "shops-tolist": {
      const d = (state.shopDeals || []).find((x) => x.id === el.dataset.deal); if (!d) return;
      const name = (String(d.aka || "").split(/[,，]/).map((x) => x.trim()).find((x) => lang !== "en" ? /[一-鿿]/.test(x) : /^[\x20-\x7e]+$/.test(x)) || d.name).slice(0, 60);
      if (!window.confirm(t("把「{name}」加入采购清单？", { name }))) return;   // 右滑加入清单也走这里：取消 = 不加
      await Store.saveShopping({ name, quantity: 1, unit: Units.guess(name) || Units.guess(d.name) || "", item_id: null, category: "other" });
      toast(t("已加入采购清单：{name}", { name })); return refresh();
    }
  }
}
/** 把一家的特价存进去：replace = 先删掉这家现有的有效特价；记下更新时间。返回 { added, replaced } */
async function applyDeals(shop, rows, { source, replace }) {
  rows = linkItems(rows);   // 对上家里的物品名（中文也行）：不同牌子的同一样东西合在一起比
  const old = replace ? replaceable(shop, rows).map((d) => d.id) : [];   // 到期比这一期晚、新广告里又没有的留着
  const saved = await Store.addShopDeals(rows.map(({ include, ...r }) => ({ ...r, ...(state.runsMissing ? { deal_type: undefined } : {}), shop_id: shop.id, source,
    price: r.price == null || Number.isNaN(+r.price) ? null : Math.round(+r.price * 100) / 100, unit_price: r.unit_price == null || Number.isNaN(+r.unit_price) ? null : +r.unit_price })));
  if (old.length) { await Store.deleteShopDeals(old); state.shopDeals = state.shopDeals.filter((d) => !old.includes(d.id)); }
  state.shopDeals.push(...saved);
  upsertLocal(await Store.saveShop({ ...shop, deals_at: new Date().toISOString() }));
  return { added: saved.length, replaced: old.length };
}
/** 更新记录（迁移 068）：每次录入一条；068 没执行时安静跳过，不影响录入 */
async function logRun(source, stores, note = null) {
  if (state.runsMissing) return null;
  const status = stores.every((x) => x.error) ? "failed" : stores.some((x) => x.error) ? "partial" : "ok";
  try { const row = await Store.addDealRun({ source, status, stores, note }); (state.dealRuns ||= []).unshift(row); return row; }
  catch (e) { console.warn("[shops] run log", e.message); return null; }
}
async function importSave(render) {
  const u = ui(), groups = (u.imp || []).filter((g, i) => g.shop && (document.querySelector(`[data-imp="${i}"]`)?.checked ?? g.include));
  if (!groups.length) { u.impError = t("没有勾选任何一家。"); return render(); }
  const replace = document.getElementById("shopsImpReplace")?.checked !== false;
  let n = 0, m = 0; const log = [];
  for (const g of groups) {
    try { const r = await applyDeals(g.shop, g.rows, { source: "claude", replace }); n += r.added; m += r.replaced; log.push({ shop_id: g.shop.id, name: g.shop.name, ...r }); }
    catch (e) { log.push({ shop_id: g.shop.id, name: g.shop.name, added: 0, replaced: 0, error: String(e.message).slice(0, 200) }); }
  }
  await logRun("claude", log);
  u.imp = null; u.impText = ""; u.claude = false;
  toast(t("已导入 {s} 家共 {n} 条特价", { s: groups.length, n }) + (m ? t("，替换了旧的 {m} 条", { m }) : "")); render();
}
async function readDeals(id, render) {
  const s = shopById(id), du = dealUi(id), att = `shopdeal-${id}`; if (!s) return;
  const pay = attachPayload(att);
  if (!pay.images.length && !pay.text.trim()) { du.error = t("先拍几张广告、截图，或粘贴文字。"); return render(); }
  du.error = "";
  // Claude（或别的工具）已经整理好的 JSON：不用 AI，直接导入
  if (!pay.images.length) { try { const j = parseLooseJson(pay.text); const rows = cleanDeals(j?.stores ? j.stores.find((x) => chainOf(x.store || x.name) === s.chain) || j.stores[0] : j, weekWindow(s)); if (rows.length) { du.rows = rows; du.source = "claude"; du.manual = false; du.replace = true; return render(); } } catch { /* 不是 JSON，交给 AI 读 */ } }
  if (!aiReady()) { du.error = t("读图片和普通文字要先在设置里填 AI key；Claude 整理好的 JSON 可以直接导入。"); return render(); }
  du.busy = true; render();
  try {
    const { system, user } = dealPrompt(s, lang);
    const txt = await askText(system, `${user}${pay.text.trim() ? `\n\nPasted text:\n${pay.text.trim().slice(0, 15000)}` : ""}${pay.images.length ? `\n\n${pay.images.length} image(s)/file(s) attached.` : ""}`, { json: true, images: pay.images, temperature: 0.1, maxTokens: 6000 });
    const rows = cleanDeals(parseLooseJson(txt), weekWindow(s));
    if (!rows.length) du.error = t("没读出特价。换一张更清楚的截图，或先在页面上搜出具体商品再截。");
    else { du.rows = rows; du.source = pay.images.length ? "photo" : "paste"; du.manual = false; du.replace = true; }
  } catch (e) { du.error = t("读取失败：{msg}", { msg: e.message }); }
  du.busy = false; render();
}
async function saveReview(f, render) {
  const id = f.dataset.id, s = shopById(id), du = dealUi(id); if (!s) return;
  keepReview(du);
  const rows = du.rows.filter((r) => r.include && r.name);
  if (!rows.length) { du.error = t("没有勾选任何一条。"); return render(); }
  const src = du.manual ? "manual" : du.source || "photo";
  const r = await applyDeals(s, rows, { source: src, replace: !!du.replace });
  await logRun(src, [{ shop_id: s.id, name: s.name, ...r }]);
  du.rows = null; du.manual = false; attachReset(`shopdeal-${id}`);
  toast(t("已保存 {n} 条特价", { n: r.added }) + (r.replaced ? t("，替换了旧的 {m} 条", { m: r.replaced }) : "")); render();
}
async function saveDealEdit(f, render) {
  const d = (state.shopDeals || []).find((x) => x.id === f.dataset.id); if (!d) return;
  const g = (n) => f.elements[n]?.value.trim() ?? "";
  const row = { ...d, name: g("name").slice(0, 80) || d.name, size: g("size") || null, price: g("price") === "" ? null : Math.round(+g("price") * 100) / 100, price_text: g("price_text") || null,
    unit_price: g("unit_price") === "" ? null : +g("unit_price"), unit_label: g("unit_label") || null, valid_to: g("valid_to") || null, aka: g("aka") || null,
    deal_type: [...f.querySelectorAll('[name="deal_type"]:checked')].map((x) => x.value).slice(0, 4).join(",") || null };
  await Store.saveShopDeal(row); Object.assign(d, row); dealUi(d.shop_id).edit = null; toast(t("已保存")); render();
}

/* 表单提交、输入：在 document 上监听（和录入购物一样），render 由 main.js 注入 */
let R = () => {};
export function bindShops(render) {
  R = render;
  installAutoHook();
  // 折扣类型下拉：勾选时更新显示的文字；点下拉外面就收起
  document.addEventListener("change", (e) => {
    const box = e.target.closest?.(".dt-drop"); if (!box || e.target.name !== "deal_type") return;
    const v = box.querySelector(".dt-val"); if (v) v.textContent = dtSummary([...box.querySelectorAll('[name="deal_type"]:checked')].map((x) => x.value));
  });
  document.addEventListener("click", (e) => { for (const dd of document.querySelectorAll(".dt-drop[open]")) if (!dd.contains(e.target)) dd.open = false; });
  document.addEventListener("submit", async (e) => {
    const f = e.target;
    if (!["shopEditForm", "shopsFindForm", "dealReviewForm", "dealEditForm"].includes(f.id)) return;
    e.preventDefault();
    try {
      if (f.id === "shopsFindForm") {
        const f2 = ui().find, zip = f.elements.zip.value.trim();
        if (zip) { try { f2.zip = zip; f2.pt = await zipToPoint(zip); } catch { f2.error = t("没认出这个 ZIP（5 位数字）。"); return R(); } }
        if (!f2.pt) { f2.error = t("先填 ZIP，或点「用当前位置」。"); return R(); }
        rememberPoint(f2.pt); return runFind(R);
      }
      if (f.id === "dealReviewForm") return saveReview(f, R);
      if (f.id === "dealEditForm") return saveDealEdit(f, R);
      const row = formRow(f); if (!row.name) return;
      const id = f.dataset.id, old = id ? shopById(id) : null;
      const saved = await Store.saveShop(old ? { ...old, ...row } : row); upsertLocal(saved); ui().edit = null;
      toast(old ? t("已保存") : t("已加入 {name}", { name: saved.name })); R();
    } catch (err) { toast(t("保存失败：{msg}", { msg: err.message })); }
  });
  document.addEventListener("input", (e) => {
    const el = e.target;
    if (el.matches?.("[data-shops-q]")) { ui().q = el.value; R(); restoreFocus("[data-shops-q]", el); }
    else if (el.matches?.("[data-deal-q]")) { dealUi(el.dataset.dealQ).q = el.value; R(); restoreFocus(`[data-deal-q="${el.dataset.dealQ}"]`, el); }
    else if (el.matches?.("[data-shops-zip]")) ui().find.zip = el.value.trim();
    else if (el.matches?.("[data-find-radius]")) { const v = Math.round(+el.value); if (v >= 1) { ui().find.radius = Math.min(MAX_MI, v); document.querySelectorAll('[data-action="shops-radius"]').forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.v === ui().find.radius))); } }
    else if (el.matches?.("[data-find-q]")) { ui().find.q = el.value; R(); restoreFocus("[data-find-q]", el); }
  });
  document.addEventListener("change", (e) => {
    const el = e.target;
    if (el.matches?.("[data-shops-sort]")) { ui().sort = el.value; R(); }
    else if (el.matches?.("[data-shops-status]")) { ui().status = el.value; ui().cat = ""; R(); }
    else if (el.matches?.("[data-shops-cat]")) { ui().cat = el.value; R(); }
    else if (el.matches?.("[data-deal-cat]")) { dealUi(el.dataset.dealCat).cat = el.value; R(); }
    else if (el.matches?.("[data-run-src]")) { (ui().log ||= {}).src = el.value; R(); }
    else if (el.matches?.("[data-run-shop]")) { (ui().log ||= {}).shop = el.value; R(); }
    else if (el.matches?.("[data-deal-type]")) { dealUi(el.dataset.dealType).type = el.value; R(); }
    else if (el.matches?.("[data-deal-filter]")) { dealUi(el.dataset.dealFilter).filter = el.value; R(); }
    else if (el.matches?.("[data-deal-sort]")) { dealUi(el.dataset.dealSort).sort = el.value; R(); }
    else if (el.matches?.('#dealReviewForm [name="inc"]')) { const f = el.form, n = f.querySelectorAll('[name="inc"]:checked').length, b = f.querySelector('button[type="submit"]'); if (b) b.textContent = t("保存 {n} 条", { n }); }
  });
}
function restoreFocus(sel, old) { const el = document.querySelector(sel); if (el && el !== old) { el.focus(); const n = el.value.length; try { el.setSelectionRange(n, n); } catch { /* 忽略 */ } } }
