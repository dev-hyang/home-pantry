/* 首页「钱 · 本月」要的几个数：本月 / 上月的日常消费、含住房、现金流出、收入。
 * 只读数据库的两个聚合函数（spend_rollup、inc_rollup，迁移 055 / 056）的最近 2 个月，不读明细、不碰统计页的缓存，
 * 所以首页不用把统计页（stats/views、income/views）整个加载进来。汇总规则在 stats/report.js（纯函数）。
 * 一分钟内重复打开首页直接用缓存；花费 / 收入变了（spend-rows-changed）标过期，下次画首页时后台重读。 */
import { Store } from "./store.js";
import { state } from "./state.js";
import { lang, t } from "./i18n.js";
import { aggregate, incAggregate, livingSeries, normIncRow, normRow, outflowSeries, withHousingSeries } from "../stats/report.js";

const TTL = 60_000;
const MONTH_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
/** 最近 n 个月（含本月），老的在前："2026-10"、"2026-11" */
export function lastMonths(n) {
  const d = new Date(), out = [];
  for (let i = n - 1; i >= 0; i--) out.push(key(new Date(d.getFullYear(), d.getMonth() - i, 1)));
  return out;
}
export const monthLabel = (k) => (lang === "en"
  ? (k.endsWith("-01") ? `${MONTH_EN[0]} ${k.slice(2, 4)}` : MONTH_EN[+k.slice(5) - 1])
  : (k.endsWith("-01") ? t("{yy}年1月", { yy: k.slice(2, 4) }) : t("{m}月", { m: +k.slice(5) })));
const tz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; } };
const nextMonth = (m) => { const [y, mo] = m.split("-").map(Number); return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`; };

let cache = null, loading = null, stale = false;
window.addEventListener("spend-rows-changed", () => { stale = true; });

/** 读好的数：{ months: [上月, 本月], living: [上月, 本月], housing, outflow, income }；还在读 / 读失败返回 null。读完调 onReady 让首页重画 */
export function homeMoney(onReady) {
  const fresh = cache && !stale && Date.now() - cache.at < TTL;
  if (!fresh && !loading) {
    stale = false;
    const months = lastMonths(2), from = `${months[0]}-01`, to = `${nextMonth(months[1])}-01`, cur = Units.region.currency;
    loading = Promise.all([Store.spendRollup(from, to, tz()), Store.incRollup(from, to, tz()).catch(() => null)])
      .then(([sp, inc]) => {
        const A = aggregate((sp || []).map(normRow), months, { cur, exCap: state.stats?.exCap !== false, exInv: state.stats?.exInv !== false });
        const I = inc ? incAggregate(inc.map(normIncRow), months, { cur }) : null;
        cache = { at: Date.now(), months, living: livingSeries(A), housing: withHousingSeries(A), outflow: outflowSeries(A), income: I ? I.income : null };
      })
      .catch((e) => { console.warn("[home money]", e.message); cache = null; })
      .finally(() => { loading = null; onReady?.(); });
  }
  return cache;
}
