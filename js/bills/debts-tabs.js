/* 借贷 → 标签页：借出 / 借入、总览、还款日历等各个页签。 */
import * as A from "../core/amortization.js";
import { FD, changed, clearFiltersBtn } from "../core/clear-filters.js";
import { TXN_TYPES, debtCat, debtGroup, isClosedStatus } from "../core/debt-rules.js";
import { assetName } from "../house/assets.js";
import { attentionPanel } from "../core/alerts.js";
import { debtDashboard, debtFigures } from "./debt-stats.js";
import { debtHref } from "./debt-logic.js";
import { esc, fmtDate } from "../core/util.js";
import { loanCard, looseBillsHtml, personCard } from "./debts-list.js";
import { pageLimit, pageMoreBtn } from "../core/pager.js";
import { recordsList } from "./debt-records.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";
import { mny, tabHref, ui } from "./debt-common.js";
import { debtTxns } from "./debt-logic-common.js";

/* ───────────── 标签页 ───────────── */
const fsel = (attr, f, key, label, list) => `<label class="tb-field"><span>${t(label)}</span><select ${attr}="${key}" data-nosearch aria-label="${esc(t(label))}">${list.map(([k, l]) => `<option value="${k}"${k === f[key] ? " selected" : ""}>${esc(t(l))}</option>`).join("")}</select></label>`;
const fsearch = (attr, f, ph, label) => `<label class="tb-field tb-q"><span>${t("搜索")}</span><input type="search" ${attr}="q" value="${esc(f.q)}" placeholder="${esc(t(ph))}" aria-label="${esc(t(label))}" autocomplete="off"></label>`;
/** 列表区：标题 + 筛选条 + 小结 + 列表（按页）；id=debt-recs，统计面板里的名字链过来时滚到这里 */
const recsBlock = ({ title, tools, sum, body }) => `<div class="debt-recs" id="debt-recs" tabindex="-1"><div class="ds-viewbar"><h3>${title}</h3></div>${tools}${sum}<div class="panel">${body}</div></div>`;
export function tabPage(tab, all) {
  if (tab === "txns") return txnsTab();
  const mine = all.filter((e) => tab === "all" || debtGroup(e) === tab), dash = debtDashboard(tab, all);
  if (tab === "asset") return `<div class="section-head debt-head"><h2>🏦 ${t("资产融资")}</h2><div class="head-acts"><a class="btn btn-sm btn-primary" href="${esc(debtHref(null, "new=1"))}">＋ ${t("添加贷款")}</a></div></div>
    ${dash}${assetRecs(mine)}${looseBillsHtml()}${sumHint()}`;
  if (tab === "personal") return `<div class="section-head debt-head"><h2>🤝 ${t("个人借贷")}</h2><div class="head-acts">
      <a class="btn btn-sm btn-primary" href="${esc(debtHref(null, "new=1&cat=personal_lending&dir=receivable"))}">＋ ${t("借出")}</a>
      <a class="btn btn-sm btn-primary" href="${esc(debtHref(null, "new=1&cat=personal_lending&dir=payable"))}">＋ ${t("借入")}</a></div></div>
    ${dash}${personalTab(mine)}${sumHint()}
    <p class="hint">${t("借出是钱从账户出去（不算消费）；收回本金不算收入，收到的利息算投资收益。以前收入里「需要还」的记录已经转成这里的借入。")}</p>`;
  // 全部借贷（进入页）
  return `<div class="section-head debt-head"><h2>📊 ${t("全部借贷")} <small class="muted">${t("全部历史，含已还清的")}</small></h2></div>
    ${dash || `<div class="panel empty"><strong>${t("还没有借贷记录")}</strong>${t("房贷、车贷、学生贷款、分期，和亲友之间的借款都可以记在这里")}
      <div class="form-actions"><a class="btn btn-sm btn-primary" href="${esc(debtHref(null, "new=1"))}">＋ ${t("添加贷款")}</a><a class="btn btn-sm" href="${esc(tabHref("personal"))}">🤝 ${t("个人借贷")}</a></div></div>`}
    ${attentionPanel(["debt"], { title: t("要处理"), sub: t("快到期、逾期的借款，待确认的车贷") })}
    ${dash ? sumHint() : ""}`;
}
const sumHint = () => `<p class="hint">${t("总额 = 原始本金加上后来又借的；已还 = 总额 − 未还（房贷按摊还表）；已还清 / 核销 / 关闭的按结清算。同一个对方的几笔合在一行：点名字，一笔的进详情，几笔的在列表里筛出来。")}</p>`;
/* 资产融资：贷款卡片列表，筛选（搜索、状态、类型）+ 排序（默认在还的在前、未还多的在前），按页加载更多 */
const ASTS = [["all", "全部状态"], ["open", "在还"], ["ended", "已结束"]];
const ASORTS = [["left", "未还 大 → 小"], ["new", "起始日期 新 → 旧"], ["old", "起始日期 旧 → 新"], ["name", "名称"]];
export const af = () => ({ ...FD.debtA, sort: "left", ...(ui().af || {}) });
const isOpen = (e) => !isClosedStatus(e.status);
function assetRows(loans) {
  const f = af(), q = f.q.trim().toLowerCase();
  const rows = loans.filter((e) => (f.st === "all" || (f.st === "open" ? isOpen(e) : !isOpen(e))) && (f.cat === "all" || e.category === f.cat) &&
    (!q || [e.name, e.counterparty_name, e.notes, e.property?.name, e.asset ? assetName(e.asset) : ""].some((v) => String(v || "").toLowerCase().includes(q))));
  const date = (e) => e.start_date || e.opening_balance_on || "";
  const by = { left: (a, b) => isOpen(b) - isOpen(a) || (b.balance || 0) - (a.balance || 0), new: (a, b) => date(b).localeCompare(date(a)), old: (a, b) => (date(a) || "9").localeCompare(date(b) || "9"),
    name: (a, b) => String(a.name).localeCompare(String(b.name)) }[f.sort] || ((a, b) => isOpen(b) - isOpen(a));
  return rows.sort((a, b) => by(a, b) || String(a.name).localeCompare(String(b.name)));
}
function assetRecs(loans) {
  const f = af(), rows = assetRows(loans), cats = [...new Set(loans.map((e) => e.category))];
  const lim = pageLimit("debt-asset", JSON.stringify(f)), shown = rows.slice(0, lim), A_ = "data-debt-af";
  const tools = loans.length ? `<div class="time-bar debt-pf" role="group" aria-label="${esc(t("筛选和排序"))}">${fsearch(A_, f, "贷款名称、贷款方、资产", "搜索贷款")}
      ${fsel(A_, f, "st", "状态", ASTS)}${cats.length > 1 ? fsel(A_, f, "cat", "类型", [["all", "全部类型"], ...cats.map((c) => [c, debtCat(c).name])]) : ""}${fsel(A_, f, "sort", "排序", ASORTS)}${clearFiltersBtn("debtA", changed(f, FD.debtA))}</div>` : "";
  const owe = rows.filter(isOpen).reduce((s, e) => s + (e.balance || 0), 0);
  const sum = loans.length ? `<p class="muted debt-pf-sum" role="status">${t("{n} 笔贷款", { n: rows.length })}${owe ? ` · ${t("未还 {a}", { a: mny(A.r2(owe)) })}` : ""}</p>` : "";
  const body = !loans.length ? `<div class="empty"><strong>${t("还没有贷款")}</strong>${t("房贷、车贷、学生贷款、分期都可以记在这里")}</div>`
    : rows.length ? `<ul class="fa-list">${shown.map(loanCard).join("")}</ul>${pageMoreBtn("debt-asset", rows.length, shown.length)}` : `<div class="empty">${t("没有符合筛选的贷款")}</div>`;
  return recsBlock({ title: `${t("全部贷款")} <small class="muted">${t("在还的在前")}</small>`, tools, sum, body });
}
/* 个人借贷：筛选（按人搜索、借出 / 借入、状态）+ 排序（默认按借款日期 新 → 旧），一个列表、按页显示 */
const PSORTS = [["new", "借款日期 新 → 旧"], ["old", "借款日期 旧 → 新"], ["amt", "金额 大 → 小"], ["amtAsc", "金额 小 → 大"], ["left", "未还 大 → 小"], ["due", "到期 近 → 远"]];
const PDIRS = [["all", "借出和借入"], ["receivable", "借出（别人欠我）"], ["payable", "借入（我欠别人）"]];
const PSTS = [["all", "全部状态"], ["open", "未结清"], ["overdue", "逾期"], ["settled", "已结清"]];
export const pf = () => ({ ...FD.debtP, sort: "new", ...(ui().pf || {}) });
const pFiltered = () => changed(pf(), FD.debtP);
function personalRows(mine) {
  const f = pf(), q = f.q.trim().toLowerCase();
  const rows = mine.map((e) => ({ e, f: debtFigures(e) })).filter(({ e, f: x }) =>
    (f.dir === "all" || e.direction === f.dir) &&
    (f.st === "all" || (f.st === "settled" ? x.settled : f.st === "open" ? !x.settled : e.overdue)) &&
    (!q || [e.counterparty_name, e.name, e.notes, (state.people || []).find((p) => p.id === e.person_id)?.name].some((v) => String(v || "").toLowerCase().includes(q))));
  const newest = (a, b) => b.f.date.localeCompare(a.f.date);
  const by = { new: newest, old: (a, b) => (a.f.date || "9").localeCompare(b.f.date || "9"), amt: (a, b) => b.f.total - a.f.total, amtAsc: (a, b) => a.f.total - b.f.total,
    left: (a, b) => (b.f.left || 0) - (a.f.left || 0), due: (a, b) => (a.e.maturity_date || "9").localeCompare(b.e.maturity_date || "9") }[f.sort] || newest;
  return rows.sort((a, b) => by(a, b) || newest(a, b));
}
function personalTab(mine) {
  const f = pf(), rows = personalRows(mine), P_ = "data-debt-pf";
  const lim = pageLimit("debt-personal", JSON.stringify(f)), shown = rows.slice(0, lim);
  const left = (dir) => rows.filter((x) => x.e.direction === dir).reduce((s, x) => s + (x.f.left || 0), 0);
  const tools = mine.length ? `<div class="time-bar debt-pf" role="group" aria-label="${esc(t("筛选和排序"))}">${fsearch(P_, f, "对方名字、备注", "按人搜索")}
      ${fsel(P_, f, "dir", "方向", PDIRS)}${fsel(P_, f, "st", "状态", PSTS)}${fsel(P_, f, "sort", "排序", PSORTS)}${clearFiltersBtn("debtP", pFiltered())}</div>` : "";
  const sum = mine.length ? `<p class="muted debt-pf-sum" role="status">${t("{n} 笔借贷", { n: rows.length })}${left("receivable") ? ` · ${t("别人还欠我 {a}", { a: mny(A.r2(left("receivable"))) })}` : ""}${left("payable") ? ` · ${t("我还欠 {a}", { a: mny(A.r2(left("payable"))) })}` : ""}</p>` : "";
  const body = !mine.length ? `<div class="empty">${t("还没有个人借贷：借给亲友、向亲友借的钱都可以记在这里")}</div>`
    : rows.length ? `<ul class="fa-list">${shown.map((x) => personCard(x.e)).join("")}</ul>${pageMoreBtn("debt-personal", rows.length, shown.length)}` : `<div class="empty">${t("没有符合筛选的借贷")}</div>`;
  return recsBlock({ title: `${t("每一笔借贷")} <small class="muted">${t("默认按借款日期 新 → 旧")}</small>`, tools, sum, body });
}
const txnName = (x) => t(TXN_TYPES[x.type]?.name || x.type);
export const txnsOf0 = (id) => debtTxns().filter((x) => x.debt_id === id);
/** 已存的拆分流水（不能按摊还表拆时的只读列表） */
export function txnRow(x, d, { manage = false } = {}) {
  const parts = [x.principal_amount ? t("本金 {a}", { a: mny(x.principal_amount, d?.currency) }) : null, x.interest_amount ? t("利息 {a}", { a: mny(x.interest_amount, d?.currency) }) : null,
    x.escrow_amount ? t("Escrow {a}", { a: mny(x.escrow_amount, d?.currency) }) : null, x.fee_amount ? t("滞纳金 {a}", { a: mny(x.fee_amount, d?.currency) }) : null].filter(Boolean);
  const src = x.bill_payment_id ? t("账单缴费") : x.purchase_id ? t("已记花费") : x.income_record_id ? t("已记收入") : null;
  // 一行：左边 日期 · 类型 · 贷款（+ 拆分明细），右边金额（右对齐、等宽数字）；手机上明细换行，金额仍在右上
  return `<li class="fa-row dd-row"><div class="dd-row-main"><span class="dd-row-top"><b>${esc(fmtDate(x.txn_date))}</b><span>${esc(txnName(x))}</span>${x.split_source === "manual" && x.bill_payment_id ? `<span class="badge b-soon">${t("手动")}</span>` : ""}
      ${d ? `<a href="${esc(debtHref(d.id))}">${esc(d.name)}</a>` : ""}</span>
    <small class="muted">${[...parts, src, x.notes].filter(Boolean).map(esc).join(" · ")}</small></div>
    <b class="dd-amt">${mny(x.total, d?.currency)}</b>
    ${manage && !x.bill_payment_id ? `<div class="dd-row-act"><button type="button" class="btn btn-sm btn-ghost" data-debt="txn-del" data-id="${esc(x.id)}">${t("删除")}<span class="sr-only"> ${esc(fmtDate(x.txn_date))} ${esc(txnName(x))}</span></button></div>` : ""}</li>`;
}
function txnsTab() {
  return `<div class="panel" style="margin-top:12px">${recordsList("txns", { txns: debtTxns, showDebt: true, empty: t("还没有借贷流水") })}</div>
    <p class="hint">${t("↙ 资金流入、↗ 资金流出、⇄ 不动钱（调整、核销）。账单缴费的拆分在缴费时自动生成；钱本身记在花费 / 收入里，这里是同一笔钱的借贷视角，不重复计算。")}</p>`;
}
