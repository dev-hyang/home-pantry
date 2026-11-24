/* 明细的「金额」筛选（花费 / 收入共用）：纯函数，不碰页面（html 在 amount-filter.js）。
 *  下拉的顺序（从高到低，筛出来的结果集越来越小）：全部金额（默认）· 自定义 · 1000+ · 500–999 · 200–499 · 100–199 · 50–99 · 0–49 · < 0（只有花费有：退款 / 报销）。
 *  传给数据库 / 内存筛选的是 amin（金额 ≥）和 amax（金额 <），都可以只给一个；自定义里填的「到」是含的，所以换成 < 到 + 0.005（金额只有分）。 */
export const AMT_OPTS = [["all", "全部金额"], ["custom", "自定义…"], ["1000", "1000+"], ["500", "500–999"], ["200", "200–499"], ["100", "100–199"], ["50", "50–99"], ["0", "0–49"], ["neg", "< 0"]];
const RANGE = { 1000: [1000, null], 500: [500, 1000], 200: [200, 500], 100: [100, 200], 50: [50, 100], 0: [0, 50], neg: [null, 0] };
const numOrNull = (v) => { if (v === "" || v == null) return null; const n = Number(v); return Number.isFinite(n) ? n : null; };

/** 选择 + 自定义的两个框 → { amin, amax }（数字或 null）；「全部金额」/ 没填 = 都是 null */
export function amtParams(sel, min, max) {
  if (!sel || sel === "all") return { amin: null, amax: null };
  if (sel === "custom") {
    let lo = numOrNull(min), hi = numOrNull(max);
    if (lo != null && hi != null && lo > hi) [lo, hi] = [hi, lo];
    return { amin: lo, amax: hi == null ? null : Math.round((hi + 0.005) * 1000) / 1000 };
  }
  const r = RANGE[sel]; return r ? { amin: r[0], amax: r[1] } : { amin: null, amax: null };
}
/** 这个金额在不在筛选范围里（内存里筛：演示模式 / 测试） */
export const amtOk = (amount, { amin, amax }) => (amin == null || amount >= amin) && (amax == null || amount < amax);
