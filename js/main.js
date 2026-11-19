import "./core/autosize.js";
import { initPrivacy, setPrivacyRoute } from "./core/privacy.js";
import { state } from "./core/state.js";
import { $, toast } from "./core/util.js";
import { debounce } from "./core/pager.js";
import { renderAllList } from "./bills/all-views.js";
import { initCompactFilters, watchStick } from "../shared/compact-filters.js";
import { miniBarEl } from "./minibar.js";
import "./core/long-press.js";
import { initSwipeRows } from "./swipe-rows.js";
import { initQuickDrag } from "./quick-drag.js";
import { initSelectSearch } from "./select-search.js";
import "./bills/cards.js";
import { t } from "./core/i18n.js";
import { initTodayRender, saveQuick } from "./today.js";
import { registerAlerts } from "./core/alerts.js";
import { pantryAlertItems } from "./core/logic.js";
import { billAlertItems } from "./bills/logic.js";
import { budgetAlertItems } from "./bills/budget.js";
import "./settings/income.js";
import { escrowAlertItems } from "./bills/escrow.js";
import "./bills/finance.js";
import "./bills/finance-alerts.js";
import { maintFilter } from "./house/assets-logic.js";
import { payeeInput } from "./stats/payees.js";
import { initHomeStats } from "./stats/home-stats.js";
import { refresh } from "./app/data.js";
import { renderAssetList, renderMaintLogs, shiftAlertSource, shiftTasksMonth, updateHoaTotal } from "./app/lazy-modules.js";
import { boot } from "./app/boot.js";
import { markDirty } from "./app/unsaved.js";
import { render, syncEditing } from "./app/render.js";
import { uiKind } from "./app/chrome.js";
import "./app/lazy-modules.js";
import "./app/lazy-init.js";
import "./app/page-table.js";
import "./app/route.js";
import "./app/page-events.js";
import "./app/auth/login.js";
import "./app/auth/household.js";
import { drillTo, pickRow, pickShop } from "./app/events/selection.js";
import { onMainChange } from "./app/events/change.js";
import { onMainClick } from "./app/events/click.js";
import { onMainSubmit } from "./app/events/submit.js";
import { renderInvList, renderShopList, setFold } from "./app/lazy-modules.js";
import { viewCards } from "./app/lazy-modules.js";
import { renderSpendList } from "./app/lazy-modules.js";

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});
// 提醒总线：各模块的适配器（新增提醒来源只需在这里注册一个函数）
[pantryAlertItems, billAlertItems, budgetAlertItems, escrowAlertItems].forEach(registerAlerts);
/* ───────────── 交互（事件委托） ───────────── */
export const main = $("#main");
// 页面局部重画（行内表单打开 / 关闭、保存栏出现 / 消失）时，底部导航跟着保存栏走：有保存栏才隐藏
let editingQueued = false;
new MutationObserver(() => { if (editingQueued) return; editingQueued = true; requestAnimationFrame(() => { editingQueued = false; syncEditing(); }); }).observe(main, { childList: true, subtree: true });
// 手机：列表页的“搜索 + 一排下拉框”收成一行（搜索框 + 筛选按钮），滑动时固定在顶栏 / 路径下面；路径条（面包屑）也固定
initCompactFilters({ root: main, ui: uiKind });
miniBarEl();
   // 手机上滚动后固定的站名窄条（js/minibar.js）
document.addEventListener("toggle", (e) => { const d = e.target; if (d?.matches?.("details.pv-card[data-fold]")) setFold(d.dataset.fold, d.open); }, true);
   // 储藏概览大卡片折叠 / 展开：记在本机
initSwipeRows({ kinds: ["asset", "rs", "item", "income", "budget-goal", "med-pay", "person", "bill-pay", "maint", "shop", "purchase", "card", "store", "deal"], altKinds: ["asset", "card", "deal", "shop", "item", "rs"], del: () => t("删除"), release: () => t("松手删除"), alt: () => t("停用"), altRelease: () => t("松手停用") });
initHomeStats(render);
initTodayRender(() => render());
   // 今日天气取回来后重画
initPrivacy({ toast });
 setPrivacyRoute(() => state.route);
   // 金额遮挡：外出 / 在家两种模式；表格 / 图表局部重画时按当前页面再标   // 我的 → 家里的数字：近一年日志读完后重画
