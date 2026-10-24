/* 信用卡（用卡）界面：「现在该刷哪张」快速查询、卡列表、卡表单；采购清单 / 补记花费旁的一行建议。逻辑在 cards.js。 */
import { state } from "../core/state.js";
import { Store } from "../core/store.js";
import { $, esc, fmtDate, money, num, todayISO, toast } from "../core/util.js";
import { t } from "../core/i18n.js";
import { href, go } from "../core/router.js";
import { enrichBills, initialDue } from "./logic.js";
import { CARDS_HREF, bonusLeft, cardById, cardHref, expDays, feeDays, fromCatalog, holderName, networkName, pickCards, pickFor, quarterOf, reloadCards, rewardCatIcon, rewardCatName, rotatingNow } from "./cards.js";

const D = () => window.CARDS;
const d = (v) => esc(v ?? "");
const cur = () => Units.region.currency;
const catalogAge = () => Math.round((Date.now() - new Date(`${D().AS_OF}T12:00:00`)) / 864e5);

/* ───────────── 页面 ───────────── */
export function viewCards() {
  const id = state.route.q.get("card");
  if (id) return cardForm(id);
  const cards = state.cards.filter((c) => c.active !== false), off = state.cards.filter((c) => c.active === false);
  return `<section class="section">
    <div class="section-head"><h2>${t("用卡")}</h2><p>${t("按场景比返现：该刷哪张、为什么；到期、年费、轮换类别、开卡奖励按时提醒。")}</p>
      <div class="head-acts"><a class="btn btn-primary btn-sm" href="${cardHref("new")}">${t("添加卡")}</a></div></div>
    ${cards.length ? pickPanel() : ""}
    ${cards.length ? `<div class="section-head" style="margin-top:14px"><h2>${t("我的卡")}</h2><p>${t("{n} 张在用", { n: cards.length })}${catalogAge() > 90 ? ` · <span class="bank-dup">${t("目录更新于 {d}，可能过期，返现规则以发卡行为准", { d: D().AS_OF })}</span>` : ""}</p></div>
      <div class="panel"><ul class="restock-list card-list">${cards.map(cardRow).join("")}</ul></div>` : emptyHtml()}
    ${off.length ? `<details class="ref-panel panel" style="margin-top:10px"><summary><b>${t("停用的卡")}</b><small>${t("{n} 张", { n: off.length })}</small><span class="mch" aria-hidden="true">›</span></summary><ul class="restock-list card-list ref-body">${off.map(cardRow).join("")}</ul></details>` : ""}
    <p class="muted kinds-note" style="margin-top:10px">${t("只记发卡行、产品、末四位、到期年月，不记完整卡号和密码。返现规则来自内置目录或你自己填，会变，以发卡行为准。")}</p>
  </section>`;
}
const emptyHtml = () => `<div class="panel empty"><strong>${t("还没有卡")}</strong>${t("从内置目录选一张常见卡，填上末四位、到期月、还款日就行；不在目录里的手填规则。")}<p><a class="btn btn-primary" href="${cardHref("new")}">${t("添加第一张卡")}</a></p></div>`;

