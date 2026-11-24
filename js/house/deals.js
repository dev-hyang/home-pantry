import { houseHooks } from "./hooks.js";
import { registerAlerts } from "../core/alerts.js";
import { dealAlertItems, dealSubLabel, dealTail, historyLabel, openDeal, routeDeal } from "./deal-tasks.js";
export { currentProp, dateLabels, dealAlertItems, dealAlerts, dealAsk, dealHref, dealSubLabel, dealTail, dealTasks, dueText, historyLabel, isVehDeal, kindHref, lagText, openDeal, openVehicleDeal, propertyLive, routeDeal, skipBtn, statusText, taskRow } from "./deal-tasks.js";
export { viewDeal } from "./deal-page.js";
export { applyCloseout, cancelDeal, completeBuy, completeVehicleDeal, deleteCustomTask, saveDealForm, saveDealTaskForm, startDeal, toggleDealSkip, toggleDealTask } from "./deal-actions.js";

Object.assign(houseHooks, { openDeal, routeDeal, dealSubLabel, dealTail, historyLabel });   // 给 menu.js 的面包屑 / 目录用

registerAlerts(dealAlertItems);
