/* 借贷流水：关联候选（前后 7 天的花费 + 收入，金额相近）和事件。 */
import { DAY, fmtDate, num } from "../core/util.js";
import { INTERNAL_KINDS } from "../core/income-taxonomy.js";
import { Store } from "../core/store.js";
import { debtById, debtTxns } from "./debt-logic-common.js";
import { filt, flowOf, refreshRecords, rerender, setRerender } from "./debt-rec-filter.js";
import { inc, kindLabel, loadIncome } from "../income/logic.js";
import { isTransfer } from "../core/taxonomy.js";
import { localDay } from "../core/spend-data.js";
import { sentence } from "./debt-rec-row.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";
import { mny, r2, ui } from "./debt-rec-common.js";

/** 读到了多少：前后 7 天 N 笔花费、M 笔收入（刷新后能看出确实重新读了） */
export const seenLine = (cand, side = null) => (cand?.seen ? `<small class="muted dr-seen">${side === "p:" ? t("前后 7 天读到 {p} 笔花费", { p: cand.seen.p }) : t("前后 7 天读到 {p} 笔花费、{i} 笔收入", cand.seen)}${cand.taken?.length ? ` · ${t("{n} 笔金额相近的已关联到别处", { n: cand.taken.filter((o) => !side || o.v.startsWith(side)).length })}` : ""}</small>` : "");
/* ───────────── 关联候选：前后 7 天的花费 + 收入，金额相近的排前面 ───────────── */
const WIN = 7;
const shift = (iso, n) => localDay(new Date(new Date(`${iso}T12:00:00`).getTime() + n * DAY));
const purchaseCache = new Map();
   // "from|to" → 这段的花费（花费变了清空）
