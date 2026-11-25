/* 周期性账单的详情页（#/bill/<id>?sec=detail）：账单菜单第一项「详情」进这里，不再直接进整张编辑表单。
 * 按块列出所有信息（这是什么账单 / 多少钱、多久一次 / 怎么付 / 提醒与其他），每块带自己的「编辑」，点进去只改这一块（?sec=basic|amount|autopay|other，表单在 bill-form.js）。 */
import { esc, fmtDate, money, num } from "../core/util.js";
import { href } from "../core/router.js";
import { t } from "../core/i18n.js";
import { state } from "../core/state.js";
import { billCat } from "./logic.js";
import { B, billCrumb, mny } from "./bill-common.js";
import { acctById, billPayLabel } from "./card-picker.js";
import { assetName } from "../house/assets.js";
import { adultPeople } from "../settings/family-lite.js";

const fact = (k, v) => (v ? `<div class="fact"><dt>${esc(k)}</dt><dd>${v}</dd></div>` : "");
const yn = (x) => esc(t(x ? "是" : "否"));
const pick = (map, k) => (k && map?.[k] ? esc(t(map[k])) : "");
const link = (u) => (u ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(String(u).replace(/^https?:\/\//, "").replace(/\/$/, "").slice(0, 42))}</a>` : "");

export const DETAIL_BLOCKS = [
  { id: "basic", icon: "🧾", name: "这是什么账单" },
  { id: "amount", icon: "📅", name: "多少钱、多久一次" },
  { id: "autopay", icon: "🔁", name: "怎么付" },
  { id: "other", icon: "⋯", name: "提醒与其他" },
];

function rows(b, id) {
  const bills = B(), cat = bills.CATEGORIES.find((c) => c.id === b.category), prop = state.properties.find((p) => p.id === b.property_id), asset = (state.assets || []).find((a) => a.id === b.asset_id);
  const cur = b.currency, who = adultPeople().find((p) => p.id === b.assigned_person_id);
  const exp = acctById(b.pay_card_id);
  switch (id) {
    case "basic": return [fact(t("名称"), esc(b.name)), fact(t("分类"), cat ? `${cat.icon} ${esc(t(cat.name))}` : ""), fact(t("订阅种类"), pick(bills.SUB_KINDS, b.sub_kind)), fact(t("免费试用到期日"), b.trial_ends_on ? esc(fmtDate(b.trial_ends_on)) : ""),
      fact(t("房产"), prop ? esc(prop.name) : ""), fact(t("关联资产"), asset ? esc(assetName(asset)) : ""), fact(t("方向"), b.direction === "receivable" ? esc(t("别人付给我（应收）")) : ""), fact(t("付款方 / 收款方"), esc(b.payee || ""))];
    case "amount": return [fact(t("频率"), pick(bills.FREQUENCIES, b.frequency) + (b.frequency === "custom" && b.interval_months ? ` · ${esc(t("每 {n} 个月", { n: b.interval_months }))}` : "")),
      fact(t("每月几号到期"), b.due_day ? esc(t("每月 {n} 号", { n: b.due_day })) : ""), fact(t("固定日期（半年 / 年付）"), esc((b.due_dates || []).join(", "))), fact(t("下次到期日"), b.next_due_on ? esc(fmtDate(b.next_due_on)) : ""),
      fact(t("金额类型"), esc(t(b.amount_type === "fixed" ? "固定" : "每次不同"))), fact(t("通常金额"), b.typical_amount != null ? mny(b.typical_amount, cur) : ""),
      fact(t("单元费 Unit assessment"), b.unit_amount != null ? mny(b.unit_amount, cur) : ""), fact(t("车位费 Parking assessment"), b.parking_amount != null ? mny(b.parking_amount, cur) : ""),
      fact(t("通常手续费（估算）"), b.typical_fee != null ? mny(b.typical_fee, cur) : ""), fact(t("通常税（估算）"), b.typical_tax != null ? mny(b.typical_tax, cur) : ""), fact(t("货币"), esc(cur || ""))];
    case "autopay": return [fact(t("缴费方式"), pick(bills.CHANNELS, b.pay_channel)), fact(t("付款账户 / 卡"), esc(billPayLabel(b) || "")), fact(t("自动扣款"), yn(b.autopay)),
      !exp && b.autopay_card_expires ? fact(t("扣款卡有效期"), esc(b.autopay_card_expires)) : "", fact(t("缴费链接"), link(b.pay_url)), fact(t("账号尾号"), esc(b.account_last4 || "")),
      fact(t("登录提示"), b.login_hint ? `<span class="nolink">${esc(b.login_hint)}</span>` : ""), fact(t("账单怎么来"), pick(bills.STATEMENTS, b.statement_channel))];
    default: return [fact(t("提前提醒（天，逗号分隔）"), esc((b.reminder_days || [7, 1]).join(", "))), fact(t("宽限天数"), b.grace_days ? esc(String(b.grace_days)) : ""), fact(t("结束日期（可选）"), b.ends_on ? esc(fmtDate(b.ends_on)) : ""),
      fact(t("滞纳金说明"), esc(b.late_fee_note || "")), fact(t("谁负责"), who ? esc(who.name) : ""), fact(t("必要支出（预算里单独统计）"), yn(b.essential !== false)), fact(t("启用（停用后不再提醒，记录保留）"), yn(b.active !== false)),
      b.notes ? fact(t("备注"), `<span class="pre">${esc(b.notes)}</span>`) : ""];
  }
}

/** 详情页：每块一张卡，右上角「编辑」只改这一块 */
export function billDetailPage(b, root, hubHref) {
  const cards = DETAIL_BLOCKS.map((s) => {
    const r = rows(b, s.id).filter(Boolean);
    return `<section class="panel prof-card" aria-labelledby="bd-${s.id}">
      <header class="prof-head"><span class="mi" aria-hidden="true">${s.icon}</span><div class="prof-t"><h3 id="bd-${s.id}">${t(s.name)}</h3></div>
        <a class="ui-btn prof-edit" data-size="sm" data-tone="ghost" href="${hubHref}?sec=${s.id}" aria-label="${esc(t("编辑") + " · " + t(s.name))}">${t("编辑")}</a></header>
      ${r.length ? `<dl class="fact-grid one">${r.join("")}</dl>` : `<p class="muted prof-empty">${t("未填")}</p>`}</section>`;
  }).join("");
  return `<section class="section">
    ${billCrumb(b, root, hubHref, t("详情"))}
    <div class="section-head"><h2>${billCat(b.category).icon} ${esc(b.name)}</h2></div>
    <div class="prof-grid bill-detail-grid one-col">${cards}</div>
  </section>`;
}