function cardRow(c) {
  const ed = expDays(c), fd = feeDays(c), rot = rotatingNow(c), bl = bonusLeft(c), rw = c.rewards || {};
  const best = Object.entries(rw.cats || {}).sort((a, b) => num(b[1]) - num(a[1])).slice(0, 3).map(([k, v]) => `${rewardCatIcon(k)} ${v}%`).join(" ");
  const tags = [];
  if (ed != null && ed < 0) tags.push(`<span class="badge b-out">${t("已过期")}</span>`); else if (ed != null && ed <= 60) tags.push(`<span class="badge b-soon">${t("{d} 天后到期", { d: ed })}</span>`);
  if (fd != null && fd <= 30) tags.push(`<span class="badge b-soon">${t("年费 {a}", { a: money(num(c.annual_fee)) })}</span>`);
  if (rot?.empty) tags.push(`<span class="badge b-soon">${t("本季类别未填")}</span>`); else if (rot && !rot.activated) tags.push(`<span class="badge b-soon">${t("本季未激活")}</span>`); else if (rot) tags.push(`<span class="badge b-ok">${t("本季 5%：{c}", { c: (rot.cats || []).map(rewardCatName).join(" / ") })}</span>`);
  if (bl) tags.push(`<span class="badge b-low">${t("开卡奖励还差 {a}", { a: money(bl.left) })}</span>`);
  const bill = c.bill_id && state.billsEnriched.find((b) => b.id === c.bill_id);
  const NET_SHORT = { visa: "VISA", mastercard: "MC", amex: "AMEX", discover: "DISC", unionpay: "银联", other: "卡" };
  return `<li class="card-row ${c.active === false ? "inactive" : ""}"><span class="card-net net-${esc(c.network || "other")}" aria-hidden="true" title="${esc(networkName(c.network))}">${esc(NET_SHORT[c.network] || NET_SHORT.other)}</span>
    <div class="grow"><a class="link-name" href="${cardHref(c.id)}">${d(c.name)}</a>${c.last4 ? ` <span class="muted">••${d(c.last4)}</span>` : ""}
      <small>${[holderName(c), c.expires_on ? t("到期 {d}", { d: c.expires_on.slice(0, 7) }) : null, num(c.annual_fee) ? t("年费 {a}", { a: money(num(c.annual_fee)) }) : t("无年费"), bill ? t("还款 {d}", { d: fmtDate(bill.next_due_on) }) : c.due_day ? t("每月 {d} 号还款", { d: c.due_day }) : null, best ? `${t("其他 {b}%", { b: num(rw.base, 0) })} · ${best}` : t("所有消费 {b}%", { b: num(rw.base, 0) })].filter(Boolean).map(esc).join(" · ")}</small>
      ${tags.length ? `<div class="card-tags">${tags.join(" ")}</div>` : ""}</div>
    <a class="btn btn-sm btn-ghost" href="${cardHref(c.id)}">${t("编辑")}</a></li>`;
}

/* ───────────── 现在该刷哪张 ───────────── */
function pickPanel() {
  const p = state.cardPick;
  const cats = D().REWARD_CATS.map(([id, name, icon]) => `<option value="${id}" ${p.cat === id ? "selected" : ""}>${icon} ${esc(t(name))}</option>`).join("");
  return `<form id="cardPickForm" class="panel card-pick" onsubmit="return false">
    <div class="form-grid pick-grid">
      <label>${t("买什么")}<select name="cat">${cats}</select></label>
      <label>${t("在哪买（可不填）")}<input name="merchant" maxlength="40" list="storeList" value="${d(p.merchant)}" placeholder="${esc(t("Costco / Amazon / 餐厅名…"))}"></label>
      <label>${t("金额（可不填）")}<input name="amount" type="number" min="0" step="0.01" inputmode="decimal" value="${d(p.amount)}" placeholder="${esc(cur())}"></label>
      <label class="check-inline"><input type="checkbox" name="abroad" ${p.abroad ? "checked" : ""}><span>${t("境外消费")}</span></label>
    </div>
    <div id="cardPickOut">${pickResultHtml()}</div>
  </form>`;
}
export function pickResultHtml() {
  const p = state.cardPick, amount = p.amount === "" ? null : num(p.amount);
  const list = pickCards({ rewardCat: p.cat, merchant: p.merchant, amount, abroad: p.abroad });
  if (!list.length) return "";
  const top = list.filter((x) => !x.excluded).slice(0, 3), ex = list.filter((x) => x.excluded);
  return `<div class="pick-cards">${top.map((x, i) => `<div class="pick-card ${i === 0 ? "best" : ""}"><div class="pick-rate">${x.eff}%${x.cash != null ? `<small>≈ ${money(x.cash)}</small>` : ""}</div>
      <b>${d(x.card.name)}</b>${x.card.last4 ? ` <span class="muted">••${d(x.card.last4)}</span>` : ""}<small>${esc(x.reason)}</small>
      ${x.warns.length ? `<div class="pick-warn">⚠️ ${x.warns.map(esc).join("；")}</div>` : ""}</div>`).join("")}</div>
    ${ex.length ? `<p class="muted" style="margin:6px 0 0;font-size:12.5px">${t("不能用：")}${ex.map((x) => `${esc(x.card.name)}（${esc(x.excluded)}）`).join("、")}</p>` : ""}`;
}
/** 采购清单 / 补记花费旁的一行建议：按花费分类 + 商店 */
export function cardHintHtml(category, store, amount) {
  if (!state.billsEnabled || !state.cards.some((c) => c.active !== false)) return "";
  if (!category || category === "other") category = "grocery_misc";   // 采购清单里没分类的大多是买菜
  const list = pickFor(category, store, amount).filter((x) => !x.excluded); if (!list.length) return "";
  const x = list[0];
  return `<span class="card-hint" title="${esc(x.reason)}">💳 ${t("建议用 {card}（{r}%）", { card: esc(x.card.name), r: x.eff })}${x.warns.length ? ` ⚠️` : ""}</span>`;
}

