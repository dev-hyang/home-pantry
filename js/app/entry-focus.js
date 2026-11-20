/* 进入表单页后，把光标放到第一个要填的格子。
 * 页面是按需加载的：路由刚切过来时画的可能还是「加载中…」，表单还不存在；所以路由切换后调一次，页面加载完重画后再调一次（render.js 的 mountView）。 */
import { $ } from "../core/util.js";

/** 花费详情里某一块的「编辑」带 &sec=：光标放到那一块的第一个格子 */
const MAINT_SEC_FIELD = { basic: "kind", cost: "cost", notes: "notes" };   // 保养记录详情某一块的「编辑」
const SHOP_SEC_FIELD = { basic: "name", update: "refresh" };   // 商店详情某一块的「编辑」
const SPEND_SEC_FIELD = { basic: "name", pay: "store", kind: "nature" };

/** 收入详情的某一块的「编辑」带 &sec=：光标放到那一块的第一个格子（默认金额） */
const INC_SEC_FIELD = { basic: "amount", acct: "acct_sel", fx: "orig_amount", repay: "repay_required", notes: "notes" };

/** 缴费 / 保养表单：滚到表单、光标放在金额（缴费）或类型（保养）；新建账单 / 资产 / 物品放在名称上 */

export function focusEntry(route) {
  if (!route) return;
  if (route.section === "bills" && route.sub === "spend" && route.q?.get("sec")) $("#spendEditForm")?.elements[SPEND_SEC_FIELD[route.q.get("sec")]]?.focus({ preventScroll: true });
  if (route.section === "bills" && route.sub === "income" && route.q?.get("form")) $("#incForm")?.elements[INC_SEC_FIELD[route.q.get("sec")] || "amount"]?.focus({ preventScroll: true });
  if (route.section === "shops" && route.sub === "shop" && route.q?.get("edit") === "1") $("#shopEditForm")?.elements[SHOP_SEC_FIELD[route.q.get("sec")] || "name"]?.focus({ preventScroll: true });
  if (route.section === "item") $("#itemForm")?.elements.name?.focus({ preventScroll: true });
  if (route.section === "asset") {
    const mf = $("#maintForm[data-focus]");
    if (mf) { mf.scrollIntoView({ block: "start" }); mf.elements[MAINT_SEC_FIELD[route.q?.get("sec")] || "kind"]?.focus({ preventScroll: true }); }
    else if (route.id === "new") $("#assetForm")?.elements.name?.focus({ preventScroll: true });
  }
  if (route.section === "bill") {
    const pf = $("#billPayForm[data-focus]");
    if (pf) { pf.scrollIntoView({ block: "start" }); pf.elements.amount?.focus({ preventScroll: true }); }
    else if (route.id === "new") $("#billForm")?.elements.name?.focus({ preventScroll: true });
  }
}
