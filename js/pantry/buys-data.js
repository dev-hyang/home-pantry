/* 购买排行的计算（纯函数，没有界面）：把一段时间里的购买记录按物品汇总——买了几次、总数量、花了多少、平均 / 最低单价、最近一次、涨没涨。
 * 只统计「对得上库存物品」的购买：记录带 item_id，或名字能对上某件物品（含别名），或分类就是库存里用到的分类。
 * 负数金额是退款：算进花费（减掉），不算「买了一次」。单价只在同一个单位里比（取这件东西最常用的单位）。 */
import { normName } from "../core/item-match.js";

const pos = (r) => (r.amount != null ? Number(r.amount) > 0 : Number(r.quantity) > 0);
const num = (v) => (v == null || v === "" ? 0 : Number(v) || 0);
const round2 = (v) => Math.round(v * 100) / 100;
const newest = (a, b) => String(b.purchased_at).localeCompare(String(a.purchased_at));

/** rows = 购买记录；items = 库存物品；resolve(name) = 按名字（含别名）找物品；cats = 库存里用到的分类 id；cur = 只算这个币种 */
export function aggregateBuys(rows, { items = [], resolve = () => null, cats = new Set(), cur = null } = {}) {
  const byId = new Map(items.map((i) => [i.id, i])), groups = new Map();
  for (const r of rows || []) {
    if (r.amount == null && !(num(r.quantity) > 0)) continue;
    if (cur && r.currency && r.currency !== cur) continue;
    const it = (r.item_id && byId.get(r.item_id)) || resolve(r.name) || null;
    if (!it && !cats.has(r.category)) continue;
    const key = it ? it.id : `n:${normName(r.name)}`;
    let g = groups.get(key); if (!g) groups.set(key, g = { key, id: it?.id || null, name: it?.name || r.name, category: it?.category || r.category, rows: [] });
    g.rows.push({ ...r, unit: r.unit || it?.unit || "" });
  }
  return [...groups.values()].map(finish).filter((g) => g.n > 0);
}
function finish(g) {
  const rows = g.rows.sort(newest), buys = rows.filter(pos);
  const unitCount = new Map(); for (const r of buys) unitCount.set(r.unit, (unitCount.get(r.unit) || 0) + 1);
  const unit = [...unitCount].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  const priced = buys.filter((r) => r.unit === unit && num(r.quantity) > 0 && num(r.amount) > 0);   // 新 → 旧
  const ups = priced.map((r) => num(r.amount) / num(r.quantity)), sumQ = priced.reduce((a, r) => a + num(r.quantity), 0), sumA = priced.reduce((a, r) => a + num(r.amount), 0);
  const older = ups.slice(1), prevAvg = older.length ? older.reduce((a, b) => a + b, 0) / older.length : null;
  return { ...g, rows, n: buys.length, unit,
    spend: round2(rows.reduce((a, r) => a + num(r.amount), 0)),
    qty: round2(buys.filter((r) => r.unit === unit).reduce((a, r) => a + num(r.quantity), 0)),
    avgUnit: sumQ > 0 ? sumA / sumQ : null, minUnit: ups.length ? Math.min(...ups) : null, lastUnit: ups[0] ?? null,
    change: ups.length >= 2 && prevAvg > 0 ? ups[0] / prevAvg - 1 : null,   // 最近一次单价比之前的平均贵 / 便宜了多少
    lastAt: buys[0]?.purchased_at || rows[0]?.purchased_at || "", lastStore: (buys.find((r) => r.store) || {}).store || "" };
}
export const SORTS = {
  count: (a, b) => b.n - a.n || b.spend - a.spend,
  spend: (a, b) => b.spend - a.spend || b.n - a.n,
  recent: (a, b) => String(b.lastAt).localeCompare(String(a.lastAt)),
  rise: (a, b) => (b.change ?? -9) - (a.change ?? -9),
};
export const sortBuys = (groups, mode) => [...groups].sort(SORTS[mode] || SORTS.count);
export const buysTotals = (groups) => ({ kinds: groups.length, times: groups.reduce((a, g) => a + g.n, 0), spend: round2(groups.reduce((a, g) => a + g.spend, 0)) });
