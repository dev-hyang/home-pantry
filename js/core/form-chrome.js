/* 局部重画（不走整页 render）之后，把表单页的「外壳」补回来：底部「取消 / 确认」条的顺序和大小、贴底、底部导航的隐藏。
 * 整页 render 末尾会做这几件事（app/render.js）；只用 outerHTML 换掉一块的页面（比如录入购物）调这个，免得重画后按钮条被「改坏」。 */
import { normalizeFormActions } from "./form-actions.js";

export function refreshFormChrome(root = document.getElementById("main"), on = false) {
  if (!root) return;
  normalizeFormActions(root, on);
  document.body.classList.toggle("editing", !!document.querySelector("#main .sticky-actions"));
}
