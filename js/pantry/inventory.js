/* 库存页：分类导航、筛选、方块仪表盘（手机）/ 分类列表（宽屏）。 */
import { COLORS, ICONS } from "../core/categories.js";
import { L1S, l2List, l2Of } from "../core/taxonomy.js";
import { catsOf, esc, num } from "../core/util.js";
import { locationGroups } from "../core/locations.js";
import { ownerMatch } from "./owner.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";

/* ── 库存 ──
 * 宽屏（电脑 / iPad）：分类芯片导航 + 全部分组列表。
 * 手机：先看分类方块仪表盘（图标、件数、状态标：红圈 ! 缺货、黄三角 ! 少货或临期、绿圈 ✓ 充足），点一块进该分类；方块顺序可自己调，保存在本机。 */
export const isPhone = () => window.matchMedia("(max-width: 640px)").matches || document.documentElement.classList.contains("force-phone");
   // force-phone：桌面上预览手机布局
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
export const grpName = (g) => `${g.icon} ${t(g.name)}`;
/** 手机：进了分类后的「大类」下拉，按组分 optgroup */
export function catSelOpts(space, curId) {
  const o = (c) => `<option value="${esc(c.id)}" ${c.id === curId ? "selected" : ""}>${c.icon} ${esc(t(c.name))}</option>`, grps = groupedCats(space);
  return grps.length < 2 ? grps.flatMap((e) => e.cats).map(o).join("") : grps.map((e) => `<optgroup label="${esc(t(e.g.name))}">${e.cats.map(o).join("")}</optgroup>`).join("");
}
/** 电脑：分类芯片一行，每组前面一个小标签（食品杂货 · 日用个护…）；只有一组时不加 */
export function chipGroups(space, chip) {
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
  if (!ownerMatch(it, f.owner)) return false;
  if (f.status === "alert") return it.status !== "ok";
  if (f.status === "exp") return !!it.exp;
  if (f.status !== "all") return it.status === f.status;
  return true;
}
/** 位置筛选下拉：只列这个空间里实际用到的位置，按房间分组 */
export function locationFilter(mine, f) {
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
export function catDashboard(space, all0) {
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
  const summary = gear ? `<div class="dash-sum"><div class="sum-main"><b>${mine.length}</b><span>${t("件家居耐用品")}</span></div></div>`
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
/** 自建分类在花费统计里挂在哪个二级分类下（js/core/taxonomy.js）；空 = 按空间默认（储藏 → 食品杂货，家居耐用品 → 家居家电，汽车房屋消耗品 → 维护与服务） */
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
