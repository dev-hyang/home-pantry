/* 保养记录详情页（#/asset/<id>?sec=log&view=<记录 id>）：只读分块，每块右上角有自己的「编辑」（去编辑页并把光标放到那一块的第一个格子）。
 * 入口：保养记录列表点一行 / 长按菜单「详情」。右上 ⋯：复制、删除。 */
import { esc, fmt, fmtDate, num } from "../core/util.js";
import { state } from "../core/state.js";
import { href } from "../core/router.js";
import { t } from "../core/i18n.js";
import { dtBlock, dtRow } from "../core/detail-ui.js";
import { moreMenu } from "../core/more-menu.js";
import { purchaseById } from "../core/spend-data.js";
import { paymentPayLabel } from "../bills/card-picker.js";
import { isVehicle } from "./assets-logic.js";
import { C, H, V, distUnit } from "./asset-common.js";

export const maintViewHref = (a, id) => `${href("asset", a.id)}?sec=log&view=${encodeURIComponent(id)}`;
export const maintEditHref = (a, id, sec) => `${href("asset", a.id)}?log=1&edit=${encodeURIComponent(id)}${sec ? `&sec=${sec}` : ""}`;

export function maintDetail(a, id) {
  const l = a.logs.find((x) => x.id === id), listHref = `${href("asset", a.id)}?sec=log`;
  if (!l) return `<div class="panel empty"><strong>${t("找不到这条记录")}</strong><p><a class="btn btn-sm" href="${listHref}">${t("回到保养记录")}</a></p></div>`;
  const K = H().MAINT_KINDS, R = C().RESULTS, veh = isVehicle(a), pur = l.purchase_id ? purchaseById(l.purchase_id) : null;
  const item = l.service_item ? t(V().serviceItem(l.service_item)?.name || l.service_item) : "";
  const money = (v) => Units.money(num(v), l.currency || Units.region.currency);
  const basic = dtBlock(t("基本信息"), maintEditHref(a, l.id, "basic"), [dtRow(t("日期"), esc(fmtDate(l.done_on))), dtRow(t("类型"), esc(t(K[l.kind] || l.kind))),
    veh ? dtRow(t("保养项目"), esc(item)) : "", l.result ? dtRow(t("检查结论"), esc(t(R[l.result] || l.result))) : "", l.odometer != null ? dtRow(t("里程（{u}）", { u: distUnit() }), esc(`${fmt(l.odometer)} ${distUnit()}`)) : ""]);
  const cost = dtBlock(t("花费与收款方"), maintEditHref(a, l.id, "cost"), [dtRow(t("花费"), l.cost != null ? esc(money(l.cost)) : ""), dtRow(t("收款方"), esc(l.vendor || "")), dtRow(t("怎么付的"), esc((pur && paymentPayLabel(pur)) || "")),
    dtRow(t("自己动手"), l.diy ? esc(t("是")) : ""), pur ? dtRow(t("花费记录"), `<a href="${href("bills", "spend")}?view=${encodeURIComponent(l.purchase_id)}">${t("打开这笔花费")}</a>`) : ""]);
  const note = dtBlock(t("备注"), maintEditHref(a, l.id, "notes"), [dtRow(t("备注"), esc(l.notes || "")), l.created_at ? dtRow(t("记录时间"), esc(fmtDate(l.created_at))) : ""]);
  const menu = moreMenu([{ label: t("复制"), href: `${href("asset", a.id)}?log=1&copy=${encodeURIComponent(l.id)}`, first: true }, { label: t("删除"), action: "maint-del", data: { id: l.id }, danger: true }]);
  return `<div class="section-head"><div class="sh-title"><h2>${esc(item || t(K[l.kind] || l.kind))}</h2><p>${esc(fmtDate(l.done_on))}</p></div><div class="head-acts">${menu}</div></div>${basic}${cost}${note}`;
}
