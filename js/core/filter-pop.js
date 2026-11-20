/* 靠右的「筛选」按钮 + 点开的面板（收入、花费的时间条用，宽屏和手机都一样）：
 *  面板第一行：左边「筛选」字样，右边清除筛选（没改过时隐藏）；下面放原来的下拉、范围、开关。
 *  页面一改筛选就整页重画：打开状态记在这里，重画出来的面板保持打开（和 shared/compact-filters.js 的面板一个习惯）。 */
import { esc } from "./util.js";
import { t } from "./i18n.js";

let openId = "";   // 现在打开的面板（同一时间最多一个）
const OPEN_ATTR = " data-open";

/** inner = 面板里的控件；clear = 清除按钮 html；count = 已改动的筛选个数 */
export function filterPop(inner, { id = "fp", count = 0, clear = "", cls = "" } = {}) {
  const open = openId === id;
  return `<div class="fpop ${cls}" data-fpop="${esc(id)}"${open ? OPEN_ATTR : ""}>
    <button type="button" class="fpop-btn" aria-expanded="${open}" aria-controls="fpop-${esc(id)}" data-fpop-toggle>${t("筛选")}<span class="tb-count"${count ? "" : " hidden"}>${count}</span></button>
    <div class="fpop-panel" id="fpop-${esc(id)}"${open ? "" : " hidden"}>
      <div class="fpop-head"><b>${t("筛选")}</b>${clear}</div>
      <div class="fpop-body">${inner}</div>
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
