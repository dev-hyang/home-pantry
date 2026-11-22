/* 从卡 / 账户表单里读出要保存的卡对象（保存和「添加向导」的确认页共用）：只读表单，不碰数据库。 */
import { num, todayISO } from "../core/util.js";
import { state } from "../core/state.js";
import { D } from "./card-common.js";
import { cardById, quarterOf } from "./cards.js";

/** f = #cardForm；返回 { card, bill_id, payFrom, old }：bill_id 可能是 "__new"（要新建还款账单），payFrom = 信用卡从哪个账户还款 */
export function collectCard(f) {
  const fe = f.elements, name = fe.name.value.trim();
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
  const bill_id = fe.bill_id.value || null, payFrom = fe.pay_from?.value || null;   // 信用卡从哪个账户还款：写到关联的还款账单上
  const card = { id: old?.id, name, issuer: fe.issuer.value.trim() || null, network: fe.network.value, kind: fe.kind.value, last4: /^\d{4}$/.test(fe.last4.value.trim()) ? fe.last4.value.trim() : null, holder_person_id: fe.holder_person_id.value || null,
    expires_on: fe.expires_on.value ? `${fe.expires_on.value}-01` : null, opened_on: fe.opened_on.value || null, annual_fee: n("annual_fee") ?? 0, balance: fe.kind.value === "gift" ? n("balance") : null, fee_month: n("fee_month"), credit_limit: n("credit_limit"), statement_day: n("statement_day"), due_day: n("due_day"), autopay: fe.autopay.checked,
    bill_id: bill_id === "__new" ? null : bill_id, catalog_id: fe.catalog_id.value || null, rewards, bonus, credits, rules_as_of: fe.rules_as_of.value || (old?.rules_as_of ?? todayISO()), active: fe.active.checked, notes: fe.notes.value.trim() || null,
    inactive_since: fe.active.checked ? null : (old?.active === false ? old.inactive_since || null : todayISO()) };   // 刚取消「在用」：记今天为停用日期
  return { card, bill_id, payFrom, old };
}
