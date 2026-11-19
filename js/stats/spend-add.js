import { LOADING } from "./spend-drill.js";
import { SPEND_TABS, activeTab } from "../core/tabs.js";
import { catOf, esc, fmt } from "../core/util.js";
import { consumptionData, ensureFirstYear, itemSeries, noSpend, rangeMonths } from "./spend-roll.js";
import { financeOk } from "../core/finance-access.js";
import { href } from "../core/router.js";
import { viewAnnualExport, viewStoreStats } from "./spend-stores.js";
import { natureOptions } from "../core/taxonomy.js";
import { normRange } from "../core/time-range.js";
import { spendCategoryTab, spendHref, spendOverviewTab } from "./spend-overview.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";
import { tabBar } from "../core/hub.js";
import { tripDatalist } from "./spend-trips.js";
import { viewHomeStats } from "./home-stats.js";
import { categoryOptions } from "../pantry/meals-sync.js";
import { cardSelectHtml } from "../bills/card-picker.js";
import { cardHintHtml } from "../bills/cards-review.js";
import { propertyOptions, spendExportTab, timeBarHtml } from "./add-lite.js";
import { activeProps } from "./add-lite-common.js";
import { spendRecordsHtml } from "./spend-records.js";
import { lastStore, storeDatalist } from "./store-lite.js";
export { activeProps } from "./add-lite-common.js";
export { propertyOptions, rangeLabel, spendExportTab, timeBarHtml } from "./add-lite.js";

