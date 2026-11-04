/* ============ 收入 → 明细：把记成收入的 Zelle 转入 / 报销 逐个付款方整理（2026-11-04 用户定） ============
 * 朋友 AA 还你、替人垫付后还回 = 自己的钱回来了，不是收入：应该是「支出退回」——所选花费分类的一笔负数花费，抵掉你先付的那部分。
 * 以前银行导入把 Zelle / Venmo 转入默认记成收入类型「Zelle / Venmo 转入」，报销也算收入；这里把这些记录按付款方列出来，你逐个决定：
 *   先不动（默认）/ 支出退回 → 负数花费（选分类）/ 是收入（改成赠与、副业…）/ 转让二手 → 出售所得 / 朋友还我借的钱 → 本金返还。
 * 谨慎（用户要求）：
 *   · 只列类型还是「Zelle / Venmo 转入」或「报销」的：你已经改过类型的不会出现；需要还的、填了「其中认定收入」的、有还款记录的也不列；
 *   · 默认「先不动」（以前在银行导入里给这个付款方选过支出退回分类的，预选那个分类）；
 *   · 每笔都能单独去掉勾；已经有一笔同金额的负数花费（±3 天）的，默认不勾并写出对上的是哪一笔；
 *   · 「应用」前弹确认框写清楚要改几笔；改成负数花费时先写花费、写成功了才删收入记录，失败的那笔原样留着。 */
import { state } from "../core/state.js";
import { Store } from "../core/store.js";
import { esc, money, toast } from "../core/util.js";
import { t } from "../core/i18n.js";
import { spendChanged } from "../core/spend-data.js";
import { categoryOptions } from "../pantry/views.js";
import { meta, saveMeta } from "../bills/budget.js";
import { loadNear, nearRows } from "../stats/dup-check.js";
import { inc, incomeRules, isOwnerNow, kindLabel, kindOptionsHtml, loadIncome, skey } from "./logic.js";

const FIX_KINDS = ["zelle", "reimburse"];
const MODES = [["skip", "先不动"], ["aa", "支出退回（AA / 垫付还回）→ 负数花费"], ["income", "是收入（赠与、副业收款…）"], ["sale", "转让二手 → 出售所得（不算收入）"], ["loanback", "朋友还我借的钱 → 本金返还（不算收入）"]];
const KIND_OF = { sale: "sale", loanback: "returned_principal" };
const st = () => (inc().aafix ||= { open: false, mode: {}, cat: {}, kind: {}, off: new Set(), on: new Set(), remember: true, busy: false, near: false });
let hooks = { redraw: () => {} };

/** 能改的、还是这两种类型的记录（不含需要还的 / 填了认定收入的 / 有还款的） */
function candidates() {
  const I = inc(), me = state.user?.id, owner = isOwnerNow(), repaid = new Set((I.rep || []).map((p) => p.record_id));
  return (I.rec || []).filter((r) => FIX_KINDS.includes(r.kind) && !r.repay_required && r.income_amount == null && !repaid.has(r.id) && (owner || r.created_by === me));
}
function groups() {
  const m = new Map();
  for (const r of candidates()) { const k = skey(r.source_name) || "?"; const g = m.get(k) || { key: k, name: r.source_name || t("（没写付款方）"), rows: [], total: 0 }; g.rows.push(r); g.total += +r.amount || 0; m.set(k, g); }
  for (const g of m.values()) g.rows.sort((a, b) => b.received_on.localeCompare(a.received_on));
  return [...m.values()].sort((a, b) => b.total - a.total);
}
/** 这笔已经有同金额的负数花费（±3 天）：多半以前手动记过退款了 */
const dupOf = (r) => (nearRows(r.received_on, -(+r.amount)) || []).find((p) => +p.amount < 0) || null;
const modeOf = (g) => { const S = st(); if (!(g.key in S.mode)) { const rr = (meta("_refund_rules", {}) || {})[g.key]; S.mode[g.key] = rr ? "aa" : "skip"; if (rr && !(g.key in S.cat)) S.cat[g.key] = rr; } return S.mode[g.key]; };
const picked = (g, r) => { const S = st(); if (S.off.has(r.id)) return false; if (S.on.has(r.id)) return true; return !(modeOf(g) === "aa" && dupOf(r)); };

export const aaFixCount = () => candidates().length;

