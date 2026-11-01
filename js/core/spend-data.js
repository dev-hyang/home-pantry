/* ───────────── 花费的按需数据（迁移 057）：不再把花费整表读进浏览器 ─────────────
 * 以前启动时后台读近 400 天的花费放进 state.purchases，预算、复盘、补货预估、联想、查重、卡的用量都在内存里算；
 * 现在各自向数据库要聚合好的 / 定点的结果（spend_rollup、item_purchase_stats、spend_suggest、card_spend…），
 * 读回来的结果按 key 缓存在这里。花费变了（实时同步、自己记 / 改 / 删、医疗付款变了 → spend-rows-changed）全部标过期，
 * 下次画的时候后台重读；读完发 spend-data-loaded，main.js 重画当前页面（和 stats/views.js 的聚合缓存同一套）。 */
import { Store } from "./store.js";
import { DAY } from "./util.js";

/** 浏览器所在时区：月份、日按本地时间算 */
export const TZ = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; } };
/** 本地日期 YYYY-MM-DD */
export const localDay = (d = new Date()) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };

/** 花费变了：统计、明细、联想、卡的用量等全部标过期（实时同步和整轮刷新都走这里） */
export const spendChanged = () => window.dispatchEvent(new Event("spend-rows-changed"));

/** 按 key 缓存一次异步读取。get(key, ...args)：立刻返回已有的结果（第一次 / 过期时在后台读，读完发 spend-data-loaded）；
 *  还没读到返回 null。wait(key, ...args)：等它读完再返回（打印、保存前用）。读失败记下 err，结果用 fallback，免得反复重读 */
export function cached(load, { max = 24, fallback = null } = {}) {
  const M = new Map();
  window.addEventListener("spend-rows-changed", () => { for (const e of M.values()) e.stale = true; });
  const entry = (key, args) => {
    let e = M.get(key);
    if (!e || (e.stale && !e.busy)) {
      if (!e) { if (M.size >= max) M.delete(M.keys().next().value); e = { val: null, err: "" }; M.set(key, e); }
      e.busy = true; e.stale = false;
      e.p = Promise.resolve().then(() => load(...args))
        .then((v) => { e.val = v; e.err = ""; })
        .catch((err) => { e.err = err?.message || String(err); if (e.val == null) e.val = fallback; console.warn("[spend-data]", e.err); })
        .finally(() => { e.busy = false; window.dispatchEvent(new Event("spend-data-loaded")); });
    }
    return e;
  };
  return {
    get: (key, ...args) => entry(key, args).val,
    wait: async (key, ...args) => { const e = entry(key, args); await e.p; return e.val; },
    err: (key) => M.get(key)?.err || "",
  };
}

/* ── 一笔花费（编辑缴费记录 / 保养记录时要它的付款方式、收款方）── */
const ONE = cached((id) => Store.getPurchase(id), { max: 40 });
/** 同步读：没读过返回 null（后台读，读完重画） */
export const purchaseById = (id) => (id ? ONE.get(id, id) : null);
/** 等它读回来 */
export const fetchPurchase = (id) => (id ? ONE.wait(id, id) : Promise.resolve(null));

/* ── 商店 / 行程联想：近 400 天用过的商店（按次数）和行程名（按最近）── */
const SUGGEST = cached(() => Store.spendSuggest(new Date(Date.now() - 400 * DAY).toISOString(), 300), { max: 1, fallback: { stores: [], trips: [] } });
/** { stores: [...], trips: [...] }；还没读到时是空的 */
export const spendSuggestions = () => SUGGEST.get("s") || { stores: [], trips: [] };
/** 表单里要用那笔花费的值做默认值，但它还没读回来（表单页不会因为后台数据重画）：读回来后，只要用户还没改过这一栏，就把值填进去 */
export function fillFromPurchase(id, selector, valueOf) {
  if (!id) return;
  setTimeout(() => {
    const v0 = document.querySelector(selector)?.value;
    fetchPurchase(id).then((p) => {
      const el = document.querySelector(selector); if (!p || !el || el.value !== v0) return;
      const v = valueOf(p); if (v != null && v !== "") el.value = v;
    }).catch(() => {});
  }, 0);
}
