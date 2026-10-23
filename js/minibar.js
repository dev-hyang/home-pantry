/* ============ 手机上滚动后固定在顶部的窄条：站名 ============
   宽屏（> 440px）顶栏本来就是固定的；手机上顶栏随页面滑走（为了不占掉大半屏），往下滑之后就看不到站名了。
   这条窄条在手机上、页面往下滑了一点之后固定在屏幕顶端，显示站名，点它回到顶部。
   路径（面包屑）和筛选条原来就是固定的，现在叠在它下面：窄条的高度记进 --eco-h（shared/compact-filters.js 的 watchStick）。
   它是单独的一层（position: fixed），不占页面位置，出现和消失不会让内容跳动。 */
const PHONE = "(max-width: 440px)";
const SHOW_AFTER = 24;   // 往下滑多少像素后出现（要比路径条开始固定的位置早一点，两者才不会叠在一起）
let bar = null;

function ensureBar() {
  if (bar) return bar;
  bar = document.createElement("div");
  bar.id = "minibar"; bar.className = "minibar";
  bar.setAttribute("aria-hidden", "true");   // 顶栏不在时才显示；平时屏幕阅读器读顶栏本身
  document.body.appendChild(bar);
  bar.addEventListener("click", (e) => {
    if (!e.target.closest(".mb-title")) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: calm ? "auto" : "smooth" });
  });
  const sync = () => {
    const show = window.matchMedia(PHONE).matches && window.scrollY > SHOW_AFTER;
    bar.classList.toggle("show", show); bar.setAttribute("aria-hidden", String(!show));
  };
  window.addEventListener("scroll", sync, { passive: true }); window.addEventListener("resize", sync); sync();
  return bar;
}

/** title：纯文本站名；tip：提示文字 */
export function updateMiniBar(title, tip = "回到顶部") {
  const b = ensureBar(), esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  b.innerHTML = `<div class="in"><button type="button" class="mb-title" title="${esc(tip)}">${esc(title)}</button></div>`;
}
export const miniBarEl = () => ensureBar();
