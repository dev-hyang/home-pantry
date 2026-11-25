/* 添加借贷向导（#/bills/debts?new=1）：一步一页，最后一页「确认」汇总全部信息，每一块带「编辑」回到对应那一步，点「确认并创建」才真正建。
 * 做法和添加车辆 / 卡的向导一样：表单还是原来那一个（字段、保存逻辑 saveDebtForm 都不变），各块（[data-fsec]）一次只显示一个，填的内容就留在表单里；
 * 确认页由 readDebt 读出表单当前内容、复用借贷详情的分块画法（debtRows）。步骤随类型变：个人借贷 = 基本信息 → 金额与期限 → 备注；其余 = 基本 → 金额与期限 → 还款安排 → 关联 → 备注；最后是确认。
 * 每一步显示哪些块由 CSS 按表单的 data-step 决定（styles.css 的 form[data-dwz]）；不用 hidden：表单自己还用 hidden 藏「个人借贷不需要的字段」。 */
import { esc, num } from "../core/util.js";
import { t } from "../core/i18n.js";
import { cur } from "./debt-common.js";
import { DEBT_SEC_NAMES, debtRows } from "./debt-sections.js";

const REVIEW = "review", personalOf = (f) => f.elements.category.value === "personal_lending";
const contentSteps = (personal) => Object.keys(DEBT_SEC_NAMES).filter((k) => !(personal && (k === "pay" || k === "link")));
const stepsOf = (f) => [...contentSteps(personalOf(f)), REVIEW];
const nameOf = (id) => (id === REVIEW ? "确认" : DEBT_SEC_NAMES[id]);
const nowText = (list, id) => { const i = Math.max(0, list.indexOf(id)); return `<b>${esc(t("第 {n} 步，共 {m} 步", { n: i + 1, m: list.length }))}</b> · ${esc(t(nameOf(list[i])))}`; };
const dots = (list, id) => list.map((s, i) => `<li class="${i < list.indexOf(id) ? "is-done" : s === id ? "is-now" : ""}"></li>`).join("");

/** 表单顶上的进度：第 n 步 / 共 m 步 + 进度点（步骤数随类型变，show() 更新） */
export const dwChrome = (personal) => { const list = [...contentSteps(personal), REVIEW]; return `<div class="wiz-steps"><p class="wiz-now" data-dw-now aria-live="polite">${nowText(list, "basic")}</p><ol class="wiz-dots" data-dw-dots aria-hidden="true">${dots(list, "basic")}</ol></div>`; };
/** 底部按钮：取消 / 上一步 / 下一步 / 确认并创建（只在确认页出现） */
export const dwActions = (cancelHref) => `<div class="ui-acts sticky-actions wz-actions"><a class="ui-btn" data-tone="ghost" href="${esc(cancelHref)}">${t("取消")}</a><button type="button" class="ui-btn" data-tone="ghost" data-dw="prev" hidden>${t("上一步")}</button><button type="button" class="ui-btn" data-tone="primary" data-dw="next">${t("下一步")}</button><button type="submit" class="ui-btn" data-tone="primary" data-wz-save data-dw-save hidden>${t("确认并创建")}</button></div>`;

const form = () => document.querySelector("form[data-dwz]");
const cur$ = (f) => f.dataset.step || "basic";

function show(f, id) {
  const list = stepsOf(f);
  f.dataset.step = id;
  const rv = f.querySelector("[data-dw-review]"); rv.hidden = id !== REVIEW; if (id === REVIEW) rv.innerHTML = reviewHtml(f);
  f.querySelector("[data-dw-now]").innerHTML = nowText(list, id); f.querySelector("[data-dw-dots]").innerHTML = dots(list, id);
  f.querySelector('[data-dw="prev"]').hidden = list.indexOf(id) === 0;
  f.querySelector('[data-dw="next"]').hidden = id === REVIEW;
  f.querySelector("[data-dw-save]").hidden = id !== REVIEW;
  const err = f.querySelector("[data-debt-err]"); if (err) err.textContent = "";
  f.scrollIntoView({ block: "start" });
}

/** 这一步能不能往下走：基本信息要有名称；「某天的未还本金」和「那一天」要一起填 */
function check(f, id) {
  const err = f.querySelector("[data-debt-err]"), fe = f.elements;
  if (id === "basic" && !fe.name.value.trim()) { err.textContent = t("请填名称"); fe.name.focus(); return false; }
  if (id === "terms" && (fe.opening_balance.value === "") !== !fe.opening_balance_on.value) { err.textContent = t("「某天的未还本金」和「那一天」要一起填"); return false; }
  return true;
}

