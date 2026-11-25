/* 财务各页统一的页头：[目录] 财务 / 页面 / 当前页签ⓘ …… [筛选等]
 *  · 目录 = 整个财务的嵌套目录（fin-tree.js）：打开就停在当前页，一个按钮从头到尾；
 *  · 路径三段都能点：「财务」回财务首页，「页面」回这一页的第一个页签，最后一段是当前所在；
 *  · ⓘ（note）放在标题行（最后一层的名字）右上角，路径行里不放；右边 right 放筛选按钮 / 页面自己的操作。
 *  带这个页头的页面，顶上原来的面包屑（render.js）自动不画，路径只有这一行。 */
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";
import { href } from "../core/router.js";
import { treePop } from "../core/tree-pop.js";
import { finTree, groupHref } from "./fin-tree.js";
import { finGroupOf } from "../core/crumb-base.js";
import { pathHead } from "../core/page-path.js";

/** menu = 本页操作（打印、导出…，放在目录面板最下面，格式 { label, icon, href | action + data }）；label = 页面名；pageHref = 页面第一个页签的网址（有 tab 时「页面」才是链接）；tab = 当前页签名；tabHref + leaf = 页签下面再有一层时（页签名变链接，后面接 leaf）；note = ⓘ 的 html；right = 右边的 html；actsId = 右边容器的 id
 *  两行（画法在 core/page-path.js）：路径行含全部层级（财务 / 分组 / 页面 / 页签 …，最后一层是当前页），标题行再写一遍当前页名字 + 右上角 ⓘ + 靠右的筛选。 */
export function finHead({ label, pageHref = "", tab = "", tabHref = "", leaf = "", note = "", right = "", menu = [], actsId = "" }) {
  const g = state.route?.sub === "group" ? null : finGroupOf(state.route?.sub);   // 分组（分析 / 收支 / 账单 / 账户）是页面上一层的目录页
  const trail = [{ href: href("bills"), label: t("财务") }];
  if (g) trail.push({ href: groupHref(g.id), label: t(g.name) });
  trail.push({ href: tab ? pageHref : "", label });
  if (tab) trail.push({ href: leaf ? tabHref : "", label: tab });
  if (tab && leaf) trail.push({ label: leaf });
  return pathHead({ treeHtml: treePop(finTree(state.route), { id: "fintree", actions: menu }), trail, title: trail[trail.length - 1].label, note, right, actsId });
}