function spendRecordsTab() {
  const today = new Date().toISOString().slice(0, 10), q = state.route?.q;
  const preCat = q?.get("cat") || "", preTrip = q?.get("trip") || "";   // 从「按行程」进来：分类预选旅行、行程预填
  const open = !!state.spendAddOpen || !!q?.get("add");   // 表单默认收着，点「手动记一笔」或从「记一笔花费」按钮进来才展开
  return `<section class="section">
      <div class="section-head"><h2>${t("记一笔花费")}</h2><p>${t("没走购物车的，在这里记")}</p></div>
      <div class="entry-ways" role="group" aria-label="${esc(t("三种记法"))}">
        <button type="button" class="way ${open ? "is-cur" : ""}" data-action="spend-add-toggle" aria-expanded="${open ? "true" : "false"}"><span class="way-ico" aria-hidden="true">✍️</span><span>${t("手动记一笔")}</span></button>
        <a class="way" href="${href("pantry", "scan")}"><span class="way-ico" aria-hidden="true">📷</span><span>${t("拍小票识别")}</span></a>
        ${financeOk() ? `<a class="way" href="${href("bills", "statements")}"><span class="way-ico" aria-hidden="true">🏦</span><span>${t("导入对账单")}</span></a>` : ""}</div>
      ${storeDatalist()}
      ${open ? "" : "<!-- 表单收着 -->"}
      <form id="purchaseForm" class="panel add-row purchase-row" ${open ? "" : "hidden"}>
        <input class="pr-name" name="name" required maxlength="60" placeholder="${t("买了什么，例如：超市采购")}" aria-label="${t("名称")}">
        <select class="pr-cat" name="category" aria-label="${t("分类")}">${categoryOptions(preCat || undefined, { spend: true })}</select>
        <input class="pr-trip" name="trip" maxlength="30" list="tripList" value="${esc(preTrip)}" placeholder="${t("行程（旅行）")}" aria-label="${t("所属行程")}">${tripDatalist()}
        <input class="pr-amt" name="amount" type="number" min="0" step="0.01" inputmode="decimal" required placeholder="${t("金额（{cur}）", { cur: Units.region.currency })}" aria-label="${t("金额")}">
        <input class="pr-store" name="store" maxlength="40" list="storeList" value="${esc(lastStore())}" placeholder="${t("商店（可不填）")}" aria-label="${t("商店")}">
        <input class="pr-date" name="date" type="date" value="${today}" max="${today}" aria-label="${t("日期")}">
        ${cardSelectHtml("card_id", undefined, 'class="pr-card"')}
        <select class="pr-nat" name="nature" data-nosearch aria-label="${t("经济性质")}" title="${esc(t("日常消费 / 资本性 / 投资 / 融资 / 转账：决定算进哪些统计；一般按分类默认就行"))}">${natureOptions("", { leaf: preCat || "fresh" })}</select>
        ${activeProps().length ? `<select class="pr-prop" name="property_id" data-nosearch aria-label="${t("关联房产")}">${propertyOptions("")}</select>` : ""}
        <label class="check-inline pr-refund" title="${esc(t("退货退款、报销收回：记成负数，统计里按净额算"))}"><input type="checkbox" name="refund"><span>${t("退款 / 报销")}</span></label>
        <button class="btn btn-primary pr-go" type="submit">${t("记一笔")}</button>
      </form>
      <p id="purchaseDupHint" class="dup-hint" role="status" hidden></p>
      <p id="purchaseCardHint" class="card-hint-line">${cardHintHtml("fresh", lastStore(), null)}</p>
      <p class="muted cat-hint">${t("分类怎么选：先找一级（生活消费 / 房产住房 / 投资理财 / 财务及其他 / 转账），再找二级。买房买车、装修这类几年一次的大额，性质选「资本性支出」；信用卡还款、自己账户之间转账选「转账」，不算花费。")}</p>
    </section>
    <section class="section" id="spendRecords">${spendRecordsHtml()}</section>`;
}
export function viewSpend() {
  const r = state.route, onSpendPage = r?.section === "bills" && r?.sub === "spend";
  let tab = onSpendPage ? activeTab(r) : "all";
  if (onSpendPage && r.q?.get("tab") === "trips") {   // 以前的「旅行」标签（书签 / 旧链接）：改到 分类 → 旅行 → 按行程
    Object.assign(state.stats, { node: "travel", byTrip: true }); tab = "category";
    history.replaceState(null, "", `${href("bills", "spend")}?tab=category`);
  }
  const ranged = tab === "overview" || tab === "category" || tab === "stores" || tab === "all";
  // 「全部历史」要等最早的年份查到再画，否则会先按今年算（刷新页面时最明显）
  if (!state.stats.firstYear) ensureFirstYear().then((fresh) => { if (fresh) window.dispatchEvent(new Event("spend-data-loaded")); });   // main.js 收到就重画
  const waitFirst = ranged && normRange(state.stats.months) === "all" && !state.stats.firstYear;
  const body = waitFirst ? LOADING() : {
    overview: () => spendOverviewTab(onSpendPage), category: spendCategoryTab, stores: () => viewStoreStats(rangeMonths()) || noSpend(),
    records: spendRecordsTab, export: spendExportTab,
    all: () => `${spendOverviewTab()}${spendCategoryTab()}${viewStoreStats(rangeMonths())}${viewAnnualExport()}${spendRecordsTab()}`,
  }[tab]();
  return `
    <section class="section">
      <div class="section-head"><h2>${t("花费")}</h2><div class="head-acts">${onSpendPage ? `<a class="btn btn-primary btn-sm" href="${href("bills", "spend")}?tab=records&add=1">${t("记一笔花费")}</a>` : ""}</div></div>
      ${onSpendPage ? tabBar(SPEND_TABS, tab, spendHref, t("花费内容")) : ""}
      ${ranged ? timeBarHtml(tab) : ""}
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
    ${state.billsEnabled ? `<div class="panel cta-panel"><div><b>${t("花费统计搬到了 财务 → 花费")}</b><p class="muted">${t("每月花了多少、分类占比、商店、年度报表、补记和花费记录都在那里；这里只看库存的使用趋势。")}</p></div>
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
/** 我的 → 统计：账单模块开着时只看用量趋势（花费在 财务 → 花费）；关掉账单时花费和用量都在这里 */
export function viewStats() {
  return state.billsEnabled ? viewHomeStats() : viewSpend() + viewHomeStats();   // 2026-11-06：原来的消耗趋势并进「家里的数字」（js/stats/home-stats.js）
}
