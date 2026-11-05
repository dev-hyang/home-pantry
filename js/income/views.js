/* 财务 → 收入：收支总览、明细、类型（一级 → 叶子）、付款方历史、收支对比（双周 / 月 / 季 / 年，AI 分析）、导出、预算与计划。
 * 数据在 income_records（迁移 042 / 056），收入规则在 js/core/income-taxonomy.js（认定收入 vs 资本流入），花费规则在 js/core/taxonomy.js。
 * 统计不把花费读进浏览器：收支总览 / 类型读数据库按月聚合的 inc_rollup + spend_rollup，收支对比的花费一侧读 ledger_rollup（按月或双周），
 * 在 js/stats/report.js 汇总。明细是服务器分页（inc_page / inc_stats）。付款方、最近到账、还款、表单查重仍用整张收入表（I.rec）。 */
import { FD, changed, clearFiltersBtn, clearUrlParams, onClearFilters } from "../core/clear-filters.js";
import { state } from "../core/state.js";
import { Store } from "../core/store.js";
import { $, applyDraft, daysUntil, esc, fmtDate, formDraft, money, moneyExact, num, todayISO, toast, confirmDelete } from "../core/util.js";
import { attentionPanel, registerAlerts } from "../core/alerts.js";
import { lang, t } from "../core/i18n.js";
import { href } from "../core/router.js";
import { tabBar, tabHub } from "../core/hub.js";
import { printHtml, printStamp } from "../settings/print.js";
import { INCOME_TABS, activeTab } from "../core/tabs.js";
import { debtHref, ensureBorrowDebt } from "../bills/debt-logic.js";
import { initIncomeScan, scanHtml } from "./scan.js";
import { aaFixHtml, initAaFix } from "./aa-fix.js";   // 把记成收入的 Zelle 转入 / 报销 逐个付款方整理成支出退回
import { meta, monthlyOf, saveMeta, totalIncomeMonthly } from "../bills/budget.js";
import { incomePanel } from "../settings/income.js";
import { acctById, acctLabel } from "../bills/cards-views.js";
import { ACCT_KINDS, CARDS_HREF } from "../bills/cards.js";
import { aiReady, askText } from "../core/ai.js";
import { debounce, moreBtn, pageLimit, pageMoreBtn, pageSize } from "../core/pager.js";
import { serverList } from "../core/server-list.js";
import { compact } from "../core/list-query.js";
import { STAT_CATS, download, dq, hitAttrs, monthLabel, toCsv, trendPeriods } from "../stats/views.js";
import { BUCKETS, bucketOf, l2IdOf } from "../core/taxonomy.js";
import { INC_L1S, incL1, incLeaf, incLeavesOf, splitRecord } from "../core/income-taxonomy.js";
import { OWN_XFER, aggregate, householdFlow, incAggregate, incNodeSum, normIncRow, normRow } from "../stats/report.js";
import { sameAmountNear } from "../stats/dup-check.js";
import { CHANNELS, GAIN_KINDS, RANGES, UNITS, adults, biweekAnchor, bucketKey, canSeeAll, capitalKinds, customKinds, groupList, groupOf, groupSum, inc, incSumOf, incomeIn, isIncomeKind, isOwnerNow, kindLabel, kindList, kindMatch, kindOf, kindOptionsHtml, knownSenders, loadIncome, memberLabel, myPersonId, normKindSel, openRepayments, periodKeys, personOk,
  periodLabel, personName, recognized, repayState, repaidOf, setIncMerge, similarIncome, skey, sharedRangeHtml, spanLabel, spanOk, spanOptionsHtml, spanPrev, spanWindow, statKinds, sumOf, windowOf } from "./logic.js";
import { liveNetWorth, thisMonth } from "../bills/nw-logic.js";   // 净资产（迁移 059）：收支总览上的小卡片
import { monthChange, trendPoints } from "../stats/net-worth.js";

const incomeHref = (id) => `${href("bills", "income")}${id === "overview" ? "" : `?tab=${id}`}`;
const GREEN = "#2c6a57", RED = "#d4694c", BLUE = "#3b7fc4", TEAL = "#24897d", SLATE = "#64748b";
const R2 = (v) => Math.round(v * 100) / 100;
let hooks = { render: () => {}, refresh: async () => {} };
const rerender = () => hooks.render(false);
/** 用户自己点的操作（展开 / 编辑 / 取消 / 删除…）要立刻重画：main.js 的 render(false) 只给后台刷新用，页面上只要有任何 <form>（明细页底部的「类型管理」就有一个）它就直接跳过，点行编辑就「没反应也没报错」 */
const redraw = () => hooks.render(true);
const cur = () => Units.region.currency;

/* ───────────── 聚合数据：inc_rollup / spend_rollup / ledger_rollup（迁移 055 / 056），按参数缓存；数据变了标过期，下次画的时候后台重读 ───────────── */
const TZ = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; } };
const nextMonth = (m) => { const [y, mo] = m.split("-").map(Number); return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`; };
const addDay = (s, n) => { const d = new Date(`${s}T12:00:00`); d.setDate(d.getDate() + n); return iso(d); };
/** from..to（日期，含）覆盖的月份 */
const monthsBetween = (from, to) => { const out = []; for (let m = from.slice(0, 7); m <= to.slice(0, 7); m = nextMonth(m)) out.push(m); return out; };
/** 一组月份 → [from, to)（月初，不含 to） */
const spanOfMonths = (ms) => { const s = [...ms].sort(); return { from: `${s[0]}-01`, to: `${nextMonth(s.at(-1))}-01` }; };
const ROLL = new Map();   // key → { rows, busy, stale, err, p }
let rollErrShown = false;
function roll(kind, from, to, unit = "month") {
  const key = `${kind}|${from}|${to}|${unit}`;
  let e = ROLL.get(key);
  if (!e || (e.stale && !e.busy)) {
    if (!e) { if (ROLL.size > 30) ROLL.delete(ROLL.keys().next().value); e = { rows: null }; ROLL.set(key, e); }
    e.busy = true; e.stale = false;
    const req = kind === "inc" ? Store.incRollup(from, to, TZ()) : kind === "spend" ? Store.spendRollup(from, to, TZ()) : Store.ledgerRollup(from, to, TZ(), unit, unit === "biweek" ? biweekAnchor() : null);
    e.p = req.then((rows) => { e.rows = (rows || []).map(kind === "inc" ? normIncRow : kind === "spend" ? normRow : (x) => x); e.err = ""; })
      .catch((err) => {
        e.err = err?.message || String(err); e.rows = e.rows || [];
        if (!rollErrShown) { rollErrShown = true; toast(/could not find the function|schema cache|does not exist/i.test(e.err) ? t("收支统计读不出来：数据库还没升级，请先执行 supabase/migrations/056_income_ledger.sql") : t("收支统计读取失败：{msg}", { msg: e.err })); }
      })
      .finally(() => { e.busy = false; rerender(); });
  }
  return e.rows;
}
/** 覆盖这些月份的收入聚合行（净资产页「财富增长 vs 消费」用，和收支总览共用缓存）；还在读返回 null */
export const incRollupFor = (months) => { const sp = spanOfMonths(months); return roll("inc", sp.from, sp.to); };
/** 收支总览上的净资产小卡片：现在的净资产 + 比上月，点进 财务 → 净资产（只给有财务权限的人；没执行 059 不显示） */
function netWorthCard() {
  if (!state.nwOk || !canSeeAll()) return "";
  const r = liveNetWorth(), m = thisMonth(), mom = monthChange(trendPoints(state.nwSnapshots, cur(), { live: r, month: m }), m);
  const sgn = (v) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${fmtMoney(Math.abs(v))}`;
  return `<a class="panel nw-card" href="${href("bills", "networth")}"><span>📈 ${t("净资产")}</span><b class="${r.netWorth < 0 ? "down" : ""}">${fmtMoney(r.netWorth)}</b>
    <small class="muted">${mom == null ? t("资产 {a} · 负债 {l}", { a: fmtMoney(r.assetsTotal, true), l: fmtMoney(r.liabilitiesTotal, true) }) : t("比上月 {d}", { d: sgn(mom) })}</small><span class="mch" aria-hidden="true">›</span></a>`;
}
const rollAsync = async (kind, from, to, unit = "month") => { roll(kind, from, to, unit); await ROLL.get(`${kind}|${from}|${to}|${unit}`)?.p; return ROLL.get(`${kind}|${from}|${to}|${unit}`)?.rows || []; };
const staleAll = (kinds) => { for (const [k, e] of ROLL) if (kinds.includes(k.split("|")[0])) e.stale = true; };
window.addEventListener("income-data-changed", () => staleAll(["inc", "ledger"]));
window.addEventListener("spend-rows-changed", () => staleAll(["spend", "ledger"]));

/* ───────────── 收支对比用的现金流：收入（认定，逐笔，任意周期）+ 消费 / 投资（ledger_rollup 的花费一侧，按月或双周） ─────────────
 * 消费 = 日常 + 住房（和花费页「含住房」同一口径，js/core/taxonomy.js 的 bucketOf）；投资 = 性质是投资的现金流出；其他流出 = 财务及其他 + 资本性支出。
 * 花费不分人，只在选「全家」时有。 */
function cashflow({ range, from, to, unit, person, win = null }) {
  const I = inc(), w = win || spanWindow(range), keys = periodKeys(w.from, w.to, unit), zero = () => Object.fromEntries(keys.map((k) => [k, 0]));
  const income = zero(), capIn = zero(), capBook = zero(), spend = zero(), invest = zero(), other = zero(), repaid = zero(), byKind = {}, spendCats = {};
  const rows = incomeIn(w.from, w.to, person);
  for (const r of rows) {
    const s = splitRecord(r), k = bucketKey(r.received_on, unit);
    income[k] += s.income; capIn[k] += s.cap; if (s.capLeaf !== OWN_XFER) capBook[k] += s.cap;   // 账面：从储蓄账户转入不算（自己账户之间）
    if (s.income) { const sk = I.merge ? `g:${s.l1}` : r.kind; byKind[sk] = (byKind[sk] || 0) + s.income; }
  }
  for (const p of I.rep) {
    if (p.paid_on < w.from || p.paid_on > w.to) continue;
    const rec = I.rec.find((r) => r.id === p.record_id); if (!rec || !personOk(rec, person)) continue;
    repaid[bucketKey(p.paid_on, unit)] += p.amount;
  }
  const lunit = unit === "biweek" ? "biweek" : "month", list = person === "all" ? roll("ledger", w.from, addDay(w.to, 1), lunit) : null;
  if (list) for (const x of list) {
    if (x.source === "income" || (x.currency && x.currency !== cur())) continue;
    const k = lunit === "biweek" ? x.period : bucketKey(`${x.period}-01`, unit); if (!(k in spend)) continue;
    const b = bucketOf(x.category, x.nature), amt = -num(x.amount_sum);
    if (b === "living" || b === "housing") { spend[k] += amt; const c = l2IdOf(x.category); (spendCats[c] ||= zero())[k] += amt; }
    else if (b === "investment") invest[k] += amt;
    else if (b) other[k] += amt;
  }
  const hasSpend = person === "all" && !!list, hasRepaid = Object.values(repaid).some((v) => v > 0);
  // incNet 收入结余 = 收入 − 消费 − 其他流出（税、保险、利息、奉献、资本性）− 投资；net 净现金流（账面）= 收入结余 + 资本流入（全部流入 − 全部流出）；
  // saved = 存下来的（含投资），储蓄率用它（只看收入）
  const lines = keys.map((k) => { const i = R2(income[k]), s = hasSpend ? R2(spend[k]) : null, o = hasSpend ? R2(other[k]) : null, v = hasSpend ? R2(invest[k]) : null;
    return { key: k, label: periodLabel(k, unit), income: i, capIn: R2(capIn[k]), spend: s, invest: v, other: o, repaid: R2(repaid[k]), saved: s == null ? null : R2(i - s - o), incNet: s == null ? null : R2(i - s - o - v), capBook: R2(capBook[k]), net: s == null ? null : R2(i - s - o - v + capBook[k]), noSpend: hasSpend && i > 0 && !s && !o && !v }; });
  const tsum = (f) => R2(lines.reduce((a, l) => a + (f(l) || 0), 0));
  const tot = { income: tsum((l) => l.income), capIn: tsum((l) => l.capIn), spend: hasSpend ? tsum((l) => l.spend) : null, invest: hasSpend ? tsum((l) => l.invest) : null, other: hasSpend ? tsum((l) => l.other) : null, repaid: tsum((l) => l.repaid) };
  tot.saved = tot.spend == null ? null : R2(tot.income - tot.spend - tot.other); tot.incNet = tot.spend == null ? null : R2(tot.saved - tot.invest); tot.capBook = tsum((l) => l.capBook); tot.capOwn = R2(tot.capIn - tot.capBook); tot.net = tot.spend == null ? null : R2(tot.incNet + tot.capBook);   // 还款是钱从账户里出去了，已经算在花费里（记还款时同时记一笔花费，或银行导入）：这里的「还款」只是告诉你其中有多少
  const noSpend = lines.filter((l) => l.noSpend).map((l) => l.label);   // 有收入、却一笔花费都没有：多半是那段对账单还没导入，净现金流会偏高
  return { w, keys, lines, tot, byKind, rows, hasSpend, hasRepaid, spendCats, unit, person, noSpend, loading: person === "all" && !list };
}

/* ───────────── 页面外壳 ───────────── */
const shell = (tab, body) => `<section class="section" id="incomePage">
  <div class="section-head"><h2>💰 ${t("收入")}</h2><div class="head-acts"><button type="button" class="btn btn-primary btn-sm" data-inc="add">＋ ${t("记一笔收入")}</button></div></div>
  ${tabBar(INCOME_TABS, tab, incomeHref, t("收入内容"))}${noticeHtml()}${tab === "overview" || tab === "records" ? attentionPanel(["income"], { title: t("要处理"), sub: t("该收的还款") }) : ""}${body}</section>`;
function noticeHtml() {
  const I = inc();
  if (!I.ok) return `<div class="notice" role="alert"><b>${t("还没执行数据库迁移 042（收入表）：先在 Supabase → SQL Editor 里执行 supabase/migrations/042_income_records.sql，再刷新。")}</b><br><small>${esc(I.err)}</small></div>`;
  const parts = [];
  if (Store.mode === "demo") parts.push(t("演示模式的数据只存在这台设备的浏览器里，没有账号隔离；登录云端家庭后，收入由数据库按「家主 / 已允许 / 自己记的」隔离。"));
  else if (!canSeeAll()) parts.push(t("你只能看到自己记的收入；家主在 设置 → 家庭与成员 给你开财务权限后，才能看全家的。"));
  return parts.length ? `<div class="notice" role="status">${parts.map(esc).join("<br>")}</div>` : "";
}
export function viewIncome() {
  const I = inc(), tab = activeTab(state.route) || "overview";
  if (I._lastTab !== undefined && I._lastTab !== tab) { if (I._keep) I._keep = false; else { I.form = null; I.scanOpen = false; I.selMode = false; } }   // 换标签：不带着没关的表单 / 识别面板
  I._lastTab = tab;
  const qb = state.route?.q?.get("batch");   // 银行导入「查看收入」：只看这一批入账
  if (qb && I.batchFrom !== qb) { I.batch = qb; I.batchFrom = qb; Object.assign(I, { q: "", kind: "all", acct: "all", year: "all", person: "all", limit: pageSize(), from: "", to: "", ex: false }); } else if (!qb) I.batchFrom = null;
  const dqs = tab === "records" && state.route?.q?.get("inc") ? state.route.q.toString() : "";   // 概览 / 类型图表点进来：套上对应筛选（同一个链接只套一次，之后用户改筛选不被覆盖）
  if (dqs && I.drillFrom !== dqs) { I.drillFrom = dqs; applyIncomeDrill(state.route.q); } else if (!dqs) I.drillFrom = null;
  if (!I.loaded && !I.loading) { I.loading = true; loadIncome().finally(() => { I.loading = false; rerender(); }); }
  if (!I.loaded) return shell(tab, `<div class="panel empty"><strong>${t("加载中…")}</strong></div>`);
  const body = { overview: overviewTab, records: recordsTab, category: categoryTab, senders: sendersTab, compare: reportTab, import: importTab, export: exportTab, plan: planTab }[tab]();
  return shell(tab, I.ok || tab === "plan" ? body : "");
}

