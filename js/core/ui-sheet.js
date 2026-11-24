/* ============ 底部弹窗的标记（长按菜单、选绑定的人共用） ============
   sheetHtml({ title, label, list, closeAttr, cancelText }) → 遮罩 + 底部面板 + 选项清单 + 占整行的取消按钮。
   · title：面板顶上的标题 HTML（调用方自己转义；不要标题就留空）；label：读屏用的名字（纯文字）
   · list：选项清单的 HTML（里面的选项用 class="ui-opt fam-sheet-row"）
   · closeAttr：遮罩和取消按钮都带上的属性，例如 data-lp-close 或 data-action="xx-cancel"，由调用方的点击处理去关
   样式在 styles.css 的 .fam-sheet*；圆角、遮罩、阴影用 :root 里的 --sheet-* 变量，和 ask-dlg（手机上也是底部弹出）一致。
   迁到 Vue / Svelte：这五个参数就是组件的 props / slot。 */
// 自带转义：不引 util.js（它会连带加载 i18n，纯函数测试里没有 window）
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const sheetHtml = ({ title = "", label = "", list = "", closeAttr = "data-sheet-close", cancelText = "" }) =>
  `<div class="fam-sheet-back" ${closeAttr}></div><div class="fam-sheet" role="dialog" aria-modal="true" aria-label="${esc(label)}">${title ? `<h3>${title}</h3>` : ""}<div class="fam-sheet-list">${list}</div><button type="button" class="btn btn-ghost fam-sheet-cancel" ${closeAttr}>${esc(cancelText)}</button></div>`;

/* ── 底部弹窗的键盘与焦点（所有 .fam-sheet 自动生效，调用方不用接线） ──
   · 出现时：焦点移进面板（读屏会读出 aria-label），记下原来的焦点；消失后焦点回到原处（原处还在页面上的话）
   · Tab / Shift+Tab 只在面板里转圈，不会跑到背后的页面
   · Esc：点一下面板里的「取消」（遮罩 / 取消按钮带的 closeAttr 由调用方处理）；长按菜单自己处理 Esc，这里不重复 */
/** Tab 在 list 里转圈：返回下一个该聚焦的元素；焦点不在 list 里就从头（Shift 从尾）开始 */
export function cycleFocus(list, current, shift) {
  if (!list.length) return null;
  const i = list.indexOf(current);
  if (i < 0) return shift ? list[list.length - 1] : list[0];
  return list[(i + (shift ? -1 : 1) + list.length) % list.length];
}

const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
if (typeof document !== "undefined") {
  let opener = null;
  const sheetIn = (n) => (n.nodeType === 1 ? (n.matches?.(".fam-sheet") ? n : n.querySelector?.(".fam-sheet")) : null);
  new MutationObserver((muts) => {
    for (const m of muts) {
      for (const n of m.addedNodes) {
        const sh = sheetIn(n);
        if (!sh) continue;
        if (!opener && document.activeElement !== document.body) opener = document.activeElement;
        sh.tabIndex = -1;
        if (!sh.contains(document.activeElement)) sh.focus({ preventScroll: true });
      }
      if (opener && [...m.removedNodes].some(sheetIn) && !document.querySelector(".fam-sheet")) {
        if (opener.isConnected) opener.focus({ preventScroll: true });
        opener = null;
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener("keydown", (e) => {
    const sh = document.querySelector(".fam-sheet");
    if (!sh) return;
    if (e.key === "Escape" && !sh.closest(".lp-sheet")) { e.preventDefault(); sh.querySelector(".fam-sheet-cancel")?.click(); return; }
    if (e.key !== "Tab") return;
    const next = cycleFocus([...sh.querySelectorAll(FOCUSABLE)], document.activeElement, e.shiftKey);
    if (next) { e.preventDefault(); next.focus(); }
  }, true);
}
