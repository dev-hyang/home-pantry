import { alertsOf, hasStock, memberName, openShopFor } from "../core/logic.js";
import { STATUS, state } from "../core/state.js";
import { Store } from "../core/store.js";
import { $, catOf, catsOf, esc, fmt, fmtShort, inSpace, isGear, money, num, showQty, stampText } from "../core/util.js";
import { href } from "../core/router.js";
import { compare, joinList, lang, t } from "../core/i18n.js";
import { lastStore, storeDatalist } from "../stats/views.js";

/* ── 概览（储藏 / 房屋耗材共用）── */
export function restockPanel(alerts, limit = 8) {
  if (!alerts.length) return "";
  return `<ul class="restock-list">${alerts.slice(0, limit).map((it) => {
    const inList = openShopFor(it.id);
    return `<li>
      <span class="badge ${STATUS[it.status].cls}">${t(STATUS[it.status].label)}</span>
      <div class="grow"><button type="button" class="link-name" data-action="edit" data-id="${it.id}">${esc(it.name)}</button>
        <small>${t("剩 {q} {u}", { q: fmt(it.dqty), u: esc(t(it.du)) })}${it.daysLeft != null && it.qty > 0 ? t("，约够 {d} 天", { d: Math.max(0, Math.floor(it.daysLeft)) }) : ""}${t("，建议买 {q} {u}", { q: fmt(it.dsuggest), u: esc(t(it.du)) })}</small></div>
      ${inList ? `<span class="badge b-ok">${t("已在清单")}</span>` : `<button type="button" class="btn btn-sm" data-action="shop-add-item" data-id="${it.id}">${t("加入采购")}</button>`}
    </li>`;
  }).join("")}</ul>`;
}

export function shelfGrid(space) {
  const list = state.enriched.filter(inSpace(space));
  return catsOf(space).map((c) => {
    const inCat = list.filter((x) => x.category === c.id);
    if (!inCat.length) return "";
    // 装备没有库存状态：只显示件数和位置
    if (space === "gear") {
      const locs = [...new Set(inCat.map((x) => x.location).filter(Boolean))];
      return `<button type="button" class="shelf-cell" style="--cat:${c.color}" data-action="goto-cat" data-space="${space}" data-cat="${c.id}">
        <span class="ico" aria-hidden="true">${c.icon}</span><h3>${t(c.name)}</h3>
        <p>${t("{n} 种", { n: inCat.length })}${locs.length ? t("，在{locs}{etc}", { locs: esc(joinList(locs.slice(0, 2).map((l) => t(l)))), etc: locs.length > 2 ? t("等") : "" }) : ""}</p>
      </button>`;
    }
    const cnt = (s) => inCat.filter((x) => x.status === s).length;
    const seg = (s, color) => cnt(s) ? `<i style="width:${(cnt(s) / inCat.length) * 100}%;background:${color}"></i>` : "";
    const bad = inCat.length - cnt("ok");
    return `<button type="button" class="shelf-cell" style="--cat:${c.color}" data-action="goto-cat" data-space="${space}" data-cat="${c.id}">
      <span class="ico" aria-hidden="true">${c.icon}</span><h3>${t(c.name)}</h3>
      <p>${t("{n} 种", { n: inCat.length })}${bad ? t("，{n} 种需补", { n: bad }) : t("，都充足")}</p>
      <div class="mix" aria-hidden="true">${seg("out", "var(--out)")}${seg("low", "var(--low)")}${seg("soon", "var(--mustard)")}${seg("ok", "var(--pine)")}</div>
    </button>`;
  }).join("");
}

