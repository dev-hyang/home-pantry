/* ============ 行记录左滑删除 ============
   给一行加 data-swipe 就行（行里原来的「删除」按钮加 class="swipe-src"，滑动时代它点击，原来的确认框、删除流程都照旧）：
     · 向左滑：行里的内容跟着手指向左走，右边露出红色「删除」；停在一半，点红色按钮就删除；
     · 一直滑过大半（≥ 55%）松手：直接删除；
     · 向右滑：暂时没有动作，不会动；
     · 点别处、往上下滚：已经滑开的行自动合上。
   键盘 / 读屏：原来的删除按钮还在（平时视觉隐藏，Tab 到它时显示），所以不用手势也能删。
   行里的输入框、下拉框不响应滑动（免得打字时误触）。

   行的标签、类名、里面的结构都不动（所以原来给 li、行写的 flex、分隔线、:last-child 等样式全部照旧）：
   只是给这一行加 class="swipe-row"、在末尾放一个绝对定位的红色条，滑动时把行的子元素整体平移。
   唯一的例外是 <button> / <a> 这类不能装按钮的行：外面套一层 div 再做同样的事。
   四个姐妹应用各放一份同样的文件。用法：initSwipeRows({ del, release, onDelete })，del / release 是文字或返回文字的函数；
   onDelete(行元素) 可选：没有 .swipe-src 的行（例如小月亮的记录行）用它来做删除，返回 false 表示用户取消了（行弹回去）。 */
const REVEAL = 88;      // 停住时露出的红色按钮宽度（px）
const GO = 0.55;        // 滑过行宽的这一比例松手，直接删除
const START = 8;        // 位移超过多少像素才判断方向
let cfg = { del: "删除", release: "松手删除", onDelete: null }, drag = null, justSwiped = false, opened = null;

const lab = (v) => (typeof v === "function" ? v() : v);
const rowOf = (n) => n && n.closest && n.closest(".swipe-row");
const origOf = (row) => (row.matches("[data-swipe]") ? row : row.querySelector(":scope > [data-swipe]"));   // 原来那一行（button 行时在套层里面）

function enhance(el) {
  if (el.dataset.swipeReady) return;
  el.dataset.swipeReady = "1";
  let row = el;
  if (el.tagName === "BUTTON" || el.tagName === "A") {   // 按钮里不能再放按钮：外面套一层 div，红色条放在套层里
    row = document.createElement("div");
    row.style.borderRadius = getComputedStyle(el).borderRadius;
    el.replaceWith(row); row.appendChild(el);
  }
  row.classList.add("swipe-row");
  const bg = document.createElement("div");
  bg.className = "swipe-bg";
  bg.innerHTML = `<button type="button" class="swipe-del" tabindex="-1" aria-hidden="true"><span class="s-del">${lab(cfg.del)}</span><b class="s-go">${lab(cfg.release)}</b></button>`;
  row.appendChild(bg);
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
  row.classList.remove("ready"); row.classList.add("leaving"); setX(row, -w, true);
  let declined = false;
  const src = row.querySelector(".swipe-src"), orig = window.confirm;
  window.confirm = (m) => { const r = orig.call(window, m); if (!r) declined = true; return r; };   // 用户在确认框里点了取消：行弹回来
  try {
    if (src) { const keep = justSwiped; justSwiped = false; src.click(); justSwiped = keep; }   // 放手时 justSwiped 还是 true，别让这次替点的 click 被当成手势的尾巴吞掉
    else if (cfg.onDelete) { const r = await cfg.onDelete(origOf(row)); if (r === false) declined = true; }
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
  if (e.target.closest(".swipe-bg")) return;                       // 点红色按钮：交给 click
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
  const scan = (root) => root.querySelectorAll && root.querySelectorAll("[data-swipe]:not([data-swipe-ready])").forEach(enhance);
  scan(document);
  let queued = false;
  new MutationObserver(() => { if (queued) return; queued = true; setTimeout(() => { queued = false; scan(document); }, 0); }).observe(document.body, { childList: true, subtree: true });
  document.addEventListener("pointerdown", onDown);
  document.addEventListener("pointermove", onMove);
  document.addEventListener("pointerup", (e) => onUp(e, false));
  document.addEventListener("pointercancel", (e) => onUp(e, true));
  // 滑开的行：点红色按钮删除；点这一行的内容或别处只是合上，不触发别的操作；滚动也合上
  document.addEventListener("click", (e) => {
    if (justSwiped) { e.stopPropagation(); e.preventDefault(); return; }
    const del = e.target.closest && e.target.closest(".swipe-del");
    if (del) { e.stopPropagation(); e.preventDefault(); const row = rowOf(del); if (row) remove(row); return; }
    if (opened) { const row = rowOf(e.target); const hit = row === opened; close(opened); if (hit) { e.stopPropagation(); e.preventDefault(); } }
  }, true);
  window.addEventListener("scroll", () => { if (opened) close(opened); }, { passive: true });
}
