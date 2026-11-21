import { state } from "../core/state.js";
import { esc, fmtDate, num, todayISO } from "../core/util.js";
import { href } from "../core/router.js";
import { t } from "../core/i18n.js";
import { addDays } from "./dates.js";
import { infoTip } from "../core/info-tip.js";
import { viewSwitch } from "../core/view-switch.js";
import { fabHtml } from "./bill-fab.js";
import { eyeFilter } from "../core/filter-pop.js";
import { billTrendSection } from "./views.js";
import { detailHref } from "./medical.js";
import { BILL_RANGES, STATUS_GROUPS, assetBreakdown, billInstances, cycleBreakdown, filterRows, monthBounds, monthlySeries, nextDue, rangeBounds, seriesMonths, sortRows, summarize } from "./instances.js";
import { allBillsHref, assetKeyLabel, assetOptions, rowHtml } from "./all-views.js";
import { assetBillsHref } from "./all-href.js";

const cur = () => Units.region.currency;
const mny = (v) => Units.money(num(v), cur());
/** 要处理：逾期、今天 / 7 天内到期（soon 已含今天）、待核对的自动扣款 */
const isUrgent = (r) => ["overdue", "soon", "verify"].some((k) => STATUS_GROUPS[k](r));
function compute() {
  const f = state.ovFilter, today = todayISO(), { from, to } = rangeBounds(f.range, today), data = { recurring: state.billsEnriched, onetime: state.medEnriched };
  const base = billInstances(data, { from, to, today });
  const rows = filterRows(base.rows, { asset: f.asset });
  const S = summarize(rows, { cur: cur(), today });
  // 下一笔：今天起最近一笔没缴的，不受范围限制（往后看 120 天）
  const ahead = filterRows(billInstances(data, { from: today, to: addDays(today, 120), today }).rows, { asset: f.asset });
  const next = nextDue(ahead, { today, cur: cur() });
  // 走势：前 5 个月 + 本月 + 后 2 个月（跟着资产筛选走，不跟着时间范围走）
  const months = seriesMonths(today, 5, 2), mb = { from: monthBounds(months[0]).from, to: monthBounds(months.at(-1)).to };
  const series = monthlySeries(filterRows(billInstances(data, { ...mb, today }).rows, { asset: f.asset }), months, { cur: cur() });
  const urgentAll = rows.filter(isUrgent), urgent = sortRows(urgentAll, "due").slice(0, 6);
  return { today, from, to, base, rows, S, next, series, urgent, urgentN: urgentAll.length, byAsset: assetBreakdown(rows, { cur: cur() }), byCycle: cycleBreakdown(rows, { cur: cur() }) };   // 按资产：跟着上面选的资产走（选了某个资产就只剩它）
}
/** 一张卡：整张是一个链接；颜色类 bc-<种类>（--bill-* 变量，浅色 / 深色各一套） */
function card(kind, icon, label, value, sub, link, aria, extra = "", tip = "") {
  const a = `<a class="bill-card bc-${kind} ${extra}" href="${esc(link)}" aria-label="${esc(aria)}"><span class="bc-head"><span class="bc-ico" aria-hidden="true">${icon}</span><span class="bc-label">${label}</span></span><b class="bc-val">${value}</b><small class="bc-sub">${sub}</small></a>`;
  // ⓘ 不能放进 <a> 里（点它会跳转）：和卡片并排放进一个外框，用绝对定位叠在右上角
  return tip ? `<div class="bc-wrap ${extra}">${a}<span class="bc-tip">${tip}</span></div>` : a;
}
function cardsHtml(C) {
  const { S, next } = C, f = state.ovFilter, q = { range: f.range, asset: f.asset }, link = (extra = {}) => allBillsHref({ ...q, ...extra });
  const cnt = (k) => `${k} ${t("笔账单")}`;
  const total = card("total", "💲", t("全部账单"), mny(S.total.amount), cnt(S.total.n), link(), `${t("全部账单")}，${cnt(S.total.n)}，${mny(S.total.amount)}`, "bc-wide", infoTip(totalNotes(C), { align: "end", pos: "bottom" }));
  const overdue = card("overdue", "⚠️", t("逾期"), mny(S.overdue.amount), S.overdue.n ? cnt(S.overdue.n) : t("没有逾期 ✓"), allBillsHref({ asset: f.asset, status: "overdue" }), `${t("逾期")}，${cnt(S.overdue.n)}，${mny(S.overdue.amount)}`);
  const paid = card("paid", "✅", t("已缴"), mny(S.paid.amount), `${cnt(S.paid.n)}${S.partial.n ? ` · ${t("另有 {n} 笔部分已付", { n: S.partial.n })}` : ""}`, link({ status: "paid" }), `${t("已缴")}，${cnt(S.paid.n)}，${mny(S.paid.amount)}`);
  const days = next ? Math.round((new Date(`${next.dueOn}T12:00:00`) - new Date(`${C.today}T12:00:00`)) / 86400000) : null;
  const nextCard = next
    ? card("next", "📅", t("下一笔到期"), esc(fmtDate(next.dueOn)), `${esc(next.name)} · ${days === 0 ? t("今天") : t("{d} 天后", { d: days })} · ${mny(next.amount)}`, next.kind === "onetime" ? detailHref(next.billId) : href("bill", next.billId), `${t("下一笔到期")}，${fmtDate(next.dueOn)}，${next.name}`)
    : card("next", "📅", t("下一笔到期"), "—", t("接下来没有待缴的账单"), link({ status: "unpaid" }), t("下一笔到期：没有"));
  const soon = card("soon", "⏳", t("即将到期"), mny(S.soon.amount), `${S.soon.n ? cnt(S.soon.n) : t("7 天内没有")} · ${t("7 天内")}`, link({ status: "soon" }), `${t("即将到期")}，${cnt(S.soon.n)}，${mny(S.soon.amount)}`);
  const remain = card("remain", "📊", t("剩余待缴"), mny(S.remaining.amount), `${cnt(S.remaining.n)} · ${t("应付 − 已缴")}`, link({ status: "unpaid" }), `${t("剩余待缴")}，${cnt(S.remaining.n)}，${mny(S.remaining.amount)}`, "bc-wide-m", infoTip(estNote(S), { align: "end", pos: "bottom" }));
  return `<div class="bill-cards">${total}${overdue}${paid}${nextCard}${soon}${remain}</div>`;
}
const estNote = (S) => (S.estimatedN ? t("含估算 {n} 笔（水电燃气按最近均值估，记缴费时填实际金额就会更新）", { n: S.estimatedN }) : "");
/** 「全部账单」卡 ⓘ 里的口径说明：估算 / 金额未知 / Escrow / 其他币种 / 没展开的期 */
const totalNotes = (C) => { const { S } = C; return [estNote(S), S.unknownN ? t("{n} 笔金额未知按 0 算", { n: S.unknownN }) : "", S.escrow.n ? t("Escrow 代缴 {n} 笔 {a} 不计入上面的数字", { n: S.escrow.n, a: mny(S.escrow.amount) }) : "",
  S.otherCurrency ? t("另有 {n} 笔非 {c} 账单未计入", { n: S.otherCurrency, c: cur() }) : "", C.base.truncated ? t("另有 {n} 期太久远或太远没有展开", { n: C.base.truncated }) : ""]; };
