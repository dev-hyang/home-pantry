/* 账单详情 → 特别摊派（?sec=assess）：这条账单的摊派列表（进度 + 每一期）、新增 / 编辑页（付款计划一期一行）。
 * 数据在 state.assess / state.assessItems（启动时整表读进内存，小表）；缴费时在缴费表单里勾选「这次交哪几期」，见 views.js。
 * 付款计划的写法：分期（每月一期，可「快速生成」）+ 一次性结清（可以只有其中一种，也可以前几期分期、最后一次结清）。 */
import { numAttrs } from "../core/ui-num.js";
import { state } from "../core/state.js";
import { Store } from "../core/store.js";
import { esc, fmtDate, num, todayISO, toast } from "../core/util.js";
import { go, href } from "../core/router.js";
import { lang, t } from "../core/i18n.js";
import { assessmentsOf, genInstallments, isPaid, nextInstallment, paidOn } from "./assessments-lib.js";
import { infoTip } from "../core/info-tip.js";
import { moreMenu } from "../core/more-menu.js";
import { lpAttr } from "../core/long-press.js";

const mny = (v, cur) => Units.money(num(v), cur || Units.region.currency);
const KINDS = [["installment", "分期"], ["payoff", "一次性结清"]];
const kindName = (k) => t((KINDS.find(([id]) => id === k) || KINDS[0])[1]);

/** 摊派列表：一笔摊派一张卡。头部：名称（备注收在名称旁的 ⓘ）+ 两行摘要 + 右上角 ⋯ 菜单；下面是「待缴」「已缴」两个小节（各自带箭头，默认收起）。
 *  摘要：未缴 $x（n 笔按分期计划）· 已缴 $x（n 笔）；换行：最近一次缴费、即将到期（最近一期没缴的） */
