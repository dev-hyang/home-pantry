/* 可搜索的下拉：选项很多的 <select>（分类下拉有六七十项）换成一个「能打字的下拉」——
 * 看起来和普通下拉一样（显示当前选项 + 右边小箭头），点进去直接在原位打字筛选，下面列出匹配的选项，点一项选中。没有单独的搜索框。
 * 做法：原来的 <select> 留在表单里（提交、现有的 change 处理都照旧），视觉上藏起来；
 * 列表每次打开时按 select 当前的选项重建（选项是动态生成的也没问题），选一项 = 改 select 的值并派发 change。
 * 哪些 select 会变：带 data-search 的，或者选项数 ≥ 20 且没有 data-nosearch 的（页面重画后由 MutationObserver 自动接上）。
 * 键盘：↑↓ 移动、Enter 选中、Esc 还原并关闭；读屏：输入框是 combobox，列表是 listbox / option。 */
import { t } from "./core/i18n.js";

const MIN = 20;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const want = (sel) => sel.matches("select") && !sel.dataset.nosearch && !sel.dataset.sselReady && !sel.multiple && (sel.dataset.search !== undefined || sel.options.length >= MIN);
let openBox = null;

const label = (sel) => { const o = sel.selectedOptions[0]; return o ? o.textContent.trim() : ""; };
function enhance(sel) {
  sel.dataset.sselReady = "1";
  const box = document.createElement("div"); box.className = "ssel";
  box.innerHTML = `<input type="text" class="ssel-in" role="combobox" aria-expanded="false" aria-autocomplete="list" autocomplete="off" spellcheck="false" aria-label="${esc(sel.getAttribute("aria-label") || sel.closest("label")?.firstChild?.textContent?.trim() || "")}"><div class="ssel-list" role="listbox" hidden></div>`;
  sel.classList.add("ssel-native"); sel.tabIndex = -1; sel.setAttribute("aria-hidden", "true");
  sel.after(box); box._sel = sel; sel._ssel = box;
  const inp = box.querySelector(".ssel-in"); inp.value = label(sel); inp.disabled = sel.disabled;
  inp.addEventListener("focus", () => open(box));
  inp.addEventListener("click", () => { if (!box.classList.contains("is-open")) open(box); });
  inp.addEventListener("input", () => { box.dataset.typed = "1"; filter(box); });
  inp.addEventListener("keydown", (e) => onKey(e, box));
  inp.addEventListener("blur", () => setTimeout(() => { if (box.classList.contains("is-open") && !box.contains(document.activeElement)) close(box); }, 0));
  const list = box.querySelector(".ssel-list");
  list.addEventListener("pointerdown", (e) => e.preventDefault());   // 点列表时输入框别失焦（否则 blur 先把列表关了）
  list.addEventListener("click", (e) => { const row = e.target.closest(".ssel-opt"); if (row && !row.classList.contains("is-off")) pick(box, row.dataset.v); });
}
function build(box) {
  const sel = box._sel, list = box.querySelector(".ssel-list"), cur = sel.value, parts = [];
  const opt = (o) => `<div class="ssel-opt ${o.value === cur ? "is-cur" : ""} ${o.disabled ? "is-off" : ""}" role="option" aria-selected="${o.value === cur}" data-v="${esc(o.value)}" data-t="${esc(o.textContent.trim().toLowerCase())}">${esc(o.textContent.trim())}</div>`;
  for (const n of sel.children) {
    if (n.tagName === "OPTGROUP") { parts.push(`<div class="ssel-grp" data-grp>${esc(n.label)}</div>`); for (const o of n.children) parts.push(opt(o)); }
    else if (n.tagName === "OPTION") parts.push(opt(n));
  }
  list.innerHTML = parts.join("");
}
function filter(box) {
  const q = box.dataset.typed ? box.querySelector(".ssel-in").value.trim().toLowerCase() : "", list = box.querySelector(".ssel-list");
  let any = false;
  list.querySelectorAll(".ssel-opt").forEach((r) => { const hit = !q || r.dataset.t.includes(q); r.hidden = !hit; any = any || hit; });
  list.querySelectorAll(".ssel-grp").forEach((g) => { let n = g.nextElementSibling, shown = false; while (n && !n.hasAttribute("data-grp")) { if (!n.hidden) shown = true; n = n.nextElementSibling; } g.hidden = !shown; });
  list.querySelectorAll(".is-hl").forEach((r) => r.classList.remove("is-hl"));
  list.querySelector(".ssel-empty")?.remove();
  if (!any) list.insertAdjacentHTML("beforeend", `<div class="ssel-empty muted">${esc(t("没有匹配的选项"))}</div>`);
  if (q) { const first = list.querySelector(".ssel-opt:not([hidden]):not(.is-off)"); if (first) first.classList.add("is-hl"); }
}
function open(box) {
  if (openBox && openBox !== box) close(openBox);
  const inp = box.querySelector(".ssel-in"), list = box.querySelector(".ssel-list");
  build(box); delete box.dataset.typed;
  inp.placeholder = label(box._sel) || t("输入几个字筛选…"); inp.value = "";   // 当前选项变成灰色占位，直接打字就是筛选
  box.classList.add("is-open"); list.hidden = false; inp.setAttribute("aria-expanded", "true"); openBox = box;
  filter(box);
  list.querySelector(".ssel-opt.is-cur")?.scrollIntoView({ block: "center" });
  box.classList.remove("is-right"); let r = list.getBoundingClientRect();
  if (r.right > window.innerWidth - 8) { box.classList.add("is-right"); r = list.getBoundingClientRect(); }   // 列表比输入框宽、伸出了右边：改成右对齐
  box.classList.toggle("is-up", r.bottom > window.innerHeight - 8 && r.top > r.height + 8);
}
function close(box) {
  const inp = box.querySelector(".ssel-in");
  box.classList.remove("is-open", "is-up", "is-right"); box.querySelector(".ssel-list").hidden = true; inp.setAttribute("aria-expanded", "false");
  inp.value = label(box._sel); inp.placeholder = ""; delete box.dataset.typed;
  if (openBox === box) openBox = null;
}
function pick(box, v) {
  const sel = box._sel; if (sel.value !== v) { sel.value = v; sel.dispatchEvent(new Event("change", { bubbles: true })); }
  close(box); box.querySelector(".ssel-in").blur();
}
function onKey(e, box) {
  if (e.key === "Escape") { e.preventDefault(); close(box); box.querySelector(".ssel-in").blur(); return; }
  if (!box.classList.contains("is-open")) { if (e.key === "ArrowDown" || e.key === "Enter") { e.preventDefault(); open(box); } return; }
  const rows = [...box.querySelectorAll(".ssel-opt:not([hidden]):not(.is-off)")]; if (!rows.length) return;
  let i = rows.findIndex((r) => r.classList.contains("is-hl")); if (i < 0) i = rows.findIndex((r) => r.classList.contains("is-cur"));
  if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); i = Math.max(0, Math.min(rows.length - 1, i + (e.key === "ArrowDown" ? 1 : -1))); rows.forEach((r) => r.classList.remove("is-hl")); rows[i].classList.add("is-hl"); rows[i].scrollIntoView({ block: "nearest" }); }
  else if (e.key === "Enter") { e.preventDefault(); pick(box, (rows[i] || rows[0]).dataset.v); }
  else if (e.key === "Tab") close(box);
}

export function initSelectSearch() {
  const scan = (root) => root.querySelectorAll && root.querySelectorAll("select").forEach((s) => { if (want(s)) enhance(s); });
  scan(document);
  let queued = false;
  new MutationObserver(() => { if (queued) return; queued = true; setTimeout(() => { queued = false; scan(document); }, 0); }).observe(document.body, { childList: true, subtree: true });
  document.addEventListener("change", (e) => { const sel = e.target; if (sel._ssel && !sel._ssel.classList.contains("is-open")) sel._ssel.querySelector(".ssel-in").value = label(sel); });   // 别处改了 select 的值（自动填表、重置）
  document.addEventListener("pointerdown", (e) => { if (openBox && !openBox.contains(e.target)) close(openBox); }, true);
}
