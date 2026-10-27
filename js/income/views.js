/* 账单 → 收入：概览、明细、付款方历史、报表（收入 / 花费 / 差额，按双周 / 月 / 季 / 年，导出，AI 分析）、查看权限。
 * 数据在 income_records（迁移 042），逻辑在 logic.js。花费来自 purchases（按需读取时间窗口，医疗付款并进来），和这里的收入合成现金流。 */
import { state } from "../core/state.js";
import { Store } from "../core/store.js";
import { $, daysUntil, esc, money, num, todayISO, toast } from "../core/util.js";
import { registerAlerts } from "../core/alerts.js";
import { lang, t } from "../core/i18n.js";
import { href } from "../core/router.js";
import { tabBar } from "../core/hub.js";
import { INCOME_TABS, activeTab } from "../core/tabs.js";
import { saveMeta } from "../bills/budget.js";
import { medicalVirtuals } from "../bills/medical.js";
import { aiReady, askText } from "../core/ai.js";
import { STAT_CATS, download, statCat, toCsv, ymd } from "../stats/views.js";
import { CHANNELS, RANGES, UNITS, adults, bucketKey, canSeeAll, customKinds, groupSum, inc, incomeIn, isOwnerNow, kindList, kindOf, knownSenders, loadIncome, memberLabel, myAccess, myPersonId, openRepayments, periodKeys, personOk,
  periodLabel, personName, repayState, repaidOf, similarIncome, skey, sumOf, windowOf } from "./logic.js";

const incomeHref = (id) => `${href("bills", "income")}${id === "overview" ? "" : `?tab=${id}`}`;
const GREEN = "#2c6a57", RED = "#d4694c", BLUE = "#3b7fc4";
const R2 = (v) => Math.round(v * 100) / 100;
let hooks = { render: () => {}, refresh: async () => {} };
const rerender = () => hooks.render(false);
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
function cashflow({ range, from, to, unit, person }) {
  const w = windowOf(range, { from, to }), keys = periodKeys(w.from, w.to, unit), zero = () => Object.fromEntries(keys.map((k) => [k, 0]));
  const income = zero(), spend = zero(), repaid = zero(), byKind = {}, spendCats = {};
  const rows = incomeIn(w.from, w.to, person);
  for (const r of rows) { income[bucketKey(r.received_on, unit)] += r.amount; byKind[r.kind] = (byKind[r.kind] || 0) + r.amount; }
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
  return { w, keys, lines, tot, byKind, rows, hasSpend, hasRepaid, spendCats, unit, loading: person === "all" && !list };
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
  if (!I.loaded && !I.loading) { I.loading = true; loadIncome().finally(() => { I.loading = false; rerender(); }); }
  if (!I.loaded) return shell(tab, `<div class="panel empty"><strong>${t("加载中…")}</strong></div>`);
  const body = { overview: overviewTab, records: recordsTab, senders: sendersTab, report: reportTab, access: accessTab }[tab]();
  return shell(tab, I.ok ? body : tab === "access" ? body : "");
}

