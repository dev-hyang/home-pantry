/* 交易页的搜索框（计划 / 实际 / 对比 / 阶段页顶部，和别的明细页同一种「搜索 + 筛选」条）：
 * 输入停顿 250ms 后记进 state.dealQ 并重画；重画会换掉搜索框，所以画完把焦点和光标放回去。 */
import { render } from "../app/render.js";
import { state } from "../core/state.js";

let timer = null;
if (typeof document !== "undefined") {
  document.addEventListener("input", (e) => {
    const el = e.target; if (el?.id !== "dealSearch") return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      const v = el.value; state.dealQ = v;
      render(false);
      requestAnimationFrame(() => { const i = document.getElementById("dealSearch"); if (i) { i.focus(); try { i.setSelectionRange(v.length, v.length); } catch { /* 忽略 */ } } });
    }, 250);
  });
}
