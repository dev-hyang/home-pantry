/* 账单详情 → 特别摊派（?sec=assess）：这条账单的摊派列表（进度 + 每一期）、新增 / 编辑页（付款计划一期一行）。
 * 数据在 state.assess / state.assessItems（启动时整表读进内存，小表）；缴费时在缴费表单里勾选「这次交哪几期」，见 views.js。
 * 付款计划的写法：分期（每月一期，可「快速生成」）+ 一次性结清（可以只有其中一种，也可以前几期分期、最后一次结清）。 */
import { state } from "../core/state.js";
import { Store } from "../core/store.js";
import { esc, fmtDate, num, todayISO, toast } from "../core/util.js";
import { go, href } from "../core/router.js";
import { t } from "../core/i18n.js";
import { assessmentsOf, genInstallments } from "./assessments-lib.js";

const mny = (v, cur) => Units.money(num(v), cur || Units.region.currency);
const KINDS = [["installment", "分期"], ["payoff", "一次性结清"]];
const kindName = (k) => t((KINDS.find(([id]) => id === k) || KINDS[0])[1]);

/** 摊派列表页（crumb = 面包屑 HTML） */
export function assessListPage(b, crumb) {
  const base = href("bill", b.id), list = assessmentsOf(b.id, state.assess, state.assessItems), cur = b.currency;
  const payDate = (id) => { const p = b.pays.find((x) => x.id === id); return p ? fmtDate(p.paid_on) : ""; };
  const cards = list.map((a) => `<section class="panel prof-card as-card">
      <header class="prof-head"><span class="mi" aria-hidden="true">📣</span>
        <div class="prof-t"><h3>${esc(a.name)}</h3><small>${a.done ? `<span class="badge b-ok">${t("已缴清")}</span> ` : a.status === "closed" ? `<span class="badge">${t("已关闭")}</span> ` : ""}${t("共 {total} · 已缴 {paid} · 剩余 {left}", { total: mny(a.total, cur), paid: mny(a.paid, cur), left: mny(a.remaining, cur) })}</small></div>
        <a class="btn btn-sm btn-ghost prof-edit" href="${base}?sec=assess&edit=${a.id}">${t("编辑")}</a></header>
      ${a.notes ? `<p class="muted" style="margin:0 0 6px;font-size:13px">${esc(a.notes)}</p>` : ""}
      <ul class="restock-list as-items">${a.rows.map((x) => `<li><span class="badge ${x.payment_id ? "b-ok" : ""}">${x.payment_id ? t("已缴") : t("待缴")}</span>
        <div class="grow">${esc(fmtDate(x.due_on))}<small>${[kindName(x.kind), x.payment_id ? t("{d} 缴", { d: payDate(x.payment_id) || "—" }) : null].filter(Boolean).map(esc).join(" · ")}</small></div><b>${mny(x.amount, cur)}</b></li>`).join("")}</ul>
    </section>`).join("");
  return `<section class="section">${crumb}
    <div class="section-head"><h2>${t("特别摊派")}</h2><p>${esc(b.name)}</p></div>
    ${cards ? `<div class="prof-grid bill-detail-grid one-col">${cards}</div>` : `<div class="panel empty"><strong>${t("还没有特别摊派")}</strong>${t("HOA 临时收的大额费用（屋顶、电梯、停车场…）可以记在这里：分期、一次性结清，或前几期分期、最后一次结清。")}</div>`}
    <a class="fab" href="${base}?sec=assess&edit=new" aria-label="${esc(t("新增摊派"))}" title="${esc(t("新增摊派"))}">＋</a>
  </section>`;
}

const rowHtml = (x = {}, paid = false) => `<li class="as-row${paid ? " is-paid" : ""}" data-id="${esc(x.id || "")}">
    <input type="date" name="as_due" required value="${esc(x.due_on || "")}" ${paid ? "disabled" : ""} aria-label="${esc(t("到期日"))}">
    <input type="number" name="as_amt" inputmode="decimal" min="0.01" step="0.01" required value="${x.amount != null ? num(x.amount).toFixed(2) : ""}" ${paid ? "disabled" : ""} aria-label="${esc(t("金额"))}">
    <select name="as_kind" ${paid ? "disabled" : ""} aria-label="${esc(t("类型"))}">${KINDS.map(([k, n]) => `<option value="${k}" ${x.kind === k ? "selected" : ""}>${esc(t(n))}</option>`).join("")}</select>
    ${paid ? `<span class="badge b-ok">${t("已缴")}</span>` : `<button type="button" class="btn btn-sm btn-ghost" data-as-del aria-label="${esc(t("删除这一期"))}">✕</button>`}</li>`;