export function assessListPage(b, crumb) {
  const focus = state.route?.q?.get("focus") || null;   // 从账单页点某一笔摊派进来：展开它的「待缴」，并滚到它
  const base = href("bill", b.id), list = assessmentsOf(b.id, state.assess, state.assessItems), cur = b.currency;
  const payDate = (x) => paidOn(x, b.pays);
  const rowLi = (x) => `<li><span class="badge ${isPaid(x) ? "b-ok" : ""}">${isPaid(x) ? t("已缴") : t("待缴")}</span>
        <div class="grow">${esc(fmtDate(x.due_on))}<small>${[kindName(x.kind), x.payment_id ? t("{d} 缴", { d: fmtDate(payDate(x)) || "—" }) : x.settled_on ? t("已缴（无缴费记录）") : null].filter(Boolean).map(esc).join(" · ")}</small></div><b>${mny(x.amount, cur)}</b>${isPaid(x) ? moreMenu(paidRowItems(b, x), { label: t("更多操作") }) : ""}</li>`;
  const sec = (cls, title, rows, open, more = "") => `<details class="as-sec ${cls}" ${open ? "open" : ""}><summary>${title}<span class="ui-chev" aria-hidden="true">›</span></summary><ul class="restock-list as-items">${rows.map(rowLi).join("")}</ul>${more}</details>`;
  const cards = list.map((a) => {
    const todo = a.rows.filter((x) => !isPaid(x)), paid = a.rows.filter(isPaid), isFocus = a.id === focus;
    const planN = todo.filter((x) => x.kind === "installment").length, last = [...paid].sort((x, y) => String(payDate(y)).localeCompare(String(payDate(x))))[0], next = todo[0];
    const cnt = (n) => (lang === "en" ? `${n} ${n === 1 ? "payment" : "payments"}` : t("{n} 笔", { n })), plan = planN ? t("，其中 {n} 笔按分期计划", { n: planN }) : "";
    const lines = [t("未缴 {a}（{c}{p}）", { a: mny(a.remaining, cur), c: cnt(todo.length), p: plan }), t("已缴 {a}（{c}）", { a: mny(a.paid, cur), c: cnt(paid.length) }),
      last ? t("最近一次缴费：{d}，{a}", { d: fmtDate(payDate(last)) || "—", a: mny(last.amount, cur) }) : null, next ? t("即将到期：{d}，{a}", { d: fmtDate(next.due_on), a: mny(next.amount, cur) }) : null].filter(Boolean);
    const items = menuItems(a, base);
    return `<section class="panel prof-card as-card" id="as-${esc(a.id)}" ${isFocus ? "data-as-focus" : ""} ${lpAttr(items, a.name)}>
      <header class="prof-head"><span class="mi" aria-hidden="true">📣</span>
        <div class="prof-t"><h3>${esc(a.name)}${a.notes ? ` ${infoTip.classic(a.notes)}` : ""}</h3>
          <small>${a.done ? `<span class="badge b-ok">${t("已缴清")}</span> ` : a.status === "closed" ? `<span class="badge">${t("已关闭")}</span> ` : ""}${esc(t("共 {total}", { total: mny(a.total, cur) }))}</small>
          ${lines.map((x) => `<small class="as-desc">${esc(x)}</small>`).join("")}</div>
        ${moreMenu(items, { label: `${a.name} · ${t("更多操作")}` })}</header>
      ${todo.length ? sec("as-todo", t("待缴 {n} 期 · {m}", { n: todo.length, m: mny(a.remaining, cur) }), todo, isFocus) : `<p class="muted as-none">${t("没有待缴的期了")}</p>`}
      ${paid.length ? sec("as-paid", t("已缴 {n} 期 · {m}", { n: paid.length, m: mny(a.paid, cur) }), paid, false, `<p class="as-more"><a href="${base}?sec=assess&pays=${encodeURIComponent(a.id)}">${t("查看缴费记录")} ›</a></p>`) : ""}
    </section>`;
  }).join("");
  return `<section class="section">${crumb}
    <div class="section-head"><h2>${t("特别摊派")}</h2><p>${esc(b.name)}</p></div>
    ${cards ? `<div class="prof-grid bill-detail-grid one-col as-list">${cards}</div>` : `<div class="panel empty"><strong>${t("还没有特别摊派")}</strong>${t("HOA 临时收的大额费用（屋顶、电梯、停车场…）可以记在这里：分期、一次性结清，或前几期分期、最后一次结清。")}</div>`}
    <a class="fab" href="${base}?sec=assess&edit=new" aria-label="${esc(t("新增摊派"))}" title="${esc(t("新增摊派"))}">＋</a>
  </section>`;
}
/** 已缴的一期的更多操作（⋯）：查看那笔缴费 / 撤销。撤销：只标了「已缴（无缴费记录）」的直接撤销；交在某笔缴费里的，要到那笔缴费里取消勾选（金额、花费统计跟着那笔缴费走，不在这里单独改） */
export const paidRowItems = (b, x) => {
  const pay = x.payment_id ? `${href("bill", b.id)}?sec=pay&edit=${encodeURIComponent(x.payment_id)}` : null;
  return [pay ? { label: t("查看这笔缴费"), href: pay, first: true } : null,
    pay ? { label: t("撤销：到缴费里取消勾选"), href: pay } : { label: t("撤销（改回待缴）"), action: "assess-undo", data: { id: x.id }, danger: true, first: true }].filter(Boolean);
};
/** 一笔摊派的更多操作（⋯ 和长按共用）：编辑 / 加一期分期 / 一次性结清（还有没缴的期时）/ 缴费记录 / 复制 / 删除 */
const menuItems = (a, base) => [{ label: t("编辑"), href: `${base}?sec=assess&edit=${a.id}`, first: true },
  a.status === "closed" ? null : { label: t("加一期分期"), href: `${base}?sec=assess&edit=${a.id}&add=installment` },
  a.status === "closed" || !a.rows.some((x) => !isPaid(x)) ? null : { label: t("一次性结清"), href: `${base}?pay=1&settle=${encodeURIComponent(a.id)}` },
  { label: t("缴费记录"), href: `${base}?sec=assess&pays=${encodeURIComponent(a.id)}` }, { label: t("复制"), href: `${base}?sec=assess&edit=new&copy=${encodeURIComponent(a.id)}` }, { label: t("删除"), action: "assess-del", data: { id: a.id }, danger: true }];

const rowHtml = (x = {}, paid = false) => {
  if (paid) return `<li data-variant="card" class="ui-row as-row is-paid" data-id="${esc(x.id || "")}">   <!-- 已关联缴费：锁定，只读显示；隐藏域让保存时仍能读到这一期 -->
    <input type="hidden" name="as_due" value="${esc(x.due_on || "")}"><input type="hidden" name="as_amt" value="${num(x.amount).toFixed(2)}"><input type="hidden" name="as_kind" value="${esc(x.kind || "installment")}">
    <div class="as-line"><b class="as-date">${esc(fmtDate(x.due_on))}</b><span class="as-kindtxt">${esc(kindName(x.kind))}</span><b class="as-money">${mny(x.amount)}</b><span class="badge b-ok">${t("已缴")}</span></div></li>`;
  return `<li data-variant="card" class="ui-row as-row" data-id="${esc(x.id || "")}">
    <div class="as-line"><select name="as_kind" aria-label="${esc(t("类型"))}">${KINDS.map(([k, n]) => `<option value="${k}" ${x.kind === k ? "selected" : ""}>${esc(t(n))}</option>`).join("")}</select>
      <button type="button" class="ui-btn as-del" data-tone="ghost" data-as-del aria-label="${esc(t("删除这一期"))}" title="${esc(t("删除这一期"))}">✕</button></div>
    <div class="as-fields">
      <label>${lang === "en" ? "Due date" : "到期日"}<input type="date" name="as_due" required value="${esc(x.due_on || "")}"></label>
      <label>${lang === "en" ? "Amount" : "金额"}<input ${numAttrs("money", { min: 0.01 })} name="as_amt" required value="${x.amount != null ? num(x.amount).toFixed(2) : ""}"></label></div>
    <label class="as-settled"><input type="checkbox" name="as_settled" ${x.settled_on ? "checked" : ""}><span>${t("已缴（无缴费记录）")}</span></label></li>`;
};

