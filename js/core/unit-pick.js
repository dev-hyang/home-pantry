/* 单位下拉（2026-11-14）：手上点比打字方便——常用的包装单位排在前面（袋、瓶、包、条、个、盒），
 * 然后是其余计数单位和本地区的重量 / 容量单位；最后一项「其他…」换成文字框，可以手填。
 * 选中的值是统一写法（Units.normalize），显示按界面语言翻译。物品行、物品表单共用。 */
import { esc } from "./util.js";
import { t } from "./i18n.js";

const FIRST = ["袋", "瓶", "包", "条", "个", "盒", "箱"];
export const OTHER = "__other";
/** 下拉里的单位（统一写法），常用的在前 */
export function unitChoices() {
  const all = window.Units?.list?.() || FIRST;
  return [...FIRST, ...all.filter((u) => !FIRST.includes(u))];
}
/** attrs：放在 select / 文字框上的属性（name、data-…、aria-label）；value：当前单位（统一写法或手填的文字） */
export function unitSelect(attrs, value, { cls = "" } = {}) {
  const v = window.Units?.normalize?.(value) || value || "个", list = unitChoices();
  const opts = (list.includes(v) ? list : [v, ...list]).map((u) => `<option value="${esc(u)}" ${u === v ? "selected" : ""}>${esc(t(u))}</option>`).join("");
  return `<select class="unit-pick ${cls}" data-nosearch="1" ${attrs}>${opts}<option value="${OTHER}">✎ ${esc(t("其他…"))}</option></select>`;
}
/* 选了「其他…」：原地换成文字框（保留同样的属性），聚焦；填完离开 / 回车时触发 change，调用方照常读 value */
if (typeof document !== "undefined") document.addEventListener("change", (e) => {
  const s = e.target;
  if (!s?.matches?.("select.unit-pick") || s.value !== OTHER) return;
  e.stopImmediatePropagation();
  const inp = document.createElement("input");
  for (const a of s.attributes) if (a.name !== "class") inp.setAttribute(a.name, a.value);
  inp.className = `${s.className} unit-typed`.replace("unit-pick", "unit-pick-in");
  inp.type = "text"; inp.maxLength = 10; inp.value = ""; inp.placeholder = t("单位");
  s.replaceWith(inp); inp.focus();
}, true);
