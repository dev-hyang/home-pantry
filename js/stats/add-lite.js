/* 花费页的同步小件：时间栏、范围文字、房产下拉、导出标签。 */
import { FD, changed, clearFiltersBtn } from "../core/clear-filters.js";
import { customBar, monthOpt, rangeChipsHtml, rangeMonths, statOpts, unitSel } from "./spend-roll.js";
import { esc } from "../core/util.js";
import { rangeLabelOf } from "../core/time-range.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";
import { viewAnnualExport } from "./spend-stores.js";
import { activeProps } from "./add-lite-common.js";
import { filterPop } from "../core/filter-pop.js";
import { finUnit } from "../core/time-range.js";

/** 房产下拉的选项；空 = 不关联 */
export const propertyOptions = (sel) => `<option value="" ${!sel ? "selected" : ""}>${t("不关联房产")}</option>${activeProps().map((p) => `<option value="${esc(p.id)}" ${p.id === sel ? "selected" : ""}>${esc(p.name)}</option>`).join("")}`;
export function spendExportTab() {
  return `${viewAnnualExport()}
    <section class="section">
      <div class="section-head"><h2>${t("打印")}</h2><p>${t("浏览器的打印窗口里也可以另存为 PDF")}</p></div>
      <div class="panel export-grid">
        <label class="export-pick"><span>${t("时间范围")}</span><select id="printRange" data-nosearch>${[3, 6, 12].map((n) => `<option value="${n}" ${n === +state.stats.months ? "selected" : ""}>${t("近 {n} 个月", { n })}</option>`).join("")}</select></label>
        <div class="export-btns"><button type="button" class="btn btn-primary btn-sm" data-action="print-run" data-kind="spend">${t("打印花费统计")}</button></div>
      </div>
      <p class="muted" style="margin:6px 0 0;font-size:13px">${t("要打印筛选后的明细，到“明细”标签里点“打印”。")}</p>
    </section>`;
}
/** 时间条：时间范围 + 月份（分类 / 商店页才有；默认「整段」= 和时间范围一致）+ 排除资本性 / 投资 的开关，放在标签下面、内容上面，一眼能看到。
 *  tab 为空 = 只有时间范围（预算趋势页用，同一个范围值） */
export function timeBarHtml(tab, { unitMonths = null } = {}) {
  const clr = clearFiltersBtn("stats", changed(state.stats, FD.stats) || finUnit() !== "auto");
  const n = ["months", "month", "exCap", "exInv"].filter((k) => changed(state.stats, FD.stats, [k])).length + (finUnit() !== "auto" ? 1 : 0);
  const pop = (inner) => filterPop(`<div class="fpop-fields">${inner}</div>`, { id: "stats", count: n, clear: clr });
  if (!tab) return pop(`<label class="tb-field"><label class="tb-field"><span>${t("时间范围")}</span>${rangeChipsHtml()}</label>${customBar()}${unitMonths ? unitSel(unitMonths) : ""}`);
  const ms = rangeMonths(), withMonth = tab === "category" || tab === "stores" || tab === "all";
  const m = state.stats.month && ms.includes(state.stats.month) ? state.stats.month : "";
  const monthSel = withMonth && ms.length > 1 ? `<label class="tb-field"><span>${t("月份")}</span><select id="statsMonth" aria-label="${t("选择月份")}" data-nosearch><option value="" ${m ? "" : "selected"}>${t("整段（{r}）", { r: rangeLabel() })}</option>${[...ms].reverse().map((x) => `<option value="${x}" ${x === m ? "selected" : ""}>${monthOpt(x)}</option>`).join("")}</select></label>` : "";
  const o = statOpts(), tg = (act, on, label, tip) => `<label class="check-inline" title="${esc(tip)}"><input type="checkbox" data-action="${act}" ${on ? "checked" : ""}><span>${label}</span></label>`;
  const withUnit = tab === "overview" || tab === "category" || tab === "all";
  return pop(`<label class="tb-field"><span>${t("时间范围")}</span>${rangeChipsHtml()}</label>${customBar()}${withUnit ? unitSel() : ""}${monthSel}
    ${tg("stats-excap", o.exCap, t("排除资本性"), t("买房卖房、买车整付、装修：几年一次、金额巨大，默认不画进图里；去掉勾可以一起看"))}
    ${tg("stats-exinv", o.exInv, t("排除投资"), t("转入投资账户、买基金股票：钱还是家里的，默认不画进图里；去掉勾可以一起看"))}`);
}
/** 当前时间范围的叫法：近 6 个月 / 今年 / 2025 年 */
export const rangeLabel = (n = state.stats.months) => rangeLabelOf(n);
