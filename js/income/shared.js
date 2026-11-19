/* 收入各页签共用的小件：颜色、金额 / 比例格式、空状态、下拉选项、钻取链接、KPI 卡、图表小件。从 views.js 抽出来，各页签依赖这里而不是互相依赖。 */
import { ROLL, addDay, hooks, iso, roll } from "./rollup.js";
import { adults, canSeeAll, groupList, groupOf, inc, kindLabel, kindOf, statKinds } from "./logic.js";
import { esc, money, moneyExact } from "../core/util.js";
import { href } from "../core/router.js";
import { liveNetWorth, thisMonth } from "../bills/nw-logic.js";
import { monthChange, trendPoints } from "../stats/net-worth.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";
import { acctById, acctLabel } from "../bills/card-picker.js";
import { dq } from "../stats/spend-drill.js";

/** 分组柱（收入 / 消费…并排）超过 12 期就太挤：改画折线（2026-11 统一规则） */
export const GROUPED_MAX = 12;
export const incomeHref = (id) => `${href("bills", "income")}${id === "overview" ? "" : `?tab=${id}`}`;
export const GREEN = "#2c6a57", RED = "#d4694c", BLUE = "#3b7fc4", TEAL = "#24897d", SLATE = "#64748b";
export const R2 = (v) => Math.round(v * 100) / 100;
/** 用户自己点的操作（展开 / 编辑 / 取消 / 删除…）要立刻重画：main.js 的 render(false) 只给后台刷新用，页面上只要有任何 <form>（明细页底部的「类型管理」就有一个）它就直接跳过，点行编辑就「没反应也没报错」 */
export const redraw = () => hooks.render(true);
export const cur = () => Units.region.currency;
/** 收支总览上的净资产小卡片：现在的净资产 + 比上月，点进 财务 → 净资产（只给有财务权限的人；没执行 059 不显示） */
export function netWorthCard() {
  if (!state.nwOk || !canSeeAll()) return "";
  const r = liveNetWorth(), m = thisMonth(), mom = monthChange(trendPoints(state.nwSnapshots, cur(), { live: r, month: m }), m);
  const sgn = (v) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${fmtMoney(Math.abs(v))}`;
  return `<a class="panel nw-card" href="${href("bills", "networth")}"><span>📈 ${t("净资产")}</span><b class="${r.netWorth < 0 ? "down" : ""}">${fmtMoney(r.netWorth)}</b>
    <small class="muted">${mom == null ? t("资产 {a} · 负债 {l}", { a: fmtMoney(r.assetsTotal, true), l: fmtMoney(r.liabilitiesTotal, true) }) : t("比上月 {d}", { d: sgn(mom) })}</small><span class="mch" aria-hidden="true">›</span></a>`;
}
export const rollAsync = async (kind, from, to, unit = "month") => { roll(kind, from, to, unit); await ROLL.get(`${kind}|${from}|${to}|${unit}`)?.p; return ROLL.get(`${kind}|${from}|${to}|${unit}`)?.rows || []; };
export const staleAll = (kinds) => { for (const [k, e] of ROLL) if (kinds.includes(k.split("|")[0])) e.stale = true; };
/* ───────────── 公共小件 ───────────── */
export const kindBadge = (id) => { const k = kindOf(id); return `<span class="ix-kind" style="--k:${k.color}">${k.icon} ${esc(kindLabel(id))}</span>`; };
/* ── 钻取：图表色块、图例、数字卡片、表格行点一下 → 「明细」并套上对应筛选（类型 / 日期段 / 成员 / 账户）。
 * 和花费图表同一套 data-drill（查询串）；带 inc=1 的由 main.js 的 drillTo 送到 收入 → 明细，applyIncomeDrill 套筛选。 */
export const incDrill = (o) => dq({ inc: 1, ...o, person: o.person && o.person !== "all" ? o.person : "" });
const monthEnd = (y, m) => iso(new Date(y, m, 0));
/** 一个周期（图表上的一根柱子）对应的日期段，夹在时间窗口里 */
export function periodWin(k, unit, w) {
  let from, to;
  if (unit === "year") { from = `${k}-01-01`; to = `${k}-12-31`; }
  else if (unit === "quarter") { const y = +k.slice(0, 4), q = +k.slice(-1); from = `${y}-${String(q * 3 - 2).padStart(2, "0")}-01`; to = monthEnd(y, q * 3); }
  else if (unit === "month") { from = `${k}-01`; to = monthEnd(+k.slice(0, 4), +k.slice(5, 7)); }
  else { from = k; to = addDay(k, 13); }
  return { from: from < w.from ? w.from : from, to: to > w.to ? w.to : to };
}
/** 花费那一列点一下：到花费明细（按月 / 季 / 年；双周没有对应筛选，不可点） */
const spendDrillOf = (k, unit) => (unit === "month" ? dq({ month: k }) : unit === "year" ? dq({ year: k }) : unit === "quarter" ? dq({ mlist: [0, 1, 2].map((i) => `${k.slice(0, 4)}-${String(+k.slice(-1) * 3 - 2 + i).padStart(2, "0")}`).join(",") }) : null);
export const DRILL_HINT = () => `<p class="muted drill-hint">${t("点图里的色块、图例或数字，可以查看对应的收入明细。")}</p>`;
/** 收支对比 / 导出的时间条里的勾选：同一个一级合并显示（记在本机） */
export function togglesHtml(cf) {
  const I = inc(), used = [...new Set(cf.rows.map((r) => r.kind))];
  const multi = groupList().some((g) => used.filter((k) => groupOf(k).id === g.id).length > 1);
  return multi || I.merge ? `<label class="check-inline" title="${esc(t("基本工资、奖金、福利合成「工作收入」，利息、股息合成「投资收益」等，图里颜色更少"))}"><input type="checkbox" data-inc-tog="merge" ${I.merge ? "checked" : ""}><span>${t("同一个一级合并显示")}</span></label>` : "";
}
export const personOptions = (sel, { all = false } = {}) => `${all ? `<option value="all" ${sel === "all" ? "selected" : ""}>${t("全家")}</option>` : ""}<option value="none" ${sel === "none" ? "selected" : ""}>${t(all ? "未指定的" : "未指定 / 全家")}</option>${adults().map((p) => `<option value="${p.id}" ${sel === p.id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}`;
export const selOpts = (list, sel) => list.map(([v, l]) => `<option value="${esc(v)}" ${v === sel ? "selected" : ""}>${esc(t(l))}</option>`).join("");
export const yearsOf = () => [...new Set(inc().rec.map((r) => r.received_on.slice(0, 4)).concat(String(new Date().getFullYear())))].sort().reverse();
export const empty = () => `<div class="panel empty"><strong>${t("还没有收入记录")}</strong>${t("点右上角「记一笔收入」；在「财务 → 对账单」导入对账单时，工资、电汇、Zelle 转入这些入账会单独列出来，勾上就能一起导入。")}</div>`;
export const kpi = (label, val, sub = "") => `<div class="kpi"><span>${esc(label)}</span><b>${val}</b>${sub ? `<small>${sub}</small>` : ""}</div>`;
export const rate = (n, i) => (i > 0 && n != null ? `${Math.round((n / i) * 100)}%` : "—");
export const pctOf = (r) => (r == null ? "—" : `${Math.round(r * 100)}%`);
export const fmtMoney = (v, short) => (short ? money(v, true) : moneyExact(v));
   // 不带 short：记录和合计都显示到分；short 只给图表中心、月均这类紧凑处
/** 记录上的入账账户：登记过的账户（account_id）显示「图标 名称 ••尾号」，否则显示原来的文字 */
export const acctShow = (r) => { const c = r.account_id && acctById(r.account_id); return c ? acctLabel(c) : r.account || ""; };
/** 收入 / 消费分组柱 + 差额（结余 / 超支）柱 + 趋势线（收支对比用） */
export function flowCharts(cf, title) {
  if (!window.Charts || !cf.lines.length) return "";
  const labels = cf.lines.map((l) => l.label), f = (v, s) => fmtMoney(v, s);
  // 没过完的周期（本月 / 本季…）或只盖住一部分的：图上浅色
  const partial = cf.lines.map((l) => { const nat = periodWin(l.key, cf.unit, { from: "0000-01-01", to: "9999-12-31" }); return nat.from < cf.w.from || nat.to > cf.w.to; });
  const drillOf = (k, i) => { const key = cf.lines[i].key; return k === 0 ? incDrill({ ...periodWin(key, cf.unit, cf.w), person: cf.person, ex: 1 }) : k === 1 ? spendDrillOf(key, cf.unit) : null; };
  if (cf.lines.length > GROUPED_MAX) {   // 期数多：并排柱子太挤，收入 / 消费 / 其他流出 / 投资画成折线；净现金流仍是一期一根柱子
    const flow = window.Charts.line({ labels, title, fmt: f, partial, drill: drillOf, legendDrill: (k) => (k === 0 ? incDrill({ ...cf.w, person: cf.person, ex: 1 }) : null),
      series: [{ name: t("收入"), color: GREEN, values: cf.lines.map((l) => l.income) }, ...(cf.hasSpend ? [{ name: t("消费（日常 + 住房）"), color: RED, values: cf.lines.map((l) => Math.max(0, l.spend)) },
        ...(cf.lines.some((l) => l.other > 0) ? [{ name: t("其他流出（税、保险、利息、奉献、资本性）"), color: "#8a5fb0", values: cf.lines.map((l) => Math.max(0, l.other)) }] : []),
        ...(cf.lines.some((l) => l.invest > 0) ? [{ name: t("投资"), color: TEAL, values: cf.lines.map((l) => Math.max(0, l.invest)) }] : [])] : [])] });
    const net = cf.hasSpend ? window.Charts.bars({ labels, title: t("净现金流"), stacked: true, showTotals: false, fmt: f, partial,
      series: [{ name: t("结余"), color: BLUE, values: cf.lines.map((l) => Math.max(0, l.net)) }, { name: t("超支"), color: "#b23b3b", values: cf.lines.map((l) => Math.max(0, -l.net)) }] }) : "";
    return `<div class="panel chart-panel"><h3>${t("收入 vs 消费")}</h3>${flow}</div>${net ? `<div class="panel chart-panel"><h3>${t("净现金流：结余 / 超支")}</h3>${net}</div>` : ""}`;
  }
  const grouped = window.Charts.bars({ labels, title, stacked: false, showTotals: false, fmt: f, partial,
    drill: (k, i) => { const key = cf.lines[i].key; return k === 0 ? incDrill({ ...periodWin(key, cf.unit, cf.w), person: cf.person, ex: 1 }) : spendDrillOf(key, cf.unit); },
    legendDrill: (k) => (k === 0 ? incDrill({ ...cf.w, person: cf.person, ex: 1 }) : null),
    series: [{ name: t("收入"), color: GREEN, values: cf.lines.map((l) => l.income) }, ...(cf.hasSpend ? [{ name: t("消费（日常 + 住房）"), color: RED, values: cf.lines.map((l) => Math.max(0, l.spend)) }] : []),
      ...(cf.hasSpend && cf.lines.some((l) => l.other > 0) ? [{ name: t("其他流出（税、保险、利息、奉献、资本性）"), color: "#8a5fb0", values: cf.lines.map((l) => Math.max(0, l.other)) }] : [])],
    lines: cf.hasSpend && cf.lines.some((l) => l.invest > 0) ? [{ name: t("投资"), color: TEAL, values: cf.lines.map((l) => Math.max(0, l.invest)) }] : [] });
  const diff = cf.hasSpend ? window.Charts.bars({ labels, title: t("净现金流"), stacked: true, showTotals: false, fmt: f, partial,
    series: [{ name: t("结余"), color: BLUE, values: cf.lines.map((l) => Math.max(0, l.net)) }, { name: t("超支"), color: "#b23b3b", values: cf.lines.map((l) => Math.max(0, -l.net)) }] }) : "";
  const trend = cf.lines.length > 2 ? window.Charts.line({ labels, title: t("趋势"), fmt: f, partial, series: [{ name: t("收入"), color: GREEN, values: cf.lines.map((l) => l.income) }, ...(cf.hasSpend ? [{ name: t("消费（日常 + 住房）"), color: RED, values: cf.lines.map((l) => Math.max(0, l.spend)) }] : [])] }) : "";
  return `<div class="panel chart-panel"><h3>${t("收入 vs 消费")}</h3>${grouped}</div>${diff ? `<div class="panel chart-panel"><h3>${t("净现金流：结余 / 超支")}</h3>${diff}</div>` : ""}${trend ? `<div class="panel chart-panel"><h3>${t("趋势")}</h3>${trend}</div>` : ""}`;
}
export const kindDonut = (cf) => {
  const items = statKinds(inc().merge).filter((k) => cf.byKind[k.id]).map((k) => ({ name: `${k.icon} ${kindLabel(k.id)}`, value: R2(cf.byKind[k.id]), color: k.color, drill: incDrill({ kind: k.id, ...cf.w, person: cf.person }) }));
  return items.length && window.Charts ? `<div class="panel chart-panel"><h3>${t("收入按类型（认定收入）")}</h3>${window.Charts.donut({ items, fmt: fmtMoney, stack: true, title: t("按收入类型"), center: fmtMoney(items.reduce((a, x) => a + x.value, 0), true) })}</div>` : "";
};
export const lineTable = (cf) => `<div class="panel"><div class="ch-scroll"><table class="store-table"><thead><tr><th scope="col">${t("周期")}</th><th scope="col">${t("收入")}</th><th scope="col">${t("资本流入")}</th>${cf.hasSpend ? `<th scope="col">${t("消费（含住房）")}</th><th scope="col">${t("其他流出")}</th><th scope="col">${t("投资")}</th>` : ""}${cf.hasRepaid ? `<th scope="col">${t("其中：还款")}</th>` : ""}${cf.hasSpend ? `<th scope="col">${t("收入结余")}</th><th scope="col">${t("净现金流（账面）")}</th><th scope="col">${t("储蓄率")}</th>` : ""}</tr></thead><tbody>
  ${cf.lines.map((l) => `<tr><th scope="row">${esc(l.label)}</th><td>${fmtMoney(l.income)}</td><td>${l.capIn ? fmtMoney(l.capIn) : "—"}</td>${cf.hasSpend ? `<td>${fmtMoney(l.spend)}</td><td>${fmtMoney(l.other)}</td><td>${fmtMoney(l.invest)}</td>` : ""}${cf.hasRepaid ? `<td>${fmtMoney(l.repaid)}</td>` : ""}${cf.hasSpend ? `<td class="${l.incNet < 0 ? "down" : ""}">${fmtMoney(l.incNet)}</td><td class="${l.net < 0 ? "down" : ""}"><b>${fmtMoney(l.net)}</b>${l.noSpend ? ` <span class="bank-dup" title="${esc(t("这段一笔花费都没有，可能对账单还没导入"))}">⚠</span>` : ""}</td><td>${rate(l.saved, l.income)}</td>` : ""}</tr>`).join("")}
  <tr><th scope="row"><b>${t("合计")}</b></th><td><b>${fmtMoney(cf.tot.income)}</b></td><td><b>${cf.tot.capIn ? fmtMoney(cf.tot.capIn) : "—"}</b></td>${cf.hasSpend ? `<td><b>${fmtMoney(cf.tot.spend)}</b></td><td><b>${fmtMoney(cf.tot.other)}</b></td><td><b>${fmtMoney(cf.tot.invest)}</b></td>` : ""}${cf.hasRepaid ? `<td><b>${fmtMoney(cf.tot.repaid)}</b></td>` : ""}${cf.hasSpend ? `<td><b>${fmtMoney(cf.tot.incNet)}</b></td><td><b>${fmtMoney(cf.tot.net)}</b></td><td><b>${rate(cf.tot.saved, cf.tot.income)}</b></td>` : ""}</tr></tbody></table></div>
  <p class="muted" style="font-size:12.5px;margin:6px 0 0">${t("收入 = 认定收入；资本流入 = 卖房卖股的本金、借款、本金返还、从投资账户转回等，不算收入；消费 = 日常 + 住房；其他流出 = 税、保险、利息、奉献、资本性支出。收入结余 = 收入 − 全部流出；净现金流（账面）= 全部流入 − 全部流出 = 收入结余 + 资本流入；储蓄率 =（收入 − 消费 − 其他流出）÷ 收入，只看收入。")}${cf.tot.capOwn ? ` ${t("从储蓄账户转入的 {a} 没算进净现金流：那是自己账户之间挪钱，转出去时也没算支出。", { a: fmtMoney(cf.tot.capOwn) })}` : ""}${cf.hasRepaid ? ` ${t("其中「还款」= 还给个人赠与 / 借款的钱，已经算在花费里，这一列只是告诉你其中有多少。")}` : ""}</p></div>`;
