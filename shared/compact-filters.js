/* 紧凑筛选条（手机）：列表页顶部的“搜索框 + 一排下拉框”在手机上要占三四行，把列表挤到屏幕下方（头重脚轻）。
 * 这里把它收成一行：搜索框 + “筛选 (n)” 按钮；点开才展开下拉框（浮在列表上，不把内容顶下去），n 是已经改过的筛选个数；
 * 这一行在手机上滑动时固定在顶栏 / 路径下面。宽屏完全不变。
 * 做法：运行时把 .toolbar 里的 select 收进一个面板，宽屏用 display: contents 还原成原来的排版，所以不用管各页的写法；
 * 页面重画后由 MutationObserver 重新处理，各页原有的 change 事件、id 都不受影响。
 *
 * 接入：
 *   import { initCompactFilters } from "https://dev-hyang.github.io/home-pantry/shared/compact-filters.js";
 *   initCompactFilters({ root: document.getElementById("main"), ui: () => "zh" | "tw" | "en" });
 * 固定位置依赖两个 CSS 变量（各站自己设）：--eco-stick = 顶栏（和路径条）占的高度；不设则贴在最上面。 */

const TEXT = { zh: "筛选", tw: "篩選", en: "Filters" };
const CSS = `
.toolbar.tb-on .tb-toggle { display: none; }
.toolbar.tb-on .tb-panel { display: contents; }
@media (max-width: 440px) {
  .toolbar.tb-on { position: sticky; top: calc(var(--eco-stick, 0px) + env(safe-area-inset-top, 0px)); z-index: 14; flex-wrap: nowrap; align-items: center; gap: 8px; margin: 0 0 8px; padding: 8px 0; background: var(--eco-tb-bg, var(--bg, #fff)); }
  .panel > .toolbar.tb-on, .panel .toolbar.tb-on { background: var(--eco-tb-bg, var(--surface, #fff)); }
  .toolbar.tb-on > input[type="search"] { flex: 1 1 auto; min-width: 0; width: auto; }
  .toolbar.tb-on .tb-toggle { display: inline-flex; align-items: center; gap: 6px; flex: 0 0 auto; min-height: 44px; padding: 0 14px; border: 1px solid var(--line, #cfdcd2); border-radius: 12px; background: var(--surface, #fff); color: inherit; font: inherit; font-size: 15px; font-weight: 600; cursor: pointer; }
  .toolbar.tb-on .tb-toggle[aria-expanded="true"] { background: var(--surface-2, var(--bg, #e3ebe4)); }
  .toolbar.tb-on .tb-toggle:focus-visible { outline: 3px solid var(--focus, #1f6feb); outline-offset: 2px; }
  .tb-count { display: inline-flex; align-items: center; justify-content: center; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 10px; background: var(--ink, #1e3a32); color: var(--bg, #fff); font-size: 12px; font-weight: 700; }
  .tb-count[hidden] { display: none; }
  .toolbar.tb-on .tb-panel { display: none; position: absolute; left: 0; right: 0; top: 100%; z-index: 15; grid-template-columns: 1fr 1fr; gap: 8px; padding: 10px; background: var(--surface, #fff); border: 1px solid var(--line, #cfdcd2); border-radius: 12px; box-shadow: 0 12px 28px rgba(0, 0, 0, .16); }
  .toolbar.tb-on .tb-panel.open { display: grid; }
  .toolbar.tb-on .tb-panel select { width: 100%; min-width: 0; flex: none; }
}
@media print { .tb-toggle { display: none !important; } .toolbar.tb-on { position: static !important; } .toolbar.tb-on .tb-panel { display: contents !important; position: static; } }
`;
let styled = false;

/** 已改动的筛选个数：下拉框不是第一项（“全部”）；排序下拉不算筛选 */
const activeCount = (panel) => [...panel.querySelectorAll("select")].filter((s) => !/sort|order/i.test(s.id || s.name || "") && s.selectedIndex > 0).length;

