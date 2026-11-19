/* 车辆资料页每个分区卡片里的内容：该分区表单里填过的字段一项一行（和房屋资料页 house-profile.js 的 sectionFacts 同一种画法），没填的不列，整块都没填显示「未填」。
 * 字段和标签对应 asset-form.js 里各分区的表单；改了表单字段，这里一起改。 */
import { esc, fmt, fmtDate, money, num } from "../core/util.js";
import { t } from "../core/i18n.js";
import { priceOrNull, pricesOk } from "../core/finance-access.js";
import { assetName } from "./assets-logic.js";
import { V, distUnit, vehStatus } from "./asset-common.js";

const date = (d) => (d ? esc(fmtDate(d)) : "");
const text = (x) => (x == null || x === "" ? "" : esc(x));
const distance = (n) => (n == null || n === "" ? "" : esc(`${fmt(n)} ${distUnit()}`));

/** 某个分区的内容：[[标签, 已转义的值], …]；值为空的那行不画 */
function rowsOf(a, id) {
  const v = a.vehicle || {}, ins = v.insurance || {}, pt = V().POWERTRAINS[a.type];
  switch (id) {
    case "basic": return [[t("动力类型"), pt ? esc(t(pt.name)) : ""], [t("名称"), text(assetName(a))], [t("位置"), text(a.location)], [t("品牌"), text(a.brand)], [t("型号"), text(a.model)], ["VIN", text(a.serial)]];
    case "plate": return [[t("车牌"), text(v.plate)], [t("上牌州 / 省"), text(v.plate_state)], [t("当前里程"), v.odometer != null && v.odometer !== "" ? `${distance(v.odometer)}${v.odometer_on ? ` · ${date(v.odometer_on)}` : ""}` : ""], [t("年均里程"), distance(v.annual_miles)]];
    case "docs": return [[t("拥有状态"), esc(t(V().STATUS[vehStatus(a)]?.name || ""))], [t("租赁到期"), date(v.lease_end)], [t("贷款结清日期"), date(v.loan_end)], [t("卖出 / 归还日期"), date(v.disposed_on)],
      [t("卖出价"), pricesOk() && priceOrNull(v.sale_price) != null ? esc(money(num(v.sale_price))) : ""], [t("牌照年贴到期"), date(v.registration_due)], [t("排放检测到期"), date(v.emissions_due)]];
    case "insurance": return [[t("保险公司"), text(ins.provider)], [t("保单号"), text(ins.policy)], [t("生效日"), date(ins.from)], [t("到期日"), date(ins.to)], [t("保障范围"), text(ins.coverage)], [t("代理 / 经纪人"), text(ins.agent)], [t("理赔电话"), ins.phone ? `<a href="tel:${esc(String(ins.phone).replace(/[^\d+]/g, ""))}">${esc(ins.phone)}</a>` : ""], [t("理赔邮箱"), ins.email ? `<a href="mailto:${esc(ins.email)}">${esc(ins.email)}</a>` : ""]];
    case "years": return [[t("购车日期"), date(a.installed_on)], [t("年款"), text(a.manufacture_year)], [t("整车保修到"), date(a.warranty_until)], [t("动力总成 / 高压电池保修到"), date(a.labor_warranty_until)]];
    case "cost": return [[t("购车价"), pricesOk() && priceOrNull(a.purchase_price) != null ? esc(money(num(a.purchase_price))) : ""]];
    case "notes": return [[t("备注"), a.notes ? `<span class="pre">${esc(a.notes)}</span>` : ""]];
    default: return [];
  }
}

export function vehicleFacts(a, id) {
  const rows = rowsOf(a, id).filter(([, val]) => val);
  return rows.length ? `<dl class="fact-grid one">${rows.map(([k, val]) => `<div class="fact"><dt>${k}</dt><dd>${val}</dd></div>`).join("")}</dl>` : `<p class="muted prof-empty">${t("未填")}</p>`;
}
