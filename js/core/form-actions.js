/* 表单底部按钮条统一：取消靠左、保存靠右，同一行（手机、电脑都一样）。
 * 只处理「正好两个按钮：一个提交、一个取消」的按钮条（带别的按钮、提示的条不动）；取消 = 文字是「取消 / Cancel」，或 data-action 以 cancel 结尾。
 * 每次整页重画后调用（见 main.js render）。 */
const isCancel = (el) => /^(取消|Cancel)$/i.test(el.textContent.trim()) || /cancel$/i.test(el.dataset.action || "");
export function normalizeFormActions(root = document) {
  root.querySelectorAll("form .form-actions").forEach((bar) => {
    if (bar.dataset.fa) return;
    const btns = [...bar.children].filter((c) => c.classList.contains("btn"));
    if (btns.length !== 2) return;
    const submit = btns.find((b) => b.matches('button[type="submit"]')), cancel = btns.find((b) => b !== submit && isCancel(b));
    if (!submit || !cancel) return;
    bar.dataset.fa = "1"; bar.classList.add("form-actions-split");
    bar.prepend(cancel); bar.append(submit);   // 取消在最前、保存在最后；其余孩子（小字提示等）夹在中间
  });
}