export function aaFixHtml() {
  const list = groups(); if (!list.length) return "";
  const S = st(), n = list.reduce((a, g) => a + g.rows.length, 0), sum = list.reduce((a, g) => a + g.total, 0);
  if (S.open && !S.near) { S.near = true; loadNear(candidates().map((r) => ({ d: r.received_on, a: -(+r.amount) }))).then((fresh) => { if (fresh) hooks.redraw(); }).catch(() => {}); }
  const head = `<div class="notice aafix-note" role="status"><b>${t("有 {n} 笔 Zelle / Venmo 转入或报销记成了收入（共 {m}）", { n, m: money(sum) })}</b>
    <br><small>${t("朋友 AA 还你、替人垫付后还回的钱是你自己的钱回来了，不算收入，应该记成「支出退回」（所选花费分类的负数花费）。按付款方逐个看一下，默认都不动。")}</small>
    <div class="form-actions" style="margin-top:6px"><button type="button" class="btn btn-sm" data-aafix="toggle" aria-expanded="${S.open}">${S.open ? t("收起") : t("逐个付款方整理")}</button></div></div>`;
  if (!S.open) return head;
  const rowsHtml = list.map((g) => {
    const mode = modeOf(g), on = g.rows.filter((r) => picked(g, r)), dups = mode === "aa" ? g.rows.filter(dupOf).length : 0;
    const extra = mode === "aa" ? `<select data-aafix-cat="${esc(g.key)}" aria-label="${esc(t("退回到哪个花费分类"))}"><option value="">${esc(t("— 选花费分类 —"))}</option>${categoryOptions(S.cat[g.key] || "", { withOther: true, spend: true })}</select>`
      : mode === "income" ? `<select data-aafix-kind="${esc(g.key)}" aria-label="${esc(t("收入类型"))}">${kindOptionsHtml(S.kind[g.key] || g.rows[0].kind)}</select>` : "";
    const warn = mode === "aa" && !S.cat[g.key] ? ` · <b class="bank-dup">${t("选个花费分类才会改")}</b>` : "";
    const lines = g.rows.map((r) => { const d = mode === "aa" ? dupOf(r) : null;
      return `<li><label class="check-inline"><input type="checkbox" data-aafix-row="${esc(r.id)}" data-g="${esc(g.key)}" ${picked(g, r) ? "checked" : ""}><span>${esc(r.received_on)} · ${money(+r.amount)} · ${esc(kindLabel(r.kind))}${r.notes ? ` · <span class="muted">${esc(r.notes)}</span>` : ""}${d ? ` · <b class="bank-dup">${esc(t("已经有一笔 {a} 的花费：{x}", { a: money(+d.amount), x: `${d.name} · ${String(d.purchased_at).slice(0, 10)}` }))}</b>` : ""}</span></label></li>`; }).join("");
    return `<li class="aafix-g"><div class="grow"><span class="name">${esc(g.name)}</span><small>${t("{n} 笔", { n: g.rows.length })} · ${money(g.total)} · ${esc(g.rows.at(-1).received_on)} → ${esc(g.rows[0].received_on)}${mode !== "skip" ? ` · ${t("勾了 {k} 笔", { k: on.length })}` : ""}${dups ? ` · <b class="bank-dup">${t("{k} 笔可能已经记过退款，默认没勾", { k: dups })}</b>` : ""}${warn}</small>
      <details class="bank-dups"><summary>${t("逐笔核对")}</summary><ul class="plain small" style="margin:6px 0 0">${lines}</ul></details></div>
      <div class="bank-ipick"><select data-aafix-mode="${esc(g.key)}" aria-label="${esc(t("这个付款方的钱是什么"))}">${MODES.map(([v, l]) => `<option value="${v}" ${v === mode ? "selected" : ""}>${esc(t(l))}</option>`).join("")}</select>${extra}</div></li>`;
  }).join("");
  const plan = planOf();
  return `${head}<div class="panel aafix">
    <ul class="restock-list bank-list">${rowsHtml}</ul>
    <label class="check-inline" style="margin-top:8px"><input type="checkbox" data-aafix-remember ${S.remember ? "checked" : ""}><span>${t("记住这些付款方的选择（以后导入对账单自动套用）")}</span></label>
    <div class="form-actions"><button type="button" class="btn btn-primary" data-aafix="apply" ${plan.total && !S.busy ? "" : "disabled"}>${S.busy ? t("处理中…") : t("应用（{n} 笔）", { n: plan.total })}</button></div></div>`;
}

