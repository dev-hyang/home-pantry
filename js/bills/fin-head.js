/* 财务各页统一的页头：[目录] 财务 / 页面 / 当前页签ⓘ …… [筛选等]
 *  · 目录 = 整个财务的嵌套目录（fin-tree.js）：打开就停在当前页，一个按钮从头到尾；
 *  · 路径三段都能点：「财务」回财务首页，「页面」回这一页的第一个页签，最后一段是当前所在；
 *  · ⓘ（note）放在标题里，紧贴最后一个字；右边 right 放筛选按钮 / 页面自己的操作。
 *  带这个页头的页面，顶上原来的面包屑（render.js）自动不画，路径只有这一行。 */
import { state } from "../core/state.js";
import { esc } from "../core/util.js";
import { t } from "../core/i18n.js";
import { href } from "../core/router.js";
import { treePop } from "../core/tree-pop.js";
import { finTree } from "./fin-tree.js";

/** menu = 本页操作（打印、导出…，放在目录面板最下面，格式 { label, icon, href | action + data }）；label = 页面名；pageHref = 页面第一个页签的网址（有 tab 时「页面」才是链接）；tab = 当前页签名；note = ⓘ 的 html；right = 右边的 html；actsId = 右边容器的 id（局部刷新用） */
export function finHead({ label, pageHref = "", tab = "", note = "", right = "", menu = [], actsId = "" }) {
  const root = `<a class="h-root" href="${esc(href("bills"))}">${t("财务")}</a>`;
  const page = tab && pageHref ? `<a class="h-root" href="${esc(pageHref)}">${esc(label)}</a>` : esc(label);
  return `<div class="section-head fin-head"><div class="sh-title">${treePop(finTree(state.route), { id: "fintree", actions: menu })}<h2>${root} / ${page}${tab ? ` / ${esc(tab)}` : ""}${note}</h2></div><div class="head-acts"${actsId ? ` id="${esc(actsId)}"` : ""}>${right}</div></div>`;
}
