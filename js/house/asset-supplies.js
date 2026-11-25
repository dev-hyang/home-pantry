/* 设备 ↔ 耗材：这类设备用到的耗材，对应 储藏 → 库存 → 汽车房屋消耗品 里的物品。 */
import { STATUS, state } from "../core/state.js";
import { esc, inSpace } from "../core/util.js";
import { href } from "../core/router.js";
import { openShopFor } from "../core/logic.js";
import { t } from "../core/i18n.js";
import { H } from "./asset-common.js";

/* ── 设备 ↔ 耗材：这类设备用到的耗材，对应 储藏 → 库存 → 汽车房屋消耗品 里的物品；没备的可一键按模板加进库存 ── */
const supplyTpl = (name, region) => [region, "na", "cn"].map((r) => (H().SUPPLIES[r] || []).find((s) => s.name === name)).find(Boolean) || null;
/** 按模板名生成一条库存物品（名称、单位按当前语言写入，之后作为用户数据不再翻译） */
export function supplyItem(name) {
  const r = supplyTpl(name, state.houseProfile?.region); if (!r) return null;
  return { name: t(r.name), category: r.category, subcategory: r.sub || null, unit: t(r.unit), quantity: r.qty, min_quantity: Math.min(r.min || 0, Math.max(0, r.qty - 1)),
    location: r.loc || null, expiry_date: null, lead_days: 14, avg_daily_use: r.every ? Math.round((1 / r.every) * 1000) / 1000 : null, notes: r.note ? t(r.note) : null };
}
export function supplyRows(a) {
  const region = state.houseProfile?.region, mine = state.enriched.filter(inSpace("house"));
  // 物品表单里“关联设备”勾了这台设备的耗材，排在最前
  const linked = mine.filter((i) => Array.isArray(i.asset_ids) && i.asset_ids.includes(a.id)).map((item) => ({ name: item.name, item }));
  const rest = [...new Set(H().ASSET_SUPPLIES[a.type] || [])].map((name) => ({ name, item: mine.find((i) => [name, t(name)].includes(i.name.trim())) || null }))
    // 没备的只列当前地区模板里有的（例如北美列 AA 电池，国内列 5 号电池）
    .filter((r) => (r.item ? !linked.some((l) => l.item.id === r.item.id) : (H().SUPPLIES[region || "na"] || []).some((s) => s.name === r.name) || (!region && supplyTpl(r.name))));
  return [...linked, ...rest];
}
export function suppliesSection(a) {
  const rows = supplyRows(a);
  const li = ({ name, item }) => item
    ? `<li><span class="badge ${STATUS[item.status].cls}">${t(STATUS[item.status].label)}</span>
        <div class="grow"><a class="link-name" href="${href("item", item.id)}">${esc(item.name)}</a><small>${t("剩 {q} {u}", { q: Math.round(item.dqty * 100) / 100, u: t(item.du) })}${item.location ? ` · 📍${esc(t(item.location))}` : ""}</small></div>
        ${openShopFor(item.id) ? `<span class="badge b-ok">${t("已在清单")}</span>` : `<button type="button" class="ui-btn" data-size="sm" data-action="shop-add-item" data-id="${item.id}">${t("加入购物车")}</button>`}</li>`
    : `<li><span class="badge" style="background:var(--surface-2)">${t("还没备")}</span>
        <div class="grow"><b>${esc(t(name))}</b><small>${t("库存里还没有这项")}</small></div>
        <button type="button" class="ui-btn" data-size="sm" data-tone="primary" data-action="supply-add" data-name="${esc(name)}">${t("加入库存")}</button></li>`;
  return `<div class="panel"><p class="muted" style="margin:0 0 8px;font-size:13px">${t("这类设备用到的耗材。库存统一在 储藏 → 库存 → 汽车房屋消耗品 里管理，少货会进采购提醒。")}</p>
    <ul class="restock-list">${rows.map(li).join("")}</ul>
    <div class="ui-acts" style="margin-top:10px"><a class="ui-btn" data-size="sm" data-tone="ghost" href="${href("pantry", "inventory")}?space=house">${t("看全部汽车房屋消耗品")}</a></div></div>`;
}
export const ASSET_SECTIONS = [
  { id: "basic", icon: "🏷️", name: "基本信息" },
  { id: "units", icon: "📍", name: "位置与数量", fx: true },
  { id: "plate", icon: "🪪", name: "车牌与里程", veh: true },
  { id: "docs", icon: "📄", name: "拥有状态与证照", veh: true },
  { id: "insurance", icon: "🛡️", name: "车险", veh: true },
  { id: "years", icon: "📆", name: "年份与保修" },
  { id: "life", icon: "⏳", name: "寿命与保养周期", eq: true },
  { id: "cost", icon: "💵", name: "费用与负责方" },
  { id: "notes", icon: "📝", name: "备注" },
];
/** 车辆页「账单」入口上的一句话：挂在这辆车上的账单有几张、几张要处理（逾期 / 待核对 / 7 天内到期） */
export function vehBillsStat(a) {
  const rec = (state.billsEnriched || []).filter((b) => b.asset_id === a.id && b.active && !b.ended), one = (state.medEnriched || []).filter((b) => b.asset_id === a.id);
  const n = rec.length + one.length; if (!n) return t("还没有账单");
  const hot = rec.filter((b) => ["overdue", "due", "soon", "verify"].includes(b.status)).length + one.filter((b) => b.open && b.daysLeft != null && b.daysLeft <= 7).length;
  return hot ? t("{n} 张账单，{h} 张要处理", { n, h: hot }) : t("{n} 张账单", { n });
}
