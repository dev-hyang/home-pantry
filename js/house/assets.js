import { houseHooks } from "./hooks.js";
import { state } from "../core/state.js";
import { daysUntil, fmtDate } from "../core/util.js";
import { href } from "../core/router.js";
import { t } from "../core/i18n.js";
import { registerAlerts } from "../core/alerts.js";
import { activeProperties } from "../core/lifecycle.js";
import { recallOf } from "./recall.js";
import { activeVehicles, assetName, enrichAssets, isVehicle, maintFilter, myVehicles } from "./assets-logic.js";
import { assetAsk } from "./asset-list.js";
import { V, alertAct, alertBadge, alertText, assetAlerts } from "./asset-common.js";

export { activeVehicles, assetName, enrichAssets, isVehicle, maintFilter, myVehicles } from "./assets-logic.js";
/** 车辆列表（不分房产）：全部 / 还在用的（含选购中）/ 已卖出、已归还的 */
export const pastVehicles = () => myVehicles().filter((a) => !V().isActive(a)).sort((x, y) => (y.vehicle?.disposed_on || "").localeCompare(x.vehicle?.disposed_on || ""));
/** 设备提醒行的竖三点菜单：详情；召回时再多一个「记保养」 */
export const assetMenu = (a) => [{ label: t("详情"), href: href("asset", a.id) }, a.recallSt && { label: t("记保养"), href: `${href("asset", a.id)}?log=1` }];
/** 提醒总线：所有活跃房产的设备 + 家庭的车辆（检查发现问题 = 尽快·必须；保养逾期 = 今天级；到期 / 保修 = 尽快级） */
export function assetAlertItems() {
  if (!state.houseEnabled || state.pending?.maint) return [];   // 保养记录还在加载：没有记录会被误判成“从没保养过”
  const live = new Set(activeProperties().map((p) => p.id));
  // 召回：停止使用 = 紧急·必须，待处理 = 尽快·必须，直到在设备页选了处理结果
  const out = assetAlerts(state.assetsEnriched.filter((a) => (isVehicle(a) ? V().inService(a) : live.has(a.property_id)))).map((a) => ({
    source: "asset", severity: a.recallSt === "stop_use" ? 0 : a.recallSt ? 2 : a.followUp ? 2 : a.service === "overdue" ? 1 : 2, must: !!(a.recallSt || a.followUp), due: a.recallSt ? null : a.next,
    daysLeft: a.recallSt ? (recallOf(a).found_on ? daysUntil(recallOf(a).found_on) : null) : a.followUp ? -(-daysUntil(a.followUp.done_on)) : a.service === "overdue" || a.service === "due" ? a.dueDays : a.wDays,
    asset_id: a.id, property_id: a.property_id, title: `${a.recallSt === "stop_use" ? "⛔" : a.t?.icon || "⚙️"} ${assetName(a)}`, detail: alertText(a), href: href("asset", a.id),
    badge: alertBadge(a), actions: [{ type: "link", ...alertAct(a) }], ask: assetAsk(a), dotRow: true, menu: assetMenu(a),
  }));
  // 车辆证照与保险：牌照 / 排放 / 保险 30 天内到期（尽快·必须，过期 → 今天）；租赁 90 天内（留意）
  for (const a of state.assetsEnriched.filter((x) => isVehicle(x) && V().inService(x))) {
    const D = a.vDocs || {};
    const push = (key, label, d, within, sevLate, mustFlag) => {
      if (!d || d.days > within) return;
      out.push({ source: "asset", severity: d.days < 0 ? sevLate : within <= 30 ? 2 : 3, must: mustFlag, due: d.date, daysLeft: d.days, asset_id: a.id, property_id: null,
        title: `${a.t?.icon || "🚗"} ${assetName(a)} · ${label}`, detail: d.days < 0 ? t("已过期 {d} 天", { d: -d.days }) : d.days === 0 ? t("今天到期") : t("{d} 天后到期（{date}）", { d: d.days, date: fmtDate(d.date) }),
        href: href("asset", a.id), badge: { label: d.days < 0 ? t("已过期") : t("快到期"), cls: d.days < 0 ? "b-out" : "b-soon" }, actions: [{ type: "link", href: href("asset", a.id), label: t("更新") }], dotRow: true, menu: [{ label: t("详情"), href: href("asset", a.id) }] });
    };
    push("registration", t("牌照年贴"), D.registration, 30, 1, true);
    push("emissions", t("排放检测"), D.emissions, 30, 1, true);
    push("insurance", t("车险续保"), D.insurance, 30, 1, true);
    push("lease", t("租赁到期"), D.lease, 90, 2, false);
  }
  return out;
}
/** 设备要处理的台数（2026-11 起全站唯一口径：首页「设备保养」、房屋首页、房产目录、车辆行都用它）。
 * 定义 = 提醒总线里 source=asset 的提醒按设备去重：在用房产的设备（召回、检查发现问题、保养逾期 / 30 天内到期、保修 30 天内到期）
 * + 在用车辆（保养、牌照 / 排放 / 车险 / 租赁到期）；退役的、已结束房产的不算。一辆车同时有保养和车险到期只算 1 台。
 * where：{ property: 房产 id } 只算这套房产的设备；{ vehicles: true } 只算车辆；不传 = 全部 */
export function assetsDue(where = {}, items = assetAlertItems()) {
  const ids = new Set();
  for (const x of items) {
    if (x.source !== "asset" || !x.asset_id) continue;
    const veh = isVehicle(state.assetsEnriched.find((a) => a.id === x.asset_id));
    if (where.vehicles ? !veh : where.property !== undefined && (veh || x.property_id !== where.property)) continue;
    ids.add(x.asset_id);
  }
  return [...ids];
}
export const assetsDueCount = (where) => assetsDue(where).length;
export { C, H, OWNER_OPTS, SERVICE_BADGE, V, WARRANTY_BADGE, alertAct, alertBadge, alertText, assetAlerts, distUnit, isFixture, isPortable, myAssets, retiredAssets, unitsCount, unitsOf, unitsText, vehStatus, vehStatusBadge, vehicleLoanNote } from "./asset-common.js";
export { assetAsk, careCard, renderAssetList, viewAssets } from "./asset-list.js";
export { assetCard, pastVehiclesSection } from "./vehicles-page.js";
export { assetTemplateItems, viewAssetTemplate } from "./asset-templates.js";
export { guessAssetType, leaveAsset, openAsset, unitRow, viewAssetForm } from "./asset-form.js";
export { supplyItem } from "./asset-supplies.js";
export { renderMaintLogs, saveMaintForm } from "./asset-maint.js";
export { onAssetFormChange, onMaintFormChange, saveAssetForm } from "./asset-save.js";
houseHooks.assetsDueCount = assetsDueCount;   // 给 menu.js 的目录计数用

registerAlerts(assetAlertItems);
