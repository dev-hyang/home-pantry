/* 账单 → 医疗：概览 / 账单 / 年度报表三个标签（窄屏概览下面是入口行），账单详情页（?bill=<id|new>）里有金额、保险、付款记录。
 * 隐私：默认“仅自己和家主可见”（visibility = private），可改成全家可见；列表里私密的带 🔒。 */
import { state } from "../core/state.js";
import { Store } from "../core/store.js";
import { $, esc, fmtDate, money, num, toast, todayISO } from "../core/util.js";
import { t } from "../core/i18n.js";
import { go, href } from "../core/router.js";
import { tabBar, tabHub } from "../core/hub.js";
import { MEDICAL_TABS, activeTab } from "../core/tabs.js";
import { dq, download, lastMonths, monthLabel, toCsv } from "../stats/views.js";
import { autofillBar } from "../core/autofill.js";
import { kindsNote } from "./kinds.js";
import { KINDS, PEOPLE_KINDS, STATUS, STATUS_CLS, detailHref, enrichMedical, findPerson, kindOf, mergeMedical, peopleFor, subIcon, subName } from "./medical.js";

const cur = () => Units.region.currency;
const mny = (v, c) => (v == null ? "—" : Units.money(num(v), c || cur()));
const medHref = (id) => `${href("bills", "onetime")}${id === "overview" ? "" : `?tab=${id}`}`;
const lock = (b) => (b.visibility === "private" ? `<span title="${esc(t("仅自己和家主可见"))}" aria-label="${esc(t("仅自己和家主可见"))}">🔒</span> ` : "");

/** 重读医疗账单和付款（保存 / 删除后用，不用整个 refresh）；表还没建（没执行迁移 027）时当作空 */
export async function reloadMedical() {
  try {
    const [bills, pays] = await Promise.all([Store.listMedicalBills(), Store.listMedicalPayments()]);
    state.medBills = bills; state.medPayments = pays;
  } catch (e) { console.warn("[medical]", e.message); state.medBills = state.medBills || []; state.medPayments = state.medPayments || []; }
  state.medEnriched = enrichMedical(state.medBills, state.medPayments);
  mergeMedical();
}
export function applyMedical(bills, pays) {
  state.medBills = bills; state.medPayments = pays; state.medEnriched = enrichMedical(bills, pays); mergeMedical();
}

/* ───────────── 行 / 筛选 ───────────── */
export function medRow(b) {
  const who = [b.kind !== "medical" ? t(kindOf(b).name) : null, b.patient, b.service_date ? fmtDate(b.service_date) : null, b.bill_ref ? `#${b.bill_ref}` : null].filter(Boolean).map(esc).join(" · ");
  const amt = b.status === "paid" ? mny(b.paid, b.currency) : b.balance != null ? mny(b.balance, b.currency) : mny(b.billed_amount, b.currency);
  const due = b.open && b.due_on ? ` · ${b.overdue ? `<b class="down">${t("逾期")}</b> ` : ""}${t("到期 {d}", { d: fmtDate(b.due_on) })}` : "";
  return `<li><span class="badge ${STATUS_CLS[b.status] || ""}">${t(STATUS[b.status] || b.status)}</span>
    <div class="grow">${lock(b)}<a class="link-name" href="${detailHref(b.id)}">${subIcon(b)} ${esc(b.provider)}</a><small>${who}${due}</small></div>
    <b title="${esc(b.status === "paid" ? t("已付") : t("余额"))}">${amt}</b></li>`;
}
function filtered() {
  const f = state.medFilter, q = f.q.trim().toLowerCase();
  return state.medEnriched.filter((b) => (f.kind === "all" || b.kind === f.kind) && (f.patient === "all" || (b.patient || "") === f.patient) && (f.provider === "all" || b.provider === f.provider)
    && (f.status === "all" || (f.status === "open" ? b.open : b.status === f.status)) && (f.year === "all" || String(b.service_date || b.bill_date || b.created_at || "").startsWith(f.year))
    && (!q || `${b.provider}${b.patient || ""}${b.bill_ref || ""}${b.claim_ref || ""}${b.insurer || ""}`.toLowerCase().includes(q)))
    .sort((x, y) => String(y.service_date || y.bill_date || y.created_at).localeCompare(String(x.service_date || x.bill_date || x.created_at)));
}
function listInner() {
  const all = filtered();
  if (!state.medEnriched.length) return emptyHtml();
  if (!all.length) return `<div class="empty"><strong>${t("没有符合条件的账单")}</strong>${t("换个筛选试试。")}</div>`;
  const owe = all.reduce((s, b) => s + (b.open && b.balance ? b.balance : 0), 0);
  return `<p class="muted" style="margin:0 0 6px;font-size:13px">${t("{n} 张", { n: all.length })} · ${t("余额 {a}", { a: mny(owe) })}</p><ul class="restock-list">${all.slice(0, 200).map(medRow).join("")}</ul>`;
}
export function renderMedList() { const h = $("#medList"); if (h) h.innerHTML = listInner(); }
const emptyHtml = () => `<div class="empty"><strong>${t("还没有医疗账单")}</strong>${t("就诊后收到的账单、保险说明（EOB）都记在这里：总额、保险已付、自付金额、分次付款。默认只有你自己和家主看得到。")}
  <p><a class="btn btn-primary" href="${detailHref("new")}">${t("记一张医疗账单")}</a></p></div>`;

