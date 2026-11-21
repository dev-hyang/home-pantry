/* 靠右的「筛选」按钮 + 点开的面板（收入、花费的时间条用，宽屏和手机都一样）：
 *  面板第一行：左边「筛选」字样，右边清除筛选（没改过时隐藏）；下面放原来的下拉、范围、开关。
 *  页面一改筛选就整页重画：打开状态记在这里，重画出来的面板保持打开（和 shared/compact-filters.js 的面板一个习惯）。 */
import { esc } from "./util.js";
import { t } from "./i18n.js";
import { moneyEye } from "./privacy.js";

let openId = "";   // 现在打开的面板（同一时间最多一个）
const OPEN_ATTR = " data-open";

/* 按钮上的小图标：两条横线，各带一个圆（滑块）；目录按钮是三条横线。颜色跟文字走（currentColor） */
const svg = (inner) => `<svg class="fpop-ico" viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false">${inner}</svg>`;
const ICON_FILTER = svg(`<path d="M2 6h16M2 14h16"/><circle cx="7" cy="6" r="2.2" fill="var(--surface)"/><circle cx="13" cy="14" r="2.2" fill="var(--surface)"/>`);
const ICON_MENU = svg(`<path d="M3 5h14M3 10h14M3 15h14"/>`);

/** 目录按钮 + 导航面板（和筛选同一个外观、同一套开关）：items = [{ href, icon, label, current }]；点一项就跳转，面板随页面重画收起 */
export function navPop(items, { id = "nav", label = t("目录") } = {}) {
  const open = openId === id;
  const row = (x) => `<a class="npop-item" href="${esc(x.href)}"${x.current ? ' aria-current="page"' : ""}><span class="npop-ico" aria-hidden="true">${x.icon || ""}</span><span class="npop-lbl">${esc(x.label)}</span>${x.current ? '<span class="npop-ck" aria-hidden="true">✓</span>' : ""}</a>`;
  return `<div class="fpop npop" data-fpop="${esc(id)}"${open ? OPEN_ATTR : ""}>
    <button type="button" class="fpop-btn" aria-expanded="${open}" aria-controls="fpop-${esc(id)}" aria-label="${esc(label)}" data-fpop-toggle>${ICON_MENU}<span>${esc(label)}</span></button>
    <div class="fpop-panel" id="fpop-${esc(id)}"${open ? "" : " hidden"}>
      <div class="fpop-head"><b>${esc(label)}</b></div>
      <nav class="npop-list" aria-label="${esc(label)}">${items.map(row).join("")}</nav>
    </div></div>`;
}

/** 面板里的「金额显示」一行：就是页头原来那只眼睛（单击露 10 秒 / 马上遮；双击或长按切换常显示，规则在 privacy.js，按钮带 data-moneyeye 就生效） */
export const eyeRow = () => `<div class="fpop-eye"><span class="fpop-eye-t"><b>${t("金额显示")}</b><small>${t("默认遮挡；单击露 10 秒，双击或长按切到常显示")}</small></span>${moneyEye()}</div>`;

/** inner = 面板里的控件；clear = 清除按钮 html；count = 已改动的筛选个数；eye = 面板里带「金额显示」（眼睛并进筛选，页头不再单放一只） */
export function filterPop(inner, { id = "fp", count = 0, clear = "", cls = "", eye = false } = {}) {
  const open = openId === id;
  return `<div class="fpop ${cls}" data-fpop="${esc(id)}"${open ? OPEN_ATTR : ""}>
    <button type="button" class="fpop-btn" aria-expanded="${open}" aria-controls="fpop-${esc(id)}" aria-label="${esc(t("筛选"))}" data-fpop-toggle>${ICON_FILTER}<span>${t("筛选")}</span><span class="tb-count"${count ? "" : " hidden"}>${count}</span></button>
    <div class="fpop-panel" id="fpop-${esc(id)}"${open ? "" : " hidden"}>
      <div class="fpop-head"><b>${t("筛选")}</b>${clear}</div>
      <div class="fpop-body">${inner}${eye ? eyeRow() : ""}</div>
    </div></div>`;
}

const close = (box) => { box.removeAttribute("data-open"); box.querySelector(".fpop-panel").hidden = true; box.querySelector("[data-fpop-toggle]").setAttribute("aria-expanded", "false"); };
document.addEventListener("click", (e) => {
  const btn = e.target.closest?.("[data-fpop-toggle]");
  const box = btn?.closest("[data-fpop]");
  const inId = e.target.closest?.("[data-fpop]")?.dataset.fpop;   // 点的控件让页面重画了：旧节点已脱离页面，按面板 id 认
  document.querySelectorAll("[data-fpop][data-open]").forEach((b) => { if (b.dataset.fpop !== inId) { close(b); openId = ""; } });
  if (!box) return;
  const on = !box.hasAttribute("data-open");
  if (on) { box.setAttribute("data-open", ""); box.querySelector(".fpop-panel").hidden = false; btn.setAttribute("aria-expanded", "true"); openId = box.dataset.fpop; } else { close(box); openId = ""; }
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  const b = document.querySelector("[data-fpop][data-open]"); if (!b) return;
  close(b); openId = ""; b.querySelector("[data-fpop-toggle]").focus();
});
window.addEventListener("hashchange", () => { openId = ""; });   // 换了页面：面板不带着打开
