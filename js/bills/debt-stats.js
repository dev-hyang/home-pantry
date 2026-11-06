/* 财务 → 借贷的统计面板（2026-11 改版：原「借贷总览」页就是借贷的进入页）。
 * 标签：全部借贷（进入页）· 资产融资 · 个人借贷 · 还款记录（js/core/tabs.js DEBT_TABS；手机下拉、宽屏标签条）。前三个都是全部历史，含已还清的。
 * 面板：指标卡（我还欠、借出未收、总借入、总借出、已结清；资产融资是 未还贷款、每月还款、总借入、已结清）→ 现在欠的钱（构成 + 和净资产的关系）→
 * 按对方汇总，两种视图可切换（记在本机）：借入 / 借出（两栏进度条，每栏最多露 5 位，多的在框里上下滑）、表格（表头排序，最多露 10 行）。
 * 名字的链接：资产融资只有一笔 → 贷款详情，几笔 → 资产融资页下面的贷款列表（按名字筛好）；
 * 个人借贷 → 个人借贷页下面的借贷列表（按名字和方向筛好；在个人借贷页里只有一笔时直接进详情）。
 * 金额口径（每笔借贷）：总额 = max(原始本金, 未还 + 已还本金 + 核销)，「又借入 / 又借出」也算进去；已还 = 总额 − 未还；
 * 已结束的（还清 / 核销 / 关闭）未还按 0；不知道余额的（没填本金）总额按原始本金、已还按记过的还本流水，未还记「—」不算进合计。
 * 数据全在内存（state.debts / state.debtTxns），小表，直接算。 */
import { state } from "../core/state.js";
import { esc, fmtDate } from "../core/util.js";
import { t } from "../core/i18n.js";
import { href } from "../core/router.js";
import { debtCat, debtGroup, isClosedStatus } from "../core/debt-rules.js";
import { debtHref } from "./debt-logic.js";
import { liveNetWorth } from "./nw-logic.js";
import { r2 } from "../core/amortization.js";

const cur = () => Units.region.currency;
const mny = (v, c) => (v == null ? "—" : Units.money(v, c || cur()));
const ui = () => (state.debtUi ||= {});
export const SEGS = [["all", "全部借贷"], ["asset", "资产融资"], ["personal", "个人借贷"]];
export const debtTabHref = (tab = "all") => `${href("bills", "debts")}${tab && tab !== "all" ? `?tab=${tab}` : ""}`;
/** 旧的「借贷总览」网址（?view=summary&seg=…）现在就是对应的标签 */
export const summaryHref = (seg = "all") => debtTabHref(seg);
/** 标签下面的列表按名字（和方向）筛好，并滚到列表 */
export const recsHref = (tab, { who = "", dir = "" } = {}) => `${href("bills", "debts")}?tab=${tab}${who ? `&who=${encodeURIComponent(who)}` : ""}${dir ? `&dir=${dir}` : ""}&at=rec`;

/** 一笔借贷的统计口径：总额、已还、未还（null = 不知道）、是否结清、开始日期 */
export function debtFigures(e) {
  const closed = isClosedStatus(e.status);
  const repaid = (e.txns || []).reduce((s, x) => s + (x.type === "principal_repayment" || x.type === "write_off" ? Math.abs(Number(x.principal_amount) || 0) : 0), 0);
  const bal = closed ? 0 : e.balance;
  const total = bal == null ? e.original || repaid || 0 : Math.max(e.original || 0, r2(bal + repaid));
  const paid = bal == null ? Math.min(repaid, total) : r2(Math.max(0, total - bal));
  const date = e.start_date || (e.txns || []).map((x) => x.txn_date).sort()[0] || (e.created_at || "").slice(0, 10) || "";
  return { total: r2(total), paid: r2(paid), left: bal == null ? null : r2(bal), settled: closed || bal === 0, date };
}

