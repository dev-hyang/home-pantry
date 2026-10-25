/* 账单 B1 · 页面：概览、清单、记录、常用账单模板、账单整页表单（含缴费记录） */
import { state } from "../core/state.js";
import { Store } from "../core/store.js";
import { $, esc, fmtDate, fmtShort, money, num, stampText, todayISO, toast } from "../core/util.js";
import { SECTIONS, go, href } from "../core/router.js";
import { compare, joinList, t } from "../core/i18n.js";
import { memberName } from "../core/logic.js";
import { download, monthKey, spendGlance } from "../stats/views.js";
import { STATUS_RANK, acctText, escrowMonthlyFor, advanceDue, alertText, billAlerts, billCat, currentProperty, freqText, icsFor, initialDue, propertyName, subscriptionSummary, upcoming } from "./logic.js";
import { propertyTag, withProperty } from "../core/alerts.js";
import { autofillBar } from "../core/autofill.js";
import { escrowPanelHtml } from "./escrow.js";
import { billInUse, endedSuffix, propertyActive, propertyById, propertyOptionsHtml } from "../core/lifecycle.js";
import { kindsNote, ONETIME, RECURRING } from "./kinds.js";
import { medRow } from "./medical-views.js";
import { RECURRING_TABS, activeTab } from "../core/tabs.js";
import { tabBar, tabHub } from "../core/hub.js";
import { countBadge, crumbNav, filledCount, hubList, hubRow, sectionCrumb } from "../core/hub.js";
import { acctById, acctLabel, accountOptions, billPayLabel, payAcctValue, paymentPayLabel, resolvePayAccount } from "./cards-views.js";

const B = () => window.BILLS;
const BADGE = { overdue: "b-out", due: "b-low", verify: "b-soon", soon: "b-soon", ok: "b-ok", escrow: "b-ok", none: "", ended: "", inactive: "" };
const STATUS_LABEL = { overdue: "逾期", due: "今天到期", verify: "待核对", soon: "即将到期", ok: "正常", escrow: "Escrow 代缴", none: "未填到期日", ended: "已结束", inactive: "已停用" };
const mny = (v, cur) => (v == null ? "—" : Units.money(num(v), cur || Units.region.currency));

/** 房产切换条（房屋、账单页共用）；只有一套房产时不显示 */
export function propertyBar({ all = false } = {}) {
  const list = state.properties.filter((p) => propertyActive(p) || p.id === state.propertyId);   // 在用的 + 当前正看的（已卖出的从这里退出，要看历史去房屋列表）
  if (list.length < 2) return "";
  const cur = all ? state.billsFilter.property : state.propertyId;
  const chip = (id, label) => `<button type="button" class="chip" data-action="${all ? "bills-prop" : "property"}" data-id="${id}" aria-pressed="${cur === id}">${label}</button>`;
  return `<div class="chips prop-bar" role="group" aria-label="${t("选择房产")}">${all ? chip("all", t("全部房产")) : ""}${list.map((p) => chip(p.id, `🏠 ${esc(p.name)}`)).join("")}</div>`;
}

/** 房产筛选：账单概览 / 清单里的一个下拉（默认“全部房产”），代替原来占一行的芯片导航；只有一套房产时不显示 */
export function propertyFilter() {
  if (state.properties.filter((p) => !p.archived).length < 2) return "";
  const cur = state.billsFilter.property;
  // “全部房产”只含在用的房产和与房产无关的账单；已卖出 / 已退租的放在下拉最后一组，选它才看得到它的账单
  return `<select id="billProp" class="prop-filter" aria-label="${t("选择房产")}"><option value="all">${t("全部房产")}</option>${propertyOptionsHtml(cur, { esc })}</select>`;
}

const billRow = (b) => `<li>
    <span class="badge ${b.trialSoon ? "b-out" : BADGE[b.status]}">${b.trialSoon ? t("试用") : t(STATUS_LABEL[b.status])}</span>
    <div class="grow">${propertyTag(b.property_id)}<a class="link-name" href="${href("bill", b.id)}">${billCat(b.category).icon} ${esc(b.name)}</a>
      <small>${esc([acctText(b), alertText(b)].filter(Boolean).join(" · "))}${b.est != null ? ` · ${mny(b.est, b.currency)}` : ""}</small></div>
    ${b.pay_url && !b.autopay ? `<a class="btn btn-sm btn-ghost" href="${esc(b.pay_url)}" target="_blank" rel="noopener noreferrer">${t("去缴费")}</a>` : ""}
    ${b.autopay ? `<button type="button" class="btn btn-sm" data-action="bill-verify" data-id="${b.id}">${t("已核对")}</button>`
      : `<a class="btn btn-sm" href="${href("bill", b.id)}?pay=1">${t("记缴费")}</a>`}
  </li>`;

/** 本月账单：本月到期或已缴过的账单，已缴的显示“已缴”（缴费日和金额），没缴的显示待缴 / 今天到期 / 逾期——缴完状态马上变 */
function monthBillsHtml(list) {
  const now = new Date(), m = monthKey(now), today = now.toISOString().slice(0, 10), cur = Units.region.currency;
  const rows = [];
  for (const b of list) {
    if (!b.active || b.ended || b.escrow || b.direction === "receivable") continue;
    const paid = b.pays.find((p) => p.status !== "skipped" && ((p.paid_on || "").startsWith(m) || (p.due_on || "").startsWith(m)));
    const dueNow = b.next_due_on && (b.next_due_on.startsWith(m) || b.next_due_on < today);
    if (!paid && !dueNow) continue;
    rows.push({ b, paid, due: b.next_due_on });
  }
  if (!rows.length) return "";
  rows.sort((x, y) => (x.paid ? 1 : 0) - (y.paid ? 1 : 0) || (x.paid ? (y.paid.paid_on || "").localeCompare(x.paid.paid_on || "") : (x.due || "").localeCompare(y.due || "")));
  const done = rows.filter((r) => r.paid).length, left = rows.filter((r) => !r.paid && (r.b.currency || cur) === cur).reduce((s, r) => s + num(r.b.est), 0);
  const li = ({ b, paid }) => {
    const late = !paid && b.next_due_on < today, dueToday = !paid && b.next_due_on === today;
    const badge = paid ? `<span class="badge b-ok">✓ ${t("已缴")}</span>` : late ? `<span class="badge b-out">${t("逾期")}</span>` : dueToday ? `<span class="badge b-low">${t("今天到期")}</span>` : `<span class="badge b-soon">${t("待缴")}</span>`;
    const meta = paid ? t("{d} 缴费", { d: fmtDate(paid.paid_on) }) + (paid.status === "verified" ? ` · ${t("已核对")}` : "") : t("到期 {d}", { d: fmtDate(b.next_due_on) });
    return `<li class="${paid ? "is-paid" : ""}">${badge}<div class="grow">${propertyTag(b.property_id)}<a class="link-name" href="${href("bill", b.id)}">${billCat(b.category).icon} ${esc(b.name)}</a><small>${esc(meta)}</small></div><b>${paid && paid.amount != null ? mny(paid.amount, paid.currency) : mny(b.est, b.currency)}</b></li>`;
  };
  return `<section class="section"><div class="section-head"><h2>${t("本月账单")}</h2><p>${t("已缴 {a} / {b} 笔", { a: done, b: rows.length })}${left > 0 ? ` · ${t("还要交 {m}", { m: money(left) })}` : ""}</p></div>
    <div class="panel"><ul class="restock-list">${rows.map(li).join("")}</ul></div></section>`;
}

/* ── 账单总览：周期性 + 一次性 ── */
export function viewBillsHome() {
  const all = state.billsEnriched.filter((b) => b.active), list = filterByProperty(all), alerts = billAlerts(list), cur = Units.region.currency;
  const inCur = list.filter((b) => (b.currency || cur) === cur), monthlyTotal = inCur.reduce((s, b) => s + b.monthly, 0);
  const next30 = upcoming(list, 30), due30 = next30.filter((x) => (x.bill.currency || cur) === cur).reduce((s, x) => s + num(x.bill.est), 0);
  const open = state.medEnriched.filter((b) => b.open), owe = open.reduce((s, b) => s + (b.balance || 0), 0);
  const card = (href_, icon, title, desc, stat, add) => `<div class="kind-card"><a class="kind-main" href="${href_}"><span class="kind-ico" aria-hidden="true">${icon}</span><span class="grow"><b>${title}</b><small>${desc}</small></span><span class="kind-stat">${stat}</span><span class="mch" aria-hidden="true">›</span></a>${add}</div>`;
  return `
    <section class="section">
      <div class="section-head"><h2>${t("账单")}</h2><div class="head-acts">${propertyFilter()}</div></div>
      <div class="kpis">
        <div class="kpi"><span>${t("未来 30 天要交")}</span><b>${money(due30)}</b><small>${t("周期性账单 · {n} 笔", { n: next30.length })}</small></div>
        <div class="kpi"><span>${t("每月固定支出")}</span><b>${money(monthlyTotal)}</b><small>${t("周期性账单")}</small></div>
        <div class="kpi"><span>${t("一次性账单未结")}</span><b>${money(owe)}</b><small>${t("{n} 张待处理", { n: open.length })}</small></div>
      </div>
      <div class="panel kind-cards">
        ${card(RECURRING(), "🔁", t("周期性账单"), t("水电气网、房贷房租、保险、订阅、信用卡：按周期反复出现，算下次到期并提醒"), alerts.length ? t("{n} 条要处理", { n: alerts.length }) : t("{n} 条", { n: list.length }),
          `<a class="btn btn-sm btn-ghost" href="${href("bill", "new")}">${t("添加周期性账单")}</a>`)}
        ${card(ONETIME(), "🏥", t("一次性账单"), t("一次事件产生的账单：医疗、宠物、法律税务、装修工程；有总额、可分次付、有余额"), open.length ? t("{n} 张未结", { n: open.length }) : t("{n} 张", { n: state.medEnriched.length }),
          `<a class="btn btn-sm btn-ghost" href="${ONETIME()}?bill=new">${t("记一张一次性账单")}</a>`)}
      </div>
      <p class="muted kinds-note">${t("区别：周期性账单每隔一段时间自己再来一张，系统帮你算下次到期；一次性账单是一次事件产生的，付清就结束，可以分几次付。")}</p>
    </section>
    ${monthBillsHtml(list)}
    ${alerts.length ? `<section class="section"><div class="section-head"><h2>${t("要处理的周期性账单")}</h2><p>${t("逾期、到期、即将到期和待核对的自动扣款")}</p></div>
      <div class="panel"><ul class="restock-list">${alerts.slice(0, 6).map((b) => billRow(b)).join("")}</ul>${alerts.length > 6 ? `<div class="form-actions" style="justify-content:center"><a class="btn btn-sm btn-ghost" href="${RECURRING()}">${t("看全部 {n} 条", { n: alerts.length })}</a></div>` : ""}</div></section>` : ""}
    ${open.length ? `<section class="section"><div class="section-head"><h2>${t("未结的一次性账单")}</h2><p>${t("按到期日排序")}</p></div>
      <div class="panel"><ul class="restock-list">${[...open].sort((a, b) => (a.due_on || "9999").localeCompare(b.due_on || "9999")).slice(0, 6).map(medRow).join("")}</ul></div></section>` : ""}
    ${!alerts.length && !open.length ? `<section class="section"><div class="panel empty"><strong>${t("最近没有要处理的账单")}</strong></div></section>` : ""}
    ${spendGlance()}`;
}

