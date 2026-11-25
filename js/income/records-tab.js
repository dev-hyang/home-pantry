/* 收入 → 明细（带银行导入入口）：筛选条、分页列表、合计。 */
import { $, esc, fmtDate, num } from "../core/util.js";
import { CHANNELS, capitalKinds, customKinds, groupOf, inc, isOwnerNow, kindLabel, kindList, kindMatch, kindOf, kindOptionsHtml, normKindSel, openRepayments, personName, repayState, skey } from "./logic.js";
import { FD, changed, clearFiltersBtn } from "../core/clear-filters.js";
import { INC_L1S, incLeaf, incLeavesOf, splitRecord } from "../core/income-taxonomy.js";
import { aaFixHtml } from "./aa-fix.js";
import { toolbarEye } from "../core/toolbar-eye.js";
import { activeTab } from "../core/tabs.js";
import { compact } from "../core/list-query.js";
import { formHtml } from "./record-form.js";
import { href } from "../core/router.js";
import { incList } from "./list.js";
import { meta } from "../bills/budget.js";
import { moreBtn, pageLimit, pageMoreBtn, pageSize } from "../core/pager.js";
import { scanHtml } from "./scan.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";
import { acctShow, empty, fmtMoney, incFormHref, incViewHref, incomeHref, personOptions, selOpts, yearsOf } from "./shared.js";
import { acctLabel } from "../bills/card-picker.js";
import { customHtml, rangeOptionsHtml, rangeWindow } from "../core/time-range.js";
import { amtCustomHtml, amtParams, amtSelectHtml } from "../core/amount-filter.js";
import { lpAttr } from "../core/long-press.js";

