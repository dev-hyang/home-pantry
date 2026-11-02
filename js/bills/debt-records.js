/* 财务 → 借贷 · 流水列表（2026-11）：「还款记录」标签、个人借贷详情的还款记录、贷款详情的「其他流水」共用一套：
 *   搜索（贷款 / 对方 / 备注 / 金额 / 日期）+ 筛选（借入 / 借出、资金流入 / 流出、类型、哪笔借贷、关联了花费 / 收入没有）+ 「继续加载」（全站每页条数，pager.js）；
 *   每行一个资金方向图标（↙ 流入 / ↗ 流出 / ⇄ 不动钱），点「编辑」在这一行下面展开表单：改日期 / 类型 / 金额 / 备注，关联一笔花费或收入，或删除。
 * 关联候选：这笔流水日期前后 7 天的花费（listPurchasesRange，一次读这一小段进内存）和收入（内存里的收入记录），
 *   金额相近（差 ≤ max(1, 10%)）的排前面；还没关联时自动选中最像的一笔，没有就留空。已经挂在别的借贷流水 / 账单缴费上的花费不出现。
 * 账单缴费拆出来的流水（房贷月供）金额由缴费决定：在贷款详情的「每期还款拆分」里改，这里点「编辑」跳过去。
 * 数据量：借贷流水是小表，已整表在内存里（debt-logic.js），筛选、分页都在内存里做。 */
import { state } from "../core/state.js";
import { Store } from "../core/store.js";
import { DAY, esc, fmtDate, num } from "../core/util.js";
import { t } from "../core/i18n.js";
import { TXN_TYPES } from "../core/debt-rules.js";
import { pageLimit, pageMoreBtn } from "../core/pager.js";
import { changed, clearFiltersBtn, onClearFilters } from "../core/clear-filters.js";
import { localDay } from "../core/spend-data.js";
import { INTERNAL_KINDS } from "../core/income-taxonomy.js";
import { isTransfer } from "../core/taxonomy.js";
import { inc, kindLabel, loadIncome } from "../income/logic.js";
import { debtById, debtHref, debtTxns } from "./debt-logic.js";

const ui = () => (state.debtUi ||= {});
const mny = (v, c) => (v == null ? "—" : Units.money(v, c || Units.region.currency));
const r2 = (v) => Math.round(num(v) * 100) / 100;

/* ───────────── 方向 ───────────── */
/** 资金方向（站在家里的角度）：in = 钱进来，out = 钱出去，null = 不动钱（调整、核销） */
export function flowOf(x, d = debtById(x.debt_id)) {
  const recv = d?.direction === "receivable";
  switch (x.type) {
    case "disbursement": return recv ? "out" : "in";            // 借出 = 钱出去；借入 / 贷款放款 = 钱进来
    case "principal_repayment": return recv ? "in" : "out";     // 对方还我 = 进来；我还 = 出去
    case "interest_income": return "in";
    case "interest_payment": case "fee": case "escrow": return "out";
    default: return null;
  }
}
const FLOW = { in: { icon: "↙", cls: "dr-in", name: "资金流入" }, out: { icon: "↗", cls: "dr-out", name: "资金流出" }, none: { icon: "⇄", cls: "dr-none", name: "不动钱" } };
const flowIcon = (f) => { const v = FLOW[f || "none"]; return `<span class="dr-flow ${v.cls}" title="${esc(t(v.name))}"><span aria-hidden="true">${v.icon}</span><span class="sr-only">${esc(t(v.name))}</span></span>`; };
/** 借入（我欠别人，含贷款）/ 借出（别人欠我） */
const dirOf = (d) => (d?.direction === "receivable" ? "lent" : "borrowed");
const linked = (x) => !!(x.purchase_id || x.income_record_id || x.bill_payment_id);
const txnName = (x) => t(TXN_TYPES[x.type]?.name || x.type);

/* ───────────── 筛选 ───────────── */
const DEF = { q: "", dir: "all", flow: "all", type: "all", debt: "all", link: "all" };
const filt = (key) => ((ui().recF ||= {})[key] ||= { ...DEF });
const skey = (s) => String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
function matches(x, f) {
  const d = debtById(x.debt_id);
  if (f.dir !== "all" && dirOf(d) !== f.dir) return false;
  if (f.flow !== "all" && (flowOf(x, d) || "none") !== f.flow) return false;
  if (f.type !== "all" && x.type !== f.type) return false;
  if (f.debt !== "all" && x.debt_id !== f.debt) return false;
  if (f.link === "yes" && !linked(x)) return false;
  if (f.link === "no" && linked(x)) return false;
  const q = skey(f.q);
  if (q) {
    const hay = skey([d?.name, d?.counterparty_name, x.notes, txnName(x), x.txn_date, fmtDate(x.txn_date), r2(x.total).toFixed(2), r2(x.principal_amount).toFixed(2), r2(x.interest_amount).toFixed(2)].join(" "));
    if (!q.split(" ").every((w) => hay.includes(w))) return false;
  }
  return true;
}
/** 从网址带进来的筛选（例如提醒点进来 ?link=no） */
export const setRecordFilter = (key, patch) => { Object.assign(filt(key), patch); };
const byDate = (a, b) => b.txn_date.localeCompare(a.txn_date) || String(b.id).localeCompare(String(a.id));

