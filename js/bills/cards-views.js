/* 信用卡（用卡）界面：「现在该刷哪张」快速查询、卡列表、卡表单；采购清单 / 补记花费旁的一行建议。逻辑在 cards.js。 */
import { state } from "../core/state.js";
import { Store } from "../core/store.js";
import { $, esc, fmtDate, money, num, todayISO, toast } from "../core/util.js";
import { t } from "../core/i18n.js";
import { href, go } from "../core/router.js";
import { enrichBills, initialDue } from "./logic.js";
import { ACCT_KINDS, CARDS_HREF, bonusLeft, cardById, cardHref, expDays, feeDays, fromCatalog, giftBalance, holderName, isBankAcct, kindIcon, kindName, networkName, noRewards, pickCards, pickFor, quarterOf, reloadCards, reviewMonth, rewardCatIcon, rewardCatName, rotatingNow, usage } from "./cards.js";
export { isBankAcct, kindIcon, kindName, noRewards };
import { aiReady, aiSettings, askText, providerOf } from "../core/ai.js";
import { askInline } from "../core/ask.js";

const D = () => window.CARDS;
const d = (v) => esc(v ?? "");
const cur = () => Units.region.currency;
const catalogAge = () => Math.round((Date.now() - new Date(`${D().AS_OF}T12:00:00`)) / 864e5);

/* ───────────── 记花费时选哪张卡（补记 / 编辑 / 采购已买到 / 银行导入共用） ───────────── */
const LAST_CARD = "hmh-last-card";
export const lastCard = () => { try { return localStorage.getItem(LAST_CARD) || ""; } catch { return ""; } };
export const rememberCard = (id) => { try { localStorage.setItem(LAST_CARD, id || ""); } catch { /* 忽略 */ } };
export const acctById = (id) => (id ? state.cards.find((c) => c.id === id) : null);
/** 「💳 Chase Freedom ••0934」/「🏦 Chase Checking ••1234」 */
export const acctLabel = (c) => `${kindIcon(c.kind)} ${c.name}${c.last4 ? ` ••${c.last4}` : ""}`;
/** 付款账户下拉（账单扣款 / 缴费记录 / 一次性账单付款 / 记花费共用）：卡和账户按种类分组；extra = 现金、其他这类额外选项 [[value, label]]；exclude = 不列这张卡 */
export function accountOptions(selected, { none = "（未指定）", extra = [], exclude = "", kinds = null } = {}) {
  const sel = selected || "";
  const list = state.cards.filter((c) => (c.active !== false || c.id === sel) && c.id !== exclude && (!kinds || kinds.includes(c.kind || "credit")));
  const opt = (v, label) => `<option value="${esc(v)}" ${v === sel ? "selected" : ""}>${esc(label)}</option>`;
  const groups = Object.entries(ACCT_KINDS).map(([k, [name]]) => { const cs = list.filter((c) => (c.kind || "credit") === k); return cs.length ? `<optgroup label="${esc(t(name))}">${cs.map((c) => opt(c.id, `${c.name}${c.last4 ? ` ••${c.last4}` : ""}`)).join("")}</optgroup>` : ""; }).join("");
  return `${none != null ? opt("", t(none)) : ""}${groups}${extra.map(([v, l]) => opt(v, t(l))).join("")}`;
}
/* 付款方式（迁移 040 起全站统一）：登记过的卡 / 账户 / 礼品卡存 id（card_id / pay_card_id），其余存文字（method / autopay_method）：
 * 现金、支票（纸质）、礼品卡（没登记的）、其他（手填）。电子钱包（PayPal / Venmo / 支付宝 / 微信）按一张 kind = wallet 的卡登记，不另设选项。 */
