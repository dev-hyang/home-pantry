import { LOADING } from "./spend-drill.js";
import { SPEND_TABS, activeTab } from "../core/tabs.js";
import { catOf, esc, fmt } from "../core/util.js";
import { consumptionData, ensureFirstYear, itemSeries, noSpend, rangeMonths } from "./spend-roll.js";
import { financeOk } from "../core/finance-access.js";
import { href } from "../core/router.js";
import { viewAnnualExport, viewStoreStats } from "./spend-stores.js";
import { normRange } from "../core/time-range.js";
import { spendCategoryTab, spendHref, spendOverviewTab } from "./spend-overview.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";
import { viewHomeStats } from "./home-stats.js";
import { propertyOptions, spendExportTab, timeBarHtml } from "./add-lite.js";
import { activeProps } from "./add-lite-common.js";
import { spendRecordsHtml } from "./spend-records.js";
import { pageHead } from "../core/page-head.js";
import { fabMenu } from "../core/fab-menu.js";
import { spendFormPage, spendFormParams } from "./spend-form-page.js";
import { spendDetailPage, spendViewParams } from "./spend-detail-page.js";
export { activeProps } from "./add-lite-common.js";
export { propertyOptions, rangeLabel, spendExportTab, timeBarHtml } from "./add-lite.js";

function spendRecordsTab() {
  return `<section class="section" id="spendRecords">${spendRecordsHtml()}</section>`;   // 记一笔 / 拍小票 / 导入对账单 都在右下角圆形 ＋ 的菜单里（记一笔是独立的表单页：spend-form-page.js）
}
/** 右下角圆形 ＋：点开菜单——手动记一笔（表单页）/ 拍小票识别 / 导入对账单 */
const spendFab = () => fabMenu([{ label: t("手动记一笔"), href: `${href("bills", "spend")}?form=new`, icon: "✍️" }, { label: t("拍小票识别"), href: href("pantry", "scan"), icon: "📷" },
  financeOk() ? { label: t("导入对账单"), href: href("bills", "statements"), icon: "🏦" } : null], { label: t("记一笔花费") });
export function viewSpend() {
  const r = state.route, formP = r?.section === "bills" && r?.sub === "spend" ? spendFormParams(r.q) : null;
  const viewP = r?.section === "bills" && r?.sub === "spend" && !formP ? spendViewParams(r.q) : null;
  if (viewP) return spendDetailPage(viewP);   // 详情：只读，分块，每块有自己的编辑
  if (formP) return spendFormPage(formP);   // 记一笔 / 编辑 / 复制：独立的表单页
  const onSpendPage = r?.section === "bills" && r?.sub === "spend";
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
  const bar = ranged ? timeBarHtml(tab) : "";   // 时间条 = 页头右边的筛选按钮（面板里带「金额显示」）；明细自己有筛选条，眼睛在那里面
  const own = tab === "records" && body.includes("ix-toolbar");
  return `
    <section class="section">
      ${onSpendPage ? pageHead({ title: t("花费"), tabs: SPEND_TABS, tab, hrefOf: spendHref, label: t("花费内容"), filter: own ? false : bar }) : `<div class="section-head"><h2>${t("花费")}</h2></div>${bar}`}
      ${body}
      ${onSpendPage ? spendFab() : ""}
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
      <a class="ui-btn" data-tone="primary" href="#/bills/spend">${t("去看花费")}</a></div>` : ""}
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
