import { STATUS, state } from "./state.js";
import { DAY, MIN_RATE_SPAN_DAYS, RATE_WINDOW_DAYS, STOCK_TARGET_DAYS, du, isGear, num, spaceOf, todayISO } from "./util.js";
import { t } from "./i18n.js";

/* ───────────── 提醒与消耗速度计算 ───────────── */
export function enrich(items, logs) {
  const now = Date.now(), today = todayISO();
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
    const qty = num(it.quantity);
    // 装备：没有消耗速度、少货线和保质期，永远不进提醒
    if (isGear(it)) {
      const f = Units.factor(it.unit);
      return { ...it, qty, min: 0, rate: null, rateSrc: null, daysLeft: null, status: "ok", exp: null, expDays: null,
        suggest: 1, level: qty > 0 ? 1 : 0, minMark: null, du: du(it.unit), dqty: qty * f, drate: null, dsuggest: f };
    }
    const min = num(it.min_quantity), lead = it.lead_days == null ? 3 : num(it.lead_days, 3);
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
    // 标了“不再提醒 / 暂停提醒”的物品：补货状态按正常算（不进注意事项、不计入提醒数、不被“一键加入采购”带上）；临期照常提醒
    const muted = status !== "ok" && !!it.alert_mute_until && String(it.alert_mute_until) > today, rawStatus = status;
    if (muted) status = "ok";

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
    return { ...it, qty, min, rate, rateSrc, daysLeft, status, rawStatus, muted, exp, expDays, suggest, level, minMark,
      du: du(it.unit), dqty: qty * f, drate: rate ? rate * f : null, dsuggest: suggest * f };
  });
}

export const alertsOf = (list) => list.filter((x) => x.status !== "ok").sort((a, b) => STATUS[a.status].rank - STATUS[b.status].rank || (a.daysLeft ?? 0) - (b.daysLeft ?? 0));

/** 提醒总线：储藏与房屋耗材的补货（缺货 = 尽快，少货 / 即将告罄 = 留意）和临期食材（留意） */
export function pantryAlertItems() {
  const items = [];
  const spaces = state.houseEnabled ? ["pantry", "house"] : ["pantry"];
  for (const sp of spaces) {
    for (const it of alertsOf(state.enriched.filter((x) => spaceOf(x.category) === sp))) {
      items.push({ source: sp, severity: it.status === "out" ? 2 : 3, must: false, due: null, daysLeft: it.daysLeft == null ? null : Math.floor(it.daysLeft),
        title: it.name, detail: `${t("剩 {q} {u}", { q: Math.round(it.dqty * 100) / 100, u: t(it.du) })}${it.daysLeft != null && it.qty > 0 ? t("，约够 {d} 天", { d: Math.max(0, Math.floor(it.daysLeft)) }) : ""}`,
        href: null, badge: { label: t(STATUS[it.status].label), cls: STATUS[it.status].cls },
        // 已在采购清单里：按钮换成「已加入采购」标签（点开清单）；从清单删掉后自动变回「加入采购」
        actions: [{ type: "button", action: "edit", id: it.id, label: t("编辑"), cls: "btn-ghost" },
          { type: "button", action: "mute-item", id: it.id, label: t("不再提醒"), cls: "btn-ghost" },
          openShopFor(it.id) ? { type: "tag", href: "#/shopping", label: t("已加入采购"), cls: "b-ok" } : { type: "button", action: "shop-add-item", id: it.id, label: t("加入采购") }] });
    }
  }
  for (const it of state.enriched.filter((x) => x.exp && x.qty > 0 && spaceOf(x.category) === "pantry").sort((a, b) => a.expDays - b.expDays)) {
    items.push({ source: "pantry", severity: it.exp === "expired" ? 2 : 3, must: false, due: it.expiry_date, daysLeft: it.expDays, title: it.name,
      detail: `${it.location ? `${t(it.location)} ` : ""}${t("剩 {q} {u}", { q: Math.round(it.dqty * 100) / 100, u: t(it.du) })}`, href: null,
      badge: { label: it.exp === "expired" ? t("已过期") : it.expDays === 0 ? t("今天到期") : t("{d} 天后到期", { d: it.expDays }), cls: "b-exp" },
      actions: [{ type: "link", href: "#/pantry/meals", label: t("看看能做什么菜"), cls: "btn-ghost" }] });
  }
  return items;
}
export const memberName = (userId) => state.members.find((m) => m.user_id === userId)?.display_name;
export const openShopFor = (itemId) => state.shopping.find((s) => s.item_id === itemId && s.status !== "bought");
// 菜单推荐只看日常储备（食材）里的东西；关键词中英文都有，英文不区分大小写
export const nameHas = (name, kw) => { const n = String(name).toLowerCase(); return kw.some((k) => n.includes(k.toLowerCase())); };
export const hasStock = (kw) => state.enriched.find((it) => it.qty > 0 && spaceOf(it.category) === "pantry" && nameHas(it.name, kw));
