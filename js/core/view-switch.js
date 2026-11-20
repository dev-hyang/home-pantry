/* 视图切换（统一控件）：靠右的深色圆角按钮「切换图标 当前视图名」（只显示名称，不带各视图自己的图标），点开列出几种视图，选中后收起，只显示当前的。
 * 取代各页自己做的一排并列按钮 / 标签（按模块 | 按优先级、列表 | 卡片 | 按商品、物品 | 分类…）。
 * 菜单、收起（点选项 / 点别处 / Esc）、竖三点样式沿用 .act-more（main.js 统一处理）。
 * options = [[值, 名称, 图标?], …]；action = 页面原来的 data-action；attr = 值放在哪个 data-xx（默认 data-v）。 */
import { esc } from "./util.js";
import { t } from "./i18n.js";

/** 统一的「切换」图标（2×2 方块）：不随视图变，只提示「这里可以切换」 */
const SW_ICON = '<svg class="vs-ic" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.4"/><rect x="9" y="1.5" width="5.5" height="5.5" rx="1.4"/><rect x="1.5" y="9" width="5.5" height="5.5" rx="1.4"/><rect x="9" y="9" width="5.5" height="5.5" rx="1.4"/></svg>';
export function viewSwitch(options, current, { action, attr = "v", label = "视图" } = {}) {
  const list = options.filter(Boolean);
  if (list.length < 2) return "";
  const cur = list.find((o) => o[0] === current) || list[0];
  return `<details class="act-more view-sw"><summary aria-label="${esc(`${t(label)}：${t(cur[1])}`)}" title="${esc(t(label))}">${SW_ICON}<span class="vs-cur">${esc(t(cur[1]))}</span></summary>
    <div class="act-menu" role="menu" aria-label="${esc(t(label))}">${list.map((o) => `<button type="button" class="act-item vs-item" role="menuitemradio" aria-checked="${o[0] === cur[0]}" data-action="${esc(action)}" data-${attr}="${esc(o[0])}"><span>${esc(t(o[1]))}</span>${o[0] === cur[0] ? '<span class="vs-ok" aria-hidden="true">✓</span>' : ""}</button>`).join("")}</div></details>`;
}
