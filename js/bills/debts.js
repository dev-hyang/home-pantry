/* 财务 → 借贷（财务 P2，迁移 058）：全部借贷（进入页）· 资产融资（房贷、车贷、HELOC、学生贷款、分期）· 个人借贷（借给亲友 / 向亲友借）· 还款记录；
 * 前三个标签上面是统计面板（debt-stats.js：指标、现在欠的钱、按对方 借入 / 借出 或 表格），资产融资 / 个人借贷下面是带筛选的列表（按页加载更多）。
 * 一笔贷款的详情：摊还表、每期还款的 本金 / 利息 / Escrow 拆分（可手动改）、关联账单和资产（按 id）。
 * 网址：#/bills/debts[?tab=asset|personal|txns]；列表按名字筛好 ?tab=…&who=<名字>&dir=payable|receivable&at=rec；旧的 ?view=summary&seg=… 也认。
 * 详情 ?id=<贷款 id>；新建 ?new=1&cat=…&lender=…&principal=…&prop=…&asset=…&bill=…；编辑 ?id=…&edit=1。
 * 别名：#/finance/debts、#/bills/loans、#/bills/debt、#/bills/lending（router.js）。只给有财务权限的人（finance-rules.js）。
 * 数据都在内存里（state.debts / state.debtTxns，见 debt-logic.js）；还款记录多了按页显示。设计见 docs/design-debt-lending.md。 */
import { state } from "../core/state.js";
import { Store } from "../core/store.js";
import { esc, fmtDate, money, num, toast, todayISO, confirmDelete } from "../core/util.js";
import { t } from "../core/i18n.js";
import { go, href } from "../core/router.js";
import { tabBar } from "../core/hub.js";
import { DEBT_TABS, activeTab } from "../core/tabs.js";
import * as A from "../core/amortization.js";
import { DEBT_CATS, DIRECTIONS, FREQS, ROLES, STATUSES, TXN_TYPES, debtCat, debtCatOfBill, debtGroup, freqOfBill, isClosedStatus, isLoanBillCat, isPersonalDebt } from "../core/debt-rules.js";
import { billOfDebt, calibrateDebt, canSplit, clearOverride, debt060, debtById, paymentTable, setExtraPrincipal, splitMissing, debtHref, debtTxns, debtsEnriched, deleteDebtTxn, enrichDebt, loadDebts, overrideSplit, recordDebtTxn, relinkPaymentPurchase, resplitDebt, syncDebtStatus, syncVehicle, unsplitDebt, updateDebtTxn } from "./debt-logic.js";
import { initRecords, linkCandidates, recordsList, seenLine, setRecordFilter, takenGroup } from "./debt-records.js";
import { deleteBillPay } from "./views.js";
import { pageLimit, pageMoreBtn } from "../core/pager.js";
import { loadIncome } from "../income/logic.js";
import { assetName, isVehicle } from "../house/assets.js";
import { liveNetWorth } from "./nw-logic.js";
import { attentionPanel } from "../core/alerts.js";   // 资产净值（P3，迁移 059）
import { SEGS, debtDashboard, debtFigures, initDebtSummary } from "./debt-stats.js";
import { FD, changed, clearFiltersBtn, onClearFilters } from "../core/clear-filters.js";

let hooks = { render: () => {}, refresh: async () => {} };
const ui = () => (state.debtUi ||= {});
const cur = () => Units.region.currency;
const mny = (v, c) => (v == null ? "—" : Units.money(v, c || cur()));
const pct = (v) => (v == null ? "—" : `${+Number(v).toFixed(3)}%`);
const tabHref = (id) => `${href("bills", "debts")}${id === "all" ? "" : `?tab=${id}`}`;
const fact = (label, value) => (value ? `<span class="fa-fact"><small>${esc(label)}</small>${value}</span>` : "");
const statusBadge = (e) => `<span class="badge ${STATUSES[e.status]?.cls || ""}">${esc(t(STATUSES[e.status]?.name || e.status))}</span>`;
const catBadge = (e) => `<span class="badge" style="background:var(--surface-2)">${debtCat(e.category).icon} ${esc(t(debtCat(e.category).name))}</span>`;
const vehicles = () => state.assets.filter(isVehicle);
const assetLabel = (a) => (a ? (isVehicle(a) ? `🚗 ${assetName(a)}` : `⚙️ ${assetName(a)}`) : "");
const assetHref = (e) => (e.asset ? href("asset", e.asset.id) : e.property ? `${href("house", "pages")}?prop=${encodeURIComponent(e.property.id)}` : null);
const linkedText = (e) => {
  const lbl = e.asset ? assetLabel(e.asset) : e.property ? `🏠 ${e.property.name}` : null; if (!lbl) return "";
  const h = assetHref(e);
  return `<a href="${esc(h)}">${esc(lbl)}</a>${e.link_confirmed === false ? ` <span class="badge b-soon">${t("待确认")}</span>` : ""}`;
};
const periodPay = (e) => (e.pi != null ? e.pi + (e.escrow || 0) : e.scheduled_payment ?? e.bill?.est ?? null);

/* ───────────── 列表 ───────────── */
/** 关联资产的净值（净资产页同一份计算：市值 − 挂在这处资产上的全部贷款）；没估值时提示去资产页 */
const equityText = (e) => {
  const q = liveNetWorth().equity.find((x) => (e.property ? x.kind === "property" && x.item.id === e.property.id : x.kind !== "property" && x.item.id === e.asset?.id));
  return q?.equity != null ? `<a href="${href("bills", "networth")}">${mny(q.equity)}</a>${q.source === "purchase" ? ` <small class="muted">${t("按购入价")}</small>` : ""}` : `<a class="muted" href="${href("bills", "assets")}">${t("未估值")}</a>`;
};
function loanCard(e) {
  const rate = e.interest_rate != null ? pct(e.interest_rate) : `<span class="muted">${t("未填")}</span>`;
  const term = e.term_months ? t("{n} 个月", { n: e.term_months }) : null;
  const pay = periodPay(e);
  return `<li class="fa-row">
    <div class="fa-head"><b>${esc(e.name)}</b>${catBadge(e)}${statusBadge(e)}
      <a class="btn btn-sm btn-ghost fa-edit" href="${esc(debtHref(e.id))}" aria-label="${esc(t("打开贷款 {name}", { name: e.name }))}">${t("详情")} ›</a></div>
    <div class="fa-facts">
      ${fact(t("贷款方"), esc(e.counterparty_name || "—"))}
      ${fact(t("原始本金"), mny(e.original, e.currency))}
      ${fact(t("未还本金"), e.balance != null ? `<b>${mny(e.balance, e.currency)}</b>` : `<span class="muted">${t("填本金后算")}</span>`)}
      ${fact(t("利率 / 期限"), [rate, term].filter(Boolean).join(" · "))}
      ${fact(t("每期还款"), pay != null ? `${mny(pay, e.currency)}${e.escrow ? ` <small class="muted">${t("含 Escrow {a}", { a: mny(e.escrow, e.currency) })}</small>` : ""}` : "—")}
      ${fact(t("下次还款"), e.nextDue ? esc(fmtDate(e.nextDue)) : e.bill ? `<span class="muted">${t("账单没填到期日")}</span>` : `<span class="muted">${t("没挂账单")}</span>`)}
      ${fact(t("资产"), linkedText(e) || `<span class="muted">${t("没关联")}</span>`)}
      ${(e.property || e.asset) && !isClosedStatus(e.status) && state.nwOk ? fact(t("资产净值"), equityText(e)) : ""}
    </div></li>`;
}
function personCard(e) {
  const recv = e.direction === "receivable", who = e.counterparty_name || e.name;
  const paidPct = e.original > 0 && e.balance != null ? Math.round(((e.original - e.balance) / e.original) * 100) : null;
  const person = e.person_id ? (state.people || []).find((p) => p.id === e.person_id)?.name : null;
  return `<li class="fa-row">
    <div class="fa-head"><b>${esc(who)}</b><span class="badge" style="background:var(--surface-2)">${esc(t(DIRECTIONS[e.direction].short))}</span>${e.balance === 0 && !isClosedStatus(e.status) ? `<span class="badge b-ok">${t("已结清")}</span>` : statusBadge(e)}
      <a class="btn btn-sm btn-ghost fa-edit" href="${esc(debtHref(e.id))}" aria-label="${esc(t("打开借款 {name}", { name: who }))}">${t("详情")} ›</a></div>
    <div class="fa-facts">
      ${fact(t("金额"), mny(e.original, e.currency))}
      ${fact(t("借款日期"), e.start_date ? esc(fmtDate(e.start_date)) : "")}
      ${fact(recv ? t("对方还欠") : t("我还欠"), e.balance != null ? `<b>${mny(e.balance, e.currency)}</b>` : "—")}
      ${fact(t("到期"), e.maturity_date ? `${esc(fmtDate(e.maturity_date))}${e.overdue ? ` <span class="badge b-out">${t("逾期")}</span>` : ""}` : `<span class="muted">${t("没约定")}</span>`)}
      ${fact(recv ? t("已收回") : t("已还"), paidPct != null ? `<span class="pc-prog"><span class="ds-bar ${paidPct >= 100 ? "done" : recv ? "recv" : ""}" aria-hidden="true"><i style="width:${Math.min(100, paidPct)}%"></i></span>${paidPct}% · ${mny(A.r2(e.original - e.balance), e.currency)}</span>` : "—")}
      ${person ? fact(t("家里"), esc(person)) : ""}
    </div></li>`;
}
/** 没挂贷款的贷款类账单（迁移以后新建的）：提示建贷款 */
const looseLoanBills = () => state.billsEnriched.filter((b) => isLoanBillCat(b.category) && b.direction !== "receivable" && !b.debt_id && b.active && !b.ended);
export const looseBillsHtml = () => {
  const list = looseLoanBills(); if (!list.length) return "";
  return `<div class="panel" style="margin-top:12px"><b>${t("还没建贷款的贷款账单")}</b><p class="muted" style="font-size:13px;margin:4px 0 8px">${t("建了贷款才能算余额、按本金 / 利息拆分还款")}</p>
    <ul class="fa-list">${list.map((b) => `<li class="fa-row"><div class="fa-head"><a href="${esc(href("bill", b.id))}">${esc(b.name)}</a><small class="muted">${mny(b.est, b.currency)}</small>
      <a class="btn btn-sm fa-edit" href="${esc(newFromBillHref(b))}">${t("建贷款")}</a></div></li>`).join("")}</ul></div>`;
};
export const newFromBillHref = (b) => debtHref(null, `new=1&bill=${encodeURIComponent(b.id)}`);

