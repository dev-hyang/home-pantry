import { STATUS, state } from "./state.js";
import { DAY, MIN_RATE_SPAN_DAYS, RATE_WINDOW_DAYS, STOCK_TARGET_DAYS, du, num, spaceOf } from "./util.js";

/* ───────────── 提醒与消耗速度计算 ───────────── */
export function enrich(items, logs) {
  const now = Date.now();
  const usage = {};
  const rateSince = now - RATE_WINDOW_DAYS * DAY;
  for (const l of logs) {
    if (l.reason !== "consume" || num(l.delta) >= 0) continue;
    const t = new Date(l.created_at).getTime();
    if (t < rateSince) continue;
    const u = (usage[l.item_id] ||= { sum: 0, first: t });
    u.sum += -num(l.delta);
    u.first = Math.min(u.first, t);
  }
  return items.map((it) => {
    const qty = num(it.quantity), min = num(it.min_quantity), lead = it.lead_days == null ? 3 : num(it.lead_days, 3);
    let rate = null, rateSrc = null;
    if (num(it.avg_daily_use) > 0) { rate = num(it.avg_daily_use); rateSrc = "manual"; }
    else if (usage[it.id]) {
      const span = Math.max(MIN_RATE_SPAN_DAYS, (now - usage[it.id].first) / DAY);
      rate = usage[it.id].sum / span; rateSrc = "auto";
    }
    const daysLeft = rate > 0 ? qty / rate : null;
    let status = "ok";
    if (qty <= 0) status = "out";
    else if (min > 0 && qty <= min) status = "low";
    else if (daysLeft != null && daysLeft <= lead) status = "soon";

    let exp = null, expDays = null;
    if (it.expiry_date) {
      expDays = Math.ceil((new Date(it.expiry_date + "T23:59:59").getTime() - now) / DAY);
      if (expDays < 0) exp = "expired"; else if (expDays <= 3) exp = "expiring";
    }
    const target = Math.max(min * 2, rate ? rate * STOCK_TARGET_DAYS : 0, 1);
    const suggest = Math.max(1, Math.ceil(target - qty));
    const cap = Math.max(min * 3, rate ? rate * 21 : 0, 1);
    const level = Math.min(1, qty / cap);
    const minMark = min > 0 ? Math.min(1, min / cap) : null;
    const f = Units.factor(it.unit);
    return { ...it, qty, min, rate, rateSrc, daysLeft, status, exp, expDays, suggest, level, minMark,
      du: du(it.unit), dqty: qty * f, drate: rate ? rate * f : null, dsuggest: suggest * f };
  });
}

export const alertsOf = (list) => list.filter((x) => x.status !== "ok").sort((a, b) => STATUS[a.status].rank - STATUS[b.status].rank || (a.daysLeft ?? 0) - (b.daysLeft ?? 0));
export const memberName = (userId) => state.members.find((m) => m.user_id === userId)?.display_name;
export const openShopFor = (itemId) => state.shopping.find((s) => s.item_id === itemId && s.status !== "bought");
// 菜单推荐只看厨房储藏里的东西
export const hasStock = (kw) => state.enriched.find((it) => it.qty > 0 && spaceOf(it.category) === "pantry" && kw.some((k) => it.name.includes(k)));
