import { categoryOptions } from "../pantry/views.js";
import { state } from "../core/state.js";
import { Store } from "../core/store.js";
import { askInline } from "../core/ask.js";
import { $, DAY, catOf, du, esc, fmt, money, num, showQty, toast } from "../core/util.js";
import { compare, lang, locale, t } from "../core/i18n.js";
import { memberName } from "../core/logic.js";
import { href } from "../core/router.js";
import { withProperty } from "../core/alerts.js";
import { tabBar, tabHub } from "../core/hub.js";
import { medicalVirtuals } from "../bills/medical.js";
import { budgetBridge } from "../core/budget-bridge.js";
import { SPEND_TABS, activeTab } from "../core/tabs.js";
import { bankImportTab } from "./bank-import.js";
import { cardHintHtml, cardOptions, cardSelectHtml } from "../bills/cards-views.js";

/* ── 统计：花费与消耗趋势 ── */
// 账单分类在 purchases 里记为 bill_<category>，名字取自 data/bills.js
const BILL_CATS = () => BILLS_GROUP.cats();
export const ALL_CATS = () => [...CATEGORIES, MAINT_CAT, VEHICLE_CAT, ...BILL_CATS(), ...TRAVEL_CATS, TRAVEL_GROUP, ...LIFE_CATS, LIFE_GROUP, DINING_GROUP, ADMIN_GROUP, ...CAPITAL_CATS, CAPITAL_GROUP, ...WORK_CATS, WORK_GROUP, GROCERY_MISC, VEHICLE_FUEL, MEDICAL_GROUP, { id: "pet_care", name: "宠物医疗 / 服务", icon: "🐾", color: "#9a6b3c" }, { id: "legal", name: "法律 / 税务", icon: "⚖️", color: "#8a948f" }, { id: "project", name: "装修 / 项目", icon: "🔨", color: "#b07a1a" }, OTHER_CAT];
// 统计图里：储藏各分类单独显示，房屋耗材和设备维修保养合并为“房屋维护”、装备合并为“装备”、车辆维修保养为“车辆”各一组；
// 账单按具体种类各一项（电费、燃气费、房贷…，只有有花费的才会出现在图里），同类账单同色相
// 花费页有个“同一大类合并显示”开关（水电气网、住房、车…各合成一项，颜色少一些），选择记在本机；
// merge 参数默认跟开关走，明细页的分类下拉传 false，始终列具体种类
const MERGE_KEY = "hmh-bill-merge";
try { state.stats.billMerge = localStorage.getItem(MERGE_KEY) === "1"; } catch { state.stats.billMerge = false; }
export const setBillMerge = (on) => { state.stats.billMerge = !!on; try { localStorage.setItem(MERGE_KEY, on ? "1" : "0"); } catch { /* 隐私模式下忽略 */ } };
const billStatCats = (merge) => (merge ? [...BILLS_GROUP.families(), ...BILL_CATS().filter((c) => !BILLS_GROUP.familyOf(c.id))] : BILL_CATS());
export const STAT_CATS = (merge = state.stats.billMerge) => [...CATEGORIES.filter((c) => c.space === "pantry"), GROCERY_MISC, HOUSE_GROUP, GEAR_GROUP, VEHICLE_GROUP, ...billStatCats(merge), DINING_GROUP, LIFE_GROUP, WORK_GROUP, ADMIN_GROUP, TRAVEL_GROUP, MEDICAL_GROUP, OTHER_CAT, CAPITAL_GROUP];
const isBill = (id) => String(id || "").startsWith("bill_");
export const statCat = (id, merge = state.stats.billMerge) => {
  id = canonCat(id);   // 旧分类（旅行·餐饮 / 燃油 / 门票）按别名表换成新的
  if (isCapital(id)) return "capital";   // 资本性支出：默认不进统计图和预算
  if (TRIP.isTravel(id)) return "travel";
  if (id === "life_dining") return "dining";   // 餐饮外食单独一组（通常是第二大可变开支，单独做预算）
  if (id === "life_transit" || id === "vehicle_fuel") return "vehicle";
  if (String(id).startsWith("work_")) return "work";   // 工作与专业：付费软件、考证、律师会计（非房产）、办公用品
  if (id === "life_gov" || id === "life_fees" || id === "life_mail" || id === "legal") return "admin";   // 政务与手续：证件罚单报税、手续费、邮寄、法律税务
  if (id === "life_shopping") return "other";   // 综合购物（待细分）：统计里归其他
  if (String(id).startsWith("life_")) return "life";   // 娱乐、美容、健身、礼物、课程…统计里合并成「休闲与个人」
  if (id === "grocery_misc") return id;   // 超市杂货（银行导入里没细分的）：统计里和日常储备各分类并排   // 机票、住宿、门票、燃油…统计里合并成“旅行出行”一组
  if (id === "medical") return id;   // 事件型账单的付款（虚拟花费，见 bills/medical.js）
  if (id === "pet_care") return "pet";   // 宠物账单（兽医、美容、寄养）并进“宠物”这一组
  if (id === "project") return "house";   // 法律 / 税务并入“其他”，装修 / 项目并入“房屋维护”
  const c = CATEGORIES.find((x) => x.id === id);
  if (c) return c.space === "pantry" ? c.id : c.space;
  if (id === MAINT_CAT.id) return "house";
  if (id === VEHICLE_CAT.id) return "vehicle";
  if (!isBill(id) || !BILL_CATS().some((c) => c.id === id)) return "other";   // 不认识的 bill_ 种类归“其他”，免得合计对不上
  return (merge && BILLS_GROUP.familyOf(id)) || id;   // 账单保持具体种类（bill_electric…）；合并开关打开时归到所属大类（billfam_utilities…）
};
/** 明细 / 钻取的分类筛选：除了统计分类，还支持 "bills" = 全部账单、"billfam_*" = 一个大类、"bill_*" = 一种账单（不受合并开关影响，书签 / 旧钻取链接都有效） */
const catMatches = (sel, category) => {
  if (sel === "bills") return isBill(category);
  if (sel.startsWith("billfam_")) return isBill(category) && BILLS_GROUP.familyOf(category) === sel;
  if (isBill(sel) || TRIP.isTravel(sel) || String(sel).startsWith("life_") || String(sel).startsWith("work_") || sel === "vehicle_fuel" || sel === "grocery_misc") return canonCat(category) === sel;   // 具体的账单种类 / 旅行类型
  return statCat(category) === sel;
};
export const monthKey = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`; };
const MONTH_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const monthLabel = (k) => (lang === "en"
  ? (k.endsWith("-01") ? `${MONTH_EN[0]} ${k.slice(2, 4)}` : MONTH_EN[+k.slice(5) - 1])
  : (k.endsWith("-01") ? t("{yy}年1月", { yy: k.slice(2, 4) }) : t("{m}月", { m: +k.slice(5) })));
export function lastMonths(n) {
  const d = new Date(), out = [];
  for (let i = n - 1; i >= 0; i--) out.push(monthKey(new Date(d.getFullYear(), d.getMonth() - i, 1)));
  return out;
}

export function spendData(n = state.stats.months) {
  const cur = Units.region.currency;
  const months = rangeMonths(n);
  const byMC = Object.fromEntries(months.map((m) => [m, {}]));
  const counts = Object.fromEntries(months.map((m) => [m, 0]));
  let otherCurrency = 0, capital = 0, capitalN = 0;
  for (const p of state.purchases) {
    if (p.amount == null) continue;
    if (p.currency && p.currency !== cur) { otherCurrency++; continue; }
    const m = monthKey(p.purchased_at);
    if (!byMC[m]) continue;
    const c = statCat(p.category);
    if (c === "capital") { capital += num(p.amount); capitalN++; if (!state.stats.includeCapital) continue; }   // 资本性支出：默认不进图，只在开关旁显示合计
    byMC[m][c] = (byMC[m][c] || 0) + num(p.amount);
    counts[m]++;
  }
  const totals = months.map((m) => Object.values(byMC[m]).reduce((a, b) => a + b, 0));
  const cats = STAT_CATS().filter((c) => months.some((m) => byMC[m][c.id]));
  return { capital: Math.round(capital * 100) / 100, capitalN, months, byMC, totals, cats, counts, otherCurrency };
}

export function consumptionData() {
  const WEEKS = 12, now = Date.now();
  const starts = Array.from({ length: WEEKS }, (_, i) => now - (WEEKS - i) * 7 * DAY);
  const labels = starts.map((x) => { const d = new Date(x); return `${d.getMonth() + 1}/${d.getDate()}`; });
  const wk = (x) => Math.floor((x - starts[0]) / (7 * DAY));
  const itemCat = Object.fromEntries(state.items.map((i) => [i.id, i.category]));
  const freq = {}, perItem = {};
  for (const l of state.logs) {
    if (l.reason !== "consume") continue;
    const w = wk(new Date(l.created_at).getTime());
    if (w < 0 || w >= WEEKS) continue;
    const c = itemCat[l.item_id];
    if (!c) continue;
    (freq[c] ||= Array(WEEKS).fill(0))[w]++;
    perItem[l.item_id] = (perItem[l.item_id] || 0) + 1;
  }
  return { WEEKS, starts, labels, freq, perItem };
}

// 周消耗量 + 每周末库存水位（用当前库存减去之后发生的所有变动倒推）
export function itemSeries(item, starts) {
  const W = starts.length, f = Units.factor(item.unit);
  const used = Array(W).fill(0), level = Array(W).fill(0);
  const logs = state.logs.filter((l) => l.item_id === item.id).map((l) => ({ t: new Date(l.created_at).getTime(), d: num(l.delta), r: l.reason }));
  for (const l of logs) {
    const w = Math.floor((l.t - starts[0]) / (7 * DAY));
    if (l.r === "consume" && w >= 0 && w < W) used[w] += -l.d;
  }
  for (let i = 0; i < W; i++) {
    const end = starts[i] + 7 * DAY;
    const after = logs.filter((l) => l.t > end).reduce((a, l) => a + l.d, 0);
    level[i] = Math.max(0, num(item.quantity) - after);
  }
  return { used: used.map((v) => v * f), level: level.map((v) => v * f), unit: t(du(item.unit)) };
}

/** 时间范围：近 3 / 6 / 9 / 12 个月，或某一年（"y:2025"，从今年到最早有记录的那年）；花费各标签和预算趋势共用（state.stats.months）。
 *  云端平时只读近 400 天的花费，选往年时按需把那一年读回来并进 state.purchases（见 ensureYearLoaded） */
export const RANGES = [3, 6, 9, 12];
const thisYear = () => new Date().getFullYear();
export function rangeMonths(n = state.stats.months) {
  if (n === "m") return lastMonths(1);   // 本月
  if (typeof n === "string" && n.startsWith("y:")) { const y = +n.slice(2), last = y === thisYear() ? new Date().getMonth() + 1 : 12; return Array.from({ length: last }, (_, i) => `${y}-${String(i + 1).padStart(2, "0")}`); }
  return lastMonths(+n || 6);
}
export const rangeChipsHtml = () => {
  const y0 = thisYear(), first = state.stats.firstYear || y0, years = Array.from({ length: Math.max(0, Math.min(12, y0 - first + 1)) }, (_, i) => y0 - i);
  const cur = String(state.stats.months);
  return `<select id="statsRange" class="range-sel" aria-label="${t("时间范围")}" data-nosearch><option value="m" ${cur === "m" ? "selected" : ""}>${t("本月")}</option>${RANGES.map((n) => `<option value="${n}" ${cur === String(n) ? "selected" : ""}>${t("近 {n} 个月", { n })}</option>`).join("")}${years.map((y) => `<option value="y:${y}" ${cur === `y:${y}` ? "selected" : ""}>${y === y0 ? t("今年") : t("{y} 年", { y })}</option>`).join("")}</select>`;
};
/** 选了往年：那一年的花费不在平时读的近 400 天里，按需读回来并进 state.purchases（去重）；返回 true 表示读到了新的 */
export async function ensureYearLoaded(n) {
  if (typeof n !== "string" || !n.startsWith("y:")) return false;
  const y = +n.slice(2); state.yearLoaded ||= {}; if (state.yearLoaded[y]) return false;
  state.yearLoaded[y] = true;
  const rows = await Store.listPurchasesRange(`${y}-01-01T00:00:00.000Z`, `${y + 1}-01-01T00:00:00.000Z`).catch(() => []);
  const have = new Set(state.purchases.map((p) => p.id)), fresh = rows.filter((p) => !have.has(p.id));
  if (fresh.length) state.purchases = [...state.purchases, ...fresh];
  return fresh.length > 0;
}
/** 银行导入「查看 / 修改」：云端平时只读近 400 天，补录的老对账单（日期更早）不在内存里，筛出来就是空的——按这一批的日期范围把它们读回来 */
export async function ensureBatchLoaded() {
  const id = state.spendFilter.batch, bt = id ? batchOf(id) : null; if (!bt) return false;
  let rows = [];
  if (bt.b.tagged || bt.ids.size) rows = await Store.listPurchasesByBatch(id, [...bt.ids]).catch(() => []);   // 按批次 id / 旧批次的 id 列表直接读，不猜日期
  else if (bt.b.from) { const day = (s, d) => new Date(new Date(`${s}T00:00:00Z`).getTime() + d * 864e5).toISOString(); rows = await Store.listPurchasesRange(day(bt.b.from, -1), day(bt.b.to || bt.b.from, 2)).catch(() => []); }
  const have = new Set(state.purchases.map((p) => p.id)), fresh = rows.filter((p) => !have.has(p.id));
  if (fresh.length) state.purchases = [...state.purchases, ...fresh];
  return fresh.length > 0;
}
/** 最早有记录的年份（只查一次），下拉里的往年选项到这一年为止 */
export async function ensureFirstYear() {
  if (state.stats.firstYear) return false;
  const y = await Store.firstPurchaseYear().catch(() => null);
  state.stats.firstYear = y || thisYear(); return true;
}
const monthOpt = (m) => (lang === "en" ? `${MONTH_EN[+m.slice(5) - 1]} ${m.slice(0, 4)}` : t("{y} 年 {m} 月", { y: m.slice(0, 4), m: +m.slice(5) }));
const noSpend = () => `<div class="panel empty"><strong>${t("还没有花费记录")}</strong>${t("在采购清单点“已买到”时填上实际花费，或在“明细”里补记一笔。")}</div>`;

/* ── 钻取：图表色块、图例、名称、数字卡片都带 data-drill（查询串），点一下跳到 明细 并套上对应筛选（分类 / 商店 / 月份 / 近 N 个月）；
 * 全局点击处理在 main.js，筛选在 applySpendDrill，明细页顶部用筛选条显示并可逐项去掉。 */
/** 预算页的“预算分组”（日常储备 / 房屋维护 / 大件家电…）和分类不是一回事（大件按单笔金额分），分组的判断函数由 budget.js 登记在这里，明细按它筛选 */
export const dq = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v != null && v !== "").map(([k, v]) => [k, String(v)])).toString();
const encKeys = (keys) => keys.map(encodeURIComponent).join(",");
export const hitAttrs = (q, label) => (q ? ` data-drill="${esc(q)}" role="link" tabindex="0" aria-label="${esc(label)}"` : "");
const DRILL_HINT = () => `<p class="muted drill-hint">${t("点图里的色块、图例或名称，可以查看对应的花费明细。")}</p>`;
export function applySpendDrill(q) {
  if (!["cat", "grp", "store", "stores", "month", "range", "year", "q", "batch"].some((k) => q.has(k))) return false;
  const f = state.spendFilter;
  Object.assign(f, { q: "", cat: "all", grp: null, store: "all", stores: null, month: "all", months: null, batch: null, dmax: null, sort: "new", limit: 20 });
  if (q.get("dmax")) f.dmax = +q.get("dmax") || null;   // 只看每月 1–N 日（「上月同期」对比用）
  if (q.get("batch")) f.batch = q.get("batch");   // 银行导入「查看 / 修改」：只看这一批
  if (q.get("q")) f.q = q.get("q");   // 旅行页「查看明细」：按「【行程名】」搜名称
  if (q.get("grp")) f.grp = q.get("grp");
  if (q.get("cat")) f.cat = q.get("cat");
  if (q.get("store")) f.store = q.get("store");
  if (q.get("stores")) f.stores = q.get("stores").split(",").map(decodeURIComponent);
  if (q.get("month")) f.month = q.get("month");
  else if (q.get("mlist")) f.months = q.get("mlist").split(",").filter((x) => /^\d{4}-\d{2}$/.test(x));
  else if (q.get("range")) f.months = lastMonths(Math.max(1, Math.min(24, +q.get("range") || 6)));
  else if (q.get("year")) { const y = +q.get("year"), now = new Date(), last = y === now.getFullYear() ? now.getMonth() + 1 : 12; f.months = Array.from({ length: last }, (_, i) => `${y}-${String(i + 1).padStart(2, "0")}`); }   // 年度预算：今年到本月为止
  return true;
}

/** 本月 / 上月 / 近 n 月月均：花费概览和账单概览的速览共用；数字卡片点一下看对应月份的明细 */
export function spendKpis(sd) {
  const { months, totals } = sd;
  const thisTotal = totals.at(-1) || 0, prevTotal = totals.at(-2) || 0, avg = totals.reduce((a, b) => a + b, 0) / (totals.length || 1);
  const change = prevTotal > 0 ? Math.round(((thisTotal - prevTotal) / prevTotal) * 100) : null;
  return `<div class="kpis">
    <div class="kpi ch-hit-row"${hitAttrs(dq({ month: months.at(-1) }), t("本月花费"))}><span>${t("本月花费")}</span><b>${money(thisTotal)}</b><small>${t("{n} 笔", { n: sd.counts[months.at(-1)] })} ›</small></div>
    <div class="kpi ch-hit-row"${hitAttrs(dq({ month: months.at(-2) }), t("上月花费"))}><span>${t("上月花费")}</span><b>${money(prevTotal)}</b>
      <small class="${change > 0 ? "up" : "down"}">${change == null ? t("上月无记录") : change > 0 ? t("多了 {p}%", { p: Math.abs(change) }) : t("少了 {p}%", { p: Math.abs(change) })}</small></div>
    <div class="kpi ch-hit-row"${hitAttrs(dq({ range: months.length }), t("近 {n} 个月月均", { n: months.length }))}><span>${t("近 {n} 个月月均", { n: months.length })}</span><b>${money(avg)}</b><small>${t("本月进度供参考")} ›</small></div>
  </div>`;
}
/* ── 花费概览的三个数字：随时间范围变化，前两个时间长度对等 ──
 *   本月      → 本月至今 | 上月同期（1–今天） | 本月日均
 *   近 N 个月 → 近 N 个月合计 | 再往前的 N 个月合计 | 近 N 个月月均
 *   某一年    → 该年（今年到本月）| 前一年同期 | 该年月均
 *  前一段可能不在平时读的近 400 天里，ensureCompareLoaded 按需读回来。 */
const monthNums = (ms) => {
  const ym = (m) => `${m.slice(0, 4)}.${+m.slice(5)}`;
  if (ms.length === 1) return monthLabel(ms[0]);
  if (ms[0].slice(0, 4) === ms.at(-1).slice(0, 4)) return `${+ms[0].slice(5)}–${+ms.at(-1).slice(5)}${lang === "en" ? "" : " 月"}`;   // 同一年：8–10 月
  return `${ym(ms[0])}–${ym(ms.at(-1))}`;   // 跨年带上年份，免得「前 12 个月」和「近 12 个月」看起来一样
};
const shiftYear = (m, d) => `${+m.slice(0, 4) + d}${m.slice(4)}`;
export function comparePlan(n = state.stats.months) {
  const now = new Date(), cur = lastMonths(1)[0];
  if (n === "m") { const prev = lastMonths(2)[0]; return { a: { months: [cur], label: t("本月至今"), drill: { month: cur } }, b: { months: [prev], dmax: now.getDate(), label: t("上月同期（1–{d} 日）", { d: now.getDate() }), drill: { month: prev, dmax: now.getDate() } }, avg: "day" }; }
  if (typeof n === "string" && n.startsWith("y:")) {
    const y = +n.slice(2), ms = rangeMonths(n), pm = ms.map((m) => shiftYear(m, -1)), part = ms.length < 12;
    return { a: { months: ms, label: y === thisYear() ? t("本年花费") : t("{y} 年花费", { y }), drill: { year: y } }, b: { months: pm, label: part ? t("{y} 年同期（{r}）", { y: y - 1, r: monthNums(pm) }) : t("{y} 年花费", { y: y - 1 }), drill: { mlist: pm.join(",") } }, avg: "month" };
  }
  const k = +n || 6, all = lastMonths(k * 2), am = all.slice(k), bm = all.slice(0, k);
  return { a: { months: am, label: t("近 {n} 个月（{r}）", { n: k, r: monthNums(am) }), drill: { range: k } }, b: { months: bm, label: t("前 {n} 个月（{r}）", { n: k, r: monthNums(bm) }), drill: { mlist: bm.join(",") } }, avg: "month" };
}
/** 一段时间的合计（口径同 spendData：本币、资本性支出默认不算）；dmax = 只算每月 1–N 日 */
function windowSum(months, dmax) {
  const cur = Units.region.currency, set = new Set(months); let total = 0, n = 0;
  for (const p of state.purchases) {
    if (p.amount == null || (p.currency && p.currency !== cur) || !set.has(monthKey(p.purchased_at))) continue;
    if (dmax && new Date(p.purchased_at).getDate() > dmax) continue;
    if (statCat(p.category) === "capital" && !state.stats.includeCapital) continue;
    total += num(p.amount); n++;
  }
  return { total, n };
}
export async function ensureCompareLoaded() {
  const plan = comparePlan(), ms = plan.b.months, first = ms[0], key = first + ms.length;
  if (first >= monthKey(new Date(Date.now() - 395 * 864e5))) return false;   // 平时读的是近 400 天
  state.compareLoaded ||= {}; if (state.compareLoaded[key]) return false;
  state.compareLoaded[key] = true;
  const next = (m) => { const [y, mo] = m.split("-").map(Number); return new Date(Date.UTC(y, mo, 1)).toISOString(); };
  const rows = await Store.listPurchasesRange(`${first}-01T00:00:00.000Z`, next(ms.at(-1))).catch(() => []);
  const have = new Set(state.purchases.map((p) => p.id)), fresh = rows.filter((p) => !have.has(p.id));
  if (fresh.length) state.purchases = [...state.purchases, ...fresh];
  return fresh.length > 0;
}
export function periodKpis(sd) {
  const plan = comparePlan(), A = windowSum(plan.a.months, plan.a.dmax), B = windowSum(plan.b.months, plan.b.dmax);
  const change = B.total > 0 ? Math.round(((A.total - B.total) / B.total) * 100) : null;
  const today = new Date().getDate(), avgLabel = plan.avg === "day" ? t("本月日均") : t("近 {n} 个月月均", { n: sd.months.length });
  const avgVal = plan.avg === "day" ? A.total / Math.max(1, today) : sd.totals.reduce((a, b) => a + b, 0) / (sd.totals.length || 1);
  const drill = (o) => hitAttrs(dq(o), "");
  return `<div class="kpis">
    <div class="kpi ch-hit-row"${drill(plan.a.drill)}><span>${plan.a.label}</span><b>${money(A.total)}</b><small>${t("{n} 笔", { n: A.n })} ›</small></div>
    <div class="kpi ch-hit-row"${drill(plan.b.drill)}><span>${plan.b.label}</span><b>${money(B.total)}</b>
      <small class="${change > 0 ? "up" : "down"}">${change == null ? t("这段时间无记录") : change > 0 ? t("多了 {p}%", { p: Math.abs(change) }) : t("少了 {p}%", { p: Math.abs(change) })}</small></div>
    <div class="kpi ch-hit-row"${drill(plan.a.drill)}><span>${avgLabel}</span><b>${money(avgVal)}</b><small>${plan.avg === "day" ? t("{n} 笔", { n: A.n }) : t("本月进度供参考")} ›</small></div>
  </div>`;
}
/** 账单概览里的花费速览：只放三个数字，详细的在 账单 → 花费 */
export function spendGlance() {
  if (!state.purchases.length) return "";
  return `<section class="section"><div class="section-head"><h2>${t("花费速览")}</h2><div class="head-acts"><a class="btn btn-sm btn-ghost" href="${href("bills", "spend")}">${t("看花费")}</a></div></div>${spendKpis(spendData(6))}</section>`;
}

/* 花费页分为 5 个标签（概览 / 分类 / 商店 / 明细 / 导出打印），一次只画一块，页面不再一屏接一屏地长；
 * 统计页（账单模块关闭时）仍用 "all"：全部连在一起 */
const spendHref = (id) => `${href("bills", "spend")}${id === "overview" ? "" : `?tab=${id}`}`;
/** 花费图的「问咩咩」：为什么涨、怎么控（带每月合计和前三类） */
function spendAsk(sd) {
  const { months, totals, byMC, cats } = sd, sum = {}; for (const m of months) for (const [c, v] of Object.entries(byMC[m] || {})) sum[c] = (sum[c] || 0) + v;
  const top = Object.entries(sum).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, v]) => `${t(cats.find((x) => x.id === c)?.name || c)} ${money(v)}`);
  return { id: `spend-${months[0]}-${months.at(-1)}`, title: t("{r}的花费", { r: rangeLabel() }), question: t("这段时间花费为什么变多了？主要在哪几类？怎么控制？"),
    context: () => [t("按月合计：{s}", { s: months.map((m, i) => `${monthLabel(m)} ${money(totals[i])}`).join("，") }), t("前三类：{s}", { s: top.join("，") }), t("家庭人数 {n}", { n: state.members?.length || 1 })] };
}
function spendOverviewTab(sd, withHub = false) {
  const { months, byMC, cats, totals } = sd;
  const spendBars = Charts.bars({
    title: t("每月花费（按分类）"), labels: months.map(monthLabel), fmt: money,
    series: cats.map((c) => ({ name: t(c.name), color: c.color, values: months.map((m) => byMC[m][c.id] || 0) })),
    drill: (k, i) => dq({ cat: cats[k].id, month: months[i] }), legendDrill: (k) => dq({ cat: cats[k].id, range: months.length }),
  });
  // 时间条 → 数字卡片 → 图表连在一起；手机上的「其他功能」入口行放最后（原来夹在数字卡片和图表中间，把筛选和图表隔开了）
  return `${periodKpis(sd)}
    ${sd.otherCurrency ? `<p class="muted" style="font-size:13px">${t("另有 {n} 笔非 {cur} 记录未计入。", { n: sd.otherCurrency, cur: Units.region.currency })}</p>` : ""}
    ${totals.some((v) => v > 0) ? `<div class="panel chart-panel"><h3>${t("每月花了多少")}</h3>${spendBars}${DRILL_HINT()}${askInline(spendAsk(sd))}</div>` : noSpend()}
    ${withHub ? tabHub(SPEND_TABS, spendHref, t("其他功能")) : ""}`;
}
function spendCategoryTab(sd) {
  const st = state.stats, { months, byMC, cats, totals } = sd;
  if (!totals.some((v) => v > 0)) return noSpend();
  const selMonth = st.month && byMC[st.month] ? st.month : "";   // 空 = 整段（和时间范围一致）
  const PRIORITY = ["grocery_misc", "dining", "other", "medical"];   // 单个分类趋势：超市、餐饮、网购（待细分归「其他」）、医疗排前面，其余照原顺序
  const ordCats = [...PRIORITY.map((id) => cats.find((c) => c.id === id)).filter(Boolean), ...cats.filter((c) => !PRIORITY.includes(c.id))];
  const selCat = st.cat && ordCats.some((c) => c.id === st.cat) ? st.cat : ordCats[0]?.id;
  const sumCat = (id) => (selMonth ? byMC[selMonth][id] || 0 : months.reduce((a, m) => a + (byMC[m][id] || 0), 0));
  const donut = Charts.donut({
    title: selMonth ? t("{month}分类占比", { month: monthLabel(selMonth) }) : t("{r}分类占比", { r: rangeLabel() }), fmt: money,
    center: money(STAT_CATS().reduce((a, c) => a + sumCat(c.id), 0), true),
    items: STAT_CATS().map((c) => ({ name: `${c.icon} ${t(c.name)}`, color: c.color, value: sumCat(c.id), drill: dq(selMonth ? { cat: c.id, month: selMonth } : { cat: c.id, range: months.length }) })),
  });
  const catObj = STAT_CATS().find((c) => c.id === selCat);
  const catTrend = catObj ? Charts.line({
    title: t("{cat}月度花费趋势", { cat: t(catObj.name) }), labels: months.map(monthLabel), fmt: money,
    series: [{ name: t(catObj.name), color: catObj.color, values: months.map((m) => byMC[m][selCat] || 0) }],
    drill: (_, i) => dq({ cat: selCat, month: months[i] }),
  }) : "";
  return `<div class="panel chart-panel"><h3>${t("分类占比")}</h3>${donut}${DRILL_HINT()}</div>
    <div class="panel chart-panel"><h3>${t("单个分类的月度趋势")}</h3>
      <div class="chips" role="group" aria-label="${t("选择分类")}">${ordCats.map((c) => `<button type="button" class="chip" data-action="stats-cat" data-cat="${c.id}" aria-pressed="${c.id === selCat}">${c.icon} ${t(c.name)}</button>`).join("")}</div>
      ${catTrend}
      ${catObj ? `<div class="form-actions"><button type="button" class="btn btn-sm" data-drill="${esc(dq({ cat: selCat, range: months.length }))}">${t("查看「{cat}」近 {n} 个月的明细", { cat: t(catObj.name), n: months.length })} ›</button></div>` : ""}${DRILL_HINT()}</div>`;
}
/* ── 旅行：花费名称「【行程】项目」按行程汇总；只有 travel_* 类型的花费才算（餐饮等日常花费不带行程前缀就不进来） ── */
const tripsOf = () => {
  const map = new Map();
  for (const p of state.purchases) {
    if (p.amount == null || (p.virtual && !TRIP.isTravel(p.category))) continue;   // 一次性账单里的旅行付款（虚拟花费）也算
    const { trip } = TRIP.parse(p.name);
    if (!trip) continue;
    const g = map.get(trip) || { trip, total: 0, n: 0, first: p.purchased_at, last: p.purchased_at, byCat: {}, cur: p.currency };
    g.total += num(p.amount); g.n++; g.byCat[p.category] = (g.byCat[p.category] || 0) + num(p.amount);
    if (p.purchased_at < g.first) g.first = p.purchased_at; if (p.purchased_at > g.last) g.last = p.purchased_at;
    map.set(trip, g);
  }
  return [...map.values()].sort((a, b) => String(b.last).localeCompare(String(a.last)));
};
const tripDatalist = () => `<datalist id="tripList">${tripsOf().map((g) => `<option value="${esc(g.trip)}">`).join("")}</datalist>`;
function spendTripsTab() {
  const trips = tripsOf(), cur = Units.region.currency;
  const loose = state.purchases.filter((p) => p.amount != null && TRIP.isTravel(p.category) && !TRIP.parse(p.name).trip);
  const looseTotal = loose.reduce((s, p) => s + num(p.amount), 0);
  // 补入以前的：以前记成“其他”、名称或商店里带机票 / 酒店 / 门票 / 加油…关键词的，给出归类建议，点一下归到对应旅行类型（不会自动改）
  const sugg = state.purchases.filter((p) => !p.virtual && p.amount != null && p.category === "other" && TRIP.guess(p.name, p.store)).slice(0, 12);
  const suggHtml = sugg.length ? `<div class="panel"><h3 style="font-size:15px;margin:0 0 4px">${t("以前的花费里，可能是旅行")}</h3><p class="muted" style="margin:0 0 6px;font-size:13px">${t("名称或商店里带机票、酒店、门票、加油…的“其他”花费；点一下归到对应类型（可在明细里再改，也可以给名称加上「【行程名】」）。")}</p>
    <ul class="restock-list">${sugg.map((p) => { const id = TRIP.guess(p.name, p.store), c = TRAVEL_CATS.find((x) => x.id === id);
      return `<li><div class="grow"><span class="name">${esc(p.name)}</span><small>${esc(String(p.purchased_at).slice(0, 10))}${p.store ? ` · ${esc(p.store)}` : ""} · ${money(num(p.amount))}</small></div><button type="button" class="btn btn-sm" data-action="trip-reclass" data-id="${esc(p.id)}" data-cat="${id}">${t("归为")} ${c.icon} ${esc(t(c.name.split("（")[0]))}</button></li>`; }).join("")}</ul></div>` : "";
  const card = (g) => `<div class="panel trip-card"><div class="row"><div class="v"><b>🧳 ${esc(g.trip)}</b>
      <div class="muted" style="font-size:12.5px">${esc(String(g.first).slice(0, 10))}${String(g.first).slice(0, 10) !== String(g.last).slice(0, 10) ? ` → ${esc(String(g.last).slice(0, 10))}` : ""} · ${t("{n} 笔", { n: g.n })}</div></div>
      <b class="num">${money(g.total)}</b></div>
    <ul class="trip-cats">${Object.entries(g.byCat).sort((a, b) => b[1] - a[1]).map(([id, v]) => { const c = TRAVEL_CATS.find((x) => x.id === id) || ALL_CATS().find((x) => x.id === id) || OTHER_CAT; return `<li><span>${c.icon} ${esc(t(c.name))}</span><b class="num">${money(v)}</b></li>`; }).join("")}</ul>
    <div class="form-actions" style="margin-top:6px"><a class="btn btn-sm" href="${href("bills", "spend")}?tab=records&add=1&cat=travel_other&trip=${encodeURIComponent(g.trip)}">＋ ${t("记一笔")}</a><button type="button" class="btn btn-sm btn-ghost" data-drill="${esc(dq({ q: `【${g.trip}】` }))}">${t("查看明细")} ›</button></div></div>`;
  return `<section class="section"><div class="section-head"><h2>${t("旅行")}</h2><p>${t("按行程汇总这趟出门的全部花费：机票、住宿、租车这类选「旅行专属」分类；旅途中的吃饭、加油、门票照常选外出就餐 / 燃油 / 娱乐——只要填了行程名，都会算进这趟。补记以前的旅行也一样，日期选当时的。")}</p></div>
    ${trips.length ? trips.map(card).join("") : `<div class="panel empty"><strong>${t("还没有行程")}</strong>${t("记一笔花费时在「行程」里写个名字（例如 东京 2026），这笔就归到这趟：机票、住宿、租车选「旅行专属」分类，吃饭、加油、门票照常选普通分类。以前的旅行也可以补记，日期选当时的。")}<p><a class="btn btn-primary btn-sm" href="${href("bills", "spend")}?tab=records&add=1&cat=travel_flight">${t("记一笔旅行花费")}</a></p></div>`}
    ${suggHtml}
    ${loose.length ? `<div class="panel"><div class="row"><div class="v"><b>${t("没归入行程的旅行花费")}</b><div class="muted" style="font-size:12.5px">${t("{n} 笔 · 在明细里把名称改成「【行程名】项目」就归进去", { n: loose.length })}</div></div><b class="num">${money(looseTotal)}</b></div></div>` : ""}
  </section>`;
}
function spendRecordsTab() {
  const today = new Date().toISOString().slice(0, 10), q = state.route?.q;
  const preCat = q?.get("cat") || "", preTrip = q?.get("trip") || "";   // 从旅行页进来：分类预选旅行、行程预填
  const open = !!state.spendAddOpen || !!q?.get("add");   // 表单默认收着，点「手动记一笔」或从「记一笔花费」按钮进来才展开
  return `<section class="section">
      <div class="section-head"><h2>${t("记一笔花费")}</h2><p>${t("没走采购清单的，在这里记")}</p></div>
      <div class="entry-ways" role="group" aria-label="${esc(t("三种记法"))}">
        <button type="button" class="way ${open ? "is-cur" : ""}" data-action="spend-add-toggle" aria-expanded="${open ? "true" : "false"}"><span class="way-ico" aria-hidden="true">✍️</span><span>${t("手动记一笔")}</span></button>
        <a class="way" href="${href("scan")}"><span class="way-ico" aria-hidden="true">📷</span><span>${t("拍小票识别")}</span></a>
        <a class="way" href="${href("bills", "spend")}?tab=import"><span class="way-ico" aria-hidden="true">🏦</span><span>${t("导入对账单")}</span></a></div>
      ${storeDatalist()}
      ${open ? "" : "<!-- 表单收着 -->"}
      <form id="purchaseForm" class="panel add-row purchase-row" ${open ? "" : "hidden"}>
        <input class="pr-name" name="name" required maxlength="60" placeholder="${t("买了什么，例如：超市采购")}" aria-label="${t("名称")}">
        <select class="pr-cat" name="category" aria-label="${t("分类")}">${categoryOptions(preCat || undefined, { spend: true })}</select>
        <input class="pr-trip" name="trip" maxlength="30" list="tripList" value="${esc(preTrip)}" placeholder="${t("行程（旅行）")}" aria-label="${t("所属行程")}">${tripDatalist()}
        <input class="pr-amt" name="amount" type="number" min="0" step="0.01" inputmode="decimal" required placeholder="${t("金额（{cur}）", { cur: Units.region.currency })}" aria-label="${t("金额")}">
        <input class="pr-store" name="store" maxlength="40" list="storeList" value="${esc(lastStore())}" placeholder="${t("商店（可不填）")}" aria-label="${t("商店")}">
        <input class="pr-date" name="date" type="date" value="${today}" max="${today}" aria-label="${t("日期")}">
        ${cardSelectHtml("card_id", undefined, 'class="pr-card"')}
        <label class="check-inline pr-refund" title="${esc(t("退货退款、报销收回：记成负数，统计里按净额算"))}"><input type="checkbox" name="refund"><span>${t("退款 / 报销")}</span></label>
        <button class="btn btn-primary pr-go" type="submit">${t("记一笔")}</button>
      </form>
      <p id="purchaseCardHint" class="card-hint-line">${cardHintHtml("fresh", lastStore(), null)}</p>
      <p class="muted cat-hint">${t("分类怎么选：买回家吃的、用的（会用完）→ 日常储备；买回家长期用的 → 装备；花钱买体验或服务、没有东西留在家里 → 外出与服务。")}</p>
    </section>
    <section class="section" id="spendRecords">${spendRecordsHtml()}</section>`;
}
function spendExportTab() {
  return `${viewAnnualExport()}
    <section class="section">
      <div class="section-head"><h2>${t("打印")}</h2><p>${t("浏览器的打印窗口里也可以另存为 PDF")}</p></div>
      <div class="panel export-grid">
        <label class="export-pick"><span>${t("时间范围")}</span><select id="printRange" data-nosearch>${[3, 6, 12].map((n) => `<option value="${n}" ${n === +state.stats.months ? "selected" : ""}>${t("近 {n} 个月", { n })}</option>`).join("")}</select></label>
        <div class="export-btns"><button type="button" class="btn btn-primary btn-sm" data-action="print-run" data-kind="spend">${t("打印花费统计")}</button></div>
      </div>
      <p class="muted" style="margin:6px 0 0;font-size:13px">${t("要打印筛选后的明细，到“明细”标签里点“打印”。")}</p>
    </section>`;
}

/** 时间条：时间范围 + 月份（分类 / 商店页才有；默认「整段」= 和时间范围一致）+ 合并 / 资本性支出开关，放在标签下面、内容上面，一眼能看到 */
/** 时间条；sd 为空 = 只有时间范围（预算趋势页用，同一个范围值） */
export function timeBarHtml(sd, tab) {
  if (!sd) return `<div class="time-bar"><label class="tb-field"><span>${t("时间范围")}</span>${rangeChipsHtml()}</label></div>`;
  const withMonth = tab === "category" || tab === "stores" || tab === "all";
  const m = state.stats.month && sd.months.includes(state.stats.month) ? state.stats.month : "";
  const monthSel = withMonth ? `<label class="tb-field"><span>${t("月份")}</span><select id="statsMonth" aria-label="${t("选择月份")}" data-nosearch><option value="" ${m ? "" : "selected"}>${t("整段（{r}）", { r: rangeLabel() })}</option>${[...sd.months].reverse().map((x) => `<option value="${x}" ${x === m ? "selected" : ""}>${monthOpt(x)}</option>`).join("")}</select></label>` : "";
  return `<div class="time-bar"><label class="tb-field"><span>${t("时间范围")}</span>${rangeChipsHtml()}</label>${monthSel}${billMergeHtml(sd)}${capitalHtml(sd)}</div>`;
}
/** 当前时间范围的叫法：近 6 个月 / 今年 / 2025 年 */
export function rangeLabel(n = state.stats.months) {
  if (n === "m") return t("本月");
  if (typeof n === "string" && n.startsWith("y:")) { const y = +n.slice(2); return y === thisYear() ? t("今年") : t("{y} 年", { y }); }
  return t("近 {n} 个月", { n: +n || 6 });
}
/** 资本性支出（房产交易、买车整付）：这段时间里有的话显示合计和「含」开关；默认不进图和预算，免得把日常占比拉歪 */
function capitalHtml(sd) {
  if (!sd.capitalN) return "";
  return `<label class="check-inline" title="${esc(t("买房卖房的房款、律师、中介、Title、过户税，买车整付：几年一次、金额巨大，默认不进日常统计和预算；勾上可以一起看"))}"><input type="checkbox" data-action="stats-capital" ${state.stats.includeCapital ? "checked" : ""}><span>${t("含资本性支出 {a}（{n} 笔）", { a: money(sd.capital), n: sd.capitalN })}</span></label>`;
}
/** “同一大类合并显示”开关：只在这段时间里有 2 种以上账单花费时才出现（否则没东西可合并） */
function billMergeHtml(sd) {
  const inRange = new Set(sd.months);
  const used = new Set(state.purchases.filter((p) => p.amount != null && inRange.has(monthKey(p.purchased_at))).map((p) => statCat(p.category, false)).filter(isBill));
  if (used.size < 2) return "";
  return `<label class="check-inline" title="${esc(t("把电费、燃气费、水费、网络…合成“水电气网通讯”，房贷、房租、HOA…合成“住房”等，图里颜色更少"))}"><input type="checkbox" data-action="stats-bill-merge" ${state.stats.billMerge ? "checked" : ""}><span>${t("同一大类账单合并显示")}</span></label>`;
}

export function viewSpend() {
  const r = state.route, onSpendPage = r?.section === "bills" && r?.sub === "spend";
  const tab = onSpendPage ? activeTab(r) : "all";
  const sd = spendData();
  ensureCompareLoaded().then((fresh) => { if (fresh) window.dispatchEvent(new Event("spend-data-loaded")); });   // 前一段在近 400 天之外：读回来再重画
  const ranged = tab === "overview" || tab === "category" || tab === "stores" || tab === "all";
  const body = {
    overview: () => spendOverviewTab(sd, onSpendPage), category: () => spendCategoryTab(sd), stores: () => viewStoreStats(sd.months) || noSpend(),
    records: spendRecordsTab, trips: spendTripsTab, import: bankImportTab, export: spendExportTab,
    all: () => `${spendOverviewTab(sd)}${spendCategoryTab(sd)}${viewStoreStats(sd.months)}${viewAnnualExport()}${spendRecordsTab()}`,
  }[tab]();
  return `
    <section class="section">
      <div class="section-head"><h2>${t("花费")}</h2><div class="head-acts">${onSpendPage ? `<a class="btn btn-primary btn-sm" href="${href("bills", "spend")}?tab=records&add=1${tab === "trips" ? "&cat=travel_flight" : ""}">${t("记一笔花费")}</a>` : ""}</div></div>
      ${onSpendPage ? tabBar(SPEND_TABS, tab, spendHref, t("花费内容")) : ""}
      ${ranged ? timeBarHtml(sd, tab) : ""}
      ${body}
    </section>`;
}

export function viewUsage() {
  const st = state.stats;
  // 消耗趋势
  const cd = consumptionData();
  const freqCats = CATEGORIES.filter((c) => cd.freq[c.id]);
  const freqChart = freqCats.length ? Charts.bars({
    title: t("每周使用记录次数（按分类）"), labels: cd.labels, fmt: (v) => t("{n} 次", { n: Math.round(v) }), showTotals: false,
    series: freqCats.map((c) => ({ name: t(c.name), color: c.color, values: cd.freq[c.id] })),
  }) : "";
  const ranked = state.items.filter((i) => cd.perItem[i.id]).sort((a, b) => cd.perItem[b.id] - cd.perItem[a.id]);
  const selItem = state.items.find((i) => i.id === st.itemId && cd.perItem[i.id]) || ranked[0];
  let itemChart = "";
  if (selItem) {
    const ser = itemSeries(selItem, cd.starts);
    const c = catOf(selItem.category);
    itemChart = Charts.line({
      title: t("{name}每周用量与库存", { name: selItem.name }), labels: cd.labels, fmt: (v) => `${fmt(v)} ${ser.unit}`,
      barSeries: { name: t("每周用量（{u}）", { u: ser.unit }), color: c.color, values: ser.used },
      series: [{ name: t("周末库存（{u}）", { u: ser.unit }), color: "var(--ink)", values: ser.level }],
    });
  }
  return `
    ${state.billsEnabled ? `<div class="panel cta-panel"><div><b>${t("花费统计搬到了 账单 → 花费")}</b><p class="muted">${t("每月花了多少、分类占比、商店、年度报表、补记和花费记录都在那里；这里只看库存的使用趋势。")}</p></div>
      <a class="btn btn-primary" href="#/bills/spend">${t("去看花费")}</a></div>` : ""}
    <section class="section">
      <div class="section-head"><h2>${t("消耗趋势")}</h2><p>${t("最近 12 周，来自家人点“−”的记录")}</p></div>
      ${selItem ? `
      <div class="panel chart-panel"><div class="chart-head"><h3>${t("单品用量与库存")}</h3>
        <select id="statsItem" aria-label="${t("选择物品")}">${ranked.map((i) => `<option value="${i.id}" ${i.id === selItem.id ? "selected" : ""}>${esc(i.name)}（${t("{n} 次", { n: cd.perItem[i.id] })}）</option>`).join("")}</select></div>
        ${itemChart}</div>
      <div class="panel chart-panel"><h3>${t("各分类使用频率")}</h3><p class="muted" style="margin:0 0 6px;font-size:13px">${t("按记录次数统计，不同物品单位不同，不能直接相加数量。")}</p>${freqChart}</div>`
      : `<div class="panel empty"><strong>${t("还没有使用记录")}</strong>${t("在库存页用掉东西时点一下 −，这里就会出现趋势。")}</div>`}
    </section>
    `;
}

/** 我的 → 统计：账单模块开着时只看用量趋势（花费在 账单 → 花费）；关掉账单时花费和用量都在这里 */
export function viewStats() {
  return state.billsEnabled ? viewUsage() : viewSpend() + viewUsage();
}

/* ── 花费记录：搜索 + 分类 / 商店 / 月份筛选 + 排序，按月分组带小计，分批显示 ── */
export const SPEND_SORTS = [["new", "时间：新 → 旧"], ["old", "时间：旧 → 新"], ["high", "金额：高 → 低"], ["low", "金额：低 → 高"], ["name", "名称 A → Z"]];
const PAGE = 20;
const amountOf = (p) => (p.amount != null && (!p.currency || p.currency === Units.region.currency) ? num(p.amount) : 0);
/** 银行导入的一批：{ 批次记录, 旧批次的花费 id 集合 }（记录在预算设置里） */
const batchOf = (id) => { const b = (state.budget?.cat_budgets?._bank_batches || []).find((x) => x.id === id); return b ? { b, ids: new Set(b.ids || []) } : null; };
export function filteredSpend() {
  const f = state.spendFilter, q = f.q.trim().toLowerCase(), bt = f.batch ? batchOf(f.batch) : null;
  let list = state.purchases.filter((p) => {
    if (f.batch && !(p.import_batch === f.batch || (bt && bt.ids.has(p.id)))) return false;
    if (f.cat !== "all" && !catMatches(f.cat, p.category)) return false;
    if (f.month !== "all" && monthKey(p.purchased_at) !== f.month) return false;
    if (f.months?.length && !f.months.includes(monthKey(p.purchased_at))) return false;
    if (f.dmax && new Date(p.purchased_at).getDate() > f.dmax) return false;
    if (f.grp && budgetBridge.groupOf) { const g = budgetBridge.groupOf(p.category, amountOf(p)); if (f.grp === "!bills" ? g === "bills" : g !== f.grp) return false; }   // 预算分组（“!bills” = 除账单以外）   // 从图表钻取来的“近 N 个月”
    if (f.stores?.length && !f.stores.includes(storeKey(storeOf(p)) || "__none__")) return false;   // “其他商店”：一组商店
    if (f.store !== "all" && (f.store === "__none__" ? !!storeOf(p) : storeKey(storeOf(p)) !== f.store)) return false;
    return !q || `${p.name}${storeOf(p)}`.toLowerCase().includes(q);
  });
  const date = (p) => new Date(p.purchased_at).getTime();
  const sorts = { new: (a, b) => date(b) - date(a), old: (a, b) => date(a) - date(b), high: (a, b) => amountOf(b) - amountOf(a) || date(b) - date(a), low: (a, b) => amountOf(a) - amountOf(b) || date(b) - date(a), name: (a, b) => compare(a.name, b.name) || date(b) - date(a) };
  list = list.sort(sorts[f.sort] || sorts.new);
  return list;
}
function spendRow(p) {
  const d = new Date(p.purchased_at), sameYear = d.getFullYear() === new Date().getFullYear();
  const cat = ALL_CATS().find((c) => c.id === p.category) || OTHER_CAT;
  if (state.spendEdit === p.id) return spendEditRow(p);
  // 账单缴费记的花费：名称链接到那条缴费记录的编辑页（改那里，花费会同步）；其余的在这一行里就地编辑
  const pay = state.billPayments.find((x) => x.purchase_id === p.id), bill = pay && state.bills.find((x) => x.id === pay.bill_id);
  const title = p.virtual === "medical" ? `<a class="link-name" href="${href("bills", "onetime")}?bill=${p.bill_id}" title="${esc(t("到医疗账单里看 / 改"))}">${esc(p.name)}</a>`
    : bill ? `<a class="link-name" href="${href("bill", bill.id)}?sec=pay&edit=${pay.id}" title="${esc(t("点一下编辑"))}">${esc(withProperty(bill.property_id, p.name))}</a>`
    : `<button type="button" class="link-name linkbtn" data-action="spend-edit" data-id="${p.id}" title="${esc(t("点一下编辑"))}">${esc(p.name)}</button>`;
  const sel = state.spendSel && !p.virtual ? `<input type="checkbox" class="sel" data-sel="${p.id}" aria-label="${esc(t("选中 {name}", { name: p.name }))}" ${state.spendSel.has(p.id) ? "checked" : ""}>` : "";
  return `<li data-swipe-del="purchase">${sel}
    <span class="badge" style="background:var(--surface-2)">${esc(d.toLocaleDateString(locale(), sameYear ? { month: "numeric", day: "numeric" } : { year: "2-digit", month: "numeric", day: "numeric" }))}</span>
    <div class="grow"><span class="name">${title}</span><small>${esc(`${cat.icon || ""} ${t(cat.name)}`.trim())}${storeOf(p) ? `，${esc(storeOf(p))}` : ""}${p.quantity ? `，${showQty(p.quantity, p.unit || "")}` : ""}${p.created_by && state.members.length > 1 ? `，${esc(memberName(p.created_by) || "")}` : ""}</small></div>
    <b>${p.amount != null && num(p.amount) < 0 ? `<span class="badge b-ok">${t("退款")}</span> ` : ""}${p.amount != null ? esc(Units.money(num(p.amount), p.currency || Units.region.currency)) : `<span class="muted">${t("未填金额")}</span>`}</b>
    ${p.virtual ? "" : `<button type="button" class="btn btn-sm btn-ghost swipe-src" data-action="purchase-del" data-id="${p.id}" aria-label="${esc(t("删除 {name} 这笔记录", { name: p.name }))}">${t("删除")}</button>`}</li>`;
}
/** 就地编辑：名称、分类、金额、商店、日期（数量和单位不动） */
function spendEditRow(p) {
  const day = String(p.purchased_at).slice(0, 10), opts = categoryOptions(p.category, { withOther: true, spend: true });   // 当前分类已在选项里时会自动选中
  const hasCat = opts.includes(`value="${p.category}"`);
  return `<li class="spend-edit"><form id="spendEditForm" data-id="${p.id}" class="form-grid" novalidate>
    <label class="span-2">${t("名称")}<input name="name" required maxlength="60" value="${esc(p.name)}"></label>
    <label>${t("分类")}<select name="category">${hasCat ? "" : `<option value="${esc(p.category)}" selected>${esc(t((ALL_CATS().find((c) => c.id === p.category) || OTHER_CAT).name))}</option>`}${opts}</select></label>
    <label>${t("金额（{cur}）", { cur: p.currency || Units.region.currency })}<input name="amount" type="number" step="0.01" inputmode="decimal" value="${p.amount != null ? num(p.amount).toFixed(2) : ""}"><small>${t("退款 / 报销填负数")}</small></label>
    <label>${t("商店 / 收款方")}<input name="store" maxlength="40" list="storeList" value="${esc(p.store || "")}"></label>
    <label>${t("日期")}<input name="date" type="date" max="${new Date().toISOString().slice(0, 10)}" value="${esc(day)}"></label>
    ${state.cards.length ? `<label>${t("用的哪张卡")}<select name="card_id">${cardOptions(p.card_id || "")}</select></label>` : ""}
    <div class="form-actions span-2"><button type="submit" class="btn btn-primary btn-sm">${t("保存修改")}</button><button type="button" class="btn btn-sm btn-ghost" data-action="spend-edit-cancel">${t("取消")}</button></div></form></li>`;
}
/** 明细页顶部的筛选条：当前生效的筛选一项一个标签，点标签去掉那一项，“清除全部”一键回到全部。从图表 / 名称钻取进来时靠它看清“现在看的是什么” */
function activeFilterChips() {
  const f = state.spendFilter, out = [];
  const monthName = (m) => (lang === "en" ? `${MONTH_EN[+m.slice(5) - 1]} ${m.slice(0, 4)}` : t("{y} 年 {m} 月", { y: m.slice(0, 4), m: +m.slice(5) }));
  const storeName = (k) => (k === "__none__" ? t(STORE_NONE.name) : knownStores().find((x) => storeKey(x) === k) || k);
  if (f.cat !== "all") { const c = f.cat === "bills" ? BILLS_GROUP : [...STAT_CATS(false), ...BILLS_GROUP.families()].find((x) => x.id === f.cat); out.push(["cat", c ? `${c.icon} ${t(c.name)}` : f.cat]); }
  if (f.grp) { const g = budgetBridge.groups.find((x) => x.id === f.grp); out.push(["grp", f.grp === "!bills" ? t("不含账单的花费") : g ? `${g.icon} ${t(g.name)}` : f.grp]); }
  if (f.store !== "all") out.push(["store", storeName(f.store)]);
  if (f.stores?.length) { const n = f.stores.map(storeName); out.push(["stores", n.length <= 3 ? n.join("、") : t("{a} 等 {n} 家", { a: n.slice(0, 2).join("、"), n: n.length })]); }
  if (f.month !== "all") out.push(["month", monthName(f.month)]);
  if (f.months?.length) { const m0 = f.months[0], whole = m0.endsWith("-01") && f.months.every((m) => m.startsWith(m0.slice(0, 4))); out.push(["months", whole ? t("{y} 年", { y: m0.slice(0, 4) }) : t("近 {n} 个月", { n: f.months.length })]); }
  if (f.q.trim()) out.push(["q", `“${f.q.trim()}”`]);
  if (f.batch) { const bt = batchOf(f.batch); out.push(["batch", t("导入批次：{name}", { name: bt ? (bt.b.account || bt.b.file || t("银行导入")) + (bt.b.from ? ` · ${bt.b.from} → ${bt.b.to || bt.b.from}` : bt.b.at ? ` · ${String(bt.b.at).slice(0, 10)}` : "") : f.batch })]); }
  return out;
}
function spendChipsHtml() {
  const chips = activeFilterChips(); if (!chips.length) return "";
  return `<div class="filter-chips" role="group" aria-label="${t("当前筛选")}"><span class="muted">${t("当前筛选")}</span>${chips.map(([k, label]) => `<button type="button" class="chip fchip" data-action="spend-chip-clear" data-k="${k}" aria-label="${esc(t("去掉筛选：{x}", { x: label }))}">${esc(label)} <span aria-hidden="true">✕</span></button>`).join("")}${chips.length > 1 ? `<button type="button" class="btn btn-sm btn-ghost" data-action="spend-chip-clear" data-k="all">${t("清除全部")}</button>` : ""}</div>`;
}
export function clearSpendFilter(k) {
  const f = state.spendFilter, d = { cat: ["cat", "all"], store: ["store", "all"], month: ["month", "all"], q: ["q", ""] };
  if (k === "all") Object.assign(f, { q: "", cat: "all", grp: null, store: "all", stores: null, month: "all", months: null, batch: null });
  else if (k === "grp") f.grp = null; else if (k === "batch") f.batch = null; else if (k === "stores") f.stores = null; else if (k === "months") f.months = null; else if (d[k]) f[d[k][0]] = d[k][1];
  f.limit = 20;
}
/** 筛选条、各个下拉和搜索框都按当前筛选重画（点掉标签后下拉也跟着回到“全部”） */
export function renderSpendRecords() { const h = $("#spendRecords"); if (h) h.innerHTML = spendRecordsHtml(); }

/** 列表本体 + 合计；搜索 / 筛选变化只重画这一块（输入框不丢焦点） */
function spendListHtml() {
  const f = state.spendFilter, all = filteredSpend(), shown = all.slice(0, f.limit);
  if (!all.length) return `<div class="empty"><strong>${t("没有符合条件的记录")}</strong>${t("换个关键词或筛选试试。")}</div>`;
  const byDate = f.sort === "new" || f.sort === "old";
  let out = "", cur = null;
  for (const p of shown) {
    if (byDate) {
      const m = monthKey(p.purchased_at);
      if (m !== cur) {
        cur = m; const inM = all.filter((x) => monthKey(x.purchased_at) === m);
        out += `<li class="rec-month"><b>${esc(lang === "en" ? `${MONTH_EN[+m.slice(5) - 1]} ${m.slice(0, 4)}` : t("{y} 年 {m} 月", { y: m.slice(0, 4), m: +m.slice(5) }))}</b><span class="muted">${esc(t("{n} 笔", { n: inM.length }))} · ${esc(money(inM.reduce((a, x) => a + amountOf(x), 0)))}</span></li>`;
      }
    }
    out += spendRow(p);
  }
  const S = state.spendSel, delN = S ? [...S].filter((id) => all.some((p) => p.id === id)).length : 0;
  const selBar = S ? `<div class="sel-bar" role="region" aria-label="${esc(t("多选删除"))}"><b id="selCount">${t("已选 {n} 笔", { n: delN })}</b>
      <button type="button" class="btn btn-sm btn-ghost" data-action="spend-sel-all">${t("全选这 {n} 笔", { n: all.filter((p) => !p.virtual).length })}</button>
      <button type="button" class="btn btn-sm btn-ghost" data-action="spend-sel-none">${t("清空")}</button>
      <button type="button" class="btn btn-sm btn-danger-ghost" data-action="spend-sel-del" ${delN ? "" : "disabled"}>${t("删除所选")}</button>
      <button type="button" class="btn btn-sm btn-ghost" data-action="spend-sel-toggle">${t("退出多选")}</button>
      <small class="muted" style="flex-basis:100%">${t("先用上面的筛选（月份、商店、分类、批次）缩小范围，再全选；删除前会再确认一次。")}</small></div>` : "";
  return `${selBar}<ul class="restock-list rec-list${S ? " selecting" : ""}">${out}</ul>
    ${all.length > shown.length ? `<div class="form-actions" style="justify-content:center"><button type="button" class="btn btn-ghost" data-action="spend-more">${t("再显示 {n} 笔（还有 {m} 笔）", { n: Math.min(PAGE, all.length - shown.length), m: all.length - shown.length })}</button></div>` : ""}`;
}
function spendSummary() {
  const all = filteredSpend();
  return `${t("{n} 笔", { n: all.length })} · ${money(all.reduce((a, p) => a + amountOf(p), 0))}`;
}
export function renderSpendList() {
  const host = $("#spendList"); if (!host) return;
  host.innerHTML = spendListHtml();
  const sum = $("#spendSum"); if (sum) sum.textContent = spendSummary();
  const chips = $("#spendChips"); if (chips) chips.innerHTML = spendChipsHtml();
}
function spendRecordsHtml() {
  const f = state.spendFilter, ps = state.purchases;
  if (!ps.length) return `<div class="section-head"><h2>${t("花费记录")}</h2></div><div class="panel empty"><strong>${t("还没有花费记录")}</strong>${t("采购清单点“已买到”、录入购物或上面的补记，都会出现在这里。")}</div>`;
  const months = [...new Set(ps.map((p) => monthKey(p.purchased_at)))].sort().reverse();
  const stores = knownStores(), hasNone = ps.some((p) => !storeOf(p));
  const cats = STAT_CATS(false).filter((c) => ps.some((p) => statCat(p.category, false) === c.id));   // 下拉始终列具体种类，不受“合并显示”开关影响
  const ti = cats.findIndex((c) => c.id === "travel");
  if (ti >= 0) cats.splice(ti + 1, 0, ...TRAVEL_CATS.filter((c) => ps.some((p) => p.category === c.id)));   // “旅行出行”后面列有花费的具体类型（机票、住宿…），可以只看某一类
  for (const gid of ["dining", "vehicle", "life", "work", "admin"]) {   // 这几组后面列有花费的具体类型（交通、燃油、娱乐…），可以只看某一类
    const gi = cats.findIndex((c) => c.id === gid); if (gi < 0) continue;
    cats.splice(gi + 1, 0, ...[...LIFE_CATS, ...WORK_CATS, VEHICLE_FUEL].filter((c) => statCat(c.id, false) === gid && ps.some((p) => p.category === c.id)));
  }
  const firstBill = cats.findIndex((c) => isBill(c.id));
  if (cats.filter((c) => isBill(c.id)).length > 1) cats.splice(firstBill, 0, BILLS_GROUP);   // 多种账单时多一个“全部账单”总筛选，排在各具体种类前
  const opt = (v, label, cur) => `<option value="${esc(v)}" ${cur === v ? "selected" : ""}>${esc(label)}</option>`;
  const mo = (m) => (lang === "en" ? `${MONTH_EN[+m.slice(5) - 1]} ${m.slice(0, 4)}` : t("{y} 年 {m} 月", { y: m.slice(0, 4), m: +m.slice(5) }));
  return `<div class="section-head"><h2>${t("花费记录")}</h2><div class="head-acts"><span id="spendSum" class="muted">${esc(spendSummary())}</span><button type="button" class="btn btn-sm btn-ghost" data-action="spend-sel-toggle">${state.spendSel ? t("退出多选") : t("多选删除")}</button><button type="button" class="btn btn-sm btn-ghost" data-action="print-run" data-kind="spend" data-filtered="1">${t("打印")}</button></div></div>
    <div class="panel">
      <div class="filter-bar"><div id="spendChips">${spendChipsHtml()}</div>
      <div class="toolbar">
        <input type="search" id="spendSearch" placeholder="${t("搜索名称或商店")}" value="${esc(f.q)}" aria-label="${t("搜索花费记录")}">
        <select id="spendCat" aria-label="${t("按分类筛选")}">${opt("all", t("全部分类"), f.cat)}${(f.cat.startsWith("billfam_") ? BILLS_GROUP.families().filter((c) => c.id === f.cat) : []).map((c) => opt(c.id, `${c.icon} ${t(c.name)}`, f.cat)).join("")}${cats.map((c) => opt(c.id, `${c.icon} ${t(c.name)}`, f.cat)).join("")}</select>
        <select id="spendStore" aria-label="${t("按商店筛选")}">${opt("all", t("全部商店 / 收款方"), f.store)}${stores.map((x) => opt(storeKey(x), x, f.store)).join("")}${hasNone ? opt("__none__", t("未填写商店"), f.store) : ""}</select>
        <select id="spendMonth" aria-label="${t("按月份筛选")}">${opt("all", t("全部月份"), f.month)}${months.map((m) => opt(m, mo(m), f.month)).join("")}</select>
        <select id="spendSort" aria-label="${t("排序")}">${SPEND_SORTS.map(([v, l]) => opt(v, t(l), f.sort)).join("")}</select>
      </div></div>
      <div id="spendList">${spendListHtml()}</div>
      <p class="muted" style="margin:8px 0 0;font-size:12.5px">${t("这里是近 400 天的记录。")} ${t("删一笔：手机上把那一行向左滑；电脑上鼠标移到行上，右边出现「删除」。要删很多笔用「多选删除」。")}</p>
    </div>`;
}

/* ── 商店统计与年度报表 ── */
export const STORE_COLORS = ["#2c6a57", "#d4694c", "#3b7fc4", "#b07a1a", "#7563c0", "#c75a85"];
export const STORE_REST = { name: "其他商店", color: "#8a948f" }, STORE_NONE = { name: "未填写商店", color: "#c3cbc6" };
export const cleanStore = (v) => (v || "").trim().replace(/\s+/g, " ").slice(0, 40) || null;
export const lastStore = () => { try { return localStorage.getItem("hmh-last-store") || ""; } catch { return ""; } };
export const rememberStore = (v) => { try { localStorage.setItem("hmh-last-store", v); } catch { /* 忽略 */ } };
// 商店名大小写、空格不同视为同一家（Costco 与 costco）
export const storeKey = (v) => (v || "").trim().toLowerCase();
/** 商店名：按记下来的（账单缴费时就是当时的收款方，中途换了收款方，历史不改写）；没记的账单 / 订阅 / 保险用账单的收款方（没填就用账单名），统计里就不会都归到“未填写商店” */
export function storeOf(p) {
  const s = (p.store || "").trim(); if (s) return s;
  if (!String(p.category || "").startsWith("bill_")) return "";
  const b = state.bills.find((x) => x.name === p.name);
  return (b?.payee || "").trim() || String(p.name || "").trim();
}
export function knownStores() {
  const m = new Map();
  for (const p of state.purchases) { const n = storeOf(p); if (n && !m.has(storeKey(n))) m.set(storeKey(n), n); }
  return [...m.values()].sort(compare);
}
export const storeDatalist = () => `<datalist id="storeList">${knownStores().map((x) => `<option value="${esc(x)}">`).join("")}</datalist>`;

export function viewStoreStats(months, month = state.stats.month) {
  const cur = Units.region.currency, inRange = new Set(months), sel = month && inRange.has(month) ? month : "";   // sel = 只看某个月（占比和表格）；月度柱状图始终画整段
  const agg = new Map();   // key → { name, total, count, byMonth }
  for (const p of state.purchases) {
    if (p.amount == null || (p.currency && p.currency !== cur)) continue;
    const m = monthKey(p.purchased_at);
    if (!inRange.has(m)) continue;
    const k = storeKey(storeOf(p)) || "__none__";
    const a = agg.get(k) || { name: storeOf(p) || t(STORE_NONE.name), total: 0, count: 0, byMonth: {}, countByMonth: {} };
    a.byMonth[m] = (a.byMonth[m] || 0) + num(p.amount); a.countByMonth[m] = (a.countByMonth[m] || 0) + 1;
    if (!sel || m === sel) { a.total += num(p.amount); a.count++; }
    agg.set(k, a);
  }
  for (const [k, a] of [...agg.entries()]) if (sel && !a.count) agg.delete(k);   // 选了月份：那个月没花过的商店不列
  if (!agg.size) return "";
  const named = [...agg.entries()].filter(([k]) => k !== "__none__").map(([, v]) => v).sort((a, b) => b.total - a.total);
  const keyOf = new Map([...agg.entries()].map(([k, v]) => [v, k]));
  const groups = named.slice(0, STORE_COLORS.length).map((v, i) => ({ ...v, color: STORE_COLORS[i], keys: [keyOf.get(v)] }));
  const rest = named.slice(STORE_COLORS.length);
  if (rest.length) groups.push(rest.reduce((g, v) => {
    g.total += v.total; g.count += v.count; g.keys.push(keyOf.get(v));
    for (const [m, x] of Object.entries(v.byMonth)) g.byMonth[m] = (g.byMonth[m] || 0) + x;
    return g;
  }, { ...STORE_REST, name: t(STORE_REST.name), total: 0, count: 0, byMonth: {}, keys: [], members: rest, isRest: true }));
  if (agg.has("__none__")) groups.push({ ...agg.get("__none__"), color: STORE_NONE.color, keys: ["__none__"] });
  const total = groups.reduce((a, g) => a + g.total, 0);
  // 点一个商店 / “其他商店”：跳到明细，套上这家（或这一组）商店；month 为空 = 整个时间范围
  const gDrill = (g, month) => dq({ ...(g.keys.length === 1 ? { store: g.keys[0] } : { stores: encKeys(g.keys) }), ...(month ? { month } : { range: months.length }) });

  const donut = Charts.donut({
    title: sel ? t("{month}各商店花费占比", { month: monthLabel(sel) }) : t("{r}各商店花费占比", { r: rangeLabel() }), fmt: money, center: money(total, true),
    items: groups.map((g) => ({ name: g.name, color: g.color, value: g.total, drill: gDrill(g, sel) })),
  });
  const bars = Charts.bars({
    title: t("各商店月度花费"), labels: months.map(monthLabel), fmt: money,
    series: groups.map((g) => ({ name: g.name, color: g.color, values: months.map((m) => g.byMonth[m] || 0) })),
    drill: (k, i) => gDrill(groups[k], months[i]), legendDrill: (k) => gDrill(groups[k]),
  });
  const rows = groups.map((g) => `<tr><th scope="row"><i class="sw" style="background:${g.color}"></i><button type="button" class="link-name linkbtn" data-drill="${esc(gDrill(g, sel))}" title="${esc(t("查看明细"))}">${esc(g.name)}</button>${g.isRest ? ` <small class="muted">${t("{n} 家", { n: g.members.length })}</small>` : ""}
    <td>${g.count}</td><td>${esc(money(g.total))}</td><td>${esc(money(g.total / g.count))}</td><td>${Math.round((g.total / total) * 100)}%</td></tr>`).join("");
  // “其他商店”里到底有哪些：展开列出每一家，每家也能点进明细
  const rg = groups.find((g) => g.isRest);
  const restDetail = rg ? `<details class="rest-detail"><summary><span class="rd-text"><b>${t("“其他商店”包含 {n} 家", { n: rg.members.length })}</b><small>${t("花费较少的商店合并在一起；点开看每一家，再点收起")}</small></span><span class="mch" aria-hidden="true">›</span></summary>
    <ul class="rest-list">${[...rg.members].sort((a, b) => b.total - a.total).map((v) => `<li class="ch-hit-row"${hitAttrs(dq(sel ? { store: keyOf.get(v), month: sel } : { store: keyOf.get(v), range: months.length }), v.name)}><span class="grow">${esc(v.name)}</span><small class="muted">${t("{n} 笔", { n: v.count })}</small><b>${esc(money(v.total))}</b><u aria-hidden="true">›</u></li>`).join("")}</ul></details>` : "";
  return `<section class="section">
    <div class="section-head"><h2>${t("按商店 / 收款方统计")}</h2><p>${sel ? monthLabel(sel) : rangeLabel()}${t("；账单、订阅、保险按收款方；名称不区分大小写")}</p></div>
    <div class="panel chart-panel"><h3>${t("在哪里花得最多")}</h3>${donut}
      <div class="ch-scroll"><table class="store-table"><thead><tr><th scope="col">${t("商店 / 收款方")}</th><th scope="col">${t("次数")}</th><th scope="col">${t("合计")}</th><th scope="col">${t("平均每次")}</th><th scope="col">${t("占比")}</th></tr></thead><tbody>${rows}</tbody></table></div>
      ${restDetail}${DRILL_HINT()}
    </div>
    <div class="panel chart-panel"><h3>${t("每月在各商店的花费")}</h3>${bars}${DRILL_HINT()}</div>
  </section>`;
}

export function viewAnnualExport() {
  const y = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => y - i);
  return `<section class="section">
    <div class="section-head"><h2>${t("年度花费报表")}</h2><p>${t("导出 CSV，可用 Excel、Numbers 或 Google 表格打开")}</p></div>
    <div class="panel export-grid">
      <label class="export-pick"><span>${t("年份")}</span><select id="csvYear" data-nosearch>${years.map((v) => `<option value="${v}">${t("{y} 年", { y: v })}</option>`).join("")}</select></label>
      <div class="export-btns"><button type="button" class="btn btn-primary btn-sm" data-action="csv-summary">${t("导出汇总（月份 × 分类、商店）")}</button>
      <button type="button" class="btn btn-sm" data-action="csv-detail">${t("导出明细（每一笔）")}</button></div>
    </div>
  </section>`;
}

// CSV：加 UTF-8 BOM（Excel 打开中文不乱码）；以 = + - @ 开头的文本加 ' 前缀，防止表格公式注入
export function csvCell(v) {
  if (v == null) return "";
  if (typeof v === "number") return String(v);
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export const toCsv = (rows) => "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");

export function download(name, text, type = "text/csv;charset=utf-8") {
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export const ymd = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export async function exportAnnual(kind) {
  const year = +($("#csvYear")?.value || new Date().getFullYear());
  // 按本地时间：当年 1 月 1 日 0 点到次年 1 月 1 日 0 点
  const from = new Date(year, 0, 1).toISOString(), to = new Date(year + 1, 0, 1).toISOString();
  const list = [...(await Store.listPurchasesRange(from, to)), ...medicalVirtuals().filter((p) => p.purchased_at >= from && p.purchased_at < to)];   // 医疗付款也在年度报表里
  if (!list.length) return toast(t("{y} 年没有采购记录", { y: year }));
  const catName = (id) => t((ALL_CATS().find((c) => c.id === id) || OTHER_CAT).name);
  const r2 = (v) => Math.round(v * 100) / 100;
  const hh = state.household?.name || t("家庭");
  const fileBase = `${hh.replace(/[\\/:*?"<>|（）()\s]/g, "")}-${year}`;

  if (kind === "detail") {
    const rows = [[t("日期"), t("物品"), t("分类"), t("商店 / 收款方"), t("数量"), t("单位"), t("金额"), t("货币"), t("关联库存")]];
    for (const p of list) {
      rows.push([ymd(p.purchased_at), p.name, catName(p.category), storeOf(p), p.quantity == null ? "" : num(p.quantity), p.unit ? t(p.unit) : "",
        p.amount == null ? "" : num(p.amount), p.currency || "", p.item_id ? t("是") : t("否")]);
    }
    download(`${fileBase}-${t("采购明细")}.csv`, toCsv(rows));
    return toast(t("已导出 {n} 笔明细", { n: list.length }));
  }

  // 汇总：只统计当前地区货币，其他币种和未填金额的笔数在文末说明
  const cur = Units.region.currency;
  const valid = list.filter((p) => p.amount != null && (!p.currency || p.currency === cur));
  const skipped = list.filter((p) => p.amount != null && p.currency && p.currency !== cur).length;
  const noAmount = list.filter((p) => p.amount == null).length;
  const cats = STAT_CATS();
  const grid = Array.from({ length: 12 }, () => Object.fromEntries(cats.map((c) => [c.id, 0])));
  const stores = new Map();
  for (const p of valid) {
    const m = new Date(p.purchased_at).getMonth();
    const c = statCat(p.category);
    grid[m][c] += num(p.amount);
    const k = storeKey(storeOf(p)) || "__none__";
    const st = stores.get(k) || { name: storeOf(p) || t(STORE_NONE.name), count: 0, total: 0 };
    st.count++; st.total += num(p.amount); stores.set(k, st);
  }
  const used = cats.filter((c) => grid.some((g) => g[c.id] > 0));
  const catYear = (id) => grid.reduce((a, g) => a + g[id], 0);
  const yearTotal = valid.reduce((a, p) => a + num(p.amount), 0);
  const rows = [
    [t("{hh} {y} 年采购花费汇总", { hh, y: year })],
    [t("货币：{cur}", { cur }), t("导出时间：{d}", { d: new Date().toLocaleString(locale()) })],
    [],
    [t("月份"), ...used.map((c) => t(c.name)), t("合计")],
  ];
  grid.forEach((g, i) => rows.push([t("{m}月", { m: i + 1 }), ...used.map((c) => r2(g[c.id])), r2(used.reduce((a, c) => a + g[c.id], 0))]));
  rows.push([t("全年"), ...used.map((c) => r2(catYear(c.id))), r2(yearTotal)]);
  rows.push([t("占比"), ...used.map((c) => (yearTotal ? `${r2((catYear(c.id) / yearTotal) * 100)}%` : "")), "100%"]);
  rows.push([], [t("商店"), t("次数"), t("合计"), t("平均每次"), t("占比")]);
  [...stores.values()].sort((a, b) => b.total - a.total).forEach((st) =>
    rows.push([st.name, st.count, r2(st.total), r2(st.total / st.count), yearTotal ? `${r2((st.total / yearTotal) * 100)}%` : ""]));
  if (skipped || noAmount) rows.push([], [t("说明：{a}{b}明细表中仍可查看。", { a: skipped ? t("{n} 笔非 {cur} 记录未计入；", { n: skipped, cur }) : "", b: noAmount ? t("{n} 笔未填金额；", { n: noAmount }) : "" })]);
  download(`${fileBase}-${t("花费汇总")}.csv`, toCsv(rows));
  toast(t("已导出 {y} 年汇总，共 {n} 笔", { y: year, n: valid.length }));
}