/* ───────────── 三个标签 ───────────── */
function overviewTab() {
  const list = state.medEnriched, open = list.filter((b) => b.open), owe = open.reduce((s, b) => s + (b.balance || 0), 0);
  const wait = list.filter((b) => b.status === "awaiting_insurance").length, y = String(new Date().getFullYear());
  const paidYear = state.medPayments.filter((p) => String(p.paid_on).startsWith(y) && state.medBills.some((b) => b.id === p.bill_id)).reduce((s, p) => s + num(p.amount), 0);
  const months = lastMonths(12), byM = Object.fromEntries(months.map((m) => [m, 0]));
  for (const p of state.medPayments) { const m = String(p.paid_on).slice(0, 7); if (m in byM && state.medBills.some((b) => b.id === p.bill_id)) byM[m] += num(p.amount); }
  const chart = list.length && Object.values(byM).some((v) => v > 0) ? Charts.bars({ title: t("每月医疗付款"), labels: months.map(monthLabel), fmt: money,
    series: [{ name: t("已付"), color: window.MEDICAL_GROUP.color, values: months.map((m) => byM[m]) }], drill: (_, i) => dq({ cat: "medical", month: months[i] }) }) : "";
  const kpi = (label, val, sub, drill) => `<div class="kpi"><span>${label}</span><b>${val}</b><small>${sub}</small></div>`;
  return `<div class="kpis">
      ${kpi(t("未结余额"), mny(owe), t("{n} 张待处理", { n: open.length }))}
      ${kpi(t("等保险理赔"), wait, wait ? t("超过 45 天会提醒") : t("没有"))}
      ${kpi(t("{y} 年已付", { y }), mny(paidYear), t("自付，不含保险已付"))}
    </div>
    ${tabHub(MEDICAL_TABS, medHref, t("更多"))}
    ${list.length ? `<section class="section"><div class="section-head"><h2>${t("待处理")}</h2></div><div class="panel">${open.length ? `<ul class="restock-list">${open.sort((a, b) => (a.due_on || "9999").localeCompare(b.due_on || "9999")).slice(0, 8).map(medRow).join("")}</ul>` : `<div class="empty"><strong>${t("没有待处理的账单")}</strong></div>`}</div></section>` : `<div class="panel">${emptyHtml()}</div>`}
    ${chart ? `<div class="panel chart-panel"><h3>${t("每月医疗付款")}</h3>${chart}<p class="muted drill-hint">${t("点柱子，可以查看对应的付款明细。")}</p></div>` : ""}
    <p class="muted" style="font-size:12.5px">${t("医疗付款会自动并入 账单 → 花费 的“医疗”分类，商店 / 收款方是医院或化验所。")}</p>`;
}
function listTab() {
  const f = state.medFilter, opt = (v, l, c) => `<option value="${esc(v)}" ${c === v ? "selected" : ""}>${esc(l)}</option>`;
  const uniq = (key) => [...new Set(state.medEnriched.map((b) => b[key]).filter(Boolean))].sort();
  const years = [...new Set(state.medEnriched.map((b) => String(b.service_date || b.bill_date || b.created_at || "").slice(0, 4)).filter(Boolean))].sort().reverse();
  if (!state.medEnriched.length) return `<div class="panel">${emptyHtml()}</div>`;
  return `<div class="panel">
    <div class="toolbar">
      <input type="search" id="medSearch" placeholder="${t("搜索商家、患者、账单号")}" value="${esc(f.q)}" aria-label="${t("搜索账单")}">
      <select id="medKind" aria-label="${t("按种类筛选")}">${opt("all", t("全部种类"), f.kind)}${Object.entries(KINDS).map(([k, K]) => opt(k, `${K.icon} ${t(K.name)}`, f.kind)).join("")}</select>
      <select id="medPatient" aria-label="${t("按患者筛选")}">${opt("all", t("全部患者 / 对象"), f.patient)}${uniq("patient").map((x) => opt(x, x, f.patient)).join("")}</select>
      <select id="medProvider" aria-label="${t("按商家筛选")}">${opt("all", t("全部医院 / 商家"), f.provider)}${uniq("provider").map((x) => opt(x, x, f.provider)).join("")}</select>
      <select id="medStatus" aria-label="${t("按状态筛选")}">${opt("all", t("全部状态"), f.status)}${opt("open", t("待处理（未结清）"), f.status)}${Object.entries(STATUS).map(([k, n]) => opt(k, t(n), f.status)).join("")}</select>
      <select id="medYear" aria-label="${t("按年份筛选")}">${opt("all", t("全部年份"), f.year)}${years.map((y) => opt(y, y, f.year)).join("")}</select>
    </div>
    <div id="medList">${listInner()}</div></div>`;
}
function reportTab() {
  const y = state.medYear || String(new Date().getFullYear()), years = [...new Set([String(new Date().getFullYear()), ...state.medEnriched.map((b) => String(b.service_date || b.bill_date || "").slice(0, 4)).filter(Boolean)])].sort().reverse();
  const inYear = state.medEnriched.filter((b) => String(b.service_date || b.bill_date || b.created_at || "").startsWith(y));
  const payYear = state.medPayments.filter((p) => String(p.paid_on).startsWith(y) && state.medBills.some((b) => b.id === p.bill_id));
  const sum = (arr, f) => arr.reduce((s, x) => s + f(x), 0);
  const group = (key) => { const m = new Map(); for (const b of inYear) { const k = b[key] || t("（未填）"); const g = m.get(k) || { name: k, n: 0, billed: 0, ins: 0, adj: 0, owed: 0, paid: 0 }; g.n++; g.billed += num(b.billed_amount); g.ins += num(b.insurance_paid); g.adj += num(b.adjustment); g.owed += b.owed || 0; g.paid += b.paid; m.set(k, g); } return [...m.values()].sort((a, b) => b.owed - a.owed); };
  const table = (title, rows) => `<div class="panel"><h3 style="font-size:15px;margin:0 0 6px">${title}</h3><div class="ch-scroll"><table class="store-table"><thead><tr><th scope="col">${t("名称")}</th><th scope="col">${t("张数")}</th><th scope="col">${t("账单总额")}</th><th scope="col">${t("保险已付")}</th><th scope="col">${t("自付金额")}</th><th scope="col">${t("已付")}</th></tr></thead>
    <tbody>${rows.map((g) => `<tr><th scope="row">${esc(g.name)}</th><td>${g.n}</td><td>${esc(mny(g.billed))}</td><td>${esc(mny(g.ins))}</td><td>${esc(mny(g.owed))}</td><td>${esc(mny(g.paid))}</td></tr>`).join("")}</tbody></table></div></div>`;
  const hsa = sum(payYear.filter((p) => state.medBills.find((b) => b.id === p.bill_id)?.hsa_eligible), (p) => num(p.amount));
  return `<div class="range-row"><label class="field-label" for="medReportYear" style="margin:0">${t("年份")}</label>
      <select id="medReportYear">${years.map((v) => `<option value="${v}" ${v === y ? "selected" : ""}>${t("{y} 年", { y: v })}</option>`).join("")}</select>
      <button type="button" class="btn btn-sm btn-primary" data-action="med-csv">${t("导出 CSV")}</button>
      <button type="button" class="btn btn-sm btn-ghost" onclick="window.print()">${t("打印")}</button></div>
    <div class="kpis"><div class="kpi"><span>${t("账单总额")}</span><b>${mny(sum(inYear, (b) => num(b.billed_amount)))}</b><small>${t("{n} 张", { n: inYear.length })}</small></div>
      <div class="kpi"><span>${t("自付已付")}</span><b>${mny(sum(payYear, (p) => num(p.amount)))}</b><small>${t("{n} 笔付款", { n: payYear.length })}</small></div>
      <div class="kpi"><span>${t("HSA / FSA 可报")}</span><b>${mny(hsa)}</b><small>${t("已付，标了“可用 HSA / FSA”的账单")}</small></div></div>
    ${inYear.length ? (new Set(inYear.map((b) => b.kind)).size > 1 ? table(t("按种类"), group("kind").map((g) => ({ ...g, name: t(KINDS[g.name]?.name || g.name) }))) : "") + table(t("按患者 / 对象"), group("patient")) + table(t("按医院 / 商家"), group("provider")) : `<div class="panel empty"><strong>${t("这一年没有医疗账单")}</strong></div>`}
    <p class="muted" style="font-size:12.5px">${t("报税抵扣、HSA / FSA 报销以保险公司和税务机构的规定为准，这里只帮你把金额理清楚；导出的是已付的每一笔。")}</p>`;
}

