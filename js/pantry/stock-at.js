/* 补录以前的购物：入库那条流水 / 新物品的建立时间记成购买那天（迁移 113 的 p_at）。今天和以后的不传，照旧按录入时间。 */
import { todayISO } from "../core/util.js";

/** iso = 这一行的购买时间（购买日 12:00）；是今天之前的日子就返回它，否则 null */
export function pastAt(iso, today = todayISO()) {
  const t = Date.parse(iso), start = Date.parse(`${today}T00:00:00`);
  return Number.isFinite(t) && t < start ? new Date(t).toISOString() : null;
}
