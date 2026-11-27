/* 购买排行 · 特价命中：常买的物品（近 90 天买过 2 次以上）里，现在有特价的。
 * 特价来自「常去的商店」里还在有效期的 shop_deals（和购物车同一套对法 dealsFor：名称、别名、品牌）；
 * 好价 = 特价比原价便宜 20% 以上，或单价比自己的平均单价低 10% 以上（单位对得上才比）。
 * 也在这里拼「问咩咩：该趁打折囤什么」的提问上下文。 */
import { state } from "../core/state.js";
import { money } from "../core/util.js";
import { t } from "../core/i18n.js";
import { dealsFor } from "../shops/deals-logic.js";
import { shopName, unitMoney } from "../shops/lite.js";

export const MIN_BUYS = 2;   // 买过几次才算「常买」
const unitKey = (s) => String(s || "").replace(/^\//, "").trim().toLowerCase();
/** 一组购买汇总的最优特价：{ deal, shop, off, vsAvg, good }；没有（或不常买）返回 null */
export function dealOf(g) {
  if (!g || g.n < MIN_BUYS) return null;
  const best = dealsFor({ name: g.name, item_id: g.id })[0]; if (!best) return null;
  const off = best.regular_price > 0 && best.price != null ? 1 - best.price / best.regular_price : null;
  const vsAvg = best.unit_price != null && g.avgUnit > 0 && unitKey(best.unit_label) === unitKey(g.unit) ? best.unit_price / g.avgUnit - 1 : null;
  return { deal: best, shop: shopName(best.shop_id), off, vsAvg, good: (off != null && off >= 0.2) || (vsAvg != null && vsAvg <= -0.1) };
}
/** 带特价的排前面（好价先，再按便宜多少、买得多不多），没有特价的跟在后面按次数 */
export function dealsSort(groups) {
  const wrap = groups.map((g) => ({ g, d: dealOf(g) }));
  const score = (x) => (x.d ? (x.d.good ? 2 : 1) : 0);
  return wrap.sort((a, b) => score(b) - score(a) || Math.max(b.d?.off ?? 0, -(b.d?.vsAvg ?? 0)) - Math.max(a.d?.off ?? 0, -(a.d?.vsAvg ?? 0)) || b.g.n - a.g.n).map((x) => x.g);
}
export const dealCount = (groups) => groups.filter((g) => dealOf(g)).length;
/** 特价那一行的文字：「Jewel $2.99（原价 $4.99，省 40%）」 */
export function dealText(d) {
  const p = d.deal.price != null ? money(d.deal.price) : d.deal.price_text || "";
  const was = d.deal.regular_price > 0 && d.deal.price != null ? `${t("原价 {m}", { m: money(d.deal.regular_price) })}${d.off > 0 ? `，${t("省 {p}%", { p: Math.round(d.off * 100) })}` : ""}` : "";
  const unit = d.deal.unit_price != null && d.deal.unit_label ? ` · ${unitMoney(d.deal.unit_price)} ${d.deal.unit_label}` : "";
  return `${d.shop} ${p}${was ? `（${was}）` : ""}${unit}`;
}
/** 问咩咩的上下文：最多 12 件常买物品，带次数、均价（有财务权限才带）、库存约够几天、现在的特价 */
export function stockContext(groups, days, fin) {
  const byId = new Map((state.enriched || []).map((i) => [i.id, i]));
  const lines = groups.filter((g) => g.n >= MIN_BUYS).slice(0, 12).map((g) => {
    const it = byId.get(g.id), d = dealOf(g);
    return [g.name, t("近 {d} 天买 {n} 次", { d: days, n: g.n }), fin && g.avgUnit != null ? t("均价 {a} / {u}", { a: money(g.avgUnit), u: t(g.unit) }) : "",
      it ? (it.daysLeft != null && it.qty > 0 ? t("库存约够 {d} 天", { d: Math.max(0, Math.floor(it.daysLeft)) }) : it.qty <= 0 ? t("库存已用完") : "") : "", d ? t("现特价：{s}", { s: dealText(d) }) : ""].filter(Boolean).join("，");
  });
  return [t("家庭人数 {n}", { n: state.members?.length || 1 }), ...lines];
}
