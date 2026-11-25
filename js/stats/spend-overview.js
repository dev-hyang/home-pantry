/* 花费统计：概览的数字卡片，和分类一级 → 二级 → 叶子逐层点进去。 */
import { BUCKETS, L1S, allLeaves, childrenOf, isNode, l2List, leafInfo, nodeOf, parentOf } from "../core/taxonomy.js";
import { DRILL_HINT, LOADING, changeTxt, comparePlan, dq, kpi, livHou, winDrill, windowAgg } from "./spend-drill.js";
import { PER_TITLE, lastMonths, monthLabel, noSpend, rangeMonths, rollErr, spendAgg, statOpts, trendHead, trendMonths, trendPeriods } from "./spend-roll.js";
import { SPEND_TABS } from "../core/tabs.js";
import { askInline } from "../core/ask.js";
import { avg, fullMonths, livingSeries, median, nodeSum, normalizedMonthly, outflowSeries, rankChildren, series, sum, withHousingSeries } from "./report.js";
import { billExpenseMonthly } from "../bills/debt-logic.js";
import { esc, money } from "../core/util.js";
import { href } from "../core/router.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";
import { tripsPanel } from "./spend-trips.js";
import { rangeLabel } from "./add-lite.js";

/* ── 概览的数字卡片：日常 / 含住房（月均、中位数、均摊）、现金流出（对比前一段）、投资、资本性 ──
 *   日常 = 生活消费里性质是日常消费的；含住房 = 再加上房产住房里日常消费的（房贷、房产税、保险、HOA、维护）；
 *   现金流出 = 除了转账的全部；投资 / 资本性 按经济性质。口径全在 js/core/taxonomy.js 的 bucketOf。
 *   月均、中位数只用过完的月份（时间范围超过一个月时不含本月）；均摊 = 账单按每月折算（年付的摊开）代替缴费那个月的实际金额。 */
function overviewKpis() {
  const plan = comparePlan(), A = windowAgg(plan.a), B = windowAgg(plan.b), cur = Units.region.currency;
  if (!A) return LOADING();
  const L = livingSeries(A), H = withHousingSeries(A), outA = sum(outflowSeries(A)), outB = B ? sum(outflowSeries(B)) : 0;
  let liv;
  if (plan.avg === "day") {
    liv = kpi({ label: t("日常生活成本（本月至今）"), value: livHou(sum(L), sum(H)), wide: true, drill: { cat: "living", nat: "operating", ...plan.a.drill },
      small: B ? t("{label}：日常 {a} / 含住房 {b}", { label: plan.b.label, a: money(sum(livingSeries(B))), b: money(sum(withHousingSeries(B))) }) : "" });
  } else {
    const full = fullMonths(plan.a.months, lastMonths(1)[0]), pick = (arr) => full.map((m) => arr[A.months.indexOf(m)]);
    const billsX = state.billsEnriched.map((b) => (b.debt_id ? { ...b, expMonthly: billExpenseMonthly(b) } : b));   // 贷款账单：本金不算消费（迁移 058）
    const nl = normalizedMonthly(A, full, billsX, "living", cur), nh = nl + normalizedMonthly(A, full, billsX, "housing", cur);
    liv = kpi({ label: full.length < A.months.length ? t("日常生活成本（月均，不含本月）") : t("日常生活成本（月均）"), value: livHou(avg(pick(L)), avg(pick(H))), wide: true, drill: { cat: "living", nat: "operating", ...plan.a.drill },
      small: t("中位数 {a} / {b} · 均摊 {c} / {d}", { a: money(median(pick(L))), b: money(median(pick(H))), c: money(nl), d: money(nh) }) });
  }
  const inv = sum(series(A, (b) => b.investment)), cap = sum(series(A, (b) => b.capital));
  return `<div class="kpis">${liv}
    ${kpi({ label: t("现金流出 · {r}", { r: plan.a.label }), value: money(outA), small: plan.b.months.length ? `${t("比{r}", { r: plan.b.label })}${changeTxt(outA, outB)}` : t("全部历史 / 自定义范围不做对比"), drill: plan.a.drill })}
    ${kpi({ label: t("投资"), value: money(inv), small: t("算现金流出，不算日常"), drill: { nat: "investment", ...plan.a.drill } })}
    ${kpi({ label: t("资本性支出"), value: money(cap), small: t("买房、买车、装修等，不算日常"), drill: { nat: "capital", ...plan.a.drill } })}
  </div>`;
}
/* 花费页分为 5 个标签（概览 / 明细 / 分类 / 商店 / 导出打印），一次只画一块；旅行不再单独一个标签：分类 → 生活消费 → 旅行 里可以按行程看。
 * 统计页（账单模块关闭时）仍用 "all"：全部连在一起 */
