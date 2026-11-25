/* 统一的页头两行（财务各页、采购各页共用）：
 *  ① 路径行：目录按钮 + 完整路径（每一层，包括当前页；当前页是粗体、不能点，不放 ⓘ）；滚动时固定在顶栏下面（高约 45px）。
 *  ② 标题行：当前页的名字（和路径最后一层同名）+ 名字右上角的 ⓘ；筛选 / 本页操作靠右。
 * trail = [{ href?, label }]，最后一项是当前页；没有 href 的非最后一项当普通文字。样式在 styles.css 的「统一面包屑控件」。 */
import { esc } from "./util.js";
import { t } from "./i18n.js";
import { toSupTip } from "./info-tip.js";

/** treeHtml = treePop(...) 画好的目录按钮；after = 标题后面紧跟的 html（如「N 项」）；note = ⓘ 的 html */
export function pathHead({ treeHtml, trail, title, after = "", note = "", right = "", actsId = "" }) {
  const last = trail.length - 1;
  const crumbs = trail.map((c, i) => (i === last ? `<b aria-current="page">${esc(c.label)}</b>` : c.href ? `<a class="h-root" href="${esc(c.href)}">${esc(c.label)}</a>` : esc(c.label))).join(' <span class="sep">/</span> ');
  return `<div class="fin-head"><div class="fin-path">${treeHtml}<nav class="fin-crumb" aria-label="${esc(t("当前位置"))}">${crumbs}</nav></div>
    <div class="section-head fin-titlebar"><div class="sh-title"><h2 class="fin-title">${esc(title)}${toSupTip(note)}${after}</h2></div><div class="head-acts"${actsId ? ` id="${esc(actsId)}"` : ""}>${right}</div></div></div>`;
}
