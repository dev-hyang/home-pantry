/* 我的 → 设置 → 收入与预算：每个人只能看到和编辑自己的收入；家主还能看到每个人的收入和全家合计，并调整储蓄比例、重新生成预算。
 * 收入存在 member_incomes（迁移 023，行级安全：本人或家主可读写）；预算本身（各类金额）是全家共用的。 */
import { state } from "../core/state.js";
import { Store } from "../core/store.js";
import { esc, money, num, toast } from "../core/util.js";
import { t } from "../core/i18n.js";
import { href } from "../core/router.js";
import { budgetPlan, generatePlan, incomeBanner, isHouseholdOwner, monthlyOf, myId, saveBudgetBase, totalIncomeMonthly } from "../bills/budget.js";

const nameOf = (uid) => (uid === myId() && !state.members.length ? t("我") : state.members.find((m) => m.user_id === uid)?.display_name || t("家人"));
const periodSel = (v) => `<select name="income_period" aria-label="${t("按")}"><option value="month" ${v !== "year" ? "selected" : ""}>${t("每月")}</option><option value="year" ${v === "year" ? "selected" : ""}>${t("每年")}</option></select>`;
const incomeForm = (id, uid, inc, label) => `<form id="${id}" class="bud-income" data-uid="${esc(uid)}">
    <label>${label}<span class="bud-income-row"><input name="income_amount" type="number" min="0" step="0.01" inputmode="decimal" required value="${esc(inc?.income_amount ?? "")}" placeholder="${t("例如：8000")}" aria-label="${t("收入（税后，{cur}）", { cur: Units.region.currency })}">${periodSel(inc?.income_period)}
      <button type="submit" class="btn btn-primary btn-sm">${t("保存")}</button>${inc ? `<button type="button" class="btn btn-sm btn-ghost" data-action="income-clear" data-uid="${esc(uid)}">${t("清除")}</button>` : ""}</span></label></form>`;

export function incomePanel() {
  const owner = isHouseholdOwner(), me = myId(), mine = state.incomes.find((i) => i.user_id === me), plan = budgetPlan();
  const cur = Units.region.currency;
  const own = `<div class="panel"><div class="kv"><div><b>${t("我的收入")}</b><div class="muted">${t("税后，{cur}。只有你自己{o}能看到这里的数字。", { cur, o: owner ? "" : t("和家主") })}</div></div></div>
    ${incomeForm("incomeForm", me, mine, t("金额"))}
    <p class="muted" style="margin:8px 0 0;font-size:13px"><b>${t("填到手工资，不含已被扣掉的税和保险。")}</b> ${t("固定工资按月或按年填；兼职 / 副业填一个大概的月均就行。偶尔的一次性收入（例如卖二手）不用填，预算不把它算进去。")}</p></div>`;
  if (!owner) return `${own}<div class="panel"><p class="muted" style="margin:0">${t("预算由家主按全家收入生成，你在 账单 → 预算 里能看到各类预算和进度，但看不到别人的收入。")}</p>
    <div class="form-actions"><a class="btn btn-sm btn-ghost" href="${href("bills", "budget")}">${t("去看预算")}</a></div></div>`;
  const rows = state.members.length ? state.members : [{ user_id: me, display_name: t("我") }];
  const total = totalIncomeMonthly();
  const b = state.budget || {};
  return `${incomeBanner()}${own}
    <div class="panel"><div class="kv"><div><b>${t("全家收入（仅家主可见）")}</b><div class="muted">${t("每个人的收入只有本人和家主能看到；其他家人看不到。")}</div></div></div>
      <table class="owner-table"><thead><tr><th>${t("成员")}</th><th>${t("填写")}</th><th>${t("折合每月")}</th></tr></thead><tbody>
      ${rows.map((m) => { const inc = state.incomes.find((i) => i.user_id === m.user_id); return `<tr><th scope="row">${esc(m.display_name)}${m.user_id === me ? ` <span class="muted">${t("（我）")}</span>` : ""}</th>
        <td>${m.user_id === me ? `<small class="muted">${inc ? `${money(num(inc.income_amount))} / ${inc.income_period === "year" ? t("年") : t("月")}` : t("未填")}</small>` : incomeForm(`memberIncomeForm-${m.user_id}`, m.user_id, inc, "")}</td><td>${inc ? money(monthlyOf(inc)) : "—"}</td></tr>`; }).join("")}
      <tr><th scope="row">${t("合计")}</th><td></td><td><b>${money(total)}</b> <small class="muted">${t("年 {a}", { a: money(total * 12) })}</small></td></tr></tbody></table></div>
    <div class="panel"><div class="kv"><div><b>${t("预算生成比例")}</b><div class="muted">${t("预算 = 全家收入 − 固定账单 − 储蓄；剩下的按过去的花费比例分给各类。只有家主能改。")}</div></div></div>
      <form id="ratioForm" class="bud-inline"><label>${t("计划储蓄占收入")}（%）<input name="savings_pct" type="number" min="0" max="90" step="1" inputmode="numeric" value="${esc(b.savings_pct ?? 20)}"></label>
        <button type="submit" class="btn btn-sm">${t("保存比例")}</button></form>
      <div class="form-actions"><button type="button" class="btn btn-primary btn-sm" data-action="budget-generate" ${total > 0 ? "" : "disabled"}>${plan ? t("重新生成预算") : t("生成预算")}</button>
        <a class="btn btn-sm btn-ghost" href="${href("bills", "budget")}">${t("去看预算")}</a></div>
      ${plan ? `<p class="muted" style="margin:8px 0 0;font-size:13px">${t("你在预算页改过的各类金额会保留；想全部按建议值，在预算页点“恢复建议值”。")}</p>` : `<p class="muted" style="margin:8px 0 0;font-size:13px">${t("填好收入后会自动生成第一版预算。")}</p>`}</div>`;
}

