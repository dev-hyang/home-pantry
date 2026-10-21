/* 枢纽页小部件：一行一个入口（图标、标题、状态文字、完成度条、徽章），和子页顶部的面包屑。
 * 长表单（账单、设备 / 车辆、房屋资料）都用它：先看目录和完成度，点进去只改一块。 */
import { esc } from "./util.js";
import { t } from "./i18n.js";

/** 一行入口；pct 为空不画进度条 */
export const hubRow = ({ href, icon, title, desc = "", pct = null, badge = "" }) => `<a class="mrow" href="${esc(href)}">
    <span class="mi" aria-hidden="true">${icon}</span>
    <span class="mt"><b>${esc(title)}</b>${desc ? `<small>${desc}</small>` : ""}${pct != null ? `<span class="mprog"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></span>` : ""}</span>
    ${badge}<span class="mch" aria-hidden="true">›</span></a>`;

export const hubList = (rows) => `<div class="panel mlist">${rows.join("")}</div>`;

/** 面包屑：一行连续的层级，最后一项加粗当标题，中间项可点（href 链接或 action 按钮）。
 * parts: [{ href?, action?, attrs?, label, icon? }, …]；全站所有子页都用它，页面不再另起一行标题。 */
export function crumbNav(parts, cls = "") {
  const node = (p, i, last) => {
    const label = `${p.icon ? `${p.icon} ` : ""}${esc(p.label)}`;
    if (last) return `<b aria-current="page">${label}</b>`;
    if (p.action) return `<button type="button" class="link-name crumb-mid" data-action="${esc(p.action)}" ${p.attrs || ""}>${label}</button>`;
    return `<a href="${esc(p.href || "#/")}">${i === 0 ? "‹ " : ""}${label}</a>`;
  };
  return `<nav class="crumb ${cls}" aria-label="${t("位置")}">${parts.map((p, i) => `${i ? `<span class="sep">/</span>` : ""}${node(p, i, i === parts.length - 1)}`).join("")}</nav>`;
}
/** 枢纽子页面包屑：‹ 来源页 / 枢纽（如“电费”） / 当前块；root 省略时两级 */
export const sectionCrumb = (backHref, backLabel, cur, root = null) => crumbNav([...(root ? [root] : []), { href: backHref, label: backLabel }, { label: cur }]);

/** 计数徽章 n/m */
export const countBadge = (n, m, cls = "") => `<span class="badge mcount ${cls}" style="${cls ? "" : "background:var(--surface-2)"}">${n}/${m}</span>`;

/** 非空字段数 */
export const filledCount = (vals) => vals.filter((v) => v != null && v !== "" && v !== false && !(Array.isArray(v) && !v.length)).length;

/** 页内标签条（三级导航）：链接形式，地址带 ?tab=，后退键、分享、刷新都保持在同一标签；手机上可横向滑动 */
export const tabBar = (tabs, active, hrefOf, label) => `<nav class="subtabs" aria-label="${esc(label)}">${tabs.map(([id, name, icon]) =>
  `<a href="${esc(hrefOf(id))}" class="subtab" ${id === active ? 'aria-current="page"' : ""}><span aria-hidden="true">${icon}</span> ${esc(t(name))}</a>`).join("")}</nav>`;

/** 窄屏的“入口行”：第一个标签下面列出其余标签，每行带图标和一句说明；宽屏隐藏（那里用标签条）。hrefOf 与 tabBar 共用 */
export const tabHub = (tabs, hrefOf, title) => `<section class="section tabhub"><div class="section-head"><h2>${esc(title)}</h2></div>${hubList(tabs.filter((x) => x[3]).map(([id, name, icon, desc]) => hubRow({ href: hrefOf(id), icon, title: t(name), desc: esc(t(desc)) })))}</section>`;
