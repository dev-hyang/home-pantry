/* 借贷流水：方向和筛选。 */
import { TXN_TYPES } from "../core/debt-rules.js";
import { changed, clearFiltersBtn, onClearFilters } from "../core/clear-filters.js";
import { debtById } from "./debt-logic-common.js";
import { debtLabel, isPersonal, rowHtml, sentence, whoOf } from "./debt-rec-row.js";
import { esc, fmtDate, num } from "../core/util.js";
import { pageLimit, pageMoreBtn } from "../core/pager.js";
import { t } from "../core/i18n.js";
import { mny, r2, ui } from "./debt-rec-common.js";

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
export const flowIcon = (f) => { const v = FLOW[f || "none"]; return `<span class="dr-flow ${v.cls}" title="${esc(t(v.name))}"><span aria-hidden="true">${v.icon}</span><span class="sr-only">${esc(t(v.name))}</span></span>`; };
/** 借入（我欠别人，含贷款）/ 借出（别人欠我） */
const dirOf = (d) => (d?.direction === "receivable" ? "lent" : "borrowed");
const linked = (x) => !!(x.purchase_id || x.income_record_id || x.bill_payment_id);
export const txnName = (x) => t(TXN_TYPES[x.type]?.name || x.type);
/* ───────────── 筛选 ───────────── */
const DEF = { q: "", dir: "all", flow: "all", type: "all", debt: "all", link: "all" };
export const filt = (key) => ((ui().recF ||= {})[key] ||= { ...DEF });
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
    const hay = skey([d?.name, d?.counterparty_name, debtLabel(d), sentence(x, d), x.notes, txnName(x), x.txn_date, fmtDate(x.txn_date), r2(x.total).toFixed(2), r2(x.principal_amount).toFixed(2), r2(x.interest_amount).toFixed(2)].join(" "));
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
  const debts = showDebt ? [...new Map(all.map((x) => [x.debt_id, debtById(x.debt_id)])).values()].filter(Boolean).sort((a, b) => whoOf(a).localeCompare(whoOf(b)) || String(a.start_date || "").localeCompare(String(b.start_date || ""))) : [];
  const optH = ([v, n]) => `<option value="${esc(v)}" ${String(f[name0]) === String(v) ? "selected" : ""}>${esc(n)}</option>`;
  let name0 = "";
  const sel = (name, label, opts) => { name0 = name; return `<select data-rec-f="${name}" data-rec="${esc(key)}" aria-label="${esc(label)}">${opts.map((o) => (o.group ? `<optgroup label="${esc(o.group)}">${o.items.map(optH).join("")}</optgroup>` : optH(o))).join("")}</select>`; };
  // 「哪笔借贷」按 借出（别人欠我）/ 借入（我欠别人）/ 贷款 分组：同一个人既借过他、又借给过他时分得清；同一组里重名的加上起始日期
  const debtGroups = () => {
    const G = [["lent", t("借出 · 别人欠我"), (d) => isPersonal(d) && d.direction === "receivable"], ["borrowed", t("借入 · 我欠别人"), (d) => isPersonal(d) && d.direction !== "receivable"], ["loan", t("贷款"), (d) => !isPersonal(d)]];
    return G.map(([, label, pred]) => {
      const ds = debts.filter(pred); if (!ds.length) return null;
      const n = (d) => whoOf(d), dup = (d) => ds.filter((y) => n(y) === n(d)).length > 1;
      return { group: label, items: ds.map((d) => [d.id, `${n(d)}${dup(d) ? ` · ${d.start_date ? fmtDate(d.start_date) : mny(d.original_principal, d.currency)}` : ""}`]) };
    }).filter(Boolean);
  };
  return `<div class="toolbar dr-tools">
      <input type="search" data-rec-q="${esc(key)}" value="${esc(f.q)}" placeholder="${esc(t("搜索：对方、备注、金额"))}" aria-label="${esc(t("搜索借贷流水"))}">
      ${dirFilter ? sel("dir", t("借入 / 借出"), [["all", t("借入和借出")], ["lent", t("借出（别人欠我）")], ["borrowed", t("借入（我欠别人，含贷款）")]]) : ""}
      ${sel("flow", t("资金方向"), [["all", t("流入和流出")], ["in", `↙ ${t("资金流入")}`], ["out", `↗ ${t("资金流出")}`], ["none", `⇄ ${t("不动钱")}`]])}
      ${types.length > 1 ? sel("type", t("类型"), [["all", t("全部类型")], ...types.map((k) => [k, t(TXN_TYPES[k]?.name || k)])]) : ""}
      ${debts.length > 1 ? sel("debt", t("哪笔借贷"), [["all", t("全部借贷")], ...debtGroups()]) : ""}
      ${sel("link", t("关联"), [["all", t("关联不限")], ["yes", t("已关联花费 / 收入")], ["no", t("没关联")]])}
      ${clearFiltersBtn(`debt-rec-${key}`, changed(f, DEF))}
    </div>
    <div class="dr-list" id="drl-${esc(key)}">${innerHtml(key)}</div>`;
}
let rerenderFn = () => {};
export const rerender = (...a) => rerenderFn(...a);
/** 页面加载后由 debt-rec-link.js 的入口交进来（重画整页的函数） */
export const setRerender = (f) => { rerenderFn = f; };
const refreshAll = () => rerender(false);
