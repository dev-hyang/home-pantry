import { $, esc, fmtDay, money, num, showQty } from "../core/util.js";
import { ALL_CATS, MONTH_EN, TZ, isBill, monthKey, rangeMonths } from "./spend-roll.js";
import { BUCKETS, NATURES, bucketOf, coversUnknown, defaultNature, isTransfer, knownLeafIds, leafLabel, leavesOf, natureName, natureParams, treeOptions } from "../core/taxonomy.js";
import { FD, changed, clearFiltersBtn } from "../core/clear-filters.js";
import { budgetBridge } from "../core/budget-bridge.js";
import { toolbarEye } from "../core/toolbar-eye.js";
import { compact } from "../core/list-query.js";
import { compare, lang, t } from "../core/i18n.js";
import { customHtml, rangeOptionsHtml } from "../core/time-range.js";
import { amtCustomHtml, amtParams, amtSelectHtml } from "../core/amount-filter.js";
import { href } from "../core/router.js";
import { dayLabel, dayWindow, daysControlsHtml, mergeSpan } from "./spend-days.js";
import { memberName } from "../core/logic.js";
import { moreBtn } from "../core/pager.js";
import { serverList } from "../core/server-list.js";
import { state } from "../core/state.js";
import { withProperty } from "../core/alerts.js";
import { paymentPayLabel } from "../bills/card-picker.js";
import { STORE_NONE, storeOf } from "./store-lite.js";
import { knownStores, storeKey } from "./store-lite-common.js";
import { activeProps } from "./add-lite-common.js";
import { NO_SPEND_FILTER } from "./records-lite.js";
import { medNames } from "./records-lite-common.js";
import { lpAttr } from "../core/long-press.js";
import { dots } from "../core/dots.js";

/* ── 花费记录：搜索 + 分类树 / 性质 / 房产 / 商店 / 年份 / 月份筛选 + 排序，按月分组带小计；服务器分页（迁移 054 / 055），任何一年、全部年份都能看 ──
 * 筛选、排序、合计、月小计都在数据库里做（spend_page / spend_stats），这里只把界面上的筛选翻译成筛选对象（spendParams）；
 * 分类树、预算分组这类只有前端认识的规则（js/core/taxonomy.js）先在这里展开成叶子分类表，数据库只查表。转账照样列出（带标记），合计不算。
 * 筛选条和 收入 → 明细 同一套：搜索 + 下拉一行（手机收成「筛选」按钮），图表钻取带来的其他条件在下面一行标签里，可逐项去掉。 */
export const SPEND_SORTS = [["new", "时间：新 → 旧"], ["old", "时间：旧 → 新"], ["high", "金额：高 → 低"], ["low", "金额：低 → 高"], ["name", "名称 A → Z"]];
/** 银行导入的一批：{ 批次记录, 旧批次的花费 id 集合 }（记录在预算设置里） */
const batchOf = (id) => { const b = (state.budget?.cat_budgets?._bank_batches || []).find((x) => x.id === id); return b ? { b, ids: new Set(b.ids || []) } : null; };
/** 分类节点 / 叶子是否包含这个叶子（"bills" = 全部账单、"billfam_*" = 账单的一个大类：旧钻取链接） */
function catHas(sel, id) {
  if (sel === "bills") return isBill(id);
  if (String(sel).startsWith("billfam_")) return isBill(id) && BILLS_GROUP.familyOf(id) === sel;
  return leavesOf(sel).includes(id);
}
/** 分类 + 预算分组 + 性质筛选 → 数据库的筛选参数（在这里先求交集）：
 *  known = 认识的分类（含旧别名）；lo = hi = 命中的叶子（054 的「大件门槛」已不用，big = 0）；unk = 不认识的分类算不算（lo / hi：普通的，blo / bhi：bill_ 开头的；不认识的算 生活消费 → 其他）；
 *  nat = 命中的实际性质。预算分组（钻取来的 grp）：资本性组 = 性质是资本性的全部；其余按「日常消费」时的归组，只看日常消费 / 融资 */
