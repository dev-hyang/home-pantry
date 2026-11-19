/* 收入 → 付款方：搜索、类型筛选、点表头排序、加载更多。 */
import { $, esc } from "../core/util.js";
import { FD, changed, clearFiltersBtn } from "../core/clear-filters.js";
import { autoUnit, chartUnit, finUnit, unitNote, unitSelectHtml } from "../core/time-range.js";
import { canEdit } from "./records-tab.js";
import { cfAnchor } from "./export-ai.js";
import { filterToolbar, groupList, groupOf, groupSum, inc, incSumOf, kindLabel, kindMatch, kindOptionsHtml, knownSenders, personOk, recognized, sharedRangeHtml, skey, spanWindow, sumOf } from "./logic.js";
import { meta, saveMeta } from "../bills/budget.js";
import { moreBtn, pageSize } from "../core/pager.js";
import { splitRecord } from "../core/income-taxonomy.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";
import { R2, empty, fmtMoney, incDrill, kindBadge, personOptions, rate, togglesHtml } from "./shared.js";
import { STAT_CATS, monthLabel } from "../stats/spend-roll.js";
import { hitAttrs } from "../stats/spend-drill.js";

/* ───────────── 付款方历史：搜索 + 类型筛选 + 点表头排序，每次显示 20 个，「加载更多」（多取一个判断还有没有，不算总数） ─────────────
 * 合计 = 认定收入；资本流入（卖股卖房的本金、借款、转入）单独显示，不算进合计和占比。 */
export const S_PAGE = () => pageSize();
   // 付款方每次显示几个：跟全站的每页条数设置