/* ───────────── 公共小件 ───────────── */
const kindBadge = (id) => { const k = kindOf(id); return `<span class="ix-kind" style="--k:${k.color}">${k.icon} ${esc(kindLabel(id))}</span>`; };
/* ── 钻取：图表色块、图例、数字卡片、表格行点一下 → 「明细」并套上对应筛选（类型 / 日期段 / 成员 / 账户）。
 * 和花费图表同一套 data-drill（查询串）；带 inc=1 的由 main.js 的 drillTo 送到 收入 → 明细，applyIncomeDrill 套筛选。 */
const incDrill = (o) => dq({ inc: 1, ...o, person: o.person && o.person !== "all" ? o.person : "" });
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
/** 收支对比 / 导出的时间条里的勾选：同一个一级合并显示（记在本机） */
function togglesHtml(cf) {
  const I = inc(), used = [...new Set(cf.rows.map((r) => r.kind))];
  const multi = groupList().some((g) => used.filter((k) => groupOf(k).id === g.id).length > 1);
  return multi || I.merge ? `<label class="check-inline" title="${esc(t("基本工资、奖金、福利合成「工作收入」，利息、股息合成「投资收益」等，图里颜色更少"))}"><input type="checkbox" data-inc-tog="merge" ${I.merge ? "checked" : ""}><span>${t("同一个一级合并显示")}</span></label>` : "";
}
const personOptions = (sel, { all = false } = {}) => `${all ? `<option value="all" ${sel === "all" ? "selected" : ""}>${t("全家")}</option>` : ""}<option value="none" ${sel === "none" ? "selected" : ""}>${t(all ? "未指定的" : "未指定 / 全家")}</option>${adults().map((p) => `<option value="${p.id}" ${sel === p.id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}`;
const selOpts = (list, sel) => list.map(([v, l]) => `<option value="${esc(v)}" ${v === sel ? "selected" : ""}>${esc(t(l))}</option>`).join("");
const yearsOf = () => [...new Set(inc().rec.map((r) => r.received_on.slice(0, 4)).concat(String(new Date().getFullYear())))].sort().reverse();
const empty = () => `<div class="panel empty"><strong>${t("还没有收入记录")}</strong>${t("点右上角「记一笔收入」；在「财务 → 对账单」导入对账单时，工资、电汇、Zelle 转入这些入账会单独列出来，勾上就能一起导入。")}</div>`;
const kpi = (label, val, sub = "") => `<div class="kpi"><span>${esc(label)}</span><b>${val}</b>${sub ? `<small>${sub}</small>` : ""}</div>`;
const rate = (n, i) => (i > 0 && n != null ? `${Math.round((n / i) * 100)}%` : "—");
const pctOf = (r) => (r == null ? "—" : `${Math.round(r * 100)}%`);
const fmtMoney = (v, short) => (short ? money(v, true) : moneyExact(v));   // 不带 short：记录和合计都显示到分；short 只给图表中心、月均这类紧凑处
/** 记录上的入账账户：登记过的账户（account_id）显示「图标 名称 ••尾号」，否则显示原来的文字 */
const acctShow = (r) => { const c = r.account_id && acctById(r.account_id); return c ? acctLabel(c) : r.account || ""; };

/** 收入 / 消费分组柱 + 差额（结余 / 超支）柱 + 趋势线（收支对比用） */
function flowCharts(cf, title) {
  if (!window.Charts || !cf.lines.length) return "";
  const labels = cf.lines.map((l) => l.label), f = (v, s) => fmtMoney(v, s);
  const grouped = window.Charts.bars({ labels, title, stacked: false, showTotals: false, fmt: f,
    drill: (k, i) => { const key = cf.lines[i].key; return k === 0 ? incDrill({ ...periodWin(key, cf.unit, cf.w), person: cf.person, ex: 1 }) : spendDrillOf(key, cf.unit); },
    legendDrill: (k) => (k === 0 ? incDrill({ ...cf.w, person: cf.person, ex: 1 }) : null),
    series: [{ name: t("收入"), color: GREEN, values: cf.lines.map((l) => l.income) }, ...(cf.hasSpend ? [{ name: t("消费（日常 + 住房）"), color: RED, values: cf.lines.map((l) => Math.max(0, l.spend)) }] : []),
      ...(cf.hasSpend && cf.lines.some((l) => l.other > 0) ? [{ name: t("其他流出（税、保险、利息、奉献、资本性）"), color: "#8a5fb0", values: cf.lines.map((l) => Math.max(0, l.other)) }] : [])],
    lines: cf.hasSpend && cf.lines.some((l) => l.invest > 0) ? [{ name: t("投资"), color: TEAL, values: cf.lines.map((l) => Math.max(0, l.invest)) }] : [] });
  const diff = cf.hasSpend ? window.Charts.bars({ labels, title: t("净现金流"), stacked: true, showTotals: false, fmt: f,
    series: [{ name: t("结余"), color: BLUE, values: cf.lines.map((l) => Math.max(0, l.net)) }, { name: t("超支"), color: "#b23b3b", values: cf.lines.map((l) => Math.max(0, -l.net)) }] }) : "";
  const trend = cf.lines.length > 2 ? window.Charts.line({ labels, title: t("趋势"), fmt: f, series: [{ name: t("收入"), color: GREEN, values: cf.lines.map((l) => l.income) }, ...(cf.hasSpend ? [{ name: t("消费（日常 + 住房）"), color: RED, values: cf.lines.map((l) => Math.max(0, l.spend)) }] : [])] }) : "";
  return `<div class="panel chart-panel"><h3>${t("收入 vs 消费")}</h3>${grouped}</div>${diff ? `<div class="panel chart-panel"><h3>${t("净现金流：结余 / 超支")}</h3>${diff}</div>` : ""}${trend ? `<div class="panel chart-panel"><h3>${t("趋势")}</h3>${trend}</div>` : ""}`;
}
const kindDonut = (cf) => {
  const items = statKinds(inc().merge).filter((k) => cf.byKind[k.id]).map((k) => ({ name: `${k.icon} ${kindLabel(k.id)}`, value: R2(cf.byKind[k.id]), color: k.color, drill: incDrill({ kind: k.id, ...cf.w, person: cf.person }) }));
  return items.length && window.Charts ? `<div class="panel chart-panel"><h3>${t("收入按类型（认定收入）")}</h3>${window.Charts.donut({ items, fmt: fmtMoney, stack: true, title: t("按收入类型"), center: fmtMoney(items.reduce((a, x) => a + x.value, 0), true) })}</div>` : "";
};
const lineTable = (cf) => `<div class="panel"><div class="ch-scroll"><table class="store-table"><thead><tr><th scope="col">${t("周期")}</th><th scope="col">${t("收入")}</th><th scope="col">${t("资本流入")}</th>${cf.hasSpend ? `<th scope="col">${t("消费（含住房）")}</th><th scope="col">${t("其他流出")}</th><th scope="col">${t("投资")}</th>` : ""}${cf.hasRepaid ? `<th scope="col">${t("其中：还款")}</th>` : ""}${cf.hasSpend ? `<th scope="col">${t("收入结余")}</th><th scope="col">${t("净现金流（账面）")}</th><th scope="col">${t("储蓄率")}</th>` : ""}</tr></thead><tbody>
  ${cf.lines.map((l) => `<tr><th scope="row">${esc(l.label)}</th><td>${fmtMoney(l.income)}</td><td>${l.capIn ? fmtMoney(l.capIn) : "—"}</td>${cf.hasSpend ? `<td>${fmtMoney(l.spend)}</td><td>${fmtMoney(l.other)}</td><td>${fmtMoney(l.invest)}</td>` : ""}${cf.hasRepaid ? `<td>${fmtMoney(l.repaid)}</td>` : ""}${cf.hasSpend ? `<td class="${l.incNet < 0 ? "down" : ""}">${fmtMoney(l.incNet)}</td><td class="${l.net < 0 ? "down" : ""}"><b>${fmtMoney(l.net)}</b>${l.noSpend ? ` <span class="bank-dup" title="${esc(t("这段一笔花费都没有，可能对账单还没导入"))}">⚠</span>` : ""}</td><td>${rate(l.saved, l.income)}</td>` : ""}</tr>`).join("")}
  <tr><th scope="row"><b>${t("合计")}</b></th><td><b>${fmtMoney(cf.tot.income)}</b></td><td><b>${cf.tot.capIn ? fmtMoney(cf.tot.capIn) : "—"}</b></td>${cf.hasSpend ? `<td><b>${fmtMoney(cf.tot.spend)}</b></td><td><b>${fmtMoney(cf.tot.other)}</b></td><td><b>${fmtMoney(cf.tot.invest)}</b></td>` : ""}${cf.hasRepaid ? `<td><b>${fmtMoney(cf.tot.repaid)}</b></td>` : ""}${cf.hasSpend ? `<td><b>${fmtMoney(cf.tot.incNet)}</b></td><td><b>${fmtMoney(cf.tot.net)}</b></td><td><b>${rate(cf.tot.saved, cf.tot.income)}</b></td>` : ""}</tr></tbody></table></div>
  <p class="muted" style="font-size:12.5px;margin:6px 0 0">${t("收入 = 认定收入；资本流入 = 卖房卖股的本金、借款、本金返还、从投资账户转回等，不算收入；消费 = 日常 + 住房；其他流出 = 税、保险、利息、奉献、资本性支出。收入结余 = 收入 − 全部流出；净现金流（账面）= 全部流入 − 全部流出 = 收入结余 + 资本流入；储蓄率 =（收入 − 消费 − 其他流出）÷ 收入，只看收入。")}${cf.tot.capOwn ? ` ${t("从储蓄账户转入的 {a} 没算进净现金流：那是自己账户之间挪钱，转出去时也没算支出。", { a: fmtMoney(cf.tot.capOwn) })}` : ""}${cf.hasRepaid ? ` ${t("其中「还款」= 还给个人赠与 / 借款的钱，已经算在花费里，这一列只是告诉你其中有多少。")}` : ""}</p></div>`;

/* ───────────── 收支总览（原「概览」）：时间条 → 五个指标 → 现金流瀑布 → 12 个月收支走势 → 收入按一级 → 付款方 / 成员 / 最近到账 ─────────────
 * 收入 = 认定收入（js/core/income-taxonomy.js）；消费 = 日常 / 含住房（和花费页同一口径）；净现金流 = 收入 − 消费（投资之前）；
 * 储蓄率 = 净现金流 ÷ 收入；投资率 = 投资（性质 = 投资的现金流出）÷ 收入；资本流入单列，不算收入。花费不分人：选了某个成员时只看收入。 */
/** 概览 / 类型页共用的时间范围、成员、节点（切标签不丢）；时间范围和花费页同一套：本月 / 近 3·6·9·12 个月 / 今年 / 往年 */
const OV = () => {
  const o = (inc().ov ||= { range: "12", person: "all", month: "", node: "" });
  if (o.range !== state.stats.months) { o.range = spanOk(state.stats.months) ? state.stats.months : "12"; o.month = ""; }   // 共享的时间范围（js/core/time-range.js）：花费页改了这里也跟着变
  if (!(o.person === "all" || o.person === "none" || adults().some((p) => p.id === o.person))) o.person = "all";
  return o;
};
const kpiS = (label, val, small = "", drill = "") => `<div class="kpi${drill ? " ch-hit-row" : ""}"${hitAttrs(drill, label)}><span>${esc(label)}</span><b>${val}</b>${small}</div>`;
const changeHtml = (now, before) => (before > 0 ? `<small class="${now >= before ? "gain" : "loss"}">${now >= before ? t("比上期多 {p}%", { p: Math.round(((now - before) / before) * 100) }) : t("比上期少 {p}%", { p: Math.round(((before - now) / before) * 100) })}</small>` : `<small>${t("上期没有收入")}</small>`);
const senderLabel = (x) => x.rows.find((r) => r.source_name)?.source_name || x.key;
const ovBar = (O, { keys = null } = {}) => `<div class="time-bar">${sharedRangeHtml()}
  <label class="tb-field"><span>${t("谁的")}</span><select data-inc-ov="person" data-nosearch>${personOptions(O.person, { all: true })}</select></label>
  ${keys ? `<label class="tb-field"><span>${t("月份")}</span><select data-inc-ov="month" data-nosearch><option value="">${t("整段（{r}）", { r: spanLabel(O.range) })}</option>${[...keys].reverse().map((k) => `<option value="${k}" ${k === O.month ? "selected" : ""}>${esc(periodLabel(k, "month"))}</option>`).join("")}</select></label>` : ""}</div>`;
/** 付款方排行：名字 + 金额 + 占比条 */
const rankHtml = (list, total, w, person) => `<ul class="ix-rank">${list.map((x) => `<li><div class="rk-top"><button type="button" class="link-name" data-drill="${esc(incDrill({ q: senderLabel(x), ...w, person }))}">${esc(senderLabel(x))}</button><b>${fmtMoney(x.total)}</b></div>
  <div class="rk-bar" aria-hidden="true"><i style="width:${total > 0 ? Math.max(2, Math.round((x.total / total) * 100)) : 0}%"></i></div><small class="muted">${t("{n} 次", { n: x.n })} · ${rate(x.total, total)}${x.cap ? ` · ${t("另有资本流入 {a}", { a: fmtMoney(x.cap) })}` : ""}</small></li>`).join("")}</ul>`;
/** 总览要用的月份：时间范围（月）、12 个月走势（选了某一年 = 那一年） */
function ovMonths(O) {
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
function overviewTab() {
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
  const TP = trendPeriods(trend), pEnd = (i) => { const m = TP.when(i); const last = m.month || m.mlist.split(",").at(-1); const d = new Date(+last.slice(0, 4), +last.slice(5, 7), 0); const e = iso(d); return e > todayISO() ? todayISO() : e; };
  const pFrom = (i) => `${(TP.when(i).month || TP.when(i).mlist.split(",")[0])}-01`;
  const trendChart = window.Charts ? window.Charts.bars({ title: t("收入 vs 消费"), labels: TP.labels, stacked: false, showTotals: false, fmt: fmtMoney,
    series: [{ name: t("收入"), color: GREEN, values: TP.agg(trend.map((m) => R2(TI.income[m]))) }, ...(TS ? [{ name: t("消费（日常 + 住房）"), color: RED, values: TP.agg(trend.map((m) => R2(TS.bucket[m].living + TS.bucket[m].housing))) }] : [])],
    lines: TS ? [{ name: t("投资"), color: TEAL, values: TP.agg(trend.map((m) => R2(TS.bucket[m].investment))) }] : [],
    drill: (k, i) => (k === 0 ? incDrill({ from: pFrom(i), to: pEnd(i), person: O.person, ex: 1 }) : dq(TP.when(i))),
    lineDrill: (_, i) => dq({ nat: "investment", ...TP.when(i) }),
    legendDrill: (k) => (k === 0 ? incDrill({ from: `${trend[0]}-01`, to: todayISO(), person: O.person, ex: 1 }) : null) }) : "";
  const rows = incomeIn(w.from, w.to, O.person), senders = groupSum(rows, (r) => skey(r.source_name)).filter((x) => x.total > 0), top = senders.slice(0, 5), total = incSumOf(rows);
  const rank = top.length ? `<div class="panel"><div class="chart-head"><h3>${t("主要付款方")}</h3><a class="btn btn-sm btn-ghost" href="${incomeHref("senders")}">${t("全部付款方")} ›</a></div>${rankHtml(top, total, w, O.person)}</div>` : "";
  const byP = groupSum(rows, (r) => r.person_id || "");
  const members = byP.length > 1 || (byP.length === 1 && byP[0].key) ? `<div class="panel"><h3 style="margin:0 0 8px">${t("按成员")}</h3><div class="ch-scroll"><table class="store-table ix-tbl"><thead><tr><th scope="col">${t("成员")}</th><th scope="col">${t("笔数")}</th><th scope="col">${t("收入")}</th><th scope="col">${t("占比")}</th></tr></thead><tbody>
    ${byP.map((x) => `<tr class="ch-hit-row"${hitAttrs(incDrill({ ...w, person: x.key || "none" }), x.key ? personName(x.key) : t("未指定 / 全家"))}><th scope="row">${esc(x.key ? personName(x.key) || t("已删除的成员") : t("未指定 / 全家"))}</th><td>${x.n}</td><td>${fmtMoney(x.total)}</td><td>${rate(x.total, total)}</td></tr>`).join("")}
    <tr><th scope="row"><b>${t("全家合计")}</b></th><td><b>${byP.reduce((a, x) => a + x.n, 0)}</b></td><td><b>${fmtMoney(total)}</b></td><td>100%</td></tr></tbody></table></div></div>` : "";
  const recent = I.rec.filter((r) => personOk(r, O.person)).slice().sort((a, b) => b.received_on.localeCompare(a.received_on) || String(b.created_at).localeCompare(String(a.created_at))).slice(0, 5);
  const recentHtml = recent.length ? `<div class="panel"><div class="chart-head"><h3>${t("最近到账")}</h3><a class="btn btn-sm btn-ghost" href="${incomeHref("records")}">${t("全部明细")} ›</a></div><ul class="restock-list ix-list">${recent.map(recordRow).join("")}</ul></div>` : "";
  return `${ovBar(O)}${kpis}${netWorthCard()}${all ? waterfallHtml(F, spW, esc(incDrill({ kind: "g:capital", ...w, person: O.person }))) : ""}
    <div class="panel chart-panel"><h3>${t("收入 vs 消费（{r}）", { r: trend.length === months.length ? spanLabel(O.range) : t("近 12 个月") })}</h3>${trendChart}<p class="muted drill-hint">${t("柱子 = 认定收入和消费（日常 + 住房），虚线 = 投资转入。点一下看对应的明细。")}</p></div>
    ${breakdown}<div class="ix-two">${rank}${members}</div>${recentHtml}${repayPanel()}
    ${tabHub(INCOME_TABS, incomeHref, t("其他功能"))}`;
}

/* ───────────── 类型：一级 → 叶子逐层点进去（面包屑回上层），子类排行（带占比）+ 选中节点的月度柱状图（和花费的「分类」页一样，没有饼图） ─────────────
 * 节点：""（全部）/ 一级 id / "一级|叶子"（资本流入下是 capital|叶子；卖股票这类的收益记在 investment|stock_sale）。 */
const nodeL1 = (node) => String(node).split("|")[0];
const nodeName = (node) => {
  if (!node) return t("全部类型");
  const [l1, leaf] = String(node).split("|"), g = incL1(l1);
  if (!leaf) return `${g.icon} ${t(g.name)}`;
  const k = incLeaf(leaf); return `${k.icon} ${t(k.name)}${l1 !== "capital" && !isIncomeKind(leaf) ? ` ${t("（收益部分）")}` : ""}`;
};
function nodeCrumb(node) {
  const path = node ? (String(node).includes("|") ? [nodeL1(node), node] : [node]) : [];
  const btn = (id, label) => `<button type="button" class="linkbtn" data-inc="node" data-node="${esc(id)}">${esc(label)}</button>`;
  return `<nav class="node-crumb" aria-label="${esc(t("类型层级"))}">${node ? btn("", t("全部类型")) : `<b aria-current="page">${t("全部类型")}</b>`}${path.map((id, i) => `<span class="sep" aria-hidden="true">›</span>${i === path.length - 1 ? `<b aria-current="page">${esc(nodeName(id))}</b>` : btn(id, nodeName(id))}`).join("")}</nav>`;
}
/** 一个一级下面出现过的叶子节点（分类表里的 + 汇总里有数的，比如投资收益下的「卖股票所得（收益部分）」） */
function childNodes(agg, l1) {
  const ids = new Set(incLeavesOf(l1).map((k) => `${l1}|${k}`));
  for (const m of agg.months) for (const k of Object.keys(l1 === "capital" ? agg.capLeaf[m] : agg.leaf[m])) { const id = l1 === "capital" ? `capital|${k}` : k; if (nodeL1(id) === l1) ids.add(id); }
  return [...ids];
}
const nodeKindSel = (node) => (!node ? "" : String(node).includes("|") ? String(node).split("|")[1] : `g:${node}`);
const MAX_SERIES = 7;
function categoryTab() {
  const I = inc(), O = OV();
  if (!I.rec.length) return empty();
  const { w, months, span } = ovMonths(O);
  if (O.month && !months.includes(O.month)) O.month = "";
  const node = O.node && (INC_L1S.some((g) => g.id === nodeL1(O.node))) ? O.node : "", bar = ovBar(O, { keys: months });
  const cm = months.length > 1 ? months : monthsBetween(iso(new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1)), todayISO());
  const cspan = spanOfMonths([...months, ...cm]);
  const rows = roll("inc", cspan.from, cspan.to);
  if (!rows) return `${bar}${nodeCrumb(node)}<p class="muted" role="status">${t("加载中…")}</p>`;
  const A = incAggregate(rows, months, { cur: cur(), person: O.person }), sel = O.month || null, leaf = String(node).includes("|");
  const kids = !node ? INC_L1S.map((g) => g.id) : leaf ? [] : childNodes(A, node);
  const val = (id, m = sel) => incNodeSum(A, id, m);
  const ranked = kids.map((id) => ({ id, v: val(id) })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
  const win = sel ? periodWin(sel, "month", w) : w, kd = (id) => incDrill({ kind: nodeKindSel(id), ...win, person: O.person });
  const total = node ? val(node) : R2(ranked.filter((x) => x.id !== "capital").reduce((a, x) => a + x.v, 0));
  const items = ranked.map(({ id, v }) => { const isL1 = !String(id).includes("|"), g = incL1(nodeL1(id)), k = isL1 ? g : incLeaf(String(id).split("|")[1]);
    return { name: `${nodeName(id)}${isL1 && !g.income ? ` · ${t("不计收入")}` : ""}`, value: v, color: k.color, ...(isL1 ? { btn: `data-inc="node" data-node="${esc(id)}" aria-label="${esc(t("看「{n}」的细分", { n: t(g.name) }))}"` } : { drill: kd(id) }) }; });
  // 月度柱状图：选中节点按子类堆叠（子类多时前 7 个 + 其他）；只看一个月时画近 6 个月
  const C = incAggregate(rows, cm, { cur: cur(), person: O.person });
  const ids = leaf ? [node] : (node ? childNodes(C, node) : INC_L1S.filter((g) => g.income).map((g) => g.id)).map((id) => ({ id, v: incNodeSum(C, id) })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v).map((x) => x.id);
  const top = ids.slice(0, MAX_SERIES), rest = ids.slice(MAX_SERIES);
  const ser = top.map((id) => { const isL1 = !String(id).includes("|"), k = isL1 ? incL1(id) : incLeaf(String(id).split("|")[1]); return { id, name: nodeName(id), color: k.color, values: cm.map((m) => incNodeSum(C, id, m)) }; });
  if (rest.length) ser.push({ id: node, name: t("其他"), color: "#8a948f", values: cm.map((m) => R2(rest.reduce((s, id) => s + incNodeSum(C, id, m), 0))) });
  const cmW = { from: `${cm[0]}-01`, to: todayISO() };
  const chart = ser.length && window.Charts ? window.Charts.bars({ title: t("{k}每月", { k: nodeName(node) }), labels: cm.map(monthLabel), fmt: fmtMoney, series: ser,
    drill: (k, i) => incDrill({ kind: nodeKindSel(ser[k].id), ...periodWin(cm[i], "month", cmW), person: O.person }), legendDrill: (k) => incDrill({ kind: nodeKindSel(ser[k].id), ...(months.length > 1 ? w : cmW), person: O.person }) })
    : `<p class="muted">${t("这段时间没有收入")}</p>`;
  const capNote = !node && val("capital") > 0 ? `<p class="muted small" style="margin:6px 0 0">${t("资本与资产流入（卖房卖股的本金、借款、自己账户转入、国际电汇…）只是现金流入，不算收入，不在合计里。")}</p>` : "";
  return `${bar}${nodeCrumb(node)}
    <div class="panel chart-panel"><div class="row"><h3 style="margin:0">${esc(nodeName(node))}</h3><b class="num">${fmtMoney(total)}</b></div>
      <p class="muted" style="margin:2px 0 8px;font-size:13px">${sel ? monthLabel(sel) : spanLabel(O.range)}${leaf ? "" : ` · ${t("点名称看下一层，点条看明细")}`}</p>
      ${leaf ? "" : window.Charts ? window.Charts.hbars({ items, fmt: fmtMoney, total: node ? total : null, title: t("子类排行"), empty: t("这段时间没有收入") }) : ""}${capNote}
      <div class="form-actions"><button type="button" class="btn btn-sm" data-drill="${esc(incDrill({ kind: nodeKindSel(node), ...win, person: O.person, ex: node ? "" : 1 }))}">${t("查看明细")} ›</button></div></div>
    <div class="panel chart-panel"><h3>${t("每月走势")}</h3>${chart}${DRILL_HINT()}</div>`;
}

/* ───────────── 银行导入：对账单里的入账补入收入（和「花费 → 银行导入」是同一个入口） ───────────── */
function importTab() {
  // 「最近导入的收入」：笔数 / 合计按现在还带着这批标记的收入算（收入已整表在内存里），和点「查看收入」看到的一致；导入时的数字不一样就注一句
  const I = inc(), live = new Map();
  for (const r of I.rec) if (r.import_batch) { const x = live.get(r.import_batch) || { n: 0, sum: 0 }; x.n++; x.sum = Math.round((x.sum + num(r.amount)) * 100) / 100; live.set(r.import_batch, x); }
  const allB = (meta("_bank_batches", []) || []).filter((b) => b.inN || live.has(b.id)).slice().reverse();
  const lim = pageLimit("inc-batches"), batches = allB.slice(0, lim);
  const nums = (b) => live.get(b.id) || { n: 0, sum: 0 };
  return `<div class="panel"><h3 style="margin:0 0 6px">🏦 ${t("从银行对账单导入收入")}</h3>
    <p class="muted small" style="margin:0 0 10px">${t("同一个入口：选一次对账单（CSV、Excel、OFX、PDF、截图），里面刷卡 / 扣款记成花费，工资、利息、股息、转入这些入账单独列出来记成收入（借款到账、券商转入这类记成资本流入，不算收入），互不重复。自己账户之间的转账会跳过。")}</p>
    <div class="form-actions"><a class="btn btn-primary btn-sm" href="${href("bills", "statements")}">${t("去导入对账单")}</a><a class="btn btn-sm" href="${incomeHref("records")}">${t("或者拍照 / 手动记一笔")}</a></div></div>
  <div class="panel"><h3 style="margin:0 0 6px">${t("最近导入的收入")}</h3>${batches.length ? `<ul class="restock-list">${batches.map((b) => `<li><div class="grow"><span class="name">${b.account ? `🏦 ${esc(b.account)}` : esc(b.file || t("银行导入"))}</span><small>${t("收入 {n} 笔", { n: nums(b).n })} · ${fmtMoney(nums(b).sum)} · ${t("导入于 {d}", { d: String(b.at).slice(0, 10) })}${nums(b).n !== (b.inN || 0) ? ` <span class="bank-dup">${nums(b).n ? t("（导入时 {n} 笔，之后改过）", { n: b.inN || 0 }) : t("（导入的都已删除）")}</span>` : ""}</small></div>${nums(b).n ? `<a class="btn btn-sm btn-ghost" href="${href("bills", "income")}?tab=records&batch=${esc(b.id)}">${t("查看收入")}</a>` : ""}</li>`).join("")}</ul><p class="muted bank-batch-count">${t("显示 {a} / 共 {b} 批", { a: batches.length, b: allB.length })}</p>${pageMoreBtn("inc-batches", allB.length, batches.length)}` : `<p class="muted small" style="margin:0">${t("还没有从对账单导入过收入。")}</p>`}</div>`;
}

function repayPanel() {
  const list = openRepayments(); if (!list.length) return "";
  return `<div class="panel"><h3 style="margin:0 0 8px">🤝 ${t("还没还清的（个人赠与 / 借款）")}</h3><ul class="restock-list">${list.map(({ r, s }) => `<li><div class="grow"><span class="name">${esc(r.source_name)} · ${fmtMoney(s.total)}</span><small>${t("已还 {a}，还差 {b}", { a: fmtMoney(s.paid), b: fmtMoney(s.left) })}${r.repay_due_on ? ` · ${s.overdue ? `<b class="bank-dup">${t("已逾期")}</b> ` : ""}${t("到期日 {d}", { d: r.repay_due_on })}` : ""}</small></div>
    <button type="button" class="btn btn-sm btn-ghost" data-inc="open" data-id="${r.id}">${t("去还款")}</button></li>`).join("")}</ul></div>`;
}

/* ───────────── 明细 ───────────── */
/** 图表钻取的查询串 → 明细筛选：类型（叶子 / g:一级，旧的 g:work 这类自动换算）、日期段 from–to、成员、账户、搜索、ex = 不含资本流入 */
function applyIncomeDrill(q) {
  const I = inc(), d = (k) => (/^\d{4}-\d{2}-\d{2}$/.test(q.get(k) || "") ? q.get(k) : "");
  Object.assign(I, { q: q.get("q") || "", kind: normKindSel(q.get("kind") || "all"), acct: q.get("acct") || "all", person: q.get("person") || "all", year: "all", month: "all", batch: null, from: d("from"), to: d("to"), ex: q.get("ex") === "1", limit: pageSize(), open: null, selMode: false });
}
/* 明细是服务器分页（迁移 054 / 056 的 inc_page / inc_stats）：每次「继续加载」向数据库要下一页，筛选、排序、合计都在 SQL 里做；
 * 类型（叶子 / 一级）、搜索里的类型名称、「默认不算收入的类型」这类只有前端认识的规则，先在这里展开成类型表。 */
const SORT_KEY = { big: "high", small: "low", kind: "name" };   // 界面的排序 → 通用排序（按类型 = 按类型序号排）
function incParams() {
  const I = inc(), q = skey(I.q), ks = kindList().map((k) => k.id), sort = SORT_KEY[I.sort] || I.sort || "new", byKind = !!I.kind && I.kind !== "all";
  const label = (id) => skey(`${kindLabel(id)} ${kindOf(id).name} ${groupOf(id).name}`);   // 和原来搜索时拼的类型文字一样
  return compact({ kinds: byKind ? ks.filter((k) => kindMatch(I.kind, k)) : null, known: byKind ? ks : null, kunk: byKind && kindMatch(I.kind, "__unknown__") ? true : null,
    person: I.person !== "all" ? I.person : null, acct: I.acct && I.acct !== "all" ? I.acct : null, year: I.year && I.year !== "all" ? I.year : null, mon: I.month && I.month !== "all" ? I.month : null, batch: I.batch || null,
    from: I.from || null, to: I.to || null, ex: I.ex ? capitalKinds() : null, capk: capitalKinds(), q: q || null, qkinds: q ? ks.filter((k) => label(k).includes(q)) : null,
    krank: sort === "name" ? Object.fromEntries(ks.map((k, i) => [k, i])) : null, sort });   // 按类型：一级 → 叶子的顺序，同类里新的在前
}
/** 明细列表：读到的几页 + 当前筛选的笔数、合计 */
export const incList = serverList("inc", { host: "#incList", map: (r) => ({ ...r, amount: num(r.amount), income_amount: r.income_amount == null ? null : num(r.income_amount) }), draw: () => renderIncList() });
window.addEventListener("income-rows-changed", () => incList.reload());   // loadIncome 读完（实时同步、自己改了）：统计 + 第一页重读
/** 明细顶部「当前筛选」：图表点进来的日期段、不含资本流入，可逐个去掉（和花费明细的筛选条一样） */
function drillChips() {
  const I = inc(), out = [];
  if (I.from || I.to) out.push(["range", I.from === I.to ? I.from : `${I.from || "…"} → ${I.to || "…"}`]);
  if (I.ex) out.push(["ex", t("不含资本流入")]);
  if (!out.length) return "";
  return `<div class="filter-chips" role="group" aria-label="${esc(t("当前筛选"))}"><span class="muted">${t("当前筛选")}</span>${out.map(([k, label]) => `<button type="button" class="chip fchip" data-inc="drill-clear" data-k="${k}" aria-label="${esc(t("去掉筛选：{x}", { x: label }))}">${esc(label)} <span aria-hidden="true">✕</span></button>`).join("")}</div>`;
}
const canEdit = (r) => isOwnerNow() || r.created_by === state.user?.id;
/** 正在改哪一条：它就在已显示的列表里时，表单在那一行下面展开；否则（被筛掉 / 还没翻到）表单放顶部 */
const inlineEditId = () => { const I = inc(), id = I.form?.rec?.id; return id && activeTab(state.route) === "records" && incList.rows.some((x) => x.id === id) ? id : null; };
/** 行上的「收入 / 资本流入」小标：整笔都算收入时不标 */
function recBadge(r) {
  const s = splitRecord(r);
  if (!s.cap) return "";
  return s.income ? `<span class="badge b-ok">${t("收入 {a}", { a: fmtMoney(s.income) })}</span>` : `<span class="badge" style="background:var(--surface-2)">${r.repay_required ? t("借款") : t("资本流入")}</span>`;
}
function recordRow(r) {
  const I = inc(), s = repayState(r), pick = !!I.selMode && activeTab(state.route) === "records", editing = !pick && inlineEditId() === r.id, open = I.open === r.id && !editing;
  const who = r.person_id ? personName(r.person_id) : "", acct = acctShow(r), sub = [esc(fmtDate(r.received_on)), esc(kindLabel(r.kind)), who && esc(who), acct && esc(acct), r.channel && esc(t((CHANNELS.find((c) => c[0] === r.channel) || [])[1] || ""))].filter(Boolean).join(" · ");
  const rb = s ? `<span class="badge ${s.status === "paid" ? "b-ok" : s.overdue ? "b-out" : "b-soon"}">${s.status === "paid" ? t("已还清") : s.overdue ? t("逾期") : t("待还 {a}", { a: fmtMoney(s.left) })}</span>` : "";
  return `<li class="ix-li${open || editing ? " is-open" : ""}" data-id="${r.id}"${canEdit(r) && !pick && !editing ? ' data-swipe-del="income"' : ""}>${pick ? `<label class="ix-main"><input type="checkbox" class="ix-chk" data-inc-sel="${r.id}" ${I.sel?.has(r.id) ? "checked" : ""} ${canEdit(r) ? "" : "disabled"} aria-label="${esc(t("选择"))}">` : `<button type="button" class="ix-main" data-inc="${canEdit(r) ? "edit" : "open"}" data-id="${r.id}" ${canEdit(r) ? `title="${esc(editing ? t("再点一下收起") : t("点一下编辑"))}" aria-expanded="${editing}"` : `aria-expanded="${open}"`}>`}
    <span class="ix-ico" style="--k:${kindOf(r.kind).color}" aria-hidden="true">${kindOf(r.kind).icon}</span><span class="grow"><b class="name">${esc(r.source_name)}</b><small>${sub}</small></span><span class="ix-side"><b class="ix-amt">+${fmtMoney(r.amount)}</b>${recBadge(r)}${I.drafts?.[r.id] ? `<span class="badge b-soon">${t("草稿")}</span>` : ""}${rb}</span>${pick ? "</label>" : "</button>" + rowTools(r, open)}${editing ? `<div class="ix-edit">${formHtml()}</div>` : ""}${open && !pick ? recordDetail(r, s) : ""}</li>`;
}
/** 行右边：▾ 展开 / 收起详情（还款、备注、原币种…）；隐藏的「删除」给左滑用（js/swipe-rows.js），键盘 Tab 到它也能删 */
const rowTools = (r, open) => `<button type="button" class="ix-more" data-inc="open" data-id="${r.id}" aria-expanded="${open}" aria-label="${esc(t("展开详情"))}" title="${esc(t("展开详情"))}">${open ? "▴" : "▾"}</button>${canEdit(r) ? `<button type="button" class="swipe-src" data-inc="del-swipe" data-id="${r.id}">${t("删除")}</button>` : ""}`;
function recordDetail(r, s) {
  const sp = splitRecord(r);
  const extra = [sp.cap && t("认定收入 {a}，资本流入 {b}", { a: fmtMoney(sp.income), b: fmtMoney(sp.cap) }), r.orig_amount && `${t("原币种")} ${r.orig_amount} ${r.orig_currency || ""}`, r.fee != null && `${t("手续费")} ${fmtMoney(r.fee)}`, r.import_batch && t("银行导入"), r.created_by && r.created_by !== state.user?.id && memberLabel(r.created_by) && t("{n} 记的", { n: memberLabel(r.created_by) })].filter(Boolean);
  const reps = inc().rep.filter((p) => p.record_id === r.id).sort((a, b) => b.paid_on.localeCompare(a.paid_on));
  const repay = s?.debt ? `<div class="ix-repay"><b>🤝 ${t("已转为借款")}</b> · ${t("总额 {a}，已还 {b}，还差 {c}", { a: fmtMoney(s.total), b: fmtMoney(s.paid), c: fmtMoney(s.left) })}
      <p style="margin:6px 0 0"><a class="btn btn-sm" href="${esc(debtHref(s.debt))}">${t("去借贷里记还款")} ›</a></p></div>`   // 迁移 058：还款走借贷（余额、到期、提醒都在那里）
    : s ? `<div class="ix-repay"><b>🤝 ${t("还款（还给对方）")}</b> · ${t("总额 {a}，已还 {b}，还差 {c}", { a: fmtMoney(s.total), b: fmtMoney(s.paid), c: fmtMoney(s.left) })}${r.repay_due_on ? ` · ${t("到期日 {d}", { d: r.repay_due_on })}` : ""}
    <ul class="ix-reps">${reps.map((p) => `<li><span>${p.paid_on} · <b>${fmtMoney(p.amount)}</b>${p.method ? ` · ${esc(p.method)}` : ""}${p.purchase_id ? ` · <span class="muted">${t("已计入花费")}</span>` : ""}</span><button type="button" class="btn btn-sm btn-ghost" data-inc="rep-del" data-id="${p.id}">${t("删除")}</button></li>`).join("") || `<li class="muted">${t("还没有还款记录")}</li>`}</ul>
    ${s.left > 0 ? `<form data-inc-form="repay" data-id="${r.id}" class="form-grid" style="margin-top:6px"><label>${t("还款日期")}<input type="date" name="paid_on" value="${todayISO()}" required></label><label>${t("金额")}<input type="number" name="amount" step="0.01" min="0.01" value="${s.left}" required></label><label>${t("方式")}<input name="method" maxlength="40" placeholder="Zelle / ${esc(t("现金"))}"></label><label class="check-inline" style="grid-column:1/-1"><input type="checkbox" name="as_spend" checked><span>${t("同时记为一笔花费（钱从账户里出去了）")}</span></label><small class="muted" style="grid-column:1/-1">${t("如果这笔转账已经从银行对账单导入成花费了，系统会发现并不再重复记；也可以取消勾选。")}</small><div class="form-actions"><button class="btn btn-sm btn-primary">${t("记一笔还款")}</button></div></form>` : ""}</div>` : "";
  return `<div class="ix-detail">${extra.length ? `<p class="muted small" style="margin:0 0 6px">${extra.map(esc).join(" · ")}</p>` : ""}${r.notes ? `<p style="margin:0 0 6px">${esc(r.notes)}</p>` : ""}${repay}
    ${canEdit(r) ? `<div class="form-actions"><button type="button" class="btn btn-sm" data-inc="edit" data-id="${r.id}">${t("编辑")}</button><button type="button" class="btn btn-sm btn-ghost" data-inc="del" data-id="${r.id}">${t("删除")}</button></div>` : ""}</div>`;
}
const selBar = () => { const I = inc(); return I.selMode ? `<div class="ix-selbar"><span id="incSelN" role="status">${t("已选 {n} 笔", { n: I.sel?.size || 0 })}</span><button type="button" class="btn btn-sm btn-ghost" data-inc="sel-all">${t("全选当前显示的")}</button><button type="button" class="btn btn-sm" data-inc="sel-del">${t("删除所选")}</button></div>` : ""; };
const listHtml = () => {
  const L = incList.sync(incParams()), st = L.stats || {}, capS = num(st.cap_sum);
  const empty = `<li class="muted"${L.busy ? ' role="status"' : ""}>${L.busy ? t("加载中…") : L.err ? esc(L.err) : t("没有符合条件的记录")}</li>`;
  const head = st.income_sum != null ? t("{n} 笔，到账 {m} · 认定收入 {i}", { n: st.n ?? "…", m: fmtMoney(num(st.sum)), i: fmtMoney(num(st.income_sum)) }) + (capS > 0 ? ` · ${t("资本流入 {a}", { a: fmtMoney(capS) })}` : "") : t("{n} 笔，合计 {m}", { n: st.n ?? "…", m: fmtMoney(num(st.sum)) });
  return `${selBar()}<div class="muted small" style="margin:0 0 6px">${head}</div><ul class="restock-list ix-list">${L.rows.map(recordRow).join("") || empty}</ul>
    ${L.busy && L.rows.length ? `<p class="muted" role="status" style="text-align:center">${t("加载中…")}</p>` : moreBtn(L.hasMore, 'data-inc="more"')}`;
};
export const renderIncList = () => { const el = $("#incList"); if (el) el.innerHTML = listHtml(); };
/** 三种记法（和「记一笔花费」一样）：手动 / 拍照识别 / 导入对账单 */
const waysHtml = () => { const I = inc(), newOpen = !!I.form && !I.form.rec?.id; return `<div class="entry-ways" role="group" aria-label="${esc(t("三种记法"))}">
  <button type="button" class="way ${newOpen ? "is-cur" : ""}" data-inc="way-manual" aria-pressed="${newOpen ? "true" : "false"}"><span class="way-ico" aria-hidden="true">✍️</span><span>${t("手动记一笔")}</span></button>
  <button type="button" class="way ${I.scanOpen ? "is-cur" : ""}" data-inc="way-scan" aria-pressed="${I.scanOpen ? "true" : "false"}"><span class="way-ico" aria-hidden="true">📷</span><span>${t("拍照识别")}</span></button>
  <a class="way" href="${href("bills", "statements")}"><span class="way-ico" aria-hidden="true">🏦</span><span>${t("导入对账单")}</span></a></div>`; };
/** 账户筛选：用过的登记账户 + 「没关联登记账户的」 */
function acctFilterOptions(sel) {
  const used = new Set(inc().rec.map((r) => r.account_id).filter(Boolean)), list = (state.cards || []).filter((c) => used.has(c.id) || c.id === sel);
  const opt = (v, l) => `<option value="${esc(v)}" ${v === sel ? "selected" : ""}>${esc(l)}</option>`;
  return `${opt("all", t("全部账户"))}${list.map((c) => opt(c.id, acctLabel(c))).join("")}${opt("none", t("没关联登记账户的"))}`;
}
function recordsTab() {
  const I = inc(), top = `${aaFixHtml()}${waysHtml()}${I.scanOpen ? scanHtml() : ""}${I.form && !inlineEditId() ? formHtml() : ""}`;
  if (!I.rec.length && !I.form) return top + empty() + kindManager();
  // 和花费明细同一套 .toolbar：宽屏一行（搜索 + 下拉）；手机收成「搜索框 + 筛选」按钮，点开才出下拉（shared/compact-filters.js）
  const opt = (v, l, cur) => `<option value="${esc(v)}" ${v === cur ? "selected" : ""}>${esc(l)}</option>`;
  return `${top}<div class="panel"><div class="toolbar ix-toolbar">
    <input type="search" data-inc-f="q" value="${esc(I.q)}" placeholder="${esc(t("搜索付款方 / 备注"))}" aria-label="${esc(t("搜索收入"))}">
    <select id="incKindF" data-inc-f="kind" aria-label="${esc(t("按类型筛选"))}">${kindOptionsHtml(I.kind, { all: true, groups: true, allLabel: t("全部类型") })}</select>
    <select id="incAcctF" data-inc-f="acct" data-nosearch aria-label="${esc(t("按账户筛选"))}">${acctFilterOptions(I.acct || "all")}</select>
    <select id="incPersonF" data-inc-f="person" data-nosearch aria-label="${esc(t("按成员筛选"))}">${personOptions(I.person, { all: true })}</select>
    <select id="incYearF" data-inc-f="year" data-nosearch aria-label="${esc(t("按年份筛选"))}">${opt("all", t("全部年份"), I.year)}${yearsOf().map((v) => opt(v, v, I.year)).join("")}</select>
    <select id="incMonthF" data-inc-f="month" data-nosearch aria-label="${esc(t("按月份筛选"))}">${opt("all", t("全部月份"), I.month || "all")}${Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map((m) => opt(m, t("{m} 月", { m: +m }), I.month)).join("")}</select>
    ${clearFiltersBtn("incRec", changed(I, FD.incRec))}
    <select id="incSort" data-inc-f="sort" data-nosearch aria-label="${esc(t("排序"))}">${selOpts([["new", "最近的在前"], ["old", "最早的在前"], ["big", "金额从大到小"], ["small", "金额从小到大"], ["kind", "按类型（一级 · 具体类型）"]], I.sort || "new")}</select></div>
    ${drillChips()}
    ${I.batch ? `<div class="muted small" style="margin-top:8px">${t("只看一次银行导入的入账")} <button type="button" class="btn btn-sm btn-ghost" data-inc="batch-clear">${t("看全部收入")}</button></div>` : ""}
    <div class="ix-tools"><button type="button" class="btn btn-sm btn-ghost" data-inc="sel-toggle">${I.selMode ? t("退出多选") : t("多选删除")}</button><button type="button" class="btn btn-sm btn-ghost" data-inc="print-list">${t("打印")}</button><button type="button" class="btn btn-sm btn-ghost" data-inc="csv-detail">${t("导出当前列表 CSV")}</button></div>
    <div id="incList" style="margin-top:8px">${listHtml()}</div>
  </div>${kindManager()}`;
}
/** 自定义类型挂在哪个一级下（旧的大类显示成换算后的一级） */
const l1Select = (attrs, sel) => `<select ${attrs} data-nosearch>${INC_L1S.map((g) => `<option value="${g.id}" ${sel === g.id ? "selected" : ""}>${esc(`${t(g.name)}${g.income ? "" : ` · ${t("不计收入")}`}`)}</option>`).join("")}</select>`;
function kindManager() {
  const cs = customKinds();
  return `<details class="panel ref-panel" style="margin-top:10px"><summary><b>${t("管理收入类型")}</b><small>${t("内置 {n} 种，自定义 {m} 种", { n: kindList().filter((k) => !k.custom).length, m: cs.length })}</small><span class="mch" aria-hidden="true">›</span></summary><div class="ref-body">
    <p class="muted small" style="margin:0 0 6px">${t("内置类型的一级：{g}", { g: INC_L1S.map((g) => `${t(g.name)}（${incLeavesOf(g.id).filter((id) => !id.startsWith("c_")).map((id) => t(incLeaf(id).name)).join("、")}）`).join("；") })}</p>
    <p class="muted small" style="margin:0 0 6px">${t("「资本与资产流入」只是现金流入，不算收入：卖房 / 卖股票的本金、借款、本金返还、自己账户转入、国际电汇。卖出时有赚的，在记录里填「其中已实现收益」，那部分算投资收益。")}</p>
    <ul class="plain small">${cs.map((k) => `<li>${esc(k.icon || "🏷️")} ${esc(kindLabel(k.id))} ${l1Select(`data-inc-kparent="${esc(k.id)}" aria-label="${esc(t("一级分类"))}"`, k.parent)} <button type="button" class="btn btn-sm btn-ghost" data-inc="kind-del" data-id="${esc(k.id)}">${t("删除")}</button></li>`).join("") || `<li class="muted">${t("还没有自定义类型")}</li>`}</ul>
    <form data-inc-form="kind" class="form-grid"><label>${t("一级分类")}${l1Select('name="parent"', "other_income")}</label><label>${t("图标")}<input name="icon" maxlength="4" value="🏷️" style="width:4em"></label><label>${t("名称")}<input name="name" maxlength="20" required placeholder="${esc(t("例如：稿费、副业"))}"></label><div class="form-actions"><button class="btn btn-sm">${t("添加类型")}</button></div></form></div></details>`;
}

/* ── 入账账户：「卡与账户」里登记的账户（支票 / 储蓄 / 券商 / 退休 / HSA / 借记卡 / 钱包 / 现金…），可设默认 ──
 * 记录上存 account_id（迁移 056）和一份文字 account（「名称 ••尾号」，显示兜底；没登记的现金存「现金」，其他手填）。
 * 默认账户按人存在预算设置 _income_cfg.defAcct[用户 id]（登记账户的 id 或 cash）。 */
const INCOME_ACCT_KINDS = ["checking", "savings", "brokerage", "retirement", "hsa", "cash", "debit", "wallet", "loan"];
const INCOME_ACCT_EXTRA = [["cash", "现金（没登记的）"], ["other", "其他（手填）"]];
const acctText = (c) => `${c.name}${c.last4 ? ` ••${c.last4}` : ""}`;
const incomeAccts = () => (state.cards || []).filter((c) => INCOME_ACCT_KINDS.includes(c.kind || "credit"));
const hasBankAcct = () => incomeAccts().some((c) => c.active !== false);
const incCfg = () => meta("_income_cfg", {}) || {};
const defAcct = () => incCfg().defAcct?.[state.user?.id || "me"] || "";
/** 默认账户还在（没被删 / 没停用）才用 */
const defAcctValid = () => { const v = defAcct(); return v === "cash" || (v && incomeAccts().some((c) => c.id === v && c.active !== false)) ? v : ""; };
/** 记录 → 下拉的值：登记账户 id / cash / other / 空。有 account_id 用它；老记录按原来的文字对上登记过的账户 */
function acctValueOf(r) {
  if (r.account_id && acctById(r.account_id)) return r.account_id;
  const s = String(r.account || "").trim(); if (!s) return "";
  if (s === "现金" || /^cash$/i.test(s)) return "cash";
  const list = incomeAccts(), exact = list.find((c) => acctText(c) === s || c.name === s);
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
/** 类型下面的一句说明：资本流入不算收入；卖出类可以填「其中已实现收益」 */
const kindHint = (kind) => (kind === "zelle" || kind === "reimburse" ? t("朋友 AA 还你、替人垫付后还回、报销：是你自己的钱回来了，不算收入——请在 花费 里记一笔负数（勾「退款 / 报销」，选当初那笔的分类）。这里只记真正的收入：赠与、副业收款等。")
  : GAIN_KINDS.includes(kind) ? t("卖出 / 资本利得：到账金额里只有赚的那部分算收入，填在下面「其中已实现收益」；不填 = {d}。", { d: isIncomeKind(kind) ? t("整笔都算收入") : t("整笔都不算收入") })
  : isIncomeKind(kind) ? "" : t("资本与资产流入：记下来（现金流里看得到），但不算收入。"));
function formHtml() {
  const I = inc(), f = I.form, owner = isOwnerNow(), mine = myPersonId();
  let r = f.rec || {};
  const person = r.person_id !== undefined ? r.person_id : mine, d = (v) => esc(v ?? "");
  if (!r.id) r = { ...r, source_name: r.source_name || defValid("source_name") || undefined, kind: r.kind || defValid("kind") || undefined, channel: r.channel || defValid("channel") || undefined };   // 新记一笔：预填默认的付款方 / 类型 / 收款方式
  const accVal = r.id ? acctValueOf(r) : defAcctValid(), kind = r.kind || "other", gain = GAIN_KINDS.includes(kind) || r.income_amount != null;   // 新记一笔默认选上你设的默认账户；编辑按 account_id（老记录按文字）对上登记过的账户
  const persons = owner ? personOptions(person || "none") : `<option value="${mine || "none"}">${esc(personName(mine) || t("未指定 / 全家"))}</option>`;
  return `<form class="panel" data-inc-form="record" id="incForm" autocomplete="off"><h3 style="margin:0 0 8px">${r.id ? t("编辑收入") : t("记一笔收入")}</h3>
    <div class="form-grid">
      <label>${t("到账日期")}<input type="date" name="received_on" value="${d(r.received_on || todayISO())}" required></label>
      <label>${t("到账金额")}（${esc(cur())}）<input type="number" name="amount" step="0.01" min="0.01" inputmode="decimal" value="${d(r.amount)}" required></label>
      <label>${t("谁给的（付款方 / 雇主）")}<input name="source_name" list="incSenders" maxlength="80" value="${d(r.source_name)}" required placeholder="${esc(t("公司名 / 汇款人"))}"><datalist id="incSenders">${knownSenders().map((s) => `<option value="${esc(s)}">`).join("")}</datalist></label>
      <label>${t("类型")}<select name="kind" data-inc-kind>${kindOptionsHtml(kind)}</select><small class="muted" data-inc-kind-hint>${esc(kindHint(kind))}</small></label>
      <label data-inc-gain ${gain ? "" : "hidden"}>${t("其中已实现收益（算收入的部分，选填）")}<input type="number" name="income_amount" step="0.01" min="0" inputmode="decimal" value="${d(r.income_amount)}" aria-describedby="incGainHelp"><small class="muted" id="incGainHelp">${t("例：成本 $10,000 的股票卖了 $15,000，到账 15,000，这里填 5,000。")}</small></label>
      <label>${t("收款方式")}<select name="channel" data-nosearch><option value="">${t("未填")}</option>${selOpts(CHANNELS, r.channel)}</select></label>
      ${defsHtml(r)}
      <label>${t("这是谁的收入")}<select name="person_id" data-nosearch>${persons}</select></label>
      <label>${t("入到哪个账户")}<select name="acct_sel" data-inc-acct>${acctSelectHtml(accVal)}</select>
        <input name="account" maxlength="60" value="${accVal === "other" ? d(r.account) : ""}" placeholder="Chase ····1234" style="margin-top:6px" ${accVal === "other" ? "" : "hidden"}></label>
      <div class="ix-acct-def"><label class="check-inline"><input type="checkbox" name="acct_default" ${accVal && accVal === defAcct() ? "checked" : ""}><span>${t("设为我的默认入账账户")}</span></label>
        ${hasBankAcct() ? "" : `<small class="muted">${t("还没登记账户？到「卡与账户」里登记银行、券商、退休账户后，这里就能选。")} <a href="${CARDS_HREF()}">${t("去登记")}</a></small>`}</div>
      <label>${t("备注")}<input name="notes" maxlength="500" value="${d(r.notes)}"></label></div>
    <details style="margin-top:8px" ${r.orig_amount || r.fee != null ? "open" : ""}><summary>${t("国际电汇 / 外币（选填）")}</summary><div class="form-grid" style="margin-top:6px">
      <label>${t("汇出金额（原币种）")}<input type="number" name="orig_amount" step="0.01" min="0" value="${d(r.orig_amount)}"></label><label>${t("原币种")}<input name="orig_currency" maxlength="3" value="${d(r.orig_currency)}" placeholder="CNY"></label>
      <label>${t("手续费")}<input type="number" name="fee" step="0.01" min="0" value="${d(r.fee)}"></label></div><small class="muted">${t("到账金额填实际收到的（已扣手续费、已换成家庭货币）；这里只是留个底，方便对账。")}</small></details>
    <label class="check-inline" style="margin-top:8px"><input type="checkbox" name="repay_required" data-inc-repay ${r.repay_required ? "checked" : ""}><span>${t("需要还（个人赠与 / 借款）——当借款到账，不算收入")}</span></label>
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
  const gainBox = form.querySelector("[data-inc-gain]"), gainRaw = gainBox && !gainBox.hidden ? g("income_amount") : "";
  const income_amount = gainRaw === "" ? null : Math.round(num(gainRaw) * 100) / 100;
  if (income_amount != null && !(income_amount >= 0 && income_amount <= amount)) return fail(t("「其中已实现收益」要在 0 和到账金额之间"));
  const repay = fd.get("repay_required") === "on", pid = g("person_id");
  const accSel = g("acct_sel"), accCard = accSel && accSel !== "cash" && accSel !== "other" ? acctById(accSel) : null;
  const account = accSel === "cash" ? "现金" : accSel === "other" ? g("account") || null : accCard ? acctText(accCard) : null;
  const row = { id: f.rec?.id, received_on: g("received_on") || todayISO(), amount, currency: cur(), orig_amount: num(g("orig_amount")) > 0 ? num(g("orig_amount")) : null, orig_currency: g("orig_currency").toUpperCase().slice(0, 3) || null,
    fee: g("fee") === "" ? null : num(g("fee")), source_name: name, kind: g("kind") || "other", channel: g("channel") || null, person_id: pid && pid !== "none" ? pid : null, account, account_id: accCard?.id || null, income_amount,
    import_batch: f.rec?.import_batch || null, repay_required: repay, repay_due_on: repay ? g("repay_due_on") || null : null, repay_amount: repay && num(g("repay_amount")) > 0 ? num(g("repay_amount")) : null, notes: g("notes") || null };
  if (row.orig_currency && !/^[A-Z]{3}$/.test(row.orig_currency)) return fail(t("原币种填 3 位字母，如 CNY"));
  const dup = !row.id && similarIncome(row), key = `${row.received_on}|${row.amount}|${skey(name)}`;
  if (dup && f.dupAck !== key) { f.dupAck = key; return fail(t("看起来已经记过：{d} · {n} · {a}。确认不是重复的话，再点一次保存。", { d: dup.received_on, n: dup.source_name, a: fmtMoney(dup.amount) })); }
  try {
    const savedId = await Store.saveIncomeRecord(row);
    if (repay && state.debtsOk) await ensureBorrowDebt({ ...row, id: row.id || savedId }).catch((e) => console.warn("[debt]", e.message));   // 需要还 = 借入：建（或更新）对应的借款（迁移 058）
    await saveDefaults(fd).catch(() => toast(t("默认值没存上，下次再试")));
    const was = defAcct(), want = fd.get("acct_default") === "on";   // 勾「设为默认」：记住；取消勾选且现在选的正是默认：清掉
    const next = want && accSel && accSel !== "other" ? accSel : !want && accSel && accSel === was ? "" : was;
    if (next !== was) await saveDefaultAcct(next).catch(() => toast(t("默认账户没存上，下次再试")));
    if (I.drafts && f.rec?.id) delete I.drafts[f.rec.id];
    I.form = null; await loadIncome(); toast(t("已保存")); rerender(); }
  catch (e) { fail(/income_amount|account_id/i.test(e.message || "") ? t("数据库还没升级：请先执行 supabase/migrations/056_income_ledger.sql") : t("保存失败：{msg}", { msg: e.message })); }
}

