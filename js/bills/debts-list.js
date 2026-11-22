/* 借贷 → 列表：每笔借贷一行（余额、下次还款、利率）。 */
import * as A from "../core/amortization.js";
import { DIRECTIONS, isClosedStatus, isLoanBillCat } from "../core/debt-rules.js";
import { debtHref } from "./debt-logic.js";
import { esc, fmtDate } from "../core/util.js";
import { href } from "../core/router.js";
import { liveNetWorth } from "./nw-logic.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";
import { moreMenu } from "../core/more-menu.js";
import { lpAttr } from "../core/long-press.js";
import { catBadge, fact, linkedText, mny, pct, periodPay, statusBadge } from "./debt-common.js";

/* ───────────── 列表 ───────────── */
/** 关联资产的净值（净资产页同一份计算：市值 − 挂在这处资产上的全部贷款）；没估值时提示去资产页 */
const equityText = (e) => {
  const q = liveNetWorth().equity.find((x) => (e.property ? x.kind === "property" && x.item.id === e.property.id : x.kind !== "property" && x.item.id === e.asset?.id));
  return q?.equity != null ? `<a href="${href("bills", "networth")}">${mny(q.equity)}</a>${q.source === "purchase" ? ` <small class="muted">${t("按购入价")}</small>` : ""}` : `<a class="muted" href="${href("bills", "assets")}">${t("未估值")}</a>`;
};
/** 一行借贷（贷款 / 个人借款）共用的外壳：第一行 名称（点进详情）· 右边最重要的金额 · ⋯；第二行 标签；下面 2 列（宽屏 4 列）的小事实。
 *  ⋯ 和长按（电脑右键）同一份菜单：详情 / 编辑 / 删除。 */
function debtRow(e, { name, label, amount, amountLabel, badges, facts }) {
  const menu = [{ label: t("详情"), href: debtHref(e.id), first: true }, { label: t("编辑"), href: debtHref(e.id, "&edit=1") }, { label: t("删除"), data: { debt: "delete", id: e.id }, danger: true }];
  return `<li class="fa-row dr-row" ${lpAttr(menu, name)}>
    <div class="dr-top"><a class="dr-name" href="${esc(debtHref(e.id))}" aria-label="${esc(label)}">${esc(name)}</a>
      <span class="dr-amt"><b>${amount}</b><small>${esc(amountLabel)}</small></span>${moreMenu(menu, { label: `${name} · ${t("更多操作")}` })}</div>
    <div class="dr-badges">${badges}</div>
    <div class="dr-facts">${facts.filter(Boolean).join("")}</div></li>`;
}
export function loanCard(e) {
  const rate = e.interest_rate != null ? pct(e.interest_rate) : `<span class="muted">${t("未填")}</span>`;
  const term = e.term_months ? t("{n} 个月", { n: e.term_months }) : null;
  const pay = periodPay(e);
  return debtRow(e, { name: e.name, label: t("打开贷款 {name}", { name: e.name }), amount: e.balance != null ? mny(e.balance, e.currency) : "—", amountLabel: e.balance != null ? t("未还本金") : t("填本金后算"),
    badges: `${catBadge(e)}${statusBadge(e)}`,
    facts: [fact(t("贷款方"), esc(e.counterparty_name || "—")),
      fact(t("原始本金"), mny(e.original, e.currency)),
      fact(t("利率 / 期限"), [rate, term].filter(Boolean).join(" · ")),
      fact(t("每期还款"), pay != null ? `${mny(pay, e.currency)}${e.escrow ? ` <small class="muted">${t("含 Escrow {a}", { a: mny(e.escrow, e.currency) })}</small>` : ""}` : "—"),
      fact(t("下次还款"), e.nextDue ? esc(fmtDate(e.nextDue)) : e.bill ? `<span class="muted">${t("账单没填到期日")}</span>` : `<span class="muted">${t("没挂账单")}</span>`),
      fact(t("资产"), linkedText(e) || `<span class="muted">${t("没关联")}</span>`),
      (e.property || e.asset) && !isClosedStatus(e.status) && state.nwOk ? fact(t("资产净值"), equityText(e)) : ""] });
}
export function personCard(e) {
  const recv = e.direction === "receivable", who = e.counterparty_name || e.name;
  const paidPct = e.original > 0 && e.balance != null ? Math.round(((e.original - e.balance) / e.original) * 100) : null;
  const person = e.person_id ? (state.people || []).find((p) => p.id === e.person_id)?.name : null;
  return debtRow(e, { name: who, label: t("打开借款 {name}", { name: who }), amount: e.balance != null ? mny(e.balance, e.currency) : "—", amountLabel: recv ? t("对方还欠") : t("我还欠"),
    badges: `<span class="badge" style="background:var(--surface-2)">${esc(t(DIRECTIONS[e.direction].short))}</span>${e.balance === 0 && !isClosedStatus(e.status) ? `<span class="badge b-ok">${t("已结清")}</span>` : statusBadge(e)}`,
    facts: [fact(t("金额"), mny(e.original, e.currency)),
      fact(t("借款日期"), e.start_date ? esc(fmtDate(e.start_date)) : ""),
      fact(t("到期"), e.maturity_date ? `${esc(fmtDate(e.maturity_date))}${e.overdue ? ` <span class="badge b-out">${t("逾期")}</span>` : ""}` : `<span class="muted">${t("没约定")}</span>`),
      fact(recv ? t("已收回") : t("已还"), paidPct != null ? `<span class="pc-prog"><span class="ds-bar ${paidPct >= 100 ? "done" : recv ? "recv" : ""}" aria-hidden="true"><i style="width:${Math.min(100, paidPct)}%"></i></span>${paidPct}% · ${mny(A.r2(e.original - e.balance), e.currency)}</span>` : "—"),
      person ? fact(t("家里"), esc(person)) : ""] });
}
/** 没挂贷款的贷款类账单（迁移以后新建的）：提示建贷款 */
const looseLoanBills = () => state.billsEnriched.filter((b) => isLoanBillCat(b.category) && b.direction !== "receivable" && !b.debt_id && b.active && !b.ended);
export const looseBillsHtml = () => {
  const list = looseLoanBills(); if (!list.length) return "";
  return `<div class="panel" style="margin-top:12px"><b>${t("还没建贷款的贷款账单")}</b><p class="muted" style="font-size:13px;margin:4px 0 8px">${t("建了贷款才能算余额、按本金 / 利息拆分还款")}</p>
    <ul class="fa-list">${list.map((b) => `<li class="fa-row"><div class="fa-head"><a href="${esc(href("bill", b.id))}">${esc(b.name)}</a><small class="muted">${mny(b.est, b.currency)}</small>
      <a class="btn btn-sm fa-edit" href="${esc(newFromBillHref(b))}">${t("建贷款")}</a></div></li>`).join("")}</ul></div>`;
};
export const newFromBillHref = (b) => debtHref(null, `new=1&bill=${encodeURIComponent(b.id)}`);
