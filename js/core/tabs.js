/* 账单 → 花费 / 预算 的第三层分页（页内标签，地址里用 ?tab=）。
 * 层级：底部页签（一级）→ 目录里的二级页（花费、预算…）→ 页内标签（三级，只换内容，不新开页面）。
 * 面包屑和各页共用这里的定义。 */
export const SPEND_TABS = [["overview", "概览", "📊"], ["category", "分类", "🧩"], ["stores", "商店", "🏪"], ["records", "明细", "🧾"], ["export", "导出打印", "🖨️"]];
export const BUDGET_TABS = [["month", "本月", "📆"], ["bills", "账单", "🧾"], ["plan", "规划", "🧮"], ["trend", "趋势", "📈"], ["goals", "目标", "🎯"]];
const DEFS = { spend: SPEND_TABS, budget: BUDGET_TABS };

/** 当前路由的页内标签 id（不认识的回到第一个）；不是花费 / 预算页返回 null */
export function activeTab(r) {
  const defs = r?.section === "bills" ? DEFS[r.sub] : null; if (!defs) return null;
  const q = r.q?.get("tab");
  return defs.some(([k]) => k === q) ? q : defs[0][0];
}
export const tabLabel = (r) => (DEFS[r?.sub] || []).find(([k]) => k === activeTab(r))?.[1] || "";
