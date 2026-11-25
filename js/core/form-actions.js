/* 表单底部按钮条统一（每次整页重画后调用，见 app/render.js）：
 *  1. 顺序：取消靠左、上一步 / 下一步 / 跳过 等居中、保存 / 确认 / 添加靠右，同一行；
 *  2. 大小：每个按钮等宽平分一行，按钮越多字越小（data-n 记按钮数，CSS 按它调字号和内边距，和面包屑一样自动缩）；
 *  3. 编辑 / 新建的整页表单：主按钮条贴底（sticky-actions），页面上不再另放一份顶部的取消 / 保存。
 * 只处理表单里的按钮条；行内小表单（列表行、表格、折叠块、弹窗里）只统一顺序和大小，不贴底。 */
import { isCancelBtn } from "../../shared/ui-acts.js";
const isCancel = isCancelBtn;   // 「取消」类按钮的判断和排序规则在共用的 shared/ui-acts.js（姊妹站用同一份）
const isStep = (el) => ["prev", "next"].includes(el.dataset?.wz) || /^[‹›]?\s*(上一步|下一步|跳过|Back|Next|Skip)$/i.test(el.textContent.trim());
const isSubmit = (el) => el.matches('button[type="submit"], button:not([type]), button[data-tone="primary"][data-action]') && !isCancel(el);
const SUBMIT_SEL = 'button[type="submit"], button:not([type]), button[data-tone="primary"][data-action]';

/** 一条按钮条：取消放最前、保存 / 确认放最后、其余（上一步 / 下一步 / 删除…）夹在中间 */
function arrange(bar) {
  const btns = [...bar.children].filter((c) => c.classList.contains("ui-btn"));
  if (btns.length < 2 || bar.classList.contains("wiz-exit")) return;
  const cancel = btns.find(isCancel), rights = btns.filter((b) => b !== cancel && !isStep(b) && (isSubmit(b) || b.hasAttribute("data-wz-save")));
  if (cancel) bar.prepend(cancel);
  rights.forEach((b) => bar.append(b));
  bar.classList.add("ui-acts-split");
  // 记按钮数（向导里隐藏着的「保存」只在最后一步出现，不算，免得每一步字号不一样）
  bar.dataset.n = String(btns.filter((b) => !b.hasAttribute("data-wz-save")).length);
}

export function normalizeFormActions(root = document, on = false) {
  root.querySelectorAll("form .ui-acts").forEach((bar) => { if (bar.dataset.fa !== "1") { bar.dataset.fa = "1"; arrange(bar); } });
  stickMainBar(root, on);
}

const hasCancel = (b) => [...b.querySelectorAll("button, a.ui-btn")].some(isCancel);
/** 整页表单（on = 已知是编辑页；否则按钮条里同时有取消和提交、且不在行内的才算）的主按钮条贴底 */
function stickMainBar(root, on) {
  const bars = [...root.querySelectorAll("form .ui-acts, form .sticky-actions")];
  if (bars.some((b) => b.classList.contains("sticky-actions") && !b.closest("li, td, tr, .tcarousel, details, dialog"))) return;   // 页面自己已经有贴底条
  const bar = bars.find((b) => b.querySelector(SUBMIT_SEL) && !b.closest("[hidden], dialog, details:not([open])") && (on || (hasCancel(b) && !b.closest("li, td, tr, .tcarousel"))));
  if (bar) bar.classList.add("sticky-actions");
}