const S_COLS = [["name", "付款方"], ["kind", "类型"], ["n", "收到次数"], ["total", "收入"], ["share", "占比"], ["last", "最近一次"]];
export const sNameOf = (x) => x.rows.find((r) => r.source_name)?.source_name || x.key;
export const sMainKind = (x) => { const m = new Map(); for (const r of x.rows) m.set(r.kind, (m.get(r.kind) || 0) + r.amount); return [...m].sort((a, b) => b[1] - a[1])[0]?.[0] || "other"; };
/** 当前时间范围 / 成员 / 类型 / 搜索下的付款方（已排序）；rows = 参与统计的收入 */
export function senderGroups({ noSearch = false } = {}) {
  const I = inc(), w = spanWindow(state.stats.months), q = noSearch ? "" : skey(I.sq), sk = I.skind || "all";
  const rows = I.rec.filter((r) => r.received_on >= w.from && r.received_on <= w.to && personOk(r, I.person) && kindMatch(sk, r.kind));
  const list = groupSum(rows, (r) => skey(r.source_name)).filter((x) => !q || skey(`${x.rows.map((r) => r.source_name).join(" ")} ${kindLabel(sMainKind(x))}`).includes(q));
  const { k = "total", dir = "desc" } = I.ssort || {}, sgn = dir === "asc" ? 1 : -1;
  const val = { name: (x) => skey(sNameOf(x)), kind: (x) => kindLabel(sMainKind(x)), n: (x) => x.n, total: (x) => x.total, share: (x) => x.total, last: (x) => x.last }[k] || ((x) => x.total);
  list.sort((a, b) => { const va = val(a), vb = val(b); return (typeof va === "number" ? va - vb : String(va).localeCompare(String(vb))) * sgn || b.total - a.total || b.cash - a.cash; });
  return { w, rows, list, total: incSumOf(rows), cap: R2(sumOf(rows) - incSumOf(rows)) };
}
function sendersListHtml() {
  const I = inc(), { list, total, cap } = senderGroups(), lim = I.slimit || S_PAGE();
  const page = list.slice(0, lim + 1), hasNext = page.length > lim, shown = page.slice(0, lim);   // 多取一个：有第 lim+1 个才显示「加载更多」
  const { k = "total", dir = "desc" } = I.ssort || {};
  const th = ([key, label]) => { const on = k === key; return `<th scope="col" class="s-${key}" ${on ? `aria-sort="${dir === "asc" ? "ascending" : "descending"}"` : ""}><button type="button" class="th-sort${on ? " is-on" : ""}" data-inc="s-sort" data-k="${key}" title="${esc(t("点一下按这一列排序"))}">${t(label)}<span aria-hidden="true">${on ? (dir === "asc" ? " ▲" : " ▼") : " ↕"}</span></button></th>`; };
  const cell = (key, inner) => `<td class="s-${key}" data-l="${esc(t(S_COLS.find((c) => c[0] === key)[1]))}">${inner}</td>`;
  const sel = I.ssel, pickedN = sel ? list.filter((x) => sel.has(x.key)).length : 0;
  const defTo = I.smergeTo || [...list].filter((x) => sel?.has(x.key)).sort((a, b) => b.n - a.n).map(sNameOf)[0] || "";
  const selBar = sel ? `<div class="sel-bar payee-sel" role="region" aria-label="${esc(t("多选合并"))}"><b>${t("已选 {n} 家", { n: pickedN })}</b>
      <label class="payee-merge-to"><span>${t("合并为")}</span><input id="incMergeTo" maxlength="80" list="incSendersAll" value="${esc(defTo)}" autocomplete="off"></label>
      <button type="button" class="btn btn-sm btn-primary" data-inc="sender-merge" ${pickedN >= 2 ? "" : "disabled"}>${t("合并")}</button>
      <button type="button" class="btn btn-sm btn-ghost" data-inc="sender-sel">${t("退出多选")}</button>
      <small class="muted" style="flex-basis:100%">${t("勾两家以上，合并成一个名字（默认用笔数最多的那个）。")}</small><datalist id="incSendersAll">${knownSenders().map((s) => `<option value="${esc(s)}">`).join("")}</datalist></div>` : "";
  return `${selBar}<p class="muted small" style="margin:0 0 8px">${t("{n} 个付款方，收入 {m}", { n: list.length, m: fmtMoney(total) })}${cap > 0 ? ` · ${t("另有资本流入 {a}（不计收入）", { a: fmtMoney(cap) })}` : ""}</p>
    <table class="store-table ix-stbl payee-tbl"><thead><tr>${S_COLS.map(th).join("")}<th scope="col" class="s-act"><span class="sr-only">${t("操作")}</span></th></tr></thead><tbody>
    ${shown.map((x) => `<tr><th scope="row" class="s-name"><span class="s-name-in">${sel && x.rows.every(canEdit) ? `<input type="checkbox" class="sel" data-inc="sender-pick" data-key="${esc(x.key)}" ${sel.has(x.key) ? "checked" : ""} aria-label="${esc(t("选中 {name}", { name: sNameOf(x) }))}">` : ""}<button type="button" class="link-name" data-inc="sender-open" data-key="${esc(x.key)}">${esc(sNameOf(x))}</button></span></th>${cell("kind", kindBadge(sMainKind(x)))}${cell("n", x.n)}${cell("total", `<b>${fmtMoney(x.total)}</b>${x.cap ? `<br><small class="muted">${t("资本流入 {a}", { a: fmtMoney(x.cap) })}</small>` : ""}`)}${cell("share", rate(x.total, total))}${cell("last", x.last)}
      <td class="s-act"><span class="s-act-in"><button type="button" class="btn btn-sm btn-ghost" data-inc="sender-trend" data-key="${esc(x.key)}" aria-expanded="${I.sopen === x.key}" aria-label="${esc(t("{name} 近 12 个月走势", { name: sNameOf(x) }))}">${I.sopen === x.key ? "▾" : "▸"} ${t("走势")}</button>${x.rows.every(canEdit) && !sel ? `<button type="button" class="btn btn-sm btn-ghost" data-inc="sender-rename" data-key="${esc(x.key)}">${t("改名 / 合并")}</button>` : ""}</span></td></tr>
      ${I.sopen === x.key ? `<tr class="s-form s-detail"><td colspan="7">${senderTrendHtml(x)}</td></tr>` : ""}
      ${I.renameKey === x.key ? `<tr class="s-form"><td colspan="7"><form data-inc-form="rename" data-key="${esc(x.key)}" class="form-grid"><label>${t("统一改成")}<input name="to" maxlength="80" required value="${esc(sNameOf(x))}" list="incSenders"></label><div class="form-actions"><button class="btn btn-sm btn-primary">${t("改名（相同名字的会合并成一个）")}</button><button type="button" class="btn btn-sm btn-ghost" data-inc="sender-rename" data-key="">${t("取消")}</button></div></form><datalist id="incSenders">${knownSenders().map((s) => `<option value="${esc(s)}">`).join("")}</datalist></td></tr>` : ""}`).join("") || `<tr class="s-form"><td colspan="7" class="muted">${t("没有符合条件的付款方")}</td></tr>`}</tbody></table>
    ${moreBtn(hasNext, 'data-inc="s-more"')}`;
}
/** 展开一个付款方：近 12 个月每月的认定收入（和上面的时间范围无关），点柱子看那个月的收入明细 */
function senderTrendHtml(x) {
  const I = inc(), now = new Date(), ms = Array.from({ length: 12 }, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; });
  const by = Object.fromEntries(ms.map((m) => [m, 0]));
  for (const r of I.rec) if (skey(r.source_name) === x.key && personOk(r, I.person) && by[r.received_on.slice(0, 7)] != null) by[r.received_on.slice(0, 7)] += recognized(r);
  const vals = ms.map((m) => Math.round(by[m] * 100) / 100), tot = vals.reduce((a, v) => a + v, 0), used = vals.filter((v) => v > 0).length, name = sNameOf(x);
  const end = (m) => { const d = new Date(+m.slice(0, 4), +m.slice(5, 7), 0); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const chart = window.Charts ? window.Charts.bars({ title: t("{name} 近 12 个月", { name }), labels: ms.map(monthLabel), fmt: fmtMoney, showTotals: false,
    series: [{ name, color: groupOf(sMainKind(x))?.color || "#2c6a57", values: vals }], drill: (_, i) => incDrill({ q: name, from: `${ms[i]}-01`, to: end(ms[i]), person: I.person }) }) : "";
  return `<div class="payee-detail"><div class="pd-head"><b>${esc(t("近 12 个月"))}</b><span class="muted small">${esc(t("合计 {m} · {n} 个月有收入 · 月均 {a}", { m: fmtMoney(tot), n: used, a: fmtMoney(used ? tot / used : 0) }))}</span></div>${chart}</div>`;
}
/** 付款方页顶部：指标卡 + 前 10 名横条 + 按一级类型的环形图（不随搜索变；随时间范围、成员、类型筛选变）。点条 / 扇区 = 到收入明细看那几笔 */
function sendersDashHtml() {
  const I = inc(), { w, list, total, cap } = senderGroups({ noSearch: true });
  if (!list.length) return "";
  const person = I.person, top3 = list.slice(0, 3).reduce((a, x) => a + x.total, 0), big = list[0];
  const card = (label, value, small = "", drill = "") => `<div class="kpi${drill ? " ch-hit-row" : ""}"${drill ? hitAttrs(drill, label) : ""}><span>${esc(label)}</span><b>${value}</b><small>${small}${drill ? " ›" : ""}</small></div>`;
  const kpis = `<div class="kpis">
    ${card(t("付款方"), esc(t("{n} 家", { n: list.length })))}
    ${card(t("收入合计"), esc(fmtMoney(total)), esc(t("认定收入")), incDrill({ ...w, person }))}
    ${cap > 0 ? card(t("资本流入"), esc(fmtMoney(cap)), esc(t("卖房卖股的本金、借款、转回，不计收入"))) : ""}
    ${card(t("前 3 家占比"), total > 0 ? `${Math.round((top3 / total) * 100)}%` : "–", esc(t("越高越依赖少数几个来源")))}
    ${card(t("最大付款方"), esc(sNameOf(big)), esc(fmtMoney(big.total)), incDrill({ q: sNameOf(big), ...w, person }))}
  </div>`;
  if (!window.Charts) return kpis;
  const R2_ = (v) => Math.round(v * 100) / 100;
  const top = list.slice(0, 10), rest = list.slice(10);
  const items = top.map((x) => { const g = groupOf(sMainKind(x)); return { name: sNameOf(x), value: x.total, color: g?.color || "#8a948f", drill: incDrill({ q: sNameOf(x), ...w, person }) }; });
  if (rest.length) items.push({ name: `${t("其他")}（${t("{n} 家", { n: rest.length })}）`, value: R2_(rest.reduce((a, x) => a + x.total, 0)), color: "#c3cbc6" });
  const by = new Map();
  for (const x of list) for (const r of x.rows) { const g = groupOf(r.kind); if (!g) continue; const v = splitRecord(r).income || 0; if (v > 0) by.set(g.gid, (by.get(g.gid) || 0) + v); }
  let slices = [...by].sort((a, b) => b[1] - a[1]).map(([gid, v]) => { const g = groupList().find((x) => x.gid === gid); return { name: `${g.icon} ${t(g.name)}`, value: R2_(v), color: g.color, drill: incDrill({ kind: g.id, ...w, person }) }; });
  if (slices.length > 6) slices = [...slices.slice(0, 5), { name: t("其他"), value: R2_(slices.slice(5).reduce((a, x) => a + x.value, 0)), color: "#c3cbc6" }];
  return `${kpis}<div class="chart-grid">
    <div class="panel chart-panel"><h3>${t("收入最多的 10 家")}</h3>${window.Charts.hbars({ title: t("收入最多的 10 家"), fmt: fmtMoney, total, items })}</div>
    <div class="panel chart-panel"><h3>${t("按收入类型")}</h3>${slices.length ? window.Charts.donut({ items: slices, fmt: fmtMoney, title: t("按收入类型"), center: fmtMoney(total), stack: true }) : `<p class="muted">${t("这段时间没有认定收入")}</p>`}</div>
  </div><p class="muted drill-hint">${t("点条、色块或名称，可以查看对应的收入明细。")}</p>`;
}
/** 排序下拉（手机上表头不显示，靠它排序；宽屏点表头和它是同一个设置） */
const S_SORTS = [["total:desc", "金额从高到低"], ["total:asc", "金额从低到高"], ["last:desc", "最近到账的在前"], ["last:asc", "最早到账的在前"], ["n:desc", "收到次数最多"], ["name:asc", "名称 A → Z"], ["name:desc", "名称 Z → A"], ["kind:asc", "按类型"]];
function sSortOptions() {
  const { k = "total", dir = "desc" } = inc().ssort || {}, cur = `${k === "share" ? "total" : k}:${dir}`, list = [...S_SORTS];
  if (!list.some(([v]) => v === cur)) list.push([cur, `${t((S_COLS.find((c) => c[0] === k) || [])[1] || k)} ${dir === "asc" ? "↑" : "↓"}`]);   // 点表头排出来的少见组合
  return list.map(([v, l]) => `<option value="${esc(v)}" ${v === cur ? "selected" : ""}>${esc(t(l))}</option>`).join("");
}
export const renderSenders = () => { const el = $("#incSendersList"); if (el) el.innerHTML = sendersListHtml(); const ss = $("#incSsort"); if (ss) ss.innerHTML = sSortOptions(); };
export function sendersTab() {
  const I = inc();
  if (!I.rec.length) return empty();
  return `${filterToolbar(`${sharedRangeHtml()}
    <label class="tb-field"><span>${t("谁的")}</span><select data-inc-f="person" data-nosearch>${personOptions(I.person, { all: true })}</select></label>`)}
    ${sendersDashHtml()}
    <div class="panel"><div class="toolbar ix-stoolbar">
      <input type="search" data-inc-sq value="${esc(I.sq || "")}" placeholder="${esc(t("搜索付款方 / 类型"))}" aria-label="${esc(t("搜索付款方"))}">
      <select id="incSkindF" data-search data-inc-f="skind" aria-label="${esc(t("按类型筛选"))}">${kindOptionsHtml(I.skind || "all", { all: true, groups: true, allLabel: t("全部类型") })}</select>
      <select id="incSsort" data-inc-ssort data-nosearch aria-label="${esc(t("排序"))}">${sSortOptions()}</select>${clearFiltersBtn("incSend", changed(I, FD.incSend))}</div>
    <div class="ix-tools payee-tools"><button type="button" class="btn btn-sm btn-ghost" data-inc="sender-sel">${I.ssel ? t("退出多选") : t("多选合并")}</button><button type="button" class="btn btn-sm btn-ghost" data-inc="csv-senders">${t("导出 CSV")}</button></div>
    <div id="incSendersList">${sendersListHtml()}</div></div>`;
}
/** 改名 / 合并后记下别名（meta._sender_alias：原名键 → 新名），以后银行导入的入账自动用新名字（logic.js 的 senderName） */
export async function rememberSenders(keys, to) {
  const a = { ...(meta("_sender_alias", {}) || {}) }; let changed = false;
  for (const k of keys) if (k && k !== skey(to) && a[k] !== to) { a[k] = to; changed = true; }
  if (changed) await saveMeta({ _sender_alias: a });
}
/** 收支对比 / 导出的设置。时间范围、周期都是共享的（js/core/time-range.js，周期这里多一个双周）。
 *  r.unit = 实际用的周期：收支对比按统一规则（太密退回自动，r.cu.fell）；导出 exp = true 不限（按月导 5 年也行） */
