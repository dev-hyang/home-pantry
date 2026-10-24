/* 可搜索的下拉：选项很多的 <select>（分类下拉有六七十项）点开后先出一个搜索框，输几个字就只剩匹配的，再点选。
 * 做法：原来的 <select> 留在表单里（提交、现有的 change 处理都照旧），视觉上藏起来，旁边放一个按钮 + 面板；
 * 面板每次打开时按 select 当前的选项重建（选项是动态生成的也没问题），点一项 = 改 select 的值并派发 change。
 * 哪些 select 会变：带 data-search 的，或者选项数 ≥ 20 且没有 data-nosearch 的（页面重画后由 MutationObserver 自动接上）。
 * 键盘：面板里 ↑↓ 移动、Enter 选中、Esc 关闭；读屏：按钮带 aria-haspopup / aria-expanded，每项是 option 角色。 */
import { t } from "./core/i18n.js";

const MIN = 20;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const want = (sel) => sel.matches("select") && !sel.dataset.nosearch && !sel.dataset.sselReady && !sel.multiple && (sel.dataset.search !== undefined || sel.options.length >= MIN);
let openBox = null;

function label(sel) { const o = sel.selectedOptions[0]; return o ? o.textContent.trim() : ""; }
function enhance(sel) {
  sel.dataset.sselReady = "1";
  const box = document.createElement("div"); box.className = "ssel";
  box.innerHTML = `<button type="button" class="ssel-btn" aria-haspopup="listbox" aria-expanded="false"><span class="ssel-val"></span></button>
    <div class="ssel-panel" hidden><input type="search" class="ssel-q" placeholder="${esc(t("输入几个字筛选…"))}" aria-label="${esc(t("搜索选项"))}" autocomplete="off"><div class="ssel-list" role="listbox"></div></div>`;
  sel.classList.add("ssel-native"); sel.tabIndex = -1; sel.setAttribute("aria-hidden", "true");
  sel.after(box); box._sel = sel; sel._ssel = box;
  if (sel.disabled) box.querySelector(".ssel-btn").disabled = true;
  box.querySelector(".ssel-val").textContent = label(sel);
  box.querySelector(".ssel-btn").addEventListener("click", () => (box.classList.contains("is-open") ? close(box) : open(box)));
  box.querySelector(".ssel-q").addEventListener("input", () => filter(box));
  box.addEventListener("keydown", (e) => onKey(e, box));
  box.querySelector(".ssel-list").addEventListener("click", (e) => { const row = e.target.closest(".ssel-opt"); if (row) pick(box, row.dataset.v); });
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
  const q = box.querySelector(".ssel-q").value.trim().toLowerCase(), list = box.querySelector(".ssel-list");
  let any = false;
  list.querySelectorAll(".ssel-opt").forEach((r) => { const hit = !q || r.dataset.t.includes(q); r.hidden = !hit; any = any || hit; });
  list.querySelectorAll(".ssel-grp").forEach((g) => { let n = g.nextElementSibling, shown = false; while (n && !n.hasAttribute("data-grp")) { if (!n.hidden) shown = true; n = n.nextElementSibling; } g.hidden = !shown; });
  list.querySelectorAll(".is-hl").forEach((r) => r.classList.remove("is-hl"));
  box.querySelector(".ssel-empty")?.remove();
  if (!any) list.insertAdjacentHTML("beforeend", `<div class="ssel-empty muted">${esc(t("没有匹配的选项"))}</div>`);
}
function open(box) {
  if (openBox && openBox !== box) close(openBox);
  build(box); box.classList.add("is-open"); box.querySelector(".ssel-panel").hidden = false; box.querySelector(".ssel-btn").setAttribute("aria-expanded", "true");
  const q = box.querySelector(".ssel-q"); q.value = ""; filter(box); openBox = box;
  box.querySelector(".ssel-opt.is-cur")?.scrollIntoView({ block: "center" });
  // 面板要是伸出了屏幕底部，就改成往上弹
  box.classList.remove("is-right"); let r = box.querySelector(".ssel-panel").getBoundingClientRect();
  if (r.right > window.innerWidth - 8) { box.classList.add("is-right"); r = box.querySelector(".ssel-panel").getBoundingClientRect(); }   // 面板比按钮宽、伸出了右边：改成右对齐
  box.classList.toggle("is-up", r.bottom > window.innerHeight - 8 && r.top > r.height + 8);
  if (!window.matchMedia("(pointer: coarse)").matches) q.focus();   // 手机上不自动弹键盘，想搜再点搜索框
}
function close(box) { box.classList.remove("is-open", "is-up"); box.querySelector(".ssel-panel").hidden = true; box.querySelector(".ssel-btn").setAttribute("aria-expanded", "false"); if (openBox === box) openBox = null; }
function pick(box, v) {
  const sel = box._sel; if (sel.value !== v) { sel.value = v; sel.dispatchEvent(new Event("change", { bubbles: true })); }
  box.querySelector(".ssel-val").textContent = label(sel); close(box); box.querySelector(".ssel-btn").focus();
}
function onKey(e, box) {
  if (e.key === "Escape") { e.preventDefault(); close(box); box.querySelector(".ssel-btn").focus(); return; }
  if (!box.classList.contains("is-open")) return;
  const rows = [...box.querySelectorAll(".ssel-opt:not([hidden]):not(.is-off)")]; if (!rows.length) return;
  let i = rows.findIndex((r) => r.classList.contains("is-hl")); if (i < 0) i = rows.findIndex((r) => r.classList.contains("is-cur"));
  if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); i = Math.max(0, Math.min(rows.length - 1, i + (e.key === "ArrowDown" ? 1 : -1))); rows.forEach((r) => r.classList.remove("is-hl")); rows[i].classList.add("is-hl"); rows[i].scrollIntoView({ block: "nearest" }); }
  else if (e.key === "Enter") { e.preventDefault(); pick(box, (rows[i] || rows[0]).dataset.v); }
}

export function initSelectSearch() {
  const scan = (root) => root.querySelectorAll && root.querySelectorAll("select").forEach((s) => { if (want(s)) enhance(s); });
  scan(document);
  let queued = false;
  new MutationObserver(() => { if (queued) return; queued = true; setTimeout(() => { queued = false; scan(document); }, 0); }).observe(document.body, { childList: true, subtree: true });
  document.addEventListener("change", (e) => { const sel = e.target; if (sel._ssel) sel._ssel.querySelector(".ssel-val").textContent = label(sel); });   // 别处改了 select 的值（自动填表、重置）
  document.addEventListener("click", (e) => { if (openBox && !openBox.contains(e.target)) close(openBox); }, true);
}
