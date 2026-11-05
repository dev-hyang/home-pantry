/* ── 花费 → 收款方（设计见 docs/design-payees-time-range.md §1、§3、§4）──
 * 指标卡 → 图表（前 10 家横条 + 按分类环形图，点了看明细）→ 可搜索 / 排序 / 翻页的表 → 改名 / 多选合并 / 整理收款方（可撤销）。
 * 金额来自 spend_rollup_store（按 月 × 收款方 × 分类 × 性质 聚合，和概览 / 分类同一份缓存、同一个时间范围）；
 * 「最近一次」和整理时的全历史名单来自 spend_payee_names（迁移 062；没执行时这两项不显示，其余照常）。
 * 改名 / 合并改的是 purchases.store（迁移 062 的 rename_payees），同时记下别名（meta._payee_alias），以后对账单导入自动用新名字；
 * 撤销信息存在这台设备上（localStorage，最近 5 次）。 */
import { state } from "../core/state.js";
import { Store } from "../core/store.js";
import { $, esc, fmtDay, money, toast } from "../core/util.js";
import { compare, t } from "../core/i18n.js";
import { L1S, l1IdOf, nodeOf } from "../core/taxonomy.js";
import { storeAgg } from "./report.js";
import { saveMeta } from "../bills/budget.js";
import { builtinPayee, userPayeeAliases } from "../core/payee-alias.js";
import { spendChanged } from "../core/spend-data.js";
import { moreBtn, pageSize } from "../core/pager.js";
import { STORE_NONE, STORE_REST, dq, download, hitAttrs, monthLabel, rangeLabel, statKit, storeDatalist, toCsv } from "./views.js";
import { rangeMonthsOf } from "../core/time-range.js";
import { href } from "../core/router.js";

const P = () => (state.payees ||= { q: "", sort: { k: "total", dir: "desc" }, limit: 0, renameKey: null, sel: null, mergeTo: "", tidy: false, tidyOff: new Set(), tidyTo: {}, open: null });
const TZ = () => Units.timeZone() || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

/* ── 全历史名单（最近一次、整理预览）：读一次缓存，花费变了重读 ── */
const NAMES = { rows: null, busy: false, missing: false };
function loadNames() {
  if (NAMES.busy) return;
  NAMES.busy = true;
  Store.payeeNames(TZ()).then((rows) => { NAMES.rows = rows || []; NAMES.missing = rows == null; })
    .catch(() => { NAMES.rows = []; })
    .finally(() => { NAMES.busy = false; if ($("#payeeList") || $(".tidy-panel") || $("[data-tidy-wait]")) window.dispatchEvent(new Event("spend-data-loaded")); });
}
window.addEventListener("spend-rows-changed", () => { NAMES.rows = null; });
const namesByKey = () => new Map((NAMES.rows || []).map((r) => [r.store_key, r]));

/* ── 列表数据 ── */
const COLS = [["name", "收款方"], ["kind", "主要分类"], ["n", "次数"], ["total", "合计"], ["share", "占比"], ["avg", "平均每笔"], ["last", "最近一次"]];
const SORTS = [["total:desc", "金额从高到低"], ["total:asc", "金额从低到高"], ["n:desc", "次数最多"], ["last:desc", "最近付过的在前"], ["avg:desc", "平均每笔最高"], ["name:asc", "名称 A → Z"]];
const mainNode = (a) => { const top = Object.entries(a.byL2).sort((x, y) => y[1] - x[1])[0]; return top ? nodeOf(top[0]) : null; };
const nodeText = (n) => (n ? `${n.icon || ""} ${t(n.name)}`.trim() : "");
/** 当前范围 / 一级分类下的收款方（未排序）；null = 还在读 */
function payeeList(months, sel, l1) {
  const sp = statKit.spanOfMonths(months), rows = statKit.rollup(sp.from, sp.to, true);
  if (!rows) return null;
  const last = namesByKey();
  return storeAgg(rows, months, { sel, l1, ...statKit.statOpts() }).map((a) => ({ ...a, name: a.key === "__none__" ? t(STORE_NONE.name) : a.name || a.key, node: mainNode(a), last: last.get(a.key)?.last_at || "" }));
}
function sorted(list) {
  const { k, dir } = P().sort, sgn = dir === "asc" ? 1 : -1;
  const val = { name: (x) => x.name.toLowerCase(), kind: (x) => nodeText(x.node), n: (x) => x.count, total: (x) => x.total, share: (x) => x.total, avg: (x) => x.total / x.count, last: (x) => x.last || "" }[k] || ((x) => x.total);
  return [...list].sort((a, b) => { const va = val(a), vb = val(b); return (typeof va === "number" ? va - vb : compare(String(va), String(vb))) * sgn || b.total - a.total; });
}
const filtered = (list) => { const q = P().q.trim().toLowerCase(); return q ? list.filter((x) => `${x.name} ${nodeText(x.node)}`.toLowerCase().includes(q)) : list; };

