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