/** 新增 / 编辑页：名称、备注、状态 + 付款计划（一期一行） */
export function assessFormPage(b, a, crumb) {
  const base = href("bill", b.id), rows = a ? assessmentsOf(b.id, state.assess, state.assessItems).find((x) => x.id === a.id)?.rows || [] : [];
  return `<section class="section form-page">${crumb}
    <div class="section-head"><h2>${a ? t("编辑摊派") : t("新增摊派")}</h2><p>${esc(b.name)}</p></div>
    <form id="assessForm" class="panel" novalidate data-bill="${esc(b.id)}" data-id="${esc(a?.id || "")}">
      <div class="form-grid">
        <label class="span-2">${t("名称")}<input name="name" required maxlength="80" placeholder="${esc(t("例如：2026 屋顶更换"))}" value="${esc(a?.name || "")}"></label>
        <label>${t("状态")}<select name="status"><option value="active" ${a?.status !== "closed" ? "selected" : ""}>${t("进行中")}</option><option value="closed" ${a?.status === "closed" ? "selected" : ""}>${t("已关闭（不再计入费用）")}</option></select></label>
        <label class="span-2">${t("备注")}<input name="notes" maxlength="1000" placeholder="${esc(t("通知函编号、原因、和 HOA 的约定…"))}" value="${esc(a?.notes || "")}"></label>
      </div>
      <h3 class="as-h">${t("付款计划")}</h3>
      <details class="as-gen" ${a ? "" : "open"}><summary>${t("快速生成分期")}</summary>
        <div class="form-grid">
          <label>${t("期数")}<input name="g_count" type="number" inputmode="numeric" min="1" max="120" placeholder="3"></label>
          <label>${t("每期金额 / 总额")}<span class="as-gen2"><input name="g_amt" type="number" inputmode="decimal" min="0.01" step="0.01" aria-label="${esc(t("金额"))}"><select name="g_mode" aria-label="${esc(t("金额含义"))}"><option value="each">${t("每期")}</option><option value="total">${t("总额")}</option></select></span></label>
          <label>${t("第一期到期日")}<input name="g_start" type="date" value="${todayISO()}"></label>
          <div class="as-gen-go"><button type="button" class="btn btn-sm" data-as-gen>${t("生成分期")}</button></div>
        </div>
        <small class="muted">${t("每月一期；总额除不尽的零头放在最后一期。生成后每一期都能改日期和金额。")}</small></details>
      <ul class="as-rows" id="asRows">${rows.map((x) => rowHtml(x, !!x.payment_id)).join("")}</ul>
      <p class="as-total muted" id="asTotal" role="status">${esc(totalText(rows.length, rows.reduce((s, x) => s + num(x.amount), 0)))}</p>
      <div class="form-actions"><button type="button" class="btn btn-sm btn-ghost" data-as-add="installment">＋ ${t("加一期分期")}</button><button type="button" class="btn btn-sm btn-ghost" data-as-add="payoff">＋ ${t("加一次性结清")}</button></div>
      <p id="assessError" class="form-error" role="alert"></p>
      ${a ? `<p class="muted" style="font-size:13px;margin:6px 0 0">${t("已缴的期锁定，不能改；要改请先到缴费记录里取消勾选或删除那笔缴费。")}</p>` : ""}
      <div class="form-actions form-actions-split sticky-actions">
        <button type="button" class="btn btn-ghost" data-action="assess-cancel">${t("取消")}</button>
        <button type="submit" class="btn btn-primary">${a ? t("保存修改") : t("添加摊派")}</button></div>
    </form>
    ${a ? `<div class="danger-zone"><button type="button" class="btn btn-danger-ghost" data-action="assess-del" data-id="${esc(a.id)}">${t("删除这笔摊派")}</button><small class="muted">${t("连同它的付款计划一起删除；已缴的缴费记录保留，只是不再关联。")}</small></div>` : ""}
  </section>`;
}