/* ───────────── 银行导入：对账单里的入账补入收入（和「花费 → 银行导入」是同一个入口） ───────────── */
export function importTab() {
  // 「最近导入的收入」：笔数 / 合计按现在还带着这批标记的收入算（收入已整表在内存里），和点「查看收入」看到的一致；导入时的数字不一样就注一句
  const I = inc(), live = new Map();
  for (const r of I.rec) if (r.import_batch) { const x = live.get(r.import_batch) || { n: 0, sum: 0 }; x.n++; x.sum = Math.round((x.sum + num(r.amount)) * 100) / 100; live.set(r.import_batch, x); }
  const allB = (meta("_bank_batches", []) || []).filter((b) => b.inN || live.has(b.id)).slice().reverse();
  const lim = pageLimit("inc-batches"), batches = allB.slice(0, lim);
  const nums = (b) => live.get(b.id) || { n: 0, sum: 0 };
  return `<div class="panel"><h3 style="margin:0 0 6px">🏦 ${t("从银行对账单导入收入")}</h3>
    <p class="muted small" style="margin:0 0 10px">${t("同一个入口：选一次对账单（CSV、Excel、OFX、PDF、截图），里面刷卡 / 扣款记成花费，工资、利息、股息、转入这些入账单独列出来记成收入（借款到账、券商转入这类记成资本流入，不算收入），互不重复。自己账户之间的转账会跳过。")}</p>
    <div class="ui-acts"><a class="ui-btn" data-size="sm" data-tone="primary" href="${href("bills", "statements")}">${t("去导入对账单")}</a><a class="ui-btn" data-size="sm" href="${incomeHref("records")}">${t("或者拍照 / 手动记一笔")}</a></div></div>
  <div class="panel"><h3 style="margin:0 0 6px">${t("最近导入的收入")}</h3>${batches.length ? `<ul class="restock-list">${batches.map((b) => `<li><div class="grow"><span class="name">${b.account ? `🏦 ${esc(b.account)}` : esc(b.file || t("银行导入"))}</span><small>${t("收入 {n} 笔", { n: nums(b).n })} · ${fmtMoney(nums(b).sum)} · ${t("导入于 {d}", { d: String(b.at).slice(0, 10) })}${nums(b).n !== (b.inN || 0) ? ` <span class="bank-dup">${nums(b).n ? t("（导入时 {n} 笔，之后改过）", { n: b.inN || 0 }) : t("（导入的都已删除）")}</span>` : ""}</small></div>${nums(b).n ? `<a class="ui-btn" data-size="sm" data-tone="ghost" href="${href("bills", "income")}?tab=records&batch=${esc(b.id)}">${t("查看收入")}</a>` : ""}</li>`).join("")}</ul><p class="muted bank-batch-count">${t("显示 {a} / 共 {b} 批", { a: batches.length, b: allB.length })}</p>${pageMoreBtn("inc-batches", allB.length, batches.length)}` : `<p class="muted small" style="margin:0">${t("还没有从对账单导入过收入。")}</p>`}</div>`;
}
export function repayPanel() {
  const list = openRepayments(); if (!list.length) return "";
  return `<div class="panel"><h3 style="margin:0 0 8px">🤝 ${t("还没还清的（个人赠与 / 借款）")}</h3><ul class="restock-list">${list.map(({ r, s }) => `<li><div class="grow"><span class="name">${esc(r.source_name)} · ${fmtMoney(s.total)}</span><small>${t("已还 {a}，还差 {b}", { a: fmtMoney(s.paid), b: fmtMoney(s.left) })}${r.repay_due_on ? ` · ${s.overdue ? `<b class="bank-dup">${t("已逾期")}</b> ` : ""}${t("到期日 {d}", { d: r.repay_due_on })}` : ""}</small></div>
    <a class="ui-btn" data-size="sm" data-tone="ghost" href="${incViewHref(r.id)}">${t("去还款")}</a></li>`).join("")}</ul></div>`;
}
/* ───────────── 明细 ───────────── */
/** 图表钻取的查询串 → 明细筛选：类型（叶子 / g:一级，旧的 g:work 这类自动换算）、日期段 from–to、成员、账户、搜索、ex = 不含资本流入 */
export function applyIncomeDrill(q) {
  const I = inc(), d = (k) => (/^\d{4}-\d{2}-\d{2}$/.test(q.get(k) || "") ? q.get(k) : "");
  Object.assign(I, { q: q.get("q") || "", kind: normKindSel(q.get("kind") || "all"), acct: q.get("acct") || "all", person: q.get("person") || "all", range: "all", amt: "all", amin: "", amax: "", year: "all", month: "all", batch: null, from: d("from"), to: d("to"), ex: q.get("ex") === "1", limit: pageSize(), selMode: false });
}
/** 明细的日期段：图表下钻带来的 from / to 优先；否则按时间范围（全部历史 = 不限） */
const firstYear = () => +(yearsOf().at(-1) || new Date().getFullYear());
function windowOfRecords(I) {
  if (I.from || I.to) return { from: I.from, to: I.to };
  const r = I.range || "all"; if (r === "all") return { from: "", to: "" };
  const w = rangeWindow(r, { first: firstYear() }); return { from: w.from, to: w.to };
}
/* 明细是服务器分页（迁移 054 / 056 的 inc_page / inc_stats）：每次「继续加载」向数据库要下一页，筛选、排序、合计都在 SQL 里做；
 * 类型（叶子 / 一级）、搜索里的类型名称、「默认不算收入的类型」这类只有前端认识的规则，先在这里展开成类型表。 */
const SORT_KEY = { big: "high", small: "low", kind: "name" };
   // 界面的排序 → 通用排序（按类型 = 按类型序号排）
function incParams() {
  const I = inc(), q = skey(I.q), ks = kindList().map((k) => k.id), win = windowOfRecords(I), sort = SORT_KEY[I.sort] || I.sort || "new", byKind = !!I.kind && I.kind !== "all";
  const label = (id) => skey(`${kindLabel(id)} ${kindOf(id).name} ${groupOf(id).name}`);   // 和原来搜索时拼的类型文字一样
  return compact({ kinds: byKind ? ks.filter((k) => kindMatch(I.kind, k)) : null, known: byKind ? ks : null, kunk: byKind && kindMatch(I.kind, "__unknown__") ? true : null,
    person: I.person !== "all" ? I.person : null, acct: I.acct && I.acct !== "all" ? I.acct : null, year: I.year && I.year !== "all" ? I.year : null, mon: I.month && I.month !== "all" ? I.month : null, batch: I.batch || null,
    from: win.from || null, to: win.to || null, ...amtParams(I.amt, I.amin, I.amax),   // amin / amax：金额筛选（迁移 107）
    ex: I.ex ? capitalKinds() : null, capk: capitalKinds(), q: q || null, qkinds: q ? ks.filter((k) => label(k).includes(q)) : null,
    krank: sort === "name" ? Object.fromEntries(ks.map((k, i) => [k, i])) : null, sort });   // 按类型：一级 → 叶子的顺序，同类里新的在前
}
   // loadIncome 读完（实时同步、自己改了）：统计 + 第一页重读
