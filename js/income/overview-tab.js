/* 收入 → 收支总览：时间条、五个指标、现金流瀑布、12 个月走势、收入按一级、付款方 / 成员 / 最近到账。 */
import { BUCKETS } from "../core/taxonomy.js";
import { INCOME_TABS } from "../core/tabs.js";
import { INC_L1S } from "../core/income-taxonomy.js";
import { filterToolbar, adults, groupSum, inc, incSumOf, incomeIn, periodLabel, personName, personOk, sharedRangeHtml, skey, spanLabel, spanOk, spanPrev, spanWindow } from "./logic.js";
import { aggregate, householdFlow, incAggregate, incNodeSum } from "../stats/report.js";
import { esc, todayISO } from "../core/util.js";
import { iso, monthsBetween, roll, spanOfMonths } from "./rollup.js";
import { recordRow, repayPanel } from "./records-tab.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";
import { BLUE, DRILL_HINT, GREEN, GROUPED_MAX, R2, RED, SLATE, TEAL, cur, empty, fmtMoney, incDrill, incomeHref, netWorthCard, pctOf, personOptions, rate } from "./shared.js";
import { trendHead, trendPeriods } from "../stats/spend-roll.js";
import { dq, hitAttrs } from "../stats/spend-drill.js";

/* ───────────── 收支总览（原「概览」）：时间条 → 五个指标 → 现金流瀑布 → 12 个月收支走势 → 收入按一级 → 付款方 / 成员 / 最近到账 ─────────────
 * 收入 = 认定收入（js/core/income-taxonomy.js）；消费 = 日常 / 含住房（和花费页同一口径）；净现金流 = 收入 − 消费（投资之前）；
 * 储蓄率 = 净现金流 ÷ 收入；投资率 = 投资（性质 = 投资的现金流出）÷ 收入；资本流入单列，不算收入。花费不分人：选了某个成员时只看收入。 */
/** 概览 / 类型页共用的时间范围、成员、节点（切标签不丢）；时间范围和花费页同一套：本月 / 近 3·6·9·12 个月 / 今年 / 往年 */
export const OV = () => {
  const o = (inc().ov ||= { range: "12", person: "all", month: "", node: "" });
  if (o.range !== state.stats.months) { o.range = spanOk(state.stats.months) ? state.stats.months : "m"; o.month = ""; }   // 共享的时间范围（js/core/time-range.js）：花费页改了这里也跟着变
  if (!(o.person === "all" || o.person === "none" || adults().some((p) => p.id === o.person))) o.person = "all";
  return o;
};
const kpiS = (label, val, small = "", drill = "") => `<div class="kpi${drill ? " ch-hit-row" : ""}"${hitAttrs(drill, label)}><span>${esc(label)}</span><b>${val}</b>${small}</div>`;
const changeHtml = (now, before) => (before > 0 ? `<small class="${now >= before ? "gain" : "loss"}">${now >= before ? t("比上期多 {p}%", { p: Math.round(((now - before) / before) * 100) }) : t("比上期少 {p}%", { p: Math.round(((before - now) / before) * 100) })}</small>` : `<small>${t("上期没有收入")}</small>`);
export const senderLabel = (x) => x.rows.find((r) => r.source_name)?.source_name || x.key;
export const ovBar = (O, { keys = null } = {}) => filterToolbar(`${sharedRangeHtml()}
  <label class="tb-field"><span>${t("谁的")}</span><select data-inc-ov="person" data-nosearch>${personOptions(O.person, { all: true })}</select></label>
  ${keys ? `<label class="tb-field"><span>${t("月份")}</span><select data-inc-ov="month" data-nosearch><option value="">${t("整段（{r}）", { r: spanLabel(O.range) })}</option>${[...keys].reverse().map((k) => `<option value="${k}" ${k === O.month ? "selected" : ""}>${esc(periodLabel(k, "month"))}</option>`).join("")}</select></label>` : ""}`);
/** 付款方排行：名字 + 金额 + 占比条 */
const rankHtml = (list, total, w, person) => `<ul class="ix-rank">${list.map((x) => `<li><div class="rk-top"><button type="button" class="link-name" data-drill="${esc(incDrill({ q: senderLabel(x), ...w, person }))}">${esc(senderLabel(x))}</button><b>${fmtMoney(x.total)}</b></div>
  <div class="rk-bar" aria-hidden="true"><i style="width:${total > 0 ? Math.max(2, Math.round((x.total / total) * 100)) : 0}%"></i></div><small class="muted">${t("{n} 次", { n: x.n })} · ${rate(x.total, total)}${x.cap ? ` · ${t("另有资本流入 {a}", { a: fmtMoney(x.cap) })}` : ""}</small></li>`).join("")}</ul>`;