/* 每个列表登记一份「怎么取流水」，搜索框输入时只重画列表本身（不重画工具条，焦点不丢） */
const lists = new Map();
/** 列表的内层（行 + 继续加载）：key = 列表标识，opts 同 recordsList */
function innerHtml(key) {
  const L = lists.get(key); if (!L) return "";
  const f = filt(key), all = L.txns().slice().sort(byDate), shown0 = all.filter((x) => matches(x, f));
  const lim = pageLimit(`debt-rec-${key}`, JSON.stringify(f)), shown = shown0.slice(0, lim);
  if (!all.length) return `<div class="empty">${esc(L.empty || t("还没有记录"))}</div>`;
  if (!shown0.length) return `<div class="empty">${t("没有符合筛选的记录")}</div>`;
  const sum = (fl) => shown0.filter((x) => flowOf(x) === fl).reduce((s, x) => s + num(x.total), 0);
  const inSum = sum("in"), outSum = sum("out");
  return `<p class="muted dr-sum" role="status">${t("{n} 条", { n: shown0.length })}${inSum ? ` · ${t("流入 {a}", { a: mny(r2(inSum)) })}` : ""}${outSum ? ` · ${t("流出 {a}", { a: mny(r2(outSum)) })}` : ""}</p>
    <ul class="fa-list dd-rows">${shown.map((x) => rowHtml(x, L)).join("")}</ul>${pageMoreBtn(`debt-rec-${key}`, shown0.length, shown.length)}`;
}
export function refreshRecords(key) {
  const box = document.getElementById(`drl-${key}`); if (box) box.innerHTML = innerHtml(key);
}

/** 一个流水列表：工具条 + 列表。key 每页唯一；txns() 取流水；showDebt = 行里显示是哪笔借贷、筛选里有「哪笔借贷」；
 *  dirFilter = 显示「借入 / 借出」筛选（只有一笔借贷时没意义） */
export function recordsList(key, { txns, showDebt = false, dirFilter = showDebt, empty = "" }) {
  lists.set(key, { txns, showDebt, empty });
  const f = filt(key), all = txns();
  onClearFilters(`debt-rec-${key}`, () => { ui().recF[key] = { ...DEF }; refreshAll(); }, () => changed(filt(key), DEF));
  if (all.length < 6 && !changed(f, DEF)) return `<div class="dr-list" id="drl-${esc(key)}">${innerHtml(key)}</div>`;   // 几条而已：不要工具条
  const types = [...new Set(all.map((x) => x.type))];
  const debts = showDebt ? [...new Map(all.map((x) => [x.debt_id, debtById(x.debt_id)])).values()].filter(Boolean).sort((a, b) => String(a.name).localeCompare(String(b.name))) : [];
  const sel = (name, label, opts) => `<select data-rec-f="${name}" data-rec="${esc(key)}" aria-label="${esc(label)}">${opts.map(([v, n]) => `<option value="${esc(v)}" ${String(f[name]) === String(v) ? "selected" : ""}>${esc(n)}</option>`).join("")}</select>`;
  return `<div class="toolbar dr-tools">
      <input type="search" data-rec-q="${esc(key)}" value="${esc(f.q)}" placeholder="${esc(t("搜索：对方、备注、金额"))}" aria-label="${esc(t("搜索借贷流水"))}">
      ${dirFilter ? sel("dir", t("借入 / 借出"), [["all", t("借入和借出")], ["borrowed", t("借入（我欠）")], ["lent", t("借出（别人欠我）")]]) : ""}
      ${sel("flow", t("资金方向"), [["all", t("流入和流出")], ["in", `↙ ${t("资金流入")}`], ["out", `↗ ${t("资金流出")}`], ["none", `⇄ ${t("不动钱")}`]])}
      ${types.length > 1 ? sel("type", t("类型"), [["all", t("全部类型")], ...types.map((k) => [k, t(TXN_TYPES[k]?.name || k)])]) : ""}
      ${debts.length > 1 ? sel("debt", t("哪笔借贷"), [["all", t("全部借贷")], ...debts.map((d) => [d.id, d.counterparty_name && d.category === "personal_lending" ? d.counterparty_name : d.name])]) : ""}
      ${sel("link", t("关联"), [["all", t("关联不限")], ["yes", t("已关联花费 / 收入")], ["no", t("没关联")]])}
      ${clearFiltersBtn(`debt-rec-${key}`, changed(f, DEF))}
    </div>
    <div class="dr-list" id="drl-${esc(key)}">${innerHtml(key)}</div>`;
}
let rerender = () => {};
const refreshAll = () => rerender(false);