/* ── 周期性账单：概览 / 清单 / 记录三个标签（窄屏概览下面是入口行） ── */
export function viewRecurring() {
  const tab = activeTab(state.route) || "overview", body = { overview: viewBillsOverview, list: viewBillsList, history: viewBillsHistory }[tab];
  const hrefOf = (id) => `${RECURRING()}${id === "overview" ? "" : `?tab=${id}`}`;
  return `<section class="section"><div class="section-head"><h2>🔁 ${t("周期性账单")}</h2><div class="head-acts"><a class="btn btn-primary btn-sm" href="${href("bill", "new")}">${t("添加账单")}</a></div></div>
    ${kindsNote("recurring")}${tabBar(RECURRING_TABS, tab, hrefOf, t("周期性账单内容"))}${tab === "overview" ? tabHub(RECURRING_TABS, hrefOf, t("更多")) : ""}</section>${body()}`;
}

/* ── 概览 ── */
export function viewBillsOverview() {
  const all = state.billsEnriched.filter((b) => b.active);
  const list = filterByProperty(all);
  const alerts = billAlerts(list);
  const cur = Units.region.currency;
  const inCur = list.filter((b) => (b.currency || cur) === cur);
  const monthlyTotal = inCur.reduce((s, b) => s + b.monthly, 0);
  const essential = inCur.filter((b) => b.essential).reduce((s, b) => s + b.monthly, 0);
  const next30 = upcoming(list, 30);
  const due30 = next30.filter((x) => (x.bill.currency || cur) === cur).reduce((s, x) => s + num(x.bill.est), 0);
  const autopayN = list.filter((b) => b.autopay).length;
  const cards = list.filter((b) => b.active && b.cardExpiring);
  const subs = subscriptionSummary(list);
  if (!state.bills.length) {
    return `<section class="section"><div class="panel empty"><strong>${t("还没有账单")}</strong>${t("先按常用账单模板一次建好水电气、网络、HOA、房产税、房贷、保险，再补金额和到期日。")}
      <p><a class="btn btn-primary" href="${href("bills", "template")}">${t("按模板建账单")}</a> <a class="btn btn-ghost" href="${href("bill", "new")}">${t("手动添加一条")}</a></p></div></section>`;
  }
  return `
    <section class="section">
      <div class="section-head"><h2>${t("账单概览")}</h2><div class="head-acts">${propertyFilter()}
        <button type="button" class="btn btn-sm btn-ghost" data-action="bills-ics">${t("导出到日历")}</button>
        <a class="btn btn-sm btn-ghost" href="${href("bills", "spend")}">${t("看花费")}</a>
        <a class="btn btn-sm btn-ghost" href="${href("bills", "template")}">${t("常用账单")}</a>
        <a class="btn btn-primary btn-sm" href="${href("bill", "new")}">${t("添加账单")}</a></div></div>
      ${hiddenEndedHint(all)}
      <div class="kpis">
        <div class="kpi"><span>${t("未来 30 天要交")}</span><b>${money(due30)}</b><small>${t("{n} 笔", { n: next30.length })}</small></div>
        <div class="kpi"><span>${t("每月固定支出")}</span><b>${money(monthlyTotal)}</b><small>${t("必要 {m}", { m: money(essential) })}</small></div>
        <div class="kpi"><span>${t("自动扣款")}</span><b>${autopayN} / ${list.length}</b><small>${t("{n} 条需手动缴", { n: list.length - autopayN })}</small></div>
        ${subs.count ? `<div class="kpi"><span>${t("订阅与会员")}</span><b>${money(subs.monthly)}<small>/${t("月")}</small></b><small>${t("{n} 项，{a} 项年付", { n: subs.count, a: subs.annualPaid })}</small></div>` : ""}
      </div>
    </section>
    ${monthBillsHtml(list)}
    ${spendGlance()}
    ${escrowPanelHtml()}
    ${alerts.length ? `<section class="section"><div class="section-head"><h2>${t("要处理的账单")}</h2><p>${t("逾期、到期、即将到期和待核对的自动扣款")}</p></div>
      <div class="panel"><ul class="restock-list">${alerts.map((b) => billRow(b)).join("")}</ul></div></section>`
      : `<section class="section"><div class="panel empty"><strong>${t("最近没有要处理的账单")}</strong></div></section>`}
    ${cards.length ? `<section class="section"><div class="panel cta-panel"><div><b>${t("自动扣款的卡快过期了")}</b><p class="muted">${joinList(cards.map((b) => `${esc(b.name)}（${esc(b.autopay_method || "")} ${esc(b.autopay_card_expires)}）`))}</p></div></div></section>` : ""}
    <section class="section">
      <div class="section-head"><h2>${t("未来 30 天")}</h2><p>${t("按到期日排列")}</p></div>
      <div class="panel">${next30.length ? `<ul class="restock-list">${next30.map(({ bill: b, due }) => `<li>
        <span class="badge" style="background:var(--surface-2)">${esc(fmtShort(`${due}T12:00:00`))}</span>
        <div class="grow">${propertyTag(b.property_id)}<a class="link-name" href="${href("bill", b.id)}">${billCat(b.category).icon} ${esc(b.name)}</a><small>${acctText(b) ? `${esc(acctText(b))} · ` : ""}${b.autopay ? t("自动扣款") : t(B().CHANNELS[b.pay_channel] || "")}${billPayLabel(b) ? ` · ${esc(billPayLabel(b))}` : ""}${b.assigned_to ? ` · ${esc(memberName(b.assigned_to) || "")}` : ""}</small></div>
        <b>${mny(b.est, b.currency)}</b></li>`).join("")}</ul>` : `<div class="empty"><strong>${t("30 天内没有到期的账单")}</strong></div>`}</div>
    </section>`;
}

function filterByProperty(list) {
  const f = state.billsFilter.property;
  if (f === "all") return list.filter(billInUse);
  return list.filter((b) => b.property_id === f);
}
/** “全部房产”下被收起的账单数：提示在哪里能找到 */
const hiddenEndedHint = (all) => {
  const n = state.billsFilter.property === "all" ? all.filter((b) => !billInUse(b)).length : 0;
  return n ? `<p class="muted" style="font-size:13px;margin:8px 0 0">${t("另有 {n} 条账单属于已卖出 / 已退租的房产，在上方房产筛选的“已结束”里查看。", { n })}</p>` : "";
};

/** 账单页面包屑：账单 / 房产 / 账单名 / 当前块 —— 有房产的账单带上房产（点它回到这套房产的账单清单），免得多套房产时分不清是哪套的 */
const billRoot = () => ({ href: href("bills", "list"), label: t("账单") });   // 固定的第一级（之前随“从哪个页面进来”变，会变成 今日 / xx房 / 电费）
const billTrail = (b, _root, hubHref) => [billRoot(), ...(b.property_id && propertyName(b.property_id) ? [{ href: `${href("bills", "list")}?prop=${b.property_id}`, label: propertyName(b.property_id), icon: "🏠" }] : []),
  { href: hubHref, label: b.name, icon: billCat(b.category).icon }];
const billCrumb = (b, root, hubHref, cur) => crumbNav([...billTrail(b, root, hubHref), { label: cur }]);

