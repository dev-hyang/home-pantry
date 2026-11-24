/* 明细的「金额」筛选控件（花费 / 收入共用）。规则和选项顺序见 amount-filter-lib.js。
 *  下拉带 data-default="all"：默认「全部金额」时筛选计数不算它；选了「自定义…」才多出「金额从 … 到 …」两个框（可以只填一个）。 */
import { esc } from "./util.js";
import { t } from "./i18n.js";
import { AMT_OPTS } from "./amount-filter-lib.js";
export { amtParams } from "./amount-filter-lib.js";

/** 下拉：neg = 要不要「< 0」（只有花费有退款 / 报销）；id / attr 由调用方给（花费和收入的事件处理不一样） */
export const amtSelectHtml = ({ id, attr = "", cur = "all", neg = false }) =>
  `<select id="${esc(id)}" ${attr} class="amt-sel" data-default="all" data-nosearch aria-label="${esc(t("按金额筛选"))}">${AMT_OPTS.filter(([v]) => neg || v !== "neg").map(([v, l]) => `<option value="${v}" ${v === cur ? "selected" : ""}>${esc(v === "all" || v === "custom" ? t(l) : l)}</option>`).join("")}</select>`;
/** 选了「自定义…」才出现：最低 / 最高（都可以不填）。minAttr / maxAttr 是调用方的事件标记（例如 data-spend-amt="min"） */
export const amtCustomHtml = ({ cur, min = "", max = "", minAttr, maxAttr }) => (cur !== "custom" ? ""
  : `<label class="tb-field"><span>${t("最低")}</span><input type="number" step="0.01" inputmode="decimal" ${minAttr} value="${esc(min)}" placeholder="${esc(t("不限"))}" aria-label="${esc(t("最低金额"))}"></label>`
  + `<label class="tb-field"><span>${t("最高")}</span><input type="number" step="0.01" inputmode="decimal" ${maxAttr} value="${esc(max)}" placeholder="${esc(t("不限"))}" aria-label="${esc(t("最高金额"))}"></label>`);
