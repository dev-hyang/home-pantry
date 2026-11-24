/* 行记录长按（手机 / 平板触屏）：长按一行，底部弹出这一行的「更多操作」面板；电脑用鼠标右键点一行弹出同一份菜单（也可以点进详情）。
 * 用法：给行加 data-lp —— 两种写法：
 *   ① data-lp='[{"label":"编辑","href":"#/…"},{"label":"删除","action":"xx-del","data":{"id":"…"},"danger":true}]'（用 lpAttr(items) 生成）：弹底部面板；
 *      各页按自己的业务定制菜单项（归档、入库、一次性结清……）；action 走页面原有的 data-action 点击处理，href 直接跳转。
 *   ② 只写 data-lp（没有内容）：行里已经有一个 ⋯ 菜单（details.act-more）时，长按就把它打开。
 * 可选 data-lp-title="标题"：面板顶上显示这一行的名字。行里的按钮 / 输入框 / 已展开的菜单上长按不触发。
 * 手指移动超过 10px（在滚动或左滑删除）就取消；长按触发后会吞掉随后的那一下点击，不会误跳转。 */
import { esc } from "./util.js";
import { t } from "./i18n.js";
import { sheetHtml } from "./ui-sheet.js";

const HOLD = 480, SLOP = 10;
let st = null, swallowUntil = 0, sheet = null, lastType = "mouse";

/** 把菜单项数组变成 data-lp="…" 属性（已转义，直接拼进行的标签里）；项：{ label, href | action + data, danger, external } */
export const lpAttr = (items, title = "") => `data-lp="${esc(JSON.stringify((items || []).filter(Boolean)))}"${title ? ` data-lp-title="${esc(title)}"` : ""}`;

const heat = (on) => document.querySelectorAll(".lp-hot").forEach((r) => !on && r.classList.remove("lp-hot"));
function closeSheet() { sheet?.remove(); sheet = null; heat(false); document.removeEventListener("keydown", onKey); }
function onKey(e) { if (e.key === "Escape") closeSheet(); }

function openSheet(row, items) {
  closeSheet();
  const title = row.dataset.lpTitle || "";
  const one = (x) => {
    const cls = `ui-opt fam-sheet-row lp-row${x.danger ? " is-danger" : ""}`;
    if (x.href) return `<a class="${cls}" href="${esc(x.href)}"${x.external ? ' target="_blank" rel="noopener noreferrer"' : ""}>${esc(x.label)}</a>`;
    const data = Object.entries(x.data || {}).map(([k, v]) => ` data-${k}="${esc(v)}"`).join("");
    return `<button type="button" class="${cls}"${x.action ? ` data-action="${esc(x.action)}"` : ""}${data}>${esc(x.label)}</button>`;
  };
  const el = document.createElement("div"); el.className = "lp-sheet";
  el.innerHTML = sheetHtml({ title: title ? esc(title) : "", label: title || t("更多操作"), list: items.map(one).join(""), closeAttr: "data-lp-close", cancelText: t("取消") });
  el.addEventListener("click", (e) => {
    if (e.target.closest("[data-lp-close]")) return closeSheet();
    const b = e.target.closest("button.lp-row"); if (!b) { if (e.target.closest(".lp-row")) setTimeout(closeSheet, 0); return; }
    // 页面的点击处理挂在 #main 上，面板挂在 body 上（#main 里 position: fixed 会被限在它自己的盒子里）：在 #main 里放一个一模一样的临时按钮替它点一下
    const proxy = document.createElement("button"); proxy.type = "button"; proxy.hidden = true; proxy.dataset.lpProxy = "1";   // 标记：不会被下面「吞掉长按后那一下点击」的监听拦掉
    for (const [k, v] of Object.entries(b.dataset)) proxy.dataset[k] = v;
    const host = document.getElementById("main"); closeSheet();
    if (host) { host.appendChild(proxy); proxy.click(); setTimeout(() => proxy.remove(), 0); }
  });
  document.body.appendChild(el);
  sheet = el; const box = el.querySelector(".fam-sheet"); box.tabIndex = -1; box.focus({ preventScroll: true });
  document.addEventListener("keydown", onKey);
}

function fire() {
  const { row } = st; st = null;
  let items = null; try { items = JSON.parse(row.dataset.lp || "null"); } catch { /* 空属性：用行里的 ⋯ */ }
  if (items?.length) openSheet(row, items);
  else { const m = row.querySelector("details.act-more"); if (!m) return; document.querySelectorAll("details.act-more[open]").forEach((d) => { d.open = false; }); m.open = true; }
  row.classList.add("lp-hot"); swallowUntil = Date.now() + 800; navigator.vibrate?.(12);
}
const cancel = () => { if (st) { clearTimeout(st.timer); st = null; } };

document.addEventListener("pointerdown", (e) => {
  lastType = e.pointerType; cancel();
  if (e.pointerType === "mouse" || e.button > 0) return;
  const row = e.target.closest?.("[data-lp]"); if (!row || e.target.closest("button, input, select, textarea, summary, label, .act-menu")) return;
  if (!row.dataset.lp && !row.querySelector("details.act-more")) return;
  st = { row, x: e.clientX, y: e.clientY, timer: setTimeout(fire, HOLD) };
}, true);
document.addEventListener("pointermove", (e) => { if (st && Math.hypot(e.clientX - st.x, e.clientY - st.y) > SLOP) cancel(); }, true);
for (const ev of ["pointerup", "pointercancel"]) document.addEventListener(ev, cancel, true);
window.addEventListener("scroll", cancel, true);
document.addEventListener("contextmenu", (e) => {
  const row = e.target.closest?.("[data-lp]"); if (!row) return;
  if (lastType !== "mouse") return e.preventDefault();   // 长按时系统自己的菜单（复制链接等）不要出来
  // 电脑：右键点一行 = 弹出这一行的菜单（行上不再有 ⋯）；只对写了菜单项的行生效，输入框 / 按钮上仍是系统菜单
  if (e.target.closest("button, input, select, textarea, summary, label, .act-menu")) return;
  let items = null; try { items = JSON.parse(row.dataset.lp || "null"); } catch { /* 忽略 */ }
  if (!items?.length) return;
  e.preventDefault(); openSheet(row, items); row.classList.add("lp-hot");
});
// 必须排在 main.js 里「点别处收起 ⋯ 菜单」那一条之前：否则松手那一下点击会立刻把刚打开的菜单关掉
document.addEventListener("click", (e) => {
  if (Date.now() < swallowUntil && !e.target.closest(".lp-sheet") && !e.target.dataset?.lpProxy) { e.preventDefault(); e.stopImmediatePropagation(); }
  else if (!sheet) heat(false);
}, true);