export function viewMedical() {
  const r = state.route, billId = r.q.get("bill");
  if (r.q.get("people")) return viewPeople();
  if (billId) return viewDetail(billId, r.q.get("pay"));
  const tab = activeTab(r) || "overview";
  const body = { overview: overviewTab, list: listTab, report: reportTab }[tab]();
  return `<section class="section">
    <div class="section-head"><h2>🧾 ${t("一次性账单")}</h2><div class="head-acts"><a class="btn btn-sm btn-ghost" href="${href("bills", "onetime")}?people=1">${t("家庭成员")}</a><a class="btn btn-primary btn-sm" href="${detailHref("new")}">${t("记一张账单")}</a></div></div>
    ${kindsNote("onetime")}
    <p class="muted" style="margin:0 0 10px;font-size:13px">${Object.values(KINDS).map((K) => `${K.icon} ${t(K.name)}`).join(" · ")}</p>
    ${tabBar(MEDICAL_TABS, tab, medHref, t("医疗内容"))}
    ${body}</section>`;
}

/* ───────────── 账单详情：基本信息 + 金额 + 付款 ───────────── */
const d = (x) => esc(x ?? "");
const people = () => [...new Set([...state.members.map((m) => m.display_name), ...state.medBills.flatMap((b) => [b.patient, b.guarantor])].filter(Boolean))];
function viewDetail(id, payId) {
  const isNew = id === "new", b = isNew ? null : state.medEnriched.find((x) => x.id === id);
  if (!isNew && !b) return `<section class="section"><div class="panel empty"><strong>${t("找不到这张账单")}</strong>${t("可能已被删除，或它是别人的私密账单。")}<p><a class="btn" href="${medHref("list")}">${t("回账单列表")}</a></p></div></section>`;
  const newKind = KINDS[state.route.q.get("kind")] ? state.route.q.get("kind") : "medical";
  const v = b || { kind: newKind, status: "open", visibility: KINDS[newKind].visibility, currency: cur(), insurance_paid: 0, adjustment: 0, service_date: "", hsa_eligible: false }, K = kindOf(v);
  const subs = K.subs.map(([k, n, ic]) => `<option value="${k}" ${v.subkind === k ? "selected" : ""}>${ic} ${t(n)}</option>`).join("");
  const num0 = (x) => (x == null || x === "" ? "" : num(x).toFixed(2));
  const pay = payId && b ? b.pays.find((p) => p.id === payId) : null;
  const owedNow = b ? b.owed : null;
  return `<section class="section form-page">
    ${autofillBar("medbill", "#medBillForm")}
    <form id="medBillForm" class="panel" novalidate data-id="${d(b?.id)}">
      <input type="hidden" name="kind" value="${d(v.kind)}">
      ${isNew ? `<div class="seg-radio" role="radiogroup" aria-label="${t("账单种类")}" style="margin-bottom:10px">${Object.entries(KINDS).map(([k, X]) => `<label class="radio-pill"><input type="radio" name="kindPick" value="${k}" ${v.kind === k ? "checked" : ""}><span>${X.icon} ${t(X.name)}</span></label>`).join("")}</div>` : `<p class="muted" style="margin:0 0 8px">${K.icon} ${t(K.name)}</p>`}
      <div class="form-grid">
        <label class="span-2">${t(K.provider)}<input name="provider" required maxlength="60" list="medProviders" value="${d(v.provider)}"></label>
        <label>${t("小类")}<select name="subkind"><option value="">${t("未指定")}</option>${subs}</select></label>
        ${peopleFor(v.kind) ? `<label>${t(K.who)}<select name="patient_id" data-last="${d(v.patient_id || (v.patient_text ? "__text" : ""))}">${peopleOptions(peopleFor(v.kind), v.patient_id, v.patient_text)}</select><small>${t("从家庭成员里选，同一个人只建一次，家人各自录入也不会变成两个人。")} <a href="${href("bills", "onetime")}?people=1">${t("管理家庭成员")}</a></small></label>`
          : `<label>${t(K.who)}<input name="patient" maxlength="40" value="${d(v.patient)}"></label>`}
        ${K.guarantor ? `<label>${t("担保人 Guarantor")}<select name="guarantor_id" data-last="${d(v.guarantor_id || (v.guarantor_text ?? v.guarantor ? "__text" : ""))}">${peopleOptions(["adult"], v.guarantor_id, v.guarantor_id ? "" : v.guarantor)}</select><small>${t("负责付款的人，例如孩子的家长")}</small></label>` : ""}
        <label>${t("账单号 Bill #")}<input name="bill_ref" maxlength="60" value="${d(v.bill_ref)}"></label>
        ${K.insurance ? `<label>${t("保险公司")}<input name="insurer" maxlength="60" value="${d(v.insurer)}"></label>
        <label>${t("理赔号 Claim #")}<input name="claim_ref" maxlength="60" value="${d(v.claim_ref)}"></label>` : ""}
        <label>${t(v.kind === "medical" || v.kind === "pet" ? "就诊日期" : "服务日期")}<input name="service_date" type="date" value="${d(v.service_date)}"></label>
        <label>${t("账单日期 Bill date")}<input name="bill_date" type="date" value="${d(v.bill_date)}"></label>
        <label>${t("到期日")}<input name="due_on" type="date" value="${d(v.due_on)}"></label>
        <label>${t(K.billed)}（${esc(v.currency)}）<input name="billed_amount" type="number" inputmode="decimal" min="0" step="0.01" value="${num0(v.billed_amount)}"></label>
        ${K.insurance ? `<label>${t("保险已付")}<input name="insurance_paid" type="number" inputmode="decimal" min="0" step="0.01" value="${num0(v.insurance_paid)}"></label>` : ""}
        <label>${t("折扣 / 冲减")}<input name="adjustment" type="number" inputmode="decimal" min="0" step="0.01" value="${num0(v.adjustment)}"></label>
        <label>${t(K.owed)}<input name="patient_amount" type="number" inputmode="decimal" min="0" step="0.01" value="${num0(v.patient_amount)}"><small>${t(K.insurance ? "留空 = 总额 − 保险已付 − 折扣；以保险说明（EOB）上的为准" : "留空 = 总额 − 折扣")}</small></label>
        <label>${t("状态")}<select name="status">${["awaiting_insurance", "open", "disputed", "collections", "written_off"].map((k) => `<option value="${k}" ${v.status === k ? "selected" : ""}>${t(STATUS[k])}</option>`).join("")}</select><small>${t("已结清 / 部分已付由付款记录自动算")}</small></label>
        <label>${t("谁能看到")}<select name="visibility"><option value="private" ${v.visibility === "private" ? "selected" : ""}>🔒 ${t("仅自己和家主可见")}</option><option value="family" ${v.visibility === "family" ? "selected" : ""}>${t("全家可见")}</option></select></label>
        ${v.kind === "medical" ? `<label class="span-2 check-inline"><input type="checkbox" name="hsa_eligible" ${v.hsa_eligible ? "checked" : ""}><span>${t("可用 HSA / FSA 报销")}</span></label>` : ""}
        <label class="span-2">${t("备注")}<input name="notes" maxlength="500" value="${d(v.notes)}" placeholder="${t(v.kind === "medical" ? "不要记诊断、保单号全文或身份证号" : "合同要点、联系人…")}"></label>
      </div>
      ${peopleFor(v.kind) ? personAddPanel(v.kind) : ""}
      <datalist id="medProviders">${[...new Set(state.medBills.map((x) => x.provider))].map((x) => `<option value="${esc(x)}">`).join("")}</datalist>
      <p id="medBillError" class="form-error" role="alert"></p>
      <div class="form-actions"><button type="submit" class="btn btn-primary">${t("保存")}</button>
        ${b ? `<span class="spacer"></span><button type="button" class="btn btn-danger-ghost" data-action="med-del" data-id="${b.id}">${t("删除这张账单")}</button>` : ""}</div>
    </form>
    ${b ? paymentsHtml(b, pay, owedNow) : `<p class="muted">${t("先保存账单，再记付款。")}</p>`}
  </section>`;
}
function paymentsHtml(b, edit, owed) {
  const rows = b.pays.map((p) => `<li><span class="badge" style="background:var(--surface-2)">${esc(fmtDate(p.paid_on))}</span>
      <div class="grow"><span class="name">${mny(p.amount, p.currency || b.currency)}</span><small>${[p.method, p.confirmation_ref ? t("确认号 {ref}", { ref: p.confirmation_ref }) : null, p.notes].filter(Boolean).map(esc).join(" · ")}</small></div>
      <a class="btn btn-sm btn-ghost" href="${detailHref(b.id)}&pay=${p.id}">${t("编辑")}</a>
      <button type="button" class="btn btn-sm btn-ghost" data-action="med-pay-del" data-id="${p.id}">${t("删除")}</button></li>`).join("");
  const sumLine = owed == null ? t("还没填自付金额或总额，余额未知") : t("自付 {o} · 已付 {p} · 余额 {b}", { o: mny(owed, b.currency), p: mny(b.paid, b.currency), b: mny(b.balance, b.currency) });
  return `<div class="section-head"><h2>${t("付款记录")}</h2><p>${esc(sumLine)}</p></div>
    <form id="medPayForm" class="panel" novalidate data-bill="${b.id}" data-id="${d(edit?.id)}">
      <div class="form-grid">
        <label>${t("付款日期 Payment date")}<input name="paid_on" type="date" required value="${d(edit?.paid_on || todayISO())}" max="${todayISO()}"></label>
        <label>${t("金额（{cur}）", { cur: b.currency })}<input name="amount" type="number" inputmode="decimal" min="0.01" step="0.01" required value="${edit ? Math.abs(num(edit.amount)).toFixed(2) : b.balance ? b.balance.toFixed(2) : ""}"></label>
        <label class="check-inline" style="align-self:end"><input type="checkbox" name="refund" ${edit && num(edit.amount) < 0 ? "checked" : ""}><span>${t("这是退款 / 保险事后理赔")}</span></label>
        <label>${t("付款方式")}<input name="method" maxlength="40" value="${d(edit?.method)}" placeholder="${t("信用卡 / HSA 卡 / 支票…")}"></label>
        <label>${t("确认号 Confirmation #")}<input name="confirmation_ref" maxlength="60" value="${d(edit?.confirmation_ref)}"></label>
        <label class="span-2">${t("备注")}<input name="notes" maxlength="500" value="${d(edit?.notes)}"></label>
      </div>
      <p id="medPayError" class="form-error" role="alert"></p>
      <div class="form-actions"><button type="submit" class="btn btn-primary btn-sm">${edit ? t("保存修改") : t("记一笔付款")}</button>${edit ? `<a class="btn btn-sm btn-ghost" href="${detailHref(b.id)}">${t("取消")}</a>` : ""}
        <small class="muted">${t("付款会自动并入 花费 的“医疗”分类。")}</small></div>
    </form>
    <div class="panel" style="margin-top:10px">${rows ? `<ul class="restock-list">${rows}</ul>` : `<div class="empty"><strong>${t("还没有付款")}</strong></div>`}</div>`;
}

