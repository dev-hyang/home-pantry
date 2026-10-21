/* 我的 → 设置 → 收入与预算：每个人可以有多份收入（主业、兼职…），一行一张卡片，只能看到和编辑自己的；
 * 家主还能看到、编辑每个人的收入和全家合计，调整储蓄比例、重新生成预算。
 * 收入存在 member_incomes（迁移 023 / 024，行级安全：本人或家主可读写）；预算本身（各类金额）是全家共用的。 */
import { state } from "../core/state.js";
import { Store } from "../core/store.js";
import { esc, money, num, toast } from "../core/util.js";
import { t } from "../core/i18n.js";
import { href } from "../core/router.js";
import { budgetPlan, generatePlan, incomeBanner, isHouseholdOwner, linesOf, medInPool, meta, monthlyOf, myId, saveBudgetBase, saveMeta, totalIncomeMonthly } from "../bills/budget.js";

const cur = () => Units.region.currency;
const sym = () => Units.money(0).replace(/[\d.,\s]/g, "") || cur();
const uidNew = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}${Math.random().toString(16).slice(2)}`);

/** 一张收入卡片：来源 / 金额 / 每月或每年 / 删除（金额的标签和输入框同一行，前面带货币符号） */
const cardHtml = (l = {}) => `<div class="inc-card" data-line="${esc(l.id || uidNew())}">
  <label class="inc-field inc-label">${t("来源")}<input name="label" maxlength="30" value="${esc(l.label || "")}" placeholder="${t("例如：主业、兼职")}"></label>
  <label class="inc-field">${t("金额")}<span class="inc-amt"><i aria-hidden="true">${esc(sym())}</i><input name="amount" type="number" min="0" step="0.01" inputmode="decimal" value="${l.amount ?? ""}" placeholder="0.00" aria-label="${t("金额（{cur}）", { cur: cur() })}"></span></label>
  <select name="period" aria-label="${t("按")}"><option value="month" ${l.period !== "year" ? "selected" : ""}>${t("每月")}</option><option value="year" ${l.period === "year" ? "selected" : ""}>${t("每年")}</option></select>
  <button type="button" class="btn btn-sm btn-danger-ghost inc-del" data-action="income-del-row">${t("删除")}</button></div>`;

/** 某个人的收入卡片列表；改完点“保存”，删除一张卡片会立即生效 */
function incomeForm(uid, row) {
  const lines = linesOf(row);
  return `<form class="inc-form" data-uid="${esc(uid)}" novalidate>
    <div class="inc-cards">${lines.map(cardHtml).join("")}</div>
    <p class="muted inc-empty" ${lines.length ? "hidden" : ""}>${t("还没有收入，点“添加一份收入”。")}</p>
    <div class="form-actions"><button type="button" class="btn btn-sm btn-ghost" data-action="income-add-row">＋ ${t("添加一份收入")}</button>
      <button type="submit" class="btn btn-primary btn-sm">${t("保存")}</button></div></form>`;
}

export function incomePanel() {
  const owner = isHouseholdOwner(), me = myId(), mine = state.incomes.find((i) => i.user_id === me), plan = budgetPlan();
  const own = `<div class="panel"><div class="kv"><div><b>${t("我的收入")}</b><div class="muted">${t("税后，{cur}。只有你自己{o}能看到这里的数字。", { cur: cur(), o: owner ? "" : t("和家主") })}</div></div></div>
    ${incomeForm(me, mine)}
    <p class="muted" style="margin:8px 0 0;font-size:13px"><b>${t("填到手工资，不含已被扣掉的税和保险。")}</b> ${t("固定工资按月或按年填；兼职 / 副业填一个大概的月均就行。偶尔的一次性收入（例如卖二手）不用填，预算不把它算进去。")}</p></div>`;
  if (!owner) return `${own}<div class="panel"><p class="muted" style="margin:0">${t("预算由家主按全家收入生成，你在 账单 → 预算 里能看到各类预算和进度，但看不到别人的收入。")}</p>
    <div class="form-actions"><a class="btn btn-sm btn-ghost" href="${href("bills", "budget")}">${t("去看预算")}</a></div></div>`;
  const others = state.members.filter((m) => m.user_id !== me), total = totalIncomeMonthly(), b = state.budget || {};
  return `${incomeBanner()}${own}
    <div class="panel"><div class="kv"><div><b>${t("全家收入（仅家主可见）")}</b><div class="muted">${t("每个人的收入只有本人和家主能看到；其他家人看不到。")}</div></div></div>
      ${others.map((m) => { const inc = state.incomes.find((i) => i.user_id === m.user_id); return `<div class="inc-member"><h4>${esc(m.display_name)} <small class="muted">${inc ? `${t("折合每月")} ${money(monthlyOf(inc))}` : t("未填")}</small></h4>${incomeForm(m.user_id, inc)}</div>`; }).join("") || `<p class="muted" style="margin:0">${t("还没有其他成员。")}</p>`}
      <p class="inc-total"><b>${t("合计")}</b> ${money(total)} / ${t("月")} <small class="muted">${t("年 {a}", { a: money(total * 12) })}</small></p></div>
    <div class="panel"><div class="kv"><div><b>${t("预算生成比例")}</b><div class="muted">${t("预算 = 全家收入 − 固定账单 − 储蓄；剩下的按过去的花费比例分给各类。只有家主能改。")}</div></div></div>
      <form id="ratioForm" class="bud-inline"><label class="inc-field">${t("计划储蓄占收入")}（%）<input name="savings_pct" type="number" min="0" max="90" step="1" inputmode="numeric" value="${esc(b.savings_pct ?? 20)}" style="width:90px"></label>
        <button type="submit" class="btn btn-sm">${t("保存比例")}</button></form>
      <div class="form-actions"><button type="button" class="btn btn-primary btn-sm" data-action="budget-generate" ${total > 0 ? "" : "disabled"}>${plan ? t("重新生成预算") : t("生成预算")}</button>
        <a class="btn btn-sm btn-ghost" href="${href("bills", "budget")}">${t("去看预算")}</a></div>
      ${plan ? `<p class="muted" style="margin:8px 0 0;font-size:13px">${t("你在预算页改过的各类金额会保留；想全部按建议值，在预算页点“恢复建议值”。")}</p>` : `<p class="muted" style="margin:8px 0 0;font-size:13px">${t("填好收入后会自动生成第一版预算。")}</p>`}</div>
    <div class="panel"><label class="check-inline"><input type="checkbox" id="medPoolToggle" ${medInPool() ? "checked" : ""}><span><b>${t("把医疗支出计入每月可支配预算")}</b></span></label>
      <p class="muted" style="margin:6px 0 0;font-size:13px">${t("默认不计入：医疗花费大额、不可预测，单独在预算页“本月”里列出。打开后医疗和其他分类一样有月预算，也会占用可支配额。")}</p></div>
    <div class="panel"><label class="check-inline"><input type="checkbox" id="splitToggle" ${meta("_split_on", false) === true ? "checked" : ""}><span><b>${t("启用家庭分摊")}</b></span></label>
      <p class="muted" style="margin:6px 0 0;font-size:13px">${t("打开后，账单 → 预算 里会出现“家庭分摊”：按谁记的账算付款人，算谁多付了、谁该补多少。默认关闭。")}</p></div>`;
}

/** 读一个人的卡片：金额为空的行忽略；金额填错给出提示 */
function readLines(form) {
  const lines = [];
  for (const c of form.querySelectorAll(".inc-card")) {
    const raw = c.querySelector('[name="amount"]').value;
    if (raw === "") continue;
    const amount = num(raw, NaN);
    if (!Number.isFinite(amount) || amount < 0) throw new Error(t("请填写 0 或更大的金额"));
    lines.push({ id: c.dataset.line, label: c.querySelector('[name="label"]').value.trim().slice(0, 30), amount: Math.round(amount * 100) / 100, period: c.querySelector('[name="period"]').value });
  }
  return lines;
}
async function persist(uid, lines) {
  if (lines.length) await Store.saveIncome({ user_id: uid, lines }); else await Store.deleteIncome(uid);
  state.incomes = await Store.listIncomes();
  if (!isHouseholdOwner()) { toast(t("已保存，家主可以选择是否按新收入更新预算")); return document.dispatchEvent(new CustomEvent("budget-saved")); }
  if (!budgetPlan() && totalIncomeMonthly() > 0) { await generatePlan(); toast(t("已保存，并生成了预算")); return; }
  state.incomePrompt = !!budgetPlan();   // 已有预算：问一句要不要重新生成
  toast(t("已保存")); document.dispatchEvent(new CustomEvent("budget-saved"));
}
const fail = (err) => toast(/member_incomes|lines|schema cache|does not exist/i.test(err.message || "") ? t("还没执行数据库迁移 023 / 024（member_incomes 表），先在 Supabase 里执行 supabase/migrations/ 里的 023_member_incomes.sql 和 024_income_lines.sql") : err.message?.startsWith("请填写") ? err.message : t("保存失败：{msg}", { msg: err.message }));

document.addEventListener("submit", async (e) => {
  const f = e.target;
  try {
    if (f.classList?.contains("inc-form")) {
      e.preventDefault();
      const uid = f.dataset.uid; if (uid !== myId() && !isHouseholdOwner()) return;
      await persist(uid, readLines(f));
    } else if (f.id === "ratioForm") {
      e.preventDefault();
      if (!isHouseholdOwner()) return;
      await saveBudgetBase({ savings_pct: Math.min(90, Math.max(0, num(f.elements.savings_pct.value, 20))) });
      toast(t("已保存"));
      if (budgetPlan()) { state.incomePrompt = true; document.dispatchEvent(new CustomEvent("budget-saved")); }
    }
  } catch (err) { fail(err); }
});
document.addEventListener("change", async (e) => {
  if (e.target.id === "medPoolToggle" && isHouseholdOwner()) {
    try { await saveMeta({ _med_in_pool: e.target.checked }); toast(e.target.checked ? t("医疗已计入可支配预算") : t("医疗不再计入可支配预算")); } catch (err) { e.target.checked = !e.target.checked; fail(err); }
    return;
  }
  if (e.target.id !== "splitToggle" || !isHouseholdOwner()) return;
  try { await saveMeta({ _split_on: e.target.checked }); toast(e.target.checked ? t("已启用家庭分摊") : t("已关闭家庭分摊")); } catch (err) { e.target.checked = !e.target.checked; fail(err); }
});
document.addEventListener("click", async (e) => {
  const add = e.target.closest?.('[data-action="income-add-row"]');
  if (add) {
    const form = add.closest(".inc-form"); form.querySelector(".inc-cards").insertAdjacentHTML("beforeend", cardHtml());
    form.querySelector(".inc-empty").hidden = true; form.querySelector(".inc-card:last-child input").focus(); return;
  }
  const del = e.target.closest?.('[data-action="income-del-row"]');
  if (del) {   // 删除整张卡片：点两次确认，立即保存
    if (del.dataset.armed !== "1") { del.dataset.armed = "1"; del.dataset.label = del.textContent; del.textContent = t("再点一次删除"); setTimeout(() => { del.dataset.armed = ""; del.textContent = del.dataset.label; }, 3000); return; }
    const form = del.closest(".inc-form"), card = del.closest(".inc-card"), uid = form.dataset.uid;
    card.remove(); form.querySelector(".inc-empty").hidden = !!form.querySelector(".inc-card");
    try { await persist(uid, readLines(form)); } catch (err) { fail(err); }
  }
});