/* ── 钻取：收款方 / 一组收款方 / 分类 → 明细，套上同样的时间范围 ── */
let CTX = { sel: "", l1: "all" };
const win = () => (CTX.sel ? { month: CTX.sel } : statKit.winDrill());
const payeeDrill = (keys) => dq({ ...(keys.length === 1 ? { store: keys[0] } : { stores: keys.map(encodeURIComponent).join(",") }), ...(CTX.l1 !== "all" ? { cat: CTX.l1 } : {}), ...win() });

/* ── 页面 ── */
export function viewPayees(months, month = state.stats.month) {
  const sel = month && months.includes(month) ? month : "";
  const l1 = L1S.some((x) => x.id === state.stats.storeL1 && x.id !== "transfer") ? state.stats.storeL1 : "all";
  CTX = { sel, l1 };
  if (state.route?.q?.get("tidy") === "1") { if (!P().tidyFromLink) { P().tidy = true; P().tidyFromLink = true; } } else P().tidyFromLink = false;   // 导入完成页「去整理」带过来的（每次点链接都打开一次）
  if (!NAMES.rows) loadNames();
  const l1Sel = `<label class="tb-field"><span>${t("只看")}</span><select id="statsStoreL1" data-nosearch aria-label="${t("按一级分类筛选收款方")}"><option value="all" ${l1 === "all" ? "selected" : ""}>${t("全部花费（不含转账）")}</option>${L1S.filter((x) => x.id !== "transfer").map((x) => `<option value="${x.id}" ${x.id === l1 ? "selected" : ""}>${x.icon} ${esc(t(x.name))}</option>`).join("")}</select></label>`;
  const head = `<div class="section-head"><h2>${t("收款方")}</h2><p>${esc(sel ? monthLabel(sel) : rangeLabel())}${t("；账单、订阅、保险按收款方；名称不区分大小写")}</p></div><div class="time-bar">${l1Sel}</div>`;
  const list = payeeList(months, sel, l1);
  if (!list) return `<section class="section">${head}${statKit.LOADING()}</section>`;
  if (!list.length) return `<section class="section">${head}<div class="panel empty"><strong>${t("这段时间没有符合条件的花费")}</strong></div></section>`;
  return `<section class="section payees">${head}${kpisHtml(list)}${chartsHtml(list)}${P().tidy ? tidyHtml() : ""}
    <div class="panel">
      <div class="toolbar ix-stoolbar">
        <input type="search" id="payeeSearch" value="${esc(P().q)}" placeholder="${esc(t("搜索收款方 / 分类"))}" aria-label="${esc(t("搜索收款方"))}">
        <select id="payeeSort" data-nosearch aria-label="${esc(t("排序"))}">${sortOptions()}</select>
      </div>
      <div class="ix-tools payee-tools">
        <button type="button" class="btn btn-sm btn-ghost" data-action="payee-sel">${P().sel ? t("退出多选") : t("多选合并")}</button>
        <button type="button" class="btn btn-sm btn-ghost" data-action="payee-tidy" aria-expanded="${P().tidy}">${t("整理收款方")}</button>
        ${undoLog().length ? `<button type="button" class="btn btn-sm btn-ghost" data-action="payee-undo">${t("撤销上次合并")}</button>` : ""}
        <button type="button" class="btn btn-sm btn-ghost" data-action="payee-csv">${t("导出 CSV")}</button>
      </div>
      <div id="payeeList">${listHtml(list)}</div>
      ${storeDatalist()}
    </div>
  </section>`;
}
/** 只重画表格（搜索、排序、多选、翻页时；输入框不丢焦点） */
let LAST = null;
export function renderPayeeList() { const el = $("#payeeList"); if (el && LAST) el.innerHTML = listHtml(LAST); }

function kpisHtml(list) {
  const named = list.filter((x) => x.key !== "__none__"), total = list.reduce((a, x) => a + x.total, 0), n = list.reduce((a, x) => a + x.count, 0);
  const top5 = named.slice(0, 5).reduce((a, x) => a + x.total, 0), big = named[0];
  const card = (label, value, small = "", drill = "") => `<div class="kpi${drill ? " ch-hit-row" : ""}"${drill ? hitAttrs(drill, label) : ""}><span>${esc(label)}</span><b>${value}</b><small>${small}${drill ? " ›" : ""}</small></div>`;
  return `<div class="kpis">
    ${card(t("收款方"), esc(t("{n} 家", { n: named.length })), list.length > named.length ? esc(t("另有未填写收款方的花费")) : "")}
    ${card(t("花费合计"), esc(money(total)), esc(t("{n} 笔，不含转账", { n })), dq({ ...(CTX.l1 !== "all" ? { cat: CTX.l1 } : {}), ...win() }))}
    ${card(t("平均每笔"), esc(money(n ? total / n : 0)))}
    ${card(t("前 5 家占比"), total > 0 ? `${Math.round((top5 / total) * 100)}%` : "–", esc(t("钱主要花在哪几家")))}
    ${big ? card(t("最大收款方"), esc(big.name), esc(money(big.total)), payeeDrill([big.key])) : ""}
  </div>`;
}

