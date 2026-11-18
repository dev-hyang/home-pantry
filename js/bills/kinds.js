/* 账单分两种，界面里多处要讲清楚区别（账单概览、周期性账单、一次性账单），统一从这里取文案和入口。
 * 周期性账单：按周期反复出现，系统算下次到期、提前提醒（水电气网、房贷房租、保险、订阅、信用卡…）。
 * 一次性账单：一次事件产生，有总额、可分次付款、有余额，付清就结束（医疗、宠物、法律税务、装修工程…）。 */
import { t } from "../core/i18n.js";
import { href } from "../core/router.js";

/** 新建周期性账单：带 type=recurring 直接进表单；不带任何参数的 #/bill/new 是「先选账单类型」那一步 */
export const NEW_RECURRING = () => `${href("bill", "new")}?type=recurring&n=${Date.now()}`;