export function viewDashboard() {
  const list = state.enriched.filter(inSpace("pantry"));
  const n = (s) => list.filter((x) => x.status === s).length;
  const expN = list.filter((x) => x.exp).length;
  const alerts = alertsOf(list);
  const expiring = list.filter((x) => x.exp).sort((a, b) => a.expDays - b.expDays);

  const tile = (cls, count, label, status) =>
    `<button type="button" class="alert-tile ${cls}" data-action="goto-status" data-space="pantry" data-status="${status}"><b>${count}</b><span>${label}</span></button>`;

  const shelf = shelfGrid("pantry");

  return `
    <section class="section" aria-labelledby="h-alert">
      <div class="section-head"><h2 id="h-alert">${t("储藏概况")}</h2><p>${t("按家人的使用记录估算")}</p></div>
      <div class="alert-strip">
        ${tile("t-out", n("out"), t("缺货"), "out")}
        ${tile("t-low", n("low"), t("少货"), "low")}
        ${tile("t-soon", n("soon"), t("即将告罄"), "soon")}
        ${tile("t-exp", expN, t("临期或过期"), "exp")}
      </div>
    </section>

    <section class="section" aria-labelledby="h-restock">
      <div class="section-head"><h2 id="h-restock">${t("该补货了")}</h2>
        ${alerts.length ? `<button type="button" class="btn btn-primary btn-sm" data-action="shop-add-alerts">${t("全部加入采购清单")}</button>` : ""}</div>
      <div class="panel">${alerts.length ? restockPanel(alerts) : `<div class="empty"><strong>${t("库存都很充足")}</strong>${t("用掉东西时在“库存”里点一下 −，提醒会更准。")}</div>`}</div>
    </section>

    ${expiring.length ? `<section class="section" aria-labelledby="h-exp">
      <div class="section-head"><h2 id="h-exp">${t("先吃这些")}</h2><p>${t("菜单推荐会优先用到它们")}</p></div>
      <div class="panel"><ul class="restock-list">${expiring.slice(0, 6).map((it) => `<li>
        <span class="badge b-exp">${it.exp === "expired" ? t("已过期") : it.expDays === 0 ? t("今天到期") : t("{d} 天后到期", { d: it.expDays })}</span>
        <div class="grow"><span class="name">${esc(it.name)}</span><small>${esc(t(it.location || ""))} ${t("剩 {q} {u}", { q: fmt(it.dqty), u: esc(t(it.du)) })}</small></div></li>`).join("")}</ul></div>
    </section>` : ""}

    <section class="section" aria-labelledby="h-shelf">
      <div class="section-head"><h2 id="h-shelf">${t("家里的货架")}</h2><p>${t("点分类查看明细")}</p></div>
      ${shelf ? `<div class="shelf">${shelf}</div>` : `<div class="panel empty"><strong>${t("还没有物品")}</strong><a class="btn btn-primary" href="${href("item", "new")}?space=pantry">${t("添加第一件物品")}</a></div>`}
    </section>`;
}

/* ── 库存 ──
 * 宽屏（电脑 / iPad）：分类芯片导航 + 全部分组列表。
 * 手机：先看分类方块仪表盘（图标、件数、状态标：红圈 ! 缺货、黄三角 ! 少货或临期、绿圈 ✓ 充足），点一块进该分类；方块顺序可自己调，保存在本机。 */
