/* 财务权限的判断规则（纯函数，不碰 DOM / localStorage / state，node 里能直接 import 测试）。
 * 范围：对账单、收入、预算、用卡。家主恒有全部权限；普通成员看 household_members.can_finance（迁移 050，默认关，只有家主能改）。
 *   开：和家主一样，全部可看可改。
 *   关：花费照旧（只是不显示「导入对账单」入口）；用卡只读；对账单、收入、预算整块看不到（页签、快捷操作、直接打开网址都会跳走）。
 * 数据库里由 finance_can_see() + 行级安全强制，这里只管界面。 */

/** 账单下面整块隐藏的二级页 */
export const FINANCE_HIDDEN_SUBS = ["statements", "income", "budget"];
/** 没有财务权限时不注册的提醒来源（见 core/alerts.js 的 SOURCE_LABEL） */
export const FINANCE_ALERT_SOURCES = ["budget", "income"];

/** 当前用户有没有财务权限。mode：demo 只有一个人（就是家主）；cloud 看成员表里自己那一行 */
export function financeAllowed({ mode, userId, members }) {
  if (mode !== "cloud") return true;
  const me = (members || []).find((m) => m.user_id === userId);
  if (!me) return false;
  return me.role === "owner" || me.can_finance === true;
}

/** 用卡是否只读（有财务权限 = 可改） */
export const cardsReadOnly = (allowed) => !allowed;

/** 路由 { section, sub, q } 在没有权限时要不要挡住：对账单 / 收入 / 预算整页，以及「添加卡」这种只为写入存在的页面 */
export function financeRouteBlocked(route, allowed) {
  if (allowed || !route) return false;
  if (route.section !== "bills") return false;
  if (FINANCE_HIDDEN_SUBS.includes(route.sub)) return true;
  if (route.sub === "cards" && route.q?.get?.("card") === "new") return true;
  return false;
}

/** 被挡住时跳去哪：用卡的「添加」回用卡列表，其余回账单目录 */
export const financeFallback = (route) => (route?.sub === "cards" ? "#/bills/cards" : "#/bills");

/** 首页快捷操作（地址或 action:xxx）在没有权限时能不能出现 / 能不能被加上 */
export function quickAllowed(id, allowed) {
  if (allowed) return true;
  const s = String(id || "");
  const [path, qs = ""] = s.split("?");
  const parts = path.replace(/^#\/?/, "").split("/").filter(Boolean);
  const q = new URLSearchParams(qs);
  if (parts[0] === "bills") {
    if (FINANCE_HIDDEN_SUBS.includes(parts[1])) return false;
    if (parts[1] === "spend" && q.get("tab") === "import") return false;   // 旧地址：银行导入 → 对账单
    if (parts[1] === "cards" && q.get("card") === "new") return false;     // 添加信用卡
  }
  if (parts[0] === "me" && parts[1] === "settings" && q.get("sec") === "income") return false;   // 旧地址：收入与预算
  return true;
}