/* ───────────── 保存 / 删除 / 导出 ───────────── */
const val = (el) => (el?.value || "").trim() || null;
const amt = (el) => (el && el.value !== "" ? Math.round(Math.max(0, num(el.value)) * 100) / 100 : null);
export async function saveMedBillForm(f) {
  const fe = f.elements, err = $("#medBillError"), provider = val(fe.provider);
  if (!provider) { err.textContent = t("请填写商家 / 机构名称。"); fe.provider.focus(); return false; }
  const pid = fe.patient_id ? (fe.patient_id.value && fe.patient_id.value !== "__text" ? fe.patient_id.value : null) : null, gid = fe.guarantor_id ? (fe.guarantor_id.value && fe.guarantor_id.value !== "__text" ? fe.guarantor_id.value : null) : null;
  const optText = (sel) => (sel && sel.value === "__text" ? sel.selectedOptions[0].textContent.replace(/（[^）]*）\s*$/, "").trim() : null);   // 旧记录里手填的名字，未关联名册
  const row = { kind: fe.kind.value || "medical", subkind: fe.subkind.value || null, provider, patient: fe.patient_id ? (pid ? state.people.find((x) => x.id === pid)?.name || null : optText(fe.patient_id)) : val(fe.patient), patient_id: pid,
    guarantor: fe.guarantor_id ? (gid ? state.people.find((x) => x.id === gid)?.name || null : optText(fe.guarantor_id)) : val(fe.guarantor), guarantor_id: gid, bill_ref: val(fe.bill_ref), claim_ref: val(fe.claim_ref), insurer: val(fe.insurer),
    service_date: fe.service_date.value || null, bill_date: fe.bill_date.value || null, due_on: fe.due_on.value || null, billed_amount: amt(fe.billed_amount), insurance_paid: amt(fe.insurance_paid) ?? 0,
    adjustment: amt(fe.adjustment) ?? 0, patient_amount: amt(fe.patient_amount), currency: cur(), status: fe.status.value, hsa_eligible: !!fe.hsa_eligible?.checked, visibility: fe.visibility.value, notes: val(fe.notes) };
  if (f.dataset.id) { const old = state.medBills.find((x) => x.id === f.dataset.id); if (old?.currency) row.currency = old.currency; }
  try {
    const id = await Store.saveMedicalBill(f.dataset.id ? { ...row, id: f.dataset.id } : row);
    await reloadMedical(); toast(f.dataset.id ? t("已保存修改") : t("已记下这张账单，接着可以记付款"));
    go(detailHref(id), { replace: true }); return true;
  } catch (e) { err.textContent = /medical_bills|does not exist|schema cache/i.test(e.message) ? t("还没执行数据库迁移 027（医疗账单表），先在 Supabase 里执行 supabase/migrations/027_medical_bills.sql") : t("保存失败：{msg}", { msg: e.message }); return false; }
}
export async function saveMedPayForm(f) {
  const fe = f.elements, err = $("#medPayError"), amount = amt(fe.amount);
  if (!amount || amount <= 0) { err.textContent = t("请填写大于 0 的金额。"); fe.amount.focus(); return false; }
  const b = state.medEnriched.find((x) => x.id === f.dataset.bill); if (!b) return false;
  const row = { paid_on: fe.paid_on.value || todayISO(), amount: fe.refund?.checked ? -amount : amount, currency: b.currency, method: val(fe.method), confirmation_ref: val(fe.confirmation_ref), notes: val(fe.notes) };
  try {
    if (f.dataset.id) await Store.updateMedicalPayment(f.dataset.id, row); else await Store.addMedicalPayment({ ...row, bill_id: b.id });
    await reloadMedical(); toast(f.dataset.id ? t("已保存修改") : t("已记一笔付款"));
    go(detailHref(b.id), { replace: true }); return true;
  } catch (e) { err.textContent = t("保存失败：{msg}", { msg: e.message }); return false; }
}
export async function deleteMedBill(id) { await Store.deleteMedicalBill(id); await reloadMedical(); toast(t("已删除这张账单")); go(medHref("list")); }
export async function deleteMedPay(id) { await Store.deleteMedicalPayment(id); await reloadMedical(); toast(t("已删除这笔付款")); }
export function exportMedicalCsv() {
  const y = state.medYear || String(new Date().getFullYear());
  const rows = [[t("付款日期"), t("种类"), t("患者"), t("担保人"), t("医院 / 化验所"), t("小类"), t("账单号"), t("理赔号"), t("确认号"), t("付款方式"), t("金额"), t("货币"), t("可用 HSA/FSA"), t("就诊日期"), t("账单日期")]];
  for (const p of [...state.medPayments].sort((a, b) => String(a.paid_on).localeCompare(String(b.paid_on)))) {
    const b = state.medEnriched.find((x) => x.id === p.bill_id); if (!b || !String(p.paid_on).startsWith(y)) continue;
    rows.push([p.paid_on, t(kindOf(b).name), b.patient || "", b.guarantor || "", b.provider, subName(b) ? t(subName(b)) : "", b.bill_ref || "", b.claim_ref || "", p.confirmation_ref || "", p.method || "", num(p.amount), p.currency || b.currency, b.hsa_eligible ? t("是") : t("否"), b.service_date || "", b.bill_date || ""]);
  }
  if (rows.length < 2) return toast(t("{y} 年没有医疗付款", { y }));
  download(`${t("医疗付款")}-${y}.csv`, toCsv(rows)); toast(t("已导出 {n} 笔付款", { n: rows.length - 1 }));
}
/** 新建账单时换种类：整页按新种类重画（标签、小类、保险项不同） */
export function onKindPick(e) {
  if (e.target.name !== "kindPick") return;
  go(`${detailHref("new")}&kind=${e.target.value}`, { replace: true });
}
export const medBillLabel = (id) => { const b = state.medEnriched.find((x) => x.id === id); return b ? `${b.provider}${b.patient ? ` · ${b.patient}` : ""}` : t("新账单"); };

