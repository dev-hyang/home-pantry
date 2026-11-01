/* 财务 → 花费 / 预算 的第三层分页（页内标签，地址里用 ?tab=）。
 * 层级：底部页签（一级）→ 目录里的二级页（花费、预算…）→ 页内标签（三级，只换内容，不新开页面）。
 * 面包屑和各页共用这里的定义。 */
/* [id, 名称, 图标, 窄屏入口行的说明]。
 * 宽屏（laptop / iPad）：页面顶部一条标签。
 * 窄屏（≤ 440px，iPhone Pro Max 宽度）：不画标签条；第一个标签的内容下面放“入口行”，点进去是子页，靠面包屑 / 返回手势回上一层。 */
/* 第 5 项 true = 次要标签：宽屏收进标签条右边的「更多」菜单，窄屏（441–640px）仍在条里横滑；≤ 440px 用入口行（所有标签都列） */
// 旅行不再单独一个标签（2026-10，三级分类）：分类 → 生活消费 → 旅行 里可以「按行程看」；旧的 ?tab=trips 链接会转过去
export const SPEND_TABS = [["overview", "概览", "📊"], ["records", "明细", "🧾", "查看、搜索、补记花费"], ["category", "分类", "🧩", "一级 → 二级 → 具体分类逐层看，每月走势"], 
  ["stores", "商店", "🏪", "各商店、收款方花了多少", true], ["export", "导出打印", "🖨️", "年度 CSV 和打印", true]];
export const BUDGET_TABS = [["month", "本月", "📆"], ["bills", "账单", "🧾", "固定账单、订阅年成本、现金流"], ["plan", "规划", "🧮", "各类月预算、补货、大件基金、大额购物、应急金"], ["trend", "趋势", "📈", "预算对比实际、年度预算"], ["goals", "目标", "🎯", "储蓄目标和家庭分摊"]];
export const RECURRING_TABS = [["overview", "概览", "🔁"], ["list", "清单", "📋", "全部周期性账单：按房产、分类筛选，自动扣款开关"], ["history", "记录", "📈", "每条账单的缴费记录、金额趋势、CSV 导出"]];
export const MEDICAL_TABS = [["overview", "概览", "🏥"], ["list", "账单", "🧾", "全部医疗账单：按患者、医院、状态筛选"], ["report", "年度报表", "📊", "按患者和医院汇总，HSA / 报税导出"]];
// 概览 = 收支总览（2026-10，迁移 056）：收入（认定）vs 消费、储蓄率、投资率、现金流瀑布；资本流入单列不算收入
export const INCOME_TABS = [["overview", "收支总览", "📊"], ["records", "明细", "🧾", "查看、搜索、补记收入；按类型、账户筛；个人赠与 / 借款的还款"], ["category", "类型", "🧩", "一级 → 具体类型逐层看，每月走势"], ["senders", "付款方", "🏷️", "谁给过我钱：今年 / 近 3 年 / 近 5 年 / 全部历史"], ["compare", "收支对比", "⚖️", "收入 vs 消费 vs 储蓄率：双周 / 月 / 季 / 年，AI 分析"], ["import", "银行导入", "🏦", "对账单里的入账（工资、利息、转入）补入收入"],
  ["export", "导出打印", "🖨️", "CSV 和打印：收入、花费、差额报表", true], ["plan", "预算与计划", "🎯", "预期收入（用来生成预算）、储蓄比例、对比实际认定收入", true]];
// 原来的「权限」标签（income_access 申请 / 批准）已被财务权限取代（迁移 050，家主在 设置 → 家庭与成员 里逐人开关），代码已删；?tab=access 回到收支总览
export const STATEMENT_TABS = [["import", "导入", "📥", "选对账单或粘贴文字：花费和收入一次导入，可撤销"], ["all", "全部流水", "🧮", "花费和收入按时间排在一起，只读：点一行去对应的页面修改"], ["export", "导出打印", "🖨️", "花费、收入、收支差额的 CSV 和打印"]];
// 借贷（财务 P2，迁移 058）：资产融资（房贷 / 车贷 / HELOC / 学生贷款 / 分期）· 个人借贷（亲友之间）· 还款记录
export const DEBT_TABS = [["asset", "资产融资", "🏦"], ["personal", "个人借贷", "🤝", "借给亲友、向亲友借的钱：余额、到期、部分还款"], ["txns", "还款记录", "🧾", "放款、还本、利息、Escrow 的全部流水"]];
const DEFS = { debts: DEBT_TABS, statements: STATEMENT_TABS, income: INCOME_TABS, spend: SPEND_TABS, budget: BUDGET_TABS, onetime: MEDICAL_TABS, recurring: RECURRING_TABS };
export const firstTab = (r) => (DEFS[r?.sub] || [])[0]?.[0] || null;

/** 当前路由的页内标签 id（不认识的回到第一个）；不是花费 / 预算页返回 null */
export function activeTab(r) {
  const defs = r?.section === "bills" ? DEFS[r.sub] : null; if (!defs) return null;
  const q = r.q?.get("tab");
  return defs.some(([k]) => k === q) ? q : defs[0][0];
}
export const tabLabel = (r) => (DEFS[r?.sub] || []).find(([k]) => k === activeTab(r))?.[1] || "";
