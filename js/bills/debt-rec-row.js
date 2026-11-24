/* 借贷流水：一行怎么读、编辑一行。 */
import { numAttrs } from "../core/ui-num.js";
import { debtById } from "./debt-logic-common.js";
import { debtHref } from "./debt-logic.js";
import { esc, fmtDate, todayISO } from "../core/util.js";
import { flowIcon, flowOf, txnName } from "./debt-rec-filter.js";
import { loadCands, seenLine } from "./debt-rec-link.js";
import { t } from "../core/i18n.js";
import { mny, ui } from "./debt-rec-common.js";

/* ───────────── 一行 ───────────── */
/* ── 一行怎么读（2026-11-02.6）：原来是「日期 · 还款（本金）· [借出] · Tom」，要自己想「借出 + 还款」是谁还谁。
 * 现在第一行是一句话（站在家里的角度，「我」= 家里）：Tom 还我 / 借给 Tom / 向 Mom 借入 / 我还 Mom / 还 房贷 本金；
 * 第二行：日期 · 是哪笔借贷（借给 Tom 的钱 / 向 Mom 借的钱 / 🏦 贷款名，点进去是那笔借贷）· 本金 / 利息拆分 · 关联了什么 · 备注。金额在右边。 */
export const isPersonal = (d) => d?.category === "personal_lending";
export const whoOf = (d) => (d ? (isPersonal(d) ? d.counterparty_name || d.name : d.name) : "");
/** 这笔借贷叫什么（第二行、下拉框里用）：借给 Tom 的钱 / 向 Mom 借的钱 / 贷款名 */
export const debtLabel = (d) => (!d ? "" : isPersonal(d) ? (d.direction === "receivable" ? t("借给 {who} 的钱", { who: whoOf(d) }) : t("向 {who} 借的钱", { who: whoOf(d) })) : d.name);
/** 第一行的一句话 */
export function sentence(x, d) {
  const who = whoOf(d), recv = d?.direction === "receivable", loan = !isPersonal(d);
  if (loan) return ({
    disbursement: t("{loan} 放款", { loan: who }), principal_repayment: x.bill_payment_id ? t("还 {loan} 月供", { loan: who }) : t("还 {loan} 本金", { loan: who }),
    interest_payment: x.bill_payment_id ? t("还 {loan} 月供（只有利息）", { loan: who }) : t("付 {loan} 利息", { loan: who }), fee: t("付 {loan} 手续费", { loan: who }),
    escrow: t("付 {loan} 的 Escrow", { loan: who }), adjustment: t("调整 {loan} 的余额", { loan: who }), write_off: t("核销 {loan}", { loan: who }),
  })[x.type] || `${txnName(x)} · ${who}`;
  return (recv ? {
    disbursement: t("借给 {who}", { who }), principal_repayment: t("{who} 还我", { who }), interest_income: t("{who} 付我利息", { who }),
    fee: t("{who} 付手续费", { who }), adjustment: t("调整 {who} 欠我的余额", { who }), write_off: t("核销 {who} 欠我的钱", { who }),
  } : {
    disbursement: t("向 {who} 借入", { who }), principal_repayment: t("我还 {who}", { who }), interest_payment: t("我付 {who} 利息", { who }),
    fee: t("我付 {who} 手续费", { who }), adjustment: t("调整我欠 {who} 的余额", { who }), write_off: t("{who} 免了我欠的钱", { who }),
  })[x.type] || `${txnName(x)} · ${who}`;
}
export function rowHtml(x, L) {
  const d = debtById(x.debt_id), c = d?.currency;
  const parts = [x.principal_amount ? t("本金 {a}", { a: mny(x.principal_amount, c) }) : null, x.interest_amount ? t("利息 {a}", { a: mny(x.interest_amount, c) }) : null,
    x.escrow_amount ? t("Escrow {a}", { a: mny(x.escrow_amount, c) }) : null, x.fee_amount ? t("滞纳金 {a}", { a: mny(x.fee_amount, c) }) : null];
  // 只有一项（例如只有本金）且等于金额时不重复写
  const split = parts.filter(Boolean).length > 1 ? parts.filter(Boolean) : [];
  const src = x.bill_payment_id ? t("账单缴费") : x.purchase_id ? t("已关联花费") : x.income_record_id ? t("已关联收入") : t("没关联花费 / 收入");
  const editing = ui().recEdit === x.id, title = sentence(x, d);
  const act = x.bill_payment_id
    ? `<a class="btn btn-sm btn-ghost" href="${esc(debtHref(x.debt_id))}">${t("去拆分表改")}<span class="sr-only"> ${esc(fmtDate(x.txn_date))} ${esc(title)}</span></a>`
    : `<button type="button" class="btn btn-sm btn-ghost" data-rec-act="edit" data-id="${esc(x.id)}" aria-expanded="${editing}" aria-controls="dr-edit-${esc(x.id)}">${editing ? t("收起") : t("编辑")}<span class="sr-only"> ${esc(fmtDate(x.txn_date))} ${esc(title)}</span></button>`;
  const ctx = L.showDebt && d ? `<a href="${esc(debtHref(d.id))}">${isPersonal(d) ? "" : "🏦 "}${esc(debtLabel(d))}</a>` : "";
  return `<li class="ui-row fa-row dd-row dr-row${editing ? " is-editing" : ""}">
    ${flowIcon(flowOf(x, d))}
    <div class="dd-row-main"><span class="dd-row-top"><b class="dr-title">${esc(title)}</b>${x.split_source === "manual" && x.bill_payment_id ? `<span class="badge b-soon">${t("手动")}</span>` : ""}</span>
      <small class="muted dr-meta"><span>${esc(fmtDate(x.txn_date))}</span>${ctx ? `<span>${ctx}</span>` : ""}${[...split, src, x.notes].filter(Boolean).map((v) => `<span>${esc(v)}</span>`).join("")}</small></div>
    <b class="dd-amt">${mny(x.total, c)}</b>
    <div class="dd-row-act">${act}</div>
    ${editing ? editForm(x, d) : ""}</li>`;
}
/* ───────────── 编辑一行 ───────────── */
/** 这笔借贷能用的类型（个人借贷按方向；贷款没有「收利息」） */
function typesFor(d) {
  const recv = d?.direction === "receivable";
  return ["disbursement", "principal_repayment", recv ? "interest_income" : "interest_payment", "fee", "adjustment", "write_off"];
}
function editForm(x, d) {
  const c = d?.currency, cand = ui().recCand?.id === x.id ? ui().recCand : null;
  if (!cand) loadCands(x);
  const cur = x.purchase_id ? `p:${x.purchase_id}` : x.income_record_id ? `i:${x.income_record_id}` : "";
  const kept = ui().recKeep?.id === x.id ? ui().recKeep.v : null;   // 点了 ↻：保留刚才下拉框里选的（还在候选里的话）
  const pick = kept && cand?.list.some((o) => o.v === kept) ? kept : cur || cand?.best || "";   // 刚才是「不关联」：按重新找到的最像的一笔自动选
  const opt = (o) => `<option value="${esc(o.v)}" ${o.v === pick ? "selected" : ""}>${esc(o.label)}</option>`;
  const near = cand?.list.filter((o) => o.near) || [], other = cand?.list.filter((o) => !o.near) || [];
  const curMissing = cur && cand && !cand.list.some((o) => o.v === cur);   // 已关联的那笔不在前后 7 天里（改过日期）：照样保留
  const linkSel = !cand ? `<select name="link" disabled><option>${t("正在找前后几天的花费和收入…")}</option></select>`
    : `<select name="link"><option value="">${t("不关联")}</option>${curMissing ? `<option value="${esc(cur)}" selected>${t("保持现在的关联")}</option>` : ""}
        ${near.length ? `<optgroup label="${esc(t("日期和金额相近"))}">${near.map(opt).join("")}</optgroup>` : ""}
        ${other.length ? `<optgroup label="${esc(t("前后 7 天、金额差得多一些的"))}">${other.map(opt).join("")}</optgroup>` : ""}
        ${takenGroup(cand)}</select>`;
  const hint = !cand ? "" : `${seenLine(cand)}${cand.err ? `<small class="form-error">${esc(cand.err)}</small>`
    : !cur && cand.best ? `<small class="muted">${t("按日期和金额自动选了最像的一笔，不对就改成别的或「不关联」。")}</small>`
    : !cur && !near.length ? `<small class="muted">${t("前后 7 天没有金额相近的花费或收入，先留空。")}</small>` : ""}`;
  const hasCash = !!(x.purchase_id || x.income_record_id);
  return `<form id="dr-edit-${esc(x.id)}" class="dd-edit dr-edit" data-rec-form="edit" data-id="${esc(x.id)}" aria-label="${esc(t("编辑 {d} 这笔{k}", { d: fmtDate(x.txn_date), k: sentence(x, d) }))}">
    <div class="form-grid">
      <label>${t("日期")}<input type="date" name="date" required max="${todayISO()}" value="${esc(x.txn_date)}"></label>
      <label>${t("类型")}<select name="type">${[...new Set([x.type, ...typesFor(d)])].map((k) => `<option value="${k}" ${k === x.type ? "selected" : ""}>${esc(sentence({ type: k }, d))}</option>`).join("")}</select></label>
      <label>${t("本金")}<input ${numAttrs("money", { min: null })} name="principal" value="${x.principal_amount || ""}"></label>
      <label>${t("利息")}<input ${numAttrs("money")} name="interest" value="${x.interest_amount || ""}"></label>
      <label>${t("手续费 / 滞纳金")}<input ${numAttrs("money")} name="fee" value="${x.fee_amount || ""}"></label>
      <label>${t("备注")}<input name="notes" maxlength="200" value="${esc(x.notes || "")}"></label>
      <div class="dr-link-field" style="grid-column:1/-1"><div class="dr-link-row"><label>${t("关联一笔花费 / 收入 / 转账")}${linkSel}</label>
        <button type="button" class="btn btn-sm btn-ghost dr-refresh" data-rec-act="cand-refresh" data-id="${esc(x.id)}" ${cand ? "" : "disabled"} aria-label="${esc(t("重新查找相近的花费和收入"))}" title="${esc(t("重新查找相近的花费和收入（刚导入或刚记了一笔时用）"))}"><span aria-hidden="true">↻</span></button></div>${hint}</div>
    </div>
    <p class="muted dd-note">${t("关联只记下「这笔钱就是那一笔」，不改那笔花费或收入本身；金额以这里为准，合计 {a}。", { a: mny(x.total, c) })}</p>
    <div class="form-actions"><button class="btn btn-sm btn-primary">${t("保存")}</button><button type="button" class="btn btn-sm btn-ghost" data-rec-act="edit" data-id="${esc(x.id)}">${t("取消")}</button>
      <span class="spacer"></span>
      ${hasCash ? `<label class="check-inline"><input type="checkbox" name="cash" checked><span>${t("同时删掉关联的花费 / 收入")}</span></label>` : ""}
      <button type="button" class="btn btn-sm btn-danger-ghost" data-debt="txn-del" data-id="${esc(x.id)}">${t("删除这条")}</button></div>
  </form>`;
}
/** 候选下拉框末尾：已挂在别处的（灰色、不能选），写清楚挂在哪 */
export const takenGroup = (cand, side = null) => {
  const list = (cand?.taken || []).filter((o) => !side || o.v.startsWith(side));
  return list.length ? `<optgroup label="${esc(t("已关联到别处（不能重复关联）"))}">${list.map((o) => `<option disabled>${esc(`${o.label} — ${o.why}`)}</option>`).join("")}</optgroup>` : "";
};
