/* 添加卡 / 账户的向导（#/bills/<某一页>?card=new）：一步一页，最后一页「确认」汇总全部信息，每一块带「编辑」回到对应那一步，确认无误再保存。
 *  步骤随种类变：信用卡 = 类型 → 基本信息 → 还款 → 返现规则 → 开卡奖励 → 报销额度 → 备注 → 确认；借记卡 = 类型 → 基本信息 → 返现规则 → 备注 → 确认；银行 / 投资 / 电子钱包（Ventra、PayPal…）/ 礼品卡 = 类型 → 基本信息 → 备注 → 确认。
 *  做法：表单还是原来那一个（字段、保存逻辑都不变），各分区（.cf-sec）一次只显示一个；确认页由 collectCard 读出表单当前内容、复用详情页的分区画法。
 *  只用于新建；已有的卡仍是详情页 → 某一块「编辑」。 */
import { esc } from "../core/util.js";
import { t } from "../core/i18n.js";
import { CARD_SECS, cardSectionBody } from "./card-detail.js";
import { groupHref, groupName, kindName, noRewards } from "./cards.js";
import { collectCard } from "./card-collect.js";
import { refreshTaxHint } from "../tax/tax-hint.js";

/** [id, 名称, 图标, 适用种类（空 = 全部）] */
const STEPS = [["type", "类型", "🧭"], ["basic", "基本信息", "💳"], ["repay", "还款", "📅", ["credit"]], ["rewards", "返现规则", "🎯", ["credit", "debit"]],
  ["bonus", "开卡奖励", "🎁", ["credit"]], ["credits", "报销额度", "🧾", ["credit"]], ["notes", "备注", "📝"], ["review", "确认", "✅"]];
export const stepsFor = (kind) => STEPS.filter((s) => !s[3] || s[3].includes(kind));
export const firstStep = () => STEPS[0][0];

/** 页头下面的进度：第 n 步 / 共 m 步 + 进度条（具体数字由 show() 更新） */
export const wzChrome = (kind) => `<div class="wz-head" data-wz-head><p class="wz-now" data-wz-now aria-live="polite">${wzNow(kind, "type")}</p><div class="wz-bar" aria-hidden="true"><i data-wz-bar style="width:${Math.round(100 / stepsFor(kind).length)}%"></i></div></div>`;
const wzNow = (kind, id) => { const list = stepsFor(kind), i = Math.max(0, list.findIndex((s) => s[0] === id)); return `${esc(t("第 {n} 步 / 共 {m} 步", { n: i + 1, m: list.length }))} · ${list[i][2]} ${esc(t(list[i][1]))}`; };
/** 底部按钮：上一步 / 下一步 / 保存（只在确认页出现）/ 取消 */
export const wzActions = (cancelHref) => `<div class="form-actions sticky-actions wz-actions"><button type="button" class="btn btn-ghost" data-wz="prev" hidden>${t("上一步")}</button><button type="button" class="btn btn-primary" data-wz="next">${t("下一步")}</button><button type="submit" class="btn btn-primary" data-wz-save hidden>${t("确认并保存")}</button><a class="btn btn-ghost" href="${esc(cancelHref)}">${t("取消")}</a></div>`;

const form = () => document.getElementById("cardForm");
const kindOf = (f) => f.elements.kind.value;
const cur = (f) => f.dataset.step || firstStep();

function show(f, id) {
  const kind = kindOf(f), list = stepsFor(kind), i = list.findIndex((s) => s[0] === id);
  f.dataset.step = id;
  f.querySelectorAll(".cf-sec").forEach((el) => { el.hidden = el.dataset.csec !== id; });
  const rv = f.querySelector("[data-wz-review]"); rv.hidden = id !== "review"; if (id === "review") rv.innerHTML = reviewHtml(f);
  f.querySelector("[data-wz-now]").textContent = wzNow(kind, id);
  f.querySelector("[data-wz-bar]").style.width = `${Math.round(((i + 1) / list.length) * 100)}%`;
  f.querySelector('[data-wz="prev"]').hidden = i <= 0;
  f.querySelector('[data-wz="next"]').hidden = id === "review";
  f.querySelector("[data-wz-save]").hidden = id !== "review";
  const err = f.querySelector("#cardError"); if (err) err.textContent = "";
  f.scrollIntoView({ block: "start" });
}

