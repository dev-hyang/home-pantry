/* 编辑页的「取消 / 保存」置顶：长表单要滑到最底部才能保存 / 退出，手机上还被底部导航挡住。
 * 做法：每次整页重画后，在编辑页（底部导航已隐藏的页面、.form-page、收入编辑页）里找到主表单底部的按钮条，
 * 在页面顶部（面包屑下面）贴一条粘性的副本：取消靠左、保存靠右。保存是 form="表单 id" 的提交按钮，走表单原来的提交处理；
 * 底部原来的按钮条不动（页面里别的代码还在用它），所以这里不搬 DOM，只复制。 */
const isCancel = (el) => /^(取消|Cancel)$/i.test(el.textContent.trim()) || /cancel$/i.test(el.dataset?.action || "");
let seq = 0;

export function pinTopActions(root, on) {
  root.querySelectorAll(".top-actions").forEach((n) => n.remove());
  if (!on) return;
  const bar = [...root.querySelectorAll("form .form-actions, form .sticky-actions")].find((b) => b.querySelector('button[type="submit"]') && !b.closest("[hidden], dialog, details:not([open])"));
  if (!bar) return;
  const form = bar.closest("form"), submit = bar.querySelector('button[type="submit"]');
  const cancel = [...bar.querySelectorAll("button, a.btn")].find((b) => b !== submit && isCancel(b));
  if (!form.id) form.id = `pinForm${++seq}`;
  const clone = (el) => { const c = el.cloneNode(true); c.removeAttribute("id"); c.classList.remove("swipe-src"); return c; };
  const s = clone(submit); s.setAttribute("form", form.id); s.classList.add("ta-save");
  const wrap = document.createElement("div"); wrap.className = "top-actions"; wrap.setAttribute("role", "toolbar"); wrap.setAttribute("aria-label", "保存 / 取消");
  if (cancel) { const c = clone(cancel); c.classList.add("ta-cancel"); wrap.append(c); }
  wrap.append(s);
  const tb = document.querySelector(".topbar"), stuck = tb && getComputedStyle(tb).position === "sticky";
  wrap.style.setProperty("--pin-top", `${stuck ? tb.offsetHeight : 0}px`);
  const host = form.closest(".section, main") || root, crumb = host.querySelector(":scope > nav.crumb");
  if (crumb) crumb.after(wrap); else host.prepend(wrap);
}
