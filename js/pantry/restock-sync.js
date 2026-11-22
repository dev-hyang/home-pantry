/* 储藏页面导航（每个储藏页顶上都要同步用到）。 */
import { esc, isGear } from "../core/util.js";
import { href } from "../core/router.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";
import { treePop } from "../core/tree-pop.js";

/** 储藏的页面导航（2026-11-21 起和财务一样）：页顶一行「[目录] 储藏 / 当前页」，目录里列出 概览 / 库存 / 菜单 / 录入购物（购物车在底部导航，家居耐用品并进了库存），
 *  当前页高亮；库存带要补货的件数。路径只是导航文字（页面自己的标题在下面），不再另画上面的面包屑 */
export function pantryNav(cur) {
  const need = (state.enriched || []).filter((x) => !isGear(x) && x.status !== "ok").length;
  const list = [["overview", href("pantry"), "📊", t("概览")], ["inventory", href("pantry", "inventory"), "📦", t("库存"), need],
    ["meals", href("pantry", "meals"), "🍳", t("菜单")], ["scan", href("pantry", "scan"), "🧾", t("录入购物")]];
  const nodes = list.map(([id, h, icon, label, n]) => ({ label, icon, href: h, badge: n || "", current: id === cur }));
  const here = list.find(([id]) => id === cur);
  return `<div class="section-head fin-head sec-head"><div class="sh-title">${treePop(nodes, { id: "pantrytree" })}<nav class="sec-path" aria-label="${esc(t("当前位置"))}"><a class="h-root" href="${esc(href("pantry"))}">${t("储藏")}</a>${here ? ` / <b aria-current="page">${esc(here[3])}</b>` : ""}</nav></div></div>`;
}