const totalText = (n, sum) => (n ? t("共 {n} 期，合计 {m}", { n, m: mny(sum) }) : t("还没有任何一期：用上面的“快速生成分期”，或点“加一期分期 / 加一次性结清”。"));
const recalc = () => {
  const f = document.getElementById("assessForm"); if (!f) return;
  const rows = [...f.querySelectorAll(".as-row")], sum = rows.reduce((s, r) => s + num(r.querySelector('[name="as_amt"]').value), 0);
  const el = document.getElementById("asTotal"); if (el) el.textContent = totalText(rows.length, sum);
};
const addRows = (list) => { const ul = document.getElementById("asRows"); if (!ul) return; ul.insertAdjacentHTML("beforeend", list.map((x) => rowHtml(x)).join("")); recalc(); };
document.addEventListener("click", (e) => {
  const f = document.getElementById("assessForm"); if (!f) return;
  if (e.target.closest("[data-as-del]")) { e.target.closest(".as-row").remove(); recalc(); }
  const add = e.target.closest("[data-as-add]");
  if (add) { const last = [...f.querySelectorAll('.as-row [name="as_due"]')].map((x) => x.value).filter(Boolean).sort().pop(); addRows([{ due_on: last || todayISO(), amount: null, kind: add.dataset.asAdd }]); }
  if (e.target.closest("[data-as-gen]")) {
    const fe = f.elements, total = fe.g_mode.value === "total";
    const list = genInstallments({ count: fe.g_count.value, total: total ? fe.g_amt.value : null, each: total ? null : fe.g_amt.value, start: fe.g_start.value });
    if (!list.length || !(num(fe.g_amt.value) > 0)) { document.getElementById("assessError").textContent = t("填上期数、金额和第一期到期日再生成。"); return; }
    document.getElementById("assessError").textContent = ""; addRows(list);
  }
});
document.addEventListener("input", (e) => { if (e.target.closest("#assessForm") && e.target.name === "as_amt") recalc(); });
/** 保存：摊派行 + 付款计划（已缴的期原样保留；没缴的按表单增 / 改 / 删） */
export async function saveAssessForm(f) {
  const fe = f.elements, err = document.getElementById("assessError"), billId = f.dataset.bill, id = f.dataset.id || null;
  const fail = (m) => { err.textContent = m; return false; };
  const name = fe.name.value.trim(); if (!name) return fail(t("请填名称。"));
  const rows = [...f.querySelectorAll(".as-row")].map((r) => ({ id: r.dataset.id || null, paid: r.classList.contains("is-paid"), due_on: r.querySelector('[name="as_due"]').value, amount: Math.round(num(r.querySelector('[name="as_amt"]').value) * 100) / 100, kind: r.querySelector('[name="as_kind"]').value }));
  if (!rows.length) return fail(t("至少要有一期。"));
  if (rows.some((r) => !r.paid && (!r.due_on || !(r.amount > 0)))) return fail(t("每一期都要填到期日和大于 0 的金额。"));
  const btn = f.querySelector('button[type="submit"]'); btn.disabled = true;
  try {
    const aid = await Store.saveAssess({ id, bill_id: billId, name, status: fe.status.value, notes: fe.notes.value.trim() || null });
    const keep = new Set(rows.filter((r) => r.id).map((r) => r.id));
    for (const old of state.assessItems.filter((x) => x.assessment_id === aid && !x.payment_id && !keep.has(x.id))) await Store.deleteAssessItem(old.id);   // 表单里删掉的没缴期
    for (const r of rows) { if (r.paid) continue; await Store.saveAssessItem({ id: r.id, assessment_id: aid, due_on: r.due_on, amount: r.amount, kind: r.kind, payment_id: null }); }
    toast(id ? t("已保存修改") : t("已添加 {name}", { name }));
    return true;
  } catch (e) { btn.disabled = false; return fail(t("保存失败：{msg}", { msg: e.message })); }
}
export const assessListHref = (billId) => `${href("bill", billId)}?sec=assess`;
export const backToAssessList = (billId) => go(assessListHref(billId), { replace: true });
