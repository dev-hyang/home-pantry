/* “在用 / 已结束”的统一判断：房产卖出 / 退租、车辆卖出 / 归还后，全站的筛选、提醒、统计都用这里的规则。
 * 在用 = 没归档、也没有卖出 / 退租；已结束 = 卖出 / 退租但档案保留（历史页面仍要能查到）；归档 = 用户主动隐藏，只在设置里管理。 */
import { state } from "./state.js";
import { t } from "./i18n.js";

export const ENDED_STATUSES = ["sold", "moved_out"];
export const propertyActive = (p) => !!p && !p.archived && !ENDED_STATUSES.includes(p.status);
export const propertyEnded = (p) => !!p && !p.archived && ENDED_STATUSES.includes(p.status);
export const activeProperties = () => state.properties.filter(propertyActive);
export const endedProperties = () => state.properties.filter(propertyEnded);
export const propertyById = (id) => state.properties.find((p) => p.id === id) || null;
export const vehicleActive = (a) => window.VEHICLES.isActive(a);

/** 账单是否属于“在用”范围：与房产无关的，或房产还在用 */
export const billInUse = (b) => !b.property_id || propertyActive(propertyById(b.property_id));
/** 带状态后缀的名称，已结束的在下拉里一眼能认出：“Rental Condo（已卖出）” */
export const endedSuffix = (p) => (propertyEnded(p) ? `（${t(window.DEALS.PROPERTY_STATUS[p.status])}）` : "");

/** 筛选下拉的房产选项：在用的一组，已结束的放在 optgroup 里；keep 是当前选中的（即使已归档也保留，免得选项消失） */
export function propertyOptionsHtml(selected, { esc, icon = "🏠 " } = {}) {
  const opt = (p) => `<option value="${esc(p.id)}" ${selected === p.id ? "selected" : ""}>${icon}${esc(p.name)}${esc(endedSuffix(p))}</option>`;
  const act = activeProperties(), end = endedProperties(), keep = state.properties.find((p) => p.archived && p.id === selected);
  return `${act.map(opt).join("")}${keep ? opt(keep) : ""}${end.length ? `<optgroup label="${esc(t("已结束（已卖出 / 已退租）"))}">${end.map(opt).join("")}</optgroup>` : ""}`;
}
