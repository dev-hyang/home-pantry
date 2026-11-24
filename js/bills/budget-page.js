/* 预算页面。 */
import { numAttrs } from "../core/ui-num.js";
import { BILLS_GROUP, DRILL_HINT, MEDICAL_BUDGET_GROUP, actualByMonth, bigThreshold, budgetGroups, cur, extras, medInPool, meta, pct } from "./budget-groups.js";
import { BUDGET_TABS, activeTab } from "../core/tabs.js";
import { attentionPanel } from "../core/alerts.js";
import { budgetPlan, incomeBanner, isHouseholdOwner, monthProgress, myId, totalIncomeMonthly } from "./budget-income.js";
import { esc, money } from "../core/util.js";
import { fmtDate, saleEvents, sitesHtml } from "./budget-shopping.js";
import { href } from "../core/router.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";
import { perWord, rangeMonths, trendHead, trendPeriods } from "../stats/spend-roll.js";
import { dq, hitAttrs } from "../stats/spend-drill.js";
import { timeBarHtml } from "../stats/add-lite.js";
import { pageHead } from "../core/page-head.js";

/* ───────────── 页面 ───────────── */
const bar = (spent, budget, pace) => {
  const p = pct(spent, budget), cls = p >= 100 ? "over" : p >= 85 ? "warn" : "";
  return `<div class="bud-bar ${cls}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(100, p)}"><i style="width:${Math.min(100, p)}%"></i>${pace != null ? `<u style="left:${Math.round(pace * 100)}%" title="${t("本月已过去的比例")}"></u>` : ""}</div>`;
};
// 每一行预算都能点：看这一类这个月 / 今年的花费明细（drill 是查询串，由页面的全局点击处理跳转）
const row = (g, spent, budget, pace, extra = "", drill = "") => `<div class="bud-row${drill ? " ch-hit-row" : ""}"${hitAttrs(drill, `${t(g.name)}：${money(spent)}，${t("查看明细")}`)}><div class="bud-head"><b>${g.icon} ${esc(t(g.name))}</b><span>${money(spent)} / ${money(budget)} · ${pct(spent, budget)}%</span></div>${bar(spent, budget, pace)}
  <small class="${spent > budget ? "down" : "muted"}">${spent > budget ? t("超出 {a}", { a: money(spent - budget) }) : t("还剩 {a}", { a: money(budget - spent) })}${extra}</small></div>`;
