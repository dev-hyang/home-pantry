/* ============ 数字框聚焦时，值是 0 / 0.00 就整段选中 ============
   金额、天数这类数字框默认值常是 0 或 0.00；点进去再输入 9，会变成 09 / 0.009。
   这里全局处理：聚焦时如果值恰好是零，就全选，接着输入会直接覆盖掉 0。
   不动非零的值（要改 12.50 的人通常想在原值上改），也不改框里的内容，所以失焦后数据不变。 */
import { isZero } from "./num-focus-lib.js";
const NUMERIC = "input[type=number], input[inputmode=decimal], input[inputmode=numeric]";


function selectZero(el) {
  if (!el.matches || !el.matches(NUMERIC) || el.readOnly || el.disabled || !isZero(el.value)) return;
  // 点击聚焦时，鼠标抬起会把选区清掉；延后一帧再选才稳（手机上同理）
  setTimeout(() => { if (document.activeElement === el && isZero(el.value)) el.select(); }, 0);
}

document.addEventListener("focusin", e => selectZero(e.target));
export { selectZero };
