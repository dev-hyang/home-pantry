/* 借贷：新建 / 编辑表单。 */
import { numAttrs } from "../core/ui-num.js";
import { AGREEMENTS, DEBT_CATS, DIRECTIONS, FREQS, ROLES, STATUSES, debtCat, debtCatOfBill, freqOfBill } from "../core/debt-rules.js";
import { DEBT_TABS, activeTab } from "../core/tabs.js";
import { viewSwitch } from "../core/view-switch.js";
import { viewMode } from "./debt-stats.js";
import { SEGS } from "./debt-stats.js";
import { Store } from "../core/store.js";
import { af, pf, tabFilter, tabPage } from "./debts-tabs.js";
import { assetName } from "../house/assets.js";
import { debt060, debt104, debtHref } from "./debt-logic.js";
import { detail } from "./debt-detail.js";
import { esc, todayISO } from "../core/util.js";
import { href } from "../core/router.js";
import { setRecordFilter } from "./debt-records.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";
import { tabHref, ui, vehicles } from "./debt-common.js";
import { debtsEnriched } from "./debt-logic-common.js";
import { pageHead } from "../core/page-head.js";
import { curSec, fsec, secTitle } from "../core/form-sec.js";
import { DEBT_SEC_NAMES } from "./debt-sections.js";
import { dwActions, dwChrome } from "./debt-wizard.js";