initSelectSearch();
   // 选项很多的下拉（分类等）变成可搜索的（js/select-search.js）
initQuickDrag({ isEditing: () => !!state.quickEdit, enter: () => { state.quickEdit = true; state.quickAdd = false; render(); }, save: async (ids) => { try { await saveQuick(ids); } catch (e) { toast(t("保存失败：{msg}", { msg: e.message })); } render(); } });
   // 今日页快捷操作：长按进入编辑并拖动排序   // 银行 / 信用卡 CSV 导入（花费 → 银行导入）
// 「⋯」更多操作菜单：点别处或点菜单里的某项就收起（原生 details 不会自己收）
document.addEventListener("click", (e) => { document.querySelectorAll("details.act-more[open]").forEach((d) => { if (!d.contains(e.target) || e.target.closest(".act-item")) d.open = false; }); }, true);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") document.querySelectorAll("details.act-more[open]").forEach((d) => { d.open = false; d.querySelector("summary")?.focus(); }); });
watchStick({ header: () => document.querySelector(window.matchMedia("(max-width: 440px)").matches ? "#minibar" : ".topbar"), path: ".crumb" });
/* 左右滑动换页：季节任务换月（.tasks-swipe）、注意事项换来源（.swipe-zone[data-swipe=alerts]）；横向够远、纵向很小才算 */
let swipe = null;
main.addEventListener("touchstart", (e) => { const z = e.target.closest(".tasks-swipe, .swipe-zone"); swipe = z && e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY, kind: z.dataset.swipe || "tasks" } : null; }, { passive: true });
main.addEventListener("touchend", (e) => {
  if (!swipe) return;
  const { x, y, kind } = swipe; swipe = null;
  const dx = e.changedTouches[0].clientX - x, dy = e.changedTouches[0].clientY - y;
  if (Math.abs(dx) < 60 || Math.abs(dy) > 50) return;
  if (kind === "alerts") { shiftAlertSource(dx < 0 ? 1 : -1); return render(); }
  if (!document.querySelector(".month-nav")) return;
  shiftTasksMonth(dx < 0 ? 1 : -1); render();
}, { passive: true });
const searchSoon = debounce((fn) => fn());
document.addEventListener("click", (e) => { const d = document.querySelector("details.bill-fab[open]"); if (d && !d.contains(e.target)) d.open = false; });
main.addEventListener("input", (e) => {
  // 搜索框：筛选条件马上记下，列表停下 ~200ms 再重画（不是每敲一个字都重画整张列表）
  if (e.target.id === "invSearch") { state.filter.q = e.target.value; searchSoon(renderInvList); }
  if (e.target.id === "shopQ") { state.shopFilter.q = e.target.value; searchSoon(renderShopList); }   // 购物车搜索：只重画清单那块
  if (e.target.id === "maintSearch") { maintFilter.q = e.target.value; searchSoon(renderMaintLogs); }
  if (e.target.id === "spendSearch") { state.spendFilter.q = e.target.value; searchSoon(renderSpendList); }   // 停下 ~200ms 再查数据库
  if (payeeInput(e, searchSoon)) return;   // 收款方：搜索、合并后的名字
  if (e.target.id === "allSearch") { state.allFilter.q = e.target.value; searchSoon(renderAllList); }
  if (e.target.id === "assetSearch") { state.assetFilter.q = e.target.value; searchSoon(renderAssetList); }
  if (e.target.id === "offQ") {   // 停用的卡搜索：只重画那张列表，输入框不丢焦点
    (state.offFilter ||= { q: "", kind: "all", sort: "since" }).q = e.target.value;
    const panel = e.target.closest("details");
    searchSoon(() => { const ul = panel?.querySelector("ul.card-list"); if (!ul) return; const tmp = document.createElement("div"); tmp.innerHTML = viewCards(); const fresh = tmp.querySelector("details.ref-panel ul.card-list"); if (fresh) ul.replaceWith(fresh); });   // 整页 viewCards() 较重：停下再算
  }
  const df = e.target.closest("#dealForm, #dealTaskForm, #dealEventForm, #closeoutForm, #propertyForm, #planForm, #candForm, #offerForm"); if (df) markDirty(df, true);   // 提示还没保存
  if (e.target.matches("textarea[data-grow]")) autoGrow(e.target);
  const hf = e.target.closest("#houseForm"); if (hf && /^hoa_(dues|sa_)/.test(e.target.name || "")) updateHoaTotal(hf);   // HOA 金额 / 评估字段一改，每月总计卡马上重算
});
/** 说明 / 备注框：随内容长高（空着一行），接近上限时显示计数 */
function autoGrow(el) {
  el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`;
  const c = el.nextElementSibling; if (c?.classList.contains("grow-count")) { const max = +el.maxLength || 0; c.hidden = !(max && el.value.length >= max * 0.8); c.textContent = `${el.value.length}/${max}`; }
}
main.addEventListener("change", onMainChange);
// 记录性质的日期框带 max（不能晚于今天）：选择器里已经灰掉；表单多是 novalidate，手动输入的未来日期在这里统一拦住。
// 到期日、预约、计划这些能选未来的日期框不带 max，不受影响。
document.addEventListener("submit", (e) => {
  const late = [...e.target.querySelectorAll('input[type="date"][max], input[type="month"][max]')].find((el) => el.validity.rangeOverflow);
  if (!late) return;
  e.preventDefault(); e.stopImmediatePropagation();
  toast(t("日期不能晚于 {d}", { d: late.max })); late.focus();
}, true);
main.addEventListener("submit", onMainSubmit);
main.addEventListener("change", (e) => { if (e.target.matches?.(".shop-chk")) pickShop(e.target.dataset.id, e.target.checked); });
main.addEventListener("click", (e) => {
  const row = e.target.closest?.("[data-row-sel-shop]"); if (!row || e.target.closest("a, button, input, select, textarea, label, details")) return;
  pickShop(row.dataset.rowSelShop, !state.shopSel?.has(row.dataset.rowSelShop));
});
main.addEventListener("change", (e) => { if (e.target.matches?.(".inv-chk")) pickRow(e.target.dataset.selId, e.target.checked); });
main.addEventListener("click", (e) => {
  const row = e.target.closest?.("[data-row-sel]"); if (!row || e.target.closest("a, button, input, select, textarea, label")) return;
  if (e.target.closest(".inv-link")) return;
  pickRow(row.dataset.rowSel, !state.invSel?.has(row.dataset.rowSel));
});
/* 点行进编辑（2026-11-14）：带 data-row-open 的行，点到行里任何不是按钮 / 链接 / 输入框的地方，就打开它的编辑页 */
main.addEventListener("click", (e) => {
  const row = e.target.closest?.("[data-row-open]"); if (!row || e.defaultPrevented) return;
  if (e.target.closest("a, button, input, select, textarea, label, summary, [data-action]")) return;
  if (window.getSelection?.().toString()) return;   // 在选字，不跳
  location.hash = row.dataset.rowOpen.replace(/^#/, "");
});
/* 其余列表（账单、设备、花费、补货提醒、分类视图的物品卡…）同样点行就进编辑：行里只有一个「名称」链接 / 编辑按钮时，
 * 点行里任何不是按钮 / 链接 / 输入框的地方，等于点了它。行里有好几个名称链接的（不知道该去哪）不处理 */
const ROW_PRIMARY = 'a.link-name, a.asset-name, .item-title > button[data-action="edit"], .grow > button.link-name[data-action="edit"]';
main.addEventListener("click", (e) => {
  if (e.defaultPrevented || e.target.closest?.("[data-row-open], [data-row-sel], a, button, input, select, textarea, label, summary, [data-action], [data-drill], form, .crumb, nav")) return;
  const row = e.target.closest?.("li, article.item"); if (!row || !main.contains(row)) return;
  if (window.getSelection?.().toString()) return;
  const cands = [...row.querySelectorAll(ROW_PRIMARY)].filter((el) => el.closest("li, article.item") === row);
  if (cands.length === 1) cands[0].click();
});
main.addEventListener("click", (e) => { const d = e.target.closest?.("[data-drill]"); if (d) { e.preventDefault(); drillTo(d.dataset.drill); } });
main.addEventListener("keydown", (e) => { if (e.key !== "Enter" && e.key !== " ") return; const d = e.target.closest?.("[data-drill]"); if (d && !(d instanceof HTMLButtonElement)) { e.preventDefault(); drillTo(d.dataset.drill); } });
main.addEventListener("click", onMainClick);
boot();