function catFilter(f) {
  const out = {}, sel = f.cat !== "all" ? f.cat : null, G = budgetBridge.groupOf, grp = f.grp;
  let nat = f.nat && f.nat !== "all" ? [f.nat] : null;
  if (sel || grp) {
    const inGrp = (id) => !grp || !G || grp === "capital" || (grp === "!bills" ? !["bills", "transfer", "investment"].includes(G(id, "operating")) : G(id, "operating") === grp);
    const known = knownLeafIds(), hit = known.filter((id) => (!sel || catHas(sel, id)) && inGrp(id));
    const unkOk = (id) => (!sel || coversUnknown(sel) || (sel === "bills" && isBill(id))) && inGrp(id);
    Object.assign(out, { known, lo: hit, hi: hit, big: 0, unk: [["lo", "zz_unknown"], ["hi", "zz_unknown"], ["blo", "bill_zz_unknown"], ["bhi", "bill_zz_unknown"]].filter(([, id]) => unkOk(id)).map(([k]) => k) });
    if (grp) { const g = grp === "capital" ? ["capital"] : ["operating", "financing"]; nat = nat ? nat.filter((x) => g.includes(x)) : g; if (!nat.length) nat = ["__none__"]; }
  }
  if (nat) out.nat = nat;
  return out;
}
const monthStart = (m) => new Date(+m.slice(0, 4), +m.slice(5, 7) - 1, 1);
/** 年份 / 钻取的月份 → 时间戳范围（本地时间）：只用来让数据库少扫，真正的筛选是 year / mon / months */
function spanOf(f) {
  if (f.months?.length) { const s = [...f.months].sort(), e = monthStart(s.at(-1)); return { from: monthStart(s[0]).toISOString(), to: new Date(e.getFullYear(), e.getMonth() + 1, 1).toISOString() }; }
  if (f.year !== "all") { const y = +f.year; return { from: new Date(y, 0, 1).toISOString(), to: new Date(y + 1, 0, 1).toISOString() }; }
  return {};
}
/** 当前筛选 → 数据库的筛选对象（只带生效的项）；natx / xfer 每次都带：数据库靠它们认出转账（合计不算）和各分类的默认性质 */
export const spendParams = () => spendParamsOf(state.spendFilter);
/** 一组筛选 → 数据库的筛选对象（概览的「最近动态」卡片也用它读明细） */
export function spendParamsOf(f) {
  const bt = f.batch ? batchOf(f.batch) : null;
  let stores = f.stores?.length ? [...f.stores] : null;   // “其他商店”：一组商店
  // 时间范围（js/core/time-range.js）→ 月份；和图表钻取带来的一组月份（f.months）同时有时取交集
  const rm = f.range && f.range !== "all" ? rangeMonths(f.range) : null, months = rm && f.months?.length ? f.months.filter((m) => rm.includes(m)) : rm || (f.months?.length ? f.months : null);
  if (f.store !== "all") stores = stores ? stores.filter((k) => k === f.store) : [f.store];
  return compact({ tz: TZ(), cur: Units.region.currency, med: medNames(), sort: f.sort || "new", ...natureParams(), ...catFilter(f),
    year: f.year !== "all" ? f.year : null, mon: f.mon !== "all" ? f.mon : null, months: months ? (months.length ? months : ["0000-00"]) : null, dmax: f.dmax || null, ...mergeSpan(spanOf({ ...f, months }), dayWindow(f)),
    stores, q: f.q.trim().toLowerCase() || null, batch: f.batch || null, batch_ids: bt?.ids.size ? [...bt.ids] : null, prop: f.prop && f.prop !== "all" ? f.prop : null, ...amtParams(f.amt, f.amin, f.amax) });   // amin / amax：金额筛选（迁移 107）
}
/** 明细列表：读到的几页 + 当前筛选的统计；虚拟的医疗付款 id 加 med: 前缀（不会当成真实花费去删 / 改；cursor 用的是加前缀之前的原始行） */
export const spendList = serverList("spend", {
  host: "#spendList",
  map: (r) => ({ ...r, id: r.virtual ? `med:${r.id}` : r.id, category: canonCat(r.category) }),
  draw: (facetsChanged) => (facetsChanged && document.activeElement?.id !== "spendSearch" ? renderSpendRecords() : renderSpendList()),
});
/** 花费变了（实时同步、自己记 / 改 / 删、医疗付款变了）：明细的统计 + 第一页重读（mergeMedical 发出 spend-rows-changed） */
export const reloadSpendList = () => spendList.reload();
window.addEventListener("spend-rows-changed", reloadSpendList);
/** 就地编辑保存后：先改已读到的那一行，页面立刻是新的（随后的重读会再对一遍） */
export const patchSpendRow = (id, patch) => { spendList.rows = spendList.rows.map((x) => (x.id === id ? { ...x, ...patch } : x)); };
/** 每次画列表建一次查找表（分类、账单），每行不再线性查找 */
function spendLookups() {
  const first = (rows, key) => new Map(rows.map((x) => [key(x), x]).reverse());   // 重复的键保留第一条（和原来的 find 一样）
  return { cats: first(ALL_CATS(), (c) => c.id), bills: first(state.bills, (b) => b.id) };
}
function spendRow(p, L = spendLookups()) {
  // 转账：数据库已判断（is_xfer）；性质和分类默认不一样时标出来；关联了房产（多套房时）也写出来
  const xfer = p.is_xfer ?? isTransfer(p.category, p.nature), nat = p.nature && p.nature !== defaultNature(p.category) ? p.nature : null;
  const tags = (xfer ? ` <span class="badge xfer-badge">${t("转账 · 不算花费")}</span>` : "") + (nat && !xfer ? ` <span class="badge" style="background:var(--surface-2)">${esc(t(natureName(nat)))}</span>` : "");
  const prop = p.property_id && !p.pay_id && state.properties.length > 1 ? state.properties.find((x) => x.id === p.property_id)?.name : "";
  // 账单缴费记的花费（数据库顺带带回关联的缴费记录 pay_id）：名称链接到那条缴费记录的编辑页（改那里，花费会同步）；其余的在这一行里就地编辑
  const bill = p.pay_id ? L.bills.get(p.pay_bill_id) : null;
  const picking = !!state.spendSel && !p.virtual;   // 多选删除中：点行 = 勾 / 取消勾，名字不再是链接
  const editGo = bill ? `${href("bill", bill.id)}?sec=pay&edit=${p.pay_id}` : `${href("bills", "spend")}?form=${encodeURIComponent(p.id)}`;
  const rowGo = p.virtual === "medical" ? href("otbill", p.bill_id) : `${href("bills", "spend")}?view=${encodeURIComponent(p.id)}`;   // 点行任何空白处 = 进详情（main.js 的 data-row-open）；编辑在详情页每块的「编辑」和长按菜单里
  const title = picking ? `<span class="link-name">${esc(p.name)}</span>` : p.virtual === "medical" ? `<a class="link-name" href="${href("otbill", p.bill_id)}" title="${esc(t("到医疗账单里看 / 改"))}">${esc(p.name)}</a>`
    : bill ? `<a class="link-name" href="${esc(rowGo)}">${esc(withProperty(bill.property_id, p.name))}</a>`
    : `<a class="link-name" href="${esc(rowGo)}">${esc(p.name)}</a>${state.spendDrafts?.[p.id] ? ` <span class="badge b-soon">${t("草稿")}</span>` : ""}`;
  const sel = state.spendSel && !p.virtual ? `<input type="checkbox" class="sel" data-sel="${p.id}" aria-label="${esc(t("选中 {name}", { name: p.name }))}" ${state.spendSel.has(p.id) ? "checked" : ""}>` : "";
  const desc = [leafLabel(p.category), prop ? `🏠 ${prop}` : "", storeOf(p), p.quantity ? showQty(p.quantity, p.unit || "") : "", paymentPayLabel(p), p.created_by && state.members.length > 1 ? memberName(p.created_by) || "" : ""].filter(Boolean).map(esc);
  const amount = p.amount != null ? esc(Units.money(num(p.amount), p.currency || Units.region.currency)) : `<span class="muted">${t("未填金额")}</span>`;
  // 没有 ⋯ / ▾：电脑右键、手机长按弹菜单（编辑 / 复制 / 删除）；删除一笔另有手机左滑
  const detail = { label: t("详情"), href: `${href("bills", "spend")}?view=${encodeURIComponent(p.id)}`, first: true };
  const menu = p.virtual && p.virtual !== "medical" || picking ? "" : p.virtual ? ` ${lpAttr([detail], p.name)}` : ` ${lpAttr([detail, bill ? { label: t("编辑"), href: editGo } : { label: t("编辑"), action: "spend-edit", data: { id: p.id } }, { label: t("复制"), action: "spend-copy", data: { id: p.id } }, { label: t("删除"), action: "purchase-del", data: { id: p.id }, danger: true }, { label: t("多选删除"), action: "spend-sel-start", data: { id: p.id } }], p.name)}`;
  return `<li${picking ? "" : ` data-swipe-del="purchase"`} class="rec-row${picking ? " is-pick" : ""}" ${picking ? "data-row-chk" : `data-row-open="${esc(rowGo)}"`}${menu}>${sel}
    <div class="grow"><span class="name"><span class="rec-day">${esc(fmtDay(p.purchased_at))}</span>${title}${tags}</span>${desc.length ? `<small class="dots">${dots(desc)}</small>` : ""}</div>
    <b class="rec-amt">${p.amount != null && num(p.amount) < 0 ? `<span class="badge b-ok">${t("退款")}</span> ` : ""}${amount}</b>
    ${p.virtual ? "" : `<button type="button" class="ui-btn swipe-src" data-size="sm" data-tone="ghost" data-action="purchase-del" data-id="${p.id}" aria-label="${esc(t("删除 {name} 这笔记录", { name: p.name }))}">${t("删除")}</button>`}</li>`;
}
const monthName = (m) => (lang === "en" ? `${MONTH_EN[+m.slice(5) - 1]} ${m.slice(0, 4)}` : t("{y} 年 {m} 月", { y: m.slice(0, 4), m: +m.slice(5) }));
/** 筛选条下面的标签：下拉里看不到的条件（图表钻取带来的预算分组、一组商店、一段月份、导入批次）一项一个，点标签去掉那一项。
 *  分类 / 商店 / 年份 / 月份 / 搜索就在上面的筛选条里，不再重复（和收入明细一样） */
