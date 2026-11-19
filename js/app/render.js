/* 渲染：render()、mountView()（页面函数返回 Promise 时先放「加载中…」）、renderBody()。 */
import { $, listRoute, spaceOf, toast } from "../core/util.js";
import { APP_NAME, applyChrome } from "./chrome.js";
import { FORM_PAGES, TABS_HIDDEN, VIEWS, offPanel, userActing } from "./page-table.js";
import { alertCounts, collectAlerts } from "../core/alerts.js";
import { crumb, viewMenu } from "../menu.js";
import { decoratePrivacy } from "../core/privacy.js";
import { financeFallback, routeBlocked } from "../core/finance-access.js";
import { go } from "../core/router.js";
import { isScanRoute } from "./route.js";
import { keepUnsaved, restoreUnsaved } from "./unsaved.js";
import { maybeAutoSnapshot } from "../bills/nw-logic.js";
import { normalizeFormActions } from "../core/form-actions.js";
import { recalcPayTotal, viewAssetForm, viewBillForm, viewItemForm, viewPropertyList } from "./lazy-modules.js";
import { restoreCarousels } from "../core/carousel.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";
import { viewOtBill } from "./lazy-modules.js";
import { pantryNav } from "../pantry/restock-sync.js";
import { renderInvList } from "./lazy-modules.js";