function chartsHtml(list) {
  const named = list.filter((x) => x.key !== "__none__"), total = list.reduce((a, x) => a + x.total, 0);
  const top = named.slice(0, 10), rest = named.slice(10);
  const items = top.map((a) => ({ name: a.name, value: Math.round(a.total * 100) / 100, color: "#8a948f", drill: payeeDrill([a.key]),
    parts: Object.entries(a.byL2).map(([k, v]) => { const n = nodeOf(k); return { name: nodeText(n) || k, value: v, color: n?.color || "#8a948f" }; }) }));
  if (rest.length) items.push({ name: `${t(STORE_REST.name)}（${t("{n} 家", { n: rest.length })}）`, value: Math.round(rest.reduce((a, x) => a + x.total, 0) * 100) / 100, color: STORE_REST.color, drill: payeeDrill(rest.map((x) => x.key)) });
  const bars = window.Charts.hbars({ title: t("花得最多的 10 家"), fmt: money, total, items });
  // 环形图：全部 = 按一级分类；选了一级 = 按二级；最多 6 块，其余合成「其他」
  const by = new Map();
  for (const a of list) for (const [k, v] of Object.entries(a.byL2)) { const id = CTX.l1 === "all" ? l1IdOf(k) : k; by.set(id, (by.get(id) || 0) + v); }
  let slices = [...by].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([id, v]) => { const n = nodeOf(id) || L1S.find((x) => x.id === id); return { name: nodeText(n) || id, value: Math.round(v * 100) / 100, color: n?.color || "#8a948f", drill: dq({ cat: id, ...win() }) }; });
  if (slices.length > 6) slices = [...slices.slice(0, 5), { name: t("其他"), value: Math.round(slices.slice(5).reduce((a, x) => a + x.value, 0) * 100) / 100, color: "#c3cbc6" }];
  const donut = window.Charts.donut({ items: slices, fmt: money, title: t("按分类"), center: money(total, true), stack: true });
  return `<div class="chart-grid">
    <div class="panel chart-panel"><h3>${t("花得最多的 10 家")}</h3><p class="muted chart-sub">${t("每条按二级分类分段：看得出在这家主要买什么。")}</p>${bars}</div>
    <div class="panel chart-panel"><h3>${CTX.l1 === "all" ? t("按一级分类") : t("按二级分类")}</h3>${donut}</div>
  </div><p class="muted drill-hint">${t("点图里的条、色块或名称，可以查看对应的花费明细。")}</p>`;
}

function sortOptions() {
  const { k, dir } = P().sort, cur = `${k === "share" ? "total" : k}:${dir}`, list = [...SORTS];
  if (!list.some(([v]) => v === cur)) list.push([cur, `${t((COLS.find((c) => c[0] === k) || [])[1] || k)} ${dir === "asc" ? "↑" : "↓"}`]);
  return list.map(([v, l]) => `<option value="${esc(v)}" ${v === cur ? "selected" : ""}>${esc(t(l))}</option>`).join("");
}

