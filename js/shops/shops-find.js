/* 常去的商店：找附近的商店、用 Claude 整理（复制指令 → 贴回 JSON → 按商店导入）。 */
import { MAX_MI, SHOP_CATS, shopCat } from "./logic.js";
import { buyHead } from "./buy-nav.js";
import { esc, fmtShort } from "../core/util.js";
import { href } from "../core/router.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";
import { missingPanel, shopHref, ui } from "./shops-common.js";

/* ───────────── 找附近的商店 ───────────── */
export function viewFind() {
  const f = ui().find, have = new Map((state.shops || []).filter((s) => s.osm_id).map((s) => [s.osm_id, s]));
  const fq = (f.q || "").trim().toLowerCase(), res = f.results && f.results.filter((x) => !fq || `${x.name} ${x.address}`.toLowerCase().includes(fq));   // 结果里再按名称 / 地址筛
  return `<section class="section shops-page">
    ${buyHead("find")}
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
export function claudePanel() {
  const u = ui(), imp = u.imp;
  return `<div class="panel shops-claude">
    <b>🤖 ${t("用 Claude 整理特价")}</b>
    <ol class="shops-steps">
      <li>${t("在 Flipp 或超市网站上打开这几家本周的广告（一家一个标签页），自己先搜好要的东西。")}</li>
      <li>${t("复制下面的指令，粘贴给 Chrome 侧边栏里的 Claude；它只读你打开的页面，不会自己去翻。")}</li>
      <li>${t("把 Claude 最后给的 JSON 贴到下面，点「看看能导入什么」，核对后导入。")}</li>
    </ol>
    <div class="form-actions"><button type="button" class="btn btn-sm" data-action="shops-claude-copy" data-mode="all">📋 ${t("复制「整理特价」指令")}</button>
      <button type="button" class="btn btn-sm" data-action="shops-claude-copy" data-mode="list">📋 ${t("复制「按购物车比价」指令")}</button></div>
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
export const copyBox = () => `<details class="shops-copy" open><summary>${t("没能自动复制，请手动全选复制")}</summary><textarea readonly rows="6">${esc(ui().copyText)}</textarea></details>`;
