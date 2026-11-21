/* 记花费时选哪张卡（补记 / 编辑 / 采购已买到 / 银行导入）：下拉、提示、付款账户。 */
import { ACCT_KINDS } from "./cards.js";
import { esc } from "../core/util.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";

/* ───────────── 记花费时选哪张卡（补记 / 编辑 / 采购已买到 / 银行导入共用） ───────────── */
const LAST_CARD = "hmh-last-card";
export const lastCard = () => { try { return localStorage.getItem(LAST_CARD) || ""; } catch { return ""; } };
export const rememberCard = (id) => { try { localStorage.setItem(LAST_CARD, id || ""); } catch { /* 忽略 */ } };
export const acctById = (id) => (id ? state.cards.find((c) => c.id === id) : null);
/** 「Chase Freedom **0934」：下拉 / 选项里不放图标（种类已经在分组名里） */
export const acctLabel = (c) => `${c.name}${c.last4 ? ` **${c.last4}` : ""}`;
/** 付款账户下拉（账单扣款 / 缴费记录 / 一次性账单付款 / 记花费共用）：卡和账户按种类分组；extra = 现金、其他这类额外选项 [[value, label]]；exclude = 不列这张卡 */
export function accountOptions(selected, { none = "（未指定）", extra = [], exclude = "", kinds = null } = {}) {
  const sel = selected || "";
  const list = state.cards.filter((c) => (c.active !== false || c.id === sel) && c.id !== exclude && (!kinds || kinds.includes(c.kind || "credit")));
  const opt = (v, label) => `<option value="${esc(v)}" ${v === sel ? "selected" : ""}>${esc(label)}</option>`;
  const groups = Object.entries(ACCT_KINDS).map(([k, [name]]) => { const cs = list.filter((c) => (c.kind || "credit") === k); return cs.length ? `<optgroup label="${esc(t(name))}">${cs.map((c) => opt(c.id, `${c.name}${c.last4 ? ` **${c.last4}` : ""}`)).join("")}</optgroup>` : ""; }).join("");
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
  const c = acctById(value); return c ? { card_id: c.id, method: `${c.name}${c.last4 ? ` **${c.last4}` : ""}`.slice(0, 40) } : { card_id: null, method: (text || "").trim().slice(0, 40) || null };
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
export const payAcctLabel = (cardId, text) => { const c = acctById(cardId); return c ? acctLabel(c) : text ? t(text).replace(/•+/g, "**") : ""; };   // 以前存的文字里尾号前是两个圆点，显示时统一成 **
export const billPayLabel = (b) => payAcctLabel(b.pay_card_id, b.autopay_method);
export const paymentPayLabel = (p) => payAcctLabel(p.card_id, p.method);
/** 付款账户下拉里「其他（手填）」对应的说明框：选了其他才显示 */
export const payAcctSelectHtml = (name, value, { extra = PAY_EXTRA, none = "（未指定）", exclude = "" } = {}) => `<select name="${name}" data-pay-acct>${accountOptions(value, { none, extra, exclude })}</select>`;