/* ───────────── 家庭成员 / 孩子 / 宠物名册：选人、新增（查重）、管理 ───────────── */
const rerender = () => window.dispatchEvent(new HashChangeEvent("hashchange"));
const KIND_ICON = { adult: "🧑", child: "👶", pet: "🐾" };
const peopleOptions = (kinds, selected, legacyText) => `<option value="">${t("（未选）")}</option>${state.people.filter((p) => kinds.includes(p.kind)).map((p) => `<option value="${esc(p.id)}" ${p.id === selected ? "selected" : ""}>${KIND_ICON[p.kind] || ""} ${esc(p.name)}</option>`).join("")}${legacyText && !selected ? `<option value="__text" selected>${esc(legacyText)}（${t("旧记录，未关联")}）</option>` : ""}<option value="__new">＋ ${t("新增…")}</option>`;
const personAddPanel = (kind) => `<div id="personAdd" class="panel" hidden style="margin:10px 0;background:var(--surface-2)">
    <div class="form-grid"><label>${t("姓名")}<input id="personAddName" maxlength="40"></label>
      <label>${t("类别")}<select id="personAddKind">${(peopleFor(kind) || ["adult"]).map((k) => `<option value="${k}">${t(PEOPLE_KINDS[k])}</option>`).join("")}${kind === "medical" ? "" : ""}</select></label></div>
    <p id="personAddMsg" class="muted" role="status" style="margin:6px 0 0;font-size:13px"></p>
    <div class="form-actions"><button type="button" class="btn btn-sm btn-primary" data-action="person-add-do">${t("添加")}</button><button type="button" class="btn btn-sm btn-ghost" data-action="person-add-cancel">${t("取消")}</button></div></div>`;
