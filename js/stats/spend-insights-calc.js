/* 花费概览的「最近动态」卡片的计算（纯函数）：rows = 最近两个月的花费明细（spend_page 读回来的行，和明细页同一批数据）。
 * 转账（is_xfer）和没填金额的不算；金额 < 0 是退款，会减掉。日期按浏览器本地时区。
 *   last7 / prev7   近 7 天（含今天）和再往前 7 天的合计
 *   topDay          本月花得最多的一天
 *   biggest         本月金额最大的一笔
 *   topStore        本月花得最多的收款方
 *   rising          本月至今比上月同期多花得最多的二级分类 */
import { l2Of } from "../core/taxonomy.js";
import { dayISO } from "./spend-days.js";

/** 和 store-lite-common.js 的 storeKey 同一个规则（那边会带进整串页面依赖，这里只要一行，纯函数好测） */
const storeKey = (v) => (v || "").trim().toLowerCase();
/** 行上的商店名：本地版是 store_txt（账单没填商店时用收款方），数据库版是 store */
const storeOfRow = (r) => String(r.store_txt || r.store || "").trim();
const num = (v) => Number(v) || 0;
const round2 = (v) => Math.round(v * 100) / 100;
const ymOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
/** 一行的有效金额；转账 / 没金额返回 null */
const amt = (r) => (r.is_xfer || r.amount == null ? null : num(r.amount));
const max = (arr, f) => arr.reduce((b, x) => (b == null || f(x) > f(b) ? x : b), null);

export function insights(rows, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()), cur = ymOf(today), prev = ymOf(new Date(today.getFullYear(), today.getMonth() - 1, 1));
  const day = (n) => dayISO(new Date(today.getFullYear(), today.getMonth(), today.getDate() - n));
  const d7 = day(6), p7a = day(13), p7b = day(7);
  const list = (rows || []).map((r) => ({ r, a: amt(r), at: new Date(r.purchased_at) })).filter((x) => x.a != null && !Number.isNaN(x.at.getTime())).map((x) => ({ ...x, day: dayISO(x.at), ym: ymOf(x.at) }));
  const sumOf = (xs) => round2(xs.reduce((s, x) => s + x.a, 0));
  const last7 = list.filter((x) => x.day >= d7 && x.day <= day(0)), prev7 = list.filter((x) => x.day >= p7a && x.day <= p7b);
  const month = list.filter((x) => x.ym === cur);
  const byDay = new Map(); for (const x of month) { const e = byDay.get(x.day) || { day: x.day, sum: 0, n: 0 }; e.sum += x.a; e.n++; byDay.set(x.day, e); }
  const topDay = max([...byDay.values()].filter((e) => e.sum > 0), (e) => e.sum);
  const big = max(month.filter((x) => x.a > 0), (x) => x.a);
  const byStore = new Map(); for (const x of month) { const k = storeKey(storeOfRow(x.r)); if (!k) continue; const e = byStore.get(k) || { key: k, name: storeOfRow(x.r), sum: 0, n: 0 }; e.sum += x.a; e.n++; byStore.set(k, e); }
  const topStore = max([...byStore.values()].filter((e) => e.sum > 0), (e) => e.sum);
  const upTo = today.getDate(), cat = new Map();   // 二级分类 → { cur, prev }（上月只算 1..今天的日期）
  for (const x of list) {
    const inCur = x.ym === cur, inPrev = x.ym === prev && x.at.getDate() <= upTo; if (!inCur && !inPrev) continue;
    const l2 = l2Of(x.r.category); if (!l2) continue;
    const e = cat.get(l2.id) || { id: l2.id, name: l2.name, icon: l2.icon, cur: 0, prev: 0 }; e[inCur ? "cur" : "prev"] += x.a; cat.set(l2.id, e);
  }
  const rising = max([...cat.values()].map((e) => ({ ...e, delta: round2(e.cur - e.prev) })).filter((e) => e.delta > 0), (e) => e.delta);
  return { cur, today: dayISO(today), d7,
    last7: { sum: sumOf(last7), n: last7.length }, prev7: { sum: sumOf(prev7), n: prev7.length },
    topDay: topDay && { day: topDay.day, sum: round2(topDay.sum), n: topDay.n },
    biggest: big && { id: big.r.id, name: big.r.name, store: storeOfRow(big.r), sum: big.a, day: big.day },
    topStore: topStore && { key: topStore.key, name: topStore.name, sum: round2(topStore.sum), n: topStore.n },
    rising: rising && { id: rising.id, name: rising.name, icon: rising.icon, delta: rising.delta, cur: round2(rising.cur), prev: round2(rising.prev) } };
}