/* ───────────── 标签页 ───────────── */
const fsel = (attr, f, key, label, list) => `<label class="tb-field"><span>${t(label)}</span><select ${attr}="${key}" data-nosearch aria-label="${esc(t(label))}">${list.map(([k, l]) => `<option value="${k}"${k === f[key] ? " selected" : ""}>${esc(t(l))}</option>`).join("")}</select></label>`;
const fsearch = (attr, f, ph, label) => `<label class="tb-field tb-q"><span>${t("搜索")}</span><input type="search" ${attr}="q" value="${esc(f.q)}" placeholder="${esc(t(ph))}" aria-label="${esc(t(label))}" autocomplete="off"></label>`;
/** 列表区：标题 + 筛选条 + 小结 + 列表（按页）；id=debt-recs，统计面板里的名字链过来时滚到这里 */
const recsBlock = ({ title, tools, sum, body }) => `<div class="debt-recs" id="debt-recs" tabindex="-1"><div class="ds-viewbar"><h3>${title}</h3></div>${tools}${sum}<div class="panel">${body}</div></div>`;

function tabPage(tab, all) {
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
const af = () => ({ ...FD.debtA, sort: "left", ...(ui().af || {}) });
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
const pf = () => ({ ...FD.debtP, sort: "new", ...(ui().pf || {}) });
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
const txnsOf0 = (id) => debtTxns().filter((x) => x.debt_id === id);
/** 已存的拆分流水（不能按摊还表拆时的只读列表） */
function txnRow(x, d, { manage = false } = {}) {
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

/* ───────────── 详情 ─────────────
 * 布局（笔记本两栏、手机一栏，390px 不横向滚动）：头部（名称、类型、状态、贷款方 · 资产 · 账单、编辑）→ KPI 一行 →
 * 「下一期构成」（本金 / 利息 / Escrow 条）+「贷款条款」（标签 / 数值对齐的网格）→ 每期还款拆分表（宽表在可聚焦的滚动区里，手机变成卡片）→
 * 摊还表 / 额外还本 / 对账单校准 / 关联（折叠）。金额一律 tabular-nums、右对齐。 */
const dl = (rows) => `<dl class="dd-dl">${rows.filter(Boolean).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join("")}</dl>`;
const kpi = (label, value, sub = "") => `<div class="kpi"><span>${esc(label)}</span><b>${value}</b>${sub ? `<small>${sub}</small>` : ""}</div>`;
const daysText = (iso) => { const n = Math.round((new Date(`${iso}T12:00:00`) - new Date(`${todayISO()}T12:00:00`)) / 86400000); return n === 0 ? t("今天") : n > 0 ? t("{d} 天后", { d: n }) : t("逾期 {d} 天", { d: -n }); };

function amortHtml(e) {
  const principal = e.opening_balance ?? e.original;
  if (e.interest_rate == null || !(principal > 0)) return `<p class="muted">${t("填了本金和利率才有摊还表。")}</p>`;
  const fromOpening = e.opening_balance != null && !(e.original_principal > 0);
  const n = fromOpening ? A.remainingPeriods(e.opening_balance, e.rate, e.pi) : A.periodsOf(e.term_months, e.freq);
  // 有原始本金：从第 1 期（第一期还款日）画整张表；只有某天的余额：从那天往后画
  const first = fromOpening ? A.addPeriods(e.opening_balance_on, e.freq, 1) : e.first;
  const rows = A.schedule({ principal: fromOpening ? e.opening_balance : e.original, annualRate: e.interest_rate, periods: fromOpening ? null : n, pay: fromOpening || !n ? e.pi : null, first, start: e.start_date || todayISO(), freq: e.freq });
  if (!rows.length) return `<p class="muted">${t("每期还款不够付利息，或缺期限 / 每期还款，算不出摊还表。")}</p>`;
  const all = ui().amortAll === e.id, today = todayISO();
  const nextIdx = Math.max(0, rows.findIndex((r) => r.date >= today));
  const shown = all ? rows : rows.slice(Math.max(0, nextIdx - 3), Math.max(0, nextIdx - 3) + 24);
  const totalInt = rows.reduce((s, r) => s + r.interest, 0);
  return `<p class="muted dd-note">${t("{n} 期，利息合计 {a}，最后一期 {d}", { n: rows.length, a: mny(A.r2(totalInt), e.currency), d: fmtDate(rows.at(-1).date) })}${e.escrow ? ` · ${t("每期另有 Escrow 约 {a}", { a: mny(e.escrow, e.currency) })}` : ""}</p>
    <div class="table-scroll" tabindex="0" role="region" aria-label="${esc(t("摊还表"))}"><table class="dd-tbl amort-table"><caption class="sr-only">${t("摊还表")}</caption>
    <thead><tr><th scope="col">#</th><th scope="col">${t("日期")}</th><th scope="col" class="num">${t("本息")}</th><th scope="col" class="num">${t("利息")}</th><th scope="col" class="num">${t("本金")}</th><th scope="col" class="num">${t("余额")}</th></tr></thead>
    <tbody>${shown.map((r) => `<tr${r.date < today ? ' class="muted"' : ""}><td class="num">${r.n}</td><td>${esc(fmtDate(r.date))}</td><td class="num">${mny(r.payment, e.currency)}</td><td class="num">${mny(r.interest, e.currency)}</td><td class="num">${mny(r.principal, e.currency)}</td><td class="num">${mny(r.balance, e.currency)}</td></tr>`).join("")}</tbody></table></div>
    ${rows.length > 24 ? `<p><button type="button" class="btn btn-sm btn-ghost" data-debt="amort-all" data-id="${esc(e.id)}" aria-expanded="${all}">${all ? t("只看最近 24 期") : t("显示全部 {n} 期", { n: rows.length })}</button></p>` : ""}`;
}

/** 下一期的构成：本金 / 利息（按当前余额和本息）+ Escrow（银行计划；没填用 Escrow 账单估算）；条形图 + 数字，Escrow 账单只做参考 */
function breakdownHtml(e) {
  if (!(e.pi > 0) || e.balance == null) return `<p class="muted">${t("填了利率、本金和期限（或对账单校准）后显示每期的本金 / 利息。")}</p>`;
  const i = A.interestCents(Math.round(e.balance * 100), e.interest_rate, e.freq) / 100, p = A.r2(Math.max(0, e.pi - i)), es = e.escrowBank ?? e.escrowRef ?? 0;
  const total = A.r2(p + i + es), w = (v) => (total > 0 ? Math.max(0, (v / total) * 100).toFixed(1) : 0);
  const seg = (cls, v) => (v > 0 ? `<i class="${cls}" style="width:${w(v)}%"></i>` : "");
  const ref = e.escrowRef > 0 ? `<p class="dd-hint" role="note">${t("参考：这处房产的 Escrow 账单（保险 + 房产税 …）折合每期 {a}", { a: mny(e.escrowRef, e.currency) })}${e.escrowBank != null ? ` · ${t("和银行计划差 {d}", { d: mny(A.r2(e.escrowBank - e.escrowRef), e.currency) })}` : ""}<br><small>${t("只做提示：银行会留缓冲（cushion），每年 Escrow 分析后调整；不影响本金 / 利息。")}</small></p>` : "";
  return `<div class="dd-bar" aria-hidden="true">${seg("p", p)}${seg("i", i)}${seg("e", es)}</div>
    ${dl([[t("本金"), `<span class="dd-sw p" aria-hidden="true"></span>${mny(p, e.currency)}`], [t("利息"), `<span class="dd-sw i" aria-hidden="true"></span>${mny(i, e.currency)}`],
      es ? [e.escrowBank != null ? t("Escrow（银行计划）") : t("Escrow（按账单估算）"), `<span class="dd-sw e" aria-hidden="true"></span>${mny(es, e.currency)}`] : null,
      [t("合计"), `<b>${mny(total, e.currency)}</b>`]])}${ref}`;
}

/** 贷款条款：标签 / 数值两列对齐 */
function termsHtml(e) {
  const missing = splitMissing(e).map((k) => ({ rate: t("年利率"), principal: t("原始本金或某天的余额"), pi: t("期限（或对账单校准）"), first: t("第一期还款日") })[k]);
  return `${dl([
    [t("原始本金"), mny(e.original, e.currency)],
    e.opening_balance != null ? [t("记录起点"), t("{d} 余额 {a}", { d: fmtDate(e.opening_balance_on), a: mny(e.opening_balance, e.currency) })] : null,
    [t("年利率"), pct(e.interest_rate)], [t("期限"), e.term_months ? t("{n} 个月", { n: e.term_months }) : "—"],
    [t("每期本息"), `${mny(e.pi, e.currency)}${e.statement_check ? ` <small class="muted">${t("对账单校准")}</small>` : ""}`],
    [t("第一期还款日"), e.first ? `${esc(fmtDate(e.first))}${e.first_payment_date ? "" : ` <small class="muted">${t("按起始日推算")}</small>`}` : "—"],
    e.start_date ? [t("起始日（放款）"), esc(fmtDate(e.start_date))] : null,
    [t("预计还清"), e.payoff ? `${esc(fmtDate(e.payoff))}${e.left ? ` <small class="muted">${t("还剩 {n} 期", { n: e.left })}</small>` : ""}` : "—"],
    [t("已还本金"), mny(e.paid.principal, e.currency)], [t("已付利息"), mny(e.paid.interest, e.currency)],
    e.paid.escrow ? [t("已付 Escrow"), mny(e.paid.escrow, e.currency)] : null,
    e.financing_role ? [t("融资关系"), esc(t(ROLES[e.financing_role])) + (e.secured ? ` · ${t("抵押")}` : "")] : null])}
    ${missing.length ? `<p class="notice dd-hint" role="status">${t("按摊还表拆分还缺：{x}", { x: missing.join("、") })} <a href="${esc(debtHref(e.id, "&edit=1"))}">${t("去填")}</a></p>` : ""}`;
}

/** 每期还款拆分表：按摊还表算出来的（重新拆分会写成这样），已存的不一样标「未保存」；手机上一行变一张卡片 */
function payTableHtml(e) {
  if (!e.bill) return `<p class="muted">${t("没挂账单：在下面关联一条账单，月供提醒和缴费记录就用那条账单。")}</p>`;
  if (!e.split) return `<p class="muted">${t("填了利率和本金（或某天的余额）后，账单的每笔缴费会自动拆成本金 / 利息。")}</p>${savedListHtml(e)}`;
  const pt = ui().pt;
  if (!pt || pt.id !== e.id) { loadPayTable(e.id); return `<p class="muted" role="status">${t("正在读取缴费记录…")}</p>`; }
  if (pt.err) return `<p class="form-error" role="alert">${esc(pt.err)}</p>`;
  const rows = pt.data?.rows || [];
  if (!rows.length) return `<p class="muted">${t("这条账单还没有缴费记录。")}</p>`;
  const lim = pageLimit(`debt-pay-${e.id}`), shown = rows.slice(0, lim), anyExtra = rows.some((r) => r.extra > 0), stale = rows.filter((r) => r.stale).length, c = e.currency;
  const edit = ui().editPay ? rows.find((r) => r.id === ui().editPay) : null, linking = ui().linkPay ? rows.find((r) => r.id === ui().linkPay) : null;
  const pay = (r) => state.billPayments.find((p) => p.id === r.id);
  // 「按对账单改」「关联一笔花费」的表单就在这一期下面展开（占满一行），不跑到表格最下面
  const cols = 9 + (anyExtra ? 1 : 0);
  const inline = (r) => (edit?.id === r.id || linking?.id === r.id ? `<tr class="dd-inline"><td colspan="${cols}">${edit?.id === r.id ? overrideForm(e, edit) : payLinkForm(e, linking)}</td></tr>` : "");
  // 每行的「⋯」：手动编辑（账单的缴费记录表单：日期、金额、卡）、关联一笔花费、删除这笔缴费
  const more = (r) => `<details class="act-more"><summary class="btn btn-sm btn-ghost" aria-label="${esc(t("更多操作：{d}", { d: fmtDate(r.paid_on) }))}" title="${esc(t("更多操作"))}"><span class="dots3" aria-hidden="true"></span></summary><div class="act-menu">
      <a class="act-item" href="${esc(`${href("bill", e.bill.id)}?sec=pay&edit=${encodeURIComponent(r.id)}`)}">${t("手动编辑这笔缴费")}</a>
      <button type="button" class="act-item" data-debt="pay-link" data-pay="${esc(r.id)}" aria-controls="dd-link">${t("关联一笔花费")}</button>
      <button type="button" class="act-item" data-debt="pay-del" data-id="${esc(e.id)}" data-pay="${esc(r.id)}">${t("删除这笔缴费")}</button></div></details>`;
  const cell = (label, v, cls = "num") => `<td class="${cls}" data-label="${esc(label)}">${v}</td>`;
  const tr = (r) => {
    const open = edit?.id === r.id || linking?.id === r.id;
    const tip = r.ok ? t("实付 = 本金 + 利息 + Escrow{f}", { f: r.fee ? t(" + 滞纳金") : "" }) : t("实付不够本息：先付利息，再付本金");
    const diff = r.source === "schedule" && r.escrowDiff != null && r.escrowDiff > 0.005 ? r.escrowDiff : 0;
    return `<tr class="${[r.stale ? "dd-stale" : "", open ? "dd-open" : ""].filter(Boolean).join(" ")}">
      ${cell(t("日期"), `<b>${esc(fmtDate(r.paid_on))}</b>${r.paid_on !== r.due ? ` <small class="muted">${t("应还 {d}", { d: fmtDate(r.due) })}</small>` : ""}`, "")}
      ${cell(t("期"), `#${r.k}`)}
      ${cell(t("实付"), `${mny(r.total, c)} <span class="${r.ok ? "dd-ok" : "dd-warn"}" title="${esc(tip)}">${r.ok ? "✓" : "⚠"}<span class="sr-only">${esc(tip)}</span></span>`)}
      ${cell(t("本金"), mny(r.principal - r.extra, c))}
      ${cell(t("利息"), mny(r.interest, c))}
      ${cell(t("Escrow"), `${mny(r.escrow, c)}${r.expEscrow != null && Math.abs(r.escrowDiff) >= 0.005 ? `<small class="dd-diff">${r.escrowDiff > 0 ? "+" : "−"}${mny(Math.abs(r.escrowDiff), c)} ${t("对比计划")}</small>` : ""}`)}
      ${anyExtra ? cell(t("额外本金"), r.extra ? mny(r.extra, c) : "—") : ""}
      ${cell(t("还款后余额"), mny(r.balance, c))}
      ${cell(t("来源"), `${r.source === "manual" ? `<span class="badge b-soon">${t("手动")}</span>` : `<span class="badge">${t("摊还表")}</span>`}${r.stale ? ` <span class="badge b-out">${t("未保存")}</span>` : ""}${r.fee ? ` <small class="muted">${t("滞纳金 {a}", { a: mny(r.fee, c) })}</small>` : ""}`, "dd-src")}
      <td class="dd-act">${diff ? `<button type="button" class="btn btn-sm btn-ghost" data-debt="mark-extra" data-id="${esc(e.id)}" data-pay="${esc(r.id)}" data-amt="${diff}">${t("多 {a} 记为额外本金", { a: mny(diff, c) })}</button>` : ""}
        ${r.extra > 0 && r.source === "schedule" ? `<button type="button" class="btn btn-sm btn-ghost" data-debt="mark-extra" data-id="${esc(e.id)}" data-pay="${esc(r.id)}" data-amt="0">${t("取消额外本金")}</button>` : ""}
        <button type="button" class="btn btn-sm btn-ghost" data-debt="pay-edit" data-pay="${esc(r.id)}" aria-expanded="${edit?.id === r.id}" aria-controls="dd-edit">${t("按对账单改")}<span class="sr-only"> ${esc(fmtDate(r.paid_on))}</span></button>
        ${r.source === "manual" ? `<button type="button" class="btn btn-sm btn-ghost" data-debt="override-clear" data-id="${esc(e.id)}" data-pay="${esc(r.id)}">${t("按摊还表")}<span class="sr-only"> ${esc(fmtDate(r.paid_on))}</span></button>` : ""}
        ${pay(r) ? more(r) : ""}</td></tr>`;
  };
  return `${stale ? `<p class="notice" role="status">${t("{n} 期已存的拆分和摊还表不一样（表里是按摊还表算的）：点「按摊还表重新拆分」写入。", { n: stale })}</p>` : ""}
    <div class="table-scroll dd-pay-wrap" tabindex="0" role="region" aria-label="${esc(t("每期还款拆分"))}"><table class="dd-tbl dd-pay"><caption class="sr-only">${t("每期还款拆分")}</caption>
    <thead><tr><th scope="col">${t("日期")}</th><th scope="col" class="num">${t("期")}</th><th scope="col" class="num">${t("实付")}</th><th scope="col" class="num">${t("本金")}</th><th scope="col" class="num">${t("利息")}</th><th scope="col" class="num">Escrow</th>${anyExtra ? `<th scope="col" class="num">${t("额外本金")}</th>` : ""}<th scope="col" class="num">${t("还款后余额")}</th><th scope="col">${t("来源")}</th><th scope="col"><span class="sr-only">${t("操作")}</span></th></tr></thead>
    <tbody>${shown.map((r) => tr(r) + inline(r)).join("")}</tbody></table></div>
    ${rows.length > lim ? `<p class="muted dd-note">${t("显示最近 {a} 期，共 {n} 期", { a: lim, n: rows.length })}</p>` : ""}${pageMoreBtn(`debt-pay-${e.id}`, rows.length, shown.length)}
`;
}
/** 一期还款「关联一笔花费」：缴费日前后 7 天、金额相近的花费（对账单导入的那笔多半就在里面）；选了以后缴费改指向它，原来自动记的那笔删掉 */
function payLinkForm(e, r) {
  const cand = ui().payCand?.id === r.id ? ui().payCand : null;
  if (!cand && ui().payCandLoading !== r.id) {
    const fresh = ui().payFresh === r.id; ui().payFresh = null;
    ui().payCandLoading = r.id;
    const cur0 = state.billPayments.find((p) => p.id === r.id)?.purchase_id;
    linkCandidates({ date: r.paid_on, amount: r.total, flow: "out", exclude: new Set(cur0 ? [cur0] : []), fresh })
      .then((x) => { ui().payCand = { id: r.id, ...x, list: x.list.filter((o) => o.v.startsWith("p:")), seen: x.seen }; ui().payCand.best = ui().payCand.list.find((o) => o.near)?.v || ""; },
        (err) => { ui().payCand = { id: r.id, list: [], best: "", err: err.message }; })
      .finally(() => { ui().payCandLoading = null; hooks.render(false); });
  }
  const opts = cand ? cand.list.map((o) => `<option value="${esc(o.v.slice(2))}" ${o.v === cand.best ? "selected" : ""}>${o.near ? "★ " : ""}${esc(o.label)}</option>`).join("") : "";
  return `<form id="dd-link" data-debt-form="pay-link" data-id="${esc(e.id)}" data-pay="${esc(r.id)}" class="dd-edit" aria-label="${esc(t("把 {d} 这一期关联到一笔花费", { d: fmtDate(r.paid_on) }))}">
    <p class="dd-edit-title"><b>${t("把 {d} 这一期关联到一笔花费", { d: fmtDate(r.paid_on) })}</b> <small class="muted">${t("实付 {a}", { a: mny(r.total, e.currency) })}</small></p>
    <div class="dr-link-row"><label>${t("花费")}${!cand ? `<select disabled><option>${t("正在找前后几天的花费…")}</option></select>` : cand.err ? `<span class="form-error">${esc(cand.err)}</span>`
      : cand.list.length || cand.taken?.some((o) => o.v.startsWith("p:")) ? `<select name="purchase" required><option value="">${t("选一笔")}</option>${opts}${takenGroup(cand, "p:")}</select>` : `<span class="muted">${t("前后 7 天没有可关联的花费。")}</span>`}</label>
      <button type="button" class="btn btn-sm btn-ghost dr-refresh" data-debt="pay-cand-refresh" data-pay="${esc(r.id)}" ${cand ? "" : "disabled"} aria-label="${esc(t("重新查找相近的花费和收入"))}" title="${esc(t("重新查找相近的花费和收入（刚导入或刚记了一笔时用）"))}"><span aria-hidden="true">↻</span></button></div>${cand ? seenLine(cand, "p:") : ""}
    <p class="muted dd-note">${t("★ = 日期和金额相近。关联后这笔缴费就记在那笔花费上（原来自动记的那笔删掉），花费会改成利息 + Escrow 部分，本金另记一行——同一笔钱不重复计算。")}</p>
    <div class="form-actions"><button class="btn btn-sm btn-primary" ${cand?.list.length ? "" : "disabled"}>${t("关联")}</button><button type="button" class="btn btn-sm btn-ghost" data-debt="pay-link" data-pay="">${t("取消")}</button></div>
  </form>`;
}
/** 改一期（按对账单）：本金 / 额外本金 / 利息 / Escrow */
function overrideForm(e, r) {
  const v = r.saved && r.source === "manual" ? { principal: A.r2(r.saved.principal_amount - r.saved.extra_principal), extra: r.saved.extra_principal, interest: r.saved.interest_amount, escrow: r.saved.escrow_amount } : { principal: A.r2(r.principal - r.extra), extra: r.extra, interest: r.interest, escrow: r.escrow };
  return `<form id="dd-edit" data-debt-form="override" data-id="${esc(e.id)}" data-pay="${esc(r.id)}" class="dd-edit" aria-label="${esc(t("改 {d} 这一期", { d: fmtDate(r.paid_on) }))}">
    <p class="dd-edit-title"><b>${t("改 {d} 这一期（按对账单）", { d: fmtDate(r.paid_on) })}</b> <small class="muted">${t("实付 {a}", { a: mny(r.total, e.currency) })}</small></p>
    <div class="form-grid">
      <label>${t("本金")}<input type="number" name="principal" inputmode="decimal" step="0.01" min="0" value="${v.principal}" required></label>
      <label>${t("额外本金")}<input type="number" name="extra" inputmode="decimal" step="0.01" min="0" value="${v.extra || ""}"></label>
      <label>${t("利息")}<input type="number" name="interest" inputmode="decimal" step="0.01" min="0" value="${v.interest}"></label>
      <label>Escrow<input type="number" name="escrow" inputmode="decimal" step="0.01" min="0" value="${v.escrow}"></label>
    </div>
    <div class="form-actions"><button class="btn btn-sm btn-primary">${t("保存这一期")}</button>${r.source === "manual" ? `<button type="button" class="btn btn-sm btn-ghost" data-debt="override-clear" data-id="${esc(e.id)}" data-pay="${esc(r.id)}">${t("改回按摊还表")}</button>` : ""}<button type="button" class="btn btn-sm btn-ghost" data-debt="pay-edit" data-pay="">${t("取消")}</button></div>
  </form>`;
}
/** 不能按摊还表拆时：已存的拆分流水（迁移来的 / 以前拆的） */
function savedListHtml(e) {
  const list = e.txns.filter((x) => x.bill_payment_id).sort((a, b) => b.txn_date.localeCompare(a.txn_date)).slice(0, ui().payLimit || 12);
  return list.length ? `<ul class="fa-list dd-rows">${list.map((x) => txnRow(x, null)).join("")}</ul>` : "";
}
/** 读逐期表（读一次这条账单的缴费）；读完重画 */
function loadPayTable(id) {
  if (ui().ptLoading === id) return;
  ui().ptLoading = id;
  const d = debtById(id);
  paymentTable(d).then((data) => { ui().pt = { id, data }; }, (err) => { ui().pt = { id, err: t("读取缴费记录失败：{msg}", { msg: err.message }) }; })
    .finally(() => { ui().ptLoading = null; if (state.route.q.get("id") === id) hooks.render(false); });
}

/** 用对账单校准：填一期的日期、本金、利息（和还款后余额）→ 和摊还表对照；可以存成校准（本息以对账单为准）或者作为记录起点 */
function calibrateHtml(e) {
  const c = ui().calib?.id === e.id ? ui().calib : null, sc = e.statement_check || {}, v = c?.input || sc, cur = e.currency;
  const res = c?.res;
  const hint = (h) => ({
    pi_mismatch: t("按公式算的本息 {a}，对账单是 {b}：原始本金、利率或期限可能填得不对（存成校准后以对账单为准）。", { a: mny(h.calc, cur), b: mny(h.stmt, cur) }),
    shift: t("对账单和摊还表的第 {k} 期一致：第一期还款日可能{w}了一个月。", { k: h.k, w: h.by < 0 ? t("填晚") : t("填早") }),
    extra_before: t("对账单的余额比摊还表少约 {a}：之前可能有额外还本金（在下面「额外还本金」里补记，或作为记录起点）。", { a: mny(h.amount, cur) }),
    no_schedule: t("缺第一期还款日或本金，没法对到第几期；可以把这张对账单作为记录起点。"),
    before_anchor: t("这一期在记录起点之前，没法对照。"),
  })[h.code] || h.code;
  const out = res ? `<div class="dd-calib-res" role="status">
      ${res.expected ? `${res.ok ? `<p class="dd-ok-line">✓ ${t("和摊还表第 {k} 期逐分一致", { k: res.k })}</p>` : `<p class="dd-warn-line">⚠ ${t("和摊还表第 {k} 期不一致", { k: res.k })}</p>`}
        <div class="table-scroll" tabindex="0" role="region" aria-label="${esc(t("对账单和摊还表对照"))}"><table class="dd-tbl"><thead><tr><th scope="col"></th><th scope="col" class="num">${t("对账单")}</th><th scope="col" class="num">${t("摊还表")}</th><th scope="col" class="num">${t("差")}</th></tr></thead><tbody>
        <tr><th scope="row">${t("本金")}</th><td class="num">${mny(v.principal, cur)}</td><td class="num">${mny(res.expected.principal, cur)}</td><td class="num">${mny(res.diff.principal, cur)}</td></tr>
        <tr><th scope="row">${t("利息")}</th><td class="num">${mny(v.interest, cur)}</td><td class="num">${mny(res.expected.interest, cur)}</td><td class="num">${mny(res.diff.interest, cur)}</td></tr>
        ${res.diff.balance != null ? `<tr><th scope="row">${t("还款后余额")}</th><td class="num">${mny(v.balance, cur)}</td><td class="num">${mny(res.expected.balance, cur)}</td><td class="num">${mny(res.diff.balance, cur)}</td></tr>` : ""}
        </tbody></table></div>` : ""}
      ${res.impliedAfter != null ? `<p class="muted dd-note">${t("由利息倒推：期初余额约 {a}，还款后约 {b}（四舍五入误差 ± 几毛）", { a: mny(res.impliedBefore, cur), b: mny(res.impliedAfter, cur) })}</p>` : ""}
      ${res.hints.length ? `<ul class="dd-hints">${res.hints.map((h) => `<li>${esc(hint(h))}</li>`).join("")}</ul>` : ""}
      <div class="form-actions">${debt060() ? `<button type="button" class="btn btn-sm" data-debt="calib-save" data-id="${esc(e.id)}">${t("存成校准（本息 = {a}）", { a: mny(res.pi, cur) })}</button>` : ""}
        ${!res.ok ? `<button type="button" class="btn btn-sm btn-ghost" data-debt="calib-anchor" data-id="${esc(e.id)}">${t("作为记录起点（{d} 余额 {a}）", { d: fmtDate(v.date), a: mny(v.balance !== "" && v.balance != null ? v.balance : res.impliedAfter, cur) })}</button>` : ""}</div>
    </div>` : "";
  return `<form data-debt-form="calib" data-id="${esc(e.id)}" class="form-grid">
      <label>${t("对账单这一期的还款日")}<input type="date" name="date" required value="${esc(v.date || "")}"></label>
      <label>${t("本金")}<input type="number" name="principal" inputmode="decimal" step="0.01" min="0" required value="${esc(v.principal ?? "")}"></label>
      <label>${t("利息")}<input type="number" name="interest" inputmode="decimal" step="0.01" min="0" required value="${esc(v.interest ?? "")}"></label>
      <label>${t("还款后余额（可不填）")}<input type="number" name="balance" inputmode="decimal" step="0.01" min="0" value="${esc(v.balance ?? "")}"></label>
      <div class="form-actions" style="grid-column:1/-1"><button class="btn btn-sm btn-primary">${t("核对")}</button>${e.statement_check ? `<button type="button" class="btn btn-sm btn-ghost" data-debt="calib-clear" data-id="${esc(e.id)}">${t("取消校准")}</button>` : ""}</div>
    </form>${out}
    ${e.statement_check ? `<p class="muted dd-note">${t("已校准：{d} 本金 {p} + 利息 {i}", { d: fmtDate(sc.date), p: mny(sc.principal, cur), i: mny(sc.interest, cur) })}</p>` : ""}`;
}

function recordForm(e) {
  const personal = isPersonalDebt(e), recv = e.direction === "receivable";
  const kinds = personal ? [["repay", recv ? t("对方还我") : t("我还对方")], ["lend", recv ? t("又借出") : t("又借入")]] : [["extra", t("额外还本金")]];
  const accts = (state.cards || []).filter((c) => c.active !== false);
  return `<form data-debt-form="txn" data-id="${esc(e.id)}" class="form-grid">
    <label>${t("类型")}<select name="kind">${kinds.map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join("")}</select></label>
    <label>${t("日期")}<input type="date" name="date" value="${todayISO()}" required></label>
    <label>${t("本金")}<input type="number" name="principal" inputmode="decimal" step="0.01" min="0" value="${personal && e.balance > 0 ? e.balance : ""}"></label>
    ${personal ? `<label>${recv ? t("利息（收到的）") : t("利息（付的）")}<input type="number" name="interest" inputmode="decimal" step="0.01" min="0"></label>` : ""}
    <label>${t("账户")}<select name="acct"><option value="">${t("不指定")}</option>${accts.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}${c.last4 ? ` ··${esc(c.last4)}` : ""}</option>`).join("")}</select></label>
    <label>${t("备注")}<input name="notes" maxlength="200"></label>
    <label class="check-inline" style="grid-column:1/-1"><input type="checkbox" name="cash" checked><span>${personal ? (recv ? t("同时记一笔收入（收回本金不算收入，利息算投资收益）") : t("同时记一笔花费（还本金不算消费）")) : t("同时记一笔花费（性质：融资 / 还本）")}</span></label>
    <small class="muted" style="grid-column:1/-1">${personal ? t("如果这笔钱已经从对账单导入了，取消勾选，只记借贷流水。") : t("和月供一起付的额外本金：在上面的表里标在那一期上，不用在这里另记。")}</small>
    <div class="form-actions"><button class="btn btn-sm btn-primary">${t("记一笔")}</button></div></form>`;
}
/** 迁移按名字猜的车辆：请用户确认 */
const proposalHtml = (e) => (e.asset_id && e.link_confirmed === false ? `<p class="notice" role="status">${t("迁移时按名字猜这笔车贷对应「{v}」。对吗？", { v: e.asset ? assetName(e.asset) : "?" })}
      <button type="button" class="btn btn-sm btn-primary" data-debt="link-confirm" data-id="${esc(e.id)}">${t("对，确认")}</button> <button type="button" class="btn btn-sm btn-ghost" data-debt="link-clear" data-id="${esc(e.id)}">${t("不对，解除")}</button></p>` : "");
function linkPanel(e) {
  const bills = state.billsEnriched.filter((b) => isLoanBillCat(b.category) && b.direction !== "receivable" && (!b.debt_id || b.debt_id === e.id));
  const target = debtCat(e.category).target;
  const props = state.properties.filter((p) => !p.archived || p.id === e.property_id), vs = vehicles().filter((a) => window.VEHICLES.isActive(a) || a.id === e.asset_id);
  return `<form data-debt-form="link" data-id="${esc(e.id)}" class="form-grid">
    <label>${t("还款账单")}<select name="bill"><option value="">${t("不关联")}</option>${bills.map((b) => `<option value="${esc(b.id)}" ${b.debt_id === e.id ? "selected" : ""}>${esc(b.name)}${b.est != null ? ` · ${esc(mny(b.est, b.currency))}` : ""}</option>`).join("")}</select></label>
    ${target !== "vehicle" ? `<label>${t("房产")}<select name="property_id"><option value="">${t("不关联")}</option>${props.map((p) => `<option value="${esc(p.id)}" ${p.id === e.property_id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>` : ""}
    ${target !== "property" ? `<label>${t("车辆")}<select name="asset_id"><option value="">${t("不关联")}</option>${vs.map((a) => `<option value="${esc(a.id)}" ${a.id === e.asset_id ? "selected" : ""}>${esc(assetName(a))}</option>`).join("")}</select></label>` : ""}
    <div class="form-actions" style="grid-column:1/-1"><button class="btn btn-sm">${t("保存关联")}</button></div></form>`;
}
const fold = (title, sub, body, { open = false, id = "" } = {}) => `<details class="panel ref-panel dd-fold"${id ? ` id="${id}"` : ""} ${open ? "open" : ""}><summary><b>${title}</b>${sub ? `<small>${sub}</small>` : ""}<span class="mch" aria-hidden="true">›</span></summary><div class="dd-fold-body">${body}</div></details>`;

/** 详情头部：名称、类型 / 状态、对方 · 资产 · 账单、编辑 */
function headHtml(e) {
  const personal = isPersonalDebt(e), who = personal ? e.counterparty_name || e.name : e.name;
  const sub = personal ? [esc(t(DIRECTIONS[e.direction].name)), e.person_id ? esc((state.people || []).find((p) => p.id === e.person_id)?.name || "") : null]
    : [e.counterparty_name ? esc(e.counterparty_name) : null, linkedText(e) || null, e.bill ? `<a href="${esc(href("bill", e.bill.id))}">🧾 ${esc(e.bill.name)}</a>` : null];
  return `<header class="dd-head">
    <div class="dd-title"><h2>${esc(who)}</h2><span class="dd-badges">${personal ? "" : catBadge(e)}${statusBadge(e)}</span></div>
    <p class="dd-sub">${sub.filter(Boolean).join(`<span aria-hidden="true"> · </span>`)}</p>
    <a class="btn btn-sm btn-ghost dd-edit-btn" href="${esc(debtHref(e.id, "&edit=1"))}">${t("编辑")}<span class="sr-only"> ${esc(who)}</span></a>
  </header>`;
}

function personalDetail(e) {
  const recv = e.direction === "receivable", paidPct = e.original > 0 && e.balance != null ? Math.round(((e.original - e.balance) / e.original) * 100) : null, c = e.currency;
  const n = e.txns.length, open = ui().recOpen === e.id;
  return `<section class="section debt-detail">${headHtml(e)}
    <div class="kpis dd-kpis">
      ${kpi(recv ? t("对方还欠") : t("我还欠"), mny(e.balance, c), paidPct != null ? t("已还 {p}%", { p: paidPct }) : "")}
      ${kpi(t("金额"), mny(e.original, c), e.start_date ? esc(fmtDate(e.start_date)) : "")}
      ${kpi(t("到期"), e.maturity_date ? esc(fmtDate(e.maturity_date)) : "—", e.maturity_date && !isClosedStatus(e.status) ? `<span class="${e.overdue ? "dd-warn" : ""}">${esc(daysText(e.maturity_date))}</span>` : t("没约定"))}
      ${kpi(recv ? t("收到的利息") : t("付的利息"), e.paid.interest ? mny(e.paid.interest, c) : "—")}
    </div>
    ${e.notes ? `<p class="muted dd-notes">${esc(e.notes)}</p>` : ""}
    <div class="section-head dd-sec"><h2>${t("还款记录")}</h2><div class="head-acts"><small class="muted">${t("{n} 条", { n })}</small>
      <button type="button" class="btn btn-sm ${open ? "btn-ghost" : "btn-primary"}" data-debt="rec-open" data-id="${esc(e.id)}" aria-expanded="${open}" aria-controls="dd-rec-form">${open ? t("收起") : `＋ ${t("记一笔还款")}`}</button></div></div>
    ${open ? `<div class="panel dd-rec-form" id="dd-rec-form">${recordForm(e)}</div>` : ""}
    <div class="panel">${recordsList(`p-${e.id}`, { txns: () => e.txns, empty: t("还没有记录") })}</div>
    <p class="dd-foot"><button type="button" class="btn btn-sm btn-ghost" data-debt="delete" data-id="${esc(e.id)}">${t("删除这笔借贷")}</button></p>
  </section>`;
}

function detail(id) {
  const d = debtById(id);
  if (!d) return `<section class="section"><div class="panel empty"><strong>${t("找不到这笔借贷")}</strong><p><a class="btn btn-primary" href="${esc(href("bills", "debts"))}">${t("回到借贷")}</a></p></div></section>`;
  if (state.route.q.get("edit")) return `<section class="section">${debtForm(d)}</section>`;
  const e = enrichDebt(d), c = e.currency;
  if (isPersonalDebt(e)) return personalDetail(e);
  if (ui().ptRoute !== state.route) { ui().ptRoute = state.route; ui().pt = null; ui().editPay = null; }   // 每次打开详情都重新读逐期表（缴费可能在账单页改过）
  const pay = periodPay(e);
  return `<section class="section debt-detail">${headHtml(e)}
    <div class="kpis dd-kpis">
      ${kpi(t("未还本金"), e.balance != null ? mny(e.balance, c) : "—", e.original > 0 && e.balance != null ? t("已还 {p}%", { p: Math.round(((e.original - e.balance) / e.original) * 100) }) : "")}
      ${kpi(t("每期还款"), pay != null ? mny(pay, c) : "—", e.pi != null ? `${t("本息 {a}", { a: mny(e.pi, c) })}${e.escrow ? ` + Escrow ${mny(e.escrow, c)}` : ""}` : "")}
      ${kpi(t("利率 / 期限"), `${pct(e.interest_rate)}`, e.term_months ? t("{n} 个月", { n: e.term_months }) : "")}
      ${kpi(t("下次还款"), e.nextDue ? esc(fmtDate(e.nextDue)) : "—", e.nextDue ? `<span class="${e.overdue ? "dd-warn" : ""}">${esc(daysText(e.nextDue))}</span>` : e.bill ? t("账单没填到期日") : t("没挂账单"))}
    </div>
    ${proposalHtml(e)}
    <div class="dd-grid">
      <div class="panel dd-card"><h3>${t("下一期构成")}</h3>${breakdownHtml(e)}</div>
      <div class="panel dd-card"><h3>${t("贷款条款")}</h3>${termsHtml(e)}${e.notes ? `<p class="muted dd-notes">${esc(e.notes)}</p>` : ""}</div>
    </div>
    <div class="section-head dd-sec"><h2>${t("每期还款拆分")}</h2>${e.bill && e.split ? `<div class="dd-resplit"><label class="check-inline"><input type="checkbox" data-debt-overwrite ${ui().overwrite ? "checked" : ""}><span>${t("覆盖手动改过的")}</span></label><button type="button" class="btn btn-sm" data-debt="resplit" data-id="${esc(e.id)}">${t("按摊还表重新拆分")}</button></div>` : ""}</div>
    <div class="panel">${payTableHtml(e)}</div>
    <p class="hint">${t("本息只按摊还表算（第 k 期 = 第一期还款日往后 k−1 个月，早几天晚几天交都对到那一期）；Escrow = 实付 − 本息 − 额外本金。本金记成「融资 / 还本」（不算消费），利息{e}算消费。", { e: e.escrow ? t("和 Escrow（房产税、保险）") : "" })}</p>
    ${otherTxnsHtml(e)}
    ${fold(t("摊还表"), t("按原始本金、利率、期限算"), amortHtml(e))}
    ${fold(t("用对账单校准"), t("核对第几期、本金和利息是否逐分一致"), calibrateHtml(e), { open: ui().calib?.id === e.id })}
    ${fold(t("额外还本金"), t("不和月供一起付的"), recordForm(e))}
    ${fold(t("关联账单和资产"), "", linkPanel(e), { open: !e.bill })}
    <p class="dd-foot"><button type="button" class="btn btn-sm btn-ghost" data-debt="delete" data-id="${esc(e.id)}">${t("删除这笔借贷")}</button></p>
  </section>`;
}
/** 不挂缴费的流水（额外还本、放款、调整） */
function otherTxnsHtml(e) {
  const others = () => txnsOf0(e.id).filter((x) => !x.bill_payment_id);
  return others().length ? `<div class="section-head dd-sec"><h2>${t("其他流水")}</h2></div><div class="panel">${recordsList(`o-${e.id}`, { txns: others })}</div>` : "";
}

/* ───────────── 新建 / 编辑 ───────────── */
/** 银行的 Escrow 计划：每行 从哪个月起 + 每期金额（已有的几行 + 两行空的） */
function escrowFields(v, personal) {
  const rows = [...(v.escrow_schedule || []), { from: "", amount: "" }, { from: "", amount: "" }];
  return `<fieldset class="dd-escrow" data-debt-asset ${personal ? "hidden" : ""} style="grid-column:1/-1"><legend>${t("Escrow 计划（银行每期收的 Escrow，可选）")}</legend>
    ${rows.map((r, i) => `<div class="dd-escrow-row"><label>${t("从哪个月起")}<input type="month" name="escrow_from" value="${esc(r.from || "")}" aria-label="${esc(t("第 {n} 行：从哪个月起", { n: i + 1 }))}"></label><label>${t("每期金额")}<input type="number" name="escrow_amount" inputmode="decimal" min="0" step="0.01" value="${esc(r.amount ?? "")}" aria-label="${esc(t("第 {n} 行：每期金额", { n: i + 1 }))}"></label></div>`).join("")}
    <small class="muted">${t("只用来提示多付的部分（可标成额外本金）；本金 / 利息只按摊还表算。清空一行就是删掉。")}</small></fieldset>`;
}
function debtForm(d) {
  const q = state.route.q, bill = q.get("bill") ? state.billsEnriched.find((b) => b.id === q.get("bill")) : null;
  const catQ = q.get("cat") || (bill ? debtCatOfBill(bill.category) : null);
  const v = d || { category: catQ && DEBT_CATS[catQ] ? catQ : "mortgage", direction: q.get("dir") === "receivable" ? "receivable" : "payable", name: bill?.name || q.get("name") || "",
    counterparty_name: q.get("lender") || bill?.payee || "", original_principal: q.get("principal") || "", property_id: q.get("prop") || bill?.property_id || "", asset_id: q.get("asset") || "",
    start_date: q.get("start") || "", scheduled_payment: bill?.est ?? "", payment_frequency: bill ? freqOfBill(bill) : catQ === "personal_lending" ? "none" : "monthly", status: "active", secured: catQ ? debtCat(catQ).secured : true };
  const val = (k) => esc(v[k] ?? ""), personal = v.category === "personal_lending";
  const opt = (obj, sel) => Object.entries(obj).map(([k, x]) => `<option value="${k}" ${k === sel ? "selected" : ""}>${esc(t(typeof x === "string" ? x : x.name))}</option>`).join("");
  const loanAccts = (state.cards || []).filter((c) => c.kind === "loan"), has060 = debt060();
  return `<form data-debt-form="debt" class="panel" novalidate>${d ? `<input type="hidden" name="id" value="${esc(d.id)}">` : ""}${bill ? `<input type="hidden" name="bill" value="${esc(bill.id)}">` : ""}
    ${bill ? `<p class="muted" style="margin:0 0 10px">${t("从账单「{n}」建贷款：账单继续管提醒和缴费，贷款记本金、利率和拆分。", { n: bill.name })}</p>` : ""}
    <div class="form-grid">
      <label>${t("类型")}<select name="category" data-debt-cat>${opt(DEBT_CATS, v.category)}</select></label>
      <label>${t("名称")}<input name="name" maxlength="60" required value="${val("name")}" placeholder="${esc(t("例如 房贷 · Chase"))}"></label>
      <label data-debt-personal ${personal ? "" : "hidden"}>${t("方向")}<select name="direction">${opt(DIRECTIONS, v.direction)}</select></label>
      <label>${personal ? t("对方（人名）") : t("贷款方")}<input name="counterparty_name" maxlength="80" value="${val("counterparty_name")}"></label>
      <label>${t("家里哪一位")}<select name="person_id"><option value="">${t("全家 / 不指定")}</option>${(state.people || []).filter((p) => p.kind !== "pet").map((p) => `<option value="${esc(p.id)}" ${p.id === v.person_id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>
      <label>${personal ? t("金额") : t("原始本金")}<input name="original_principal" type="number" inputmode="decimal" min="0" step="0.01" value="${val("original_principal")}"></label>
      <label>${t("年利率 %")}<input name="interest_rate" type="number" inputmode="decimal" min="0" max="100" step="0.001" value="${val("interest_rate")}"></label>
      <label>${t("期限（月）")}<input name="term_months" type="number" inputmode="numeric" min="1" max="600" step="1" value="${val("term_months")}"></label>
      <label>${t("起始日（放款）")}<input name="start_date" type="date" value="${val("start_date")}"></label>
      ${has060 ? `<label data-debt-asset ${personal ? "hidden" : ""}>${t("第一期还款日")}<input name="first_payment_date" type="date" value="${val("first_payment_date")}" aria-describedby="dd-first-help"><small id="dd-first-help" class="muted">${t("对账单 / 还款计划上的第一期（例如 6 月放款、8/1 第一期）")}</small></label>` : ""}
      <label>${t("到期日")}<input name="maturity_date" type="date" value="${val("maturity_date")}"></label>
      <label>${t("还款频率")}<select name="payment_frequency">${opt(FREQS, v.payment_frequency)}</select></label>
      <label>${t("每期还款（含 Escrow）")}<input name="scheduled_payment" type="number" inputmode="decimal" min="0" step="0.01" value="${val("scheduled_payment")}"></label>
      ${has060 ? escrowFields(v, personal) : ""}
      <label>${t("某天的未还本金")}<input name="opening_balance" type="number" inputmode="decimal" min="0" step="0.01" value="${val("opening_balance")}"></label>
      <label>${t("那一天")}<input name="opening_balance_on" type="date" value="${val("opening_balance_on")}"></label>
      <label>${t("状态")}<select name="status">${opt(STATUSES, v.status)}</select></label>
      ${loanAccts.length ? `<label>${t("卡与账户里的贷款账户")}<select name="lender_card_id"><option value="">${t("不关联")}</option>${loanAccts.map((c) => `<option value="${esc(c.id)}" ${c.id === v.lender_card_id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label>` : ""}
      <label data-debt-asset ${personal ? "hidden" : ""}>${t("房产")}<select name="property_id"><option value="">${t("不关联")}</option>${state.properties.filter((p) => !p.archived || p.id === v.property_id).map((p) => `<option value="${esc(p.id)}" ${p.id === v.property_id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>
      <label data-debt-asset ${personal ? "hidden" : ""}>${t("车辆 / 资产")}<select name="asset_id"><option value="">${t("不关联")}</option>${vehicles().map((a) => `<option value="${esc(a.id)}" ${a.id === v.asset_id ? "selected" : ""}>${esc(assetName(a))}</option>`).join("")}</select></label>
      <label data-debt-asset ${personal ? "hidden" : ""}>${t("融资关系")}<select name="financing_role"><option value="">—</option>${opt(ROLES, v.financing_role || debtCat(v.category).role || "")}</select></label>
      <label class="check-inline" data-debt-asset ${personal ? "hidden" : ""}><input type="checkbox" name="secured" ${v.secured ? "checked" : ""}><span>${t("以这处资产抵押")}</span></label>
      <label style="grid-column:1/-1">${t("备注")}<textarea name="notes" maxlength="1000" rows="2">${val("notes")}</textarea></label>
    </div>
    ${has060 ? "" : `<p class="notice" role="status">${t("执行 supabase/migrations/060_debt_schedule.sql 后可以填第一期还款日、Escrow 计划和对账单校准。")}</p>`}
    <p class="muted" style="font-size:13px">${t("房贷按对账单拆分要填：原始本金、年利率、期限、第一期还款日；Escrow 计划可选（每年 Escrow 分析后加一行）。")}</p>
    <p class="muted" style="font-size:13px">${t("中途开始记的贷款：填「某天的未还本金」和那一天（看对账单），不用填原始本金；之前的还款会按利率倒推拆分。")}</p>
    <p class="form-error" role="alert" data-debt-err></p>
    <div class="form-actions"><button class="btn btn-primary">${d ? t("保存") : t("添加")}</button><a class="btn btn-ghost" href="${esc(d ? debtHref(d.id) : href("bills", "debts"))}">${t("取消")}</a></div></form>`;
}

export function viewDebts() {
  const q = state.route.q;
  if (!state.debtsOk) return `<section class="section"><div class="panel empty"><strong>${t("借贷还不能用")}</strong>${Store.mode === "cloud" ? t("数据库还没升级：请先执行 supabase/migrations/058_debt_lending.sql") : esc(state.debtsErr || "")}</div></section>`;
  if (q.get("new")) return `<section class="section">${debtForm(null)}</section>`;
  if (q.get("id")) return detail(q.get("id"));
  // 旧的「借贷总览」网址：?view=summary&seg=… 就是对应的标签
  const seg = q.get("view") === "summary" ? (SEGS.some(([k]) => k === q.get("seg")) ? q.get("seg") : "all") : null;
  const tab = seg || activeTab(state.route) || "all", all = debtsEnriched();
  if (tab === "txns" && q.get("link") && ui().linkQ !== state.route) { ui().linkQ = state.route; setRecordFilter("txns", { link: q.get("link") === "no" ? "no" : "yes" }); }   // 提醒「没关联花费 / 收入」点进来：直接筛好
  // 统计面板里点名字过来：下面的列表按名字（和方向）筛好，滚到列表（每次进来套一次，之后用户自己改筛选不受影响）
  if ((tab === "asset" || tab === "personal") && q.has("who") && ui().whoQ !== state.route) {
    ui().whoQ = state.route;
    const who = q.get("who") || "";
    if (tab === "asset") ui().af = { sort: af().sort, q: who };
    else ui().pf = { sort: pf().sort, q: who, dir: ["payable", "receivable"].includes(q.get("dir")) ? q.get("dir") : "all" };
    if (q.get("at") === "rec") requestAnimationFrame(() => { const el = document.getElementById("debt-recs"); if (el) { el.scrollIntoView({ block: "start" }); el.focus({ preventScroll: true }); } });
  }
  return `<section class="section debt-page">
    ${tabBar(DEBT_TABS, tab, tabHref, t("借贷内容"))}
    ${tabPage(tab, all)}
  </section>`;
}

/* ───────────── 动作 ───────────── */
const guard = async (fn) => { try { await fn(); } catch (e) { toast(t("操作失败：{msg}", { msg: e.message })); } };
const numOrNull = (v) => (v === "" || v == null ? null : Math.round(num(v) * 10000) / 10000);
const after = async () => { ui().pt = null; ui().editPay = null; ui().linkPay = null; ui().recEdit = null; await loadDebts(); hooks.render(false); };   // 逐期表重新读

async function saveDebtForm(f) {
  const fd = new FormData(f), g = (k) => String(fd.get(k) ?? "").trim(), err = f.querySelector("[data-debt-err]");
  const id = g("id") || null, old = id ? debtById(id) : null, cat = g("category");
  const row = { ...(old || {}), id, name: g("name"), category: cat, direction: cat === "personal_lending" ? g("direction") || "payable" : "payable", counterparty_name: g("counterparty_name") || null,
    person_id: g("person_id") || null, lender_card_id: g("lender_card_id") || null, original_principal: numOrNull(g("original_principal")), interest_rate: numOrNull(g("interest_rate")),
    term_months: g("term_months") ? Math.round(num(g("term_months"))) : null, start_date: g("start_date") || null, maturity_date: g("maturity_date") || null, payment_frequency: g("payment_frequency") || "monthly",
    scheduled_payment: numOrNull(g("scheduled_payment")), opening_balance: numOrNull(g("opening_balance")), opening_balance_on: g("opening_balance_on") || null, status: g("status") || "active",
    property_id: cat === "personal_lending" ? null : g("property_id") || null, asset_id: cat === "personal_lending" ? null : g("asset_id") || null, financing_role: g("financing_role") || null,
    secured: fd.get("secured") === "on", notes: g("notes") || null, currency: old?.currency || cur() };
  if (debt060()) {
    row.first_payment_date = cat === "personal_lending" ? null : g("first_payment_date") || null;
    const froms = fd.getAll("escrow_from").map(String), amts = fd.getAll("escrow_amount").map(String);
    const sched = new Map(); froms.forEach((m, i) => { if (/^\d{4}-\d{2}$/.test(m) && amts[i] !== "" && num(amts[i]) >= 0) sched.set(m, Math.round(num(amts[i]) * 100) / 100); });   // 同一个月填了两次：后面的为准
    row.escrow_schedule = cat === "personal_lending" ? [] : [...sched].sort((a, b) => a[0].localeCompare(b[0])).map(([from, amount]) => ({ from, amount }));
    row.statement_check = old?.statement_check || null;
    if (row.first_payment_date && row.start_date && row.first_payment_date < row.start_date) { err.textContent = t("第一期还款日不能早于起始日（放款）"); return; }
  }
  if (!row.name) { err.textContent = t("请填名称"); return; }
  if ((row.opening_balance == null) !== !row.opening_balance_on) { err.textContent = t("「某天的未还本金」和「那一天」要一起填"); return; }
  if (old && old.asset_id !== row.asset_id) row.link_confirmed = true;   // 用户自己选的车辆：算确认
  const btn = f.querySelector("button.btn-primary"); btn.disabled = true;
  try {
    const termsChanged = !old || ["original_principal", "interest_rate", "term_months", "start_date", "first_payment_date", "payment_frequency", "scheduled_payment", "opening_balance", "opening_balance_on"].some((k) => String(old[k] ?? "") !== String(row[k] ?? ""))
      || JSON.stringify(old?.escrow_schedule || []) !== JSON.stringify(row.escrow_schedule || old?.escrow_schedule || []);
    const newId = await Store.saveDebt(row);
    if (g("bill")) await Store.linkBillDebt(g("bill"), newId);
    await loadDebts(); if (g("bill")) await hooks.refresh();
    const d = debtById(newId);
    let n = 0;
    if (d && termsChanged) { if (canSplit(d)) n = await resplitDebt(d); else if (old) await unsplitDebt(d); }
    if (d) { await syncDebtStatus(d.id); await syncVehicle(debtById(d.id)); }
    toast(n ? t("已保存，拆分了 {n} 笔历史还款", { n }) : t("已保存"));
    go(debtHref(newId), { replace: true });
  } catch (e) { err.textContent = t("保存失败：{msg}", { msg: e.message }); btn.disabled = false; }
}

export function initDebts({ render, refresh }) {
  hooks = { render, refresh };
  initDebtSummary({ render });
  onClearFilters("debtP", () => { ui().pf = { sort: pf().sort }; render(false); });
  onClearFilters("debtA", () => { ui().af = { sort: af().sort }; render(false); });
  initRecords({ render, save: async (x, patch) => guard(async () => { await updateDebtTxn(x, patch); toast(t("已保存")); await after(); }) });
  const main = document.getElementById("main");
  main.addEventListener("change", (e) => {
    if (e.target.matches?.("[data-debt-overwrite]")) { ui().overwrite = e.target.checked; return; }
    // 列表筛选：个人借贷（data-debt-pf）/ 资产融资（data-debt-af）
    const fs = e.target.closest?.("select[data-debt-pf], select[data-debt-af]");
    if (fs) {
      const which = fs.dataset.debtPf != null ? "pf" : "af", k = fs.dataset.debtPf ?? fs.dataset.debtAf;
      ui()[which] = { ...(which === "pf" ? pf() : af()), [k]: fs.value }; render(false);
      requestAnimationFrame(() => document.querySelector(`[data-debt-${which}="${k}"]`)?.focus()); return;
    }
    const s = e.target.closest?.("[data-debt-cat]"); if (!s) return;
    const personal = s.value === "personal_lending", f = s.closest("form");
    f.querySelectorAll("[data-debt-personal]").forEach((x) => { x.hidden = !personal; });
    f.querySelectorAll("[data-debt-asset]").forEach((x) => { x.hidden = personal; });
    if (f.elements.secured && !f.elements.id) f.elements.secured.checked = debtCat(s.value).secured;
    if (f.elements.financing_role && !f.elements.id) f.elements.financing_role.value = debtCat(s.value).role || "";
  });
  // 按人搜索：边打边筛（防抖），重画后焦点和光标留在搜索框
  let qTimer = 0;
  main.addEventListener("input", (e) => {
    const inp = e.target.closest?.('input[data-debt-pf="q"], input[data-debt-af="q"]'); if (!inp) return;
    const which = inp.dataset.debtPf != null ? "pf" : "af";
    clearTimeout(qTimer);
    qTimer = setTimeout(() => {
      ui()[which] = { ...(which === "pf" ? pf() : af()), q: inp.value }; const at = inp.selectionStart; render(false);
      const n = document.querySelector(`input[data-debt-${which}="q"]`);
      if (n) { n.focus(); try { n.setSelectionRange(at, at); } catch { /* 不支持选区的输入框：忽略 */ } }
    }, 250);
  });
  main.addEventListener("click", (e) => {
    const b = e.target.closest?.("[data-debt]"); if (!b) return;
    const act = b.dataset.debt, id = b.dataset.id, d = id ? debtById(id) : null;
    if (act === "tx-more") { ui().txLimit = (ui().txLimit || 50) + 50; return render(false); }
    if (act === "rec-open") { ui().recOpen = ui().recOpen === id ? null : id; render(false); requestAnimationFrame(() => document.querySelector(ui().recOpen ? "#dd-rec-form select, #dd-rec-form input" : `[data-debt="rec-open"]`)?.focus()); return; }
    if (act === "pay-link") { ui().linkPay = b.dataset.pay && ui().linkPay !== b.dataset.pay ? b.dataset.pay : null; ui().payCand = null; ui().editPay = null; b.closest("details")?.removeAttribute("open"); render(false); if (ui().linkPay) requestAnimationFrame(() => { const f = document.getElementById("dd-link"); f?.scrollIntoView({ block: "nearest" }); f?.querySelector("select, button")?.focus({ preventScroll: true }); }); return; }
    if (act === "pay-cand-refresh") { ui().payFresh = b.dataset.pay; ui().payCand = null; render(false); return; }   // ↻：重新读前后几天的花费再找
    if (act === "pay-del" && d) { if (!confirmDelete(t("删除这条缴费记录？"))) return; return guard(async () => { const back = await deleteBillPay(b.dataset.pay); await hooks.refresh(); toast(back ? t("已删除这条记录，到期日回到 {d}", { d: fmtDate(back) }) : t("已删除这条记录")); await after(); }); }
    if (act === "amort-all") { ui().amortAll = ui().amortAll === id ? null : id; return render(false); }
    if (act === "resplit" && d) return guard(async () => { b.disabled = true; const n = await resplitDebt(d, { overwrite: !!ui().overwrite }); toast(t("已按摊还表拆分 {n} 笔还款", { n })); await after(); });
    if (act === "pay-edit") { ui().linkPay = null; ui().editPay = b.dataset.pay && ui().editPay !== b.dataset.pay ? b.dataset.pay : null; render(false); if (ui().editPay) requestAnimationFrame(() => document.querySelector("#dd-edit input")?.focus()); return; }
    if (act === "mark-extra" && d) return guard(async () => { b.disabled = true; await setExtraPrincipal(d, b.dataset.pay, num(b.dataset.amt)); toast(num(b.dataset.amt) > 0 ? t("已记为额外本金，后面各期重新计算") : t("已取消额外本金")); await after(); });
    if (act === "calib-clear" && d) return guard(async () => { await Store.saveDebt({ ...d, statement_check: null }); ui().calib = null; await loadDebts(); await resplitDebt(debtById(id), { onlyChanged: true }); toast(t("已取消校准")); await after(); });
    if ((act === "calib-save" || act === "calib-anchor") && d && ui().calib?.id === id) return guard(async () => {
      const { input: v, res } = ui().calib, sc = { date: v.date, principal: num(v.principal), interest: num(v.interest), balance: v.balance === "" ? null : num(v.balance) };
      const patch = { ...d, ...(debt060() ? { statement_check: sc } : {}) };
      if (act === "calib-anchor") { patch.opening_balance = sc.balance ?? res.impliedAfter; patch.opening_balance_on = v.date; }
      await Store.saveDebt(patch); ui().calib = null; await loadDebts();
      const n = canSplit(debtById(id)) ? await resplitDebt(debtById(id), { onlyChanged: true }) : 0;
      toast(n ? t("已保存，重新拆分了 {n} 笔", { n }) : t("已保存")); await after();
    });
    if (act === "override-clear" && d) return guard(async () => { await clearOverride(d, b.dataset.pay); toast(t("已改回按摊还表")); await after(); });
    if (act === "link-confirm" && d) return guard(async () => { await Store.saveDebt({ ...d, link_confirmed: true }); await loadDebts(); await syncVehicle(debtById(id)); toast(t("已确认")); await after(); });
    if (act === "link-clear" && d) return guard(async () => { await Store.saveDebt({ ...d, asset_id: null, link_confirmed: true }); toast(t("已解除关联")); await after(); });
    if (act === "txn-del") {
      if (!confirmDelete(t("删除这条借贷记录？"))) return;
      const cashBox = b.closest("form")?.elements?.cash, cash = cashBox ? cashBox.checked : true;   // 编辑表单里可以只删流水、留下关联的花费 / 收入
      return guard(async () => { await deleteDebtTxn(id, { cash }); ui().recEdit = null; await loadIncome(); toast(t("已删除")); await after(); });
    }
    if (act === "delete" && d) {
      if (!confirmDelete(t("删除这笔借贷？关联的花费、收入、账单都会保留。"))) return;
      return guard(async () => { const bill = billOfDebt(d); if (bill) await unsplitDebt(d, bill); await Store.deleteDebt(id); await loadDebts(); await hooks.refresh(); toast(t("已删除")); go(href("bills", "debts"), { replace: true }); });
    }
  });
  main.addEventListener("submit", (e) => {
    const f = e.target.closest?.("[data-debt-form]"); if (!f) return;
    e.preventDefault(); e.stopPropagation();
    const kind = f.dataset.debtForm, d = f.dataset.id ? debtById(f.dataset.id) : null, fd = new FormData(f), g = (k) => String(fd.get(k) ?? "").trim();
    if (kind === "debt") return saveDebtForm(f);
    if (kind === "pay-link" && d) return guard(async () => {
      const pid = g("purchase"); if (!pid) return toast(t("请选一笔花费"));
      f.querySelector("button.btn-primary").disabled = true;
      const ok = await relinkPaymentPurchase(d, f.dataset.pay, pid);
      ui().linkPay = null; ui().payCand = null; await hooks.refresh();
      toast(ok ? t("已关联，这笔缴费记在那笔花费上") : t("没有变化")); await after();
    });
    if (kind === "override" && d) return guard(async () => { await overrideSplit(d, f.dataset.pay, { principal: g("principal"), interest: g("interest"), escrow: g("escrow"), extra: g("extra") }); toast(t("已按对账单改")); await after(); });
    if (kind === "calib" && d) return guard(async () => {
      const input = { date: g("date"), principal: g("principal"), interest: g("interest"), balance: g("balance") };
      if (!input.date || input.principal === "" || input.interest === "") return toast(t("请填日期、本金和利息"));
      ui().calib = { id: d.id, input, res: await calibrateDebt(d, input) }; render(false);
    });
    if (kind === "txn" && d) return guard(async () => {
      const principal = num(g("principal")), interest = num(g("interest"));
      if (!(principal > 0) && !(interest > 0)) return toast(t("请填金额"));
      const acct = g("acct") || null, card = acct ? (state.cards || []).find((c) => c.id === acct) : null;
      const n = await recordDebtTxn(d, { kind: g("kind"), date: g("date") || todayISO(), principal, interest, cash: fd.get("cash") === "on", card_id: card && !["checking", "savings", "brokerage", "retirement", "hsa", "cash", "loan"].includes(card.kind) ? card.id : null, account_id: card?.id || null, notes: g("notes") || null });
      if (fd.get("cash") === "on") await loadIncome();
      if (n) ui().recOpen = null;   // 记好了：表单收起，留下还款记录
      toast(n ? t("已记录") : t("没有要记的金额")); await after();
    });
    if (kind === "link" && d) return guard(async () => {
      const billId = g("bill") || null, cur0 = billOfDebt(d);
      if (cur0 && cur0.id !== billId) { await unsplitDebt(d, cur0); await Store.linkBillDebt(cur0.id, null); }
      if (billId && (!cur0 || cur0.id !== billId)) await Store.linkBillDebt(billId, d.id);
      const patch = { ...d };
      if (f.elements.property_id) patch.property_id = g("property_id") || null;
      if (f.elements.asset_id) { patch.asset_id = g("asset_id") || null; if (patch.asset_id !== d.asset_id) patch.link_confirmed = true; }
      await Store.saveDebt(patch);
      await hooks.refresh(); await loadDebts();
      if (billId && (!cur0 || cur0.id !== billId) && canSplit(debtById(d.id))) await resplitDebt(debtById(d.id));
      await syncVehicle(debtById(d.id));
      toast(t("已保存关联")); await after();
    });
  });
}
