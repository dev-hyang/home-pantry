/* 常去的商店：列表页（商店卡片、起步清单、新建 / 编辑表单）。 */
import { CHAINS, SHOP_CATS, adUrl, dealMatches, dealsDue, liveDeals, openShopping, shopCat } from "./logic.js";
import { claudePanel } from "./shops-find.js";
import { crumbNav } from "../core/hub.js";
import { esc, fmtShort } from "../core/util.js";
import { href } from "../core/router.js";
import { lang, t } from "../core/i18n.js";
import { state } from "../core/state.js";
import { DOW, distOf, missingPanel, shopHref, ui } from "./shops-common.js";
import { lpAttr } from "../core/long-press.js";
import { Store } from "../core/store.js";
import { bulkBar, bulkCheck, bulkMenuItem, bulkOn, bulkRegister } from "../core/bulk-select.js";
import { clearActionBtn } from "../core/clear-filters.js";
import { shopsFab } from "./shops-nav.js";
import { curSec, fsec, secTitle } from "../core/form-sec.js";
import { gwActions, gwAttr, gwChrome, gwReview } from "../core/form-wizard.js";
import { buyHead } from "./buy-nav.js";

/* ───────────── 列表 ───────────── */
export function viewList() {
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
    ${buyHead("shops-list")}
    ${missingPanel()}
    <p class="head-sub">${t("每家的本周广告、特价都在这里；购物车会标出哪家在打折。")}</p>
    ${u.edit === "new" && !gridOn ? shopForm(null) : ""}
    ${u.claude ? claudePanel() : ""}
    ${due.length && u.status === "active" ? `<div class="panel shops-due" role="status">🗓️ ${t("{n} 家本周的特价还没更新：{names}", { n: due.length, names: due.map((s) => esc(s.name)).join("、") })}</div>` : ""}
    ${all.length ? `<div class="toolbar shops-toolbar">
      <label class="shops-q"><span class="sr-only">${t("搜索商店")}</span><input type="search" data-shops-q value="${esc(u.q)}" placeholder="${esc(t("搜索名称、地址"))}" autocomplete="off"></label>
      <select data-shops-status data-nosearch aria-label="${esc(t("显示哪些商店"))}">${[["active", t("常去"), all.filter((s) => !s.archived).length], ["archived", t("不去了"), all.filter((s) => s.archived).length]].map(([k, l, n]) => `<option value="${k}" ${u.status === k ? "selected" : ""}>${esc(l)}${lang === "en" ? ` (${n})` : `（${n}）`}</option>`).join("")}</select>
      <select data-shops-cat data-nosearch aria-label="${esc(t("按分类筛选"))}">${chips.map(([c, l, i, n]) => `<option value="${c}" ${u.cat === c ? "selected" : ""}>${i ? `${i} ` : ""}${esc(c ? l : t("全部分类"))}${lang === "en" ? ` (${n})` : `（${n}）`}</option>`).join("")}</select>
      <select data-shops-sort data-nosearch aria-label="${esc(t("排序"))}">${[["name", "按名称"], ["dist", "按距离"], ["deals", "按特价多少"], ["updated", "按最近更新"]].map(([k, l]) => `<option value="${k}" ${u.sort === k ? "selected" : ""}>${t(l)}</option>`).join("")}</select>
      ${u.q || u.cat || u.status !== "active" || u.sort !== "name" ? `${clearActionBtn("shops-reset")}` : ""}
    </div>` : ""}
    ${gridOn ? `${(bulkRegister("shops", { ids: () => list.map((x) => x.id), del: async (id) => { await Store.deleteShop(id); state.shops = state.shops.filter((x) => x.id !== id); state.shopDeals = (state.shopDeals || []).filter((d) => d.shop_id !== id); } }), bulkBar("shops"))}<div class="shop-grid">${list.map(shopCard).join("")}${u.edit === "new" ? `<div class="shop-new-slot">${shopForm(null)}</div>` : newCard()}</div>${list.length ? "" : `<p class="muted shops-empty">${t("没有符合条件的商店。")}</p>`}`
      : all.length ? `<p class="muted shops-empty">${u.status === "archived" ? t("没有收起来的商店。") : t("没有符合条件的商店。")}</p>` : starterPanel()}
    ${shopsFab()}
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
  const pick = !!bulkOn("shops");
  return `<article class="shop-card ${s.archived ? "is-off" : ""}${pick ? " is-pick" : ""}" ${pick ? "data-row-chk" : `data-swipe-del="store" ${lpAttr([{ label: t("打开"), href: shopHref(s), first: true }, s.archived ? { label: t("加回常去"), action: "shops-unarchive", data: { id: s.id } } : { label: t("本周广告"), href: adUrl(s), external: true }, s.archived ? null : { label: t("更新特价"), href: `${shopHref(s)}?update=1` }, { label: t("删除"), action: "shops-del", data: { id: s.id }, danger: true }, bulkMenuItem("shops", s.id)], s.name)}`}>${pick ? `<label class="shop-chk">${bulkCheck("shops", s.id)}</label>` : ""}
    <${pick ? "span" : "a"} class="shop-main"${pick ? "" : ` href="${shopHref(s)}"`}><span class="shop-ico" aria-hidden="true">${icon}</span>
      <span class="shop-txt"><b>${esc(s.name)}</b><small>${d != null ? `${t("{n} 英里", { n: d.toFixed(1) })} · ` : ""}${esc(s.address || t("没填地址"))}</small></span><span class="mch" aria-hidden="true">›</span></${pick ? "span" : "a"}>
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
const SHOP_STEPS = [["basic", "基本信息"], ["update", "特价更新"]];
export function shopForm(s, { page = false } = {}) {
  const sec = s && page ? curSec(["basic", "update"]) : "";   // 详情页某一块的「编辑」：只显示那一块（core/form-sec.js）
  const v = s || { category: "groceries", refresh: "weekly", refresh_dow: 3 };
  return `<form class="panel shop-form" id="shopEditForm" data-id="${esc(s?.id || "")}" ${sec ? "novalidate" : ""}${s ? "" : gwAttr(SHOP_STEPS)} aria-label="${esc(s ? t("编辑商店") : t("添加商店"))}">
    ${secTitle(sec === "update" ? "特价更新" : "基本信息", sec)}${s ? "" : gwChrome(SHOP_STEPS)}
    <div class="form-grid">
      <label ${fsec("basic", sec)} class="span-2">${t("名称")}<input name="name" required maxlength="60" value="${esc(v.name || "")}" placeholder="${esc(t("例如：ALDI"))}" list="shopChains"></label>
      <label ${fsec("basic", sec)}>${t("分类")}<select name="category" data-nosearch>${SHOP_CATS.map(([c, n, i]) => `<option value="${c}" ${v.category === c ? "selected" : ""}>${i} ${esc(t(n))}</option>`).join("")}</select></label>
      <label ${fsec("basic", sec)}>${t("ZIP")}<input name="zip" maxlength="10" inputmode="numeric" value="${esc(v.zip || "")}"></label>
      <label ${fsec("basic", sec)} class="span-2">${t("地址")}<input name="address" maxlength="200" value="${esc(v.address || "")}" placeholder="${esc(t("门牌、街道、城市"))}"></label>
      <label ${fsec("update", sec)} class="span-2">${t("本周广告链接（可不填）")}<input name="ad_url" type="url" maxlength="500" value="${esc(v.ad_url || "")}" placeholder="${esc(t("不填：用这家连锁店的广告页，没有就用 Flipp 搜索"))}"></label>
      <label ${fsec("basic", sec)}>${t("电话")}<input name="phone" maxlength="30" value="${esc(v.phone || "")}"></label>
      <label ${fsec("update", sec)}>${t("更新特价")}<select name="refresh" data-nosearch><option value="weekly" ${v.refresh === "weekly" ? "selected" : ""}>${t("每周")}</option><option value="manual" ${v.refresh === "manual" ? "selected" : ""}>${t("需要时手动")}</option></select></label>
      <label ${fsec("update", sec)}>${t("每周哪天换广告")}<select name="refresh_dow" data-nosearch>${DOW.map((d, i) => `<option value="${i}" ${+v.refresh_dow === i ? "selected" : ""}>${t(d)}</option>`).join("")}</select></label>
      <label ${fsec("update", sec)} class="span-2 check-inline shop-auto"><input type="checkbox" name="auto_update" ${v.auto_update ? "checked" : ""}><span>🤖 ${t("换广告那天自动更新（Claude 定时任务每天早上看一次，到了这家的换广告日就读广告、自动录入；只对「每周」的商店生效，季节 / 节日类的保持手动）")}</span></label>
      <label ${fsec("basic", sec)} class="span-2">${t("备注")}<input name="notes" maxlength="300" value="${esc(v.notes || "")}" placeholder="${esc(t("会员卡、营业时间、哪个门口好停车…"))}"></label>
    </div>
    ${s ? "" : gwReview()}
    <datalist id="shopChains">${Object.values(CHAINS).map((c) => `<option value="${esc(c.name)}">`).join("")}</datalist>
    ${s ? `<div class="form-actions">${page ? `<a class="btn btn-ghost" href="${shopHref(s)}">${t("取消")}</a>` : `<button type="button" class="btn btn-ghost" data-action="shops-edit-cancel">${t("取消")}</button>`}<button class="btn btn-primary" type="submit">${t("保存")}</button>
      ${s && !page ? `${s.archived ? "" : `<button type="button" class="btn btn-ghost" data-action="shops-archive" data-id="${s.id}">${t("不去了")}</button>`}<button type="button" class="btn btn-ghost btn-danger" data-action="shops-del" data-id="${s.id}">${t("删除")}</button>` : ""}</div>` : gwActions(`<button type="button" class="btn btn-ghost" data-action="shops-edit-cancel">${t("取消")}</button>`)}
  </form>`;
}
