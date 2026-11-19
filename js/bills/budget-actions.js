/* 预算页的交互：提交、点击处理。 */
import { $, esc, money, num, toast } from "../core/util.js";
import { Store } from "../core/store.js";
import { actions, groupsNow, saveMeta, underscoreKeys } from "./budget-groups.js";
import { adviceHtml, planPurchase, saleEvents } from "./budget-shopping.js";
import { generatePlan, isHouseholdOwner } from "./budget-income.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";

/* ───────────── 交互 ───────────── */
document.addEventListener("submit", async (e) => {
  const f = e.target;
  if (f.id === "budgetCatsForm" && !isHouseholdOwner()) { e.preventDefault(); return; }
  if (false) {
  } else if (f.id === "budgetCatsForm") {
    e.preventDefault();
    try {
      const cb = underscoreKeys(state.budget?.cat_budgets); for (const g of groupsNow()) { const v = f.elements[`cat_${g.id}`]?.value ?? "";  if (v !== "") cb[g.id] = Math.max(0, Math.round(num(v))); }
      const th = f.elements.big_threshold?.value; if (th !== "" && num(th, 0) > 0) cb._big_threshold = Math.round(num(th)); else delete cb._big_threshold;
      state.budget = await Store.saveBudget({ ...state.budget, cat_budgets: cb });
      toast(t("预算已保存")); document.dispatchEvent(new CustomEvent("budget-saved"));
    } catch (err) { toast(budgetError(err)); }
  } else if (f.id === "planForm") {
    e.preventDefault();
    const price = num(f.elements.price.value, 0); if (price <= 0) return;
    const ev = f.elements.event.value === "" ? null : saleEvents(new Date(), 6)[+f.elements.event.value];
    const name = f.elements.name.value.trim();
    $("#planOut").innerHTML = `<div class="bud-tip" style="margin-top:10px"><b>${name ? `${esc(name)} · ` : ""}${money(price)}</b>${adviceHtml(planPurchase({ price, group: f.elements.group.value, event: ev }))}</div>`;
  }
});
const budgetError = (err) => (/household_budgets|relation .* does not exist|schema cache/i.test(err.message || "") ? t("还没执行数据库迁移 022（household_budgets 表），先在 Supabase 里执行 supabase/migrations/022_budgets.sql") : t("保存失败：{msg}", { msg: err.message }));
/** main.js 里的点击入口 */
export async function budgetAction(action, ctx, el) {
  if (actions[action]) { try { return await actions[action](el, ctx); } catch (e) { toast(budgetError(e)); return; } }
  if (action === "budget-reset") { try { state.budget = await Store.saveBudget({ ...state.budget, cat_budgets: underscoreKeys(state.budget?.cat_budgets) }); toast(t("已恢复建议值")); ctx.render(); } catch (e) { toast(budgetError(e)); } }
  if (action === "budget-generate") { try { await generatePlan(); toast(t("预算已生成")); } catch (e) { toast(budgetError(e)); } return; }
  if (action === "budget-keep") { state.incomePrompt = false; try { const snap = state.budget?.cat_budgets?._plan; if (snap) await saveMeta({ _plan: { ...snap, dismissed_at: new Date().toISOString() } }); else ctx.render(); } catch (e) { toast(budgetError(e)); } return; }
  if (action === "shop-advice-close") { state.shopAdvice = null; ctx.render(); }
}
