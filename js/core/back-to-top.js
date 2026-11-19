/* 回到顶部：页面已经滚下去一段，手势「持续往上滑」时，底部中央冒出一个圆形按钮，点一下平滑回到顶部。
 * 出现：滚过 SHOW_AFTER 之后，向上累计滑过 UP_NEEDED；收起：往下滑、回到接近顶部、停下 IDLE_MS 不动、换页。
 * 样式在 styles.css 的 .to-top：底部中央、在底部导航 / 保存栏上方，右下角的 ＋ 在另一边，不重叠。 */
import { t } from "./i18n.js";

const SHOW_AFTER = 300, HIDE_BELOW = 200, UP_NEEDED = 180, IDLE_MS = 3500;
let btn = null, last = 0, up = 0, idle = 0;

function ensure() {
  if (btn) return btn;
  btn = document.createElement("button");
  btn.type = "button"; btn.className = "to-top"; btn.setAttribute("aria-label", t("回到顶部")); btn.title = t("回到顶部");
  btn.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path d="M6 14.5l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  btn.addEventListener("click", () => { const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches; window.scrollTo({ top: 0, behavior: calm ? "auto" : "smooth" }); hide(); });
  document.body.appendChild(btn);
  return btn;
}
const show = () => { const b = ensure(); b.classList.add("is-on"); clearTimeout(idle); idle = setTimeout(hide, IDLE_MS); };
function hide() { clearTimeout(idle); up = 0; btn?.classList.remove("is-on"); }

function onScroll() {   // 计算很轻，直接在滚动事件里做（不用 rAF 节流：后台 / 被遮挡的页面里 rAF 会被拖慢，状态就滞后一拍）
  const y = window.scrollY, dy = y - last; last = y;
  if (dy > 4) { hide(); return; }                    // 往下滑：收起
  if (dy < 0) up += -dy;                             // 往上滑：累计
  if (y < HIDE_BELOW) { hide(); return; }            // 已经接近顶部：不需要
  if (y > SHOW_AFTER && up > UP_NEEDED) show();      // 滚下去一段又持续往上滑：出现
  else if (btn?.classList.contains("is-on")) show(); // 已经出现：继续往上滑就续时间
}
window.addEventListener("scroll", onScroll, { passive: true });
window.addEventListener("hashchange", () => { last = window.scrollY; hide(); });
