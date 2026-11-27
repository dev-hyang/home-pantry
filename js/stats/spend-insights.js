/* 花费 → 概览顶部的「最近动态」卡片：近 7 天花费、本月最高的一天、本月最大一笔、本月花得最多的商家、比上月同期涨得最多的分类。
 * 数据 = 最近两个月的花费明细（和明细页同一个 spend_page，读一次、5 分钟内不重读，花费有变动时标过期）；计算在 spend-insights-calc.js。
 * 每张卡片点进去是明细页，带着对应的条件（近 7 天 / 那一天 / 金额从高到低 / 那家商家 / 那个分类），所以数字能一笔笔核对。 */
import { Store } from "../core/store.js";
import { cursorOf } from "../core/list-query.js";
import { esc, money } from "../core/util.js";
import { t } from "../core/i18n.js";
import { NO_SPEND_FILTER } from "./records-lite.js";
import { spendParamsOf } from "./spend-records.js";
import { dayISO } from "./spend-days.js";
import { insights } from "./spend-insights-calc.js";
import { changeTxt, kpi } from "./spend-drill.js";

const FRESH = 5 * 60e3, PAGE = 500, MAX = 5000, C = { calc: null, at: 0, busy: false, stale: false, err: "" };
window.addEventListener("spend-rows-changed", () => { C.stale = true; });
async function fetchRows() {
  const now = new Date(), today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const from = new Date(Math.min(new Date(today.getFullYear(), today.getMonth() - 1, 1).getTime(), new Date(today.getFullYear(), today.getMonth(), today.getDate() - 13).getTime()));
  const f = spendParamsOf({ ...NO_SPEND_FILTER(), sort: "new", dpre: "c", dfrom: dayISO(from), dto: dayISO(today) }), out = []; let after = null;
  while (out.length < MAX) {
    const raw = (await Store.listPage("spend", f, after, PAGE)) || [], page = raw.slice(0, PAGE);
    out.push(...page); if (raw.length <= PAGE || !page.length) break;
    after = cursorOf(page.at(-1));
  }
  return out;
}
function load() {
  if (C.busy || (C.at && !C.stale && Date.now() - C.at < FRESH)) return;
  C.busy = true;
  fetchRows().then((rows) => { C.calc = insights(rows); C.err = ""; }).catch((e) => { C.err = e?.message || String(e); C.calc = C.calc || insights([]); })
    .finally(() => { C.busy = false; C.at = Date.now(); C.stale = false; window.dispatchEvent(new Event("spend-data-loaded")); });   // 失败也记时间：5 分钟后再试
}
export function insightsHtml() {
  load();
  const r = C.calc; if (!r) return `<p class="muted" role="status" style="margin:0 0 10px;font-size:13px">${esc(t("正在读取最近动态…"))}</p>`;
  const cards = [
    kpi({ label: t("近 7 天花费"), value: money(r.last7.sum), small: r.prev7.n ? `${t("比前 7 天")}${changeTxt(r.last7.sum, r.prev7.sum)}` : t("{n} 笔", { n: r.last7.n }), drill: { days: 7 } }),
    r.topDay && kpi({ label: t("本月最高的一天"), value: `${r.topDay.day.slice(5)} · ${money(r.topDay.sum)}`, small: t("{n} 笔", { n: r.topDay.n }), drill: { dfrom: r.topDay.day, dto: r.topDay.day } }),
    r.biggest && kpi({ label: t("本月最大一笔"), value: money(r.biggest.sum), small: [r.biggest.store, r.biggest.name].filter(Boolean).join(" · "), drill: { month: r.cur, sort: "high" } }),
    r.topStore && kpi({ label: t("本月花得最多的商家"), value: r.topStore.name, small: `${money(r.topStore.sum)} · ${t("{n} 笔", { n: r.topStore.n })}`, drill: { month: r.cur, store: r.topStore.key } }),
    r.rising && kpi({ label: t("比上月同期涨得最多"), value: `${r.rising.icon || ""} ${t(r.rising.name)}`.trim(), small: `+${money(r.rising.delta)}（${money(r.rising.prev)} → ${money(r.rising.cur)}）`, drill: { month: r.cur, cat: r.rising.id } }),
  ].filter(Boolean);
  return `<div class="section-head" style="margin:0 0 6px"><h3 style="margin:0">${esc(t("最近动态"))}</h3></div><div class="kpis spend-recent">${cards.join("")}</div>`;
}
