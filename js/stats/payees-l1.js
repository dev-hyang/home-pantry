/* 收款方页的「只看」（一级分类）：放在页头右边的筛选按钮里（add-lite.js 的 timeBarHtml），和时间范围一起；选中值记在 state.stats.storeL1。 */
import { esc } from "../core/util.js";
import { L1S } from "../core/taxonomy.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";

/** 当前选中的一级分类（没有 / 不认识 = all；转账不在收款方里） */
export const storeL1Of = () => (L1S.some((x) => x.id === state.stats.storeL1 && x.id !== "transfer") ? state.stats.storeL1 : "all");

export const storeL1Select = () => {
  const l1 = storeL1Of();
  return `<label class="tb-field"><span>${t("只看")}</span><select id="statsStoreL1" data-nosearch aria-label="${t("按一级分类筛选收款方")}"><option value="all" ${l1 === "all" ? "selected" : ""}>${t("全部花费（不含转账）")}</option>${L1S.filter((x) => x.id !== "transfer").map((x) => `<option value="${x.id}" ${x.id === l1 ? "selected" : ""}>${x.icon} ${esc(t(x.name))}</option>`).join("")}</select></label>`;
};
