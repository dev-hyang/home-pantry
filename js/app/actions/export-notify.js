/* 导出 JSON、浏览器通知。 */
import { APP_NAME } from "../chrome.js";
import { Store } from "../../core/store.js";
import { collectAlerts, withProperty } from "../../core/alerts.js";
import { financeOk } from "../../core/finance-access.js";
import { joinList, t } from "../../core/i18n.js";
import { state } from "../../core/state.js";

/** 导出里的房产 / 设备 / 交易：没财务权限时去掉价格（买入 / 卖出价、成交价、定金、设备买价 / 更换估价、车辆卖出价），和界面一致 */
function pricedExport() {
  if (financeOk()) return { properties: state.properties, assets: state.assets, property_deals: state.deals };
  const drop = (o, keys) => { const x = { ...o }; for (const k of keys) delete x[k]; return x; };
  return { properties: state.properties.map((p) => drop(p, ["purchase_price", "sale_price"])),
    assets: state.assets.map((a) => ({ ...drop(a, ["purchase_price", "replacement_cost_estimate"]), ...(a.vehicle ? { vehicle: drop(a.vehicle, ["sale_price"]) } : {}) })),
    property_deals: state.deals.map((d) => drop(d, ["price", "earnest_money"])) };
}
export async function exportJson() {
  let purchases = []; try { purchases = await Store.listPurchases(); } catch { /* 读不到就不导出花费 */ }   // 花费不在内存里：导出时按需读全部（迁移 057）
  const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), household: state.household?.name, items: state.items, shopping: state.shopping, purchases, medical_bills: state.medBills, medical_payments: state.medPayments,
    ...pricedExport(), house_profile: state.houseProfile, maintenance_logs: state.maintLogs, seasonal_tasks: state.seasonalDone,
    bills: state.bills, bill_payments: state.billPayments, deal_task_done: state.dealDone, deal_task_overrides: state.dealOverrides, deal_custom_tasks: state.dealCustom }, null, 2)], { type: "application/json" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `pantry-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export function notifyIfNeeded() {
  // 浏览器通知：紧急和今天两档有新增时弹一次，内容带房产名
  const urgent = collectAlerts().filter((x) => x.severity <= 1);
  const prev = state.lastAlertCount;
  state.lastAlertCount = urgent.length;
  if (prev === null ? urgent.length === 0 : urgent.length <= prev) return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try { new Notification(t(APP_NAME), { body: t("{n} 件事要马上处理：{list}", { n: urgent.length, list: joinList(urgent.slice(0, 4).map((x) => withProperty(x.property_id, x.title))) }) }); } catch { /* 部分移动浏览器只允许 Service Worker 通知 */ }
}