export const spendHref = (id) => `${href("bills", "spend")}${id === "overview" ? "" : `?tab=${id}`}`;
/** 花费图的「问咩咩」：为什么涨、怎么控（带每月日常 / 现金流出和日常的前三类） */
function spendAsk(A) {
  const { months } = A, L = livingSeries(A), O = outflowSeries(A), top = rankChildren(A, l2List("living").map((n) => n.id)).slice(0, 3);
  const liv = {}; for (const m of months) for (const [k, v] of Object.entries(A.liv[m] || {})) liv[k] = (liv[k] || 0) + v;
  const top3 = Object.entries(liv).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${t(nodeOf(k)?.name || k)} ${money(v)}`);
  return { id: `spend-${months[0]}-${months.at(-1)}`, title: t("{r}的花费", { r: rangeLabel() }), question: t("这段时间花费为什么变多了？主要在哪几类？怎么控制？"),
    context: () => [t("按月日常生活成本：{s}", { s: months.map((m, i) => `${monthLabel(m)} ${money(L[i])}`).join("，") }), t("按月现金流出：{s}", { s: months.map((m, i) => `${monthLabel(m)} ${money(O[i])}`).join("，") }),
      t("日常里前三类：{s}", { s: (top3.length ? top3 : top.map((x) => `${t(nodeOf(x.id)?.name)} ${money(x.v)}`)).join("，") }), t("家庭人数 {n}", { n: state.members?.length || 1 })] };
}
const bucketOf_ = (id) => BUCKETS.find((b) => b.id === id);
export function spendOverviewTab(withHub = false) {
  const ms = rangeMonths(), A = spendAgg(ms), tm = trendMonths(), T = spendAgg(tm), o = statOpts();
  const notes = A ? [A.xfer.n ? t("另有 {n} 笔转账（{a}）不算花费，明细里能看到。", { n: A.xfer.n, a: money(A.xfer.sum) }) : "", A.otherCur ? t("另有 {n} 笔非 {cur} 记录未计入。", { n: A.otherCur, cur: Units.region.currency }) : ""].filter(Boolean) : [];
  let body = "";
  if (A && T) {
    const has = sum(outflowSeries(T)) > 0 || sum(outflowSeries(A)) > 0;
    if (!has) body = rollErr() ? `<div class="panel empty"><strong>${t("花费统计读不出来")}</strong>${esc(rollErr())}</div>` : noSpend();
    else {
      const B = (id) => bucketOf_(id), tmDrill = rangeMonths().length >= 6 ? winDrill() : { range: 12 }, TP = trendPeriods(tm);
      // 每条虚线带上它的钻取条件：财务 = 财务及其他 · 日常性质；资本性 / 投资按经济性质（和上面 KPI 卡片的链接一致）
      const lines = [{ name: t(B("financial").name), color: B("financial").color, values: TP.agg(series(T, (b) => b.financial)), q: { cat: "financial", nat: "operating" } },
        ...(o.exCap ? [] : [{ name: t(B("capital").name), color: B("capital").color, values: TP.agg(series(T, (b) => b.capital)), q: { nat: "capital" } }]),
        ...(o.exInv ? [] : [{ name: t(B("investment").name), color: B("investment").color, values: TP.agg(series(T, (b) => b.investment)), q: { nat: "investment" } }])];
      const trend = Charts.bars({ title: t("花费走势：日常 + 住房（柱），财务 / 资本性 / 投资（虚线）"), labels: TP.labels, fmt: money,
        series: [{ name: t(B("living").name), color: B("living").color, values: TP.agg(livingSeries(T)) }, { name: t(B("housing").name), color: B("housing").color, values: TP.agg(series(T, (b) => b.housing)) }], lines,
        drill: (k, i) => dq({ cat: k === 0 ? "living" : "housing", nat: "operating", ...TP.when(i) }), legendDrill: (k) => (k < 2 ? dq({ cat: k === 0 ? "living" : "housing", nat: "operating", ...tmDrill }) : dq({ ...lines[k - 2].q, ...tmDrill })),
        lineDrill: (j, i) => dq({ ...lines[j].q, ...TP.when(i) }), partial: TP.partial });
      const liv = l2List("living").map((n) => ({ name: `${n.icon} ${t(n.name)}`, color: n.color, value: Math.round(ms.reduce((s, m) => s + (A.liv[m]?.[n.id] || 0), 0) * 100) / 100, drill: dq({ cat: n.id, nat: "operating", ...winDrill() }) }));
      body = `<div class="panel chart-panel">${trendHead(t(PER_TITLE[TP.unit]), TP)}<p class="muted" style="margin:0 0 6px;font-size:13px">${t("柱子 = 日常 + 住房（合起来就是「含住房」）；虚线是不算日常的部分。上面的开关可以把资本性、投资也画出来。")}</p>${trend}${DRILL_HINT()}${askInline(spendAsk(T))}</div>
        <div class="panel chart-panel"><h3>${t("日常生活花在哪（{r}）", { r: rangeLabel() })}</h3>${Charts.hbars({ items: liv, fmt: money, title: t("日常生活按类别"), empty: t("这段时间没有日常生活花费") })}${DRILL_HINT()}</div>`;
    }
  } else body = LOADING();
  return `${overviewKpis()}
    ${notes.map((x) => `<p class="muted" style="font-size:13px">${esc(x)}</p>`).join("")}
    ${body}`;
}
/* ── 分类：一级 → 二级 → 叶子 逐层点进去（面包屑回上层）；每层有子类排行（带占比）和选中节点的月度柱状图（按子类堆叠）。
 * 跟着时间范围、月份、「排除资本性 / 投资」开关；转账不在这里（不是花费），在明细里看。 */
const nodeName = (id) => { const n = nodeOf(id); return n ? `${n.icon} ${t(n.name)}` : `${leafInfo(id).icon || ""} ${t(leafInfo(id).name)}`.trim(); };
function nodeCrumb(node) {
  const path = [];
  for (let x = node; x; x = parentOf(x)) path.unshift(x);
  const btn = (id, label) => `<button type="button" class="linkbtn" data-action="stats-node" data-node="${esc(id)}">${esc(label)}</button>`;
  return `<nav class="node-crumb" aria-label="${esc(t("分类层级"))}">${node ? btn("", t("全部分类")) : `<b aria-current="page">${t("全部分类")}</b>`}${path.map((id, i) => `<span class="sep" aria-hidden="true">›</span>${i === path.length - 1 ? `<b aria-current="page">${esc(nodeName(id))}</b>` : btn(id, nodeName(id))}`).join("")}</nav>`;
}
const MAX_SERIES = 7;
export function spendCategoryTab() {
  const st = state.stats, ms = rangeMonths(), sel = st.month && ms.includes(st.month) ? st.month : "";
  const node = st.node && (isNode(st.node) || allLeaves().some((c) => c.id === st.node)) ? st.node : "";
  const A = spendAgg(ms); if (!A) return `${nodeCrumb(node)}${LOADING()}`;
  const kids = node ? childrenOf(node) : L1S.filter((l) => l.id !== "transfer");
  const leaf = node && !isNode(node), mDrill = sel ? { month: sel } : winDrill();
  const ranked = rankChildren(A, kids.map((k) => k.id), sel || null), byId = new Map(kids.map((k) => [k.id, k]));
  const total = node ? nodeSum(A, node, sel || null) : sum(ranked.map((x) => x.v));
  const items = ranked.map(({ id, v }) => { const k = byId.get(id), sub = isNode(id);
    return { name: `${k.icon || ""} ${t(k.name)}`.trim(), value: v, color: k.color, ...(sub ? { btn: `data-action="stats-node" data-node="${esc(id)}" aria-label="${esc(t("看「{n}」的细分", { n: t(k.name) }))}"` } : { drill: dq({ cat: id, ...mDrill }) }) }; });
  // 月度柱状图：选中节点按子类堆叠（子类多时前 7 个 + 其他）；只看一个月时画近 6 个月，看得出走势
  const cm = ms.length > 1 ? ms : lastMonths(6), C = spendAgg(cm);
  let chart = "", chartHead = `<h3>${t("走势")}</h3>`;
  if (C) {
    const ids = leaf ? [node] : rankChildren(C, kids.map((k) => k.id)).map((x) => x.id), top = ids.slice(0, MAX_SERIES), rest = ids.slice(MAX_SERIES);
    const ser = top.map((id) => { const k = byId.get(id) || leafInfo(id); return { id, name: t(k.name), color: k.color || "#8a948f", values: cm.map((m) => nodeSum(C, id, m)) }; });
    if (rest.length) ser.push({ id: node, name: t("其他"), color: "#8a948f", values: cm.map((m) => rest.reduce((s, id) => s + nodeSum(C, id, m), 0)) });
    const TP = trendPeriods(cm); for (const x of ser) x.values = TP.agg(x.values);
    chart = ser.length ? Charts.bars({ title: `${t("{cat}花费走势", { cat: node ? nodeName(node) : t("全部分类") })} · ${TP.title}`, labels: TP.labels, fmt: money, series: ser,
      drill: (k, i) => dq({ cat: ser[k].id || "", ...TP.when(i) }), legendDrill: (k) => (ser[k].id ? dq({ cat: ser[k].id, ...(ms.length > 1 ? winDrill() : { range: 6 }) }) : null), partial: TP.partial }) : "";
    chartHead = trendHead(TP.title, TP);
  } else chart = LOADING();
  const trips = node === "travel" ? `<div class="ui-acts"><button type="button" class="ui-btn" data-size="sm" data-action="stats-trips" aria-expanded="${st.byTrip ? "true" : "false"}">🧳 ${st.byTrip ? t("收起按行程") : t("按行程看")}</button></div>${st.byTrip ? tripsPanel() : ""}` : "";
  return `${nodeCrumb(node)}
    <div class="panel chart-panel"><div class="row"><h3 style="margin:0">${node ? esc(nodeName(node)) : t("全部分类")}</h3><b class="num">${money(total)}</b></div>
      <p class="muted" style="margin:2px 0 8px;font-size:13px">${sel ? monthLabel(sel) : rangeLabel()}${leaf ? "" : ` · ${t("点名称看下一层，点条看明细")}`}</p>
      ${leaf ? "" : Charts.hbars({ items, fmt: money, total, title: t("子类排行"), empty: t("这段时间没有花费") })}
      <div class="ui-acts"><button type="button" class="ui-btn" data-size="sm" data-drill="${esc(dq({ cat: node || "", ...mDrill }))}">${t("查看明细")} ›</button></div></div>
    ${trips}
    <div class="panel chart-panel">${chartHead}${chart}${DRILL_HINT()}</div>`;
}
