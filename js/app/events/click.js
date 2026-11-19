/* 点击事件的派发：带前缀的动作交给各页面模块，其余按 data-action 查表交给 click-*.js 的某一组；出错统一提示。 */
import { FAMILY_ACTIONS, clickFamily } from "./click-family.js";
import { HOUSE_ACTIONS, clickHouse } from "./click-house.js";
import { MONEY_ACTIONS, clickMoney } from "./click-money.js";
import { PANTRY_ACTIONS, clickPantry } from "./click-pantry.js";
import { TODAY_ACTIONS, clickToday } from "./click-today.js";
import { budgetAction } from "../../bills/budget.js";
import { fixAction, recallAction, scanAction } from "../lazy-modules.js";
import { friendlyErr } from "../errors.js";
import { go } from "../../core/router.js";
import { payeeAction } from "../../stats/payees.js";
import { refresh } from "../data.js";
import { render } from "../render.js";
import { shopScanAction } from "../../pantry/shop-scan.js";
import { t } from "../../core/i18n.js";
import { toast } from "../../core/util.js";
import { shopsAction } from "../lazy-modules.js";

const CLICK_GROUPS = [[PANTRY_ACTIONS, clickPantry], [HOUSE_ACTIONS, clickHouse], [MONEY_ACTIONS, clickMoney], [FAMILY_ACTIONS, clickFamily], [TODAY_ACTIONS, clickToday]];
/** data-action → 处理它的那一组（每个动作只属于一组） */
const CLICK_ROUTES = new Map(CLICK_GROUPS.flatMap(([actions, handler]) => [...actions].map((a) => [a, handler])));
export async function onMainClick(e) {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const { action, id } = el.dataset;
  try {
    if (action?.startsWith("scan-")) return scanAction(action, el, { go, refresh });
    if (action?.startsWith("shops-")) return shopsAction(action, el, { render, go, refresh });
    if (action?.startsWith("shopscan-")) return shopScanAction(action, el, { render: () => render(false) });   // 拍照加入购物车（js/pantry/shop-scan.js）   // 常去的商店与特价（js/shops/views.js）
    if (action?.startsWith("fix-")) return fixAction(action, el, { refresh, render, go });   // 出了问题？诊断与配件
    if (action?.startsWith("recall-")) return recallAction(action, el, { refresh, render });   // 设备召回：清除标记 / 重新打开
    if (action?.startsWith("budget-") || action === "shop-advice-close") return budgetAction(action, { refresh, render }, el);
    if (action?.startsWith("payee-")) return payeeAction(action, el, { render });   // 花费 → 收款方（js/stats/payees.js）
    const route = CLICK_ROUTES.get(action);
    if (route) return await route(action, el, id, e);
  } catch (err) { toast(t("操作失败：{msg}", { msg: friendlyErr(err.message) })); refresh(); }
}
