/* 财务 → 借贷（财务 P2，迁移 058）：资产融资（房贷、车贷、HELOC、学生贷款、分期）· 个人借贷（借给亲友 / 向亲友借）· 还款记录；
 * 一笔贷款的详情：摊还表、每期还款的 本金 / 利息 / Escrow 拆分（可手动改）、关联账单和资产（按 id）。
 * 网址：#/bills/debts?tab=asset|personal|txns；详情 ?id=<贷款 id>；新建 ?new=1&cat=…&lender=…&principal=…&prop=…&asset=…&bill=…；编辑 ?id=…&edit=1。
 * 别名：#/finance/debts、#/bills/loans、#/bills/debt、#/bills/lending（router.js）。只给有财务权限的人（finance-rules.js）。
 * 数据都在内存里（state.debts / state.debtTxns，见 debt-logic.js）；还款记录多了按页显示。设计见 docs/design-debt-lending.md。 */
import { state } from "../core/state.js";
import { Store } from "../core/store.js";
import { armed, esc, fmtDate, money, num, toast, todayISO } from "../core/util.js";
import { t } from "../core/i18n.js";
import { go, href } from "../core/router.js";
import { tabBar } from "../core/hub.js";
import { DEBT_TABS, activeTab } from "../core/tabs.js";
import * as A from "../core/amortization.js";
import { DEBT_CATS, DIRECTIONS, FREQS, ROLES, STATUSES, TXN_TYPES, debtCat, debtCatOfBill, debtGroup, freqOfBill, isClosedStatus, isLoanBillCat, isPersonalDebt } from "../core/debt-rules.js";
import { billOfDebt, canSplit, clearOverride, debtById, debtHref, debtTxns, debtsEnriched, deleteDebtTxn, enrichDebt, loadDebts, overrideSplit, recordDebtTxn, resplitDebt, syncDebtStatus, syncVehicle, unsplitDebt } from "./debt-logic.js";
import { loadIncome } from "../income/logic.js";
import { assetName, isVehicle } from "../house/assets.js";

let hooks = { render: () => {}, refresh: async () => {} };
const ui = () => (state.debtUi ||= {});
const cur = () => Units.region.currency;
const mny = (v, c) => (v == null ? "—" : Units.money(v, c || cur()));
const pct = (v) => (v == null ? "—" : `${+Number(v).toFixed(3)}%`);
const tabHref = (id) => `${href("bills", "debts")}?tab=${id}`;
const fact = (label, value) => (value ? `<span class="fa-fact"><small>${esc(label)}</small>${value}</span>` : "");
const statusBadge = (e) => `<span class="badge ${STATUSES[e.status]?.cls || ""}">${esc(t(STATUSES[e.status]?.name || e.status))}</span>`;
const catBadge = (e) => `<span class="badge" style="background:var(--surface-2)">${debtCat(e.category).icon} ${esc(t(debtCat(e.category).name))}</span>`;
const vehicles = () => state.assets.filter(isVehicle);
const assetLabel = (a) => (a ? (isVehicle(a) ? `🚗 ${assetName(a)}` : `⚙️ ${assetName(a)}`) : "");
const assetHref = (e) => (e.asset ? href("asset", e.asset.id) : e.property ? `${href("house", "pages")}?prop=${encodeURIComponent(e.property.id)}` : null);
const linkedText = (e) => {
  const lbl = e.asset ? assetLabel(e.asset) : e.property ? `🏠 ${e.property.name}` : null; if (!lbl) return "";
  const h = assetHref(e);
  return `<a href="${esc(h)}">${esc(lbl)}</a>${e.link_confirmed === false ? ` <span class="badge b-soon">${t("待确认")}</span>` : ""}`;
};
const periodPay = (e) => (e.pi != null ? e.pi + (e.escrow || 0) : e.scheduled_payment ?? e.bill?.est ?? null);

