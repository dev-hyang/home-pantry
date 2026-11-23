/* 借贷的操作：initDebts 在页面加载后注册点击和表单处理（保存、还款、关联、结清…）。 */
import { Store } from "../core/store.js";
import { af, pf } from "./debts-tabs.js";
import { calibrateDebt, clearOverride, debt060, debtHref, deleteDebtTxn, overrideSplit, recordDebtTxn, relinkPaymentPurchase, resplitDebt, setExtraPrincipal, syncDebtStatus, syncVehicle, unsplitDebt, updateDebtTxn } from "./debt-logic.js";
import { confirmDelete, fmtDate, num, toast, todayISO } from "../core/util.js";
import { debtCat } from "../core/debt-rules.js";
import { deleteBillPay } from "./views.js";
import { go, href } from "../core/router.js";
import { initDebtSummary } from "./debt-stats.js";
import { initRecords } from "./debt-records.js";
import { loadIncome } from "../income/logic.js";
import { onClearFilters } from "../core/clear-filters.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";
import { cur, hooks, ui } from "./debt-common.js";
import { billOfDebt, canSplit, debtById, loadDebts } from "./debt-logic-common.js";
import { dwIntercept } from "./debt-wizard.js";

/* ───────────── 动作 ───────────── */
const guard = async (fn) => { try { await fn(); } catch (e) { toast(t("操作失败：{msg}", { msg: e.message })); } };
const numOrNull = (v) => (v === "" || v == null ? null : Math.round(num(v) * 10000) / 10000);
const after = async () => { ui().pt = null; ui().editPay = null; ui().linkPay = null; ui().recEdit = null; await loadDebts(); hooks.render(false); };
   // 逐期表重新读

