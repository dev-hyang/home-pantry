import { alertsOf, hasStock, memberName, openShopFor } from "../core/logic.js";
import { STATUS, state } from "../core/state.js";
import { aiPanel } from "./ai.js";
import { COLORS, ICONS } from "../core/categories.js";
import { locationGroups } from "../core/locations.js";
import { Store } from "../core/store.js";
import { $, catOf, catsOf, du, esc, fmt, fmtShort, inSpace, isGear, money, num, showQty, stampText, toDisp } from "../core/util.js";
import { href } from "../core/router.js";
import { compare, joinList, lang, t } from "../core/i18n.js";
import { lastStore, storeDatalist } from "../stats/views.js";
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

  return `
    <section class="section" aria-labelledby="h-alert">
      <div class="section-head"><h2 id="h-alert">${t("储藏概况")}</h2><div class="head-acts"><p>${t("按家人的使用记录估算")}</p><a class="btn btn-primary btn-sm" href="${href("item", "new")}?space=pantry">${t("添加物品")}</a></div></div>
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
        ${alerts.length ? `<button type="button" class="btn btn-primary btn-sm" data-action="shop-add-alerts" data-space="${withHouse ? "all" : "pantry"}">${t("全部加入采购清单")}</button>` : ""}</div>
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
    </section>

    ${withHouse ? `<section class="section" aria-labelledby="h-house">
      <div class="section-head"><h2 id="h-house">${t("房屋耗材")}</h2><p>${t("滤网、电池、融雪盐等，可关联到设备")}</p></div>
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
  const addTile = sorting ? "" : `<button type="button" class="tile tile-add" data-action="cat-new" data-space="${space}"><span class="tile-top"><span class="tile-ico" style="--cat:#8a948f" aria-hidden="true">＋</span></span><span class="tile-name">${t("新分类")}</span><span class="pill pill-none">${t("自定义")}</span></button>`;
  return `${summary}<div class="cat-dash" id="catDash">${tiles}${addTile}</div>
    <p class="muted dash-foot"><button type="button" class="link-name" data-action="cat-sort">${sorting ? t("完成排序") : t("调整顺序")}</button></p>`;
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
  const subBar = subCounts.length > 1 ? `<div class="chips" role="group" aria-label="${t("按小类筛选")}">
        <button type="button" class="chip" data-action="inv-sub" data-sub="all" aria-pressed="${f.sub === "all"}">${t("全部小类")}</button>
        ${subCounts.map(([s, n]) => `<button type="button" class="chip" data-action="inv-sub" data-sub="${esc(s)}" aria-pressed="${f.sub === s}">${esc(t(s))} <span class="muted">${n}</span></button>`).join("")}</div>` : "";
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
      </div>
      ${phone ? "" : `<div class="chips" role="group" aria-label="${t("按分类筛选")}">
        ${chip("all", t("全部"))}${orderedCats(space).map((c) => chip(c.id, `${c.icon} ${t(c.name)}`)).join("")}
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
  host.innerHTML = orderedCats(f.space).map((c) => {
    const inCat = list.filter((x) => x.category === c.id)
      .sort(invSorter(f.sort));
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
/** 待买 / 认领中的数量可改：−/+ 按单位步进（kg 0.5、lb 1、个 1…），也能直接在框里输数；按显示单位算，存回时换回原单位 */
function shopQty(s) {
  const unit = s.unit || "", d = du(unit), step = Units.step(d);
  const disp = fmt(toDisp(num(s.quantity, 1), unit));
  return `<span class="shop-qty" role="group" aria-label="${esc(t("{name} 数量", { name: s.name }))}">
    <button type="button" data-action="shop-qty" data-id="${s.id}" data-dir="-1" aria-label="${esc(t("{name} 减少 {q} {u}", { name: s.name, q: step, u: t(d) }))}">−</button>
    <input type="number" inputmode="decimal" min="${step}" step="${step}" value="${disp}" data-qty-for="${s.id}" aria-label="${esc(t("{name} 数量", { name: s.name }))}">
    ${d ? `<small>${esc(t(d))}</small>` : ""}
    <button type="button" data-action="shop-qty" data-id="${s.id}" data-dir="1" aria-label="${esc(t("{name} 增加 {q} {u}", { name: s.name, q: step, u: t(d) }))}">+</button>
  </span>`;
}
const SHOP_SORTS = [["new", "加入时间：新 → 旧"], ["old", "加入时间：旧 → 新"], ["name", "名称 A → Z"], ["cat", "按分类"]];
const shopCat = (s) => state.items.find((i) => i.id === s.item_id)?.category || s.category || "other";
/** 采购清单的筛选和排序（分类、谁认领的） */
function shopRows(status) {
  const f = state.shopFilter, me = state.user?.id;
  const mineOf = (s) => Store.mode === "demo" || s.claimed_by === me;
  const rows = state.shopping.filter((s) => s.status === status && (f.cat === "all" || shopCat(s) === f.cat)
    && (f.who === "all" || (f.who === "mine" ? s.status === "claimed" && mineOf(s) : f.who === "others" ? s.status === "claimed" && !mineOf(s) : s.status === "todo")));
  const date = (s) => String(s.created_at || "");
  const sorter = { new: (a, b) => date(b).localeCompare(date(a)), old: (a, b) => date(a).localeCompare(date(b)), name: (a, b) => compare(a.name, b.name), cat: (a, b) => shopCat(a).localeCompare(shopCat(b)) || compare(a.name, b.name) }[f.sort] || (() => 0);
  return rows.sort(sorter);
}
function shopToolbar() {
  const f = state.shopFilter, opt = (v, l, c) => `<option value="${esc(v)}" ${c === v ? "selected" : ""}>${esc(l)}</option>`;
  const cats = [...new Set(state.shopping.map(shopCat))];
  if (state.shopping.length < 3) return "";
  return `<div class="toolbar" style="margin-top:12px">
    <select id="shopCat" aria-label="${t("按分类筛选")}">${opt("all", t("全部分类"), f.cat)}${cats.map((c) => opt(c, `${(window.CATEGORIES.find((x) => x.id === c) || OTHER_CAT).icon || ""} ${t((window.CATEGORIES.find((x) => x.id === c) || OTHER_CAT).name)}`.trim(), f.cat)).join("")}</select>
    <select id="shopWho" aria-label="${t("按认领筛选")}">${opt("all", t("全部"), f.who)}${opt("todo", t("没人认领的"), f.who)}${opt("mine", t("我认领的"), f.who)}${opt("others", t("家人认领的"), f.who)}</select>
    <select id="shopSort" aria-label="${t("排序")}">${SHOP_SORTS.map(([v, l]) => opt(v, t(l), f.sort)).join("")}</select></div>`;
}
export function viewShopping() {
  const by = (s) => shopRows(s);
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
      <div class="row"><span class="nm"><b>${esc(s.name)}</b> ${s.status === "bought" ? showQty(num(s.quantity, 1), s.unit || "") : shopQty(s)}${s.created_at ? ` <small class="muted" title="${esc(stampText(s))}">${t("{d} 加入", { d: fmtShort(s.created_at) })}</small>` : ""}</span>
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
        <div class="head-acts"><a class="btn btn-sm btn-primary" href="${href("scan")}">🧾 ${t("录入购物")}</a>
          <button type="button" class="btn btn-sm" data-action="shop-add-alerts">${t("把补货提醒加进来")}</button></div></div>
      ${shopAdviceHtml()}${shopForecastHtml()}
      <form class="panel add-row shop-row" id="shopForm" aria-label="${t("手动添加采购项")}">
        <input name="name" required maxlength="60" placeholder="${t("要买什么")}" list="itemNames" aria-label="${t("名称")}">
        <input name="quantity" type="number" min="0.1" step="0.1" value="1" aria-label="${t("数量")}">
        <input name="unit" list="unitList" placeholder="${t("单位")}" maxlength="10" aria-label="${t("单位")}">
        <select name="category" aria-label="${t("分类")}"><option value="">${t("自动分类")}</option>${categoryOptions()}</select>
        <input name="estimate" type="number" min="0" step="0.01" inputmode="decimal" placeholder="${t("预估金额")}" aria-label="${t("预估金额（可不填，用来做预算提示）")}">
        <button class="btn btn-primary" type="submit">${t("加入清单")}</button>
      </form>
      ${storeDatalist()}
      <datalist id="itemNames">${state.items.map((i) => `<option value="${esc(i.name)}">`).join("")}</datalist>
      ${shopToolbar()}
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

/** 分类下拉选项：储藏、房屋、装备分组显示 */
export function categoryOptions(selected, { withOther = true } = {}) {
  const opt = (c) => `<option value="${c.id}" ${c.id === selected ? "selected" : ""}>${c.icon} ${t(c.name)}</option>`;
  return `<optgroup label="${t("日常储备")}">${catsOf("pantry").map(opt).join("")}</optgroup>
    <optgroup label="${t("房屋耗材")}">${catsOf("house").map(opt).join("")}${withOther ? opt(MAINT_CAT) : ""}</optgroup>
    <optgroup label="${t("装备（只记数量和位置）")}">${catsOf("gear").map(opt).join("")}</optgroup>
    ${withOther ? opt(OTHER_CAT) : ""}`;
}
