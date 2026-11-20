/* 带页签的财务页（收入以外：花费、预算、借贷、对账单）统一的页头：
 *  「标题 · 当前页签名」+ 紧跟的眼睛 + 右上角 ⋯（页面自己的操作 + 次要页签），下面是导航小卡片（主要页签，和储藏页同一个样子）。
 *  切换页签只换下面的内容；note = 标题旁的 ⓘ（原来的说明文字）。 */
import { esc } from "./util.js";
import { t } from "./i18n.js";
import { moneyEye } from "./privacy.js";
import { moreMenu } from "./more-menu.js";
import { tabCards } from "./hub.js";

/** tabs：[id, 名称, 图标, 说明?, 次要?]；menu：页面自己的 ⋯ 菜单项（moreMenu 的格式）；次要页签自动排在它们后面 */
export function pageHead({ icon = "", title, tabs, tab, hrefOf, label, menu = [], note = "" }) {
  const cur = tabs.find(([id]) => id === tab), more = tabs.filter((x) => x[4]);
  const items = [...menu, ...more.map(([id, name, ic]) => ({ label: `${ic} ${t(name)}`, href: hrefOf(id) }))];
  if (items.length) items[0].first = true;
  return `<div class="section-head"><div class="sh-title"><h2>${icon ? `${icon} ` : ""}${esc(title)}${cur ? ` · ${esc(t(cur[1]))}` : ""}</h2>${note}${moneyEye()}</div><div class="head-acts">${moreMenu(items, { label: t("更多操作") })}</div></div>
  ${tabCards(tabs, tab, hrefOf, label)}`;
}
