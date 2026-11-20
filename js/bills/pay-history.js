/* 账单详情 → 缴费记录页（?sec=pay）：这条账单的全部缴费，带搜索 + 筛选 + 排序，右下角圆形「＋」新建。
 * 数据：内存里的 b.pays 只有近 400 天；进页面时按账单 id 读一次这条账单的全部记录（一条账单最多几百行），
 *  更早的合并进来，搜索 / 筛选 / 排序都在内存里做。点一行进独立的编辑页（?sec=pay&edit=id），不在列表上方弹表单。 */
import { state } from "../core/state.js";
import { Store } from "../core/store.js";
import { esc, fmtDate, num } from "../core/util.js";
import { href } from "../core/router.js";
import { t } from "../core/i18n.js";
import { payTotal } from "./pay-total.js";
import { paymentPayLabel } from "./card-picker.js";
import { moreMenu } from "../core/more-menu.js";
import { lpAttr } from "../core/long-press.js";
import { changed, clearFiltersBtn, onClearFilters } from "../core/clear-filters.js";

const B = () => window.BILLS;
const mny = (v, cur) => (v == null ? "—" : Units.money(num(v), cur || Units.region.currency));
const SORTS = [["new", "最新在前"], ["old", "最早在前"], ["high", "金额从高到低"], ["low", "金额从低到高"]];
const FILTER0 = { q: "", status: "all", year: "all", sort: "new" };
const PAGE = 20;   // 全部缴费记录：一次显示 20 条，「加载更多」再加 20 条
let filter = { ...FILTER0 }, older = { billId: null, rows: [], busy: false }, shown = PAGE;

/** 缴费记录变了（记 / 改 / 删）：更早的那部分下次进页面重新读 */
export const resetPayHistory = () => { older = { billId: null, rows: [], busy: false }; };
/** 编辑页要找的记录可能比 400 天更早，不在 state.billPayments 里 */
export const olderPayment = (id) => older.rows.find((p) => p.id === id) || null;

const rowsOf = (b) => {
  const have = new Set(b.pays.map((p) => p.id));
  return [...b.pays, ...(older.billId === b.id ? older.rows.filter((p) => !have.has(p.id)) : [])];
};
const haystack = (p) => [p.paid_on, p.due_on, fmtDate(p.paid_on), p.amount != null ? String(num(p.amount).toFixed(2)) : "", p.amount != null ? String(payTotal(p).toFixed(2)) : "", paymentPayLabel(p), p.confirmation_ref, p.notes, t(B().PAYMENT_STATUS[p.status] || p.status)].filter(Boolean).join(" ").toLowerCase();
function visible(b) {
  const q = filter.q.trim().toLowerCase();
  const list = rowsOf(b).filter((p) => (filter.status === "all" || p.status === filter.status) && (filter.year === "all" || (p.paid_on || "").startsWith(filter.year)) && (!q || haystack(p).includes(q)));
  const by = { new: (x, y) => (y.paid_on || "").localeCompare(x.paid_on || ""), old: (x, y) => (x.paid_on || "").localeCompare(y.paid_on || ""), high: (x, y) => num(y.amount) - num(x.amount), low: (x, y) => num(x.amount) - num(y.amount) }[filter.sort];
  return list.sort(by);
}

