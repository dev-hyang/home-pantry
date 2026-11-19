/* 收入的导出（CSV：收入 / 花费 / 合并）、打印，和 AI 分析（只发汇总，付款方 / 成员默认打码）。 */
import { CHANNELS, UNITS, bucketKey, groupOf, groupSum, inc, incSumOf, kindLabel, loadIncome, openRepayments, personName, recognized, repayState, skey, spanWindow, statKinds, sumOf } from "./logic.js";
import { R, controlsHtml, sMainKind } from "./senders-tab.js";
import { STAT_CATS, download, toCsv } from "../stats/views.js";
import { addDay, iso, rerender } from "./rollup.js";
import { aiReady, askText } from "../core/ai.js";
import { cashflow } from "./compare-tab.js";
import { esc, fmtDate, num, toast } from "../core/util.js";
import { incList } from "./list.js";
import { incomePanel } from "../settings/income.js";
import { lang, t } from "../core/i18n.js";
import { monthlyOf, totalIncomeMonthly } from "../bills/budget.js";
import { printHtml, printStamp } from "../settings/print.js";
import { senderLabel } from "./overview-tab.js";
import { splitRecord } from "../core/income-taxonomy.js";
import { state } from "../core/state.js";
import { R2, acctShow, cur, empty, fmtMoney, kpi, rate, rollAsync, selOpts } from "./shared.js";