export const isPhone = () => window.matchMedia("(max-width: 640px)").matches || document.documentElement.classList.contains("force-phone");   // force-phone：桌面上预览手机布局
const ORDER_KEY = (space) => `hmh-cat-order:${space}`;
function loadOrder(space) { try { return JSON.parse(localStorage.getItem(ORDER_KEY(space)) || "[]"); } catch { return []; } }
/** 该空间的分类，按用户自定义顺序（没调过的按默认顺序排在后面） */
export function orderedCats(space) {
  const order = loadOrder(space), cats = catsOf(space);
  const idx = (c) => { const i = order.indexOf(c.id); return i < 0 ? 1000 + cats.indexOf(c) : i; };
  return [...cats].sort((a, b) => idx(a) - idx(b));
}
/** 把某个分类往前 / 往后挪一位 */
export function moveCat(space, id, dir) {
  const ids = orderedCats(space).map((c) => c.id), i = ids.indexOf(id), j = i + dir;
  if (i < 0 || j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  try { localStorage.setItem(ORDER_KEY(space), JSON.stringify(ids)); } catch { /* 忽略 */ }
}
/** 分类状态：out 有缺货 > warn 有少货 / 即将告罄 / 临期 > ok 都充足 > none 没东西 */
export function catStatus(items) {
  const out = items.filter((x) => x.status === "out").length;
  const warn = items.filter((x) => x.status === "low" || x.status === "soon" || x.exp).length;
  return { out, warn, kind: !items.length ? "none" : out ? "out" : warn ? "warn" : "ok" };
}
/** 状态小药丸：红「! 1 缺货」、琥珀「! 3 少货」、绿「✓ 充足」、灰「空」 */
const stPill = (s, items) => {
  if (!items.length) return `<span class="pill pill-none">${t("空")}</span>`;
  if (s.kind === "out") return `<span class="pill pill-out"><i>!</i>${t("{n} 缺货", { n: s.out })}${s.warn ? ` · ${t("{n} 少货", { n: s.warn })}` : ""}</span>`;
  if (s.kind === "warn") return `<span class="pill pill-warn"><i>!</i>${t("{n} 少货 / 临期", { n: s.warn })}</span>`;
  return `<span class="pill pill-ok"><i>✓</i>${t("充足")}</span>`;
};

/** 手机上的分类仪表盘（参考 iOS 提醒事项 / 常见记账 App 的卡片）：顶部一条汇总，下面每个分类一张卡 */
function catDashboard(space, mine) {
  const sorting = !!state.catSort, cats = orderedCats(space), gear = space === "gear";
  const all = gear ? null : catStatus(mine), expN = gear ? 0 : mine.filter((x) => x.exp).length, lowN = gear ? 0 : mine.filter((x) => x.status === "low" || x.status === "soon").length;
  const stat = (n, label, status, cls) => `<button type="button" class="stat ${cls}" data-action="goto-status" data-space="${space}" data-status="${status}" ${n ? "" : "disabled"}><b>${n}</b><span>${label}</span></button>`;
  const summary = gear ? `<div class="dash-sum"><div class="sum-main"><b>${mine.length}</b><span>${t("件装备")}</span></div></div>`
    : `<div class="dash-sum">
        <div class="sum-main"><b>${mine.length}</b><span>${t("件物品")}</span><small>${all.kind === "ok" ? t("库存都充足") : t("{n} 件要补货", { n: all.out + lowN })}</small></div>
        <div class="sum-stats">${stat(all.out, t("缺货"), "out", "s-out")}${stat(lowN, t("少货"), "low", "s-warn")}${stat(expN, t("临期"), "exp", "s-exp")}</div>
      </div>`;
  const tiles = cats.map((c, i) => {
    const items = mine.filter((x) => x.category === c.id), s = gear ? { kind: items.length ? "ok" : "none", out: 0, warn: 0 } : catStatus(items);
    const count = gear ? items.reduce((a, x) => a + num(x.qty), 0) : items.length;
    const arrows = sorting ? `<span class="tile-sort"><button type="button" data-action="cat-move" data-cat="${c.id}" data-dir="-1" ${i === 0 ? "disabled" : ""} aria-label="${t("往前")}">‹</button><button type="button" data-action="cat-move" data-cat="${c.id}" data-dir="1" ${i === cats.length - 1 ? "disabled" : ""} aria-label="${t("往后")}">›</button></span>` : "";
    // 排序模式下卡片里有 ‹ › 按钮，按钮不能嵌套按钮，所以这时卡片用 div
    const body = `<span class="tile-top"><span class="tile-ico" style="--cat:${c.color}" aria-hidden="true">${c.icon}</span><b class="tile-count">${count}</b></span>
      <span class="tile-name">${esc(t(c.name))}</span>
      ${gear ? (items.length ? `<span class="pill pill-none">${t("{n} 种", { n: items.length })}</span>` : `<span class="pill pill-none">${t("空")}</span>`) : stPill(s, items)}${arrows}`;
    const cls = `tile st-${s.kind} ${items.length ? "" : "is-empty"}`;
    return sorting ? `<div class="${cls} is-sorting">${body}</div>` : `<button type="button" class="${cls}" data-action="cat" data-cat="${c.id}">${body}</button>`;
  }).join("");
  return `${summary}<div class="cat-dash" id="catDash">${tiles}</div>
    <p class="muted dash-foot"><button type="button" class="link-name" data-action="cat-sort">${sorting ? t("完成排序") : t("调整顺序")}</button></p>`;
}

export function viewInventory(space = "pantry") {
  if (state.filter.space !== space) Object.assign(state.filter, { space, cat: "all", q: "", status: state.filter.status });
  const f = state.filter;
  const house = space === "house", gear = space === "gear";
  if (gear) f.status = "all";   // 装备没有库存状态
  const phone = isPhone(), dash = phone && f.cat === "all";
  const chip = (id, label) => `<button type="button" class="chip" data-action="cat" data-cat="${id}" aria-pressed="${f.cat === id}">${label}</button>`;
  const shelf = gear && !phone ? shelfGrid("gear") : "";
  const mine = state.enriched.filter(inSpace(space));
  const cur = f.cat !== "all" ? catOf(f.cat) : null;
  return `
    <section class="section">
      ${phone && cur ? `<nav class="crumb" aria-label="${t("位置")}"><button type="button" class="link-name" data-action="cat" data-cat="all">‹ ${t("全部分类")}</button><span class="sep">/</span><b>${cur.icon} ${esc(t(cur.name))}</b></nav>` : ""}
      <div class="section-head"><h2>${phone && cur ? `${esc(t(cur.name))}<span class="muted">（${mine.filter((x) => x.category === cur.id).length}）</span>` : gear ? t("装备") : house ? t("房屋耗材") : t("库存清单")}</h2>
        <div class="head-acts">${house && !phone ? `<a class="btn btn-sm btn-ghost" href="${href("house", "template")}">${t("按房屋资料推荐")}</a>` : ""}
        <a class="btn btn-primary ${phone ? "btn-sm" : ""}" href="${href("item", "new")}?space=${space}${cur ? `&cat=${cur.id}` : ""}">${gear ? t("添加装备") : t("添加物品")}</a></div></div>
      ${gear && !phone ? `<p class="muted" style="margin:-4px 0 12px;font-size:13px">${t("床品、电器、自行车、千斤顶、工具这类耐用品：只记有几件、放在哪，不算消耗、不提醒补货。")}</p>` : ""}
      ${shelf ? `<div class="shelf" style="margin-bottom:14px">${shelf}</div>` : ""}
      <div class="toolbar">
        <input type="search" id="invSearch" placeholder="${gear ? t("搜索，例如：被罩、千斤顶、自行车") : house ? t("搜索，例如：滤网、电池") : t("搜索物品，例如：纸、蛋")}" value="${esc(f.q)}" aria-label="${t("搜索物品")}">
        ${gear ? "" : `<select id="invStatus" aria-label="${t("按提醒筛选")}">
          ${[["all", "全部状态"], ["alert", "需要补货"], ["out", "缺货"], ["low", "少货"], ["soon", "即将告罄"], ["exp", "临期或过期"], ["ok", "充足"]]
            .map(([v, l]) => `<option value="${v}" ${f.status === v ? "selected" : ""}>${t(l)}</option>`).join("")}
        </select>`}
      </div>
      ${phone ? "" : `<div class="chips" role="group" aria-label="${t("按分类筛选")}">
        ${chip("all", t("全部"))}${orderedCats(space).map((c) => chip(c.id, `${c.icon} ${t(c.name)}`)).join("")}
      </div>`}
      ${dash ? catDashboard(space, mine) : ""}
      <div id="invList" ${dash && !f.q.trim() ? "hidden" : ""}></div>
    </section>`;
}

export function renderInvList() {
  const f = state.filter, q = f.q.trim().toLowerCase();
  const mine = state.enriched.filter(inSpace(f.space));
  const list = mine.filter((it) => {
    if (f.cat !== "all" && it.category !== f.cat) return false;
    if (q && !(`${it.name}${it.subcategory || ""}${t(it.subcategory || "")}${it.notes || ""}`).toLowerCase().includes(q)) return false;
    if (f.status === "alert") return it.status !== "ok";
    if (f.status === "exp") return !!it.exp;
    if (f.status !== "all") return it.status === f.status;
    return true;
  });
  const host = $("#invList");
  if (!host) return;
  // 手机仪表盘：没搜索时只显示方块；一输入关键词就切成列表
  const dash = $("#catDash"), foot = $(".dash-foot");
  if (dash) { const show = !!q; dash.hidden = show; if (foot) foot.hidden = show; host.hidden = !show; if (!show) return; }
  if (!list.length) {
    host.innerHTML = mine.length
      ? `<div class="panel empty"><strong>${t("没有符合条件的物品")}</strong>${t("换个关键词或分类试试。")}</div>`
      : f.space === "house"
        ? `<div class="panel empty"><strong>${t("还没有房屋耗材")}</strong>${t("按你家的房型和设施，一次加好常用的滤网、电池、融雪盐等。")}<p><a class="btn btn-primary" href="${href("house", "template")}">${t("按房屋资料推荐")}</a></p></div>`
        : f.space === "gear"
          ? `<div class="panel empty"><strong>${t("还没有装备")}</strong>${t("床单被罩、电热毯、旅行床、自行车、千斤顶、园艺工具……这些只需要记数量和位置的东西都放这里。")}<p><a class="btn btn-primary" href="${href("item", "new")}?space=gear">${t("添加第一件装备")}</a></p></div>`
          : `<div class="panel empty"><strong>${t("库存还是空的")}</strong>${t("从最常用的几样开始，例如鸡蛋、大米、抽纸。")}</div>`;
    return;
  }
  host.innerHTML = orderedCats(f.space).map((c) => {
    const inCat = list.filter((x) => x.category === c.id)
      .sort((a, b) => STATUS[a.status].rank - STATUS[b.status].rank || compare(a.name, b.name));
    if (!inCat.length) return "";
    return `<div class="cat-group" style="--cat:${c.color}"><h3><span class="dot" aria-hidden="true"></span>${c.icon} ${t(c.name)}<span class="muted">（${inCat.length}）</span></h3>
      <div class="items">${inCat.map(itemCard).join("")}</div></div>`;
  }).join("");
}

export function itemCard(it) {
  const st = STATUS[it.status];
  const by = Store.mode === "cloud" ? memberName(it.updated_by) : null;
  const du = t(it.du);
  const stamp = (it.updated_at || it.created_at) && `<span title="${esc(stampText(it))}">${by ? `${esc(by)} ` : ""}${t("{d} 更新", { d: fmtShort(it.updated_at || it.created_at) })}</span>`;
  // 装备卡片：没有存量罐和 −/+（数量在编辑页改），显示件数、位置和备注
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
  const expBadge = it.exp ? `<span class="badge b-exp">${it.exp === "expired" ? t("已过期") : t("{d} 天内到期", { d: it.expDays })}</span>` : "";
  const label = `${it.name}，${t("剩余 {q} {u}", { q: fmt(it.dqty), u: du })}，${t(st.label)}`;
  return `<article class="item st-${it.status}" aria-label="${esc(label)}">
    <div class="jar st-${it.status}" role="img" aria-label="${t("存量约 {p}%", { p: Math.round(it.level * 100) })}">
      <i style="height:${Math.max(it.qty > 0 ? 6 : 0, it.level * 100)}%"></i>
      ${it.minMark != null ? `<span class="tick" style="bottom:${it.minMark * 100}%"></span>` : ""}
    </div>
    <div class="item-main">
      <div class="item-title"><button type="button" data-action="edit" data-id="${it.id}">${esc(it.name)}</button>
        ${it.status !== "ok" ? `<span class="badge ${st.cls}">${t(st.label)}</span>` : ""}${expBadge}</div>
      <div class="item-meta">${meta}</div>
    </div>
    <div class="qty">
      <button type="button" data-action="consume" data-id="${it.id}" aria-label="${esc(t("{name} 用掉 {q} {u}", { name: it.name, q: Units.step(it.du), u: du }))}">−</button>
      <output>${fmt(it.dqty)}<small>${esc(du)}</small></output>
      <button type="button" data-action="restock" data-id="${it.id}" aria-label="${esc(t("{name} 补充 {q} {u}", { name: it.name, q: Units.step(it.du), u: du }))}">+</button>
    </div>
  </article>`;
}

/* ── 采购清单 ── */
export function viewShopping() {
  const by = (s) => state.shopping.filter((x) => x.status === s);
  const row = (s) => {
    const mine = Store.mode === "demo" || s.claimed_by === state.user?.id;
    let acts = "";
    if (s.status === "todo") acts = `<button type="button" class="btn btn-sm btn-dark" data-action="shop-claim" data-id="${s.id}">${t("我来买")}</button>
      <button type="button" class="btn btn-sm btn-primary" data-action="shop-bought" data-id="${s.id}">${t("已买到")}</button>`;
    if (s.status === "claimed") acts = `${mine ? `<button type="button" class="btn btn-sm btn-ghost" data-action="shop-unclaim" data-id="${s.id}">${t("不买了")}</button>` : ""}
      <button type="button" class="btn btn-sm btn-primary" data-action="shop-bought" data-id="${s.id}">${t("已买到")}</button>`;
    const priceBox = s.status === "bought" ? (s.amount != null ? `<div class="muted" style="font-size:12px">${t("花费 {m}", { m: money(num(s.amount)) })}</div>` : "")
      : `<div class="price-in">
          <input type="number" min="0" step="0.01" inputmode="decimal" data-price-for="${s.id}" placeholder="${esc(t("花费 {sym}（可不填）", { sym: Units.money(0).replace(/[\d.,\s]/g, "") }))}" aria-label="${esc(t("{name} 实际花费", { name: s.name }))}">
          <input type="text" maxlength="40" list="storeList" data-store-for="${s.id}" value="${esc(lastStore())}" placeholder="${t("在哪买（可不填）")}" aria-label="${esc(t("{name} 购买商店", { name: s.name }))}">
        </div>`;
    return `<li class="shop-item ${s.status === "bought" ? "done" : ""}">
      <div class="row"><span class="nm"><b>${esc(s.name)}</b> ${showQty(num(s.quantity, 1), s.unit || "")}${s.created_at ? ` <small class="muted" title="${esc(stampText(s))}">${t("{d} 加入", { d: fmtShort(s.created_at) })}</small>` : ""}</span>
        <button type="button" class="btn btn-sm btn-ghost" data-action="shop-del" data-id="${s.id}" aria-label="${esc(t("删除 {name}", { name: s.name }))}">${t("删除")}</button></div>
      ${s.status === "claimed" ? `<div class="who">🛍 ${t("{who} 正在买", { who: esc(s.claimed_by_name || t("家人")) })}</div>` : ""}
      ${s.item_id ? "" : `<div class="muted" style="font-size:12px">${t("未关联库存，买到后需手动入库")}</div>`}
      ${priceBox}
      ${acts ? `<div class="acts">${acts}</div>` : ""}
    </li>`;
  };
  const col = (title, rows, empty, extra = "") => `<div class="shop-col"><h3>${title}<span class="muted">（${rows.length}）</span>${extra}</h3>
    ${rows.length ? `<ul>${rows.map(row).join("")}</ul>` : `<p class="muted">${empty}</p>`}</div>`;
  const bought = by("bought");
  return `
    <section class="section">
      <div class="section-head"><h2>${t("采购清单")}</h2>
        <button type="button" class="btn btn-sm" data-action="shop-add-alerts">${t("把补货提醒加进来")}</button></div>
      <form class="panel add-row" id="shopForm" aria-label="${t("手动添加采购项")}">
        <input name="name" required maxlength="60" placeholder="${t("要买什么")}" list="itemNames" aria-label="${t("名称")}">
        <input name="quantity" type="number" min="0.1" step="0.1" value="1" aria-label="${t("数量")}">
        <input name="unit" list="unitList" placeholder="${t("单位")}" maxlength="10" aria-label="${t("单位")}">
        <select name="category" aria-label="${t("分类")}"><option value="">${t("自动分类")}</option>${categoryOptions()}</select>
        <button class="btn btn-primary" type="submit">${t("加入清单")}</button>
      </form>
      ${storeDatalist()}
      <datalist id="itemNames">${state.items.map((i) => `<option value="${esc(i.name)}">`).join("")}</datalist>
      <div class="shop-cols">
        ${col(t("待购买"), by("todo"), t("没有待买的东西。"))}
        ${col(t("家人认领中"), by("claimed"), t("点“我来买”认领，家人就不会重复买。"))}
        ${col(t("已买到"), bought, t("买到后自动加回库存。"), bought.length ? ` <button type="button" class="btn btn-sm btn-ghost" style="margin-left:auto" data-action="shop-clear">${t("清空")}</button>` : "")}
      </div>
    </section>`;
}


/* ── 菜单推荐 ── */
export function scoreRecipes() {
  const expiringNames = state.enriched.filter((x) => x.exp === "expiring" && x.qty > 0);
  return RECIPES.filter((r) => r.diets.includes(state.diet)).map((r) => {
    const parts = r.ings.map((kw) => ({ kw, item: hasStock(kw) }));
    const have = parts.filter((p) => p.item).length;
    const usesExpiring = parts.some((p) => p.item && expiringNames.some((e) => e.id === p.item.id));
    return { ...r, parts, have, score: have / r.ings.length + (usesExpiring ? 0.3 : 0), usesExpiring, full: have === r.ings.length };
  }).sort((a, b) => b.score - a.score || compare(t(a.name), t(b.name)));
}

/** 菜谱外链：中文去下厨房，英文用搜索 */
const recipeLink = (name) => (lang === "en"
  ? `https://www.google.com/search?q=${encodeURIComponent(`${t(name)} recipe`)}`
  : `https://www.xiachufang.com/search/?keyword=${encodeURIComponent(name)}`);

export function viewMeals() {
  const d = DIETS[state.diet];
  const scored = scoreRecipes();
  const used = new Set();
  const pick = (meal, count) => {
    const pool = scored.filter((r) => r.meal === meal && r.have > 0 && !used.has(r.name));
    if (!pool.length) return [];
    const out = [];
    for (let i = 0; i < Math.min(count, pool.length); i++) {
      const r = pool[(state.mealShift + i) % pool.length];
      if (!out.includes(r)) { out.push(r); used.add(r.name); }
    }
    return out;
  };
  const plan = MEAL_SLOTS.map((s) => {
    const dishes = pick(s.meal, s.count);
    return `<div class="slot"><h3>${t(s.name)}</h3>${dishes.length ? dishes.map((r) => `<div class="dish">${esc(t(r.name))}${r.usesExpiring ? ` <span class="badge b-exp">${t("用临期")}</span>` : ""}
      <small>${r.full ? t("食材齐全") : t("还缺：{list}", { list: joinList(r.parts.filter((p) => !p.item).map((p) => esc(t(p.kw[0])))) })}</small></div>`).join("")
      : `<p class="muted">${t("库存里暂时凑不出，看看下面的菜谱缺什么。")}</p>`}</div>`;
  }).join("");

  const cards = scored.map((r) => {
    const missing = r.parts.filter((p) => !p.item);
    return `<article class="recipe">
      <h3><span>${esc(t(r.name))}</span><span class="badge ${r.full ? "b-ok" : "b-soon"}">${r.have}/${r.ings.length}</span></h3>
      <div class="ing">${r.parts.map((p) => `<span class="${p.item ? "have" : "miss"}">${esc(p.item ? p.item.name : t(p.kw[0]))}</span>`).join("")}</div>
      <p class="muted" style="margin:0;font-size:13px">${esc(t(r.note))}</p>
      <div class="acts">
        ${missing.length ? `<button type="button" class="btn btn-sm" data-action="recipe-missing" data-name="${esc(r.name)}">${t("缺的加入采购")}</button>` : ""}
        <a class="btn btn-sm btn-ghost" href="${recipeLink(r.name)}" target="_blank" rel="noopener noreferrer">${t("在下厨房看做法")}</a>
      </div>
    </article>`;
  }).join("");

  return `
    <section class="section">
      <div class="section-head"><h2>${t("按库存推荐菜单")}</h2>
        <button type="button" class="btn btn-sm" data-action="shuffle">${t("换一组")}</button></div>
      <div class="seg" role="group" aria-label="${t("饮食模式")}">
        ${Object.entries(DIETS).map(([k, v]) => `<button type="button" class="chip" data-action="diet" data-diet="${k}" aria-pressed="${state.diet === k}">${v.icon} ${t(v.name)}</button>`).join("")}
      </div>
      <div class="panel"><ul class="tips">${d.tips.map((x) => `<li>${esc(t(x))}</li>`).join("")}</ul>
        <p class="disclaimer">${t("以上为一般性膳食建议，不能代替医生或注册营养师的个体化方案；孕期、妊娠糖尿病和产后请以医嘱为准。")}</p></div>
    </section>
    <section class="section"><div class="section-head"><h2>${t("今天吃什么")}</h2><p>${t("优先用掉快到期的食材")}</p></div><div class="plan">${plan}</div></section>
    <section class="section"><div class="section-head"><h2>${t("可选菜谱")}</h2><p>${t("绿色是家里有的")}</p></div><div class="recipes">${cards}</div></section>`;
}

/** 分类下拉选项：储藏、房屋、装备分组显示 */
export function categoryOptions(selected, { withOther = true } = {}) {
  const opt = (c) => `<option value="${c.id}" ${c.id === selected ? "selected" : ""}>${c.icon} ${t(c.name)}</option>`;
  return `<optgroup label="${t("厨房储藏")}">${catsOf("pantry").map(opt).join("")}</optgroup>
    <optgroup label="${t("房屋耗材")}">${catsOf("house").map(opt).join("")}${withOther ? opt(MAINT_CAT) : ""}</optgroup>
    <optgroup label="${t("装备（只记数量和位置）")}">${catsOf("gear").map(opt).join("")}</optgroup>
    ${withOther ? opt(OTHER_CAT) : ""}`;
}
