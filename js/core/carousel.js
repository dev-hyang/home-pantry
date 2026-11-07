/* 左右滑动的卡片（2026-11-07，今日页；做法和小月亮顶部大计时一样）：
 *  - 一屏一张，scroll-snap 吸附；手指 / 触控板左右滑，宽屏鼠标有 ‹ › 箭头，下面一排圆点可直接跳。
 *  - 循环：轨道里放 5 份同样的卡，停在中间那份；滑到靠边时悄悄跳回中间同一张，所以能一直滑下去（副本加 inert，读屏和 Tab 只走真的那份）。
 *  - 自动切换：每 30 秒到下一张；手指按着、鼠标悬停、焦点在卡片里、刚滑过（30 秒内）、页面在后台、系统要求减少动态效果时都不动；
 *    右下角 ⏸ 可以停 / 开，记在这台设备上。
 * 用法：carouselHtml(id, slides[]) 画出来；render 之后调 restoreCarousels()（main.js 每次 render 后会调）。 */
import { esc } from "./util.js";
import { t } from "./i18n.js";

const GAP = 12, COPIES = 5, AUTO_MS = 30e3, MID = 2;
const pos = {};   // id → 当前第几张（真实序号）
const PAUSE_KEY = "hmh-carousel-paused";
const paused = () => { try { return localStorage.getItem(PAUSE_KEY) === "1"; } catch { return false; } };

export function carouselHtml(id, slides, { label = "" } = {}) {
  const n = slides.length; if (!n) return "";
  const loop = n > 1, cur = Math.min(pos[id] || 0, n - 1);
  const slide = (html, j, clone) => `<div class="tslide" ${clone ? 'inert aria-hidden="true"' : `role="group" aria-roledescription="${esc(t("卡片"))}" aria-label="${j + 1}/${n}"`}>${html}</div>`;
  const track = loop ? Array.from({ length: COPIES }, (_, c) => slides.map((h, j) => slide(h, j, c !== MID)).join("")).join("") : slide(slides[0], 0, false);
  const nav = (d, l, ch) => `<button type="button" class="tc-nav ${d < 0 ? "prev" : "next"}" data-tcnav="${d}" aria-label="${esc(l)}">${ch}</button>`;
  const ps = paused();
  return `<div class="tcarousel" data-carousel="${esc(id)}">
    <div class="tc-view"><div class="ttrack" ${loop ? 'data-loop="1"' : ""} data-n="${n}" tabindex="0" role="region" aria-roledescription="carousel" aria-label="${esc(label)}">${track}</div></div>
    ${loop ? `<div class="tc-ctrl">${nav(-1, t("上一张"), "‹")}<div class="tc-dots">${slides.map((_, i) => `<button type="button" data-tcdot="${i}" aria-label="${i + 1}/${n}" aria-current="${i === cur}"></button>`).join("")}</div>${nav(1, t("下一张"), "›")}
      <button type="button" class="tc-pause" data-tcpause aria-pressed="${ps}" aria-label="${esc(ps ? t("开始自动切换") : t("暂停自动切换"))}" title="${esc(ps ? t("开始自动切换（每 30 秒）") : t("暂停自动切换"))}">${ps ? "▶" : "⏸"}</button></div>` : ""}
  </div>`;
}