/* ───────────── 列表 ───────────── */
function loanCard(e) {
  const rate = e.interest_rate != null ? pct(e.interest_rate) : `<span class="muted">${t("未填")}</span>`;
  const term = e.term_months ? t("{n} 个月", { n: e.term_months }) : null;
  const pay = periodPay(e);
  return `<li class="fa-row">
    <div class="fa-head"><b>${esc(e.name)}</b>${catBadge(e)}${statusBadge(e)}
      <a class="btn btn-sm btn-ghost fa-edit" href="${esc(debtHref(e.id))}" aria-label="${esc(t("打开贷款 {name}", { name: e.name }))}">${t("详情")} ›</a></div>
    <div class="fa-facts">
      ${fact(t("贷款方"), esc(e.counterparty_name || "—"))}
      ${fact(t("原始本金"), mny(e.original, e.currency))}
      ${fact(t("未还本金"), e.balance != null ? `<b>${mny(e.balance, e.currency)}</b>` : `<span class="muted">${t("填本金后算")}</span>`)}
      ${fact(t("利率 / 期限"), [rate, term].filter(Boolean).join(" · "))}
      ${fact(t("每期还款"), pay != null ? `${mny(pay, e.currency)}${e.escrow ? ` <small class="muted">${t("含 Escrow {a}", { a: mny(e.escrow, e.currency) })}</small>` : ""}` : "—")}
      ${fact(t("下次还款"), e.nextDue ? esc(fmtDate(e.nextDue)) : e.bill ? `<span class="muted">${t("账单没填到期日")}</span>` : `<span class="muted">${t("没挂账单")}</span>`)}
      ${fact(t("资产"), linkedText(e) || `<span class="muted">${t("没关联")}</span>`)}
      ${e.property && !isClosedStatus(e.status) ? fact(t("净值"), `<span class="muted">${t("估值 P3")}</span>`) : ""}
    </div></li>`;
}
function personCard(e) {
  const recv = e.direction === "receivable", who = e.counterparty_name || e.name;
  const paidPct = e.original > 0 && e.balance != null ? Math.round(((e.original - e.balance) / e.original) * 100) : null;
  const person = e.person_id ? (state.people || []).find((p) => p.id === e.person_id)?.name : null;
  return `<li class="fa-row">
    <div class="fa-head"><b>${esc(who)}</b><span class="badge" style="background:var(--surface-2)">${esc(t(DIRECTIONS[e.direction].short))}</span>${statusBadge(e)}
      <a class="btn btn-sm btn-ghost fa-edit" href="${esc(debtHref(e.id))}" aria-label="${esc(t("打开借款 {name}", { name: who }))}">${t("详情")} ›</a></div>
    <div class="fa-facts">
      ${fact(t("金额"), mny(e.original, e.currency))}
      ${fact(recv ? t("对方还欠") : t("我还欠"), e.balance != null ? `<b>${mny(e.balance, e.currency)}</b>` : "—")}
      ${fact(t("到期"), e.maturity_date ? `${esc(fmtDate(e.maturity_date))}${e.overdue ? ` <span class="badge b-out">${t("逾期")}</span>` : ""}` : `<span class="muted">${t("没约定")}</span>`)}
      ${fact(t("已还"), paidPct != null ? `${paidPct}% · ${mny(e.paid.principal, e.currency)}` : "—")}
      ${person ? fact(t("家里"), esc(person)) : ""}
    </div></li>`;
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

function listTab(tab, all) {
  if (tab === "txns") return txnsTab(all);
  const open = (e) => !isClosedStatus(e.status);
  if (tab === "personal") {
    const mine = all.filter((e) => debtGroup(e) === "personal");
    const sec = (dir, title) => { const l = mine.filter((e) => e.direction === dir).sort((a, b) => (open(b) - open(a)) || (a.maturity_date || "9").localeCompare(b.maturity_date || "9"));
      return `<div class="section-head" style="margin-top:14px"><h2>${title}</h2><a class="btn btn-sm btn-primary" href="${esc(debtHref(null, `new=1&cat=personal_lending&dir=${dir}`))}">＋ ${dir === "receivable" ? t("借出") : t("借入")}</a></div>
        <div class="panel">${l.length ? `<ul class="fa-list">${l.map(personCard).join("")}</ul>` : `<div class="empty">${dir === "receivable" ? t("没有借给别人的钱") : t("没有向别人借的钱")}</div>`}</div>`; };
    return sec("receivable", `🤝 ${t("借出（别人欠我）")}`) + sec("payable", `🙏 ${t("借入（我欠别人）")}`) + `<p class="hint">${t("借出是钱从账户出去（不算消费）；收回本金不算收入，收到的利息算投资收益。以前收入里「需要还」的记录已经转成这里的借入。")}</p>`;
  }
  const loans = all.filter((e) => debtGroup(e) === "asset").sort((a, b) => (open(b) - open(a)) || (b.balance || 0) - (a.balance || 0));
  const live = loans.filter(open), ended = loans.filter((e) => !open(e));
  return `<div class="section-head" style="margin-top:14px"><h2>🏦 ${t("贷款")}</h2><a class="btn btn-sm btn-primary" href="${esc(debtHref(null, "new=1"))}">＋ ${t("添加贷款")}</a></div>
    <div class="panel">${live.length ? `<ul class="fa-list">${live.map(loanCard).join("")}</ul>` : `<div class="empty"><strong>${t("没有在还的贷款")}</strong>${t("房贷、车贷、学生贷款、分期都可以记在这里")}</div>`}</div>
    ${ended.length ? `<details class="panel ref-panel" style="margin-top:12px"><summary><b>${t("已结束")}</b><small>${t("{n} 笔已还清或关闭", { n: ended.length })}</small><span class="mch" aria-hidden="true">›</span></summary><ul class="fa-list">${ended.map(loanCard).join("")}</ul></details>` : ""}
    ${looseBillsHtml()}`;
}

const txnName = (x) => t(TXN_TYPES[x.type]?.name || x.type);
function txnRow(x, d, { manage = false } = {}) {
  const parts = [x.principal_amount ? t("本金 {a}", { a: mny(x.principal_amount, d?.currency) }) : null, x.interest_amount ? t("利息 {a}", { a: mny(x.interest_amount, d?.currency) }) : null,
    x.escrow_amount ? t("Escrow {a}", { a: mny(x.escrow_amount, d?.currency) }) : null, x.fee_amount ? t("滞纳金 {a}", { a: mny(x.fee_amount, d?.currency) }) : null].filter(Boolean);
  const src = x.bill_payment_id ? t("账单缴费") : x.purchase_id ? t("已记花费") : x.income_record_id ? t("已记收入") : null;
  return `<li class="fa-row"><div class="fa-head"><b>${esc(fmtDate(x.txn_date))}</b><span>${esc(txnName(x))}</span>${x.split_source === "manual" && x.bill_payment_id ? `<span class="badge b-soon">${t("手动")}</span>` : ""}
      ${d ? `<a href="${esc(debtHref(d.id))}">${esc(d.name)}</a>` : ""}<b style="margin-left:auto">${mny(x.total, d?.currency)}</b></div>
    <small class="muted">${[...parts, src, x.notes].filter(Boolean).map(esc).join(" · ")}</small>
    ${manage && !x.bill_payment_id ? `<div><button type="button" class="btn btn-sm btn-ghost" data-debt="txn-del" data-id="${esc(x.id)}">${t("删除")}</button></div>` : ""}</li>`;
}
function txnsTab(all) {
  const by = new Map(all.map((e) => [e.id, e])), list = debtTxns().slice().sort((a, b) => b.txn_date.localeCompare(a.txn_date) || String(b.id).localeCompare(String(a.id)));
  const lim = ui().txLimit || 50, shown = list.slice(0, lim);
  return `<div class="panel" style="margin-top:12px">${shown.length ? `<ul class="fa-list">${shown.map((x) => txnRow(x, by.get(x.debt_id))).join("")}</ul>` : `<div class="empty">${t("还没有借贷流水")}</div>`}
    ${list.length > lim ? `<p style="text-align:center"><button type="button" class="btn btn-sm" data-debt="tx-more">${t("继续加载（还有 {n} 条）", { n: list.length - lim })}</button></p>` : ""}</div>
    <p class="hint">${t("账单缴费的拆分在缴费时自动生成；钱本身记在花费 / 收入里，这里是同一笔钱的借贷视角，不重复计算。")}</p>`;
}

/* ───────────── 详情 ───────────── */
function amortHtml(e) {
  const start = e.opening_balance_on || e.start_date || todayISO(), principal = e.opening_balance ?? e.original;
  if (e.interest_rate == null || !(principal > 0)) return `<p class="muted">${t("填了本金和利率才有摊还表。")}</p>`;
  const n = e.opening_balance != null ? A.remainingPeriods(e.opening_balance, e.rate, e.pi) : A.periodsOf(e.term_months, e.freq);
  const rows = A.schedule({ principal, annualRate: e.interest_rate, periods: e.opening_balance != null ? null : n, pay: e.opening_balance != null || !n ? e.pi : null, start, freq: e.freq });
  if (!rows.length) return `<p class="muted">${t("每期还款不够付利息，或缺期限 / 每期还款，算不出摊还表。")}</p>`;
  const all = ui().amortAll === e.id, shown = all ? rows : rows.slice(0, 24), today = todayISO();
  const totalInt = rows.reduce((s, r) => s + r.interest, 0);
  return `<p class="muted" style="font-size:13px;margin:0 0 6px">${t("{n} 期，利息合计 {a}，最后一期 {d}", { n: rows.length, a: mny(A.r2(totalInt), e.currency), d: fmtDate(rows.at(-1).date) })}${e.escrow ? ` · ${t("每期另有 Escrow 约 {a}", { a: mny(e.escrow, e.currency) })}` : ""}</p>
    <div class="table-scroll" tabindex="0" role="region" aria-label="${esc(t("摊还表"))}"><table class="store-table amort-table"><thead><tr><th scope="col">#</th><th scope="col">${t("日期")}</th><th scope="col">${t("本息")}</th><th scope="col">${t("利息")}</th><th scope="col">${t("本金")}</th><th scope="col">${t("余额")}</th></tr></thead>
    <tbody>${shown.map((r) => `<tr${r.date < today ? ' class="muted"' : ""}><td>${r.n}</td><td>${esc(fmtDate(r.date))}</td><td>${mny(r.payment, e.currency)}</td><td>${mny(r.interest, e.currency)}</td><td>${mny(r.principal, e.currency)}</td><td>${mny(r.balance, e.currency)}</td></tr>`).join("")}</tbody></table></div>
    ${rows.length > 24 ? `<p><button type="button" class="btn btn-sm btn-ghost" data-debt="amort-all" data-id="${esc(e.id)}" aria-expanded="${all}">${all ? t("只看前 24 期") : t("显示全部 {n} 期", { n: rows.length })}</button></p>` : ""}`;
}
/** 账单缴费的拆分：每期一行，可手动改（按对账单） */
function paymentsHtml(e) {
  const list = e.txns.filter((x) => x.bill_payment_id).sort((a, b) => b.txn_date.localeCompare(a.txn_date));
  const others = e.txns.filter((x) => !x.bill_payment_id).sort((a, b) => b.txn_date.localeCompare(a.txn_date));
  const lim = ui().payLimit || 12, shown = list.slice(0, lim);
  const row = (x) => `<li class="fa-row"><details><summary class="debt-pay"><span><b>${esc(fmtDate(x.txn_date))}</b> · ${mny(x.total, e.currency)}</span>
      <small>${[t("本金 {a}", { a: mny(x.principal_amount, e.currency) }), t("利息 {a}", { a: mny(x.interest_amount, e.currency) }), x.escrow_amount ? t("Escrow {a}", { a: mny(x.escrow_amount, e.currency) }) : null, x.fee_amount ? t("滞纳金 {a}", { a: mny(x.fee_amount, e.currency) }) : null].filter(Boolean).map(esc).join(" · ")}${x.split_source === "manual" ? ` <span class="badge b-soon">${t("手动")}</span>` : ""}</small></summary>
    <form data-debt-form="override" data-id="${esc(e.id)}" data-pay="${esc(x.bill_payment_id)}" class="form-grid" style="margin-top:8px">
      <label>${t("本金")}<input type="number" name="principal" inputmode="decimal" step="0.01" min="0" value="${x.principal_amount}" required></label>
      <label>${t("利息")}<input type="number" name="interest" inputmode="decimal" step="0.01" min="0" value="${x.interest_amount}"></label>
      <label>${t("Escrow")}<input type="number" name="escrow" inputmode="decimal" step="0.01" min="0" value="${x.escrow_amount}"></label>
      <div class="form-actions" style="grid-column:1/-1"><button class="btn btn-sm btn-primary">${t("按对账单改")}</button>${x.split_source === "manual" ? `<button type="button" class="btn btn-sm btn-ghost" data-debt="override-clear" data-id="${esc(e.id)}" data-pay="${esc(x.bill_payment_id)}">${t("改回按摊还表")}</button>` : ""}</div>
    </form></details></li>`;
  return `${list.length ? `<ul class="fa-list">${shown.map(row).join("")}</ul>${list.length > lim ? `<p><button type="button" class="btn btn-sm btn-ghost" data-debt="pay-more">${t("继续加载（还有 {n} 期）", { n: list.length - lim })}</button></p>` : ""}`
    : `<p class="muted">${e.bill ? (e.split ? t("这条账单还没有缴费记录。") : t("填了利率和本金（或某天的余额）后，账单的每笔缴费会自动拆成本金 / 利息。")) : t("没挂账单：在下面关联一条账单，月供提醒和缴费记录就用那条账单。")}</p>`}
    ${others.length ? `<h3 style="font-size:15px;margin:14px 0 6px">${t("其他流水")}</h3><ul class="fa-list">${others.map((x) => txnRow(x, null, { manage: true })).join("")}</ul>` : ""}`;
}
function recordForm(e) {
  const personal = isPersonalDebt(e), recv = e.direction === "receivable";
  const kinds = personal ? [["repay", recv ? t("对方还我") : t("我还对方")], ["lend", recv ? t("又借出") : t("又借入")]] : [["extra", t("额外还本金")]];
  const accts = (state.cards || []).filter((c) => c.active !== false);
  return `<form data-debt-form="txn" data-id="${esc(e.id)}" class="form-grid">
    <label>${t("类型")}<select name="kind">${kinds.map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join("")}</select></label>
    <label>${t("日期")}<input type="date" name="date" value="${todayISO()}" required></label>
    <label>${t("本金")}<input type="number" name="principal" inputmode="decimal" step="0.01" min="0" value="${personal && e.balance > 0 ? e.balance : ""}"></label>
    ${personal ? `<label>${recv ? t("利息（收到的）") : t("利息（付的）")}<input type="number" name="interest" inputmode="decimal" step="0.01" min="0"></label>` : ""}
    <label>${t("账户")}<select name="acct"><option value="">${t("不指定")}</option>${accts.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}${c.last4 ? ` ··${esc(c.last4)}` : ""}</option>`).join("")}</select></label>
    <label>${t("备注")}<input name="notes" maxlength="200"></label>
    <label class="check-inline" style="grid-column:1/-1"><input type="checkbox" name="cash" checked><span>${personal ? (recv ? t("同时记一笔收入（收回本金不算收入，利息算投资收益）") : t("同时记一笔花费（还本金不算消费）")) : t("同时记一笔花费（性质：融资 / 还本）")}</span></label>
    <small class="muted" style="grid-column:1/-1">${t("如果这笔钱已经从对账单导入了，取消勾选，只记借贷流水。")}</small>
    <div class="form-actions"><button class="btn btn-sm btn-primary">${t("记一笔")}</button></div></form>`;
}
function linkPanel(e) {
  const bills = state.billsEnriched.filter((b) => isLoanBillCat(b.category) && b.direction !== "receivable" && (!b.debt_id || b.debt_id === e.id));
  const target = debtCat(e.category).target;
  const props = state.properties.filter((p) => !p.archived || p.id === e.property_id), vs = vehicles().filter((a) => window.VEHICLES.isActive(a) || a.id === e.asset_id);
  const proposal = e.asset_id && e.link_confirmed === false ? `<p class="notice" role="status">${t("迁移时按名字猜这笔车贷对应「{v}」。对吗？", { v: e.asset ? assetName(e.asset) : "?" })}
      <button type="button" class="btn btn-sm btn-primary" data-debt="link-confirm" data-id="${esc(e.id)}">${t("对，确认")}</button> <button type="button" class="btn btn-sm btn-ghost" data-debt="link-clear" data-id="${esc(e.id)}">${t("不对，解除")}</button></p>` : "";
  return `${proposal}<form data-debt-form="link" data-id="${esc(e.id)}" class="form-grid">
    <label>${t("还款账单")}<select name="bill"><option value="">${t("不关联")}</option>${bills.map((b) => `<option value="${esc(b.id)}" ${b.debt_id === e.id ? "selected" : ""}>${esc(b.name)}${b.est != null ? ` · ${esc(mny(b.est, b.currency))}` : ""}</option>`).join("")}</select></label>
    ${target !== "vehicle" ? `<label>${t("房产")}<select name="property_id"><option value="">${t("不关联")}</option>${props.map((p) => `<option value="${esc(p.id)}" ${p.id === e.property_id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>` : ""}
    ${target !== "property" ? `<label>${t("车辆")}<select name="asset_id"><option value="">${t("不关联")}</option>${vs.map((a) => `<option value="${esc(a.id)}" ${a.id === e.asset_id ? "selected" : ""}>${esc(assetName(a))}</option>`).join("")}</select></label>` : ""}
    <div class="form-actions" style="grid-column:1/-1"><button class="btn btn-sm">${t("保存关联")}</button></div></form>`;
}
function detail(id) {
  const d = debtById(id);
  if (!d) return `<section class="section"><div class="panel empty"><strong>${t("找不到这笔借贷")}</strong><p><a class="btn btn-primary" href="${esc(href("bills", "debts"))}">${t("回到借贷")}</a></p></div></section>`;
  if (state.route.q.get("edit")) return `<section class="section">${debtForm(d)}</section>`;
  const e = enrichDebt(d), personal = isPersonalDebt(e), recv = e.direction === "receivable";
  const facts = personal ? [
      fact(t("对方"), esc(e.counterparty_name || "—")), fact(t("方向"), esc(t(DIRECTIONS[e.direction].name))), fact(t("金额"), mny(e.original, e.currency)),
      fact(recv ? t("对方还欠") : t("我还欠"), `<b>${mny(e.balance, e.currency)}</b>`), fact(t("到期"), e.maturity_date ? esc(fmtDate(e.maturity_date)) : "—"),
      fact(t("利息"), e.paid.interest ? mny(e.paid.interest, e.currency) : "—")]
    : [fact(t("贷款方"), esc(e.counterparty_name || "—")), fact(t("原始本金"), mny(e.original, e.currency)), fact(t("未还本金"), `<b>${mny(e.balance, e.currency)}</b>`),
      fact(t("年利率"), pct(e.interest_rate)), fact(t("期限"), e.term_months ? t("{n} 个月", { n: e.term_months }) : "—"), fact(t("每期本息"), mny(e.pi, e.currency)),
      e.escrow ? fact(t("每期 Escrow"), mny(e.escrow, e.currency)) : "", fact(t("下次还款"), e.nextDue ? esc(fmtDate(e.nextDue)) : "—"),
      fact(t("预计还清"), e.payoff ? esc(fmtDate(e.payoff)) : "—"), fact(t("已还本金 / 利息"), `${mny(e.paid.principal, e.currency)} / ${mny(e.paid.interest, e.currency)}`),
      fact(t("资产"), linkedText(e) || "—"), e.financing_role ? fact(t("融资关系"), esc(t(ROLES[e.financing_role])) + (e.secured ? ` · ${t("抵押")}` : "")) : "",
      e.bill ? fact(t("账单"), `<a href="${esc(href("bill", e.bill.id))}">${esc(e.bill.name)}</a>`) : ""];
  return `<section class="section">
    <div class="fa-head" style="margin-bottom:6px">${catBadge(e)}${statusBadge(e)}${e.opening_balance != null ? `<small class="muted">${t("{d} 起记录，当时余额 {a}", { d: fmtDate(e.opening_balance_on), a: mny(e.opening_balance, e.currency) })}</small>` : ""}
      <a class="btn btn-sm btn-ghost fa-edit" href="${esc(debtHref(e.id, "&edit=1"))}">${t("编辑")}</a></div>
    <div class="panel"><div class="fa-facts">${facts.join("")}</div>${e.notes ? `<p class="muted" style="margin:8px 0 0;white-space:pre-line">${esc(e.notes)}</p>` : ""}</div>
    ${personal ? "" : `<div class="section-head" style="margin-top:16px"><h2>${t("每期还款拆分")}</h2>${e.bill && e.split ? `<button type="button" class="btn btn-sm" data-debt="resplit" data-id="${esc(e.id)}">${t("按摊还表重新拆分")}</button>` : ""}</div>
      <div class="panel">${paymentsHtml(e)}</div>
      <p class="hint">${t("本金记成「融资 / 还本」（不算消费），利息{e}算消费；Escrow 账单本身不记缴费，所以不会重复计算。", { e: e.escrow ? t("和 Escrow（房产税、保险）") : "" })}</p>`}
    ${personal ? `<div class="section-head" style="margin-top:16px"><h2>${t("还款记录")}</h2></div><div class="panel">${e.txns.length ? `<ul class="fa-list">${e.txns.slice().sort((a, b) => b.txn_date.localeCompare(a.txn_date)).map((x) => txnRow(x, null, { manage: true })).join("")}</ul>` : `<p class="muted">${t("还没有记录")}</p>`}</div>` : ""}
    <details class="panel ref-panel" style="margin-top:12px" ${personal ? "open" : ""}><summary><b>${personal ? t("记一笔还款 / 借款") : t("额外还本金")}</b><span class="mch" aria-hidden="true">›</span></summary>${recordForm(e)}</details>
    ${personal ? "" : `<details class="panel ref-panel" style="margin-top:12px"><summary><b>${t("摊还表")}</b><small>${t("按当前的本金、利率、期限算")}</small><span class="mch" aria-hidden="true">›</span></summary>${amortHtml(e)}</details>
      <details class="panel ref-panel" style="margin-top:12px" ${e.link_confirmed === false || !e.bill ? "open" : ""}><summary><b>${t("关联账单和资产")}</b><span class="mch" aria-hidden="true">›</span></summary>${linkPanel(e)}</details>`}
    <p style="margin-top:16px;text-align:right"><button type="button" class="btn btn-sm btn-ghost" data-debt="delete" data-id="${esc(e.id)}">${t("删除这笔借贷")}</button></p>
  </section>`;
}

/* ───────────── 新建 / 编辑 ───────────── */
function debtForm(d) {
  const q = state.route.q, bill = q.get("bill") ? state.billsEnriched.find((b) => b.id === q.get("bill")) : null;
  const catQ = q.get("cat") || (bill ? debtCatOfBill(bill.category) : null);
  const v = d || { category: catQ && DEBT_CATS[catQ] ? catQ : "mortgage", direction: q.get("dir") === "receivable" ? "receivable" : "payable", name: bill?.name || q.get("name") || "",
    counterparty_name: q.get("lender") || bill?.payee || "", original_principal: q.get("principal") || "", property_id: q.get("prop") || bill?.property_id || "", asset_id: q.get("asset") || "",
    start_date: q.get("start") || "", scheduled_payment: bill?.est ?? "", payment_frequency: bill ? freqOfBill(bill) : catQ === "personal_lending" ? "none" : "monthly", status: "active", secured: catQ ? debtCat(catQ).secured : true };
  const val = (k) => esc(v[k] ?? ""), personal = v.category === "personal_lending";
  const opt = (obj, sel) => Object.entries(obj).map(([k, x]) => `<option value="${k}" ${k === sel ? "selected" : ""}>${esc(t(typeof x === "string" ? x : x.name))}</option>`).join("");
  const loanAccts = (state.cards || []).filter((c) => c.kind === "loan");
  return `<form data-debt-form="debt" class="panel" novalidate>${d ? `<input type="hidden" name="id" value="${esc(d.id)}">` : ""}${bill ? `<input type="hidden" name="bill" value="${esc(bill.id)}">` : ""}
    ${bill ? `<p class="muted" style="margin:0 0 10px">${t("从账单「{n}」建贷款：账单继续管提醒和缴费，贷款记本金、利率和拆分。", { n: bill.name })}</p>` : ""}
    <div class="form-grid">
      <label>${t("类型")}<select name="category" data-debt-cat>${opt(DEBT_CATS, v.category)}</select></label>
      <label>${t("名称")}<input name="name" maxlength="60" required value="${val("name")}" placeholder="${esc(t("例如 房贷 · Chase"))}"></label>
      <label data-debt-personal ${personal ? "" : "hidden"}>${t("方向")}<select name="direction">${opt(DIRECTIONS, v.direction)}</select></label>
      <label>${personal ? t("对方（人名）") : t("贷款方")}<input name="counterparty_name" maxlength="80" value="${val("counterparty_name")}"></label>
      <label>${t("家里哪一位")}<select name="person_id"><option value="">${t("全家 / 不指定")}</option>${(state.people || []).filter((p) => p.kind !== "pet").map((p) => `<option value="${esc(p.id)}" ${p.id === v.person_id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>
      <label>${personal ? t("金额") : t("原始本金")}<input name="original_principal" type="number" inputmode="decimal" min="0" step="0.01" value="${val("original_principal")}"></label>
      <label>${t("年利率 %")}<input name="interest_rate" type="number" inputmode="decimal" min="0" max="100" step="0.001" value="${val("interest_rate")}"></label>
      <label>${t("期限（月）")}<input name="term_months" type="number" inputmode="numeric" min="1" max="600" step="1" value="${val("term_months")}"></label>
      <label>${t("起始日（放款）")}<input name="start_date" type="date" value="${val("start_date")}"></label>
      <label>${t("到期日")}<input name="maturity_date" type="date" value="${val("maturity_date")}"></label>
      <label>${t("还款频率")}<select name="payment_frequency">${opt(FREQS, v.payment_frequency)}</select></label>
      <label>${t("每期还款（含 Escrow）")}<input name="scheduled_payment" type="number" inputmode="decimal" min="0" step="0.01" value="${val("scheduled_payment")}"></label>
      <label>${t("某天的未还本金")}<input name="opening_balance" type="number" inputmode="decimal" min="0" step="0.01" value="${val("opening_balance")}"></label>
      <label>${t("那一天")}<input name="opening_balance_on" type="date" value="${val("opening_balance_on")}"></label>
      <label>${t("状态")}<select name="status">${opt(STATUSES, v.status)}</select></label>
      ${loanAccts.length ? `<label>${t("卡与账户里的贷款账户")}<select name="lender_card_id"><option value="">${t("不关联")}</option>${loanAccts.map((c) => `<option value="${esc(c.id)}" ${c.id === v.lender_card_id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label>` : ""}
      <label data-debt-asset ${personal ? "hidden" : ""}>${t("房产")}<select name="property_id"><option value="">${t("不关联")}</option>${state.properties.filter((p) => !p.archived || p.id === v.property_id).map((p) => `<option value="${esc(p.id)}" ${p.id === v.property_id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>
      <label data-debt-asset ${personal ? "hidden" : ""}>${t("车辆 / 资产")}<select name="asset_id"><option value="">${t("不关联")}</option>${vehicles().map((a) => `<option value="${esc(a.id)}" ${a.id === v.asset_id ? "selected" : ""}>${esc(assetName(a))}</option>`).join("")}</select></label>
      <label data-debt-asset ${personal ? "hidden" : ""}>${t("融资关系")}<select name="financing_role"><option value="">—</option>${opt(ROLES, v.financing_role || debtCat(v.category).role || "")}</select></label>
      <label class="check-inline" data-debt-asset ${personal ? "hidden" : ""}><input type="checkbox" name="secured" ${v.secured ? "checked" : ""}><span>${t("以这处资产抵押")}</span></label>
      <label style="grid-column:1/-1">${t("备注")}<textarea name="notes" maxlength="1000" rows="2">${val("notes")}</textarea></label>
    </div>
    <p class="muted" style="font-size:13px">${t("中途开始记的贷款：填「某天的未还本金」和那一天（看对账单），不用填原始本金；之前的还款会按利率倒推拆分。")}</p>
    <p class="form-error" role="alert" data-debt-err></p>
    <div class="form-actions"><button class="btn btn-primary">${d ? t("保存") : t("添加")}</button><a class="btn btn-ghost" href="${esc(d ? debtHref(d.id) : href("bills", "debts"))}">${t("取消")}</a></div></form>`;
}

export function viewDebts() {
  const q = state.route.q;
  if (!state.debtsOk) return `<section class="section"><div class="panel empty"><strong>${t("借贷还不能用")}</strong>${Store.mode === "cloud" ? t("数据库还没升级：请先执行 supabase/migrations/058_debt_lending.sql") : esc(state.debtsErr || "")}</div></section>`;
  if (q.get("new")) return `<section class="section">${debtForm(null)}</section>`;
  if (q.get("id")) return detail(q.get("id"));
  const tab = activeTab(state.route) || "asset", all = debtsEnriched();
  const open = all.filter((e) => !isClosedStatus(e.status));
  const owe = open.filter((e) => e.direction === "payable" && e.balance != null).reduce((s, e) => s + e.balance, 0);
  const lent = open.filter((e) => e.direction === "receivable" && e.balance != null).reduce((s, e) => s + e.balance, 0);
  const monthly = open.filter((e) => e.direction === "payable" && e.bill).reduce((s, e) => s + (e.bill.monthly || 0), 0);
  const overdue = open.filter((e) => e.overdue).length;
  return `<section class="section">
    <div class="kpis">
      <div class="kpi"><span>${t("未还贷款")}</span><b>${mny(A.r2(owe))}</b><small>${t("{n} 笔在还", { n: open.filter((e) => e.direction === "payable").length })}</small></div>
      <div class="kpi"><span>${t("每月还款")}</span><b>${mny(A.r2(monthly))}</b><small>${t("按关联账单折算")}</small></div>
      <div class="kpi"><span>${t("借出未收")}</span><b>${mny(A.r2(lent))}</b><small>${overdue ? t("{n} 笔逾期", { n: overdue }) : t("没有逾期")}</small></div>
    </div>
    ${tabBar(DEBT_TABS, tab, tabHref, t("借贷内容"))}
    ${listTab(tab, all)}
  </section>`;
}

/* ───────────── 动作 ───────────── */
const guard = async (fn) => { try { await fn(); } catch (e) { toast(t("操作失败：{msg}", { msg: e.message })); } };
const numOrNull = (v) => (v === "" || v == null ? null : Math.round(num(v) * 10000) / 10000);
const after = async () => { await loadDebts(); hooks.render(false); };

async function saveDebtForm(f) {
  const fd = new FormData(f), g = (k) => String(fd.get(k) ?? "").trim(), err = f.querySelector("[data-debt-err]");
  const id = g("id") || null, old = id ? debtById(id) : null, cat = g("category");
  const row = { ...(old || {}), id, name: g("name"), category: cat, direction: cat === "personal_lending" ? g("direction") || "payable" : "payable", counterparty_name: g("counterparty_name") || null,
    person_id: g("person_id") || null, lender_card_id: g("lender_card_id") || null, original_principal: numOrNull(g("original_principal")), interest_rate: numOrNull(g("interest_rate")),
    term_months: g("term_months") ? Math.round(num(g("term_months"))) : null, start_date: g("start_date") || null, maturity_date: g("maturity_date") || null, payment_frequency: g("payment_frequency") || "monthly",
    scheduled_payment: numOrNull(g("scheduled_payment")), opening_balance: numOrNull(g("opening_balance")), opening_balance_on: g("opening_balance_on") || null, status: g("status") || "active",
    property_id: cat === "personal_lending" ? null : g("property_id") || null, asset_id: cat === "personal_lending" ? null : g("asset_id") || null, financing_role: g("financing_role") || null,
    secured: fd.get("secured") === "on", notes: g("notes") || null, currency: old?.currency || cur() };
  if (!row.name) { err.textContent = t("请填名称"); return; }
  if ((row.opening_balance == null) !== !row.opening_balance_on) { err.textContent = t("「某天的未还本金」和「那一天」要一起填"); return; }
  if (old && old.asset_id !== row.asset_id) row.link_confirmed = true;   // 用户自己选的车辆：算确认
  const btn = f.querySelector("button.btn-primary"); btn.disabled = true;
  try {
    const termsChanged = !old || ["original_principal", "interest_rate", "term_months", "start_date", "payment_frequency", "scheduled_payment", "opening_balance", "opening_balance_on"].some((k) => String(old[k] ?? "") !== String(row[k] ?? ""));
    const newId = await Store.saveDebt(row);
    if (g("bill")) await Store.linkBillDebt(g("bill"), newId);
    await loadDebts(); if (g("bill")) await hooks.refresh();
    const d = debtById(newId);
    let n = 0;
    if (d && termsChanged) { if (canSplit(d)) n = await resplitDebt(d); else if (old) await unsplitDebt(d); }
    if (d) { await syncDebtStatus(d.id); await syncVehicle(debtById(d.id)); }
    toast(n ? t("已保存，拆分了 {n} 笔历史还款", { n }) : t("已保存"));
    go(debtHref(newId), { replace: true });
  } catch (e) { err.textContent = t("保存失败：{msg}", { msg: e.message }); btn.disabled = false; }
}

export function initDebts({ render, refresh }) {
  hooks = { render, refresh };
  const main = document.getElementById("main");
  main.addEventListener("change", (e) => {
    const s = e.target.closest?.("[data-debt-cat]"); if (!s) return;
    const personal = s.value === "personal_lending", f = s.closest("form");
    f.querySelectorAll("[data-debt-personal]").forEach((x) => { x.hidden = !personal; });
    f.querySelectorAll("[data-debt-asset]").forEach((x) => { x.hidden = personal; });
    if (f.elements.secured && !f.elements.id) f.elements.secured.checked = debtCat(s.value).secured;
    if (f.elements.financing_role && !f.elements.id) f.elements.financing_role.value = debtCat(s.value).role || "";
  });
  main.addEventListener("click", (e) => {
    const b = e.target.closest?.("[data-debt]"); if (!b) return;
    const act = b.dataset.debt, id = b.dataset.id, d = id ? debtById(id) : null;
    if (act === "tx-more") { ui().txLimit = (ui().txLimit || 50) + 50; return render(false); }
    if (act === "pay-more") { ui().payLimit = (ui().payLimit || 12) + 24; return render(false); }
    if (act === "amort-all") { ui().amortAll = ui().amortAll === id ? null : id; return render(false); }
    if (act === "resplit" && d) return guard(async () => { b.disabled = true; const n = await resplitDebt(d); toast(t("已按摊还表拆分 {n} 笔还款", { n })); await after(); });
    if (act === "override-clear" && d) return guard(async () => { await clearOverride(d, b.dataset.pay); toast(t("已改回按摊还表")); await after(); });
    if (act === "link-confirm" && d) return guard(async () => { await Store.saveDebt({ ...d, link_confirmed: true }); await loadDebts(); await syncVehicle(debtById(id)); toast(t("已确认")); await after(); });
    if (act === "link-clear" && d) return guard(async () => { await Store.saveDebt({ ...d, asset_id: null, link_confirmed: true }); toast(t("已解除关联")); await after(); });
    if (act === "txn-del") { if (!armed(b, t("再点一次确认删除"))) return; return guard(async () => { await deleteDebtTxn(id); await loadIncome(); toast(t("已删除")); await after(); }); }
    if (act === "delete" && d) {
      if (!armed(b, t("再点一次确认删除（花费、收入、账单都保留）"))) return;
      return guard(async () => { const bill = billOfDebt(d); if (bill) await unsplitDebt(d, bill); await Store.deleteDebt(id); await loadDebts(); await hooks.refresh(); toast(t("已删除")); go(href("bills", "debts"), { replace: true }); });
    }
  });
  main.addEventListener("submit", (e) => {
    const f = e.target.closest?.("[data-debt-form]"); if (!f) return;
    e.preventDefault(); e.stopPropagation();
    const kind = f.dataset.debtForm, d = f.dataset.id ? debtById(f.dataset.id) : null, fd = new FormData(f), g = (k) => String(fd.get(k) ?? "").trim();
    if (kind === "debt") return saveDebtForm(f);
    if (kind === "override" && d) return guard(async () => { await overrideSplit(d, f.dataset.pay, { principal: g("principal"), interest: g("interest"), escrow: g("escrow") }); toast(t("已按对账单改")); await after(); });
    if (kind === "txn" && d) return guard(async () => {
      const principal = num(g("principal")), interest = num(g("interest"));
      if (!(principal > 0) && !(interest > 0)) return toast(t("请填金额"));
      const acct = g("acct") || null, card = acct ? (state.cards || []).find((c) => c.id === acct) : null;
      const n = await recordDebtTxn(d, { kind: g("kind"), date: g("date") || todayISO(), principal, interest, cash: fd.get("cash") === "on", card_id: card && !["checking", "savings", "brokerage", "retirement", "hsa", "cash", "loan"].includes(card.kind) ? card.id : null, account_id: card?.id || null, notes: g("notes") || null });
      if (fd.get("cash") === "on") await loadIncome();
      toast(n ? t("已记录") : t("没有要记的金额")); await after();
    });
    if (kind === "link" && d) return guard(async () => {
      const billId = g("bill") || null, cur0 = billOfDebt(d);
      if (cur0 && cur0.id !== billId) { await unsplitDebt(d, cur0); await Store.linkBillDebt(cur0.id, null); }
      if (billId && (!cur0 || cur0.id !== billId)) await Store.linkBillDebt(billId, d.id);
      const patch = { ...d };
      if (f.elements.property_id) patch.property_id = g("property_id") || null;
      if (f.elements.asset_id) { patch.asset_id = g("asset_id") || null; if (patch.asset_id !== d.asset_id) patch.link_confirmed = true; }
      await Store.saveDebt(patch);
      await hooks.refresh(); await loadDebts();
      if (billId && (!cur0 || cur0.id !== billId) && canSplit(debtById(d.id))) await resplitDebt(debtById(d.id));
      await syncVehicle(debtById(d.id));
      toast(t("已保存关联")); await after();
    });
  });
}
