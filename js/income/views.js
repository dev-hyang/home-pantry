/* 收入页（#/bills/income）：页面外壳 + 路由到各个页签。各页签、表单、导出、事件分在同目录的文件里（overview-tab / types-tab / records-tab / record-form / senders-tab / compare-tab / export-ai / events），公共小件在 shared.js。 */
import { state } from "../core/state.js";
import { Store } from "../core/store.js";
import { esc } from "../core/util.js";
import { attentionPanel } from "../core/alerts.js";
import { t } from "../core/i18n.js";
import { tabCards } from "../core/hub.js";
import { moneyEye } from "../core/privacy.js";
import { moreMenu } from "../core/more-menu.js";
import { fabMenu } from "../core/fab-menu.js";
import { incomeHref as hrefOfTab } from "./shared.js";
import { INCOME_TABS, activeTab } from "../core/tabs.js";
import { pageSize } from "../core/pager.js";
import { canSeeAll, inc, loadIncome } from "./logic.js";
import { rerender } from "./rollup.js";
import "./list.js";
import { applyIncomeDrill, importTab, recordsTab } from "./records-tab.js";
import { categoryTab } from "./types-tab.js";
import { exportTab, planTab } from "./export-ai.js";
import { overviewTab } from "./overview-tab.js";
import { reportTab } from "./compare-tab.js";
import { sendersTab } from "./senders-tab.js";
import { incomeDetailPage, incomeFormPage } from "./detail-page.js";
export { initIncome } from "./events.js";   // 页面加载后由 app/lazy-init.js 调用（注册点击等处理）
import { incomeHref, staleAll } from "./shared.js";

window.addEventListener("income-data-changed", () => staleAll(["inc", "ledger"]));
window.addEventListener("spend-rows-changed", () => staleAll(["spend", "ledger"]));
/* ───────────── 页面外壳 ───────────── */
/** 页头：「💰 收入 · 当前页签」+ 紧跟着的眼睛；右上角 ⋯ 放次要页签（导出打印）；记一笔收入 / 拍照识别 / 银行导入是右下角圆形 ＋ 的菜单 */
const headMenu = () => {
  const items = INCOME_TABS.filter((x) => x[4] && x[0] !== "import").map(([id, name, icon]) => ({ label: `${icon} ${t(name)}`, href: hrefOfTab(id) }));
  if (items.length) items[0].first = true;
  return moreMenu(items, { label: t("更多操作") });
};
const incomeFab = () => fabMenu([{ label: t("手动记一笔"), data: { inc: "add" }, icon: "✍️" }, { label: t("拍照识别"), data: { inc: "scan" }, icon: "📷" }, { label: t("银行导入"), href: hrefOfTab("import"), icon: "🏦" }], { label: t("记一笔收入") });
const shell = (tab, body) => {
  const cur = INCOME_TABS.find(([id]) => id === tab);
  return `<section class="section" id="incomePage">
  <div class="section-head"><div class="sh-title"><h2>💰 ${t("收入")} · ${esc(t(cur?.[1] || ""))}</h2></div><div class="head-acts">${moneyEye()}${headMenu()}</div></div>
  ${tabCards(INCOME_TABS, tab, incomeHref, t("收入内容"))}${noticeHtml()}${tab === "overview" || tab === "records" ? attentionPanel(["income"], { title: t("要处理"), sub: t("该收的还款") }) : ""}${body}
  ${incomeFab()}</section>`;
};
function noticeHtml() {
  const I = inc();
  if (!I.ok) return `<div class="notice" role="alert"><b>${t("还没执行数据库迁移 042（收入表）：先在 Supabase → SQL Editor 里执行 supabase/migrations/042_income_records.sql，再刷新。")}</b><br><small>${esc(I.err)}</small></div>`;
  const parts = [];
  if (Store.mode === "demo") parts.push(t("演示模式的数据只存在这台设备的浏览器里，没有账号隔离；登录云端家庭后，收入由数据库按「家主 / 已允许 / 自己记的」隔离。"));
  else if (!canSeeAll()) parts.push(t("你只能看到自己记的收入；家主在 设置 → 家庭与成员 给你开财务权限后，才能看全家的。"));
  return parts.length ? `<div class="notice" role="status">${parts.map(esc).join("<br>")}</div>` : "";
}
export function viewIncome() {
  const I = inc(), tab = activeTab(state.route) || "overview", qView = state.route?.q?.get("view"), qForm = state.route?.q?.get("form");
  if (!qForm && I._formPage) { I.form = null; I._formPage = false; }   // 从编辑页退回来（浏览器返回）：别把没存的表单带到列表顶部
  if (I._lastTab !== undefined && I._lastTab !== tab) { if (I._keep) I._keep = false; else { I.form = null; I.scanOpen = false; I.selMode = false; } }   // 换标签：不带着没关的表单 / 识别面板
  I._lastTab = tab;
  const qb = state.route?.q?.get("batch");   // 银行导入「查看收入」：只看这一批入账
  if (qb && I.batchFrom !== qb) { I.batch = qb; I.batchFrom = qb; Object.assign(I, { q: "", kind: "all", acct: "all", year: "all", person: "all", limit: pageSize(), from: "", to: "", ex: false }); } else if (!qb) I.batchFrom = null;
  const dqs = tab === "records" && state.route?.q?.get("inc") ? state.route.q.toString() : "";   // 概览 / 类型图表点进来：套上对应筛选（同一个链接只套一次，之后用户改筛选不被覆盖）
  if (dqs && I.drillFrom !== dqs) { I.drillFrom = dqs; applyIncomeDrill(state.route.q); } else if (!dqs) I.drillFrom = null;
  if (!I.loaded && !I.loading) { I.loading = true; loadIncome().finally(() => { I.loading = false; rerender(); }); }
  if (!I.loaded) return shell(tab, `<div class="panel empty"><strong>${t("加载中…")}</strong></div>`);
  if (tab === "records" && qForm) return incomeFormPage(qForm);   // 详情页 / 编辑页：单独一页，不带页签和圆形 ＋
  if (tab === "records" && qView) return incomeDetailPage(qView);
  const body = { overview: overviewTab, records: recordsTab, category: categoryTab, senders: sendersTab, compare: reportTab, import: importTab, export: exportTab, plan: planTab }[tab]();
  return shell(tab, I.ok || tab === "plan" ? body : "");
}
