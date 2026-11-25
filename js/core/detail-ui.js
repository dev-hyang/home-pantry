/* 详情页的共用零件（只读的分块信息，每块右上角一个「编辑」）：花费详情、缴费记录详情等共用；样式 .dt-*（styles.css）。 */
import { esc } from "./util.js";
import { t } from "./i18n.js";

const dash = '<span class="muted">—</span>';
/** 一行「名称：值」（值已转义；空值显示 —） */
export const dtRow = (label, val) => `<div data-variant="detail" class="ui-row dt-row"><dt>${esc(label)}</dt><dd>${val || dash}</dd></div>`;
/** 一块：标题 + 右上角编辑（editHref 为空则没有编辑）+ 若干行 */
export const dtBlock = (title, editHref, rows) => `<section class="panel dt-block"><div class="dt-head"><h3>${esc(title)}</h3>${editHref ? `<a class="ui-btn" data-size="sm" data-tone="ghost" href="${esc(editHref)}">${t("编辑")}</a>` : ""}</div><dl class="dt-list">${rows.filter(Boolean).join("")}</dl></section>`;