function listHtml(all) {
  LAST = all;
  const S = P(), list = sorted(filtered(all)), total = all.reduce((a, x) => a + x.total, 0), lim = S.limit || pageSize();
  const shown = list.slice(0, lim), { k, dir } = S.sort, hasLast = !!NAMES.rows && !NAMES.missing;
  const cols = COLS.filter(([key]) => key !== "last" || hasLast);
  const th = ([key, label]) => { const on = k === key; return `<th scope="col" class="s-${key}" ${on ? `aria-sort="${dir === "asc" ? "ascending" : "descending"}"` : ""}><button type="button" class="th-sort${on ? " is-on" : ""}" data-action="payee-sort" data-k="${key}" title="${esc(t("点一下按这一列排序"))}">${t(label)}<span aria-hidden="true">${on ? (dir === "asc" ? " ▲" : " ▼") : " ↕"}</span></button></th>`; };
  const cell = (key, inner) => `<td class="s-${key}" data-l="${esc(t(COLS.find((c) => c[0] === key)[1]))}">${inner}</td>`;
  const span = cols.length + 1;
  const row = (x) => {
    const own = x.key !== "__none__", picked = S.sel?.has(x.key);
    const pick = S.sel && own ? `<input type="checkbox" class="sel" data-action="payee-pick" data-key="${esc(x.key)}" ${picked ? "checked" : ""} aria-label="${esc(t("选中 {name}", { name: x.name }))}">` : "";
    const tr = `<tr${picked ? ' class="is-picked"' : ""}><th scope="row" class="s-name"><span class="s-name-in">${pick}<button type="button" class="link-name linkbtn" data-drill="${esc(payeeDrill([x.key]))}" title="${esc(t("查看明细"))}">${esc(x.name)}</button></span></th>
      ${cell("kind", x.node ? `<span class="ix-kind">${esc(nodeText(x.node))}</span>` : "")}${cell("n", x.count)}${cell("total", `<b>${esc(money(x.total))}</b>`)}${cell("share", total > 0 ? `${Math.round((x.total / total) * 1000) / 10}%` : "–")}${cell("avg", esc(money(x.total / x.count)))}${hasLast ? cell("last", x.last ? esc(fmtDay(x.last)) : "–") : ""}
      <td class="s-act"><span class="s-act-in"><button type="button" class="btn btn-sm btn-ghost" data-action="payee-open" data-key="${esc(x.key)}" aria-expanded="${S.open === x.key}" aria-label="${esc(t("{name} 近 12 个月走势", { name: x.name }))}">${S.open === x.key ? "▾" : "▸"} ${t("走势")}</button>${own && !S.sel ? `<button type="button" class="btn btn-sm btn-ghost" data-action="payee-rename" data-key="${esc(x.key)}">${t("改名 / 合并")}</button>` : ""}</span></td></tr>
      ${S.open === x.key ? `<tr class="s-form s-detail"><td colspan="${span}">${detailHtml(x)}</td></tr>` : ""}`;
    const form = S.renameKey === x.key ? `<tr class="s-form"><td colspan="${span}"><div class="payee-form">
      <label>${t("统一改成")}<input id="payeeTo" maxlength="40" list="storeList" value="${esc(x.name)}" autocomplete="off"></label>
      <div class="form-actions"><button type="button" class="btn btn-sm btn-primary" data-action="payee-rename-go" data-key="${esc(x.key)}">${t("改名（同名的会合并成一个）")}</button><button type="button" class="btn btn-sm btn-ghost" data-action="payee-rename" data-key="">${t("取消")}</button></div>
      <small class="muted">${t("以后导入对账单时，同样的收款方会自动用新名字。")}</small></div></td></tr>` : "";
    return tr + form;
  };
  const picked = S.sel ? all.filter((x) => S.sel.has(x.key)) : [];
  const defTo = S.mergeTo || [...picked].sort((a, b) => b.count - a.count)[0]?.name || "";
  const selBar = S.sel ? `<div class="sel-bar payee-sel" role="region" aria-label="${esc(t("多选合并"))}"><b>${t("已选 {n} 家", { n: picked.length })}</b>
      <label class="payee-merge-to"><span>${t("合并为")}</span><input id="payeeMergeTo" maxlength="40" list="storeList" value="${esc(defTo)}" autocomplete="off"></label>
      <button type="button" class="btn btn-sm btn-primary" data-action="payee-merge" ${picked.length >= 2 ? "" : "disabled"}>${t("合并")}</button>
      <button type="button" class="btn btn-sm btn-ghost" data-action="payee-sel">${t("退出多选")}</button>
      <small class="muted" style="flex-basis:100%">${t("勾两家以上，合并成一个名字（默认用笔数最多的那个）。")}</small></div>` : "";
  return `${selBar}<p class="muted small" style="margin:0 0 6px">${t("{n} 家，合计 {m}", { n: list.length, m: money(list.reduce((a, x) => a + x.total, 0)) })}</p>
    ${list.length ? `<table class="store-table ix-stbl payee-tbl"><thead><tr>${cols.map(th).join("")}<th scope="col" class="s-act"><span class="sr-only">${t("操作")}</span></th></tr></thead><tbody>${shown.map(row).join("")}</tbody></table>` : `<p class="muted">${t("没有符合条件的收款方")}</p>`}
    ${moreBtn(list.length > shown.length, 'data-action="payee-more"')}`;
}

/* ── 展开一行：这家近 12 个月每月花了多少 + 主要买什么（和时间范围无关，看得出是不是越花越多） ── */
function detailHtml(x) {
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
function tidyHtml() {
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
const undoLog = () => { try { return JSON.parse(localStorage.getItem(UNDO_KEY) || "[]"); } catch { return []; } };
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
