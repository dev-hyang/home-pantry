/* 储藏 · 购买排行：近 90 天 / 近 12 个月买得最多、花得最多、最近买、涨价了的物品。
 * 每一行点开就是这件东西的购买明细（日期、商店、数量、金额），数字能一笔笔核对；概览的「最常购买 / 花费最多」卡片点进来就是这里。
 * 金额跟着财务权限：没有财务权限只看次数和数量。汇总口径在 buys-data.js，数据在 buys-load.js。 */
import { state } from "../core/state.js";
import { esc, fmt, fmtShort, money } from "../core/util.js";
import { t } from "../core/i18n.js";
import { href } from "../core/router.js";
import { financeOk } from "../core/finance-access.js";
import { buysTotals, sortBuys } from "./buys-data.js";
import { buysFor } from "./buys-load.js";
import { dealCount, dealOf, dealsSort, dealText, stockContext } from "./buys-deals.js";
import { askInline } from "../core/ask.js";
import { pageLimit, pageMoreBtn } from "../core/pager.js";

const MAX_ROWS = 10;   // 展开后最多列几笔
const ui = () => (state.buysUi ||= { range: "90", sort: "count", open: {} });
/* 换范围 / 排序、展开收起：只改本页状态，用「花费数据已读好」的事件让 main 重画（见 buys-load.js） */
document.addEventListener("change", (e) => {
  const id = e.target.id; if (id !== "buysRange" && id !== "buysSort") return;
  ui()[id === "buysRange" ? "range" : "sort"] = e.target.value; window.dispatchEvent(new Event("spend-data-loaded"));
});
document.addEventListener("toggle", (e) => { const d = e.target; if (d?.matches?.("details[data-buys-key]")) ui().open[d.dataset.buysKey] = d.open; else if (d?.matches?.("details[data-buys-ask]")) ui().askOpen = d.open; }, true);