/* ── 清单 ── */
const BILL_SORTS = [["category", "按分类分组"], ["due", "到期日：近 → 远"], ["amount", "金额：高 → 低"], ["name", "名称 A → Z"], ["updated", "最近更新"]];
let billInner = null;   // 当前清单页的“列表本体”渲染函数：搜索 / 筛选只重画它
export function renderBillList() { const h = $("#billList"); if (h && billInner) h.innerHTML = billInner(); }
/** 清单里每条账单的「怎么付」：自动扣款 · 某张卡 / 账户，或手动缴费（可选默认用哪张卡、现金）。值 = auto|manual:卡id|cash|other|空 */
function payModeSelect(b) {
  const cur = `${b.autopay ? "auto" : "manual"}:${payAcctValue(b.pay_card_id, b.autopay_method)}`;
  const accts = state.cards.filter((c) => c.active !== false || c.id === b.pay_card_id);
  const o = (v, l) => `<option value="${v}" ${v === cur ? "selected" : ""}>${esc(l)}</option>`;
  const legacy = b.autopay_method && !b.pay_card_id && payAcctValue(null, b.autopay_method) === "other" ? o(`${b.autopay ? "auto" : "manual"}:other`, `${b.autopay ? t("自动扣款") : t("手动")} · ${b.autopay_method}`) : "";
  return `<select class="bill-pay-sel" data-bill-pay="${b.id}" aria-label="${esc(t("怎么付"))}" title="${esc(t("自动扣款从哪张卡 / 账户扣；手动缴费时记缴费默认用它"))}">
    <optgroup label="${esc(t("手动缴费"))}">${o("manual:", t("手动 · 未指定账户"))}${o("manual:cash", t("手动 · 现金"))}${accts.map((c) => o(`manual:${c.id}`, `${t("手动")} · ${acctLabel(c)}`)).join("")}</optgroup>
    ${accts.length ? `<optgroup label="${esc(t("自动扣款"))}">${accts.map((c) => o(`auto:${c.id}`, `${t("自动")} · ${acctLabel(c)}`)).join("")}</optgroup>` : `<optgroup label="${esc(t("自动扣款"))}">${o("auto:", t("自动 · 未指定账户"))}</optgroup>`}${legacy}${b.autopay && !b.pay_card_id && !legacy && !b.autopay_method ? o("auto:", t("自动 · 未指定账户")) : ""}</select>`;
}
export function viewBillsList() {
  const f = state.billsFilter;   // ?prop= 只在进入页面时套用一次（main.js onRoute），之后点房产芯片可以随意切换
  const chip = (k, v, label) => `<button type="button" class="chip" data-action="bills-filter" data-key="${k}" data-val="${v}" aria-pressed="${f[k] === v}">${label}</button>`;
  // 订阅 / 会员按种类排在一起，其余按状态
  const kindOrder = Object.keys(B().SUB_KINDS);
  const kindTag = (b) => (B().isSubCat(b.category) && b.sub_kind ? `<span class="badge sub-kind">${t(B().SUB_KINDS[b.sub_kind] || b.sub_kind)}</span>` : "");
  const row = (b, flat = false) => `<li class="bill-row ${b.active && !b.ended ? "" : "inactive"}">
      <div class="grow">${propertyTag(b.property_id)}${kindTag(b)}${flat ? `<span class="badge" style="background:var(--surface-2)">${billCat(b.category).icon}</span> ` : ""}<a class="link-name" href="${href("bill", b.id)}">${esc(b.name)}</a>${b.ended ? ` <span class="badge" style="background:var(--surface-2)">${t("已结束")}</span>` : ""}${b.priceUp ? ` <span class="badge b-low">${t("涨价了")}</span>` : ""}${b.cardExpiring ? ` <span class="badge b-soon">${t("卡快过期")}</span>` : ""}${b.trialSoon ? ` <span class="badge b-out">${t("试用快到期")}</span>` : ""}
        <small>${[acctText(b), b.escrow ? t("Escrow 代缴，含在房贷月供里") : null, b.category === "mortgage" && escrowMonthlyFor(b.property_id) > 0 ? t("含 Escrow 约 {a}/月", { a: mny(escrowMonthlyFor(b.property_id)) }) : null, b.payee, freqText(b), b.ended && b.ends_on ? t("结束于 {d}", { d: fmtDate(b.ends_on) }) : b.next_due_on ? t("下次 {d}", { d: fmtDate(b.next_due_on) }) : t("未填到期日"), b.assigned_to ? memberName(b.assigned_to) : null].filter(Boolean).map(esc).join(" · ")}</small></div>
      <b class="bill-amt">${mny(b.est, b.currency)}</b>
      ${payModeSelect(b)}
    </li>`;
  billInner = () => {
    let list = filterByProperty(state.billsEnriched);
    if (f.channel && f.channel !== "all") list = list.filter((b) => b.pay_channel === f.channel);
    if (f.cat && f.cat !== "all") list = list.filter((b) => b.category === f.cat);
    const q = (f.q || "").trim().toLowerCase();
    if (q) list = list.filter((b) => `${b.name}${b.payee || ""}${b.account_last4 || ""}`.toLowerCase().includes(q));
    const mode = f.sort || "category";
    if (mode !== "category") {   // 换了排序就不分组，跨分类按一条线排
      const sorter = { due: (x, y) => (x.next_due_on || "9999").localeCompare(y.next_due_on || "9999") || compare(x.name, y.name), amount: (x, y) => num(y.est) - num(x.est), name: (x, y) => compare(x.name, y.name),
        updated: (x, y) => String(y.updated_at || "").localeCompare(String(x.updated_at || "")) }[mode];
      return list.length ? `<div class="panel"><ul class="bill-list">${[...list].sort(sorter).map((b) => row(b, true)).join("")}</ul></div>` : `<div class="panel empty"><strong>${t("没有符合条件的账单")}</strong></div>`;
    }
    const groups = B().CATEGORIES.map((c) => ({ c, rows: list.filter((b) => b.category === c.id).sort((x, y) => (B().isSubCat(c.id) ? kindOrder.indexOf(x.sub_kind || "other") - kindOrder.indexOf(y.sub_kind || "other") : 0) || STATUS_RANK[x.status] - STATUS_RANK[y.status] || compare(x.name, y.name)) })).filter((g) => g.rows.length);
    return groups.length ? groups.map(({ c, rows }) => `<div class="cat-group" style="--cat:var(--pine)"><h3>${c.icon} ${t(c.name)}<span class="muted">（${rows.length}）</span></h3>
        <div class="panel"><ul class="bill-list">${rows.map((b) => row(b)).join("")}</ul></div></div>`).join("")
      : `<div class="panel empty"><strong>${t("没有符合条件的账单")}</strong></div>`;
  };
  const used = new Set(state.billsEnriched.map((b) => b.category));
  return `
    <section class="section">
      <div class="section-head"><h2>${t("账单清单")}</h2><div class="head-acts"><a class="btn btn-sm btn-ghost" href="${href("bills", "template")}">${t("常用账单")}</a><a class="btn btn-primary btn-sm" href="${href("bill", "new")}">${t("添加账单")}</a></div></div>
      <div class="toolbar">
        <input type="search" id="billSearch" placeholder="${t("搜索名称、收款方、账号")}" value="${esc(f.q || "")}" aria-label="${t("搜索账单")}">
        ${propertyFilter()}
        <select id="billCat" aria-label="${t("按分类筛选")}"><option value="all">${t("全部分类")}</option>${B().CATEGORIES.filter((c) => used.has(c.id)).map((c) => `<option value="${c.id}" ${f.cat === c.id ? "selected" : ""}>${c.icon} ${t(c.name)}</option>`).join("")}</select>
        <select id="billChannel" aria-label="${t("按缴费方式筛选")}"><option value="all">${t("全部缴费方式")}</option>${Object.entries(B().CHANNELS).map(([k, n]) => `<option value="${k}" ${f.channel === k ? "selected" : ""}>${t(n)}</option>`).join("")}</select>
        <select id="billSort" aria-label="${t("排序")}">${BILL_SORTS.map(([v, l]) => `<option value="${v}" ${(f.sort || "category") === v ? "selected" : ""}>${t(l)}</option>`).join("")}</select>
      </div>
      ${hiddenEndedHint(state.billsEnriched)}
      <div id="billList">${billInner()}</div>
    </section>`;
}

