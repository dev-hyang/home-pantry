/* 今日页「快捷操作」：长按进入编辑并直接拖动调整顺序（像手机桌面）。只作用在 .quick-grid 里带 data-qid 的格子，其他地方不受影响。
 *   · 平时长按（约 0.45 秒）：进入编辑模式，被按住的格子立刻"拎起来"，不松手拖到想放的位置再松手；
 *   · 已在编辑模式：按住格子稍微一动就能拖；
 *   · 按住后手指先动了（超过 8px）= 在滚动页面，不触发长按；
 *   · 编辑模式里原来的 × 删除、‹ › 移动按钮都还在（键盘 / 读屏用它们），点「完成」退出。
 * 拖动时格子实时换位置，松手后保存顺序（云端存在账号上）。 */
const HOLD = 450;        // 平时长按多久进入编辑
const SLOP = 8;          // 长按等待期间，手指动超过多少像素就当作滚动
const GRID = ".quick-grid", TILE = ".qwrap[data-qid]";
let cfg = null, st = null, suppressClick = false;

const tileAt = (x, y, except) => { const prev = except.style.pointerEvents; except.style.pointerEvents = "none"; const el = document.elementFromPoint(x, y); except.style.pointerEvents = prev; return el && el.closest ? el.closest(TILE) : null; };

function follow(e) {
  const el = st.el; el.style.transform = "none";
  const r = el.getBoundingClientRect();
  el.style.transform = `translate(${e.clientX - st.gx - r.left}px, ${e.clientY - st.gy - r.top}px) scale(1.06)`;
}
function startDrag(e) {
  const el = st.el, r = el.getBoundingClientRect();
  st.dragging = true; st.gx = e.clientX - r.left; st.gy = e.clientY - r.top;
  el.classList.add("is-dragging"); document.body.classList.add("quick-dragging");
  try { el.setPointerCapture(st.pid); } catch (_) { /* 没有也行 */ }
  follow(e);
}
function endDrag(commit) {
  const { el, grid } = st; clearTimeout(st.timer);
  if (st.dragging) {
    el.classList.remove("is-dragging"); el.style.transform = ""; el.style.pointerEvents = ""; document.body.classList.remove("quick-dragging");
    if (commit) { const ids = [...grid.querySelectorAll(TILE)].map((x) => x.dataset.qid); if (ids.join("\n") !== st.start.join("\n")) cfg.save(ids); }
    suppressClick = true; setTimeout(() => { suppressClick = false; }, 0);
  }
  st = null;
}

function onDown(e) {
  if (!cfg || e.button > 0) return;
  const tile = e.target.closest && e.target.closest(TILE); if (!tile || e.target.closest(".qdel, .qmove")) return;
  const grid = tile.closest(GRID); if (!grid) return;
  st = { el: tile, id: tile.dataset.qid, grid, pid: e.pointerId, x0: e.clientX, y0: e.clientY, dragging: false, ready: cfg.isEditing() && e.pointerType === "mouse", start: [...grid.querySelectorAll(TILE)].map((x) => x.dataset.qid), timer: 0 };
  if (cfg.isEditing()) { if (e.pointerType !== "mouse") st.timer = setTimeout(() => { if (st) st.ready = true; }, 140); }   // 触屏：按住一小会儿再拖，免得和滑动页面混淆
  else st.timer = setTimeout(() => {   // 平时：长按 → 进入编辑，并把这个格子拎起来
    if (!st) return;
    const id = st.id, pid = st.pid, x = e.clientX, y = e.clientY;
    try { navigator.vibrate && navigator.vibrate(12); } catch (_) { /* 忽略 */ }
    cfg.enter();   // 重画今日页：格子换成编辑模式的新元素
    const el = document.querySelector(`${GRID} ${TILE}[data-qid="${CSS.escape(id)}"]`); if (!el) { st = null; return; }
    st = { el, id, grid: el.closest(GRID), pid, x0: x, y0: y, dragging: false, ready: true, start: [...el.closest(GRID).querySelectorAll(TILE)].map((q) => q.dataset.qid), timer: 0, last: { clientX: x, clientY: y } };
    startDrag({ clientX: x, clientY: y }); suppressClick = true;
  }, HOLD);
}
function onMove(e) {
  if (!st || e.pointerId !== st.pid) return;
  if (!st.dragging) {
    const dist = Math.hypot(e.clientX - st.x0, e.clientY - st.y0);
    if (!cfg.isEditing()) { if (dist > SLOP) { clearTimeout(st.timer); st = null; } return; }   // 长按还没到就动了 = 在滚动
    if (st.ready && dist > 6) startDrag(e);
    return;
  }
  st.last = e;
  follow(e);
  const over = tileAt(e.clientX, e.clientY, st.el);
  if (over && over !== st.el && over.parentNode === st.grid) {
    const kids = [...st.grid.querySelectorAll(TILE)];
    st.grid.insertBefore(st.el, kids.indexOf(over) > kids.indexOf(st.el) ? over.nextSibling : over);   // 往后拖插到它后面，往前拖插到它前面
    follow(e);
  }
}
const onUp = (e) => { if (st && e.pointerId === st.pid) endDrag(e.type === "pointerup"); };

export function initQuickDrag(options) {
  cfg = options;
  document.addEventListener("pointerdown", onDown);
  document.addEventListener("pointermove", onMove);
  document.addEventListener("pointerup", onUp);
  document.addEventListener("pointercancel", onUp);
  // 拖动 / 长按期间不让页面跟着滚（触屏上必须在 touchmove 里 preventDefault）；松手后的那次 click 不当成点击（不跳转）
  document.addEventListener("touchmove", (e) => { if (st && (st.dragging || (st.timer && cfg.isEditing() && st.ready))) e.preventDefault(); }, { passive: false });
  document.addEventListener("click", (e) => { if (suppressClick && e.target.closest && e.target.closest(GRID)) { e.preventDefault(); e.stopPropagation(); } }, true);
  document.addEventListener("contextmenu", (e) => { if (e.target.closest && e.target.closest(GRID) && (st || cfg.isEditing())) e.preventDefault(); });   // 长按弹出的系统菜单
  document.addEventListener("dragstart", (e) => { if (e.target.closest && e.target.closest(GRID)) e.preventDefault(); });   // 链接自带的拖拽
}