function urgentHtml(C) {
  if (!C.urgent.length) return `<section class="section"><div class="panel empty"><strong>${t("最近没有要处理的账单 ✓")}</strong></div></section>`;
  const f = state.ovFilter, more = C.urgentN;
  return `<section class="section attn-sec ${C.urgent.some((r) => r.status === "overdue") ? "is-hot" : ""}"><div class="section-head"><h2>${t("要处理的账单")}<span class="badge attn-count b-out">${more}</span></h2><div class="head-acts"><a class="btn btn-sm btn-ghost" href="${allBillsHref({ range: f.range, asset: f.asset, status: "unpaid" })}">${t("看全部待缴")} ›</a></div></div>
    <div class="panel"><ul class="bill-list">${C.urgent.map(rowHtml).join("")}</ul></div></section>`;
}
/** 账单分组：默认按资产；切到「按周期」= 周期性（再按每月 / 每季度 / 每年细分）和一次性各一组，有金额才出现 */
function groupHtml(C) {
  const f = state.ovFilter, byCycle = f.group === "cycle", cyc = C.byCycle;
  if (!C.byAsset.length && !cyc.recurring && !cyc.onetime) return "";
  const amt = (g) => `<span class="ba-amt"><b>${mny(g.total)}</b><small>${g.remaining > 0 ? t("余 {a}", { a: mny(g.remaining) }) : t("已结清")}</small></span>`;
  const bar = (g, max) => `<span class="ba-bar" aria-hidden="true"><i style="width:${Math.max(3, Math.round((g.total / max) * 100))}%"></i></span>`;
  const row = (href_, name, g, max, sub = false) => `<li ${sub ? 'class="ba-sub"' : ""}><a class="ba-row" href="${href_}"><span class="ba-name">${name}${g.n ? ` <small class="muted">${t("{n} 笔账单", { n: g.n })}</small>` : ""}</span>${amt(g)}${bar(g, max)}<span class="mch" aria-hidden="true">›</span></a></li>`;
  let list = "";
  if (byCycle) {
    const max = Math.max(cyc.recurring?.total || 0, cyc.onetime?.total || 0, 1), q = { range: f.range, asset: f.asset };
    if (cyc.recurring) list += row(allBillsHref({ ...q, type: "recurring" }), `🔁 ${t("周期性")}`, cyc.recurring, max) + cyc.recurring.byFreq.map((g) => row(allBillsHref({ ...q, type: "recurring" }), esc(t(window.BILLS.FREQUENCIES[g.freq] || g.freq)), g, max, true)).join("");
    if (cyc.onetime) list += row(allBillsHref({ ...q, type: "onetime" }), `🧾 ${t("一次性")}`, cyc.onetime, max);
  } else {
    const max = Math.max(...C.byAsset.map((g) => g.total), 1);
    list = C.byAsset.map((g) => row(["general", "vehicle"].includes(g.key) ? assetBillsHref(g.key, f.range) : allBillsHref({ range: f.range, asset: g.key }), esc(assetKeyLabel(g.key)), g, max)).join("");
  }
  const sw = viewSwitch([["asset", "按资产"], ["cycle", "按周期"]], byCycle ? "cycle" : "asset", { action: "ov-group", attr: "group", label: "分组方式" });
  return `<section class="section"><div class="section-head"><h2>${t("账单分组")} ${infoTip(byCycle ? t("点一行看这类账单") : t("点一行看这个资产的账单"), { align: "start" })}</h2><div class="head-acts"><div class="view-bar">${sw}</div></div></div>
    <div class="panel"><ul class="bill-assets">${list}</ul></div></section>`;
}
function trendHtml(C) {
  const max = Math.max(...C.series.map((s) => s.due), 1), thisM = C.today.slice(0, 7), f = state.ovFilter;
  return `<section class="section"><div class="section-head"><h2>${t("按月走势")}</h2><p>${t("应付 vs 已付：前 5 个月、本月和后 2 个月")}</p></div><div class="panel"><ol class="bill-trend">${C.series.map((s) => {
    const mm = s.m.slice(5), label = `${s.m}：${t("应付")} ${mny(s.due)}，${t("已付")} ${mny(s.paid)}`;
    return `<li><a href="${allBillsHref({ range: s.m, asset: f.asset })}" class="bt-col ${s.m === thisM ? "is-now" : ""} ${s.m > thisM ? "is-future" : ""}" aria-label="${esc(label)}" title="${esc(label)}">
      <span class="bt-bars" aria-hidden="true"><i class="bt-due" style="height:${Math.round((s.due / max) * 100)}%"></i><i class="bt-paid" style="height:${Math.round((s.paid / max) * 100)}%"></i></span><span class="bt-m">${mm}</span></a></li>`;
  }).join("")}</ol><p class="muted bt-key"><span class="bt-k due"></span>${t("应付")} <span class="bt-k paid"></span>${t("已付")}</p></div></section>`;
}
export function viewBillsHome() {
  const f = state.ovFilter, C = compute(), scope = f.range === "all" ? t("不限时间") : `${fmtDate(C.from)} – ${fmtDate(C.to)}`;
  const range = BILL_RANGES.map(([k, l]) => `<option value="${k}" ${f.range === k ? "selected" : ""}>${t(l)}</option>`).join("");   // 概览只用固定几个范围；链接带的某个月只在全部账单里显示
  const assetLabel = f.asset === "all" ? t("全部资产") : assetKeyLabel(f.asset);
  const empty = !state.billsEnriched.length && !state.medEnriched.length;
  return `<section class="section">
      <div class="section-head"><h2>${t("账单概览")}</h2><div class="head-acts">${eyeFilter()}<a class="btn btn-sm btn-ghost" href="${allBillsHref({ range: f.range, asset: f.asset })}">${t("账单明细")} ›</a></div></div>
      <div class="ov-filters">
        <select id="ovRange" aria-label="${t("时间范围")}">${range}</select>
        <select id="ovAsset" data-search aria-label="${t("按资产筛选")}">${assetOptions(C.base.rows, f.asset)}</select>
      </div>
      <p class="muted kinds-note" role="status">${t("统计范围：{r}（{s}）· {a}。逾期没缴的一直计入，不受范围限制。", { r: t(BILL_RANGES.find(([k]) => k === f.range)?.[1] || f.range), s: scope, a: assetLabel })}</p>
      ${empty ? `<div class="panel empty"><strong>${t("还没有账单")}</strong>${t("先按常用账单模板一次建好水电气、网络、HOA、房产税、房贷、保险，再补金额和到期日。")}<p><a class="btn btn-primary" href="${href("bills", "template")}">${t("按模板建账单")}</a> <a class="btn btn-ghost" href="${href("bill", "new")}">${t("手动添加一条")}</a></p></div>` : `${cardsHtml(C)}`}
    </section>
    ${empty ? "" : `${urgentHtml(C)}${groupHtml(C)}${trendHtml(C)}${billTrendSection()}
    ${fabHtml()}`}`;
}