/** force=true：路由变化，整页重画；false：数据刷新，表单页保持不动 */
export function render(force = true) {
  if (!state.enriched) return;
  document.body.classList.remove("gate");
  applyChrome();
  $("#hhName").textContent = state.household?.name || "";
  const r = state.route;
  const navSection = r.section === "item" ? (state.prevRoute?.section || listRoute(spaceOf(state.editingCat))[0])
    : r.section === "asset" ? (state.prevRoute?.section || "house") : r.section === "bill" || r.section === "otbill" ? (state.prevRoute?.section || "bills")
    : r.section === "shops" ? "shopping" : r.section === "alerts" || r.section === "ai" || r.section === "quick" ? "today" : r.section;   // 注意事项、咩咩咩都是首页的子页，底栏高亮「今日」
  document.querySelectorAll("#tabs a[data-section]").forEach((a) => {
    a.hidden = (a.dataset.section === "house" && !state.houseEnabled) || (a.dataset.section === "bills" && !state.billsEnabled);
    if (a.dataset.section === navSection) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  const openShop = state.shopping.filter((s) => s.status !== "bought").length;
  const sc = $("#shopCount"); sc.hidden = !openShop; sc.textContent = openShop;
  const alertN = alertCounts(collectAlerts()).important;   // 紧急 / 今天 / 尽快三档计入标题
  document.title = alertN ? `(${alertN}) ${t(APP_NAME)}` : t(APP_NAME);
  document.body.classList.toggle("editing", TABS_HIDDEN(r));

  if (!force && FORM_PAGES(r) && $("#main form")) return;
  if (!force && isScanRoute(r) && $("#main .scan-page")) return;   // 录入购物：识别中 / 确认页的改动不被后台同步冲掉（页面还没画出来时，比如直接刷新在这一页，要先画）
  // 数据刷新（后台读完借贷 / 净资产 / 收入、切回标签页、家人改动）会重画整页：先把页面里「每一张」表单还没保存的改动记下来，
  // 画完再填回去，连光标位置一起（11-09：以前只认一份表单名单，新加的表单——比如卡和账户——不在名单里，填到一半 2–3 秒就被冲掉）
  const kept = force || userActing ? null : keepUnsaved();   // 用户自己点的（筛选、清除、展开…）照常按新状态画；只有后台刷新才保留
  try { renderBody(r); } finally { if (kept) restoreUnsaved(kept); }
  restoreCarousels();   // 左右滑动的卡片（今日）：放回刚才看的那张
  { const pf = $("#billPayForm"); if (pf) recalcPayTotal(pf); }   // 缴费表单：先算一次总金额
  { const af = $("#main [data-as-focus]"); if (af) requestAnimationFrame(() => af.scrollIntoView({ block: "start" })); }   // 从账单页点某笔摊派进来：滚到那一笔
  normalizeFormActions($("#main"));   // 所有表单：取消靠左、保存靠右，同一行
  syncEditing();
  decoratePrivacy(r);   // 财务看板的大数字：遮挡模式下模糊（js/core/privacy.js）
}
/** 底部导航隐不隐藏的最终判断：页面里有底部保存栏（.sticky-actions：取消 / 保存）才隐藏，让保存栏贴底；其余页面（列表、详情、没有保存栏的表单）一律保留导航 */
export function syncEditing() { document.body.classList.toggle("editing", !!document.querySelector("#main .sticky-actions")); }
/** 页面函数返回 Promise = 这个页面的代码还没下载（js/core/lazy.js）：先放 面包屑 + 「加载中…」，下载完（还停在这个页面）再重画。返回 true = 已经画好 */
function mountView(pre, out) {
  if (!out || typeof out.then !== "function") { $("#main").innerHTML = pre + out; return true; }
  const key = location.hash;
  $("#main").innerHTML = pre + `<div class="panel empty" role="status">${t("加载中…")}</div>`;
  out.then(() => { if (location.hash === key && state.enriched) render(true); }, (e) => {
    if (location.hash !== key) return;
    $("#main").innerHTML = pre + `<div class="panel empty" role="alert"><strong>${t("页面加载失败")}</strong><p>${t("可能是网络不稳，或者页面有了新版本，没能下载这个页面。点「重试」刷新一下。")}</p><p><button type="button" class="btn btn-primary" data-action="reload-page">${t("重试")}</button></p></div>`;
  });
  return false;
}
function renderBody(r) {
  if (r.section === "item") { mountView("", viewItemForm()); return; }
  if (r.section === "asset") { mountView("", viewAssetForm()); return; }
  if (r.section === "bill") { mountView("", viewBillForm()); return; }
  if (r.section === "otbill") { mountView("", viewOtBill()); return; }
  if (r.section === "house" && !state.houseEnabled) { $("#main").innerHTML = offPanel(t("房屋维护模块已关闭"), "house-enable", t("打开房屋维护")); return; }
  if (r.section === "bills" && !state.billsEnabled) { $("#main").innerHTML = offPanel(t("财务模块已关闭"), "bills-enable", t("打开财务")); return; }
  if (routeBlocked(r)) { $("#main").innerHTML = ""; toast(t("家主还没给你开财务权限")); go(financeFallback(r), { replace: true }); return; }   // 对账单 / 收入 / 预算 / 添加卡：没有财务权限时直接打开网址也跳走
  if (r.section === "bills") maybeAutoSnapshot().then((w) => { if (w && state.route?.section === "bills" && state.route?.sub === "networth") render(false); });   // 本月还没有快照 / 自动快照的数字变了：后台写一行（不挡画面）
  if (r.section === "pantry" && r.sub === "gear" && !state.gearEnabled) { $("#main").innerHTML = crumb(r) + offPanel(t("家居耐用品模块已关闭"), "gear-enable", t("打开家居耐用品")); return; }
  if (r.sub === "menu") { mountView("", r.section === "house" ? viewPropertyList() : viewMenu(r.section)); return; }   // 页签目录页；房屋先列房产
  const v = VIEWS[r.section];
  const view = typeof v === "function" ? v : v[r.sub];
  if (!mountView(crumb(r) + (r.section === "pantry" ? pantryNav(r.sub === "gear" ? "inventory" : r.sub) : ""), view())) return;   // 储藏的每个页面顶上都有页面导航卡片
  if ((r.section === "pantry" && (r.sub === "inventory" || r.sub === "gear"))) renderInvList();
  const hs = r.section === "pantry" && r.sub === "inventory" && r.q.get("space") === "house" ? $("#invSec-house") : r.section === "pantry" && r.sub === "gear" ? $("#invSec-gear") : null;   // 从概览「汽车房屋消耗品」或旧的家居耐用品链接进来：展开并滚到那一块
  if (hs && !state.scrolledHouse) { hs.open = true; state.scrolledHouse = true; requestAnimationFrame(() => hs.scrollIntoView({ block: "start" })); }
  if (!hs) state.scrolledHouse = false;
}
