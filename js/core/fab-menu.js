/* 右下角圆形「＋」+ 点开的菜单（样式沿用账单页的 .bill-fab）：items = [{ label, icon?, desc?, href | data: { xx: "…" } }]（href = 链接；data = 按钮，带 data-xx 属性）（假值忽略）。
 * 只有一项时直接是一个圆形 ＋ 链接，不弹菜单。 */
import { esc } from "./util.js";
import { t } from "./i18n.js";

const one = (x) => {
  const inner = `${x.icon ? `${x.icon} ` : ""}${esc(x.label)}${x.desc ? `<small>${esc(x.desc)}</small>` : ""}`;
  if (x.href) return `<a role="menuitem" href="${esc(x.href)}">${inner}</a>`;
  return `<button type="button" role="menuitem"${Object.entries(x.data || {}).map(([k, v]) => ` data-${k}="${esc(v)}"`).join("")}>${inner}</button>`;   // 按钮项：页面自己的 data-xx 点击处理
};
document.addEventListener("click", (e) => { const b = e.target.closest?.(".bill-fab-menu button"); if (b) b.closest("details").open = false; });   // 点了菜单里的按钮就收起

export function fabMenu(items, { label = t("添加") } = {}) {
  const list = (items || []).filter(Boolean);
  if (!list.length) return "";
  if (list.length === 1 && list[0].href) return `<a class="fab" href="${esc(list[0].href)}" aria-label="${esc(label)}" title="${esc(label)}">＋</a>`;
  return `<details class="bill-fab"><summary aria-label="${esc(label)}" title="${esc(label)}"><span aria-hidden="true">＋</span></summary>
    <div class="bill-fab-menu" role="menu">${list.map(one).join("")}</div></details>`;
}
