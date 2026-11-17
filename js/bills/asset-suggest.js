/* 账单 ↔ 资产（车辆 / 设备）的挂靠：给没挂资产的旧账单猜「可能属于哪辆车」，由用户逐张确认（纯函数，Node 可测）。
 * 规则（保守，宁可不猜）：只猜车辆相关的周期性账单（车险、车贷、牌照、通行费、停车），账单名或付款方里恰好包含**一辆**车的名字（≥ 2 个字）才给建议；
 * 同时匹配多辆、一辆都没匹配、已经挂了资产的，都不给建议。设备不猜（名字太容易重名），只能手动选。 */
import { VEHICLE_CATS } from "./instances.js";

const norm = (s) => String(s || "").trim().toLowerCase();

/** bills：周期性账单；assets：assets 表的行；返回 [{ billId, assetId, why }]（why = 命中的那段文字） */
export function suggestAssetLinks(bills, assets) {
  const vehicles = (assets || []).filter((a) => a.kind === "vehicle" && norm(a.name).length >= 2);
  const out = [];
  for (const b of bills || []) {
    if (b.asset_id || !b.active || !VEHICLE_CATS.includes(b.category)) continue;
    const text = `${norm(b.name)} ${norm(b.payee)}`;
    const hit = vehicles.filter((v) => text.includes(norm(v.name)));
    if (hit.length === 1) out.push({ billId: b.id, assetId: hit[0].id, why: hit[0].name });
  }
  return out;
}

/** 「关联资产」下拉的选项：只列车辆和设备（工具不列），车辆在前；selected 即使是别的种类也保留，免得编辑旧数据时丢值 */
export function assetChoices(assets, selected = null) {
  const kinds = { vehicle: 0, equipment: 1 };
  return (assets || []).filter((a) => a.kind in kinds || a.id === selected)
    .sort((x, y) => (kinds[x.kind] ?? 2) - (kinds[y.kind] ?? 2) || String(x.name).localeCompare(String(y.name)));
}