/** 按方向 / 对方汇总；seg 过滤资产融资或个人借贷 */
export function debtStats(all, seg = "all") {
  const list = all.filter((e) => seg === "all" || debtGroup(e) === seg).map((e) => ({ e, f: debtFigures(e) }));
  const sum = (arr, k) => r2(arr.reduce((s, x) => s + (x.f[k] || 0), 0));
  const side = (dir) => { const l = list.filter((x) => x.e.direction === dir); return { n: l.length, total: sum(l, "total"), paid: sum(l, "paid"), left: sum(l, "left") }; };
  const settled = list.filter((x) => x.f.settled), open = list.filter((x) => !x.f.settled);
  const people = new Map();
  for (const x of list) {
    const name = (x.e.counterparty_name || x.e.name || "").trim() || t("（没写对方）"), grp = debtGroup(x.e);
    const key = `${grp}|${x.e.direction}|${name.toLowerCase()}`;   // 同一个名字的资产融资和个人借贷分两行（链接去的页面不一样）
    const p = people.get(key) || { key, name, grp, dir: x.e.direction, n: 0, total: 0, paid: 0, left: 0, unknown: 0, last: "", ids: [] };
    p.n++; p.total += x.f.total; p.paid += x.f.paid; p.left += x.f.left || 0; if (x.f.left == null) p.unknown++;
    if (x.f.date > p.last) p.last = x.f.date; p.ids.push(x.e.id);
    people.set(key, p);
  }
  const rows = [...people.values()].map((p) => ({ ...p, total: r2(p.total), paid: r2(p.paid), left: r2(p.left), pct: p.total > 0 ? Math.min(100, Math.round((p.paid / p.total) * 100)) : 0 }));
  const cats = new Map();
  for (const x of list) { const c = cats.get(x.e.category) || { cat: x.e.category, n: 0, total: 0, left: 0 }; c.n++; c.total += x.f.total; c.left += x.f.left || 0; cats.set(x.e.category, c); }
  return { list, borrowed: side("payable"), lent: side("receivable"), settled: { n: settled.length, total: sum(settled, "total") }, open: { n: open.length, left: sum(open, "left"), total: sum(open, "total") },
    rows, cats: [...cats.values()].map((c) => ({ ...c, total: r2(c.total), left: r2(c.left) })).sort((a, b) => b.left - a.left || b.total - a.total) };
}

/** 现在欠的钱按类型：资产融资所欠、个人借贷所欠、借出未收 */
export function owedSplit(all) {
  const open = all.filter((e) => !isClosedStatus(e.status) && e.balance != null);
  const s = (f) => r2(open.filter(f).reduce((a, e) => a + e.balance, 0));
  return { asset: s((e) => e.direction === "payable" && debtGroup(e) === "asset"), personal: s((e) => e.direction === "payable" && debtGroup(e) === "personal"), lent: s((e) => e.direction === "receivable") };
}

/* ───────────── 视图 ───────────── */
const VKEY = "hmh-debt-view";
const viewMode = () => { try { return localStorage.getItem(VKEY) === "table" ? "table" : "group"; } catch { return "group"; } };
const SORT_COLS = [["name", "对方"], ["dir", "方向"], ["n", "笔数"], ["total", "总额"], ["paid", "已还"], ["left", "未还"], ["pct", "进度"], ["last", "最近"]];
const sortRows = (rows, { k = "total", d = "desc" } = {}) => {
  const v = (r) => (k === "name" ? r.name.toLowerCase() : k === "dir" ? r.dir : r[k] ?? "");
  const s = [...rows].sort((a, b) => { const x = v(a), y = v(b); return x < y ? -1 : x > y ? 1 : b.total - a.total; });
  return d === "desc" ? s.reverse() : s;
};
const bar = (pct, cls = "") => `<span class="ds-bar ${cls}" aria-hidden="true"><i style="width:${pct}%"></i></span>`;
const kpi = (label, value, sub) => `<div class="kpi"><span>${esc(label)}</span><b>${value}</b>${sub ? `<small>${sub}</small>` : ""}</div>`;

/** 名字链到哪（见文件头）；tab = 现在所在的标签 */
function rowHref(r, tab) {
  if (r.grp === "asset") return r.ids.length === 1 ? debtHref(r.ids[0]) : recsHref("asset", { who: r.name });
  if (tab === "personal" && r.ids.length === 1) return debtHref(r.ids[0]);
  return recsHref("personal", { who: r.name, dir: r.dir });
}
const rowLink = (r, tab) => `<a href="${esc(rowHref(r, tab))}">${esc(r.name)}</a>`;

