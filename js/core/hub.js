/* 枢纽页小部件：一行一个入口（图标、标题、状态文字、完成度条、徽章），和子页顶部的面包屑。
 * 长表单（账单、设备 / 车辆、房屋资料）都用它：先看目录和完成度，点进去只改一块。 */
import { esc } from "./util.js";

/** 一行入口；pct 为空不画进度条 */
export const hubRow = ({ href, icon, title, desc = "", pct = null, badge = "" }) => `<a class="mrow" href="${esc(href)}">
    <span class="mi" aria-hidden="true">${icon}</span>
    <span class="mt"><b>${esc(title)}</b>${desc ? `<small>${desc}</small>` : ""}${pct != null ? `<span class="mprog"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></span>` : ""}</span>
    ${badge}<span class="mch" aria-hidden="true">›</span></a>`;

export const hubList = (rows) => `<div class="panel mlist">${rows.join("")}</div>`;

/** 子页面包屑：‹ 回枢纽 / 当前块 */
export const sectionCrumb = (backHref, backLabel, cur) => `<nav class="crumb" aria-label="位置"><a href="${esc(backHref)}">‹ ${esc(backLabel)}</a><span class="sep">/</span><b>${esc(cur)}</b></nav>`;

/** 计数徽章 n/m */
export const countBadge = (n, m, cls = "") => `<span class="badge mcount ${cls}" style="${cls ? "" : "background:var(--surface-2)"}">${n}/${m}</span>`;

/** 非空字段数 */
export const filledCount = (vals) => vals.filter((v) => v != null && v !== "" && v !== false && !(Array.isArray(v) && !v.length)).length;