/* ───────────── 付款方历史：搜索 + 类型筛选 + 点表头排序，每次显示 20 个，「加载更多」（多取一个判断还有没有，不算总数） ─────────────
 * 合计 = 认定收入；资本流入（卖股卖房的本金、借款、转入）单独显示，不算进合计和占比。 */
const S_PAGE = () => pageSize();   // 付款方每次显示几个：跟全站的每页条数设置
const S_COLS = [["name", "付款方"], ["kind", "类型"], ["n", "收到次数"], ["total", "收入"], ["share", "占比"], ["last", "最近一次"]];
const sNameOf = (x) => x.rows.find((r) => r.source_name)?.source_name || x.key;
const sMainKind = (x) => { const m = new Map(); for (const r of x.rows) m.set(r.kind, (m.get(r.kind) || 0) + r.amount); return [...m].sort((a, b) => b[1] - a[1])[0]?.[0] || "other"; };
/** 当前时间范围 / 成员 / 类型 / 搜索下的付款方（已排序）；rows = 参与统计的收入 */
function senderGroups({ noSearch = false } = {}) {
  const I = inc(), w = spanWindow(state.stats.months), q = noSearch ? "" : skey(I.sq), sk = I.skind || "all";
  const rows = I.rec.filter((r) => r.received_on >= w.from && r.received_on <= w.to && personOk(r, I.person) && kindMatch(sk, r.kind));
  const list = groupSum(rows, (r) => skey(r.source_name)).filter((x) => !q || skey(`${x.rows.map((r) => r.source_name).join(" ")} ${kindLabel(sMainKind(x))}`).includes(q));
  const { k = "total", dir = "desc" } = I.ssort || {}, sgn = dir === "asc" ? 1 : -1;
  const val = { name: (x) => skey(sNameOf(x)), kind: (x) => kindLabel(sMainKind(x)), n: (x) => x.n, total: (x) => x.total, share: (x) => x.total, last: (x) => x.last }[k] || ((x) => x.total);
  list.sort((a, b) => { const va = val(a), vb = val(b); return (typeof va === "number" ? va - vb : String(va).localeCompare(String(vb))) * sgn || b.total - a.total || b.cash - a.cash; });
  return { w, rows, list, total: incSumOf(rows), cap: R2(sumOf(rows) - incSumOf(rows)) };
}
function sendersListHtml() {
  const I = inc(), { list, total, cap } = senderGroups(), lim = I.slimit || S_PAGE();
  const page = list.slice(0, lim + 1), hasNext = page.length > lim, shown = page.slice(0, lim);   // 多取一个：有第 lim+1 个才显示「加载更多」
  const { k = "total", dir = "desc" } = I.ssort || {};
  const th = ([key, label]) => { const on = k === key; return `<th scope="col" class="s-${key}" ${on ? `aria-sort="${dir === "asc" ? "ascending" : "descending"}"` : ""}><button type="button" class="th-sort${on ? " is-on" : ""}" data-inc="s-sort" data-k="${key}" title="${esc(t("点一下按这一列排序"))}">${t(label)}<span aria-hidden="true">${on ? (dir === "asc" ? " ▲" : " ▼") : " ↕"}</span></button></th>`; };
  const cell = (key, inner) => `<td class="s-${key}" data-l="${esc(t(S_COLS.find((c) => c[0] === key)[1]))}">${inner}</td>`;
  const sel = I.ssel, pickedN = sel ? list.filter((x) => sel.has(x.key)).length : 0;
  const defTo = I.smergeTo || [...list].filter((x) => sel?.has(x.key)).sort((a, b) => b.n - a.n).map(sNameOf)[0] || "";
  const selBar = sel ? `<div class="sel-bar payee-sel" role="region" aria-label="${esc(t("多选合并"))}"><b>${t("已选 {n} 家", { n: pickedN })}</b>
      <label class="payee-merge-to"><span>${t("合并为")}</span><input id="incMergeTo" maxlength="80" list="incSendersAll" value="${esc(defTo)}" autocomplete="off"></label>
      <button type="button" class="btn btn-sm btn-primary" data-inc="sender-merge" ${pickedN >= 2 ? "" : "disabled"}>${t("合并")}</button>
      <button type="button" class="btn btn-sm btn-ghost" data-inc="sender-sel">${t("退出多选")}</button>
      <small class="muted" style="flex-basis:100%">${t("勾两家以上，合并成一个名字（默认用笔数最多的那个）。")}</small><datalist id="incSendersAll">${knownSenders().map((s) => `<option value="${esc(s)}">`).join("")}</datalist></div>` : "";
  return `${selBar}<p class="muted small" style="margin:0 0 8px">${t("{n} 个付款方，收入 {m}", { n: list.length, m: fmtMoney(total) })}${cap > 0 ? ` · ${t("另有资本流入 {a}（不计收入）", { a: fmtMoney(cap) })}` : ""}</p>
    <table class="store-table ix-stbl payee-tbl"><thead><tr>${S_COLS.map(th).join("")}<th scope="col" class="s-act"><span class="sr-only">${t("操作")}</span></th></tr></thead><tbody>
    ${shown.map((x) => `<tr><th scope="row" class="s-name"><span class="s-name-in">${sel && x.rows.every(canEdit) ? `<input type="checkbox" class="sel" data-inc="sender-pick" data-key="${esc(x.key)}" ${sel.has(x.key) ? "checked" : ""} aria-label="${esc(t("选中 {name}", { name: sNameOf(x) }))}">` : ""}<button type="button" class="link-name" data-inc="sender-open" data-key="${esc(x.key)}">${esc(sNameOf(x))}</button></span></th>${cell("kind", kindBadge(sMainKind(x)))}${cell("n", x.n)}${cell("total", `<b>${fmtMoney(x.total)}</b>${x.cap ? `<br><small class="muted">${t("资本流入 {a}", { a: fmtMoney(x.cap) })}</small>` : ""}`)}${cell("share", rate(x.total, total))}${cell("last", x.last)}
      <td class="s-act"><span class="s-act-in"><button type="button" class="btn btn-sm btn-ghost" data-inc="sender-trend" data-key="${esc(x.key)}" aria-expanded="${I.sopen === x.key}" aria-label="${esc(t("{name} 近 12 个月走势", { name: sNameOf(x) }))}">${I.sopen === x.key ? "▾" : "▸"} ${t("走势")}</button>${x.rows.every(canEdit) && !sel ? `<button type="button" class="btn btn-sm btn-ghost" data-inc="sender-rename" data-key="${esc(x.key)}">${t("改名 / 合并")}</button>` : ""}</span></td></tr>
      ${I.sopen === x.key ? `<tr class="s-form s-detail"><td colspan="7">${senderTrendHtml(x)}</td></tr>` : ""}
      ${I.renameKey === x.key ? `<tr class="s-form"><td colspan="7"><form data-inc-form="rename" data-key="${esc(x.key)}" class="form-grid"><label>${t("统一改成")}<input name="to" maxlength="80" required value="${esc(sNameOf(x))}" list="incSenders"></label><div class="form-actions"><button class="btn btn-sm btn-primary">${t("改名（相同名字的会合并成一个）")}</button><button type="button" class="btn btn-sm btn-ghost" data-inc="sender-rename" data-key="">${t("取消")}</button></div></form><datalist id="incSenders">${knownSenders().map((s) => `<option value="${esc(s)}">`).join("")}</datalist></td></tr>` : ""}`).join("") || `<tr class="s-form"><td colspan="7" class="muted">${t("没有符合条件的付款方")}</td></tr>`}</tbody></table>
    ${moreBtn(hasNext, 'data-inc="s-more"')}`;
}
/** 展开一个付款方：近 12 个月每月的认定收入（和上面的时间范围无关），点柱子看那个月的收入明细 */
function senderTrendHtml(x) {
  const I = inc(), now = new Date(), ms = Array.from({ length: 12 }, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; });
  const by = Object.fromEntries(ms.map((m) => [m, 0]));
  for (const r of I.rec) if (skey(r.source_name) === x.key && personOk(r, I.person) && by[r.received_on.slice(0, 7)] != null) by[r.received_on.slice(0, 7)] += recognized(r);
  const vals = ms.map((m) => Math.round(by[m] * 100) / 100), tot = vals.reduce((a, v) => a + v, 0), used = vals.filter((v) => v > 0).length, name = sNameOf(x);
  const end = (m) => { const d = new Date(+m.slice(0, 4), +m.slice(5, 7), 0); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const chart = window.Charts ? window.Charts.bars({ title: t("{name} 近 12 个月", { name }), labels: ms.map(monthLabel), fmt: fmtMoney, showTotals: false,
    series: [{ name, color: groupOf(sMainKind(x))?.color || "#2c6a57", values: vals }], drill: (_, i) => incDrill({ q: name, from: `${ms[i]}-01`, to: end(ms[i]), person: I.person }) }) : "";
  return `<div class="payee-detail"><div class="pd-head"><b>${esc(t("近 12 个月"))}</b><span class="muted small">${esc(t("合计 {m} · {n} 个月有收入 · 月均 {a}", { m: fmtMoney(tot), n: used, a: fmtMoney(used ? tot / used : 0) }))}</span></div>${chart}</div>`;
}
/** 付款方页顶部：指标卡 + 前 10 名横条 + 按一级类型的环形图（不随搜索变；随时间范围、成员、类型筛选变）。点条 / 扇区 = 到收入明细看那几笔 */
function sendersDashHtml() {
  const I = inc(), { w, list, total, cap } = senderGroups({ noSearch: true });
  if (!list.length) return "";
  const person = I.person, top3 = list.slice(0, 3).reduce((a, x) => a + x.total, 0), big = list[0];
  const card = (label, value, small = "", drill = "") => `<div class="kpi${drill ? " ch-hit-row" : ""}"${drill ? hitAttrs(drill, label) : ""}><span>${esc(label)}</span><b>${value}</b><small>${small}${drill ? " ›" : ""}</small></div>`;
  const kpis = `<div class="kpis">
    ${card(t("付款方"), esc(t("{n} 家", { n: list.length })))}
    ${card(t("收入合计"), esc(fmtMoney(total)), esc(t("认定收入")), incDrill({ ...w, person }))}
    ${cap > 0 ? card(t("资本流入"), esc(fmtMoney(cap)), esc(t("卖房卖股的本金、借款、转回，不计收入"))) : ""}
    ${card(t("前 3 家占比"), total > 0 ? `${Math.round((top3 / total) * 100)}%` : "–", esc(t("越高越依赖少数几个来源")))}
    ${card(t("最大付款方"), esc(sNameOf(big)), esc(fmtMoney(big.total)), incDrill({ q: sNameOf(big), ...w, person }))}
  </div>`;
  if (!window.Charts) return kpis;
  const R2_ = (v) => Math.round(v * 100) / 100;
  const top = list.slice(0, 10), rest = list.slice(10);
  const items = top.map((x) => { const g = groupOf(sMainKind(x)); return { name: sNameOf(x), value: x.total, color: g?.color || "#8a948f", drill: incDrill({ q: sNameOf(x), ...w, person }) }; });
  if (rest.length) items.push({ name: `${t("其他")}（${t("{n} 家", { n: rest.length })}）`, value: R2_(rest.reduce((a, x) => a + x.total, 0)), color: "#c3cbc6" });
  const by = new Map();
  for (const x of list) for (const r of x.rows) { const g = groupOf(r.kind); if (!g) continue; const v = splitRecord(r).income || 0; if (v > 0) by.set(g.gid, (by.get(g.gid) || 0) + v); }
  let slices = [...by].sort((a, b) => b[1] - a[1]).map(([gid, v]) => { const g = groupList().find((x) => x.gid === gid); return { name: `${g.icon} ${t(g.name)}`, value: R2_(v), color: g.color, drill: incDrill({ kind: g.id, ...w, person }) }; });
  if (slices.length > 6) slices = [...slices.slice(0, 5), { name: t("其他"), value: R2_(slices.slice(5).reduce((a, x) => a + x.value, 0)), color: "#c3cbc6" }];
  return `${kpis}<div class="chart-grid">
    <div class="panel chart-panel"><h3>${t("收入最多的 10 家")}</h3>${window.Charts.hbars({ title: t("收入最多的 10 家"), fmt: fmtMoney, total, items })}</div>
    <div class="panel chart-panel"><h3>${t("按收入类型")}</h3>${slices.length ? window.Charts.donut({ items: slices, fmt: fmtMoney, title: t("按收入类型"), center: fmtMoney(total), stack: true }) : `<p class="muted">${t("这段时间没有认定收入")}</p>`}</div>
  </div><p class="muted drill-hint">${t("点条、色块或名称，可以查看对应的收入明细。")}</p>`;
}
/** 排序下拉（手机上表头不显示，靠它排序；宽屏点表头和它是同一个设置） */
const S_SORTS = [["total:desc", "金额从高到低"], ["total:asc", "金额从低到高"], ["last:desc", "最近到账的在前"], ["last:asc", "最早到账的在前"], ["n:desc", "收到次数最多"], ["name:asc", "名称 A → Z"], ["name:desc", "名称 Z → A"], ["kind:asc", "按类型"]];
function sSortOptions() {
  const { k = "total", dir = "desc" } = inc().ssort || {}, cur = `${k === "share" ? "total" : k}:${dir}`, list = [...S_SORTS];
  if (!list.some(([v]) => v === cur)) list.push([cur, `${t((S_COLS.find((c) => c[0] === k) || [])[1] || k)} ${dir === "asc" ? "↑" : "↓"}`]);   // 点表头排出来的少见组合
  return list.map(([v, l]) => `<option value="${esc(v)}" ${v === cur ? "selected" : ""}>${esc(t(l))}</option>`).join("");
}
const renderSenders = () => { const el = $("#incSendersList"); if (el) el.innerHTML = sendersListHtml(); const ss = $("#incSsort"); if (ss) ss.innerHTML = sSortOptions(); };
function sendersTab() {
  const I = inc();
  if (!I.rec.length) return empty();
  return `<div class="time-bar">${sharedRangeHtml()}
    <label class="tb-field"><span>${t("谁的")}</span><select data-inc-f="person" data-nosearch>${personOptions(I.person, { all: true })}</select></label></div>
    ${sendersDashHtml()}
    <div class="panel"><div class="toolbar ix-stoolbar">
      <input type="search" data-inc-sq value="${esc(I.sq || "")}" placeholder="${esc(t("搜索付款方 / 类型"))}" aria-label="${esc(t("搜索付款方"))}">
      <select id="incSkindF" data-inc-f="skind" aria-label="${esc(t("按类型筛选"))}">${kindOptionsHtml(I.skind || "all", { all: true, groups: true, allLabel: t("全部类型") })}</select>
      <select id="incSsort" data-inc-ssort data-nosearch aria-label="${esc(t("排序"))}">${sSortOptions()}</select>${clearFiltersBtn("incSend", changed(I, FD.incSend))}</div>
    <div class="ix-tools payee-tools"><button type="button" class="btn btn-sm btn-ghost" data-inc="sender-sel">${I.ssel ? t("退出多选") : t("多选合并")}</button><button type="button" class="btn btn-sm btn-ghost" data-inc="csv-senders">${t("导出 CSV")}</button></div>
    <div id="incSendersList">${sendersListHtml()}</div></div>`;
}
/** 改名 / 合并后记下别名（meta._sender_alias：原名键 → 新名），以后银行导入的入账自动用新名字（logic.js 的 senderName） */
async function rememberSenders(keys, to) {
  const a = { ...(meta("_sender_alias", {}) || {}) }; let changed = false;
  for (const k of keys) if (k && k !== skey(to) && a[k] !== to) { a[k] = to; changed = true; }
  if (changed) await saveMeta({ _sender_alias: a });
}

