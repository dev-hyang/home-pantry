/* 储藏页面导航（每个储藏页顶上都要同步用到）。 */
import { esc, isGear } from "../core/util.js";
import { href } from "../core/router.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";

/** 储藏的页面导航（2026-11-14 重构）：每个储藏页面顶上都有这一块——一排小卡片（概览 / 库存 / 菜单；购物车在底部导航，家居耐用品并进了库存），
 *  当前页背景高亮；库存卡带要补货的件数。宽屏一行排开，手机两到三列网格（不横滑，点按区域 ≥ 44px） */
export function pantryNav(cur) {
  const need = (state.enriched || []).filter((x) => !isGear(x) && x.status !== "ok").length;
  const list = [["overview", href("pantry"), "📊", t("概览")], ["inventory", href("pantry", "inventory"), "📦", t("库存"), need],
    ["meals", href("pantry", "meals"), "🍳", t("菜单")], ["scan", href("pantry", "scan"), "🧾", t("录入购物")]].filter(Boolean);
  return `<nav class="pnav" aria-label="${esc(t("储藏的页面"))}">${list.map(([id, h, ic, l, n]) => `<a class="pnav-card" href="${esc(h)}" ${id === cur ? 'aria-current="page"' : ""}>
    <span class="pnav-ico" aria-hidden="true">${ic}</span><span class="pnav-lbl">${esc(l)}</span>${n ? `<b class="pnav-n" aria-label="${esc(t("{n} 项", { n }))}">${n}</b>` : ""}</a>`).join("")}</nav>`;
}
