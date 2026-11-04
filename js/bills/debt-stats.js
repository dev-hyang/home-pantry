/* 财务 → 借贷 → 总览（2026-11）：全历史的借贷统计。从借贷页的「未还贷款」「欠款构成」「借出未收」卡片、净资产页的「总负债」点进来。
 * 网址：#/bills/debts?view=summary&seg=all|asset|personal。
 * 内容：总借入 / 总借出 / 已结清 / 未结清（笔数 + 金额）→ 现在欠的钱按类型（资产融资所欠、个人借贷所欠、借出未收）和净资产的关系 →
 * 按对方（人或贷款方）的进度条（借入、借出两组，金额大的在前）→ 可排序的明细表（表头按钮排序，aria-sort）。
 * 金额口径（每笔借贷）：总额 = max(原始本金, 未还 + 已还本金 + 核销)，「又借入 / 又借出」也算进去；已还 = 总额 − 未还；
 * 已结束的（还清 / 核销 / 关闭）未还按 0；不知道余额的（没填本金）总额按原始本金、已还按记过的还本流水，未还记「—」不算进合计。
 * 数据全在内存（state.debts / state.debtTxns），小表，直接算。 */
import { state } from "../core/state.js";
import { esc, fmtDate } from "../core/util.js";
import { t } from "../core/i18n.js";
import { href } from "../core/router.js";
import { debtCat, debtGroup, isClosedStatus } from "../core/debt-rules.js";
import { debtHref, debtsEnriched } from "./debt-logic.js";
import { liveNetWorth } from "./nw-logic.js";
import { r2 } from "../core/amortization.js";

const cur = () => Units.region.currency;
const mny = (v, c) => (v == null ? "—" : Units.money(v, c || cur()));
const ui = () => (state.debtUi ||= {});
export const SEGS = [["all", "全部借贷"], ["asset", "资产融资"], ["personal", "个人借贷"]];
export const summaryHref = (seg = "all") => `${href("bills", "debts")}?view=summary${seg && seg !== "all" ? `&seg=${seg}` : ""}`;

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
    const name = (x.e.counterparty_name || x.e.name || "").trim() || t("（没写对方）");
    const key = `${x.e.direction}|${name.toLowerCase()}`;
    const p = people.get(key) || { key, name, dir: x.e.direction, n: 0, total: 0, paid: 0, left: 0, unknown: 0, last: "", ids: [] };
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

/** 现在欠的钱按类型：资产融资所欠、个人借贷所欠、借出未收（借贷页卡片和总览共用） */
export function owedSplit(all) {
  const open = all.filter((e) => !isClosedStatus(e.status) && e.balance != null);
  const s = (f) => r2(open.filter(f).reduce((a, e) => a + e.balance, 0));
  return { asset: s((e) => e.direction === "payable" && debtGroup(e) === "asset"), personal: s((e) => e.direction === "payable" && debtGroup(e) === "personal"), lent: s((e) => e.direction === "receivable") };
}

/* ───────────── 视图 ───────────── */
const SORT_COLS = [["name", "对方"], ["dir", "方向"], ["n", "笔数"], ["total", "总额"], ["paid", "已还"], ["left", "未还"], ["pct", "进度"], ["last", "最近"]];
const sortRows = (rows, { k = "total", d = "desc" } = {}) => {
  const v = (r) => (k === "name" ? r.name.toLowerCase() : k === "dir" ? r.dir : r[k] ?? "");
  const s = [...rows].sort((a, b) => { const x = v(a), y = v(b); return x < y ? -1 : x > y ? 1 : b.total - a.total; });
  return d === "desc" ? s.reverse() : s;
};
const bar = (pct, cls = "") => `<span class="ds-bar ${cls}" aria-hidden="true"><i style="width:${pct}%"></i></span>`;
const kpi = (label, value, sub) => `<div class="kpi"><span>${esc(label)}</span><b>${value}</b>${sub ? `<small>${sub}</small>` : ""}</div>`;

