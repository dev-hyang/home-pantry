/* 收入 → 收支对比：收入 vs 消费 vs 净现金流 / 储蓄率的组合图（双周 / 月 / 季 / 年）和它用的现金流数据。 */
import { OWN_XFER } from "../stats/report.js";
import { R, controlsHtml, spendDonut } from "./senders-tab.js";
import { UNITS, bucketKey, inc, incomeIn, periodKeys, periodLabel, personOk, spanWindow } from "./logic.js";
import { addDay, roll } from "./rollup.js";
import { aiPanel, kpiRow } from "./export-ai.js";
import { bucketOf, l2IdOf } from "../core/taxonomy.js";
import { num } from "../core/util.js";
import { splitRecord } from "../core/income-taxonomy.js";
import { t } from "../core/i18n.js";
import { R2, cur, empty, flowCharts, kindDonut, lineTable } from "./shared.js";

/* ───────────── 收支对比用的现金流：收入（认定，逐笔，任意周期）+ 消费 / 投资（ledger_rollup 的花费一侧，按月或双周） ─────────────
 * 消费 = 日常 + 住房（和花费页「含住房」同一口径，js/core/taxonomy.js 的 bucketOf）；投资 = 性质是投资的现金流出；其他流出 = 财务及其他 + 资本性支出。
 * 花费不分人，只在选「全家」时有。 */
export function cashflow({ range, from, to, unit, person, win = null }) {
  const I = inc(), w = win || spanWindow(range), keys = periodKeys(w.from, w.to, unit), zero = () => Object.fromEntries(keys.map((k) => [k, 0]));
  const income = zero(), capIn = zero(), capBook = zero(), spend = zero(), invest = zero(), other = zero(), repaid = zero(), byKind = {}, spendCats = {};
  const rows = incomeIn(w.from, w.to, person);
  for (const r of rows) {
    const s = splitRecord(r), k = bucketKey(r.received_on, unit);
    income[k] += s.income; capIn[k] += s.cap; if (s.capLeaf !== OWN_XFER) capBook[k] += s.cap;   // 账面：从储蓄账户转入不算（自己账户之间）
    if (s.income) { const sk = I.merge ? `g:${s.l1}` : r.kind; byKind[sk] = (byKind[sk] || 0) + s.income; }
  }
  for (const p of I.rep) {
    if (p.paid_on < w.from || p.paid_on > w.to) continue;
    const rec = I.rec.find((r) => r.id === p.record_id); if (!rec || !personOk(rec, person)) continue;
    repaid[bucketKey(p.paid_on, unit)] += p.amount;
  }
  const lunit = unit === "biweek" ? "biweek" : "month", list = person === "all" ? roll("ledger", w.from, addDay(w.to, 1), lunit) : null;
  if (list) for (const x of list) {
    if (x.source === "income" || (x.currency && x.currency !== cur())) continue;
    const k = lunit === "biweek" ? x.period : bucketKey(`${x.period}-01`, unit); if (!(k in spend)) continue;
    const b = bucketOf(x.category, x.nature), amt = -num(x.amount_sum);
    if (b === "living" || b === "housing") { spend[k] += amt; const c = l2IdOf(x.category); (spendCats[c] ||= zero())[k] += amt; }
    else if (b === "investment") invest[k] += amt;
    else if (b) other[k] += amt;
  }
  const hasSpend = person === "all" && !!list, hasRepaid = Object.values(repaid).some((v) => v > 0);
  // incNet 收入结余 = 收入 − 消费 − 其他流出（税、保险、利息、奉献、资本性）− 投资；net 净现金流（账面）= 收入结余 + 资本流入（全部流入 − 全部流出）；
  // saved = 存下来的（含投资），储蓄率用它（只看收入）
  const lines = keys.map((k) => { const i = R2(income[k]), s = hasSpend ? R2(spend[k]) : null, o = hasSpend ? R2(other[k]) : null, v = hasSpend ? R2(invest[k]) : null;
    return { key: k, label: periodLabel(k, unit), income: i, capIn: R2(capIn[k]), spend: s, invest: v, other: o, repaid: R2(repaid[k]), saved: s == null ? null : R2(i - s - o), incNet: s == null ? null : R2(i - s - o - v), capBook: R2(capBook[k]), net: s == null ? null : R2(i - s - o - v + capBook[k]), noSpend: hasSpend && i > 0 && !s && !o && !v }; });
  const tsum = (f) => R2(lines.reduce((a, l) => a + (f(l) || 0), 0));
  const tot = { income: tsum((l) => l.income), capIn: tsum((l) => l.capIn), spend: hasSpend ? tsum((l) => l.spend) : null, invest: hasSpend ? tsum((l) => l.invest) : null, other: hasSpend ? tsum((l) => l.other) : null, repaid: tsum((l) => l.repaid) };
  tot.saved = tot.spend == null ? null : R2(tot.income - tot.spend - tot.other); tot.incNet = tot.spend == null ? null : R2(tot.saved - tot.invest); tot.capBook = tsum((l) => l.capBook); tot.capOwn = R2(tot.capIn - tot.capBook); tot.net = tot.spend == null ? null : R2(tot.incNet + tot.capBook);   // 还款是钱从账户里出去了，已经算在花费里（记还款时同时记一笔花费，或银行导入）：这里的「还款」只是告诉你其中有多少
  const noSpend = lines.filter((l) => l.noSpend).map((l) => l.label);   // 有收入、却一笔花费都没有：多半是那段对账单还没导入，净现金流会偏高
  return { w, keys, lines, tot, byKind, rows, hasSpend, hasRepaid, spendCats, unit, person, noSpend, loading: person === "all" && !list };
}
/* ───────────── 收支对比：收入 vs 消费 vs 净现金流 / 储蓄率（组合图），双周 / 月 / 季 / 年 ───────────── */
export function reportTab() {
  const I = inc(), r = R();
  if (!I.rec.length) return empty();
  const cf = cashflow(r), person = r.person;
  const note = person !== "all" ? `<p class="muted small" role="status">${t("花费不分人：选「全家」才会显示消费、净现金流和储蓄率。")}</p>` : cf.loading ? `<p class="muted small" role="status">${t("正在读取花费…")}</p>` : "";
  return `${controlsHtml(r, cf)}${note}${kpiRow(cf)}${flowCharts(cf, t("每{u}收入 vs 消费", { u: t((UNITS.find((u) => u[0] === r.unit) || [])[1]) }))}${lineTable(cf)}
    <div class="ix-two">${kindDonut(cf)}${spendDonut(cf)}</div>${aiPanel(cf)}`;
}
