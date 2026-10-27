/* 账单 → 花费 / 预算 的第三层分页（页内标签，地址里用 ?tab=）。
 * 层级：底部页签（一级）→ 目录里的二级页（花费、预算…）→ 页内标签（三级，只换内容，不新开页面）。
 * 面包屑和各页共用这里的定义。 */
/* [id, 名称, 图标, 窄屏入口行的说明]。
 * 宽屏（laptop / iPad）：页面顶部一条标签。
 * 窄屏（≤ 440px，iPhone Pro Max 宽度）：不画标签条；第一个标签的内容下面放“入口行”，点进去是子页，靠面包屑 / 返回手势回上一层。 */
/* 第 5 项 true = 次要标签：宽屏收进标签条右边的「更多」菜单，窄屏（441–640px）仍在条里横滑；≤ 440px 用入口行（所有标签都列） */
export const SPEND_TABS = [["overview", "概览", "📊"], ["records", "明细", "🧾", "查看、搜索、补记花费"], ["category", "分类", "🧩", "分类占比和单个分类的月度趋势"], ["trips", "旅行", "🧳", "机票、住宿、门票…按行程汇总"], ["import", "银行导入", "🏦", "银行 / 信用卡的 CSV、PDF 对账单、OFX 补入花费"],
  ["stores", "商店", "🏪", "各商店、收款方花了多少", true], ["export", "导出打印", "🖨️", "年度 CSV 和打印", true]];
export const BUDGET_TABS = [["month", "本月", "📆"], ["bills", "账单", "🧾", "固定账单、订阅年成本、现金流"], ["plan", "规划", "🧮", "各类月预算、补货、大件基金、大额购物、应急金"], ["trend", "趋势", "📈", "预算对比实际、年度预算"], ["goals", "目标", "🎯", "储蓄目标和家庭分摊"]];
export const RECURRING_TABS = [["overview", "概览", "🔁"], ["list", "清单", "📋", "全部周期性账单：按房产、分类筛选，自动扣款开关"], ["history", "记录", "📈", "每条账单的缴费记录、金额趋势、CSV 导出"]];
export const MEDICAL_TABS = [["overview", "概览", "🏥"], ["list", "账单", "🧾", "全部医疗账单：按患者、医院、状态筛选"], ["report", "年度报表", "📊", "按患者和医院汇总，HSA / 报税导出"]];
export const INCOME_TABS = [["overview", "概览", "📊"], ["records", "明细", "🧾", "查看、搜索、补记收入；个人赠与 / 借款的还款"], ["senders", "付款方历史", "🏷️", "谁给过我钱：今年 / 近 3 年 / 近 5 年 / 全部历史"], ["report", "报表", "📈", "收入 vs 花费 vs 差额：双周 / 月 / 季 / 年，导出，AI 分析"], ["access", "权限", "🔐", "谁能看收入：申请 / 批准"]];
const DEFS = { income: INCOME_TABS, spend: SPEND_TABS, budget: BUDGET_TABS, onetime: MEDICAL_TABS, recurring: RECURRING_TABS };
export const firstTab = (r) => (DEFS[r?.sub] || [])[0]?.[0] || null;

/** 当前路由的页内标签 id（不认识的回到第一个）；不是花费 / 预算页返回 null */
export function activeTab(r) {
  const defs = r?.section === "bills" ? DEFS[r.sub] : null; if (!defs) return null;
  const q = r.q?.get("tab");
  return defs.some(([k]) => k === q) ? q : defs[0][0];
}
export const tabLabel = (r) => (DEFS[r?.sub] || []).find(([k]) => k === activeTab(r))?.[1] || "";