function progressGroup(title, rows, dir, tab) {
  const l = rows.filter((r) => r.dir === dir).sort((a, b) => b.total - a.total);
  if (!l.length) return "";
  const verb = dir === "payable" ? t("借入") : t("借出"), back = dir === "payable" ? t("已还") : t("已收回");
  const line = (r) => {
    const label = t("{name}：{verb} {a}，{back} {b}，{p}%", { name: r.name, verb, a: mny(r.total), back, b: mny(r.paid), p: r.pct });
    return `<li class="ds-prow" aria-label="${esc(label)}">
      <div class="ds-ptop"><b>${rowLink(r, tab)}</b>${r.n > 1 ? `<small class="muted">${t("{n} 笔借贷", { n: r.n })}</small>` : ""}<span class="ds-pct ${r.pct >= 100 ? "done" : ""}">${r.pct >= 100 ? `✓ ${t("已结清")}` : `${r.pct}%`}</span></div>
      ${bar(r.pct, r.pct >= 100 ? "done" : dir === "receivable" ? "recv" : "")}
      <div class="ds-pnums"><span>${verb} <b>${mny(r.total)}</b></span><span>${back} ${mny(r.paid)}</span><span class="${r.left > 0 ? "ds-left" : "muted"}">${r.unknown && !r.left ? t("未还 不知道") : r.left > 0 ? t("余 {a} 未结清", { a: mny(r.left) }) : t("无余额")}</span></div></li>`;
  };
  // 最多露 5 位，多的在框里上下滑（data-cap，高度由 capLists 量）
  const scroll = l.length > 5 ? `data-cap="5" tabindex="0" role="region" aria-label="${esc(title)}"` : "";
  return `<div class="panel ds-group"><h3>${title} <small class="muted">${t("{n} 位", { n: l.length })}</small></h3>
    <ul class="ds-plist ${scroll ? "ds-scroll" : ""}" ${scroll}>${l.map(line).join("")}</ul></div>`;
}

function sortTable(rows, tab) {
  const s = ui().dsSort || { k: "total", d: "desc" };
  const th = ([k, l]) => {
    const on = s.k === k, aria = on ? (s.d === "asc" ? "ascending" : "descending") : "none";
    return `<th scope="col" class="${["name", "dir"].includes(k) ? "" : "num"}" aria-sort="${aria}"><button type="button" class="ds-sort" data-ds="sort" data-k="${k}">${t(l)}<span aria-hidden="true">${on ? (s.d === "asc" ? " ▲" : " ▼") : " ↕"}</span></button></th>`;
  };
  const tr = (r) => `<tr><th scope="row">${rowLink(r, tab)}</th>
    <td>${r.dir === "payable" ? t("借入") : t("借出")}</td><td class="num">${r.n}</td><td class="num">${mny(r.total)}</td><td class="num">${mny(r.paid)}</td>
    <td class="num">${r.unknown && !r.left ? "—" : mny(r.left)}</td><td class="num">${r.pct}%</td><td class="num">${r.last ? esc(fmtDate(r.last)) : "—"}</td></tr>`;
  // 最多露 10 行，多的在框里上下滑（表头固定）；窄屏左右也能滑
  return `<div class="panel ds-tpanel"><div class="table-scroll ds-tscroll" ${rows.length > 10 ? 'data-cap="10"' : ""} tabindex="0" role="region" aria-label="${esc(t("按对方汇总，点表头排序"))}"><table class="dd-tbl ds-tbl"><caption class="sr-only">${t("按对方汇总，点表头排序")}</caption>
    <thead><tr>${SORT_COLS.map(th).join("")}</tr></thead><tbody>${sortRows(rows, s).map(tr).join("")}</tbody></table></div></div>`;
}

