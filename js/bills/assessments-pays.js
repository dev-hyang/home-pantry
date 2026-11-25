/* 账单详情 → 特别摊派 → 缴费记录（?sec=assess&pays=摊派id|all）：已缴的各期一行一条，带搜索 + 筛选 + 排序。
 * 一行 = 摊派计划里已缴的一期（分期 / 一次性结清）；有缴费记录的能点进那笔缴费，只标了「已缴（无缴费记录）」的只显示。
 * 数据全在内存里（state.assess / state.assessItems / 这条账单的 b.pays），搜索 / 筛选只重画列表，不重画工具条（输入框焦点不丢）。 */
import { state } from "../core/state.js";
import { esc, fmtDate, num } from "../core/util.js";
import { href } from "../core/router.js";
import { t } from "../core/i18n.js";
import { FD, changed, clearFiltersBtn, onClearFilters } from "../core/clear-filters.js";
import { payBody, payRowHtml } from "./pay-row-fmt.js";
import { assessmentsOf, isPaid, paidOn } from "./assessments-lib.js";
import { paidRowItems } from "./assessments-views.js";

const mny = (v, cur) => Units.money(num(v), cur || Units.region.currency);
const SORTS = [["new", "最新在前"], ["old", "最早在前"], ["high", "金额从高到低"], ["low", "金额从低到高"]];
const FILTER0 = { q: "", kind: "all", year: "all", sort: "new" };
const PAGE = 20;
let filter = { ...FILTER0 }, shown = PAGE, scopeKey = "";   // scopeKey：换了一笔摊派 / 换了账单就重置筛选
FD.asPay = { q: "", kind: "all", year: "all" };   // 清除筛选不动排序

/** 这条账单里已缴的各期（pays = 摊派 id 或 "all"），带上所属摊派和缴费日期 */
function paidRows(b, which) {
  const list = assessmentsOf(b.id, state.assess, state.assessItems).filter((a) => which === "all" || a.id === which);
  return list.flatMap((a) => a.rows.filter(isPaid).map((x) => ({ ...x, aName: a.name, date: paidOn(x, b.pays) || x.due_on || "", pay: x.payment_id ? b.pays.find((p) => p.id === x.payment_id) || null : null })));
}
const kindText = (k) => t(k === "payoff" ? "结清" : "分期");   // 角标要短（「一次性结清」太宽会把日期挤到换行）；筛选下拉里仍写全称
const haystack = (r) => [r.aName, kindText(r.kind), r.date, fmtDate(r.date), r.due_on, num(r.amount).toFixed(2), r.pay?.confirmation_ref, r.pay?.notes].filter(Boolean).join(" ").toLowerCase();
function visible(b, which) {
  const q = filter.q.trim().toLowerCase(), by = { new: (x, y) => y.date.localeCompare(x.date), old: (x, y) => x.date.localeCompare(y.date), high: (x, y) => num(y.amount) - num(x.amount), low: (x, y) => num(x.amount) - num(y.amount) }[filter.sort];
  return paidRows(b, which).filter((r) => (filter.kind === "all" || r.kind === filter.kind) && (filter.year === "all" || r.date.startsWith(filter.year)) && (!q || haystack(r).includes(q))).sort(by);
}
function rowHtml(b, r, multi) {
  const edit = r.pay ? `${href("bill", b.id)}?sec=pay&edit=${encodeURIComponent(r.pay.id)}` : null;
  const items = [...paidRowItems(b, r), { label: t("查看这笔摊派"), href: `${href("bill", b.id)}?sec=assess&focus=${encodeURIComponent(r.assessment_id)}` }];
  const meta = [multi ? r.aName : null, r.due_on ? t("应缴日 {d}", { d: fmtDate(r.due_on) }) : null, r.payment_id ? null : t("已缴（无缴费记录）"), r.pay?.confirmation_ref ? t("确认号 {ref}", { ref: r.pay.confirmation_ref }) : null].filter(Boolean).map(esc);
  const badge = `<span class="badge ${r.kind === "payoff" ? "b-soon" : "b-ok"}">${esc(kindText(r.kind))}</span>`;
  return payRowHtml({ edit, hitTitle: t("查看这笔缴费"), body: payBody({ date: fmtDate(r.date), badge, meta }), total: `<b class="pay-total">${mny(r.amount, b.currency)}</b>`, items, lpTitle: fmtDate(r.date) });
}
function listHtml(b, which) {
  const all = paidRows(b, which), rows = visible(b, which), multi = which === "all";
  if (!all.length) return `<div class="empty"><strong>${t("还没有已缴的期")}</strong>${t("缴了之后会出现在这里。")}</div>`;
  if (!rows.length) return `<div class="empty"><strong>${t("没有符合条件的记录")}</strong>${t("换个关键词，或点“清除筛选”。")}</div>`;
  const sum = rows.reduce((s, r) => s + num(r.amount), 0), page = rows.slice(0, shown), rest = rows.length - page.length;
  return `<p class="muted pay-sum">${t("共 {n} 条", { n: rows.length })}${rows.length !== all.length ? ` / ${all.length}` : ""} · ${t("合计 {m}", { m: mny(sum, b.currency) })}</p>
    <ul class="restock-list pay-list">${page.map((r) => rowHtml(b, r, multi)).join("")}</ul>${rest > 0 ? `<div class="ui-acts"><button type="button" class="ui-btn" data-size="sm" data-tone="ghost" data-action="aspay-more">${t("加载更多（还有 {n} 条）", { n: rest })}</button></div>` : ""}`;
}
function toolbarHtml(b, which) {
  const years = [...new Set(paidRows(b, which).map((r) => r.date.slice(0, 4)).filter(Boolean))].sort().reverse(), opt = (v, l, cur) => `<option value="${esc(v)}" ${cur === v ? "selected" : ""}>${esc(l)}</option>`;
  return `<div class="toolbar pay-bar" id="aspBar">
    <input id="aspQ" type="search" class="pay-q" placeholder="${esc(t("搜索缴费记录"))}" aria-label="${esc(t("搜索日期、金额、摊派名称、确认号"))}" value="${esc(filter.q)}" autocomplete="off">
    <select id="aspKind" aria-label="${esc(t("按类型筛选"))}">${opt("all", t("全部类型"), filter.kind)}${opt("installment", t("分期"), filter.kind)}${opt("payoff", t("一次性结清"), filter.kind)}</select>
    <select id="aspYear" aria-label="${esc(t("按年份筛选"))}">${opt("all", t("全部年份"), filter.year)}${years.map((y) => opt(y, y, filter.year)).join("")}</select>
    <select id="aspSort" aria-label="${esc(t("排序"))}">${SORTS.map(([v, l]) => opt(v, t(l), filter.sort)).join("")}</select>
    ${clearFiltersBtn("asPay", changed(filter, FD.asPay))}</div>`;
}

