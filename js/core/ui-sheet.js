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