/** 现在欠的钱的构成 + 和净资产的关系（原首页的「欠款构成」「负债 / 总资产」卡片并到这里） */
function owedPanel(all, seg) {
  const o = owedSplit(all), nw = state.nwOk ? liveNetWorth() : null;
  const parts = [["asset", t("资产融资所欠"), o.asset, "a"], ["personal", t("个人借贷所欠"), o.personal, "p"], ["lent", t("借出未收"), o.lent, "r"]]
    .filter(([k]) => seg === "all" || (seg === "asset" ? k === "asset" : k !== "asset"));
  const owe = parts.filter(([k]) => k !== "lent").reduce((s, x) => s + x[2], 0), max = Math.max(1, ...parts.map((x) => x[2]));
  const rel = nw ? [
    nw.liabilitiesTotal > 0 && owe > 0 ? t("占总负债 {p}%（总负债 {a}，含信用卡欠款等）", { p: Math.round((owe / nw.liabilitiesTotal) * 100), a: mny(nw.liabilitiesTotal) }) : null,
    nw.assetsTotal > 0 ? t("负债 / 总资产 = {p}%", { p: Math.round((nw.liabilitiesTotal / nw.assetsTotal) * 100) }) : null,
    o.lent > 0 && seg !== "asset" ? t("借出未收 {a} 算在资产里（应收）", { a: mny(o.lent) }) : null,
  ].filter(Boolean) : [];
  // 全部借贷页：每一类点过去是那个标签
  const lab = (k, l) => (seg === "all" ? `<a href="${esc(debtTabHref(k === "asset" ? "asset" : "personal"))}">${esc(l)}</a>` : esc(l));
  return `<div class="panel ds-owed"><div class="chart-head"><h3>${t("现在欠的钱")}</h3>${nw ? `<a class="btn btn-sm btn-ghost" href="${href("bills", "networth")}">${t("净资产")} ${mny(nw.netWorth)} ›</a>` : ""}</div>
    <ul class="ds-olist">${parts.map(([k, l, v, cls]) => `<li><span class="ds-olabel"><span class="ds-sw ${cls}" aria-hidden="true"></span>${lab(k, l)}</span>${bar(Math.round((v / max) * 100), `o-${cls}`)}<b class="num">${mny(v)}</b></li>`).join("")}</ul>
    ${rel.length ? `<p class="muted ds-rel">${rel.map(esc).join(" · ")}</p>` : ""}</div>`;
}

function catPanel(cats) {
  if (cats.length < 2) return "";
  return `<details class="panel ref-panel dd-fold"><summary><b>${t("按类型")}</b><small>${t("{n} 种", { n: cats.length })}</small><span class="mch" aria-hidden="true">›</span></summary>
    <div class="table-scroll" tabindex="0" role="region" aria-label="${esc(t("按类型"))}"><table class="dd-tbl"><thead><tr><th scope="col">${t("类型")}</th><th scope="col" class="num">${t("笔数")}</th><th scope="col" class="num">${t("总额")}</th><th scope="col" class="num">${t("未还")}</th></tr></thead>
    <tbody>${cats.map((c) => `<tr><th scope="row">${debtCat(c.cat).icon} ${esc(t(debtCat(c.cat).name))}</th><td class="num">${c.n}</td><td class="num">${mny(c.total)}</td><td class="num">${mny(c.left)}</td></tr>`).join("")}</tbody></table></div></details>`;
}

/** 指标卡：合并原借贷首页（未还贷款、欠款构成、每月还款、借出未收、负债 / 总资产）和原总览（总借入、总借出、已结清、尚未结清），不重复 */
function kpiRow(all, seg, s) {
  const open = all.filter((e) => (seg === "all" || debtGroup(e) === seg) && !isClosedStatus(e.status));
  const sumBal = (l) => r2(l.reduce((a, e) => a + (e.balance || 0), 0));
  const owing = open.filter((e) => e.direction === "payable"), lending = open.filter((e) => e.direction === "receivable");
  const monthly = r2(owing.filter((e) => e.bill).reduce((a, e) => a + (e.bill.monthly || 0), 0)), overdue = open.filter((e) => e.overdue).length;
  const cards = [
    kpi(seg === "asset" ? t("未还贷款") : t("我还欠"), mny(sumBal(owing)), `${t("{n} 笔在还", { n: owing.length })}${monthly && seg !== "asset" ? ` · ${t("每月 {a}", { a: mny(monthly) })}` : ""}`),
    seg === "asset" ? kpi(t("每月还款"), mny(monthly), t("按关联账单折算"))
      : kpi(t("借出未收"), mny(sumBal(lending)), overdue ? `<span class="ds-left">${t("{n} 笔逾期", { n: overdue })}</span>` : t("没有逾期")),
    kpi(t("总借入"), mny(s.borrowed.total), `${t("{n} 笔借贷", { n: s.borrowed.n })} · ${t("已还 {a}", { a: mny(s.borrowed.paid) })}`),
    seg === "asset" ? "" : kpi(t("总借出"), mny(s.lent.total), `${t("{n} 笔借贷", { n: s.lent.n })} · ${t("已收回 {a}", { a: mny(s.lent.paid) })}`),
    kpi(t("已结清"), t("{a} / {b} 笔", { a: s.settled.n, b: s.list.length }), s.open.n ? t("{n} 笔未结清", { n: s.open.n }) : t("全部结清")),
  ].filter(Boolean);
  return `<div class="kpis debt-kpis">${cards.join("")}</div>`;
}

