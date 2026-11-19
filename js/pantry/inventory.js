import { esc, num } from "../core/util.js";
import { locationGroups } from "../core/locations.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";
import { orderedCats } from "./inventory-sync-common.js";
import { groupedCats, matchItem } from "./inventory-match.js";

/* ── 库存 ──
 * 宽屏（电脑 / iPad）：分类芯片导航 + 全部分组列表。
 * 手机：先看分类方块仪表盘（图标、件数、状态标：红圈 ! 缺货、黄三角 ! 少货或临期、绿圈 ✓ 充足），点一块进该分类；方块顺序可自己调，保存在本机。 */
export const isPhone = () => window.matchMedia("(max-width: 640px)").matches || document.documentElement.classList.contains("force-phone");
export const grpName = (g) => `${g.icon} ${t(g.name)}`;
export { orderedCats } from "./inventory-sync-common.js";
export { catFormHtml, moveCat } from "./inventory-sync.js";
export { groupedCats, matchItem } from "./inventory-match.js";
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
