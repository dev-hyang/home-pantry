/* 账单的保存：保存账单、保存缴费、删除、核对、关联设备。 */
import { Store } from "../core/store.js";
import { advanceDue, initialDue } from "./logic.js";
import { beforeDeletePayment, splitBillPayment } from "./debt-logic.js";
import { checkedItems } from "./bill-pay.js";
import { dupOnce, normName } from "../core/item-match.js";
import { fmtDate, num, toast, todayISO } from "../core/util.js";
import { leaveBill } from "./bill-form.js";
import { olderPayment, resetPayHistory } from "./pay-history.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";
import { withProperty } from "../core/alerts.js";
import { B } from "./bill-common.js";
import { isBankAcct } from "./cards.js";
import { resolvePayAccount } from "./card-picker.js";
import { settleMerge } from "./assessments-lib.js";

/* ── 保存 ── */
const parseList = (s, { int = true } = {}) => String(s || "").split(/[,，\s]+/).map((x) => x.trim()).filter(Boolean).map((x) => (int ? parseInt(x, 10) : x)).filter((x) => (int ? Number.isFinite(x) : true));
/** silent=true：离开页面时自动保存（不跳转；校验不过就提示“没有自动保存”）。返回是否保存成功 */
export async function saveBillForm(f, { silent = false } = {}) {
  const fe = f.elements, err = f.querySelector("#billFormError");
  const fail = (msg, el) => { if (silent) toast(t("没有自动保存：{msg}", { msg })); else { err.textContent = msg; el.focus(); } return false; };
  const name = fe.name.value.trim();
  if (!name) return fail(t("请填写账单名称。"), fe.name);
  const numOrNull = (el, int) => { if (el.value === "") return null; const n = num(el.value, NaN); return Number.isFinite(n) ? (int ? Math.round(n) : Math.round(n * 100) / 100) : null; };
  const dueDates = parseList(fe.due_dates.value, { int: false }).map((x) => x.replace("/", "-")).filter((x) => /^\d{2}-\d{2}$/.test(x));
  const reminders = [...new Set(parseList(fe.reminder_days.value).filter((n) => n >= 0 && n <= 90))].sort((a, b) => b - a).slice(0, 5);
  const payUrl = fe.pay_url.value.trim();
  if (payUrl && !/^https?:\/\//i.test(payUrl)) return fail(t("缴费链接需要以 http:// 或 https:// 开头。"), fe.pay_url);
  if (!silent) {   // 疑似重复（「电费」和「Electric」各建一条）：在用的账单里同名，或同一收款方 + 同一分类——先提醒一次
    const payee = fe.payee.value.trim(), hit = (state.bills || []).find((x) => x.id !== fe.bill_id.value && x.active !== false && !x.ended_on
      && (normName(x.name) === normName(name) || (payee && normName(x.payee) === normName(payee) && x.category === fe.category.value)));
    if (dupOnce(f, hit?.id)) return fail(t("已经有在用的账单「{name}」（同名或同一收款方、同一分类）。确认是另一条，再点一次保存。", { name: hit.name }), fe.name);
  }
  const b = {
    id: fe.bill_id.value || undefined, name, category: fe.category.value, property_id: fe.property_id.value || null, asset_id: fe.asset_id?.value || null, direction: fe.direction.value || "payable",
    payee: fe.payee.value.trim() || null, account_last4: fe.account_last4.value.trim() || null, login_hint: fe.login_hint.value.trim() || null, pay_url: payUrl || null,
    pay_channel: fe.pay_channel.value, statement_channel: fe.statement_channel.value, amount_type: fe.amount_type.value, typical_amount: numOrNull(fe.typical_amount), unit_amount: fe.category.value === "hoa" ? numOrNull(fe.unit_amount) : null, parking_amount: fe.category.value === "hoa" ? numOrNull(fe.parking_amount) : null, typical_fee: numOrNull(fe.typical_fee), typical_tax: numOrNull(fe.typical_tax),
    currency: (fe.currency.value.trim().toUpperCase() || Units.region.currency).slice(0, 3), frequency: fe.frequency.value, interval_months: numOrNull(fe.interval_months, true),
    due_day: numOrNull(fe.due_day, true), due_dates: dueDates, next_due_on: fe.next_due_on.value || null, grace_days: numOrNull(fe.grace_days, true) || 0, ends_on: fe.ends_on.value || null,
    sub_kind: B().isSubCat(fe.category.value) ? fe.sub_kind.value || null : null, trial_ends_on: B().isSubCat(fe.category.value) ? fe.trial_ends_on.value || null : null,
    reminder_days: reminders.length ? reminders : [7, 1], late_fee_note: fe.late_fee_note.value.trim() || null,
    autopay: fe.autopay.checked, ...payFields(fe.pay_account?.value, fe.autopay_method.value), autopay_card_expires: fe.autopay_card_expires.value || null,
    assigned_person_id: fe.assigned_person_id.value || null, essential: fe.essential.checked, active: fe.active.checked, notes: fe.notes.value.trim() || null,
  };
  if (b.category === "hoa" && (b.unit_amount != null || b.parking_amount != null)) { b.typical_amount = Math.round((num(b.unit_amount) + num(b.parking_amount)) * 100) / 100; b.amount_type = "fixed"; }   // HOA 拆分：标准金额 = 单元费 + 车位费
  if (b.pay_channel === "escrow") b.autopay = false;   // 代缴就不是自动扣款
  if (b.autopay && b.pay_channel !== "autopay") b.pay_channel = "autopay";
  if (!b.autopay && b.pay_channel === "autopay") b.pay_channel = "online";
  if (!b.next_due_on) b.next_due_on = initialDue(b);
  // 只改别的分区（如基本信息）时，到期日那块是隐藏的：不拦，照常保存，到期日留到“金额与周期”再补
  const amountVisible = !fe.next_due_on.closest("fieldset")?.hidden;
  if (!b.next_due_on && b.frequency !== "one_time" && amountVisible) return fail(t("这种频率算不出到期日，请填“下次到期日”。"), fe.next_due_on);
  const btn = f.querySelector('button[type="submit"]'); btn.disabled = true;
  try {
    await Store.saveBill(b);
    if (silent) return true;
    toast(b.id ? t("已保存修改") : t("已添加 {name}", { name }));
    leaveBill(true);
    return true;
  } catch (e) { if (silent) throw e; err.textContent = t("保存失败：{msg}", { msg: e.message }); btn.disabled = false; return false; }
}
/** 选了卡 / 账户时「扣款卡有效期」那行的说明 */
export const payExpNote = (c) => (!c ? "" : isBankAcct(c) ? t("银行账户没有到期日") : c.expires_on ? t("按 {name} 的到期年月 {d} 提醒换卡；要改去 用卡 里改", { name: c.name, d: c.expires_on.slice(0, 7) }) : t("{name} 还没填到期年月，去 用卡 里填上才会提醒换卡", { name: c.name }));
/** 账单的付款账户字段：下拉选卡 → pay_card_id；现金 / 其他 → autopay_method 文字 */
const payFields = (value, text) => { const r = resolvePayAccount(value, text); return { pay_card_id: r.card_id, autopay_method: r.method }; };
/** 记一笔缴费 / 核对 / 跳过：写 purchases（有金额且为应付，带上用的卡）、写记录、把账单推到下一期 */
export async function recordPayment(bill, { paid_on, due_on, amount, status, method, card_id, confirmation_ref, late_fee, fee_amount, tax_amount, assessment_amount, assessment_ids, settle_assessment, unit_amount, parking_amount, notes, store }) {
  const currency = bill.currency || Units.region.currency;
  let purchase_id = null;
  const total = status === "skipped" ? 0 : num(amount) + num(late_fee) + num(fee_amount) + num(tax_amount) + num(assessment_amount);
  if (total > 0 && bill.direction !== "receivable") {
    purchase_id = await Store.addPurchase({ item_id: null, name: bill.name, category: `bill_${bill.category}`, quantity: null, unit: null, store: (store || "").trim().slice(0, 40) || bill.payee || bill.name || null,
      amount: Math.round(total * 100) / 100, currency, purchased_at: new Date(`${paid_on}T12:00:00`).toISOString(), ...(card_id ? { card_id } : {}), ...(bill.property_id ? { property_id: bill.property_id } : {}) });   // 关联账单的房产（迁移 055）
  }
  const assessOnly = !!settle_assessment && !(num(amount) > 0) && !(num(late_fee) > 0) && !(num(fee_amount) > 0) && !(num(tax_amount) > 0);   // 一次性结清只交摊派：不算交了本期（不关联到期日、不推进下次到期）
  const payRow = { bill_id: bill.id, due_on: assessOnly ? null : due_on || bill.next_due_on || null, paid_on, amount: status === "skipped" ? null : (amount == null ? null : Math.round(num(amount) * 100) / 100),
    currency, method: method || null, confirmation_ref: confirmation_ref || null, late_fee: Math.round(num(late_fee) * 100) / 100, fee_amount: Math.round(num(fee_amount) * 100) / 100, tax_amount: Math.round(num(tax_amount) * 100) / 100, assessment_amount: Math.round(num(assessment_amount) * 100) / 100, unit_amount: unit_amount == null ? null : Math.round(num(unit_amount) * 100) / 100, parking_amount: parking_amount == null ? null : Math.round(num(parking_amount) * 100) / 100, status, notes: notes || null, purchase_id, ...(card_id ? { card_id } : {}) };
  const payId = await Store.addBillPayment(payRow);
  // 一次性结清：这笔摊派所有没缴的期都被这次交掉 → 删掉它们，换成一行「一次性结清」（金额 = 合计，关联这次缴费）；否则照常记上是哪次缴费交的
  const merge = settle_assessment ? settleMerge(state.assessItems, settle_assessment, assessment_ids || [], { paidOn: paid_on, paymentId: payId }) : null;
  if (merge) { for (const id of merge.removeIds) await Store.deleteAssessItem(id); await Store.saveAssessItem(merge.payoff); }
  else if (assessment_ids?.length) await Store.setItemsPayment(assessment_ids, payId);
  resetPayHistory();
  if (bill.debt_id && purchase_id) await splitBillPayment(bill, { ...payRow, id: payId }).catch((e) => console.warn("[debt split]", e.message));   // 贷款：本金单独一行（性质 = 融资），主行只剩利息 + Escrow
  if (assessOnly) return { next: bill.next_due_on, catchUp: false };
  // 推到下一期：以这次对应的到期日为基准，保证不会漏期。补记更早一期（到期日早于当前下次到期）不往回推，下次到期不动
  const base = due_on || bill.next_due_on || paid_on;
  const catchUp = !!(bill.next_due_on && base < bill.next_due_on && bill.frequency !== "one_time");
  const next = catchUp ? bill.next_due_on : advanceDue(bill, base);
  const patch = { ...bill, next_due_on: next };
  if (!next && bill.frequency === "one_time") patch.active = false;
  for (const k of ["pays", "last", "avg", "est", "priceUp", "daysLeft", "status", "cardDays", "cardExpiring", "monthly", "ended"]) delete patch[k];
  await Store.saveBill(patch);
  return { next, catchUp };
}
/** 改了记录的到期日后，账单的下次到期跟着对：这条正是把账单推到当前这期的那条，或改后的到期日已经不早于当前下次到期，就按新到期日重推；否则不动 */
async function resyncDue(bill, old, newDue) {
  if (!newDue || bill.frequency === "one_time") return null;
  const pushedIt = old.due_on && bill.next_due_on === advanceDue(bill, old.due_on);
  if (!pushedIt && bill.next_due_on && newDue < bill.next_due_on) return null;
  const next = advanceDue(bill, newDue); if (!next || next === bill.next_due_on) return null;
  const patch = { ...bill, next_due_on: next };
  for (const k of ["pays", "last", "avg", "est", "priceUp", "daysLeft", "status", "cardDays", "cardExpiring", "monthly", "ended"]) delete patch[k];
  await Store.saveBill(patch);
  return next;
}
/** 删一条缴费记录：同时退回它推进过的到期日（只在它正是把账单推到当前这一期的那条时才退；之后又记了别的期，或同一期还有别的记录，就不动）。返回退回后的到期日，没退回返回 null */
export async function deleteBillPay(id) {
  const p = state.billPayments.find((x) => x.id === id);
  const bill = p && state.billsEnriched.find((b) => b.id === p.bill_id);
  await beforeDeletePayment(id).catch(() => {});   // 贷款拆分的本金行（流水随缴费记录级联删除）
  await Store.deleteBillPayment(id);
  resetPayHistory();
  if (!bill || !p.due_on) return null;
  const sameDue = state.billPayments.some((x) => x.id !== id && x.bill_id === bill.id && x.due_on === p.due_on);
  const pushedIt = bill.next_due_on === advanceDue(bill, p.due_on) || (bill.frequency === "one_time" && !bill.next_due_on);
  if (sameDue || !pushedIt || bill.next_due_on === p.due_on) return null;
  const patch = { ...bill, next_due_on: p.due_on };
  if (bill.frequency === "one_time") patch.active = true;   // 一次性账单记过缴费会被停用，删了记录要恢复
  for (const k of ["pays", "last", "avg", "est", "priceUp", "daysLeft", "status", "cardDays", "cardExpiring", "monthly", "ended"]) delete patch[k];
  await Store.saveBill(patch);
  return p.due_on;
}
/** 改一条已有的缴费记录：不动账单的下次到期日；记过花费的，花费也跟着改（金额变 0 / 跳过就删掉那笔花费，之前没记的有金额就补一笔） */
async function updatePayment(bill, fe) {
  const old = state.billPayments.find((x) => x.id === fe.pay_id.value) || olderPayment(fe.pay_id.value);
  if (!old) return toast(t("找不到这条记录"));
  const r2 = (v) => Math.round(num(v) * 100) / 100, status = fe.status.value, paid_on = fe.paid_on.value || old.paid_on || todayISO();
  const amount = status === "skipped" || fe.amount.value === "" ? null : r2(fe.amount.value), late = r2(fe.late_fee.value), fee = r2(fe.fee_amount?.value), tax = r2(fe.tax_amount?.value), picked = checkedItems(fe), asum = status === "skipped" ? 0 : picked.sum, total = status === "skipped" ? 0 : r2((amount || 0) + late + fee + tax + asum);
  const currency = old.currency || bill.currency || Units.region.currency, at = new Date(`${paid_on}T12:00:00`).toISOString();
  const payee = (fe.store?.value || "").trim().slice(0, 40) || bill.payee || bill.name || null;
  const pay = resolvePayAccount(fe.pay_account?.value, fe.method.value), cardPatch = pay.card_id || old.card_id ? { card_id: pay.card_id } : {};   // 没选过卡就不带这个字段（没执行迁移 036 也能存）
  let purchase_id = old.purchase_id || null;
  if (purchase_id && total > 0) await Store.updatePurchase(purchase_id, { amount: total, purchased_at: at, store: payee, ...cardPatch });
  else if (purchase_id) { await Store.deletePurchase(purchase_id); purchase_id = null; }
  else if (total > 0 && bill.direction !== "receivable") purchase_id = await Store.addPurchase({ item_id: null, name: bill.name, category: `bill_${bill.category}`, quantity: null, unit: null, store: payee, amount: total, currency, purchased_at: at, ...cardPatch, ...(bill.property_id ? { property_id: bill.property_id } : {}) });
  if (!purchase_id) await beforeDeletePayment(old.id).catch(() => {});   // 不再记花费了：贷款拆分的本金行和流水也去掉
  const patch = { paid_on, due_on: fe.due_on.value || null, amount, currency, method: pay.method, confirmation_ref: fe.confirmation_ref.value.trim() || null, late_fee: late, fee_amount: fee, tax_amount: tax, assessment_amount: asum, ...(fe.unit_amount ? { unit_amount: r2(fe.unit_amount.value), parking_amount: r2(fe.parking_amount?.value) } : {}), status, notes: fe.notes.value.trim() || null, purchase_id, ...cardPatch };
  await Store.updateBillPayment(old.id, patch);
  const had = state.assessItems.filter((x) => x.payment_id === old.id).map((x) => x.id);
  const keepIds = status === "skipped" ? [] : picked.ids;
  const toFree = had.filter((x) => !keepIds.includes(x)), toTake = keepIds.filter((x) => !had.includes(x));
  if (toFree.length) await Store.setItemsPayment(toFree, null);
  if (toTake.length) await Store.setItemsPayment(toTake, old.id);
  resetPayHistory();
  if (bill.debt_id && purchase_id) await splitBillPayment(bill, { ...old, ...patch, id: old.id }).catch((e) => console.warn("[debt split]", e.message));
  const moved = fe.due_on.value !== (old.due_on || "") ? await resyncDue(bill, old, fe.due_on.value || null) : null;   // 到期日改了：账单的下次到期跟着对
  toast(moved ? t("已保存修改，下次到期 {d}", { d: fmtDate(moved) }) : t("已保存修改"));
}
export async function saveBillPayForm(f) {
  const fe = f.elements;
  const bill = state.billsEnriched.find((x) => x.id === fe.bill_id.value);
  if (!bill) return toast(t("账单不存在"));
  if (fe.pay_id?.value) return updatePayment(bill, fe);
  const pay = resolvePayAccount(fe.pay_account?.value, fe.method.value);
  // 固定金额的账单涨价了：勾着「更新通常金额」就把这次的金额带进账单（recordPayment 存账单时一起存，不会被旧值盖回去）
  const paidAmt = fe.amount.value === "" ? null : Math.round(num(fe.amount.value) * 100) / 100;
  const unit = fe.unit_amount ? Math.round(num(fe.unit_amount.value) * 100) / 100 : null, parking = fe.parking_amount ? Math.round(num(fe.parking_amount.value) * 100) / 100 : null;   // HOA：单元费 + 车位费
  if (fe.update_typical?.checked && fe.status.value !== "skipped" && paidAmt != null && paidAmt > 0 && paidAmt !== num(bill.typical_amount, NaN)) { bill.typical_amount = paidAmt; if (unit != null) { bill.unit_amount = unit; bill.parking_amount = parking; } }
  const r = await recordPayment(bill, { paid_on: fe.paid_on.value || todayISO(), due_on: fe.due_on.value || null, amount: fe.amount.value === "" ? null : fe.amount.value, status: fe.status.value,
    method: pay.method, card_id: pay.card_id, confirmation_ref: fe.confirmation_ref.value.trim(), late_fee: fe.late_fee.value, unit_amount: unit, parking_amount: parking, fee_amount: fe.fee_amount?.value, tax_amount: fe.tax_amount?.value, ...(fe.status.value === "skipped" ? {} : { assessment_amount: checkedItems(fe).sum, assessment_ids: checkedItems(fe).ids, settle_assessment: fe.settle_assessment?.value || null }), notes: fe.notes.value.trim(), store: fe.store?.value });
  const nextTxt = fmtDate(r.next || "") || t("无");
  toast(fe.status.value === "skipped" ? t("已跳过这期，下次到期 {d}", { d: nextTxt }) : r.catchUp ? t("已补记 {due} 那期；下次到期仍是 {d}", { due: fmtDate(fe.due_on.value), d: nextTxt }) : t("已记录，下次到期 {d}", { d: nextTxt }));
}
/** 概览里的“已核对”：自动扣款账单一键记录（金额取通常金额或平均） */
export async function quickVerify(id) {
  const bill = state.billsEnriched.find((x) => x.id === id);
  if (!bill) return;
  const pay = bill.pay_card_id ? resolvePayAccount(bill.pay_card_id) : { card_id: null, method: bill.autopay_method || t("自动扣款") };
  const r = await recordPayment(bill, { paid_on: todayISO(), due_on: bill.next_due_on, amount: bill.est, status: "verified", method: pay.method, card_id: pay.card_id, late_fee: 0, fee_amount: bill.typical_fee, tax_amount: bill.typical_tax });
  toast(t("已核对 {name}，下次 {d}", { name: withProperty(bill.property_id, bill.name), d: fmtDate(r.next || "") || t("无") }));
}