/** 读表单 → 借贷（只用来画确认页，字段和 saveDebtForm 一致） */
function readDebt(f) {
  const fe = f.elements, v = (k) => (fe[k] ? String(fe[k].value || "").trim() : ""), n = (k) => (v(k) === "" ? null : num(v(k))), personal = personalOf(f);
  const froms = [...f.querySelectorAll('[name="escrow_from"]')].map((x) => x.value), amts = [...f.querySelectorAll('[name="escrow_amount"]')].map((x) => x.value);
  return { id: "", category: v("category"), name: v("name"), direction: personal ? v("direction") || "payable" : "payable", counterparty_name: v("counterparty_name"), person_id: v("person_id"), status: v("status") || "active",
    original: n("original_principal"), interest_rate: n("interest_rate"), term_months: n("term_months"), start_date: v("start_date"), first_payment_date: v("first_payment_date"), maturity_date: v("maturity_date"),
    opening_balance: n("opening_balance"), opening_balance_on: v("opening_balance_on"), payment_frequency: v("payment_frequency"), scheduled_payment: n("scheduled_payment"),
    escrow_schedule: froms.map((m, i) => ({ from: m, amount: amts[i] })).filter((r) => r.from && r.amount !== ""), lender_card_id: v("lender_card_id"), property_id: personal ? "" : v("property_id"),
    asset_id: personal ? "" : v("asset_id"), financing_role: v("financing_role"), secured: !!fe.secured?.checked, notes: v("notes"), currency: cur() };
}

/** 确认页：每一块 = 详情页同样的分块 + 「编辑」（回到对应那一步） */
function reviewHtml(f) {
  const d = readDebt(f), rows = debtRows(d), blocks = contentSteps(personalOf(f)).map((k) => `<section class="panel dt-block"><div class="dt-head"><h3>${esc(t(DEBT_SEC_NAMES[k]))}</h3>
      <button type="button" class="ui-btn" data-size="sm" data-tone="ghost" data-dw="goto" data-step="${k}" aria-label="${esc(t("编辑 {name}", { name: t(DEBT_SEC_NAMES[k]) }))}">${t("编辑")}</button></div><dl class="dt-list">${rows[k].filter(Boolean).join("")}</dl></section>`).join("");
  return `<p class="muted" style="margin:0 0 10px;font-size:13px">${t("请核对下面的信息；哪一块要改，点它的「编辑」回到那一步。没问题就点最下面的「确认并创建」，到这一步才会真正建好这笔借贷。")}</p><div class="dt-grid dd-secs">${blocks}</div>`;
}

/** 回车 = 下一步，不直接保存；确认页上把每一步再查一遍，有问题回到那一步。返回 true = 已处理，不用保存（debt-actions 的提交处理开头调用） */
export function dwIntercept(f) {
  if (!f?.hasAttribute("data-dwz")) return false;
  if (cur$(f) !== REVIEW) { advance(f); return true; }
  for (const s of contentSteps(personalOf(f))) if (!check(f, s)) { show(f, s); check(f, s); return true; }
  return false;
}
function advance(f) { const list = stepsOf(f), id = cur$(f); if (check(f, id)) show(f, list[Math.min(list.length - 1, list.indexOf(id) + 1)]); }

if (typeof document !== "undefined") {
  document.addEventListener("click", (e) => {
    const b = e.target.closest?.("[data-dw]"), f = form(); if (!b || !f) return;
    const list = stepsOf(f), i = list.indexOf(cur$(f));
    if (b.dataset.dw === "next") return advance(f);
    if (b.dataset.dw === "prev") return show(f, list[Math.max(0, i - 1)]);
    if (b.dataset.dw === "goto") return show(f, b.dataset.step);
  });
  document.addEventListener("change", (e) => {   // 换了类型：步骤数跟着变（个人借贷少两步）
    const f = form(); if (!f || e.target.name !== "category") return;
    setTimeout(() => { const list = stepsOf(f); f.querySelector("[data-dw-now]").innerHTML = nowText(list, cur$(f)); f.querySelector("[data-dw-dots]").innerHTML = dots(list, cur$(f)); }, 0);
  });
}
