import { numAttrs } from "../core/ui-num.js";
import { viewSwitch } from "../core/view-switch.js";
import { $, catOf, esc, fmt, fmtShort, inSpace, isGear, num, spaceOf, stampText, todayISO } from "../core/util.js";
import { FD, changed, clearFiltersBtn } from "../core/clear-filters.js";
import { STATUS, state } from "../core/state.js";
import { Store } from "../core/store.js";
import { catDashboard, catSelOpts, chipGroups, grpName, isPhone, locationFilter, spaceFilter } from "./inventory.js";
import { t } from "../core/i18n.js";
import { discardBtn, shelfGrid } from "./restock.js";
import { href } from "../core/router.js";
import { memberName, openShopFor } from "../core/logic.js";
import { ownerFilter, ownerTag } from "./owner.js";
import { pageLimit, pageMoreBtn } from "../core/pager.js";
import { unitSelect } from "../core/unit-pick.js";
import { secNeed, selBarText } from "./inv-sync.js";
import { VIEW_KEY, invSorter, invSpaces, rowMatch } from "./inv-sync-common.js";
import { orderedCats } from "./inventory-sync-common.js";
import { catFormHtml } from "./inventory-sync.js";
import { groupedCats, matchItem } from "./inventory-match.js";
import { lpAttr } from "../core/long-press.js";

export function invView() { try { return localStorage.getItem(VIEW_KEY) === "cats" ? "cats" : "rows"; } catch { return "rows"; } }
const viewSeg = (cur) => `<div class="view-bar">${viewSwitch([["rows", "物品", "☰"], ["cats", "分类", "▦"]], cur, { action: "inv-view", attr: "view" })}</div>`;
const muteOn = (it) => !!it.alert_mute_until && String(it.alert_mute_until) > todayISO();
/** 新物品的空间：开着汽车房屋消耗品时跟着筛选的空间，否则日常消耗品 */
const addSpace = () => (state.filter.space === "house" && state.houseEnabled ? "house" : state.filter.space === "gear" ? "gear" : "pantry");
export const fab = (space, label) => (String(space).includes("&cat=")
  ? `<a class="fab" href="${href("item", "new")}?space=${space}" aria-label="${esc(label)}" title="${esc(label)}"><span aria-hidden="true">＋</span></a>`
  : `<button type="button" class="fab" data-action="add-item-pick" aria-label="${esc(label)}" title="${esc(label)}"><span aria-hidden="true">＋</span></button>`);
   // 先选放在哪一类（js/pantry/space-pick.js）

