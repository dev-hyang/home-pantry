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