const sel = (id, label, opts, cur) => `<select id="${id}" aria-label="${esc(label)}">${opts.map(([v, l]) => `<option value="${v}" ${v === cur ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
const pct = (c) => `${c > 0 ? "+" : ""}${Math.round(c * 100)}%`;
const qtyText = (q, u) => `${fmt(q)}${u ? ` ${t(u)}` : ""}`;
function priceBadge(g) {
  if (g.change == null || g.n < 3 || Math.abs(g.change) < 0.1) return "";
  return `<span class="ui-badge" data-tone="${g.change > 0 ? "warn" : "ok"}" data-size="sm">${esc(t("单价 {p}", { p: pct(g.change) }))}</span>`;
}
/** 点开后的明细：每笔购买一行 + 这件东西的单价小结 */
function detail(g, fin) {
  const rows = g.rows.slice(0, MAX_ROWS).map((r) => `<li><span class="bd-d">${esc(fmtShort(r.purchased_at))}</span><span class="bd-s">${esc(r.store || "—")}</span><span class="bd-q">${r.quantity != null ? esc(qtyText(r.quantity, r.unit)) : ""}</span>${fin ? `<b class="bd-m ${Number(r.amount) < 0 ? "down" : ""}">${r.amount != null ? esc(money(r.amount)) : "—"}</b>` : ""}</li>`).join("");
  const facts = fin && g.avgUnit != null ? `<p class="muted bd-facts">${esc(t("平均单价 {a} / {u}", { a: money(g.avgUnit), u: t(g.unit) }))} · ${esc(t("最低 {m}", { m: money(g.minUnit) }))} · ${esc(t("最近一次 {m}", { m: money(g.lastUnit) }))}</p>` : "";
  return `<div class="buys-body">${facts}<ul class="buys-list">${rows}</ul>${g.rows.length > MAX_ROWS ? `<p class="muted bd-facts">${esc(t("只列最近 {n} 笔", { n: MAX_ROWS }))}</p>` : ""}${g.id ? `<a class="ui-btn" data-size="sm" data-tone="ghost" href="${esc(href("item", g.id))}">${t("看这件物品")}</a>` : ""}</div>`;
}
function row(g, fin, open) {
  const dl = dealOf(g), sub = [t("买了 {n} 次", { n: g.n }), g.qty ? qtyText(g.qty, g.unit) : "", t("最近 {d}", { d: fmtShort(g.lastAt) }), g.lastStore].filter(Boolean).map(esc).join(" · ");
  return `<li class="buys-item"><details data-buys-key="${esc(g.key)}"${open ? " open" : ""}><summary>
    <span class="buys-main"><b>${esc(g.name)}</b>${priceBadge(g)}<small>${sub}</small>${dl ? `<small class="buys-deal${dl.good ? " is-good" : ""}">🏷 ${esc(dealText(dl))}</small>` : ""}</span>
    <span class="buys-num">${fin ? `<b class="num">${esc(money(g.spend))}</b>` : `<b class="num">${g.n}</b><small>${t("次")}</small>`}</span>
    <span class="ui-chev" data-dir="down" aria-hidden="true">▾</span></summary>${detail(g, fin)}</details></li>`;
}
export function viewBuys() {
  const u = ui(), fin = financeOk(), days = u.range === "365" ? 365 : 90, sort = !fin && u.sort === "spend" ? "count" : u.sort, e = buysFor(days);
  const sorts = [["count", t("买得最多")], ...(fin ? [["spend", t("花得最多")]] : []), ["recent", t("最近买的")], ["rise", t("涨价了")], ["deals", t("有特价的")]];
  const bar = `<div class="toolbar">${sel("buysRange", t("时间范围"), [["90", t("近 90 天")], ["365", t("近 12 个月")]], String(days))}${sel("buysSort", t("排序"), sorts, sort)}</div>`;
  const head = `<div class="section-head"><h2>${t("购买排行")}</h2></div>`;
  if (!e.groups) return `<section class="section">${head}${bar}<div class="panel"><p class="muted" style="margin:0" role="status">${t("正在读取购买记录…")}</p></div></section>`;
  const tot = buysTotals(e.groups), list = sort === "deals" ? dealsSort(e.groups) : sortBuys(e.groups, sort), lim = pageLimit("buys", `${days}|${sort}`);
  const sum = e.groups.length ? `<p class="buys-sum"><b>${esc(days === 365 ? t("近 12 个月") : t("近 {d} 天", { d: days }))}</b> · ${esc(t("买过 {k} 种 · 共 {n} 次", { k: tot.kinds, n: tot.times }))}${fin ? ` · ${esc(t("花了 {m}", { m: money(tot.spend) }))}` : ""}<span class="muted">${esc(t("只统计对得上库存物品的购买；退款会从花费里减掉。点一行看每一笔。"))}</span></p>` : "";
  const hits = dealCount(e.groups), stock = e.groups.some((g) => g.n >= 2) ? `<details class="ov-ask buys-ask" data-buys-ask${u.askOpen ? " open" : ""}><summary><span>${esc(t("趁打折囤什么？问咩咩"))}${hits ? ` <span class="ui-badge" data-tone="warn" data-size="sm">${esc(t("{n} 样有特价", { n: hits }))}</span>` : ""}</span><span class="ui-chev" data-dir="down" aria-hidden="true">▾</span></summary>
    <div class="ov-ask-body">${askInline({ id: `pantry-buys-stock-${days}`, title: t("囤货建议"), question: t("按我常买的东西、现在的特价和家里的库存，哪些值得趁打折多囤一些？每样囤多少、够吃用多久？"), context: stockContext(sortBuys(e.groups, "count"), days, fin) })}</div></details>` : "";
  const body = list.length ? `<ul class="buys-ul">${list.slice(0, lim).map((g) => row(g, fin, !!u.open[g.key])).join("")}</ul>${pageMoreBtn("buys", list.length, lim)}`
    : `<div class="panel empty"><strong>${t("这段时间没有购买记录")}</strong>${t("用「录入购物」入库，或在购物车里点买到并填花费，这里就会有排行。")}</div>`;
  return `<section class="section">${head}${bar}${e.err ? `<p class="muted" role="alert">${esc(e.err)}</p>` : ""}${sum}${stock}${body}</section>`;
}
