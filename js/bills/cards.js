/* 信用卡（用卡：该刷哪张）：数据、推荐算法、提醒。界面在 cards-views.js，设计见 docs/design-cards.md。
 * 卡画像（rewards）全是「% 返现等价」：{ base, cats: {奖励类别: %}, caps: {类别|"*": {limit, period, then}}, rotating: [{from,to,cats,rate,cap,activated}], merchants: {关键词: %}, point_value, foreign_fee }。
 * 推荐 = 每张卡在这个场景的有效返现率排序：轮换类别（已激活、未封顶）> 特定商家 > 类别 > base；境外减手续费；
 *   开卡奖励没刷满的卡加上「边际价值」（奖励价值 ÷ 还差的金额），自然排到前面；商家不收的网络直接排除；快到期 / 该还款的给警告。 */
import { state } from "../core/state.js";
import { Store } from "../core/store.js";
import { daysUntil, num, todayISO } from "../core/util.js";
import { t } from "../core/i18n.js";
import { href } from "../core/router.js";
import { registerAlerts } from "../core/alerts.js";
import { memberName } from "../core/logic.js";

const D = () => window.CARDS;
export const CARDS_HREF = () => href("bills", "cards");
export const cardHref = (id) => `${CARDS_HREF()}?card=${id || "new"}`;
const r2 = (v) => Math.round(v * 100) / 100;
export const holderName = (c) => (c.holder_user_id ? memberName(c.holder_user_id) || t("家人") : t("共用"));
export const networkName = (n) => D().NETWORKS[n] || n || "";
export const rewardCatName = (id) => { const x = D().REWARD_CATS.find((r) => r[0] === id); return x ? t(x[1]) : id; };
export const rewardCatIcon = (id) => (D().REWARD_CATS.find((r) => r[0] === id) || [])[2] || "";

/* ───────────── 季度轮换 ───────────── */
export const quarterOf = (d = todayISO()) => { const y = +d.slice(0, 4), q = Math.floor((+d.slice(5, 7) - 1) / 3); return { y, q, from: `${y}-${String(q * 3 + 1).padStart(2, "0")}-01`, to: `${y}-${String(q * 3 + 3).padStart(2, "0")}-${q === 0 || q === 3 ? "31" : "30"}`, label: `${y} Q${q + 1}` }; };
/** 这张卡当前季度的轮换条目（没有就返回 null；有轮换机制但本季没填返回 { empty: true }） */
export function rotatingNow(c, day = todayISO()) {
  const list = c.rewards?.rotating; if (!Array.isArray(list) && !c.rewards?.has_rotating) return null;
  const hit = (list || []).find((x) => x.from <= day && day <= x.to);
  if (hit && (hit.cats || []).length) return hit;   // 填了类别才算；只建了条目没填类别 = 还没填
  return c.rewards?.has_rotating ? { empty: true, ...quarterOf(day) } : null;
}

/* ───────────── 从目录建卡 ───────────── */
export function fromCatalog(id) {
  const k = D().catalogOf(id); if (!k) return null;
  return { name: k.name, issuer: k.issuer, network: k.network, kind: "credit", annual_fee: k.annual_fee, catalog_id: k.id, rules_as_of: k.as_of, active: true,
    rewards: { base: k.base, cats: { ...k.cats }, caps: { ...k.caps }, merchants: { ...k.merchants }, point_value: k.point_value, foreign_fee: k.foreign_fee, has_rotating: !!k.rotating, rotating_cap: k.rotating_cap || null, rotating: [] }, credits: [], notes: k.note || "" };
}

