/* 带页签的财务页（收入、花费、预算、借贷、对账单、资产 / 净资产）的页头：薄薄一层，真正的画法在 bills/fin-head.js（财务各页共用）。
 *  · 筛选按钮：filter 传 filterPop 画好的 html（面板里最后一行是「金额显示」）；不传 = 面板里只有「金额显示」；
 *    filter = false = 页面自己有筛选条（明细、流水），页头不放，眼睛并进那个筛选条（core/toolbar-eye.js）。
 *  · plain：路径只到页面名，不加页签名（资产 / 净资产这类，页签只是在几个页面之间切）。 */
import { t } from "./i18n.js";
import { filterPop } from "./filter-pop.js";
import { finHead } from "../bills/fin-head.js";

/** tabs：[id, 名称, 图标, 说明?, 次要?]；menu：页面自己的 ⋯ 菜单项（moreMenu 的格式）；note = 标题旁的 ⓘ */
export function pageHead({ title, tabs, tab, hrefOf, menu = [], note = "", plain = false, filter = "" }) {
  const cur = tabs.find(([id]) => id === tab);
  const right = filter === false ? "" : filter || filterPop("", { id: "pg", eye: true });
  return finHead({ label: title, pageHref: tabs.length ? hrefOf(tabs[0][0]) : "", tab: cur && !plain ? t(cur[1]) : "", note, right, menu });
}