/* ───────────── 公共小件 ───────────── */
const kindBadge = (id) => { const k = kindOf(id); return `<span class="ix-kind" style="--k:${k.color}">${k.icon} ${esc(t(k.name))}</span>`; };
const personOptions = (sel, { all = false } = {}) => `${all ? `<option value="all" ${sel === "all" ? "selected" : ""}>${t("全家")}</option>` : ""}<option value="none" ${sel === "none" ? "selected" : ""}>${t(all ? "未指定的" : "未指定 / 全家")}</option>${adults().map((p) => `<option value="${p.id}" ${sel === p.id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}`;
const selOpts = (list, sel) => list.map(([v, l]) => `<option value="${esc(v)}" ${v === sel ? "selected" : ""}>${esc(t(l))}</option>`).join("");
const yearsOf = () => [...new Set(inc().rec.map((r) => r.received_on.slice(0, 4)).concat(String(new Date().getFullYear())))].sort().reverse();
const empty = () => `<div class="panel empty"><strong>${t("还没有收入记录")}</strong>${t("点右上角「记一笔收入」；在「花费 → 银行导入」导入对账单时，工资、电汇、Zelle 转入这些入账会单独列出来，勾上就能一起导入。")}</div>`;
const kpi = (label, val, sub = "") => `<div class="kpi"><span>${esc(label)}</span><b>${val}</b>${sub ? `<small>${sub}</small>` : ""}</div>`;
const rate = (n, i) => (i > 0 && n != null ? `${Math.round((n / i) * 100)}%` : "—");
const fmtMoney = (v, short) => money(v, !!short);

/** 收入 / 花费分组柱 + 差额（结余 / 超支）柱 + 趋势线 */
function flowCharts(cf, title) {
  if (!window.Charts || !cf.lines.length) return "";
  const labels = cf.lines.map((l) => l.label), f = (v, s) => fmtMoney(v, s);
  const grouped = window.Charts.bars({ labels, title, stacked: false, showTotals: false, fmt: f,
    series: [{ name: t("收入"), color: GREEN, values: cf.lines.map((l) => l.income) }, ...(cf.hasSpend ? [{ name: t("花费"), color: RED, values: cf.lines.map((l) => Math.max(0, l.spend)) }] : [])] });
  const diff = cf.hasSpend ? window.Charts.bars({ labels, title: t("收支差额"), stacked: true, showTotals: false, fmt: f,
    series: [{ name: t("结余（收入 − 花费）"), color: BLUE, values: cf.lines.map((l) => Math.max(0, l.net)) }, { name: t("超支"), color: "#b23b3b", values: cf.lines.map((l) => Math.max(0, -l.net)) }] }) : "";
  const trend = cf.lines.length > 2 ? window.Charts.line({ labels, title: t("趋势"), fmt: f, series: [{ name: t("收入"), color: GREEN, values: cf.lines.map((l) => l.income) }, ...(cf.hasSpend ? [{ name: t("花费"), color: RED, values: cf.lines.map((l) => Math.max(0, l.spend)) }] : [])] }) : "";
  return `<div class="panel chart-panel"><h3>${t("收入 vs 花费")}</h3>${grouped}</div>${diff ? `<div class="panel chart-panel"><h3>${t("差额：结余 / 超支")}</h3>${diff}</div>` : ""}${trend ? `<div class="panel chart-panel"><h3>${t("趋势")}</h3>${trend}</div>` : ""}`;
}
const kindDonut = (byKind) => {
  const items = Object.entries(byKind).map(([id, value]) => ({ name: t(kindOf(id).name), value: R2(value), color: kindOf(id).color }));
  return items.length && window.Charts ? `<div class="panel chart-panel"><h3>${t("按收入类型")}</h3>${window.Charts.donut({ items, fmt: fmtMoney, title: t("按收入类型"), center: fmtMoney(items.reduce((a, x) => a + x.value, 0), true) })}</div>` : "";
};
const lineTable = (cf) => `<div class="panel"><div class="ch-scroll"><table class="store-table"><thead><tr><th scope="col">${t("周期")}</th><th scope="col">${t("收入")}</th>${cf.hasSpend ? `<th scope="col">${t("花费")}</th>` : ""}${cf.hasRepaid ? `<th scope="col">${t("其中：还款")}</th>` : ""}${cf.hasSpend ? `<th scope="col">${t("收支差额")}</th><th scope="col">${t("结余率")}</th>` : ""}</tr></thead><tbody>
  ${cf.lines.map((l) => `<tr><th scope="row">${esc(l.label)}</th><td>${fmtMoney(l.income)}</td>${cf.hasSpend ? `<td>${fmtMoney(l.spend)}</td>` : ""}${cf.hasRepaid ? `<td>${fmtMoney(l.repaid)}</td>` : ""}${cf.hasSpend ? `<td class="${l.net < 0 ? "down" : ""}">${fmtMoney(l.net)}</td><td>${rate(l.net, l.income)}</td>` : ""}</tr>`).join("")}
  <tr><th scope="row"><b>${t("合计")}</b></th><td><b>${fmtMoney(cf.tot.income)}</b></td>${cf.hasSpend ? `<td><b>${fmtMoney(cf.tot.spend)}</b></td>` : ""}${cf.hasRepaid ? `<td><b>${fmtMoney(cf.tot.repaid)}</b></td>` : ""}${cf.hasSpend ? `<td><b>${fmtMoney(cf.tot.net)}</b></td><td><b>${rate(cf.tot.net, cf.tot.income)}</b></td>` : ""}</tr></tbody></table></div>
  ${cf.hasRepaid ? `<p class="muted" style="font-size:12.5px;margin:6px 0 0">${t("其中「还款」= 还给个人赠与 / 借款的钱：钱从账户里出去了，已经算在花费里（记还款时默认同时记一笔花费；银行导入的转账也会算），这一列只是告诉你其中有多少。差额 = 收入 − 花费。")}</p>` : ""}</div>`;

/* ───────────── 概览 ───────────── */
function overviewTab() {
  const I = inc(), years = yearsOf(), y = years.includes(I.year) ? I.year : years[0], person = I.person === "all" || I.person === "none" || adults().some((p) => p.id === I.person) ? I.person : "all";
  if (!I.rec.length) return empty();
  const today = todayISO(), cf = cashflow({ range: "custom", from: `${y}-01-01`, to: +y === +today.slice(0, 4) ? today : `${y}-12-31`, unit: "month", person });
  const filters = `<div class="time-bar"><label class="tb-field"><span>${t("年份")}</span><select data-inc-f="year" data-nosearch>${years.map((v) => `<option value="${v}" ${v === y ? "selected" : ""}>${t("{y} 年", { y: v })}</option>`).join("")}</select></label>
    <label class="tb-field"><span>${t("谁的")}</span><select data-inc-f="person" data-nosearch>${personOptions(person, { all: true })}</select></label></div>`;
  const kpis = `<div class="kpis">${kpi(t("收入"), fmtMoney(cf.tot.income), t("{n} 笔收入", { n: cf.rows.length }))}${cf.hasSpend ? kpi(t("花费"), fmtMoney(cf.tot.spend)) : ""}${cf.hasSpend ? kpi(t("收支差额"), `<span class="${cf.tot.net < 0 ? "down" : ""}">${fmtMoney(cf.tot.net)}</span>`, t("结余率 {r}", { r: rate(cf.tot.net, cf.tot.income) })) : ""}</div>`;
  // 每人一行 + 全家合计
  const byP = groupSum(incomeIn(cf.w.from, cf.w.to, "all"), (r) => r.person_id || "");
  const members = byP.length ? `<div class="panel"><h3 style="margin:0 0 8px">${t("按成员")}</h3><div class="ch-scroll"><table class="store-table"><thead><tr><th scope="col">${t("成员")}</th><th scope="col">${t("笔数")}</th><th scope="col">${t("合计")}</th><th scope="col">${t("占比")}</th></tr></thead><tbody>
    ${byP.map((x) => `<tr><th scope="row">${esc(x.key ? personName(x.key) || t("已删除的成员") : t("未指定 / 全家"))}</th><td>${x.n}</td><td>${fmtMoney(x.total)}</td><td>${rate(x.total, sumOf(incomeIn(cf.w.from, cf.w.to, "all")))}</td></tr>`).join("")}
    <tr><th scope="row"><b>${t("全家合计")}</b></th><td><b>${byP.reduce((a, x) => a + x.n, 0)}</b></td><td><b>${fmtMoney(sumOf(incomeIn(cf.w.from, cf.w.to, "all")))}</b></td><td>100%</td></tr></tbody></table></div></div>` : "";
  return `${filters}${kpis}${cf.loading ? `<p class="muted" role="status">${t("正在读取花费…")}</p>` : ""}${flowCharts(cf, t("{y} 年每月收入 vs 花费", { y }))}${kindDonut(cf.byKind)}${members}${repayPanel()}`;
}
function repayPanel() {
  const list = openRepayments(); if (!list.length) return "";
  return `<div class="panel"><h3 style="margin:0 0 8px">🤝 ${t("还没还清的（个人赠与 / 借款）")}</h3><ul class="restock-list">${list.map(({ r, s }) => `<li><div class="grow"><span class="name">${esc(r.source_name)} · ${fmtMoney(s.total)}</span><small>${t("已还 {a}，还差 {b}", { a: fmtMoney(s.paid), b: fmtMoney(s.left) })}${r.repay_due_on ? ` · ${s.overdue ? `<b class="bank-dup">${t("已逾期")}</b> ` : ""}${t("到期日 {d}", { d: r.repay_due_on })}` : ""}</small></div>
    <button type="button" class="btn btn-sm btn-ghost" data-inc="open" data-id="${r.id}">${t("去还款")}</button></li>`).join("")}</ul></div>`;
}

/* ───────────── 明细 ───────────── */
function filteredRecords() {
  const I = inc(), q = skey(I.q);
  return I.rec.filter((r) => (I.kind === "all" || r.kind === I.kind) && (I.person === "all" || (I.person === "none" ? !r.person_id : r.person_id === I.person)) && (I.year === "all" || r.received_on.startsWith(I.year))
    && (!q || skey(`${r.source_name} ${r.notes || ""} ${r.account || ""} ${kindOf(r.kind).name}`).includes(q))).sort((a, b) => b.received_on.localeCompare(a.received_on) || String(b.created_at).localeCompare(String(a.created_at)));
}
const canEdit = (r) => isOwnerNow() || r.created_by === state.user?.id;
function recordRow(r) {
  const I = inc(), s = repayState(r), open = I.open === r.id;
  const who = r.person_id ? personName(r.person_id) : "", sub = [r.received_on, esc(t(kindOf(r.kind).name)), who && esc(who), r.account && esc(r.account), r.channel && esc(t((CHANNELS.find((c) => c[0] === r.channel) || [])[1] || ""))].filter(Boolean).join(" · ");
  const rb = s ? `<span class="badge ${s.status === "paid" ? "b-ok" : s.overdue ? "b-out" : "b-soon"}">${s.status === "paid" ? t("已还清") : s.overdue ? t("逾期") : t("待还 {a}", { a: fmtMoney(s.left, true) })}</span>` : "";
  return `<li class="ix-li${open ? " is-open" : ""}" data-id="${r.id}"><button type="button" class="ix-main" data-inc="open" data-id="${r.id}" aria-expanded="${open}">
    <span class="ix-ico" style="--k:${kindOf(r.kind).color}" aria-hidden="true">${kindOf(r.kind).icon}</span><span class="grow"><b class="name">${esc(r.source_name)}</b><small>${sub}</small></span><span class="ix-side"><b class="ix-amt">+${fmtMoney(r.amount)}</b>${rb}</span></button>${open ? recordDetail(r, s) : ""}</li>`;
}
function recordDetail(r, s) {
  const extra = [r.orig_amount && `${t("原币种")} ${r.orig_amount} ${r.orig_currency || ""}`, r.fee != null && `${t("手续费")} ${fmtMoney(r.fee)}`, r.import_batch && t("银行导入"), r.created_by && r.created_by !== state.user?.id && memberLabel(r.created_by) && t("{n} 记的", { n: memberLabel(r.created_by) })].filter(Boolean);
  const reps = inc().rep.filter((p) => p.record_id === r.id).sort((a, b) => b.paid_on.localeCompare(a.paid_on));
  const repay = s ? `<div class="ix-repay"><b>🤝 ${t("还款（还给对方）")}</b> · ${t("总额 {a}，已还 {b}，还差 {c}", { a: fmtMoney(s.total), b: fmtMoney(s.paid), c: fmtMoney(s.left) })}${r.repay_due_on ? ` · ${t("到期日 {d}", { d: r.repay_due_on })}` : ""}
    <ul class="ix-reps">${reps.map((p) => `<li><span>${p.paid_on} · <b>${fmtMoney(p.amount)}</b>${p.method ? ` · ${esc(p.method)}` : ""}${p.purchase_id ? ` · <span class="muted">${t("已计入花费")}</span>` : ""}</span><button type="button" class="btn btn-sm btn-ghost" data-inc="rep-del" data-id="${p.id}">${t("删除")}</button></li>`).join("") || `<li class="muted">${t("还没有还款记录")}</li>`}</ul>
    ${s.left > 0 ? `<form data-inc-form="repay" data-id="${r.id}" class="form-grid" style="margin-top:6px"><label>${t("还款日期")}<input type="date" name="paid_on" value="${todayISO()}" required></label><label>${t("金额")}<input type="number" name="amount" step="0.01" min="0.01" value="${s.left}" required></label><label>${t("方式")}<input name="method" maxlength="40" placeholder="Zelle / ${esc(t("现金"))}"></label><label class="check-inline" style="grid-column:1/-1"><input type="checkbox" name="as_spend" checked><span>${t("同时记为一笔花费（钱从账户里出去了）")}</span></label><small class="muted" style="grid-column:1/-1">${t("如果这笔转账已经从银行对账单导入成花费了，系统会发现并不再重复记；也可以取消勾选。")}</small><div class="form-actions"><button class="btn btn-sm btn-primary">${t("记一笔还款")}</button></div></form>` : ""}</div>` : "";
  return `<div class="ix-detail">${extra.length ? `<p class="muted small" style="margin:0 0 6px">${extra.map(esc).join(" · ")}</p>` : ""}${r.notes ? `<p style="margin:0 0 6px">${esc(r.notes)}</p>` : ""}${repay}
    ${canEdit(r) ? `<div class="form-actions"><button type="button" class="btn btn-sm" data-inc="edit" data-id="${r.id}">${t("编辑")}</button><button type="button" class="btn btn-sm btn-ghost" data-inc="del" data-id="${r.id}">${t("删除")}</button></div>` : ""}</div>`;
}
const listHtml = () => {
  const I = inc(), all = filteredRecords(), head = all.slice(0, I.limit);
  return `<div class="muted small" style="margin:0 0 6px">${t("{n} 笔，合计 {m}", { n: all.length, m: fmtMoney(sumOf(all)) })}</div><ul class="restock-list ix-list">${head.map(recordRow).join("") || `<li class="muted">${t("没有符合条件的记录")}</li>`}</ul>
    ${all.length > head.length ? `<div class="form-actions" style="justify-content:center"><button type="button" class="btn btn-sm btn-ghost" data-inc="more">${t("再看 40 笔（还有 {n} 笔）", { n: all.length - head.length })}</button></div>` : ""}`;
};
export const renderIncList = () => { const el = $("#incList"); if (el) el.innerHTML = listHtml(); };
function recordsTab() {
  const I = inc();
  if (!I.rec.length && !I.form) return empty() + kindManager();
  return `${I.form ? formHtml() : ""}<div class="panel"><div class="form-grid ix-filter">
    <label>${t("搜索")}<input type="search" data-inc-f="q" value="${esc(I.q)}" placeholder="${esc(t("付款方 / 备注"))}"></label>
    <label>${t("类型")}<select data-inc-f="kind" data-nosearch><option value="all">${t("全部")}</option>${kindList().map((k) => `<option value="${k.id}" ${I.kind === k.id ? "selected" : ""}>${k.icon} ${esc(t(k.name))}</option>`).join("")}</select></label>
    <label>${t("谁的")}<select data-inc-f="person" data-nosearch>${personOptions(I.person, { all: true })}</select></label>
    <label>${t("年份")}<select data-inc-f="year" data-nosearch><option value="all">${t("全部")}</option>${yearsOf().map((v) => `<option value="${v}" ${I.year === v ? "selected" : ""}>${v}</option>`).join("")}</select></label></div>
    <div id="incList" style="margin-top:8px">${listHtml()}</div>
    <div class="form-actions" style="margin-top:6px"><button type="button" class="btn btn-sm btn-ghost" data-inc="csv-detail">${t("导出当前列表 CSV")}</button></div></div>${kindManager()}`;
}
function kindManager() {
  const cs = customKinds();
  return `<details class="panel ref-panel" style="margin-top:10px"><summary><b>${t("管理收入类型")}</b><small>${t("内置 {n} 种，自定义 {m} 种", { n: 14, m: cs.length })}</small><span class="mch" aria-hidden="true">›</span></summary><div class="ref-body">
    <ul class="plain small">${cs.map((k) => `<li>${esc(k.icon || "🏷️")} ${esc(k.name)} <button type="button" class="btn btn-sm btn-ghost" data-inc="kind-del" data-id="${esc(k.id)}">${t("删除")}</button></li>`).join("") || `<li class="muted">${t("还没有自定义类型")}</li>`}</ul>
    <form data-inc-form="kind" class="form-grid"><label>${t("图标")}<input name="icon" maxlength="4" value="🏷️" style="width:4em"></label><label>${t("名称")}<input name="name" maxlength="20" required placeholder="${esc(t("例如：稿费、副业"))}"></label><div class="form-actions"><button class="btn btn-sm">${t("添加类型")}</button></div></form></div></details>`;
}

/* ── 表单 ── */
function formHtml() {
  const I = inc(), f = I.form, r = f.rec || {}, owner = isOwnerNow(), mine = myPersonId();
  const person = r.person_id !== undefined ? r.person_id : mine, d = (v) => esc(v ?? "");
  const persons = owner ? personOptions(person || "none") : `<option value="${mine || "none"}">${esc(personName(mine) || t("未指定 / 全家"))}</option>`;
  return `<form class="panel" data-inc-form="record" id="incForm" autocomplete="off"><h3 style="margin:0 0 8px">${r.id ? t("编辑收入") : t("记一笔收入")}</h3>
    <div class="form-grid">
      <label>${t("到账日期")}<input type="date" name="received_on" value="${d(r.received_on || todayISO())}" required></label>
      <label>${t("到账金额")}（${esc(cur())}）<input type="number" name="amount" step="0.01" min="0.01" inputmode="decimal" value="${d(r.amount)}" required></label>
      <label>${t("谁给的（付款方 / 雇主）")}<input name="source_name" list="incSenders" maxlength="80" value="${d(r.source_name)}" required placeholder="${esc(t("公司名 / 汇款人"))}"><datalist id="incSenders">${knownSenders().map((s) => `<option value="${esc(s)}">`).join("")}</datalist></label>
      <label>${t("类型")}<select name="kind">${kindList().map((k) => `<option value="${k.id}" ${(r.kind || "other") === k.id ? "selected" : ""}>${k.icon} ${esc(t(k.name))}</option>`).join("")}</select></label>
      <label>${t("收款方式")}<select name="channel" data-nosearch><option value="">${t("未填")}</option>${selOpts(CHANNELS, r.channel)}</select></label>
      <label>${t("这是谁的收入")}<select name="person_id" data-nosearch>${persons}</select></label>
      <label>${t("入到哪个账户")}<input name="account" maxlength="60" value="${d(r.account)}" placeholder="Chase ····1234"></label>
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
  const row = { id: f.rec?.id, received_on: g("received_on") || todayISO(), amount, currency: cur(), orig_amount: num(g("orig_amount")) > 0 ? num(g("orig_amount")) : null, orig_currency: g("orig_currency").toUpperCase().slice(0, 3) || null,
    fee: g("fee") === "" ? null : num(g("fee")), source_name: name, kind: g("kind") || "other", channel: g("channel") || null, person_id: pid && pid !== "none" ? pid : null, account: g("account") || null,
    import_batch: f.rec?.import_batch || null, repay_required: repay, repay_due_on: repay ? g("repay_due_on") || null : null, repay_amount: repay && num(g("repay_amount")) > 0 ? num(g("repay_amount")) : null, notes: g("notes") || null };
  if (row.orig_currency && !/^[A-Z]{3}$/.test(row.orig_currency)) return fail(t("原币种填 3 位字母，如 CNY"));
  const dup = !row.id && similarIncome(row), key = `${row.received_on}|${row.amount}|${skey(name)}`;
  if (dup && f.dupAck !== key) { f.dupAck = key; return fail(t("看起来已经记过：{d} · {n} · {a}。确认不是重复的话，再点一次保存。", { d: dup.received_on, n: dup.source_name, a: fmtMoney(dup.amount) })); }
  try { await Store.saveIncomeRecord(row); I.form = null; await loadIncome(); toast(t("已保存")); rerender(); }
  catch (e) { fail(t("保存失败：{msg}", { msg: e.message })); }
}

