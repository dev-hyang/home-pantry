/* 带页签的财务页（花费、预算、借贷、对账单、资产 / 净资产）统一的页头，和收入页同一个样子（js/income/views.js）：
 *  [目录] 标题 / 当前页签 ⓘ …… [筛选]（⋯ 只留页面自己的操作，比如打印）
 *  · 目录按钮：所有页签（含次要页签）；点标题里的「标题」回第一个页签。
 *  · 筛选按钮：面板里放页面的筛选（filter 传 filterPop 画好的 html），最后一行是「金额显示」（原来页头的眼睛）。
 *    不传 filter = 面板里只有「金额显示」；filter = false = 页面自己有筛选条（明细、流水），页头不放，眼睛并进那个筛选条（core/toolbar-eye.js）。
 *  切换页签只换下面的内容；note = 标题旁的 ⓘ（原来的说明文字）。 */
import { esc } from "./util.js";
import { t } from "./i18n.js";
import { moreMenu } from "./more-menu.js";
import { filterPop, navPop } from "./filter-pop.js";

/** tabs：[id, 名称, 图标, 说明?, 次要?]；menu：页面自己的 ⋯ 菜单项（moreMenu 的格式）；plain：标题就是页面名，不加「/ 页签名」（资产 / 净资产这类，目录只是在几个页面之间切） */
export function pageHead({ icon = "", title, tabs, tab, hrefOf, label, menu = [], note = "", plain = false, filter = "" }) {
  const cur = tabs.find(([id]) => id === tab);
  const nav = navPop(tabs.map(([id, name, ic]) => ({ href: hrefOf(id), icon: ic, label: t(name), current: id === tab })), { id: "pgnav", label: t("目录") });
  const root = `${icon ? `${icon} ` : ""}${plain || !tabs.length ? esc(title) : `<a class="h-root" href="${esc(hrefOf(tabs[0][0]))}">${esc(title)}</a>`}`;
  const items = [...menu]; if (items.length) items[0].first = true;
  const right = filter === false ? "" : filter || filterPop("", { id: "pg", eye: true });
  return `<div class="section-head"><div class="sh-title">${nav}<h2>${root}${cur && !plain ? ` / ${esc(t(cur[1]))}` : ""}</h2>${note}</div><div class="head-acts">${right}${moreMenu(items, { label: t("更多操作") })}</div></div>`;
}