export const R = ({ exp = false } = {}) => {
  const r = (inc().r ||= { unit: "month", range: "12", from: "", to: "", person: "all", what: "both", unmask: false });
  r.range = state.stats.months; r.ms = spanWindow(r.range).months; r.pick = finUnit({ biweek: true }); r.exp = exp;
  r.cu = exp ? { unit: r.pick === "auto" ? autoUnit(r.ms) : r.pick, fell: false } : chartUnit(r.ms, r.pick);
  r.unit = r.cu.unit; return r;
};
/** 周期 / 时间范围 / 谁的（收支对比页和导出页共用，同一份设置） */
export const controlsHtml = (r, cf = null) => {
  return `${filterToolbar(`${unitSelectHtml(r.ms, { biweek: true, nocap: r.exp })}${sharedRangeHtml()}
    <label class="tb-field"><span>${t("谁的")}</span><select data-inc-r="person" data-nosearch>${personOptions(r.person, { all: true })}</select></label>
    ${cf ? togglesHtml(cf) : ""}`)}${r.cu.fell ? `<p class="muted small trend-note" role="status">${esc(unitNote(r.cu))}</p>` : ""}
    ${r.unit === "biweek" ? `<p class="muted small" style="margin:-4px 0 8px">${t("双周起点（每 14 天一个周期，对上你的发薪日）：")}<input type="date" data-inc-anchor value="${esc(cfAnchor())}" aria-label="${esc(t("双周起点"))}"></p>` : ""}`;
};
export const spendDonut = (cf) => {
  const items = STAT_CATS().filter((c) => cf.spendCats[c.id]).map((c) => ({ name: `${c.icon} ${t(c.name)}`, color: c.color, value: R2(Object.values(cf.spendCats[c.id]).reduce((a, b) => a + b, 0)) })).filter((x) => x.value > 0);
  return items.length && window.Charts ? `<div class="panel chart-panel"><h3>${t("消费去向（按分类）")}</h3>${window.Charts.donut({ items, fmt: fmtMoney, stack: true, title: t("消费去向"), center: fmtMoney(items.reduce((a, x) => a + x.value, 0), true) })}</div>` : "";
};