/* ───────────── 推荐 ───────────── */
const feeDays = (c, day = todayISO()) => {   // 距下次年费多少天
  if (!num(c.annual_fee)) return null;
  const m = c.fee_month || (c.opened_on ? +c.opened_on.slice(5, 7) : null); if (!m) return null;
  const y = +day.slice(0, 4), cand = `${y}-${String(m).padStart(2, "0")}-01`;
  return daysUntil(cand >= day ? cand : `${y + 1}-${String(m).padStart(2, "0")}-01`);
};
const expDays = (c) => (c.expires_on ? daysUntil(endOfMonth(c.expires_on)) : null);
const endOfMonth = (d) => { const y = +d.slice(0, 4), m = +d.slice(5, 7); return `${y}-${String(m).padStart(2, "0")}-${new Date(y, m, 0).getDate()}`; };
const dueDays = (c, day = todayISO()) => {   // 距下次还款日（没关联账单时按 due_day 粗算）
  const b = c.bill_id && state.billsEnriched.find((x) => x.id === c.bill_id);
  if (b?.next_due_on) return daysUntil(b.next_due_on);
  if (!c.due_day) return null;
  const y = +day.slice(0, 4), m = +day.slice(5, 7), mk = (yy, mm) => `${yy}-${String(mm).padStart(2, "0")}-${String(Math.min(c.due_day, new Date(yy, mm, 0).getDate())).padStart(2, "0")}`;
  const cand = mk(y, m); return daysUntil(cand >= day ? cand : (m === 12 ? mk(y + 1, 1) : mk(y, m + 1)));
};
/* ───────────── 用量：开卡奖励 / 封顶进度（从记到这张卡的花费自动累计，也可手填覆盖） ───────────── */
const windowOf = (period, day) => {   // 封顶周期的起止
  const y = +day.slice(0, 4), m = +day.slice(5, 7);
  if (period === "month") return [`${y}-${String(m).padStart(2, "0")}-01`, `${y}-${String(m).padStart(2, "0")}-31`];
  if (period === "quarter") { const q = quarterOf(day); return [q.from, q.to]; }
  return [`${y}-01-01`, `${y}-12-31`];
};
const spentOn = (c, from, to, pred = () => true) => state.purchases.filter((p) => p.card_id === c.id && p.amount != null && !p.virtual && String(p.purchased_at).slice(0, 10) >= from && String(p.purchased_at).slice(0, 10) <= to && pred(p))
  .reduce((sum, p) => sum + num(p.amount), 0);
/** { bonusSpent, cap(cat) → 已用, rotUsed } */
export function usage(c, day = todayISO()) {
  const D2 = D(), cats = Object.keys(c.rewards?.cats || {}), rc = (p) => D2.rewardCatOf(p.category, p.store);
  return {
    bonusSpent: c.bonus?.spend ? r2(spentOn(c, c.bonus.start || c.opened_on || "2000-01-01", c.bonus.by || "9999-12-31")) : 0,
    cap: (cat) => { const cap = c.rewards?.caps?.[cat] || c.rewards?.caps?.["*"]; if (!cap?.limit) return 0;
      const manual = c.rewards?.cap_used?.[cat] ?? c.rewards?.cap_used?.["*"]; if (manual != null && manual !== "") return num(manual);
      const [a, b] = windowOf(cap.period || "year", day); const star = !c.rewards?.caps?.[cat];
      return r2(spentOn(c, a, b, (p) => (star ? cats.includes(rc(p)) : rc(p) === cat))); },
    rotUsed: () => { const q = quarterOf(day), rot = rotatingNow(c, day); if (!rot || rot.empty) return 0; return r2(spentOn(c, q.from, q.to, (p) => (rot.cats || []).includes(rc(p)))); },
  };
}
const bonusLeft = (c) => { const b = c.bonus; if (!b || b.done || !b.spend || !b.by || b.by < todayISO()) return null; const spent = num(b.spent_manual ?? usage(c).bonusSpent, 0); return { left: Math.max(0, num(b.spend) - spent), spent, days: daysUntil(b.by), value: num(b.reward_value), label: b.label || "" }; };
const capLeft = (c, cat) => {   // 封顶还剩多少；"*" = 所有奖励类别共享；cat === "rotating" = 本季轮换类别的封顶
  if (cat === "rotating") { const rot = rotatingNow(c), lim = num(rot?.cap ?? c.rewards?.rotating_cap, 0); if (!lim) return null; return { left: Math.max(0, lim - usage(c).rotUsed()), limit: lim, then: c.rewards?.base ?? 1, period: "quarter" }; }
  const cap = c.rewards?.caps?.[cat] || c.rewards?.caps?.["*"]; if (!cap?.limit) return null;
  const used = usage(c).cap(cat);
  return { left: Math.max(0, num(cap.limit) - used), limit: num(cap.limit), then: cap.then ?? c.rewards?.base ?? 1, period: cap.period || "year" };
};

