/* 明细页筛选条里的「金额显示」（眼睛并进筛选）：
 *  电脑：眼睛排在筛选条那一行最后；手机：shared/compact-filters.js 把下拉收进「筛选」面板后，这里再把眼睛也挪进面板（面板里带一行文字）。
 *  不改共享的 compact-filters.js（它在家庭学堂也有一份）：它先处理，这里的观察者后注册、后执行，只补这一步。 */
import { moneyEye } from "./privacy.js";
import { t } from "./i18n.js";

/** 放在 .toolbar 里的最后一项 */
export const toolbarEye = () => `<span class="tb-eye"><span class="tb-eye-t"><b>${t("金额显示")}</b><small>${t("默认遮挡；单击露 10 秒，双击或长按切到常显示")}</small></span>${moneyEye()}</span>`;

function merge() {
  document.querySelectorAll(".toolbar.tb-on > .tb-dates").forEach((box) => {   // 自选日期的两个日期框（花费明细）：进面板、排在下拉后面
    const panel = box.parentElement.querySelector(":scope > .tb-panel");
    if (panel) panel.appendChild(box);
  });
  document.querySelectorAll(".toolbar.tb-on > .tb-eye").forEach((eye) => {
    const panel = eye.parentElement.querySelector(":scope > .tb-panel");
    if (panel) panel.appendChild(eye);
  });
}
if (typeof document !== "undefined" && typeof MutationObserver !== "undefined") {
  const start = () => { const main = document.getElementById("main") || document.body; new MutationObserver(merge).observe(main, { childList: true, subtree: true }); merge(); };
  document.body ? start() : document.addEventListener("DOMContentLoaded", start);
}
