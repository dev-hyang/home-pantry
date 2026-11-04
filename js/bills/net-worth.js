/* 财务 → 分析 → 净资产（财务 P3，迁移 059）：KPI、资产 / 负债构成（排行条，不用饼图）、净资产走势（快照）、
 * 财富增长 vs 消费、每处资产的净值、数据新鲜度提示、快照管理。只给有财务权限的人（路由、目录、数据库三层都挡）。
 * 还有两块给别的页面复用：账户的「更新余额」+ 余额历史（资产页、卡与账户）、房产 / 车辆的「更新估值」+ 估值历史（资产页）。
 * 数据全在内存（nw-logic.js），计算在 js/stats/net-worth.js；消费 / 收入用收支总览同一份聚合（spend_rollup / inc_rollup，按月缓存）。
 * 设计见 docs/design-net-worth.md。 */
import { state } from "../core/state.js";
import { Store } from "../core/store.js";
import { esc, fmtDate, num, toast, todayISO, confirmDelete } from "../core/util.js";
import { t } from "../core/i18n.js";
import { href } from "../core/router.js";
import { financeOk } from "../core/finance-access.js";
import { ASSET_BUCKETS, BALANCE_KINDS, LIAB_BUCKETS, growthRows, isLiabilityKind, monthChange, trendPoints } from "../stats/net-worth.js";
import { aggregate, incAggregate } from "../stats/report.js";
import { monthLabel, spendRollupFor } from "../stats/views.js";
import { incRollupFor } from "../income/views.js";
import { STALE_DAYS, balancesOf, deleteBalance, deleteSnapshot, liveNetWorth, rebuildSnapshot, saveBalance, saveMonthSnapshot, saveValuation, thisMonth, valuationsOf, deleteValuation } from "./nw-logic.js";
import { debtHref } from "./debt-logic.js";
import { summaryHref } from "./debt-stats.js";
import { cardHref } from "./cards.js";
import { assetName } from "../house/assets.js";

const cur = () => Units.region.currency;
const mny = (v, c) => (v == null ? "—" : Units.money(v, c || cur()));
const ui = () => { const u = (state.nwUi ||= {}); u.open ||= {}; u.more ||= {}; return u; };   // 折叠开合、历史显示几条
export const NW_HREF = () => href("bills", "networth");
export const BUCKET_NAMES = { cash: "现金与储蓄", investments: "投资账户", retirement: "退休账户", hsa: "HSA", properties: "房产", vehicles: "车辆", other_assets: "其他资产", receivables: "应收（借出未收）",
  mortgage: "房贷（含 HELOC）", auto_loans: "车贷", other_loans: "其他贷款", credit_cards: "信用卡欠款", other_liabilities: "其他负债（亲友借款、透支）" };
const BUCKET_COLORS = { cash: "#2c6a57", investments: "#3b7fc4", retirement: "#24897d", hsa: "#5b8c3a", properties: "#8a6d3b", vehicles: "#64748b", other_assets: "#7c6fb0", receivables: "#3a9bb5",
  mortgage: "#d4694c", auto_loans: "#c2410c", other_loans: "#b45309", credit_cards: "#be123c", other_liabilities: "#9f1239" };
