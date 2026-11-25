/* 收入 → 类型：一级到叶子逐层点进去，子类排行和选中节点的月度柱状图。 */
import { INC_L1S, incL1, incLeaf, incLeavesOf } from "../core/income-taxonomy.js";
import { OV, ovBar, ovMonths } from "./overview-tab.js";
import { esc, todayISO } from "../core/util.js";
import { inc, isIncomeKind, spanLabel } from "./logic.js";
import { incAggregate, incNodeSum } from "../stats/report.js";
import { iso, monthsBetween, roll, spanOfMonths } from "./rollup.js";
import { t } from "../core/i18n.js";
import { DRILL_HINT, R2, cur, empty, fmtMoney, incDrill, periodWin } from "./shared.js";
import { monthLabel, trendHead, trendPeriods } from "../stats/spend-roll.js";

/* ───────────── 类型：一级 → 叶子逐层点进去（面包屑回上层），子类排行（带占比）+ 选中节点的月度柱状图（和花费的「分类」页一样，没有饼图） ─────────────
 * 节点：""（全部）/ 一级 id / "一级|叶子"（资本流入下是 capital|叶子；卖股票这类的收益记在 investment|stock_sale）。 */
const nodeL1 = (node) => String(node).split("|")[0];
const nodeName = (node) => {
  if (!node) return t("全部类型");
  const [l1, leaf] = String(node).split("|"), g = incL1(l1);
  if (!leaf) return `${g.icon} ${t(g.name)}`;
  const k = incLeaf(leaf); return `${k.icon} ${t(k.name)}${l1 !== "capital" && !isIncomeKind(leaf) ? ` ${t("（收益部分）")}` : ""}`;
};
function nodeCrumb(node) {
  const path = node ? (String(node).includes("|") ? [nodeL1(node), node] : [node]) : [];
  const btn = (id, label) => `<button type="button" class="linkbtn" data-inc="node" data-node="${esc(id)}">${esc(label)}</button>`;
  return `<nav class="node-crumb" aria-label="${esc(t("类型层级"))}">${node ? btn("", t("全部类型")) : `<b aria-current="page">${t("全部类型")}</b>`}${path.map((id, i) => `<span class="sep" aria-hidden="true">›</span>${i === path.length - 1 ? `<b aria-current="page">${esc(nodeName(id))}</b>` : btn(id, nodeName(id))}`).join("")}</nav>`;
}
/** 一个一级下面出现过的叶子节点（分类表里的 + 汇总里有数的，比如投资收益下的「卖股票所得（收益部分）」） */
function childNodes(agg, l1) {
  const ids = new Set(incLeavesOf(l1).map((k) => `${l1}|${k}`));
  for (const m of agg.months) for (const k of Object.keys(l1 === "capital" ? agg.capLeaf[m] : agg.leaf[m])) { const id = l1 === "capital" ? `capital|${k}` : k; if (nodeL1(id) === l1) ids.add(id); }
  return [...ids];
}
const nodeKindSel = (node) => (!node ? "" : String(node).includes("|") ? String(node).split("|")[1] : `g:${node}`);
const MAX_SERIES = 7;
export function categoryTab() {
  const I = inc(), O = OV();
  if (!I.rec.length) return empty();
  const { w, months, span } = ovMonths(O);
  if (O.month && !months.includes(O.month)) O.month = "";
  const cm = months.length > 1 ? months : monthsBetween(iso(new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1)), todayISO());
  const node = O.node && (INC_L1S.some((g) => g.id === nodeL1(O.node))) ? O.node : "", bar = ovBar(O, { keys: months });
  const cspan = spanOfMonths([...months, ...cm]);
  const rows = roll("inc", cspan.from, cspan.to);
  if (!rows) return `${bar}${nodeCrumb(node)}<p class="muted" role="status">${t("加载中…")}</p>`;
  const A = incAggregate(rows, months, { cur: cur(), person: O.person }), sel = O.month || null, leaf = String(node).includes("|");
  const kids = !node ? INC_L1S.map((g) => g.id) : leaf ? [] : childNodes(A, node);
  const val = (id, m = sel) => incNodeSum(A, id, m);
  const ranked = kids.map((id) => ({ id, v: val(id) })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
  const win = sel ? periodWin(sel, "month", w) : w, kd = (id) => incDrill({ kind: nodeKindSel(id), ...win, person: O.person });
  const total = node ? val(node) : R2(ranked.filter((x) => x.id !== "capital").reduce((a, x) => a + x.v, 0));
  const items = ranked.map(({ id, v }) => { const isL1 = !String(id).includes("|"), g = incL1(nodeL1(id)), k = isL1 ? g : incLeaf(String(id).split("|")[1]);
    return { name: `${nodeName(id)}${isL1 && !g.income ? ` · ${t("不计收入")}` : ""}`, value: v, color: k.color, ...(isL1 ? { btn: `data-inc="node" data-node="${esc(id)}" aria-label="${esc(t("看「{n}」的细分", { n: t(g.name) }))}"` } : { drill: kd(id) }) }; });
  // 月度柱状图：选中节点按子类堆叠（子类多时前 7 个 + 其他）；只看一个月时画近 6 个月
  const C = incAggregate(rows, cm, { cur: cur(), person: O.person });
  const ids = leaf ? [node] : (node ? childNodes(C, node) : INC_L1S.filter((g) => g.income).map((g) => g.id)).map((id) => ({ id, v: incNodeSum(C, id) })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v).map((x) => x.id);
  const top = ids.slice(0, MAX_SERIES), rest = ids.slice(MAX_SERIES);
  const ser = top.map((id) => { const isL1 = !String(id).includes("|"), k = isL1 ? incL1(id) : incLeaf(String(id).split("|")[1]); return { id, name: nodeName(id), color: k.color, values: cm.map((m) => incNodeSum(C, id, m)) }; });
  if (rest.length) ser.push({ id: node, name: t("其他"), color: "#8a948f", values: cm.map((m) => R2(rest.reduce((s, id) => s + incNodeSum(C, id, m), 0))) });
  const cmW = { from: `${cm[0]}-01`, to: todayISO() }, TP = trendPeriods(cm);   // 统一的周期：范围长了按季 / 按年
  for (const x of ser) x.values = TP.agg(x.values);
  const chart = ser.length && window.Charts ? window.Charts.bars({ title: `${t("{k}收入", { k: nodeName(node) })} · ${TP.title}`, labels: TP.labels, fmt: fmtMoney, series: ser, partial: TP.partial,
    drill: (k, i) => incDrill({ kind: nodeKindSel(ser[k].id), ...TP.win(i), person: O.person }), legendDrill: (k) => incDrill({ kind: nodeKindSel(ser[k].id), ...(months.length > 1 ? w : cmW), person: O.person }) })
    : `<p class="muted">${t("这段时间没有收入")}</p>`;
  const capNote = !node && val("capital") > 0 ? `<p class="muted small" style="margin:6px 0 0">${t("资本与资产流入（卖房卖股的本金、借款、自己账户转入、国际电汇…）只是现金流入，不算收入，不在合计里。")}</p>` : "";
  return `${bar}${nodeCrumb(node)}
    <div class="panel chart-panel"><div class="row"><h3 style="margin:0">${esc(nodeName(node))}</h3><b class="num">${fmtMoney(total)}</b></div>
      <p class="muted" style="margin:2px 0 8px;font-size:13px">${sel ? monthLabel(sel) : spanLabel(O.range)}${leaf ? "" : ` · ${t("点名称看下一层，点条看明细")}`}</p>
      ${leaf ? "" : window.Charts ? window.Charts.hbars({ items, fmt: fmtMoney, total: node ? total : null, title: t("子类排行"), empty: t("这段时间没有收入") }) : ""}${capNote}
      <div class="ui-acts"><button type="button" class="ui-btn" data-size="sm" data-drill="${esc(incDrill({ kind: nodeKindSel(node), ...win, person: O.person, ex: node ? "" : 1 }))}">${t("查看明细")} ›</button></div></div>
    <div class="panel chart-panel">${trendHead(TP.title, TP)}${chart}${DRILL_HINT()}</div>`;
}