/* ───────────── 付款方历史 ───────────── */
function sendersTab() {
  const I = inc(), range = I.sRange || "all", person = I.person;
  const rows = I.rec.filter((r) => { const w = sWindow(range); return r.received_on >= w.from && r.received_on <= w.to && (person === "all" || (person === "none" ? !r.person_id : r.person_id === person)); });
  if (!I.rec.length) return empty();
  const list = groupSum(rows, (r) => skey(r.source_name)), total = sumOf(rows);
  const mainKind = (x) => { const k = groupSum(x.rows, (r) => r.kind)[0]?.key; return k ? kindBadge(k) : ""; };
  const nameOf = (x) => x.rows.find((r) => r.source_name)?.source_name || x.key;
  return `<div class="time-bar"><label class="tb-field"><span>${t("时间范围")}</span><select data-inc-f="sRange" data-nosearch>${[["ytd", "今年"], ["3y", "近 3 年"], ["5y", "近 5 年"], ["all", "全部历史"]].map(([v, l]) => `<option value="${v}" ${v === range ? "selected" : ""}>${t(l)}</option>`).join("")}</select></label>
    <label class="tb-field"><span>${t("谁的")}</span><select data-inc-f="person" data-nosearch>${personOptions(person, { all: true })}</select></label></div>
    <div class="panel"><p class="muted small" style="margin:0 0 8px">${t("{n} 个付款方，合计 {m}", { n: list.length, m: fmtMoney(total) })}</p>
    <div class="ch-scroll"><table class="store-table ix-tbl"><thead><tr><th scope="col">${t("付款方")}</th><th scope="col">${t("类型")}</th><th scope="col">${t("收到次数")}</th><th scope="col">${t("合计")}</th><th scope="col">${t("占比")}</th><th scope="col">${t("最近一次")}</th><th></th></tr></thead><tbody>
    ${list.map((x) => `<tr><th scope="row"><button type="button" class="link-name" data-inc="sender-open" data-key="${esc(x.key)}">${esc(nameOf(x))}</button></th><td>${mainKind(x)}</td><td>${x.n}</td><td>${fmtMoney(x.total)}</td><td>${rate(x.total, total)}</td><td>${x.last}</td>
      <td>${x.rows.every(canEdit) ? `<button type="button" class="btn btn-sm btn-ghost" data-inc="sender-rename" data-key="${esc(x.key)}">${t("改名 / 合并")}</button>` : ""}</td></tr>
      ${I.renameKey === x.key ? `<tr><td colspan="7"><form data-inc-form="rename" data-key="${esc(x.key)}" class="form-grid"><label>${t("统一改成")}<input name="to" maxlength="80" required value="${esc(nameOf(x))}" list="incSenders"></label><div class="form-actions"><button class="btn btn-sm btn-primary">${t("改名（相同名字的会合并成一个）")}</button><button type="button" class="btn btn-sm btn-ghost" data-inc="sender-rename" data-key="">${t("取消")}</button></div></form><datalist id="incSenders">${knownSenders().map((s) => `<option value="${esc(s)}">`).join("")}</datalist></td></tr>` : ""}`).join("")}</tbody></table></div>
    <div class="form-actions" style="margin-top:8px"><button type="button" class="btn btn-sm" data-inc="csv-senders">${t("导出付款方汇总 CSV")}</button></div></div>`;
}
function sWindow(range) { return windowOf(range === "ytd" ? "ytd" : range === "3y" ? "3y" : range === "5y" ? "5y" : "all"); }

