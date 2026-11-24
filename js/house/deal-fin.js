/* 交易的付款方式（迁移 110 的 property_deals.financing）对清单的影响（纯函数，不碰页面 / 数据库）。
 *  · 取值：'cash' 现金、'loan' 贷款、空 = 没选（按贷款算，所以已有的交易行为不变）；买入 / 买车 = 我的付款方式，卖出 = 买家的付款方式。
 *  · 模板事项用 when: ["fin:loan"] / ["fin:cash"] 控制显示；已经勾过的事项，付款方式切换后仍然保留。 */
export const isCash = (deal) => deal?.financing === "cash";
/** 条件 "fin:loan" / "fin:cash" 对这笔交易成不成立 */
export function finMatches(cond, deal) {
  const v = String(cond).split(":")[1];
  return v === "cash" ? isCash(deal) : !isCash(deal);
}
/** 哪些交易有「付款方式」这一项：买入、卖出、买车、卖车（退租、租赁归还没有） */
export const hasFinancing = (deal) => ["buy", "sell", "veh_buy", "veh_sell"].includes(deal?.kind);
/** 前置依赖：某个前置步骤在这笔交易里不存在（比如现金交易没有「贷款承诺」）时，换成它自己的前置步骤（一路往前找），后面的步骤才不会失去约束。
 *  raw = { 步骤: [前置步骤…] }，present = 这笔交易里实际有的步骤 key 的集合 */
export function resolveDeps(raw, present) {
  const has = (k) => present.has(k);
  const pre = (k, seen) => (has(k) ? [k] : (raw[k] || []).flatMap((p) => (seen.has(p) ? [] : pre(p, new Set([...seen, k])))));
  const out = {};
  for (const [key, list] of Object.entries(raw)) out[key] = [...new Set(list.flatMap((k) => pre(k, new Set([key]))))];
  return out;
}