async function afterSave(uid) {
  state.incomes = await Store.listIncomes();
  if (!isHouseholdOwner()) { toast(t("已保存，家主可以选择是否按新收入更新预算")); return document.dispatchEvent(new CustomEvent("budget-saved")); }
  if (!budgetPlan() && totalIncomeMonthly() > 0) { await generatePlan(); toast(t("已保存，并生成了预算")); return; }
  state.incomePrompt = true;   // 已有预算：问一句要不要重新生成
  toast(t("已保存")); document.dispatchEvent(new CustomEvent("budget-saved"));
}
document.addEventListener("submit", async (e) => {
  const f = e.target;
  try {
    if (f.id === "incomeForm" || f.id?.startsWith("memberIncomeForm-")) {
      e.preventDefault();
      const uid = f.dataset.uid, amount = num(f.elements.income_amount.value, NaN);
      if (!Number.isFinite(amount) || amount < 0) return toast(t("请填写 0 或更大的金额"));
      if (uid !== myId() && !isHouseholdOwner()) return;
      await Store.saveIncome({ user_id: uid, income_amount: amount, income_period: f.elements.income_period.value });
      await afterSave(uid);
    } else if (f.id === "ratioForm") {
      e.preventDefault();
      if (!isHouseholdOwner()) return;
      await saveBudgetBase({ savings_pct: Math.min(90, Math.max(0, num(f.elements.savings_pct.value, 20))) });
      toast(t("已保存"));
      if (budgetPlan()) { state.incomePrompt = true; document.dispatchEvent(new CustomEvent("budget-saved")); }
    }
  } catch (err) { toast(/member_incomes|schema cache|does not exist/i.test(err.message || "") ? t("还没执行数据库迁移 023（member_incomes 表），先在 Supabase 里执行 supabase/migrations/023_member_incomes.sql") : t("保存失败：{msg}", { msg: err.message })); }
});
document.addEventListener("click", async (e) => {
  const el = e.target.closest?.('[data-action="income-clear"]'); if (!el) return;
  try { await Store.deleteIncome(el.dataset.uid); await afterSave(el.dataset.uid); } catch (err) { toast(t("保存失败：{msg}", { msg: err.message })); }
});
