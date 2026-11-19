/* 账单 ↔ 资产（车辆 / 设备）：表单里的「关联资产」下拉、旧账单的「可能属于哪辆车」建议条。
 * 纯逻辑在 asset-suggest.js；这里是界面（用到 state / i18n / Store）。设计见 docs/design-bills-overview.md §6。 */
import { state } from "../core/state.js";
import { Store } from "../core/store.js";
import { esc } from "../core/util.js";
import { t } from "../core/i18n.js";
import { assetChoices, suggestAssetLinks } from "./asset-suggest.js";

const ICON = { vehicle: "🚗", equipment: "🔧", tool: "🧰" };
/** 数据库里有没有 asset_id 这一列（迁移 076 / 077）：演示模式有；云端看读回来的行有没有这个键；还没有任何账单时按「有」处理（保存时没挂资产也能兜底） */
export const hasAssetColumn = (list) => Store.mode === "demo" || !list.length || list.some((r) => "asset_id" in r);

/** 表单里的「关联资产」下拉；没有车辆 / 设备，或数据库还没升级，返回空串（表单不显示这一项） */
export function assetSelectHtml(selected, list) {
  const choices = assetChoices(state.assets, selected);
  if (!hasAssetColumn(list) || !choices.length) return "";
  return `<label>${t("关联资产（车辆 / 设备）")}<select name="asset_id" data-search><option value="">${t("不关联")}</option>${choices.map((a) => `<option value="${a.id}" ${a.id === selected ? "selected" : ""}>${ICON[a.kind] || ""} ${esc(a.name)}</option>`).join("")}</select>
    <small>${t("车险、车贷、保养、维修等账单挂在对应的车或设备上，账单里就能按资产筛选。")}</small></label>`;
}

/* ── 旧账单的挂靠建议（忽略的记在本机） ── */
const KEY = "hmh-asset-suggest-ignored";
const ignored = () => { try { return new Set(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch { return new Set(); } };
export function ignoreSuggestion(billId) { try { const s = ignored(); s.add(billId); localStorage.setItem(KEY, JSON.stringify([...s])); } catch { /* 忽略 */ } }

/** 清单页顶上的一条：「这几张账单可能属于某辆车」，每张有 确认 / 忽略 */
export function assetSuggestHtml() {
  if (!hasAssetColumn(state.bills)) return "";
  const skip = ignored(), list = suggestAssetLinks(state.billsEnriched, state.assets).filter((s) => !skip.has(s.billId));
  if (!list.length) return "";
  const byId = new Map(state.billsEnriched.map((b) => [b.id, b])), car = new Map(state.assets.map((a) => [a.id, a]));
  return `<div class="panel cta-panel" style="display:block;margin-bottom:12px" role="region" aria-label="${t("账单可能属于某辆车")}">
    <b>${t("这 {n} 张账单可能属于某辆车", { n: list.length })}</b>
    <p class="muted" style="margin:4px 0 8px">${t("按名字猜的，确认后账单就挂在这辆车上；不对就点“忽略”。")}</p>
    <ul class="restock-list">${list.map((s) => `<li><div class="grow"><b>${esc(byId.get(s.billId)?.name || "")}</b><small>${t("可能是")} 🚗 ${esc(car.get(s.assetId)?.name || "")}</small></div>
      <button type="button" class="btn btn-sm" data-action="bill-link-asset" data-id="${s.billId}" data-asset="${s.assetId}">${t("确认")}</button>
      <button type="button" class="btn btn-sm btn-ghost" data-action="bill-link-ignore" data-id="${s.billId}">${t("忽略")}</button></li>`).join("")}</ul></div>`;
}

/** 确认：把这张账单挂到那辆车上（要传整张账单：saveBill 会把没带的字段写成空） */
export async function linkBillAsset(billId, assetId) {
  const b = state.billsEnriched.find((x) => x.id === billId); if (!b) return false;
  await Store.saveBill({ ...b, asset_id: assetId });
  return true;
}
