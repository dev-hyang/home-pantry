/* 缴费记录行的统一版式（账单缴费记录 / 一次性账单缴费 / 摊派缴费共用）。没有 ⋯：电脑右键、手机长按弹同一份菜单（core/long-press.js）。
 *   第一行：日期 + 状态角标（已缴费 / 已核对 …）                       金额（靠右）
 *   第二行：来源信息（到期日、付款账户、确认号…）用「·」隔开，整条为单位换行
 *   第三行：金额明细（单元费 / 车位费 / 摊派 / 手续费 / 税 / 滞纳金）单独成组，金额不会被别的信息隔开
 *   第四行：备注（长文字，自己占一行）
 * 每组只在整条信息之间换行；某一组是空的就不画，一般的记录只有一两行。 */
import { dots } from "../core/dots.js";
import { esc } from "../core/util.js";
import { lpAttr } from "../core/long-press.js";

/** groups = { meta: [html…], amounts: [html…], note: html }；items 已经转义。返回 <a class="grow pay-hit"> 里面的内容 */
export function payBody({ date, badge = "", meta = [], amounts = [], note = "" }) {
  const m = dots(meta), a = dots(amounts);
  return `<span class="pr-head"><b>${esc(date)}</b>${badge}</span>${m ? `<small class="dots">${m}</small>` : ""}${a ? `<small class="dots">${a}</small>` : ""}${note ? `<small class="pr-note">${note}</small>` : ""}`;
}

/** 一整行 <li>：edit = 点一下去的链接（没有就不能点）；total = 靠右的金额 html；del = { action, id }（左滑删除的隐藏按钮）；swipe = data-swipe-del 的类型 */
export function payRowHtml({ edit, hitTitle, body, total = "", items = [], lpTitle = "", swipe = "", del = null, delLabel = "", cls = "", pick = "" }) {
  // pick = 多选删除中这一行的勾选框 html（core/bulk-select.js）：整行点一下 = 勾选，没有长按菜单 / 左滑 / 跳转
  if (pick) return `<li class="pay-row ${cls} is-pick" data-row-chk>${pick}<div class="grow pay-hit">${body}</div>${total}</li>`;
  const hit = edit ? `<a class="grow pay-hit" href="${esc(edit)}" title="${esc(hitTitle || "")}">${body}</a>` : `<div class="grow pay-hit">${body}</div>`;
  return `<li class="pay-row ${cls}" ${swipe ? `data-swipe-del="${swipe}"` : ""} ${lpAttr(items, lpTitle)}>${hit}${total}${del ? `<button type="button" class="ui-btn swipe-src" data-size="sm" data-tone="ghost" data-action="${del.action}" data-id="${esc(del.id)}" aria-label="${esc(delLabel)}">${esc(del.label)}</button>` : ""}</li>`;
}
