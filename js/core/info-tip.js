/* 小「i」提示：把说明文字收进一个小圆标，电脑悬停 / 键盘聚焦、手机点一下显示（样式 shared/ui.css 的 .ui-hint）。
 * 用法：infoTip("说明文字", { align: "end" })；靠右边的用 align:"end"，靠左边的用 "start"，居中不传。
 * 多条说明传数组，会换行显示。 */
import { esc } from "./util.js";

export function infoTip(text, { align = "", pos = "" } = {}) {
  const s = Array.isArray(text) ? text.filter(Boolean).join("\n") : String(text || "");
  if (!s) return "";
  return `<button type="button" class="ui-hint" data-tip="${esc(s)}" aria-label="${esc(s)}"${align ? ` data-tip-align="${align}"` : ""}${pos ? ` data-tip-pos="${pos}"` : ""}>i</button>`;
}

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
