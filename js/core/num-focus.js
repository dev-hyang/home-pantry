/* ============ 数字框聚焦时整段选中 ============
   金额、天数这类数字框点进去再输入，原来是接在旧值后面：0 变成 09、0.00 变成 0.009。
   这里全局处理：聚焦时只要框里有值就全选，接着输入直接覆盖；不输入就失焦，值不变。
   想改中间某一位，再点一下就能放光标。 */
import { shouldSelect } from "./num-focus-lib.js";
const NUMERIC = "input[type=number], input[inputmode=decimal], input[inputmode=numeric]";

function selectOnFocus(el) {
  if (!el.matches || !el.matches(NUMERIC) || el.readOnly || el.disabled || !shouldSelect(el.value)) return;
  // 点击聚焦时，鼠标抬起会把选区清掉；延后一帧再选才稳（手机上同理）
  setTimeout(() => { if (document.activeElement === el && shouldSelect(el.value)) el.select(); }, 0);
}

document.addEventListener("focusin", e => selectOnFocus(e.target));
export { selectOnFocus };