const CASH = "现金", CHECK = "支票", GIFT = "礼品卡", OTHER = "其他";
/** 下拉里卡 / 账户之后的固定选项 [value, label]；记花费的紧凑下拉没有手填框，「其他」直接存“其他” */
export const PAY_EXTRA = [["cash", "现金"], ["check", "纸质支票"], ["giftcard", "礼品卡（没登记的）"], ["other", "其他（手填）"]];
export const SPEND_EXTRA = [["cash", "现金"], ["check", "纸质支票"], ["giftcard", "礼品卡（没登记的）"], ["other", "其他"]];
/** 记花费的「怎么付的」：selected 为空时默认选上次用的（卡 id 或 cash / check…） */
export function cardOptions(selected, { withNone = true } = {}) {
  const sel = selected === undefined ? lastCard() : selected || "";
  return accountOptions(sel, { none: withNone ? "（没记怎么付）" : null, extra: SPEND_EXTRA });
}
/** 记一笔 / 采购已买到 / 录入购物 / 保养费用共用的紧凑下拉：没登记卡也有现金 / 支票 / 礼品卡可选 */
export const cardSelectHtml = (name, selected, attrs = "") => (state.billsEnabled ? `<select name="${name}" aria-label="${esc(t("怎么付的"))}" ${attrs}>${cardOptions(selected)}</select>` : "");
export const isCashText = (m) => m === CASH || /^cash$/i.test(m || "");
const isCheckText = (m) => m === CHECK || m === "纸质支票" || /^(paper )?che(ck|que)$/i.test(m || "");
const isGiftText = (m) => m === GIFT || /^gift ?card$/i.test(m || "");
/** 下拉的当前值：卡 id / "cash" / "check" / "giftcard" / "other" / "" */
export const payAcctValue = (cardId, text) => cardId || (isCashText(text) ? "cash" : isCheckText(text) ? "check" : isGiftText(text) ? "giftcard" : text ? "other" : "");
/** 下拉选的值 + 手填说明 → { card_id, method }；选了卡时 method 记成卡名（导出 / 旧版本显示用） */
export function resolvePayAccount(value, text) {
  if (value === "cash") return { card_id: null, method: CASH };
  if (value === "check") return { card_id: null, method: CHECK };
  if (value === "giftcard") return { card_id: null, method: GIFT };
  if (value === "other" || !value) return { card_id: null, method: (text || "").trim().slice(0, 40) || (value === "other" ? OTHER : null) };
  const c = acctById(value); return c ? { card_id: c.id, method: `${c.name}${c.last4 ? ` ••${c.last4}` : ""}`.slice(0, 40) } : { card_id: null, method: (text || "").trim().slice(0, 40) || null };
}
/** 花费（purchases）上的付款字段：刷卡记 card_id、method 留空（显示时按卡现在的名字）；其余记 method。
 * 旧库没执行迁移 033 / 040 时，没选过就不带这个字段，照样能存；old = 正在编辑的那笔（它原来有的字段要清掉） */
export function purchasePayFields(value, old = null) {
  const r = resolvePayAccount(value, "");
  const out = {};
  if (r.card_id || old?.card_id) out.card_id = r.card_id;
  if ((r.method && !r.card_id) || old?.method) out.method = r.card_id ? null : r.method;
  return out;
}
/** 账单 / 缴费记录上显示的付款账户：有卡就按卡现在的名字，否则按文字 */
export const payAcctLabel = (cardId, text) => { const c = acctById(cardId); return c ? acctLabel(c) : text ? t(text) : ""; };
export const billPayLabel = (b) => payAcctLabel(b.pay_card_id, b.autopay_method);
export const paymentPayLabel = (p) => payAcctLabel(p.card_id, p.method);
/** 付款账户下拉里「其他（手填）」对应的说明框：选了其他才显示 */
export const payAcctSelectHtml = (name, value, { extra = PAY_EXTRA, none = "（未指定）", exclude = "" } = {}) => `<select name="${name}" data-pay-acct>${accountOptions(value, { none, extra, exclude })}</select>`;

