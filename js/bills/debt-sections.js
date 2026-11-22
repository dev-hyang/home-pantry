/* 借贷详情页的资料分块：每块一张卡（标题 + 「编辑」+ 当前填的内容），点「编辑」进编辑页只改这一块（debt-form.js 按 &sec= 显示对应字段）。
 * 和房屋资料、卡与账户、收入详情同一种样式（dtBlock）。个人借贷没有还款安排 / 关联资产两块。 */
import { DEBT_CATS, DIRECTIONS, FREQS, ROLES, STATUSES, isPersonalDebt } from "../core/debt-rules.js";
import { dtBlock, dtRow } from "../core/detail-ui.js";
import { esc, fmtDate } from "../core/util.js";
import { assetName } from "../house/assets.js";
import { debtHref } from "./debt-logic.js";
import { mny, pct } from "./debt-common.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";

/** 块 id → 名称（编辑页标题也用） */
export const DEBT_SEC_NAMES = { basic: "基本信息", terms: "金额与期限", pay: "还款安排", link: "关联账户与资产", notes: "备注" };
const date = (d) => (d ? esc(fmtDate(d)) : "");

export function debtBlocks(e) {
  const personal = isPersonalDebt(e), ed = (sec) => debtHref(e.id, `&edit=1&sec=${sec}`), c = e.currency;
  const person = e.person_id ? (state.people || []).find((p) => p.id === e.person_id)?.name : "";
  const card = e.lender_card_id ? (state.cards || []).find((x) => x.id === e.lender_card_id)?.name : "";
  const prop = e.property_id ? state.properties.find((p) => p.id === e.property_id)?.name : "", veh = e.asset_id ? (state.assets || []).find((a) => a.id === e.asset_id) : null;
  const esch = (e.escrow_schedule || []).filter((r) => r.from && r.amount !== "" && r.amount != null);
  const blocks = [
    dtBlock(t(DEBT_SEC_NAMES.basic), ed("basic"), [dtRow(t("类型"), esc(t(DEBT_CATS[e.category]?.name || ""))), dtRow(t("名称"), esc(e.name)), personal ? dtRow(t("方向"), esc(t(DIRECTIONS[e.direction]?.name || ""))) : "",
      dtRow(personal ? t("对方（人名）") : t("贷款方"), esc(e.counterparty_name || "")), dtRow(t("家里哪一位"), esc(person || "")), dtRow(t("状态"), esc(t(STATUSES[e.status]?.name || e.status || "")))]),
    dtBlock(t(DEBT_SEC_NAMES.terms), ed("terms"), [dtRow(personal ? t("金额") : t("原始本金"), e.original ? mny(e.original, c) : ""), dtRow(t("年利率"), e.interest_rate != null && e.interest_rate !== "" ? pct(e.interest_rate) : ""),
      dtRow(t("期限"), e.term_months ? t("{n} 个月", { n: e.term_months }) : ""), dtRow(t("起始日（放款）"), date(e.start_date)), personal ? "" : dtRow(t("第一期还款日"), date(e.first_payment_date)), dtRow(t("到期日"), date(e.maturity_date)),
      e.opening_balance != null ? dtRow(t("记录起点"), t("{d} 余额 {a}", { d: fmtDate(e.opening_balance_on), a: mny(e.opening_balance, c) })) : ""]),
    personal ? "" : dtBlock(t(DEBT_SEC_NAMES.pay), ed("pay"), [dtRow(t("还款频率"), esc(t(FREQS[e.payment_frequency] || ""))), dtRow(t("每期还款（含 Escrow）"), e.scheduled_payment ? mny(e.scheduled_payment, c) : ""),
      dtRow(t("Escrow 计划"), esch.length ? esc(esch.map((r) => `${r.from} ${mny(r.amount, c)}`).join(" · ")) : "")]),
    personal ? "" : dtBlock(t(DEBT_SEC_NAMES.link), ed("link"), [dtRow(t("卡与账户里的贷款账户"), esc(card || "")), dtRow(t("房产"), esc(prop || "")), dtRow(t("车辆 / 资产"), veh ? esc(assetName(veh)) : ""),
      dtRow(t("融资关系"), e.financing_role ? esc(t(ROLES[e.financing_role] || "")) + (e.secured ? ` · ${t("以这处资产抵押")}` : "") : "")]),
    dtBlock(t(DEBT_SEC_NAMES.notes), ed("notes"), [dtRow(t("备注"), e.notes ? `<span class="pre">${esc(e.notes)}</span>` : "")]),
  ];
  return `<div class="dt-grid dd-secs">${blocks.join("")}</div>`;
}