/* ───────────── 新建 / 编辑 ───────────── */
/** 银行的 Escrow 计划：每行 从哪个月起 + 每期金额（已有的几行 + 两行空的） */
function escrowFields(v, personal, sec = "") {
  const rows = [...(v.escrow_schedule || []), { from: "", amount: "" }, { from: "", amount: "" }];
  return `<fieldset ${fsec("pay", sec)} class="dd-escrow" data-debt-asset ${personal ? "hidden" : ""} style="grid-column:1/-1"><legend>${t("Escrow 计划（银行每期收的 Escrow，可选）")}</legend>
    ${rows.map((r, i) => `<div class="dd-escrow-row"><label>${t("从哪个月起")}<input type="month" name="escrow_from" value="${esc(r.from || "")}" aria-label="${esc(t("第 {n} 行：从哪个月起", { n: i + 1 }))}"></label><label>${t("每期金额")}<input ${numAttrs("money")} name="escrow_amount" value="${esc(r.amount ?? "")}" aria-label="${esc(t("第 {n} 行：每期金额", { n: i + 1 }))}"></label></div>`).join("")}
    <small class="muted">${t("只用来提示多付的部分（可标成额外本金）；本金 / 利息只按摊还表算。清空一行就是删掉。")}</small></fieldset>`;
}
export function debtForm(d) {
  const q = state.route.q, bill = q.get("bill") ? state.billsEnriched.find((b) => b.id === q.get("bill")) : null;
  const catQ = q.get("cat") || (bill ? debtCatOfBill(bill.category) : null);
  const v = d || { category: catQ && DEBT_CATS[catQ] ? catQ : "mortgage", direction: q.get("dir") === "receivable" ? "receivable" : "payable", name: bill?.name || q.get("name") || "",
    counterparty_name: q.get("lender") || bill?.payee || "", original_principal: q.get("principal") || "", property_id: q.get("prop") || bill?.property_id || "", asset_id: q.get("asset") || "",
    start_date: q.get("start") || "", interest_rate: q.get("rate") || "", term_months: q.get("term") || "", scheduled_payment: q.get("pay") || (bill?.est ?? ""), payment_frequency: bill ? freqOfBill(bill) : catQ === "personal_lending" ? "none" : "monthly", status: "active", secured: catQ ? debtCat(catQ).secured : true };
  const sec = d ? curSec(DEBT_SEC_NAMES) : "";   // 详情页某一块的「编辑」：只显示那一块（core/form-sec.js）
  const val = (k) => esc(v[k] ?? ""), personal = v.category === "personal_lending";
  const opt = (obj, sel) => Object.entries(obj).map(([k, x]) => `<option value="${k}" ${k === sel ? "selected" : ""}>${esc(t(typeof x === "string" ? x : x.name))}</option>`).join("");
  const loanAccts = (state.cards || []).filter((c) => c.kind === "loan"), has060 = debt060();
  return `<form data-debt-form="debt" class="panel" novalidate ${d ? "" : "data-dwz=\"1\""}>${secTitle(DEBT_SEC_NAMES[sec], sec)}${d ? "" : dwChrome(personal)}${d ? `<input type="hidden" name="id" value="${esc(d.id)}">` : ""}${bill ? `<input type="hidden" name="bill" value="${esc(bill.id)}">` : ""}
    ${bill ? `<p data-fsec="basic" class="muted" style="margin:0 0 10px">${t("从账单「{n}」建贷款：账单继续管提醒和缴费，贷款记本金、利率和拆分。", { n: bill.name })}</p>` : ""}
    <div class="form-grid">
      <label ${fsec("basic", sec)}>${t("类型")}<select name="category" data-debt-cat>${opt(DEBT_CATS, v.category)}</select></label>
      <label ${fsec("basic", sec)}>${t("名称")}<input name="name" maxlength="60" required value="${val("name")}" placeholder="${esc(t("例如 房贷 · Chase"))}"></label>
      <label ${fsec("basic", sec)} data-debt-personal ${personal ? "" : "hidden"}>${t("方向")}<select name="direction">${opt(DIRECTIONS, v.direction)}</select></label>
      <label ${fsec("basic", sec)}>${personal ? t("对方（人名）") : t("贷款方")}<input name="counterparty_name" maxlength="80" value="${val("counterparty_name")}"></label>
      <label ${fsec("basic", sec)}>${t("家里哪一位")}<select name="person_id"><option value="">${t("全家 / 不指定")}</option>${(state.people || []).filter((p) => p.kind !== "pet").map((p) => `<option value="${esc(p.id)}" ${p.id === v.person_id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>
      <label ${fsec("terms", sec)}>${personal ? t("金额") : t("原始本金")}<input name="original_principal" ${numAttrs("money")} value="${val("original_principal")}"></label>
      ${debt104() ? `<label ${fsec("terms", sec)} data-debt-personal ${personal ? "" : "hidden"}>${t("借款凭证")}<select name="agreement"><option value="">${t("还没填")}</option>${opt(AGREEMENTS, v.agreement)}</select></label>
      <label ${fsec("terms", sec)} data-debt-personal ${personal ? "" : "hidden"}>${t("借据放在哪（可选）")}<input name="agreement_note" maxlength="120" value="${val("agreement_note")}" placeholder="${esc(t("Drive / 家庭文件"))}"></label>` : ""}
      <label ${fsec("terms", sec)}>${t("年利率 %")}<input name="interest_rate" ${numAttrs("rate")} value="${val("interest_rate")}"></label>
      <label ${fsec("terms", sec)}>${t("期限（月）")}<input name="term_months" ${numAttrs("int", { max: 600, min: 1 })} value="${val("term_months")}"></label>
      <label ${fsec("terms", sec)}>${t("起始日（放款）")}<input name="start_date" type="date" value="${val("start_date")}"></label>
      ${has060 ? `<label ${fsec("terms", sec)} data-debt-asset ${personal ? "hidden" : ""}>${t("第一期还款日")}<input name="first_payment_date" type="date" value="${val("first_payment_date")}" aria-describedby="dd-first-help"><small id="dd-first-help" class="muted">${t("对账单 / 还款计划上的第一期（例如 6 月放款、8/1 第一期）")}</small></label>` : ""}
      <label ${fsec("terms", sec)}>${t("到期日")}<input name="maturity_date" type="date" value="${val("maturity_date")}"></label>
      <label ${fsec("pay", sec)}>${t("还款频率")}<select name="payment_frequency">${opt(FREQS, v.payment_frequency)}</select></label>
      <label ${fsec("pay", sec)}>${t("每期还款（含 Escrow）")}<input name="scheduled_payment" ${numAttrs("money")} value="${val("scheduled_payment")}"></label>
      ${has060 ? escrowFields(v, personal, sec) : ""}
      <label ${fsec("terms", sec)}>${t("某天的未还本金")}<input name="opening_balance" ${numAttrs("money")} value="${val("opening_balance")}"></label>
      <label ${fsec("terms", sec)}>${t("那一天")}<input name="opening_balance_on" type="date" max="${todayISO()}" value="${val("opening_balance_on")}"></label>
      <label ${fsec("basic", sec)}>${t("状态")}<select name="status">${opt(STATUSES, v.status)}</select></label>
      ${loanAccts.length ? `<label ${fsec("link", sec)}>${t("卡与账户里的贷款账户")}<select name="lender_card_id"><option value="">${t("不关联")}</option>${loanAccts.map((c) => `<option value="${esc(c.id)}" ${c.id === v.lender_card_id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label>` : ""}
      <label ${fsec("link", sec)} data-debt-asset ${personal ? "hidden" : ""}>${t("房产")}<select name="property_id"><option value="">${t("不关联")}</option>${state.properties.filter((p) => !p.archived || p.id === v.property_id).map((p) => `<option value="${esc(p.id)}" ${p.id === v.property_id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>
      <label ${fsec("link", sec)} data-debt-asset ${personal ? "hidden" : ""}>${t("车辆 / 资产")}<select name="asset_id"><option value="">${t("不关联")}</option>${vehicles().map((a) => `<option value="${esc(a.id)}" ${a.id === v.asset_id ? "selected" : ""}>${esc(assetName(a))}</option>`).join("")}</select></label>
      <label ${fsec("link", sec)} data-debt-asset ${personal ? "hidden" : ""}>${t("融资关系")}<select name="financing_role"><option value="">—</option>${opt(ROLES, v.financing_role || debtCat(v.category).role || "")}</select></label>
      <label ${fsec("link", sec)} class="check-inline" data-debt-asset ${personal ? "hidden" : ""}><input type="checkbox" name="secured" ${v.secured ? "checked" : ""}><span>${t("以这处资产抵押")}</span></label>
      <label ${fsec("notes", sec)} style="grid-column:1/-1">${t("备注")}<textarea name="notes" maxlength="1000" rows="2">${val("notes")}</textarea></label>
    </div>
    ${sec ? "" : `<div data-fsec="terms">${has060 ? "" : `<p class="notice" role="status">${t("执行 supabase/migrations/060_debt_schedule.sql 后可以填第一期还款日、Escrow 计划和对账单校准。")}</p>`}
    <p class="muted" style="font-size:13px">${t("房贷按对账单拆分要填：原始本金、年利率、期限、第一期还款日；Escrow 计划可选（每年 Escrow 分析后加一行）。")}</p>
    <p class="muted" style="font-size:13px">${t("中途开始记的贷款：填「某天的未还本金」和那一天（看对账单），不用填原始本金；之前的还款会按利率倒推拆分。")}</p></div>`}
    ${d ? "" : `<div data-dw-review hidden></div>`}
    <p class="form-error" role="alert" data-debt-err></p>
    ${d ? `<div class="ui-acts"><button class="ui-btn" data-tone="primary">${t("保存")}</button><a class="ui-btn" data-tone="ghost" href="${esc(debtHref(d.id))}">${t("取消")}</a></div>` : dwActions(href("bills", "debts"))}</form>`;
}
export function viewDebts() {
  const q = state.route.q;
  if (!state.debtsOk) return `<section class="section"><div class="panel empty"><strong>${t("借贷还不能用")}</strong>${Store.mode === "cloud" ? t("数据库还没升级：请先执行 supabase/migrations/058_debt_lending.sql") : esc(state.debtsErr || "")}</div></section>`;
  if (q.get("new")) return `<section class="section">${debtForm(null)}</section>`;
  if (q.get("id")) return detail(q.get("id"));
  // 旧的「借贷总览」网址：?view=summary&seg=… 就是对应的标签
  const seg = q.get("view") === "summary" ? (SEGS.some(([k]) => k === q.get("seg")) ? q.get("seg") : "all") : null;
  const tab = seg || activeTab(state.route) || "all", all = debtsEnriched();
  if (tab === "txns" && q.get("link") && ui().linkQ !== state.route) { ui().linkQ = state.route; setRecordFilter("txns", { link: q.get("link") === "no" ? "no" : "yes" }); }   // 提醒「没关联花费 / 收入」点进来：直接筛好
  // 统计面板里点名字过来：下面的列表按名字（和方向）筛好，滚到列表（每次进来套一次，之后用户自己改筛选不受影响）
  if ((tab === "asset" || tab === "personal") && q.has("who") && ui().whoQ !== state.route) {
    ui().whoQ = state.route;
    const who = q.get("who") || "";
    if (tab === "asset") ui().af = { sort: af().sort, q: who };
    else ui().pf = { sort: pf().sort, q: who, dir: ["payable", "receivable"].includes(q.get("dir")) ? q.get("dir") : "all" };
    if (q.get("at") === "rec") requestAnimationFrame(() => { const el = document.getElementById("debt-recs"); if (el) { el.scrollIntoView({ block: "start" }); el.focus({ preventScroll: true }); } });
  }
  const body = tabPage(tab, all);
  // 页头右边：有借贷记录时先放视图切换（借入 / 借出 ↔ 表格），再是筛选按钮（带「金额显示」）；还款记录页有自己的筛选条
  const sw = tab !== "txns" && all.length ? viewSwitch([["group", "借入 / 借出"], ["table", "表格"]], viewMode(), { action: "ds-view", label: "视图" }) : "";
  return `<section class="section debt-page">
    ${pageHead({ title: t("借贷"), tabs: DEBT_TABS, tab, hrefOf: tabHref, label: t("借贷内容"), filter: body.includes("dr-tools") ? false : `${sw}${tabFilter(tab, all)}` })}
    ${body}
  </section>`;
}