/** 借贷三个标签（全部借贷 / 资产融资 / 个人借贷）共用的面板；没有记录时返回空 */
export function debtDashboard(tab, all) {
  const seg = SEGS.some(([k]) => k === tab) ? tab : "all", s = debtStats(all, seg);
  if (!s.list.length) return "";
  const view = viewMode(), dirs = new Set(s.rows.map((r) => r.dir));
  const chip = (k, l) => `<button type="button" class="chip" data-ds="view" data-v="${k}" aria-pressed="${view === k}">${esc(l)}</button>`;
  const body = view === "table" ? sortTable(s.rows, seg)
    : `<div class="ds-two ${dirs.size < 2 ? "ds-one" : ""}">${progressGroup(`🙏 ${t("借入（我欠别人）")}`, s.rows, "payable", seg)}${progressGroup(`🤝 ${t("借出（别人欠我）")}`, s.rows, "receivable", seg)}</div>`;
  return `<div class="debt-sum">
    ${kpiRow(all, seg, s)}
    ${owedPanel(all, seg)}
    <div class="ds-viewbar"><h3>${seg === "asset" ? t("按贷款方") : t("按对方")} <small class="muted">${t("{n} 位", { n: s.rows.length })}</small></h3>
      <div class="ds-toggle" role="group" aria-label="${esc(t("切换视图"))}">${chip("group", t("借入 / 借出"))}${chip("table", t("表格"))}</div></div>
    ${body}
    ${seg !== "personal" ? catPanel(s.cats) : ""}
  </div>`;
}

/* 框里最多露 N 条：按第 N+1 条的位置量高度（行高随内容、屏宽变），页面画完和窗口变化时重算 */
function capLists() {
  for (const el of document.querySelectorAll("[data-cap]")) {
    const n = +el.dataset.cap, kids = el.tagName === "UL" ? el.children : el.querySelectorAll("tbody > tr");
    if (kids.length <= n) { el.style.maxHeight = ""; continue; }
    const h = `${Math.ceil(kids[n].getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop)}px`;
    if (el.style.maxHeight !== h) el.style.maxHeight = h;
  }
}
if (typeof document !== "undefined" && typeof MutationObserver !== "undefined") {
  let raf = 0; const later = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; capLists(); }); };
  const start = () => { new MutationObserver(later).observe(document.body, { childList: true, subtree: true }); later(); };
  document.body ? start() : document.addEventListener("DOMContentLoaded", start);
  window.addEventListener("resize", later);
}

export function initDebtSummary({ render }) {
  const main = document.getElementById("main");
  main.addEventListener("click", (e) => {
    const b = e.target.closest?.("[data-ds]"); if (!b) return;
    if (b.dataset.ds === "view") {
      try { localStorage.setItem(VKEY, b.dataset.v); } catch { /* 忽略 */ }
      render(false); requestAnimationFrame(() => document.querySelector(`[data-ds="view"][data-v="${b.dataset.v}"]`)?.focus()); return;
    }
    if (b.dataset.ds === "sort") {
      const k = b.dataset.k, s = ui().dsSort || { k: "total", d: "desc" };
      ui().dsSort = { k, d: s.k === k ? (s.d === "asc" ? "desc" : "asc") : ["name", "dir"].includes(k) ? "asc" : "desc" };
      render(false); requestAnimationFrame(() => document.querySelector(`[data-ds="sort"][data-k="${k}"]`)?.focus());
    }
  });
}