async function saveDebtForm(f) {
  const fd = new FormData(f), g = (k) => String(fd.get(k) ?? "").trim(), err = f.querySelector("[data-debt-err]");
  const id = g("id") || null, old = id ? debtById(id) : null, cat = g("category");
  const row = { ...(old || {}), id, name: g("name"), category: cat, direction: cat === "personal_lending" ? g("direction") || "payable" : "payable", counterparty_name: g("counterparty_name") || null,
    person_id: g("person_id") || null, lender_card_id: g("lender_card_id") || null, original_principal: numOrNull(g("original_principal")), interest_rate: numOrNull(g("interest_rate")),
    term_months: g("term_months") ? Math.round(num(g("term_months"))) : null, start_date: g("start_date") || null, maturity_date: g("maturity_date") || null, payment_frequency: g("payment_frequency") || "monthly",
    scheduled_payment: numOrNull(g("scheduled_payment")), opening_balance: numOrNull(g("opening_balance")), opening_balance_on: g("opening_balance_on") || null, status: g("status") || "active",
    property_id: cat === "personal_lending" ? null : g("property_id") || null, asset_id: cat === "personal_lending" ? null : g("asset_id") || null, financing_role: g("financing_role") || null,
    secured: fd.get("secured") === "on", agreement: cat === "personal_lending" ? g("agreement") || null : null, agreement_note: cat === "personal_lending" ? g("agreement_note") || null : null, notes: g("notes") || null, currency: old?.currency || cur() };
  if (debt060()) {
    row.first_payment_date = cat === "personal_lending" ? null : g("first_payment_date") || null;
    const froms = fd.getAll("escrow_from").map(String), amts = fd.getAll("escrow_amount").map(String);
    const sched = new Map(); froms.forEach((m, i) => { if (/^\d{4}-\d{2}$/.test(m) && amts[i] !== "" && num(amts[i]) >= 0) sched.set(m, Math.round(num(amts[i]) * 100) / 100); });   // 同一个月填了两次：后面的为准
    row.escrow_schedule = cat === "personal_lending" ? [] : [...sched].sort((a, b) => a[0].localeCompare(b[0])).map(([from, amount]) => ({ from, amount }));
    row.statement_check = old?.statement_check || null;
    if (row.first_payment_date && row.start_date && row.first_payment_date < row.start_date) { err.textContent = t("第一期还款日不能早于起始日（放款）"); return; }
  }
  if (!row.name) { err.textContent = t("请填名称"); return; }
  if ((row.opening_balance == null) !== !row.opening_balance_on) { err.textContent = t("「某天的未还本金」和「那一天」要一起填"); return; }
  if (old && old.asset_id !== row.asset_id) row.link_confirmed = true;   // 用户自己选的车辆：算确认
  const btn = f.querySelector("button.btn-primary"); btn.disabled = true;
  try {
    const termsChanged = !old || ["original_principal", "interest_rate", "term_months", "start_date", "first_payment_date", "payment_frequency", "scheduled_payment", "opening_balance", "opening_balance_on"].some((k) => String(old[k] ?? "") !== String(row[k] ?? ""))
      || JSON.stringify(old?.escrow_schedule || []) !== JSON.stringify(row.escrow_schedule || old?.escrow_schedule || []);
    const newId = await Store.saveDebt(row);
    if (g("bill")) await Store.linkBillDebt(g("bill"), newId);
    await loadDebts(); if (g("bill")) await hooks.refresh();
    const d = debtById(newId);
    let n = 0;
    if (d && termsChanged) { if (canSplit(d)) n = await resplitDebt(d); else if (old) await unsplitDebt(d); }
    if (d) { await syncDebtStatus(d.id); await syncVehicle(debtById(d.id)); }
    toast(n ? t("已保存，拆分了 {n} 笔历史还款", { n }) : t("已保存"));
    go(debtHref(newId), { replace: true });
  } catch (e) { err.textContent = t("保存失败：{msg}", { msg: e.message }); btn.disabled = false; }
}
export function initDebts({ render, refresh }) {
  Object.assign(hooks, { render, refresh });
  initDebtSummary({ render });
  onClearFilters("debtP", () => { ui().pf = { sort: pf().sort }; render(false); });
  onClearFilters("debtA", () => { ui().af = { sort: af().sort }; render(false); });
  initRecords({ render, save: async (x, patch) => guard(async () => { await updateDebtTxn(x, patch); toast(t("已保存")); await after(); }) });
  const main = document.getElementById("main");
  main.addEventListener("change", (e) => {
    if (e.target.matches?.("[data-debt-overwrite]")) { ui().overwrite = e.target.checked; return; }
    // 列表筛选：个人借贷（data-debt-pf）/ 资产融资（data-debt-af）
    const fs = e.target.closest?.("select[data-debt-pf], select[data-debt-af]");
    if (fs) {
      const which = fs.dataset.debtPf != null ? "pf" : "af", k = fs.dataset.debtPf ?? fs.dataset.debtAf;
      ui()[which] = { ...(which === "pf" ? pf() : af()), [k]: fs.value }; render(false);
      requestAnimationFrame(() => document.querySelector(`[data-debt-${which}="${k}"]`)?.focus()); return;
    }
    const s = e.target.closest?.("[data-debt-cat]"); if (!s) return;
    const personal = s.value === "personal_lending", f = s.closest("form");
    f.querySelectorAll("[data-debt-personal]").forEach((x) => { x.hidden = !personal; });
    f.querySelectorAll("[data-debt-asset]").forEach((x) => { x.hidden = personal; });
    if (f.elements.secured && !f.elements.id) f.elements.secured.checked = debtCat(s.value).secured;
    if (f.elements.financing_role && !f.elements.id) f.elements.financing_role.value = debtCat(s.value).role || "";
  });
  // 按人搜索：边打边筛（防抖），重画后焦点和光标留在搜索框
  let qTimer = 0;
  main.addEventListener("input", (e) => {
    const inp = e.target.closest?.('input[data-debt-pf="q"], input[data-debt-af="q"]'); if (!inp) return;
    const which = inp.dataset.debtPf != null ? "pf" : "af";
    clearTimeout(qTimer);
    qTimer = setTimeout(() => {
      ui()[which] = { ...(which === "pf" ? pf() : af()), q: inp.value }; const at = inp.selectionStart; render(false);
      const n = document.querySelector(`input[data-debt-${which}="q"]`);
      if (n) { n.focus(); try { n.setSelectionRange(at, at); } catch { /* 不支持选区的输入框：忽略 */ } }
    }, 250);
  });
  main.addEventListener("click", (e) => {
    const b = e.target.closest?.("[data-debt]"); if (!b) return;
    const act = b.dataset.debt, id = b.dataset.id, d = id ? debtById(id) : null;
    if (act === "tx-more") { ui().txLimit = (ui().txLimit || 50) + 50; return render(false); }
    if (act === "rec-open") { ui().recOpen = ui().recOpen === id ? null : id; render(false); requestAnimationFrame(() => document.querySelector(ui().recOpen ? "#dd-rec-form select, #dd-rec-form input" : `[data-debt="rec-open"]`)?.focus()); return; }
    if (act === "pay-link") { ui().linkPay = b.dataset.pay && ui().linkPay !== b.dataset.pay ? b.dataset.pay : null; ui().payCand = null; ui().editPay = null; b.closest("details")?.removeAttribute("open"); render(false); if (ui().linkPay) requestAnimationFrame(() => { const f = document.getElementById("dd-link"); f?.scrollIntoView({ block: "nearest" }); f?.querySelector("select, button")?.focus({ preventScroll: true }); }); return; }
    if (act === "pay-cand-refresh") { ui().payFresh = b.dataset.pay; ui().payCand = null; render(false); return; }   // ↻：重新读前后几天的花费再找
    if (act === "pay-del" && d) { if (!confirmDelete(t("删除这条缴费记录？"))) return; return guard(async () => { const back = await deleteBillPay(b.dataset.pay); await hooks.refresh(); toast(back ? t("已删除这条记录，到期日回到 {d}", { d: fmtDate(back) }) : t("已删除这条记录")); await after(); }); }
    if (act === "amort-all") { ui().amortAll = ui().amortAll === id ? null : id; return render(false); }
    if (act === "resplit" && d) return guard(async () => { b.disabled = true; const n = await resplitDebt(d, { overwrite: !!ui().overwrite }); toast(t("已按摊还表拆分 {n} 笔还款", { n })); await after(); });
    if (act === "pay-edit") { ui().linkPay = null; ui().editPay = b.dataset.pay && ui().editPay !== b.dataset.pay ? b.dataset.pay : null; render(false); if (ui().editPay) requestAnimationFrame(() => document.querySelector("#dd-edit input")?.focus()); return; }
    if (act === "mark-extra" && d) return guard(async () => { b.disabled = true; await setExtraPrincipal(d, b.dataset.pay, num(b.dataset.amt)); toast(num(b.dataset.amt) > 0 ? t("已记为额外本金，后面各期重新计算") : t("已取消额外本金")); await after(); });
    if (act === "calib-clear" && d) return guard(async () => { await Store.saveDebt({ ...d, statement_check: null }); ui().calib = null; await loadDebts(); await resplitDebt(debtById(id), { onlyChanged: true }); toast(t("已取消校准")); await after(); });
    if ((act === "calib-save" || act === "calib-anchor") && d && ui().calib?.id === id) return guard(async () => {
      const { input: v, res } = ui().calib, sc = { date: v.date, principal: num(v.principal), interest: num(v.interest), balance: v.balance === "" ? null : num(v.balance) };
      const patch = { ...d, ...(debt060() ? { statement_check: sc } : {}) };
      if (act === "calib-anchor") { patch.opening_balance = sc.balance ?? res.impliedAfter; patch.opening_balance_on = v.date; }
      await Store.saveDebt(patch); ui().calib = null; await loadDebts();
      const n = canSplit(debtById(id)) ? await resplitDebt(debtById(id), { onlyChanged: true }) : 0;
      toast(n ? t("已保存，重新拆分了 {n} 笔", { n }) : t("已保存")); await after();
    });
    if (act === "override-clear" && d) return guard(async () => { await clearOverride(d, b.dataset.pay); toast(t("已改回按摊还表")); await after(); });
    if (act === "link-confirm" && d) return guard(async () => { await Store.saveDebt({ ...d, link_confirmed: true }); await loadDebts(); await syncVehicle(debtById(id)); toast(t("已确认")); await after(); });
    if (act === "link-clear" && d) return guard(async () => { await Store.saveDebt({ ...d, asset_id: null, link_confirmed: true }); toast(t("已解除关联")); await after(); });
    if (act === "txn-del") {
      if (!confirmDelete(t("删除这条借贷记录？"))) return;
      const cashBox = b.closest("form")?.elements?.cash, cash = cashBox ? cashBox.checked : true;   // 编辑表单里可以只删流水、留下关联的花费 / 收入
      return guard(async () => { await deleteDebtTxn(id, { cash }); ui().recEdit = null; await loadIncome(); toast(t("已删除")); await after(); });
    }
    if (act === "delete" && d) {
      if (!confirmDelete(t("删除这笔借贷？关联的花费、收入、账单都会保留。"))) return;
      return guard(async () => { const bill = billOfDebt(d); if (bill) await unsplitDebt(d, bill); await Store.deleteDebt(id); await loadDebts(); await hooks.refresh(); toast(t("已删除")); go(href("bills", "debts"), { replace: true }); });
    }
  });
  main.addEventListener("submit", (e) => {
    const f = e.target.closest?.("[data-debt-form]"); if (!f) return;
    e.preventDefault(); e.stopPropagation();
    const kind = f.dataset.debtForm, d = f.dataset.id ? debtById(f.dataset.id) : null, fd = new FormData(f), g = (k) => String(fd.get(k) ?? "").trim();
    if (kind === "debt") return dwIntercept(f) ? undefined : saveDebtForm(f);   // 添加借贷向导：回车 = 下一步，确认页先复查每一步
    if (kind === "pay-link" && d) return guard(async () => {
      const pid = g("purchase"); if (!pid) return toast(t("请选一笔花费"));
      f.querySelector("button.btn-primary").disabled = true;
      const ok = await relinkPaymentPurchase(d, f.dataset.pay, pid);
      ui().linkPay = null; ui().payCand = null; await hooks.refresh();
      toast(ok ? t("已关联，这笔缴费记在那笔花费上") : t("没有变化")); await after();
    });
    if (kind === "override" && d) return guard(async () => { await overrideSplit(d, f.dataset.pay, { principal: g("principal"), interest: g("interest"), escrow: g("escrow"), extra: g("extra") }); toast(t("已按对账单改")); await after(); });
    if (kind === "calib" && d) return guard(async () => {
      const input = { date: g("date"), principal: g("principal"), interest: g("interest"), balance: g("balance") };
      if (!input.date || input.principal === "" || input.interest === "") return toast(t("请填日期、本金和利息"));
      ui().calib = { id: d.id, input, res: await calibrateDebt(d, input) }; render(false);
    });
    if (kind === "txn" && d) return guard(async () => {
      const principal = num(g("principal")), interest = num(g("interest"));
      if (!(principal > 0) && !(interest > 0)) return toast(t("请填金额"));
      const acct = g("acct") || null, card = acct ? (state.cards || []).find((c) => c.id === acct) : null;
      const n = await recordDebtTxn(d, { kind: g("kind"), date: g("date") || todayISO(), principal, interest, cash: fd.get("cash") === "on", card_id: card && !["checking", "savings", "brokerage", "retirement", "hsa", "cash", "loan"].includes(card.kind) ? card.id : null, account_id: card?.id || null, notes: g("notes") || null });
      if (fd.get("cash") === "on") await loadIncome();
      if (n) ui().recOpen = null;   // 记好了：表单收起，留下还款记录
      toast(n ? t("已记录") : t("没有要记的金额")); await after();
    });
    if (kind === "link" && d) return guard(async () => {
      const billId = g("bill") || null, cur0 = billOfDebt(d);
      if (cur0 && cur0.id !== billId) { await unsplitDebt(d, cur0); await Store.linkBillDebt(cur0.id, null); }
      if (billId && (!cur0 || cur0.id !== billId)) await Store.linkBillDebt(billId, d.id);
      const patch = { ...d };
      if (f.elements.property_id) patch.property_id = g("property_id") || null;
      if (f.elements.asset_id) { patch.asset_id = g("asset_id") || null; if (patch.asset_id !== d.asset_id) patch.link_confirmed = true; }
      await Store.saveDebt(patch);
      await hooks.refresh(); await loadDebts();
      if (billId && (!cur0 || cur0.id !== billId) && canSplit(debtById(d.id))) await resplitDebt(debtById(d.id));
      await syncVehicle(debtById(d.id));
      toast(t("已保存关联")); await after();
    });
  });
}