const R = () => { const r = (inc().r ||= { unit: "month", range: "12", from: "", to: "", person: "all", what: "both", unmask: false }); r.range = state.stats.months; return r; };   // 时间范围是共享的（js/core/time-range.js）
/** 周期 / 时间范围 / 谁的（收支对比页和导出页共用，同一份设置） */
const controlsHtml = (r, cf = null) => {
  const sel = (id, list, v) => `<label class="tb-field"><span>${t(id)}</span><select data-inc-r="${id === "周期" ? "unit" : "range"}" data-nosearch>${selOpts(list, v)}</select></label>`;
  return `<div class="time-bar">${sel("周期", UNITS, r.unit)}${sharedRangeHtml()}
    <label class="tb-field"><span>${t("谁的")}</span><select data-inc-r="person" data-nosearch>${personOptions(r.person, { all: true })}</select></label>
    ${cf ? togglesHtml(cf) : ""}</div>
    ${r.unit === "biweek" ? `<p class="muted small" style="margin:-4px 0 8px">${t("双周起点（每 14 天一个周期，对上你的发薪日）：")}<input type="date" data-inc-anchor value="${esc(cfAnchor())}" aria-label="${esc(t("双周起点"))}"></p>` : ""}`;
};
const spendDonut = (cf) => {
  const items = STAT_CATS().filter((c) => cf.spendCats[c.id]).map((c) => ({ name: `${c.icon} ${t(c.name)}`, color: c.color, value: R2(Object.values(cf.spendCats[c.id]).reduce((a, b) => a + b, 0)) })).filter((x) => x.value > 0);
  return items.length && window.Charts ? `<div class="panel chart-panel"><h3>${t("消费去向（按分类）")}</h3>${window.Charts.donut({ items, fmt: fmtMoney, stack: true, title: t("消费去向"), center: fmtMoney(items.reduce((a, x) => a + x.value, 0), true) })}</div>` : "";
};
/* ───────────── 收支对比：收入 vs 消费 vs 净现金流 / 储蓄率（组合图），双周 / 月 / 季 / 年 ───────────── */
function reportTab() {
  const I = inc(), r = R();
  if (!I.rec.length) return empty();
  const cf = cashflow(r), person = r.person;
  const note = person !== "all" ? `<p class="muted small" role="status">${t("花费不分人：选「全家」才会显示消费、净现金流和储蓄率。")}</p>` : cf.loading ? `<p class="muted small" role="status">${t("正在读取花费…")}</p>` : "";
  return `${controlsHtml(r, cf)}${note}${kpiRow(cf)}${flowCharts(cf, t("每{u}收入 vs 消费", { u: t((UNITS.find((u) => u[0] === r.unit) || [])[1]) }))}${lineTable(cf)}
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
        <label class="export-pick"><span>${t("内容")}</span><select data-inc-r="what" data-nosearch>${selOpts([["both", "收入 + 消费 + 净现金流（合并）"], ["income", "只要收入（按类型）"], ["spend", "只要消费（按分类）"]], r.what)}</select></label>
        <div class="export-btns"><button type="button" class="btn btn-primary btn-sm" data-inc="csv-report">${t("导出这段时间 CSV")}</button><button type="button" class="btn btn-sm" data-inc="csv-detail-window">${t("导出收入明细")}</button></div>
        <p class="muted small" style="margin:0">${cf.w.from} → ${cf.w.to} · ${t("{n} 笔到账", { n: cf.rows.length })} · ${t("收入 {a}", { a: fmtMoney(cf.tot.income) })}${cf.tot.capIn ? ` · ${t("资本流入 {a}", { a: fmtMoney(cf.tot.capIn) })}` : ""}</p>
      </div></section>
    <section class="section"><div class="section-head"><h2>${t("打印")}</h2><p>${t("浏览器的打印窗口里也可以另存为 PDF")}</p></div>
      <div class="panel export-grid"><div class="export-btns"><button type="button" class="btn btn-primary btn-sm" data-inc="print-report">${t("打印这段时间的收入报表")}</button></div></div>
      <p class="muted" style="margin:6px 0 0;font-size:13px">${t("要打印筛选后的明细，到“明细”标签里点“打印”。")}</p></section>`;
}
/** 给 财务 → 对账单 → 导出打印 用：收入 / 收支报表的导出块（数据没读过先读） */
export function incomeExportHtml() {
  const I = inc();
  if (!I.loaded && !I.loading) { I.loading = true; loadIncome().finally(() => { I.loading = false; rerender(); }); }
  return I.loaded ? exportTab() : `<div class="panel empty"><strong>${t("加载中…")}</strong></div>`;
}
/** 收支对比的花费一侧还在读时，等它读完（导出 / 打印用） */
async function cashflowReady(r) {
  const w = spanWindow(r.range);
  if (r.person === "all") await rollAsync("ledger", w.from, addDay(w.to, 1), r.unit === "biweek" ? "biweek" : "month");
  return cashflow(r);
}
/** 打印：report = 当前时间范围的收入报表；list = 「明细」里筛选后的列表 */
async function printIncome(mode) {
  const hh = state.household?.name || t("家庭"), kpiH = (label, val) => `<div><span>${esc(label)}</span><b>${val}</b></div>`;
  let html;
  if (mode === "list") {
    let recs; try { recs = await incList.fetchAll(300); } catch (e) { return toast(t("读取列表失败：{msg}", { msg: e.message })); }   // 明细是服务器分页：按筛选读前 300 笔
    const st = incList.stats || {}, n = st.n ?? recs.length;
    html = `<h1>${esc(hh)} · ${t("收入明细")}</h1><p class="ps-meta">${esc(printStamp())}</p>
      <div class="ps-kpis">${kpiH(t("笔数"), n)}${kpiH(t("到账合计"), fmtMoney(st.sum != null ? num(st.sum) : sumOf(recs)))}${kpiH(t("认定收入"), fmtMoney(st.income_sum != null ? num(st.income_sum) : incSumOf(recs)))}</div>
      <table><thead><tr><th>${t("到账日期")}</th><th>${t("付款方")}</th><th>${t("类型")}</th><th>${t("成员")}</th><th>${t("金额")}</th><th>${t("认定收入")}</th></tr></thead><tbody>${recs.map((r) => `<tr><td>${esc(fmtDate(r.received_on))}</td><td>${esc(r.source_name)}</td><td>${esc(kindLabel(r.kind))}</td><td>${esc(personName(r.person_id))}</td><td>${fmtMoney(r.amount)}</td><td>${fmtMoney(recognized(r))}</td></tr>`).join("")}</tbody></table>${n > recs.length ? `<p class="ps-meta">${t("只打印前 300 笔")}</p>` : ""}`;
  } else {
    const r = R(), cf = await cashflowReady(r), top = groupSum(cf.rows, (x) => skey(x.source_name)).filter((x) => x.total > 0).slice(0, 15);
    const kinds = statKinds(inc().merge).filter((k) => cf.byKind[k.id]).sort((a, b) => cf.byKind[b.id] - cf.byKind[a.id]);
    html = `<h1>${esc(hh)} · ${t("收入报表")}</h1><p class="ps-meta">${cf.w.from} → ${cf.w.to} · ${esc(printStamp())}</p>
      <div class="ps-kpis">${kpiH(t("收入（认定）"), fmtMoney(cf.tot.income))}${cf.hasSpend ? kpiH(t("消费（含住房）"), fmtMoney(cf.tot.spend)) + kpiH(t("净现金流（账面）"), fmtMoney(cf.tot.net)) + kpiH(t("储蓄率"), rate(cf.tot.saved, cf.tot.income)) : ""}${cf.tot.capIn ? kpiH(t("资本流入（不计收入）"), fmtMoney(cf.tot.capIn)) : ""}${kpiH(t("笔数"), cf.rows.length)}</div>
      <h2>${t("按{u}", { u: t((UNITS.find((u) => u[0] === r.unit) || [])[1]) })}</h2><table><thead><tr><th>${t("周期")}</th><th>${t("收入")}</th>${cf.hasSpend ? `<th>${t("消费")}</th><th>${t("净现金流（账面）")}</th>` : ""}</tr></thead><tbody>${cf.lines.map((l) => `<tr><td>${esc(l.label)}</td><td>${fmtMoney(l.income)}</td>${cf.hasSpend ? `<td>${fmtMoney(l.spend)}</td><td>${fmtMoney(l.net)}</td>` : ""}</tr>`).join("")}</tbody></table>
      <h2>${t("按类型")}</h2><table><thead><tr><th>${t("类型")}</th><th>${t("占比")}</th><th>${t("合计")}</th></tr></thead><tbody>${kinds.map((k) => `<tr><td>${k.icon} ${esc(kindLabel(k.id))}</td><td>${rate(cf.byKind[k.id], cf.tot.income)}</td><td>${fmtMoney(cf.byKind[k.id])}</td></tr>`).join("")}</tbody></table>
      <h2>${t("主要付款方")}</h2><table><thead><tr><th>${t("付款方")}</th><th>${t("次数")}</th><th>${t("合计")}</th></tr></thead><tbody>${top.map((x) => `<tr><td>${esc(senderLabel(x))}</td><td>${x.n}</td><td>${fmtMoney(x.total)}</td></tr>`).join("")}</tbody></table>`;
  }
  printHtml(html);
}
const cfAnchor = () => (state.budget?.cat_budgets?._income_cfg?.anchor) || "2024-01-01";
const kpiRow = (cf) => `${noSpendNote(cf.noSpend)}<div class="kpis">${kpi(t("收入（认定）"), fmtMoney(cf.tot.income), `${cf.w.from} → ${cf.w.to}`)}${cf.hasSpend ? kpi(t("消费（含住房）"), fmtMoney(cf.tot.spend)) : ""}${cf.hasSpend ? kpi(t("其他流出"), fmtMoney(cf.tot.other), t("税、保险、利息、奉献、资本性支出")) : ""}${cf.hasSpend ? kpi(t("净现金流（账面）"), `<span class="${cf.tot.net < 0 ? "down" : ""}">${fmtMoney(cf.tot.net)}</span>`, t("全部流入 − 全部流出 · 收入结余 {a} · 储蓄率 {r}", { a: fmtMoney(cf.tot.incNet, true), r: rate(cf.tot.saved, cf.tot.income) })) : ""}${cf.hasSpend ? kpi(t("投资率"), rate(cf.tot.invest, cf.tot.income), t("投资 {a}", { a: fmtMoney(cf.tot.invest, true) })) : ""}${cf.tot.capIn ? kpi(t("资本流入"), fmtMoney(cf.tot.capIn), t("不计收入，算进账面净现金流")) : ""}</div>`;

