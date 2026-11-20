/* 视图切换（统一控件）：靠右的一个小按钮「视图 | 当前视图 ⋮」，点开列出几种视图，选中后收起，只显示当前的。
 * 取代各页自己做的一排并列按钮 / 标签（按模块 | 按优先级、列表 | 卡片 | 按商品、物品 | 分类…）。
 * 菜单、收起（点选项 / 点别处 / Esc）、竖三点样式沿用 .act-more（main.js 统一处理）。
 * options = [[值, 名称, 图标?], …]；action = 页面原来的 data-action；attr = 值放在哪个 data-xx（默认 data-v）。 */
import { esc } from "./util.js";
import { t } from "./i18n.js";

export function viewSwitch(options, current, { action, attr = "v", label = "视图" } = {}) {
  const list = options.filter(Boolean);
  if (list.length < 2) return "";
  const cur = list.find((o) => o[0] === current) || list[0], nm = (o) => `${o[2] ? `<span aria-hidden="true">${o[2]}</span> ` : ""}${esc(t(o[1]))}`;
  return `<details class="act-more view-sw v-dots"><summary class="btn btn-ghost btn-sm" aria-label="${esc(`${t(label)}：${t(cur[1])}`)}" title="${esc(t(label))}"><span class="vs-lbl">${esc(t(label))}</span><b class="vs-cur">${nm(cur)}</b><span class="dots3" aria-hidden="true"></span></summary>
    <div class="act-menu" role="menu" aria-label="${esc(t(label))}">${list.map((o) => `<button type="button" class="act-item" role="menuitemradio" aria-checked="${o[0] === cur[0]}" data-action="${esc(action)}" data-${attr}="${esc(o[0])}">${nm(o)}${o[0] === cur[0] ? ' <span aria-hidden="true">✓</span>' : ""}</button>`).join("")}</div></details>`;
}