/* ── 记录：筛选（账单 / 年份 / 状态）+ 排序，分批显示 ── */
const PAY_SORTS = [["new", "日期：新 → 旧"], ["old", "日期：旧 → 新"], ["high", "金额：高 → 低"], ["low", "金额：低 → 高"], ["bill", "账单名 A → Z"]];
function filteredPays() {
  const f = state.payFilter, byBill = Object.fromEntries(state.billsEnriched.map((b) => [b.id, b]));
  const list = state.billPayments.filter((p) => (f.bill === "all" || p.bill_id === f.bill) && (f.year === "all" || (p.paid_on || "").startsWith(f.year)) && (f.status === "all" || p.status === f.status));
  const sorter = { new: (x, y) => (y.paid_on || "").localeCompare(x.paid_on || ""), old: (x, y) => (x.paid_on || "").localeCompare(y.paid_on || ""), high: (x, y) => num(y.amount) - num(x.amount), low: (x, y) => num(x.amount) - num(y.amount),
    bill: (x, y) => compare(byBill[x.bill_id]?.name || "", byBill[y.bill_id]?.name || "") || (y.paid_on || "").localeCompare(x.paid_on || "") }[f.sort] || (() => 0);
  return list.sort(sorter);
}
/** 多套房产时账单名带房产前缀（“房 1 · 电费”），单套房产不变 */
const billLabel = (b) => (b ? withProperty(b.property_id, b.name) : "");
/** 下拉里用：已卖出 / 已退租房产的账单带上状态，在用的排前面 */
const billOption = (b) => `${billLabel(b)}${endedSuffix(propertyById(b.property_id))}`;
const byInUse = (x, y) => (billInUse(y) ? 1 : 0) - (billInUse(x) ? 1 : 0);
/** 这笔缴费的收款方：缴费当时记在花费上的，没有就用账单的收款方 */
const payeeOf = (p, b) => (p.purchase_id ? state.purchases.find((x) => x.id === p.purchase_id)?.store : "") || b?.payee || "";
function payListInner() {
  const f = state.payFilter, byBill = Object.fromEntries(state.billsEnriched.map((b) => [b.id, b])), all = filteredPays(), shown = all.slice(0, f.limit);
  if (!state.billPayments.length) return `<div class="empty"><strong>${t("还没有缴费记录")}</strong>${t("在账单页记一笔，或在概览里点“已核对”。")}</div>`;
  if (!all.length) return `<div class="empty"><strong>${t("没有符合条件的记录")}</strong>${t("换个筛选试试。")}</div>`;
  const cur = Units.region.currency, sum = all.filter((p) => p.status !== "skipped" && (p.currency || cur) === cur).reduce((s, p) => s + num(p.amount), 0);
  return `<p class="muted" style="margin:0 0 6px;font-size:13px">${t("{n} 笔", { n: all.length })} · ${money(sum)}</p><ul class="restock-list">${shown.map((p) => {
    const b = byBill[p.bill_id];
    return `<li data-swipe-del="bill-pay"><${b ? `a href="${href("bill", b.id)}?sec=pay&edit=${p.id}" title="${t("点一下编辑")}"` : "span"} class="badge pay-date" style="background:var(--surface-2)">${esc(fmtShort(`${p.paid_on}T12:00:00`))}</${b ? "a" : "span"}>
      <div class="grow"><span class="name">${b ? `<a class="link-name" href="${href("bill", b.id)}">${esc(billLabel(b))}</a>` : t("（已删除的账单）")}</span>
        <small>${[b ? acctText(b) : null, payeeOf(p, b) ? t("收款方：{who}", { who: payeeOf(p, b) }) : null, t(B().PAYMENT_STATUS[p.status] || p.status), paymentPayLabel(p), p.confirmation_ref ? t("确认号 {ref}", { ref: p.confirmation_ref }) : null, num(p.late_fee) ? t("滞纳金 {m}", { m: mny(p.late_fee, p.currency) }) : null, p.notes].filter(Boolean).map(esc).join(" · ")}</small></div>
      <b>${p.amount != null ? mny(p.amount, p.currency) : `<span class="muted">${t("未填金额")}</span>`}</b>
      <button type="button" class="btn btn-sm btn-ghost swipe-src" data-action="billpay-del" data-id="${p.id}">${t("删除")}</button></li>`;
  }).join("")}</ul>${all.length > shown.length ? `<div class="form-actions" style="justify-content:center"><button type="button" class="btn btn-ghost" data-action="pay-more">${t("再显示 {n} 笔（还有 {m} 笔）", { n: Math.min(50, all.length - shown.length), m: all.length - shown.length })}</button></div>` : ""}`;
}
export function renderPayList() { const h = $("#payList"); if (h) h.innerHTML = payListInner(); }
function payToolbar(byBill) {
  const f = state.payFilter, opt = (v, l, c) => `<option value="${esc(v)}" ${c === v ? "selected" : ""}>${esc(l)}</option>`;
  const ids = [...new Set(state.billPayments.map((p) => p.bill_id))], years = [...new Set(state.billPayments.map((p) => (p.paid_on || "").slice(0, 4)).filter(Boolean))].sort().reverse();
  if (!state.billPayments.length) return "";
  return `<div class="toolbar" style="margin-top:10px">
    <select id="payBill" aria-label="${t("按账单筛选")}">${opt("all", t("全部账单"), f.bill)}${ids.map((id) => opt(id, billOption(byBill[id]) || t("（已删除的账单）"), f.bill)).sort().join("")}</select>
    <select id="payYear" aria-label="${t("按年份筛选")}">${opt("all", t("全部年份"), f.year)}${years.map((y) => opt(y, y, f.year)).join("")}</select>
    <select id="payStatus" aria-label="${t("按状态筛选")}">${opt("all", t("全部状态"), f.status)}${Object.entries(B().PAYMENT_STATUS).map(([k, n]) => opt(k, t(n), f.status)).join("")}</select>
    <select id="paySort" aria-label="${t("排序")}">${PAY_SORTS.map(([v, l]) => opt(v, t(l), f.sort)).join("")}</select></div>`;
}

/* ── 记录 ── */
export function viewBillsHistory() {
  const byBill = Object.fromEntries(state.billsEnriched.map((b) => [b.id, b]));
  const pays = [...state.billPayments].sort((x, y) => (y.paid_on || "").localeCompare(x.paid_on || ""));
  const cur = Units.region.currency;
  const year = new Date().getFullYear();
  const thisYear = pays.filter((p) => (p.paid_on || "").startsWith(String(year)) && p.status !== "skipped" && (p.currency || cur) === cur);
  const total = thisYear.reduce((s, p) => s + num(p.amount), 0), late = thisYear.reduce((s, p) => s + num(p.late_fee), 0);
  // 单账单趋势：选一条有 ≥ 2 笔记录的账单
  const candidates = state.billsEnriched.filter((b) => b.pays.filter((p) => p.amount != null).length >= 2).sort(byInUse);   // 在用的排前面，已卖出房产的账单在后面但仍能选
  const sel = candidates.find((b) => b.id === state.billsFilter.trend) || candidates[0];
  let chart = "";
  if (sel) {
    const series = [...sel.pays].filter((p) => p.amount != null).reverse().slice(-12);
    chart = Charts.line({ title: t("{name}缴费金额", { name: billLabel(sel) }), labels: series.map((p) => fmtShort(`${p.paid_on}T12:00:00`)), fmt: (v) => money(v),
      series: [{ name: billLabel(sel), color: "var(--pine)", values: series.map((p) => num(p.amount)) }] });
  }
  return `
    <section class="section">
      <div class="section-head"><h2>${t("缴费记录")}</h2><div class="head-acts"><button type="button" class="btn btn-sm" data-action="bills-csv">${t("导出今年 CSV")}</button></div></div>
      <div class="kpis">
        <div class="kpi"><span>${t("{y} 年已缴", { y: year })}</span><b>${money(total)}</b><small>${t("{n} 笔", { n: thisYear.length })}</small></div>
        <div class="kpi"><span>${t("滞纳金")}</span><b>${money(late)}</b><small>${late ? t("按时缴费就能省下") : t("没有滞纳金")}</small></div>
      </div>
      ${sel ? `<div class="panel chart-panel"><div class="chart-head"><h3>${t("单账单金额趋势")}</h3>
        <select id="billTrend" aria-label="${t("选择账单")}">${candidates.map((b) => `<option value="${b.id}" ${b.id === sel.id ? "selected" : ""}>${esc(billOption(b))}</option>`).join("")}</select></div>${chart}</div>` : ""}
      ${payToolbar(byBill)}
      <div class="panel" id="payList" style="margin-top:10px">${payListInner()}</div>
    </section>`;
}

