/* 用卡复盘（各卡花了多少、返现估算）和「现在该刷哪张」。 */
import { numAttrs } from "../core/ui-num.js";
import { askInline } from "../core/ask.js";
import { cardMonths, isBankAcct, pickCards, pickFor, reviewMonth, rewardCatName } from "./cards.js";
import { esc, money, num } from "../core/util.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";
import { D, cur, d } from "./card-common.js";

/* ───────────── 复盘：各卡花了多少、返现估算、用最优卡能多赚多少 ───────────── */
export function reviewHtml() {
  const months = cardMonths();   // 有记到卡上的花费的月份（card_totals）
  if (!months) return `<div class="panel"><h3 style="font-size:15px;margin:0 0 4px">${t("返现复盘")}</h3><p class="muted" role="status" style="margin:0">${t("加载中…")}</p></div>`;
  if (!months.length) return `<div class="panel"><h3 style="font-size:15px;margin:0 0 4px">${t("返现复盘")}</h3><p class="muted" style="margin:0;font-size:13px">${t("记花费、采购「已买到」、银行导入时选一下用的哪张卡，这里就会算出每张卡花了多少、估算返现，以及用对卡本来能多赚多少。")}</p></div>`;
  const cur0 = state.cardReviewMonth && months.includes(state.cardReviewMonth) ? state.cardReviewMonth : months[0], r = reviewMonth(cur0);
  if (!r) return `<div class="panel card-review"><h3 style="font-size:15px;margin:0 0 4px">${t("返现复盘")}</h3><p class="muted" role="status" style="margin:0">${t("加载中…")}</p></div>`;   // 那个月的花费还在读
  return `<div class="panel card-review"><div class="head-row" style="align-items:center;margin-bottom:6px"><h3 style="font-size:15px;margin:0;flex:1">${t("返现复盘")}</h3>
      <select id="cardReviewMonth" aria-label="${esc(t("选择月份"))}" style="width:auto">${months.map((m) => `<option value="${m}" ${m === cur0 ? "selected" : ""}>${m}</option>`).join("")}</select></div>
    <div class="kpis"><div class="kpi"><span>${t("记到卡上的花费")}</span><b>${money(r.tagged)}</b></div><div class="kpi"><span>${t("估算返现")}</span><b>${money(r.earned)}</b></div>
      <div class="kpi"><span>${t("用最优卡能返")}</span><b>${money(r.optimal)}</b><small>${r.gap >= 0.5 ? t("多赚 {a}", { a: money(r.gap) }) : t("基本用对了 👍")}</small></div></div>
    <ul class="restock-list">${r.rows.map((x) => `<li><div class="grow"><span class="name">${d(x.card.name)}</span><small>${t("{n} 笔", { n: x.n })} · ${money(x.spend)}</small></div><b class="num">${money(x.cash)}</b></li>`).join("")}</ul>
    ${r.misses.length ? `<h4 style="margin:10px 0 4px;font-size:13.5px">${t("本可以多赚的几笔")}</h4><ul class="restock-list">${r.misses.map((m) => `<li><div class="grow"><span class="name">${d(m.p.name)}</span><small>${esc(String(m.p.purchased_at).slice(0, 10))} · ${money(num(m.p.amount))} · ${t("用了 {a}（{ra}%），{b} 是 {rb}%", { a: m.used.name, ra: m.rate, b: m.best.name, rb: m.bestRate })}</small></div><b class="num" style="color:var(--pine)">+${money(m.gain)}</b></li>`).join("")}</ul>` : ""}
    ${r.untaggedN ? `<p class="muted" style="margin:8px 0 0;font-size:12.5px">${t("这个月还有 {n} 笔（{a}）没记哪张卡，没算进去。", { n: r.untaggedN, a: money(r.untagged) })}</p>` : ""}
    <p class="muted" style="margin:6px 0 0;font-size:12px">${t("按各卡当前的返现规则估算（不含封顶、开卡奖励、积分兑换差异），仅供参考；实际以发卡行为准。")}</p></div>`;
}
/* ───────────── 现在该刷哪张 ───────────── */
export function pickPanel() {
  const p = state.cardPick;
  const cats = D().REWARD_CATS.map(([id, name, icon]) => `<option value="${id}" ${p.cat === id ? "selected" : ""}>${icon} ${esc(t(name))}</option>`).join("");
  return `<form id="cardPickForm" class="panel card-pick" onsubmit="return false">
    <div class="form-grid pick-grid">
      <label>${t("买什么")}<select name="cat">${cats}</select></label>
      <label>${t("在哪买（可不填）")}<input name="merchant" maxlength="40" list="storeList" value="${d(p.merchant)}" placeholder="${esc(t("Costco / Amazon / 餐厅名…"))}"></label>
      <label>${t("金额（可不填）")}<input name="amount" ${numAttrs("money")} value="${d(p.amount)}" placeholder="${esc(cur())}"></label>
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
      <b>${d(x.card.name)}</b>${x.card.last4 ? ` <span class="muted">**${d(x.card.last4)}</span>` : ""}<small>${esc(x.reason)}</small>
      ${x.warns.length ? `<div class="pick-warn">⚠️ ${x.warns.map(esc).join("；")}</div>` : ""}</div>`).join("")}</div>
    ${ex.length ? `<p class="muted" style="margin:6px 0 0;font-size:12.5px">${t("不能用：")}${ex.map((x) => `${esc(x.card.name)}（${esc(x.excluded)}）`).join("、")}</p>` : ""}`;
}
/** 购物车 / 补记花费旁的一行建议：按花费分类 + 商店 */
export function cardHintHtml(category, store, amount) {
  if (!state.billsEnabled || !state.cards.some((c) => c.active !== false)) return "";
  if (!category || category === "other") category = "grocery_misc";   // 购物车里没分类的大多是买菜
  const list = pickFor(category, store, amount).filter((x) => !x.excluded); if (!list.length) return "";
  const x = list[0];
  return `<span class="card-hint" title="${esc(x.reason)}">💳 ${t("建议用 {card}（{r}%）", { card: esc(x.card.name), r: x.eff })}${x.warns.length ? ` ⚠️` : ""}</span>`;
}
