/* ============ 数字 / 金额框：统一的属性预设 ============
   用法：<input name="amount" ${numAttrs("money")} value="…">   或带覆盖：${numAttrs("int", { min: 1, max: 31 })}
   只负责属性（type / inputmode / min / step / max + data-num 钩子），样式在 shared/ui.css 的 [data-num]。
   聚焦整段选中由 num-focus.js 全局处理，这里不用管。
   迁到 Vue / Svelte：kind 和覆盖项就是组件的 props，data-num 对应组件根元素。 */
export const NUM_KINDS = {
  money: { inputmode: "decimal", min: 0, step: "0.01" },   // 金额（两位小数）
  qty: { inputmode: "decimal", min: 0, step: "any" },      // 数量（不限小数位）
  int: { inputmode: "numeric", min: 0, step: "1" },        // 整数：天数、月数、次数
  rate: { inputmode: "decimal", min: 0, max: 100, step: "0.001" }, // 百分比、利率
};

/** 返回一段属性字符串，直接拼进 <input …>。kind 不认识时按 qty；over 里的值覆盖预设，值为 null 表示去掉该属性。 */
export function numAttrs(kind, over = {}) {
  const p = { ...(NUM_KINDS[kind] || NUM_KINDS.qty), ...over };
  const attrs = Object.entries(p).filter(([, v]) => v !== null && v !== undefined).map(([k, v]) => `${k}="${v}"`);
  return `type="number" data-num="${NUM_KINDS[kind] ? kind : "qty"}" ${attrs.join(" ")}`;
}