/** 有收入、却一笔花费都没有的周期：提醒净现金流会偏高（近 3 年 / 5 年常见：早年的对账单没导入） */
const noSpendNote = (list) => (list?.length ? `<div class="notice" role="status" style="margin-bottom:8px"><b>${t("有 {n} 个周期只有收入、没有任何花费记录，那几段的净现金流会偏高：", { n: list.length })}</b> ${esc(list.slice(0, 8).join("、"))}${list.length > 8 ? "…" : ""}<br><small>${t("多半是那段时间的对账单还没导入。去 财务 → 对账单 补上，或把时间范围缩到已经补齐的那段。")}</small></div>` : "");

/* ── 导出 ── */
async function exportReport() {
  const r = R(), cf = await cashflowReady(r), hh = (state.household?.name || t("家庭")).replace(/[\\/:*?"<>|\s]/g, ""), base = `${hh}-${t("现金流")}-${cf.w.from}_${cf.w.to}`, unitName = t((UNITS.find((u) => u[0] === r.unit) || [])[1]);
  const head = [[t("{hh} 现金流（{u}）", { hh: state.household?.name || t("家庭"), u: unitName })], [t("时间"), `${cf.w.from} → ${cf.w.to}`, t("货币：{cur}", { cur: cur() }), t("谁的：{p}", { p: r.person === "all" ? t("全家") : r.person === "none" ? t("未指定") : personName(r.person) })], []];
  let rows;
  if (r.what === "income") {   // 认定收入按类型；资本流入单列一列
    const m = inc().merge, kinds = statKinds(m).filter((k) => cf.byKind[k.id]);
    const grid = Object.fromEntries(cf.keys.map((k) => [k, {}])); for (const x of cf.rows) { const s = splitRecord(x); if (!s.income) continue; const g = grid[bucketKey(x.received_on, r.unit)], sk = m ? `g:${s.l1}` : x.kind; g[sk] = (g[sk] || 0) + s.income; }
    rows = [[t("周期"), ...kinds.map((k) => kindLabel(k.id)), t("收入合计"), t("资本流入（不计收入）")], ...cf.lines.map((l) => [l.label, ...kinds.map((c) => R2(grid[l.key][c.id] || 0)), l.income, l.capIn]), [t("合计"), ...kinds.map((c) => R2(cf.byKind[c.id] || 0)), cf.tot.income, cf.tot.capIn]];
  } else if (r.what === "spend") {
    if (!cf.hasSpend) return toast(t("花费还没读出来，或选了某个成员（花费不分人）"));
    const cats = STAT_CATS().filter((c) => cf.spendCats[c.id]);
    rows = [[t("周期"), ...cats.map((c) => t(c.name)), t("消费合计")], ...cf.lines.map((l) => [l.label, ...cats.map((c) => R2(cf.spendCats[c.id][l.key])), l.spend]), [t("合计"), ...cats.map((c) => R2(Object.values(cf.spendCats[c.id]).reduce((a, b) => a + b, 0))), cf.tot.spend]];
  } else {
    rows = [[t("周期"), t("收入"), ...(cf.hasSpend ? [t("消费（含住房）"), t("投资"), t("财务及其他 / 资本性")] : []), ...(cf.hasRepaid ? [t("其中：还款")] : []), ...(cf.hasSpend ? [t("收入结余"), t("净现金流（账面）"), t("储蓄率")] : []), t("资本流入（不计收入）")],
      ...cf.lines.map((l) => [l.label, l.income, ...(cf.hasSpend ? [l.spend, l.invest, l.other] : []), ...(cf.hasRepaid ? [l.repaid] : []), ...(cf.hasSpend ? [l.incNet, l.net, rate(l.saved, l.income)] : []), l.capIn]),
      [t("合计"), cf.tot.income, ...(cf.hasSpend ? [cf.tot.spend, cf.tot.invest, cf.tot.other] : []), ...(cf.hasRepaid ? [cf.tot.repaid] : []), ...(cf.hasSpend ? [cf.tot.incNet, cf.tot.net, rate(cf.tot.saved, cf.tot.income)] : []), cf.tot.capIn]];
  }
  download(`${base}-${r.what}.csv`, toCsv([...head, ...rows])); toast(t("已导出"));
}
function detailRows(list) {
  const rs = (r) => { const s = repayState(r); return s ? (s.status === "paid" ? t("已还清") : t("待还 {a}", { a: s.left })) : ""; };
  return [[t("到账日期"), t("付款方"), t("一级分类"), t("类型"), t("金额"), t("认定收入"), t("资本流入"), t("货币"), t("收款方式"), t("成员"), t("账户"), t("原币种金额"), t("原币种"), t("手续费"), t("还款状态"), t("备注")],
    ...list.map((r) => { const s = splitRecord(r); return [r.received_on, r.source_name, t(groupOf(r.kind).name), kindLabel(r.kind), r.amount, s.income, s.cap, r.currency || "", (CHANNELS.find((c) => c[0] === r.channel) || [])[1] ? t(CHANNELS.find((c) => c[0] === r.channel)[1]) : "", personName(r.person_id), acctShow(r), r.orig_amount ?? "", r.orig_currency || "", r.fee ?? "", rs(r), r.notes || ""]; })];
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
    definitions: "income = recognized income (excludes capital inflows such as sale principal, loan proceeds, own-account transfers); consumption = living + housing operating costs; other_outflows = taxes, insurance, loan interest / principal, donations, capital purchases; income_net = income - consumption - other_outflows - investing; net = book net cash flow = all inflows - all outflows = income_net + capital inflows (excluding transfers from the household's own savings accounts); savings_rate = (income - consumption - other_outflows) / income (investing counts as saved); periods_with_income_but_no_spending likely have statements not yet imported, so their net is overstated",
    periods_with_income_but_no_spending: cf.noSpend,
    periods: cf.lines.map((l) => ({ period: l.label, income: l.income, consumption: l.spend, investing: l.invest, other_outflows: l.other, of_which_repayments_to_people_already_in_spending: l.repaid, income_net: l.incNet, net: l.net, capital_inflows_not_income: l.capIn })), totals: cf.tot,
    income_by_type: Object.entries(cf.byKind).map(([k, v]) => ({ type: kindLabel(k), total: R2(v) })),
    income_by_member: groupSum(cf.rows, (x) => x.person_id || "").map((x) => ({ member: pname(x.key), total: x.total })),
    top_senders: senders.map((x, i) => ({ sender: mask ? `${t("付款方")} ${i + 1}` : x.rows[0].source_name, type: kindLabel(sMainKind(x)), count: x.n, income: x.total, capital_inflow: x.cap })),
    open_paybacks_total: R2(openRepayments().reduce((a, x) => a + x.s.left, 0)) };
  const sys = `You are a careful household cash-flow analyst. You are NOT a licensed financial advisor. Reply in ${lang === "en" ? "English" : lang === "zh-Hant" ? "Traditional Chinese" : "Simplified Chinese"}, concise, plain text with short sections: 1) Overview 2) Trends 3) Unusual periods or concentration risk (e.g. one sender dominating) 4) Savings rate, investing rate and stability 5) Three practical suggestions. Use only the numbers given; if consumption is null it was not available. Do not count capital inflows as income. Do not invent data.`;
  try { I.ai[key] = String(await askText(sys, JSON.stringify(data), { maxTokens: 1400, temperature: 0.3 })).trim(); }
  catch (e) { toast(e.message || String(e)); }
  I.aiBusy = false; rerender();
}

/* ───────────── 预算与计划：预期收入（member_incomes，用来生成预算）+ 对比实际认定收入 ─────────────
 * 收入只在这里设置：原来在 设置 → 收入与预算 的预期收入、储蓄比例、生成预算、医疗计入、家庭分摊都挪到了这一页，设置里不再有第二份。 */
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/** 最近 n 个整月（不含本月）的窗口 */
const lastMonthsWin = (n) => { const d = new Date(); return { from: iso(new Date(d.getFullYear(), d.getMonth() - n, 1)), to: iso(new Date(d.getFullYear(), d.getMonth(), 0)) }; };
function compareHtml() {
  const I = inc(), n = [3, 6, 12].includes(+I.planWin) ? +I.planWin : 6, w = lastMonthsWin(n);
  // 实际月均：认定收入（借款 / 需要还的赠与、资本流入不算；卖出只算已实现收益）
  const rows = I.rec.filter((r) => r.received_on >= w.from && r.received_on <= w.to);
  const actualOf = (pid) => R2(incSumOf(rows.filter((r) => (pid === "" ? !r.person_id : r.person_id === pid))) / n);
  const lines = state.members.map((m) => { const p = state.people.find((x) => x.member_user_id === m.user_id), plan = state.incomes.find((i) => i.user_id === m.user_id); return { name: m.display_name || t("家人"), plan: plan ? R2(monthlyOf(plan)) : null, act: p ? actualOf(p.id) : null }; })
    .filter((l) => l.plan != null || l.act != null);
  const un = actualOf(""), planned = R2(totalIncomeMonthly()), actual = R2(incSumOf(rows) / n);
  const diff = (p, a) => (p > 0 ? `<span class="${a < p ? "down" : ""}">${a >= p ? "+" : ""}${Math.round(((a - p) / p) * 100)}%</span>` : "—");
  const sel = `<label class="tb-field"><span>${t("对比最近")}</span><select data-inc-f="planWin" data-nosearch>${[3, 6, 12].map((v) => `<option value="${v}" ${v === n ? "selected" : ""}>${t("{n} 个月", { n: v })}</option>`).join("")}</select></label>`;
  return `<div class="panel"><div class="time-bar" style="margin:0 0 8px"><h3 style="margin:0;flex:1">${t("计划 vs 实际收入")}</h3>${sel}</div>
    ${I.ok ? `<div class="kpis">${kpi(t("计划月收入"), fmtMoney(planned), t("下面填的预期收入"))}${kpi(t("实际月均收入"), fmtMoney(actual), t("最近 {n} 个整月", { n }))}${kpi(t("实际 vs 计划"), diff(planned, actual), planned > 0 ? "" : t("还没填计划收入"))}</div>
    ${lines.length > 1 || un ? `<div class="ch-scroll"><table class="store-table ix-tbl"><thead><tr><th scope="col">${t("成员")}</th><th scope="col">${t("计划 / 月")}</th><th scope="col">${t("实际月均")}</th><th scope="col">${t("差")}</th></tr></thead><tbody>
      ${lines.map((l) => `<tr><th scope="row">${esc(l.name)}</th><td>${l.plan == null ? "—" : fmtMoney(l.plan)}</td><td>${l.act == null ? "—" : fmtMoney(l.act)}</td><td>${l.plan && l.act != null ? diff(l.plan, l.act) : "—"}</td></tr>`).join("")}
      ${un ? `<tr><th scope="row">${t("未指定 / 全家")}</th><td>—</td><td>${fmtMoney(un)}</td><td>—</td></tr>` : ""}</tbody></table></div>` : ""}
    <p class="muted small" style="margin:8px 0 0">${t("计划收入填的是税后固定收入，用来生成预算；实际是认定收入（含奖金、利息、租金等，不含借款 / 需要还的赠与、卖房卖股的本金、自己账户转入），所以两者不会完全一样。想让预算更贴近实际，参考这里的实际月均去改计划。")}</p>` : `<p class="muted small">${t("收入记录还没读到（迁移 042 没执行？），先填下面的计划收入也可以。")}</p>`}</div>`;
}
function planTab() { return `${compareHtml()}${incomePanel()}`; }

/* ───────────── 事件 ───────────── */
function armed(el, msg) { if (el.dataset.armed) return true; el.dataset.armed = "1"; const old = el.textContent; el.textContent = msg; setTimeout(() => { delete el.dataset.armed; el.textContent = old; }, 4000); return false; }
const guard = async (fn) => { try { await fn(); } catch (e) { toast(t("操作失败：{msg}", { msg: e.message })); } };
const reload = async () => { await loadIncome(); redraw(); };
const goTab = (id) => { location.hash = incomeHref(id); };
/** 去「明细」前清掉所有筛选（含图表钻取带来的日期段 / 不含资本流入） */
const NO_FILTER = () => ({ q: "", kind: "all", acct: "all", year: "all", month: "all", person: "all", batch: null, from: "", to: "", ex: false, limit: pageSize() });

export function initIncome({ render, refresh }) {
  hooks = { render, refresh }; initIncomeScan({ render }); initAaFix({ redraw: () => hooks.render(true) });
  // 清除筛选：收入记录（搜索、下拉、下钻日期段、导入批次，网址参数一起去掉）/ 付款方汇总
  onClearFilters("incRec", () => { Object.assign(inc(), FD.incRec, { limit: pageSize() }); clearUrlParams("*"); redraw(); }, () => changed(inc(), FD.incRec));
  onClearFilters("incSend", () => { Object.assign(inc(), FD.incSend, { slimit: null }); redraw(); }, () => changed(inc(), FD.incSend));
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
    if (act === "more") return incList.more();   // 「继续加载」：向数据库要下一页
    if (act === "node") { OV().node = b.dataset.node || ""; return redraw(); }   // 类型页：逐层点进去 / 面包屑回上层
    if (act === "edit") {   // 点行 / 点「编辑」：打开编辑表单（不在「明细」标签就先切过去）；这一行已经展开着，再点一下行就收起（不保存）
      if (b.classList.contains("ix-main") && I.form?.rec?.id === id && inlineEditId() === id) {   // 收起但留着草稿：再展开时填回去，行上有「草稿」小标
        const f = $("#incForm"); if (f) (I.drafts = I.drafts || {})[id] = formDraft(f);
        I.form = null; return redraw();
      }
      I.form = { rec: I.rec.find((r) => r.id === id) || incList.rows.find((r) => r.id === id) }; I.scanOpen = false;
      if (activeTab(state.route) !== "records") { Object.assign(I, NO_FILTER()); I._keep = true; goTab("records"); return; }
      redraw(); const dr = I.drafts?.[id]; if (dr) applyDraft($("#incForm"), dr);   // 之前收起时留的草稿
      setTimeout(() => { const f = $("#incForm"); f?.scrollIntoView({ block: "center", behavior: "smooth" }); f?.elements.amount?.focus({ preventScroll: true }); }, 0); return;
    }
    if (act === "del-swipe") { if (!confirmDelete(t("删除这笔收入？"))) return; return guard(async () => { await Store.deleteIncomeRecord(id); I.open = null; await reload(); }); }   // 左滑删除：用确认框（滑动代码按它判断用户有没有取消）
    if (act === "del") { if (!confirmDelete(t("删除这笔收入？"))) return; return guard(async () => { await Store.deleteIncomeRecord(id); I.open = null; await reload(); }); }
    if (act === "rep-del") { if (!confirmDelete(t("删除这条还款记录？"))) return; return guard(async () => { const p = I.rep.find((x) => x.id === id); await Store.deleteIncomeRepayment(id); if (p?.purchase_id) { await Store.deletePurchase(p.purchase_id).catch(() => {}); hooks.refresh(); } await reload(); }); }
    if (act === "sender-open") { Object.assign(I, NO_FILTER(), { q: b.dataset.key }); goTab("records"); return; }
    if (act === "drill-clear") { if (b.dataset.k === "range") { I.from = ""; I.to = ""; } else if (b.dataset.k === "ex") I.ex = false; I.limit = pageSize(); return redraw(); }
    if (act === "sender-rename") { I.renameKey = b.dataset.key || null; return redraw(); }
    if (act === "sender-trend") { I.sopen = I.sopen === b.dataset.key ? null : b.dataset.key; return renderSenders(); }
    if (act === "sender-sel") { I.ssel = I.ssel ? null : new Set(); I.smergeTo = ""; I.renameKey = null; return redraw(); }
    if (act === "sender-pick") { const k = b.dataset.key; I.ssel.has(k) ? I.ssel.delete(k) : I.ssel.add(k); return renderSenders(); }
    if (act === "sender-merge") return guard(async () => {
      const to = ($("#incMergeTo")?.value || "").trim(), keys = [...(I.ssel || [])]; if (!to || keys.length < 2) return;
      const ids = I.rec.filter((r) => keys.includes(skey(r.source_name)) && canEdit(r)).map((r) => r.id);
      await Store.renameIncomeSource(ids, to); await rememberSenders(keys, to);
      I.ssel = null; I.smergeTo = ""; toast(t("已合并：{n} 笔记成「{to}」", { n: ids.length, to })); await reload();
    });
    if (act === "csv-detail") return guard(async () => { const l = await incList.fetchAll(); if (!l.length) return toast(t("没有可导出的记录")); download(`${fileHead()}-${t("明细")}.csv`, toCsv(detailRows(l))); });   // 按当前筛选从数据库读全部，不只是已显示的
    if (act === "csv-detail-window") { const w = spanWindow(R().range), l = incomeIn(w.from, w.to, R().person); if (!l.length) return toast(t("这段时间没有收入")); download(`${fileHead()}-${w.from}_${w.to}-${t("明细")}.csv`, toCsv(detailRows(l))); return; }
    if (act === "csv-senders") {   // 导出：和表格同样的筛选和排序，不分页
      const { w, list, total: tot } = senderGroups();
      return download(`${fileHead()}-${t("付款方汇总")}-${w.from}_${w.to}.csv`, toCsv([[t("付款方"), t("主要类型"), t("次数"), t("收入"), t("资本流入"), t("占比"), t("第一次"), t("最近一次")], ...list.map((x) => [sNameOf(x), kindLabel(sMainKind(x)), x.n, x.total, x.cap, rate(x.total, tot), x.first, x.last])]));
    }
    if (act === "s-sort") { const k = b.dataset.k, o = I.ssort || { k: "total", dir: "desc" }; I.ssort = { k, dir: o.k === k ? (o.dir === "asc" ? "desc" : "asc") : k === "name" || k === "kind" ? "asc" : "desc" }; I.slimit = S_PAGE(); renderSenders(); $(`#incSendersList [data-k="${k}"]`)?.focus(); return; }
    if (act === "s-more") { I.slimit = (I.slimit || S_PAGE()) + S_PAGE(); return renderSenders(); }
    if (act === "csv-report") return guard(exportReport);
    if (act === "print-report") return guard(() => printIncome("report"));
    if (act === "print-list") return printIncome("list");
    if (act === "kind-open") { Object.assign(I, NO_FILTER(), { kind: id, person: OV().person }); goTab("records"); return; }
    if (act === "sel-toggle") { I.selMode = !I.selMode; I.sel = new Set(); return redraw(); }
    if (act === "sel-all") { I.sel = new Set(incList.rows.filter(canEdit).map((r) => r.id)); return renderIncList(); }
    if (act === "sel-del") { const ids = [...(I.sel || [])]; if (!ids.length) return toast(t("先勾选要删的收入")); if (!confirmDelete(t("删除选中的 {n} 笔收入？", { n: ids.length }))) return; return guard(async () => { for (const x of ids) await Store.deleteIncomeRecord(x); I.sel = new Set(); I.selMode = false; I.open = null; toast(t("已删除 {n} 笔", { n: ids.length })); await reload(); }); }
    if (act === "ai-run") return runAi();
    if (act === "kind-del") { if (!confirmDelete(t("删除这个收入类型？"))) return; if (I.rec.some((r) => r.kind === id)) return toast(t("还有收入记录用着这个类型，先把它们改成别的类型")); return guard(async () => { await saveMeta({ _income_kinds: rawKinds().filter((k) => k.id !== id) }); redraw(); }); }
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
        const dup = await sameAmountNear(paid_on, amount).catch(() => null);   // ±3.5 天内金额一样的已有花费（那几天的花费读进内存比，dup-check.js）
        if (dup) note = t("；已有对上的花费（{n}），没有重复记", { n: dup.name });
        else purchase_id = await Store.addPurchase({ item_id: null, name: t("还款给 {n}", { n: rec.source_name }), category: "other", quantity: null, unit: null, store: rec.source_name, amount, currency: cur(), purchased_at: new Date(paid_on + "T12:00:00").toISOString() });
      }
      await Store.addIncomeRepayment({ record_id: rec.id, paid_on, amount, method: g("method") || null, notes: null, ...(purchase_id ? { purchase_id } : {}) });
      toast(t("已记录还款") + note); await reload(); if (purchase_id) hooks.refresh();
    });
    if (kind === "kind") return guard(async () => { const name = g("name"); if (!name) return; const parent = INC_L1S.some((x) => x.id === g("parent")) ? g("parent") : "other_income"; await saveMeta({ _income_kinds: [...rawKinds(), { id: `c_${Date.now().toString(36)}`, name, icon: g("icon") || "🏷️", parent }].slice(0, 30) }); rerender(); });
    if (kind === "rename") return guard(async () => { const to = g("to"), key = f.dataset.key; if (!to) return; const ids = I.rec.filter((r) => skey(r.source_name) === key && canEdit(r)).map((r) => r.id); await Store.renameIncomeSource(ids, to); await rememberSenders([key], to); I.renameKey = null; toast(t("已改名 {n} 笔", { n: ids.length })); await reload(); });
  }, true);
  const incListSoon = debounce(() => renderIncList()), sendersSoon = debounce(() => renderSenders());
  let datePend = null, dateT = 0;
  const dateNow = () => { clearTimeout(dateT); const fn = datePend; datePend = null; if (fn) fn(); };
  const dateLater = (v, fn) => { clearTimeout(dateT); datePend = fn; const y = +String(v).slice(0, 4); if (!v || (y >= 1900 && y <= 2100)) dateT = setTimeout(dateNow, 1200); };
  const isDateBox = (el) => el?.dataset && (el.dataset.incR === "from" || el.dataset.incR === "to" || el.dataset.incAnchor !== undefined);
  main.addEventListener("focusout", (e) => { if (isDateBox(e.target) && datePend) { const y = +String(e.target.value).slice(0, 4); if (!e.target.value || (y >= 1900 && y <= 2100)) dateNow(); else { clearTimeout(dateT); datePend = null; } } });   // 离开时年份还不完整：不应用
  main.addEventListener("keydown", (e) => { if (e.key === "Enter" && isDateBox(e.target)) { e.preventDefault(); e.target.blur(); } });   // 搜索：停下 ~200ms 再重画，不是每敲一个字都重画
  main.addEventListener("input", (e) => { const el = e.target; if (el.dataset?.incF === "q") { inc().q = el.value; inc().limit = pageSize(); incListSoon(); } if (el.dataset?.incSq !== undefined) { inc().sq = el.value; inc().slimit = S_PAGE(); sendersSoon(); } });
  main.addEventListener("change", (e) => {
    const el = e.target, I = inc();
    if (el.dataset?.incAcct !== undefined) { const f = el.closest("form"), box = f?.elements.account, cb = f?.elements.acct_default; if (box) { box.hidden = el.value !== "other"; if (!box.hidden) box.focus(); } if (cb) cb.checked = !!el.value && el.value === defAcct(); return; }
    if (el.dataset?.incKind !== undefined) {   // 换类型：卖出类显示「其中已实现收益」，资本流入给一句说明
      const f = el.closest("form"), box = f?.querySelector("[data-inc-gain]"), hint = f?.querySelector("[data-inc-kind-hint]");
      if (box) box.hidden = !(GAIN_KINDS.includes(el.value) || (box.querySelector("input")?.value || "") !== "");
      if (hint) hint.textContent = kindHint(el.value);
    }
    if (el.name && DEF_FIELDS.some(([k]) => k === el.name)) { const cb = el.closest("form")?.elements[`def_${el.name}`]; if (cb) cb.checked = !!el.value && el.value === defOf(el.name); }   // 改了值：「设为默认」跟着当前值是不是默认来（不 return，别的处理照走）
    if (el.dataset?.incRepay !== undefined) { const box = el.closest("form")?.querySelector("[data-inc-repay-box]"); if (box) box.hidden = !el.checked; return; }
    if (el.dataset?.incSel !== undefined) { (I.sel ||= new Set())[el.checked ? "add" : "delete"](el.dataset.incSel); const n = $("#incSelN"); if (n) n.textContent = t("已选 {n} 笔", { n: I.sel.size }); return; }
    if (el.dataset?.incOv) { const o = OV(); o[el.dataset.incOv] = el.value; if (el.dataset.incOv === "range") o.month = ""; return rerender(); }
    if (el.dataset?.incTog === "merge") { setIncMerge(el.checked); return rerender(); }
    if (el.dataset?.incKparent) { const kid = el.dataset.incKparent, v = el.value; guard(async () => { await saveMeta({ _income_kinds: rawKinds().map((k) => (k.id === kid ? { ...k, parent: v } : k)) }); rerender(); }); return; }
    if (el.dataset?.incSsort !== undefined) { const [k, dir] = el.value.split(":"); I.ssort = { k, dir }; I.slimit = S_PAGE(); return renderSenders(); }
    if (el.dataset?.incF) {
      const k = el.dataset.incF; if (k === "q") return; I[k] = el.value; I.limit = pageSize(); I.slimit = S_PAGE();
      // 明细 / 付款方的筛选条：只重画列表（手机上「筛选」面板不会因为整页重画被收起，选完一个还能接着选）
      if (el.closest(".ix-toolbar")) return renderIncList();
      if (el.closest(".ix-stoolbar")) return renderSenders();
      return rerender();
    }
    // 日期框：浏览器每敲完一段（比如年份的第一位）就发 change，立刻重画会把输入框换掉、光标丢了，年月根本输不完。
    // 所以只记下值，等年份像样（1900–2100）后停顿一下、离开输入框或按回车时才应用；空值（清掉）也照样应用
    if (el.dataset?.incR === "from" || el.dataset?.incR === "to") { const r = R(), k = el.dataset.incR, v = el.value; r[k] = v; dateLater(v, () => rerender()); return; }
    if (el.dataset?.incR) { const r = R(); r[el.dataset.incR] = el.value; return rerender(); }
    if (el.dataset?.incAnchor !== undefined) { const v = el.value; if (v) dateLater(v, () => guard(async () => { await saveMeta({ _income_cfg: { ...incCfg(), anchor: v } }); staleAll(["ledger"]); rerender(); })); return; }
    if (el.dataset?.incAi === "consent") { try { localStorage.setItem("hmh-income-ai-ok", el.checked ? "1" : "0"); } catch { /* 忽略 */ } return rerender(); }
    if (el.dataset?.incAi === "unmask") { R().unmask = el.checked; return; }
  });
  document.addEventListener("budget-saved", () => { if (state.route?.section === "bills" && state.route?.sub === "income") rerender(); });
}
/** 存回预算设置时用原样的自定义类型（不带换算出来的 parent 以外的显示字段） */
const rawKinds = () => customKinds().map(({ id, name, icon, parent }) => ({ id, name, icon, parent }));
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

// 付款方多选合并：输入的「合并为」名字记下来，勾选别的付款方重画时不丢
if (typeof document !== "undefined") document.addEventListener("input", (e) => { if (e.target?.id === "incMergeTo") inc().smergeTo = e.target.value; });