const stepW = (tr) => tr.clientWidth + GAP;
const nOf = (tr) => +tr.dataset.n || 1;
const pageOf = (tr) => Math.round(tr.scrollLeft / stepW(tr));
const realOf = (tr) => ((pageOf(tr) % nOf(tr)) + nOf(tr)) % nOf(tr);
/** 循环的轨道：离中间那份太远就悄悄跳回中间同一张 */
function settle(tr) {
  if (tr._down || !tr.dataset.loop) return;
  const n = nOf(tr), p = pageOf(tr); if (p >= n && p < (COPIES - 1) * n) return;
  tr.style.scrollSnapType = "none"; tr.scrollLeft = (MID * n + realOf(tr)) * stepW(tr);
  requestAnimationFrame(() => { tr.style.scrollSnapType = ""; });
}
const go = (tr, page, smooth = true) => tr.scrollTo({ left: page * stepW(tr), behavior: smooth ? "smooth" : "auto" });
/** 重画之后放回刚才看的那张（中间那份） */
export function restoreCarousels() {
  document.querySelectorAll(".tcarousel").forEach((box) => {
    const tr = box.querySelector(".ttrack"); if (!tr) return;
    const n = nOf(tr), i = Math.min(pos[box.dataset.carousel] || 0, n - 1);
    tr.scrollLeft = (tr.dataset.loop ? MID * n + i : i) * stepW(tr);
  });
}
function markDots(box, i) { box.querySelectorAll(".tc-dots button").forEach((b, k) => b.setAttribute("aria-current", String(k === i))); }

if (typeof document !== "undefined") {
  document.addEventListener("scroll", (e) => {
    const tr = e.target; if (!tr.classList?.contains("ttrack")) return;
    clearTimeout(tr._settle); tr._settle = setTimeout(() => settle(tr), 140);
    const box = tr.closest(".tcarousel"), i = realOf(tr);
    if (pos[box.dataset.carousel] !== i) { pos[box.dataset.carousel] = i; markDots(box, i); }
  }, true);
  const touched = (e) => { const tr = e.target.closest?.(".ttrack"); if (tr) { tr._down = true; tr.closest(".tcarousel")._last = Date.now(); } };
  document.addEventListener("pointerdown", touched, true);
  const release = () => document.querySelectorAll(".ttrack").forEach((tr) => { if (tr._down) { tr._down = false; clearTimeout(tr._settle); tr._settle = setTimeout(() => settle(tr), 140); } });
  document.addEventListener("pointerup", release, true); document.addEventListener("pointercancel", release, true);
  document.addEventListener("click", (e) => {
    const b = e.target.closest?.("[data-tcnav], [data-tcdot], [data-tcpause]"); if (!b) return;
    const box = b.closest(".tcarousel"), tr = box?.querySelector(".ttrack"); if (!tr) return;
    box._last = Date.now();
    if (b.dataset.tcpause !== undefined) {
      const now = !paused(); try { localStorage.setItem(PAUSE_KEY, now ? "1" : "0"); } catch { /* 忽略 */ }
      b.setAttribute("aria-pressed", String(now)); b.textContent = now ? "▶" : "⏸";
      b.setAttribute("aria-label", now ? t("开始自动切换") : t("暂停自动切换")); b.title = now ? t("开始自动切换（每 30 秒）") : t("暂停自动切换"); return;
    }
    settle(tr);
    if (b.dataset.tcnav) return go(tr, pageOf(tr) + +b.dataset.tcnav);
    const n = nOf(tr), p = pageOf(tr), base = p - realOf(tr) + +b.dataset.tcdot;   // 圆点：走最近的那一圈
    go(tr, [base - n, base, base + n].filter((x) => x >= 0 && x < tr.children.length).sort((a, c) => Math.abs(a - p) - Math.abs(c - p))[0]);
  });
  document.addEventListener("keydown", (e) => {   // 焦点在轨道上：← → 换张
    const tr = e.target.classList?.contains("ttrack") ? e.target : null; if (!tr || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
    e.preventDefault(); settle(tr); tr.closest(".tcarousel")._last = Date.now(); go(tr, pageOf(tr) + (e.key === "ArrowRight" ? 1 : -1));
  });
  // 每 30 秒自动到下一张
  setInterval(() => {
    if (paused() || document.hidden || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    document.querySelectorAll(".tcarousel").forEach((box) => {
      const tr = box.querySelector(".ttrack"); if (!tr?.dataset.loop || tr._down) return;
      if (box.matches(":hover") || box.contains(document.activeElement) || Date.now() - (box._last || 0) < AUTO_MS) return;
      settle(tr); go(tr, pageOf(tr) + 1);
    });
  }, AUTO_MS);
}