/* ───────────── 表单 ───────────── */
const NUMF = (v) => (v == null || v === "" ? "" : num(v));
function cardForm(id) {
  const isNew = id === "new", c = isNew ? null : cardById(id);
  if (!isNew && !c) return `<section class="section"><div class="panel empty"><strong>${t("找不到这张卡")}</strong><p><a class="btn" href="${CARDS_HREF()}">${t("回用卡")}</a></p></div></section>`;
  const v = c || state.cardDraft || { name: "", issuer: "", network: "visa", kind: "credit", annual_fee: 0, active: true, rewards: { base: 1, cats: {}, caps: {}, merchants: {}, point_value: 1, foreign_fee: 0, has_rotating: false, rotating: [] }, credits: [] };
  const rw = v.rewards || {}, q = quarterOf(), rot = (rw.rotating || []).find((x) => x.from === q.from) || { from: q.from, to: q.to, cats: [], rate: 5, activated: false };
  const bills = state.billsEnriched.filter((b) => b.category === "credit_card");
  const members = state.members || [];
  const opt = (val, label, on) => `<option value="${esc(val)}" ${on ? "selected" : ""}>${esc(label)}</option>`;
  const catalogSel = isNew ? `<label class="span-2">${t("从内置目录选（可选）")}<select name="catalog"><option value="">${t("— 不用目录，手填 —")}</option>${D().CATALOG.map((k) => opt(k.id, `${k.name}${k.issuer ? ` · ${k.issuer}` : ""}`, v.catalog_id === k.id)).join("")}</select><small>${t("选了会把返现规则、年费、网络填好；末四位、到期、持卡人还要你填。目录更新于 {d}。", { d: D().AS_OF })}</small></label>` : "";
  const catsGrid = D().REWARD_CATS.filter(([k]) => k !== "other").map(([k, name, icon]) => `<label class="cat-rate"><span>${icon} ${esc(t(name))}</span><input name="cat_${k}" type="number" min="0" step="0.25" inputmode="decimal" value="${NUMF(rw.cats?.[k])}" placeholder="${NUMF(rw.base) || 1}"></label>`).join("");
  const rotCats = D().REWARD_CATS.filter(([k]) => k !== "other").map(([k, name, icon]) => `<label class="radio-pill"><input type="checkbox" name="rot_cat" value="${k}" ${(rot.cats || []).includes(k) ? "checked" : ""}><span>${icon} ${esc(t(name))}</span></label>`).join("");
  const merchants = Object.entries(rw.merchants || {}).map(([k, val]) => `${k}=${val}`).join(", ");
  const credits = (v.credits || []).map((x) => `${x.name} | ${num(x.amount)} | ${x.period || "year"} | ${x.resets_on || ""} | ${num(x.used, 0)}`).join("\n");
  const b = v.bonus || {};
  return `<section class="section form-page">
    <nav class="crumb" aria-label="${t("位置")}"><a href="${CARDS_HREF()}">‹ ${t("用卡")}</a><span class="sep">/</span><b>${isNew ? t("添加卡") : d(v.name)}</b></nav>
    <form id="cardForm" class="panel" novalidate data-id="${d(c?.id)}">
      <fieldset><legend>${t("这张卡")}</legend><div class="form-grid">
        ${catalogSel}
        <input type="hidden" name="catalog_id" value="${d(v.catalog_id)}"><input type="hidden" name="rules_as_of" value="${d(v.rules_as_of)}">
        <label>${t("名称")}<input name="name" required maxlength="60" value="${d(v.name)}" placeholder="${esc(t("例如 Chase Freedom Unlimited"))}"></label>
        <label>${t("发卡行")}<input name="issuer" maxlength="40" value="${d(v.issuer)}"></label>
        <label>${t("网络")}<select name="network">${Object.entries(D().NETWORKS).map(([k, n]) => opt(k, t(n), (v.network || "visa") === k)).join("")}</select><small>${t("Costco 这类只收某个网络的商家，推荐时会用到")}</small></label>
        <label>${t("类型")}<select name="kind">${[["credit", "信用卡"], ["debit", "借记卡"], ["wallet", "支付宝 / 微信 / 电子钱包"]].map(([k, n]) => opt(k, t(n), (v.kind || "credit") === k)).join("")}</select></label>
        <label>${t("末四位")}<input name="last4" maxlength="4" inputmode="numeric" pattern="[0-9]{4}" value="${d(v.last4)}" placeholder="1234"><small>${t("只记后 4 位，银行导入时靠它认账户")}</small></label>
        <label>${t("持卡人")}<select name="holder_user_id">${opt("", t("共用"), !v.holder_user_id)}${members.map((m) => opt(m.user_id, m.display_name || t("家人"), v.holder_user_id === m.user_id)).join("")}</select></label>
        <label>${t("到期年月")}<input name="expires_on" type="month" value="${d((v.expires_on || "").slice(0, 7))}"></label>
        <label>${t("开卡日期")}<input name="opened_on" type="date" value="${d(v.opened_on)}"></label>
        <label>${t("年费（{cur}）", { cur: cur() })}<input name="annual_fee" type="number" min="0" step="0.01" inputmode="decimal" value="${NUMF(v.annual_fee)}"></label>
        <label>${t("年费哪个月收")}<select name="fee_month">${opt("", t("按开卡月"), !v.fee_month)}${Array.from({ length: 12 }, (_, i) => opt(i + 1, t("{m} 月", { m: i + 1 }), v.fee_month === i + 1)).join("")}</select></label>
        <label>${t("额度（可空）")}<input name="credit_limit" type="number" min="0" step="1" inputmode="decimal" value="${NUMF(v.credit_limit)}"></label>
        <label class="check-inline"><input type="checkbox" name="active" ${v.active !== false ? "checked" : ""}><span>${t("在用（停用的不参与推荐）")}</span></label>
      </div></fieldset>
      <fieldset><legend>${t("还款")}</legend><div class="form-grid">
        <label>${t("账单日（每月几号）")}<input name="statement_day" type="number" min="1" max="31" inputmode="numeric" value="${NUMF(v.statement_day)}"></label>
        <label>${t("还款日（每月几号）")}<input name="due_day" type="number" min="1" max="31" inputmode="numeric" value="${NUMF(v.due_day)}"></label>
        <label class="check-inline"><input type="checkbox" name="autopay" ${v.autopay ? "checked" : ""}><span>${t("自动还款")}</span></label>
        <label>${t("还款提醒走哪条账单")}<select name="bill_id">${opt("", t("（不提醒）"), !v.bill_id)}${bills.map((x) => opt(x.id, `${x.name}${x.next_due_on ? ` · ${fmtDate(x.next_due_on)}` : ""}`, v.bill_id === x.id)).join("")}${opt("__new", t("新建一条「信用卡」还款账单"), false)}</select><small>${t("到期 / 核对提醒和缴费记录都在账单模块里，这里只是关联")}</small></label>
      </div></fieldset>
      <fieldset><legend>${t("返现规则")}</legend>
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
            <label class="check-inline span-2"><input type="checkbox" name="rot_activated" ${rot.activated ? "checked" : ""}><span>${t("本季已激活")}</span></label>
          </div></details>
      </fieldset>
      <fieldset><legend>${t("开卡奖励（可选）")}</legend><div class="form-grid">
        <label>${t("要刷满（{cur}）", { cur: cur() })}<input name="bonus_spend" type="number" min="0" step="1" inputmode="decimal" value="${NUMF(b.spend)}"></label>
        <label>${t("截止日期")}<input name="bonus_by" type="date" value="${d(b.by)}"></label>
        <label>${t("奖励值多少（{cur}）", { cur: cur() })}<input name="bonus_value" type="number" min="0" step="1" inputmode="decimal" value="${NUMF(b.reward_value)}"></label>
        <label>${t("奖励说明")}<input name="bonus_label" maxlength="60" value="${d(b.label)}" placeholder="${esc(t("例如 60,000 点 ≈ $750"))}"></label>
        <label>${t("已刷了多少（手填）")}<input name="bonus_spent" type="number" min="0" step="1" inputmode="decimal" value="${NUMF(b.spent_manual)}"></label>
        <label class="check-inline"><input type="checkbox" name="bonus_done" ${b.done ? "checked" : ""}><span>${t("已拿到奖励")}</span></label>
      </div></fieldset>
      <fieldset><legend>${t("报销额度（可选）")}</legend>
        <label>${t("每行一条：名称 | 金额 | year 或 quarter 或 month | 清零日期 | 已用")}<textarea name="credits" rows="3" placeholder="${esc(t("旅行报销 | 300 | year | 2027-01-01 | 120"))}">${d(credits)}</textarea></label>
      </fieldset>
      <label>${t("备注")}<input name="notes" maxlength="500" value="${d(v.notes)}"></label>
      <p id="cardError" class="form-error" role="alert"></p>
      <div class="form-actions sticky-actions"><button type="submit" class="btn btn-primary">${t("保存")}</button><a class="btn btn-ghost" href="${CARDS_HREF()}">${t("取消")}</a>
        ${c ? `<span class="spacer"></span><button type="button" class="btn btn-danger-ghost" data-action="card-del" data-id="${c.id}">${t("删除这张卡")}</button>` : ""}</div>
    </form>
  </section>`;
}
/** 表单里选了目录：用目录内容重画（草稿放 state.cardDraft） */
export function applyCatalogPick(id) {
  const draft = id ? fromCatalog(id) : null;
  state.cardDraft = draft; go(cardHref("new"), { replace: true });
}
export async function saveCardForm(f) {
  const fe = f.elements, err = $("#cardError");
  const name = fe.name.value.trim(); if (!name) { err.textContent = t("请填名称"); fe.name.focus(); return false; }
  const old = f.dataset.id ? cardById(f.dataset.id) : null, rw0 = old?.rewards || state.cardDraft?.rewards || {};
  const n = (k) => (fe[k] && fe[k].value !== "" ? num(fe[k].value) : null);
  const cats = {}; for (const [k] of D().REWARD_CATS) { const v = fe[`cat_${k}`]; if (v && v.value !== "") cats[k] = num(v.value); }
  const merchants = {}; for (const part of fe.merchants.value.split(/[,，]/)) { const m = part.trim().match(/^(.+?)\s*=\s*([\d.]+)$/); if (m) merchants[m[1].trim().toLowerCase()] = num(m[2]); }
  const q = quarterOf(), rotCats = [...f.querySelectorAll('input[name="rot_cat"]:checked')].map((x) => x.value);
  const rotating = (rw0.rotating || []).filter((x) => x.from !== q.from);
  if (fe.has_rotating.checked && rotCats.length) rotating.push({ from: q.from, to: q.to, cats: rotCats, rate: n("rot_rate") ?? 5, cap: n("rot_cap"), activated: fe.rot_activated.checked });
  const rewards = { ...rw0, base: n("base") ?? 0, point_value: n("point_value") ?? 1, foreign_fee: n("foreign_fee") ?? 0, cats, merchants, has_rotating: fe.has_rotating.checked, rotating, caps: rw0.caps || {} };
  const bonus = n("bonus_spend") ? { spend: n("bonus_spend"), by: fe.bonus_by.value || null, reward_value: n("bonus_value") ?? 0, label: fe.bonus_label.value.trim(), spent: old?.bonus?.spent ?? 0, spent_manual: n("bonus_spent"), done: fe.bonus_done.checked } : null;
  const credits = fe.credits.value.split(/\r?\n/).map((l) => l.split("|").map((x) => x.trim())).filter((p) => p[0] && p[1]).map((p) => ({ name: p[0].slice(0, 40), amount: num(p[1]), period: ["year", "quarter", "month"].includes(p[2]) ? p[2] : "year", resets_on: /^\d{4}-\d{2}-\d{2}$/.test(p[3] || "") ? p[3] : null, used: num(p[4], 0) }));
  let bill_id = fe.bill_id.value || null;
  const card = { id: old?.id, name, issuer: fe.issuer.value.trim() || null, network: fe.network.value, kind: fe.kind.value, last4: /^\d{4}$/.test(fe.last4.value.trim()) ? fe.last4.value.trim() : null, holder_user_id: fe.holder_user_id.value || null,
    expires_on: fe.expires_on.value ? `${fe.expires_on.value}-01` : null, opened_on: fe.opened_on.value || null, annual_fee: n("annual_fee") ?? 0, fee_month: n("fee_month"), credit_limit: n("credit_limit"), statement_day: n("statement_day"), due_day: n("due_day"), autopay: fe.autopay.checked,
    bill_id: bill_id === "__new" ? null : bill_id, catalog_id: fe.catalog_id.value || null, rewards, bonus, credits, rules_as_of: fe.rules_as_of.value || (old?.rules_as_of ?? todayISO()), active: fe.active.checked, notes: fe.notes.value.trim() || null };
  const btn = f.querySelector('button[type="submit"]'); btn.disabled = true; err.textContent = "";
  try {
    if (bill_id === "__new") {   // 新建一条「信用卡」类周期账单：到期 / 核对提醒、缴费记录都走账单模块
      const b = { property_id: null, name: t("{name} 还款", { name }), category: "credit_card", direction: "payable", payee: card.issuer || name, account_last4: card.last4, login_hint: null, pay_url: null,
        pay_channel: card.autopay ? "autopay" : "online", amount_type: "variable", typical_amount: null, currency: cur(), frequency: "monthly", interval_months: null, due_day: card.due_day || 1, due_dates: [], next_due_on: null, grace_days: 0, late_fee_note: null,
        autopay: card.autopay, autopay_method: null, autopay_card_expires: card.expires_on, statement_channel: "email", reminder_days: [7, 1], ends_on: null, sub_kind: null, trial_ends_on: null, assigned_to: null, essential: true, active: true, notes: null };
      b.next_due_on = initialDue(b);
      await Store.saveBill(b);
      state.bills = await Store.listBills(); state.billsEnriched = enrichBills(state.bills, state.billPayments);
      card.bill_id = state.bills.find((x) => x.category === "credit_card" && x.name === b.name && x.account_last4 === card.last4)?.id || null;
    }
    const id = await Store.saveCard(card);
    state.cardDraft = null; await reloadCards();
    toast(old ? t("已保存") : t("已添加 {name}", { name }));
    go(CARDS_HREF()); return id;
  } catch (e) {
    err.textContent = /relation .*cards|does not exist|schema cache/i.test(e.message) ? t("还没执行数据库迁移 032（信用卡表），先在 Supabase 里执行 supabase/migrations/032_cards.sql") : t("保存失败：{msg}", { msg: e.message });
    btn.disabled = false; return false;
  }
}
export async function deleteCard(id) { await Store.deleteCard(id); await reloadCards(); toast(t("已删除")); go(CARDS_HREF()); }
