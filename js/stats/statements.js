/* 财务 → 对账单：花费和收入共用的入口。
 * · 导入：一份银行 / 信用卡对账单同时导入花费和收入（刷卡 / 扣款 → 花费；工资、电汇、Zelle 转入 → 收入；信用卡还款、自己账户之间的转账跳过），逻辑在 bank-import.js。
 * · 全部流水：统一账本 ledger_v（迁移 056）——花费和收入按时间排在一起，只读（对账时一眼看全；改动去对应的花费 / 收入页）。收入只显示你有权看到的（行级安全），认定收入和资本流入分开算。
 * · 导出打印：花费（年度 CSV、打印）和收入 / 收支差额（CSV、打印）放在一起，逻辑还在 stats/views.js 和 income/views.js，这里只是把它们摆到同一页。
 * 原来在 花费 → 银行导入、收入 → 银行导入 的入口都指到这里（旧链接 #/bills/spend?tab=import 自动跳过来）。 */
import { state } from "../core/state.js";
import { $, esc, fmtDate, money, moneyExact, num, toast } from "../core/util.js";
import { t } from "../core/i18n.js";
import { href } from "../core/router.js";
import { tabBar } from "../core/hub.js";
import { debounce, moreBtn, pageSize } from "../core/pager.js";
import { STATEMENT_TABS, activeTab } from "../core/tabs.js";
import { bankImportTab } from "./bank-import.js";
import { STAT_CATS, download, spendExportTab, statCat, toCsv, ymd } from "./views.js";
import { isTransfer } from "../core/taxonomy.js";
import { Store } from "../core/store.js";
import { splitRecord } from "../core/income-taxonomy.js";
import { incomeExportHtml } from "../income/views.js";
import { canSeeAll, inc, kindLabel, kindOf, personName, skey, windowOf } from "../income/logic.js";

const hrefOf = (id) => `${href("bills", "statements")}${id === "import" ? "" : `?tab=${id}`}`;
const R2 = (v) => Math.round(v * 100) / 100;
let render = () => {};

/* ───────────── 全部流水（只读） ───────────── */
const RANGES = [["month", "本月"], ["3m", "近 3 个月"], ["6m", "近 6 个月"], ["12m", "近 12 个月"], ["ytd", "今年"], ["lastyear", "去年"]];
const DIRS = [["all", "全部"], ["spend", "花费"], ["income", "收入"]];
const SS = () => (state.stmt ||= { range: "3m", dir: "all", q: "", limit: pageSize() });
const sgn = (v, short) => `${v < 0 ? "−" : "+"}${short ? money(Math.abs(v), true) : moneyExact(Math.abs(v))}`;

/** 这段时间的统一账本（迁移 056 的 ledger_v：花费 + 事件型账单的付款 + 收入，行级安全照常），按窗口缓存；数据变了标过期 */
const LEDGER = new Map();
window.addEventListener("spend-rows-changed", () => { for (const e of LEDGER.values()) e.stale = true; });
window.addEventListener("income-data-changed", () => { for (const e of LEDGER.values()) e.stale = true; });
function ledgerFor(w) {
  const key = `${w.from}|${w.to}`; let e = LEDGER.get(key);
  if (!e || (e.stale && !e.busy)) {
    if (!e) { if (LEDGER.size > 8) LEDGER.delete(LEDGER.keys().next().value); e = { rows: null }; LEDGER.set(key, e); }
    e.busy = true; e.stale = false;
    const end = new Date(`${w.to}T12:00:00`); end.setDate(end.getDate() + 1);
    Store.ledgerRange(w.from, ymd(end.toISOString())).then((rows) => { e.rows = rows || []; e.err = ""; })
      .catch((err) => { e.err = err?.message || String(err); e.rows = e.rows || []; toast(/ledger_v|does not exist|schema cache/i.test(e.err) ? t("全部流水读不出来：数据库还没升级，请先执行 supabase/migrations/056_income_ledger.sql") : t("读取流水失败：{msg}", { msg: e.err })); })
      .finally(() => { e.busy = false; render(false); });
  }
  return e.rows;
}
/** 这段时间的流水：统一账本里的花费和收入，按日期新到旧；spendLoading = 还在读。
 *  收入按前端规则拆成认定收入 / 资本流入（js/core/income-taxonomy.js）；花费的转账照样列出，不算花费 */
