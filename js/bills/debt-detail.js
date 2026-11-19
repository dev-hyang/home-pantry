/* 借贷详情页：校准、记一笔、关联面板、头部、个人借贷详情和详情本体。 */
import * as A from "../core/amortization.js";
import { DIRECTIONS, debtCat, isClosedStatus, isLoanBillCat, isPersonalDebt } from "../core/debt-rules.js";
import { amortHtml, breakdownHtml, daysText, kpi, payTableHtml, termsHtml } from "./debt-detail-tables.js";
import { assetName } from "../house/assets.js";
import { debt060, debtHref, paymentTable } from "./debt-logic.js";
import { debtForm } from "./debt-form.js";
import { esc, fmtDate, todayISO } from "../core/util.js";
import { href } from "../core/router.js";
import { recordsList } from "./debt-records.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";
import { txnRow, txnsOf0 } from "./debts-tabs.js";
import { catBadge, hooks, linkedText, mny, pct, periodPay, statusBadge, ui, vehicles } from "./debt-common.js";
import { debtById, enrichDebt } from "./debt-logic-common.js";

/** 改一期（按对账单）：本金 / 额外本金 / 利息 / Escrow */
export function overrideForm(e, r) {
  const v = r.saved && r.source === "manual" ? { principal: A.r2(r.saved.principal_amount - r.saved.extra_principal), extra: r.saved.extra_principal, interest: r.saved.interest_amount, escrow: r.saved.escrow_amount } : { principal: A.r2(r.principal - r.extra), extra: r.extra, interest: r.interest, escrow: r.escrow };
  return `<form id="dd-edit" data-debt-form="override" data-id="${esc(e.id)}" data-pay="${esc(r.id)}" class="dd-edit" aria-label="${esc(t("改 {d} 这一期", { d: fmtDate(r.paid_on) }))}">
    <p class="dd-edit-title"><b>${t("改 {d} 这一期（按对账单）", { d: fmtDate(r.paid_on) })}</b> <small class="muted">${t("实付 {a}", { a: mny(r.total, e.currency) })}</small></p>
    <div class="form-grid">
      <label>${t("本金")}<input type="number" name="principal" inputmode="decimal" step="0.01" min="0" value="${v.principal}" required></label>
      <label>${t("额外本金")}<input type="number" name="extra" inputmode="decimal" step="0.01" min="0" value="${v.extra || ""}"></label>
      <label>${t("利息")}<input type="number" name="interest" inputmode="decimal" step="0.01" min="0" value="${v.interest}"></label>
      <label>Escrow<input type="number" name="escrow" inputmode="decimal" step="0.01" min="0" value="${v.escrow}"></label>
    </div>
    <div class="form-actions"><button class="btn btn-sm btn-primary">${t("保存这一期")}</button>${r.source === "manual" ? `<button type="button" class="btn btn-sm btn-ghost" data-debt="override-clear" data-id="${esc(e.id)}" data-pay="${esc(r.id)}">${t("改回按摊还表")}</button>` : ""}<button type="button" class="btn btn-sm btn-ghost" data-debt="pay-edit" data-pay="">${t("取消")}</button></div>
  </form>`;
}
/** 不能按摊还表拆时：已存的拆分流水（迁移来的 / 以前拆的） */
export function savedListHtml(e) {
  const list = e.txns.filter((x) => x.bill_payment_id).sort((a, b) => b.txn_date.localeCompare(a.txn_date)).slice(0, ui().payLimit || 12);
  return list.length ? `<ul class="fa-list dd-rows">${list.map((x) => txnRow(x, null)).join("")}</ul>` : "";
}
/** 读逐期表（读一次这条账单的缴费）；读完重画 */
export function loadPayTable(id) {
  if (ui().ptLoading === id) return;
  ui().ptLoading = id;
  const d = debtById(id);
  paymentTable(d).then((data) => { ui().pt = { id, data }; }, (err) => { ui().pt = { id, err: t("读取缴费记录失败：{msg}", { msg: err.message }) }; })
    .finally(() => { ui().ptLoading = null; if (state.route.q.get("id") === id) hooks.render(false); });
}
/** 用对账单校准：填一期的日期、本金、利息（和还款后余额）→ 和摊还表对照；可以存成校准（本息以对账单为准）或者作为记录起点 */
function calibrateHtml(e) {
  const c = ui().calib?.id === e.id ? ui().calib : null, sc = e.statement_check || {}, v = c?.input || sc, cur = e.currency;
  const res = c?.res;
  const hint = (h) => ({
    pi_mismatch: t("按公式算的本息 {a}，对账单是 {b}：原始本金、利率或期限可能填得不对（存成校准后以对账单为准）。", { a: mny(h.calc, cur), b: mny(h.stmt, cur) }),
    shift: t("对账单和摊还表的第 {k} 期一致：第一期还款日可能{w}了一个月。", { k: h.k, w: h.by < 0 ? t("填晚") : t("填早") }),
    extra_before: t("对账单的余额比摊还表少约 {a}：之前可能有额外还本金（在下面「额外还本金」里补记，或作为记录起点）。", { a: mny(h.amount, cur) }),
    no_schedule: t("缺第一期还款日或本金，没法对到第几期；可以把这张对账单作为记录起点。"),
    before_anchor: t("这一期在记录起点之前，没法对照。"),
  })[h.code] || h.code;
  const out = res ? `<div class="dd-calib-res" role="status">
      ${res.expected ? `${res.ok ? `<p class="dd-ok-line">✓ ${t("和摊还表第 {k} 期逐分一致", { k: res.k })}</p>` : `<p class="dd-warn-line">⚠ ${t("和摊还表第 {k} 期不一致", { k: res.k })}</p>`}
        <div class="table-scroll" tabindex="0" role="region" aria-label="${esc(t("对账单和摊还表对照"))}"><table class="dd-tbl"><thead><tr><th scope="col"></th><th scope="col" class="num">${t("对账单")}</th><th scope="col" class="num">${t("摊还表")}</th><th scope="col" class="num">${t("差")}</th></tr></thead><tbody>
        <tr><th scope="row">${t("本金")}</th><td class="num">${mny(v.principal, cur)}</td><td class="num">${mny(res.expected.principal, cur)}</td><td class="num">${mny(res.diff.principal, cur)}</td></tr>
        <tr><th scope="row">${t("利息")}</th><td class="num">${mny(v.interest, cur)}</td><td class="num">${mny(res.expected.interest, cur)}</td><td class="num">${mny(res.diff.interest, cur)}</td></tr>
        ${res.diff.balance != null ? `<tr><th scope="row">${t("还款后余额")}</th><td class="num">${mny(v.balance, cur)}</td><td class="num">${mny(res.expected.balance, cur)}</td><td class="num">${mny(res.diff.balance, cur)}</td></tr>` : ""}
        </tbody></table></div>` : ""}
      ${res.impliedAfter != null ? `<p class="muted dd-note">${t("由利息倒推：期初余额约 {a}，还款后约 {b}（四舍五入误差 ± 几毛）", { a: mny(res.impliedBefore, cur), b: mny(res.impliedAfter, cur) })}</p>` : ""}
      ${res.hints.length ? `<ul class="dd-hints">${res.hints.map((h) => `<li>${esc(hint(h))}</li>`).join("")}</ul>` : ""}
      <div class="form-actions">${debt060() ? `<button type="button" class="btn btn-sm" data-debt="calib-save" data-id="${esc(e.id)}">${t("存成校准（本息 = {a}）", { a: mny(res.pi, cur) })}</button>` : ""}
        ${!res.ok ? `<button type="button" class="btn btn-sm btn-ghost" data-debt="calib-anchor" data-id="${esc(e.id)}">${t("作为记录起点（{d} 余额 {a}）", { d: fmtDate(v.date), a: mny(v.balance !== "" && v.balance != null ? v.balance : res.impliedAfter, cur) })}</button>` : ""}</div>
    </div>` : "";
  return `<form data-debt-form="calib" data-id="${esc(e.id)}" class="form-grid">
      <label>${t("对账单这一期的还款日")}<input type="date" name="date" required value="${esc(v.date || "")}"></label>
      <label>${t("本金")}<input type="number" name="principal" inputmode="decimal" step="0.01" min="0" required value="${esc(v.principal ?? "")}"></label>
      <label>${t("利息")}<input type="number" name="interest" inputmode="decimal" step="0.01" min="0" required value="${esc(v.interest ?? "")}"></label>
      <label>${t("还款后余额（可不填）")}<input type="number" name="balance" inputmode="decimal" step="0.01" min="0" value="${esc(v.balance ?? "")}"></label>
      <div class="form-actions" style="grid-column:1/-1"><button class="btn btn-sm btn-primary">${t("核对")}</button>${e.statement_check ? `<button type="button" class="btn btn-sm btn-ghost" data-debt="calib-clear" data-id="${esc(e.id)}">${t("取消校准")}</button>` : ""}</div>
    </form>${out}
    ${e.statement_check ? `<p class="muted dd-note">${t("已校准：{d} 本金 {p} + 利息 {i}", { d: fmtDate(sc.date), p: mny(sc.principal, cur), i: mny(sc.interest, cur) })}</p>` : ""}`;
}
function recordForm(e) {
  const personal = isPersonalDebt(e), recv = e.direction === "receivable";
  const kinds = personal ? [["repay", recv ? t("对方还我") : t("我还对方")], ["lend", recv ? t("又借出") : t("又借入")]] : [["extra", t("额外还本金")]];
  const accts = (state.cards || []).filter((c) => c.active !== false);
  return `<form data-debt-form="txn" data-id="${esc(e.id)}" class="form-grid">
    <label>${t("类型")}<select name="kind">${kinds.map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join("")}</select></label>
    <label>${t("日期")}<input type="date" name="date" value="${todayISO()}" max="${todayISO()}" required></label>
    <label>${t("本金")}<input type="number" name="principal" inputmode="decimal" step="0.01" min="0" value="${personal && e.balance > 0 ? e.balance : ""}"></label>
    ${personal ? `<label>${recv ? t("利息（收到的）") : t("利息（付的）")}<input type="number" name="interest" inputmode="decimal" step="0.01" min="0"></label>` : ""}
    <label>${t("账户")}<select name="acct"><option value="">${t("不指定")}</option>${accts.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}${c.last4 ? ` ··${esc(c.last4)}` : ""}</option>`).join("")}</select></label>
    <label>${t("备注")}<input name="notes" maxlength="200"></label>
    <label class="check-inline" style="grid-column:1/-1"><input type="checkbox" name="cash" checked><span>${personal ? (recv ? t("同时记一笔收入（收回本金不算收入，利息算投资收益）") : t("同时记一笔花费（还本金不算消费）")) : t("同时记一笔花费（性质：融资 / 还本）")}</span></label>
    <small class="muted" style="grid-column:1/-1">${personal ? t("如果这笔钱已经从对账单导入了，取消勾选，只记借贷流水。") : t("和月供一起付的额外本金：在上面的表里标在那一期上，不用在这里另记。")}</small>
    <div class="form-actions"><button class="btn btn-sm btn-primary">${t("记一笔")}</button></div></form>`;
}
/** 迁移按名字猜的车辆：请用户确认 */
const proposalHtml = (e) => (e.asset_id && e.link_confirmed === false ? `<p class="notice" role="status">${t("迁移时按名字猜这笔车贷对应「{v}」。对吗？", { v: e.asset ? assetName(e.asset) : "?" })}
      <button type="button" class="btn btn-sm btn-primary" data-debt="link-confirm" data-id="${esc(e.id)}">${t("对，确认")}</button> <button type="button" class="btn btn-sm btn-ghost" data-debt="link-clear" data-id="${esc(e.id)}">${t("不对，解除")}</button></p>` : "");
function linkPanel(e) {
  const bills = state.billsEnriched.filter((b) => isLoanBillCat(b.category) && b.direction !== "receivable" && (!b.debt_id || b.debt_id === e.id));
  const target = debtCat(e.category).target;
  const props = state.properties.filter((p) => !p.archived || p.id === e.property_id), vs = vehicles().filter((a) => window.VEHICLES.isActive(a) || a.id === e.asset_id);
  return `<form data-debt-form="link" data-id="${esc(e.id)}" class="form-grid">
    <label>${t("还款账单")}<select name="bill"><option value="">${t("不关联")}</option>${bills.map((b) => `<option value="${esc(b.id)}" ${b.debt_id === e.id ? "selected" : ""}>${esc(b.name)}${b.est != null ? ` · ${esc(mny(b.est, b.currency))}` : ""}</option>`).join("")}</select></label>
    ${target !== "vehicle" ? `<label>${t("房产")}<select name="property_id"><option value="">${t("不关联")}</option>${props.map((p) => `<option value="${esc(p.id)}" ${p.id === e.property_id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>` : ""}
    ${target !== "property" ? `<label>${t("车辆")}<select name="asset_id"><option value="">${t("不关联")}</option>${vs.map((a) => `<option value="${esc(a.id)}" ${a.id === e.asset_id ? "selected" : ""}>${esc(assetName(a))}</option>`).join("")}</select></label>` : ""}
    <div class="form-actions" style="grid-column:1/-1"><button class="btn btn-sm">${t("保存关联")}</button></div></form>`;
}
const fold = (title, sub, body, { open = false, id = "" } = {}) => `<details class="panel ref-panel dd-fold"${id ? ` id="${id}"` : ""} ${open ? "open" : ""}><summary><b>${title}</b>${sub ? `<small>${sub}</small>` : ""}<span class="mch" aria-hidden="true">›</span></summary><div class="dd-fold-body">${body}</div></details>`;
/** 详情头部：名称、类型 / 状态、对方 · 资产 · 账单、编辑 */
function headHtml(e) {
  const personal = isPersonalDebt(e), who = personal ? e.counterparty_name || e.name : e.name;
  const sub = personal ? [esc(t(DIRECTIONS[e.direction].name)), e.person_id ? esc((state.people || []).find((p) => p.id === e.person_id)?.name || "") : null]
    : [e.counterparty_name ? esc(e.counterparty_name) : null, linkedText(e) || null, e.bill ? `<a href="${esc(href("bill", e.bill.id))}">🧾 ${esc(e.bill.name)}</a>` : null];
  return `<header class="dd-head">
    <div class="dd-title"><h2>${esc(who)}</h2><span class="dd-badges">${personal ? "" : catBadge(e)}${statusBadge(e)}</span></div>
    <p class="dd-sub">${sub.filter(Boolean).join(`<span aria-hidden="true"> · </span>`)}</p>
    <a class="btn btn-sm btn-ghost dd-edit-btn" href="${esc(debtHref(e.id, "&edit=1"))}">${t("编辑")}<span class="sr-only"> ${esc(who)}</span></a>
  </header>`;
}
function personalDetail(e) {
  const recv = e.direction === "receivable", paidPct = e.original > 0 && e.balance != null ? Math.round(((e.original - e.balance) / e.original) * 100) : null, c = e.currency;
  const n = e.txns.length, open = ui().recOpen === e.id;
  return `<section class="section debt-detail">${headHtml(e)}
    <div class="kpis dd-kpis">
      ${kpi(recv ? t("对方还欠") : t("我还欠"), mny(e.balance, c), paidPct != null ? t("已还 {p}%", { p: paidPct }) : "")}
      ${kpi(t("金额"), mny(e.original, c), e.start_date ? esc(fmtDate(e.start_date)) : "")}
      ${kpi(t("到期"), e.maturity_date ? esc(fmtDate(e.maturity_date)) : "—", e.maturity_date && !isClosedStatus(e.status) ? `<span class="${e.overdue ? "dd-warn" : ""}">${esc(daysText(e.maturity_date))}</span>` : t("没约定"))}
      ${kpi(recv ? t("收到的利息") : t("付的利息"), e.paid.interest ? mny(e.paid.interest, c) : "—")}
    </div>
    ${e.notes ? `<p class="muted dd-notes">${esc(e.notes)}</p>` : ""}
    <div class="section-head dd-sec"><h2>${t("还款记录")}</h2><div class="head-acts"><small class="muted">${t("{n} 条", { n })}</small>
      <button type="button" class="btn btn-sm ${open ? "btn-ghost" : "btn-primary"}" data-debt="rec-open" data-id="${esc(e.id)}" aria-expanded="${open}" aria-controls="dd-rec-form">${open ? t("收起") : `＋ ${t("记一笔还款")}`}</button></div></div>
    ${open ? `<div class="panel dd-rec-form" id="dd-rec-form">${recordForm(e)}</div>` : ""}
    <div class="panel">${recordsList(`p-${e.id}`, { txns: () => e.txns, empty: t("还没有记录") })}</div>
    <p class="dd-foot"><button type="button" class="btn btn-sm btn-ghost" data-debt="delete" data-id="${esc(e.id)}">${t("删除这笔借贷")}</button></p>
  </section>`;
}
export function detail(id) {
  const d = debtById(id);
  if (!d) return `<section class="section"><div class="panel empty"><strong>${t("找不到这笔借贷")}</strong><p><a class="btn btn-primary" href="${esc(href("bills", "debts"))}">${t("回到借贷")}</a></p></div></section>`;
  if (state.route.q.get("edit")) return `<section class="section">${debtForm(d)}</section>`;
  const e = enrichDebt(d), c = e.currency;
  if (isPersonalDebt(e)) return personalDetail(e);
  if (ui().ptRoute !== state.route) { ui().ptRoute = state.route; ui().pt = null; ui().editPay = null; }   // 每次打开详情都重新读逐期表（缴费可能在账单页改过）
  const pay = periodPay(e);
  return `<section class="section debt-detail">${headHtml(e)}
    <div class="kpis dd-kpis">
      ${kpi(t("未还本金"), e.balance != null ? mny(e.balance, c) : "—", e.original > 0 && e.balance != null ? t("已还 {p}%", { p: Math.round(((e.original - e.balance) / e.original) * 100) }) : "")}
      ${kpi(t("每期还款"), pay != null ? mny(pay, c) : "—", e.pi != null ? `${t("本息 {a}", { a: mny(e.pi, c) })}${e.escrow ? ` + Escrow ${mny(e.escrow, c)}` : ""}` : "")}
      ${kpi(t("利率 / 期限"), `${pct(e.interest_rate)}`, e.term_months ? t("{n} 个月", { n: e.term_months }) : "")}
      ${kpi(t("下次还款"), e.nextDue ? esc(fmtDate(e.nextDue)) : "—", e.nextDue ? `<span class="${e.overdue ? "dd-warn" : ""}">${esc(daysText(e.nextDue))}</span>` : e.bill ? t("账单没填到期日") : t("没挂账单"))}
    </div>
    ${proposalHtml(e)}
    <div class="dd-grid">
      <div class="panel dd-card"><h3>${t("下一期构成")}</h3>${breakdownHtml(e)}</div>
      <div class="panel dd-card"><h3>${t("贷款条款")}</h3>${termsHtml(e)}${e.notes ? `<p class="muted dd-notes">${esc(e.notes)}</p>` : ""}</div>
    </div>
    <div class="section-head dd-sec"><h2>${t("每期还款拆分")}</h2>${e.bill && e.split ? `<div class="dd-resplit"><label class="check-inline"><input type="checkbox" data-debt-overwrite ${ui().overwrite ? "checked" : ""}><span>${t("覆盖手动改过的")}</span></label><button type="button" class="btn btn-sm" data-debt="resplit" data-id="${esc(e.id)}">${t("按摊还表重新拆分")}</button></div>` : ""}</div>
    <div class="panel">${payTableHtml(e)}</div>
    <p class="hint">${t("本息只按摊还表算（第 k 期 = 第一期还款日往后 k−1 个月，早几天晚几天交都对到那一期）；Escrow = 实付 − 本息 − 额外本金。本金记成「融资 / 还本」（不算消费），利息{e}算消费。", { e: e.escrow ? t("和 Escrow（房产税、保险）") : "" })}</p>
    ${otherTxnsHtml(e)}
    ${fold(t("摊还表"), t("按原始本金、利率、期限算"), amortHtml(e))}
    ${fold(t("用对账单校准"), t("核对第几期、本金和利息是否逐分一致"), calibrateHtml(e), { open: ui().calib?.id === e.id })}
    ${fold(t("额外还本金"), t("不和月供一起付的"), recordForm(e))}
    ${fold(t("关联账单和资产"), "", linkPanel(e), { open: !e.bill })}
    <p class="dd-foot"><button type="button" class="btn btn-sm btn-ghost" data-debt="delete" data-id="${esc(e.id)}">${t("删除这笔借贷")}</button></p>
  </section>`;
}
/** 不挂缴费的流水（额外还本、放款、调整） */
function otherTxnsHtml(e) {
  const others = () => txnsOf0(e.id).filter((x) => !x.bill_payment_id);
  return others().length ? `<div class="section-head dd-sec"><h2>${t("其他流水")}</h2></div><div class="panel">${recordsList(`o-${e.id}`, { txns: others })}</div>` : "";
}