const budgetHref = (id) => `${href("bills", "budget")}${id === "month" ? "" : `?tab=${id}`}`;
export function viewBudget() {
  const plan = budgetPlan(), b = state.budget || {};
  const owner = isHouseholdOwner(), mine = state.incomes.find((i) => i.user_id === myId()), settingsHref = `${href("bills", "income")}?tab=plan`;
  if (!plan) {
    const body = owner
      ? (totalIncomeMonthly() > 0
        ? `<div class="panel cta-panel"><div><b>${t("收入已经设置了，还没有预算")}</b><p class="muted">${t("按全家收入、固定账单和储蓄比例生成第一版。")}</p></div><button type="button" class="btn btn-primary" data-action="budget-generate">${t("生成预算")}</button></div>`
        : `<div class="panel cta-panel"><div><b>${t("还没有预算：先设置收入")}</b><p class="muted">${t("在 财务 → 收入 → 预算与计划 填你的收入（每个人只能看到自己的），预算会自动生成。")}</p></div><a class="btn btn-primary" href="${settingsHref}">${t("去设置收入")}</a></div>`)
      : `<div class="panel cta-panel"><div><b>${mine ? t("家主还没有生成预算") : t("还没有预算")}</b><p class="muted">${mine ? t("你的收入已经填好了，等家主生成预算就能在这里看到。") : t("先在 财务 → 收入 → 预算与计划 填你自己的收入；预算由家主按全家收入生成。")}</p></div>${mine ? "" : `<a class="btn btn-primary" href="${settingsHref}">${t("去设置收入")}</a>`}</div>`;
    return `<section class="section"><div class="section-head"><h2>${t("预算")}</h2></div>${body}
      <p class="muted">${t("预算 = 全家收入 − 固定账单 − 储蓄，剩下的“可支配额”按过去的花费比例分给各类；超了会在首页提醒。")}</p></section>`;
  }

  const mp = monthProgress(plan), cm = mp.month;
  const months = rangeMonths(state.stats.months === "m" ? 3 : state.stats.months), abm = actualByMonth();
  const ser = [BILLS_GROUP, ...budgetGroups(), ...(medInPool() ? [] : [MEDICAL_BUDGET_GROUP])];   // 实际花费：医疗不管计不计入预算都算在里面
  const totals = months.map((m) => ser.reduce((s, g) => s + (abm[m]?.[g.id] || 0), 0));
  // 统一的周期（js/core/time-range.js）：范围长了按季 / 按年；预算、收入按月 × 这一期的月数
  const TP = trendPeriods(months, { u: "auto" }), per = (v) => TP.agg(months.map(() => v));
  const stacked = Charts.bars({ title: `${t("花费构成（账单 vs 其他）")} · ${TP.title}`, labels: TP.labels, fmt: money, partial: TP.partial,
    series: [{ name: t("账单"), color: BILLS_GROUP.color, values: TP.agg(months.map((m) => abm[m]?.bills || 0)) },
      { name: t("其他花费"), color: "#d4694c", values: TP.agg(months.map((m) => ser.slice(1).reduce((s, g) => s + (abm[m]?.[g.id] || 0), 0))) }],
    drill: (k, i) => dq({ grp: k === 0 ? "bills" : "!bills", ...TP.when(i) }), legendDrill: (k) => dq({ grp: k === 0 ? "bills" : "!bills", range: months.length }) });
  const vs = Charts.line({ title: `${t("实际花费 vs 预算 vs 收入")} · ${TP.title}`, labels: TP.labels, fmt: money, partial: TP.partial,
    barDrill: (i) => dq(TP.when(i)),
    barSeries: { name: t("实际花费"), color: "#d4694c", values: TP.agg(totals) },
    series: [{ name: t("预算合计"), color: "var(--pine)", values: per(plan.totalBudget) }, ...(plan.income != null ? [{ name: TP.unit === "month" ? t("月收入") : t("收入（按月 × 月数）"), color: "var(--ink)", values: per(plan.income) }] : [])] });

  // 年度：今年已过的月份 × 月预算
  const now = new Date(), yr = now.getFullYear(), elapsed = now.getMonth() + (now.getDate() / new Date(yr, now.getMonth() + 1, 0).getDate());
  const ytd = (g) => Object.entries(abm).filter(([m]) => m.startsWith(`${yr}-`)).reduce((s, [, v]) => s + (v[g] || 0), 0);
  const yrRows = [{ ...BILLS_GROUP, budget: plan.billsM }, ...plan.groups].map((g) => ({ g, spent: ytd(g.id), budget: g.budget * 12, proj: elapsed > 0.3 ? (ytd(g.id) / elapsed) * 12 : null }));
  const yrSpent = yrRows.reduce((s, r) => s + r.spent, 0), yrBudget = plan.totalBudget * 12, yrProj = elapsed > 0.3 ? (yrSpent / elapsed) * 12 : null;
  const events = saleEvents(new Date(), 6), ctx = { plan, mp };
  const efLow = Math.round(plan.essentialM * 3), efHigh = Math.round(plan.essentialM * 6);

  const tab = activeTab(state.route) || "month";
  const empty = (msg) => `<div class="panel empty"><strong>${msg}</strong></div>`;
  const tabs = {
    // 本月：收入与预算概况、本月进度、上个月复盘
    month: () => `<section class="section">
      ${incomeBanner()}
      <div class="kpis">
        ${plan.income != null ? `<div class="kpi"><span>${t("月收入（全家）")}</span><b>${money(plan.income)}</b><small>${t("年收入 {a}", { a: money(plan.income * 12) })}</small></div>` : ""}
        <div class="kpi"><span>${t("固定账单")}</span><b>${money(plan.billsM)}</b><small>${plan.income != null ? `${t("占收入 {p}%", { p: pct(plan.billsM, plan.income) })} · ` : ""}${t("必要 {a}", { a: money(plan.essentialM) })}</small></div>
        ${plan.savings != null ? `<div class="kpi"><span>${t("计划储蓄")}</span><b>${money(plan.savings)}</b><small>${plan.savingsPct}%</small></div>` : ""}
        <div class="kpi"><span>${t("每月可支配")}</span><b>${money(plan.pool)}</b><small>${plan.hasHistory ? t("按过去 6 个月花费比例分配") : t("还没有历史花费，先按常见比例分配")}</small></div>
      </div>
      ${plan.income != null && plan.pool <= 0 ? `<p class="form-error">${t("固定账单和储蓄已经用完了收入，没有可支配额：先看看账单能不能压缩，或降低储蓄比例。")}</p>` : ""}
    </section>
    ${attentionPanel(["budget"], { title: t("要处理") })}
    <section class="section">
      <div class="section-head"><h2>${t("本月预算")}</h2><p>${t("竖线是本月已过去的进度；条越过竖线说明花得比时间快")}</p></div>
      <div class="panel">
        ${row(BILLS_GROUP, mp.bills, plan.billsM, mp.pace, "", dq({ grp: "bills", month: cm }))}
        ${mp.rows.map((r) => row(r, r.spent, r.budget, mp.pace, "", dq({ grp: r.id, month: cm }))).join("")}
        <div class="bud-total">${row({ icon: "💰", name: "可支配花费合计" }, mp.spent, mp.variable, mp.pace, "", dq({ grp: "!bills", month: cm }))}</div>
        ${!medInPool() && mp.medical > 0 ? `<div class="bud-row ch-hit-row"${hitAttrs(dq({ grp: "medical", month: cm }), t("医疗"))}><div class="bud-head"><b>🏥 ${t("医疗")}</b><span>${t("已付 {a}", { a: money(mp.medical) })}</span></div><small class="muted">${t("不计入可支配预算；在 财务 → 收入 → 预算与计划 里可以改成计入")}</small></div>` : ""}
        ${DRILL_HINT()}
      </div>
    </section>
    ${extras("month", ctx)}`,
    // 账单：固定账单排行、订阅年成本、现金流
    bills: () => extras("bills", ctx) || empty(t("还没有固定账单")),
    // 规划：各类月预算、补货预估、大件基金、大额购物规划、应急金
    plan: () => `
    <section class="section">
      <div class="section-head"><h2>${t("各类月预算")}</h2><p>${t("可以改，留空 = 用建议值")}</p></div>
      <form id="budgetCatsForm" class="panel">
        <div class="form-grid">${plan.groups.map((g) => `<label>${g.icon} ${esc(t(g.name))}（${t("建议 {a}", { a: money(g.suggested) })}${g.fromFund ? t("，按设备寿命") : ""}）<input name="cat_${g.id}" ${numAttrs("money", { step: 1 })} value="${g.custom ? esc(g.budget) : ""}" placeholder="${g.suggested}" ${plan.owner ? "" : "disabled"}></label>`).join("")}</div>
        <label style="display:block;margin-top:10px;font-size:13px;font-weight:700">${t("“大额”提醒门槛（{cur}，记一笔达到它时问要不要标成资本性支出）", { cur: cur() })}<input name="big_threshold" ${numAttrs("int", { min: 1 })} value="${meta("_big_threshold", "") || ""}" placeholder="${bigThreshold()}" style="max-width:160px;display:block;margin-top:4px" ${plan.owner ? "" : "disabled"}></label>
        <p class="${plan.left != null && plan.left < -1 ? "form-error" : "muted"}" style="margin:8px 0 0;font-size:13px">${!plan.owner ? t("只有家主能调整预算比例和各类金额。") : plan.left < -1 ? t("各类预算加起来超出可支配额 {a}，实际会吃掉储蓄。", { a: money(-plan.left) }) : t("账单、各类预算和储蓄加起来还剩 {a} 没分配。", { a: money(Math.max(0, plan.left)) })}</p>
        ${plan.owner ? `<div class="form-actions"><button type="submit" class="btn btn-primary btn-sm">${t("保存预算")}</button><button type="button" class="btn btn-sm btn-ghost" data-action="budget-reset">${t("恢复建议值")}</button><a class="btn btn-sm btn-ghost" href="${settingsHref}">${t("调整收入和比例")}</a></div>` : ""}</form>
    </section>
    ${extras("plan", ctx)}
    <section class="section">
      <div class="section-head"><h2>${t("大额购物规划")}</h2><p>${t("想买一件贵的东西：看预算够不够，要不要分期，或者每月预存等促销日")}</p></div>
      <form id="planForm" class="panel">
        <div class="form-grid">
          <label>${t("想买什么（可不填）")}<input name="name" maxlength="60" placeholder="${t("例如：洗碗机、沙发")}"></label>
          <label>${t("价格（{cur}）", { cur: cur() })}<input name="price" ${numAttrs("money", { min: 1, step: 1 })} required></label>
          <label>${t("算进哪一类")}<select name="group">${plan.groups.map((g) => `<option value="${g.id}" ${g.id === "home_maint" ? "selected" : ""}>${g.icon} ${esc(t(g.name))}</option>`).join("")}</select></label>
          <label>${t("打算在什么时候买")}<select name="event"><option value="">${t("尽快")}</option>${events.map((e, i) => `<option value="${i}">${esc(t(e.name))} · ${esc(fmtDate(e.date))}${e.approx ? t("（约）") : ""}</option>`).join("")}</select></label>
        </div>
        <div class="form-actions"><button type="submit" class="btn btn-primary btn-sm">${t("帮我规划")}</button></div>
        <div id="planOut" aria-live="polite"></div></form>
      <div class="panel"><h3 style="font-size:15px;margin:0 0 6px">${t("省钱渠道")}</h3>${sitesHtml()}</div>
    </section>
    <section class="section">
      <div class="section-head"><h2>${t("应急金")}</h2></div>
      <div class="panel"><p style="margin:0">${plan.essentialM > 0 ? t("按必要账单每月 {m} 算，建议备 3–6 个月的应急金：{a} – {b}。", { m: money(plan.essentialM), a: money(efLow), b: money(efHigh) }) : t("在账单里把必要的项目标成“必要支出”，这里就能算建议的应急金（3–6 个月）。")}</p>
        <p class="muted" style="margin:6px 0 0;font-size:13px">${t("应急金不放在可支配额里，也不要拿去买大件。")}</p></div>
    </section>`,
    // 趋势：预算 vs 实际、年度预算
    trend: () => `
    <section class="section">
      <div class="section-head"><h2>${t("预算 vs 实际")}</h2></div>
      <div class="panel chart-panel">${trendHead(t("账单和实际花费的关系"), TP, { unit: false })}<p class="muted" style="margin:0 0 6px;font-size:13px">${t("按缴费日记账；年付账单缴费的那个月会特别高，看年度更准。")}</p>${stacked}</div>
      <div class="panel chart-panel"><h3>${TP.unit === "month" ? t("每月：实际 vs 预算 vs 收入") : t("{p}：实际 vs 预算 vs 收入", { p: perWord(TP.unit) })}</h3>${vs}</div>
    </section>
    <section class="section">
      <div class="section-head"><h2>${t("{y} 年度预算", { y: yr })}</h2><p>${t("预算 = 月预算 × 12；预计全年按今年已花的速度推算")}</p></div>
      <div class="panel">
        ${yrRows.map((r) => row(r.g, r.spent, r.budget, elapsed / 12, r.proj != null ? ` · ${t("预计全年 {a}", { a: money(r.proj) })}` : "", dq({ grp: r.g.id, year: yr }))).join("")}
        <div class="bud-total">${row({ icon: "📅", name: "年度合计" }, yrSpent, yrBudget, elapsed / 12, yrProj != null ? ` · ${t("预计全年 {a}", { a: money(yrProj) })}` : "", dq({ year: yr }))}</div>
        ${plan.income != null ? `<p class="muted" style="margin:8px 0 0;font-size:13px">${t("年收入 {i}，计划储蓄 {s}；预计全年花费 {p} 时，结余约 {r}。", { i: money(plan.income * 12), s: money(plan.savings * 12), p: yrProj != null ? money(yrProj) : "—", r: yrProj != null ? money(plan.income * 12 - yrProj) : "—" })}</p>` : ""}
      </div>
    </section>`,
    // 目标：储蓄目标、家庭分摊（在 财务 → 收入 → 预算与计划 里启用）
    goals: () => extras("goals", ctx) || empty(t("还没有内容")),
  };
  return `
    <section class="section">
      ${pageHead({ title: t("预算"), tabs: BUDGET_TABS, tab, hrefOf: budgetHref, label: t("预算内容"), filter: tab === "trend" ? timeBarHtml(null) : "", menu: [{ label: t("打印"), icon: "🖨️", action: "print-run", data: { kind: "budget" } }] })}
    </section>
    ${tabs[tab]()}`;
}
