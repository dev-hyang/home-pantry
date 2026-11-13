import { alertsOf, hasStock, memberName, openShopFor } from "../core/logic.js";
import { STATUS, state } from "../core/state.js";
import { aiPanel } from "./ai.js";
import { COLORS, ICONS } from "../core/categories.js";
import { L1S, l2List, l2Of, spendOptions } from "../core/taxonomy.js";
import { locationGroups } from "../core/locations.js";
import { Store } from "../core/store.js";
import { shopDealLine, shopsStats } from "../shops/views.js";
import { crumbNav } from "../core/hub.js";
import { shopScanHtml } from "./shop-scan.js";
import { normName } from "../core/item-match.js";
import { $, catOf, catsOf, du, esc, fmt, fmtShort, inSpace, isGear, money, num, showQty, stampText, toDisp } from "../core/util.js";
import { href } from "../core/router.js";
import { compare, joinList, lang, t } from "../core/i18n.js";
import { lastStore, storeDatalist } from "../stats/views.js";
import { cardHintHtml, cardSelectHtml } from "../bills/cards-views.js";
import { askInline } from "../core/ask.js";
import { catCheckAlt } from "../core/category-moves.js";
import { pageLimit, pageMoreBtn } from "../core/pager.js";
import { FD, changed, clearFiltersBtn } from "../core/clear-filters.js";
import { shopAdviceHtml, shopForecastHtml } from "../bills/budget.js";

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

/** 「请确认分类」（迁移 064）：063 分类重整时按小类 + 名称猜着搬的物品，一件件确认。没有就不显示 */
const SPACE_NAME = { pantry: "日常储备", house: "房屋耗材", gear: "装备" };
function catCheckSection() {
  const list = state.items.filter((it) => it.cat_check).sort((a, b) => compare(a.name, b.name));
  if (!list.length) return "";
  const where = (cat, sub) => { const c = catOf(cat); return `${c.icon} ${esc(t(c.name))}${sub ? ` · ${esc(t(sub))}` : ""}`; };
  return `<section class="section" aria-labelledby="h-catcheck">
      <div class="section-head"><h2 id="h-catcheck">${t("请确认分类")} <span class="muted">${list.length}</span></h2>
        <button type="button" class="btn btn-ghost btn-sm" data-action="cat-check-all">${t("全部没错")}</button></div>
      <p class="muted cat-check-tip">${t("分类重整时，这些物品是按名称猜着放的。放对了点「没错」；放错了点「改成…」，连着的花费也跟着换。")}</p>
      <div class="panel"><ul class="restock-list cat-check">${list.slice(0, 30).map((it) => {
        const alt = catCheckAlt(it), sp = (c) => t(SPACE_NAME[catOf(c).space] || "");
        return `<li>
        <div class="grow"><button type="button" class="link-name" data-action="edit" data-id="${it.id}">${esc(it.name)}</button>
          <small>${t("现在：")}${where(it.category, it.subcategory)}<span class="muted">（${sp(it.category)}）</span></small></div>
        <div class="cat-check-acts">
          <button type="button" class="btn btn-sm" data-action="cat-check-ok" data-id="${it.id}">${t("没错")}</button>
          ${alt ? `<button type="button" class="btn btn-sm btn-ghost" data-action="cat-check-alt" data-id="${it.id}" data-cat="${alt[0]}" data-sub="${esc(alt[1])}" title="${esc(t(SPACE_NAME[catOf(alt[0]).space] || ""))}">${t("改成")} ${where(alt[0], alt[1])}</button>` : ""}
        </div></li>`;
      }).join("")}</ul>${list.length > 30 ? `<p class="muted cat-check-more">${t("还有 {n} 件，确认完这些再显示", { n: list.length - 30 })}</p>` : ""}</div>
    </section>`;
}