/* ───────────── 页面 ───────────── */
export function viewCards() {
  const id = state.route.q.get("card");
  if (id) return cardForm(id);
  const live = state.cards.filter((c) => c.active !== false), cards = live.filter((c) => !noRewards(c)), banks = live.filter(noRewards), off = state.cards.filter((c) => c.active === false);
  const addChips = `<div class="acct-add">${Object.entries(ACCT_KINDS).map(([k, [name, icon]]) => `<a class="chip" href="${cardHref("new")}&kind=${k}">＋ ${icon} ${esc(t(name))}</a>`).join("")}</div>`;
  return `<section class="section">
    <div class="section-head"><h2>${t("用卡")}</h2><p>${t("按场景比返现：该刷哪张、为什么；到期、年费、轮换类别、开卡奖励按时提醒。银行账户也记在这里，账单扣款、缴费记录能直接选。")}</p>
      <div class="head-acts"><a class="btn btn-primary btn-sm" href="${cardHref("new")}">${t("添加卡 / 账户")}</a></div></div>
    ${cards.length ? pickPanel() : ""}
    ${cards.length ? reviewHtml() : ""}
    ${cards.length ? `<div class="section-head" style="margin-top:14px"><h2>${t("我的卡")}</h2><p>${t("{n} 张在用", { n: cards.length })}${catalogAge() > 90 ? ` · <span class="bank-dup">${t("目录更新于 {d}，可能过期，返现规则以发卡行为准", { d: D().AS_OF })}</span>` : ""}</p></div>
      <div class="panel"><ul class="restock-list card-list">${cards.map(cardRow).join("")}</ul></div>` : live.length ? "" : emptyHtml()}
    ${banks.length ? `<div class="section-head" style="margin-top:14px"><h2>${t("银行账户与礼品卡")}</h2><p>${t("支票 / 储蓄账户：账单自动扣款、缴费记录、信用卡还款从哪扣；礼品卡：花费记到它名下，自动算余额")}</p></div>
      <div class="panel"><ul class="restock-list card-list">${banks.map(cardRow).join("")}</ul></div>` : ""}
    ${addChips}
    ${off.length ? `<details class="ref-panel panel" style="margin-top:10px"><summary><b>${t("停用的卡")}</b><small>${t("{n} 张", { n: off.length })}</small><span class="mch" aria-hidden="true">›</span></summary><ul class="restock-list card-list ref-body">${off.map(cardRow).join("")}</ul></details>` : ""}
    <p class="muted kinds-note" style="margin-top:10px">${t("只记发卡行、产品、末四位、到期年月，不记完整卡号和密码。返现规则来自内置目录或你自己填，会变，以发卡行为准。")}</p>
  </section>`;
}
const emptyHtml = () => `<div class="panel empty"><strong>${t("还没有卡")}</strong>${t("从内置目录选一张常见卡，填上末四位、到期月、还款日就行；不在目录里的手填规则。")}<p><a class="btn btn-primary" href="${cardHref("new")}">${t("添加第一张卡")}</a></p></div>`;