/* ───────────── 报表（窗口 + 周期 + 导出 + AI） ───────────── */
const R = () => (inc().r ||= { unit: "month", range: "12m", from: "", to: "", person: "all", what: "both", unmask: false });
function reportTab() {
  const I = inc(), r = R();
  if (!I.rec.length) return empty();
  const cf = cashflow(r);
  const person = r.person, sel = (id, list, v) => `<label class="tb-field"><span>${t(id)}</span><select data-inc-r="${id === "周期" ? "unit" : id === "时间范围" ? "range" : "what"}" data-nosearch>${selOpts(list, v)}</select></label>`;
  const controls = `<div class="time-bar">${sel("周期", UNITS, r.unit)}${sel("时间范围", RANGES, r.range)}
    <label class="tb-field"><span>${t("谁的")}</span><select data-inc-r="person" data-nosearch>${personOptions(person, { all: true })}</select></label>
    ${r.range === "custom" ? `<label class="tb-field"><span>${t("从")}</span><input type="date" data-inc-r="from" value="${esc(r.from)}"></label><label class="tb-field"><span>${t("到")}</span><input type="date" data-inc-r="to" value="${esc(r.to)}"></label>` : ""}</div>
    ${r.unit === "biweek" ? `<p class="muted small" style="margin:-4px 0 8px">${t("双周起点（每 14 天一个周期，对上你的发薪日）：")}<input type="date" data-inc-anchor value="${esc(cfAnchor())}" aria-label="${esc(t("双周起点"))}"></p>` : ""}`;
  const note = person !== "all" ? `<p class="muted small" role="status">${t("花费不分人：选「全家」才会显示花费和差额。")}</p>` : cf.loading ? `<p class="muted small" role="status">${t("正在读取花费…")}</p>` : "";
  const exp = `<div class="panel"><h3 style="margin:0 0 8px">${t("导出")}</h3><div class="form-actions" style="flex-wrap:wrap">
    <label class="tb-field"><span>${t("内容")}</span><select data-inc-r="what" data-nosearch>${selOpts([["both", "收入 + 花费 + 差额（合并）"], ["income", "只要收入（按类型）"], ["spend", "只要花费（按分类）"]], r.what)}</select></label>
    <button type="button" class="btn btn-primary btn-sm" data-inc="csv-report">${t("导出这段时间 CSV")}</button><button type="button" class="btn btn-sm" data-inc="csv-detail-window">${t("导出收入明细")}</button></div></div>`;
  return `${controls}${note}${kpiRow(cf)}${flowCharts(cf, t("每{u}收入 vs 花费", { u: t((UNITS.find((u) => u[0] === r.unit) || [])[1]) }))}${lineTable(cf)}${kindDonut(cf.byKind)}${exp}${aiPanel(cf)}`;
}
const cfAnchor = () => (state.budget?.cat_budgets?._income_cfg?.anchor) || "2024-01-01";
const kpiRow = (cf) => `<div class="kpis">${kpi(t("收入"), fmtMoney(cf.tot.income), `${cf.w.from} → ${cf.w.to}`)}${cf.hasSpend ? kpi(t("花费"), fmtMoney(cf.tot.spend)) : ""}${cf.hasSpend ? kpi(t("收支差额"), `<span class="${cf.tot.net < 0 ? "down" : ""}">${fmtMoney(cf.tot.net)}</span>`, t("结余率 {r}", { r: rate(cf.tot.net, cf.tot.income) })) : ""}</div>`;

