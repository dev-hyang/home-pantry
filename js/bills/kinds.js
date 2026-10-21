/* 账单分两种，界面里多处要讲清楚区别（账单概览、周期性账单、一次性账单），统一从这里取文案和入口。
 * 周期性账单：按周期反复出现，系统算下次到期、提前提醒（水电气网、房贷房租、保险、订阅、信用卡…）。
 * 一次性账单：一次事件产生，有总额、可分次付款、有余额，付清就结束（医疗、宠物、法律税务、装修工程…）。 */
import { t } from "../core/i18n.js";
import { href } from "../core/router.js";

export const RECURRING = () => href("bills", "recurring");
export const ONETIME = () => href("bills", "onetime");

/** 一行说明 + 去另一种的入口；kind = "recurring" | "onetime" */
export function kindsNote(kind) {
  return kind === "recurring"
    ? `<p class="muted kinds-note">${t("周期性账单：按周期反复出现，系统算下次到期并提前提醒——水电气网、房贷房租、保险、订阅、信用卡。")} ${t("就诊、装修、工程这类一次性的账单，请到")} <a href="${ONETIME()}">${t("一次性账单")} ›</a></p>`
    : `<p class="muted kinds-note">${t("一次性账单：一次事件产生，有总额、可以分次付、有余额，付清就结束——医疗、宠物、法律税务、装修工程。")} ${t("水电气网这类按周期重复的账单，请到")} <a href="${RECURRING()}">${t("周期性账单")} ›</a></p>`;
}
