/* 财务权限：读当前状态，给界面用。规则本身在 finance-rules.js（纯函数）。 */
import { state } from "./state.js";
import { Store } from "./store.js";
import { financeAllowed, financeRouteBlocked, quickAllowed } from "./finance-rules.js";
export { FINANCE_ALERT_SOURCES, FINANCE_HIDDEN_SUBS, financeFallback } from "./finance-rules.js";

/** 当前用户能不能看 / 改对账单、收入、预算、用卡（家主恒为 true；没执行迁移 050 时普通成员一律 false） */
export const financeOk = () => financeAllowed({ mode: Store.mode, userId: state.user?.id, members: state.members });
export const cardsRO = () => !financeOk();
export const routeBlocked = (r) => financeRouteBlocked(r, financeOk());
export const quickOk = (id) => quickAllowed(id, financeOk());

/* 金额字段的界面闸门（2026-11，财务 P1 方案 a）：没财务权限的家人看不到房产买入 / 卖出价、交易成交价 / 定金、设备和车辆的买价 / 更换成本。
 * 只是界面：properties / property_deals / assets 的行级安全不变（这些表全家都能读），要在数据库层面挡需要以后的迁移（列级视图），见 docs/design-finance-ia.md。 */
/** 能不能看到这些价格 */
export const pricesOk = () => financeOk();
/** 读：没权限返回 null（数组里 filter(Boolean) 自然去掉） */
export const priceOrNull = (v) => (pricesOk() ? v : null);
/** 表单里的价格输入：有权限照常画；没权限换成隐藏字段，把原值原样带回去（保存不会把家主填的价格清空） */
export const priceInput = (html, name, value) => (pricesOk() ? html : `<input type="hidden" name="${name}" value="${String(value ?? "").replace(/[&"<>]/g, (c) => ({ "&": "&amp;", '"': "&quot;", "<": "&lt;", ">": "&gt;" }[c]))}">`);
