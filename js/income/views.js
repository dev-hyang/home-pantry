/* 账单 → 收入：概览、明细、付款方历史、报表（收入 / 花费 / 差额，按双周 / 月 / 季 / 年，导出，AI 分析）、查看权限。
 * 数据在 income_records（迁移 042），逻辑在 logic.js。花费来自 purchases（按需读取时间窗口，医疗付款并进来），和这里的收入合成现金流。 */
import { state } from "../core/state.js";
import { Store } from "../core/store.js";
import { $, applyDraft, daysUntil, esc, formDraft, money, moneyExact, num, todayISO, toast } from "../core/util.js";
import { registerAlerts } from "../core/alerts.js";
import { lang, t } from "../core/i18n.js";
import { href } from "../core/router.js";
import { tabBar, tabHub } from "../core/hub.js";
import { printHtml, printStamp } from "../settings/print.js";
import { INCOME_TABS, activeTab } from "../core/tabs.js";
import { initIncomeScan, scanHtml } from "./scan.js";
import { meta, monthlyOf, saveMeta, totalIncomeMonthly } from "../bills/budget.js";
import { incomePanel } from "../settings/income.js";
import { acctById } from "../bills/cards-views.js";
import { ACCT_KINDS, CARDS_HREF } from "../bills/cards.js";
import { medicalVirtuals } from "../bills/medical.js";
import { aiReady, askText } from "../core/ai.js";
import { STAT_CATS, download, dq, hitAttrs, statCat, toCsv, ymd } from "../stats/views.js";
import { CHANNELS, GROUPS, RANGES, UNITS, adults, bucketKey, canSeeAll, customKinds, groupList, groupOf, groupSum, inc, incomeIn, isExtra, isOwnerNow, kindLabel, kindList, kindMatch, kindOf, kindOptionsHtml, knownSenders, loadIncome, memberLabel, myAccess, myPersonId, openRepayments, periodKeys, personOk,
  periodLabel, personName, repayState, repaidOf, setIncMerge, similarIncome, skey, spanLabel, spanOk, spanOptionsHtml, spanPrev, spanWindow, statKind, statKinds, sumOf, windowOf } from "./logic.js";

const incomeHref = (id) => `${href("bills", "income")}${id === "overview" ? "" : `?tab=${id}`}`;
const GREEN = "#2c6a57", RED = "#d4694c", BLUE = "#3b7fc4";
const R2 = (v) => Math.round(v * 100) / 100;
let hooks = { render: () => {}, refresh: async () => {} };
const rerender = () => hooks.render(false);
/** 用户自己点的操作（展开 / 编辑 / 取消 / 删除…）要立刻重画：main.js 的 render(false) 只给后台刷新用，页面上只要有任何 <form>（明细页底部的「类型管理」就有一个）它就直接跳过，点行编辑就「没反应也没报错」 */
const redraw = () => hooks.render(true);
const cur = () => Units.region.currency;

/* ───────────── 花费：按时间窗口读取（缓存 60 秒），和收入合成现金流 ───────────── */
const spendCache = new Map();
const addDay = (s, n) => { const d = new Date(`${s}T12:00:00`); d.setDate(d.getDate() + n); return ymd(d.toISOString()); };
function spendFor(w) {
  const key = `${w.from}|${w.to}`, c = spendCache.get(key);
  if (c && Date.now() - c.ts < 60000) return c.list;
  if (!c || !c.loading) {
    spendCache.set(key, { ...(c || {}), loading: true });
    const f = new Date(`${w.from}T00:00:00`).toISOString(), e = new Date(`${addDay(w.to, 1)}T00:00:00`).toISOString();
    Store.listPurchasesRange(f, e).then((list) => {
      const med = medicalVirtuals().filter((p) => p.purchased_at >= f && p.purchased_at < e);
      spendCache.set(key, { ts: Date.now(), list: [...list, ...med] });
    }).catch(() => spendCache.set(key, { ts: Date.now(), list: c?.list || null })).finally(() => rerender());
  }
  return c?.list || null;   // 还在读：先用上一次的（没有就是 null）
}
const spendRowsOk = (list) => list.filter((p) => p.amount != null && (!p.currency || p.currency === cur()) && (state.stats.includeCapital || statCat(p.category) !== "capital"));

/** 一个时间窗口 + 周期的现金流：每个周期的收入 / 花费 / 还款 / 差额；花费不分人，只在选「全家」时有 */
function cashflow({ range, from, to, unit, person, win = null }) {
  const I = inc(), w = win || windowOf(range, { from, to }), keys = periodKeys(w.from, w.to, unit), zero = () => Object.fromEntries(keys.map((k) => [k, 0]));
  const income = zero(), spend = zero(), repaid = zero(), byKind = {}, spendCats = {};
  const allRows = incomeIn(w.from, w.to, person), extraRows = allRows.filter((r) => isExtra(r.kind));
  const rows = I.extra ? allRows : allRows.filter((r) => !isExtra(r.kind));   // 默认不算国际电汇 / 个人赠与（勾「含…」才算）
  for (const r of rows) { const k = statKind(r.kind, I.merge); income[bucketKey(r.received_on, unit)] += r.amount; byKind[k] = (byKind[k] || 0) + r.amount; }
  for (const p of inc().rep) {
    if (p.paid_on < w.from || p.paid_on > w.to) continue;
    const rec = inc().rec.find((r) => r.id === p.record_id); if (!rec || !personOk(rec, person)) continue;
    repaid[bucketKey(p.paid_on, unit)] += p.amount;
  }
  const list = person === "all" ? spendFor(w) : null;
  if (list) for (const p of spendRowsOk(list)) { const k = bucketKey(ymd(p.purchased_at), unit); if (k in spend) { spend[k] += num(p.amount); const c = statCat(p.category); spendCats[c] = spendCats[c] || zero(); spendCats[c][k] += num(p.amount); } }
  const hasSpend = person === "all" && !!list, hasRepaid = Object.values(repaid).some((v) => v > 0);
  const lines = keys.map((k) => { const i = R2(income[k]), s = hasSpend ? R2(spend[k]) : null, rp = R2(repaid[k]); return { key: k, label: periodLabel(k, unit), income: i, spend: s, repaid: rp, net: s == null ? null : R2(i - s) }; });
  const tot = { income: R2(lines.reduce((a, l) => a + l.income, 0)), spend: hasSpend ? R2(lines.reduce((a, l) => a + l.spend, 0)) : null, repaid: R2(lines.reduce((a, l) => a + l.repaid, 0)) };
  tot.net = tot.spend == null ? null : R2(tot.income - tot.spend);   // 还款是钱从账户里出去了，已经算在花费里（记还款时同时记一笔花费，或银行导入）：这里的「还款」只是告诉你其中有多少
  return { w, keys, lines, tot, byKind, rows, allRows, extraRows, hasSpend, hasRepaid, spendCats, unit, person, loading: person === "all" && !list };
}

/* ───────────── 页面外壳 ───────────── */
const shell = (tab, body) => `<section class="section" id="incomePage">
  <div class="section-head"><h2>💰 ${t("收入")}</h2><div class="head-acts"><button type="button" class="btn btn-primary btn-sm" data-inc="add">＋ ${t("记一笔收入")}</button></div></div>
  ${tabBar(INCOME_TABS, tab, incomeHref, t("收入内容"))}${noticeHtml()}${body}</section>`;
function noticeHtml() {
  const I = inc();
  if (!I.ok) return `<div class="notice" role="alert"><b>${t("还没执行数据库迁移 042（收入表）：先在 Supabase → SQL Editor 里执行 supabase/migrations/042_income_records.sql，再刷新。")}</b><br><small>${esc(I.err)}</small></div>`;
  const parts = [];
  if (Store.mode === "demo") parts.push(t("演示模式的数据只存在这台设备的浏览器里，没有账号隔离；登录云端家庭后，收入由数据库按「家主 / 已允许 / 自己记的」隔离。"));
  else if (!canSeeAll()) parts.push(t("你只能看到自己记的收入。想看全家的：到「权限」申请，家主批准后才能看。"));
  return parts.length ? `<div class="notice" role="status">${parts.map(esc).join("<br>")}</div>` : "";
}
export function viewIncome() {
  const I = inc(), tab = activeTab(state.route) || "overview";
  if (I._lastTab !== undefined && I._lastTab !== tab) { if (I._keep) I._keep = false; else { I.form = null; I.scanOpen = false; I.selMode = false; } }   // 换标签：不带着没关的表单 / 识别面板
  I._lastTab = tab;
  const qb = state.route?.q?.get("batch");   // 银行导入「查看收入」：只看这一批入账
  if (qb && I.batchFrom !== qb) { I.batch = qb; I.batchFrom = qb; Object.assign(I, { q: "", kind: "all", year: "all", person: "all", limit: 40, from: "", to: "", ex: false }); } else if (!qb) I.batchFrom = null;
  const dqs = tab === "records" && state.route?.q?.get("inc") ? state.route.q.toString() : "";   // 概览 / 类型图表点进来：套上对应筛选（同一个链接只套一次，之后用户改筛选不被覆盖）
  if (dqs && I.drillFrom !== dqs) { I.drillFrom = dqs; applyIncomeDrill(state.route.q); } else if (!dqs) I.drillFrom = null;
  if (!I.loaded && !I.loading) { I.loading = true; loadIncome().finally(() => { I.loading = false; rerender(); }); }
  if (!I.loaded) return shell(tab, `<div class="panel empty"><strong>${t("加载中…")}</strong></div>`);
  const body = { overview: overviewTab, records: recordsTab, category: categoryTab, senders: sendersTab, compare: reportTab, import: importTab, export: exportTab, plan: planTab, access: accessTab }[tab]();
  return shell(tab, I.ok || tab === "plan" || tab === "access" ? body : "");
}

/* ───────────── 公共小件 ───────────── */
const kindBadge = (id) => { const k = kindOf(id); return `<span class="ix-kind" style="--k:${k.color}">${k.icon} ${esc(kindLabel(id))}</span>`; };
/* ── 钻取：图表色块、图例、数字卡片、表格行点一下 → 「明细」并套上对应筛选（类型 / 日期段 / 成员 / 不含电汇赠与）。
 * 和花费图表同一套 data-drill（查询串）；带 inc=1 的由 main.js 的 drillTo 送到 收入 → 明细，applyIncomeDrill 套筛选。 */