/** 明细顶部「当前筛选」：图表点进来的日期段、不含资本流入，可逐个去掉（和花费明细的筛选条一样） */
function drillChips() {
  const I = inc(), out = [];
  if (I.from || I.to) out.push(["range", I.from === I.to ? I.from : `${I.from || "…"} → ${I.to || "…"}`]);
  if (I.ex) out.push(["ex", t("不含资本流入")]);
  if (!out.length) return "";
  return `<div class="filter-chips" role="group" aria-label="${esc(t("当前筛选"))}"><span class="muted">${t("当前筛选")}</span>${out.map(([k, label]) => `<button type="button" class="chip fchip" data-inc="drill-clear" data-k="${k}" aria-label="${esc(t("去掉筛选：{x}", { x: label }))}">${esc(label)} <span aria-hidden="true">✕</span></button>`).join("")}</div>`;
}
export const canEdit = (r) => isOwnerNow() || r.created_by === state.user?.id;
/** 行上的「收入 / 资本流入」小标：整笔都算收入时不标 */
function recBadge(r) {
  const s = splitRecord(r);
  if (!s.cap) return "";
  return s.income ? `<span class="badge b-ok">${t("收入 {a}", { a: fmtMoney(s.income) })}</span>` : `<span class="badge" style="background:var(--surface-2)">${r.repay_required ? t("借款") : t("资本流入")}</span>`;
}
export function recordRow(r) {
  const I = inc(), s = repayState(r), pick = !!I.selMode && activeTab(state.route) === "records", k = kindOf(r.kind);
  const who = r.person_id ? personName(r.person_id) : "", acct = acctShow(r), sub = [esc(kindLabel(r.kind)), who && esc(who), acct && esc(acct), r.channel && esc(t((CHANNELS.find((c) => c[0] === r.channel) || [])[1] || ""))].filter(Boolean).join(" · ");
  const rb = s ? `<span class="badge ${s.status === "paid" ? "b-ok" : s.overdue ? "b-out" : "b-soon"}">${s.status === "paid" ? t("已还清") : s.overdue ? t("逾期") : t("待还 {a}", { a: fmtMoney(s.left) })}</span>` : "";
  const menu = canEdit(r) ? [{ label: t("详情"), href: incViewHref(r.id), first: true }, { label: t("编辑"), href: incFormHref(r.id) }, { label: t("复制"), data: { inc: "copy", id: r.id } }, { label: t("删除"), data: { inc: "del", id: r.id }, danger: true }, { label: t("多选删除"), data: { inc: "sel-start", id: r.id } }] : [{ label: t("详情"), href: incViewHref(r.id), first: true }];
  // 第一行：日期 图标 名字（图标不单占一列），第二行：类型 · 成员 · 账户 · 收款方式；整行是一个链接，点哪里都进详情
  const head = `<span class="grow"><b class="name"><span class="ix-date">${esc(fmtDate(r.received_on))}</span><span class="ix-ico" style="--k:${k.color}" aria-hidden="true">${k.icon}</span>${esc(r.source_name)}</b><small>${sub}</small></span><span class="ix-side"><b class="ix-amt" data-money>+${fmtMoney(r.amount)}</b>${recBadge(r)}${rb}</span>`;
  return `<li class="ix-li" data-id="${r.id}"${pick ? " data-row-chk" : ""}${canEdit(r) && !pick ? ' data-swipe-del="income"' : ""}${pick ? "" : ` ${lpAttr(menu, r.source_name)}`}>${pick ? `<label class="ix-main"><input type="checkbox" class="ix-chk" data-inc-sel="${r.id}" ${I.sel?.has(r.id) ? "checked" : ""} ${canEdit(r) ? "" : "disabled"} aria-label="${esc(t("选择"))}">${head}</label>` : `<a class="ix-main" href="${esc(incViewHref(r.id))}">${head}</a>${canEdit(r) ? `<button type="button" class="swipe-src" data-inc="del-swipe" data-id="${r.id}">${t("删除")}</button>` : ""}`}</li>`;
}
const selBar = () => { const I = inc(); return I.selMode ? `<div class="ix-selbar"><span id="incSelN" role="status">${t("已选 {n} 笔", { n: I.sel?.size || 0 })}</span><button type="button" class="ui-btn" data-size="sm" data-tone="ghost" data-inc="sel-all">${t("全选当前显示的")}</button><button type="button" class="ui-btn" data-size="sm" data-inc="sel-del">${t("删除所选")}</button><button type="button" class="ui-btn" data-size="sm" data-tone="ghost" data-inc="sel-toggle">${t("退出多选")}</button></div>` : ""; };
const listHtml = () => {
  const L = incList.sync(incParams()), st = L.stats || {}, capS = num(st.cap_sum);
  const empty = `<li class="muted"${L.busy ? ' role="status"' : ""}>${L.busy ? t("加载中…") : L.err ? esc(L.err) : t("没有符合条件的记录")}</li>`;
  const head = st.income_sum != null ? t("{n} 笔，到账 {m} · 认定收入 {i}", { n: st.n ?? "…", m: fmtMoney(num(st.sum)), i: fmtMoney(num(st.income_sum)) }) + (capS > 0 ? ` · ${t("资本流入 {a}", { a: fmtMoney(capS) })}` : "") : t("{n} 笔，合计 {m}", { n: st.n ?? "…", m: fmtMoney(num(st.sum)) });
  void head;   // 2026-11-14 用户定：明细上面不再写「N 笔，到账…」（看板上有）
  return `${selBar()}<ul class="restock-list ix-list">${L.rows.map(recordRow).join("") || empty}</ul>
    ${L.busy && L.rows.length ? `<p class="muted" role="status" style="text-align:center">${t("加载中…")}</p>` : moreBtn(L.hasMore, 'data-inc="more"')}`;
};
export const renderIncList = () => { const el = $("#incList"); if (el) el.innerHTML = listHtml(); };
/** 账户筛选：用过的登记账户 + 「没关联登记账户的」 */
function acctFilterOptions(sel) {
  const used = new Set(inc().rec.map((r) => r.account_id).filter(Boolean)), list = (state.cards || []).filter((c) => used.has(c.id) || c.id === sel);
  const opt = (v, l) => `<option value="${esc(v)}" ${v === sel ? "selected" : ""}>${esc(l)}</option>`;
  return `${opt("all", t("全部账户"))}${list.map((c) => opt(c.id, acctLabel(c))).join("")}${opt("none", t("没关联登记账户的"))}`;
}
export function recordsTab() {
  const I = inc(), top = `${aaFixHtml()}${I.scanOpen ? scanHtml() : ""}${I.form ? formHtml() : ""}`;
  if (!I.rec.length && !I.form) return top + empty() + kindManager();
  // 和花费明细同一套 .toolbar：宽屏一行（搜索 + 下拉）；手机收成「搜索框 + 筛选」按钮，点开才出下拉（shared/compact-filters.js）
  const opt = (v, l, cur) => `<option value="${esc(v)}" ${v === cur ? "selected" : ""}>${esc(l)}</option>`;
  return `${top}<div class="panel"><div class="toolbar ix-toolbar">
    <input type="search" data-inc-f="q" value="${esc(I.q)}" placeholder="${esc(t("搜索付款方 / 备注"))}" aria-label="${esc(t("搜索收入"))}">
    <select id="incKindF" data-search data-inc-f="kind" aria-label="${esc(t("按类型筛选"))}">${kindOptionsHtml(I.kind, { all: true, groups: true, allLabel: t("全部类型") })}</select>
    <select id="incAcctF" data-inc-f="acct" data-nosearch aria-label="${esc(t("按账户筛选"))}">${acctFilterOptions(I.acct || "all")}</select>
    <select id="incPersonF" data-inc-f="person" data-nosearch aria-label="${esc(t("按成员筛选"))}">${personOptions(I.person, { all: true })}</select>
    <select id="incRangeF" class="range-sel" data-inc-f="range" data-default="all" data-nosearch aria-label="${esc(t("时间范围"))}">${rangeOptionsHtml(I.range || "all", { first: firstYear(), allFirst: true })}</select>
    ${customHtml(I.range || "all", { first: firstYear(), attr: "data-inc-c" })}
    ${amtSelectHtml({ id: "incAmtF", attr: 'data-inc-f="amt"', cur: I.amt || "all" })}${amtCustomHtml({ cur: I.amt || "all", min: I.amin, max: I.amax, minAttr: 'data-inc-f="amin"', maxAttr: 'data-inc-f="amax"' })}
    ${clearFiltersBtn("incRec", changed(I, FD.incRec))}
    <select id="incSort" data-inc-f="sort" data-nosearch aria-label="${esc(t("排序"))}">${selOpts([["new", "最近的在前"], ["old", "最早的在前"], ["big", "金额从大到小"], ["small", "金额从小到大"], ["kind", "按类型（一级 · 具体类型）"]], I.sort || "new")}</select>${toolbarEye()}</div>
    ${drillChips()}
    ${I.batch ? `<div class="muted small" style="margin-top:8px">${t("只看一次银行导入的入账")} <button type="button" class="ui-btn" data-size="sm" data-tone="ghost" data-inc="batch-clear">${t("看全部收入")}</button></div>` : ""}
    <div id="incList" style="margin-top:8px">${listHtml()}</div>
  </div>${kindManager()}`;
}
/** 自定义类型挂在哪个一级下（旧的大类显示成换算后的一级） */
const l1Select = (attrs, sel) => `<select ${attrs} data-nosearch>${INC_L1S.map((g) => `<option value="${g.id}" ${sel === g.id ? "selected" : ""}>${esc(`${t(g.name)}${g.income ? "" : ` · ${t("不计收入")}`}`)}</option>`).join("")}</select>`;
function kindManager() {
  const cs = customKinds();
  return `<details class="panel ref-panel" style="margin-top:10px"><summary><b>${t("管理收入类型")}</b><small>${t("内置 {n} 种，自定义 {m} 种", { n: kindList().filter((k) => !k.custom).length, m: cs.length })}</small><span class="ui-chev" aria-hidden="true">›</span></summary><div class="ref-body">
    <p class="muted small" style="margin:0 0 6px">${t("内置类型的一级：{g}", { g: INC_L1S.map((g) => `${t(g.name)}（${incLeavesOf(g.id).filter((id) => !id.startsWith("c_")).map((id) => t(incLeaf(id).name)).join("、")}）`).join("；") })}</p>
    <p class="muted small" style="margin:0 0 6px">${t("「资本与资产流入」只是现金流入，不算收入：卖房 / 卖股票的本金、借款、本金返还、自己账户转入、国际电汇。卖出时有赚的，在记录里填「其中已实现收益」，那部分算投资收益。")}</p>
    <ul class="plain small">${cs.map((k) => `<li>${esc(k.icon || "🏷️")} ${esc(kindLabel(k.id))} ${l1Select(`data-inc-kparent="${esc(k.id)}" aria-label="${esc(t("一级分类"))}"`, k.parent)} <button type="button" class="ui-btn" data-size="sm" data-tone="ghost" data-inc="kind-del" data-id="${esc(k.id)}">${t("删除")}</button></li>`).join("") || `<li class="muted">${t("还没有自定义类型")}</li>`}</ul>
    <form data-inc-form="kind" class="form-grid"><label>${t("一级分类")}${l1Select('name="parent"', "other_income")}</label><label>${t("图标")}<input name="icon" maxlength="4" value="🏷️" style="width:4em"></label><label>${t("名称")}<input name="name" maxlength="20" required placeholder="${esc(t("例如：稿费、副业"))}"></label><div class="ui-acts"><button class="ui-btn" data-size="sm">${t("添加类型")}</button></div></form></div></details>`;
}