/** 一张卡在一个场景的有效返现：{ rate, eff, reason, warns, excluded, bonusPush, cash }；opts.plain = 复盘用（不看封顶进度、不加开卡奖励、不出警告） */
export function evalCard(c, { rewardCat = "other", merchant = "", amount = null, abroad = false, day = todayISO(), plain = false } = {}) {
  const m = String(merchant || "").toLowerCase(), rule = D().MERCHANT_NETWORKS.find((x) => x.re.test(m));
  const rw = c.rewards || {}, warns = [], why = [];
  let rate = num(rw.base, 0), src = "base";
  const cat = rw.cats?.[rewardCat];
  if (cat != null) { rate = num(cat); src = "cat"; }
  const mk = Object.entries(rw.merchants || {}).find(([k]) => m && m.includes(String(k).toLowerCase()));
  if (mk && num(mk[1]) > rate) { rate = num(mk[1]); src = "merchant"; why.push(t("{m} {r}%", { m: mk[0], r: rate })); }
  const rot = rotatingNow(c, day);
  if (rot && !rot.empty && (rot.cats || []).includes(rewardCat) && num(rot.rate) > rate) {
    rate = num(rot.rate); src = "rotating";
    if (!rot.activated && !plain) warns.push(t("本季 5% 类别还没激活，先去发卡行激活"));
  }
  if (rot?.empty && !plain) warns.push(t("本季轮换类别还没填（{q}）", { q: rot.label }));
  if (!plain && (src === "cat" || src === "rotating")) {
    const cl = capLeft(c, src === "rotating" ? "rotating" : rewardCat);
    if (cl && cl.left <= 0) { why.push(t("{cat} 已封顶，按 {r}%", { cat: rewardCatName(rewardCat), r: cl.then })); rate = num(cl.then); src = "capped"; }
    else if (cl && amount && amount > cl.left) warns.push(t("封顶只剩 {a}，超出部分按 {r}%", { a: Units.money(cl.left), r: cl.then }));
    else if (cl && cl.left < cl.limit) why.push(t("封顶还剩 {a}", { a: Units.money(cl.left) }));
  }
  if (src === "cat") why.unshift(t("{cat} {r}%", { cat: rewardCatName(rewardCat), r: rate }));
  else if (src === "rotating") why.unshift(t("本季轮换 {r}%", { r: rate }));
  else if (src === "base") why.unshift(t("所有消费 {r}%", { r: rate }));
  if (abroad && num(rw.foreign_fee) > 0) { rate -= num(rw.foreign_fee); why.push(t("境外手续费 −{f}%", { f: rw.foreign_fee })); }
  let bonusPush = 0;
  if (!plain) {
    const bl = bonusLeft(c);
    if (bl && bl.left > 0 && bl.value > 0) { bonusPush = r2(bl.value / bl.left * 100); why.push(t("开卡奖励还差 {a}（{d} 天内），刷满得 {v}", { a: Units.money(bl.left), d: bl.days, v: bl.label || Units.money(bl.value) })); }
    const ed = expDays(c); if (ed != null && ed < 0) warns.push(t("已过期")); else if (ed != null && ed <= 30) warns.push(t("{d} 天后到期，确认新卡到了再用", { d: ed }));
    const dd = dueDays(c, day); if (dd != null && dd >= 0 && dd <= 3 && !c.autopay) warns.push(t("{d} 天内要还款", { d: dd }));
  }
  const ed2 = expDays(c), excluded = rule && !rule.accepts.includes(c.network) ? t(rule.note) : (!plain && ed2 != null && ed2 < 0 ? t("已过期") : "");
  return { card: c, rate: r2(rate), eff: r2(rate + bonusPush), bonusPush, reason: why.join(" · "), warns, excluded, cash: amount ? r2(amount * (rate + bonusPush) / 100) : null };
}
/** 输入 { rewardCat, merchant, amount, abroad, day } → 每张在用的卡的评估，按有效返现率排序 */
export function pickCards(ctx = {}) {
  return state.cards.filter((x) => x.active !== false).map((c) => evalCard(c, ctx))
    .sort((a, b) => (a.excluded ? 1 : 0) - (b.excluded ? 1 : 0) || b.eff - a.eff);
}
/** 给花费分类 + 商店直接推荐（采购清单、补记花费用） */
export const pickFor = (category, store, amount) => pickCards({ rewardCat: D().rewardCatOf(category, store), merchant: store, amount });

/* ───────────── 复盘：某个月记到各张卡上的花费，估算返现 vs 用最优卡能返多少 ───────────── */
export function reviewMonth(month) {
  const cards = state.cards.filter((c) => c.active !== false || state.purchases.some((p) => p.card_id === c.id));
  const list = state.purchases.filter((p) => !p.virtual && p.amount != null && num(p.amount) > 0 && String(p.purchased_at).slice(0, 7) === month && (!p.currency || p.currency === Units.region.currency));
  const per = new Map(), misses = []; let tagged = 0, untagged = 0, untaggedN = 0, earned = 0, optimal = 0;
  const live = state.cards.filter((c) => c.active !== false);
  for (const p of list) {
    const card = p.card_id && cards.find((c) => c.id === p.card_id);
    if (!card) { untagged += num(p.amount); untaggedN++; continue; }
    const ctx = { rewardCat: D().rewardCatOf(p.category, p.store), merchant: p.store || p.name, amount: num(p.amount), day: String(p.purchased_at).slice(0, 10), plain: true };
    const got = evalCard(card, ctx), best = live.map((c) => evalCard(c, ctx)).filter((x) => !x.excluded).sort((a, b) => b.rate - a.rate)[0] || got;
    const cash = r2(num(p.amount) * got.rate / 100), bestCash = r2(num(p.amount) * Math.max(best.rate, got.rate) / 100);
    tagged += num(p.amount); earned += cash; optimal += bestCash;
    const row = per.get(card.id) || { card, spend: 0, cash: 0, n: 0 }; row.spend += num(p.amount); row.cash += cash; row.n++; per.set(card.id, row);
    if (bestCash - cash >= 0.5) misses.push({ p, used: card, best: best.card, gain: r2(bestCash - cash), rate: got.rate, bestRate: best.rate });
  }
  return { rows: [...per.values()].sort((a, b) => b.spend - a.spend).map((r) => ({ ...r, spend: r2(r.spend), cash: r2(r.cash) })), tagged: r2(tagged), untagged: r2(untagged), untaggedN, earned: r2(earned), optimal: r2(optimal), gap: r2(optimal - earned), misses: misses.sort((a, b) => b.gain - a.gain).slice(0, 8) };
}