function activeFilterChips() {
  const f = state.spendFilter, out = [];
  const storeName = (k) => (k === "__none__" ? t(STORE_NONE.name) : knownStores().find((x) => storeKey(x) === k) || (spendList.facets?.stores || []).find((x) => storeKey(x) === k) || k);
  if (f.grp) { const g = budgetBridge.groups.find((x) => x.id === f.grp); out.push(["grp", f.grp === "!bills" ? t("不含账单的花费") : g ? `${g.icon} ${t(g.name)}` : f.grp]); }
  if (f.stores?.length) { const n = f.stores.map(storeName); out.push(["stores", n.length <= 3 ? n.join("、") : t("{a} 等 {n} 家", { a: n.slice(0, 2).join("、"), n: n.length })]); }
  if (f.months?.length) {
    const m0 = f.months[0], whole = m0.endsWith("-01") && f.months.every((m) => m.startsWith(m0.slice(0, 4)));
    const label = f.months.length === 1 ? monthName(m0) : whole ? t("{y} 年", { y: m0.slice(0, 4) }) : `${monthName([...f.months].sort()[0])} → ${monthName([...f.months].sort().at(-1))}`;
    out.push(["months", f.dmax ? `${label}（${t("每月 1–{d} 日", { d: f.dmax })}）` : label]);
  } else if (f.dmax) out.push(["months", t("每月 1–{d} 日", { d: f.dmax })]);
  if (dayWindow(f)) out.push(["days", `${t("日期")}：${dayLabel(f)}`]);
  if (f.batch) { const bt = batchOf(f.batch); out.push(["batch", t("导入批次：{name}", { name: bt ? (bt.b.account || bt.b.file || t("银行导入")) + (bt.b.from ? ` · ${bt.b.from} → ${bt.b.to || bt.b.from}` : bt.b.at ? ` · ${String(bt.b.at).slice(0, 10)}` : "") : f.batch })]); }
  return out;
}
function spendChipsHtml() {
  const chips = activeFilterChips(); if (!chips.length) return "";
  return `<div class="filter-chips" role="group" aria-label="${t("当前筛选")}"><span class="muted">${t("当前筛选")}</span>${chips.map(([k, label]) => `<button type="button" class="chip fchip" data-action="spend-chip-clear" data-k="${k}" aria-label="${esc(t("去掉筛选：{x}", { x: label }))}">${esc(label)} <span aria-hidden="true">✕</span></button>`).join("")}</div>`;   // 全部清除：工具条上统一的「清除筛选」
}
export function clearSpendFilter(k) {
  const f = state.spendFilter;
  if (k === "all") Object.assign(f, NO_SPEND_FILTER());
  else if (k === "grp") f.grp = null; else if (k === "batch") f.batch = null; else if (k === "stores") f.stores = null; else if (k === "months") { f.months = null; f.dmax = null; } else if (k === "days") Object.assign(f, { dpre: "all", dfrom: "", dto: "" });
}
/** 筛选条、各个下拉和搜索框都按当前筛选重画（点掉标签后下拉也跟着回到“全部”） */
export function renderSpendRecords() { const h = $("#spendRecords"); if (h) h.innerHTML = spendRecordsHtml(); }
/** 列表本体 + 合计；搜索 / 筛选变化只重画这一块（输入框不丢焦点）。月小计、合计来自 spend_stats（整组筛选结果，不只是已读到的几页） */
function spendListHtml() {
  const f = state.spendFilter, L = spendList.sync(spendParams()), st = L.stats || {};
  if (!L.rows.length) {
    if (L.busy) return `<p class="muted" role="status">${t("加载中…")}</p>`;
    return L.err ? `<div class="empty"><strong>${t("没读到花费记录")}</strong>${esc(L.err)}</div>` : `<div class="empty"><strong>${t("没有符合条件的记录")}</strong>${t("换个关键词或筛选试试。")}</div>`;
  }
  const byDate = f.sort === "new" || f.sort === "old", months = st.months || {}, Lk = spendLookups();
  let out = "", cur = null;
  for (const p of L.rows) {
    if (byDate) {
      const m = monthKey(p.purchased_at);
      if (m !== cur) { cur = m; const inM = months[m] || { n: 0, sum: 0 }; out += `<li class="rec-month"><b>${esc(monthName(m))}</b><span class="muted">${esc(t("{n} 笔", { n: inM.n }))} · ${esc(money(num(inM.sum)))}</span></li>`; }
    }
    out += spendRow(p, Lk);
  }
  const S = state.spendSel, own = L.rows.filter((p) => !p.virtual), delN = S ? own.filter((p) => S.has(p.id)).length : 0;
  const selBar = S ? `<div class="sel-bar" role="region" aria-label="${esc(t("多选删除"))}"><b id="selCount">${t("已选 {n} 笔", { n: delN })}</b>
      <button type="button" class="ui-btn" data-size="sm" data-tone="ghost" data-action="spend-sel-all">${t("全选当前显示的 {n} 笔", { n: own.length })}</button>
      <button type="button" class="ui-btn" data-size="sm" data-tone="ghost" data-action="spend-sel-none">${t("清空")}</button>
      <button type="button" class="ui-btn" data-size="sm" data-tone="danger" data-action="spend-sel-del" ${delN ? "" : "disabled"}>${t("删除所选")}</button>
      <button type="button" class="ui-btn" data-size="sm" data-tone="ghost" data-action="spend-sel-toggle">${t("退出多选")}</button>
      <small class="muted" style="flex-basis:100%">${t("先用上面的筛选（年份、月份、收款方、分类、批次）缩小范围，再全选；删除前会再确认一次。")}</small></div>` : "";
  const xNote = st.xn ? `；${t("其中 {n} 笔转账（{a}）不算进合计", { n: st.xn, a: money(num(st.xsum)) })}` : "";
  // 2026-11-14 用户定：明细上面不再放一大段统计（看板上有）；明细金额不遮（data-money-off）
  void xNote;
  return `${selBar}<ul class="restock-list rec-list${S ? " selecting" : ""}" data-money-off>${out}</ul>
    ${L.busy ? `<p class="muted" role="status" style="text-align:center">${t("加载中…")}</p>` : moreBtn(L.hasMore, 'data-action="spend-more"')}`;
}
/** 合计按统计桶拆开（spend_stats.bycat，迁移 061）：明细的合计 = 除转账外的全部流出，收支总览的「消费」只算 日常 + 住房，
 *  这里把两者对上。只有一个桶时不拆；没跑迁移（没有 bycat）时不显示。 */
