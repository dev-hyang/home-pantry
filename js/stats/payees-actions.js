/* 花费 → 收款方：展开一行、整理收款方（按内置规则 / 别名归组）、改名 / 合并 / 撤销。 */
import { $, esc, money, toast } from "../core/util.js";
import { CTX, LAST, NAMES, filtered, loadNames, nodeText, payeeDrill, renderPayeeList, sorted } from "./payees-data.js";
import { Store } from "../core/store.js";
import { builtinPayee, userPayeeAliases } from "../core/payee-alias.js";
import { download, dq, monthLabel, statKit, toCsv } from "./views.js";
import { href } from "../core/router.js";
import { nodeOf } from "../core/taxonomy.js";
import { pageSize } from "../core/pager.js";
import { rangeMonthsOf } from "../core/time-range.js";
import { saveMeta } from "../bills/budget.js";
import { spendChanged } from "../core/spend-data.js";
import { state } from "../core/state.js";
import { storeAgg } from "./report.js";
import { t } from "../core/i18n.js";
import { P } from "./payees-common.js";

/* ── 展开一行：这家近 12 个月每月花了多少 + 主要买什么（和时间范围无关，看得出是不是越花越多） ── */
export function detailHtml(x) {
  const ms = rangeMonthsOf("12"), rows = statKit.rollup(`${ms[0]}-01`, `${nextMonth(ms.at(-1))}-01`, true);
  if (!rows) return statKit.LOADING();
  const mine = rows.filter((r) => (r.sk || "__none__") === x.key), opts = { l1: CTX.l1, ...statKit.statOpts() };
  const vals = ms.map((m) => Math.round((storeAgg(mine, [m], opts)[0]?.total || 0) * 100) / 100), tot = vals.reduce((a, v) => a + v, 0);
  const all = storeAgg(mine, ms, opts)[0], parts = all ? Object.entries(all.byL2).sort((a, b) => b[1] - a[1]).slice(0, 4) : [];
  const chart = window.Charts.bars({ title: t("{name} 近 12 个月", { name: x.name }), labels: ms.map(monthLabel), fmt: money, showTotals: false,
    series: [{ name: x.name, color: "var(--pine, #2c6a57)", values: vals }], drill: (_, i) => dq({ store: x.key, month: ms[i], ...(CTX.l1 !== "all" ? { cat: CTX.l1 } : {}) }) });
  const used = vals.filter((v) => v > 0).length;
  return `<div class="payee-detail"><div class="pd-head"><b>${esc(t("近 12 个月"))}</b><span class="muted small">${esc(t("合计 {m} · {n} 个月有花费 · 月均 {a}", { m: money(tot), n: used, a: money(used ? tot / used : 0) }))}</span></div>
    ${chart}
    ${parts.length ? `<p class="pd-parts">${parts.map(([k, v]) => `<span class="chip tidy-chip">${esc(nodeText(nodeOf(k)) || k)} <small>${all.total > 0 ? Math.round((v / all.total) * 100) : 0}%</small></span>`).join("")}</p>` : ""}
    <div class="form-actions"><button type="button" class="btn btn-sm btn-ghost" data-drill="${esc(payeeDrill([x.key]))}">${t("查看明细")} ›</button></div></div>`;
}
const nextMonth = (m) => { const d = new Date(+m.slice(0, 4), +m.slice(5, 7), 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
/** 导入完成页的提示：全历史里还有几组可以合并的收款方（名单没读到时先读，读完重画）；0 组不显示 */
export function tidyHintHtml() {
  if (!NAMES.rows) { loadNames(); return `<span data-tidy-wait hidden></span>`; }
  if (NAMES.missing) return "";
  const groups = tidyGroups(); if (!groups.length) return "";
  const eg = groups[0], from = eg.members.find((m) => m.store !== eg.to)?.store || eg.members[0].store;
  return `<p class="tidy-hint"><span>${esc(t("另有 {n} 组收款方是同一家的不同写法（比如 {a} → {b}），可以合并。", { n: groups.length, a: from, b: eg.to }))}</span> <a class="btn btn-sm btn-ghost" href="${href("bills", "spend")}?tab=stores&tidy=1">${t("去整理")} ›</a></p>`;
}
/* ── 整理收款方：按内置规则 / 你记的别名，把同一家的不同写法归成一组（全历史） ── */
function tidyGroups() {
  const ua = userPayeeAliases(), by = new Map();
  for (const r of NAMES.rows || []) {
    if (r.store_key === "__none__" || !r.store) continue;
    const to = ua[r.store_key] || builtinPayee(r.store);
    if (!to) continue;
    const g = by.get(to.toLowerCase()) || { to, members: [] };
    g.members.push(r); by.set(to.toLowerCase(), g);
  }
  return [...by.values()].filter((g) => g.members.some((m) => m.store !== g.to)).sort((a, b) => b.members.reduce((s, m) => s + m.n, 0) - a.members.reduce((s, m) => s + m.n, 0));
}
export function tidyHtml() {
  const S = P();
  if (!NAMES.rows) return `<div class="panel">${statKit.LOADING()}</div>`;
  if (NAMES.missing) return `<div class="panel notice" role="status">${t("执行 supabase/migrations/062_payees.sql 后才能整理收款方。")}</div>`;
  const groups = tidyGroups();
  const body = groups.length ? `<ul class="tidy-list">${groups.map((g, i) => {
    const n = g.members.reduce((a, m) => a + m.n, 0), on = !S.tidyOff.has(i);
    return `<li class="tidy-row"><label class="tidy-pick"><input type="checkbox" data-action="payee-tidy-pick" data-i="${i}" ${on ? "checked" : ""}><span class="sr-only">${esc(t("合并这一组"))}</span></label>
      <div class="tidy-from">${g.members.map((m) => `<span class="chip tidy-chip">${esc(m.store)} <small>${esc(t("{n} 笔", { n: m.n }))}</small></span>`).join("")}</div>
      <div class="tidy-to"><span aria-hidden="true">→</span><input data-tidy-to="${i}" maxlength="40" value="${esc(S.tidyTo[i] ?? g.to)}" aria-label="${esc(t("合并后的名字"))}"><small class="muted">${esc(t("共 {n} 笔", { n }))}</small></div></li>`;
  }).join("")}</ul>
    <div class="form-actions"><button type="button" class="btn btn-sm btn-primary" data-action="payee-tidy-go">${t("合并所选 {n} 组", { n: groups.length - [...S.tidyOff].filter((i) => i < groups.length).length })}</button><button type="button" class="btn btn-sm btn-ghost" data-action="payee-tidy">${t("关闭")}</button></div>`
    : `<p class="muted" style="margin:0">${t("没有需要合并的收款方：同一家的不同写法都已经是一个名字了。")}</p>`;
  return `<div class="panel tidy-panel"><h3>${t("整理收款方")}</h3>
    <p class="muted chart-sub">${t("同一家商户在对账单上有好几种写法（AMAZON MKTPL、Amazon.com、AMZN Mktp…），按规则合成一个名字；Amazon Prime 会员单独保留。改的是全部历史，合并后可以撤销。")}</p>${body}</div>`;
}
/* ── 改名 / 合并 / 撤销 ── */
const UNDO_KEY = "hmh-payee-undo";
export const undoLog = () => { try { return JSON.parse(localStorage.getItem(UNDO_KEY) || "[]"); } catch { return []; } };
const saveUndo = (list) => { try { localStorage.setItem(UNDO_KEY, JSON.stringify(list.slice(-5))); } catch { /* 太大或不能存：撤销就不可用 */ } };
/** groups: [{ keys: [小写收款方], to }]；一次做完、记别名、记撤销 */
async function mergeGroups(groups) {
  const rows = [], aliases = {}, ua = { ...userPayeeAliases() };
  let n = 0;
  for (const g of groups) {
    const to = String(g.to || "").trim().slice(0, 40); if (!to) continue;
    const done = await Store.renamePayees(g.keys, to);
    rows.push(...done); n += done.length;
    for (const k of g.keys) if (k !== to.toLowerCase()) { aliases[k] = ua[k] ?? null; ua[k] = to; }
  }
  if (!n) { toast(t("没有可以改的记录：账单 / 医疗的收款方要在那张账单上改。")); return 0; }
  await saveMeta({ _payee_alias: ua });
  saveUndo([...undoLog(), { at: new Date().toISOString(), rows, aliases }]);
  spendChanged();
  return n;
}
async function undoLast() {
  const log = undoLog(), last = log.pop(); if (!last) return;
  await Store.restorePayees(last.rows);
  const ua = { ...userPayeeAliases() };
  for (const [k, prev] of Object.entries(last.aliases || {})) { if (prev == null) delete ua[k]; else ua[k] = prev; }
  await saveMeta({ _payee_alias: ua });
  saveUndo(log); spendChanged();
  toast(t("已撤销：{n} 笔恢复原来的收款方", { n: last.rows.length }));
}
function exportCsv() {
  if (!LAST) return;
  const list = sorted(filtered(LAST)), total = LAST.reduce((a, x) => a + x.total, 0);
  const rows = [[t("收款方"), t("主要分类"), t("次数"), t("合计"), t("占比"), t("平均每笔"), t("最近一次")],
    ...list.map((x) => [x.name, nodeText(x.node), x.count, Math.round(x.total * 100) / 100, total > 0 ? `${Math.round((x.total / total) * 1000) / 10}%` : "", Math.round((x.total / x.count) * 100) / 100, x.last ? String(x.last).slice(0, 10) : ""])];
  const hh = (state.household?.name || t("家庭")).replace(/[\\/:*?"<>|（）()\s]/g, "");
  download(`${hh}-${t("收款方汇总")}.csv`, toCsv(rows));
}
/** 点击：main.js 把 payee-* 都交给这里 */
export async function payeeAction(act, el, { render }) {
  const S = P();
  switch (act) {
    case "payee-sort": { const k = el.dataset.k, o = S.sort; S.sort = { k, dir: o.k === k ? (o.dir === "asc" ? "desc" : "asc") : k === "name" || k === "kind" ? "asc" : "desc" }; return renderPayeeList(); }
    case "payee-more": S.limit = (S.limit || pageSize()) + pageSize(); return renderPayeeList();
    case "payee-rename": S.renameKey = el.dataset.key || null; renderPayeeList(); $("#payeeTo")?.focus(); return;
    case "payee-open": S.open = S.open === el.dataset.key ? null : el.dataset.key; return renderPayeeList();
    case "payee-rename-go": {
      const to = $("#payeeTo")?.value.trim(); if (!to) return;
      el.disabled = true;
      const n = await mergeGroups([{ keys: [el.dataset.key], to }]);
      S.renameKey = null; if (n) toast(t("已改名：{n} 笔记成「{to}」", { n, to }));
      return render();
    }
    case "payee-sel": S.sel = S.sel ? null : new Set(); S.mergeTo = ""; S.renameKey = null; return render();
    case "payee-pick": { const k = el.dataset.key; S.sel.has(k) ? S.sel.delete(k) : S.sel.add(k); return renderPayeeList(); }
    case "payee-merge": {
      const to = ($("#payeeMergeTo")?.value || "").trim(), keys = [...S.sel]; if (!to || keys.length < 2) return;
      el.disabled = true;
      const n = await mergeGroups([{ keys, to }]);
      if (n) toast(t("已合并：{n} 笔记成「{to}」", { n, to }));
      S.sel = null; S.mergeTo = ""; return render();
    }
    case "payee-tidy": S.tidy = !S.tidy; S.tidyOff = new Set(); S.tidyTo = {}; if (S.tidy && !NAMES.rows) loadNames(); return render();
    case "payee-tidy-pick": { const i = +el.dataset.i; S.tidyOff.has(i) ? S.tidyOff.delete(i) : S.tidyOff.add(i); return render(); }
    case "payee-tidy-go": {
      const groups = tidyGroups().map((g, i) => ({ keys: g.members.map((m) => m.store_key), to: S.tidyTo[i] ?? g.to, i })).filter((g) => !S.tidyOff.has(g.i));
      if (!groups.length) return;
      el.disabled = true;
      const n = await mergeGroups(groups);
      if (n) toast(t("已整理 {g} 组，{n} 笔", { g: groups.length, n }));
      S.tidy = false; NAMES.rows = null; return render();
    }
    case "payee-undo": el.disabled = true; await undoLast(); NAMES.rows = null; return render();
    case "payee-csv": return exportCsv();
  }
}
/** 输入：搜索、合并后的名字（main.js 的 input 事件交给这里；返回 true = 处理过） */
export function payeeInput(e, searchSoon) {
  const S = P(), id = e.target.id;
  if (id === "payeeSearch") { S.q = e.target.value; S.limit = 0; searchSoon(renderPayeeList); return true; }
  if (id === "payeeMergeTo") { S.mergeTo = e.target.value; return true; }
  if (e.target.dataset.tidyTo != null) { S.tidyTo[+e.target.dataset.tidyTo] = e.target.value; return true; }
  return false;
}
/** 排序下拉（手机上表头不显示） */
export function payeeChange(e) {
  if (e.target.id !== "payeeSort") return false;
  const [k, dir] = e.target.value.split(":"); P().sort = { k, dir }; renderPayeeList(); return true;
}
