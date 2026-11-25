/* 借贷详情里的表：摊还表、余额拆分、条款、还款流水表、关联与覆盖表单。 */
import * as A from "../core/amortization.js";
import { ROLES } from "../core/debt-rules.js";
import { debtHref, splitMissing } from "./debt-logic.js";
import { esc, fmtDate, todayISO } from "../core/util.js";
import { href } from "../core/router.js";
import { linkCandidates, seenLine, takenGroup } from "./debt-records.js";
import { loadPayTable, overrideForm, savedListHtml } from "./debt-detail.js";
import { pageLimit, pageMoreBtn } from "../core/pager.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";
import { hooks, mny, pct, ui } from "./debt-common.js";

/* ───────────── 详情 ─────────────
 * 布局（笔记本两栏、手机一栏，390px 不横向滚动）：头部（名称、类型、状态、贷款方 · 资产 · 账单、编辑）→ KPI 一行 →
 * 「下一期构成」（本金 / 利息 / Escrow 条）+「贷款条款」（标签 / 数值对齐的网格）→ 每期还款拆分表（宽表在可聚焦的滚动区里，手机变成卡片）→
 * 摊还表 / 额外还本 / 对账单校准 / 关联（折叠）。金额一律 tabular-nums、右对齐。 */
const dl = (rows) => `<dl class="dd-dl">${rows.filter(Boolean).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join("")}</dl>`;
export const kpi = (label, value, sub = "") => `<div class="kpi"><span>${esc(label)}</span><b>${value}</b>${sub ? `<small>${sub}</small>` : ""}</div>`;
export const daysText = (iso) => { const n = Math.round((new Date(`${iso}T12:00:00`) - new Date(`${todayISO()}T12:00:00`)) / 86400000); return n === 0 ? t("今天") : n > 0 ? t("{d} 天后", { d: n }) : t("逾期 {d} 天", { d: -n }); };
export function amortHtml(e) {
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
    ${rows.length > 24 ? `<p><button type="button" class="ui-btn" data-size="sm" data-tone="ghost" data-debt="amort-all" data-id="${esc(e.id)}" aria-expanded="${all}">${all ? t("只看最近 24 期") : t("显示全部 {n} 期", { n: rows.length })}</button></p>` : ""}`;
}
/** 下一期的构成：本金 / 利息（按当前余额和本息）+ Escrow（银行计划；没填用 Escrow 账单估算）；条形图 + 数字，Escrow 账单只做参考 */
export function breakdownHtml(e) {
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
export function termsHtml(e) {
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
export function payTableHtml(e) {
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
  const more = (r) => `<details class="act-more"><summary class="ui-btn" data-size="sm" data-tone="ghost" aria-label="${esc(t("更多操作：{d}", { d: fmtDate(r.paid_on) }))}" title="${esc(t("更多操作"))}"><span class="dots3" aria-hidden="true"></span></summary><div class="act-menu">
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
      <td class="dd-act">${diff ? `<button type="button" class="ui-btn" data-size="sm" data-tone="ghost" data-debt="mark-extra" data-id="${esc(e.id)}" data-pay="${esc(r.id)}" data-amt="${diff}">${t("多 {a} 记为额外本金", { a: mny(diff, c) })}</button>` : ""}
        ${r.extra > 0 && r.source === "schedule" ? `<button type="button" class="ui-btn" data-size="sm" data-tone="ghost" data-debt="mark-extra" data-id="${esc(e.id)}" data-pay="${esc(r.id)}" data-amt="0">${t("取消额外本金")}</button>` : ""}
        <button type="button" class="ui-btn" data-size="sm" data-tone="ghost" data-debt="pay-edit" data-pay="${esc(r.id)}" aria-expanded="${edit?.id === r.id}" aria-controls="dd-edit">${t("按对账单改")}<span class="sr-only"> ${esc(fmtDate(r.paid_on))}</span></button>
        ${r.source === "manual" ? `<button type="button" class="ui-btn" data-size="sm" data-tone="ghost" data-debt="override-clear" data-id="${esc(e.id)}" data-pay="${esc(r.id)}">${t("按摊还表")}<span class="sr-only"> ${esc(fmtDate(r.paid_on))}</span></button>` : ""}
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
      <button type="button" class="ui-btn dr-refresh" data-size="sm" data-tone="ghost" data-debt="pay-cand-refresh" data-pay="${esc(r.id)}" ${cand ? "" : "disabled"} aria-label="${esc(t("重新查找相近的花费和收入"))}" title="${esc(t("重新查找相近的花费和收入（刚导入或刚记了一笔时用）"))}"><span aria-hidden="true">↻</span></button></div>${cand ? seenLine(cand, "p:") : ""}
    <p class="muted dd-note">${t("★ = 日期和金额相近。关联后这笔缴费就记在那笔花费上（原来自动记的那笔删掉），花费会改成利息 + Escrow 部分，本金另记一行——同一笔钱不重复计算。")}</p>
    <div class="form-actions"><button class="ui-btn" data-size="sm" data-tone="primary" ${cand?.list.length ? "" : "disabled"}>${t("关联")}</button><button type="button" class="ui-btn" data-size="sm" data-tone="ghost" data-debt="pay-link" data-pay="">${t("取消")}</button></div>
  </form>`;
}
