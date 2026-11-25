/* 花费记录详情页（#/bills/spend?view=<花费 id>）：只读，按块显示，每块右上角有自己的「编辑」（去编辑页并把光标放到那一块的第一个格子）。
 * 入口：花费明细行的长按 / 右键菜单 →「详情」。账单缴费记的花费，「编辑」去那条缴费记录的编辑页（改那里，花费会同步）。 */
import { esc, fmtDay, num, showQty } from "../core/util.js";
import { state } from "../core/state.js";
import { href } from "../core/router.js";
import { t } from "../core/i18n.js";
import { recCrumb } from "../core/rec-crumb.js";
import { moreMenu } from "../core/more-menu.js";
import { dtBlock, dtRow } from "../core/detail-ui.js";
import { defaultNature, isTransfer, leafLabel, natureName } from "../core/taxonomy.js";
import { memberName } from "../core/logic.js";
import { paymentPayLabel } from "../bills/card-picker.js";
import { storeOf } from "./store-lite.js";
import { findRow, spendRecordsHref } from "./spend-form-page.js";

const row = dtRow, block = dtBlock;

/** 路由参数：?view=<id> → { id }，否则 null */
export const spendViewParams = (q) => (q?.get("view") ? { id: q.get("view") } : null);

export function spendDetailPage({ id }) {
  const crumb = (label) => recCrumb("spend", spendRecordsHref(), label);
  const p = findRow(id);
  if (p === undefined) return `<section class="section">${crumb(t("详情"))}<div class="panel empty"><strong>${t("加载中…")}</strong></div></section>`;
  if (!p) return `<section class="section">${crumb(t("详情"))}<div class="panel empty"><strong>${t("找不到这笔记录")}</strong><p><a class="ui-btn" data-size="sm" href="${spendRecordsHref()}">${t("回到花费记录")}</a></p></div></section>`;
  const base = `${href("bills", "spend")}?form=${encodeURIComponent(p.id)}`, bill = p.pay_id ? state.bills.find((b) => b.id === p.pay_bill_id) : null;
  const edit = (sec) => (p.virtual ? "" : bill ? `${href("bill", bill.id)}?sec=pay&edit=${encodeURIComponent(p.pay_id)}` : `${base}&sec=${sec}`);
  const xfer = p.is_xfer ?? isTransfer(p.category, p.nature), nat = p.nature || defaultNature(p.category);
  const prop = p.property_id ? state.properties.find((x) => x.id === p.property_id)?.name : "";
  const amount = p.amount != null ? esc(Units.money(num(p.amount), p.currency || Units.region.currency)) : `<span class="muted">${t("未填金额")}</span>`;
  const basic = block(t("基本信息"), edit("basic"), [row(t("名称"), esc(p.name)), row(t("日期"), esc(fmtDay(p.purchased_at))), row(t("金额"), `${num(p.amount) < 0 ? `<span class="badge b-ok">${t("退款")}</span> ` : ""}${amount}`), row(t("分类"), esc(leafLabel(p.category))), p.quantity ? row(t("数量"), esc(showQty(p.quantity, p.unit || ""))) : ""].filter(Boolean));
  const pay = block(t("付款与收款方"), edit("pay"), [row(t("商店 / 收款方"), esc(storeOf(p))), row(t("怎么付的"), esc(paymentPayLabel(p) || "")), p.created_by && state.members.length > 1 ? row(t("记录人"), esc(memberName(p.created_by) || "")) : ""].filter(Boolean));
  const kind = block(t("统计口径"), edit("kind"), [row(t("经济性质"), esc(t(natureName(nat))) + (xfer ? ` <span class="badge xfer-badge">${t("转账 · 不算花费")}</span>` : "")), state.properties.length > 1 || prop ? row(t("关联房产"), esc(prop || "")) : ""].filter(Boolean));
  const link = bill ? block(t("关联的账单缴费"), edit("link"), [row(t("账单"), `<a href="${href("bill", bill.id)}">${esc(bill.name)}</a>`), row(t("缴费记录"), `<a href="${href("bill", bill.id)}?sec=pay&edit=${encodeURIComponent(p.pay_id)}">${t("打开这条缴费记录")}</a>`)])
    : p.virtual === "medical" ? block(t("关联的医疗账单"), "", [row(t("医疗账单"), `<a href="${href("otbill", p.bill_id)}">${t("到医疗账单里看 / 改")}</a>`)]) : "";
  return `<section class="section">${crumb(p.name)}<div class="section-head"><div class="sh-title"><h2>${esc(p.name)}</h2><p>${esc(fmtDay(p.purchased_at))}</p></div>${p.virtual ? "" : `<div class="head-acts">${moreMenu([{ label: t("复制"), action: "spend-copy", data: { id: p.id }, first: true }, { label: t("删除"), action: "purchase-del", data: { id: p.id }, danger: true }])}</div>`}</div>${basic}${pay}${kind}${link}</section>`;
}