const RANGES = [["12", "近 12 个月"], ["24", "近 24 个月"], ["all", "全部"]];
const propHref = (id) => `${href("house", "pages")}?prop=${encodeURIComponent(id)}`;
const itemHref = (e) => (e.kind === "property" ? propHref(e.item.id) : href("asset", e.item.id));
const itemName = (e) => (e.kind === "property" ? e.item.name : assetName(e.item));
const signed = (v) => (v == null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${mny(Math.abs(v))}`);
const monthsAgo = (m, k) => { let [y, mo] = m.split("-").map(Number); mo -= k; while (mo < 1) { mo += 12; y--; } return `${y}-${String(mo).padStart(2, "0")}`; };

/** 不能用的时候：没执行 059 / 读失败 */
const unavailable = () => `<section class="section"><div class="panel empty"><strong>${t("净资产还不能用")}</strong>${Store.mode === "cloud" ? t("数据库还没升级：请先执行 supabase/migrations/059_net_worth.sql") : esc(state.nwErr || "")}</div></section>`;

/* ───────────── 余额 / 估值：内联表单 + 历史（资产页、卡与账户共用） ───────────── */
const SHOW = 5;
function histList(key, rows, line) {
  const more = ui().more[key] || SHOW, shown = rows.slice(0, more);
  if (!rows.length) return `<p class="muted nw-none">${t("还没有记录")}</p>`;
  return `<ul class="nw-hist-list">${shown.map(line).join("")}</ul>
    ${rows.length > shown.length ? `<button type="button" class="btn btn-sm btn-ghost" data-nw="more" data-key="${esc(key)}">${t("再显示 {n} 条（共 {total} 条）", { n: Math.min(SHOW * 4, rows.length - shown.length), total: rows.length })}</button>` : ""}`;
}
const detailsOpen = (key, dft = false) => (ui().open[key] ?? dft ? "open" : "");
/** 账户的余额：最新余额 + 「更新余额」表单 + 历史（新 → 旧，5 条一页）。信用卡 / 贷款的余额 = 欠款 */
export function balancePanel(c, { open = false } = {}) {
  if (!state.nwOk || !financeOk() || !BALANCE_KINDS.includes(c.kind)) return "";
  const key = `b:${c.id}`, rows = balancesOf(c.id), last = rows[0], liab = isLiabilityKind(c.kind);
  const stale = last && last.as_of < monthsAgoDay(STALE_DAYS);
  const line = (b) => `<li><span>${esc(fmtDate(b.as_of))}</span><b>${mny(b.balance, b.currency)}</b>${b.notes ? `<small class="muted">${esc(b.notes)}</small>` : ""}
      <button type="button" class="btn btn-sm btn-ghost" data-nw="bal-del" data-id="${esc(b.id)}" aria-label="${esc(t("删除 {d} 的余额", { d: fmtDate(b.as_of) }))}">${t("删除")}</button></li>`;
  return `<details class="nw-hist panel" data-nw-key="${esc(key)}" ${detailsOpen(key, open)}>
    <summary><span>${liab ? t("欠款") : t("余额")}：<b>${last ? mny(last.balance, last.currency) : t("未记录")}</b>${last ? ` <small class="muted">${t("截至 {d}", { d: fmtDate(last.as_of) })}</small>` : ""}${stale ? ` <span class="badge b-soon">${t("需要更新")}</span>` : ""}</span><span class="nw-sum-act">${t("更新余额")}</span></summary>
    <form class="nw-form" data-nw-form="bal" data-id="${esc(c.id)}">
      <label>${t("日期")}<input type="date" name="as_of" required value="${todayISO()}" max="${todayISO()}"></label>
      <label>${liab ? t("欠款（{cur}）", { cur: cur() }) : t("余额（{cur}）", { cur: cur() })}<input type="number" name="balance" step="0.01" inputmode="decimal" required ${liab ? 'min="0"' : ""} value="${last ? esc(last.balance) : ""}"></label>
      <label class="nw-note">${t("备注（可选）")}<input name="notes" maxlength="300"></label>
      <button type="submit" class="btn btn-primary btn-sm">${t("保存余额")}</button>
    </form>
    <p class="hint">${liab ? t("信用卡 / 贷款记欠款（正数），算负债。同一天再记一次 = 改那一天。") : t("按对账单或网银填当天余额；同一天再记一次 = 改那一天。透支记负数。")}</p>
    ${histList(key, rows, line)}
  </details>`;
}
const monthsAgoDay = (days) => { const d = new Date(`${todayISO()}T12:00:00`); d.setDate(d.getDate() - days); return d.toISOString().slice(0, 10); };
/** 房产 / 车辆的估值：最新估值（没有时按购入价 / 未估值）+ 「更新估值」表单 + 历史 */
export function valuationPanel(kind, item, { fallback = null } = {}) {
  if (!state.nwOk || !financeOk()) return "";
  const key = `v:${kind}:${item.id}`, rows = valuationsOf(kind, item.id), last = rows[0];
  const SRC = { manual: t("自己估 / 评估"), estimate: t("网站估算") };
  const line = (v) => `<li><span>${esc(fmtDate(v.as_of))}</span><b>${mny(v.value, v.currency)}</b><small class="muted">${esc(SRC[v.source] || "")}${v.notes ? ` · ${esc(v.notes)}` : ""}</small>
      <button type="button" class="btn btn-sm btn-ghost" data-nw="val-del" data-id="${esc(v.id)}" aria-label="${esc(t("删除 {d} 的估值", { d: fmtDate(v.as_of) }))}">${t("删除")}</button></li>`;
  const now = last ? `${mny(last.value, last.currency)} <small class="muted">${t("截至 {d}", { d: fmtDate(last.as_of) })}</small>` : fallback != null ? `${mny(fallback)} <small class="muted">${t("按购入价")}</small>` : t("未估值");
  return `<details class="nw-hist" data-nw-key="${esc(key)}" ${detailsOpen(key)}>
    <summary><span>${t("估值")}：<b>${now}</b></span><span class="nw-sum-act">${t("更新估值")}</span></summary>
    <form class="nw-form" data-nw-form="val" data-kind="${esc(kind)}" data-id="${esc(item.id)}">
      <label>${t("日期")}<input type="date" name="as_of" required value="${todayISO()}" max="${todayISO()}"></label>
      <label>${t("市值（{cur}）", { cur: cur() })}<input type="number" name="value" min="0" step="1" inputmode="decimal" required value="${last ? esc(last.value) : ""}"></label>
      <label>${t("来源")}<select name="source"><option value="manual">${SRC.manual}</option><option value="estimate">${SRC.estimate}</option></select></label>
      <label class="nw-note">${t("备注（可选）")}<input name="notes" maxlength="300" placeholder="${esc(kind === "property" ? t("如 Zillow / 评估报告") : t("如 KBB 私人出售价"))}"></label>
      <button type="submit" class="btn btn-primary btn-sm">${t("保存估值")}</button>
    </form>
    ${histList(key, rows, line)}
  </details>`;
}

/* ───────────── 净资产页 ───────────── */
function freshness(r) {
  const out = [];
  if (r.stale.length) out.push(`<li><span class="badge b-soon">${t("需要更新")}</span> ${t("超过 {n} 天没更新余额：", { n: STALE_DAYS })}${r.stale.map((a) => `<a href="${esc(cardHref(a.card.id))}">${esc(a.card.name)}</a> <small class="muted">(${esc(fmtDate(a.as_of))})</small>`).join("、")}</li>`);
  if (r.missing.length) out.push(`<li>${t("还没记过余额（不算进去）：")}${r.missing.map((a) => `<a href="${esc(cardHref(a.card.id))}">${esc(a.card.name)}</a>`).join("、")}</li>`);
  if (r.byPurchase) out.push(`<li>${t("{n} 处房产没有估值，按购入价算", { n: r.byPurchase })} · <a href="${href("bills", "assets")}">${t("去资产页更新估值")}</a></li>`);
  if (r.unvalued) out.push(`<li>${t("{n} 处资产没有估值（不算进去）", { n: r.unvalued })} · <a href="${href("bills", "assets")}">${t("去资产页更新估值")}</a></li>`);
  if (r.unknownDebts.length) out.push(`<li>${t("这些贷款不知道余额（没填本金或某天的余额），不算进去：")}${r.unknownDebts.map((d) => `<a href="${esc(debtHref(d.id))}">${esc(d.name)}</a>`).join("、")}</li>`);
  if (!state.debtsOk) out.push(`<li>${t("借贷读不到：贷款和应收没算进去")}</li>`);
  return out.length ? `<div class="panel nw-fresh" role="status"><h3>${t("数据新鲜度")}</h3><ul>${out.join("")}</ul></div>` : `<p class="muted nw-fresh-ok">✓ ${t("所有账户 {n} 天内更新过余额", { n: STALE_DAYS })}</p>`;
}
function breakdown(r) {
  const items = (keys, side) => keys.map((k) => ({ name: t(BUCKET_NAMES[k]), color: BUCKET_COLORS[k], value: side[k] })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value);
  const hb = (title, list) => (window.Charts ? window.Charts.hbars({ items: list, fmt: (v) => mny(v), title, empty: t("还没有") }) : "");
  return `<div class="ix-two">
    <div class="panel chart-panel"><div class="chart-head"><h3>${t("资产构成")} <small class="muted">${mny(r.assetsTotal)}</small></h3><a class="btn btn-sm btn-ghost" href="${href("bills", "assets")}">${t("详情")} ›</a></div>${hb(t("资产按分类"), items(ASSET_BUCKETS, r.assets))}</div>
    <div class="panel chart-panel"><div class="chart-head"><h3>${t("负债构成")} <small class="muted">${mny(r.liabilitiesTotal)}</small></h3><a class="btn btn-sm btn-ghost" href="${esc(summaryHref())}">${t("借贷总览")} ›</a></div>${hb(t("负债按分类"), items(LIAB_BUCKETS, r.liabilities))}</div>
  </div>`;
}
function trend(points, range) {
  const pick = range === "all" ? points : points.slice(-Number(range));
  const chips = `<div class="chips" role="group" aria-label="${esc(t("时间范围"))}">${RANGES.map(([k, l]) => `<a class="chip ${k === range ? "on" : ""}" href="${NW_HREF()}?range=${k}" ${k === range ? 'aria-current="true"' : ""}>${t(l)}</a>`).join("")}</div>`;
  const chart = pick.length > 1 && window.Charts ? window.Charts.line({ title: t("净资产走势"), labels: pick.map((p) => monthLabel(p.month)), fmt: (v) => Units.money(v, cur(), true),   // 纵轴用短格式（$520K），长数字会被截掉
    series: [{ name: t("净资产"), color: "#2c6a57", values: pick.map((p) => p.nw) }, { name: t("资产"), color: "#3b7fc4", values: pick.map((p) => p.assets) }, { name: t("负债"), color: "#d4694c", values: pick.map((p) => p.liabilities) }] })
    : `<p class="muted">${t("每月一个快照：再过一个月就能看到走势。也可以在下面「重建过去某月」补上以前的月份。")}</p>`;
  return `<div class="panel chart-panel"><div class="chart-head"><h3>${t("净资产走势")}</h3>${chips}</div>${chart}
    ${pick.some((p) => p.nw < 0) ? `<p class="muted small">${t("有的月份净资产是负数，图上画在 0 以下；准确数字见图下的表。")}</p>` : ""}</div>`;
}
/** 财富增长 vs 消费：近 12 个快照月份的 净资产变化 / 收入 / 消费 / 储蓄 / 其他变化（表格：负数也看得清，读屏按表读） */
function growth(points) {
  const pts = points.slice(-13), months = pts.map((p) => p.month);
  if (pts.length < 2) return "";
  const sr = spendRollupFor(months), ir = incRollupFor(months);
  let flow = {};
  if (sr && ir) {
    const SA = aggregate(sr, months, { cur: cur() }), IA = incAggregate(ir, months, { cur: cur() });
    for (const m of months) flow[m] = { income: IA.income[m] || 0, consumption: (SA.bucket[m]?.living || 0) + (SA.bucket[m]?.housing || 0) };
  }
  const rows = growthRows(pts, flow).slice(1).reverse();
  const td = (v, cls = "") => `<td class="${cls} ${v != null && v < 0 ? "down" : ""}">${v == null ? "—" : signed(v)}</td>`;
  return `<div class="panel"><h3>${t("财富增长 vs 消费")}</h3>
    <p class="muted small">${t("两个问题：家里的钱是在变多吗（净资产变化）？日子过得怎么样（消费）？储蓄 = 收入 − 消费；其他变化 = 净资产变化 − 储蓄（市值涨跌、估值更新、没记账的钱）。")}</p>
    ${sr && ir ? "" : `<p class="muted" role="status">${t("加载中…")}</p>`}
    <div class="ch-scroll" role="region" aria-label="${esc(t("财富增长 vs 消费"))}" tabindex="0"><table class="store-table nw-tbl"><thead><tr><th scope="col">${t("月份")}</th><th scope="col">${t("净资产变化")}</th><th scope="col">${t("收入")}</th><th scope="col">${t("消费")}</th><th scope="col">${t("储蓄额")}</th><th scope="col" class="nw-opt">${t("其他变化")}</th></tr></thead>
    <tbody>${rows.map((x) => `<tr><th scope="row">${esc(monthLabel(x.month))}</th>${td(x.delta)}<td>${x.income == null ? "—" : mny(x.income)}</td><td>${x.consumption == null ? "—" : mny(x.consumption)}</td>${td(x.savings)}${td(x.other, "nw-opt")}</tr>`).join("")}</tbody></table></div>
    <p class="muted small">${t("净资产变化和上个月的快照比；上个月没有快照显示「—」。")}</p></div>`;
}
function equityTable(r) {
  if (!r.equity.length) return "";
  const srcTxt = (e) => (e.source === "purchase" ? `<small class="muted">${t("按购入价")}</small>` : e.source === "valuation" ? `<small class="muted">${esc(fmtDate(e.valueAsOf))}</small>` : `<small class="muted">${t("未估值")}</small>`);
  const loans = (e) => (e.loans.length ? e.loans.map((l) => `<a href="${esc(debtHref(l.debt.id))}">${esc(l.debt.name)}</a> ${mny(l.balance)}`).join("<br>") : `<span class="muted">${t("无")}</span>`);
  return `<div class="panel"><div class="chart-head"><h3>${t("资产净值")}</h3><a class="btn btn-sm btn-ghost" href="${href("bills", "assets")}">${t("更新估值")} ›</a></div>
    <div class="ch-scroll" role="region" aria-label="${esc(t("资产净值"))}" tabindex="0"><table class="store-table nw-tbl"><thead><tr><th scope="col">${t("资产")}</th><th scope="col">${t("市值")}</th><th scope="col">${t("贷款余额")}</th><th scope="col">${t("净值")}</th></tr></thead>
    <tbody>${r.equity.map((e) => `<tr><th scope="row"><a href="${esc(itemHref(e))}">${e.kind === "property" ? "🏠" : e.kind === "vehicle" ? "🚗" : "⚙️"} ${esc(itemName(e))}</a></th>
      <td>${e.value == null ? "—" : mny(e.value, e.currency)}<br>${srcTxt(e)}</td><td>${loans(e)}</td><td><b class="${e.equity != null && e.equity < 0 ? "down" : ""}">${e.equity == null ? "—" : mny(e.equity)}</b></td></tr>`).join("")}</tbody></table></div>
    <p class="muted small">${t("净值 = 市值 − 挂在这处资产上的贷款的未还本金（借贷里按房产 / 车辆关联）。")}</p></div>`;
}
function snapshotsPanel() {
  const list = [...(state.nwSnapshots || [])].sort((a, b) => b.month.localeCompare(a.month)), key = "snaps";
  const SRC = { auto: t("自动"), manual: t("手动") };
  const line = (s) => `<li><span>${esc(monthLabel(s.month))} <small class="muted">${esc(s.month)}</small></span><b>${mny(Number(s.net_worth), s.currency)}</b><small class="muted">${esc(SRC[s.source] || s.source)}${s.meta?.rebuilt ? ` · ${t("重建")}` : ""}${s.currency !== cur() ? ` · ${esc(s.currency)}` : ""}</small>
    <button type="button" class="btn btn-sm btn-ghost" data-nw="snap-del" data-id="${esc(s.id)}" aria-label="${esc(t("删除 {m} 的快照", { m: s.month }))}">${t("删除")}</button></li>`;
  return `<details class="nw-hist panel" data-nw-key="snaps" ${detailsOpen(key)}>
    <summary><span>${t("每月快照")}（${list.length}）</span><span class="nw-sum-act">${t("管理")}</span></summary>
    <p class="hint">${t("打开财务时，本月还没有快照会自动存一个（本月里数字变了会更新）；手动保存的不会被自动覆盖。重建过去某月只用那个月月底以前的余额、估值和还款记录；那时没记的余额不算，房产 / 车辆按买卖日期判断。")}</p>
    <div class="nw-snap-acts"><button type="button" class="btn btn-primary btn-sm" data-nw="snap-save">${t("保存本月快照")}</button>
      <form class="nw-form nw-inline" data-nw-form="rebuild"><label>${t("重建过去某月")}<input type="month" name="month" required max="${thisMonth()}" value="${monthsAgo(thisMonth(), 1)}"></label><button type="submit" class="btn btn-sm">${t("重建")}</button></form></div>
    ${histList(key, list, line)}
  </details>`;
}
export function viewNetWorth() {
  if (!state.nwOk) return unavailable();
  const range = ["12", "24", "all"].includes(state.route.q.get("range")) ? state.route.q.get("range") : "12";
  const r = liveNetWorth(), m = thisMonth(), points = trendPoints(state.nwSnapshots, cur(), { live: r, month: m }), mom = monthChange(points, m);
  // 能跳转的卡片是链接（整张卡可点，键盘 Tab 可达）：总资产 → 资产页，总负债 → 借贷总览，比上月 → 下面的快照
  const kpi = (label, val, small = "", neg = false, to = null) => (to ? `<a class="kpi" href="${esc(to)}"><span>${esc(label)}</span><b class="${neg ? "down" : ""}">${val}</b>${small}</a>` : `<div class="kpi"><span>${esc(label)}</span><b class="${neg ? "down" : ""}">${val}</b>${small}</div>`);
  const other = r.otherCur.length ? `<div class="panel"><h3>${t("其他币种（不算进净资产）")}</h3><ul class="nw-other">${r.otherCur.map((x) => `<li>${esc(x.name)}：${x.side === "l" ? "−" : ""}${mny(x.amount, x.currency)}</li>`).join("")}</ul></div>` : "";
  return `<section class="section nw-page">
    <p class="muted" style="margin:-6px 0 12px;font-size:13px">${t("净资产 = 资产 − 负债。账户余额、房产 / 车辆估值在资产页和卡与账户里更新；贷款余额来自借贷（按摊还表）。只算 {cur}。", { cur: cur() })}</p>
    <div class="kpis">
      ${kpi(t("净资产"), mny(r.netWorth), `<small>${t("截至今天")}</small>`, r.netWorth < 0)}
      ${kpi(t("总资产"), mny(r.assetsTotal), `<small>${t("房产、车辆、账户")} ›</small>`, false, href("bills", "assets"))}
      ${kpi(t("总负债"), mny(r.liabilitiesTotal), `<small>${t("贷款、借款、信用卡")} ›</small>`, false, summaryHref())}
      ${kpi(t("比上月"), signed(mom), `<small>${mom == null ? t("上个月没有快照") : t("和上月快照比")}</small>`, mom != null && mom < 0)}
    </div>
    ${freshness(r)}
    ${breakdown(r)}
    ${trend(points, range)}
    ${growth(points)}
    ${equityTable(r)}
    ${other}
    ${snapshotsPanel()}
  </section>`;
}
/* ───────────── 动作 ───────────── */
const guard = async (fn) => { try { await fn(); } catch (e) { toast(t("操作失败：{msg}", { msg: e.message })); } };
export function initNetWorth({ render }) {
  const main = document.getElementById("main");
  const after = () => render(false);
  // <details> 开合记在 state 里，重画后保持（toggle 不冒泡：捕获阶段听）
  main.addEventListener("toggle", (e) => { const d = e.target; if (d?.dataset?.nwKey) ui().open[d.dataset.nwKey] = d.open; }, true);
  main.addEventListener("click", (e) => {
    const b = e.target.closest?.("[data-nw]"); if (!b) return;
    const act = b.dataset.nw, id = b.dataset.id;
    if (act === "more") { ui().more[b.dataset.key] = (ui().more[b.dataset.key] || SHOW) + SHOW * 4; return after(); }
    if (act === "bal-del") { if (!confirmDelete(t("删除这条余额记录？"))) return; return guard(async () => { await deleteBalance(id); toast(t("已删除")); after(); }); }
    if (act === "val-del") { if (!confirmDelete(t("删除这条估值记录？"))) return; return guard(async () => { await deleteValuation(id); toast(t("已删除")); after(); }); }
    if (act === "snap-del") { if (!confirmDelete(t("删除这个快照？"))) return; return guard(async () => { await deleteSnapshot(id); toast(t("已删除")); after(); }); }
    if (act === "snap-save") return guard(async () => { b.disabled = true; await saveMonthSnapshot(); toast(t("已保存本月快照")); after(); });
  });
  main.addEventListener("submit", (e) => {
    const f = e.target.closest?.("[data-nw-form]"); if (!f) return;
    e.preventDefault(); e.stopPropagation();
    const fd = new FormData(f), g = (k) => String(fd.get(k) ?? "").trim(), kind = f.dataset.nwForm;
    if (kind === "bal") return guard(async () => {
      if (g("balance") === "" || !g("as_of")) return toast(t("请填日期和金额"));
      await saveBalance({ card_id: f.dataset.id, as_of: g("as_of"), balance: num(g("balance")), notes: g("notes") || null }); toast(t("已更新余额")); after();
    });
    if (kind === "val") return guard(async () => {
      if (g("value") === "" || !g("as_of")) return toast(t("请填日期和金额"));
      await saveValuation({ kind: f.dataset.kind, target: f.dataset.id, as_of: g("as_of"), value: num(g("value")), source: g("source") || "manual", notes: g("notes") || null }); toast(t("已更新估值")); after();
    });
    if (kind === "rebuild") return guard(async () => { await rebuildSnapshot(g("month")); toast(t("已重建 {m} 的快照", { m: g("month") })); after(); });
  });
}
