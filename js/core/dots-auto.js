/* 「A · B · C」自动换行：页面上凡是用「 · 」隔开的一行小字（卡片说明、行记录描述、资产信息…），放不下时只在「·」后面换行，
 * 每一段（比如「到期 2026-11-30」「摊派 $120.00」）整段落到下一行，不会从中间拆开。
 * 做法：找到含「 · 」、里面只有文字和行内元素（span / b / a …）的小字容器，把每两个「·」之间的内容包成一个不换行的段（dt-s）；
 * 段太长（折合 > 36 个英文字符宽，一个汉字算 2，比如一大段备注）不加不换行，免得撑出屏幕。只挪动已有的节点，事件和样式不受影响；整页用一个 MutationObserver 处理新画出来的内容。
 * 手写了 .dots / .rf-meta 的地方（core/dots.js、bills/row-fmt.js）已经是这个效果，这里跳过。 */
const SEL = "small, .muted, .kpi-sub, .hv-txt small, td small";
const SKIP = "input, select, textarea, button, details, ul, ol, table, div, p, form, svg, canvas, img";
const SEP = " · ", LONG = 36;
/** 一段文字的宽度（按英文字符算：汉字 / 全角符号算 2）；只数字数的话，一段 30 个汉字会比手机屏幕还宽 */
const width = (txt) => [...txt.trim()].reduce((n, c) => n + (c.charCodeAt(0) > 0x2e80 ? 2 : 1), 0);

function wrap(el) {
  el.dataset.dta = "1";
  if (!el.textContent.includes(SEP) || el.closest(".dots, .rf-meta, [contenteditable], pre") || el.querySelector(SKIP)) return;
  const segs = []; let cur = [];
  const flush = (more) => { if (cur.length) segs.push({ nodes: cur, more }); cur = []; };
  for (const n of [...el.childNodes]) {
    if (n.nodeType !== 3) { cur.push(n); continue; }
    const parts = n.data.split(SEP);
    parts.forEach((p, i) => { if (i > 0) flush(true); if (p) cur.push(document.createTextNode(p)); });
  }
  flush(false);
  if (segs.length < 2) return;
  el.replaceChildren();
  segs.forEach((s, i) => {
    const span = document.createElement("span"); span.className = "dt-s";
    s.nodes.forEach((n) => span.appendChild(n));
    if (width(span.textContent) > LONG) span.classList.add("dt-long");
    if (s.more) span.append(" ·");
    el.appendChild(span); if (i < segs.length - 1) el.appendChild(document.createTextNode(" "));
  });
}

let queue = new Set(), planned = false, obs = null;
function run() {
  planned = false; const list = [...queue]; queue = new Set();
  obs?.disconnect();
  for (const root of list) {
    if (!root.isConnected) continue;
    if (root.matches?.(SEL) && !root.dataset.dta) wrap(root);
    root.querySelectorAll?.(SEL).forEach((e) => { if (!e.dataset.dta) wrap(e); });
  }
  obs?.observe(document.body, { childList: true, subtree: true, characterData: false });
}

export function initDotsAuto() {
  if (typeof MutationObserver === "undefined" || obs) return;
  obs = new MutationObserver((muts) => {
    for (const m of muts) m.addedNodes.forEach((n) => { if (n.nodeType === 1 && !n.classList?.contains("dt-s")) queue.add(n); });
    if (queue.size && !planned) { planned = true; requestAnimationFrame(run); }
  });
  queue.add(document.body); planned = true; requestAnimationFrame(run);
}
