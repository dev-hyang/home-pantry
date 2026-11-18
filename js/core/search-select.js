/* 长下拉可以手动搜索：给 <select data-ss> 套一层「点开 → 搜索框 + 选项列表」（样式同物品里选设备的 .pick），
 * 原来的 <select> 留在页面里（隐藏），选了就改它的值并触发 change，所以原来的 change 处理一行都不用改。
 * 选项分组（optgroup）画成小标题；搜索按选项文字，没有结果的分组连标题一起收起。 */
import { esc } from "./util.js";
import { t } from "./i18n.js";

const label = (sel) => sel.selectedOptions[0]?.textContent.trim() || "";
function panelHtml(sel) {
  const row = (o) => `<button type="button" class="pick-row ss-row" role="option" data-v="${esc(o.value)}" aria-selected="${o.selected}">${esc(o.textContent.trim())}</button>`;
  const parts = [];
  for (const n of sel.children) {
    if (n.tagName === "OPTGROUP") parts.push(`<div class="ss-grp" data-grp><div class="ss-h">${esc(n.label)}</div>${[...n.children].map(row).join("")}</div>`);
    else parts.push(row(n));
  }
  return parts.join("");
}
export function enhanceSelects(root = document) {
  root.querySelectorAll("select[data-ss]").forEach((sel) => {
    if (sel.dataset.ssDone) return;
    sel.dataset.ssDone = "1";
    const box = document.createElement("details");
    box.className = "pick ss";
    box.innerHTML = `<summary aria-label="${esc(sel.getAttribute("aria-label") || "")}"><span class="pick-val">${esc(label(sel))}</span></summary>
      <div class="pick-panel" role="listbox"><input type="search" class="pick-q" placeholder="${esc(t("搜索"))}" aria-label="${esc(t("搜索"))}" autocomplete="off"><div class="ss-list">${panelHtml(sel)}</div></div>`;
    sel.hidden = true; sel.after(box);
  });
}
document.addEventListener("click", (e) => {
  const row = e.target.closest(".ss .ss-row");
  if (row) {
    const box = row.closest(".ss"), sel = box.previousElementSibling;
    if (sel?.tagName === "SELECT") { sel.value = row.dataset.v; box.open = false; sel.dispatchEvent(new Event("change", { bubbles: true })); box.querySelector(".pick-val").textContent = label(sel); box.querySelectorAll(".ss-row").forEach((r) => r.setAttribute("aria-selected", String(r === row))); }
    return;
  }
  document.querySelectorAll("details.ss[open]").forEach((d) => { if (!d.contains(e.target)) d.open = false; });
});
document.addEventListener("input", (e) => {
  if (!e.target.classList?.contains("pick-q") || !e.target.closest(".ss")) return;
  const q = e.target.value.trim().toLowerCase(), panel = e.target.closest(".ss");
  panel.querySelectorAll(".ss-row").forEach((r) => { r.hidden = !!q && !r.textContent.toLowerCase().includes(q); });
  panel.querySelectorAll("[data-grp]").forEach((g) => { g.hidden = ![...g.querySelectorAll(".ss-row")].some((r) => !r.hidden); });
});
document.addEventListener("toggle", (e) => { if (e.target.matches?.("details.ss") && e.target.open) e.target.querySelector(".pick-q")?.focus({ preventScroll: true }); }, true);