/* ───────────── 导出打印：CSV（收入 / 花费 / 合并）+ 打印 ───────────── */
export function exportTab() {
  const I = inc(), r = R({ exp: true });
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
export async function printIncome(mode) {
  const hh = state.household?.name || t("家庭"), kpiH = (label, val) => `<div><span>${esc(label)}</span><b>${val}</b></div>`;
  let html;
  if (mode === "list") {
    let recs; try { recs = await incList.fetchAll(300); } catch (e) { return toast(t("读取列表失败：{msg}", { msg: e.message })); }   // 明细是服务器分页：按筛选读前 300 笔
    const st = incList.stats || {}, n = st.n ?? recs.length;
    html = `<h1>${esc(hh)} · ${t("收入明细")}</h1><p class="ps-meta">${esc(printStamp())}</p>
      <div class="ps-kpis">${kpiH(t("笔数"), n)}${kpiH(t("到账合计"), fmtMoney(st.sum != null ? num(st.sum) : sumOf(recs)))}${kpiH(t("认定收入"), fmtMoney(st.income_sum != null ? num(st.income_sum) : incSumOf(recs)))}</div>
      <table><thead><tr><th>${t("到账日期")}</th><th>${t("付款方")}</th><th>${t("类型")}</th><th>${t("成员")}</th><th>${t("金额")}</th><th>${t("认定收入")}</th></tr></thead><tbody>${recs.map((r) => `<tr><td>${esc(fmtDate(r.received_on))}</td><td>${esc(r.source_name)}</td><td>${esc(kindLabel(r.kind))}</td><td>${esc(personName(r.person_id))}</td><td>${fmtMoney(r.amount)}</td><td>${fmtMoney(recognized(r))}</td></tr>`).join("")}</tbody></table>${n > recs.length ? `<p class="ps-meta">${t("只打印前 300 笔")}</p>` : ""}`;
  } else {
    const r = R({ exp: true }), cf = await cashflowReady(r), top = groupSum(cf.rows, (x) => skey(x.source_name)).filter((x) => x.total > 0).slice(0, 15);
    const kinds = statKinds(inc().merge).filter((k) => cf.byKind[k.id]).sort((a, b) => cf.byKind[b.id] - cf.byKind[a.id]);
    html = `<h1>${esc(hh)} · ${t("收入报表")}</h1><p class="ps-meta">${cf.w.from} → ${cf.w.to} · ${esc(printStamp())}</p>
      <div class="ps-kpis">${kpiH(t("收入（认定）"), fmtMoney(cf.tot.income))}${cf.hasSpend ? kpiH(t("消费（含住房）"), fmtMoney(cf.tot.spend)) + kpiH(t("净现金流（账面）"), fmtMoney(cf.tot.net)) + kpiH(t("储蓄率"), rate(cf.tot.saved, cf.tot.income)) : ""}${cf.tot.capIn ? kpiH(t("资本流入（不计收入）"), fmtMoney(cf.tot.capIn)) : ""}${kpiH(t("笔数"), cf.rows.length)}</div>
      <h2>${t("按{u}", { u: t((UNITS.find((u) => u[0] === r.unit) || [])[1]) })}</h2><table><thead><tr><th>${t("周期")}</th><th>${t("收入")}</th>${cf.hasSpend ? `<th>${t("消费")}</th><th>${t("净现金流（账面）")}</th>` : ""}</tr></thead><tbody>${cf.lines.map((l) => `<tr><td>${esc(l.label)}</td><td>${fmtMoney(l.income)}</td>${cf.hasSpend ? `<td>${fmtMoney(l.spend)}</td><td>${fmtMoney(l.net)}</td>` : ""}</tr>`).join("")}</tbody></table>
      <h2>${t("按类型")}</h2><table><thead><tr><th>${t("类型")}</th><th>${t("占比")}</th><th>${t("合计")}</th></tr></thead><tbody>${kinds.map((k) => `<tr><td>${k.icon} ${esc(kindLabel(k.id))}</td><td>${rate(cf.byKind[k.id], cf.tot.income)}</td><td>${fmtMoney(cf.byKind[k.id])}</td></tr>`).join("")}</tbody></table>
      <h2>${t("主要付款方")}</h2><table><thead><tr><th>${t("付款方")}</th><th>${t("次数")}</th><th>${t("合计")}</th></tr></thead><tbody>${top.map((x) => `<tr><td>${esc(senderLabel(x))}</td><td>${x.n}</td><td>${fmtMoney(x.total)}</td></tr>`).join("")}</tbody></table>`;
  }
  printHtml(html);
}
export const cfAnchor = () => (state.budget?.cat_budgets?._income_cfg?.anchor) || "2024-01-01";
export const kpiRow = (cf) => `${noSpendNote(cf.noSpend)}<div class="kpis">${kpi(t("收入（认定）"), fmtMoney(cf.tot.income), `${cf.w.from} → ${cf.w.to}`)}${cf.hasSpend ? kpi(t("消费（含住房）"), fmtMoney(cf.tot.spend)) : ""}${cf.hasSpend ? kpi(t("其他流出"), fmtMoney(cf.tot.other), t("税、保险、利息、奉献、资本性支出")) : ""}${cf.hasSpend ? kpi(t("净现金流（账面）"), `<span class="${cf.tot.net < 0 ? "down" : ""}">${fmtMoney(cf.tot.net)}</span>`, t("全部流入 − 全部流出 · 收入结余 {a} · 储蓄率 {r}", { a: fmtMoney(cf.tot.incNet, true), r: rate(cf.tot.saved, cf.tot.income) })) : ""}${cf.hasSpend ? kpi(t("投资率"), rate(cf.tot.invest, cf.tot.income), t("投资 {a}", { a: fmtMoney(cf.tot.invest, true) })) : ""}${cf.tot.capIn ? kpi(t("资本流入"), fmtMoney(cf.tot.capIn), t("不计收入，算进账面净现金流")) : ""}</div>`;
/** 有收入、却一笔花费都没有的周期：提醒净现金流会偏高（近 3 年 / 5 年常见：早年的对账单没导入） */
const noSpendNote = (list) => (list?.length ? `<div class="notice" role="status" style="margin-bottom:8px"><b>${t("有 {n} 个周期只有收入、没有任何花费记录，那几段的净现金流会偏高：", { n: list.length })}</b> ${esc(list.slice(0, 8).join("、"))}${list.length > 8 ? "…" : ""}<br><small>${t("多半是那段时间的对账单还没导入。去 财务 → 对账单 补上，或把时间范围缩到已经补齐的那段。")}</small></div>` : "");
/* ── 导出 ── */
export async function exportReport() {
  const r = R({ exp: true }), cf = await cashflowReady(r), hh = (state.household?.name || t("家庭")).replace(/[\\/:*?"<>|\s]/g, ""), base = `${hh}-${t("现金流")}-${cf.w.from}_${cf.w.to}`, unitName = t((UNITS.find((u) => u[0] === r.unit) || [])[1]);
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
export function detailRows(list) {
  const rs = (r) => { const s = repayState(r); return s ? (s.status === "paid" ? t("已还清") : t("待还 {a}", { a: s.left })) : ""; };
  return [[t("到账日期"), t("付款方"), t("一级分类"), t("类型"), t("金额"), t("认定收入"), t("资本流入"), t("货币"), t("收款方式"), t("成员"), t("账户"), t("原币种金额"), t("原币种"), t("手续费"), t("还款状态"), t("备注")],
    ...list.map((r) => { const s = splitRecord(r); return [r.received_on, r.source_name, t(groupOf(r.kind).name), kindLabel(r.kind), r.amount, s.income, s.cap, r.currency || "", (CHANNELS.find((c) => c[0] === r.channel) || [])[1] ? t(CHANNELS.find((c) => c[0] === r.channel)[1]) : "", personName(r.person_id), acctShow(r), r.orig_amount ?? "", r.orig_currency || "", r.fee ?? "", rs(r), r.notes || ""]; })];
}
export const fileHead = () => `${(state.household?.name || t("家庭")).replace(/[\\/:*?"<>|\s]/g, "")}-${t("收入")}`;
/* ── AI 分析：只发汇总（周期合计、类型合计、前 10 个付款方），付款方 / 成员默认打码；每次发送前要勾选同意 ── */
const aiConsent = () => { try { return localStorage.getItem("hmh-income-ai-ok") === "1"; } catch { return false; } };
export function aiPanel(cf) {
  const I = inc(), r = R(), key = `${cf.w.from}|${cf.w.to}|${r.unit}|${r.person}`, out = I.ai[key];
  if (!aiReady()) return `<div class="panel"><h3 style="margin:0 0 6px">✨ ${t("AI 分析")}</h3><p class="muted small" style="margin:0">${t("到 设置 → AI 助手 填 key 后，可以让 AI 读这段时间的收入 / 花费汇总，写出趋势、异常和建议。")}</p></div>`;
  return `<div class="panel"><h3 style="margin:0 0 6px">✨ ${t("AI 分析")}</h3>
    <p class="muted small" style="margin:0 0 8px">${t("只发送汇总数字（每个周期的收入 / 花费 / 差额、各类型合计、前 10 个付款方），不发每一笔明细。付款方和成员名字默认换成「付款方 1」「成员 A」。会发给你在设置里选的 AI 服务商。")}</p>
    <label class="check-inline"><input type="checkbox" data-inc-ai="consent" ${aiConsent() ? "checked" : ""}><span>${t("我同意把这段时间的收入 / 花费汇总发给 AI 服务商")}</span></label><br>
    <label class="check-inline"><input type="checkbox" data-inc-ai="unmask" ${r.unmask ? "checked" : ""}><span>${t("不打码，发真实名字")}</span></label>
    <div class="form-actions" style="margin-top:8px"><button type="button" class="btn btn-primary btn-sm" data-inc="ai-run" ${aiConsent() && !I.aiBusy ? "" : "disabled"}>${I.aiBusy ? t("分析中…") : out ? t("重新分析") : t("分析这段时间")}</button></div>
    ${out ? `<div class="ai-out" style="margin-top:10px;white-space:pre-wrap">${esc(out)}</div><p class="muted small" style="margin:6px 0 0">${t("AI 的分析仅供参考，不是理财建议。")}</p>` : ""}</div>`;
}
export async function runAi() {
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
/** 最近 n 个整月（不含本月）的窗口 */
const lastMonthsWin = (n) => { const d = new Date(); return { from: iso(new Date(d.getFullYear(), d.getMonth() - n, 1)), to: iso(new Date(d.getFullYear(), d.getMonth(), 0)) }; };
function compareHtml() {
  const I = inc(), n = [3, 6, 12].includes(+I.planWin) ? +I.planWin : 6, w = lastMonthsWin(n);
  // 实际月均：认定收入（借款 / 需要还的赠与、资本流入不算；卖出只算已实现收益）
  const rows = I.rec.filter((r) => r.received_on >= w.from && r.received_on <= w.to);
  const actualOf = (pid) => R2(incSumOf(rows.filter((r) => (pid === "" ? !r.person_id : r.person_id === pid))) / n);
  const byPerson = new Map();   // 一位家庭成员可以有多台设备：收入计划按人合计
  for (const m of state.members) { const k = m.person_id || `dev:${m.user_id}`; if (!byPerson.has(k)) byPerson.set(k, []); byPerson.get(k).push(m); }
  const lines = [...byPerson.entries()].map(([k, ms]) => { const p = k.startsWith("dev:") ? null : state.people.find((x) => x.id === k), plans = ms.map((m) => state.incomes.find((i) => i.user_id === m.user_id)).filter(Boolean); return { name: p?.name || ms[0].display_name || t("家人"), plan: plans.length ? R2(plans.reduce((a, i) => a + monthlyOf(i), 0)) : null, act: p ? actualOf(p.id) : null }; })
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
export function planTab() { return `${compareHtml()}${incomePanel()}`; }