/* ───────────── 一行 ───────────── */
function rowHtml(x, L) {
  const d = debtById(x.debt_id), c = d?.currency;
  const parts = [x.principal_amount ? t("本金 {a}", { a: mny(x.principal_amount, c) }) : null, x.interest_amount ? t("利息 {a}", { a: mny(x.interest_amount, c) }) : null,
    x.escrow_amount ? t("Escrow {a}", { a: mny(x.escrow_amount, c) }) : null, x.fee_amount ? t("滞纳金 {a}", { a: mny(x.fee_amount, c) }) : null].filter(Boolean);
  const src = x.bill_payment_id ? t("账单缴费") : x.purchase_id ? t("已关联花费") : x.income_record_id ? t("已关联收入") : t("没关联花费 / 收入");
  const who = d ? (d.category === "personal_lending" ? d.counterparty_name || d.name : d.name) : "";
  const editing = ui().recEdit === x.id;
  const dirBadge = L.showDebt && d ? `<span class="badge dr-dir">${d.direction === "receivable" ? t("借出") : t("借入")}</span>` : "";
  const act = x.bill_payment_id
    ? `<a class="btn btn-sm btn-ghost" href="${esc(debtHref(x.debt_id))}">${t("去拆分表改")}<span class="sr-only"> ${esc(fmtDate(x.txn_date))}</span></a>`
    : `<button type="button" class="btn btn-sm btn-ghost" data-rec-act="edit" data-id="${esc(x.id)}" aria-expanded="${editing}" aria-controls="dr-edit-${esc(x.id)}">${editing ? t("收起") : t("编辑")}<span class="sr-only"> ${esc(fmtDate(x.txn_date))} ${esc(txnName(x))}</span></button>`;
  return `<li class="fa-row dd-row dr-row${editing ? " is-editing" : ""}">
    ${flowIcon(flowOf(x, d))}
    <div class="dd-row-main"><span class="dd-row-top"><b>${esc(fmtDate(x.txn_date))}</b><span>${esc(txnName(x))}</span>${dirBadge}${x.split_source === "manual" && x.bill_payment_id ? `<span class="badge b-soon">${t("手动")}</span>` : ""}
      ${L.showDebt && d ? `<a href="${esc(debtHref(d.id))}">${esc(who)}</a>` : ""}</span>
      <small class="muted">${[...parts, src, x.notes].filter(Boolean).map(esc).join(" · ")}</small></div>
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
  const pick = cur || cand?.best || "";
  const opt = (o) => `<option value="${esc(o.v)}" ${o.v === pick ? "selected" : ""}>${esc(o.label)}</option>`;
  const near = cand?.list.filter((o) => o.near) || [], other = cand?.list.filter((o) => !o.near) || [];
  const curMissing = cur && cand && !cand.list.some((o) => o.v === cur);   // 已关联的那笔不在前后 7 天里（改过日期）：照样保留
  const linkSel = !cand ? `<select name="link" disabled><option>${t("正在找前后几天的花费和收入…")}</option></select>`
    : `<select name="link"><option value="">${t("不关联")}</option>${curMissing ? `<option value="${esc(cur)}" selected>${t("保持现在的关联")}</option>` : ""}
        ${near.length ? `<optgroup label="${esc(t("日期和金额相近"))}">${near.map(opt).join("")}</optgroup>` : ""}
        ${other.length ? `<optgroup label="${esc(t("前后 7 天、金额差得多一些的"))}">${other.map(opt).join("")}</optgroup>` : ""}</select>`;
  const hint = !cand ? "" : cand.err ? `<small class="form-error">${esc(cand.err)}</small>`
    : !cur && cand.best ? `<small class="muted">${t("按日期和金额自动选了最像的一笔，不对就改成别的或「不关联」。")}</small>`
    : !cur && !near.length ? `<small class="muted">${t("前后 7 天没有金额相近的花费或收入，先留空。")}</small>` : "";
  const hasCash = !!(x.purchase_id || x.income_record_id);
  return `<form id="dr-edit-${esc(x.id)}" class="dd-edit dr-edit" data-rec-form="edit" data-id="${esc(x.id)}" aria-label="${esc(t("编辑 {d} 这笔{k}", { d: fmtDate(x.txn_date), k: txnName(x) }))}">
    <div class="form-grid">
      <label>${t("日期")}<input type="date" name="date" required value="${esc(x.txn_date)}"></label>
      <label>${t("类型")}<select name="type">${[...new Set([x.type, ...typesFor(d)])].map((k) => `<option value="${k}" ${k === x.type ? "selected" : ""}>${esc(t(TXN_TYPES[k]?.name || k))}</option>`).join("")}</select></label>
      <label>${t("本金")}<input type="number" name="principal" inputmode="decimal" step="0.01" value="${x.principal_amount || ""}"></label>
      <label>${t("利息")}<input type="number" name="interest" inputmode="decimal" step="0.01" min="0" value="${x.interest_amount || ""}"></label>
      <label>${t("手续费 / 滞纳金")}<input type="number" name="fee" inputmode="decimal" step="0.01" min="0" value="${x.fee_amount || ""}"></label>
      <label>${t("备注")}<input name="notes" maxlength="200" value="${esc(x.notes || "")}"></label>
      <label style="grid-column:1/-1">${t("关联一笔花费 / 收入 / 转账")}${linkSel}${hint}</label>
    </div>
    <p class="muted dd-note">${t("关联只记下「这笔钱就是那一笔」，不改那笔花费或收入本身；金额以这里为准，合计 {a}。", { a: mny(x.total, c) })}</p>
    <div class="form-actions"><button class="btn btn-sm btn-primary">${t("保存")}</button><button type="button" class="btn btn-sm btn-ghost" data-rec-act="edit" data-id="${esc(x.id)}">${t("取消")}</button>
      <span class="spacer"></span>
      ${hasCash ? `<label class="check-inline"><input type="checkbox" name="cash" checked><span>${t("同时删掉关联的花费 / 收入")}</span></label>` : ""}
      <button type="button" class="btn btn-sm btn-danger-ghost" data-debt="txn-del" data-id="${esc(x.id)}">${t("删除这条")}</button></div>
  </form>`;
}

/* ───────────── 关联候选：前后 7 天的花费 + 收入，金额相近的排前面 ───────────── */
const WIN = 7;
const shift = (iso, n) => localDay(new Date(new Date(`${iso}T12:00:00`).getTime() + n * DAY));
const purchaseCache = new Map();   // "from|to" → 这段的花费（花费变了清空）
if (typeof window !== "undefined") window.addEventListener("spend-rows-changed", () => purchaseCache.clear());
async function purchasesNear(iso) {
  const from = shift(iso, -WIN), to = shift(iso, WIN + 1), k = `${from}|${to}`;
  if (!purchaseCache.has(k)) purchaseCache.set(k, await Store.listPurchasesRange(new Date(`${from}T00:00:00`).toISOString(), new Date(`${to}T00:00:00`).toISOString()));
  return purchaseCache.get(k);
}
/** 候选列表：[{ v: "p:<id>" | "i:<id>", label, near, score }]；best = 自动选中的（金额相近里分最低的，偏向资金方向对的那一边） */
export async function linkCandidates({ date, amount, flow, selfId = null, exclude = new Set() }) {
  const I = inc(); if (!I.loaded) await loadIncome();
  const used = new Set([...debtTxns().filter((y) => y.id !== selfId).flatMap((y) => [y.purchase_id, y.income_record_id]), ...(state.billPayments || []).map((p) => p.purchase_id)].filter(Boolean));
  for (const id of exclude) used.add(id);
  const target = Math.abs(num(amount)), tol = Math.max(1, target * 0.1);
  const dayGap = (iso) => Math.abs(Math.round((new Date(`${String(iso).slice(0, 10)}T12:00:00`) - new Date(`${date}T12:00:00`)) / DAY));
  const out = [];
  for (const p of await purchasesNear(date)) {
    if (used.has(p.id)) continue;
    const a = Math.abs(num(p.amount)), day = localDay(new Date(p.purchased_at)), diff = Math.abs(a - target), xfer = isTransfer(p.category, p.nature);
    out.push({ v: `p:${p.id}`, side: "out", amt: a, near: diff <= tol, score: diff / Math.max(1, target) + dayGap(day) * 0.02,
      label: `${xfer ? t("转账") : t("花费")} · ${fmtDate(day)} · ${p.name || p.store || ""}${p.store && p.name !== p.store ? ` · ${p.store}` : ""} · ${mny(p.amount, p.currency)}` });
  }
  const lo = shift(date, -WIN), hi = shift(date, WIN);
  for (const r of I.rec) {
    if (used.has(r.id) || !r.received_on || r.received_on < lo || r.received_on > hi) continue;
    const diff = Math.abs(Math.abs(num(r.amount)) - target), internal = INTERNAL_KINDS.includes(r.kind);
    out.push({ v: `i:${r.id}`, side: "in", amt: Math.abs(num(r.amount)), near: diff <= tol, score: diff / Math.max(1, target) + dayGap(r.received_on) * 0.02,
      label: `${internal ? t("资金转入") : t("收入")} · ${fmtDate(r.received_on)} · ${r.source_name || kindLabel(r.kind)} · ${mny(r.amount, r.currency)}` });
  }
  out.sort((a, b) => (b.near - a.near) || ((flow && b.side === flow) - (flow && a.side === flow)) || a.score - b.score);
  const near = out.filter((o) => o.near), best = (near.find((o) => !flow || o.side === flow) || null)?.v || "";
  // 「其他」只留金额在一半到两倍之间的（拆成几笔付、带手续费的那种），不把同期的零碎小额花费都列出来
  const other = out.filter((o) => !o.near && o.amt >= target * 0.5 && o.amt <= target * 2).slice(0, 10);
  return { list: [...near, ...other], best };
}
function loadCands(x) {
  if (ui().recCandLoading === x.id) return;
  ui().recCandLoading = x.id;
  linkCandidates({ date: x.txn_date, amount: x.total, flow: flowOf(x), selfId: x.id })
    .then((r) => { ui().recCand = { id: x.id, ...r }; }, (e) => { ui().recCand = { id: x.id, list: [], best: "", err: t("读取花费 / 收入失败：{msg}", { msg: e.message }) }; })
    .finally(() => { ui().recCandLoading = null; if (ui().recEdit === x.id) rerender(false); });
}

/* ───────────── 事件 ───────────── */
let qTimer = 0;
/** 挂在 #main 上（debts.js 的 initDebts 调）：save(x, patch) 由调用方写库并重画 */
export function initRecords({ render, save }) {
  rerender = render;
  const main = document.getElementById("main");
  main.addEventListener("input", (e) => {
    const q = e.target.closest?.("[data-rec-q]"); if (!q) return;
    filt(q.dataset.recQ).q = q.value;
    clearTimeout(qTimer); qTimer = setTimeout(() => refreshRecords(q.dataset.recQ), 200);
  });
  main.addEventListener("change", (e) => {
    const s = e.target.closest?.("[data-rec-f]"); if (!s) return;
    filt(s.dataset.rec)[s.dataset.recF] = s.value; render(false);
  });
  main.addEventListener("click", (e) => {
    const b = e.target.closest?.("[data-rec-act]"); if (!b) return;
    if (b.dataset.recAct === "edit") {
      const id = b.dataset.id; ui().recEdit = ui().recEdit === id ? null : id; ui().recCand = null; render(false);
      if (ui().recEdit) requestAnimationFrame(() => document.querySelector(`#dr-edit-${CSS.escape(id)} input`)?.focus());
      else requestAnimationFrame(() => document.querySelector(`[data-rec-act="edit"][data-id="${CSS.escape(id)}"]`)?.focus());
    }
  });
  main.addEventListener("submit", async (e) => {
    const f = e.target.closest?.("[data-rec-form]"); if (!f) return;
    e.preventDefault(); e.stopPropagation();
    const x = debtTxns().find((y) => y.id === f.dataset.id); if (!x) return;
    const fd = new FormData(f), g = (k) => String(fd.get(k) ?? "").trim(), link = g("link");
    const principal = r2(g("principal")), interest = r2(g("interest")), fee = r2(g("fee"));
    const total = r2(Math.abs(principal) + interest + fee + num(x.escrow_amount));
    if (!g("date")) return;
    const patch = { txn_date: g("date"), type: g("type") || x.type, principal_amount: principal, interest_amount: interest, fee_amount: fee, total, notes: g("notes") || null };
    if (link !== "" || !f.elements.link?.disabled) {   // 候选还没读完时不动关联
      patch.purchase_id = link.startsWith("p:") ? link.slice(2) : null;
      patch.income_record_id = link.startsWith("i:") ? link.slice(2) : null;
    }
    const btn = f.querySelector("button.btn-primary"); if (btn) btn.disabled = true;
    try { await save(x, patch); ui().recEdit = null; ui().recCand = null; }
    finally { if (btn) btn.disabled = false; }
  });
}
