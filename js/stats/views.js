import { categoryOptions } from "../pantry/views.js";
import { state } from "../core/state.js";
import { Store } from "../core/store.js";
import { $, DAY, catOf, du, esc, fmt, money, num, showQty, toast } from "../core/util.js";
import { compare, lang, locale, t } from "../core/i18n.js";
import { memberName } from "../core/logic.js";
import { href } from "../core/router.js";
import { withProperty } from "../core/alerts.js";
import { tabBar, tabHub } from "../core/hub.js";
import { SPEND_TABS, activeTab } from "../core/tabs.js";

/* ── 统计：花费与消耗趋势 ── */
// 账单分类在 purchases 里记为 bill_<category>，名字取自 data/bills.js
const BILL_CATS = () => window.BILLS.CATEGORIES.map((c) => ({ id: `bill_${c.id}`, name: c.name, icon: c.icon, color: BILLS_GROUP.color }));
export const ALL_CATS = () => [...CATEGORIES, MAINT_CAT, VEHICLE_CAT, ...BILL_CATS(), OTHER_CAT];
// 统计图里：储藏各分类单独显示，房屋耗材和设备维修保养合并为“房屋维护”、装备合并为“装备”、车辆维修保养为“车辆”、账单合并为“账单”各一组，避免颜色过多
export const STAT_CATS = () => [...CATEGORIES.filter((c) => c.space === "pantry"), HOUSE_GROUP, GEAR_GROUP, VEHICLE_GROUP, BILLS_GROUP, OTHER_CAT];
export const statCat = (id) => {
  const c = CATEGORIES.find((x) => x.id === id);
  if (c) return c.space === "pantry" ? c.id : c.space;
  if (id === MAINT_CAT.id) return "house";
  if (id === VEHICLE_CAT.id) return "vehicle";
  return String(id || "").startsWith("bill_") ? "bills" : "other";
};
export const monthKey = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`; };
const MONTH_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const monthLabel = (k) => (lang === "en"
  ? (k.endsWith("-01") ? `${MONTH_EN[0]} ${k.slice(2, 4)}` : MONTH_EN[+k.slice(5) - 1])
  : (k.endsWith("-01") ? t("{yy}年1月", { yy: k.slice(2, 4) }) : t("{m}月", { m: +k.slice(5) })));
export function lastMonths(n) {
  const d = new Date(), out = [];
  for (let i = n - 1; i >= 0; i--) out.push(monthKey(new Date(d.getFullYear(), d.getMonth() - i, 1)));
  return out;
}

export function spendData(n = state.stats.months) {
  const cur = Units.region.currency;
  const months = lastMonths(n);
  const byMC = Object.fromEntries(months.map((m) => [m, {}]));
  const counts = Object.fromEntries(months.map((m) => [m, 0]));
  let otherCurrency = 0;
  for (const p of state.purchases) {
    if (p.amount == null) continue;
    if (p.currency && p.currency !== cur) { otherCurrency++; continue; }
    const m = monthKey(p.purchased_at);
    if (!byMC[m]) continue;
    const c = statCat(p.category);
    byMC[m][c] = (byMC[m][c] || 0) + num(p.amount);
    counts[m]++;
  }
  const totals = months.map((m) => Object.values(byMC[m]).reduce((a, b) => a + b, 0));
  const cats = STAT_CATS().filter((c) => months.some((m) => byMC[m][c.id]));
  return { months, byMC, totals, cats, counts, otherCurrency };
}

export function consumptionData() {
  const WEEKS = 12, now = Date.now();
  const starts = Array.from({ length: WEEKS }, (_, i) => now - (WEEKS - i) * 7 * DAY);
  const labels = starts.map((x) => { const d = new Date(x); return `${d.getMonth() + 1}/${d.getDate()}`; });
  const wk = (x) => Math.floor((x - starts[0]) / (7 * DAY));
  const itemCat = Object.fromEntries(state.items.map((i) => [i.id, i.category]));
  const freq = {}, perItem = {};
  for (const l of state.logs) {
    if (l.reason !== "consume") continue;
    const w = wk(new Date(l.created_at).getTime());
    if (w < 0 || w >= WEEKS) continue;
    const c = itemCat[l.item_id];
    if (!c) continue;
    (freq[c] ||= Array(WEEKS).fill(0))[w]++;
    perItem[l.item_id] = (perItem[l.item_id] || 0) + 1;
  }
  return { WEEKS, starts, labels, freq, perItem };
}

// 周消耗量 + 每周末库存水位（用当前库存减去之后发生的所有变动倒推）
export function itemSeries(item, starts) {
  const W = starts.length, f = Units.factor(item.unit);
  const used = Array(W).fill(0), level = Array(W).fill(0);
  const logs = state.logs.filter((l) => l.item_id === item.id).map((l) => ({ t: new Date(l.created_at).getTime(), d: num(l.delta), r: l.reason }));
  for (const l of logs) {
    const w = Math.floor((l.t - starts[0]) / (7 * DAY));
    if (l.r === "consume" && w >= 0 && w < W) used[w] += -l.d;
  }
  for (let i = 0; i < W; i++) {
    const end = starts[i] + 7 * DAY;
    const after = logs.filter((l) => l.t > end).reduce((a, l) => a + l.d, 0);
    level[i] = Math.max(0, num(item.quantity) - after);
  }
  return { used: used.map((v) => v * f), level: level.map((v) => v * f), unit: t(du(item.unit)) };
}

/** 时间范围：3 / 6 / 9 / 12 个月；花费各标签和预算趋势共用（state.stats.months） */
export const RANGES = [3, 6, 9, 12];
export const rangeChipsHtml = () => `<div class="seg" role="group" aria-label="${t("时间范围")}">${RANGES.map((n) => `<button type="button" class="chip" data-action="stats-months" data-months="${n}" aria-pressed="${state.stats.months === n}">${t("近 {n} 个月", { n })}</button>`).join("")}</div>`;
const monthOpt = (m) => (lang === "en" ? `${MONTH_EN[+m.slice(5) - 1]} ${m.slice(0, 4)}` : t("{y} 年 {m} 月", { y: m.slice(0, 4), m: +m.slice(5) }));
const noSpend = () => `<div class="panel empty"><strong>${t("还没有花费记录")}</strong>${t("在采购清单点“已买到”时填上实际花费，或在“明细”里补记一笔。")}</div>`;

/* ── 钻取：图表色块、图例、名称、数字卡片都带 data-drill（查询串），点一下跳到 明细 并套上对应筛选（分类 / 商店 / 月份 / 近 N 个月）；
 * 全局点击处理在 main.js，筛选在 applySpendDrill，明细页顶部用筛选条显示并可逐项去掉。 */
const dq = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v != null && v !== "").map(([k, v]) => [k, String(v)])).toString();
const encKeys = (keys) => keys.map(encodeURIComponent).join(",");
const hitAttrs = (q, label) => (q ? ` data-drill="${esc(q)}" role="link" tabindex="0" aria-label="${esc(label)}"` : "");
const DRILL_HINT = () => `<p class="muted drill-hint">${t("点图里的色块、图例或名称，可以查看对应的花费明细。")}</p>`;
export function applySpendDrill(q) {
  if (!["cat", "store", "stores", "month", "range"].some((k) => q.has(k))) return false;
  const f = state.spendFilter;
  Object.assign(f, { q: "", cat: "all", store: "all", stores: null, month: "all", months: null, sort: "new", limit: 20 });
  if (q.get("cat")) f.cat = q.get("cat");
  if (q.get("store")) f.store = q.get("store");
  if (q.get("stores")) f.stores = q.get("stores").split(",").map(decodeURIComponent);
  if (q.get("month")) f.month = q.get("month");
  else if (q.get("range")) f.months = lastMonths(Math.max(1, Math.min(24, +q.get("range") || 6)));
  return true;
}

/** 本月 / 上月 / 近 n 月月均：花费概览和账单概览的速览共用；数字卡片点一下看对应月份的明细 */
export function spendKpis(sd) {
  const { months, totals } = sd;
  const thisTotal = totals.at(-1) || 0, prevTotal = totals.at(-2) || 0, avg = totals.reduce((a, b) => a + b, 0) / (totals.length || 1);
  const change = prevTotal > 0 ? Math.round(((thisTotal - prevTotal) / prevTotal) * 100) : null;
  return `<div class="kpis">
    <div class="kpi ch-hit-row"${hitAttrs(dq({ month: months.at(-1) }), t("本月花费"))}><span>${t("本月花费")}</span><b>${money(thisTotal)}</b><small>${t("{n} 笔", { n: sd.counts[months.at(-1)] })} ›</small></div>
    <div class="kpi ch-hit-row"${hitAttrs(dq({ month: months.at(-2) }), t("上月花费"))}><span>${t("上月花费")}</span><b>${money(prevTotal)}</b>
      <small class="${change > 0 ? "up" : "down"}">${change == null ? t("上月无记录") : change > 0 ? t("多了 {p}%", { p: Math.abs(change) }) : t("少了 {p}%", { p: Math.abs(change) })}</small></div>
    <div class="kpi ch-hit-row"${hitAttrs(dq({ range: months.length }), t("近 {n} 个月月均", { n: months.length }))}><span>${t("近 {n} 个月月均", { n: months.length })}</span><b>${money(avg)}</b><small>${t("本月进度供参考")} ›</small></div>
  </div>`;
}
/** 账单概览里的花费速览：只放三个数字，详细的在 账单 → 花费 */
export function spendGlance() {
  if (!state.purchases.length) return "";
  return `<section class="section"><div class="section-head"><h2>${t("花费速览")}</h2><div class="head-acts"><a class="btn btn-sm btn-ghost" href="${href("bills", "spend")}">${t("看花费")}</a></div></div>${spendKpis(spendData(6))}</section>`;
}

/* 花费页分为 5 个标签（概览 / 分类 / 商店 / 明细 / 导出打印），一次只画一块，页面不再一屏接一屏地长；
 * 统计页（账单模块关闭时）仍用 "all"：全部连在一起 */
const spendHref = (id) => `${href("bills", "spend")}${id === "overview" ? "" : `?tab=${id}`}`;
function spendOverviewTab(sd, withHub = false) {
  const { months, byMC, cats, totals } = sd;
  const spendBars = Charts.bars({
    title: t("月度采购花费（按分类堆叠）"), labels: months.map(monthLabel), fmt: money,
    series: cats.map((c) => ({ name: t(c.name), color: c.color, values: months.map((m) => byMC[m][c.id] || 0) })),
    drill: (k, i) => dq({ cat: cats[k].id, month: months[i] }), legendDrill: (k) => dq({ cat: cats[k].id, range: months.length }),
  });
  return `${spendKpis(sd)}
    ${withHub ? tabHub(SPEND_TABS, spendHref, t("更多")) : ""}
    ${sd.otherCurrency ? `<p class="muted" style="font-size:13px">${t("另有 {n} 笔非 {cur} 记录未计入。", { n: sd.otherCurrency, cur: Units.region.currency })}</p>` : ""}
    ${totals.some((v) => v > 0) ? `<div class="panel chart-panel"><h3>${t("每月花了多少")}</h3>${spendBars}${DRILL_HINT()}</div>` : noSpend()}`;
}
function spendCategoryTab(sd) {
  const st = state.stats, { months, byMC, cats, totals } = sd;
  if (!totals.some((v) => v > 0)) return noSpend();
  const selMonth = st.month && byMC[st.month] ? st.month : months.at(-1);
  const selCat = st.cat && cats.some((c) => c.id === st.cat) ? st.cat : cats[0]?.id;
  const donut = Charts.donut({
    title: t("{month}分类占比", { month: monthLabel(selMonth) }), fmt: money,
    center: money(Object.values(byMC[selMonth]).reduce((a, b) => a + b, 0), true),
    items: STAT_CATS().map((c) => ({ name: `${c.icon} ${t(c.name)}`, color: c.color, value: byMC[selMonth][c.id] || 0, drill: dq({ cat: c.id, month: selMonth }) })),
  });
  const catObj = STAT_CATS().find((c) => c.id === selCat);
  const catTrend = catObj ? Charts.line({
    title: t("{cat}月度花费趋势", { cat: t(catObj.name) }), labels: months.map(monthLabel), fmt: money,
    series: [{ name: t(catObj.name), color: catObj.color, values: months.map((m) => byMC[m][selCat] || 0) }],
    drill: (_, i) => dq({ cat: selCat, month: months[i] }),
  }) : "";
  return `<div class="panel chart-panel"><div class="chart-head"><h3>${t("分类占比")}</h3>
      <select id="statsMonth" aria-label="${t("选择月份")}">${[...months].reverse().map((m) => `<option value="${m}" ${m === selMonth ? "selected" : ""}>${monthOpt(m)}</option>`).join("")}</select></div>${donut}${DRILL_HINT()}</div>
    <div class="panel chart-panel"><h3>${t("单个分类的月度趋势")}</h3>
      <div class="chips" role="group" aria-label="${t("选择分类")}">${cats.map((c) => `<button type="button" class="chip" data-action="stats-cat" data-cat="${c.id}" aria-pressed="${c.id === selCat}">${c.icon} ${t(c.name)}</button>`).join("")}</div>
      ${catTrend}
      ${catObj ? `<div class="form-actions"><button type="button" class="btn btn-sm" data-drill="${esc(dq({ cat: selCat, range: months.length }))}">${t("查看「{cat}」近 {n} 个月的明细", { cat: t(catObj.name), n: months.length })} ›</button></div>` : ""}${DRILL_HINT()}</div>`;
}
function spendRecordsTab() {
  const today = new Date().toISOString().slice(0, 10);
  return `<section class="section">
      <div class="section-head"><h2>${t("补记一笔花费")}</h2><p>${t("没走采购清单的，也可以记在这里")}</p></div>
      ${storeDatalist()}
      <form id="purchaseForm" class="panel add-row purchase-row">
        <input name="name" required maxlength="60" placeholder="${t("买了什么，例如：超市采购")}" aria-label="${t("名称")}">
        <select name="category" aria-label="${t("分类")}">${categoryOptions()}</select>
        <input name="amount" type="number" min="0" step="0.01" inputmode="decimal" required placeholder="${t("金额（{cur}）", { cur: Units.region.currency })}" aria-label="${t("金额")}">
        <input name="store" maxlength="40" list="storeList" value="${esc(lastStore())}" placeholder="${t("商店（可不填）")}" aria-label="${t("商店")}">
        <input name="date" type="date" value="${today}" max="${today}" aria-label="${t("日期")}">
        <button class="btn btn-primary" type="submit">${t("记一笔")}</button>
      </form>
    </section>
    <section class="section" id="spendRecords">${spendRecordsHtml()}</section>`;
}
function spendExportTab() {
  return `${viewAnnualExport()}
    <section class="section">
      <div class="section-head"><h2>${t("打印")}</h2><p>${t("浏览器的打印窗口里也可以另存为 PDF")}</p></div>
      <div class="panel export-row">
        <label class="field-label" for="printRange" style="margin:0">${t("时间范围")}</label>
        <select id="printRange">${[3, 6, 12].map((n) => `<option value="${n}" ${n === state.stats.months ? "selected" : ""}>${t("近 {n} 个月", { n })}</option>`).join("")}</select>
        <button type="button" class="btn btn-primary btn-sm" data-action="print-run" data-kind="spend">${t("打印花费统计")}</button>
      </div>
      <p class="muted" style="margin:6px 0 0;font-size:13px">${t("要打印筛选后的明细，到“明细”标签里点“打印”。")}</p>
    </section>`;
}

export function viewSpend() {
  const r = state.route, onSpendPage = r?.section === "bills" && r?.sub === "spend";
  const tab = onSpendPage ? activeTab(r) : "all";
  const sd = spendData();
  const ranged = tab === "overview" || tab === "category" || tab === "stores" || tab === "all";
  const body = {
    overview: () => spendOverviewTab(sd, onSpendPage), category: () => spendCategoryTab(sd), stores: () => viewStoreStats(sd.months) || noSpend(),
    records: spendRecordsTab, export: spendExportTab,
    all: () => `${spendOverviewTab(sd)}${spendCategoryTab(sd)}${viewStoreStats(sd.months)}${viewAnnualExport()}${spendRecordsTab()}`,
  }[tab]();
  return `
    <section class="section">
      <div class="section-head"><h2>${t("采购花费")}</h2></div>
      ${onSpendPage ? tabBar(SPEND_TABS, tab, spendHref, t("花费内容")) : ""}
      ${ranged ? `<div class="range-row">${rangeChipsHtml()}</div>` : ""}
      ${body}
    </section>`;
}

export function viewUsage() {
  const st = state.stats;
  // 消耗趋势
  const cd = consumptionData();
  const freqCats = CATEGORIES.filter((c) => cd.freq[c.id]);
  const freqChart = freqCats.length ? Charts.bars({
    title: t("每周使用记录次数（按分类）"), labels: cd.labels, fmt: (v) => t("{n} 次", { n: Math.round(v) }), showTotals: false,
    series: freqCats.map((c) => ({ name: t(c.name), color: c.color, values: cd.freq[c.id] })),
  }) : "";
  const ranked = state.items.filter((i) => cd.perItem[i.id]).sort((a, b) => cd.perItem[b.id] - cd.perItem[a.id]);
  const selItem = state.items.find((i) => i.id === st.itemId && cd.perItem[i.id]) || ranked[0];
  let itemChart = "";
  if (selItem) {
    const ser = itemSeries(selItem, cd.starts);
    const c = catOf(selItem.category);
    itemChart = Charts.line({
      title: t("{name}每周用量与库存", { name: selItem.name }), labels: cd.labels, fmt: (v) => `${fmt(v)} ${ser.unit}`,
      barSeries: { name: t("每周用量（{u}）", { u: ser.unit }), color: c.color, values: ser.used },
      series: [{ name: t("周末库存（{u}）", { u: ser.unit }), color: "var(--ink)", values: ser.level }],
    });
  }
  return `
    ${state.billsEnabled ? `<div class="panel cta-panel"><div><b>${t("花费统计搬到了 账单 → 花费")}</b><p class="muted">${t("每月花了多少、分类占比、商店、年度报表、补记和花费记录都在那里；这里只看库存的使用趋势。")}</p></div>
      <a class="btn btn-primary" href="#/bills/spend">${t("去看花费")}</a></div>` : ""}
    <section class="section">
      <div class="section-head"><h2>${t("消耗趋势")}</h2><p>${t("最近 12 周，来自家人点“−”的记录")}</p></div>
      ${selItem ? `
      <div class="panel chart-panel"><div class="chart-head"><h3>${t("单品用量与库存")}</h3>
        <select id="statsItem" aria-label="${t("选择物品")}">${ranked.map((i) => `<option value="${i.id}" ${i.id === selItem.id ? "selected" : ""}>${esc(i.name)}（${t("{n} 次", { n: cd.perItem[i.id] })}）</option>`).join("")}</select></div>
        ${itemChart}</div>
      <div class="panel chart-panel"><h3>${t("各分类使用频率")}</h3><p class="muted" style="margin:0 0 6px;font-size:13px">${t("按记录次数统计，不同物品单位不同，不能直接相加数量。")}</p>${freqChart}</div>`
      : `<div class="panel empty"><strong>${t("还没有使用记录")}</strong>${t("在库存页用掉东西时点一下 −，这里就会出现趋势。")}</div>`}
    </section>
    `;
}

/** 我的 → 统计：账单模块开着时只看用量趋势（花费在 账单 → 花费）；关掉账单时花费和用量都在这里 */
export function viewStats() {
  return state.billsEnabled ? viewUsage() : viewSpend() + viewUsage();
}

/* ── 花费记录：搜索 + 分类 / 商店 / 月份筛选 + 排序，按月分组带小计，分批显示 ── */
export const SPEND_SORTS = [["new", "时间：新 → 旧"], ["old", "时间：旧 → 新"], ["high", "金额：高 → 低"], ["low", "金额：低 → 高"], ["name", "名称 A → Z"]];
const PAGE = 20;
const amountOf = (p) => (p.amount != null && (!p.currency || p.currency === Units.region.currency) ? num(p.amount) : 0);
export function filteredSpend() {
  const f = state.spendFilter, q = f.q.trim().toLowerCase();
  let list = state.purchases.filter((p) => {
    if (f.cat !== "all" && statCat(p.category) !== f.cat) return false;
    if (f.month !== "all" && monthKey(p.purchased_at) !== f.month) return false;
    if (f.months?.length && !f.months.includes(monthKey(p.purchased_at))) return false;   // 从图表钻取来的“近 N 个月”
    if (f.stores?.length && !f.stores.includes(storeKey(storeOf(p)) || "__none__")) return false;   // “其他商店”：一组商店
    if (f.store !== "all" && (f.store === "__none__" ? !!storeOf(p) : storeKey(storeOf(p)) !== f.store)) return false;
    return !q || `${p.name}${storeOf(p)}`.toLowerCase().includes(q);
  });
  const date = (p) => new Date(p.purchased_at).getTime();
  const sorts = { new: (a, b) => date(b) - date(a), old: (a, b) => date(a) - date(b), high: (a, b) => amountOf(b) - amountOf(a) || date(b) - date(a), low: (a, b) => amountOf(a) - amountOf(b) || date(b) - date(a), name: (a, b) => compare(a.name, b.name) || date(b) - date(a) };
  list = list.sort(sorts[f.sort] || sorts.new);
  return list;
}
function spendRow(p) {
  const d = new Date(p.purchased_at), sameYear = d.getFullYear() === new Date().getFullYear();
  const cat = ALL_CATS().find((c) => c.id === p.category) || OTHER_CAT;
  if (state.spendEdit === p.id) return spendEditRow(p);
  // 账单缴费记的花费：名称链接到那条缴费记录的编辑页（改那里，花费会同步）；其余的在这一行里就地编辑
  const pay = state.billPayments.find((x) => x.purchase_id === p.id), bill = pay && state.bills.find((x) => x.id === pay.bill_id);
  const title = bill ? `<a class="link-name" href="${href("bill", bill.id)}?sec=pay&edit=${pay.id}" title="${esc(t("点一下编辑"))}">${esc(withProperty(bill.property_id, p.name))}</a>`
    : `<button type="button" class="link-name linkbtn" data-action="spend-edit" data-id="${p.id}" title="${esc(t("点一下编辑"))}">${esc(p.name)}</button>`;
  return `<li>
    <span class="badge" style="background:var(--surface-2)">${esc(d.toLocaleDateString(locale(), sameYear ? { month: "numeric", day: "numeric" } : { year: "2-digit", month: "numeric", day: "numeric" }))}</span>
    <div class="grow"><span class="name">${title}</span><small>${esc(`${cat.icon || ""} ${t(cat.name)}`.trim())}${storeOf(p) ? `，${esc(storeOf(p))}` : ""}${p.quantity ? `，${showQty(p.quantity, p.unit || "")}` : ""}${p.created_by && state.members.length > 1 ? `，${esc(memberName(p.created_by) || "")}` : ""}</small></div>
    <b>${p.amount != null ? esc(Units.money(num(p.amount), p.currency || Units.region.currency)) : `<span class="muted">${t("未填金额")}</span>`}</b>
    <button type="button" class="btn btn-sm btn-ghost" data-action="purchase-del" data-id="${p.id}" aria-label="${esc(t("删除 {name} 这笔记录", { name: p.name }))}">${t("删除")}</button></li>`;
}
/** 就地编辑：名称、分类、金额、商店、日期（数量和单位不动） */
function spendEditRow(p) {
  const day = String(p.purchased_at).slice(0, 10), opts = categoryOptions(p.category, { withOther: true });   // 当前分类已在选项里时会自动选中
  const hasCat = opts.includes(`value="${p.category}"`);
  return `<li class="spend-edit"><form id="spendEditForm" data-id="${p.id}" class="form-grid" novalidate>
    <label class="span-2">${t("名称")}<input name="name" required maxlength="60" value="${esc(p.name)}"></label>
    <label>${t("分类")}<select name="category">${hasCat ? "" : `<option value="${esc(p.category)}" selected>${esc(t((ALL_CATS().find((c) => c.id === p.category) || OTHER_CAT).name))}</option>`}${opts}</select></label>
    <label>${t("金额（{cur}）", { cur: p.currency || Units.region.currency })}<input name="amount" type="number" min="0" step="0.01" inputmode="decimal" value="${p.amount != null ? num(p.amount).toFixed(2) : ""}"></label>
    <label>${t("商店 / 收款方")}<input name="store" maxlength="40" list="storeList" value="${esc(p.store || "")}"></label>
    <label>${t("日期")}<input name="date" type="date" max="${new Date().toISOString().slice(0, 10)}" value="${esc(day)}"></label>
    <div class="form-actions span-2"><button type="submit" class="btn btn-primary btn-sm">${t("保存修改")}</button><button type="button" class="btn btn-sm btn-ghost" data-action="spend-edit-cancel">${t("取消")}</button></div></form></li>`;
}
/** 明细页顶部的筛选条：当前生效的筛选一项一个标签，点标签去掉那一项，“清除全部”一键回到全部。从图表 / 名称钻取进来时靠它看清“现在看的是什么” */
function activeFilterChips() {
  const f = state.spendFilter, out = [];
  const monthName = (m) => (lang === "en" ? `${MONTH_EN[+m.slice(5) - 1]} ${m.slice(0, 4)}` : t("{y} 年 {m} 月", { y: m.slice(0, 4), m: +m.slice(5) }));
  const storeName = (k) => (k === "__none__" ? t(STORE_NONE.name) : knownStores().find((x) => storeKey(x) === k) || k);
  if (f.cat !== "all") { const c = STAT_CATS().find((x) => x.id === f.cat); out.push(["cat", c ? `${c.icon} ${t(c.name)}` : f.cat]); }
  if (f.store !== "all") out.push(["store", storeName(f.store)]);
  if (f.stores?.length) { const n = f.stores.map(storeName); out.push(["stores", n.length <= 3 ? n.join("、") : t("{a} 等 {n} 家", { a: n.slice(0, 2).join("、"), n: n.length })]); }
  if (f.month !== "all") out.push(["month", monthName(f.month)]);
  if (f.months?.length) out.push(["months", t("近 {n} 个月", { n: f.months.length })]);
  if (f.q.trim()) out.push(["q", `“${f.q.trim()}”`]);
  return out;
}
function spendChipsHtml() {
  const chips = activeFilterChips(); if (!chips.length) return "";
  return `<div class="filter-chips" role="group" aria-label="${t("当前筛选")}"><span class="muted">${t("当前筛选")}</span>${chips.map(([k, label]) => `<button type="button" class="chip fchip" data-action="spend-chip-clear" data-k="${k}" aria-label="${esc(t("去掉筛选：{x}", { x: label }))}">${esc(label)} <span aria-hidden="true">✕</span></button>`).join("")}${chips.length > 1 ? `<button type="button" class="btn btn-sm btn-ghost" data-action="spend-chip-clear" data-k="all">${t("清除全部")}</button>` : ""}</div>`;
}
export function clearSpendFilter(k) {
  const f = state.spendFilter, d = { cat: ["cat", "all"], store: ["store", "all"], month: ["month", "all"], q: ["q", ""] };
  if (k === "all") Object.assign(f, { q: "", cat: "all", store: "all", stores: null, month: "all", months: null });
  else if (k === "stores") f.stores = null; else if (k === "months") f.months = null; else if (d[k]) f[d[k][0]] = d[k][1];
  f.limit = 20;
}
/** 筛选条、各个下拉和搜索框都按当前筛选重画（点掉标签后下拉也跟着回到“全部”） */
export function renderSpendRecords() { const h = $("#spendRecords"); if (h) h.innerHTML = spendRecordsHtml(); }

/** 列表本体 + 合计；搜索 / 筛选变化只重画这一块（输入框不丢焦点） */
function spendListHtml() {
  const f = state.spendFilter, all = filteredSpend(), shown = all.slice(0, f.limit);
  if (!all.length) return `<div class="empty"><strong>${t("没有符合条件的记录")}</strong>${t("换个关键词或筛选试试。")}</div>`;
  const byDate = f.sort === "new" || f.sort === "old";
  let out = "", cur = null;
  for (const p of shown) {
    if (byDate) {
      const m = monthKey(p.purchased_at);
      if (m !== cur) {
        cur = m; const inM = all.filter((x) => monthKey(x.purchased_at) === m);
        out += `<li class="rec-month"><b>${esc(lang === "en" ? `${MONTH_EN[+m.slice(5) - 1]} ${m.slice(0, 4)}` : t("{y} 年 {m} 月", { y: m.slice(0, 4), m: +m.slice(5) }))}</b><span class="muted">${esc(t("{n} 笔", { n: inM.length }))} · ${esc(money(inM.reduce((a, x) => a + amountOf(x), 0)))}</span></li>`;
      }
    }
    out += spendRow(p);
  }
  return `<ul class="restock-list rec-list">${out}</ul>
    ${all.length > shown.length ? `<div class="form-actions" style="justify-content:center"><button type="button" class="btn btn-ghost" data-action="spend-more">${t("再显示 {n} 笔（还有 {m} 笔）", { n: Math.min(PAGE, all.length - shown.length), m: all.length - shown.length })}</button></div>` : ""}`;
}
function spendSummary() {
  const all = filteredSpend();
  return `${t("{n} 笔", { n: all.length })} · ${money(all.reduce((a, p) => a + amountOf(p), 0))}`;
}
export function renderSpendList() {
  const host = $("#spendList"); if (!host) return;
  host.innerHTML = spendListHtml();
  const sum = $("#spendSum"); if (sum) sum.textContent = spendSummary();
  const chips = $("#spendChips"); if (chips) chips.innerHTML = spendChipsHtml();
}
function spendRecordsHtml() {
  const f = state.spendFilter, ps = state.purchases;
  if (!ps.length) return `<div class="section-head"><h2>${t("花费记录")}</h2></div><div class="panel empty"><strong>${t("还没有花费记录")}</strong>${t("采购清单点“已买到”、录入购物或上面的补记，都会出现在这里。")}</div>`;
  const months = [...new Set(ps.map((p) => monthKey(p.purchased_at)))].sort().reverse();
  const stores = knownStores(), hasNone = ps.some((p) => !storeOf(p));
  const cats = STAT_CATS().filter((c) => ps.some((p) => statCat(p.category) === c.id));
  const opt = (v, label, cur) => `<option value="${esc(v)}" ${cur === v ? "selected" : ""}>${esc(label)}</option>`;
  const mo = (m) => (lang === "en" ? `${MONTH_EN[+m.slice(5) - 1]} ${m.slice(0, 4)}` : t("{y} 年 {m} 月", { y: m.slice(0, 4), m: +m.slice(5) }));
  return `<div class="section-head"><h2>${t("花费记录")}</h2><div class="head-acts"><span id="spendSum" class="muted">${esc(spendSummary())}</span><button type="button" class="btn btn-sm btn-ghost" data-action="print-run" data-kind="spend" data-filtered="1">${t("打印")}</button></div></div>
    <div class="panel">
      <div id="spendChips">${spendChipsHtml()}</div>
      <div class="toolbar">
        <input type="search" id="spendSearch" placeholder="${t("搜索名称或商店")}" value="${esc(f.q)}" aria-label="${t("搜索花费记录")}">
        <select id="spendCat" aria-label="${t("按分类筛选")}">${opt("all", t("全部分类"), f.cat)}${cats.map((c) => opt(c.id, `${c.icon} ${t(c.name)}`, f.cat)).join("")}</select>
        <select id="spendStore" aria-label="${t("按商店筛选")}">${opt("all", t("全部商店 / 收款方"), f.store)}${stores.map((x) => opt(storeKey(x), x, f.store)).join("")}${hasNone ? opt("__none__", t("未填写商店"), f.store) : ""}</select>
        <select id="spendMonth" aria-label="${t("按月份筛选")}">${opt("all", t("全部月份"), f.month)}${months.map((m) => opt(m, mo(m), f.month)).join("")}</select>
        <select id="spendSort" aria-label="${t("排序")}">${SPEND_SORTS.map(([v, l]) => opt(v, t(l), f.sort)).join("")}</select>
      </div>
      <div id="spendList">${spendListHtml()}</div>
      <p class="muted" style="margin:8px 0 0;font-size:12.5px">${t("这里是近 400 天的记录。")}</p>
    </div>`;
}

/* ── 商店统计与年度报表 ── */
export const STORE_COLORS = ["#2c6a57", "#d4694c", "#3b7fc4", "#b07a1a", "#7563c0", "#c75a85"];
export const STORE_REST = { name: "其他商店", color: "#8a948f" }, STORE_NONE = { name: "未填写商店", color: "#c3cbc6" };
export const cleanStore = (v) => (v || "").trim().replace(/\s+/g, " ").slice(0, 40) || null;
export const lastStore = () => { try { return localStorage.getItem("hmh-last-store") || ""; } catch { return ""; } };
export const rememberStore = (v) => { try { localStorage.setItem("hmh-last-store", v); } catch { /* 忽略 */ } };
// 商店名大小写、空格不同视为同一家（Costco 与 costco）
export const storeKey = (v) => (v || "").trim().toLowerCase();
/** 商店名：按记下来的（账单缴费时就是当时的收款方，中途换了收款方，历史不改写）；没记的账单 / 订阅 / 保险用账单的收款方（没填就用账单名），统计里就不会都归到“未填写商店” */
export function storeOf(p) {
  const s = (p.store || "").trim(); if (s) return s;
  if (!String(p.category || "").startsWith("bill_")) return "";
  const b = state.bills.find((x) => x.name === p.name);
  return (b?.payee || "").trim() || String(p.name || "").trim();
}
export function knownStores() {
  const m = new Map();
  for (const p of state.purchases) { const n = storeOf(p); if (n && !m.has(storeKey(n))) m.set(storeKey(n), n); }
  return [...m.values()].sort(compare);
}
export const storeDatalist = () => `<datalist id="storeList">${knownStores().map((x) => `<option value="${esc(x)}">`).join("")}</datalist>`;

export function viewStoreStats(months) {
  const cur = Units.region.currency, inRange = new Set(months);
  const agg = new Map();   // key → { name, total, count, byMonth }
  for (const p of state.purchases) {
    if (p.amount == null || (p.currency && p.currency !== cur)) continue;
    const m = monthKey(p.purchased_at);
    if (!inRange.has(m)) continue;
    const k = storeKey(storeOf(p)) || "__none__";
    const a = agg.get(k) || { name: storeOf(p) || t(STORE_NONE.name), total: 0, count: 0, byMonth: {} };
    a.total += num(p.amount); a.count++; a.byMonth[m] = (a.byMonth[m] || 0) + num(p.amount);
    agg.set(k, a);
  }
  if (!agg.size) return "";
  const named = [...agg.entries()].filter(([k]) => k !== "__none__").map(([, v]) => v).sort((a, b) => b.total - a.total);
  const keyOf = new Map([...agg.entries()].map(([k, v]) => [v, k]));
  const groups = named.slice(0, STORE_COLORS.length).map((v, i) => ({ ...v, color: STORE_COLORS[i], keys: [keyOf.get(v)] }));
  const rest = named.slice(STORE_COLORS.length);
  if (rest.length) groups.push(rest.reduce((g, v) => {
    g.total += v.total; g.count += v.count; g.keys.push(keyOf.get(v));
    for (const [m, x] of Object.entries(v.byMonth)) g.byMonth[m] = (g.byMonth[m] || 0) + x;
    return g;
  }, { ...STORE_REST, name: t(STORE_REST.name), total: 0, count: 0, byMonth: {}, keys: [], members: rest, isRest: true }));
  if (agg.has("__none__")) groups.push({ ...agg.get("__none__"), color: STORE_NONE.color, keys: ["__none__"] });
  const total = groups.reduce((a, g) => a + g.total, 0);
  // 点一个商店 / “其他商店”：跳到明细，套上这家（或这一组）商店；month 为空 = 整个时间范围
  const gDrill = (g, month) => dq({ ...(g.keys.length === 1 ? { store: g.keys[0] } : { stores: encKeys(g.keys) }), ...(month ? { month } : { range: months.length }) });

  const donut = Charts.donut({
    title: t("近 {n} 个月各商店花费占比", { n: months.length }), fmt: money, center: money(total, true),
    items: groups.map((g) => ({ name: g.name, color: g.color, value: g.total, drill: gDrill(g) })),
  });
  const bars = Charts.bars({
    title: t("各商店月度花费"), labels: months.map(monthLabel), fmt: money,
    series: groups.map((g) => ({ name: g.name, color: g.color, values: months.map((m) => g.byMonth[m] || 0) })),
    drill: (k, i) => gDrill(groups[k], months[i]), legendDrill: (k) => gDrill(groups[k]),
  });
  const rows = groups.map((g) => `<tr><th scope="row"><i class="sw" style="background:${g.color}"></i><button type="button" class="link-name linkbtn" data-drill="${esc(gDrill(g))}" title="${esc(t("查看明细"))}">${esc(g.name)}</button>${g.isRest ? ` <small class="muted">${t("{n} 家", { n: g.members.length })}</small>` : ""}
    <td>${g.count}</td><td>${esc(money(g.total))}</td><td>${esc(money(g.total / g.count))}</td><td>${Math.round((g.total / total) * 100)}%</td></tr>`).join("");
  // “其他商店”里到底有哪些：展开列出每一家，每家也能点进明细
  const rg = groups.find((g) => g.isRest);
  const restDetail = rg ? `<details class="rest-detail" open><summary><b>${t("“其他商店”包含 {n} 家", { n: rg.members.length })}</b><small>${t("花费较少的商店合并显示在一起，展开看每一家")}</small></summary>
    <ul class="rest-list">${[...rg.members].sort((a, b) => b.total - a.total).map((v) => `<li class="ch-hit-row"${hitAttrs(dq({ store: keyOf.get(v), range: months.length }), v.name)}><span class="grow">${esc(v.name)}</span><small class="muted">${t("{n} 笔", { n: v.count })}</small><b>${esc(money(v.total))}</b><u aria-hidden="true">›</u></li>`).join("")}</ul></details>` : "";
  return `<section class="section">
    <div class="section-head"><h2>${t("按商店 / 收款方统计")}</h2><p>${t("近 {n} 个月；账单、订阅、保险按收款方；名称不区分大小写", { n: months.length })}</p></div>
    <div class="panel chart-panel"><h3>${t("在哪里花得最多")}</h3>${donut}
      <div class="ch-scroll"><table class="store-table"><thead><tr><th scope="col">${t("商店 / 收款方")}</th><th scope="col">${t("次数")}</th><th scope="col">${t("合计")}</th><th scope="col">${t("平均每次")}</th><th scope="col">${t("占比")}</th></tr></thead><tbody>${rows}</tbody></table></div>
      ${restDetail}${DRILL_HINT()}
    </div>
    <div class="panel chart-panel"><h3>${t("每月在各商店的花费")}</h3>${bars}${DRILL_HINT()}</div>
  </section>`;
}

export function viewAnnualExport() {
  const y = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => y - i);
  return `<section class="section">
    <div class="section-head"><h2>${t("年度花费报表")}</h2><p>${t("导出 CSV，可用 Excel、Numbers 或 Google 表格打开")}</p></div>
    <div class="panel export-row">
      <label class="field-label" for="csvYear" style="margin:0">${t("年份")}</label>
      <select id="csvYear">${years.map((v) => `<option value="${v}">${t("{y} 年", { y: v })}</option>`).join("")}</select>
      <button type="button" class="btn btn-primary btn-sm" data-action="csv-summary">${t("导出汇总（月份 × 分类、商店）")}</button>
      <button type="button" class="btn btn-sm" data-action="csv-detail">${t("导出明细（每一笔）")}</button>
    </div>
  </section>`;
}

// CSV：加 UTF-8 BOM（Excel 打开中文不乱码）；以 = + - @ 开头的文本加 ' 前缀，防止表格公式注入
export function csvCell(v) {
  if (v == null) return "";
  if (typeof v === "number") return String(v);
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export const toCsv = (rows) => "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");

export function download(name, text, type = "text/csv;charset=utf-8") {
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export const ymd = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export async function exportAnnual(kind) {
  const year = +($("#csvYear")?.value || new Date().getFullYear());
  // 按本地时间：当年 1 月 1 日 0 点到次年 1 月 1 日 0 点
  const from = new Date(year, 0, 1).toISOString(), to = new Date(year + 1, 0, 1).toISOString();
  const list = await Store.listPurchasesRange(from, to);
  if (!list.length) return toast(t("{y} 年没有采购记录", { y: year }));
  const catName = (id) => t((ALL_CATS().find((c) => c.id === id) || OTHER_CAT).name);
  const r2 = (v) => Math.round(v * 100) / 100;
  const hh = state.household?.name || t("家庭");
  const fileBase = `${hh.replace(/[\\/:*?"<>|（）()\s]/g, "")}-${year}`;

  if (kind === "detail") {
    const rows = [[t("日期"), t("物品"), t("分类"), t("商店 / 收款方"), t("数量"), t("单位"), t("金额"), t("货币"), t("关联库存")]];
    for (const p of list) {
      rows.push([ymd(p.purchased_at), p.name, catName(p.category), storeOf(p), p.quantity == null ? "" : num(p.quantity), p.unit ? t(p.unit) : "",
        p.amount == null ? "" : num(p.amount), p.currency || "", p.item_id ? t("是") : t("否")]);
    }
    download(`${fileBase}-${t("采购明细")}.csv`, toCsv(rows));
    return toast(t("已导出 {n} 笔明细", { n: list.length }));
  }

  // 汇总：只统计当前地区货币，其他币种和未填金额的笔数在文末说明
  const cur = Units.region.currency;
  const valid = list.filter((p) => p.amount != null && (!p.currency || p.currency === cur));
  const skipped = list.filter((p) => p.amount != null && p.currency && p.currency !== cur).length;
  const noAmount = list.filter((p) => p.amount == null).length;
  const cats = STAT_CATS();
  const grid = Array.from({ length: 12 }, () => Object.fromEntries(cats.map((c) => [c.id, 0])));
  const stores = new Map();
  for (const p of valid) {
    const m = new Date(p.purchased_at).getMonth();
    const c = statCat(p.category);
    grid[m][c] += num(p.amount);
    const k = storeKey(storeOf(p)) || "__none__";
    const st = stores.get(k) || { name: storeOf(p) || t(STORE_NONE.name), count: 0, total: 0 };
    st.count++; st.total += num(p.amount); stores.set(k, st);
  }
  const used = cats.filter((c) => grid.some((g) => g[c.id] > 0));
  const catYear = (id) => grid.reduce((a, g) => a + g[id], 0);
  const yearTotal = valid.reduce((a, p) => a + num(p.amount), 0);
  const rows = [
    [t("{hh} {y} 年采购花费汇总", { hh, y: year })],
    [t("货币：{cur}", { cur }), t("导出时间：{d}", { d: new Date().toLocaleString(locale()) })],
    [],
    [t("月份"), ...used.map((c) => t(c.name)), t("合计")],
  ];
  grid.forEach((g, i) => rows.push([t("{m}月", { m: i + 1 }), ...used.map((c) => r2(g[c.id])), r2(used.reduce((a, c) => a + g[c.id], 0))]));
  rows.push([t("全年"), ...used.map((c) => r2(catYear(c.id))), r2(yearTotal)]);
  rows.push([t("占比"), ...used.map((c) => (yearTotal ? `${r2((catYear(c.id) / yearTotal) * 100)}%` : "")), "100%"]);
  rows.push([], [t("商店"), t("次数"), t("合计"), t("平均每次"), t("占比")]);
  [...stores.values()].sort((a, b) => b.total - a.total).forEach((st) =>
    rows.push([st.name, st.count, r2(st.total), r2(st.total / st.count), yearTotal ? `${r2((st.total / yearTotal) * 100)}%` : ""]));
  if (skipped || noAmount) rows.push([], [t("说明：{a}{b}明细表中仍可查看。", { a: skipped ? t("{n} 笔非 {cur} 记录未计入；", { n: skipped, cur }) : "", b: noAmount ? t("{n} 笔未填金额；", { n: noAmount }) : "" })]);
  download(`${fileBase}-${t("花费汇总")}.csv`, toCsv(rows));
  toast(t("已导出 {y} 年汇总，共 {n} 笔", { y: year, n: valid.length }));
}
