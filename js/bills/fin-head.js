/* 财务各页统一的页头：[目录] 财务 / 页面 / 当前页签ⓘ …… [筛选等]
 *  · 目录 = 整个财务的嵌套目录（fin-tree.js）：打开就停在当前页，一个按钮从头到尾；
 *  · 路径三段都能点：「财务」回财务首页，「页面」回这一页的第一个页签，最后一段是当前所在；
 *  · ⓘ（note）放在标题行（最后一层的名字）右上角，路径行里不放；右边 right 放筛选按钮 / 页面自己的操作。
 *  带这个页头的页面，顶上原来的面包屑（render.js）自动不画，路径只有这一行。 */
import { state } from "../core/state.js";
import { esc } from "../core/util.js";
import { t } from "../core/i18n.js";
import { href } from "../core/router.js";
import { treePop } from "../core/tree-pop.js";
import { finTree, groupHref } from "./fin-tree.js";
import { finGroupOf } from "../core/crumb-base.js";
import { toSupTip } from "../core/info-tip.js";

/** menu = 本页操作（打印、导出…，放在目录面板最下面，格式 { label, icon, href | action + data }）；label = 页面名；pageHref = 页面第一个页签的网址（有 tab 时「页面」才是链接）；tab = 当前页签名；tabHref + leaf = 页签下面再有一层时（页签名变链接，后面接 leaf）；note = ⓘ 的 html；right = 右边的 html；actsId = 右边容器的 id
 *  两行：① 路径行（目录按钮 + 财务 / 分组 / 页面 …，不含最后一层，不放 ⓘ；滚动时固定在顶上）；② 标题行（最后一层的名字 + 右上角 ⓘ，右边是筛选等操作）。 */
export function finHead({ label, pageHref = "", tab = "", tabHref = "", leaf = "", note = "", right = "", menu = [], actsId = "" }) {
  const link = (h, s) => `<a class="h-root" href="${esc(h)}">${s}</a>`, g = state.route?.sub === "group" ? null : finGroupOf(state.route?.sub);   // 分组（分析 / 收支 / 账单 / 账户）是页面上一层的目录页
  const trail = [link(href("bills"), t("财务"))];
  if (g) trail.push(link(groupHref(g.id), esc(t(g.name))));
  let title = label;
  if (tab) {
    trail.push(pageHref ? link(pageHref, esc(label)) : esc(label)); title = tab;
    if (tabHref && leaf) { trail.push(link(tabHref, esc(tab))); title = leaf; }
  }
  return `<div class="fin-head"><div class="fin-path">${treePop(finTree(state.route), { id: "fintree", actions: menu })}<nav class="fin-crumb" aria-label="${esc(t("当前位置"))}">${trail.join(' <span class="sep">/</span> ')}</nav></div>
    <div class="section-head fin-titlebar"><div class="sh-title"><h2 class="fin-title">${esc(title)}${toSupTip(note)}</h2></div><div class="head-acts"${actsId ? ` id="${esc(actsId)}"` : ""}>${right}</div></div></div>`;
}
