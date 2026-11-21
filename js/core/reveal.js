/* 「点选 / 点下一步 → 展开下一块」的统一做法：把新露出来的那一块自动滚到屏幕中间（手机上不用手滑往下找）。
 * 用法：revealInto(el) —— el 是刚显示（或刚重画出来）的那一块；已经完整在屏幕里就不动，放不下半屏的才对齐到顶部；
 * 减少动态效果时直接跳。和「一步一步点下一步」的向导页（账单向导、一次性账单向导）共用：它们换步骤后也调这个，让新一步的内容回到视野里。 */
const reduced = () => !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function revealInto(el) {
  if (!el) return;
  el.hidden = false;
  el.classList.remove("is-revealed"); void el.offsetWidth; el.classList.add("is-revealed");   // 淡入一下，提示「这里是新出来的」
  requestAnimationFrame(() => {
    const r = el.getBoundingClientRect(), vh = window.innerHeight || 700, top = 64, bottom = vh - 84;   // 上面有顶栏 / 置顶条，下面有底部导航
    if (r.top >= top && r.bottom <= bottom) return;   // 已经完整看得见
    el.scrollIntoView({ block: r.height > (bottom - top) * 0.85 ? "start" : "center", behavior: reduced() ? "auto" : "smooth" });
  });
}