function cardRow(c) {
  if (noRewards(c)) {   // 银行账户 / 礼品卡：没有返现 / 到期，只看哪些账单从这里扣、记了多少笔；礼品卡再显示余额
    const bills = state.billsEnriched.filter((b) => b.pay_card_id === c.id && b.active), n = state.purchases.filter((p) => p.card_id === c.id).length, gb = giftBalance(c, state.purchases);
    return `<li class="card-row ${c.active === false ? "inactive" : ""}"><span class="card-net net-bank" aria-hidden="true">${c.kind === "gift" ? t("礼品") : c.kind === "savings" ? t("储蓄") : t("支票")}</span>
      <div class="grow"><a class="link-name" href="${cardHref(c.id)}">${d(c.name)}</a>${c.last4 ? ` <span class="muted">••${d(c.last4)}</span>` : ""}
        <small>${[c.issuer, holderName(c), gb != null ? (gb <= 0 ? t("已用完") : t("余额约 {m}", { m: money(gb) })) : null, bills.length ? t("{n} 条账单从这里扣：{names}", { n: bills.length, names: bills.slice(0, 3).map((b) => b.name).join("、") + (bills.length > 3 ? "…" : "") }) : t("还没有账单从这里扣"), n ? t("{n} 笔花费", { n }) : null].filter(Boolean).map(esc).join(" · ")}</small></div>
      <a class="btn btn-sm btn-ghost" href="${cardHref(c.id)}">${t("编辑")}</a></li>`;
  }
  const ed = expDays(c), fd = feeDays(c), rot = rotatingNow(c), bl = bonusLeft(c), rw = c.rewards || {};
  const best = Object.entries(rw.cats || {}).sort((a, b) => num(b[1]) - num(a[1])).slice(0, 3).map(([k, v]) => `${rewardCatIcon(k)} ${v}%`).join(" ");
  const tags = [];
  if (ed != null && ed < 0) tags.push(`<span class="badge b-out">${t("已过期")}</span>`); else if (ed != null && ed <= 60) tags.push(`<span class="badge b-soon">${t("{d} 天后到期", { d: ed })}</span>`);
  if (fd != null && fd <= 30) tags.push(`<span class="badge b-soon">${t("年费 {a}", { a: money(num(c.annual_fee)) })}</span>`);
  if (rot?.empty) tags.push(`<span class="badge b-soon">${t("本季类别未填")}</span>`); else if (rot && !rot.activated) tags.push(`<span class="badge b-soon">${t("本季未激活")}</span>`); else if (rot) tags.push(`<span class="badge b-ok">${t("本季 5%：{c}", { c: (rot.cats || []).map(rewardCatName).join(" / ") })}</span>`);
  if (bl) tags.push(`<span class="badge b-low">${t("开卡奖励还差 {a}", { a: money(bl.left) })}</span>`);
  const bill = c.bill_id && state.billsEnriched.find((b) => b.id === c.bill_id);
  const bars = [];
  if (c.bonus?.spend && !c.bonus.done) { const spent = num(c.bonus.spent_manual ?? usage(c).bonusSpent, 0), pct = Math.min(100, Math.round(spent / c.bonus.spend * 100)); bars.push(progressHtml(t("开卡奖励"), pct, `${money(spent)} / ${money(c.bonus.spend)}${c.bonus.by ? ` · ${t("{d} 天", { d: Math.max(0, bonusLeft(c)?.days ?? 0) })}` : ""}`)); }
  for (const [cat, cap] of Object.entries(c.rewards?.caps || {})) { const used = usage(c).cap(cat); if (cap?.limit && used > 0) bars.push(progressHtml(`${cat === "*" ? t("奖励类别合计") : rewardCatName(cat)} ${t("封顶")}`, Math.min(100, Math.round(used / cap.limit * 100)), `${money(used)} / ${money(cap.limit)}`)); }
  const rot0 = rotatingNow(c), rotLim = num(rot0?.cap ?? c.rewards?.rotating_cap, 0);
  if (rot0 && !rot0.empty && rotLim) { const used = usage(c).rotUsed(); bars.push(progressHtml(t("本季轮换封顶"), Math.min(100, Math.round(used / rotLim * 100)), `${money(used)} / ${money(rotLim)}`)); }
  const NET_SHORT = { visa: "VISA", mastercard: "MC", amex: "AMEX", discover: "DISC", unionpay: "银联", other: "卡" };
  return `<li class="card-row ${c.active === false ? "inactive" : ""}"><span class="card-net net-${esc(c.network || "other")}" aria-hidden="true" title="${esc(networkName(c.network))}">${esc(NET_SHORT[c.network] || NET_SHORT.other)}</span>
    <div class="grow"><a class="link-name" href="${cardHref(c.id)}">${d(c.name)}</a>${c.last4 ? ` <span class="muted">••${d(c.last4)}</span>` : ""}
      <small>${[holderName(c), c.expires_on ? t("到期 {d}", { d: c.expires_on.slice(0, 7) }) : null, num(c.annual_fee) ? t("年费 {a}", { a: money(num(c.annual_fee)) }) : t("无年费"), bill ? t("还款 {d}", { d: fmtDate(bill.next_due_on) }) : c.due_day ? t("每月 {d} 号还款", { d: c.due_day }) : null, best ? `${t("其他 {b}%", { b: num(rw.base, 0) })} · ${best}` : t("所有消费 {b}%", { b: num(rw.base, 0) })].filter(Boolean).map(esc).join(" · ")}</small>
      ${tags.length ? `<div class="card-tags">${tags.join(" ")}</div>` : ""}${bars.length ? `<div class="card-bars">${bars.join("")}</div>` : ""}</div>
    <a class="btn btn-sm btn-ghost" href="${cardHref(c.id)}">${t("编辑")}</a></li>`;
}

const progressHtml = (label, pct, text) => `<div class="prog"><span>${esc(label)}</span><i class="prog-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><b style="width:${pct}%"></b></i><small>${esc(text)}</small></div>`;

