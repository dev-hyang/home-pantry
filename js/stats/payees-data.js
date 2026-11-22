/* 花费 → 收款方：全历史名单、列表数据、钻取、页面。 */
import { $, esc, fmtDay, money } from "../core/util.js";
import { L1S, l1IdOf, nodeOf } from "../core/taxonomy.js";
import { Store } from "../core/store.js";
import { compare, t } from "../core/i18n.js";
import { detailHtml, tidyHtml, undoLog } from "./payees-actions.js";
import { moreBtn, pageSize } from "../core/pager.js";
import { state } from "../core/state.js";
import { storeAgg } from "./report.js";
import { P, TZ } from "./payees-common.js";
import { monthLabel } from "./spend-roll.js";
import { dq, hitAttrs } from "./spend-drill.js";
import { STORE_NONE, STORE_REST, statKit, storeDatalist } from "./store-lite.js";
import { rangeLabel } from "./add-lite.js";
import { storeL1Of } from "./payees-l1.js";
import { lpAttr } from "../core/long-press.js";

/* ── 全历史名单（最近一次、整理预览）：读一次缓存，花费变了重读 ── */
export const NAMES = { rows: null, busy: false, missing: false };
export function loadNames() {
  if (NAMES.busy) return;
  NAMES.busy = true;
  Store.payeeNames(TZ()).then((rows) => { NAMES.rows = rows || []; NAMES.missing = rows == null; })
    .catch(() => { NAMES.rows = []; })
    .finally(() => { NAMES.busy = false; if ($("#payeeList") || $(".tidy-panel") || $("[data-tidy-wait]")) window.dispatchEvent(new Event("spend-data-loaded")); });
}
window.addEventListener("spend-rows-changed", () => { NAMES.rows = null; });
const namesByKey = () => new Map((NAMES.rows || []).map((r) => [r.store_key, r]));
/* ── 列表数据 ── */
const COLS = [["name", "收款方"], ["kind", "主要分类"], ["n", "次数"], ["total", "合计"], ["share", "占比"], ["avg", "平均每笔"], ["last", "最近一次"]];
const SORTS = [["total:desc", "金额从高到低"], ["total:asc", "金额从低到高"], ["n:desc", "次数最多"], ["last:desc", "最近付过的在前"], ["avg:desc", "平均每笔最高"], ["name:asc", "名称 A → Z"]];
const mainNode = (a) => { const top = Object.entries(a.byL2).sort((x, y) => y[1] - x[1])[0]; return top ? nodeOf(top[0]) : null; };
export const nodeText = (n) => (n ? `${n.icon || ""} ${t(n.name)}`.trim() : "");
/** 当前范围 / 一级分类下的收款方（未排序）；null = 还在读 */
function payeeList(months, sel, l1) {
  const sp = statKit.spanOfMonths(months), rows = statKit.rollup(sp.from, sp.to, true);
  if (!rows) return null;
  const last = namesByKey();
  return storeAgg(rows, months, { sel, l1, ...statKit.statOpts() }).map((a) => ({ ...a, name: a.key === "__none__" ? t(STORE_NONE.name) : a.name || a.key, node: mainNode(a), last: last.get(a.key)?.last_at || "" }));
}
export function sorted(list) {
  const { k, dir } = P().sort, sgn = dir === "asc" ? 1 : -1;
  const val = { name: (x) => x.name.toLowerCase(), kind: (x) => nodeText(x.node), n: (x) => x.count, total: (x) => x.total, share: (x) => x.total, avg: (x) => x.total / x.count, last: (x) => x.last || "" }[k] || ((x) => x.total);
  return [...list].sort((a, b) => { const va = val(a), vb = val(b); return (typeof va === "number" ? va - vb : compare(String(va), String(vb))) * sgn || b.total - a.total; });
}
export const filtered = (list) => {
  const q = P().q.trim().toLowerCase(), kind = P().kind || "all";
  return list.filter((x) => (!q || `${x.name} ${nodeText(x.node)}`.toLowerCase().includes(q)) && (kind === "all" || (x.node && l1IdOf(x.node.id) === kind)));   // 搜索 + 主要分类（一级）
};
/* ── 钻取：收款方 / 一组收款方 / 分类 → 明细，套上同样的时间范围 ── */
export let CTX = { sel: "", l1: "all" };
const win = () => (CTX.sel ? { month: CTX.sel } : statKit.winDrill());
export const payeeDrill = (keys) => dq({ ...(keys.length === 1 ? { store: keys[0] } : { stores: keys.map(encodeURIComponent).join(",") }), ...(CTX.l1 !== "all" ? { cat: CTX.l1 } : {}), ...win() });
/* ── 页面 ── */
export function viewPayees(months, month = state.stats.month) {
  const sel = month && months.includes(month) ? month : "";
  const l1 = storeL1Of();
  CTX = { sel, l1 };
  if (state.route?.q?.get("tidy") === "1") { if (!P().tidyFromLink) { P().tidy = true; P().tidyFromLink = true; } } else P().tidyFromLink = false;   // 导入完成页「去整理」带过来的（每次点链接都打开一次）
  if (!NAMES.rows) loadNames();
  const head = `<div class="section-head"><h2>${t("收款方")}</h2><p>${esc(sel ? monthLabel(sel) : rangeLabel())}${t("；账单、订阅、保险按收款方；名称不区分大小写")}</p></div>`;   // 「只看」在页头右边的筛选按钮里（payees-l1.js）
  const list = payeeList(months, sel, l1);
  if (!list) return `<section class="section">${head}${statKit.LOADING()}</section>`;
  if (!list.length) return `<section class="section">${head}<div class="panel empty"><strong>${t("这段时间没有符合条件的花费")}</strong></div></section>`;
  return `<section class="section payees">${head}${kpisHtml(list)}${chartsHtml(list)}${P().tidy ? tidyHtml() : ""}
    <div class="panel">
      <div class="toolbar ix-stoolbar">
        <input type="search" id="payeeSearch" value="${esc(P().q)}" placeholder="${esc(t("搜索收款方 / 分类"))}" aria-label="${esc(t("搜索收款方"))}">
        <select id="payeeKind" data-nosearch aria-label="${esc(t("按主要分类筛选"))}"><option value="all">${t("全部分类")}</option>${L1S.filter((x) => x.id !== "transfer").map((x) => `<option value="${x.id}" ${(P().kind || "all") === x.id ? "selected" : ""}>${x.icon} ${esc(t(x.name))}</option>`).join("")}</select>
        <select id="payeeSort" data-nosearch aria-label="${esc(t("排序"))}">${sortOptions()}</select>
      </div>
      <div id="payeeList">${listHtml(list)}</div>
      ${storeDatalist()}
    </div>
  </section>`;
}
/** 只重画表格（搜索、排序、多选、翻页时；输入框不丢焦点） */
export let LAST = null;
export function renderPayeeList() { const el = $("#payeeList"); if (el && LAST) el.innerHTML = listHtml(LAST); }
function kpisHtml(list) {
  const named = list.filter((x) => x.key !== "__none__"), total = list.reduce((a, x) => a + x.total, 0), n = list.reduce((a, x) => a + x.count, 0);
  const top5 = named.slice(0, 5).reduce((a, x) => a + x.total, 0), big = named[0];
  const card = (label, value, small = "", drill = "") => `<div class="kpi${drill ? " ch-hit-row" : ""}"${drill ? hitAttrs(drill, label) : ""}><span>${esc(label)}</span><b>${value}</b><small>${small}${drill ? " ›" : ""}</small></div>`;
  return `<div class="kpis">
    ${card(t("收款方"), esc(t("{n} 家", { n: named.length })), list.length > named.length ? esc(t("另有未填写收款方的花费")) : "")}
    ${card(t("花费合计"), esc(money(total)), esc(t("{n} 笔，不含转账", { n })), dq({ ...(CTX.l1 !== "all" ? { cat: CTX.l1 } : {}), ...win() }))}
    ${card(t("平均每笔"), esc(money(n ? total / n : 0)))}
    ${card(t("前 5 家占比"), total > 0 ? `${Math.round((top5 / total) * 100)}%` : "–", esc(t("钱主要花在哪几家")))}
    ${big ? card(t("最大收款方"), esc(big.name), esc(money(big.total)), payeeDrill([big.key])) : ""}
  </div>`;
}
function chartsHtml(list) {
  const named = list.filter((x) => x.key !== "__none__"), total = list.reduce((a, x) => a + x.total, 0);
  const top = named.slice(0, 10), rest = named.slice(10);
  const items = top.map((a) => ({ name: a.name, value: Math.round(a.total * 100) / 100, color: "#8a948f", drill: payeeDrill([a.key]),
    parts: Object.entries(a.byL2).map(([k, v]) => { const n = nodeOf(k); return { name: nodeText(n) || k, value: v, color: n?.color || "#8a948f" }; }) }));
  if (rest.length) items.push({ name: `${t(STORE_REST.name)}（${t("{n} 家", { n: rest.length })}）`, value: Math.round(rest.reduce((a, x) => a + x.total, 0) * 100) / 100, color: STORE_REST.color, drill: payeeDrill(rest.map((x) => x.key)) });
  const bars = window.Charts.hbars({ title: t("花得最多的 10 家"), fmt: money, total, items });
  // 环形图：全部 = 按一级分类；选了一级 = 按二级；最多 6 块，其余合成「其他」
  const by = new Map();
  for (const a of list) for (const [k, v] of Object.entries(a.byL2)) { const id = CTX.l1 === "all" ? l1IdOf(k) : k; by.set(id, (by.get(id) || 0) + v); }
  let slices = [...by].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([id, v]) => { const n = nodeOf(id) || L1S.find((x) => x.id === id); return { name: nodeText(n) || id, value: Math.round(v * 100) / 100, color: n?.color || "#8a948f", drill: dq({ cat: id, ...win() }) }; });
  if (slices.length > 6) slices = [...slices.slice(0, 5), { name: t("其他"), value: Math.round(slices.slice(5).reduce((a, x) => a + x.value, 0) * 100) / 100, color: "#c3cbc6" }];
  const donut = window.Charts.donut({ items: slices, fmt: money, title: t("按分类"), center: money(total, true), stack: true });
  return `<div class="chart-grid">
    <div class="panel chart-panel"><h3>${t("花得最多的 10 家")}</h3><p class="muted chart-sub">${t("每条按二级分类分段：看得出在这家主要买什么。")}</p>${bars}</div>
    <div class="panel chart-panel"><h3>${CTX.l1 === "all" ? t("按一级分类") : t("按二级分类")}</h3>${donut}</div>
  </div><p class="muted drill-hint">${t("点图里的条、色块或名称，可以查看对应的花费明细。")}</p>`;
}
function sortOptions() {
  const { k, dir } = P().sort, cur = `${k === "share" ? "total" : k}:${dir}`, list = [...SORTS];
  if (!list.some(([v]) => v === cur)) list.push([cur, `${t((COLS.find((c) => c[0] === k) || [])[1] || k)} ${dir === "asc" ? "↑" : "↓"}`]);
  return list.map(([v, l]) => `<option value="${esc(v)}" ${v === cur ? "selected" : ""}>${esc(t(l))}</option>`).join("");
}
function listHtml(all) {
  LAST = all;
  const S = P(), list = sorted(filtered(all)), total = all.reduce((a, x) => a + x.total, 0), lim = S.limit || pageSize();
  const shown = list.slice(0, lim), { k, dir } = S.sort, hasLast = !!NAMES.rows && !NAMES.missing;
  const cols = COLS.filter(([key]) => key !== "last" || hasLast);
  const th = ([key, label]) => { const on = k === key; return `<th scope="col" class="s-${key}" ${on ? `aria-sort="${dir === "asc" ? "ascending" : "descending"}"` : ""}><button type="button" class="th-sort${on ? " is-on" : ""}" data-action="payee-sort" data-k="${key}" title="${esc(t("点一下按这一列排序"))}">${t(label)}<span aria-hidden="true">${on ? (dir === "asc" ? " ▲" : " ▼") : " ↕"}</span></button></th>`; };
  const cell = (key, inner) => `<td class="s-${key}" data-l="${esc(t(COLS.find((c) => c[0] === key)[1]))}">${inner}</td>`;
  const span = cols.length;
  /** 一行的长按（电脑右键）菜单：原来行里的「走势」「改名 / 合并」和工具条里的「多选合并」「整理收款方」「撤销」「导出 CSV」都收在这里（和 收入 → 付款方 一样） */
  const rowMenu = (x) => { const own = x.key !== "__none__";
    return [{ label: t("看花费明细"), data: { drill: payeeDrill([x.key]) }, first: true },
      { label: S.open === x.key ? t("收起走势") : t("近 12 个月走势"), action: "payee-open", data: { key: x.key } },
      own ? { label: t("改名 / 合并"), action: "payee-rename", data: { key: x.key } } : null,
      own ? { label: t("多选合并"), action: "payee-sel" } : null,
      { label: t("整理收款方"), action: "payee-tidy" },
      undoLog().length ? { label: t("撤销上次合并"), action: "payee-undo" } : null,
      { label: t("导出 CSV"), action: "payee-csv" }]; };
  const row = (x) => {
    const own = x.key !== "__none__", picked = S.sel?.has(x.key);
    const pick = S.sel && own ? `<input type="checkbox" class="sel" data-action="payee-pick" data-key="${esc(x.key)}" ${picked ? "checked" : ""} aria-label="${esc(t("选中 {name}", { name: x.name }))}">` : "";
    const tr = `<tr${picked ? ' class="is-picked"' : ""} ${S.sel ? "" : lpAttr(rowMenu(x), x.name)}><th scope="row" class="s-name"><span class="s-name-in">${pick}<button type="button" class="link-name linkbtn" data-drill="${esc(payeeDrill([x.key]))}" title="${esc(t("查看明细"))}">${esc(x.name)}</button></span></th>
      ${cell("kind", x.node ? `<span class="ix-kind">${esc(nodeText(x.node))}</span>` : "")}${cell("n", x.count)}${cell("total", `<b>${esc(money(x.total))}</b>`)}${cell("share", total > 0 ? `${Math.round((x.total / total) * 1000) / 10}%` : "–")}${cell("avg", esc(money(x.total / x.count)))}${hasLast ? cell("last", x.last ? esc(fmtDay(x.last)) : "–") : ""}</tr>
      ${S.open === x.key ? `<tr class="s-form s-detail"><td colspan="${span}">${detailHtml(x)}</td></tr>` : ""}`;
    const form = S.renameKey === x.key ? `<tr class="s-form"><td colspan="${span}"><div class="payee-form">
      <label>${t("统一改成")}<input id="payeeTo" maxlength="40" list="storeList" value="${esc(x.name)}" autocomplete="off"></label>
      <div class="form-actions"><button type="button" class="btn btn-sm btn-primary" data-action="payee-rename-go" data-key="${esc(x.key)}">${t("改名（同名的会合并成一个）")}</button><button type="button" class="btn btn-sm btn-ghost" data-action="payee-rename" data-key="">${t("取消")}</button></div>
      <small class="muted">${t("以后导入对账单时，同样的收款方会自动用新名字。")}</small></div></td></tr>` : "";
    return tr + form;
  };
  const picked = S.sel ? all.filter((x) => S.sel.has(x.key)) : [];
  const defTo = S.mergeTo || [...picked].sort((a, b) => b.count - a.count)[0]?.name || "";
  const selBar = S.sel ? `<div class="sel-bar payee-sel" role="region" aria-label="${esc(t("多选合并"))}"><b>${t("已选 {n} 家", { n: picked.length })}</b>
      <label class="payee-merge-to"><span>${t("合并为")}</span><input id="payeeMergeTo" maxlength="40" list="storeList" value="${esc(defTo)}" autocomplete="off"></label>
      <button type="button" class="btn btn-sm btn-primary" data-action="payee-merge" ${picked.length >= 2 ? "" : "disabled"}>${t("合并")}</button>
      <button type="button" class="btn btn-sm btn-ghost" data-action="payee-sel">${t("退出多选")}</button>
      <small class="muted" style="flex-basis:100%">${t("勾两家以上，合并成一个名字（默认用笔数最多的那个）。")}</small></div>` : "";
  return `${selBar}<p class="muted small" style="margin:0 0 6px">${t("{n} 家，合计 {m}", { n: list.length, m: money(list.reduce((a, x) => a + x.total, 0)) })}</p>
    <p class="list-hint">${t("长按（电脑右键）一行：更多操作")}</p>
    ${list.length ? `<table class="store-table ix-stbl payee-tbl"><thead><tr>${cols.map(th).join("")}</tr></thead><tbody>${shown.map(row).join("")}</tbody></table>` : `<p class="muted">${t("没有符合条件的收款方")}</p>`}
    ${moreBtn(list.length > shown.length, 'data-action="payee-more"')}`;
}
