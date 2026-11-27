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
import { budgetBridge } from "../core/budget-bridge.js";
import { defaultNature } from "../core/taxonomy.js";
import { infoTip } from "../core/info-tip.js";
import { viewSwitch } from "../core/view-switch.js";

/* 「含账单 / 不含账单」：账单（房贷、保险、水电、订阅、医疗…）金额大又固定，不分开的话「最高的一天 / 最大一笔 / 商家」永远是账单。
 * 默认不含账单；记在本机。「不含账单」的口径和明细筛选的预算分组 grp=!bills 完全一样（账单、转账、投资组不算，只看日常 / 融资性质），点进明细带着 grp=!bills，数字对得上。 */
const MODE_KEY = "hmh-spend-ins-bills";
const getMode = () => { try { return localStorage.getItem(MODE_KEY) === "all" ? "all" : "nobills"; } catch { return "nobills"; } };
document.addEventListener("click", (e) => {
  const b = e.target.closest?.('[data-action="spend-ins-mode"]'); if (!b) return;
  try { localStorage.setItem(MODE_KEY, b.dataset.v === "all" ? "all" : "nobills"); } catch { /* 忽略 */ }
  C.at = 0; C.calc = null; window.dispatchEvent(new Event("spend-data-loaded"));
});
/** 「不含账单」时一行算不算：和明细筛选 grp=!bills 同一个判断（分类的预算分组不是 账单 / 转账 / 投资，性质是日常 / 融资） */
function notBill(r) {
  const G = budgetBridge.groupOf, nat = r.nat_eff || r.nature || defaultNature(r.category);
  if (r.virtual || r.pay_id) return false;   // 医疗一次性账单、账单缴费记的花费
  if (G) return !["bills", "transfer", "investment"].includes(G(r.category, "operating")) && (nat === "operating" || nat === "financing");
  return !String(r.category || "").startsWith("bill_");
}
const FRESH = 5 * 60e3, PAGE = 500, MAX = 5000, C = { calc: null, at: 0, busy: false, stale: false, err: "", mode: "" };
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
  const mode = getMode();
  fetchRows().then((rows) => { C.calc = insights(rows, new Date(), { keep: mode === "nobills" ? notBill : () => true }); C.mode = mode; C.err = ""; }).catch((e) => { C.err = e?.message || String(e); C.calc = C.calc || insights([]); C.mode = mode; })
    .finally(() => { C.busy = false; C.at = Date.now(); C.stale = false; window.dispatchEvent(new Event("spend-data-loaded")); });   // 失败也记时间：5 分钟后再试
}
export function insightsHtml() {
  if (C.calc && C.mode !== getMode()) { C.at = 0; C.calc = null; }   // 切了「含 / 不含账单」：重算
  load();
  const r = C.calc; if (!r) return `<p class="muted" role="status" style="margin:0 0 10px;font-size:13px">${esc(t("正在读取最近动态…"))}</p>`;
  const nb = getMode() === "nobills", g = nb ? { grp: "!bills" } : {};
  const tip = (x) => infoTip(x, { mode: "sup", size: "md" });
  const scope = nb ? t("不含账单（房贷、保险、水电、订阅、医疗等周期性和一次性账单）、转账和投资。") : t("含账单；转账不算。");
  const cards = [
    kpi({ label: t("近 7 天花费") + tip(t("含今天往前 7 天，和再往前 7 天对比。") + scope), value: money(r.last7.sum), small: r.prev7.n ? `${t("比前 7 天")}${changeTxt(r.last7.sum, r.prev7.sum)}` : t("{n} 笔", { n: r.last7.n }), drill: { days: 7, ...g } }),
    r.topDay && kpi({ label: t("本月最高的一天") + tip(t("本月里合计花得最多的那一天。") + scope), value: `${r.topDay.day.slice(5)} · ${money(r.topDay.sum)}`, small: t("{n} 笔", { n: r.topDay.n }), drill: { dfrom: r.topDay.day, dto: r.topDay.day, ...g } }),
    r.biggest && kpi({ label: t("本月最大一笔") + tip(t("本月金额最大的一笔。") + scope), value: money(r.biggest.sum), small: [r.biggest.store, r.biggest.name].filter(Boolean).join(" · "), drill: { month: r.cur, sort: "high", ...g } }),
    r.topStore && kpi({ label: t("本月花得最多的商家") + tip(t("按收款方合计，大小写和空格不同算同一家。") + scope), value: r.topStore.name, small: `${money(r.topStore.sum)} · ${t("{n} 笔", { n: r.topStore.n })}`, drill: { month: r.cur, store: r.topStore.key, ...g } }),
    r.rising && kpi({ label: t("比上月同期涨得最多") + tip(t("本月至今对比上月同一段日期，按二级分类，看多花了多少。") + scope), value: `${r.rising.icon || ""} ${t(r.rising.name)}`.trim(), small: `+${money(r.rising.delta)}（${money(r.rising.prev)} → ${money(r.rising.cur)}）`, drill: { month: r.cur, cat: r.rising.id, ...g } }),
  ].filter(Boolean);
  const sw = viewSwitch([["nobills", t("不含账单")], ["all", t("含账单")]], getMode(), { action: "spend-ins-mode", label: "统计范围" });
  return `<div class="section-head" style="margin:0 0 6px"><h3 style="margin:0">${esc(t("最近动态"))}${tip(t("账单（房贷、保险、水电、订阅、医疗等）金额大又固定，混在一起「最高的一天、最大一笔、商家」几乎总是账单，看不出日常花销。默认「不含账单」；切到「含账单」看全部（转账始终不算）。点卡片进明细，筛选条件和卡片一致。"))}</h3>${sw}</div><div class="kpis spend-recent">${cards.join("")}</div>`;
}