export function rowHtml(b, p) {
  const skipped = p.status === "skipped", edit = `${href("bill", b.id)}?sec=pay&edit=${encodeURIComponent(p.id)}`;
  const sub = [p.unit_amount != null ? `${t("单元费")} ${mny(p.unit_amount, p.currency)} · ${t("车位费")} ${mny(p.parking_amount, p.currency)}` : null, p.due_on && p.due_on !== p.paid_on ? t("到期 {d}", { d: fmtDate(p.due_on) }) : null, paymentPayLabel(p), p.confirmation_ref ? t("确认号 {ref}", { ref: p.confirmation_ref }) : null,
    num(p.assessment_amount) ? t("摊派 {m}", { m: mny(p.assessment_amount, p.currency) }) : null, num(p.fee_amount) ? t("手续费 {m}", { m: mny(p.fee_amount, p.currency) }) : null, num(p.tax_amount) ? t("税 {m}", { m: mny(p.tax_amount, p.currency) }) : null,
    num(p.late_fee) ? t("滞纳金 {m}", { m: mny(p.late_fee, p.currency) }) : null, p.notes].filter(Boolean).map(esc).join(" · ");
  // 这一笔的更多操作：⋯（电脑）和长按（手机）同一份
  const items = [{ label: t("编辑"), href: edit, first: true }, { label: t("复制"), href: `${href("bill", b.id)}?sec=pay&copy=${encodeURIComponent(p.id)}` }, { label: t("删除"), action: "billpay-del", data: { id: p.id }, danger: true }];
  return `<li class="pay-row" data-swipe-del="bill-pay" ${lpAttr(items, fmtDate(p.paid_on))}>
    <span class="badge ${skipped ? "" : "b-ok"}" ${skipped ? 'style="background:var(--surface-2)"' : ""}>${esc(t(B().PAYMENT_STATUS[p.status] || p.status))}</span>
    <a class="grow pay-hit" href="${edit}" title="${esc(t("点一下编辑"))}"><b>${esc(fmtDate(p.paid_on))}</b>${sub ? `<small>${sub}</small>` : ""}</a>
    <b class="pay-total" title="${esc(t("总金额"))}">${p.amount != null && !skipped ? mny(payTotal(p), p.currency) : ""}</b>
    ${moreMenu(items, { label: t("更多操作") })}
    <button type="button" class="btn btn-sm btn-ghost swipe-src" data-action="billpay-del" data-id="${p.id}" aria-label="${esc(t("删除这条记录"))}">${t("删除")}</button></li>`;
}

/** 列表区（筛选结果 + 合计）：搜索 / 筛选变了只重画这一块 */
function listHtml(b) {
  const all = rowsOf(b), rows = visible(b);
  if (!all.length) return `<div class="empty"><strong>${t("还没有记录")}</strong>${t("点右下角的 ＋ 记第一笔。")}</div>`;
  if (!rows.length) return `<div class="empty"><strong>${t("没有符合条件的记录")}</strong>${t("换个关键词，或点“清除筛选”。")}</div>`;
  const paid = rows.filter((p) => p.status !== "skipped" && p.amount != null).reduce((s, p) => s + payTotal(p), 0), page = rows.slice(0, shown), rest = rows.length - page.length;
  return `<p class="muted pay-sum">${t("共 {n} 条", { n: rows.length })}${rows.length !== all.length ? ` / ${all.length}` : ""} · ${t("合计 {m}", { m: mny(paid, b.currency) })}</p>
    <ul class="restock-list pay-list">${page.map((p) => rowHtml(b, p)).join("")}</ul>${rest > 0 ? `<div class="form-actions"><button type="button" class="btn btn-sm btn-ghost" data-action="pay-hist-more">${t("加载更多（还有 {n} 条）", { n: rest })}</button></div>` : ""}${older.busy ? `<p class="muted" role="status">${t("正在读取更早的记录…")}</p>` : ""}`;
}
const filtered = () => changed(filter, FILTER0);   // 清除筛选用全站统一的按钮（手机上收进筛选面板第一行）；排序不算筛选，但这页原来把它算进去，保持：排序变了也显示清除
function toolbarHtml(b) {
  const years = [...new Set(rowsOf(b).map((p) => (p.paid_on || "").slice(0, 4)).filter(Boolean))].sort().reverse();
  const opt = (v, l, cur) => `<option value="${esc(v)}" ${cur === v ? "selected" : ""}>${esc(l)}</option>`;
  return `<div class="toolbar pay-bar" id="bphBar">
    <input id="bphQ" type="search" class="pay-q" placeholder="${esc(t("搜索缴费记录"))}" aria-label="${esc(t("搜索日期、金额、账户、确认号、备注"))}" value="${esc(filter.q)}" autocomplete="off">
    <select id="bphStatus" aria-label="${esc(t("按状态筛选"))}">${opt("all", t("全部状态"), filter.status)}${Object.entries(B().PAYMENT_STATUS).map(([k, n]) => opt(k, t(n), filter.status)).join("")}</select>
    <select id="bphYear" aria-label="${esc(t("按年份筛选"))}">${opt("all", t("全部年份"), filter.year)}${years.map((y) => opt(y, y, filter.year)).join("")}</select>
    <select id="bphSort" aria-label="${esc(t("排序"))}">${SORTS.map(([v, l]) => opt(v, t(l), filter.sort)).join("")}</select>
    ${clearFiltersBtn("bph", filtered())}</div>`;
}