export function initCompactFilters({ root = document.body, ui = () => "zh", selector = ".toolbar" } = {}) {
  if (!styled) { const st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st); styled = true; }
  const label = () => TEXT[ui()] || TEXT.zh;
  let seq = 0;
  const refresh = (tb) => {
    const panel = tb.querySelector(":scope > .tb-panel"), btn = tb.querySelector(":scope > .tb-toggle"); if (!panel || !btn) return;
    const n = activeCount(panel), c = btn.querySelector(".tb-count");
    c.textContent = n; c.hidden = !n;
    btn.firstChild.textContent = label();
  };
  const setup = (tb) => {
    if (tb.classList.contains("tb-on") || tb.querySelectorAll(":scope > select").length < 2) return;
    const selects = [...tb.querySelectorAll(":scope > select")];
    const panel = document.createElement("div"); panel.className = "tb-panel"; panel.id = `tbp${++seq}`;
    selects.forEach((s) => panel.appendChild(s));
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "tb-toggle"; btn.setAttribute("aria-expanded", "false"); btn.setAttribute("aria-controls", panel.id);
    btn.innerHTML = `${label()}<span class="tb-count" hidden>0</span>`;
    const search = tb.querySelector(":scope > input"); (search ? search.after(btn) : tb.prepend(btn));
    tb.appendChild(panel); tb.classList.add("tb-on");
    refresh(tb);
  };
  const scan = () => root.querySelectorAll(selector).forEach(setup);
  new MutationObserver(() => scan()).observe(root, { childList: true, subtree: true });
  scan();
  root.addEventListener("click", (e) => {
    const btn = e.target.closest?.(".tb-toggle");
    if (btn) { const panel = document.getElementById(btn.getAttribute("aria-controls")); const open = !panel.classList.contains("open"); panel.classList.toggle("open", open); btn.setAttribute("aria-expanded", String(open)); return; }
    // 点面板外：收起
    root.querySelectorAll(".tb-panel.open").forEach((p) => { if (!p.contains(e.target)) { p.classList.remove("open"); document.querySelector(`[aria-controls="${p.id}"]`)?.setAttribute("aria-expanded", "false"); } });
  });
  root.addEventListener("change", (e) => { const tb = e.target.closest?.(`${selector}.tb-on`); if (tb) refresh(tb); });
  root.addEventListener("keydown", (e) => { if (e.key === "Escape") root.querySelectorAll(".tb-panel.open").forEach((p) => { p.classList.remove("open"); const b = document.querySelector(`[aria-controls="${p.id}"]`); b?.setAttribute("aria-expanded", "false"); b?.focus(); }); });
}

/** 把“顶栏高度 / 路径条高度”写成 CSS 变量：--eco-h（顶栏）、--eco-p（路径条）、--eco-stick（两者之和），固定定位的元素用它们叠在一起不重叠 */
export function watchStick({ header, path } = {}) {
  const root = document.documentElement;
  // header 可以是选择器，也可以是返回元素的函数（手机上固定的是窄条，宽屏上是顶栏）
  const h = () => (typeof header === "function" ? header() : header ? document.querySelector(header) : null), p = () => (path ? document.querySelector(path) : null);
  const set = () => {
    const he = h(), pe = p();
    const hh = he && getComputedStyle(he).position !== "static" ? Math.round(he.getBoundingClientRect().height) : 0;
    const ph = pe && getComputedStyle(pe).position === "sticky" ? Math.round(pe.getBoundingClientRect().height) : 0;
    root.style.setProperty("--eco-h", `${hh}px`); root.style.setProperty("--eco-p", `${ph}px`); root.style.setProperty("--eco-stick", `${hh + ph}px`);
  };
  const ro = new ResizeObserver(set);
  const watch = () => { [h(), p()].forEach((el) => el && ro.observe(el)); set(); };
  let queued = false;
  new MutationObserver(() => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; watch(); }); }).observe(document.body, { childList: true, subtree: true });
  window.addEventListener("resize", set); watch();
}
