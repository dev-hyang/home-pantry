/* ============ 行记录左滑删除 ============
   只用在「具体某一种记录」的行上：行里加 data-swipe-del="种类"，并且这个种类要列在 initSwipeRows({ kinds: […] }) 里
   （没列的种类、没加属性的行一律不会滑动）。行里原来的「删除」按钮加 class="swipe-src"，滑动时代它点击，原来的确认框、删除流程都照旧。
     · 向左滑：行里的内容跟着手指向左走，右边露出红色「删除」；停在一半，点红色区域就删除；
     · 一直滑过大半（≥ 55%）松手：直接删除；
     · 向右滑：暂时没有动作；点别处、往上下滚：已经滑开的行自动合上。
   键盘 / 读屏：原来的删除按钮还在（平时视觉隐藏，Tab 到它时显示），不用手势也能删。行里的输入框、下拉框不响应滑动。

   对行本身零改动：不换标签、不套层、不往行里加子元素（红色区域是 CSS 伪元素 ::after），所以原来给行写的
   flex / grid、:last-child、分隔线等样式全部照旧；只是给这一行加 class="swipe-row"（见样式表里的说明）。
   四个姐妹应用各放一份同样的文件。用法：initSwipeRows({ kinds, del, release, onDelete })，del / release 是文字或返回文字的函数；
   onDelete(行元素) 可选：没有 .swipe-src 的行（例如小月亮的记录行）用它来做删除，返回 false 表示用户取消了（行弹回去）。 */
const REVEAL = 88;      // 停住时露出的红色区域宽度（px）
const GO = 0.55;        // 滑过行宽的这一比例松手，直接删除
const START = 8;        // 位移超过多少像素才判断方向
let cfg = { del: "删除", release: "松手删除", onDelete: null, kinds: [] }, drag = null, justSwiped = false, opened = null;

const lab = (v) => (typeof v === "function" ? v() : v);
const cssStr = (s) => `"${String(s).replace(/[\\"]/g, "\\$&")}"`;
const rowOf = (n) => n && n.closest && n.closest(".swipe-row");
const allowed = (el) => (cfg.kinds || []).includes(el.dataset.swipeDel);   // 只有登记过的记录种类才能左滑
const inBar = (row, x) => x >= row.getBoundingClientRect().right - REVEAL;   // 红色区域在行的最右边

function enhance(el) {
  if (el.dataset.swipeReady) return;
  el.dataset.swipeReady = "1";
  el.classList.add("swipe-row");
  el.style.setProperty("--swipe-del", cssStr(lab(cfg.del)));
  el.style.setProperty("--swipe-go", cssStr(lab(cfg.release)));
}

function setX(row, x, animate) {
  if (x) row.classList.add("shift");   // 只有真的在滑的时候才给子元素加 transform（平时不要平白多出层叠上下文）
  if (!animate) row.classList.add("swiping");
  row.style.setProperty("--sx", x ? `${x}px` : "0px");
  row.style.setProperty("--sw", x ? `${-x}px` : "0px");
  if (animate) row.classList.remove("swiping");
}
function close(row, animate = true) {
  if (!row) return;
  row.classList.remove("open", "ready");
  setX(row, 0, animate);
  if (opened === row) opened = null;
  setTimeout(() => { if (row.style.getPropertyValue("--sx") === "0px") row.classList.remove("shift"); }, 260);   // 弹回动画放完再去掉
}
function openRow(row) {
  if (opened && opened !== row) close(opened);
  row.classList.add("open"); row.classList.remove("ready"); setX(row, -REVEAL, true); opened = row;
}