if (typeof window !== "undefined") window.addEventListener("spend-rows-changed", () => purchaseCache.clear());
async function purchasesNear(iso) {
  const from = shift(iso, -WIN), to = shift(iso, WIN + 1), k = `${from}|${to}`;
  if (!purchaseCache.has(k)) purchaseCache.set(k, await Store.listPurchasesRange(new Date(`${from}T00:00:00`).toISOString(), new Date(`${to}T00:00:00`).toISOString()));
  return purchaseCache.get(k);
}
/** 候选列表：[{ v: "p:<id>" | "i:<id>", label, near, score }]；best = 自动选中的（金额相近里分最低的，偏向资金方向对的那一边） */
/** 候选里的花费 / 收入重新读一遍（下拉框旁边的 ↻：刚导入了对账单、刚记了一笔时用） */
export async function refreshCandidateData() { purchaseCache.clear(); await loadIncome(); }
export async function linkCandidates({ date, amount, flow, selfId = null, exclude = new Set(), fresh = false }) {
  if (fresh) await refreshCandidateData();
  const I = inc(); if (!I.loaded) await loadIncome();
  // 已经挂在别处的花费 / 收入：不能再关联（同一笔钱不能算两次），但不再悄悄丢掉——列成灰色的一组，写清楚挂在哪（以前用户刷新后看到 API 里有那笔、下拉框里却没有）
  const usedBy = new Map();
  for (const y of debtTxns()) if (y.id !== selfId) for (const id of [y.purchase_id, y.income_record_id]) if (id) usedBy.set(id, t("已关联：{what}", { what: `${sentence(y, debtById(y.debt_id))} ${fmtDate(y.txn_date)}` }));
  for (const bp of state.billPayments || []) if (bp.purchase_id && !usedBy.has(bp.purchase_id)) usedBy.set(bp.purchase_id, t("已是账单缴费：{what}", { what: `${state.bills?.find((b) => b.id === bp.bill_id)?.name || ""} ${fmtDate(bp.paid_on)}` }));
  for (const id of exclude) usedBy.set(id, t("就是现在关联的这一笔"));
  const used = usedBy;
  const target = Math.abs(num(amount)), tol = Math.max(1, target * 0.1);
  const dayGap = (iso) => Math.abs(Math.round((new Date(`${String(iso).slice(0, 10)}T12:00:00`) - new Date(`${date}T12:00:00`)) / DAY));
  const out = [];
  const taken = [], seen = { p: 0, i: 0 };
  const keepTaken = (o, id) => { if (o.amt >= target * 0.5 && o.amt <= target * 2) taken.push({ ...o, why: used.get(id) }); };
  for (const p of await purchasesNear(date)) {
    seen.p++;
    const a = Math.abs(num(p.amount)), day = localDay(new Date(p.purchased_at)), diff = Math.abs(a - target), xfer = isTransfer(p.category, p.nature);
    (used.has(p.id) ? { push: (o) => keepTaken(o, p.id) } : out).push({ v: `p:${p.id}`, side: "out", amt: a, near: diff <= tol, score: diff / Math.max(1, target) + dayGap(day) * 0.02,
      label: `${xfer ? t("转账") : t("花费")} · ${fmtDate(day)} · ${p.name || p.store || ""}${p.store && p.name !== p.store ? ` · ${p.store}` : ""} · ${mny(p.amount, p.currency)}` });
  }
  const lo = shift(date, -WIN), hi = shift(date, WIN);
  for (const r of I.rec) {
    if (!r.received_on || r.received_on < lo || r.received_on > hi) continue;
    seen.i++;
    const diff = Math.abs(Math.abs(num(r.amount)) - target), internal = INTERNAL_KINDS.includes(r.kind);
    (used.has(r.id) ? { push: (o) => keepTaken(o, r.id) } : out).push({ v: `i:${r.id}`, side: "in", amt: Math.abs(num(r.amount)), near: diff <= tol, score: diff / Math.max(1, target) + dayGap(r.received_on) * 0.02,
      label: `${internal ? t("资金转入") : t("收入")} · ${fmtDate(r.received_on)} · ${r.source_name || kindLabel(r.kind)} · ${mny(r.amount, r.currency)}` });
  }
  out.sort((a, b) => (b.near - a.near) || ((flow && b.side === flow) - (flow && a.side === flow)) || a.score - b.score);
  const near = out.filter((o) => o.near), best = (near.find((o) => !flow || o.side === flow) || null)?.v || "";
  // 「其他」只留金额在一半到两倍之间的（拆成几笔付、带手续费的那种），不把同期的零碎小额花费都列出来
  const other = out.filter((o) => !o.near && o.amt >= target * 0.5 && o.amt <= target * 2).slice(0, 10);
  taken.sort((a, b) => (b.near - a.near) || a.score - b.score);
  return { list: [...near, ...other], best, taken: taken.slice(0, 10), seen };
}
export function loadCands(x) {
  if (ui().recCandLoading === x.id) return;
  const fresh = ui().recFresh === x.id; ui().recFresh = null;
  ui().recCandLoading = x.id;
  linkCandidates({ date: x.txn_date, amount: x.total, flow: flowOf(x), selfId: x.id, fresh })
    .then((r) => { ui().recCand = { id: x.id, ...r }; }, (e) => { ui().recCand = { id: x.id, list: [], best: "", err: t("读取花费 / 收入失败：{msg}", { msg: e.message }) }; })
    .finally(() => { ui().recCandLoading = null; if (ui().recEdit === x.id) rerender(false); });
}
/* ───────────── 事件 ───────────── */
let qTimer = 0;
/** 挂在 #main 上（debts.js 的 initDebts 调）：save(x, patch) 由调用方写库并重画 */
export function initRecords({ render, save }) {
  setRerender(render);
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
    if (b.dataset.recAct === "cand-refresh") {   // ↻：重新查找相近的花费 / 收入（已选的那一项保留，重新读完后如果还在就照样选中）
      const x = debtTxns().find((y) => y.id === b.dataset.id); if (!x) return;
      const keep = b.closest("form")?.elements.link?.value || "";
      ui().recKeep = { id: x.id, v: keep }; ui().recCand = null; ui().recFresh = x.id; render(false);   // 重画时 editForm 调 loadCands，看到 recFresh 就重新读
      return;
    }
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