function viewInvRows(space) {
  const f = state.filter;
  if (f.space !== space) Object.assign(f, { space, cat: "all" });
  const all = state.enriched.filter((x) => (space === "all" ? invSpaces().some((s) => inSpace(s)(x)) : inSpace(space)(x)));   // 范围下拉：全部组别（默认）或某一个组别
  const cur = f.cat !== "all" ? catOf(f.cat) : null;
  return `<section class="section inv-rows-page">
      <div class="section-head"><h2>${t("库存")}</h2><div class="head-acts">
        ${viewSeg("rows")}</div></div>
      <div class="toolbar">
        <input type="search" id="invSearch" placeholder="${t("搜索物品，例如：纸、蛋")}" value="${esc(f.q)}" aria-label="${t("搜索物品")}">
        ${spaceFilter(space, { all: true })}
        ${space === "gear" ? "" : `<select id="invStatus" aria-label="${t("按提醒筛选")}">
          ${[["all", "全部状态"], ["alert", "需要补货"], ["out", "缺货"], ["low", "少货"], ["soon", "即将告罄"], ["exp", "临期或过期"], ["ok", "充足"]]
            .map(([v, l]) => `<option value="${v}" ${f.status === v ? "selected" : ""}>${t(l)}</option>`).join("")}
        </select>`}
        ${locationFilter(all, f)}
        ${ownerFilter(f)}
        <select id="invSort" aria-label="${t("排序")}">${INV_SORTS.map(([v, l]) => `<option value="${v}" ${(f.sort || "default") === v ? "selected" : ""}>${t(l)}</option>`).join("")}</select>
        ${clearFiltersBtn("inv", changed(f, FD.inv))}
      </div>
      ${cur ? `<div class="chips inv-catchip"><button type="button" class="chip" data-action="cat" data-cat="all" aria-pressed="true" aria-label="${esc(t("清除分类：{c}", { c: t(cur.name) }))}">${cur.icon} ${esc(t(cur.name))} <span aria-hidden="true">✕</span></button></div>` : ""}
      <div id="invRows" class="${state.invSel ? "sel-mode" : ""}"></div>
      ${state.invSel ? selBar() : fab(addSpace(), t("添加物品"))}
    </section>`;
}
function selBar() {
  const off = state.invSel.size ? "" : "disabled";
  return `<div class="inv-selbar" role="toolbar" aria-label="${esc(t("多选操作"))}">
    <span class="inv-seln" aria-live="polite">${esc(selBarText())}</span>
    <button type="button" class="btn btn-sm btn-ghost" data-action="inv-sel-all">${t("全选")}</button>
    <button type="button" class="btn btn-sm btn-primary" data-action="inv-select">${t("完成")}</button>
    <span class="spacer"></span>
    <button type="button" class="btn btn-sm" data-action="inv-sel-shop" ${off}>🛒 ${t("加入购物车")}</button>
    <button type="button" class="btn btn-sm" data-action="inv-sel-mute" ${off}>🔕 ${t("不提醒")}</button>
    <button type="button" class="btn btn-sm btn-danger-ghost" data-action="inv-sel-del" ${off}>🗑 ${t("删除")}</button>
  </div>`;
}
/** 物品视图的两个容器（折叠状态和概览大卡片共用一份本机记录） */
function renderInvRows(host) {
  const f = state.filter, cur = f.cat !== "all" ? catOf(f.cat) : null;
  const fold = (() => { try { return JSON.parse(localStorage.getItem("hmh-pv-fold") || "{}"); } catch { return {}; } })();
  const sec = (space, icon, title) => {
    if (cur && spaceOf(cur.id) !== space) return "";   // 按分类看：只留这个分类所在的容器
    const mine = state.enriched.filter(inSpace(space)), list = mine.filter(rowMatch).sort(invSorter(f.sort)), need = space === "gear" ? [] : secNeed(space);
    const lim = pageLimit(`inv-${space}`, JSON.stringify(f)), part = list.slice(0, lim);
    const body = list.length ? `<ul class="inv-list">${part.map(itemRow).join("")}</ul>${pageMoreBtn(`inv-${space}`, list.length, lim)}`
      : `<div class="empty">${mine.length ? `<strong>${t("没有符合条件的物品")}</strong>${t("换个关键词或筛选试试。")}`
        : space === "house" ? `<strong>${t("还没有汽车房屋消耗品")}</strong><a class="btn btn-primary" href="${href("house", "template")}">${t("按房屋资料推荐")}</a>`
        : space === "gear" ? `<strong>${t("还没有家居耐用品")}</strong>${t("床单被罩、电热毯、旅行床、自行车、千斤顶、园艺工具……这些只需要记数量和位置的东西都放这里。")}`
        : `<strong>${t("库存还是空的")}</strong>${t("从最常用的几样开始，例如鸡蛋、大米、抽纸。")}`}</div>`;
    return `<details class="pv-card inv-sec" data-fold="${space}" id="invSec-${space}" ${fold[space] !== 0 ? "open" : ""}>
      <summary><span class="pv-ico" aria-hidden="true">${icon}</span><span class="pv-ttl"><b>${esc(title)}</b><small>${list.length === mine.length ? t("{n} 件", { n: mine.length }) : t("{a} / {b} 件符合", { a: list.length, b: mine.length })}</small></span><span class="ui-chev" data-dir="down" aria-hidden="true">▾</span></summary>
      <div class="pv-body">${need.length && !state.invSel ? `<div class="inv-sec-bar"><span class="muted">${t("{n} 件要补货", { n: need.length })}</span><button type="button" class="btn btn-sm" data-action="inv-sec-shop" data-space="${space}">🛒 ${t("全部加入购物车")}</button></div>` : ""}${body}</div></details>`;
  };
  const SEC = { pantry: ["🥫", t("日常消耗品")], house: ["🧰", t("汽车房屋消耗品")], gear: ["🛋️", t("家居耐用品")] };
  host.innerHTML = `<div class="pv-cards">${invSpaces().filter((s) => f.space === "all" || s === f.space).map((s) => sec(s, ...SEC[s])).join("")}</div>`;
}
/** 库存状态标签（缺货 / 少货 / 即将告罄 / 充足）：库存行用 badge，物品编辑页标题右边也用 */
export const statusTag = (it) => `<span class="badge ${STATUS[it.status].cls}">${t(STATUS[it.status].label)}</span>`;
/** 「已加入购物车」的短标签：✓🛒，只显示不能点（库存行、物品编辑页共用） */
export const cartTag = () => `<span class="rs-tag is-in is-static" title="${esc(t("已加入购物车"))}" aria-label="${esc(t("已加入购物车"))}" role="img">✓🛒</span>`;
export { catNeed, secNeed, selBarText, setInvView, visibleItemIds } from "./inv-sync.js";
/** 状态位的标签：充足时显示提醒设置——「🔕 不提醒」或「🔔 少货线 · 提前几天」，点一下弹出小框来改；少货 / 缺货 / 即将告罄时由状态标签取代 */
const noRemind = (it) => muteOn(it) || (num(it.min_quantity) <= 0 && num(it.lead_days) <= 0);
function remindChip(it, plain) {
  if (isGear(it)) return "";
  const off = noRemind(it), f = Units.factor(it.unit);
  const parts = off ? [] : [num(it.min_quantity) > 0 && t("少货线 {q} {u}", { q: fmt(num(it.min_quantity) * f), u: esc(t(it.du)) }), num(it.lead_days) > 0 && t("提前 {d} 天", { d: num(it.lead_days) })].filter(Boolean);
  const text = off ? `🔕 ${t("不提醒")}` : `🔔 ${parts.join(" · ")}`;
  const tip = off ? t("点一下设置提醒") : t("点一下修改提醒设置");
  return plain ? `<span class="rem-tag${off ? " is-off" : ""}">${text}</span>`
    : `<button type="button" class="rem-tag${off ? " is-off" : ""}" data-action="item-remind" data-id="${it.id}" title="${esc(tip)}" aria-label="${esc(`${it.name}：${off ? t("不提醒") : parts.join("，")}，${tip}`)}">${text}</button>`;
}
/** 物品一行：状态色条 | 名称、状态 / 提醒标签、小类 · 位置 · 约够几天 | − 数量 单位 + */
export function itemRow(it) {
  const st = STATUS[it.status], c = catOf(it.category), inList = openShopFor(it.id);
  const meta = [`${c.icon} ${esc(t(it.subcategory || c.name))}`, ownerTag(it) && `<span class="own-tag">${esc(ownerTag(it))}</span>`, it.location && `📍${esc(t(it.location))}`,
    it.daysLeft != null && it.qty > 0 && `${t("约够 {d} 天", { d: Math.max(0, Math.floor(it.daysLeft)) })}`].filter(Boolean).join(" · ");
  const badges = `${it.status !== "ok" ? `<span class="badge ${st.cls}">${t(st.label)}</span>` : remindChip(it, !!state.invSel)}${it.exp ? `<span class="badge b-exp">${it.exp === "expired" ? t("已过期") : t("{d} 天内到期", { d: it.expDays })}</span>` : ""}${inList ? cartTag() : ""}`;
  const step = Units.step(it.du), nm = esc(it.name), sel = state.invSel, on = sel?.has(it.id);
  const rowAttrs = sel ? `data-row-sel="${it.id}"` : `data-row-open="${esc(href("item", it.id))}" data-swipe-del="item" data-swipe-alt="item" data-swipe-alt-label="${esc(t("加入购物车"))}" data-swipe-alt-go="${esc(t("松手加入"))}"`;
  const lp = sel ? "" : lpAttr([{ label: t("详情"), href: href("item", it.id), first: true }, { label: t("加入购物车"), action: "inv-shop", data: { id: it.id } }, { label: t("多选"), action: "inv-sel-start", data: { id: it.id } }, { label: t("删除"), action: "inv-del", data: { id: it.id }, danger: true }], it.name);
  return `<li class="inv-row st-${it.status}${on ? " is-picked" : ""}" data-id="${it.id}" ${rowAttrs} ${lp}>
    <span class="inv-bar" aria-hidden="true"></span>
    ${sel ? `<input type="checkbox" class="inv-chk" data-sel-id="${it.id}" ${on ? "checked" : ""} aria-label="${esc(t("选择 {name}", { name: it.name }))}">` : ""}
    <div class="inv-main"><div class="inv-name">${sel ? `<span class="inv-link">${nm}</span>` : `<a href="${esc(href("item", it.id))}" class="inv-link">${nm}</a>`}${badges}</div><div class="inv-meta">${meta}</div></div>
    <div class="inv-qty" role="group" aria-label="${esc(t("{name} 数量", { name: it.name }))}">
      <button type="button" data-action="consume" data-id="${it.id}" aria-label="${esc(t("{name} 用掉 {q} {u}", { name: it.name, q: step, u: t(it.du) }))}">−</button>
      <input ${numAttrs("qty")} value="${fmt(it.dqty)}" data-inv-qty="${it.id}" data-keep="invq:${it.id}" aria-label="${esc(t("{name} 数量", { name: it.name }))}">
      ${unitSelect(`data-inv-unit="${it.id}" aria-label="${esc(t("{name} 单位", { name: it.name }))}"`, it.du, { cls: "inv-unit" })}
      <button type="button" data-action="restock" data-id="${it.id}" aria-label="${esc(t("{name} 补充 {q} {u}", { name: it.name, q: step, u: t(it.du) }))}">+</button>
    </div>
    <button type="button" class="swipe-src" data-action="inv-del" data-id="${it.id}">${t("删除 {name}", { name: it.name })}</button>
    <button type="button" class="swipe-alt-src" data-action="inv-shop" data-id="${it.id}">${t("{name} 加入购物车", { name: it.name })}</button>
  </li>`;
}
export function viewInventory(space = "all") {
  if (invView() === "rows") return viewInvRows(space);
  if (space === "all") space = "pantry";   // 分类视图一次看一个组别：全部组别时先看日常消耗品
  if (state.filter.space !== space) Object.assign(state.filter, { space, cat: "all", q: "", status: state.filter.status, loc: "all" });
  const f = state.filter;
  const house = space === "house", gear = space === "gear";
  if (gear) f.status = "all";   // 家居耐用品没有库存状态
  const phone = isPhone(), dash = phone && f.cat === "all";
  const chip = (id, label) => `<button type="button" class="chip" data-action="cat" data-cat="${id}" aria-pressed="${f.cat === id}">${label}</button>`;
  const shelf = gear && !phone ? shelfGrid("gear") : "";
  const mine = state.enriched.filter(inSpace(space));
  const cur = f.cat !== "all" ? catOf(f.cat) : null;
  const cf = state.catForm && state.catForm.space === space ? state.catForm : null;
  // 小类筛选：打开某个分类后，列出里面实际有物品的小类；换了分类（小类不属于它）就回到“全部”
  if (!cur || !(cur.subs || []).includes(f.sub)) f.sub = "all";
  const subCounts = cur ? (cur.subs || []).map((s) => [s, mine.filter((x) => x.category === cur.id && x.subcategory === s).length]).filter(([, n]) => n > 0) : [];
  const subChips = subCounts.length > 1 ? `<div class="chips" role="group" aria-label="${t("按小类筛选")}">
        <button type="button" class="chip" data-action="inv-sub" data-sub="all" aria-pressed="${f.sub === "all"}">${t("全部小类")}</button>
        ${subCounts.map(([s, n]) => `<button type="button" class="chip" data-action="inv-sub" data-sub="${esc(s)}" aria-pressed="${f.sub === s}">${esc(t(s))} <span class="muted">${n}</span></button>`).join("")}</div>` : "";
  // 手机：进了某个大类后，原来「全部小类」芯片的位置放两个下拉——大类（默认当前，切换就换路径）+ 小类（默认全部小类）；电脑页横向够宽，大类芯片 / 小类芯片照旧一眼能点
  const subSel = subCounts.length > 1 ? `<select id="invSubSel" aria-label="${t("按小类筛选")}"><option value="all">${t("全部小类")}</option>${subCounts.map(([s, n]) => `<option value="${esc(s)}" ${f.sub === s ? "selected" : ""}>${esc(t(s))} (${n})</option>`).join("")}</select>` : "";
  const subBar = phone && cur ? `<div class="inv-filters${subSel ? "" : " solo"}">
        <select id="invCatSel" data-search aria-label="${t("按分类筛选")}"><option value="all">${t("全部")}</option>${catSelOpts(space, cur.id)}</select>${subSel}</div>` : subChips;
  return `
    <section class="section">
      <div class="section-head"><h2>${t("库存")}</h2>
        <div class="head-acts">${house && !phone ? `<a class="btn btn-sm btn-ghost" href="${href("house", "template")}">${t("按房屋资料推荐")}</a>` : ""}
        ${cur && !cf ? `<button type="button" class="btn btn-sm btn-ghost" data-action="cat-edit" data-cat="${cur.id}">${t("编辑分类")}</button>` : ""}
        ${viewSeg("cats")}</div></div>
      ${house && !phone ? `<p class="muted" style="margin:-4px 0 12px;font-size:13px">${t("滤网、电池、融雪盐这类要消耗、要补货的房屋用品；设备页的“相关耗材”会指到这里。")}</p>` : ""}
      ${gear && !phone ? `<p class="muted" style="margin:-4px 0 12px;font-size:13px">${t("床品、电器、自行车、千斤顶、工具这类耐用品：只记有几件、放在哪，不算消耗、不提醒补货。")}</p>` : ""}
      ${shelf ? `<div class="shelf" style="margin-bottom:14px">${shelf}</div>` : ""}
      <div class="toolbar">
        <input type="search" id="invSearch" placeholder="${gear ? t("搜索，例如：被罩、千斤顶、自行车") : house ? t("搜索，例如：滤网、电池") : t("搜索物品，例如：纸、蛋")}" value="${esc(f.q)}" aria-label="${t("搜索物品")}">
        ${spaceFilter(space)}
        ${gear ? "" : `<select id="invStatus" aria-label="${t("按提醒筛选")}">
          ${[["all", "全部状态"], ["alert", "需要补货"], ["out", "缺货"], ["low", "少货"], ["soon", "即将告罄"], ["exp", "临期或过期"], ["ok", "充足"]]
            .map(([v, l]) => `<option value="${v}" ${f.status === v ? "selected" : ""}>${t(l)}</option>`).join("")}
        </select>`}
        ${locationFilter(mine, f)}
        ${house ? ownerFilter(f) : ""}
        <select id="invSort" aria-label="${t("排序")}">${INV_SORTS.filter(([v]) => !(gear && v === "exp")).map(([v, l]) => `<option value="${v}" ${(f.sort || "default") === v ? "selected" : ""}>${t(l)}</option>`).join("")}</select>
        ${clearFiltersBtn("inv", changed(f, FD.inv))}
      </div>
      ${phone ? "" : `<div class="chips" role="group" aria-label="${t("按分类筛选")}">
        ${chip("all", t("全部"))}${chipGroups(space, chip)}
        <button type="button" class="chip chip-add" data-action="cat-new" data-space="${space}">＋ ${t("新分类")}</button>
      </div>`}
      ${cf ? catFormHtml(cf) : ""}
      ${subBar}
      ${dash && !cf ? `<div id="dashWrap" data-space="${space}">${catDashboard(space, mine)}</div>` : ""}
      <div id="invList" ${dash ? "hidden" : ""}></div>
      ${fab(`${space}${cur ? `&cat=${cur.id}` : ""}`, gear ? t("添加家居耐用品") : t("添加物品"))}
    </section>`;
}
const INV_SORTS = [["default", "按状态（缺货优先）"], ["name", "名称 A → Z"], ["qty", "数量：少 → 多"], ["exp", "保质期：近 → 远"], ["updated", "最近更新"]];
export function renderInvList() {
  const rowsHost = $("#invRows");
  if (rowsHost) return renderInvRows(rowsHost);
  const f = state.filter;
  const mine = state.enriched.filter(inSpace(f.space));
  const list = mine.filter((it) => matchItem(it, f));
  const host = $("#invList");
  if (!host) return;
  // 手机仪表盘（全部分类）：搜索 / 筛选只作用在方块上（符合的数量、没符合的变淡），列表不显示；点方块进分类后才列出
  const wrap = $("#dashWrap");
  if (wrap) { wrap.innerHTML = catDashboard(wrap.dataset.space, mine); host.hidden = true; return; }
  if (!list.length) {
    host.innerHTML = mine.length
      ? `<div class="panel empty"><strong>${t("没有符合条件的物品")}</strong>${t("换个关键词或分类试试。")}</div>`
      : f.space === "house"
        ? `<div class="panel empty"><strong>${t("还没有汽车房屋消耗品")}</strong>${t("按你家的房型和设施，一次加好常用的滤网、电池、融雪盐等。")}<p><a class="btn btn-primary" href="${href("house", "template")}">${t("按房屋资料推荐")}</a></p></div>`
        : f.space === "gear"
          ? `<div class="panel empty"><strong>${t("还没有家居耐用品")}</strong>${t("床单被罩、电热毯、旅行床、自行车、千斤顶、园艺工具……这些只需要记数量和位置的东西都放这里。")}<p><a class="btn btn-primary" href="${href("item", "new")}?space=gear">${t("添加第一件家居耐用品")}</a></p></div>`
          : `<div class="panel empty"><strong>${t("库存还是空的")}</strong>${t("从最常用的几样开始，例如鸡蛋、大米、抽纸。")}</div>`;
    return;
  }
  // 分批显示：按分类顺序排好后一共只画前 lim 件，分类标题的件数仍按完整结果；筛选 / 搜索 / 排序变了回到一页
  const lim = pageLimit("inv", JSON.stringify(f)); let left = lim;
  const byCat = new Map(); for (const x of list) { const arr = byCat.get(x.category); if (arr) arr.push(x); else byCat.set(x.category, [x]); }
  const grps = groupedCats(f.space), shown = new Set(grps.filter((e) => e.cats.some((c) => byCat.has(c.id))).map((e) => e.g.id)), withHead = shown.size > 1;
  let lastG = "";
  host.innerHTML = grps.flatMap((e) => e.cats.map((c) => [e.g, c])).map(([g, c]) => {
    const inCat = (byCat.get(c.id) || []).sort(invSorter(f.sort));
    if (!inCat.length || left <= 0) return "";
    const part = inCat.slice(0, left); left -= part.length;
    const head = withHead && g.id !== lastG ? `<h2 class="inv-grp-h">${esc(grpName(g))}</h2>` : ""; lastG = g.id;
    const need = f.space === "gear" ? 0 : inCat.filter((x) => x.status !== "ok" && !openShopFor(x.id)).length;   // 这个大类里要补货、还不在清单里的
    return `${head}<div class="cat-group" style="--cat:${c.color}"><div class="cat-group-h"><h3><span class="dot" aria-hidden="true"></span>${c.icon} ${t(c.name)}<span class="muted">（${inCat.length}）</span></h3>
      ${need ? `<button type="button" class="btn btn-sm cat-shop" data-action="inv-cat-shop" data-cat="${c.id}" aria-label="${esc(t("{c}：{n} 件要补货，全部加入购物车", { c: t(c.name), n: need }))}">🛒 ${t("全部加入购物车")} <b class="ui-badge" data-shape="count">${need}</b></button>` : ""}</div>
      <div class="items">${part.map(itemCard).join("")}</div></div>`;
  }).join("") + pageMoreBtn("inv", orderedCats(f.space).reduce((n, c) => n + (byCat.get(c.id)?.length || 0), 0), lim);
}
export function itemCard(it) {
  const st = STATUS[it.status];
  const by = Store.mode === "cloud" ? memberName(it.updated_by) : null;
  const du = t(it.du);
  const stamp = (it.updated_at || it.created_at) && `<span title="${esc(stampText(it))}">${by ? `${esc(by)} ` : ""}${t("{d} 更新", { d: fmtShort(it.updated_at || it.created_at) })}</span>`;
  // 家居耐用品卡片：没有存量罐和 −/+（数量在编辑页改），显示件数、位置和备注
  if (isGear(it)) {
    const meta = [
      it.subcategory && `<span>${esc(t(it.subcategory))}</span>`,
      it.location && `<span>📍${esc(t(it.location))}</span>`,
      it.notes && `<span class="note" title="${esc(it.notes)}">${esc(it.notes.length > 40 ? `${it.notes.slice(0, 40)}…` : it.notes)}</span>`,
      stamp,
    ].filter(Boolean).join("");
    return `<article class="item is-gear" aria-label="${esc(`${it.name}，${fmt(it.dqty)} ${du}${it.location ? t("，在{loc}", { loc: t(it.location) }) : ""}`)}">
      <span class="gear-ico" aria-hidden="true">${catOf(it.category).icon}</span>
      <div class="item-main">
        <div class="item-title"><button type="button" data-action="edit" data-id="${it.id}">${esc(it.name)}</button></div>
        <div class="item-meta">${meta}</div>
        ${it.qty > 0 ? `<div class="item-acts"><button type="button" class="link-name" data-action="gear-broke" data-id="${it.id}" aria-label="${esc(it.name)} — ${esc(t("损坏了，换新"))}">🔨 ${t("损坏了，换新")}</button></div>` : ""}
      </div>
      <div class="qty"><output>${fmt(it.dqty)}<small>${esc(du)}</small></output></div>
    </article>`;
  }
  const meta = [
    it.subcategory && `<span>${esc(t(it.subcategory))}</span>`,
    it.location && `<span>📍${esc(t(it.location))}</span>`,
    it.daysLeft != null && `<span>${t("约够 {d} 天", { d: Math.max(0, Math.floor(it.daysLeft)) })}</span>`,
    it.rate && `<span title="${it.rateSrc === "manual" ? t("手动设置") : t("根据最近使用记录估算")}">${t("日均 {q} {u}", { q: fmt(it.drate), u: esc(du) })}</span>`,
    stamp,
  ].filter(Boolean).join("");
  const expBadge = it.exp ? `<span class="badge b-exp">${it.exp === "expired" ? t("已过期") : t("{d} 天内到期", { d: it.expDays })}</span>${it.exp === "expired" && it.qty > 0 ? discardBtn(it) : ""}` : "";
  const label = `${it.name}，${t("剩余 {q} {u}", { q: fmt(it.dqty), u: du })}，${t(st.label)}`;
  return `<article class="item st-${it.status}" aria-label="${esc(label)}">
    <div class="jar st-${it.status}" role="img" aria-label="${t("存量约 {p}%", { p: Math.round(it.level * 100) })}">
      <i style="height:${Math.max(it.qty > 0 ? 6 : 0, it.level * 100)}%"></i>
      ${it.minMark != null ? `<span class="tick" style="bottom:${it.minMark * 100}%"></span>` : ""}
    </div>
    <div class="item-main">
      <div class="item-title"><button type="button" data-action="edit" data-id="${it.id}">${esc(it.name)}</button>
        ${it.status !== "ok" ? `<span class="badge ${st.cls}">${t(st.label)}</span>` : ""}${it.muted ? `<span class="badge b-muted" title="${t("已设为不提醒；编辑页里可以恢复")}">🔕 ${t("不提醒")}</span>` : ""}${expBadge}</div>
      <div class="item-meta">${meta}</div>
    </div>
    <div class="qty">
      <button type="button" data-action="consume" data-id="${it.id}" aria-label="${esc(t("{name} 用掉 {q} {u}", { name: it.name, q: Units.step(it.du), u: du }))}">−</button>
      <output>${fmt(it.dqty)}<small>${esc(du)}</small></output>
      <button type="button" data-action="restock" data-id="${it.id}" aria-label="${esc(t("{name} 补充 {q} {u}", { name: it.name, q: Units.step(it.du), u: du }))}">+</button>
    </div>
  </article>`;
}