/** 总览要用的月份：时间范围（月）、12 个月走势（选了某一年 = 那一年） */
export function ovMonths(O) {
  const w = spanWindow(O.range), months = monthsBetween(w.from, w.to);
  const now = new Date(), trend = months.length >= 6 ? months : monthsBetween(iso(new Date(now.getFullYear(), now.getMonth() - 11, 1)), todayISO());   // 和花费页一样：6 个月以上画这段，更短看满近 12 个月
  return { w, months, trend, span: spanOfMonths([...months, ...trend]) };
}
/** 现金流瀑布：收入 → − 日常 − 住房 = 净现金流 → − 财务及其他 − 资本性 − 投资 = 剩余现金（表格 + 条形，读屏读表格） */
function waterfallHtml(F, drillW, capDrill = "") {
  const max = Math.max(F.income + F.capBook, F.living + F.housing + F.financial + F.capital + F.investment, 1);
  const bar = (v, color) => `<span class="rk-bar wf-bar" aria-hidden="true"><i style="width:${Math.max(0, Math.min(100, Math.round((Math.abs(v) / max) * 100)))}%;background:${color}"></i></span>`;
  const sd = (o) => esc(dq({ ...o, ...drillW }));
  const row = (label, v, color, { sign = "−", total = false, drill = "" } = {}) => `<tr${drill ? ` class="ch-hit-row" data-drill="${drill}" role="link" tabindex="0" aria-label="${esc(label)}"` : ""}><th scope="row">${total ? `<b>${esc(label)}</b>` : esc(label)}</th><td class="${total && v < 0 ? "down" : ""}">${total ? `<b>${fmtMoney(v)}</b>` : `${sign === "+" ? "+" : "−"}${fmtMoney(Math.abs(v))}`}</td><td class="wf-cell">${bar(v, color)}</td></tr>`;
  const B = (id) => BUCKETS.find((b) => b.id === id)?.color || SLATE;
  return `<div class="panel"><h3 style="margin:0 0 8px">${t("现金流")}</h3><div class="ch-scroll"><table class="store-table ix-tbl wf-tbl"><caption class="sr-only">${t("现金流：收入和资本流入减去各项支出")}</caption>
    <thead><tr><th scope="col">${t("项目")}</th><th scope="col">${t("金额")}</th><th scope="col"><span class="sr-only">${t("比例")}</span></th></tr></thead><tbody>
    ${row(t("收入（认定）"), F.income, GREEN, { sign: "+" })}
    ${row(t("日常生活"), F.living, B("living"), { drill: sd({ cat: "living", nat: "operating" }) })}
    ${row(t("住房"), F.housing, B("housing"), { drill: sd({ cat: "housing", nat: "operating" }) })}
    ${row(t("日常结余（收入 − 消费）"), F.surplus, BLUE, { total: true })}
    ${F.financial ? row(t("财务及其他（税、保险、利息…）"), F.financial, B("financial")) : ""}
    ${F.capital ? row(t("资本性支出（买车、装修、房产交易）"), F.capital, B("capital"), { drill: sd({ nat: "capital" }) }) : ""}
    ${row(t("投资转入"), F.investment, B("investment"), { drill: sd({ nat: "investment" }) })}
    ${row(t("收入结余（收入 − 全部流出）"), F.incNet, BLUE, { total: true })}
    ${F.capBook ? row(t("资本流入（卖房卖股本金、借款、本金返还…，不算收入）"), F.capBook, SLATE, { sign: "+", drill: capDrill }) : ""}
    ${row(t("净现金流（账面：全部流入 − 全部流出）"), F.net, SLATE, { total: true })}</tbody></table></div>
    ${F.capOwn ? `<p class="muted small" style="margin:6px 0 0">${t("从储蓄账户转入的 {a} 没算进来：那是自己账户之间挪钱，转出去时也没算支出。", { a: fmtMoney(F.capOwn) })}</p>` : ""}</div>`;
}
export function overviewTab() {
  const I = inc(), O = OV();
  if (!I.rec.length) return empty();
  const { w, months, trend, span } = ovMonths(O), all = O.person === "all";
  const ir = roll("inc", span.from, span.to), sr = all ? roll("spend", span.from, span.to) : [];
  if (!ir || !sr) return `${ovBar(O)}<p class="muted" role="status">${t("加载中…")}</p>`;
  const IA = incAggregate(ir, months, { cur: cur(), person: O.person }), SA = all ? aggregate(sr, months, { cur: cur() }) : null, F = householdFlow(IA, SA, months);
  const pw = spanPrev(O.range), before = pw ? incSumOf(incomeIn(pw.from, pw.to, O.person)) : 0, allDrill = incDrill({ ...w, person: O.person, ex: 1 });
  const spW = String(O.range).startsWith("y:") ? { year: String(O.range).slice(2) } : months.length === 1 ? { month: months[0] } : O.range === "all" ? {} : { mlist: months.join(",") };
  const kpis = `<div class="kpis">${kpiS(t("收入（认定）"), fmtMoney(F.income), changeHtml(F.income, before), allDrill)}
    ${all ? `${kpiS(t("消费"), `${t("日常")} ${fmtMoney(F.living, true)} <span class="kpi-sub">/ ${t("含住房")} ${fmtMoney(F.consumption, true)}</span>`, `<small>${t("和花费页同一口径")}</small>`, dq({ cat: "living", nat: "operating", ...spW }))}
      ${kpiS(t("净现金流（账面）"), `<span class="${F.net < 0 ? "down" : ""}">${fmtMoney(F.net)}</span>`, `<small>${t("全部流入 − 全部流出 · 收入结余 {a}", { a: fmtMoney(F.incNet, true) })}</small>`)}
      ${kpiS(t("储蓄率"), pctOf(F.savingsRate), `<small>${t("存下来的（含投资）÷ 收入")}</small>`)}
      ${kpiS(t("投资率"), pctOf(F.investRate), `<small>${t("投资 {a} ÷ 收入", { a: fmtMoney(F.investment, true) })}</small>`, dq({ nat: "investment", ...spW }))}` : ""}</div>
    ${all ? "" : `<p class="muted small" role="status">${t("花费不分人：选「全家」才会显示消费、净现金流、储蓄率和投资率。")}</p>`}`;
  // 收入按一级（排行条，带占比）；资本流入单列
  const l1Items = INC_L1S.filter((g) => g.income).map((g) => ({ name: `${g.icon} ${t(g.name)}`, color: g.color, value: incNodeSum(IA, g.id), drill: incDrill({ kind: `g:${g.id}`, ...w, person: O.person }) }));
  const breakdown = `<div class="panel chart-panel"><h3>${t("收入构成（{r}）", { r: spanLabel(O.range) })}</h3>${window.Charts ? window.Charts.hbars({ items: l1Items, fmt: fmtMoney, title: t("收入按一级分类"), empty: t("这段时间没有认定收入") }) : ""}
    ${F.capIn ? `<p class="muted small" style="margin:6px 0 0"><button type="button" class="linkbtn" data-drill="${esc(incDrill({ kind: "g:capital", ...w, person: O.person }))}">🔁 ${t("资本流入 {a} · 不计收入", { a: fmtMoney(F.capIn) })}</button></p>` : ""}${DRILL_HINT()}</div>`;
  // 12 个月：收入 vs 消费（柱），投资（虚线）
  const TI = incAggregate(ir, trend, { cur: cur(), person: O.person }), TS = all ? aggregate(sr, trend, { cur: cur() }) : null;
  const TP = trendPeriods(trend), asLine = TP.n > GROUPED_MAX;
  const incV = TP.agg(trend.map((m) => R2(TI.income[m]))), spV = TS ? TP.agg(trend.map((m) => R2(TS.bucket[m].living + TS.bucket[m].housing))) : null, invV = TS ? TP.agg(trend.map((m) => R2(TS.bucket[m].investment))) : null;
  const tDrill = (k, i) => (k === 0 ? incDrill({ ...TP.win(i), person: O.person, ex: 1 }) : k === 1 ? dq(TP.when(i)) : dq({ nat: "investment", ...TP.when(i) }));
  const tLegend = (k) => (k === 0 ? incDrill({ from: `${trend[0]}-01`, to: todayISO(), person: O.person, ex: 1 }) : null);
  const tTitle = `${t("收入 vs 消费")} · ${TP.title}`;
  // 期数多：三条折线（收入、消费、投资）；少：并排柱子 + 投资虚线
  const trendChart = !window.Charts ? "" : asLine
    ? window.Charts.line({ title: tTitle, labels: TP.labels, fmt: fmtMoney, partial: TP.partial, drill: tDrill, legendDrill: tLegend,
      series: [{ name: t("收入"), color: GREEN, values: incV }, ...(TS ? [{ name: t("消费（日常 + 住房）"), color: RED, values: spV }, { name: t("投资"), color: TEAL, values: invV }] : [])] })
    : window.Charts.bars({ title: tTitle, labels: TP.labels, stacked: false, showTotals: false, fmt: fmtMoney, partial: TP.partial,
      series: [{ name: t("收入"), color: GREEN, values: incV }, ...(TS ? [{ name: t("消费（日常 + 住房）"), color: RED, values: spV }] : [])],
      lines: TS ? [{ name: t("投资"), color: TEAL, values: invV }] : [],
      drill: tDrill, lineDrill: (_, i) => tDrill(2, i), legendDrill: tLegend });
  const rows = incomeIn(w.from, w.to, O.person), senders = groupSum(rows, (r) => skey(r.source_name)).filter((x) => x.total > 0), top = senders.slice(0, 5), total = incSumOf(rows);
  const rank = top.length ? `<div class="panel"><div class="chart-head"><h3>${t("主要付款方")}</h3><a class="btn btn-sm btn-ghost" href="${incomeHref("senders")}">${t("全部付款方")} ›</a></div>${rankHtml(top, total, w, O.person)}</div>` : "";
  const byP = groupSum(rows, (r) => r.person_id || "");
  const members = byP.length > 1 || (byP.length === 1 && byP[0].key) ? `<div class="panel"><h3 style="margin:0 0 8px">${t("按成员")}</h3><div class="ch-scroll"><table class="store-table ix-tbl"><thead><tr><th scope="col">${t("成员")}</th><th scope="col">${t("笔数")}</th><th scope="col">${t("收入")}</th><th scope="col">${t("占比")}</th></tr></thead><tbody>
    ${byP.map((x) => `<tr class="ch-hit-row"${hitAttrs(incDrill({ ...w, person: x.key || "none" }), x.key ? personName(x.key) : t("未指定 / 全家"))}><th scope="row">${esc(x.key ? personName(x.key) || t("已删除的成员") : t("未指定 / 全家"))}</th><td>${x.n}</td><td>${fmtMoney(x.total)}</td><td>${rate(x.total, total)}</td></tr>`).join("")}
    <tr><th scope="row"><b>${t("全家合计")}</b></th><td><b>${byP.reduce((a, x) => a + x.n, 0)}</b></td><td><b>${fmtMoney(total)}</b></td><td>100%</td></tr></tbody></table></div></div>` : "";
  const recent = I.rec.filter((r) => personOk(r, O.person)).slice().sort((a, b) => b.received_on.localeCompare(a.received_on) || String(b.created_at).localeCompare(String(a.created_at))).slice(0, 5);
  const recentHtml = recent.length ? `<div class="panel"><div class="chart-head"><h3>${t("最近到账")}</h3><a class="btn btn-sm btn-ghost" href="${incomeHref("records")}">${t("全部明细")} ›</a></div><ul class="restock-list ix-list">${recent.map(recordRow).join("")}</ul></div>` : "";
  return `${ovBar(O)}${kpis}${netWorthCard()}${all ? waterfallHtml(F, spW, esc(incDrill({ kind: "g:capital", ...w, person: O.person }))) : ""}
    <div class="panel chart-panel">${trendHead(`${t("收入 vs 消费（{r}）", { r: trend.length === months.length ? spanLabel(O.range) : t("近 12 个月") })} · ${TP.title}`, TP)}${trendChart}<p class="muted drill-hint">${asLine ? t("折线 = 认定收入、消费（日常 + 住房）和投资转入。点一个点看对应的明细。") : t("柱子 = 认定收入和消费（日常 + 住房），虚线 = 投资转入。点一下看对应的明细。")}</p></div>
    ${breakdown}<div class="ix-two">${rank}${members}</div>${recentHtml}${repayPanel()}`;
}