const personSelects = () => [...document.querySelectorAll("#medBillForm select[name=patient_id], #medBillForm select[name=guarantor_id]")];

/** 下拉里选了“＋ 新增…”：不真的选它，展开新增面板（记下是给哪个下拉加的） */
export function onPersonPick(e) {
  const sel = e.target;
  if (sel.value !== "__new") { sel.dataset.last = sel.value; return; }
  sel.value = sel.dataset.last || ""; const box = $("#personAdd"); if (!box) return;
  box.hidden = false; box.dataset.target = sel.name; box.dataset.confirm = ""; $("#personAddMsg").textContent = "";
  const k = $("#personAddKind"); if (k) k.value = sel.name === "guarantor_id" ? "adult" : (k.options[0]?.value || "adult");
  $("#personAddName").value = ""; $("#personAddName").focus();
}
export function personAddCancel() { const box = $("#personAdd"); if (box) { box.hidden = true; box.dataset.confirm = ""; } }
function selectPerson(id) {
  const box = $("#personAdd"), sel = box?.dataset.target && $(`#medBillForm select[name=${box.dataset.target}]`);
  for (const s of personSelects()) {   // 新人加进所有适用的下拉（患者只列大人 / 孩子或宠物，担保人只列大人）
    const p = state.people.find((x) => x.id === id), ok = s.name === "guarantor_id" ? p.kind === "adult" : (peopleFor($("#medBillForm").elements.kind.value) || []).includes(p.kind);
    if (ok && !s.querySelector(`option[value="${id}"]`)) s.insertBefore(new Option(`${KIND_ICON[p.kind] || ""} ${p.name}`, id), s.querySelector('option[value="__new"]'));
  }
  if (sel && sel.querySelector(`option[value="${id}"]`)) { sel.value = id; sel.dataset.last = id; }
  personAddCancel();
}
export function personUse(id) { selectPerson(id); }
export async function personAddDo() {
  const box = $("#personAdd"), name = $("#personAddName").value.trim(), kind = $("#personAddKind").value, msg = $("#personAddMsg");
  if (!name) { msg.textContent = t("请填写姓名。"); return; }
  const { exact, similar } = findPerson(name);
  if (exact) { selectPerson(exact.id); toast(t("名册里已经有“{n}”，已选中它", { n: exact.name })); return; }
  if (similar.length && box.dataset.confirm !== name) {   // 近似（Alice / Alice Y）：先问是不是同一个人，再点一次“添加”才新建
    box.dataset.confirm = name;
    msg.innerHTML = `${t("名册里有相近的名字，是不是同一个人？")} ${similar.map((p) => `<button type="button" class="chip" data-action="person-use" data-id="${esc(p.id)}">${esc(p.name)} · ${t("是同一个人")}</button>`).join(" ")} ${t("不是的话，再点一次“添加”。")}`;
    return;
  }
  try {
    const id = await Store.savePerson({ name, kind }); state.people = await Store.listPeople();
    applyMedical(state.medBills, state.medPayments); selectPerson(id); toast(t("已加入家庭成员：{n}", { n: name }));
  } catch (e) { msg.textContent = e.message; }
}