/* ───────────── 复盘：各卡花了多少、返现估算、用最优卡能多赚多少 ───────────── */
export function reviewHtml() {
  const months = [...new Set(state.purchases.filter((p) => p.card_id).map((p) => String(p.purchased_at).slice(0, 7)))].sort().reverse();
  if (!months.length) return `<div class="panel"><h3 style="font-size:15px;margin:0 0 4px">${t("返现复盘")}</h3><p class="muted" style="margin:0;font-size:13px">${t("记花费、采购「已买到」、银行导入时选一下用的哪张卡，这里就会算出每张卡花了多少、估算返现，以及用对卡本来能多赚多少。")}</p></div>`;
  const cur0 = state.cardReviewMonth && months.includes(state.cardReviewMonth) ? state.cardReviewMonth : months[0], r = reviewMonth(cur0);
  return `<div class="panel card-review"><div class="row" style="align-items:center;margin-bottom:6px"><h3 style="font-size:15px;margin:0;flex:1">${t("返现复盘")}</h3>
      <select id="cardReviewMonth" aria-label="${esc(t("选择月份"))}" style="width:auto">${months.map((m) => `<option value="${m}" ${m === cur0 ? "selected" : ""}>${m}</option>`).join("")}</select></div>
    <div class="kpis"><div class="kpi"><span>${t("记到卡上的花费")}</span><b>${money(r.tagged)}</b></div><div class="kpi"><span>${t("估算返现")}</span><b>${money(r.earned)}</b></div>
      <div class="kpi"><span>${t("用最优卡能返")}</span><b>${money(r.optimal)}</b><small>${r.gap >= 0.5 ? t("多赚 {a}", { a: money(r.gap) }) : t("基本用对了 👍")}</small></div></div>
    <ul class="restock-list">${r.rows.map((x) => `<li><div class="grow"><span class="name">${d(x.card.name)}</span><small>${t("{n} 笔", { n: x.n })} · ${money(x.spend)}</small></div><b class="num">${money(x.cash)}</b></li>`).join("")}</ul>
    ${r.misses.length ? `<h4 style="margin:10px 0 4px;font-size:13.5px">${t("本可以多赚的几笔")}</h4><ul class="restock-list">${r.misses.map((m) => `<li><div class="grow"><span class="name">${d(m.p.name)}</span><small>${esc(String(m.p.purchased_at).slice(0, 10))} · ${money(num(m.p.amount))} · ${t("用了 {a}（{ra}%），{b} 是 {rb}%", { a: m.used.name, ra: m.rate, b: m.best.name, rb: m.bestRate })}</small></div><b class="num" style="color:var(--pine)">+${money(m.gain)}</b></li>`).join("")}</ul>` : ""}
    ${r.untaggedN ? `<p class="muted" style="margin:8px 0 0;font-size:12.5px">${t("这个月还有 {n} 笔（{a}）没记哪张卡，没算进去。", { n: r.untaggedN, a: money(r.untagged) })}</p>` : ""}
    <p class="muted" style="margin:6px 0 0;font-size:12px">${t("按各卡当前的返现规则估算（不含封顶、开卡奖励、积分兑换差异），仅供参考；实际以发卡行为准。")}</p></div>`;
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
    ${askInline({ id: "cardpick", title: t("用卡推荐"), question: t("为什么推荐这张卡？我的几张卡平时怎么分工最划算？"), context: () => [t("卡：{s}", { s: state.cards.filter((c) => c.active !== false && !isBankAcct(c)).map((c) => `${c.name}（${t("其他 {b}%", { b: num(c.rewards?.base, 0) })}${Object.entries(c.rewards?.cats || {}).slice(0, 4).map(([k, v]) => `，${rewardCatName(k)} ${v}%`).join("")}）`).join("；") }), t("场景：{c}{m}", { c: rewardCatName(p.cat), m: p.merchant ? ` · ${p.merchant}` : "" })] })}
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
  const members = state.members || [];
  const opt = (val, label, on) => `<option value="${esc(val)}" ${on ? "selected" : ""}>${esc(label)}</option>`;
  const aiBtn = `<div class="span-2" ${only("credit")}><button type="button" class="btn btn-sm btn-ghost" data-action="card-ai">✨ ${t("用 AI 按卡名起草返现规则")}</button> <small class="muted">${t("只把卡的名字发给你设置的模型；按模型记忆起草，可能过时，逐项核对后再保存。")}</small></div>`;
  const catalogSel = isNew ? `<label class="span-2" ${only("credit")}>${t("从内置目录选（可选）")}<select name="catalog"><option value="">${t("— 不用目录，手填 —")}</option>${D().CATALOG.map((k) => opt(k.id, `${k.name}${k.issuer ? ` · ${k.issuer}` : ""}`, v.catalog_id === k.id)).join("")}</select><small>${t("选了会把返现规则、年费、网络填好；末四位、到期、持卡人还要你填。目录更新于 {d}。", { d: D().AS_OF })}</small></label>` : "";
  const catsGrid = D().REWARD_CATS.filter(([k]) => k !== "other").map(([k, name, icon]) => `<label class="cat-rate"><span>${icon} ${esc(t(name))}</span><input name="cat_${k}" type="number" min="0" step="0.25" inputmode="decimal" value="${NUMF(rw.cats?.[k])}" placeholder="${NUMF(rw.base) || 1}"></label>`).join("");
  const rotCats = D().REWARD_CATS.filter(([k]) => k !== "other").map(([k, name, icon]) => `<label class="radio-pill"><input type="checkbox" name="rot_cat" value="${k}" ${(rot.cats || []).includes(k) ? "checked" : ""}><span>${icon} ${esc(t(name))}</span></label>`).join("");
  const merchants = Object.entries(rw.merchants || {}).map(([k, val]) => `${k}=${val}`).join(", ");
  const credits = (v.credits || []).map((x) => `${x.name} | ${num(x.amount)} | ${x.period || "year"} | ${x.resets_on || ""} | ${num(x.used, 0)}`).join("\n");
  const b = v.bonus || {};
  return `<section class="section form-page">
    <nav class="crumb" aria-label="${t("当前位置")}"><a href="${CARDS_HREF()}">‹ ${t("用卡")}</a><span class="sep">/</span><b>${isNew ? (bank ? t("添加账户") : t("添加卡")) : d(v.name)}</b></nav>
    <form id="cardForm" class="panel" novalidate data-id="${d(c?.id)}">
      <fieldset><legend>${bank ? t("这个账户") : t("这张卡")}</legend><div class="form-grid">
        <label>${t("类型")}<select name="kind">${Object.entries(ACCT_KINDS).map(([k, [n, icon]]) => opt(k, `${icon} ${t(n)}`, kind === k)).join("")}</select><small>${t("支票 / 储蓄账户没有返现，不参与推荐；用来记账单从哪扣款、缴费用的哪个账户")}</small></label>
        ${catalogSel}
        ${aiBtn}
        <input type="hidden" name="catalog_id" value="${d(v.catalog_id)}"><input type="hidden" name="rules_as_of" value="${d(v.rules_as_of)}">
        <label>${t("名称")}<input name="name" required maxlength="60" value="${d(v.name)}" placeholder="${esc(bank ? t("例如 Chase Checking") : t("例如 Chase Freedom Unlimited"))}"></label>
        <label>${t("发卡行 / 银行")}<input name="issuer" maxlength="40" value="${d(v.issuer)}"></label>
        <label ${only("credit debit")}>${t("网络")}<select name="network">${Object.entries(D().NETWORKS).map(([k, n]) => opt(k, t(n), (v.network || "visa") === k)).join("")}</select><small>${t("Costco 这类只收某个网络的商家，推荐时会用到")}</small></label>
        <label>${t("末四位")}<input name="last4" maxlength="4" inputmode="numeric" pattern="[0-9]{4}" value="${d(v.last4)}" placeholder="1234"><small>${t("只记后 4 位，银行导入时靠它认账户")}</small></label>
        <label ${only("gift")}>${t("面值 / 充值总额（{cur}）", { cur: cur() })}<input name="balance" type="number" min="0" step="0.01" inputmode="decimal" value="${NUMF(v.balance)}"><small>${t("余额 = 它减去记在这张卡上的花费；用完了把「在用」取消")}</small></label>
        <label>${t("持卡人 / 户主")}<select name="holder_user_id">${opt("", t("共用"), !v.holder_user_id)}${members.map((m) => opt(m.user_id, m.display_name || t("家人"), v.holder_user_id === m.user_id)).join("")}</select></label>
        <label ${only("credit debit")}>${t("到期年月")}<input name="expires_on" type="month" value="${d((v.expires_on || "").slice(0, 7))}"></label>
        <label>${t("开卡 / 开户日期")}<input name="opened_on" type="date" value="${d(v.opened_on)}"></label>
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
      <p id="cardError" class="form-error" role="alert"></p>
      <div class="form-actions sticky-actions"><button type="submit" class="btn btn-primary">${t("保存")}</button><a class="btn btn-ghost" href="${CARDS_HREF()}">${t("取消")}</a>
        ${c ? `<span class="spacer"></span><button type="button" class="btn btn-danger-ghost" data-action="card-del" data-id="${c.id}">${bank ? t("删除这个账户") : t("删除这张卡")}</button>` : ""}</div>
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
  const bonus = n("bonus_spend") ? { spend: n("bonus_spend"), by: fe.bonus_by.value || null, reward_value: n("bonus_value") ?? 0, label: fe.bonus_label.value.trim(), spent: 0, start: old?.bonus?.start || fe.opened_on.value || null, spent_manual: n("bonus_spent"), done: fe.bonus_done.checked } : null;
  const credits = fe.credits.value.split(/\r?\n/).map((l) => l.split("|").map((x) => x.trim())).filter((p) => p[0] && p[1]).map((p) => ({ name: p[0].slice(0, 40), amount: num(p[1]), period: ["year", "quarter", "month"].includes(p[2]) ? p[2] : "year", resets_on: /^\d{4}-\d{2}-\d{2}$/.test(p[3] || "") ? p[3] : null, used: num(p[4], 0) }));
  let bill_id = fe.bill_id.value || null;
  const payFrom = fe.pay_from?.value || null;   // 信用卡从哪个账户还款：写到关联的还款账单上
  const card = { id: old?.id, name, issuer: fe.issuer.value.trim() || null, network: fe.network.value, kind: fe.kind.value, last4: /^\d{4}$/.test(fe.last4.value.trim()) ? fe.last4.value.trim() : null, holder_user_id: fe.holder_user_id.value || null,
    expires_on: fe.expires_on.value ? `${fe.expires_on.value}-01` : null, opened_on: fe.opened_on.value || null, annual_fee: n("annual_fee") ?? 0, balance: fe.kind.value === "gift" ? n("balance") : null, fee_month: n("fee_month"), credit_limit: n("credit_limit"), statement_day: n("statement_day"), due_day: n("due_day"), autopay: fe.autopay.checked,
    bill_id: bill_id === "__new" ? null : bill_id, catalog_id: fe.catalog_id.value || null, rewards, bonus, credits, rules_as_of: fe.rules_as_of.value || (old?.rules_as_of ?? todayISO()), active: fe.active.checked, notes: fe.notes.value.trim() || null };
  const btn = f.querySelector('button[type="submit"]'); btn.disabled = true; err.textContent = "";
  try {
    if (bill_id === "__new") {   // 新建一条「信用卡」类周期账单：到期 / 核对提醒、缴费记录都走账单模块
      const b = { property_id: null, name: t("{name} 还款", { name }), category: "credit_card", direction: "payable", payee: card.issuer || name, account_last4: card.last4, login_hint: null, pay_url: null,
        pay_channel: card.autopay ? "autopay" : "online", amount_type: "variable", typical_amount: null, currency: cur(), frequency: "monthly", interval_months: null, due_day: card.due_day || 1, due_dates: [], next_due_on: null, grace_days: 0, late_fee_note: null,
        autopay: card.autopay, autopay_method: null, autopay_card_expires: card.expires_on, pay_card_id: payFrom, statement_channel: "email", reminder_days: [7, 1], ends_on: null, sub_kind: null, trial_ends_on: null, assigned_to: null, essential: true, active: true, notes: null };
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
export async function deleteCard(id) { await Store.deleteCard(id); await reloadCards(); toast(t("已删除")); go(CARDS_HREF()); }

/* ───────────── AI 起草返现规则（只发卡名；起草结果填进表单，由你核对后保存） ───────────── */
const AI_SYSTEM = [
  "You describe credit card reward structures from memory and return ONLY JSON. Be conservative: if unsure about a number, use null. Never invent bonus categories.",
  'Return {"issuer": string|null, "network": "visa|mastercard|amex|discover|unionpay|other", "annual_fee": number|null, "foreign_fee_pct": number|null, "point_value_cents": number, "base_pct": number, "category_pct": {"grocery":n,"wholesale":n,"dining":n,"gas":n,"travel":n,"online":n,"amazon":n,"drugstore":n,"streaming":n,"utilities":n,"transit":n,"entertainment":n,"home":n}, "merchant_pct": {"merchant keyword lowercase": n}, "rotating": boolean, "notes": string}.',
  "All *_pct values are the cash-back-equivalent percentage AFTER converting points with point_value_cents (e.g. 3 points per $1 at 1.25 cents = 3.75). Include only categories the card actually boosts; omit the rest. rotating = true only for cards with quarterly rotating 5% categories (do not list the current quarter's categories).",
  "notes: one short sentence about important conditions (caps, membership required, activation).",
].join("\n");
export async function aiDraftCard(f) {
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