/** 要做的事：每组按选的方式、只算勾上的 */
function planOf() {
  const S = st(), out = { aa: [], kind: [], total: 0 };
  for (const g of groups()) {
    const mode = modeOf(g); if (mode === "skip") continue;
    const rows = g.rows.filter((r) => picked(g, r)); if (!rows.length) continue;
    if (mode === "aa") { if (!S.cat[g.key]) continue; for (const r of rows) out.aa.push({ r, cat: S.cat[g.key], key: g.key }); }
    else { const kind = mode === "income" ? S.kind[g.key] || g.rows[0].kind : KIND_OF[mode]; for (const r of rows) if (r.kind !== kind) out.kind.push({ r, kind, key: g.key }); }
  }
  out.total = out.aa.length + out.kind.length;
  return out;
}

async function apply() {
  const S = st(), plan = planOf(); if (!plan.total || S.busy) return;
  const msg = [plan.aa.length && t("{n} 笔改成支出退回（负数花费，合计 {m}），原来的收入记录删掉", { n: plan.aa.length, m: money(-plan.aa.reduce((a, x) => a + (+x.r.amount || 0), 0)) }),
    plan.kind.length && t("{n} 笔改收入类型", { n: plan.kind.length })].filter(Boolean).join("\n");
  if (!window.confirm(`${t("确认整理？")}\n${msg}`)) return;
  S.busy = true; hooks.redraw();
  let ok = 0, fail = 0, noBatch = false;
  for (const { r, cat } of plan.aa) {
    const row = { item_id: null, name: t("{n} · 支出退回", { n: r.source_name || "" }), category: cat, quantity: null, unit: null, store: r.source_name || "", amount: -(+r.amount), currency: r.currency || null,
      purchased_at: new Date(`${r.received_on}T12:00:00`).toISOString(), ...(r.account_id ? { card_id: r.account_id } : {}) };
    try {
      try { await Store.addPurchase(!noBatch && r.import_batch ? { ...row, import_batch: r.import_batch } : row); }   // 留着导入批次：撤销那批时一起删
      catch (e) { if (/import_batch/i.test(e.message)) { noBatch = true; await Store.addPurchase(row); } else throw e; }
      await Store.deleteIncomeRecord(r.id); ok++;   // 花费写成功了才删收入
    } catch (e) { fail++; console.warn("[aafix]", e.message); }
  }
  for (const { r, kind } of plan.kind) { try { await Store.saveIncomeRecord({ ...r, kind }); ok++; } catch (e) { fail++; console.warn("[aafix]", e.message); } }
  if (S.remember) {   // 记住：支出退回按付款方记分类；其余记收入类型，删掉旧的支出退回规则
    const ref = { ...(meta("_refund_rules", {}) || {}) }, incR = { ...incomeRules() };
    for (const x of plan.aa) { ref[x.key] = x.cat; delete incR[x.key]; }
    for (const x of plan.kind) { incR[x.key] = x.kind; delete ref[x.key]; }
    await saveMeta({ _refund_rules: Object.fromEntries(Object.entries(ref).slice(-300)), _income_rules: Object.fromEntries(Object.entries(incR).slice(-300)) }).catch(() => {});
  }
  inc().aafix = null;
  await loadIncome(); if (plan.aa.length) spendChanged();
  toast(fail ? t("整理了 {n} 笔，{k} 笔没成功（原样留着）", { n: ok, k: fail }) : t("整理了 {n} 笔", { n: ok }));
  hooks.redraw();
}

export function initAaFix({ redraw }) {
  hooks = { redraw };
  const main = document.getElementById("main"); if (!main) return;
  main.addEventListener("click", (e) => {
    const b = e.target.closest?.("[data-aafix]"); if (!b) return;
    const S = st();
    if (b.dataset.aafix === "toggle") { S.open = !S.open; return hooks.redraw(); }
    if (b.dataset.aafix === "apply") apply();
  });
  main.addEventListener("change", (e) => {
    const el = e.target, S = st(), d = el.dataset || {};
    if (d.aafixMode !== undefined) { S.mode[d.aafixMode] = el.value; return hooks.redraw(); }
    if (d.aafixCat !== undefined) { S.cat[d.aafixCat] = el.value; return hooks.redraw(); }
    if (d.aafixKind !== undefined) { S.kind[d.aafixKind] = el.value; return hooks.redraw(); }
    if (d.aafixRow !== undefined) { const id = d.aafixRow; if (el.checked) { S.off.delete(id); S.on.add(id); } else { S.on.delete(id); S.off.add(id); } return hooks.redraw(); }
    if (d.aafixRemember !== undefined) { S.remember = el.checked; }
  });
}
