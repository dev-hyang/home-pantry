/* 清除筛选（各页统一的一个按钮）：只在这一页的筛选和默认值不同的时候出现；点一下把这一页的筛选恢复默认
 * （服务器分页的列表回到第 1 页，下钻的标签去掉，来自网址的筛选参数用 replaceState 清掉）。
 * 用法：
 *   画工具条时：clearFiltersBtn("bills", changed(state.billsFilter, BILLS_DEFAULT))
 *   初始化时：  onClearFilters("bills", () => { state.billsFilter = { ...BILLS_DEFAULT }; render(false); })
 * 按钮是原生 <button>（键盘 Enter / 空格可用）；清除后按钮消失，焦点移到这一页工具条的第一个输入框，不丢在页面顶上。
 * 样式：一个类 .clear-filters（styles.css），放进各页现有的 .toolbar / 筛选行里，笔记本和手机都排得下。 */
import { t } from "./i18n.js";
import { state } from "./state.js";

/** 各页筛选的默认值（不含排序：排序不是筛选，清除筛选不动它）；页面判断显隐、main.js 恢复默认都用这一份 */
export const FD = {
  inv: { cat: "all", sub: "all", q: "", status: "all", loc: "all" },
  shop: { cat: "all", who: "all" },
  asset: { q: "", type: "all", service: "all", warranty: "all", loc: "all" },
  bills: { property: "all", cat: "all", autopay: "all", channel: "all", q: "" },
  pay: { bill: "all", year: "all", status: "all" },
  spend: { q: "", cat: "all", nat: "all", prop: "all", store: "all", stores: null, grp: null, year: "all", mon: "all", months: null, dmax: null, batch: null },
  med: { q: "", kind: "all", patient: "all", provider: "all", status: "all", year: "all" },
  incRec: { q: "", kind: "all", acct: "all", person: "all", year: "all", month: "all", from: "", to: "", ex: false, batch: null },   // 收入记录（含图表下钻的日期段、导入批次）
  incSend: { person: "all", sq: "", skind: "all" },   // 付款方汇总
  debtP: { q: "", dir: "all", st: "all" },   // 借贷 → 个人借贷
  stmt: { range: "3m", dir: "all", q: "" },   // 全部流水
  gift: { issuer: "all", used: false },   // 卡与账户：礼品卡
  off: { q: "", kind: "all" },             // 卡与账户：停用的卡
  stats: { months: "12", month: null, exCap: true, exInv: true, node: null, byTrip: false, storeL1: "all" },   // 花费统计 / 预算趋势：时间范围、月份、分类树下钻、开关
};
const handlers = new Map();
const checks = new Map();
/** 登记一页的「恢复默认」：fn 负责改状态并重画；isChanged()（可选）= 现在是否和默认不同，边输入边更新按钮显隐（搜索框这类只重画列表、不重画工具条的） */
export const onClearFilters = (key, fn, isChanged = null) => { handlers.set(key, fn); if (isChanged) checks.set(key, isChanged); };
/** 当前筛选和默认值是否不同（只比 keys 里的键；默认比 def 的全部键；数组 / 对象按 JSON 比） */
export const changed = (cur, def, keys = Object.keys(def)) => keys.some((k) => JSON.stringify(cur?.[k] === undefined ? def[k] ?? null : cur[k] ?? null) !== JSON.stringify(def[k] ?? null));   // 没设过（undefined）= 默认
/** 按钮：没改过筛选时带 hidden（登记了 isChanged 的页面边输入边显示） */
export const clearFiltersBtn = (key, show) => `<button type="button" class="btn btn-sm btn-ghost clear-filters" data-clear-filters="${key}"${show ? "" : " hidden"}><span aria-hidden="true">✕ </span>${t("清除筛选")}</button>`;
/** 按登记的 isChanged 更新页面上按钮的显隐 */
export function syncClearButtons() {
  for (const b of document.querySelectorAll("[data-clear-filters]")) { const f = checks.get(b.dataset.clearFilters); if (f) { try { b.hidden = !f(); } catch { /* 页面状态还没准备好：不动 */ } } }
}
// 筛选控件改了：页面自己的监听先跑（在 #main 上），这里在 document 上随后更新；搜索框多半是防抖的，再晚一点补一次
let syncTimer = 0;
for (const ev of ["input", "change"]) document.addEventListener(ev, () => { syncClearButtons(); clearTimeout(syncTimer); syncTimer = setTimeout(syncClearButtons, 450); });
/** 把网址（#/路径?参数）里的这些参数去掉：replaceState，不新增历史；state.route.q 同步 */
export function clearUrlParams(names) {
  const [path, qs = ""] = location.hash.split("?"), p = new URLSearchParams(qs);
  if (names === "*") names = [...p.keys()].filter((k) => k !== "tab");   // 除了页签，全部去掉
  let hit = false;
  for (const n of names) { if (p.has(n)) { p.delete(n); hit = true; } state.route?.q?.delete?.(n); }
  if (!hit) return false;
  const s = p.toString();
  history.replaceState(history.state, "", `${location.pathname}${location.search}${path}${s ? `?${s}` : ""}`);
  return true;
}

document.addEventListener("click", (e) => {
  const b = e.target.closest?.("[data-clear-filters]"); if (!b) return;
  const fn = handlers.get(b.dataset.clearFilters); if (!fn) return;
  e.preventDefault(); e.stopPropagation();
  const scope = b.closest(".toolbar, .filter-bar, [data-filters]");
  const sel = scope?.id ? `#${CSS.escape(scope.id)}` : null;
  Promise.resolve(fn()).finally(() => requestAnimationFrame(() => {
    const root = (sel && document.querySelector(sel)) || document.getElementById("main");
    root?.querySelector('input[type="search"], .toolbar input, .toolbar select, [data-filters] input, [data-filters] select')?.focus({ preventScroll: true });
  }));
});
