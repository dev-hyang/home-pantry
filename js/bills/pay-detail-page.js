/* 缴费记录详情页（?sec=pay&view=<缴费 id>）：只读，分「缴费 / 金额明细 / 付款 / 备注」几块，每块右上角「编辑」去这条记录的编辑页。
 * 入口：缴费记录一行的长按 / 右键菜单 →「详情」。 */
import { esc, fmtDate, num } from "../core/util.js";
import { href } from "../core/router.js";
import { t } from "../core/i18n.js";
import { crumbNav } from "../core/hub.js";
import { dtBlock, dtRow } from "../core/detail-ui.js";
import { payTotal } from "./pay-total.js";
import { paymentPayLabel } from "./card-picker.js";

const mny = (v, cur) => (v == null ? "" : esc(Units.money(num(v), cur || Units.region.currency)));

/** trail = 面包屑前半段（bill-form.js 里的 billTrail）；p = 这条缴费（找不到传 null） */
export function payDetailPage(b, p, trail, listHref) {
  const crumb = (label) => crumbNav([...trail, { href: listHref, label: t("缴费记录") }, { label }]);
  if (!p) return `<section class="section">${crumb(t("详情"))}<div class="panel empty"><strong>${t("找不到这笔记录")}</strong><p><a class="ui-btn" data-size="sm" href="${esc(listHref)}">${t("回到缴费记录")}</a></p></div></section>`;
  const edit = `${href("bill", b.id)}?sec=pay&edit=${encodeURIComponent(p.id)}`, c = p.currency || b.currency;
  const status = window.BILLS?.PAYMENT_STATUS?.[p.status] || p.status;
  const amounts = [["单元费", p.unit_amount], ["车位费", p.unit_amount != null ? p.parking_amount : null], ["摊派", p.assessment_amount], ["手续费", p.fee_amount], ["税", p.tax_amount], ["滞纳金", p.late_fee]].filter(([, v]) => v != null && num(v));
  return `<section class="section">${crumb(fmtDate(p.paid_on))}<div class="section-head"><h2>${esc(fmtDate(p.paid_on))}</h2><p>${esc(b.name)}</p></div>
    ${dtBlock(t("缴费"), edit, [dtRow(t("缴费日期"), esc(fmtDate(p.paid_on))), dtRow(t("对应到期日"), esc(p.due_on ? fmtDate(p.due_on) : "")), dtRow(t("状态"), esc(t(status)))])}
    ${dtBlock(t("金额明细"), edit, [dtRow(t("总金额"), p.amount != null && p.status !== "skipped" ? mny(payTotal(p), c) : ""), ...amounts.map(([k, v]) => dtRow(t(k), mny(v, c)))])}
    ${dtBlock(t("付款"), edit, [dtRow(t("用哪张卡 / 账户"), esc(paymentPayLabel(p) || "")), dtRow(t("确认号"), esc(p.confirmation_ref || ""))])}
    ${dtBlock(t("备注"), edit, [dtRow(t("备注"), esc(p.notes || ""))])}
  </section>`;
}
