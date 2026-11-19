/* 收入 / 花费 / 收支流水的聚合数据（inc_rollup、spend_rollup、ledger_rollup，迁移 055 / 056）：按参数缓存，数据变了标过期，下次画的时候后台重读。净资产页和收入页都用，所以从收入页里抽出来（收入页点开才加载）。 */
import { Store } from "../core/store.js";
import { biweekAnchor } from "./logic.js";
import { normIncRow, normRow } from "../stats/report.js";
import { t } from "../core/i18n.js";
import { toast } from "../core/util.js";

export const hooks = { render: () => {}, refresh: async () => {} };
export const rerender = () => hooks.render(false);
/* ───────────── 聚合数据：inc_rollup / spend_rollup / ledger_rollup（迁移 055 / 056），按参数缓存；数据变了标过期，下次画的时候后台重读 ───────────── */
const TZ = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; } };
const nextMonth = (m) => { const [y, mo] = m.split("-").map(Number); return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`; };
export const addDay = (s, n) => { const d = new Date(`${s}T12:00:00`); d.setDate(d.getDate() + n); return iso(d); };
/** from..to（日期，含）覆盖的月份 */
export const monthsBetween = (from, to) => { const out = []; for (let m = from.slice(0, 7); m <= to.slice(0, 7); m = nextMonth(m)) out.push(m); return out; };
/** 一组月份 → [from, to)（月初，不含 to） */
export const spanOfMonths = (ms) => { const s = [...ms].sort(); return { from: `${s[0]}-01`, to: `${nextMonth(s.at(-1))}-01` }; };
export const ROLL = new Map();
   // key → { rows, busy, stale, err, p }
let rollErrShown = false;
export function roll(kind, from, to, unit = "month") {
  const key = `${kind}|${from}|${to}|${unit}`;
  let e = ROLL.get(key);
  if (!e || (e.stale && !e.busy)) {
    if (!e) { if (ROLL.size > 30) ROLL.delete(ROLL.keys().next().value); e = { rows: null }; ROLL.set(key, e); }
    e.busy = true; e.stale = false;
    const req = kind === "inc" ? Store.incRollup(from, to, TZ()) : kind === "spend" ? Store.spendRollup(from, to, TZ()) : Store.ledgerRollup(from, to, TZ(), unit, unit === "biweek" ? biweekAnchor() : null);
    e.p = req.then((rows) => { e.rows = (rows || []).map(kind === "inc" ? normIncRow : kind === "spend" ? normRow : (x) => x); e.err = ""; })
      .catch((err) => {
        e.err = err?.message || String(err); e.rows = e.rows || [];
        if (!rollErrShown) { rollErrShown = true; toast(/could not find the function|schema cache|does not exist/i.test(e.err) ? t("收支统计读不出来：数据库还没升级，请先执行 supabase/migrations/056_income_ledger.sql") : t("收支统计读取失败：{msg}", { msg: e.err })); }
      })
      .finally(() => { e.busy = false; rerender(); });
  }
  return e.rows;
}
/** 覆盖这些月份的收入聚合行（净资产页「财富增长 vs 消费」用，和收支总览共用缓存）；还在读返回 null */
export const incRollupFor = (months) => { const sp = spanOfMonths(months); return roll("inc", sp.from, sp.to); };
/* ───────────── 预算与计划：预期收入（member_incomes，用来生成预算）+ 对比实际认定收入 ─────────────
 * 收入只在这里设置：原来在 设置 → 收入与预算 的预期收入、储蓄比例、生成预算、医疗计入、家庭分摊都挪到了这一页，设置里不再有第二份。 */
export const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
