/* 编辑页的「取消 / 保存」置顶：长表单要滑到最底部才能保存 / 退出，手机上还被底部导航挡住。
 * 做法：每次整页重画后，在编辑页（底部导航已隐藏的页面、.form-page、收入编辑页）里找到主表单底部的按钮条，
 * 在页面顶部（面包屑下面）贴一条粘性的副本：取消靠左、保存靠右。保存是 form="表单 id" 的提交按钮，走表单原来的提交处理；
 * 底部原来的按钮条不动（页面里别的代码还在用它），所以这里不搬 DOM，只复制。 */
const isCancel = (el) => /^(取消|放弃|Cancel|Discard)$/i.test(el.textContent.trim()) || /cancel$/i.test(el.dataset?.action || "");
let seq = 0;

const hasCancel = (b) => [...b.querySelectorAll("button, a.btn")].some(isCancel);
/** on = 已知是编辑页（整页表单）：取第一条有提交按钮的按钮条；不是（on 为假）：也兜底给「新建 / 编辑」类的整页表单置顶——
 *  按钮条里同时有「取消 / 放弃」和提交按钮，且不在列表行、表格、折叠块、弹窗里（那是行内小表单，不置顶）。没有取消的表单（设置里的单个「保存」、筛选…）不动。 */
export function pinTopActions(root, on) {
  root.querySelectorAll(".top-actions").forEach((n) => n.remove());
  const bar = [...root.querySelectorAll("form .form-actions, form .sticky-actions")].find((b) => b.querySelector('button[type="submit"], button:not([type])') && !b.closest("[hidden], dialog, details:not([open])") && (on || (hasCancel(b) && !b.closest("li, td, tr, .tcarousel"))));
  if (!bar) return;
  const form = bar.closest("form"), submit = [...bar.querySelectorAll('button[type="submit"], button:not([type])')].find((b) => !isCancel(b));
  const cancel = [...bar.querySelectorAll("button, a.btn")].find((b) => b !== submit && isCancel(b));
  if (!form.id) form.id = `pinForm${++seq}`;
  const clone = (el) => { const c = el.cloneNode(true); c.removeAttribute("id"); c.classList.remove("swipe-src"); return c; };
  const s = clone(submit); s.setAttribute("form", form.id); s.classList.add("ta-save");
  const wrap = document.createElement("div"); wrap.className = "top-actions"; wrap.setAttribute("role", "toolbar"); wrap.setAttribute("aria-label", "保存 / 取消");
  if (cancel) { const c = clone(cancel); c.classList.add("ta-cancel"); wrap.append(c); }
  wrap.append(s);
  const host = form.closest(".section, main") || root, crumb = host.querySelector(":scope > nav.crumb");
  const tb = document.querySelector(".topbar"), stuck = (el) => el && getComputedStyle(el).position === "sticky";   // 顶栏、面包屑都是粘性的：置顶条贴在它们下面
  wrap.style.setProperty("--pin-top", `${(stuck(tb) ? tb.offsetHeight : 0) + (stuck(crumb) ? crumb.offsetHeight : 0)}px`);
  if (crumb) crumb.after(wrap); else host.prepend(wrap);
}