/** 这一步能不能往下走（基本信息：名称必填，末四位要么空要么 4 位数字） */
function check(f, id) {
  const err = f.querySelector("#cardError"), fe = f.elements;
  if (id === "basic") {
    if (!fe.name.value.trim()) { err.textContent = t("请填名称"); fe.name.focus(); return false; }
    const l4 = fe.last4.value.trim(); if (l4 && !/^\d{4}$/.test(l4)) { err.textContent = t("末四位要填 4 位数字，或者留空"); fe.last4.focus(); return false; }
  }
  return true;
}

/** 确认页：每一块 = 详情页同样的分区 + 「编辑」（回到对应那一步） */
function reviewHtml(f) {
  const { card, bill_id } = collectCard(f), bank = noRewards(card), steps = stepsFor(card.kind).map((s) => s[0]);
  const blocks = CARD_SECS.filter((s) => steps.includes(s.id)).map((s) => `<section class="panel prof-card" aria-labelledby="wzr-${s.id}"><header class="prof-head"><span class="mi" aria-hidden="true">${s.icon}</span><div class="prof-t"><h3 id="wzr-${s.id}">${esc(t(s.name(bank)))}</h3></div>
      <button type="button" class="btn btn-sm btn-ghost prof-edit" data-wz="goto" data-step="${s.id}" aria-label="${esc(t("编辑 {name}", { name: t(s.name(bank)) }))}">${t("编辑")}</button></header>${cardSectionBody(card, s.id)}</section>`).join("");
  return `<p class="muted" style="margin:0 0 10px;font-size:13px">${t("请核对下面的信息；哪一块要改，点它的「编辑」回到那一步。没问题就点最下面的「确认并保存」。")}</p>${bill_id === "__new" ? `<p class="muted" style="margin:0 0 10px;font-size:13px">🧾 ${t("保存时会同时新建一条「信用卡」还款账单。")}</p>` : ""}<div class="prof-grid bill-detail-grid">${blocks}</div>`;
}

/** 在向导里按了回车：当成「下一步」，不直接保存；返回 true = 已处理（saveCardForm 开头调用） */
export function wzIntercept(f) {
  if (!f?.hasAttribute("data-wzf") || cur(f) === "review") return false;
  advance(f); return true;
}
function advance(f) {
  const id = cur(f), list = stepsFor(kindOf(f)), i = list.findIndex((s) => s[0] === id);
  if (!check(f, id)) return;
  show(f, list[Math.min(list.length - 1, i + 1)][0]);
}

/** 换了类型：页头面包屑里的分组名和「添加 xxx」跟着变 */
function refreshCrumb(f) {
  const kind = kindOf(f), a = document.querySelector("[data-crumb-group]"), b = document.querySelector("[data-crumb-title]");
  if (a) { a.textContent = t(groupName(kind)); a.setAttribute("href", groupHref(kind)); }
  if (b) b.textContent = `${t("添加")} ${kindName(kind)}`;
}
if (typeof document !== "undefined") {
  document.addEventListener("input", (e) => { if (e.target.name === "base") e.target.dataset.touched = "1"; });
  document.addEventListener("click", (e) => {
    const b = e.target.closest?.("[data-wz]"); const f = form(); if (!b || !f || !f.hasAttribute("data-wzf")) return;
    const act = b.dataset.wz, id = cur(f), list = stepsFor(kindOf(f)), i = list.findIndex((s) => s[0] === id);
    if (act === "next") return advance(f);
    if (act === "prev") return show(f, list[Math.max(0, i - 1)][0]);
    if (act === "goto") return show(f, b.dataset.step);
  });
  document.addEventListener("change", (e) => {   // 换了类型：步骤数 / 名称跟着变
    const f = form(); if (!f?.hasAttribute("data-wzf") || e.target.name !== "kind") return;
    f.querySelector("[data-wz-now]").textContent = wzNow(kindOf(f), cur(f));
    refreshTaxHint(f);
    refreshCrumb(f);
    const base = f.elements.base; if (base && !base.dataset.touched) base.value = kindOf(f) === "credit" ? 1 : 0;   // 信用卡默认 1%；借记卡、电子钱包、账户默认 0（没动过才改）   // 开户前的税务提示跟着类型换（HSA / FSA / 529 / 孩子账户…）
  });
}
