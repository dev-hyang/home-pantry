/* 设置 → 打印：采购清单、账单概览。点“打印”时把要印的内容生成到 #printSheet，只在打印时显示（见 styles.css），然后调出浏览器打印。 */
import { state } from "../core/state.js";
import { $, esc, fmtDate, fmtShort, money, num, todayISO } from "../core/util.js";
import { t } from "../core/i18n.js";
import { memberName } from "../core/logic.js";
import { budgetPlan, monthProgress } from "../bills/budget.js";
import { ALL_CATS, STAT_CATS, filteredSpend, monthKey, monthLabel, spendData, storeOf } from "../stats/views.js";
import { Store } from "../core/store.js";
import { billInUse, propertyOptionsHtml } from "../core/lifecycle.js";
import { alertText, billAlerts, billCat, propertyName, subscriptionSummary, upcoming } from "../bills/logic.js";

const mny = (v, cur) => (v == null ? "—" : Units.money(num(v), cur || Units.region.currency));
const stamp = () => t("打印于 {d}", { d: fmtDate(todayISO()) });

/** 设置里的“打印”页：每种可打印的内容一行，账单概览可选房产（默认全部房产） */
export function viewPrintSettings() {
  const props = state.properties.filter((p) => !p.archived);
  const propPick = props.length > 1
    ? `<select id="printProp" aria-label="${t("选择房产")}"><option value="all">${t("全部房产")}</option>${propertyOptionsHtml("", { esc })}</select>` : "";
  const row = (kind, title, desc, extra = "") => `<div class="panel"><div class="kv"><div><b>${title}</b><div class="muted">${desc}</div></div>
      <div class="head-acts">${extra}<button type="button" class="btn btn-sm btn-primary" data-action="print-run" data-kind="${kind}">${t("打印")}</button></div></div></div>`;
  return `<p class="muted" style="margin:0 0 10px;font-size:13px">${t("选一项打印；浏览器的打印窗口里也可以另存为 PDF。")}</p>
    ${row("shopping", t("采购清单"), t("待购买和家人认领中的项目，带勾选框，逛店时可以直接划"))}
    ${row("spend", t("花费统计"), t("按月合计、按分类占比和花费明细；可选近几个月"), `<select id="printRange" aria-label="${t("时间范围")}">${[3, 6, 12].map((n) => `<option value="${n}" ${n === state.stats.months ? "selected" : ""}>${t("近 {n} 个月", { n })}</option>`).join("")}<option value="${new Date().getMonth() + 1}">${t("今年以来")}</option></select>`)}
    ${state.billsEnabled && budgetPlan() ? row("budget", t("预算"), t("本月各类预算和实际，以及年度进度")) : ""}
    ${state.billsEnabled ? row("bills", t("账单概览"), t("未来 30 天要交的账单、要处理的账单和每月固定支出"), propPick) : ""}`;
}

function shoppingSheet() {
  const open = state.shopping.filter((s) => s.status !== "bought");
  const rows = open.map((s) => `<tr><td class="box">☐</td><td>${esc(s.name)}</td><td>${esc(`${num(s.quantity, 1)} ${s.unit || ""}`.trim())}</td>
      <td>${s.status === "claimed" ? esc(t("{who} 正在买", { who: s.claimed_by_name || t("家人") })) : ""}</td></tr>`).join("");
  return `<h1>${t("采购清单")}</h1><p class="ps-meta">${esc(stamp())} · ${t("{n} 项待买", { n: open.length })}</p>
    ${open.length ? `<table><thead><tr><th></th><th>${t("名称")}</th><th>${t("数量")}</th><th>${t("备注")}</th></tr></thead><tbody>${rows}</tbody></table>` : `<p>${t("清单是空的")}</p>`}`;
}

