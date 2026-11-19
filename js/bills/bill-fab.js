/* 右下角圆形「＋」添加账单（账单概览和全部账单共用）：点开选周期性 / 一次性 */
import { t } from "../core/i18n.js";
import { NEW_RECURRING } from "./kinds.js";
import { detailHref } from "./medical.js";

export function fabHtml() {
  return `<details class="bill-fab"><summary aria-label="${t("添加账单")}" title="${t("添加账单")}"><span aria-hidden="true">＋</span></summary>
    <div class="bill-fab-menu" role="menu"><a role="menuitem" href="${NEW_RECURRING()}">🔁 ${t("周期性账单")}<small>${t("水电气网、房贷、保险、订阅…")}</small></a><a role="menuitem" href="${detailHref("new")}">🧾 ${t("一次性账单")}<small>${t("医疗、装修工程、法律、旅行…")}</small></a></div></details>`;
}