function build() {
  const o = SS(), w = windowOf(SS().range), I = inc(), cats = Object.fromEntries(STAT_CATS().map((c) => [c.id, c]));
  const list = ledgerFor(w), out = [], cur = Units.region.currency;
  for (const x of list || []) {
    if (x.source === "income") {
      if (o.dir === "spend") continue;
      const rec = I.rec.find((r) => r.id === x.id) || { kind: x.category, amount: num(x.amount), repay_required: x.repay_required, income_amount: x.income_amount };
      const s = splitRecord(rec), k = kindOf(x.category), d = x.occurred_on || ymd(x.occurred_at);
      out.push({ d, at: x.occurred_at, spend: false, amt: num(x.amount), inc: s.income, cap: s.cap, ico: k.icon, name: x.name, sub: [d, kindLabel(x.category), x.person_id && personName(x.person_id), acctOf(x)].filter(Boolean).join(" · "), id: x.id,
        tag: !s.cap ? t("收入") : s.income ? t("收入 + 资本流入") : x.repay_required ? t("借款") : t("资本流入") });
      continue;
    }
    if (o.dir === "income" || (x.currency && x.currency !== cur)) continue;
    const c = cats[statCat(x.category)], d = x.source === "purchase" ? ymd(x.occurred_at) : x.occurred_on || ymd(x.occurred_at), amt = num(x.amount), xfer = isTransfer(x.category, x.nature);   // 转账（信用卡还款、自己账户之间）：列出来，不算花费也不算收入
    out.push({ d, at: x.occurred_at, spend: true, amt, ico: c?.icon || "🧾", name: x.name, sub: [d, c && t(c.name), x.counterparty, x.source === "medical" && t("账单")].filter(Boolean).join(" · "), href: `${href("bills", "spend")}?tab=records&q=${encodeURIComponent(x.name)}`, xfer, tag: xfer ? t("转账") : amt > 0 ? t("退款") : t("花费") });
  }
  const q = skey(o.q || "");
  const rows = out.filter((x) => !q || skey(`${x.name} ${x.sub}`).includes(q)).sort((a, b) => b.d.localeCompare(a.d) || String(b.at).localeCompare(String(a.at)));
  const inc$ = R2(rows.filter((x) => !x.spend).reduce((a, x) => a + x.inc, 0)), cap$ = R2(rows.filter((x) => !x.spend).reduce((a, x) => a + x.cap, 0)), spend$ = R2(rows.filter((x) => x.spend && !x.xfer).reduce((a, x) => a + -x.amt, 0));
  return { rows, w, loading: list == null, inc: inc$, cap: cap$, spend: spend$, net: R2(inc$ - spend$) };
}
/** 账本行的账户：登记过的卡 / 账户 */
const acctOf = (x) => { const c = x.account_id && (state.cards || []).find((y) => y.id === x.account_id); return c ? `${c.name}${c.last4 ? ` ••${c.last4}` : ""}` : ""; };
function listHtml() {
  const o = SS(), b = build(), head = b.rows.slice(0, o.limit);
  let last = "";
  const items = head.map((x) => {
    const day = x.d !== last ? (last = x.d, `<li class="st-day"><b>${fmtDate(x.d)}</b></li>`) : "";
    const inner = `<span class="st-ico ${x.spend ? "" : "in"}" aria-hidden="true">${x.ico}</span><span class="grow"><b class="name">${esc(x.name)}</b><small>${esc(x.sub)}</small></span><span class="st-side"><b class="st-amt ${x.amt > 0 ? "in" : "out"}">${sgn(x.amt)}</b><span class="st-tag ${x.spend && x.amt < 0 ? "" : "in"}">${esc(x.tag)}</span></span>`;
    const main = x.spend ? `<a class="st-main" href="${x.href}" title="${esc(t("去花费页查看 / 修改"))}">${inner}</a>` : `<button type="button" class="st-main" data-inc="open" data-id="${esc(x.id)}" title="${esc(t("去收入页查看 / 修改"))}">${inner}</button>`;
    return `${day}<li class="st-row">${main}</li>`;
  }).join("");
  return `<div class="muted small" style="margin:0 0 6px">${b.loading ? t("加载中…") : t("{n} 笔", { n: b.rows.length })}</div>
    <ul class="st-list">${items || `<li class="muted" style="padding:10px 0">${t("这段时间没有记录")}</li>`}</ul>
    ${moreBtn(b.rows.length > head.length, 'data-stmt="more"')}`;
}
function allTab() {
  const o = SS(), b = build(), I = inc();
  const note = !I.ok ? `<p class="muted small" role="status">${t("收入还没读到（迁移 042 没执行？），这里先只显示花费。")}</p>` : !canSeeAll() && o.dir !== "spend" ? `<p class="muted small" role="status">${t("你只能看到自己记的收入；家主在 设置 → 家庭与成员 给你开财务权限后，才能看全家的。")}</p>` : "";
  return `<div class="time-bar"><label class="tb-field"><span>${t("时间范围")}</span><select data-stmt="range" data-nosearch>${RANGES.map(([v, l]) => `<option value="${v}" ${v === o.range ? "selected" : ""}>${t(l)}</option>`).join("")}</select></label>
      <div class="chips" role="group" aria-label="${esc(t("显示什么"))}" style="margin:0">${DIRS.map(([v, l]) => `<button type="button" class="chip" data-stmt-dir="${v}" aria-pressed="${o.dir === v}">${t(l)}</button>`).join("")}</div></div>
    ${note}<div class="kpis"><div class="kpi"><span>${t("收入（认定）")}</span><b>${money(b.inc)}</b>${b.cap ? `<small>${t("另有资本流入 {a} · 不计收入", { a: money(b.cap) })}</small>` : ""}</div><div class="kpi"><span>${t("花费")}</span><b>${money(b.spend)}</b></div><div class="kpi"><span>${t("收支差额")}</span><b class="${b.net < 0 ? "down" : ""}">${money(b.net)}</b></div></div>
    <div class="panel"><div class="st-tools"><input type="search" data-stmt-q value="${esc(o.q)}" placeholder="${esc(t("搜索名称 / 商店 / 付款方 / 账户"))}" aria-label="${esc(t("搜索"))}"><button type="button" class="btn btn-sm btn-ghost" data-stmt="csv">${t("导出这个列表 CSV")}</button></div>
      <p class="muted small" style="margin:6px 0 8px">${t("只读：花费和收入按时间排在一起。点一行去对应的花费 / 收入页查看或修改。")}</p>
      <div id="stmtList">${listHtml()}</div></div>`;
}

