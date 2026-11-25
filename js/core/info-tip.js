/* 小「i」提示：把说明文字收进一个小圆标，电脑悬停 / 键盘聚焦、手机点一下显示（样式 shared/ui.css 的 .ui-hint）。
 * 用法：infoTip("说明文字", { align, pos, mode, size })
 *   mode  "sup"（默认）= 缩在文字右上角的小角标，不占行、不占列，跟在它说明的那段文字后面；
 *         "inline" = 独立占位的圆形按钮（跟在整行末尾、单独一列时用）；
 *         "classic" = 不带 data-mode（旧页面原有的样式，由各页自己的 CSS 管；老调用点用 infoTip.classic）。
 *   size  "sm" | "md"（默认）| "lg"：按旁边文字大小选——小 ≈ 13px 以下的小字，中 ≈ 14–16px 正文，大 ≈ 标题（18px 以上）。
 *   align 浮层对齐：靠右边用 "end"，靠左边用 "start"，居中不传；pos "bottom" = 在下方显示。
 * 没有特殊说明时一律用默认（右上角角标）。多条说明传数组，会换行显示。 */
import { esc } from "./util.js";

export function infoTip(text, { align = "", pos = "", mode = "sup", size = "md" } = {}) {
  const s = Array.isArray(text) ? text.filter(Boolean).join("\n") : String(text || "");
  if (!s) return "";
  const m = mode === "classic" ? "" : ` data-mode="${mode === "inline" ? "inline" : "sup"}" data-size="${["sm", "lg"].includes(size) ? size : "md"}"`;
  return `<button type="button" class="ui-hint" data-tip="${esc(s)}" aria-label="${esc(s)}"${m}${align ? ` data-tip-align="${align}"` : ""}${pos ? ` data-tip-pos="${pos}"` : ""}>i</button>`;
}
infoTip.classic = (text, o = {}) => infoTip(text, { ...o, mode: "classic" });
/** 把已经画好的 ⓘ（旧的 classic 样式）改成标题右上角的小角标（sup，大号）；已经带 data-mode 的不动。页头标题统一用它 */
export const toSupTip = (html) => String(html || "").replace(/<button type="button" class="ui-hint"(?![^>]*data-mode)/g, '<button type="button" class="ui-hint" data-mode="sup" data-size="lg"');

/* Safari / 部分手机点按钮不会聚焦，:focus 就不触发；点一下手动聚焦，点别处自然失焦收起 */
if (!window.__infoTipBound) {
  window.__infoTipBound = true;
  document.addEventListener("click", (e) => { const h = e.target.closest?.(".ui-hint"); if (h) { e.preventDefault(); e.stopPropagation(); h.focus(); } }, true);
}

/* 提示浮层不被屏幕左右边切掉：显示前量一下浮层宽度，按它的对齐方式算出要平移多少（--tip-dx，样式在 styles.css 的 .ui-hint::after） */
function fitTip(h) {
  h.style.removeProperty("--tip-dx");
  const w = parseFloat(getComputedStyle(h, "::after").width); if (!w) return;
  const r = h.getBoundingClientRect(), al = h.dataset.tipAlign, vw = document.documentElement.clientWidth, m = 8;
  const x0 = al === "start" ? r.left : al === "end" ? r.right - w : r.left + r.width / 2 - w / 2;
  const dx = Math.max(m - x0, Math.min(0, vw - m - (x0 + w)));
  if (dx) h.style.setProperty("--tip-dx", `${Math.round(dx)}px`);
}
for (const ev of ["mouseover", "focusin"]) document.addEventListener(ev, (e) => { const h = e.target.closest?.(".ui-hint[data-tip]"); if (h) fitTip(h); });