function billsSheet(prop) {
  const scoped = prop !== "all" && state.properties.some((p) => p.id === prop);
  const list = state.billsEnriched.filter((b) => b.active && (scoped ? b.property_id === prop : billInUse(b)));
  const cur = Units.region.currency;
  const inCur = list.filter((b) => (b.currency || cur) === cur);
  const monthly = inCur.reduce((s, b) => s + b.monthly, 0);
  const next30 = upcoming(list, 30);
  const due30 = next30.filter((x) => (x.bill.currency || cur) === cur).reduce((s, x) => s + num(x.bill.est), 0);
  const subs = subscriptionSummary(list);
  const alerts = billAlerts(list);
  const where = (b) => (state.properties.length > 1 && b.property_id ? `${esc(propertyName(b.property_id))} · ` : "");
  const kpi = (label, val) => `<div><span>${label}</span><b>${val}</b></div>`;
  return `<h1>${t("账单概览")}${scoped ? ` · ${esc(propertyName(prop))}` : ` · ${t("全部房产")}`}</h1><p class="ps-meta">${esc(stamp())}</p>
    <div class="ps-kpis">${kpi(t("未来 30 天要交"), `${money(due30)} · ${t("{n} 笔", { n: next30.length })}`)}${kpi(t("每月固定支出"), money(monthly))}${subs.count ? kpi(t("订阅与会员"), `${money(subs.monthly)}/${t("月")}`) : ""}</div>
    <h2>${t("要处理的账单")}</h2>
    ${alerts.length ? `<table><thead><tr><th>${t("账单")}</th><th>${t("状态")}</th><th>${t("金额")}</th></tr></thead><tbody>${alerts.map((b) => `<tr><td>${where(b)}${billCat(b.category).icon} ${esc(b.name)}</td><td>${esc(alertText(b))}</td><td>${mny(b.est, b.currency)}</td></tr>`).join("")}</tbody></table>` : `<p>${t("最近没有要处理的账单")}</p>`}
    <h2>${t("未来 30 天")}</h2>
    ${next30.length ? `<table><thead><tr><th>${t("到期日")}</th><th>${t("账单")}</th><th>${t("缴费方式")}</th><th>${t("金额")}</th></tr></thead><tbody>${next30.map(({ bill: b, due }) => `<tr><td>${esc(fmtShort(`${due}T12:00:00`))}</td><td>${where(b)}${billCat(b.category).icon} ${esc(b.name)}${b.assigned_to ? ` · ${esc(memberName(b.assigned_to) || "")}` : ""}</td><td>${b.autopay ? t("自动扣款") : esc(t(window.BILLS.CHANNELS[b.pay_channel] || ""))}</td><td>${mny(b.est, b.currency)}</td></tr>`).join("")}</tbody></table>` : `<p>${t("30 天内没有到期的账单")}</p>`}`;
}

