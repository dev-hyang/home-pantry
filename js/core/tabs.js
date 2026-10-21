/* 账单 → 花费 / 预算 的第三层分页（页内标签，地址里用 ?tab=）。
 * 层级：底部页签（一级）→ 目录里的二级页（花费、预算…）→ 页内标签（三级，只换内容，不新开页面）。
 * 面包屑和各页共用这里的定义。 */
/* [id, 名称, 图标, 窄屏入口行的说明]。
 * 宽屏（laptop / iPad）：页面顶部一条标签。
 * 窄屏（≤ 440px，iPhone Pro Max 宽度）：不画标签条；第一个标签的内容下面放“入口行”，点进去是子页，靠面包屑 / 返回手势回上一层。 */
export const SPEND_TABS = [["overview", "概览", "📊"], ["category", "分类", "🧩", "分类占比和单个分类的月度趋势"], ["stores", "商店", "🏪", "各商店、收款方花了多少"], ["records", "明细", "🧾", "查看、搜索、补记花费"], ["export", "导出打印", "🖨️", "年度 CSV 和打印"]];
export const BUDGET_TABS = [["month", "本月", "📆"], ["bills", "账单", "🧾", "固定账单、订阅年成本、现金流"], ["plan", "规划", "🧮", "各类月预算、补货、大件基金、大额购物、应急金"], ["trend", "趋势", "📈", "预算对比实际、年度预算"], ["goals", "目标", "🎯", "储蓄目标和家庭分摊"]];
export const MEDICAL_TABS = [["overview", "概览", "🏥"], ["list", "账单", "🧾", "全部医疗账单：按患者、医院、状态筛选"], ["report", "年度报表", "📊", "按患者和医院汇总，HSA / 报税导出"]];
const DEFS = { spend: SPEND_TABS, budget: BUDGET_TABS, medical: MEDICAL_TABS };
export const firstTab = (r) => (DEFS[r?.sub] || [])[0]?.[0] || null;

/** 当前路由的页内标签 id（不认识的回到第一个）；不是花费 / 预算页返回 null */
export function activeTab(r) {
  const defs = r?.section === "bills" ? DEFS[r.sub] : null; if (!defs) return null;
  const q = r.q?.get("tab");
  return defs.some(([k]) => k === q) ? q : defs[0][0];
}
export const tabLabel = (r) => (DEFS[r?.sub] || []).find(([k]) => k === activeTab(r))?.[1] || "";