/** 页面：crumb = 面包屑 HTML；which = 摊派 id 或 "all" */
export function assessPaysPage(b, crumb, which) {
  const key = `${b.id}|${which}`; if (key !== scopeKey) { scopeKey = key; filter = { ...FILTER0 }; shown = PAGE; }
  const a = state.assess.find((x) => x.id === which && x.bill_id === b.id), w = a ? which : "all";
  return `<section class="section">${crumb}
    <div class="section-head"><h2>${t("摊派缴费记录")}</h2><p>${esc(a ? a.name : b.name)}${a && state.assess.filter((x) => x.bill_id === b.id).length > 1 ? ` · <a href="${href("bill", b.id)}?sec=assess&pays=all">${t("看全部摊派的缴费")} ›</a>` : ""}</p></div>
    ${toolbarHtml(b, w)}
    <div class="panel" id="aspList" style="margin-top:10px" data-which="${esc(w)}">${listHtml(b, w)}</div>
  </section>`;
}

const bill = () => { const r = state.route, q = r?.q; return r?.section === "bill" && q?.get("sec") === "assess" && q.get("pays") ? state.billsEnriched.find((x) => x.id === r.id) : null; };
const whichNow = () => document.getElementById("aspList")?.dataset.which || "all";
function redraw(rebuildBar = false) {
  const b = bill(); if (!b) return; const w = whichNow(), list = document.getElementById("aspList"), bar = document.getElementById("aspBar");
  if (list) list.innerHTML = listHtml(b, w);
  if (bar && rebuildBar) bar.outerHTML = toolbarHtml(b, w);
  else { const c = bar?.querySelector("[data-clear-filters]"); if (c) c.hidden = !changed(filter, FD.asPay); }   // 输入搜索词时不能重建工具栏（会丢焦点），只更新「清除筛选」按钮
}
const apply = (patch, rebuild) => { Object.assign(filter, patch); shown = PAGE; redraw(rebuild); };
onClearFilters("asPay", () => apply({ ...FD.asPay }, true), () => changed(filter, FD.asPay));
document.addEventListener("input", (e) => { if (e.target.id === "aspQ") apply({ q: e.target.value }); });
document.addEventListener("change", (e) => {
  const k = { aspKind: "kind", aspYear: "year", aspSort: "sort" }[e.target.id];
  if (k) apply({ [k]: e.target.value });
});
document.addEventListener("click", (e) => { if (!e.target.closest("[data-action=aspay-more]")) return; shown += PAGE; const y = window.scrollY; redraw(); window.scrollTo(0, y); });
