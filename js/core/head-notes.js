/* 页面各块标题下面的说明文字 → 标题后面的 ⓘ（悬停 / 点一下看）。
 * 画完页面后统一处理：.section-head 里直接挂的那句 <p>，只有「像说明」的才收（够长、有标点、没有链接、没有数字——
 * 带数字、链接的是会变的统计 / 状态，如「3 张在用」「共 5 项」；错误提示和名字副标题也留着）。页面想留着的加 data-keep。 */
import { infoTip } from "./info-tip.js";

const LOOKS_LIKE_NOTE = (s) => s.length >= 12 && /[，；。：、,;:]/.test(s) || s.length >= 20;

export function foldHeadNotes(root = document.getElementById("main")) {
  if (!root) return;
  root.querySelectorAll(".section-head > p").forEach((p) => {
    const head = p.parentElement, h2 = head.querySelector(":scope > h2, :scope > .sh-title > h2");
    const text = p.textContent.trim();
    if (!h2 || p.hasAttribute("data-keep") || p.querySelector("a, button, input") || p.classList.contains("form-error") || /\d/.test(text) || !LOOKS_LIKE_NOTE(text)) return;
    let box = h2.parentElement;
    if (!box.classList.contains("sh-title")) { box = document.createElement("div"); box.className = "sh-title"; h2.replaceWith(box); box.appendChild(h2); }
    box.insertAdjacentHTML("beforeend", infoTip(text, { align: "start" }));
    p.remove();
  });
}