/** 新增 / 编辑页：名称、备注、状态 + 付款计划（一期一行） */
export function assessFormPage(b, a, crumb, copyFrom = null, addKind = null) {
  const base = href("bill", b.id), src = a || copyFrom, rows = src ? (assessmentsOf(b.id, state.assess, state.assessItems).find((x) => x.id === src.id)?.rows || []).map((x) => (copyFrom ? { due_on: x.due_on, amount: x.amount, kind: x.kind } : x)) : [];   // 复制：每一期都当成没缴的新行，不带 id / 缴费关联
  const live = rows.filter((x) => !x.payment_id && !x.settled_on), left = Math.round(live.filter((x) => x.kind === "installment").reduce((s, x) => s + num(x.amount), 0) * 100) / 100;   // 编辑时：「快速生成」默认按没缴的分期合计重新分（结清行不动，不算进去）
  const instN = live.filter((x) => x.kind === "installment").length, startDefault = (live[0]?.due_on) || todayISO();
  if (a && addKind === "installment") rows.push({ ...nextInstallment(rows), id: null });   // 「加一期分期」进来：末尾预置一行新的
  return `<section class="section form-page">${crumb}
    <div class="section-head"><h2>${a ? t("编辑摊派") : t("新增摊派")}</h2><p>${esc(b.name)}</p></div>
    <form id="assessForm" class="panel" novalidate data-bill="${esc(b.id)}" data-id="${esc(a?.id || "")}">
      <div class="form-grid">
        <label class="span-2">${t("名称")}<input name="name" required maxlength="80" placeholder="${esc(t("例如：2026 屋顶更换"))}" value="${esc(a ? a.name : copyFrom ? t("{n}（副本）", { n: copyFrom.name }) : "")}"></label>
        <label>${t("状态")}<select name="status"><option value="active" ${a?.status !== "closed" ? "selected" : ""}>${t("进行中")}</option><option value="closed" ${a?.status === "closed" ? "selected" : ""}>${t("已关闭（不再计入费用）")}</option></select></label>
        <label class="span-2">${t("备注")}<input name="notes" maxlength="1000" placeholder="${esc(t("通知函编号、原因、和 HOA 的约定…"))}" value="${esc(src?.notes || "")}"></label>
      </div>
      <h3 class="as-h">${t("付款计划")}</h3>
      <details class="as-gen" ${src ? "" : "open"}><summary>${a ? t("重新生成未缴的分期") : t("快速生成分期")}</summary>
        <div class="form-grid">
          <label>${t("期数")}<input name="g_count" ${numAttrs("int", { max: 120, min: 1, step: null })} placeholder="3" ${a && instN ? `value="${instN}"` : ""}></label>
          <label>${t("每期金额 / 总额")}<span class="as-gen2"><input name="g_amt" ${numAttrs("money", { min: 0.01 })} aria-label="${esc(t("金额"))}" ${a && left > 0 ? `value="${left.toFixed(2)}"` : ""}><select name="g_mode" aria-label="${esc(t("金额含义"))}"><option value="each" ${a && left > 0 ? "" : "selected"}>${t("每期")}</option><option value="total" ${a && left > 0 ? "selected" : ""}>${t("总额")}</option></select></span></label>
          <label>${t("第一期到期日")}<input name="g_start" type="date" value="${esc(startDefault)}"></label>
          <div class="as-gen-go"><button type="button" class="ui-btn" data-size="sm" data-as-gen>${t("生成分期")}</button></div>
        </div>
        <small class="muted">${a ? t("只替换还没缴的分期（已缴的期和一次性结清行不动）；总额默认是现在没缴的分期合计。") : t("每月一期；总额除不尽的零头放在最后一期。生成后每一期都能改日期和金额。")}</small></details>
      <ul class="as-rows" id="asRows">${rows.map((x) => rowHtml(x, !!x.payment_id)).join("")}</ul>
      <p class="as-total muted" id="asTotal" role="status">${esc(totalText(rows.length, rows.reduce((s, x) => s + num(x.amount), 0)))}</p>
      <div class="form-actions"><button type="button" class="ui-btn" data-size="sm" data-tone="ghost" data-as-add="installment">＋ ${t("加一期分期")}</button><button type="button" class="ui-btn" data-size="sm" data-tone="ghost" data-as-add="payoff">＋ ${t("加一次性结清")}</button></div>
      <p id="assessError" class="form-error" role="alert"></p>
      ${a ? `<p class="muted" style="font-size:13px;margin:6px 0 0">${t("已缴的期锁定，不能改；要改请先到缴费记录里取消勾选或删除那笔缴费。")}</p>` : ""}
      <div class="form-actions form-actions-split sticky-actions">
        <button type="button" class="ui-btn" data-tone="ghost" data-action="assess-cancel">${t("取消")}</button>
        <button type="submit" class="ui-btn" data-tone="primary">${a ? t("保存修改") : t("添加摊派")}</button></div>
    </form>
    ${a ? `<div class="danger-zone"><button type="button" class="ui-btn" data-tone="danger" data-action="assess-del" data-id="${esc(a.id)}">${t("删除这笔摊派")}</button><small class="muted">${t("连同它的付款计划一起删除；已缴的缴费记录保留，只是不再关联。")}</small></div>` : ""}
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
    document.getElementById("assessError").textContent = "";
    const old = [...f.querySelectorAll(".as-row:not(.is-paid)")].filter((r) => r.querySelector('[name="as_kind"]')?.value === "installment");   // 编辑时：生成 = 替换没缴的分期（已缴的、结清行不动）
    if (f.dataset.id && old.length) { if (!window.confirm(t("用新生成的 {n} 期替换现有 {m} 期没缴的分期？", { n: list.length, m: old.length }))) return; old.forEach((r) => r.remove()); }
    addRows(list);
  }
});
document.addEventListener("input", (e) => { if (e.target.closest("#assessForm") && e.target.name === "as_amt") recalc(); });
/** 保存：摊派行 + 付款计划（已缴的期原样保留；没缴的按表单增 / 改 / 删） */
export async function saveAssessForm(f) {
  const fe = f.elements, err = document.getElementById("assessError"), billId = f.dataset.bill, id = f.dataset.id || null;
  const fail = (m) => { err.textContent = m; return false; };
  const name = fe.name.value.trim(); if (!name) return fail(t("请填名称。"));
  const rows = [...f.querySelectorAll(".as-row")].map((r) => ({ id: r.dataset.id || null, paid: r.classList.contains("is-paid"), due_on: r.querySelector('[name="as_due"]').value, amount: Math.round(num(r.querySelector('[name="as_amt"]').value) * 100) / 100, kind: r.querySelector('[name="as_kind"]').value, settled: !!r.querySelector('[name="as_settled"]')?.checked }));
  if (!rows.length) return fail(t("至少要有一期。"));
  if (rows.some((r) => !r.paid && (!r.due_on || !(r.amount > 0)))) return fail(t("每一期都要填到期日和大于 0 的金额。"));
  const btn = f.querySelector('button[type="submit"]'); btn.disabled = true;
  try {
    const aid = await Store.saveAssess({ id, bill_id: billId, name, status: fe.status.value, notes: fe.notes.value.trim() || null });
    const keep = new Set(rows.filter((r) => r.id).map((r) => r.id));
    for (const old of state.assessItems.filter((x) => x.assessment_id === aid && !x.payment_id && !keep.has(x.id))) await Store.deleteAssessItem(old.id);   // 表单里删掉的没缴期
    for (const r of rows) { if (r.paid) continue; await Store.saveAssessItem({ id: r.id, assessment_id: aid, due_on: r.due_on, amount: r.amount, kind: r.kind, payment_id: null, settled_on: r.settled ? (state.assessItems.find((x) => x.id === r.id)?.settled_on || r.due_on) : null }); }
    toast(id ? t("已保存修改") : t("已添加 {name}", { name }));
    return true;
  } catch (e) { btn.disabled = false; return fail(t("保存失败：{msg}", { msg: e.message })); }
}
export const assessListHref = (billId) => `${href("bill", billId)}?sec=assess`;
export const backToAssessList = (billId) => go(assessListHref(billId), { replace: true });