/* ── 管理页：#/bills/onetime?people=1 ── */
export function viewPeople() {
  const used = (id) => state.medBills.filter((b) => b.patient_id === id || b.guarantor_id === id).length;
  const edit = state.personEdit;
  const row = (p) => `<li class="person-row">
      <span class="badge" style="background:var(--surface-2)">${KIND_ICON[p.kind] || ""} ${t(PEOPLE_KINDS[p.kind] || p.kind)}</span>
      <div class="grow">${edit === p.id ? `<input id="personEditName" maxlength="40" value="${esc(p.name)}" aria-label="${t("姓名")}">` : `<span class="name">${esc(p.name)}</span>${p.member_user_id ? ` <small class="muted">${t("家庭成员")}</small>` : ""}<small>${used(p.id) ? t("{n} 张账单用了", { n: used(p.id) }) : t("还没有账单")}</small>`}</div>
      ${edit === p.id ? `<button type="button" class="btn btn-sm btn-primary" data-action="person-edit-save" data-id="${p.id}">${t("保存")}</button><button type="button" class="btn btn-sm btn-ghost" data-action="person-edit-cancel">${t("取消")}</button>`
        : `<button type="button" class="btn btn-sm btn-ghost" data-action="person-edit" data-id="${p.id}">${t("改名")}</button>
           ${state.people.length > 1 ? `<select data-merge-for="${p.id}" aria-label="${t("合并到")}"><option value="">${t("合并到…")}</option>${state.people.filter((x) => x.id !== p.id).map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join("")}</select><button type="button" class="btn btn-sm btn-ghost" data-action="person-merge" data-id="${p.id}">${t("合并")}</button>` : ""}
           <button type="button" class="btn btn-sm btn-danger-ghost" data-action="person-del" data-id="${p.id}">${t("删除")}</button>`}</li>`;
  return `<section class="section">
    <div class="section-head"><h2>👪 ${t("家庭成员 / 孩子 / 宠物")}</h2></div>
    <p class="muted kinds-note">${t("一次性账单里的患者、担保人从这里选。同一个人只建一次：家人各自录入“Alice Y”和“Alice”不会变成两个人（名字忽略大小写和空格，近似的会先问你）。改名后所有账单跟着变；建重了可以“合并”。")}</p>
    <div class="panel">${state.people.length ? `<ul class="restock-list">${state.people.map(row).join("")}</ul>` : `<div class="empty"><strong>${t("名册还是空的")}</strong>${t("大人会自动加入；孩子和宠物在下面添加。")}</div>`}</div>
    <div class="panel" style="margin-top:10px"><h3 style="font-size:15px;margin:0 0 6px">${t("批量添加")}</h3>
      <p class="muted" style="margin:0 0 6px;font-size:13px">${t("每行一个名字。小月亮的孩子在另一个账号体系里，这里读不到，把名字抄过来一次就行。")}</p>
      <div class="form-grid"><label class="span-2">${t("名字（每行一个）")}<textarea id="peopleBulkNames" rows="3" maxlength="600"></textarea></label>
        <label>${t("类别")}<select id="peopleBulkKind">${Object.entries(PEOPLE_KINDS).map(([k, n]) => `<option value="${k}" ${k === "child" ? "selected" : ""}>${t(n)}</option>`).join("")}</select></label></div>
      <div class="form-actions"><button type="button" class="btn btn-primary btn-sm" data-action="people-bulk">${t("添加")}</button><a class="btn btn-sm btn-ghost" href="${href("bills", "onetime")}">${t("回一次性账单")}</a></div></div>
  </section>`;
}
export function personEditStart(id) { state.personEdit = id; rerender(); }
export function personEditCancel() { state.personEdit = null; rerender(); }
export async function personEditSave(id) {
  const name = $("#personEditName")?.value.trim(); if (!name) return toast(t("请填写姓名。"));
  const p = state.people.find((x) => x.id === id), dup = findPerson(name).exact;
  if (dup && dup.id !== id) return toast(t("名册里已经有“{n}”了，建重了的话用“合并”", { n: dup.name }));
  try { await Store.savePerson({ ...p, name }); state.people = await Store.listPeople(); applyMedical(state.medBills, state.medPayments); state.personEdit = null; toast(t("已保存修改")); rerender(); } catch (e) { toast(e.message); }
}
export async function personMerge(id) {
  const to = document.querySelector(`[data-merge-for="${id}"]`)?.value; if (!to) return toast(t("先选要合并到谁"));
  const from = state.people.find((x) => x.id === id), dest = state.people.find((x) => x.id === to);
  try { await Store.mergePeople(id, to); await reloadMedical(); state.people = await Store.listPeople(); applyMedical(state.medBills, state.medPayments); toast(t("已把“{a}”合并到“{b}”", { a: from.name, b: dest.name })); rerender(); } catch (e) { toast(e.message); }
}
export async function personDelete(id) {
  try { await Store.deletePerson(id); state.people = await Store.listPeople(); applyMedical(state.medBills, state.medPayments); toast(t("已删除")); rerender(); } catch (e) { toast(e.message); }
}
export async function peopleBulk() {
  const names = ($("#peopleBulkNames")?.value || "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean), kind = $("#peopleBulkKind").value;
  if (!names.length) return toast(t("请填写名字。"));
  let added = 0; const skipped = [], similar = [];
  for (const n of names) {
    const { exact, similar: sim } = findPerson(n); if (exact) { skipped.push(n); continue; }
    try { await Store.savePerson({ name: n, kind }); state.people = await Store.listPeople(); added++; if (sim.length) similar.push(`${n}≈${sim[0].name}`); } catch (e) { skipped.push(n); }
  }
  applyMedical(state.medBills, state.medPayments);
  toast(t("已添加 {n} 个", { n: added }) + (skipped.length ? t("；已有 / 失败：{l}", { l: skipped.join("、") }) : "") + (similar.length ? t("；注意名字相近，是否重复：{l}", { l: similar.join("、") }) : ""));
  rerender();
}