/** 页面：crumb = 面包屑 HTML（views.js 里的 billCrumb 不好导出，由它传进来） */
export function payHistoryPage(b, crumb, notice = "") {
  const base = href("bill", b.id);
  if (older.billId !== b.id) {   // 进页面：读这条账单更早的记录，读回来后只重画列表（正在看别的页面就不动）
    older = { billId: b.id, rows: [], busy: true }; shown = PAGE;
    const id = b.id;
    Store.listPaymentsOfBill(id).then((rows) => { if (older.billId === id) older = { billId: id, rows, busy: false }; }).catch(() => { if (older.billId === id) older.busy = false; })
      .finally(() => redraw(id));
  }
  return `<section class="section">${crumb}
    <div class="section-head"><h2>${t("缴费记录")}</h2><p>${esc(b.name)}</p></div>
    ${notice}${toolbarHtml(b)}
    <div class="panel" id="bphList" style="margin-top:10px">${listHtml(b)}</div>
    <a class="fab" href="${base}?pay=1" aria-label="${esc(t("记一笔缴费"))}" title="${esc(t("记一笔缴费"))}">＋</a>
  </section>`;
}

const current = () => { const id = state.route?.id, q = state.route?.q; return state.route?.section === "bill" && q?.get("sec") === "pay" && !q.get("edit") && !q.get("copy") ? state.billsEnriched.find((x) => x.id === id) : null; };
function redraw(billId) {
  const b = current(); if (!b || b.id !== billId) return;
  const list = document.getElementById("bphList"), bar = document.getElementById("bphBar");
  if (list) list.innerHTML = listHtml(b);
  if (bar && !bar.contains(document.activeElement)) bar.outerHTML = toolbarHtml(b);   // 年份选项可能多了；正在输入搜索词时不动工具栏
}
function apply(patch, rebuildBar = false) {
  Object.assign(filter, patch); shown = PAGE;   // 换了搜索 / 筛选：回到第一页
  const b = current(); if (!b) return;
  const list = document.getElementById("bphList"); if (list) list.innerHTML = listHtml(b);
  const bar = document.getElementById("bphBar");
  if (bar && rebuildBar) bar.outerHTML = toolbarHtml(b);
  else { const c = bar?.querySelector("[data-clear-filters]"); if (c) c.hidden = !filtered(); }   // 只更新“清除筛选”按钮的显隐：输入搜索词时不能重建输入框
}
document.addEventListener("input", (e) => { if (e.target.id === "bphQ") apply({ q: e.target.value }); });
document.addEventListener("change", (e) => { const k = { bphStatus: "status", bphYear: "year", bphSort: "sort" }[e.target.id]; if (k) apply({ [k]: e.target.value }); });
onClearFilters("bph", () => apply({ ...FILTER0 }, true), filtered);
document.addEventListener("click", (e) => {   // 加载更多：只重画列表，留在原位
  if (!e.target.closest("[data-action=pay-hist-more]")) return;
  shown += PAGE; const b = current(); if (!b) return;
  const list = document.getElementById("bphList"), y = window.scrollY; if (list) list.innerHTML = listHtml(b); window.scrollTo(0, y);
});
