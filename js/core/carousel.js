/* 左右滑动的卡片（2026-11-07，今日页；做法和小月亮顶部大计时一样）：
 *  - 一屏一张，scroll-snap 吸附；手指 / 触控板左右滑；下面一行 ‹ 短划线 › 可点。
 *  - 循环：轨道里放 5 份同样的卡，停在中间那份；滑到靠边时悄悄跳回中间同一张，所以能一直滑下去（副本加 inert，读屏和 Tab 只走真的那份）。
 *  - 自动切换：当前那条短划线像进度条一样 30 秒走满，走满就到下一张、下一条重新开始。
 *    手指按着、鼠标停在卡片上、焦点在卡片里时进度条停住（CSS 暂停动画）；手动换张后从头走；系统要求减少动态效果时不走、不自动换。
 * 用法：carouselHtml(id, slides[]) 画出来；render 之后调 restoreCarousels()（main.js 每次 render 后会调）。 */
import { esc } from "./util.js";
import { t } from "./i18n.js";

const GAP = 12, COPIES = 5, MID = 2;
export const AUTO_SECONDS = 30;
const pos = {};   // id → 当前第几张（真实序号）
const reduced = () => !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function carouselHtml(id, slides, { label = "" } = {}) {
  const n = slides.length; if (!n) return "";
  const loop = n > 1, cur = Math.min(pos[id] || 0, n - 1);
  const slide = (html, j, clone) => `<div class="tslide" ${clone ? 'inert aria-hidden="true"' : `role="group" aria-roledescription="${esc(t("卡片"))}" aria-label="${j + 1}/${n}"`}>${html}</div>`;
  const track = loop ? Array.from({ length: COPIES }, (_, c) => slides.map((h, j) => slide(h, j, c !== MID)).join("")).join("") : slide(slides[0], 0, false);
  const nav = (d, l, ch) => `<button type="button" class="tc-nav" data-tcnav="${d}" aria-label="${esc(l)}">${ch}</button>`;
  const dash = (i) => `<button type="button" class="tc-dash ${i === cur ? "is-run" : ""}" data-tcdot="${i}" aria-label="${esc(t("第 {i} 张，共 {n} 张", { i: i + 1, n }))}" aria-current="${i === cur}"><i style="animation-duration:${AUTO_SECONDS}s"></i></button>`;
  return `<div class="tcarousel" data-carousel="${esc(id)}">
    <div class="tc-view"><div class="ttrack" ${loop ? 'data-loop="1"' : ""} data-n="${n}" tabindex="0" role="region" aria-roledescription="carousel" aria-label="${esc(label)}">${track}</div></div>
    ${loop ? `<div class="tc-ctrl">${nav(-1, t("上一张"), "‹")}<div class="tc-dashes" title="${esc(t("每 {s} 秒自动换下一张；手指按着或鼠标停在卡片上时暂停", { s: AUTO_SECONDS }))}">${slides.map((_, i) => dash(i)).join("")}</div>${nav(1, t("下一张"), "›")}</div>` : ""}
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
/** 当前那条短划线：换成第 i 条，进度条从头开始走 */
function markDash(box, i, restart = true) {
  box.querySelectorAll(".tc-dash").forEach((b, k) => {
    b.setAttribute("aria-current", String(k === i));
    if (k !== i) { b.classList.remove("is-run"); return; }
    if (restart || !b.classList.contains("is-run")) { b.classList.remove("is-run"); void b.offsetWidth; b.classList.add("is-run"); }   // 重新触发动画
  });
}

if (typeof document !== "undefined") {
  document.addEventListener("scroll", (e) => {
    const tr = e.target; if (!tr.classList?.contains("ttrack")) return;
    clearTimeout(tr._settle); tr._settle = setTimeout(() => settle(tr), 140);
    const box = tr.closest(".tcarousel"), i = realOf(tr);
    if (pos[box.dataset.carousel] !== i) { pos[box.dataset.carousel] = i; markDash(box, i); }
  }, true);
  // 按着：进度条停住（.is-hold），松开继续；松开后再看要不要跳回中间那份
  document.addEventListener("pointerdown", (e) => { const tr = e.target.closest?.(".ttrack"); if (tr) { tr._down = true; tr.closest(".tcarousel").classList.add("is-hold"); } }, true);
  const release = () => document.querySelectorAll(".ttrack").forEach((tr) => {
    if (!tr._down) return;
    tr._down = false; tr.closest(".tcarousel").classList.remove("is-hold");
    clearTimeout(tr._settle); tr._settle = setTimeout(() => settle(tr), 140);
  });
  document.addEventListener("pointerup", release, true); document.addEventListener("pointercancel", release, true);
  // 进度条走满 → 下一张（减少动态效果时不自动换）
  document.addEventListener("animationend", (e) => {
    const b = e.target.closest?.(".tc-dash.is-run"); if (!b || e.animationName !== "tcprog" || reduced() || document.hidden) return;
    const box = b.closest(".tcarousel"), tr = box?.querySelector(".ttrack"); if (!tr?.dataset.loop || tr._down) return;
    settle(tr); go(tr, pageOf(tr) + 1);
  }, true);
  document.addEventListener("click", (e) => {
    const b = e.target.closest?.("[data-tcnav], [data-tcdot]"); if (!b) return;
    const box = b.closest(".tcarousel"), tr = box?.querySelector(".ttrack"); if (!tr) return;
    settle(tr);
    if (b.dataset.tcnav) { go(tr, pageOf(tr) + +b.dataset.tcnav); return; }
    const n = nOf(tr), p = pageOf(tr), base = p - realOf(tr) + +b.dataset.tcdot;   // 短划线：走最近的那一圈
    const to = [base - n, base, base + n].filter((x) => x >= 0 && x < tr.children.length).sort((a, c) => Math.abs(a - p) - Math.abs(c - p))[0];
    if (to === p) markDash(box, realOf(tr)); else go(tr, to);   // 点的就是当前这张：进度条从头再走
  });
  document.addEventListener("keydown", (e) => {   // 焦点在轨道上：← → 换张
    const tr = e.target.classList?.contains("ttrack") ? e.target : null; if (!tr || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
    e.preventDefault(); settle(tr); go(tr, pageOf(tr) + (e.key === "ArrowRight" ? 1 : -1));
  });
  // 回到这个页签：当前那条从头走（后台时浏览器会把动画停掉或跳过）
  document.addEventListener("visibilitychange", () => { if (!document.hidden) document.querySelectorAll(".tcarousel").forEach((box) => { const tr = box.querySelector(".ttrack"); if (tr) markDash(box, realOf(tr)); }); });
}
