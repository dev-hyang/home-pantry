/* 「入库」的口径（库存页的筛选 / 排序 / 行内提示，概览卡片共用）：
 *   新物品   = 物品第一次建进库存（items.created_at）
 *   补货入库 = 库存记录里原因是 restock、数量为正（点 +、录入购物、购物车买到都会记）
 *   最近入库 = 两者里较晚的一个（和「最近更新」不同：点一下 − 也算更新，但不算入库）
 * 库存记录只读最近 90 天（STATS_LOG_DAYS），所以时间范围最长 90 天。 */
import { state } from "../core/state.js";
import { DAY, esc, fmt, fmtShort, num } from "../core/util.js";
import { t } from "../core/i18n.js";

export const ADDED_RANGES = ["7", "30", "90"];
const CACHE = new WeakMap();
/** 物品 id → 最近一次补货入库 { ts, delta }（按 state.logs 缓存，日志刷新后自动重算） */
function lastRestock() {
  const logs = state.logs || []; let m = CACHE.get(logs);
  if (m) return m;
  m = new Map();
  for (const l of logs) {
    if (l.reason !== "restock" || num(l.delta) <= 0 || l.voided_at) continue;   // 作废的（撤销入库）不算
    const ts = Date.parse(l.created_at), c = m.get(l.item_id);
    if (!c || ts > c.ts) m.set(l.item_id, { ts, delta: num(l.delta) });
  }
  CACHE.set(logs, m); return m;
}
const createdTs = (it) => Date.parse(it.created_at) || 0;
/** 一件物品的入库信息：{ created, restock: { ts, delta } | null, at }；at = 最近入库时间 */
export function stockInfo(it) {
  const restock = lastRestock().get(it.id) || null, created = createdTs(it);
  return { created, restock, at: Math.max(created, restock?.ts || 0) };
}
export const stockedAt = (it) => stockInfo(it).at;
/** 是否在「近 N 天」里入库；kind = new 只看新物品、restock 只看补货、all 两者都算 */
export function addedMatch(it, days, kind = "all", now = Date.now()) {
  const since = now - Number(days) * DAY, s = stockInfo(it);
  const isNew = s.created >= since, isRe = !!s.restock && s.restock.ts >= since;
  return kind === "new" ? isNew : kind === "restock" ? isRe : isNew || isRe;
}
/** 行内小字：「📥 7/18 +2 瓶」「🆕 7/18 新物品」（有入库时间范围 / 按入库排序时才显示） */
export function stockStamp(it, kind = "all") {
  const s = stockInfo(it), f = Units.factor(it.unit);
  if (s.restock && (kind === "restock" || (kind === "all" && s.restock.ts >= s.created))) return `📥 ${fmtShort(new Date(s.restock.ts).toISOString())} +${fmt(s.restock.delta * f)} ${t(it.du || "")}`.trim();
  return s.created ? `🆕 ${fmtShort(new Date(s.created).toISOString())} ${t("新物品")}` : "";
}
export const addedActive = (f) => !!f.added && f.added !== "all";