const incDrill = (o) => dq({ inc: 1, ...o, ex: inc().extra ? "" : 1, person: o.person && o.person !== "all" ? o.person : "" });
const monthEnd = (y, m) => iso(new Date(y, m, 0));
/** 一个周期（图表上的一根柱子）对应的日期段，夹在时间窗口里 */
function periodWin(k, unit, w) {
  let from, to;
  if (unit === "year") { from = `${k}-01-01`; to = `${k}-12-31`; }
  else if (unit === "quarter") { const y = +k.slice(0, 4), q = +k.slice(-1); from = `${y}-${String(q * 3 - 2).padStart(2, "0")}-01`; to = monthEnd(y, q * 3); }
  else if (unit === "month") { from = `${k}-01`; to = monthEnd(+k.slice(0, 4), +k.slice(5, 7)); }
  else { from = k; to = addDay(k, 13); }
  return { from: from < w.from ? w.from : from, to: to > w.to ? w.to : to };
}
/** 花费那一列点一下：到花费明细（按月 / 季 / 年；双周没有对应筛选，不可点） */
const spendDrillOf = (k, unit) => (unit === "month" ? dq({ month: k }) : unit === "year" ? dq({ year: k }) : unit === "quarter" ? dq({ mlist: [0, 1, 2].map((i) => `${k.slice(0, 4)}-${String(+k.slice(-1) * 3 - 2 + i).padStart(2, "0")}`).join(",") }) : null);
const DRILL_HINT = () => `<p class="muted drill-hint">${t("点图里的色块、图例或数字，可以查看对应的收入明细。")}</p>`;
/** 时间条里的两个勾选（和花费的「同一大类账单合并显示」「含资本性支出」一样）：同一个大类合并显示；含国际电汇 / 个人赠与（默认不含，看的是挣来的收入） */
function togglesHtml(cf) {
  const I = inc(), used = [...new Set(cf.allRows.filter((r) => I.extra || !isExtra(r.kind)).map((r) => r.kind))];
  const multi = groupList().some((g) => used.filter((k) => groupOf(k).id === g.id).length > 1);
  const merge = multi || I.merge ? `<label class="check-inline" title="${esc(t("工资、奖金、福利包合成「工作收入」，利息、租金合成「投资与租金」等，图里颜色更少"))}"><input type="checkbox" data-inc-tog="merge" ${I.merge ? "checked" : ""}><span>${t("同一个大类合并显示")}</span></label>` : "";
  const extra = cf.extraRows.length ? `<label class="check-inline" title="${esc(t("国际电汇、个人赠与多是家人转来的钱，不是挣来的收入：默认不算进合计和图表，勾上一起看"))}"><input type="checkbox" data-inc-tog="extra" ${I.extra ? "checked" : ""}><span>${t("含国际电汇 / 个人赠与 {a}（{n} 笔）", { a: fmtMoney(sumOf(cf.extraRows)), n: cf.extraRows.length })}</span></label>` : "";
  return merge + extra;
}
const personOptions = (sel, { all = false } = {}) => `${all ? `<option value="all" ${sel === "all" ? "selected" : ""}>${t("全家")}</option>` : ""}<option value="none" ${sel === "none" ? "selected" : ""}>${t(all ? "未指定的" : "未指定 / 全家")}</option>${adults().map((p) => `<option value="${p.id}" ${sel === p.id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}`;
const selOpts = (list, sel) => list.map(([v, l]) => `<option value="${esc(v)}" ${v === sel ? "selected" : ""}>${esc(t(l))}</option>`).join("");
const yearsOf = () => [...new Set(inc().rec.map((r) => r.received_on.slice(0, 4)).concat(String(new Date().getFullYear())))].sort().reverse();
const empty = () => `<div class="panel empty"><strong>${t("还没有收入记录")}</strong>${t("点右上角「记一笔收入」；在「账单 → 对账单」导入对账单时，工资、电汇、Zelle 转入这些入账会单独列出来，勾上就能一起导入。")}</div>`;
const kpi = (label, val, sub = "") => `<div class="kpi"><span>${esc(label)}</span><b>${val}</b>${sub ? `<small>${sub}</small>` : ""}</div>`;
const rate = (n, i) => (i > 0 && n != null ? `${Math.round((n / i) * 100)}%` : "—");
const fmtMoney = (v, short) => (short ? money(v, true) : moneyExact(v));   // 不带 short：记录和合计都显示到分；short 只给图表中心、月均这类紧凑处

/** 收入 / 花费分组柱 + 差额（结余 / 超支）柱 + 趋势线 */
function flowCharts(cf, title, { trend: withTrend = true } = {}) {
  if (!window.Charts || !cf.lines.length) return "";
  const labels = cf.lines.map((l) => l.label), f = (v, s) => fmtMoney(v, s);
  const grouped = window.Charts.bars({ labels, title, stacked: false, showTotals: false, fmt: f,
    drill: (k, i) => { const key = cf.lines[i].key; return k === 0 ? incDrill({ ...periodWin(key, cf.unit, cf.w), person: cf.person }) : spendDrillOf(key, cf.unit); },
    legendDrill: (k) => (k === 0 ? incDrill({ ...cf.w, person: cf.person }) : null),
    series: [{ name: t("收入"), color: GREEN, values: cf.lines.map((l) => l.income) }, ...(cf.hasSpend ? [{ name: t("花费"), color: RED, values: cf.lines.map((l) => Math.max(0, l.spend)) }] : [])] });
  const diff = cf.hasSpend ? window.Charts.bars({ labels, title: t("收支差额"), stacked: true, showTotals: false, fmt: f,
    series: [{ name: t("结余（收入 − 花费）"), color: BLUE, values: cf.lines.map((l) => Math.max(0, l.net)) }, { name: t("超支"), color: "#b23b3b", values: cf.lines.map((l) => Math.max(0, -l.net)) }] }) : "";
  const trend = withTrend && cf.lines.length > 2 ? window.Charts.line({ labels, title: t("趋势"), fmt: f, series: [{ name: t("收入"), color: GREEN, values: cf.lines.map((l) => l.income) }, ...(cf.hasSpend ? [{ name: t("花费"), color: RED, values: cf.lines.map((l) => Math.max(0, l.spend)) }] : [])] }) : "";
  return `<div class="panel chart-panel"><h3>${t("收入 vs 花费")}</h3>${grouped}</div>${diff ? `<div class="panel chart-panel"><h3>${t("差额：结余 / 超支")}</h3>${diff}</div>` : ""}${trend ? `<div class="panel chart-panel"><h3>${t("趋势")}</h3>${trend}</div>` : ""}`;
}
const kindDonut = (cf) => {
  const items = statKinds(inc().merge).filter((k) => cf.byKind[k.id]).map((k) => ({ name: `${k.icon} ${kindLabel(k.id)}`, value: R2(cf.byKind[k.id]), color: k.color, drill: incDrill({ kind: k.id, ...cf.w, person: cf.person }) }));
  return items.length && window.Charts ? `<div class="panel chart-panel"><h3>${t("按收入类型")}</h3>${window.Charts.donut({ items, fmt: fmtMoney, title: t("按收入类型"), center: fmtMoney(items.reduce((a, x) => a + x.value, 0), true) })}</div>` : "";
};
const lineTable = (cf) => `<div class="panel"><div class="ch-scroll"><table class="store-table"><thead><tr><th scope="col">${t("周期")}</th><th scope="col">${t("收入")}</th>${cf.hasSpend ? `<th scope="col">${t("花费")}</th>` : ""}${cf.hasRepaid ? `<th scope="col">${t("其中：还款")}</th>` : ""}${cf.hasSpend ? `<th scope="col">${t("收支差额")}</th><th scope="col">${t("结余率")}</th>` : ""}</tr></thead><tbody>
  ${cf.lines.map((l) => `<tr><th scope="row">${esc(l.label)}</th><td>${fmtMoney(l.income)}</td>${cf.hasSpend ? `<td>${fmtMoney(l.spend)}</td>` : ""}${cf.hasRepaid ? `<td>${fmtMoney(l.repaid)}</td>` : ""}${cf.hasSpend ? `<td class="${l.net < 0 ? "down" : ""}">${fmtMoney(l.net)}</td><td>${rate(l.net, l.income)}</td>` : ""}</tr>`).join("")}
  <tr><th scope="row"><b>${t("合计")}</b></th><td><b>${fmtMoney(cf.tot.income)}</b></td>${cf.hasSpend ? `<td><b>${fmtMoney(cf.tot.spend)}</b></td>` : ""}${cf.hasRepaid ? `<td><b>${fmtMoney(cf.tot.repaid)}</b></td>` : ""}${cf.hasSpend ? `<td><b>${fmtMoney(cf.tot.net)}</b></td><td><b>${rate(cf.tot.net, cf.tot.income)}</b></td>` : ""}</tr></tbody></table></div>
  ${cf.hasRepaid ? `<p class="muted" style="font-size:12.5px;margin:6px 0 0">${t("其中「还款」= 还给个人赠与 / 借款的钱：钱从账户里出去了，已经算在花费里（记还款时默认同时记一笔花费；银行导入的转账也会算），这一列只是告诉你其中有多少。差额 = 收入 − 花费。")}</p>` : ""}</div>`;

/* ───────────── 概览：和「花费」同一套——时间条 → 数字卡片 → 图表；下面是二级入口 ───────────── */
/** 概览 / 类型页共用的时间范围和成员（切标签不丢）；时间范围和花费页同一套：本月 / 近 3·6·9·12 个月 / 今年 / 往年（logic.js 的 span*） */
const OV = () => {
  const o = (inc().ov ||= { range: "12", person: "all", month: "", kind: "" });
  if (!spanOk(o.range)) o.range = "12";
  if (!(o.person === "all" || o.person === "none" || adults().some((p) => p.id === o.person))) o.person = "all";
  return o;
};
const ovUnit = (range) => (range === "m" ? "biweek" : "month");
const dayDiff = (a, b) => Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 864e5);
const kpiS = (label, val, small = "", drill = "") => `<div class="kpi${drill ? " ch-hit-row" : ""}"${hitAttrs(drill, label)}><span>${esc(label)}</span><b>${val}</b>${small}</div>`;
const changeHtml = (now, before) => (before > 0 ? `<small class="${now >= before ? "gain" : "loss"}">${now >= before ? t("比上期多 {p}%", { p: Math.round(((now - before) / before) * 100) }) : t("比上期少 {p}%", { p: Math.round(((before - now) / before) * 100) })}</small>` : `<small>${t("上期没有收入")}</small>`);
const senderLabel = (x) => x.rows.find((r) => r.source_name)?.source_name || x.key;
const ovBar = (O, { keys = null, cf = null } = {}) => `<div class="time-bar"><label class="tb-field"><span>${t("时间范围")}</span><select data-inc-ov="range" class="range-sel" data-nosearch>${spanOptionsHtml(O.range)}</select></label>
  <label class="tb-field"><span>${t("谁的")}</span><select data-inc-ov="person" data-nosearch>${personOptions(O.person, { all: true })}</select></label>
  ${keys ? `<label class="tb-field"><span>${t("月份")}</span><select data-inc-ov="month" data-nosearch><option value="">${t("整段（{r}）", { r: spanLabel(O.range) })}</option>${[...keys].reverse().map((k) => `<option value="${k}" ${k === O.month ? "selected" : ""}>${esc(periodLabel(k, "month"))}</option>`).join("")}</select></label>` : ""}${cf ? togglesHtml(cf) : ""}</div>`;
/** 每个周期按收入类型的金额：{ 类型（合并时是大类）: { periodKey: 金额 } } */
const kindGrid = (cf) => { const g = {}, m = inc().merge; for (const r of cf.rows) { const b = bucketKey(r.received_on, cf.unit); (g[statKind(r.kind, m)] ||= Object.fromEntries(cf.keys.map((k) => [k, 0])))[b] += r.amount; } return g; };
/** 付款方排行：名字 + 金额 + 占比条 */
const rankHtml = (list, total, cf) => `<ul class="ix-rank">${list.map((x) => `<li><div class="rk-top"><button type="button" class="link-name" data-drill="${esc(incDrill({ q: senderLabel(x), ...cf.w, person: cf.person }))}">${esc(senderLabel(x))}</button><b>${fmtMoney(x.total)}</b></div>
  <div class="rk-bar" aria-hidden="true"><i style="width:${total > 0 ? Math.max(2, Math.round((x.total / total) * 100)) : 0}%"></i></div><small class="muted">${t("{n} 次", { n: x.n })} · ${rate(x.total, total)}</small></li>`).join("")}</ul>`;
function overviewTab() {
  const I = inc(), O = OV();
  if (!I.rec.length) return empty();
  const cf = cashflow({ win: spanWindow(O.range), unit: ovUnit(O.range), person: O.person }), pw = spanPrev(O.range), before = sumOf(incomeIn(pw.from, pw.to, O.person).filter((r) => I.extra || !isExtra(r.kind)));
  const months = Math.max(1, dayDiff(cf.w.from, cf.w.to) / 30.4), g = kindGrid(cf), labels = cf.lines.map((l) => l.label);
  const biggest = cf.rows.reduce((m, r) => (r.amount > (m?.amount || 0) ? r : m), null), ks = statKinds(I.merge).filter((k) => g[k.id]);
  const all = incDrill({ ...cf.w, person: O.person });
  const kpis = `<div class="kpis">${kpiS(t("收入"), fmtMoney(cf.tot.income), changeHtml(cf.tot.income, before), all)}${kpiS(t("月均收入"), fmtMoney(cf.tot.income / months), `<small>${t("{n} 笔收入", { n: cf.rows.length })} ›</small>`, all)}
    ${cf.hasSpend ? `${kpiS(t("花费"), fmtMoney(cf.tot.spend), `<small>${t("月均 {m}", { m: fmtMoney(cf.tot.spend / months, true) })}</small>`)}${kpiS(t("结余（收入 − 花费）"), `<span class="${cf.tot.net < 0 ? "down" : ""}">${fmtMoney(cf.tot.net)}</span>`, `<small class="${cf.tot.net < 0 ? "loss" : "gain"}">${t("结余率 {r}", { r: rate(cf.tot.net, cf.tot.income) })}</small>`)}`
      : kpiS(t("最大一笔"), biggest ? fmtMoney(biggest.amount) : "—", biggest ? `<small>${esc(biggest.source_name)}</small>` : "", biggest ? incDrill({ q: biggest.source_name, from: biggest.received_on, to: biggest.received_on, person: O.person }) : "")}</div>`;
  const kindBars = window.Charts && cf.rows.length ? `<div class="panel chart-panel"><h3>${t("每{u}收入（按类型）", { u: t((UNITS.find((u) => u[0] === cf.unit) || [])[1]) })}</h3>${window.Charts.bars({ labels, title: t("收入（按类型）"), fmt: fmtMoney,
    drill: (k, i) => incDrill({ kind: ks[k].id, ...periodWin(cf.keys[i], cf.unit, cf.w), person: O.person }), legendDrill: (k) => incDrill({ kind: ks[k].id, ...cf.w, person: O.person }),
    series: ks.map((k) => ({ name: `${k.icon} ${kindLabel(k.id)}`, color: k.color, values: cf.keys.map((x) => R2(g[k.id][x])) })) })}${DRILL_HINT()}</div>` : `<div class="panel empty"><strong>${t("这段时间没有收入")}</strong>${t("换个时间范围，或点右上角「记一笔收入」。")}</div>`;
  const senders = groupSum(cf.rows, (r) => skey(r.source_name)), top = senders.slice(0, 5), total = sumOf(cf.rows);
  const rank = top.length ? `<div class="panel"><div class="chart-head"><h3>${t("主要付款方")}</h3><a class="btn btn-sm btn-ghost" href="${incomeHref("senders")}">${t("全部付款方")} ›</a></div>${rankHtml(top, total, cf)}</div>` : "";
  const byP = groupSum(cf.rows, (r) => r.person_id || "");
  const members = byP.length > 1 || (byP.length === 1 && byP[0].key) ? `<div class="panel"><h3 style="margin:0 0 8px">${t("按成员")}</h3><div class="ch-scroll"><table class="store-table ix-tbl"><thead><tr><th scope="col">${t("成员")}</th><th scope="col">${t("笔数")}</th><th scope="col">${t("合计")}</th><th scope="col">${t("占比")}</th></tr></thead><tbody>
    ${byP.map((x) => `<tr class="ch-hit-row"${hitAttrs(incDrill({ ...cf.w, person: x.key || "none" }), x.key ? personName(x.key) : t("未指定 / 全家"))}><th scope="row">${esc(x.key ? personName(x.key) || t("已删除的成员") : t("未指定 / 全家"))}</th><td>${x.n}</td><td>${fmtMoney(x.total)}</td><td>${rate(x.total, total)}</td></tr>`).join("")}
    <tr><th scope="row"><b>${t("全家合计")}</b></th><td><b>${byP.reduce((a, x) => a + x.n, 0)}</b></td><td><b>${fmtMoney(total)}</b></td><td>100%</td></tr></tbody></table></div></div>` : "";
  const recent = I.rec.filter((r) => personOk(r, O.person)).slice().sort((a, b) => b.received_on.localeCompare(a.received_on) || String(b.created_at).localeCompare(String(a.created_at))).slice(0, 5);
  const recentHtml = recent.length ? `<div class="panel"><div class="chart-head"><h3>${t("最近到账")}</h3><a class="btn btn-sm btn-ghost" href="${incomeHref("records")}">${t("全部明细")} ›</a></div><ul class="restock-list ix-list">${recent.map(recordRow).join("")}</ul></div>` : "";
  return `${ovBar(O, { cf })}${kpis}${cf.loading ? `<p class="muted" role="status">${t("正在读取花费…")}</p>` : ""}${kindBars}
    ${flowCharts(cf, t("收入 vs 花费"), { trend: false })}
    <div class="ix-two">${kindDonut(cf)}${rank}</div>${members}${recentHtml}${repayPanel()}
    ${tabHub(INCOME_TABS, incomeHref, t("其他功能"))}`;
}

/* ───────────── 类型：占比 + 单个类型的月度趋势（对应花费的「分类」页） ───────────── */
function categoryTab() {
  const I = inc(), O = OV();
  if (!I.rec.length) return empty();
  const cf = cashflow({ win: spanWindow(O.range), unit: "month", person: O.person }), g = kindGrid(cf);
  if (O.month && !cf.keys.includes(O.month)) O.month = "";
  const sum = (id) => R2(O.month ? g[id]?.[O.month] || 0 : cf.keys.reduce((a, k) => a + (g[id]?.[k] || 0), 0));
  const cnt = (id) => cf.rows.filter((r) => statKind(r.kind, I.merge) === id && (!O.month || bucketKey(r.received_on, "month") === O.month)).length;
  const kinds = statKinds(I.merge).filter((k) => g[k.id] && sum(k.id) > 0).sort((a, b) => sum(b.id) - sum(a.id));
  const bar = ovBar(O, { keys: cf.keys, cf }), win = O.month ? periodWin(O.month, "month", cf.w) : cf.w, kd = (id) => incDrill({ kind: id, ...win, person: O.person });
  if (!kinds.length) return `${bar}<div class="panel empty"><strong>${t("这段时间没有收入")}</strong>${t("换个时间范围或月份。")}</div>`;
  const sel = kinds.find((k) => k.id === O.kind) || kinds[0], total = R2(kinds.reduce((a, k) => a + sum(k.id), 0));
  const donut = window.Charts.donut({ title: t("收入类型占比"), fmt: fmtMoney, center: fmtMoney(total, true), items: kinds.map((k) => ({ name: `${k.icon} ${kindLabel(k.id)}`, color: k.color, value: sum(k.id), drill: kd(k.id) })) });
  const trend = window.Charts.line({ title: t("{k}月度收入趋势", { k: kindLabel(sel.id) }), labels: cf.keys.map((k) => periodLabel(k, "month")), fmt: fmtMoney, series: [{ name: kindLabel(sel.id), color: sel.color, values: cf.keys.map((k) => R2(g[sel.id]?.[k] || 0)) }],
    drill: (_, i) => incDrill({ kind: sel.id, ...periodWin(cf.keys[i], "month", cf.w), person: O.person }) });
  const table = `<div class="panel"><div class="ch-scroll"><table class="store-table ix-tbl"><thead><tr><th scope="col">${t("类型")}</th><th scope="col">${t("笔数")}</th><th scope="col">${t("合计")}</th><th scope="col">${t("占比")}</th><th scope="col">${t("平均每笔")}</th></tr></thead><tbody>
    ${kinds.map((k) => `<tr class="ch-hit-row"${hitAttrs(kd(k.id), kindLabel(k.id))}><th scope="row">${kindBadge(k.id)}</th><td>${cnt(k.id)}</td><td>${fmtMoney(sum(k.id))}</td><td>${rate(sum(k.id), total)}</td><td>${fmtMoney(cnt(k.id) ? sum(k.id) / cnt(k.id) : 0)}</td></tr>`).join("")}
    <tr><th scope="row"><b>${t("合计")}</b></th><td><b>${kinds.reduce((a, k) => a + cnt(k.id), 0)}</b></td><td><b>${fmtMoney(total)}</b></td><td>100%</td><td></td></tr></tbody></table></div></div>`;
  return `${bar}<div class="ix-two"><div class="panel chart-panel"><h3>${t("类型占比")}</h3>${donut}${DRILL_HINT()}</div>${table}</div>
    <div class="panel chart-panel"><h3>${t("单个类型的月度趋势")}</h3>
      <div class="chips" role="group" aria-label="${esc(t("选择类型"))}">${kinds.map((k) => `<button type="button" class="chip" data-inc="ov-kind" data-id="${esc(k.id)}" aria-pressed="${k.id === sel.id}">${k.icon} ${esc(kindLabel(k.id))}</button>`).join("")}</div>
      ${trend}<div class="form-actions"><button type="button" class="btn btn-sm" data-drill="${esc(kd(sel.id))}">${t("查看「{k}」的明细", { k: kindLabel(sel.id) })} ›</button></div></div>`;
}

/* ───────────── 银行导入：对账单里的入账补入收入（和「花费 → 银行导入」是同一个入口） ───────────── */
function importTab() {
  const batches = (meta("_bank_batches", []) || []).filter((b) => b.inN).slice().reverse().slice(0, 20);
  return `<div class="panel"><h3 style="margin:0 0 6px">🏦 ${t("从银行对账单导入收入")}</h3>
    <p class="muted small" style="margin:0 0 10px">${t("同一个入口：选一次对账单（CSV、Excel、OFX、PDF、截图），里面刷卡 / 扣款记成花费，工资、电汇、Zelle 转入这些入账单独列出来记成收入，互不重复。自己账户之间的转账会跳过。")}</p>
    <div class="form-actions"><a class="btn btn-primary btn-sm" href="${href("bills", "statements")}">${t("去导入对账单")}</a><a class="btn btn-sm" href="${incomeHref("records")}">${t("或者拍照 / 手动记一笔")}</a></div></div>
  <div class="panel"><h3 style="margin:0 0 6px">${t("最近导入的收入")}</h3>${batches.length ? `<ul class="restock-list">${batches.map((b) => `<li><div class="grow"><span class="name">${b.account ? `🏦 ${esc(b.account)}` : esc(b.file || t("银行导入"))}</span><small>${t("收入 {n} 笔", { n: b.inN })} · ${fmtMoney(b.inSum || 0)} · ${t("导入于 {d}", { d: String(b.at).slice(0, 10) })}</small></div><a class="btn btn-sm btn-ghost" href="${href("bills", "income")}?tab=records&batch=${esc(b.id)}">${t("查看收入")}</a></li>`).join("")}</ul>` : `<p class="muted small" style="margin:0">${t("还没有从对账单导入过收入。")}</p>`}</div>`;
}

function repayPanel() {
  const list = openRepayments(); if (!list.length) return "";
  return `<div class="panel"><h3 style="margin:0 0 8px">🤝 ${t("还没还清的（个人赠与 / 借款）")}</h3><ul class="restock-list">${list.map(({ r, s }) => `<li><div class="grow"><span class="name">${esc(r.source_name)} · ${fmtMoney(s.total)}</span><small>${t("已还 {a}，还差 {b}", { a: fmtMoney(s.paid), b: fmtMoney(s.left) })}${r.repay_due_on ? ` · ${s.overdue ? `<b class="bank-dup">${t("已逾期")}</b> ` : ""}${t("到期日 {d}", { d: r.repay_due_on })}` : ""}</small></div>
    <button type="button" class="btn btn-sm btn-ghost" data-inc="open" data-id="${r.id}">${t("去还款")}</button></li>`).join("")}</ul></div>`;
}

/* ───────────── 明细 ───────────── */
/** 图表钻取的查询串 → 明细筛选：类型（小类 / g:大类）、日期段 from–to、成员、搜索、ex = 不含国际电汇 / 个人赠与 */
function applyIncomeDrill(q) {
  const I = inc(), d = (k) => (/^\d{4}-\d{2}-\d{2}$/.test(q.get(k) || "") ? q.get(k) : "");
  Object.assign(I, { q: q.get("q") || "", kind: q.get("kind") || "all", person: q.get("person") || "all", year: "all", month: "all", batch: null, from: d("from"), to: d("to"), ex: q.get("ex") === "1", limit: 40, open: null, selMode: false });
}
function filteredRecords() {
  const I = inc(), q = skey(I.q);
  return I.rec.filter((r) => kindMatch(I.kind, r.kind) && (I.person === "all" || (I.person === "none" ? !r.person_id : r.person_id === I.person)) && (I.year === "all" || r.received_on.startsWith(I.year)) && (!I.batch || r.import_batch === I.batch) && (!I.month || I.month === "all" || r.received_on.slice(5, 7) === I.month)
    && (!I.from || r.received_on >= I.from) && (!I.to || r.received_on <= I.to) && (!I.ex || !isExtra(r.kind))
    && (!q || skey(`${r.source_name} ${r.notes || ""} ${r.account || ""} ${kindLabel(r.kind)} ${kindOf(r.kind).name} ${groupOf(r.kind).name}`).includes(q))).sort(SORTS[I.sort] || SORTS.new);
}
const kindRank = (id) => { const i = kindList().findIndex((k) => k.id === id); return i < 0 ? 999 : i; };
const SORTS = { new: (a, b) => b.received_on.localeCompare(a.received_on) || String(b.created_at).localeCompare(String(a.created_at)), old: (a, b) => a.received_on.localeCompare(b.received_on), big: (a, b) => b.amount - a.amount, small: (a, b) => a.amount - b.amount,
  kind: (a, b) => kindRank(a.kind) - kindRank(b.kind) || b.received_on.localeCompare(a.received_on) };   // 按类型：大类 → 小类的顺序，同类里新的在前
/** 明细顶部「当前筛选」：图表点进来的日期段、不含电汇 / 赠与，可逐个去掉（和花费明细的筛选条一样） */
function drillChips() {
  const I = inc(), out = [];
  if (I.from || I.to) out.push(["range", I.from === I.to ? I.from : `${I.from || "…"} → ${I.to || "…"}`]);
  if (I.ex) out.push(["ex", t("不含国际电汇 / 个人赠与")]);
  if (!out.length) return "";
  return `<div class="filter-chips" role="group" aria-label="${esc(t("当前筛选"))}"><span class="muted">${t("当前筛选")}</span>${out.map(([k, label]) => `<button type="button" class="chip fchip" data-inc="drill-clear" data-k="${k}" aria-label="${esc(t("去掉筛选：{x}", { x: label }))}">${esc(label)} <span aria-hidden="true">✕</span></button>`).join("")}</div>`;
}
const canEdit = (r) => isOwnerNow() || r.created_by === state.user?.id;
/** 正在改哪一条：它就在已显示的列表里时，表单在那一行下面展开；否则（被筛掉 / 还没翻到）表单放顶部 */
const inlineEditId = () => { const I = inc(), id = I.form?.rec?.id; return id && activeTab(state.route) === "records" && filteredRecords().slice(0, I.limit).some((x) => x.id === id) ? id : null; };
function recordRow(r) {
  const I = inc(), s = repayState(r), pick = !!I.selMode && activeTab(state.route) === "records", editing = !pick && inlineEditId() === r.id, open = I.open === r.id && !editing;
  const who = r.person_id ? personName(r.person_id) : "", sub = [r.received_on, esc(kindLabel(r.kind)), who && esc(who), r.account && esc(r.account), r.channel && esc(t((CHANNELS.find((c) => c[0] === r.channel) || [])[1] || ""))].filter(Boolean).join(" · ");
  const rb = s ? `<span class="badge ${s.status === "paid" ? "b-ok" : s.overdue ? "b-out" : "b-soon"}">${s.status === "paid" ? t("已还清") : s.overdue ? t("逾期") : t("待还 {a}", { a: fmtMoney(s.left) })}</span>` : "";
  return `<li class="ix-li${open || editing ? " is-open" : ""}" data-id="${r.id}"${canEdit(r) && !pick && !editing ? ' data-swipe-del="income"' : ""}>${pick ? `<label class="ix-main"><input type="checkbox" class="ix-chk" data-inc-sel="${r.id}" ${I.sel?.has(r.id) ? "checked" : ""} ${canEdit(r) ? "" : "disabled"} aria-label="${esc(t("选择"))}">` : `<button type="button" class="ix-main" data-inc="${canEdit(r) ? "edit" : "open"}" data-id="${r.id}" ${canEdit(r) ? `title="${esc(editing ? t("再点一下收起") : t("点一下编辑"))}" aria-expanded="${editing}"` : `aria-expanded="${open}"`}>`}
    <span class="ix-ico" style="--k:${kindOf(r.kind).color}" aria-hidden="true">${kindOf(r.kind).icon}</span><span class="grow"><b class="name">${esc(r.source_name)}</b><small>${sub}</small></span><span class="ix-side"><b class="ix-amt">+${fmtMoney(r.amount)}</b>${I.drafts?.[r.id] ? `<span class="badge b-soon">${t("草稿")}</span>` : ""}${rb}</span>${pick ? "</label>" : "</button>" + rowTools(r, open)}${editing ? `<div class="ix-edit">${formHtml()}</div>` : ""}${open && !pick ? recordDetail(r, s) : ""}</li>`;
}
/** 行右边：▾ 展开 / 收起详情（还款、备注、原币种…）；隐藏的「删除」给左滑用（js/swipe-rows.js），键盘 Tab 到它也能删 */
const rowTools = (r, open) => `<button type="button" class="ix-more" data-inc="open" data-id="${r.id}" aria-expanded="${open}" aria-label="${esc(t("展开详情"))}" title="${esc(t("展开详情"))}">${open ? "▴" : "▾"}</button>${canEdit(r) ? `<button type="button" class="swipe-src" data-inc="del-swipe" data-id="${r.id}">${t("删除")}</button>` : ""}`;
function recordDetail(r, s) {
  const extra = [r.orig_amount && `${t("原币种")} ${r.orig_amount} ${r.orig_currency || ""}`, r.fee != null && `${t("手续费")} ${fmtMoney(r.fee)}`, r.import_batch && t("银行导入"), r.created_by && r.created_by !== state.user?.id && memberLabel(r.created_by) && t("{n} 记的", { n: memberLabel(r.created_by) })].filter(Boolean);
  const reps = inc().rep.filter((p) => p.record_id === r.id).sort((a, b) => b.paid_on.localeCompare(a.paid_on));
  const repay = s ? `<div class="ix-repay"><b>🤝 ${t("还款（还给对方）")}</b> · ${t("总额 {a}，已还 {b}，还差 {c}", { a: fmtMoney(s.total), b: fmtMoney(s.paid), c: fmtMoney(s.left) })}${r.repay_due_on ? ` · ${t("到期日 {d}", { d: r.repay_due_on })}` : ""}
    <ul class="ix-reps">${reps.map((p) => `<li><span>${p.paid_on} · <b>${fmtMoney(p.amount)}</b>${p.method ? ` · ${esc(p.method)}` : ""}${p.purchase_id ? ` · <span class="muted">${t("已计入花费")}</span>` : ""}</span><button type="button" class="btn btn-sm btn-ghost" data-inc="rep-del" data-id="${p.id}">${t("删除")}</button></li>`).join("") || `<li class="muted">${t("还没有还款记录")}</li>`}</ul>
    ${s.left > 0 ? `<form data-inc-form="repay" data-id="${r.id}" class="form-grid" style="margin-top:6px"><label>${t("还款日期")}<input type="date" name="paid_on" value="${todayISO()}" required></label><label>${t("金额")}<input type="number" name="amount" step="0.01" min="0.01" value="${s.left}" required></label><label>${t("方式")}<input name="method" maxlength="40" placeholder="Zelle / ${esc(t("现金"))}"></label><label class="check-inline" style="grid-column:1/-1"><input type="checkbox" name="as_spend" checked><span>${t("同时记为一笔花费（钱从账户里出去了）")}</span></label><small class="muted" style="grid-column:1/-1">${t("如果这笔转账已经从银行对账单导入成花费了，系统会发现并不再重复记；也可以取消勾选。")}</small><div class="form-actions"><button class="btn btn-sm btn-primary">${t("记一笔还款")}</button></div></form>` : ""}</div>` : "";
  return `<div class="ix-detail">${extra.length ? `<p class="muted small" style="margin:0 0 6px">${extra.map(esc).join(" · ")}</p>` : ""}${r.notes ? `<p style="margin:0 0 6px">${esc(r.notes)}</p>` : ""}${repay}
    ${canEdit(r) ? `<div class="form-actions"><button type="button" class="btn btn-sm" data-inc="edit" data-id="${r.id}">${t("编辑")}</button><button type="button" class="btn btn-sm btn-ghost" data-inc="del" data-id="${r.id}">${t("删除")}</button></div>` : ""}</div>`;
}
const selBar = () => { const I = inc(); return I.selMode ? `<div class="ix-selbar"><span id="incSelN" role="status">${t("已选 {n} 笔", { n: I.sel?.size || 0 })}</span><button type="button" class="btn btn-sm btn-ghost" data-inc="sel-all">${t("全选当前显示的")}</button><button type="button" class="btn btn-sm" data-inc="sel-del">${t("删除所选")}</button></div>` : ""; };
const listHtml = () => {
  const I = inc(), all = filteredRecords(), head = all.slice(0, I.limit);
  return `${selBar()}<div class="muted small" style="margin:0 0 6px">${t("{n} 笔，合计 {m}", { n: all.length, m: fmtMoney(sumOf(all)) })}</div><ul class="restock-list ix-list">${head.map(recordRow).join("") || `<li class="muted">${t("没有符合条件的记录")}</li>`}</ul>
    ${all.length > head.length ? `<div class="form-actions" style="justify-content:center"><button type="button" class="btn btn-sm btn-ghost" data-inc="more">${t("再看 40 笔（还有 {n} 笔）", { n: all.length - head.length })}</button></div>` : ""}`;
};
export const renderIncList = () => { const el = $("#incList"); if (el) el.innerHTML = listHtml(); };
/** 三种记法（和「记一笔花费」一样）：手动 / 拍照识别 / 导入对账单 */
const waysHtml = () => { const I = inc(), newOpen = !!I.form && !I.form.rec?.id; return `<div class="entry-ways" role="group" aria-label="${esc(t("三种记法"))}">
  <button type="button" class="way ${newOpen ? "is-cur" : ""}" data-inc="way-manual" aria-pressed="${newOpen ? "true" : "false"}"><span class="way-ico" aria-hidden="true">✍️</span><span>${t("手动记一笔")}</span></button>
  <button type="button" class="way ${I.scanOpen ? "is-cur" : ""}" data-inc="way-scan" aria-pressed="${I.scanOpen ? "true" : "false"}"><span class="way-ico" aria-hidden="true">📷</span><span>${t("拍照识别")}</span></button>
  <a class="way" href="${href("bills", "statements")}"><span class="way-ico" aria-hidden="true">🏦</span><span>${t("导入对账单")}</span></a></div>`; };
function recordsTab() {
  const I = inc(), top = `${waysHtml()}${I.scanOpen ? scanHtml() : ""}${I.form && !inlineEditId() ? formHtml() : ""}`;
  if (!I.rec.length && !I.form) return top + empty() + kindManager();
  return `${top}<div class="panel"><div class="form-grid ix-filter">
    <label>${t("搜索")}<input type="search" data-inc-f="q" value="${esc(I.q)}" placeholder="${esc(t("付款方 / 备注"))}"></label>
    <label>${t("类型")}<select data-inc-f="kind">${kindOptionsHtml(I.kind, { all: true, groups: true })}</select></label>
    <label>${t("谁的")}<select data-inc-f="person" data-nosearch>${personOptions(I.person, { all: true })}</select></label>
    <label>${t("年份")}<select data-inc-f="year" data-nosearch><option value="all">${t("全部")}</option>${yearsOf().map((v) => `<option value="${v}" ${I.year === v ? "selected" : ""}>${v}</option>`).join("")}</select></label>
    <label>${t("月份")}<select data-inc-f="month" data-nosearch><option value="all">${t("全部")}</option>${Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map((m) => `<option value="${m}" ${I.month === m ? "selected" : ""}>${t("{m} 月", { m: +m })}</option>`).join("")}</select></label>
    <label>${t("排序")}<select data-inc-f="sort" data-nosearch>${selOpts([["new", "最近的在前"], ["old", "最早的在前"], ["big", "金额从大到小"], ["small", "金额从小到大"], ["kind", "按类型（大类 - 小类）"]], I.sort || "new")}</select></label></div>
    ${drillChips()}
    ${I.batch ? `<div class="muted small" style="margin-top:8px">${t("只看一次银行导入的入账")} <button type="button" class="btn btn-sm btn-ghost" data-inc="batch-clear">${t("看全部收入")}</button></div>` : ""}
    <div class="ix-tools"><button type="button" class="btn btn-sm btn-ghost" data-inc="sel-toggle">${I.selMode ? t("退出多选") : t("多选删除")}</button><button type="button" class="btn btn-sm btn-ghost" data-inc="print-list">${t("打印")}</button><button type="button" class="btn btn-sm btn-ghost" data-inc="csv-detail">${t("导出当前列表 CSV")}</button></div>
    <div id="incList" style="margin-top:8px">${listHtml()}</div>
  </div>${kindManager()}`;
}
function kindManager() {
  const cs = customKinds();
  return `<details class="panel ref-panel" style="margin-top:10px"><summary><b>${t("管理收入类型")}</b><small>${t("内置 {n} 种，自定义 {m} 种", { n: 14, m: cs.length })}</small><span class="mch" aria-hidden="true">›</span></summary><div class="ref-body">
    <p class="muted small" style="margin:0 0 6px">${t("内置类型的大类：{g}", { g: GROUPS.map(([, n, , , ids]) => `${t(n)}（${ids.map((id) => t(kindOf(id).name)).join("、")}）`).join("；") })}</p>
    <ul class="plain small">${cs.map((k) => `<li>${esc(k.icon || "🏷️")} ${esc(kindLabel(k.id))} <select data-inc-kparent="${esc(k.id)}" aria-label="${esc(t("大类"))}" data-nosearch>${GROUPS.map(([g, n]) => `<option value="${g}" ${k.parent === g ? "selected" : ""}>${esc(t(n))}</option>`).join("")}</select> <button type="button" class="btn btn-sm btn-ghost" data-inc="kind-del" data-id="${esc(k.id)}">${t("删除")}</button></li>`).join("") || `<li class="muted">${t("还没有自定义类型")}</li>`}</ul>
    <form data-inc-form="kind" class="form-grid"><label>${t("大类")}<select name="parent" data-nosearch>${GROUPS.map(([g, n]) => `<option value="${g}" ${g === "other" ? "selected" : ""}>${esc(t(n))}</option>`).join("")}</select></label><label>${t("图标")}<input name="icon" maxlength="4" value="🏷️" style="width:4em"></label><label>${t("名称")}<input name="name" maxlength="20" required placeholder="${esc(t("例如：稿费、副业"))}"></label><div class="form-actions"><button class="btn btn-sm">${t("添加类型")}</button></div></form></div></details>`;
}

/* ── 入账账户：和「记花费」的付款账户同一套下拉（用卡里登记的银行账户 / 借记卡 / 钱包），可设默认 ──
 * 记录上存的还是文字（income_records.account，不改数据库）：登记过的账户存「名称 ••尾号」，现金存「现金」，其他手填。
 * 默认账户按人存在预算设置 _income_cfg.defAcct[用户 id]（登记账户的 id 或 cash）。 */
const INCOME_ACCT_KINDS = ["checking", "savings", "debit", "wallet"];
const INCOME_ACCT_EXTRA = [["cash", "现金"], ["other", "其他（手填）"]];
const acctText = (c) => `${c.name}${c.last4 ? ` ••${c.last4}` : ""}`;
const incomeAccts = () => (state.cards || []).filter((c) => INCOME_ACCT_KINDS.includes(c.kind || "credit"));
const hasBankAcct = () => incomeAccts().some((c) => c.active !== false);
const incCfg = () => meta("_income_cfg", {}) || {};
const defAcct = () => incCfg().defAcct?.[state.user?.id || "me"] || "";
/** 默认账户还在（没被删 / 没停用）才用 */
const defAcctValid = () => { const v = defAcct(); return v === "cash" || (v && incomeAccts().some((c) => c.id === v && c.active !== false)) ? v : ""; };
/** 记录上的账户文字 → 下拉的值：登记账户 id / cash / other / 空 */
function acctValueOf(text) {
  const s = String(text || "").trim(); if (!s) return "";
  if (s === "现金" || /^cash$/i.test(s)) return "cash";
  const list = incomeAccts(), exact = list.find((c) => acctText(c) === s);
  if (exact) return exact.id;
  const byLast4 = list.find((c) => c.last4 && new RegExp(`(^|[^0-9])${c.last4}($|[^0-9])`).test(s));   // 银行导入记的「Chase ····1234」这类
  return byLast4 ? byLast4.id : "other";
}
function acctSelectHtml(sel) {
  const def = defAcct(), list = incomeAccts().filter((c) => c.active !== false || c.id === sel);
  const opt = (v, label) => `<option value="${esc(v)}" ${v === sel ? "selected" : ""}>${esc(label)}${v && v === def ? ` ★ ${t("默认")}` : ""}</option>`;
  const groups = Object.entries(ACCT_KINDS).map(([k, [name]]) => { const cs = list.filter((c) => (c.kind || "credit") === k); return cs.length ? `<optgroup label="${esc(t(name))}">${cs.map((c) => opt(c.id, acctText(c))).join("")}</optgroup>` : ""; }).join("");
  return `${opt("", t("（未指定）"))}${groups}${INCOME_ACCT_EXTRA.map(([v, l]) => opt(v, t(l))).join("")}`;
}
/* ── 其他默认值（选填）：付款方 / 类型 / 收款方式，同样按人存在 _income_cfg.defs[用户 id]；只在「新记一笔」时预填 ── */
const DEF_FIELDS = [["source_name", "付款方"], ["kind", "类型"], ["channel", "收款方式"]];
const defOf = (k) => String(incCfg().defs?.[state.user?.id || "me"]?.[k] || "");
/** 类型 / 收款方式的默认值已经被删掉（自定义类型）时不再用 */
const defValid = (k) => { const v = defOf(k); return k === "kind" ? (kindList().some((x) => x.id === v) ? v : "") : k === "channel" ? (CHANNELS.some((c) => c[0] === v) ? v : "") : v; };
const defsHtml = (r) => `<div class="ix-acct-def"><small class="muted">${t("设为我的默认（选填，下次记收入时自动带上）")}</small><div class="chips">${DEF_FIELDS.map(([k, l]) => `<label class="check-inline"><input type="checkbox" name="def_${k}" data-inc-def="${k}" ${r[k] && r[k] === defValid(k) ? "checked" : ""}><span>${t(l)}</span></label>`).join("")}</div></div>`;
async function saveDefaults(fd) {
  const g = (k) => String(fd.get(k) ?? "").trim(), cfg = incCfg(), uid = state.user?.id || "me", mine = { ...(cfg.defs?.[uid] || {}) };
  let changed = false;
  for (const [k] of DEF_FIELDS) {
    const want = fd.get(`def_${k}`) === "on", val = g(k), was = defOf(k);
    const next = want && val ? val : !want && val === was ? "" : was;   // 勾上：记住当前值；取消勾选且当前值正是默认：清掉
    if (next !== was) { changed = true; if (next) mine[k] = next; else delete mine[k]; }
  }
  if (changed) await saveMeta({ _income_cfg: { ...cfg, defs: { ...(cfg.defs || {}), [uid]: mine } } });
}
async function saveDefaultAcct(value) {
  const cfg = incCfg(); await saveMeta({ _income_cfg: { ...cfg, defAcct: { ...(cfg.defAcct || {}), [state.user?.id || "me"]: value } } });
}

/* ── 表单 ── */
function formHtml() {
  const I = inc(), f = I.form, owner = isOwnerNow(), mine = myPersonId();
  let r = f.rec || {};
  const person = r.person_id !== undefined ? r.person_id : mine, d = (v) => esc(v ?? "");
  if (!r.id) r = { ...r, source_name: r.source_name || defValid("source_name") || undefined, kind: r.kind || defValid("kind") || undefined, channel: r.channel || defValid("channel") || undefined };   // 新记一笔：预填默认的付款方 / 类型 / 收款方式
  const accVal = r.id ? acctValueOf(r.account) : defAcctValid();   // 新记一笔默认选上你设的默认账户；编辑按原来的文字对上登记过的账户
  const persons = owner ? personOptions(person || "none") : `<option value="${mine || "none"}">${esc(personName(mine) || t("未指定 / 全家"))}</option>`;
  return `<form class="panel" data-inc-form="record" id="incForm" autocomplete="off"><h3 style="margin:0 0 8px">${r.id ? t("编辑收入") : t("记一笔收入")}</h3>
    <div class="form-grid">
      <label>${t("到账日期")}<input type="date" name="received_on" value="${d(r.received_on || todayISO())}" required></label>
      <label>${t("到账金额")}（${esc(cur())}）<input type="number" name="amount" step="0.01" min="0.01" inputmode="decimal" value="${d(r.amount)}" required></label>
      <label>${t("谁给的（付款方 / 雇主）")}<input name="source_name" list="incSenders" maxlength="80" value="${d(r.source_name)}" required placeholder="${esc(t("公司名 / 汇款人"))}"><datalist id="incSenders">${knownSenders().map((s) => `<option value="${esc(s)}">`).join("")}</datalist></label>
      <label>${t("类型")}<select name="kind">${kindOptionsHtml(r.kind || "other")}</select></label>
      <label>${t("收款方式")}<select name="channel" data-nosearch><option value="">${t("未填")}</option>${selOpts(CHANNELS, r.channel)}</select></label>
      ${defsHtml(r)}
      <label>${t("这是谁的收入")}<select name="person_id" data-nosearch>${persons}</select></label>
      <label>${t("入到哪个账户")}<select name="acct_sel" data-inc-acct>${acctSelectHtml(accVal)}</select>
        <input name="account" maxlength="60" value="${accVal === "other" ? d(r.account) : ""}" placeholder="Chase ····1234" style="margin-top:6px" ${accVal === "other" ? "" : "hidden"}></label>
      <div class="ix-acct-def"><label class="check-inline"><input type="checkbox" name="acct_default" ${accVal && accVal === defAcct() ? "checked" : ""}><span>${t("设为我的默认入账账户")}</span></label>
        ${hasBankAcct() ? "" : `<small class="muted">${t("还没登记银行账户？到「用卡」里登记后，这里就能选。")} <a href="${CARDS_HREF()}">${t("去登记")}</a></small>`}</div>
      <label>${t("备注")}<input name="notes" maxlength="500" value="${d(r.notes)}"></label></div>
    <details style="margin-top:8px" ${r.orig_amount || r.fee != null ? "open" : ""}><summary>${t("国际电汇 / 外币（选填）")}</summary><div class="form-grid" style="margin-top:6px">
      <label>${t("汇出金额（原币种）")}<input type="number" name="orig_amount" step="0.01" min="0" value="${d(r.orig_amount)}"></label><label>${t("原币种")}<input name="orig_currency" maxlength="3" value="${d(r.orig_currency)}" placeholder="CNY"></label>
      <label>${t("手续费")}<input type="number" name="fee" step="0.01" min="0" value="${d(r.fee)}"></label></div><small class="muted">${t("到账金额填实际收到的（已扣手续费、已换成家庭货币）；这里只是留个底，方便对账。")}</small></details>
    <label class="check-inline" style="margin-top:8px"><input type="checkbox" name="repay_required" data-inc-repay ${r.repay_required ? "checked" : ""}><span>${t("需要还（个人赠与 / 借款）")}</span></label>
    <div class="form-grid" data-inc-repay-box ${r.repay_required ? "" : "hidden"} style="margin-top:6px"><label>${t("还款到期日")}<input type="date" name="repay_due_on" value="${d(r.repay_due_on)}"></label><label>${t("需要还的总额（空 = 收到的金额）")}<input type="number" name="repay_amount" step="0.01" min="0" value="${d(r.repay_amount)}"></label></div>
    <p class="form-error" role="alert" id="incFormErr" hidden></p>
    <div class="form-actions"><button class="btn btn-primary" id="incSave">${t("保存")}</button><button type="button" class="btn btn-ghost" data-inc="cancel">${t("取消")}</button></div></form>`;
}
async function saveRecord(form) {
  const I = inc(), f = I.form, fd = new FormData(form), g = (k) => String(fd.get(k) ?? "").trim(), err = $("#incFormErr");
  const fail = (m) => { if (err) { err.textContent = m; err.hidden = false; } };
  const amount = num(g("amount")), name = g("source_name");
  if (!(amount > 0)) return fail(t("请填写大于 0 的金额"));
  if (!name) return fail(t("请填写付款方"));
  const repay = fd.get("repay_required") === "on", pid = g("person_id");
  const accSel = g("acct_sel"), accCard = accSel && accSel !== "cash" && accSel !== "other" ? acctById(accSel) : null;
  const account = accSel === "cash" ? "现金" : accSel === "other" ? g("account") || null : accCard ? acctText(accCard) : null;
  const row = { id: f.rec?.id, received_on: g("received_on") || todayISO(), amount, currency: cur(), orig_amount: num(g("orig_amount")) > 0 ? num(g("orig_amount")) : null, orig_currency: g("orig_currency").toUpperCase().slice(0, 3) || null,
    fee: g("fee") === "" ? null : num(g("fee")), source_name: name, kind: g("kind") || "other", channel: g("channel") || null, person_id: pid && pid !== "none" ? pid : null, account,
    import_batch: f.rec?.import_batch || null, repay_required: repay, repay_due_on: repay ? g("repay_due_on") || null : null, repay_amount: repay && num(g("repay_amount")) > 0 ? num(g("repay_amount")) : null, notes: g("notes") || null };
  if (row.orig_currency && !/^[A-Z]{3}$/.test(row.orig_currency)) return fail(t("原币种填 3 位字母，如 CNY"));
  const dup = !row.id && similarIncome(row), key = `${row.received_on}|${row.amount}|${skey(name)}`;
  if (dup && f.dupAck !== key) { f.dupAck = key; return fail(t("看起来已经记过：{d} · {n} · {a}。确认不是重复的话，再点一次保存。", { d: dup.received_on, n: dup.source_name, a: fmtMoney(dup.amount) })); }
  try {
    await Store.saveIncomeRecord(row);
    await saveDefaults(fd).catch(() => toast(t("默认值没存上，下次再试")));
    const was = defAcct(), want = fd.get("acct_default") === "on";   // 勾「设为默认」：记住；取消勾选且现在选的正是默认：清掉
    const next = want && accSel && accSel !== "other" ? accSel : !want && accSel && accSel === was ? "" : was;
    if (next !== was) await saveDefaultAcct(next).catch(() => toast(t("默认账户没存上，下次再试")));
    if (I.drafts && f.rec?.id) delete I.drafts[f.rec.id];
    I.form = null; await loadIncome(); toast(t("已保存")); rerender(); }
  catch (e) { fail(t("保存失败：{msg}", { msg: e.message })); }
}

/* ───────────── 付款方历史：搜索 + 类型筛选 + 点表头排序，每次显示 20 个，「加载更多」（多取一个判断还有没有，不算总数） ───────────── */
const S_PAGE = 20;
const S_COLS = [["name", "付款方"], ["kind", "类型"], ["n", "收到次数"], ["total", "合计"], ["share", "占比"], ["last", "最近一次"]];
const sNameOf = (x) => x.rows.find((r) => r.source_name)?.source_name || x.key;
const sMainKind = (x) => groupSum(x.rows, (r) => r.kind)[0]?.key || "other";
/** 当前时间范围 / 成员 / 类型 / 搜索下的付款方（已排序）；rows = 参与统计的收入 */
function senderGroups() {
  const I = inc(), w = sWindow(I.sRange || "all"), q = skey(I.sq), sk = I.skind || "all";
  const rows = I.rec.filter((r) => r.received_on >= w.from && r.received_on <= w.to && personOk(r, I.person) && kindMatch(sk, r.kind));
  const list = groupSum(rows, (r) => skey(r.source_name)).filter((x) => !q || skey(`${x.rows.map((r) => r.source_name).join(" ")} ${kindLabel(sMainKind(x))}`).includes(q));
  const { k = "total", dir = "desc" } = I.ssort || {}, sgn = dir === "asc" ? 1 : -1;
  const val = { name: (x) => skey(sNameOf(x)), kind: (x) => kindLabel(sMainKind(x)), n: (x) => x.n, total: (x) => x.total, share: (x) => x.total, last: (x) => x.last }[k] || ((x) => x.total);
  list.sort((a, b) => { const va = val(a), vb = val(b); return (typeof va === "number" ? va - vb : String(va).localeCompare(String(vb))) * sgn || b.total - a.total; });
  return { w, rows, list, total: sumOf(rows) };
}
function sendersListHtml() {
  const I = inc(), { list, total } = senderGroups(), lim = I.slimit || S_PAGE;
  const page = list.slice(0, lim + 1), hasNext = page.length > lim, shown = page.slice(0, lim);   // 多取一个：有第 lim+1 个才显示「加载更多」
  const { k = "total", dir = "desc" } = I.ssort || {};
  const th = ([key, label]) => { const on = k === key; return `<th scope="col" ${on ? `aria-sort="${dir === "asc" ? "ascending" : "descending"}"` : ""}><button type="button" class="th-sort${on ? " is-on" : ""}" data-inc="s-sort" data-k="${key}" title="${esc(t("点一下按这一列排序"))}">${t(label)}<span aria-hidden="true">${on ? (dir === "asc" ? " ▲" : " ▼") : " ↕"}</span></button></th>`; };
  return `<p class="muted small" style="margin:0 0 8px">${t("合计 {m}", { m: fmtMoney(total) })}</p>
    <div class="ch-scroll"><table class="store-table ix-tbl"><thead><tr>${S_COLS.map(th).join("")}<th><span class="sr-only">${t("操作")}</span></th></tr></thead><tbody>
    ${shown.map((x) => `<tr><th scope="row"><button type="button" class="link-name" data-inc="sender-open" data-key="${esc(x.key)}">${esc(sNameOf(x))}</button></th><td>${kindBadge(sMainKind(x))}</td><td>${x.n}</td><td>${fmtMoney(x.total)}</td><td>${rate(x.total, total)}</td><td>${x.last}</td>
      <td>${x.rows.every(canEdit) ? `<button type="button" class="btn btn-sm btn-ghost" data-inc="sender-rename" data-key="${esc(x.key)}">${t("改名 / 合并")}</button>` : ""}</td></tr>
      ${I.renameKey === x.key ? `<tr><td colspan="7"><form data-inc-form="rename" data-key="${esc(x.key)}" class="form-grid"><label>${t("统一改成")}<input name="to" maxlength="80" required value="${esc(sNameOf(x))}" list="incSenders"></label><div class="form-actions"><button class="btn btn-sm btn-primary">${t("改名（相同名字的会合并成一个）")}</button><button type="button" class="btn btn-sm btn-ghost" data-inc="sender-rename" data-key="">${t("取消")}</button></div></form><datalist id="incSenders">${knownSenders().map((s) => `<option value="${esc(s)}">`).join("")}</datalist></td></tr>` : ""}`).join("") || `<tr><td colspan="7" class="muted">${t("没有符合条件的付款方")}</td></tr>`}</tbody></table></div>
    ${hasNext ? `<div class="form-actions" style="justify-content:center"><button type="button" class="btn btn-sm btn-ghost" data-inc="s-more">${t("加载更多")}</button></div>` : ""}`;
}
const renderSenders = () => { const el = $("#incSendersList"); if (el) el.innerHTML = sendersListHtml(); };
function sendersTab() {
  const I = inc(), range = I.sRange || "all";
  if (!I.rec.length) return empty();
  return `<div class="time-bar"><label class="tb-field"><span>${t("时间范围")}</span><select data-inc-f="sRange" data-nosearch>${[["ytd", "今年"], ["3y", "近 3 年"], ["5y", "近 5 年"], ["all", "全部历史"]].map(([v, l]) => `<option value="${v}" ${v === range ? "selected" : ""}>${t(l)}</option>`).join("")}</select></label>
    <label class="tb-field"><span>${t("谁的")}</span><select data-inc-f="person" data-nosearch>${personOptions(I.person, { all: true })}</select></label></div>
    <div class="panel"><div class="form-grid ix-filter" style="margin-bottom:8px">
      <label>${t("搜索")}<input type="search" data-inc-sq value="${esc(I.sq || "")}" placeholder="${esc(t("付款方 / 类型"))}"></label>
      <label>${t("类型")}<select data-inc-f="skind">${kindOptionsHtml(I.skind || "all", { all: true, groups: true })}</select></label></div>
    <div id="incSendersList">${sendersListHtml()}</div>
    <div class="form-actions" style="margin-top:8px"><button type="button" class="btn btn-sm" data-inc="csv-senders">${t("导出付款方汇总 CSV")}</button></div></div>`;
}
function sWindow(range) { return windowOf(range === "ytd" ? "ytd" : range === "3y" ? "3y" : range === "5y" ? "5y" : "all"); }

const R = () => (inc().r ||= { unit: "month", range: "12m", from: "", to: "", person: "all", what: "both", unmask: false });
/** 周期 / 时间范围 / 谁的（收支对比页和导出页共用，同一份设置） */
const controlsHtml = (r, cf = null) => {
  const sel = (id, list, v) => `<label class="tb-field"><span>${t(id)}</span><select data-inc-r="${id === "周期" ? "unit" : "range"}" data-nosearch>${selOpts(list, v)}</select></label>`;
  return `<div class="time-bar">${sel("周期", UNITS, r.unit)}${sel("时间范围", RANGES, r.range)}
    <label class="tb-field"><span>${t("谁的")}</span><select data-inc-r="person" data-nosearch>${personOptions(r.person, { all: true })}</select></label>
    ${r.range === "custom" ? `<label class="tb-field"><span>${t("从")}</span><input type="date" data-inc-r="from" value="${esc(r.from)}"></label><label class="tb-field"><span>${t("到")}</span><input type="date" data-inc-r="to" value="${esc(r.to)}"></label>` : ""}${cf ? togglesHtml(cf) : ""}</div>
    ${r.unit === "biweek" ? `<p class="muted small" style="margin:-4px 0 8px">${t("双周起点（每 14 天一个周期，对上你的发薪日）：")}<input type="date" data-inc-anchor value="${esc(cfAnchor())}" aria-label="${esc(t("双周起点"))}"></p>` : ""}`;
};
const spendDonut = (cf) => {
  const items = STAT_CATS().filter((c) => cf.spendCats[c.id]).map((c) => ({ name: `${c.icon} ${t(c.name)}`, color: c.color, value: R2(Object.values(cf.spendCats[c.id]).reduce((a, b) => a + b, 0)) })).filter((x) => x.value > 0);
  return items.length && window.Charts ? `<div class="panel chart-panel"><h3>${t("花费去向（按分类）")}</h3>${window.Charts.donut({ items, fmt: fmtMoney, title: t("花费去向"), center: fmtMoney(items.reduce((a, x) => a + x.value, 0), true) })}</div>` : "";
};
/* ───────────── 收支对比：收入 vs 花费 vs 差额（组合图），双周 / 月 / 季 / 年 ───────────── */
function reportTab() {
  const I = inc(), r = R();
  if (!I.rec.length) return empty();
  const cf = cashflow(r), person = r.person;
  const note = person !== "all" ? `<p class="muted small" role="status">${t("花费不分人：选「全家」才会显示花费和差额。")}</p>` : cf.loading ? `<p class="muted small" role="status">${t("正在读取花费…")}</p>` : "";
  return `${controlsHtml(r, cf)}${note}${kpiRow(cf)}${flowCharts(cf, t("每{u}收入 vs 花费", { u: t((UNITS.find((u) => u[0] === r.unit) || [])[1]) }))}${lineTable(cf)}
    <div class="ix-two">${kindDonut(cf)}${spendDonut(cf)}</div>${aiPanel(cf)}`;
}
/* ───────────── 导出打印：CSV（收入 / 花费 / 合并）+ 打印 ───────────── */
function exportTab() {
  const I = inc(), r = R();
  if (!I.rec.length) return empty();
  const cf = cashflow(r);
  return `${controlsHtml(r, cf)}${r.person !== "all" ? `<p class="muted small" role="status">${t("花费不分人：选「全家」才会有花费和差额。")}</p>` : ""}
    <section class="section"><div class="section-head"><h2>${t("导出 CSV")}</h2><p>${t("可用 Excel、Numbers 或 Google 表格打开")}</p></div>
      <div class="panel export-grid">
        <label class="export-pick"><span>${t("内容")}</span><select data-inc-r="what" data-nosearch>${selOpts([["both", "收入 + 花费 + 差额（合并）"], ["income", "只要收入（按类型）"], ["spend", "只要花费（按分类）"]], r.what)}</select></label>
        <div class="export-btns"><button type="button" class="btn btn-primary btn-sm" data-inc="csv-report">${t("导出这段时间 CSV")}</button><button type="button" class="btn btn-sm" data-inc="csv-detail-window">${t("导出收入明细")}</button></div>
        <p class="muted small" style="margin:0">${cf.w.from} → ${cf.w.to} · ${t("{n} 笔收入", { n: cf.rows.length })} · ${fmtMoney(cf.tot.income)}</p>
      </div></section>
    <section class="section"><div class="section-head"><h2>${t("打印")}</h2><p>${t("浏览器的打印窗口里也可以另存为 PDF")}</p></div>
      <div class="panel export-grid"><div class="export-btns"><button type="button" class="btn btn-primary btn-sm" data-inc="print-report">${t("打印这段时间的收入报表")}</button></div></div>
      <p class="muted" style="margin:6px 0 0;font-size:13px">${t("要打印筛选后的明细，到“明细”标签里点“打印”。")}</p></section>`;
}
/** 对账单 → 全部流水用：这段时间里记过的花费（已按币种 / 资本性支出过滤），还在读时返回 null */
export function loggedSpend(w) { const list = spendFor(w); return list ? spendRowsOk(list) : null; }
/** 给 账单 → 对账单 → 导出打印 用：收入 / 收支报表的导出块（数据没读过先读） */
export function incomeExportHtml() {
  const I = inc();
  if (!I.loaded && !I.loading) { I.loading = true; loadIncome().finally(() => { I.loading = false; rerender(); }); }
  return I.loaded ? exportTab() : `<div class="panel empty"><strong>${t("加载中…")}</strong></div>`;
}
/** 打印：report = 当前时间范围的收入报表；list = 「明细」里筛选后的列表 */
function printIncome(mode) {
  const hh = state.household?.name || t("家庭"), kpiH = (label, val) => `<div><span>${esc(label)}</span><b>${val}</b></div>`;
  let html;
  if (mode === "list") {
    const list = filteredRecords(), recs = list.slice(0, 300);
    html = `<h1>${esc(hh)} · ${t("收入明细")}</h1><p class="ps-meta">${esc(printStamp())}</p>
      <div class="ps-kpis">${kpiH(t("笔数"), list.length)}${kpiH(t("合计"), fmtMoney(sumOf(list)))}</div>
      <table><thead><tr><th>${t("到账日期")}</th><th>${t("付款方")}</th><th>${t("类型")}</th><th>${t("成员")}</th><th>${t("金额")}</th></tr></thead><tbody>${recs.map((r) => `<tr><td>${r.received_on}</td><td>${esc(r.source_name)}</td><td>${esc(kindLabel(r.kind))}</td><td>${esc(personName(r.person_id))}</td><td>${fmtMoney(r.amount)}</td></tr>`).join("")}</tbody></table>${list.length > recs.length ? `<p class="ps-meta">${t("只打印前 300 笔")}</p>` : ""}`;
  } else {
    const r = R(), cf = cashflow(r), top = groupSum(cf.rows, (x) => skey(x.source_name)).slice(0, 15);
    const kinds = statKinds(inc().merge).filter((k) => cf.byKind[k.id]).sort((a, b) => cf.byKind[b.id] - cf.byKind[a.id]);
    html = `<h1>${esc(hh)} · ${t("收入报表")}</h1><p class="ps-meta">${cf.w.from} → ${cf.w.to} · ${esc(printStamp())}</p>
      <div class="ps-kpis">${kpiH(t("收入"), fmtMoney(cf.tot.income))}${cf.hasSpend ? kpiH(t("花费"), fmtMoney(cf.tot.spend)) + kpiH(t("收支差额"), fmtMoney(cf.tot.net)) : ""}${kpiH(t("笔数"), cf.rows.length)}</div>
      <h2>${t("按{u}", { u: t((UNITS.find((u) => u[0] === r.unit) || [])[1]) })}</h2><table><thead><tr><th>${t("周期")}</th><th>${t("收入")}</th>${cf.hasSpend ? `<th>${t("花费")}</th><th>${t("收支差额")}</th>` : ""}</tr></thead><tbody>${cf.lines.map((l) => `<tr><td>${esc(l.label)}</td><td>${fmtMoney(l.income)}</td>${cf.hasSpend ? `<td>${fmtMoney(l.spend)}</td><td>${fmtMoney(l.net)}</td>` : ""}</tr>`).join("")}</tbody></table>
      <h2>${t("按类型")}</h2><table><thead><tr><th>${t("类型")}</th><th>${t("占比")}</th><th>${t("合计")}</th></tr></thead><tbody>${kinds.map((k) => `<tr><td>${k.icon} ${esc(kindLabel(k.id))}</td><td>${rate(cf.byKind[k.id], cf.tot.income)}</td><td>${fmtMoney(cf.byKind[k.id])}</td></tr>`).join("")}</tbody></table>
      <h2>${t("主要付款方")}</h2><table><thead><tr><th>${t("付款方")}</th><th>${t("次数")}</th><th>${t("合计")}</th></tr></thead><tbody>${top.map((x) => `<tr><td>${esc(senderLabel(x))}</td><td>${x.n}</td><td>${fmtMoney(x.total)}</td></tr>`).join("")}</tbody></table>`;
  }
  printHtml(html);
}
const cfAnchor = () => (state.budget?.cat_budgets?._income_cfg?.anchor) || "2024-01-01";
const kpiRow = (cf) => `<div class="kpis">${kpi(t("收入"), fmtMoney(cf.tot.income), `${cf.w.from} → ${cf.w.to}`)}${cf.hasSpend ? kpi(t("花费"), fmtMoney(cf.tot.spend)) : ""}${cf.hasSpend ? kpi(t("收支差额"), `<span class="${cf.tot.net < 0 ? "down" : ""}">${fmtMoney(cf.tot.net)}</span>`, t("结余率 {r}", { r: rate(cf.tot.net, cf.tot.income) })) : ""}</div>`;

/* ── 导出 ── */
function exportReport() {
  const r = R(), cf = cashflow(r), hh = (state.household?.name || t("家庭")).replace(/[\\/:*?"<>|\s]/g, ""), base = `${hh}-${t("现金流")}-${cf.w.from}_${cf.w.to}`, unitName = t((UNITS.find((u) => u[0] === r.unit) || [])[1]);
  const head = [[t("{hh} 现金流（{u}）", { hh: state.household?.name || t("家庭"), u: unitName })], [t("时间"), `${cf.w.from} → ${cf.w.to}`, t("货币：{cur}", { cur: cur() }), t("谁的：{p}", { p: r.person === "all" ? t("全家") : r.person === "none" ? t("未指定") : personName(r.person) })], []];
  let rows;
  if (r.what === "income") {
    const m = inc().merge, kinds = statKinds(m).filter((k) => cf.byKind[k.id]);
    const grid = Object.fromEntries(cf.keys.map((k) => [k, {}])); for (const x of cf.rows) { const g = grid[bucketKey(x.received_on, r.unit)], sk = statKind(x.kind, m); g[sk] = (g[sk] || 0) + x.amount; }
    rows = [[t("周期"), ...kinds.map((k) => kindLabel(k.id)), t("合计")], ...cf.keys.map((k) => [periodLabel(k, r.unit), ...kinds.map((c) => R2(grid[k][c.id] || 0)), R2(Object.values(grid[k]).reduce((a, b) => a + b, 0))]), [t("合计"), ...kinds.map((c) => R2(cf.byKind[c.id] || 0)), cf.tot.income]];
  } else if (r.what === "spend") {
    if (!cf.hasSpend) return toast(t("花费还没读出来，或选了某个成员（花费不分人）"));
    const cats = STAT_CATS().filter((c) => cf.spendCats[c.id]);
    rows = [[t("周期"), ...cats.map((c) => t(c.name)), t("合计")], ...cf.keys.map((k) => [periodLabel(k, r.unit), ...cats.map((c) => R2(cf.spendCats[c.id][k])), cf.lines.find((l) => l.key === k).spend]), [t("合计"), ...cats.map((c) => R2(Object.values(cf.spendCats[c.id]).reduce((a, b) => a + b, 0))), cf.tot.spend]];
  } else {
    rows = [[t("周期"), t("收入"), ...(cf.hasSpend ? [t("花费")] : []), ...(cf.hasRepaid ? [t("其中：还款")] : []), ...(cf.hasSpend ? [t("收支差额"), t("结余率")] : [])],
      ...cf.lines.map((l) => [l.label, l.income, ...(cf.hasSpend ? [l.spend] : []), ...(cf.hasRepaid ? [l.repaid] : []), ...(cf.hasSpend ? [l.net, rate(l.net, l.income)] : [])]),
      [t("合计"), cf.tot.income, ...(cf.hasSpend ? [cf.tot.spend] : []), ...(cf.hasRepaid ? [cf.tot.repaid] : []), ...(cf.hasSpend ? [cf.tot.net, rate(cf.tot.net, cf.tot.income)] : [])]];
  }
  download(`${base}-${r.what}.csv`, toCsv([...head, ...rows])); toast(t("已导出"));
}
function detailRows(list) {
  const rs = (r) => { const s = repayState(r); return s ? (s.status === "paid" ? t("已还清") : t("待还 {a}", { a: s.left })) : ""; };
  return [[t("到账日期"), t("付款方"), t("大类"), t("类型"), t("金额"), t("货币"), t("收款方式"), t("成员"), t("账户"), t("原币种金额"), t("原币种"), t("手续费"), t("还款状态"), t("备注")],
    ...list.map((r) => [r.received_on, r.source_name, t(groupOf(r.kind).name), kindLabel(r.kind), r.amount, r.currency || "", (CHANNELS.find((c) => c[0] === r.channel) || [])[1] ? t(CHANNELS.find((c) => c[0] === r.channel)[1]) : "", personName(r.person_id), r.account || "", r.orig_amount ?? "", r.orig_currency || "", r.fee ?? "", rs(r), r.notes || ""])];
}
const fileHead = () => `${(state.household?.name || t("家庭")).replace(/[\\/:*?"<>|\s]/g, "")}-${t("收入")}`;

/* ── AI 分析：只发汇总（周期合计、类型合计、前 10 个付款方），付款方 / 成员默认打码；每次发送前要勾选同意 ── */
const aiConsent = () => { try { return localStorage.getItem("hmh-income-ai-ok") === "1"; } catch { return false; } };
function aiPanel(cf) {
  const I = inc(), r = R(), key = `${cf.w.from}|${cf.w.to}|${r.unit}|${r.person}`, out = I.ai[key];
  if (!aiReady()) return `<div class="panel"><h3 style="margin:0 0 6px">✨ ${t("AI 分析")}</h3><p class="muted small" style="margin:0">${t("到 设置 → AI 助手 填 key 后，可以让 AI 读这段时间的收入 / 花费汇总，写出趋势、异常和建议。")}</p></div>`;
  return `<div class="panel"><h3 style="margin:0 0 6px">✨ ${t("AI 分析")}</h3>
    <p class="muted small" style="margin:0 0 8px">${t("只发送汇总数字（每个周期的收入 / 花费 / 差额、各类型合计、前 10 个付款方），不发每一笔明细。付款方和成员名字默认换成「付款方 1」「成员 A」。会发给你在设置里选的 AI 服务商。")}</p>
    <label class="check-inline"><input type="checkbox" data-inc-ai="consent" ${aiConsent() ? "checked" : ""}><span>${t("我同意把这段时间的收入 / 花费汇总发给 AI 服务商")}</span></label><br>
    <label class="check-inline"><input type="checkbox" data-inc-ai="unmask" ${r.unmask ? "checked" : ""}><span>${t("不打码，发真实名字")}</span></label>
    <div class="form-actions" style="margin-top:8px"><button type="button" class="btn btn-primary btn-sm" data-inc="ai-run" ${aiConsent() && !I.aiBusy ? "" : "disabled"}>${I.aiBusy ? t("分析中…") : out ? t("重新分析") : t("分析这段时间")}</button></div>
    ${out ? `<div class="ai-out" style="margin-top:10px;white-space:pre-wrap">${esc(out)}</div><p class="muted small" style="margin:6px 0 0">${t("AI 的分析仅供参考，不是理财建议。")}</p>` : ""}</div>`;
}
async function runAi() {
  const I = inc(), r = R(), cf = cashflow(r), key = `${cf.w.from}|${cf.w.to}|${r.unit}|${r.person}`;
  if (!aiConsent()) return; I.aiBusy = true; rerender();
  const senders = groupSum(cf.rows, (x) => skey(x.source_name)).slice(0, 10), mask = !r.unmask, pm = new Map(); let pi = 0;
  const pname = (id) => { if (!id) return t("未指定"); if (!mask) return personName(id); if (!pm.has(id)) pm.set(id, `${t("成员")} ${String.fromCharCode(65 + pi++)}`); return pm.get(id); };
  const data = { currency: cur(), window: cf.w, unit: r.unit, scope: r.person === "all" ? "household" : pname(r.person === "none" ? "" : r.person),
    periods: cf.lines.map((l) => ({ period: l.label, income: l.income, spending: l.spend, of_which_repayments_to_people_already_in_spending: l.repaid, net: l.net })), totals: cf.tot,
    income_by_type: Object.entries(cf.byKind).map(([k, v]) => ({ type: kindLabel(k), total: R2(v) })), excludes_international_wires_and_personal_gifts: !inc().extra,
    income_by_member: groupSum(cf.rows, (x) => x.person_id || "").map((x) => ({ member: pname(x.key), total: x.total })),
    top_senders: senders.map((x, i) => ({ sender: mask ? `${t("付款方")} ${i + 1}` : x.rows[0].source_name, type: kindLabel(groupSum(x.rows, (y) => y.kind)[0].key), count: x.n, total: x.total })),
    open_paybacks_total: R2(openRepayments().reduce((a, x) => a + x.s.left, 0)) };
  const sys = `You are a careful household cash-flow analyst. You are NOT a licensed financial advisor. Reply in ${lang === "en" ? "English" : lang === "zh-Hant" ? "Traditional Chinese" : "Simplified Chinese"}, concise, plain text with short sections: 1) Overview 2) Trends 3) Unusual periods or concentration risk (e.g. one sender dominating) 4) Savings rate and stability 5) Three practical suggestions. Use only the numbers given; if spending is null it was not available. Do not invent data.`;
  try { I.ai[key] = String(await askText(sys, JSON.stringify(data), { maxTokens: 1400, temperature: 0.3 })).trim(); }
  catch (e) { toast(e.message || String(e)); }
  I.aiBusy = false; rerender();
}

/* ───────────── 预算与计划：预期收入（member_incomes，用来生成预算）+ 对比实际到账 ─────────────
 * 收入只在这里设置：原来在 设置 → 收入与预算 的预期收入、储蓄比例、生成预算、医疗计入、家庭分摊都挪到了这一页，设置里不再有第二份。 */
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/** 最近 n 个整月（不含本月）的窗口 */
const lastMonthsWin = (n) => { const d = new Date(); return { from: iso(new Date(d.getFullYear(), d.getMonth() - n, 1)), to: iso(new Date(d.getFullYear(), d.getMonth(), 0)) }; };
function compareHtml() {
  const I = inc(), n = [3, 6, 12].includes(+I.planWin) ? +I.planWin : 6, w = lastMonthsWin(n);
  // 实际月均：到账金额，不含「需要还」的赠与 / 借款（那不是真收入）
  const rows = I.rec.filter((r) => r.received_on >= w.from && r.received_on <= w.to && !r.repay_required && (I.extra || !isExtra(r.kind)));   // 国际电汇 / 个人赠与跟着「含…」勾选走（默认不算）
  const actualOf = (pid) => R2(sumOf(rows.filter((r) => (pid === "" ? !r.person_id : r.person_id === pid))) / n);
  const lines = state.members.map((m) => { const p = state.people.find((x) => x.member_user_id === m.user_id), plan = state.incomes.find((i) => i.user_id === m.user_id); return { name: m.display_name || t("家人"), plan: plan ? R2(monthlyOf(plan)) : null, act: p ? actualOf(p.id) : null }; })
    .filter((l) => l.plan != null || l.act != null);
  const un = actualOf(""), planned = R2(totalIncomeMonthly()), actual = R2(sumOf(rows) / n);
  const diff = (p, a) => (p > 0 ? `<span class="${a < p ? "down" : ""}">${a >= p ? "+" : ""}${Math.round(((a - p) / p) * 100)}%</span>` : "—");
  const sel = `<label class="tb-field"><span>${t("对比最近")}</span><select data-inc-f="planWin" data-nosearch>${[3, 6, 12].map((v) => `<option value="${v}" ${v === n ? "selected" : ""}>${t("{n} 个月", { n: v })}</option>`).join("")}</select></label>`;
  return `<div class="panel"><div class="time-bar" style="margin:0 0 8px"><h3 style="margin:0;flex:1">${t("计划 vs 实际到账")}</h3>${sel}</div>
    ${I.ok ? `<div class="kpis">${kpi(t("计划月收入"), fmtMoney(planned), t("下面填的预期收入"))}${kpi(t("实际月均到账"), fmtMoney(actual), t("最近 {n} 个整月", { n }))}${kpi(t("实际 vs 计划"), diff(planned, actual), planned > 0 ? "" : t("还没填计划收入"))}</div>
    ${lines.length > 1 || un ? `<div class="ch-scroll"><table class="store-table ix-tbl"><thead><tr><th scope="col">${t("成员")}</th><th scope="col">${t("计划 / 月")}</th><th scope="col">${t("实际月均")}</th><th scope="col">${t("差")}</th></tr></thead><tbody>
      ${lines.map((l) => `<tr><th scope="row">${esc(l.name)}</th><td>${l.plan == null ? "—" : fmtMoney(l.plan)}</td><td>${l.act == null ? "—" : fmtMoney(l.act)}</td><td>${l.plan && l.act != null ? diff(l.plan, l.act) : "—"}</td></tr>`).join("")}
      ${un ? `<tr><th scope="row">${t("未指定 / 全家")}</th><td>—</td><td>${fmtMoney(un)}</td><td>—</td></tr>` : ""}</tbody></table></div>` : ""}
    <p class="muted small" style="margin:8px 0 0">${t("计划收入填的是税后固定收入，用来生成预算；实际是银行到账的收入记录（含奖金等一次性收入，不含需要还的赠与 / 借款），所以两者不会完全一样。想让预算更贴近实际，参考这里的实际月均去改计划。")}${I.extra ? "" : ` ${t("国际电汇和个人赠与默认不算（在概览里勾「含国际电汇 / 个人赠与」才算）。")}`}</p>` : `<p class="muted small">${t("收入记录还没读到（迁移 042 没执行？），先填下面的计划收入也可以。")}</p>`}</div>`;
}
function planTab() { return `${compareHtml()}${incomePanel()}`; }

/* ───────────── 权限 ───────────── */
function accessTab() {
  const I = inc(), me = state.user?.id, st = myAccess();
  const label = (s) => ({ granted: t("已允许看全家"), requested: t("申请中"), denied: t("已拒绝") }[s] || t("默认：只能看自己记的"));
  if (!isOwnerNow()) {
    return `<div class="panel"><h3 style="margin:0 0 6px">🔐 ${t("谁能看收入")}</h3><p style="margin:0 0 8px">${t("收入是高度隐私的数据。家主能看全家的；你默认只能看到自己记的。")}</p>
      <p><b>${t("你的状态")}：</b>${label(st?.status)}${st?.status === "denied" ? ` · <small class="muted">${t("家主没有批准；可以再申请")}</small>` : ""}</p>
      ${st?.status === "granted" ? "" : st?.status === "requested" ? `<div class="form-actions"><button type="button" class="btn btn-sm btn-ghost" data-inc="acc-withdraw">${t("撤回申请")}</button></div>`
        : `<form data-inc-form="request" class="form-grid"><label>${t("给家主留句话（选填）")}<input name="note" maxlength="200" placeholder="${esc(t("例如：做家庭预算要用"))}"></label><div class="form-actions"><button class="btn btn-primary btn-sm">${t("申请查看全家收入")}</button></div></form>`}</div>`;
  }
  const others = state.members.filter((m) => m.user_id !== me), by = Object.fromEntries(I.acc.map((a) => [a.user_id, a]));
  const pending = others.filter((m) => by[m.user_id]?.status === "requested");
  const row = (m) => { const a = by[m.user_id], s = a?.status; return `<li><div class="grow"><span class="name">${esc(m.display_name || t("家人"))}${m.role === "owner" ? ` · ${t("家主")}` : ""}</span><small>${m.role === "owner" ? t("家主默认能看全家的") : label(s)}${a?.note && s === "requested" ? ` · “${esc(a.note)}”` : ""}</small></div>
    ${m.role === "owner" ? "" : s === "granted" ? `<button type="button" class="btn btn-sm btn-ghost" data-inc="acc-revoke" data-id="${m.user_id}">${t("撤销")}</button>` : `<button type="button" class="btn btn-sm btn-primary" data-inc="acc-grant" data-id="${m.user_id}">${t("允许看全家")}</button>${s === "requested" ? `<button type="button" class="btn btn-sm btn-ghost" data-inc="acc-deny" data-id="${m.user_id}">${t("拒绝")}</button>` : ""}`}</li>`; };
  return `<div class="panel"><h3 style="margin:0 0 6px">🔐 ${t("谁能看收入")}</h3><p class="muted small" style="margin:0 0 8px">${t("家主默认能看、能改全家的收入。其他成员默认只能看到自己记的那几条；你批准后，才能看全家的。这是数据库层面的限制，不只是界面藏起来。")}</p>
    ${pending.length ? `<div class="notice" role="status"><b>${t("{n} 个申请等你处理", { n: pending.length })}</b></div>` : ""}
    <ul class="restock-list">${others.map(row).join("") || `<li class="muted">${t("家里还没有其他成员")}</li>`}</ul></div>
    <div class="panel"><b>${t("提醒")}</b><ul class="plain small" style="margin:6px 0 0"><li>${t("收入不会出现在花费、预算、AI 助手的问答里，也不在导出的花费 CSV 里。")}</li><li>${t("「预算与计划」里每个人填的预期收入用同一套权限：家主和被允许的人能看全家的，其他人只看自己的。")}</li><li>${t("设置 → 备份与恢复 的备份文件会包含你能看到的收入，保存备份的位置请自己保管好。")}</li></ul></div>`;
}

/* ───────────── 事件 ───────────── */
function armed(el, msg) { if (el.dataset.armed) return true; el.dataset.armed = "1"; const old = el.textContent; el.textContent = msg; setTimeout(() => { delete el.dataset.armed; el.textContent = old; }, 4000); return false; }
const guard = async (fn) => { try { await fn(); } catch (e) { toast(t("操作失败：{msg}", { msg: e.message })); } };
const reload = async () => { await loadIncome(); redraw(); };
const goTab = (id) => { location.hash = incomeHref(id); };
/** 去「明细」前清掉所有筛选（含图表钻取带来的日期段 / 不含电汇赠与） */
const NO_FILTER = () => ({ q: "", kind: "all", year: "all", month: "all", person: "all", batch: null, from: "", to: "", ex: false, limit: 40 });

export function initIncome({ render, refresh }) {
  hooks = { render, refresh }; initIncomeScan({ render });
  window.addEventListener("hashchange", () => { if (!location.hash.startsWith("#/bills/income")) { const I = inc(); I.form = null; I.scanOpen = false; I.selMode = false; I.open = null; I._lastTab = undefined; } });   // 离开收入页：下次进来是干净的，不会看着像「选了好几个」
  const main = document.getElementById("main");
  main.addEventListener("click", (e) => {
    const b = e.target.closest?.("[data-inc]"); if (!b) return;
    const I = inc(), id = b.dataset.id, act = b.dataset.inc;
    if (act === "add") { I.form = { rec: null }; I.scanOpen = false; I._keep = true; if (activeTab(state.route) !== "records" || state.route.sub !== "income") goTab("records"); else redraw(); return; }
    if (act === "way-manual") { I.form = I.form && !I.form.rec?.id ? null : { rec: null }; I.scanOpen = false; return redraw(); }
    if (act === "batch-clear") { I.batch = null; history.replaceState(null, "", `${href("bills", "income")}?tab=records`); return redraw(); }
    if (act === "way-scan") { I.scanOpen = !I.scanOpen; I.form = null; return redraw(); }
    if (act === "cancel") { if (I.drafts && I.form?.rec?.id) delete I.drafts[I.form.rec.id]; I.form = null; return redraw(); }
    if (act === "open") { I.open = I.open === id ? null : id; if (activeTab(state.route) !== "records") { Object.assign(I, NO_FILTER()); goTab("records"); return; } return redraw(); }
    if (act === "more") { I.limit += 40; return renderIncList(); }
    if (act === "edit") {   // 点行 / 点「编辑」：打开编辑表单（不在「明细」标签就先切过去）；这一行已经展开着，再点一下行就收起（不保存）
      if (b.classList.contains("ix-main") && I.form?.rec?.id === id && inlineEditId() === id) {   // 收起但留着草稿：再展开时填回去，行上有「草稿」小标
        const f = $("#incForm"); if (f) (I.drafts = I.drafts || {})[id] = formDraft(f);
        I.form = null; return redraw();
      }
      I.form = { rec: I.rec.find((r) => r.id === id) }; I.scanOpen = false;
      if (activeTab(state.route) !== "records") { Object.assign(I, NO_FILTER()); I._keep = true; goTab("records"); return; }
      redraw(); const dr = I.drafts?.[id]; if (dr) applyDraft($("#incForm"), dr);   // 之前收起时留的草稿
      setTimeout(() => { const f = $("#incForm"); f?.scrollIntoView({ block: "center", behavior: "smooth" }); f?.elements.amount?.focus({ preventScroll: true }); }, 0); return;
    }
    if (act === "del-swipe") { if (!window.confirm(t("删除这笔收入？"))) return; return guard(async () => { await Store.deleteIncomeRecord(id); I.open = null; await reload(); }); }   // 左滑删除：用确认框（滑动代码按它判断用户有没有取消）
    if (act === "del") { if (!armed(b, t("再点一次确认删除"))) return; return guard(async () => { await Store.deleteIncomeRecord(id); I.open = null; await reload(); }); }
    if (act === "rep-del") { if (!armed(b, t("再点一次确认"))) return; return guard(async () => { const p = I.rep.find((x) => x.id === id); await Store.deleteIncomeRepayment(id); if (p?.purchase_id) { await Store.deletePurchase(p.purchase_id).catch(() => {}); state.purchases = state.purchases.filter((x) => x.id !== p.purchase_id); } await reload(); }); }
    if (act === "sender-open") { Object.assign(I, NO_FILTER(), { q: b.dataset.key }); goTab("records"); return; }
    if (act === "drill-clear") { if (b.dataset.k === "range") { I.from = ""; I.to = ""; } else if (b.dataset.k === "ex") I.ex = false; I.limit = 40; return redraw(); }
    if (act === "sender-rename") { I.renameKey = b.dataset.key || null; return redraw(); }
    if (act === "csv-detail") { const l = filteredRecords(); if (!l.length) return toast(t("没有可导出的记录")); download(`${fileHead()}-${t("明细")}.csv`, toCsv(detailRows(l))); return; }
    if (act === "csv-detail-window") { const w = windowOf(R().range, R()), l = incomeIn(w.from, w.to, R().person).filter((r) => I.extra || !isExtra(r.kind)); if (!l.length) return toast(t("这段时间没有收入")); download(`${fileHead()}-${w.from}_${w.to}-${t("明细")}.csv`, toCsv(detailRows(l))); return; }
    if (act === "csv-senders") {   // 导出：和表格同样的筛选和排序，不分页
      const { w, list, total: tot } = senderGroups();
      return download(`${fileHead()}-${t("付款方汇总")}-${w.from}_${w.to}.csv`, toCsv([[t("付款方"), t("主要类型"), t("次数"), t("合计"), t("占比"), t("第一次"), t("最近一次")], ...list.map((x) => [sNameOf(x), kindLabel(sMainKind(x)), x.n, x.total, rate(x.total, tot), x.first, x.last])]));
    }
    if (act === "s-sort") { const k = b.dataset.k, o = I.ssort || { k: "total", dir: "desc" }; I.ssort = { k, dir: o.k === k ? (o.dir === "asc" ? "desc" : "asc") : k === "name" || k === "kind" ? "asc" : "desc" }; I.slimit = S_PAGE; renderSenders(); $(`#incSendersList [data-k="${k}"]`)?.focus(); return; }
    if (act === "s-more") { I.slimit = (I.slimit || S_PAGE) + S_PAGE; return renderSenders(); }
    if (act === "csv-report") return exportReport();
    if (act === "print-report") return printIncome("report");
    if (act === "print-list") return printIncome("list");
    if (act === "ov-kind") { OV().kind = id; return redraw(); }
    if (act === "kind-open") { Object.assign(I, NO_FILTER(), { kind: id, person: OV().person }); goTab("records"); return; }
    if (act === "sel-toggle") { I.selMode = !I.selMode; I.sel = new Set(); return redraw(); }
    if (act === "sel-all") { I.sel = new Set(filteredRecords().slice(0, I.limit).filter(canEdit).map((r) => r.id)); return renderIncList(); }
    if (act === "sel-del") { const ids = [...(I.sel || [])]; if (!ids.length) return toast(t("先勾选要删的收入")); if (!armed(b, t("再点一次确认删除 {n} 笔", { n: ids.length }))) return; return guard(async () => { for (const x of ids) await Store.deleteIncomeRecord(x); I.sel = new Set(); I.selMode = false; I.open = null; toast(t("已删除 {n} 笔", { n: ids.length })); await reload(); }); }
    if (act === "ai-run") return runAi();
    if (act === "kind-del") { if (!armed(b, t("再点一次确认删除"))) return; if (I.rec.some((r) => r.kind === id)) return toast(t("还有收入记录用着这个类型，先把它们改成别的类型")); return guard(async () => { await saveMeta({ _income_kinds: customKinds().filter((k) => k.id !== id) }); redraw(); }); }
    if (act === "acc-grant") return guard(async () => { await Store.setIncomeAccess(id, "granted"); toast(t("已允许")); await reload(); });
    if (act === "acc-deny") return guard(async () => { await Store.setIncomeAccess(id, "denied"); await reload(); });
    if (act === "acc-revoke") { if (!armed(b, t("再点一次撤销"))) return; return guard(async () => { await Store.deleteIncomeAccess(id); await reload(); }); }
    if (act === "acc-withdraw") return guard(async () => { await Store.deleteIncomeAccess(state.user.id); await reload(); });
  });
  main.addEventListener("submit", (e) => {
    const f = e.target.closest?.("[data-inc-form]"); if (!f) return;
    e.preventDefault(); e.stopPropagation();
    const kind = f.dataset.incForm, I = inc(), fd = new FormData(f), g = (k) => String(fd.get(k) ?? "").trim();
    if (kind === "record") return saveRecord(f);
    if (kind === "repay") return guard(async () => {
      const rec = I.rec.find((r) => r.id === f.dataset.id), amount = num(g("amount")), paid_on = g("paid_on") || todayISO(); if (!rec || !(amount > 0)) return;
      let purchase_id = null, note = "";
      if (fd.get("as_spend") === "on") {   // 还款是钱从账户里出去了：同时记一笔花费，花费统计里才看得到
        const tm = new Date(paid_on + "T12:00:00").getTime(), dup = state.purchases.find((p) => !p.virtual && Math.abs(num(p.amount) - amount) < 0.005 && Math.abs(new Date(p.purchased_at).getTime() - tm) <= 3.5 * 864e5);
        if (dup) note = t("；已有对上的花费（{n}），没有重复记", { n: dup.name });
        else purchase_id = await Store.addPurchase({ item_id: null, name: t("还款给 {n}", { n: rec.source_name }), category: "other", quantity: null, unit: null, store: rec.source_name, amount, currency: cur(), purchased_at: new Date(paid_on + "T12:00:00").toISOString() });
      }
      await Store.addIncomeRepayment({ record_id: rec.id, paid_on, amount, method: g("method") || null, notes: null, ...(purchase_id ? { purchase_id } : {}) });
      toast(t("已记录还款") + note); await reload(); if (purchase_id) hooks.refresh();
    });
    if (kind === "kind") return guard(async () => { const name = g("name"); if (!name) return; const parent = GROUPS.some((x) => x[0] === g("parent")) ? g("parent") : "other"; await saveMeta({ _income_kinds: [...customKinds(), { id: `c_${Date.now().toString(36)}`, name, icon: g("icon") || "🏷️", parent }].slice(0, 30) }); rerender(); });
    if (kind === "rename") return guard(async () => { const to = g("to"), key = f.dataset.key; if (!to) return; const ids = I.rec.filter((r) => skey(r.source_name) === key && canEdit(r)).map((r) => r.id); await Store.renameIncomeSource(ids, to); I.renameKey = null; toast(t("已改名 {n} 笔", { n: ids.length })); await reload(); });
    if (kind === "request") return guard(async () => { await Store.setIncomeAccess(state.user.id, "requested", g("note") || null); toast(t("已发送申请，等家主批准")); await reload(); });
  }, true);
  main.addEventListener("input", (e) => { const el = e.target; if (el.dataset?.incF === "q") { inc().q = el.value; inc().limit = 40; renderIncList(); } if (el.dataset?.incSq !== undefined) { inc().sq = el.value; inc().slimit = S_PAGE; renderSenders(); } });
  main.addEventListener("change", (e) => {
    const el = e.target, I = inc();
    if (el.dataset?.incAcct !== undefined) { const f = el.closest("form"), box = f?.elements.account, cb = f?.elements.acct_default; if (box) { box.hidden = el.value !== "other"; if (!box.hidden) box.focus(); } if (cb) cb.checked = !!el.value && el.value === defAcct(); return; }
    if (el.name && DEF_FIELDS.some(([k]) => k === el.name)) { const cb = el.closest("form")?.elements[`def_${el.name}`]; if (cb) cb.checked = !!el.value && el.value === defOf(el.name); }   // 改了值：「设为默认」跟着当前值是不是默认来（不 return，别的处理照走）
    if (el.dataset?.incRepay !== undefined) { const box = el.closest("form")?.querySelector("[data-inc-repay-box]"); if (box) box.hidden = !el.checked; return; }
    if (el.dataset?.incSel !== undefined) { (I.sel ||= new Set())[el.checked ? "add" : "delete"](el.dataset.incSel); const n = $("#incSelN"); if (n) n.textContent = t("已选 {n} 笔", { n: I.sel.size }); return; }
    if (el.dataset?.incOv) { const o = OV(); o[el.dataset.incOv] = el.value; if (el.dataset.incOv === "range") o.month = ""; return rerender(); }
    if (el.dataset?.incTog === "merge") { setIncMerge(el.checked); return rerender(); }
    if (el.dataset?.incTog === "extra") { I.extra = el.checked; return rerender(); }
    if (el.dataset?.incKparent) { const kid = el.dataset.incKparent, v = el.value; guard(async () => { await saveMeta({ _income_kinds: customKinds().map((k) => (k.id === kid ? { ...k, parent: v } : k)) }); rerender(); }); return; }
    if (el.dataset?.incF) { const k = el.dataset.incF; if (k === "q") return; I[k] = el.value; I.limit = 40; I.slimit = S_PAGE; return rerender(); }
    if (el.dataset?.incR) { const r = R(); r[el.dataset.incR] = el.value; return rerender(); }
    if (el.dataset?.incAnchor !== undefined) { if (el.value) guard(async () => { await saveMeta({ _income_cfg: { ...incCfg(), anchor: el.value } }); rerender(); }); return; }
    if (el.dataset?.incAi === "consent") { try { localStorage.setItem("hmh-income-ai-ok", el.checked ? "1" : "0"); } catch { /* 忽略 */ } return rerender(); }
    if (el.dataset?.incAi === "unmask") { R().unmask = el.checked; return; }
  });
  document.addEventListener("budget-saved", () => { if (state.route?.section === "bills" && state.route?.sub === "income") rerender(); });
}
/** 提醒：个人赠与 / 借款的还款逾期、一个月内到期（只有能看到这条收入的人才有：行级安全已经过滤） */
export function incomeAlertItems() {
  if (!state.billsEnabled || !inc().ok) return [];
  const link = `${href("bills", "income")}?tab=records`, out = [];
  for (const { r, s } of openRepayments()) {
    if (!r.repay_due_on) continue;
    const d = daysUntil(r.repay_due_on); if (d > 30) continue;
    const sev = d < 0 ? 0 : d <= 7 ? 2 : 3;
    out.push({ source: "income", severity: sev, must: sev <= 1, due: r.repay_due_on, daysLeft: d, title: `🤝 ${d < 0 ? t("还款已逾期：{who}", { who: r.source_name }) : t("还款快到期：{who}", { who: r.source_name })}`,
      detail: d < 0 ? t("逾期 {d} 天，还差 {a}", { d: -d, a: money(s.left) }) : t("{d} 天后到期，还差 {a}", { d, a: money(s.left) }), href: link, badge: { label: d < 0 ? t("逾期") : t("{d} 天", { d }), cls: sev === 0 ? "b-out" : sev === 2 ? "b-soon" : "b-ok" }, actions: [{ type: "link", href: link, label: t("去还款"), cls: "btn-ghost" }] });
  }
  return out;
}
registerAlerts(incomeAlertItems);
export { openRepayments, repaidOf };