export function exportBillsCsv() {
  const year = new Date().getFullYear();
  const byBill = Object.fromEntries(state.bills.map((b) => [b.id, b]));
  const rows = [[t("日期"), t("账单"), t("分类"), t("房产"), t("金额"), t("货币"), t("状态"), t("方式"), t("确认号"), t("滞纳金"), t("备注")]];
  for (const p of [...state.billPayments].sort((x, y) => (x.paid_on || "").localeCompare(y.paid_on || ""))) {
    if (!(p.paid_on || "").startsWith(String(year))) continue;
    const b = byBill[p.bill_id];
    rows.push([p.paid_on, b?.name || "", b ? t(billCat(b.category).name) : "", b?.property_id ? propertyName(b.property_id) : "", p.amount ?? "", p.currency || "", t(B().PAYMENT_STATUS[p.status] || p.status), paymentPayLabel(p) || "", p.confirmation_ref || "", num(p.late_fee) || "", p.notes || ""]);
  }
  const csv = "﻿" + rows.map((r) => r.map((v) => { const s = String(v ?? ""); const x = /^[=+\-@]/.test(s) ? `'${s}` : s; return /[",\r\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x; }).join(",")).join("\r\n");
  download(`${t("账单")}-${year}.csv`, csv);
  toast(t("已导出 {n} 笔缴费记录", { n: rows.length - 1 }));
}

export function exportIcs() {
  const list = filterByProperty(state.billsEnriched.filter((b) => b.active));
  if (!list.length) return toast(t("没有可导出的账单"));
  download(`${t("家庭账单")}.ics`, icsFor(list), "text/calendar;charset=utf-8");
  toast(t("已导出日历文件，在手机上打开即可加入日历"));
}

/* ── 常用账单模板 ── */
function templateRegion() {
  return state.houseProfile?.region || (Units.region.system === "us" ? "na" : "cn");
}
export function viewBillTemplate() {
  const region = templateRegion();
  const tpl = B().TEMPLATES[region] || [];
  const prop = currentProperty();
  // “已有”按房产判断：挂房产的模板只看当前房产下有没有同类同名账单（各房产的电费到期日可能不同，要能各建一条）；
  // 与房产无关的模板（手机、车险等）才看整个家庭
  const have = new Set(state.bills.filter((b) => !b.ended).map((b) => `${b.property_id || ""}|${b.category}|${b.name}`));
  const hasBill = (r) => { const pid = r.property === false ? "" : (prop?.id || ""); return have.has(`${pid}|${r.category}|${r.name}`) || have.has(`${pid}|${r.category}|${t(r.name)}`); };
  return `
    <section class="section">
      <div class="section-head"><p>${t("{region}模板，共 {n} 条；金额和到期日建好后再补", { region: t(region === "na" ? "北美" : "中国"), n: tpl.length })}</p></div>
      ${propertyBar()}
      <form id="billTemplateForm" class="panel">
        <div class="tpl-bar">
          <button type="button" class="btn btn-sm btn-ghost" data-action="tpl-all" data-on="1">${t("全选")}</button>
          <button type="button" class="btn btn-sm btn-ghost" data-action="tpl-all" data-on="0">${t("全不选")}</button>
          <span class="muted">${prop ? t("与房产相关的账单会挂在“{p}”下；每套房产可以各建一条（到期日可能不同），切换上面的房产再建", { p: esc(prop.name) }) : ""}</span>
        </div>
        ${(() => {
          // 按 group 分组显示（默认“常用账单”）；订阅与会员一组，带种类小标签
          const groupNames = [...new Set(tpl.map((r) => r.group || "常用账单"))];
          const rowHtml = (r, i) => {
            const exists = hasBill(r), c = billCat(r.category);
            const when = r.due_dates ? joinList(r.due_dates.map((d) => d.replace("-", "/"))) : r.due_day ? t("每月 {d} 号", { d: r.due_day }) : t("到期日建后补填");
            return `<label class="tpl-row ${exists ? "is-have" : ""}" style="--cat:var(--pine)">
            <input type="checkbox" name="tpl" value="${i}" ${exists ? "disabled" : r.optional ? "" : "checked"}>
            <span class="grow"><b>${c.icon} ${esc(t(r.name))}</b>${r.sub_kind ? ` <span class="badge sub-kind">${t(B().SUB_KINDS[r.sub_kind] || r.sub_kind)}</span>` : ""}<small>${[r.payee ? esc(r.payee) : null, t(B().FREQUENCIES[r.frequency]) + (r.frequency === "custom" ? ` (${r.interval_months})` : ""), when, r.autopay ? t("通常自动扣款") : t("手动缴费"), r.property === false ? t("与房产无关") : null].filter(Boolean).join(" · ")}</small>
              ${r.note ? `<small class="note">${esc(t(r.note))}</small>` : ""}</span>
            ${exists ? `<span class="badge b-ok">${r.property === false ? t("已有") : t("此房产已有")}</span>` : ""}
          </label>`;
          };
          return groupNames.map((g) => `<fieldset class="tpl-group"><legend>${t(g)}${g === "订阅与会员" ? `<span class="muted" style="font-weight:400;font-size:13px"> · ${t("默认不勾，勾了再补金额和到期日；年付到期前 30 天提醒")}</span>` : ""}</legend>
            ${tpl.map((r, i) => ((r.group || "常用账单") === g ? rowHtml(r, i) : "")).join("")}</fieldset>`).join("");
        })()}
        <div class="form-actions" style="margin-top:12px">
          <button type="submit" class="btn btn-primary">${t("建立选中的账单")}</button>
          <a class="btn btn-ghost" href="${href("bills", "list")}">${t("稍后再说")}</a>
        </div>
      </form>
    </section>`;
}

/** 勾选的模板 → 账单行（名称、备注按当前语言写入） */
export function billTemplateItems(indexes) {
  const region = templateRegion(), tpl = B().TEMPLATES[region] || [];
  const cur = Units.region.currency, pid = state.propertyId;
  return indexes.map((i) => tpl[i]).filter(Boolean).map((r) => {
    const b = {
      property_id: r.property === false ? null : pid, name: t(r.name), category: r.category, direction: "payable", sub_kind: r.sub_kind || null, trial_ends_on: null,
      payee: r.payee || null, account_last4: null, login_hint: null, pay_url: null,
      pay_channel: r.autopay ? "autopay" : (r.channel || "online"), amount_type: r.amount_type || "variable", typical_amount: null, currency: cur,
      frequency: r.frequency, interval_months: r.interval_months || null, due_day: r.due_day || null, due_dates: r.due_dates || [],
      next_due_on: null, grace_days: r.grace_days || 0, late_fee_note: null,
      autopay: !!r.autopay, autopay_method: null, autopay_card_expires: null, statement_channel: r.statement || "email",
      reminder_days: r.reminder_days || [7, 1], assigned_to: null, essential: r.essential !== false && billCat(r.category).essential, active: true,
      notes: r.note ? t(r.note) : null,
    };
    b.next_due_on = initialDue(b);
    return b;
  });
}

/* ── 账单表单（整页；编辑时下方带缴费记录） ── */
/** 分区页（?sec= / ?pay=1）：后退一步回枢纽；枢纽页：直接跳回进来之前的页面（不能 history.back，会掉回刚看过的分区） */
export function leaveBill(changed) {
  if (changed) state.needsRefresh = true;
  state.skipAutosave = true;
  const q = state.route?.q, inSection = !!(q && (q.get("sec") || q.get("pay") === "1"));
  if (inSection && state.prevRoute) history.back();
  else if (state.prevHash && state.prevRoute) go(state.prevHash);
  else go(href("bills", "list"), { replace: true });
}

export function viewBillForm() {
  const r = state.route;
  const b = r.id && r.id !== "new" ? state.billsEnriched.find((x) => x.id === r.id) : null;
  if (r.id !== "new" && !b) return `<div class="panel empty"><strong>${t("找不到这条账单")}</strong>${t("可能已被家人删除。")}<p><a class="btn btn-primary" href="${href("bills", "list")}">${t("回到账单")}</a></p></div>`;
  const qCat = r.q.get("category");
  const v = b || { category: qCat && B().CATEGORIES.some((c) => c.id === qCat) ? qCat : "electric", direction: "payable", pay_channel: "online", amount_type: "variable",
    currency: Units.region.currency, frequency: "monthly", due_day: null, due_dates: [], grace_days: 0, autopay: false, statement_channel: "email", reminder_days: [7, 1],
    essential: true, active: true, property_id: state.propertyId };
  const d = (x) => esc(x ?? "");
  const cloud = Store.mode === "cloud";
  const opts = (map, sel) => Object.entries(map).map(([k, n]) => `<option value="${k}" ${k === sel ? "selected" : ""}>${t(n)}</option>`).join("");
  // 面包屑根：进来之前的页面（注意事项 / 账单 / 房屋…），没有就回账单清单
  const root = { href: state.prevRoute && state.prevHash ? state.prevHash : href("bills", "list"), label: state.prevRoute ? t(SECTIONS[state.prevRoute.section]?.name || "上一页") : t("账单") };
  const landlord = state.properties.some((p) => p.role === "landlord");
  // 已有账单：先看枢纽（各块完成度），点进去只改一块；新建仍是整页
  const sec = r.q.get("pay") === "1" ? "pay" : r.q.get("sec") || "";
  const hubHref = href("bill", b?.id || "new");
  if (b && !sec) return billHub(b, root);
  if (b && sec === "pay") return `<section class="section form-page">${billCrumb(b, root, hubHref, t("缴费记录"))}${paySection(b, r.q.get("pay") === "1", b.pays.find((x) => x.id === r.q.get("edit")) || null)}</section>`;
  const hide = (k) => (b && sec && sec !== k ? "hidden" : "");
  return `
    <section class="section form-page">
      ${b ? billCrumb(b, root, hubHref, t(BILL_SECTIONS.find((s) => s.id === sec)?.name || "")) : crumbNav([billRoot(), { label: t("添加账单") }])}
      ${autofillBar("bill", "#billForm")}
      <form id="billForm" class="panel ${B().isSubCat(v.category) ? "is-sub" : ""} ${b && sec ? "one-sec" : ""}" novalidate data-autosave>
        <input type="hidden" name="bill_id" value="${d(b?.id)}">
        <fieldset data-sec="basic" ${hide("basic")}>
          <legend>${t("基本信息")}</legend>
          <div class="form-grid">
            <label>${t("名称")}<input name="name" required maxlength="60" placeholder="${t("例如：ComEd 电费")}" value="${d(v.name)}"></label>
            <label>${t("分类")}<select name="category">${B().CATEGORIES.map((c) => `<option value="${c.id}" ${c.id === v.category ? "selected" : ""}>${c.icon} ${t(c.name)}</option>`).join("")}</select></label>
            <label class="sub-only">${t("订阅种类")}<select name="sub_kind"><option value="">${t("未指定")}</option>${opts(B().SUB_KINDS, v.sub_kind)}</select><small>${t("只用于分组和汇总；流媒体、云存储、AI 工具、软件等")}</small></label>
            <label class="sub-only">${t("免费试用到期日")}<input name="trial_ends_on" type="date" value="${d(v.trial_ends_on)}"><small>${t("到期前 3 天提醒“不续就取消”")}</small></label>
            <label>${t("房产")}<select name="property_id"><option value="">${t("与房产无关")}</option>${state.properties.filter((p) => propertyActive(p) || p.id === v.property_id).map((p) => `<option value="${p.id}" ${p.id === v.property_id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>
            ${landlord || v.direction === "receivable" ? `<label>${t("方向")}<select name="direction"><option value="payable" ${v.direction !== "receivable" ? "selected" : ""}>${t("我付出去（应付）")}</option><option value="receivable" ${v.direction === "receivable" ? "selected" : ""}>${t("别人付给我（应收，如租金）")}</option></select></label>` : `<input type="hidden" name="direction" value="payable">`}
            <label>${t("付款方 / 收款方")}<input name="payee" maxlength="60" placeholder="${t("例如：ComEd")}" value="${d(v.payee)}"></label>
            <label>${t("账号尾号")}<input name="account_last4" maxlength="8" placeholder="${t("只记后 4 位")}" value="${d(v.account_last4)}"></label>
            <label>${t("登录提示")}<input name="login_hint" maxlength="80" placeholder="${t("例如：用 Gmail 登录，密码在密码管理器")}" value="${d(v.login_hint)}"></label>
            <label>${t("缴费链接")}<input name="pay_url" type="url" maxlength="300" placeholder="https://" value="${d(v.pay_url)}"></label>
            <label>${t("缴费方式")}<select name="pay_channel">${opts(B().CHANNELS, v.pay_channel)}</select><small>${t("房产税 / 保险由贷款方从月供里代缴时选“Escrow 代缴”：不提醒到期、不重复算进每月预算；金额填税单或保单上的年额，房贷填含 Escrow 的总月供。")}</small></label>
            <label>${t("账单怎么来")}<select name="statement_channel">${opts(B().STATEMENTS, v.statement_channel)}</select></label>
          </div>
        </fieldset>
        <fieldset data-sec="amount" ${hide("amount")}>
          <legend>${t("金额与周期")}</legend>
          <div class="form-grid">
            <label>${t("金额类型")}<select name="amount_type"><option value="fixed" ${v.amount_type === "fixed" ? "selected" : ""}>${t("固定")}</option><option value="variable" ${v.amount_type !== "fixed" ? "selected" : ""}>${t("每次不同")}</option></select></label>
            <label>${t("通常金额")}<input name="typical_amount" type="number" inputmode="decimal" min="0" step="0.01" placeholder="${t("每次不同的可留空，按记录平均")}" value="${d(v.typical_amount)}"></label>
            <label>${t("货币")}<input name="currency" maxlength="3" pattern="[A-Z]{3}" value="${d(v.currency || Units.region.currency)}"></label>
            <label>${t("频率")}<select name="frequency">${opts(B().FREQUENCIES, v.frequency)}</select></label>
            <label>${t("每 N 个月（自定义时）")}<input name="interval_months" type="number" inputmode="numeric" min="1" max="60" value="${d(v.interval_months)}"></label>
            <label>${t("每月几号到期")}<input name="due_day" type="number" inputmode="numeric" min="1" max="31" placeholder="${t("月付类填")}" value="${d(v.due_day)}"></label>
            <label>${t("固定日期（半年 / 年付）")}<input name="due_dates" placeholder="${t("例如 03-01, 08-01")}" value="${d((v.due_dates || []).join(", "))}"><small>${t("填了固定日期就按它循环，忽略“每月几号”")}</small></label>
            <label>${t("下次到期日")}<input name="next_due_on" type="date" value="${d(v.next_due_on)}"><small>${t("留空会按规则自动算；每周 / 年付没填日期的请手动填")}</small></label>
            <label>${t("宽限天数")}<input name="grace_days" type="number" inputmode="numeric" min="0" max="60" value="${d(v.grace_days ?? 0)}"></label>
            <label>${t("结束日期（可选）")}<input name="ends_on" type="date" value="${d(v.ends_on)}"><small>${t("晚于它的到期不再提醒，例如卖房后的最后一期")}</small></label>
            <label>${t("提前提醒（天，逗号分隔）")}<input name="reminder_days" placeholder="7, 1" value="${d((v.reminder_days || [7, 1]).join(", "))}"></label>
            <label class="span-2">${t("滞纳金说明")}<input name="late_fee_note" maxlength="120" placeholder="${t("例如：逾期 1.5% 或 $25")}" value="${d(v.late_fee_note)}"></label>
          </div>
        </fieldset>
        <fieldset data-sec="autopay" ${hide("autopay")}>
          <legend>${t("付款账户与自动扣款")}</legend>
          <div class="form-grid">
            <label>${t("付款账户 / 卡")}<select name="pay_account" data-pay-acct>${accountOptions(payAcctValue(v.pay_card_id, v.autopay_method), { none: "（未指定）", extra: [["cash", "现金"], ["other", "其他（手填）"]] })}</select><small>${t("自动扣款从它扣；手动缴费时记缴费也默认用它。卡和银行账户在 账单 → 用卡 里添加。")}</small></label>
            <label data-pay-other ${payAcctValue(v.pay_card_id, v.autopay_method) === "other" ? "" : "hidden"}>${t("账户说明")}<input name="autopay_method" maxlength="40" placeholder="${t("例如：公司代扣 / 支票")}" value="${d(v.autopay_method)}"></label>
            <label class="check-inline span-2"><input type="checkbox" name="autopay" ${v.autopay ? "checked" : ""}><span>${t("已设置自动扣款（到期前后提醒核对，而不是提醒缴费）")}</span></label>
            <label>${t("扣款卡有效期")}<input name="autopay_card_expires" type="month" value="${d(v.autopay_card_expires)}"><small>${t("选了卡就按卡的到期年月提醒换卡，这里可留空；到期前 45 天提醒")}</small></label>
          </div>
        </fieldset>
        <fieldset data-sec="other" ${hide("other")}>
          <legend>${t("其他")}</legend>
          <div class="form-grid">
            ${cloud ? `<label>${t("谁负责")}<select name="assigned_to"><option value="">${t("不指定")}</option>${state.members.map((m) => `<option value="${m.user_id}" ${m.user_id === v.assigned_to ? "selected" : ""}>${esc(m.display_name)}</option>`).join("")}</select></label>` : `<input type="hidden" name="assigned_to" value="">`}
            <label class="check-inline"><input type="checkbox" name="essential" ${v.essential !== false ? "checked" : ""}><span>${t("必要支出（预算里单独统计）")}</span></label>
            <label class="check-inline"><input type="checkbox" name="active" ${v.active !== false ? "checked" : ""}><span>${t("启用（停用后不再提醒，记录保留）")}</span></label>
            <label class="span-2">${t("备注")}<textarea name="notes" rows="2" maxlength="500" placeholder="${t("合同到期、促销价截止、客服电话…")}">${d(v.notes)}</textarea></label>
          </div>
        </fieldset>
        <p id="billFormError" class="form-error" role="alert"></p>
        <div class="form-actions sticky-actions">
          <button type="submit" class="btn btn-primary">${b ? t("保存修改") : t("添加账单")}</button>
          <button type="button" class="btn btn-ghost" data-action="bill-cancel">${t("取消")}</button>
        </div>
      </form>
      ${b ? "" : `<p class="muted" style="margin-top:12px;font-size:13px">${t("保存后可以在这条账单下记每次缴费或核对。")}</p>`}
    </section>`;
}

const BILL_SECTIONS = [
  { id: "basic", icon: "🧾", name: "基本信息" },
  { id: "amount", icon: "📅", name: "金额与周期" },
  { id: "autopay", icon: "🔁", name: "付款账户与自动扣款" },
  { id: "other", icon: "⋯", name: "其他" },
  { id: "pay", icon: "✅", name: "缴费记录" },
];
/** 账单枢纽页：摘要 + 各块完成度 + 缴费记录入口 + 删除 */
function billHub(b, root) {
  const base = href("bill", b.id);
  const st = {
    basic: () => { const n = 2 + filledCount([b.payee, b.account_last4, b.login_hint, b.pay_url]); return { text: [t(billCat(b.category).name), b.payee].filter(Boolean).join(" · "), pct: Math.round((n / 6) * 100), badge: countBadge(n, 6) }; },
    amount: () => { const n = filledCount([b.est, b.next_due_on, b.due_day || b.due_dates?.length]); return { text: [freqText(b), b.next_due_on ? t("下次 {d}", { d: fmtDate(b.next_due_on) }) : t("未填到期日"), b.est != null ? mny(b.est, b.currency) : null].filter(Boolean).join(" · "), pct: Math.round((n / 3) * 100), badge: countBadge(n, 3) }; },
    autopay: () => ({ text: b.autopay ? [t("自动扣款"), billPayLabel(b) || t("未指定账户"), b.cardDays != null ? t("卡 {d} 天后到期", { d: b.cardDays }) : null].filter(Boolean).join(" · ") : [t("手动缴费"), billPayLabel(b) ? t("默认用 {a}", { a: billPayLabel(b) }) : t("未指定账户")].join(" · "), pct: null, badge: b.autopay ? `<span class="badge b-ok mcount">✓</span>` : "" }),
    other: () => ({ text: [b.assigned_to ? memberName(b.assigned_to) : null, b.essential ? t("必要支出") : t("非必要"), b.active ? null : t("已停用"), b.notes ? t("有备注") : null].filter(Boolean).join(" · "), pct: null, badge: "" }),
    pay: () => ({ text: b.pays.length ? t("{n} 条，最近 {d}", { n: b.pays.length, d: fmtDate(b.pays[0].paid_on) }) : t("还没有记录"), pct: null, badge: b.pays.length ? countBadge(b.pays.length, "", "") .replace("/", "") : "" }),
  };
  const rows = BILL_SECTIONS.map((s) => { const x = st[s.id](); return hubRow({ href: `${base}?sec=${s.id}`, icon: s.icon, title: t(s.name), desc: esc(x.text), pct: x.pct, badge: x.badge }); });
  return `<section class="section">
    ${crumbNav([...billTrail(b, root, href("bill", b.id)).slice(0, -1), { label: b.name, icon: billCat(b.category).icon }])}
    ${billSummary(b)}
    ${hubList(rows)}
    <div class="form-actions" style="margin-top:14px">
      ${b.pay_url && !b.autopay ? `<a class="btn btn-ghost" href="${esc(b.pay_url)}" target="_blank" rel="noopener noreferrer">${t("去缴费")}</a>` : ""}
      <a class="btn btn-primary" href="${base}?pay=1">${b.autopay ? t("记核对") : t("记缴费")}</a>
      <span class="spacer"></span><button type="button" class="btn btn-danger-ghost" data-action="bill-delete">${t("删除账单")}</button>
    </div>
  </section>`;
}

function billSummary(b) {
  const bits = [
    acctText(b) ? `<span class="badge" style="background:var(--surface-2)">${esc(acctText(b))}</span>` : "",
    b.status !== "ok" && b.status !== "none" ? `<span class="badge ${BADGE[b.status]}">${t(STATUS_LABEL[b.status])}${b.next_due_on ? ` · ${fmtDate(b.next_due_on)}` : ""}</span>` : b.next_due_on ? `<span class="badge b-ok">${t("下次 {d}", { d: fmtDate(b.next_due_on) })}</span>` : "",
    b.autopay ? `<span class="badge" style="background:var(--surface-2)">${t("自动扣款")}${billPayLabel(b) ? ` · ${esc(billPayLabel(b))}` : ""}</span>` : billPayLabel(b) ? `<span class="badge" style="background:var(--surface-2)">${esc(billPayLabel(b))}</span>` : "",
    b.est != null ? `<span class="badge" style="background:var(--surface-2)">${t("约 {m} / 次", { m: mny(b.est, b.currency) })}</span>` : "",
    b.monthly ? `<span class="badge" style="background:var(--surface-2)">${t("折合每月 {m}", { m: money(b.monthly) })}</span>` : "",
    b.priceUp ? `<span class="badge b-low">${t("涨价了")}</span>` : "",
  ].filter(Boolean).join("");
  return `<div class="asset-badges" style="margin-bottom:12px">${bits}</div>${stampText(b) ? `<p class="record-meta" style="margin:-6px 0 12px">${esc(stampText(b))}</p>` : ""}`;
}

function paySection(b, focus, edit = null) {
  const v = edit || {};   // 编辑某条记录时表单带入它的值
  // 账户下拉的当前值：编辑时按这条记录（卡 / 现金 / 支票 / 手填）；新记一笔按账单的付款账户
  const payVal = edit ? (edit.card_id ? edit.card_id : edit.method === "支票" ? "check" : payAcctValue(null, edit.method)) : (b.pay_card_id ? b.pay_card_id : payAcctValue(null, b.autopay_method));
  const stale = backfillable(b);
  const linked = edit?.purchase_id ? state.purchases.find((x) => x.id === edit.purchase_id) : null;   // 这条缴费记的花费：收款方存在它上面
  const rows = b.pays.map((p) => `<li class="pay-row ${edit?.id === p.id ? "is-editing" : ""}" data-swipe-del="bill-pay">
      <span class="badge ${p.status === "skipped" ? "" : "b-ok"}" style="${p.status === "skipped" ? "background:var(--surface-2)" : ""}">${t(B().PAYMENT_STATUS[p.status] || p.status)}</span>
      <div class="grow"><a class="link-name" href="${href("bill", b.id)}?sec=pay&edit=${p.id}" title="${t("点一下编辑")}">${esc(fmtDate(p.paid_on))}</a>
        <small>${[p.due_on && p.due_on !== p.paid_on ? t("到期 {d}", { d: fmtDate(p.due_on) }) : null, paymentPayLabel(p), p.confirmation_ref ? t("确认号 {ref}", { ref: p.confirmation_ref }) : null, num(p.late_fee) ? t("滞纳金 {m}", { m: mny(p.late_fee, p.currency) }) : null, p.paid_by && Store.mode === "cloud" ? memberName(p.paid_by) : null, p.notes].filter(Boolean).map(esc).join(" · ")}</small></div>
      <b>${p.amount != null ? mny(p.amount, p.currency) : ""}</b>
      <button type="button" class="btn btn-sm btn-ghost swipe-src" data-action="billpay-del" data-id="${p.id}" aria-label="${t("删除这条记录")}">${t("删除")}</button>
    </li>`).join("");
  return `
    <div class="section-head" style="margin-top:28px"><h2>${edit ? t("编辑缴费记录") : t("缴费记录")}</h2><p>${acctText(b) ? `${esc(acctText(b))} · ` : ""}${edit ? t("改这条记录；不会动下次到期日") : t("记一笔后下次到期日自动推到下一期")}</p></div>
    <form id="billPayForm" class="panel" ${focus ? 'data-focus="1"' : ""}>
      <input type="hidden" name="bill_id" value="${esc(b.id)}"><input type="hidden" name="pay_id" value="${esc(edit?.id || "")}">
      <div class="form-grid maint-grid">
        <label>${t("缴费日期")}<input name="paid_on" type="date" required value="${esc(edit ? edit.paid_on || "" : todayISO())}" max="${todayISO()}"></label>
        <label>${t("对应到期日")}<input name="due_on" type="date" value="${esc(edit ? edit.due_on || "" : b.next_due_on || "")}"></label>
        <label>${t("金额（{cur}）", { cur: b.currency || Units.region.currency })}<input name="amount" type="number" inputmode="decimal" min="0" step="0.01" value="${edit ? (edit.amount != null ? num(edit.amount).toFixed(2) : "") : b.est != null ? num(b.est).toFixed(2) : ""}"></label>
        <label>${t("状态")}<select name="status"><option value="paid" ${edit?.status === "paid" ? "selected" : ""}>${t("已缴费")}</option><option value="verified" ${edit ? (edit.status === "verified" ? "selected" : "") : b.autopay ? "selected" : ""}>${t("已核对（自动扣款）")}</option><option value="skipped" ${edit?.status === "skipped" ? "selected" : ""}>${t("跳过这期")}</option></select></label>
        <label>${t("用哪张卡 / 账户")}<select name="pay_account" data-pay-acct>${accountOptions(payVal, { none: "（未指定）", extra: [["cash", "现金"], ["check", "支票"], ["other", "其他（手填）"]] })}</select></label>
        <label data-pay-other ${payVal === "other" ? "" : "hidden"}>${t("方式说明")}<input name="method" maxlength="40" placeholder="${t("例如：网银 / 支票 #1023 / 自动扣款")}" value="${esc(edit ? edit.method || "" : b.autopay_method || "")}"></label>
        <label>${t("收款方")}<input name="store" maxlength="40" value="${esc(edit ? (linked?.store || b.payee || b.name || "") : b.payee || b.name || "")}" placeholder="${esc(b.payee || b.name)}"><small>${edit ? t("只改这一条；中途换了收款方，旧记录保留当时的名字。") : t("没填就用账单的收款方。")}</small></label>
        <label>${t("确认号")}<input name="confirmation_ref" maxlength="60" value="${esc(edit?.confirmation_ref || "")}"></label>
        <label>${t("滞纳金")}<input name="late_fee" type="number" inputmode="decimal" min="0" step="0.01" value="${edit ? num(edit.late_fee).toFixed(2) : "0"}"></label>
        <label class="span-2">${t("备注")}<input name="notes" maxlength="500" value="${esc(edit?.notes || "")}"></label>
      </div>
      <div class="form-actions" style="margin-top:10px"><button type="submit" class="btn btn-primary btn-sm">${edit ? t("保存修改") : t("记一笔")}</button>${edit ? `<a class="btn btn-sm btn-ghost" href="${href("bill", b.id)}?sec=pay">${t("取消")}</a>` : ""}
        <small class="muted">${edit ? t("金额改了，花费统计里对应的那笔也会跟着改。") : t("有金额的记录会同时记入花费统计的“账单”组。")}</small></div>
    </form>
    ${stale.length ? `<div class="notice" role="status" style="margin-top:10px"><b>${t("有 {n} 条旧缴费记录没记账户。", { n: stale.length })}</b> ${t("按现在的付款账户 {a} 一次性补上？花费统计里对应的那几笔也会记到这张卡。现金 / 支票的不动。", { a: billPayLabel(b) })} <button type="button" class="btn btn-sm" data-action="billpay-backfill" data-id="${b.id}">${t("补上")}</button></div>` : ""}
    <div class="panel" style="margin-top:10px">${rows ? `<ul class="restock-list">${rows}</ul>` : `<div class="empty"><strong>${t("还没有记录")}</strong></div>`}</div>`;
}
/** 没记账户、也不是现金 / 支票的旧缴费记录（账单选了付款账户后可以一次性补上） */
const backfillable = (b) => (b.pay_card_id && acctById(b.pay_card_id) ? b.pays.filter((p) => !p.card_id && p.status !== "skipped" && !/^(现金|支票|cash|check)/i.test(p.method || "")) : []);
export async function backfillPayments(id) {
  const b = state.billsEnriched.find((x) => x.id === id); if (!b) return;
  const list = backfillable(b); if (!list.length) return toast(t("没有要补的记录"));
  if (!confirm(t("把这 {n} 条缴费记录都记成 {a}？", { n: list.length, a: billPayLabel(b) }))) return;
  let n = 0;
  for (const p of list) {
    await Store.updateBillPayment(p.id, { card_id: b.pay_card_id, method: resolvePayAccount(b.pay_card_id).method });
    if (p.purchase_id) await Store.updatePurchase(p.purchase_id, { card_id: b.pay_card_id }).catch(() => {});
    n++;
  }
  toast(t("已补上 {n} 条", { n }));
}

/* ── 保存 ── */
const parseList = (s, { int = true } = {}) => String(s || "").split(/[,，\s]+/).map((x) => x.trim()).filter(Boolean).map((x) => (int ? parseInt(x, 10) : x)).filter((x) => (int ? Number.isFinite(x) : true));

/** silent=true：离开页面时自动保存（不跳转；校验不过就提示“没有自动保存”）。返回是否保存成功 */
export async function saveBillForm(f, { silent = false } = {}) {
  const fe = f.elements, err = f.querySelector("#billFormError");
  const fail = (msg, el) => { if (silent) toast(t("没有自动保存：{msg}", { msg })); else { err.textContent = msg; el.focus(); } return false; };
  const name = fe.name.value.trim();
  if (!name) return fail(t("请填写账单名称。"), fe.name);
  const numOrNull = (el, int) => { if (el.value === "") return null; const n = num(el.value, NaN); return Number.isFinite(n) ? (int ? Math.round(n) : Math.round(n * 100) / 100) : null; };
  const dueDates = parseList(fe.due_dates.value, { int: false }).map((x) => x.replace("/", "-")).filter((x) => /^\d{2}-\d{2}$/.test(x));
  const reminders = [...new Set(parseList(fe.reminder_days.value).filter((n) => n >= 0 && n <= 90))].sort((a, b) => b - a).slice(0, 5);
  const payUrl = fe.pay_url.value.trim();
  if (payUrl && !/^https?:\/\//i.test(payUrl)) return fail(t("缴费链接需要以 http:// 或 https:// 开头。"), fe.pay_url);
  const b = {
    id: fe.bill_id.value || undefined, name, category: fe.category.value, property_id: fe.property_id.value || null, direction: fe.direction.value || "payable",
    payee: fe.payee.value.trim() || null, account_last4: fe.account_last4.value.trim() || null, login_hint: fe.login_hint.value.trim() || null, pay_url: payUrl || null,
    pay_channel: fe.pay_channel.value, statement_channel: fe.statement_channel.value, amount_type: fe.amount_type.value, typical_amount: numOrNull(fe.typical_amount),
    currency: (fe.currency.value.trim().toUpperCase() || Units.region.currency).slice(0, 3), frequency: fe.frequency.value, interval_months: numOrNull(fe.interval_months, true),
    due_day: numOrNull(fe.due_day, true), due_dates: dueDates, next_due_on: fe.next_due_on.value || null, grace_days: numOrNull(fe.grace_days, true) || 0, ends_on: fe.ends_on.value || null,
    sub_kind: B().isSubCat(fe.category.value) ? fe.sub_kind.value || null : null, trial_ends_on: B().isSubCat(fe.category.value) ? fe.trial_ends_on.value || null : null,
    reminder_days: reminders.length ? reminders : [7, 1], late_fee_note: fe.late_fee_note.value.trim() || null,
    autopay: fe.autopay.checked, ...payFields(fe.pay_account?.value, fe.autopay_method.value), autopay_card_expires: fe.autopay_card_expires.value || null,
    assigned_to: fe.assigned_to.value || null, essential: fe.essential.checked, active: fe.active.checked, notes: fe.notes.value.trim() || null,
  };
  if (b.pay_channel === "escrow") b.autopay = false;   // 代缴就不是自动扣款
  if (b.autopay && b.pay_channel !== "autopay") b.pay_channel = "autopay";
  if (!b.autopay && b.pay_channel === "autopay") b.pay_channel = "online";
  if (!b.next_due_on) b.next_due_on = initialDue(b);
  // 只改别的分区（如基本信息）时，到期日那块是隐藏的：不拦，照常保存，到期日留到“金额与周期”再补
  const amountVisible = !fe.next_due_on.closest("fieldset")?.hidden;
  if (!b.next_due_on && b.frequency !== "one_time" && amountVisible) return fail(t("这种频率算不出到期日，请填“下次到期日”。"), fe.next_due_on);
  const btn = f.querySelector('button[type="submit"]'); btn.disabled = true;
  try {
    await Store.saveBill(b);
    if (silent) return true;
    toast(b.id ? t("已保存修改") : t("已添加 {name}", { name }));
    leaveBill(true);
    return true;
  } catch (e) { if (silent) throw e; err.textContent = t("保存失败：{msg}", { msg: e.message }); btn.disabled = false; return false; }
}

/** 账单的付款账户字段：下拉选卡 → pay_card_id；现金 / 其他 → autopay_method 文字 */
const payFields = (value, text) => { const r = resolvePayAccount(value, text); return { pay_card_id: r.card_id, autopay_method: r.method }; };
/** 记一笔缴费 / 核对 / 跳过：写 purchases（有金额且为应付，带上用的卡）、写记录、把账单推到下一期 */
export async function recordPayment(bill, { paid_on, due_on, amount, status, method, card_id, confirmation_ref, late_fee, notes, store }) {
  const currency = bill.currency || Units.region.currency;
  let purchase_id = null;
  const total = status === "skipped" ? 0 : num(amount) + num(late_fee);
  if (total > 0 && bill.direction !== "receivable") {
    purchase_id = await Store.addPurchase({ item_id: null, name: bill.name, category: `bill_${bill.category}`, quantity: null, unit: null, store: (store || "").trim().slice(0, 40) || bill.payee || bill.name || null,
      amount: Math.round(total * 100) / 100, currency, purchased_at: new Date(`${paid_on}T12:00:00`).toISOString(), ...(card_id ? { card_id } : {}) });
  }
  await Store.addBillPayment({ bill_id: bill.id, due_on: due_on || bill.next_due_on || null, paid_on, amount: status === "skipped" ? null : (amount == null ? null : Math.round(num(amount) * 100) / 100),
    currency, method: method || null, confirmation_ref: confirmation_ref || null, late_fee: Math.round(num(late_fee) * 100) / 100, status, notes: notes || null, purchase_id, ...(card_id ? { card_id } : {}) });
  // 推到下一期：以这次对应的到期日为基准，保证不会漏期
  const base = due_on || bill.next_due_on || paid_on;
  const next = advanceDue(bill, base);
  const patch = { ...bill, next_due_on: next };
  if (!next && bill.frequency === "one_time") patch.active = false;
  for (const k of ["pays", "last", "avg", "est", "priceUp", "daysLeft", "status", "cardDays", "cardExpiring", "monthly", "ended"]) delete patch[k];
  await Store.saveBill(patch);
}

/** 删一条缴费记录：同时退回它推进过的到期日（只在它正是把账单推到当前这一期的那条时才退；之后又记了别的期，或同一期还有别的记录，就不动）。返回退回后的到期日，没退回返回 null */
export async function deleteBillPay(id) {
  const p = state.billPayments.find((x) => x.id === id);
  const bill = p && state.billsEnriched.find((b) => b.id === p.bill_id);
  await Store.deleteBillPayment(id);
  if (!bill || !p.due_on) return null;
  const sameDue = state.billPayments.some((x) => x.id !== id && x.bill_id === bill.id && x.due_on === p.due_on);
  const pushedIt = bill.next_due_on === advanceDue(bill, p.due_on) || (bill.frequency === "one_time" && !bill.next_due_on);
  if (sameDue || !pushedIt || bill.next_due_on === p.due_on) return null;
  const patch = { ...bill, next_due_on: p.due_on };
  if (bill.frequency === "one_time") patch.active = true;   // 一次性账单记过缴费会被停用，删了记录要恢复
  for (const k of ["pays", "last", "avg", "est", "priceUp", "daysLeft", "status", "cardDays", "cardExpiring", "monthly", "ended"]) delete patch[k];
  await Store.saveBill(patch);
  return p.due_on;
}

/** 改一条已有的缴费记录：不动账单的下次到期日；记过花费的，花费也跟着改（金额变 0 / 跳过就删掉那笔花费，之前没记的有金额就补一笔） */
async function updatePayment(bill, fe) {
  const old = state.billPayments.find((x) => x.id === fe.pay_id.value);
  if (!old) return toast(t("找不到这条记录"));
  const r2 = (v) => Math.round(num(v) * 100) / 100, status = fe.status.value, paid_on = fe.paid_on.value || old.paid_on || todayISO();
  const amount = status === "skipped" || fe.amount.value === "" ? null : r2(fe.amount.value), late = r2(fe.late_fee.value), total = status === "skipped" ? 0 : r2((amount || 0) + late);
  const currency = old.currency || bill.currency || Units.region.currency, at = new Date(`${paid_on}T12:00:00`).toISOString();
  const payee = (fe.store?.value || "").trim().slice(0, 40) || bill.payee || bill.name || null;
  const pay = resolvePayAccount(fe.pay_account?.value, fe.method.value), cardPatch = pay.card_id || old.card_id ? { card_id: pay.card_id } : {};   // 没选过卡就不带这个字段（没执行迁移 036 也能存）
  let purchase_id = old.purchase_id || null;
  if (purchase_id && total > 0) await Store.updatePurchase(purchase_id, { amount: total, purchased_at: at, store: payee, ...cardPatch });
  else if (purchase_id) { await Store.deletePurchase(purchase_id); purchase_id = null; }
  else if (total > 0 && bill.direction !== "receivable") purchase_id = await Store.addPurchase({ item_id: null, name: bill.name, category: `bill_${bill.category}`, quantity: null, unit: null, store: payee, amount: total, currency, purchased_at: at, ...cardPatch });
  await Store.updateBillPayment(old.id, { paid_on, due_on: fe.due_on.value || null, amount, currency, method: pay.method, confirmation_ref: fe.confirmation_ref.value.trim() || null, late_fee: late, status, notes: fe.notes.value.trim() || null, purchase_id, ...cardPatch });
  toast(t("已保存修改"));
}
export async function saveBillPayForm(f) {
  const fe = f.elements;
  const bill = state.billsEnriched.find((x) => x.id === fe.bill_id.value);
  if (!bill) return toast(t("账单不存在"));
  if (fe.pay_id?.value) return updatePayment(bill, fe);
  const pay = resolvePayAccount(fe.pay_account?.value, fe.method.value);
  await recordPayment(bill, { paid_on: fe.paid_on.value || todayISO(), due_on: fe.due_on.value || null, amount: fe.amount.value === "" ? null : fe.amount.value, status: fe.status.value,
    method: pay.method, card_id: pay.card_id, confirmation_ref: fe.confirmation_ref.value.trim(), late_fee: fe.late_fee.value, notes: fe.notes.value.trim(), store: fe.store?.value });
  toast(fe.status.value === "skipped" ? t("已跳过这期") : t("已记录，下次到期 {d}", { d: fmtDate(advanceDue(bill, fe.due_on.value || bill.next_due_on || fe.paid_on.value) || "") || t("无") }));
}

/** 概览里的“已核对”：自动扣款账单一键记录（金额取通常金额或平均） */
export async function quickVerify(id) {
  const bill = state.billsEnriched.find((x) => x.id === id);
  if (!bill) return;
  const pay = bill.pay_card_id ? resolvePayAccount(bill.pay_card_id) : { card_id: null, method: bill.autopay_method || t("自动扣款") };
  await recordPayment(bill, { paid_on: todayISO(), due_on: bill.next_due_on, amount: bill.est, status: "verified", method: pay.method, card_id: pay.card_id, late_fee: 0 });
  toast(t("已核对 {name}，下次 {d}", { name: withProperty(bill.property_id, bill.name), d: fmtDate(advanceDue(bill, bill.next_due_on || todayISO()) || "") || t("无") }));
}