function progressGroup(title, rows, dir) {
  const l = rows.filter((r) => r.dir === dir).sort((a, b) => b.total - a.total);
  if (!l.length) return "";
  const lim = ui().dsMore?.[dir] ? l.length : 8, shown = l.slice(0, lim);
  const verb = dir === "payable" ? t("借入") : t("借出"), back = dir === "payable" ? t("已还") : t("已收回");
  const line = (r) => {
    const link = r.ids.length === 1 ? debtHref(r.ids[0]) : null;
    const name = link ? `<a href="${esc(link)}">${esc(r.name)}</a>` : esc(r.name);
    const label = t("{name}：{verb} {a}，{back} {b}，{p}%", { name: r.name, verb, a: mny(r.total), back, b: mny(r.paid), p: r.pct });
    return `<li class="ds-prow" aria-label="${esc(label)}">
      <div class="ds-ptop"><b>${name}</b>${r.n > 1 ? `<small class="muted">${t("{n} 笔借贷", { n: r.n })}</small>` : ""}<span class="ds-pct ${r.pct >= 100 ? "done" : ""}">${r.pct >= 100 ? `✓ ${t("已结清")}` : `${r.pct}%`}</span></div>
      ${bar(r.pct, r.pct >= 100 ? "done" : dir === "receivable" ? "recv" : "")}
      <div class="ds-pnums"><span>${verb} <b>${mny(r.total)}</b></span><span>${back} ${mny(r.paid)}</span><span class="${r.left > 0 ? "ds-left" : "muted"}">${r.unknown && !r.left ? t("未还 不知道") : r.left > 0 ? t("余 {a} 未结清", { a: mny(r.left) }) : t("无余额")}</span></div></li>`;
  };
  return `<div class="panel ds-group"><h3>${title} <small class="muted">${t("{n} 位", { n: l.length })}</small></h3>
    <ul class="ds-plist">${shown.map(line).join("")}</ul>
    ${l.length > shown.length ? `<button type="button" class="btn btn-sm btn-ghost" data-ds="more" data-dir="${dir}">${t("显示全部 {n} 位", { n: l.length })}</button>` : ""}</div>`;
}

function sortTable(rows) {
  const s = ui().dsSort || { k: "total", d: "desc" };
  const th = ([k, l]) => {
    const on = s.k === k, aria = on ? (s.d === "asc" ? "ascending" : "descending") : "none";
    return `<th scope="col" class="${["name", "dir"].includes(k) ? "" : "num"}" aria-sort="${aria}"><button type="button" class="ds-sort" data-ds="sort" data-k="${k}">${t(l)}<span aria-hidden="true">${on ? (s.d === "asc" ? " ▲" : " ▼") : " ↕"}</span></button></th>`;
  };
  const tr = (r) => `<tr><th scope="row">${r.ids.length === 1 ? `<a href="${esc(debtHref(r.ids[0]))}">${esc(r.name)}</a>` : esc(r.name)}</th>
    <td>${r.dir === "payable" ? t("借入") : t("借出")}</td><td class="num">${r.n}</td><td class="num">${mny(r.total)}</td><td class="num">${mny(r.paid)}</td>
    <td class="num">${r.unknown && !r.left ? "—" : mny(r.left)}</td><td class="num">${r.pct}%</td><td class="num">${r.last ? esc(fmtDate(r.last)) : "—"}</td></tr>`;
  return `<div class="panel"><h3>${t("明细表")} <small class="muted">${t("点表头排序")}</small></h3>
    <div class="table-scroll" tabindex="0" role="region" aria-label="${esc(t("按对方汇总"))}"><table class="dd-tbl ds-tbl"><caption class="sr-only">${t("按对方汇总，点表头排序")}</caption>
    <thead><tr>${SORT_COLS.map(th).join("")}</tr></thead><tbody>${sortRows(rows, s).map(tr).join("")}</tbody></table></div></div>`;
}

/** 现在欠的钱的构成 + 和净资产的关系 */
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
  return `<div class="panel ds-owed"><div class="chart-head"><h3>${t("现在欠的钱")}</h3>${nw ? `<a class="btn btn-sm btn-ghost" href="${href("bills", "networth")}">${t("净资产")} ${mny(nw.netWorth)} ›</a>` : ""}</div>
    <ul class="ds-olist">${parts.map(([k, l, v, cls]) => `<li><span class="ds-olabel"><span class="ds-sw ${cls}" aria-hidden="true"></span>${esc(l)}</span>${bar(Math.round((v / max) * 100), `o-${cls}`)}<b class="num">${mny(v)}</b></li>`).join("")}</ul>
    ${rel.length ? `<p class="muted ds-rel">${rel.map(esc).join(" · ")}</p>` : ""}</div>`;
}