/* ───────────── 导出打印 ───────────── */
function exportBody() {
  return `<section class="section"><div class="section-head"><h2>📊 ${t("花费")}</h2><p>${t("年度报表 CSV、打印花费统计")}</p></div></section>${spendExportTab()}
    <section class="section"><div class="section-head"><h2>💵 ${t("收入与收支差额")}</h2><p>${t("收入、花费、差额合并成一张报表，或只导其中一项；只有家主（或被允许的人）能导出全家的收入")}</p></div></section>${incomeExportHtml()}`;
}

export function viewStatements() {
  const tab = activeTab(state.route) || "import";
  return `<section class="section"><div class="section-head"><h2>🏦 ${t("对账单")}</h2></div>
      <p class="muted" style="margin:-6px 0 10px;font-size:13px">${t("导入银行 / 信用卡对账单（花费和收入一次导入），对账时看花费和收入的全部流水，导出花费、收入和收支差额的报表。")}</p>
      ${tabBar(STATEMENT_TABS, tab, hrefOf, t("对账单内容"))}</section>
    ${tab === "export" ? exportBody() : tab === "all" ? `<section class="section" id="stmtAll">${allTab()}</section>` : bankImportTab()}`;
}

export function initStatements({ render: r }) {
  render = r;
  const main = document.getElementById("main");
  const onStmtPage = () => state.route?.section === "bills" && state.route?.sub === "statements";
  main.addEventListener("click", (e) => {
    const chip = e.target.closest?.("[data-stmt-dir]");
    if (chip && onStmtPage()) { const o = SS(); o.dir = chip.dataset.stmtDir; o.limit = pageSize(); return render(false); }
    const b = e.target.closest?.("[data-stmt]"); if (!b || b.tagName === "SELECT" || !onStmtPage()) return;
    const o = SS();
    if (b.dataset.stmt === "more") { o.limit += pageSize(); const el = $("#stmtList"); if (el) el.innerHTML = listHtml(); return; }
    if (b.dataset.stmt === "csv") {
      const rows = build().rows; if (!rows.length) return toast(t("没有可导出的记录"));
      download(`${(state.household?.name || t("家庭")).replace(/[\\/:*?"<>|\s]/g, "")}-${t("全部流水")}.csv`, toCsv([[t("日期"), t("类型"), t("名称"), t("说明"), t("金额")], ...rows.map((x) => [x.d, x.tag, x.name, x.sub, x.amt])]));
    }
  });
  main.addEventListener("change", (e) => { const el = e.target; if (el.dataset?.stmt === "range" && onStmtPage()) { const o = SS(); o.range = el.value; o.limit = pageSize(); render(false); } });
  const listSoon = debounce(() => { const box = $("#stmtList"); if (box) box.innerHTML = listHtml(); });   // 搜索：停下 ~200ms 再重画
  main.addEventListener("input", (e) => { const el = e.target; if (el.dataset?.stmtQ !== undefined && onStmtPage()) { const o = SS(); o.q = el.value; o.limit = pageSize(); listSoon(); } });
}