function totalSplitHtml(st) {
  if (!Array.isArray(st.bycat) || !st.bycat.length) return "";
  const by = {};
  for (const r of st.bycat) { const b = bucketOf(canonCat(r.c), r.nat); if (b) by[b] = (by[b] || 0) + num(r.sum); }
  const parts = BUCKETS.filter((b) => Math.abs(by[b.id] || 0) >= 0.005);
  if (parts.length < 2) return "";
  const cons = (by.living || 0) + (by.housing || 0);
  return `<div class="total-split">${parts.map((b) => `<span><i aria-hidden="true" style="background:${b.color}"></i>${esc(t(b.name))} ${esc(money(by[b.id]))}</span>`).join("")}</div>
    <div>${t("收支总览里的「消费」= 日常生活 + 住房 = {m}；财务及其他（税、保险、利息、奉献、还本）、资本性、投资另算。", { m: money(cons) })}</div>`;
}
export function renderSpendList() {
  const host = $("#spendList"); if (!host) return;
  host.innerHTML = spendListHtml();
  const chips = $("#spendChips"); if (chips) chips.innerHTML = spendChipsHtml();
}
/** 多选删除用：已经读到的（不含虚拟的医疗付款） */
export const spendRowsLoaded = () => spendList.rows.filter((p) => !p.virtual);
export { NO_SPEND_FILTER, spendBase } from "./records-lite.js";
export function spendRecordsHtml() {
  const f = state.spendFilter, fc = spendList.facets || {};
  if (fc.years && !fc.years.length) return `<div class="panel empty"><strong>${t("还没有花费记录")}</strong>${t("购物车点“已买到”、录入购物或上面的补记，都会出现在这里。")}</div>`;
  // 下拉选项：数据库读到的（全部年份）+ 联想里近 400 天的商店，在第一次统计读回来之前也有东西可选
  const y0 = new Date().getFullYear(), first = Math.min(state.stats.firstYear || y0, ...(fc.years || []).map(Number));
  const years = [...new Set([...(fc.years || []), ...Array.from({ length: Math.max(1, y0 - first + 1) }, (_, i) => String(y0 - i))])].sort().reverse();
  const stores = [...new Map([...knownStores(), ...(fc.stores || [])].map((x) => [storeKey(x), x])).values()].sort(compare);
  const used = new Set((fc.cats || []).map(canonCat));   // 分类树：一级、二级总在，叶子只列有记录的（和选中的）
  const opt = (v, label, cur) => `<option value="${esc(v)}" ${cur === v ? "selected" : ""}>${esc(label)}</option>`;
  return `
    <div class="panel">
      <div class="toolbar ix-toolbar">
        <input type="search" id="spendSearch" placeholder="${t("搜索名称或收款方")}" value="${esc(f.q)}" aria-label="${t("搜索花费记录")}">
        <select id="spendCat" data-search aria-label="${t("按分类筛选")}">${opt("all", t("全部分类"), f.cat)}${f.cat === "bills" || String(f.cat).startsWith("billfam_") ? opt(f.cat, t("账单"), f.cat) : ""}${treeOptions(f.cat, used)}</select>
        <select id="spendNat" data-nosearch aria-label="${t("按经济性质筛选")}">${opt("all", t("全部性质"), f.nat || "all")}${NATURES.map((n) => opt(n.id, t(n.name), f.nat)).join("")}</select>
        ${activeProps().length > 1 || (f.prop && f.prop !== "all") ? `<select id="spendProp" data-nosearch aria-label="${t("按房产筛选")}">${opt("all", t("全部房产"), f.prop || "all")}${activeProps().map((p) => opt(p.id, p.name, f.prop)).join("")}${opt("none", t("没关联房产"), f.prop)}</select>` : ""}
        <select id="spendStore" data-search aria-label="${t("按收款方筛选")}">${opt("all", t("全部收款方"), f.store)}${stores.map((x) => opt(storeKey(x), x, f.store)).join("")}${opt("__none__", t("未填写收款方"), f.store)}</select>
        <select id="spendRange" class="range-sel" data-default="all" data-nosearch aria-label="${t("时间范围")}">${rangeOptionsHtml(f.range || "all", { first, allFirst: true })}</select>
        ${customHtml(f.range || "all", { first, attr: "data-spend-c" })}
        ${daysControlsHtml(f)}
        ${amtSelectHtml({ id: "spendAmt", cur: f.amt || "all", neg: true })}${amtCustomHtml({ cur: f.amt || "all", min: f.amin, max: f.amax, minAttr: 'data-spend-amt="min"', maxAttr: 'data-spend-amt="max"' })}
        <select id="spendSort" data-nosearch aria-label="${t("排序")}">${SPEND_SORTS.map(([v, l]) => opt(v, t(l), f.sort)).join("")}</select>
        ${clearFiltersBtn("spend", changed(f, FD.spend))}
        ${toolbarEye()}
      </div>
      <div id="spendChips">${spendChipsHtml()}</div>
      <div id="spendList" style="margin-top:8px">${spendListHtml()}</div>
      <p class="muted" style="margin:8px 0 0;font-size:12.5px">${t("点一行看详情；手机长按那一行（电脑右键点那一行）可以看详情 / 编辑 / 复制 / 删除 / 多选删除，删除也可以向左滑。")}</p>
    </div>`;
}