/** 储藏概览顶上一排入口：采购清单（带数）、库存、装备、房屋耗材、今天吃什么（原来储藏目录页的几项） */
function pantryEntries() {
  const shop = state.shopping.filter((s) => s.status !== "bought").length;
  const e = (h, icon, label, n = 0) => `<a class="pentry" href="${esc(h)}"><span class="pentry-ico" aria-hidden="true">${icon}</span><span>${label}</span>${n ? `<b class="badge">${n}</b>` : ""}</a>`;
  const list = [[href("shopping"), "🛒", t("采购清单"), shop], [href("pantry", "inventory"), "📦", t("库存")],
    state.gearEnabled ? [href("pantry", "gear"), "🧳", t("装备")] : null,
    state.houseEnabled ? [`${href("pantry", "inventory")}?space=house`, "🧰", t("房屋耗材")] : null,
    [href("pantry", "meals"), "🍳", t("今天吃什么")]].filter(Boolean);
  // 宽屏一排入口；手机一个下拉（选了就跳过去），不占一整行横滑
  return `<nav class="pentries" aria-label="${esc(t("储藏的页面"))}">${list.map(([h, ic, l, n]) => e(h, ic, l, n)).join("")}</nav>
    <label class="pentry-dd"><span class="sr-only">${t("去储藏的页面")}</span><select data-go data-nosearch aria-label="${esc(t("去储藏的页面"))}"><option value="" selected>📊 ${t("概览")}</option>${list.map(([h, ic, l, n]) => `<option value="${esc(h)}">${ic} ${esc(l)}${n ? ` · ${n}` : ""}</option>`).join("")}</select></label>`;
}
/** 过期扔掉：把剩下的都记成 discard（迁移 065），「家里的数字 → 浪费」统计它；不算进日均用量 */
const discardBtn = (it) => `<button type="button" class="btn btn-sm btn-ghost discard-btn" data-action="discard" data-id="${it.id}" aria-label="${esc(t("{name} 过期了，扔掉剩下的", { name: it.name }))}">🗑 ${t("扔掉")}</button>`;
/** 购物篮：去采购清单，带待买 + 家人正在买的数 */
function cartBtn() {
  const n = state.shopping.filter((s) => s.status !== "bought").length;
  return `<a class="btn btn-ghost btn-sm" href="${href("shopping")}" aria-label="${esc(t("采购清单，{n} 项", { n }))}">🛒${n ? ` <b class="num">${n}</b>` : ""}</a>`;
}
export function viewDashboard() {
  const withHouse = state.houseEnabled;   // 房屋耗材也算储藏：缺货、少货、补货提醒一起看
  const pantry = state.enriched.filter(inSpace("pantry")), house = withHouse ? state.enriched.filter(inSpace("house")) : [];
  const list = [...pantry, ...house];
  const n = (arr, s) => arr.filter((x) => x.status === s).length;
  const expN = pantry.filter((x) => x.exp).length;
  const alerts = alertsOf(list);
  const expiring = pantry.filter((x) => x.exp).sort((a, b) => a.expDays - b.expDays);

  // 方块数字和点开后的库存列表同一范围：日常储备的方块进日常储备，房屋耗材的方块进房屋耗材
  const tile = (space, cls, count, label, status) =>
    `<button type="button" class="alert-tile ${cls}" data-action="goto-status" data-space="${space}" data-status="${status}"><b>${count}</b><span>${label}</span></button>`;

  const shelf = shelfGrid("pantry"), houseShelf = withHouse ? shelfGrid("house") : "";

  return `${catCheckSection()}
    <section class="section" aria-labelledby="h-alert">
      <div class="section-head"><h2 id="h-alert">${t("储藏概览")}</h2><div class="head-acts"><a class="btn btn-primary btn-sm" href="${href("scan")}" title="${esc(t("拍小票、贴线上订单，或手动添加一件"))}">🧾 ${t("录入购物")}</a></div></div>
      ${pantryEntries()}
      ${withHouse ? `<h3 class="strip-label">🥫 ${t("日常储备")}</h3>` : ""}
      <div class="alert-strip">
        ${tile("pantry", "t-out", n(pantry, "out"), t("缺货"), "out")}
        ${tile("pantry", "t-low", n(pantry, "low"), t("少货"), "low")}
        ${tile("pantry", "t-soon", n(pantry, "soon"), t("即将告罄"), "soon")}
        ${tile("pantry", "t-exp", expN, t("临期或过期"), "exp")}
      </div>
      ${withHouse ? `<h3 class="strip-label">🧰 ${t("房屋耗材")}</h3>
      <div class="alert-strip s3">
        ${tile("house", "t-out", n(house, "out"), t("缺货"), "out")}
        ${tile("house", "t-low", n(house, "low"), t("少货"), "low")}
        ${tile("house", "t-soon", n(house, "soon"), t("即将告罄"), "soon")}
      </div>` : ""}
    </section>

    <section class="section" aria-labelledby="h-restock">
      <div class="section-head"><h2 id="h-restock">${t("该补货了")}</h2>
        <div class="head-acts">${alerts.length ? `<button type="button" class="btn btn-primary btn-sm" data-action="shop-add-alerts" data-space="${withHouse ? "all" : "pantry"}">${t("全部加入采购清单")}</button>` : ""}${cartBtn()}</div></div>
      <div class="panel">${alerts.length ? restockPanel(alerts) : `<div class="empty"><strong>${t("库存都很充足")}</strong>${t("用掉东西时在“库存”里点一下 −，提醒会更准。")}</div>`}</div>
      ${alerts.length ? askInline({ id: "restock", title: t("该补货了"), question: t("这些要补的东西怎么安排采购最省钱省时间？哪些可以等？"), context: () => [t("要补：{s}", { s: alerts.slice(0, 15).map((a) => a.name || a.item?.name).filter(Boolean).join("、") }), t("家庭人数 {n}", { n: state.members?.length || 1 })] }) : ""}
    </section>

    ${expiring.length ? `<section class="section" aria-labelledby="h-exp">
      <div class="section-head"><h2 id="h-exp">${t("先吃这些")}</h2><p>${t("菜单推荐会优先用到它们")}</p></div>
      <div class="panel"><ul class="restock-list">${expiring.slice(0, 6).map((it) => `<li>
        <span class="badge b-exp">${it.exp === "expired" ? t("已过期") : it.expDays === 0 ? t("今天到期") : t("{d} 天后到期", { d: it.expDays })}</span>
        <div class="grow"><span class="name">${esc(it.name)}</span><small>${esc(t(it.location || ""))} ${t("剩 {q} {u}", { q: fmt(it.dqty), u: esc(t(it.du)) })}</small></div>${it.exp === "expired" && it.qty > 0 ? discardBtn(it) : ""}</li>`).join("")}</ul></div>
    </section>` : ""}

    <section class="section" aria-labelledby="h-shelf">
      <div class="section-head"><h2 id="h-shelf">${t("家里的货架")}</h2><div class="head-acts"><p>${t("点分类查看明细")}</p><a class="hlink" href="${href("pantry", "inventory")}?space=pantry">${t("全部")} ›</a></div></div>
      ${shelf ? `<div class="shelf">${shelf}</div>` : `<div class="panel empty"><strong>${t("还没有物品")}</strong><a class="btn btn-primary" href="${href("item", "new")}?space=pantry">${t("添加第一件物品")}</a></div>`}
    </section>

    ${withHouse ? `<section class="section" aria-labelledby="h-house">
      <div class="section-head"><h2 id="h-house">${t("房屋耗材")}</h2><div class="head-acts"><p>${t("滤网、电池、融雪盐等，可关联到设备")}</p><a class="hlink" href="${href("pantry", "inventory")}?space=house">${t("全部")} ›</a></div></div>
      ${houseShelf ? `<div class="shelf">${houseShelf}</div>` : `<div class="panel empty"><strong>${t("还没有房屋耗材")}</strong><a class="btn btn-primary" href="${href("house", "template")}">${t("按房屋资料推荐")}</a></div>`}
    </section>` : ""}`;
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
/** 按花费的二级分类分组显示（食品杂货 / 日用个护 / 家居家电…，js/core/taxonomy.js）：组的顺序 = 组里第一个分类在自定义顺序里的位置，组内保持自定义顺序 */
export function groupedCats(space, cats = orderedCats(space)) {
  const out = [], by = new Map();
  for (const c of cats) { const g = l2Of(c.id); let e = by.get(g.id); if (!e) { e = { g, cats: [] }; by.set(g.id, e); out.push(e); } e.cats.push(c); }
  return out;
}
const grpName = (g) => `${g.icon} ${t(g.name)}`;
/** 手机：进了分类后的「大类」下拉，按组分 optgroup */
function catSelOpts(space, curId) {
  const o = (c) => `<option value="${esc(c.id)}" ${c.id === curId ? "selected" : ""}>${c.icon} ${esc(t(c.name))}</option>`, grps = groupedCats(space);
  return grps.length < 2 ? grps.flatMap((e) => e.cats).map(o).join("") : grps.map((e) => `<optgroup label="${esc(t(e.g.name))}">${e.cats.map(o).join("")}</optgroup>`).join("");
}
/** 电脑：分类芯片一行，每组前面一个小标签（食品杂货 · 日用个护…）；只有一组时不加 */
function chipGroups(space, chip) {
  const grps = groupedCats(space), one = (c) => chip(c.id, `${c.icon} ${t(c.name)}`);
  return grps.length < 2 ? grps.flatMap((e) => e.cats).map(one).join("") : grps.map((e) => `<span class="chip-grp" aria-hidden="true">${esc(t(e.g.name))}</span>${e.cats.map(one).join("")}`).join("");
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

/** 搜索 / 状态 / 位置筛选是否生效（分类另算） */
const filterActive = (f) => !!f.q.trim() || f.status !== "all" || (f.loc || "all") !== "all";
/** 一件物品是否符合当前筛选（关键词、状态、位置；withCat=true 时也看分类） */
export function matchItem(it, f, { withCat = true } = {}) {
  const q = f.q.trim().toLowerCase();
  if (withCat && f.cat !== "all" && it.category !== f.cat) return false;
  if (withCat && f.cat !== "all" && f.sub && f.sub !== "all" && it.subcategory !== f.sub) return false;   // 打开某个分类后再按小类缩小（生鲜 → 水果）
  if (q && !(`${it.name}${it.subcategory || ""}${t(it.subcategory || "")}${it.notes || ""}${it.location || ""}${t(it.location || "")}`).toLowerCase().includes(q)) return false;
  if ((f.loc || "all") !== "all" && it.location !== f.loc) return false;
  if (f.status === "alert") return it.status !== "ok";
  if (f.status === "exp") return !!it.exp;
  if (f.status !== "all") return it.status === f.status;
  return true;
}
/** 位置筛选下拉：只列这个空间里实际用到的位置，按房间分组 */
function locationFilter(mine, f) {
  const used = new Set(mine.map((x) => x.location).filter(Boolean));
  if (!used.size) return "";
  const groups = locationGroups().map((g) => ({ ...g, locs: g.locs.filter((l) => used.has(l.name)) })).filter((g) => g.locs.length);
  const known = new Set(groups.flatMap((g) => g.locs.map((l) => l.name)));
  const other = [...used].filter((n) => !known.has(n));
  const opt = (n) => `<option value="${esc(n)}" ${f.loc === n ? "selected" : ""}>${esc(t(n))}</option>`;
  return `<select id="invLoc" aria-label="${t("按位置筛选")}"><option value="all">${t("全部位置")}</option>
    ${groups.map((g) => `<optgroup label="${esc(t(g.name))}">${g.locs.map((l) => opt(l.name)).join("")}</optgroup>`).join("")}
    ${other.length ? `<optgroup label="${t("其他")}">${other.map(opt).join("")}</optgroup>` : ""}</select>`;
}

/** 手机上的分类仪表盘（参考 iOS 提醒事项 / 常见记账 App 的卡片）：顶部一条汇总，下面每个分类一张卡。
 * 有搜索 / 状态 / 位置筛选时：每张卡只数符合的物品，没有符合的卡变淡；点卡进入该分类，筛选条件保留。 */
function catDashboard(space, all0) {
  const f = state.filter, filtering = filterActive(f);
  const mine = filtering ? all0.filter((x) => matchItem(x, f, { withCat: false })) : all0;
  const sorting = !filtering && !!state.catSort, cats = orderedCats(space), gear = space === "gear";
  if (filtering) {
    const tiles = cats.map((c) => {
      const items = mine.filter((x) => x.category === c.id), s = gear ? { kind: items.length ? "ok" : "none", out: 0, warn: 0 } : catStatus(items);
      const body = `<span class="tile-top"><span class="tile-ico" style="--cat:${c.color}" aria-hidden="true">${c.icon}</span><b class="tile-count">${items.length}</b></span>
        <span class="tile-name">${esc(t(c.name))}</span>${items.length ? `<span class="pill pill-none">${esc(items.slice(0, 3).map((x) => x.name).join(" · "))}${items.length > 3 ? " …" : ""}</span>` : `<span class="pill pill-none">${t("无")}</span>`}`;
      return `<button type="button" class="tile st-${s.kind} ${items.length ? "is-hit" : "is-dim"}" data-action="cat" data-cat="${c.id}" ${items.length ? "" : "disabled"}>${body}</button>`;
    }).join("");
    return `<div class="dash-sum"><div class="sum-main"><b>${mine.length}</b><span>${t("件符合")}</span><small>${mine.length ? t("点格子进入分类，筛选条件会保留") : t("换个关键词或筛选试试")}</small></div>
        <button type="button" class="stat" data-action="inv-clear"><b>✕</b><span>${t("清除")}</span></button></div>
      <div class="cat-dash" id="catDash">${tiles}</div>`;
  }
  const all = gear ? null : catStatus(mine), expN = gear ? 0 : mine.filter((x) => x.exp).length, lowN = gear ? 0 : mine.filter((x) => x.status === "low" || x.status === "soon").length;
  const stat = (n, label, status, cls) => `<button type="button" class="stat ${cls}" data-action="goto-status" data-space="${space}" data-status="${status}" ${n ? "" : "disabled"}><b>${n}</b><span>${label}</span></button>`;
  const summary = gear ? `<div class="dash-sum"><div class="sum-main"><b>${mine.length}</b><span>${t("件装备")}</span></div></div>`
    : `<div class="dash-sum">
        <div class="sum-main"><b>${mine.length}</b><span>${t("件物品")}</span><small>${all.kind === "ok" ? t("库存都充足") : t("{n} 件要补货", { n: all.out + lowN })}</small></div>
        <div class="sum-stats">${stat(all.out, t("缺货"), "out", "s-out")}${stat(lowN, t("少货"), "low", "s-warn")}${stat(expN, t("临期"), "exp", "s-exp")}</div>
      </div>`;
  const tile = (c, i) => {
    const items = mine.filter((x) => x.category === c.id), s = gear ? { kind: items.length ? "ok" : "none", out: 0, warn: 0 } : catStatus(items);
    const count = gear ? items.reduce((a, x) => a + num(x.qty), 0) : items.length;
    const arrows = sorting ? `<span class="tile-sort"><button type="button" data-action="cat-move" data-cat="${c.id}" data-dir="-1" ${i === 0 ? "disabled" : ""} aria-label="${t("往前")}">‹</button><button type="button" data-action="cat-move" data-cat="${c.id}" data-dir="1" ${i === cats.length - 1 ? "disabled" : ""} aria-label="${t("往后")}">›</button></span>` : "";
    // 排序模式下卡片里有 ‹ › 按钮，按钮不能嵌套按钮，所以这时卡片用 div
    const body = `<span class="tile-top"><span class="tile-ico" style="--cat:${c.color}" aria-hidden="true">${c.icon}</span><b class="tile-count">${count}</b></span>
      <span class="tile-name">${esc(t(c.name))}</span>
      ${gear ? (items.length ? `<span class="pill pill-none">${t("{n} 种", { n: items.length })}</span>` : `<span class="pill pill-none">${t("空")}</span>`) : stPill(s, items)}${arrows}`;
    const cls = `tile st-${s.kind} ${items.length ? "" : "is-empty"}`;
    return sorting ? `<div class="${cls} is-sorting">${body}</div>` : `<button type="button" class="${cls}" data-action="cat" data-cat="${c.id}">${body}</button>`;
  };
  // 不排序时按花费二级分组，每组一行小标题（排序模式是一整列，好挪位置）
  const grps = sorting ? [] : groupedCats(space, cats);
  const tiles = sorting || grps.length < 2 ? cats.map(tile).join("")
    : grps.map((e) => `<h4 class="cat-grp-h">${esc(grpName(e.g))}</h4>${e.cats.map((c) => tile(c, cats.indexOf(c))).join("")}`).join("");
  const addTile = sorting ? "" : `<button type="button" class="tile tile-add" data-action="cat-new" data-space="${space}"><span class="tile-top"><span class="tile-ico" style="--cat:#8a948f" aria-hidden="true">＋</span></span><span class="tile-name">${t("新分类")}</span><span class="pill pill-none">${t("自定义")}</span></button>`;
  return `${summary}<div class="cat-dash" id="catDash">${tiles}${addTile}</div>
    <p class="muted dash-foot"><button type="button" class="link-name" data-action="cat-sort">${sorting ? t("完成排序") : t("调整顺序")}</button></p>`;
}

/** 自建分类在花费统计里挂在哪个二级分类下（js/core/taxonomy.js）；空 = 按空间默认（储藏 → 食品杂货，装备 → 家居家电，房屋耗材 → 维护与服务） */
function parentSelect(cf) {
  const def = { pantry: "食品杂货", gear: "家居家电", house: "维护与服务" }[cf.space] || "其他";
  const groups = L1S.filter((l1) => l1.id !== "transfer").map((l1) => `<optgroup label="${esc(t(l1.name))}">${l2List(l1.id).map((n) => `<option value="${n.id}" ${cf.parent === n.id ? "selected" : ""}>${n.icon} ${esc(t(n.name))}</option>`).join("")}</optgroup>`).join("");
  return `<label>${t("花费统计里算作")}<select name="parent" data-nosearch><option value="">${esc(t("按默认（{d}）", { d: t(def) }))}</option>${groups}</select><small>${t("记花费、看分类统计时，这个分类归到哪一组")}</small></label>`;
}
/** 分类表单（新建自建分类 / 编辑自建或内置分类）：名称、图标、颜色、常用小类。内置分类改过的叫“覆盖”，可恢复默认或隐藏 */
export function catFormHtml(cf) {
  const editing = !!cf.key, builtin = !!cf.builtin, overridden = builtin && !!cf.id;
  const iconList = cf.icon && !ICONS.includes(cf.icon) ? [cf.icon, ...ICONS] : ICONS;   // 内置分类的图标不在候选里时也要能选中
  const icons = iconList.map((i) => `<label class="ico-pick"><input type="radio" name="icon" value="${i}" ${(cf.icon || ICONS[0]) === i ? "checked" : ""}><span>${i}</span></label>`).join("");
  const colorList = cf.color && !COLORS.includes(cf.color) ? [cf.color, ...COLORS] : COLORS;
  const colors = colorList.map((c) => `<label class="color-pick"><input type="radio" name="color" value="${c}" ${(cf.color || COLORS[0]) === c ? "checked" : ""}><span style="--c:${c}"></span></label>`).join("");
  const sub = builtin ? t("内置分类：改名、换图标颜色、增删小类都可以，全家共用；“恢复默认”退回内置设置") : t("会出现在方块、筛选芯片、物品分类下拉和统计里，全家共用");
  return `<form id="catForm" class="panel cat-form">
    <input type="hidden" name="space" value="${esc(cf.space)}">
    <div class="section-head" style="margin-bottom:8px"><h3 style="font-size:16px">${editing ? t("编辑分类") : t("新分类")}${cf.hidden ? ` <span class="badge" style="background:var(--surface-2)">${t("已隐藏")}</span>` : ""}</h3><p>${sub}</p></div>
    <div class="form-grid">
      <label>${t("分类名")}<input name="name" required maxlength="20" placeholder="${t("例如：露营食品、手工材料")}" value="${esc(cf.name || "")}"></label>
      <label>${t("小类（逗号分隔，可选）")}<input name="subs" maxlength="200" placeholder="${t("例如：帐篷食品, 速食, 饮用水")}" value="${esc((cf.subs || []).join(", "))}"><small>${t("物品表单的“小类”下拉就按这里的顺序；改名不会改已有物品上的小类文字")}</small></label>
      ${builtin ? "" : parentSelect(cf)}
    </div>
    <div class="pick-row" role="group" aria-label="${t("图标")}">${icons}</div>
    <div class="pick-row" role="group" aria-label="${t("颜色")}">${colors}</div>
    <div class="form-actions" style="margin-top:10px"><button type="submit" class="btn btn-primary btn-sm">${editing ? t("保存") : t("添加分类")}</button>
      <button type="button" class="btn btn-sm btn-ghost" data-action="cat-cancel">${t("取消")}</button>
      ${editing ? `<span class="spacer"></span>${builtin
        ? `${overridden ? `<button type="button" class="btn btn-sm btn-ghost" data-action="cat-restore" data-cat="${esc(cf.key)}">${t("恢复默认")}</button>` : ""}<button type="button" class="btn btn-sm btn-danger-ghost" data-action="cat-hide" data-cat="${esc(cf.key)}" data-on="${cf.hidden ? "0" : "1"}">${cf.hidden ? t("重新显示") : t("隐藏分类")}</button>`
        : `<button type="button" class="btn btn-sm btn-danger-ghost" data-action="cat-delete" data-cat="${esc(cf.key)}">${t("删除分类")}</button>`}` : ""}</div>
  </form>`;
}

export function viewInventory(space = "pantry") {
  if (state.filter.space !== space) Object.assign(state.filter, { space, cat: "all", q: "", status: state.filter.status, loc: "all" });
  const f = state.filter;
  const house = space === "house", gear = space === "gear";
  if (gear) f.status = "all";   // 装备没有库存状态
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
      <div class="section-head"><p>${cur ? t("{n} 件", { n: mine.filter((x) => x.category === cur.id).length }) : t("{n} 件", { n: mine.length })}</p>
        <div class="head-acts">${house && !phone ? `<a class="btn btn-sm btn-ghost" href="${href("house", "template")}">${t("按房屋资料推荐")}</a>` : ""}
        ${cur && !cf ? `<button type="button" class="btn btn-sm btn-ghost" data-action="cat-edit" data-cat="${cur.id}">${t("编辑分类")}</button>` : ""}
        <a class="btn btn-primary ${phone ? "btn-sm" : ""}" href="${href("item", "new")}?space=${space}${cur ? `&cat=${cur.id}` : ""}">${gear ? t("添加装备") : t("添加物品")}</a></div></div>
      ${gear || !state.houseEnabled ? "" : `<div class="chips" role="group" aria-label="${t("库存范围")}">
        <button type="button" class="chip" data-action="inv-space" data-space="pantry" aria-pressed="${!house}">🥫 ${t("日常储备")}</button>
        <button type="button" class="chip" data-action="inv-space" data-space="house" aria-pressed="${house}">🧰 ${t("房屋耗材")}</button></div>`}
      ${house && !phone ? `<p class="muted" style="margin:-4px 0 12px;font-size:13px">${t("滤网、电池、融雪盐这类要消耗、要补货的房屋用品；设备页的“相关耗材”会指到这里。")}</p>` : ""}
      ${gear && !phone ? `<p class="muted" style="margin:-4px 0 12px;font-size:13px">${t("床品、电器、自行车、千斤顶、工具这类耐用品：只记有几件、放在哪，不算消耗、不提醒补货。")}</p>` : ""}
      ${shelf ? `<div class="shelf" style="margin-bottom:14px">${shelf}</div>` : ""}
      <div class="toolbar">
        <input type="search" id="invSearch" placeholder="${gear ? t("搜索，例如：被罩、千斤顶、自行车") : house ? t("搜索，例如：滤网、电池") : t("搜索物品，例如：纸、蛋")}" value="${esc(f.q)}" aria-label="${t("搜索物品")}">
        ${gear ? "" : `<select id="invStatus" aria-label="${t("按提醒筛选")}">
          ${[["all", "全部状态"], ["alert", "需要补货"], ["out", "缺货"], ["low", "少货"], ["soon", "即将告罄"], ["exp", "临期或过期"], ["ok", "充足"]]
            .map(([v, l]) => `<option value="${v}" ${f.status === v ? "selected" : ""}>${t(l)}</option>`).join("")}
        </select>`}
        ${locationFilter(mine, f)}
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
    </section>`;
}

const INV_SORTS = [["default", "按状态（缺货优先）"], ["name", "名称 A → Z"], ["qty", "数量：少 → 多"], ["exp", "保质期：近 → 远"], ["updated", "最近更新"]];
/** 同一分类内的排序：默认缺货 / 少货在前；其余按名称、数量、保质期、更新时间 */
const invSorter = (mode) => ({
  name: (a, b) => compare(a.name, b.name),
  qty: (a, b) => num(a.qty) - num(b.qty) || compare(a.name, b.name),
  exp: (a, b) => (a.expiry_date || "9999").localeCompare(b.expiry_date || "9999") || compare(a.name, b.name),
  updated: (a, b) => String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || "")),
}[mode] || ((a, b) => STATUS[a.status].rank - STATUS[b.status].rank || compare(a.name, b.name)));
export function renderInvList() {
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
        ? `<div class="panel empty"><strong>${t("还没有房屋耗材")}</strong>${t("按你家的房型和设施，一次加好常用的滤网、电池、融雪盐等。")}<p><a class="btn btn-primary" href="${href("house", "template")}">${t("按房屋资料推荐")}</a></p></div>`
        : f.space === "gear"
          ? `<div class="panel empty"><strong>${t("还没有装备")}</strong>${t("床单被罩、电热毯、旅行床、自行车、千斤顶、园艺工具……这些只需要记数量和位置的东西都放这里。")}<p><a class="btn btn-primary" href="${href("item", "new")}?space=gear">${t("添加第一件装备")}</a></p></div>`
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
    return `${head}<div class="cat-group" style="--cat:${c.color}"><h3><span class="dot" aria-hidden="true"></span>${c.icon} ${t(c.name)}<span class="muted">（${inCat.length}）</span></h3>
      <div class="items">${part.map(itemCard).join("")}</div></div>`;
  }).join("") + pageMoreBtn("inv", orderedCats(f.space).reduce((n, c) => n + (byCat.get(c.id)?.length || 0), 0), lim);
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

/* ── 采购清单 ── */
/** 待买 / 认领中的数量可改：−/+ 按单位步进（kg 0.5、lb 1、个 1…），也能直接在框里输数；按显示单位算，存回时换回原单位 */
/** 采购条目的单位：自己改过的优先，没有就跟库存里这件东西的单位 */
export const shopUnit = (s) => s.unit || state.items.find((i) => i.id === s.item_id)?.unit || "";
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
const SHOP_SORTS = [["old", "加入最久的在前"], ["new", "最近加入的在前"], ["name", "名称 A → Z"], ["cat", "按分类"]];
const shopCat = (s) => state.items.find((i) => i.id === s.item_id)?.category || s.category || "other";
/* 采购（2026-11-13 重新设计）：#/shopping 是看板首页（几个数字 + 录入入口 + 待买预览），
 * #/shopping/list 是完整清单（搜索 + 状态 / 分类 / 排序下拉，默认加入最久的在前），#/shopping/add 是「加入清单」页（手动 / 拍照）。
 * 看板上的格子带 ?st=… 进清单页：进来时设好状态筛选，再把参数去掉（之后由下拉框说了算） */
const SHOP_STATES = [["open", "全部未买"], ["todo", "尚未认领"], ["claimed", "已认领"], ["mine", "我认领的"], ["bought", "已买到"], ["all", "全部（含已买到）"]];
const isMine = (s) => Store.mode === "demo" || s.claimed_by === state.user?.id;
const whoName = (s) => s.claimed_by_name || (isMine(s) ? t("我") : t("家人"));
const inState = (st) => (s) => (st === "all" ? true : st === "bought" ? s.status === "bought"
  : s.status !== "bought" && (st === "open" || (st === "todo" ? s.status === "todo" : s.status === "claimed" && (st === "claimed" || isMine(s)))));
const listHref = (st) => href("shopping", "list", st && st !== "open" ? `?st=${st}` : "");
/** 清单页的采购项：状态、分类、搜索（名称、谁认领的）筛选后排序；已买到按买到时间 */
function shopRows() {
  const f = state.shopFilter, q = normName(f.q || "");
  const cats = new Map(state.items.map((i) => [i.id, i.category]).reverse());   // 建一次，筛选 / 排序时不再逐条查库存
  const catOfRow = (s) => cats.get(s.item_id) || s.category || "other";
  const rows = state.shopping.filter((s) => inState(f.st)(s) && (f.cat === "all" || catOfRow(s) === f.cat)
    && (!q || normName(`${s.name} ${s.claimed_by_name || ""}`).includes(q)));
  const date = (s) => String((s.status === "bought" && s.bought_at) || s.created_at || "");
  const sorter = { new: (a, b) => date(b).localeCompare(date(a)), old: (a, b) => date(a).localeCompare(date(b)), name: (a, b) => compare(a.name, b.name), cat: (a, b) => catOfRow(a).localeCompare(catOfRow(b)) || compare(a.name, b.name) }[f.sort] || (() => 0);
  return rows.sort(sorter);
}
function shopToolbar() {
  const f = state.shopFilter, opt = (v, l, c) => `<option value="${esc(v)}" ${c === v ? "selected" : ""}>${esc(l)}</option>`;
  const cats = [...new Set(state.shopping.map(shopCat))];
  const n = (st) => state.shopping.filter(inState(st)).length;
  return `<div class="toolbar shop-toolbar">
    <label class="shop-q"><span class="sr-only">${t("搜索采购清单")}</span><input type="search" id="shopQ" value="${esc(f.q || "")}" placeholder="${esc(t("搜索要买的东西"))}" autocomplete="off"></label>
    <select id="shopSt" aria-label="${t("按状态筛选")}">${SHOP_STATES.map(([v, l]) => opt(v, `${t(l)}${lang === "en" ? ` (${n(v)})` : `（${n(v)}）`}`, f.st)).join("")}</select>
    <select id="shopCat" data-search aria-label="${t("按分类筛选")}">${opt("all", t("全部分类"), f.cat)}${cats.map((c) => opt(c, `${(window.CATEGORIES.find((x) => x.id === c) || OTHER_CAT).icon || ""} ${t((window.CATEGORIES.find((x) => x.id === c) || OTHER_CAT).name)}`.trim(), f.cat)).join("")}</select>
    <select id="shopSort" aria-label="${t("排序")}">${SHOP_SORTS.map(([v, l]) => opt(v, t(l), f.sort)).join("")}</select>${clearFiltersBtn("shop", changed(f, FD.shop))}</div>`;
}
/** 清单本身（搜索框输入时只重画这一块，光标不跳） */
function shopListBody() {
  const f = state.shopFilter, rows = shopRows(), key = `shop:${f.st}`, lim = pageLimit(key, JSON.stringify(f));
  const empty = f.q ? t("没找到「{q}」。", { q: f.q }) : { open: t("没有待买的东西。"), todo: t("都有人认领了。"), claimed: t("点“我来买”认领，家人就不会重复买。"), mine: t("你还没有认领要买的东西。"), bought: t("买到后自动加回库存。"), all: t("采购清单是空的。") }[f.st] || "";
  const bought = f.st === "bought" || f.st === "all" ? state.shopping.some((s) => s.status === "bought") : false;
  return `<div class="shop-list-meta"><span class="muted">${t("{n} 项", { n: rows.length })}</span>${bought ? `<button type="button" class="btn btn-sm btn-ghost" data-action="shop-clear">${t("清空已买到")}</button>` : ""}</div>
    ${rows.length ? `<ul class="shop-list">${rows.slice(0, lim).map(shopRowHtml).join("")}</ul>${pageMoreBtn(key, rows.length, lim)}` : `<p class="muted shops-empty">${esc(empty)}</p>`}`;
}
export function renderShopList() { const box = $("#shopListBox"); if (box) box.innerHTML = shopListBody(); }
/* 从别的应用带来的采购项（2026-11，牧羊人的饮食模版「加进爱家采购清单」）：#/shopping?add=燕麦|糙米|…&from=DASH 低钠
 * 牧羊人是另一个 Supabase 项目，只能把名字放在网址里带过来；这里列出来勾选确认后才加，已在清单里（待买 / 在买）的默认不勾 */
export const importNames = () => { const raw = state.route?.q?.get("add"); return raw ? [...new Set(raw.split("|").map((s) => s.trim().slice(0, 60)).filter(Boolean))].slice(0, 40) : []; };
function shopImportHtml() {
  const names = importNames(); if (!names.length) return "";
  const open = new Set(state.shopping.filter((s) => s.status !== "bought").map((s) => String(s.name).trim().toLowerCase()));
  const from = state.route.q.get("from") || "";
  return `<div class="panel shop-import" id="shopImport" role="region" aria-label="${esc(t("从别的应用带来的采购项"))}">
    <b>🐑 ${from ? t("来自牧羊人 · {n}", { n: from }) : t("来自牧羊人")}</b><p class="muted" style="margin:4px 0 8px;font-size:13px">${t("勾选要买的，再点「加进采购清单」。已经在清单里的默认不勾。")}</p>
    <div class="shop-import-list">${names.map((n) => { const dup = open.has(n.toLowerCase()); return `<label class="check-inline"><input type="checkbox" value="${esc(n)}" ${dup ? "" : "checked"}><span>${esc(n)}${dup ? ` <small class="muted">${t("已在清单里")}</small>` : ""}</span></label>`; }).join("")}</div>
    <div class="form-actions" style="margin-top:8px"><button type="button" class="btn btn-primary btn-sm" data-action="shop-import">${t("加进采购清单")}</button><button type="button" class="btn btn-ghost btn-sm" data-action="shop-import-cancel">${t("不用了")}</button></div></div>`;
}

/** 清单页的一行：数量可改、在哪买 / 花费 / 用卡、认领和买到 */
function shopRowHtml(s) {
  const mine = isMine(s);
  let acts = "";
  if (s.status === "todo") acts = `<button type="button" class="btn btn-sm btn-dark" data-action="shop-claim" data-id="${s.id}">${t("我来买")}</button>
    <button type="button" class="btn btn-sm btn-primary" data-action="shop-bought" data-id="${s.id}">${t("已买到")}</button>`;
  if (s.status === "claimed") acts = `${mine ? `<button type="button" class="btn btn-sm btn-ghost" data-action="shop-unclaim" data-id="${s.id}">${t("取消认领")}</button>` : ""}
    <button type="button" class="btn btn-sm btn-primary" data-action="shop-bought" data-id="${s.id}">${t("已买到")}</button>`;
  const priceBox = s.status === "bought" ? (s.amount != null ? `<div class="muted" style="font-size:12px">${t("花费 {m}", { m: money(num(s.amount)) })}</div>` : "")
    : `<div class="price-in">
        <input type="number" min="0" step="0.01" inputmode="decimal" data-price-for="${s.id}" placeholder="${esc(t("花费 {sym}（可不填）", { sym: Units.money(0).replace(/[\d.,\s]/g, "") }))}" aria-label="${esc(t("{name} 实际花费", { name: s.name }))}">
        <input type="text" maxlength="40" list="storeList" data-store-for="${s.id}" placeholder="${t("在哪买（可不填）")}" aria-label="${esc(t("{name} 购买商店", { name: s.name }))}">
        ${cardSelectHtml("card_id", undefined, `data-card-for="${s.id}"`)}
      </div>`;
  const when = s.status === "bought" && s.bought_at ? t("{d} 买到", { d: fmtShort(s.bought_at) }) : s.created_at ? t("{d} 加入", { d: fmtShort(s.created_at) }) : "";
  // 左滑删除；没买到的还能右滑「已买到」（先确认）。右滑替下面隐藏的 swipe-alt-src 点一下（带 data-confirm，按钮本身点了不弹框）
  const swipe = s.status === "bought" ? "" : ` data-swipe-alt="shop" data-swipe-alt-label="${esc(t("已买到"))}" data-swipe-alt-go="${esc(t("松手买到"))}"`;
  return `<li class="shop-item ${s.status === "bought" ? "done" : ""}" data-swipe-del="shop"${swipe}>
    <div class="row"><span class="nm"><b>${esc(s.name)}</b> ${s.status === "bought" ? showQty(num(s.quantity, 1), shopUnit(s)) : shopQty(s)}${when ? ` <small class="muted" title="${esc(stampText(s))}">${when}</small>` : ""}</span>
      <button type="button" class="btn btn-sm btn-ghost swipe-src" data-action="shop-del" data-id="${s.id}" aria-label="${esc(t("删除 {name}", { name: s.name }))}">${t("删除")}</button>${s.status === "bought" ? "" : `<button type="button" class="btn btn-sm btn-ghost swipe-alt-src" data-action="shop-bought" data-id="${s.id}" data-confirm="1" aria-label="${esc(t("{name} 已买到", { name: s.name }))}">${t("已买到")}</button>`}</div>
    ${s.status === "claimed" ? `<div class="who">🛍 ${t("{who} 正在买", { who: esc(whoName(s)) })}</div>` : ""}
    ${s.status === "bought" ? (s.claimed_by_name ? `<div class="who">✅ ${t("{who} 买到的", { who: esc(s.claimed_by_name) })}</div>` : "") : shopDealLine(s)}
    ${s.item_id ? "" : `<div class="muted" style="font-size:12px">${t("未关联库存，买到后需手动入库")}</div>`}
    ${priceBox}
    ${s.status === "bought" ? "" : `<div class="card-hint-slot">${cardHintHtml(s.category || state.items.find((i) => i.id === s.item_id)?.category, "")}</div>`}
    ${acts ? `<div class="acts">${acts}</div>` : ""}
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
/** 首页的「待买」预览：没人认领的在前，最多 6 项；点「我来买 / 已买到」就地处理，要填价格、商店去完整清单 */
function shopPreview() {
  const open = state.shopping.filter((s) => s.status !== "bought")
    .sort((a, b) => (a.status === "todo" ? 0 : 1) - (b.status === "todo" ? 0 : 1) || String(a.created_at || "").localeCompare(String(b.created_at || "")));
  if (!open.length) return `<div class="panel sd-empty"><b>${t("没有待买的东西")}</b><span class="muted">${t("缺什么随手加进来，家人能看到、能认领。")}</span></div>`;
  return `<div class="panel sd-preview"><div class="section-head"><h3>${t("待购买")}</h3><a class="btn btn-sm btn-ghost" href="${listHref("open")}">${t("查看全部 {n}", { n: open.length })} ›</a></div>
    <ul>${open.slice(0, 6).map((s) => `<li class="sp-row">
      <span class="sp-txt"><b>${esc(s.name)}</b> <small class="muted">${showQty(num(s.quantity, 1), shopUnit(s))}${s.status === "claimed" ? ` · 🛍 ${esc(whoName(s))}` : ""}</small>${shopDealLine(s)}</span>
      <span class="sp-acts">${s.status === "todo" ? `<button type="button" class="btn btn-sm btn-dark" data-action="shop-claim" data-id="${s.id}">${t("我来买")}</button>` : ""}<button type="button" class="btn btn-sm btn-primary" data-action="shop-bought" data-id="${s.id}">${t("已买到")}</button></span>
    </li>`).join("")}</ul></div>`;
}
function viewShopHome() {
  const st = shopStats(), sh = shopsStats();
  const who = [...st.byWho].map(([w, n]) => `${esc(w)} ${n}`).join(" · ");
  return `<section class="section shop-home">
    <div class="section-head"><h2>${t("采购")}</h2></div>
    ${shopImportHtml()}
    <div class="sd-acts" role="group" aria-label="${esc(t("录入"))}">
      <div class="sd-grp"><span class="sd-grp-t">${t("加入采购清单")}</span>
        <a class="btn btn-primary" href="${href("shopping", "add")}">＋ ${t("手动添加")}</a>
        <a class="btn btn-primary" href="${href("shopping", "add", "?mode=photo")}">📷 ${t("拍照添加")}</a>
        <button type="button" class="btn" data-action="shop-add-alerts">🔔 ${t("补货提醒")}</button></div>
      <div class="sd-grp"><span class="sd-grp-t">${t("买回来了，录入库存")}</span>
        <a class="btn" href="${href("scan")}">🧾 ${t("拍小票 / 网购订单入库")}</a></div>
    </div>
    ${shopAdviceHtml()}
    <div class="sd-grid">
      <div class="panel sd-tile sd-main">
        <a class="sd-top" href="${listHref("open")}"><span class="sd-ico" aria-hidden="true">🛒</span><span class="sd-lbl">${t("待购买")}</span><span class="mch" aria-hidden="true">›</span></a>
        <a class="sd-big" href="${listHref("open")}" aria-label="${esc(t("待购买 {n} 项", { n: st.open }))}">${st.open}<small>${t("项")}</small></a>
        <span class="sd-split"><a href="${listHref("todo")}"><b>${st.todo}</b> ${t("尚未认领")}</a><a href="${listHref("claimed")}"><b>${st.claimed}</b> ${t("已认领")}</a></span>
      </div>
      ${tile(listHref("claimed"), "🛍", t("家人认领"), `${st.claimed}<small>${t("项")}</small>`, st.claimed ? who : t("点“我来买”认领，家人就不会重复买。"))}
      ${tile(href("shops", "list"), "🏪", t("常去的商店与特价"), sh.shops ? `${sh.hits}<small>${t("项特价对上清单")}</small>` : "—",
        sh.shops ? [t("{n} 家", { n: sh.shops }), t("特价 {n} 项", { n: sh.deals }), sh.due ? `<em>${t("{n} 家待更新", { n: sh.due })}</em>` : ""].filter(Boolean).map((x) => `<span class="nw">${x}</span>`).join(" · ") : t("放进常去的超市，看本周特价、哪家最便宜"))}
      ${tile(listHref("bought"), "✅", t("近 30 天买到"), `${st.recent}<small>${t("项")}</small>`, st.priced ? t("花费 {m}", { m: money(st.spent) }) : t("买到后自动加回库存。"))}
    </div>
    ${shopForecastHtml()}
    ${shopPreview()}
  </section>`;
}
function viewShopList() {
  const st = state.route?.q?.get("st");
  if (st && SHOP_STATES.some(([k]) => k === st)) { state.shopFilter.st = st; state.route.q.delete("st"); history.replaceState(null, "", href("shopping", "list")); }
  return `<section class="section shop-list-page">
    ${crumbNav([{ href: href("shopping"), label: t("采购") }, { label: t("采购清单"), icon: "🛒" }])}
    <div class="section-head"><h2>${t("采购清单")}</h2>
      <div class="head-acts"><a class="btn btn-sm btn-primary" href="${href("shopping", "add")}">＋ ${t("添加")}</a><a class="btn btn-sm" href="${href("shopping", "add", "?mode=photo")}">📷 ${t("拍照添加")}</a></div></div>
    ${shopToolbar()}
    ${storeDatalist()}
    <div id="shopListBox">${shopListBody()}</div>
  </section>`;
}
function viewShopAdd() {
  const photo = state.route?.q?.get("mode") === "photo";
  const recent = state.shopping.filter((s) => s.status !== "bought").sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""))).slice(0, 5);
  const form = `<form class="panel shop-add-form" id="shopForm" aria-label="${t("手动添加采购项")}">
      <label class="full">${t("要买什么")}<input name="name" required maxlength="60" placeholder="${t("例如：鸡蛋、牛奶、洗洁精")}" list="itemNames" autocomplete="off"></label>
      <label>${t("数量")}<input name="quantity" type="number" min="0.1" step="0.1" value="1" inputmode="decimal"></label>
      <label>${t("单位")}<input name="unit" list="unitList" placeholder="${t("不填自动选")}" maxlength="10"></label>
      <label>${t("分类")}<select name="category"><option value="">${t("自动分类")}</option>${categoryOptions()}</select></label>
      <label>${t("预估金额")}<input name="estimate" type="number" min="0" step="0.01" inputmode="decimal" placeholder="${t("可不填，用来做预算提示")}"></label>
      <div class="form-actions full"><button class="btn btn-primary" type="submit">${t("加入清单")}</button><a class="btn btn-ghost" href="${href("shopping")}">${t("完成")}</a></div>
      <p class="muted full shop-add-tip">${t("加完一项可以接着加；库存里有的东西会自动关联，买到后自动入库。")}</p>
    </form>`;
  return `<section class="section shop-add-page">
    ${crumbNav([{ href: href("shopping"), label: t("采购") }, { label: t("加入清单"), icon: "＋" }])}
    <nav class="shop-mode" aria-label="${esc(t("添加方式"))}">
      <a class="chip" href="${href("shopping", "add")}" ${photo ? "" : 'aria-current="page"'}>✍️ ${t("手动")}</a>
      <a class="chip" href="${href("shopping", "add", "?mode=photo")}" ${photo ? 'aria-current="page"' : ""}>📷 ${t("拍照")}</a>
    </nav>
    ${photo ? shopScanHtml() : form}
    <datalist id="itemNames">${state.items.map((i) => `<option value="${esc(i.name)}">`).join("")}</datalist>
    ${shopAdviceHtml()}
    ${recent.length ? `<div class="panel sd-preview"><div class="section-head"><h3>${t("最近加入")}</h3><a class="btn btn-sm btn-ghost" href="${listHref("open")}">${t("采购清单")} ›</a></div>
      <ul>${recent.map((s) => `<li class="sp-row"><span class="sp-txt"><b>${esc(s.name)}</b> <small class="muted">${showQty(num(s.quantity, 1), shopUnit(s))}${s.created_at ? ` · ${t("{d} 加入", { d: fmtShort(s.created_at) })}` : ""}</small></span></li>`).join("")}</ul></div>` : ""}
    <a class="panel shops-entry" href="${href("scan")}"><span aria-hidden="true">🧾</span><span><b>${t("买回来了？拍小票或贴网购订单")}</b><small>${t("这是录入库存、记花费，不是加采购清单")}</small></span><span class="mch" aria-hidden="true">›</span></a>
  </section>`;
}
/** 采购：#/shopping（看板）、#/shopping/list、#/shopping/add；储藏 → 采购（#/pantry/shopping）也是看板 */
export function viewShopping() {
  const sub = state.route?.section === "shopping" ? state.route.sub : "home";
  return sub === "list" ? viewShopList() : sub === "add" ? viewShopAdd() : viewShopHome();
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
  // 每餐可以单独“换一道”：state.slotShift[meal] 让那一餐从菜谱池里往后取
  const shifts = state.slotShift || (state.slotShift = {});
  const plan = MEAL_SLOTS.map((s) => {
    const base = state.mealShift + (shifts[s.id] || 0);
    const pool = scored.filter((r) => r.meal === s.meal && r.have > 0 && !used.has(r.name));
    const dishes = []; for (let i = 0; i < Math.min(s.count, pool.length); i++) { const r = pool[(base + i) % pool.length]; if (!dishes.includes(r)) { dishes.push(r); used.add(r.name); } }
    return `<div class="slot"><h3>${t(s.name)}${dishes.length ? `<button type="button" class="link-name slot-swap" data-action="slot-swap" data-slot="${s.id}">${t("换一道")}</button>` : ""}</h3>${dishes.length ? dishes.map((r) => `<div class="dish">${esc(t(r.name))}${r.usesExpiring ? ` <span class="badge b-exp">${t("用临期")}</span>` : ""}
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

  // 顶部 AI 对话框；从首页带 ?ai=需求 进来时预填
  const qAsk = state.route?.q?.get("ai"); if (qAsk != null) { state.ai = state.ai || { ask: "", busy: false, result: null, error: null, raw: null }; if (qAsk) state.ai.ask = qAsk; }
  return `
    ${aiPanel()}
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

/** 分类下拉选项：储藏、房屋、装备分组显示。
 *  记花费（spend）的下拉按 一级 · 二级 分类分组，叶子在组里（js/core/taxonomy.js 的 spendOptions；手动记一笔、就地编辑、导入对账单、召回退款共用，不要在别处另列一份） */
export function categoryOptions(selected, { withOther = true, spend = false } = {}) {
  if (spend) return spendOptions(selected, { withOther });
  const opt = (c) => `<option value="${c.id}" ${c.id === selected ? "selected" : ""}>${c.icon} ${t(c.name)}</option>`;
  // 空间 · 花费二级（日常储备 · 食品杂货）一组；下拉里 optgroup 不能嵌套，所以两级拼在组名里
  const sp = (space, label, extra = "") => groupedCats(space).map((e, i, a) => `<optgroup label="${esc(`${label} · ${t(e.g.name)}`)}">${e.cats.map(opt).join("")}${i === a.length - 1 ? extra : ""}</optgroup>`).join("");
  return `${sp("pantry", t("日常储备"))}${sp("house", t("房屋耗材"), withOther ? opt(MAINT_CAT) : "")}${sp("gear", t("装备"))}
    ${withOther ? opt(OTHER_CAT) : ""}`;
}

/* 下拉导航（储藏概览在手机上的入口）：选了就跳过去 */
document.addEventListener("change", (e) => { if (e.target.matches?.("select[data-go]") && e.target.value) location.hash = e.target.value; });
