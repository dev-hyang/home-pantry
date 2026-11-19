/* 卡的表单，和 AI 起草返现规则（只发卡名，结果填进表单由人确认）。 */
import { $, esc, fmtDate, num, toast, todayISO } from "../core/util.js";
import { ACCT_KINDS, CARDS_HREF, cardById, cardHref, fromCatalog, kindName, noRewards, quarterOf, reloadCards } from "./cards.js";
import { Store } from "../core/store.js";
import { accountOptions, acctLabel } from "./card-picker.js";
import { aiReady, askText } from "../core/ai.js";
import { backBtn } from "../core/hub.js";
import { dupOnce, normName } from "../core/item-match.js";
import { enrichBills, initialDue } from "./logic.js";
import { go } from "../core/router.js";
import { spendChanged } from "../core/spend-data.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";
import { D, cur, d, roStop } from "./card-common.js";
import { aiSettings, providerOf } from "../core/ai-common.js";
import { balancePanel } from "./net-worth-panel.js";
import { adultPeople } from "../settings/family-lite.js";

/* ───────────── 表单 ───────────── */
const NUMF = (v) => (v == null || v === "" ? "" : num(v));
export function cardForm(id, ro = false) {
  const isNew = id === "new", c = isNew ? null : cardById(id);
  const preset = state.route.q.get("preset");
  if (isNew && preset && !state.cardDraft) {   // 链接预填：#/bills/cards?card=new&preset=<目录 id>&last4=1234&due=24
    const dft = fromCatalog(preset); if (dft) { const l4 = state.route.q.get("last4"), due = +state.route.q.get("due"); state.cardDraft = { ...dft, last4: /^\d{4}$/.test(l4 || "") ? l4 : null, due_day: due >= 1 && due <= 31 ? due : null }; }
  }
  const qKind = state.route.q.get("kind");   // 快速添加：#/bills/cards?card=new&kind=checking
  if (isNew && qKind && ACCT_KINDS[qKind] && !state.cardDraft) state.cardDraft = { name: "", issuer: "", network: qKind === "credit" || qKind === "debit" ? "visa" : "other", kind: qKind, annual_fee: 0, active: true, rewards: { base: 0, cats: {}, caps: {}, merchants: {}, point_value: 1, foreign_fee: 0, has_rotating: false, rotating: [] }, credits: [] };
  if (!isNew && !c) return `<section class="section"><div class="panel empty"><strong>${t("找不到这张卡")}</strong><p><a class="btn" href="${CARDS_HREF()}">${t("回用卡")}</a></p></div></section>`;
  const v = c || state.cardDraft || { name: "", issuer: "", network: "visa", kind: "credit", annual_fee: 0, active: true, rewards: { base: 1, cats: {}, caps: {}, merchants: {}, point_value: 1, foreign_fee: 0, has_rotating: false, rotating: [] }, credits: [] };
  const kind = v.kind || "credit", bank = noRewards({ kind });   // 银行账户 / 礼品卡：精简表单
  const only = (ks) => `data-kind="${ks}" ${ks.split(" ").includes(kind) ? "" : "hidden"}`;   // 只有这些种类才显示的字段 / 分区（换种类时 main.js 按 data-kind 切换）
  const linkedBill = v.bill_id ? state.bills.find((x) => x.id === v.bill_id) : null;
  const rw = v.rewards || {}, q = quarterOf(), rot = (rw.rotating || []).find((x) => x.from === q.from) || { from: q.from, to: q.to, cats: [], rate: 5, activated: false };
  const bills = state.billsEnriched.filter((b) => b.category === "credit_card");
  const opt = (val, label, on) => `<option value="${esc(val)}" ${on ? "selected" : ""}>${esc(label)}</option>`;
  const aiBtn = `<div class="span-2" ${only("credit")}><button type="button" class="btn btn-sm btn-ghost" data-action="card-ai">✨ ${t("用 AI 按卡名起草返现规则")}</button> <small class="muted">${t("只把卡的名字发给你设置的模型；按模型记忆起草，可能过时，逐项核对后再保存。")}</small></div>`;
  const catalogSel = isNew ? `<label class="span-2" ${only("credit")}>${t("从内置目录选（可选）")}<select name="catalog"><option value="">${t("— 不用目录，手填 —")}</option>${D().CATALOG.map((k) => opt(k.id, `${t(k.name)}${k.issuer ? ` · ${k.issuer}` : ""}`, v.catalog_id === k.id)).join("")}</select><small>${t("选了会把返现规则、年费、网络填好；末四位、到期、持卡人还要你填。目录更新于 {d}。", { d: D().AS_OF })}</small></label>` : "";
  const catsGrid = D().REWARD_CATS.filter(([k]) => k !== "other").map(([k, name, icon]) => `<label class="cat-rate"><span>${icon} ${esc(t(name))}</span><input name="cat_${k}" type="number" min="0" step="0.25" inputmode="decimal" value="${NUMF(rw.cats?.[k])}" placeholder="${NUMF(rw.base) || 1}"></label>`).join("");
  const rotCats = D().REWARD_CATS.filter(([k]) => k !== "other").map(([k, name, icon]) => `<label class="radio-pill"><input type="checkbox" name="rot_cat" value="${k}" ${(rot.cats || []).includes(k) ? "checked" : ""}><span>${icon} ${esc(t(name))}</span></label>`).join("");
  const merchants = Object.entries(rw.merchants || {}).map(([k, val]) => `${k}=${val}`).join(", ");
  const credits = (v.credits || []).map((x) => `${x.name} | ${num(x.amount)} | ${x.period || "year"} | ${x.resets_on || ""} | ${num(x.used, 0)}`).join("\n");
  const b = v.bonus || {};
  return `<section class="section form-page">
    <nav class="crumb" aria-label="${t("当前位置")}">${backBtn(CARDS_HREF())}<a href="${CARDS_HREF()}">${t("卡与账户")}</a><span class="sep">/</span><b>${isNew ? (bank ? t("添加账户") : t("添加卡")) : d(v.name)}</b></nav>
    <form id="cardForm" class="panel" novalidate data-id="${d(c?.id)}" ${ro ? 'data-readonly="1"' : ""}>
      ${ro ? `<p class="muted" style="margin:0 0 10px;font-size:13px">${t("只读：家主开放财务权限后才能修改")}</p><fieldset disabled style="border:0;padding:0;margin:0;min-width:0">` : ""}
      <fieldset><legend>${bank ? t("这个账户") : t("这张卡")}</legend><div class="form-grid">
        <label>${t("类型")}<select name="kind">${Object.entries(ACCT_KINDS).map(([k, [n, icon]]) => opt(k, `${icon} ${t(n)}`, kind === k)).join("")}</select><small>${t("支票 / 储蓄账户没有返现，不参与推荐；用来记账单从哪扣款、缴费用的哪个账户")}</small></label>
        ${catalogSel}
        ${aiBtn}
        <input type="hidden" name="catalog_id" value="${d(v.catalog_id)}"><input type="hidden" name="rules_as_of" value="${d(v.rules_as_of)}">
        <label>${t("名称")}<input name="name" required maxlength="60" value="${d(v.name)}" placeholder="${esc(bank ? t("例如 Chase Checking") : t("例如 Chase Freedom Unlimited"))}"></label>
        <label><span ${only("gift")}>${t("商家 / 品牌（在哪用）")}</span><span ${only("credit debit wallet checking savings brokerage retirement hsa loan cash")}>${t("发卡行 / 银行")}</span><input name="issuer" maxlength="40" list="giftMerchants" value="${d(v.issuer)}"><small ${only("gift")}>${t("通用的 Visa / Mastercard 礼品卡写「通用」；筛选按它分")}</small></label>
        <datalist id="giftMerchants">${["Amazon", "Target", "Walmart", "Costco", "Trader Joe's", "Whole Foods", "Home Depot", "Lowe's", "Starbucks", "Apple", "Visa 通用", "Mastercard 通用", "京东", "天猫", "盒马"].map((x) => `<option value="${esc(x)}">`).join("")}</datalist>
        <label ${only("credit debit")}>${t("网络")}<select name="network">${Object.entries(D().NETWORKS).map(([k, n]) => opt(k, t(n), (v.network || "visa") === k)).join("")}</select><small>${t("Costco 这类只收某个网络的商家，推荐时会用到")}</small></label>
        <label>${t("末四位")}<input name="last4" maxlength="4" inputmode="numeric" pattern="[0-9]{4}" value="${d(v.last4)}" placeholder="1234"><small>${t("只记后 4 位，银行导入时靠它认账户")}</small></label>
        <label ${only("gift")}>${t("面值 / 充值总额（{cur}）", { cur: cur() })}<input name="balance" type="number" min="0" step="0.01" inputmode="decimal" value="${NUMF(v.balance)}"><small>${t("余额 = 它减去记在这张卡上的花费；用完了把「在用」取消")}</small></label>
        <label>${t("持卡人 / 户主")}<select name="holder_person_id">${opt("", t("共用"), !v.holder_person_id)}${adultPeople().map((p) => opt(p.id, p.name, v.holder_person_id === p.id)).join("")}</select></label>
        <label ${only("credit debit gift")}><span ${only("gift")}>${t("有效期至（可选）")}</span><span ${only("credit debit")}>${t("到期年月")}</span><input name="expires_on" type="month" value="${d((v.expires_on || "").slice(0, 7))}"></label>
        <label>${t("开卡 / 开户日期")}<input name="opened_on" type="date" max="${todayISO()}" value="${d(v.opened_on)}"></label>
        <label ${only("credit")}>${t("年费（{cur}）", { cur: cur() })}<input name="annual_fee" type="number" min="0" step="0.01" inputmode="decimal" value="${NUMF(v.annual_fee)}"></label>
        <label ${only("credit")}>${t("年费哪个月收")}<select name="fee_month">${opt("", t("按开卡月"), !v.fee_month)}${Array.from({ length: 12 }, (_, i) => opt(i + 1, t("{m} 月", { m: i + 1 }), v.fee_month === i + 1)).join("")}</select></label>
        <label ${only("credit")}>${t("额度（可空）")}<input name="credit_limit" type="number" min="0" step="1" inputmode="decimal" value="${NUMF(v.credit_limit)}"></label>
        <label class="check-inline"><input type="checkbox" name="active" ${v.active !== false ? "checked" : ""}><span>${bank ? t("在用（停用的不出现在下拉里）") : t("在用（停用的不参与推荐）")}</span></label>
      </div></fieldset>
      <fieldset ${only("credit")}><legend>${t("还款")}</legend><div class="form-grid">
        <label>${t("账单日（每月几号）")}<input name="statement_day" type="number" min="1" max="31" inputmode="numeric" value="${NUMF(v.statement_day)}"></label>
        <label>${t("还款日（每月几号）")}<input name="due_day" type="number" min="1" max="31" inputmode="numeric" value="${NUMF(v.due_day)}"></label>
        <label class="check-inline"><input type="checkbox" name="autopay" ${v.autopay ? "checked" : ""}><span>${t("自动还款")}</span></label>
        <label>${t("从哪个账户还款")}<select name="pay_from">${accountOptions(linkedBill?.pay_card_id || "", { none: "（未指定）", exclude: c?.id || "", kinds: ["checking", "savings", "debit"] })}</select><small>${t("写到关联的还款账单上（它的付款账户）；账户在上面的「添加卡 / 账户」里加")}</small></label>
        <label>${t("还款提醒走哪条账单")}<select name="bill_id">${opt("", t("（不提醒）"), !v.bill_id)}${bills.map((x) => opt(x.id, `${x.name}${x.next_due_on ? ` · ${fmtDate(x.next_due_on)}` : ""}`, v.bill_id === x.id)).join("")}${opt("__new", t("新建一条「信用卡」还款账单"), false)}</select><small>${t("到期 / 核对提醒和缴费记录都在账单模块里，这里只是关联")}</small></label>
      </div></fieldset>
      <fieldset ${only("credit debit wallet")}><legend>${t("返现规则")}</legend>
        <p class="muted" style="margin:0 0 8px;font-size:13px">${t("全部按「% 返现」填；积分卡先定每点值多少美分，各类别写折算后的 %。没填的类别按「其他消费」。")}</p>
        <div class="form-grid">
          <label>${t("其他消费 %")}<input name="base" type="number" min="0" step="0.25" inputmode="decimal" value="${NUMF(rw.base) || 0}"></label>
          <label>${t("每点值多少美分（现金卡 = 1）")}<input name="point_value" type="number" min="0" step="0.05" inputmode="decimal" value="${NUMF(rw.point_value) || 1}"></label>
          <label>${t("境外手续费 %")}<input name="foreign_fee" type="number" min="0" step="0.1" inputmode="decimal" value="${NUMF(rw.foreign_fee) || 0}"></label>
        </div>
        <div class="cat-rates">${catsGrid}</div>
        <div class="form-grid" style="margin-top:8px">
          <label class="span-2">${t("特定商家（商家=%，逗号隔开）")}<input name="merchants" maxlength="300" value="${d(merchants)}" placeholder="amazon=5, whole foods=5"></label>
        </div>
        <details class="adv" ${rw.has_rotating ? "open" : ""}><summary>${t("季度轮换 5% 类别（Chase Freedom、Discover it 这类）")}</summary>
          <div class="form-grid" style="margin-top:8px">
            <label class="check-inline span-2"><input type="checkbox" name="has_rotating" ${rw.has_rotating ? "checked" : ""}><span>${t("这张卡有季度轮换类别")}</span></label>
            <div class="span-2"><div class="lab" style="font-size:13px;font-weight:700;margin-bottom:4px">${t("本季（{q}）的类别", { q: q.label })}</div><div class="seg-radio">${rotCats}</div></div>
            <label>${t("本季 %")}<input name="rot_rate" type="number" min="0" step="0.5" inputmode="decimal" value="${NUMF(rot.rate) || 5}"></label>
            <label>${t("本季封顶（{cur}）", { cur: cur() })}<input name="rot_cap" type="number" min="0" step="1" inputmode="decimal" value="${NUMF(rot.cap ?? rw.rotating_cap)}"></label>
            <p class="muted span-2" style="margin:0;font-size:12.5px">${t("每季类别以发卡行为准（链接可能变）：")} <a href="https://www.discover.com/credit-cards/cash-back/cashback-calendar.html" target="_blank" rel="noopener noreferrer">Discover it</a> · <a href="https://www.chase.com/personal/credit-cards/freedom/5percent" target="_blank" rel="noopener noreferrer">Chase Freedom</a></p>
            <label class="check-inline span-2"><input type="checkbox" name="rot_activated" ${rot.activated ? "checked" : ""}><span>${t("本季已激活")}</span></label>
          </div></details>
      </fieldset>
      <fieldset ${only("credit")}><legend>${t("开卡奖励（可选）")}</legend><div class="form-grid">
        <label>${t("要刷满（{cur}）", { cur: cur() })}<input name="bonus_spend" type="number" min="0" step="1" inputmode="decimal" value="${NUMF(b.spend)}"></label>
        <label>${t("截止日期")}<input name="bonus_by" type="date" value="${d(b.by)}"></label>
        <label>${t("奖励值多少（{cur}）", { cur: cur() })}<input name="bonus_value" type="number" min="0" step="1" inputmode="decimal" value="${NUMF(b.reward_value)}"></label>
        <label>${t("奖励说明")}<input name="bonus_label" maxlength="60" value="${d(b.label)}" placeholder="${esc(t("例如 60,000 点 ≈ $750"))}"></label>
        <label>${t("已刷了多少（不填 = 按记到这张卡的花费自动累计）")}<input name="bonus_spent" type="number" min="0" step="1" inputmode="decimal" value="${NUMF(b.spent_manual)}"></label>
        <label class="check-inline"><input type="checkbox" name="bonus_done" ${b.done ? "checked" : ""}><span>${t("已拿到奖励")}</span></label>
      </div></fieldset>
      <fieldset ${only("credit")}><legend>${t("报销额度（可选）")}</legend>
        <label>${t("每行一条：名称 | 金额 | year 或 quarter 或 month | 清零日期 | 已用")}<textarea name="credits" rows="3" placeholder="${esc(t("旅行报销 | 300 | year | 2027-01-01 | 120"))}">${d(credits)}</textarea></label>
      </fieldset>
      <label>${t("备注")}<input name="notes" maxlength="500" value="${d(v.notes)}"></label>
      ${ro ? `</fieldset><div class="form-actions"><a class="btn btn-ghost" href="${CARDS_HREF()}">${t("返回")}</a></div>` : `<p id="cardError" class="form-error" role="alert"></p>
      <div class="form-actions sticky-actions"><button type="submit" class="btn btn-primary">${t("保存")}</button><a class="btn btn-ghost" href="${CARDS_HREF()}">${t("取消")}</a>
        ${c ? `<span class="spacer"></span><button type="button" class="btn btn-danger-ghost" data-action="card-del" data-id="${c.id}">${bank ? t("删除这个账户") : t("删除这张卡")}</button>` : ""}</div>`}
    </form>
    ${c && !ro ? `<div class="nw-card-bal">${balancePanel(c, { open: true })}</div>` : ""}
  </section>`;
}
/** 表单里选了目录：用目录内容重画（草稿放 state.cardDraft） */
export function applyCatalogPick(id) {
  const draft = id ? fromCatalog(id) : null;
  state.cardDraft = draft; go(cardHref("new"), { replace: true });
}
export async function saveCardForm(f) {
  if (roStop()) return false;
  const fe = f.elements, err = $("#cardError");
  const name = fe.name.value.trim(); if (!name) { err.textContent = t("请填名称"); fe.name.focus(); return false; }
  { // 疑似重复：同名，或同样的末四位（手动加过、导入对账单时又加一次）——先提醒一次
    const l4 = fe.last4?.value.trim() || "", hit = (state.cards || []).find((c) => c.id !== f.dataset.id && (normName(c.name) === normName(name) || (l4 && c.last4 === l4)));
    if (dupOnce(f, hit?.id)) { err.textContent = t("已经有「{name}」了（同名或末四位一样）。确认是另一张，再点一次保存。", { name: acctLabel(hit) }); fe.name.focus(); return false; }
  }
  const old = f.dataset.id ? cardById(f.dataset.id) : null, rw0 = old?.rewards || state.cardDraft?.rewards || {};
  const n = (k) => (fe[k] && fe[k].value !== "" ? num(fe[k].value) : null);
  const cats = {}; for (const [k] of D().REWARD_CATS) { const v = fe[`cat_${k}`]; if (v && v.value !== "") cats[k] = num(v.value); }
  const merchants = {}; for (const part of fe.merchants.value.split(/[,，]/)) { const m = part.trim().match(/^(.+?)\s*=\s*([\d.]+)$/); if (m) merchants[m[1].trim().toLowerCase()] = num(m[2]); }
  const q = quarterOf(), rotCats = [...f.querySelectorAll('input[name="rot_cat"]:checked')].map((x) => x.value);
  const rotating = (rw0.rotating || []).filter((x) => x.from !== q.from);
  if (fe.has_rotating.checked && rotCats.length) rotating.push({ from: q.from, to: q.to, cats: rotCats, rate: n("rot_rate") ?? 5, cap: n("rot_cap"), activated: fe.rot_activated.checked });
  const rewards = { ...rw0, base: n("base") ?? 0, point_value: n("point_value") ?? 1, foreign_fee: n("foreign_fee") ?? 0, cats, merchants, has_rotating: fe.has_rotating.checked, rotating, caps: rw0.caps || {} };
  const bonus = n("bonus_spend") ? { spend: n("bonus_spend"), by: fe.bonus_by.value || null, reward_value: n("bonus_value") ?? 0, label: fe.bonus_label.value.trim(), spent: 0, start: old?.bonus?.start || fe.opened_on.value || null, spent_manual: n("bonus_spent"), done: fe.bonus_done.checked } : null;
  const credits = fe.credits.value.split(/\r?\n/).map((l) => l.split("|").map((x) => x.trim())).filter((p) => p[0] && p[1]).map((p) => ({ name: p[0].slice(0, 40), amount: num(p[1]), period: ["year", "quarter", "month"].includes(p[2]) ? p[2] : "year", resets_on: /^\d{4}-\d{2}-\d{2}$/.test(p[3] || "") ? p[3] : null, used: num(p[4], 0) }));
  let bill_id = fe.bill_id.value || null;
  const payFrom = fe.pay_from?.value || null;   // 信用卡从哪个账户还款：写到关联的还款账单上
  const card = { id: old?.id, name, issuer: fe.issuer.value.trim() || null, network: fe.network.value, kind: fe.kind.value, last4: /^\d{4}$/.test(fe.last4.value.trim()) ? fe.last4.value.trim() : null, holder_person_id: fe.holder_person_id.value || null,
    expires_on: fe.expires_on.value ? `${fe.expires_on.value}-01` : null, opened_on: fe.opened_on.value || null, annual_fee: n("annual_fee") ?? 0, balance: fe.kind.value === "gift" ? n("balance") : null, fee_month: n("fee_month"), credit_limit: n("credit_limit"), statement_day: n("statement_day"), due_day: n("due_day"), autopay: fe.autopay.checked,
    bill_id: bill_id === "__new" ? null : bill_id, catalog_id: fe.catalog_id.value || null, rewards, bonus, credits, rules_as_of: fe.rules_as_of.value || (old?.rules_as_of ?? todayISO()), active: fe.active.checked, notes: fe.notes.value.trim() || null,
    inactive_since: fe.active.checked ? null : (old?.active === false ? old.inactive_since || null : todayISO()) };   // 刚取消「在用」：记今天为停用日期
  const btn = f.querySelector('button[type="submit"]'); btn.disabled = true; err.textContent = "";
  try {
    if (bill_id === "__new") {   // 新建一条「信用卡」类周期账单：到期 / 核对提醒、缴费记录都走账单模块
      const b = { property_id: null, name: t("{name} 还款", { name }), category: "credit_card", direction: "payable", payee: card.issuer || name, account_last4: card.last4, login_hint: null, pay_url: null,
        pay_channel: card.autopay ? "autopay" : "online", amount_type: "variable", typical_amount: null, currency: cur(), frequency: "monthly", interval_months: null, due_day: card.due_day || 1, due_dates: [], next_due_on: null, grace_days: 0, late_fee_note: null,
        autopay: card.autopay, autopay_method: null, autopay_card_expires: card.expires_on, pay_card_id: payFrom, statement_channel: "email", reminder_days: [7, 1], ends_on: null, sub_kind: null, trial_ends_on: null, assigned_person_id: null, essential: true, active: true, notes: null };
      b.next_due_on = initialDue(b);
      await Store.saveBill(b);
      state.bills = await Store.listBills(); state.billsEnriched = enrichBills(state.bills, state.billPayments);
      card.bill_id = state.bills.find((x) => x.category === "credit_card" && x.name === b.name && x.account_last4 === card.last4)?.id || null;
    }
    const id = await Store.saveCard(card);
    const bl = card.kind === "credit" && card.bill_id ? state.bills.find((x) => x.id === card.bill_id) : null;
    if (bl && ((bl.pay_card_id || null) !== payFrom || !!bl.autopay !== !!card.autopay)) {   // 还款账户 / 自动还款同步到关联账单
      try { await Store.saveBill({ ...bl, pay_card_id: payFrom, autopay: card.autopay, pay_channel: card.autopay ? "autopay" : bl.pay_channel === "autopay" ? "online" : bl.pay_channel }); state.bills = await Store.listBills(); state.billsEnriched = enrichBills(state.bills, state.billPayments); }
      catch (e) { toast(t("卡已保存，但还款账单没同步上：{msg}", { msg: e.message })); }
    }
    state.cardDraft = null; await reloadCards();
    toast(old ? t("已保存") : t("已添加 {name}", { name }));
    go(CARDS_HREF()); return id;
  } catch (e) {
    err.textContent = /relation .*cards|does not exist|schema cache/i.test(e.message) ? t("还没执行数据库迁移 032（信用卡表），先在 Supabase 里执行 supabase/migrations/032_cards.sql") : t("保存失败：{msg}", { msg: e.message });
    btn.disabled = false; return false;
  }
}
/** 删除卡：purchases = "keep"（花费保留，付款方式改成文字「礼品卡 · 名字」）或 "delete"（名下花费一起删） */
export async function deleteCard(id, { purchases = "keep" } = {}) {
  if (roStop()) { state.cardDelete = null; return; }
  const c = cardById(id); if (!c) return;
  const label = `${kindName(c.kind)} · ${c.name}`.slice(0, 40);
  // 名下花费在数据库里一次改完 / 删完（不再逐笔：浏览器里也没有整表花费）
  const n = purchases === "delete" ? await Store.deleteCardPurchases(id) : await Store.detachCardPurchases(id, label);
  await Store.deleteCard(id); state.cardDelete = null; await reloadCards(); if (n) spendChanged();
  toast(n ? (purchases === "delete" ? t("已删除，连同 {n} 笔花费", { n }) : t("已删除，{n} 笔花费保留", { n })) : t("已删除")); go(CARDS_HREF());
}
/* ───────────── AI 起草返现规则（只发卡名；起草结果填进表单，由你核对后保存） ───────────── */
const AI_SYSTEM = [
  "You describe credit card reward structures from memory and return ONLY JSON. Be conservative: if unsure about a number, use null. Never invent bonus categories.",
  'Return {"issuer": string|null, "network": "visa|mastercard|amex|discover|unionpay|other", "annual_fee": number|null, "foreign_fee_pct": number|null, "point_value_cents": number, "base_pct": number, "category_pct": {"grocery":n,"wholesale":n,"dining":n,"gas":n,"travel":n,"online":n,"amazon":n,"drugstore":n,"streaming":n,"utilities":n,"transit":n,"entertainment":n,"home":n}, "merchant_pct": {"merchant keyword lowercase": n}, "rotating": boolean, "notes": string}.',
  "All *_pct values are the cash-back-equivalent percentage AFTER converting points with point_value_cents (e.g. 3 points per $1 at 1.25 cents = 3.75). Include only categories the card actually boosts; omit the rest. rotating = true only for cards with quarterly rotating 5% categories (do not list the current quarter's categories).",
  "notes: one short sentence about important conditions (caps, membership required, activation).",
].join("\n");
export async function aiDraftCard(f) {
  if (roStop()) return;
  const name = f.elements.name.value.trim(), issuer = f.elements.issuer.value.trim();
  if (!name) return toast(t("先在名称里填卡的名字，例如 Chase Sapphire Preferred"));
  if (!aiReady()) return toast(t("还没填 API key，去 设置 → AI 助手 填一个（Gemini 有免费额度）"));
  if (!confirm(t("将把卡名「{n}」发给 {p} 来起草返现规则（不含任何个人信息）。继续？", { n: `${issuer} ${name}`.trim(), p: t(providerOf(aiSettings().provider).name) }))) return;
  const btn = f.querySelector('[data-action="card-ai"]'); btn.disabled = true; const old = btn.textContent; btn.textContent = t("AI 起草中…");
  try {
    const text = await askText(AI_SYSTEM, `Credit card: ${issuer} ${name}`.trim(), { json: true, temperature: 0.1, maxTokens: 1500 });
    const j = JSON.parse(String(text).trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim().replace(/^[^{]*/, "").replace(/[^}]*$/, ""));
    const set = (k, val) => { if (f.elements[k] && val != null && val !== "") f.elements[k].value = val; };
    set("issuer", f.elements.issuer.value || j.issuer); if (j.network && f.elements.network.querySelector(`option[value="${j.network}"]`)) f.elements.network.value = j.network;
    set("annual_fee", j.annual_fee); set("foreign_fee", j.foreign_fee_pct); set("point_value", j.point_value_cents); set("base", j.base_pct);
    for (const [k] of D().REWARD_CATS) if (f.elements[`cat_${k}`]) f.elements[`cat_${k}`].value = j.category_pct?.[k] ?? "";
    f.elements.merchants.value = Object.entries(j.merchant_pct || {}).map(([k, val]) => `${String(k).toLowerCase()}=${val}`).join(", ");
    f.elements.has_rotating.checked = !!j.rotating;
    if (j.notes) f.elements.notes.value = `${t("AI 起草，可能过时")}：${j.notes}`.slice(0, 500);
    f.elements.rules_as_of.value = todayISO();
    toast(t("AI 起草好了：请逐项核对（尤其是返现率和封顶），确认后保存"));
  } catch (e) { toast(t("AI 起草失败：{msg}", { msg: e.message })); }
  btn.disabled = false; btn.textContent = old;
}