/* ───────────── 提醒（接提醒总线，source = card） ───────────── */
function cardAlertItems() {
  if (!state.billsEnabled || !state.cards?.length) return [];
  const out = [], link = CARDS_HREF();
  const mk = (c, severity, title, detail, label, cls, due = null, daysLeft = null) => out.push({ source: "card", severity, must: severity <= 1, due, daysLeft, title: `💳 ${title}`, detail, href: cardHref(c.id),
    badge: { label, cls }, actions: [{ type: "link", href: cardHref(c.id), label: t("看这张卡"), cls: "btn-ghost" }] });
  const today = todayISO(), q = quarterOf(today);
  for (const c of state.cards) {
    if (c.active === false) continue;
    const ed = expDays(c);
    if (ed != null && ed < 0) mk(c, 0, t("{name} 已过期", { name: c.name }), t("新卡到了就把到期年月改掉；旧卡剪掉"), t("已过期"), "b-out", endOfMonth(c.expires_on), ed);
    else if (ed != null && ed <= 60) mk(c, ed <= 30 ? 2 : 3, t("{name} {d} 天后到期", { name: c.name, d: ed }), t("发卡行一般会提前寄新卡；收到后更新到期年月"), t("快到期"), ed <= 30 ? "b-soon" : "b-ok", endOfMonth(c.expires_on), ed);
    const fd = feeDays(c, today);
    if (fd != null && fd <= 30) mk(c, 3, t("{name} 年费 {a} 下月收", { name: c.name, a: Units.money(num(c.annual_fee)) }), t("想想这一年返现和报销有没有超过年费；不值得就在收费前降级或关卡"), t("年费"), "b-ok", null, fd);
    const rot = rotatingNow(c, today);
    if (rot?.empty) mk(c, 3, t("{name} 本季（{q}）5% 类别还没填", { name: c.name, q: q.label }), t("到发卡行看本季类别，填进卡里并激活"), t("轮换"), "b-soon", null, daysUntil(q.to));
    else if (rot && !rot.activated && num(rot.rate) > 0) mk(c, 2, t("{name} 本季 5% 类别还没激活", { name: c.name }), (rot.cats || []).map(rewardCatName).join(" / "), t("去激活"), "b-soon", null, daysUntil(rot.to));
    const bl = bonusLeft(c);
    if (bl && bl.left > 0 && bl.days <= 30) mk(c, bl.days <= 7 ? 1 : bl.days <= 14 ? 2 : 3, t("{name} 开卡奖励还差 {a}", { name: c.name, a: Units.money(bl.left) }), t("{d} 天内刷满得 {v}；大额支出优先用它", { d: bl.days, v: bl.label || Units.money(bl.value) }), t("{d} 天", { d: bl.days }), bl.days <= 7 ? "b-out" : "b-soon", c.bonus.by, bl.days);
    for (const cr of c.credits || []) { const left = num(cr.amount) - num(cr.used); const dl = cr.resets_on ? daysUntil(cr.resets_on) : null; if (left > 0 && dl != null && dl >= 0 && dl <= 30) mk(c, 3, t("{name}：{cr} 还有 {a} 没用", { name: c.name, cr: cr.name, a: Units.money(left) }), t("{d} 天后清零", { d: dl }), t("报销"), "b-ok", cr.resets_on, dl); }
  }
  return out;
}
registerAlerts(cardAlertItems);

/* ───────────── 读写 ───────────── */
export async function reloadCards() { state.cards = await Store.listCards().catch(() => state.cards || []); }
export const cardById = (id) => state.cards.find((c) => c.id === id);
export { expDays, feeDays, dueDays, bonusLeft };