function spendSheet({ months: n = 6, useFilter = false } = {}) {
  const sd = spendData(n), cur = Units.region.currency, set = new Set(sd.months);
  const all = state.purchases.filter((p) => set.has(monthKey(p.purchased_at)) && p.amount != null && (!p.currency || p.currency === cur));
  const total = sd.totals.reduce((a, b) => a + b, 0), count = sd.months.reduce((a, m) => a + sd.counts[m], 0);
  const byCat = STAT_CATS().map((c) => ({ c, v: sd.months.reduce((s, m) => s + (sd.byMC[m][c.id] || 0), 0) })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
  const recs = (useFilter ? filteredSpend() : [...state.purchases].sort((a, b) => new Date(b.purchased_at) - new Date(a.purchased_at))).filter((p) => set.has(monthKey(p.purchased_at))).slice(0, 300);
  const f = state.spendFilter, filterNote = useFilter && (f.q || f.cat !== "all" || f.store !== "all" || f.stores?.length || f.month !== "all" || f.months?.length) ? ` · ${t("已按筛选条件")}` : "";
  const kpi = (label, val) => `<div><span>${label}</span><b>${val}</b></div>`;
  return `<h1>${t("花费统计")} · ${t("近 {n} 个月", { n: sd.months.length })}</h1><p class="ps-meta">${esc(stamp())}${esc(filterNote)}</p>
    <div class="ps-kpis">${kpi(t("合计"), money(total))}${kpi(t("月均"), money(total / (sd.months.length || 1)))}${kpi(t("笔数"), count)}</div>
    <h2>${t("按月")}</h2><table><thead><tr><th>${t("月份")}</th><th>${t("笔数")}</th><th>${t("合计")}</th></tr></thead><tbody>${sd.months.map((m, i) => `<tr><td>${esc(monthLabel(m))}</td><td>${sd.counts[m]}</td><td>${money(sd.totals[i])}</td></tr>`).join("")}</tbody></table>
    <h2>${t("按分类")}</h2><table><thead><tr><th>${t("分类")}</th><th>${t("占比")}</th><th>${t("合计")}</th></tr></thead><tbody>${byCat.map((x) => `<tr><td>${x.c.icon} ${esc(t(x.c.name))}</td><td>${total ? Math.round((x.v / total) * 100) : 0}%</td><td>${money(x.v)}</td></tr>`).join("")}</tbody></table>
    <h2>${t("花费明细")}（${recs.length}${all.length > recs.length && !useFilter ? ` / ${all.length}` : ""}）</h2>
    <table><thead><tr><th>${t("日期")}</th><th>${t("名称")}</th><th>${t("分类")}</th><th>${t("商店 / 收款方")}</th><th>${t("金额")}</th></tr></thead><tbody>${recs.map((p) => `<tr><td>${esc(fmtDate(String(p.purchased_at).slice(0, 10)))}</td><td>${esc(p.name)}</td><td>${esc(t((ALL_CATS().find((c) => c.id === p.category) || { name: "其他" }).name))}</td><td>${esc(storeOf(p))}</td><td>${p.amount != null ? mny(p.amount, p.currency) : ""}</td></tr>`).join("")}</tbody></table>`;
}

function budgetSheet() {
  const plan = budgetPlan(), mp = monthProgress(plan);
  if (!plan) return `<h1>${t("预算")}</h1><p>${t("还没有设置收入")}</p>`;
  const rows = [{ icon: "🧾", name: "账单", spent: mp.bills, budget: plan.billsM }, ...mp.rows.map((r) => ({ icon: r.icon, name: r.name, spent: r.spent, budget: r.budget }))];
  const kpi = (label, val) => `<div><span>${label}</span><b>${val}</b></div>`;
  return `<h1>${t("预算")} · ${esc(monthLabel(mp.month))}</h1><p class="ps-meta">${esc(stamp())}</p>
    <div class="ps-kpis">${plan.income != null ? kpi(t("月收入"), money(plan.income)) : ""}${kpi(t("固定账单"), money(plan.billsM))}${plan.savings != null ? kpi(t("计划储蓄"), money(plan.savings)) : ""}${kpi(t("每月可支配"), money(plan.pool))}</div>
    <h2>${t("本月预算 vs 实际")}</h2><table><thead><tr><th>${t("分类")}</th><th>${t("预算")}</th><th>${t("实际")}</th><th>${t("占比")}</th><th>${t("剩余")}</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${r.icon} ${esc(t(r.name))}</td><td>${money(r.budget)}</td><td>${money(r.spent)}</td><td>${r.budget > 0 ? Math.round((r.spent / r.budget) * 100) : 0}%</td><td>${money(r.budget - r.spent)}</td></tr>`).join("")}</tbody></table>
    <h2>${t("年度预算")}</h2><p>${plan.income != null ? t("月预算合计 {m} × 12 = {y}；年收入 {i}，计划储蓄 {s}。", { m: money(plan.totalBudget), y: money(plan.totalBudget * 12), i: money(plan.income * 12), s: money(plan.savings * 12) }) : t("月预算合计 {m} × 12 = {y}。", { m: money(plan.totalBudget), y: money(plan.totalBudget * 12) })}</p>`;
}

/** 生成打印内容并调出浏览器打印；打印结束后清掉 */
export async function printSheet(kind, arg = "all") {
  if (kind === "spend" && !state.purchases.length) { try { state.purchases = await Store.listPurchases(); } catch { /* 用已有的 */ } }   // 采购花费是后台读的，打印前确保读到了
  const html = kind === "shopping" ? shoppingSheet() : kind === "spend" ? spendSheet(arg) : kind === "budget" ? budgetSheet() : billsSheet(arg);
  let host = $("#printSheet");
  if (!host) { host = document.createElement("div"); host.id = "printSheet"; document.body.appendChild(host); }
  host.innerHTML = html;
  document.body.classList.add("print-sheet");
  const done = () => { document.body.classList.remove("print-sheet"); host.innerHTML = ""; window.removeEventListener("afterprint", done); };
  window.addEventListener("afterprint", done);
  window.print();
}