// 触发删除：有 .swipe-src 就替它点一下（原来的 confirm 和删除流程照旧）；否则交给 onDelete
async function remove(row) {
  const w = row.offsetWidth;
  if (opened === row) opened = null;   // 否则替点的 click 会被「点击合上已滑开的行」那段拦下来，行就弹回去了
  row.classList.remove("ready"); row.classList.add("leaving"); setX(row, -w, true);
  let declined = false;
  const src = row.querySelector(".swipe-src"), orig = window.confirm;
  window.confirm = (m) => { const r = orig.call(window, m); if (!r) declined = true; return r; };   // 用户在确认框里点了取消：行弹回来
  try {
    if (src) { const keep = justSwiped; justSwiped = false; src.click(); justSwiped = keep; }   // 放手时 justSwiped 还是 true，别让这次替点的 click 被当成手势的尾巴吞掉
    else if (cfg.onDelete) { const r = await cfg.onDelete(row); if (r === false) declined = true; }
    else declined = true;
  } finally { window.confirm = orig; }
  if (declined) { row.classList.remove("leaving"); close(row); return; }
  // 删除是异步的（要等云端）：行留在滑出的位置；万一一直没被重画掉（失败了），过一会儿弹回来
  setTimeout(() => { if (row.isConnected) { row.classList.remove("leaving"); close(row); } }, 2500);
}

function onDown(e) {
  if (e.button > 0) return;
  const row = rowOf(e.target);
  if (opened && opened !== row) close(opened);
  if (!row || row.classList.contains("leaving")) return;
  if (row.classList.contains("open") && inBar(row, e.clientX)) return;   // 点红色区域：交给 click
  if (e.target.closest("input, select, textarea")) return;
  drag = { row, id: e.pointerId, x0: e.clientX, y0: e.clientY, base: row.classList.contains("open") ? -REVEAL : 0, mode: null, x: 0, w: row.offsetWidth };
}
function onMove(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
  if (!drag.mode) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) < START) return;
    // 竖着动：是在滚页面，放手；向右滑：暂时没有动作；向左滑：开始
    if (Math.abs(dy) > Math.abs(dx) || (dx > 0 && drag.base === 0)) { drag = null; return; }
    drag.mode = "swipe";
    try { drag.row.setPointerCapture(drag.id); } catch (_) { /* 没有也行 */ }
  }
  drag.x = Math.max(-drag.w, Math.min(0, drag.base + dx));
  setX(drag.row, drag.x, false);
  drag.row.classList.toggle("ready", drag.x < -drag.w * GO);
}
function onUp(e, cancel) {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag; drag = null;
  d.row.classList.remove("swiping");
  if (!d.mode) return;
  justSwiped = true; setTimeout(() => { justSwiped = false; }, 0);    // 放手后紧跟的 click 不算点击
  if (cancel) { close(d.row); return; }
  if (d.x < -d.w * GO) remove(d.row);
  else if (d.x < -REVEAL / 2) openRow(d.row);
  else close(d.row);
}

export function initSwipeRows(options = {}) {
  cfg = { ...cfg, ...options };
  const scan = (root) => root.querySelectorAll && root.querySelectorAll("[data-swipe-del]:not([data-swipe-ready])").forEach((el) => { if (allowed(el)) enhance(el); });
  scan(document);
  let queued = false;
  new MutationObserver(() => { if (queued) return; queued = true; setTimeout(() => { queued = false; scan(document); }, 0); }).observe(document.body, { childList: true, subtree: true });
  document.addEventListener("pointerdown", onDown);
  document.addEventListener("pointermove", onMove);
  document.addEventListener("pointerup", (e) => onUp(e, false));
  document.addEventListener("pointercancel", (e) => onUp(e, true));
  // 滑开的行：点红色区域删除；点这一行的内容或别处只是合上，不触发别的操作；滚动也合上
  document.addEventListener("click", (e) => {
    if (justSwiped) { e.stopPropagation(); e.preventDefault(); return; }
    if (opened) {
      const row = rowOf(e.target);
      if (row === opened && e.target === row && e.detail > 0 && inBar(row, e.clientX)) { e.stopPropagation(); e.preventDefault(); remove(row); return; }
      close(opened); if (row === opened) { e.stopPropagation(); e.preventDefault(); }
    }
  }, true);
  window.addEventListener("scroll", () => { if (opened) close(opened); }, { passive: true });
}