/* ── 导出 ── */
function exportReport() {
  const r = R(), cf = cashflow(r), hh = (state.household?.name || t("家庭")).replace(/[\\/:*?"<>|\s]/g, ""), base = `${hh}-${t("现金流")}-${cf.w.from}_${cf.w.to}`, unitName = t((UNITS.find((u) => u[0] === r.unit) || [])[1]);
  const head = [[t("{hh} 现金流（{u}）", { hh: state.household?.name || t("家庭"), u: unitName })], [t("时间"), `${cf.w.from} → ${cf.w.to}`, t("货币：{cur}", { cur: cur() }), t("谁的：{p}", { p: r.person === "all" ? t("全家") : r.person === "none" ? t("未指定") : personName(r.person) })], []];
  let rows;
  if (r.what === "income") {
    const kinds = kindList().filter((k) => cf.rows.some((x) => x.kind === k.id));
    const grid = Object.fromEntries(cf.keys.map((k) => [k, {}])); for (const x of cf.rows) { const g = grid[bucketKey(x.received_on, r.unit)]; g[x.kind] = (g[x.kind] || 0) + x.amount; }
    rows = [[t("周期"), ...kinds.map((k) => t(k.name)), t("合计")], ...cf.keys.map((k) => [periodLabel(k, r.unit), ...kinds.map((c) => R2(grid[k][c.id] || 0)), R2(Object.values(grid[k]).reduce((a, b) => a + b, 0))]), [t("合计"), ...kinds.map((c) => R2(cf.byKind[c.id] || 0)), cf.tot.income]];
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
  return [[t("到账日期"), t("付款方"), t("类型"), t("金额"), t("货币"), t("收款方式"), t("成员"), t("账户"), t("原币种金额"), t("原币种"), t("手续费"), t("还款状态"), t("备注")],
    ...list.map((r) => [r.received_on, r.source_name, t(kindOf(r.kind).name), r.amount, r.currency || "", (CHANNELS.find((c) => c[0] === r.channel) || [])[1] ? t(CHANNELS.find((c) => c[0] === r.channel)[1]) : "", personName(r.person_id), r.account || "", r.orig_amount ?? "", r.orig_currency || "", r.fee ?? "", rs(r), r.notes || ""])];
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
    income_by_type: Object.entries(cf.byKind).map(([k, v]) => ({ type: kindOf(k).name, total: R2(v) })),
    income_by_member: groupSum(cf.rows, (x) => x.person_id || "").map((x) => ({ member: pname(x.key), total: x.total })),
    top_senders: senders.map((x, i) => ({ sender: mask ? `${t("付款方")} ${i + 1}` : x.rows[0].source_name, type: kindOf(groupSum(x.rows, (y) => y.kind)[0].key).name, count: x.n, total: x.total })),
    open_paybacks_total: R2(openRepayments().reduce((a, x) => a + x.s.left, 0)) };
  const sys = `You are a careful household cash-flow analyst. You are NOT a licensed financial advisor. Reply in ${lang === "en" ? "English" : lang === "zh-Hant" ? "Traditional Chinese" : "Simplified Chinese"}, concise, plain text with short sections: 1) Overview 2) Trends 3) Unusual periods or concentration risk (e.g. one sender dominating) 4) Savings rate and stability 5) Three practical suggestions. Use only the numbers given; if spending is null it was not available. Do not invent data.`;
  try { I.ai[key] = String(await askText(sys, JSON.stringify(data), { maxTokens: 1400, temperature: 0.3 })).trim(); }
  catch (e) { toast(e.message || String(e)); }
  I.aiBusy = false; rerender();
}

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
    <div class="panel"><b>${t("提醒")}</b><ul class="plain small" style="margin:6px 0 0"><li>${t("收入不会出现在花费、预算、AI 助手的问答里，也不在导出的花费 CSV 里。")}</li><li>${t("设置 → 备份与恢复 的备份文件会包含你能看到的收入，保存备份的位置请自己保管好。")}</li></ul></div>`;
}

/* ───────────── 事件 ───────────── */
function armed(el, msg) { if (el.dataset.armed) return true; el.dataset.armed = "1"; const old = el.textContent; el.textContent = msg; setTimeout(() => { delete el.dataset.armed; el.textContent = old; }, 4000); return false; }
const guard = async (fn) => { try { await fn(); } catch (e) { toast(t("操作失败：{msg}", { msg: e.message })); } };
const reload = async () => { await loadIncome(); rerender(); };
const goTab = (id) => { location.hash = incomeHref(id); };

export function initIncome({ render, refresh }) {
  hooks = { render, refresh };
  const main = document.getElementById("main");
  main.addEventListener("click", (e) => {
    const b = e.target.closest?.("[data-inc]"); if (!b) return;
    const I = inc(), id = b.dataset.id, act = b.dataset.inc;
    if (act === "add") { I.form = { rec: null }; if (activeTab(state.route) !== "records" || state.route.sub !== "income") goTab("records"); else rerender(); return; }
    if (act === "cancel") { I.form = null; return rerender(); }
    if (act === "open") { I.open = I.open === id ? null : id; if (activeTab(state.route) !== "records") { I.q = ""; I.kind = "all"; I.year = "all"; I.person = "all"; goTab("records"); return; } return rerender(); }
    if (act === "more") { I.limit += 40; return renderIncList(); }
    if (act === "edit") { I.form = { rec: I.rec.find((r) => r.id === id) }; return rerender(); }
    if (act === "del") { if (!armed(b, t("再点一次确认删除"))) return; return guard(async () => { await Store.deleteIncomeRecord(id); I.open = null; await reload(); }); }
    if (act === "rep-del") { if (!armed(b, t("再点一次确认"))) return; return guard(async () => { const p = I.rep.find((x) => x.id === id); await Store.deleteIncomeRepayment(id); if (p?.purchase_id) { await Store.deletePurchase(p.purchase_id).catch(() => {}); state.purchases = state.purchases.filter((x) => x.id !== p.purchase_id); } await reload(); }); }
    if (act === "sender-open") { I.q = b.dataset.key; I.kind = "all"; I.year = "all"; goTab("records"); return; }
    if (act === "sender-rename") { I.renameKey = b.dataset.key || null; return rerender(); }
    if (act === "csv-detail") { const l = filteredRecords(); if (!l.length) return toast(t("没有可导出的记录")); download(`${fileHead()}-${t("明细")}.csv`, toCsv(detailRows(l))); return; }
    if (act === "csv-detail-window") { const w = windowOf(R().range, R()), l = incomeIn(w.from, w.to, R().person); if (!l.length) return toast(t("这段时间没有收入")); download(`${fileHead()}-${w.from}_${w.to}-${t("明细")}.csv`, toCsv(detailRows(l))); return; }
    if (act === "csv-senders") {
      const w = sWindow(I.sRange || "all"), l = I.rec.filter((r) => r.received_on >= w.from && r.received_on <= w.to && (I.person === "all" || (I.person === "none" ? !r.person_id : r.person_id === I.person))), tot = sumOf(l);
      return download(`${fileHead()}-${t("付款方汇总")}-${w.from}_${w.to}.csv`, toCsv([[t("付款方"), t("主要类型"), t("次数"), t("合计"), t("占比"), t("第一次"), t("最近一次")], ...groupSum(l, (r) => skey(r.source_name)).map((x) => [x.rows[0].source_name, t(kindOf(groupSum(x.rows, (y) => y.kind)[0].key).name), x.n, x.total, rate(x.total, tot), x.first, x.last])]));
    }
    if (act === "csv-report") return exportReport();
    if (act === "ai-run") return runAi();
    if (act === "kind-del") { if (!armed(b, t("再点一次确认删除"))) return; if (I.rec.some((r) => r.kind === id)) return toast(t("还有收入记录用着这个类型，先把它们改成别的类型")); return guard(async () => { await saveMeta({ _income_kinds: customKinds().filter((k) => k.id !== id) }); rerender(); }); }
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
    if (kind === "kind") return guard(async () => { const name = g("name"); if (!name) return; await saveMeta({ _income_kinds: [...customKinds(), { id: `c_${Date.now().toString(36)}`, name, icon: g("icon") || "🏷️" }].slice(0, 30) }); rerender(); });
    if (kind === "rename") return guard(async () => { const to = g("to"), key = f.dataset.key; if (!to) return; const ids = I.rec.filter((r) => skey(r.source_name) === key && canEdit(r)).map((r) => r.id); await Store.renameIncomeSource(ids, to); I.renameKey = null; toast(t("已改名 {n} 笔", { n: ids.length })); await reload(); });
    if (kind === "request") return guard(async () => { await Store.setIncomeAccess(state.user.id, "requested", g("note") || null); toast(t("已发送申请，等家主批准")); await reload(); });
  }, true);
  main.addEventListener("input", (e) => { const el = e.target; if (el.dataset?.incF === "q") { inc().q = el.value; inc().limit = 40; renderIncList(); } });
  main.addEventListener("change", (e) => {
    const el = e.target, I = inc();
    if (el.dataset?.incRepay !== undefined) { const box = el.closest("form")?.querySelector("[data-inc-repay-box]"); if (box) box.hidden = !el.checked; return; }
    if (el.dataset?.incF) { const k = el.dataset.incF; if (k === "q") return; I[k] = el.value; I.limit = 40; return rerender(); }
    if (el.dataset?.incR) { const r = R(); r[el.dataset.incR] = el.value; return rerender(); }
    if (el.dataset?.incAnchor !== undefined) { if (el.value) guard(async () => { await saveMeta({ _income_cfg: { anchor: el.value } }); rerender(); }); return; }
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
