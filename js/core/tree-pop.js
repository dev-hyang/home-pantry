/* 嵌套目录（「目录」按钮 + 多层面板）：财务这类分好几层的区域用，一个按钮从头到尾，打开时直接停在当前所在的位置。
 *  树：组 → 页面 → 页内标签；结点 = { label, icon?, href?, badge?, current?, open?, children? }
 *    · current = 正停在这一项上（高亮 + 打 ✓）；open = 打开面板时这一层是展开的（当前所在的组 / 页面都要标 open）
 *    · 有 href 又有 children：这一行点文字是跳转，右边的 › 展开 / 收起下一层；没有 href：整行是展开 / 收起
 *    · 同一层只展开一个（手风琴），面板不会越拉越长
 *  外观和开关（点外面收起、Esc、页面重画后保持打开）沿用 filter-pop.js 的 .fpop；打开时面板滚到当前项（那边的 centerCurrent）。 */
import { esc } from "./util.js";
import { t } from "./i18n.js";
import { ICON_MENU, isOpen } from "./filter-pop.js";
import { siteTree } from "./site-tree.js";

const row = (n, lv) => {
  const cur = n.current ? ' aria-current="page" data-tpop-cur' : "";
  const inner = `<span class="npop-ico" aria-hidden="true">${n.icon || ""}</span><span class="npop-lbl">${esc(n.label)}</span>${n.badge ? `<span class="ui-badge" data-tone="warn" data-size="sm">${esc(String(n.badge))}</span>` : ""}${n.current ? '<span class="npop-ck" aria-hidden="true">✓</span>' : ""}`;
  const kids = n.children?.length;
  if (!kids) return `<a class="ui-opt npop-item" href="${esc(n.href || "#/")}"${cur}>${inner}</a>`;
  const exp = !!n.open, tg = (cls, label) => `<button type="button" class="${cls}" data-tpop-toggle aria-expanded="${exp}" aria-label="${esc(label)}">`;
  const head = n.href
    ? `<a class="ui-opt npop-item" href="${esc(n.href)}"${cur}>${inner}</a>${tg("tpop-tg", t("展开 / 收起"))}<span aria-hidden="true">›</span></button>`
    : `${tg("ui-opt npop-item tpop-grp", n.label)}${inner}<span class="ui-chev" aria-hidden="true">›</span></button>`;
  return `<div class="tpop-node" data-lv="${lv}"><div class="tpop-row">${head}</div><div class="tpop-kids"${exp ? "" : " hidden"}>${n.children.map((c) => row(c, lv + 1)).join("")}</div></div>`;
};

/** 面板最下面「本页操作」：不是去别的页面、而是做一件事（打印、导出…）；items = [{ label, icon?, href? | action + data? }] */
const actionRow = (x) => {
  const inner = `<span class="npop-ico" aria-hidden="true">${x.icon || ""}</span><span class="npop-lbl">${esc(x.label)}</span>`;
  if (x.href) return `<a class="ui-opt npop-item" href="${esc(x.href)}">${inner}</a>`;
  const data = Object.entries(x.data || {}).map(([k, v]) => ` data-${k}="${esc(v)}"`).join("");
  return `<button type="button" class="ui-opt npop-item"${x.action ? ` data-action="${esc(x.action)}"` : ""}${data}>${inner}</button>`;
};

/** nodes = 树；id = 面板 id（同一页只放一个）；label = 按钮上的名字；actions = 本页操作 */
export function treePop(nodes0, { id = "tree", label = t("目录"), actions = [], site = true } = {}) {
  const nodes = site ? siteTree(nodes0) : nodes0;   // 第一层 = 底部导航的 6 个区域（site-tree.js）
  const open = isOpen(id), acts = actions.filter(Boolean);
  return `<div class="fpop npop tpop" data-fpop="${esc(id)}"${open ? " data-open" : ""}>
    <button type="button" class="fpop-btn" aria-expanded="${open}" aria-controls="fpop-${esc(id)}" aria-label="${esc(label)}" data-fpop-toggle>${ICON_MENU}<span>${esc(label)}</span></button>
    <div class="fpop-panel" id="fpop-${esc(id)}"${open ? "" : " hidden"}>
      <div class="fpop-head"><b>${esc(label)}</b></div>
      <nav class="npop-list tpop-list" aria-label="${esc(label)}">${nodes.map((n) => row(n, 0)).join("")}</nav>
      ${acts.length ? `<div class="tpop-acts" role="group" aria-label="${esc(t("本页操作"))}">${acts.map(actionRow).join("")}</div>` : ""}
    </div></div>`;
}

/** 点展开 / 收起：同一层其余的收起（手风琴） */
if (typeof document !== "undefined") document.addEventListener("click", (e) => {
  const b = e.target.closest?.("[data-tpop-toggle]"); if (!b) return;
  const node = b.closest(".tpop-node"), kids = node.querySelector(":scope > .tpop-kids"), on = kids.hidden;
  if (on) node.parentElement.querySelectorAll(":scope > .tpop-node").forEach((s) => { if (s !== node) { s.querySelector(":scope > .tpop-kids").hidden = true; s.querySelectorAll(":scope > .tpop-row [data-tpop-toggle]").forEach((x) => x.setAttribute("aria-expanded", "false")); } });
  kids.hidden = !on;
  node.querySelectorAll(":scope > .tpop-row [data-tpop-toggle]").forEach((x) => x.setAttribute("aria-expanded", String(on)));
});