function catPanel(cats) {
  if (cats.length < 2) return "";
  return `<details class="panel ref-panel dd-fold"><summary><b>${t("按类型")}</b><small>${t("{n} 种", { n: cats.length })}</small><span class="mch" aria-hidden="true">›</span></summary>
    <div class="table-scroll" tabindex="0" role="region" aria-label="${esc(t("按类型"))}"><table class="dd-tbl"><thead><tr><th scope="col">${t("类型")}</th><th scope="col" class="num">${t("笔数")}</th><th scope="col" class="num">${t("总额")}</th><th scope="col" class="num">${t("未还")}</th></tr></thead>
    <tbody>${cats.map((c) => `<tr><th scope="row">${debtCat(c.cat).icon} ${esc(t(debtCat(c.cat).name))}</th><td class="num">${c.n}</td><td class="num">${mny(c.total)}</td><td class="num">${mny(c.left)}</td></tr>`).join("")}</tbody></table></div></details>`;
}

export function viewDebtSummary() {
  const q = state.route.q, seg = SEGS.some(([k]) => k === q.get("seg")) ? q.get("seg") : "all";
  const all = debtsEnriched(), s = debtStats(all, seg);
  const segSel = `<label class="tb-field"><span>${t("范围")}</span><select data-ds-seg data-nosearch aria-label="${esc(t("范围"))}">${SEGS.map(([k, l]) => `<option value="${k}" ${k === seg ? "selected" : ""}>${esc(t(l))}</option>`).join("")}</select></label>`;
  const head = `<div class="section-head"><h2>📊 ${t("借贷总览")}</h2><a class="btn btn-sm btn-ghost" href="${href("bills", "debts")}">‹ ${t("回到借贷")}</a></div>
    <div class="time-bar">${segSel}<small class="muted">${t("全部历史，含已还清的")}</small></div>`;
  if (!s.list.length) return `<section class="section">${head}<div class="panel empty"><strong>${t("还没有借贷记录")}</strong></div></section>`;
  return `<section class="section debt-sum">${head}
    <div class="kpis">
      ${kpi(t("总借入"), mny(s.borrowed.total), `${t("{n} 笔借贷", { n: s.borrowed.n })} · ${t("已还 {a}", { a: mny(s.borrowed.paid) })}`)}
      ${kpi(t("总借出"), mny(s.lent.total), `${t("{n} 笔借贷", { n: s.lent.n })} · ${t("已收回 {a}", { a: mny(s.lent.paid) })}`)}
      ${kpi(t("已结清"), t("{n} 笔借贷", { n: s.settled.n }), mny(s.settled.total))}
      ${kpi(t("尚未结清"), t("{n} 笔借贷", { n: s.open.n }), t("余 {a}（共 {b}）", { a: mny(s.open.left), b: mny(s.open.total) }))}
    </div>
    ${owedPanel(all, seg)}
    <div class="ds-two">${progressGroup(`🙏 ${t("借入（我欠别人）")}`, s.rows, "payable")}${progressGroup(`🤝 ${t("借出（别人欠我）")}`, s.rows, "receivable")}</div>
    ${sortTable(s.rows)}
    ${catPanel(s.cats)}
    <p class="hint">${t("总额 = 原始本金加上后来又借的；已还 = 总额 − 未还（房贷按摊还表）；已还清 / 核销 / 关闭的按结清算。同一个对方的几笔合在一行；只有一笔时点名字进详情。")}</p>
  </section>`;
}

export function initDebtSummary({ render, go }) {
  const main = document.getElementById("main");
  main.addEventListener("click", (e) => {
    const b = e.target.closest?.("[data-ds]"); if (!b) return;
    if (b.dataset.ds === "more") { (ui().dsMore ||= {})[b.dataset.dir] = true; return render(false); }
    if (b.dataset.ds === "sort") {
      const k = b.dataset.k, s = ui().dsSort || { k: "total", d: "desc" };
      ui().dsSort = { k, d: s.k === k ? (s.d === "asc" ? "desc" : "asc") : ["name", "dir"].includes(k) ? "asc" : "desc" };
      render(false); requestAnimationFrame(() => document.querySelector(`[data-ds="sort"][data-k="${k}"]`)?.focus());
    }
  });
  main.addEventListener("change", (e) => { const s = e.target.closest?.("[data-ds-seg]"); if (s) go(summaryHref(s.value), { replace: true }); });
}
