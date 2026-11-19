import { assetSelectHtml } from "./asset-ui.js";
import { copyOf } from "../core/more-menu.js";
import { state } from "../core/state.js";
import { Store } from "../core/store.js";
import { $, esc, fmtDate, num, toast, todayISO } from "../core/util.js";
import { lang, t } from "../core/i18n.js";
import { go, href } from "../core/router.js";
import { autofillBar } from "../core/autofill.js";
import { crumbNav } from "../core/hub.js";
import { allBillsHref } from "./all-views.js";
import { billScopeParts, overviewHref } from "./trail.js";
import { viewOneTimeWizard } from "./ot-wizard-views.js";
import { propertyOptionsHtml } from "../core/lifecycle.js";
import { accountOptions, acctById, paymentPayLabel } from "./cards-views.js";
import { KINDS, PEOPLE_KINDS, STATUS, STATUS_CLS, detailHref, findPerson, kindOf, peopleFor, subIcon, subName } from "./medical.js";
import { applyMedical, reloadMedical } from "./medical-data.js";
export { applyMedical, medBillLabel, reloadMedical } from "./medical-data.js";

const cur = () => Units.region.currency;
const mny = (v, c) => (v == null ? "—" : Units.money(num(v), c || cur()));
const medHref = (id) => (id === "overview" ? href("bills", "overview") : allBillsHref({ type: "onetime" }));
   // 一次性账单没有自己的目录页了：列表 = 全部账单（只看一次性）
const lock = (b) => (b.visibility === "private" ? `<span title="${esc(t("仅自己和家主可见"))}" aria-label="${esc(t("仅自己和家主可见"))}">🔒</span> ` : "");
/** 一次性账单详情 / 新建页（#/otbill/<id|new>） */
export function viewOtBill() {
  const r = state.route;
  return viewDetail(r.id || "new", r.q.get("pay"));
}
/* ───────────── 账单详情：基本信息 + 金额 + 付款 ───────────── */
const d = (x) => esc(x ?? "");
const people = () => [...new Set([...state.members.map((m) => m.display_name), ...state.medBills.flatMap((b) => [b.patient, b.guarantor])].filter(Boolean))];
function viewDetail(id, payId) {
  const isNew = id === "new", b = isNew ? null : state.medEnriched.find((x) => x.id === id);
  if (!isNew && !b) return `<section class="section"><div class="panel empty"><strong>${t("找不到这张账单")}</strong>${t("可能已被删除，或它是别人的私密账单。")}<p><a class="btn" href="${medHref("list")}">${t("回账单列表")}</a></p></div></section>`;
  const newKind = KINDS[state.route.q.get("kind")] ? state.route.q.get("kind") : "medical";
  {   // 新建：默认走 5 步向导；mode=full / copy / 别的应用带来的预填（provider、date、patient、note）→ 原整页表单
    const q0 = state.route.q;
    if (isNew && q0.get("mode") !== "full" && !q0.get("copy") && !q0.get("provider") && !q0.get("date") && !q0.get("patient") && !q0.get("note")) return viewOneTimeWizard();
    if (b && !q0.get("sec")) return medCardsPage(b, payId ? b.pays.find((p) => p.id === payId) : null);
  }
  // 从别的应用带来的预填（牧羊人的就诊「去爱家记医疗账单」：不同数据库，只能把机构、日期、就诊人放在网址里）：?bill=new&provider=…&date=…&patient=…&note=…
  const pq = state.route.q, pre = isNew ? { provider: (pq.get("provider") || "").slice(0, 60), service_date: /^\d{4}-\d{2}-\d{2}$/.test(pq.get("date") || "") ? pq.get("date") : "",
    patient_text: (pq.get("patient") || "").slice(0, 40), notes: (pq.get("note") || "").slice(0, 500) } : {};
  if (isNew && pq.get("prop") && state.properties.some((x) => x.id === pq.get("prop"))) pre.property_id = pq.get("prop");
  if (isNew && pre.patient_text) { const hit = (state.people || []).find((p) => String(p.name).trim() === pre.patient_text.trim()); if (hit) pre.patient_id = hit.id; else pre.notes = [t("就诊人：{n}", { n: pre.patient_text }), pre.notes].filter(Boolean).join(" · "); delete pre.patient_text; }   // 名字和家庭成员对得上就直接选那个人，对不上写进备注（不当成「旧记录」）
  // 复制：同一家机构 / 同一位就诊人 / 同类，日期清空、已付和保险清零，状态回到未结
  const msrc = isNew && pq.get("copy") ? copyOf((state.medBills || []).find((x) => x.id === pq.get("copy")), ["service_date", "insurance_paid", "adjustment", "closed_on"]) : null;
  if (msrc) Object.assign(msrc, { status: "open", service_date: "", insurance_paid: 0, adjustment: 0 });
  // 新建装修 / 项目账单默认挂当前房产（其他种类留空，要挂自己选）
  const v = b || msrc || { kind: newKind, status: "open", visibility: KINDS[newKind].visibility, currency: cur(), insurance_paid: 0, adjustment: 0, service_date: "", hsa_eligible: false, property_id: newKind === "project" && state.properties.some((p) => p.id === state.propertyId) ? state.propertyId : null, ...pre }, K = kindOf(v);
  const subs = K.subs.map(([k, n, ic]) => `<option value="${k}" ${v.subkind === k ? "selected" : ""}>${ic} ${t(n)}</option>`).join("");
  const num0 = (x) => (x == null || x === "" ? "" : num(x).toFixed(2));
  const secQ = b ? pq.get("sec") : "", hide = (k2) => (secQ && secQ !== k2 ? "hidden" : "");   // 已保存的账单：?sec=basic|amount|other 只显示那一块（其余字段仍在表单里一起保存）
  const pay = payId && b ? b.pays.find((p) => p.id === payId) : null;
  const owedNow = b ? b.owed : null;
  return `<section class="section form-page">
    ${b ? crumbNav([...billScopeParts(b, "onetime"), { href: detailHref(b.id), label: b.provider, icon: subIcon(b) }, { label: t("编辑") }]) : crumbNav([{ href: overviewHref(), label: t("财务") }, { href: overviewHref(), label: t("账单概览") }, { label: t("添加一次性账单") }])}
    ${secQ ? "" : autofillBar("medbill", "#medBillForm")}${b && !secQ ? `<p class="muted" style="margin:-4px 0 8px;font-size:12.5px">${t("这张账单已保存。再拍一张会新建一张账单，不会改动这张。")}</p>` : ""}
    <form id="medBillForm" class="panel" novalidate data-id="${d(b?.id)}">
      <input type="hidden" name="kind" value="${d(v.kind)}">
      ${isNew ? `<div class="seg-radio" role="radiogroup" aria-label="${t("账单种类")}" style="margin-bottom:10px">${Object.entries(KINDS).map(([k, X]) => `<label class="radio-pill"><input type="radio" name="kindPick" value="${k}" ${v.kind === k ? "checked" : ""}><span>${X.icon} ${t(X.name)}</span></label>`).join("")}</div>` : `<p class="muted" style="margin:0 0 8px">${K.icon} ${t(K.name)}</p>`}
      <fieldset data-sec="basic" ${hide("basic")}>
        <legend class="sr-only">${t("这是什么账单")}</legend>
        <div class="form-grid">
        <label class="span-2">${t(K.provider)}<input name="provider" required maxlength="60" list="medProviders" value="${d(v.provider)}"></label>
        <label>${t("小类")}<select name="subkind"><option value="">${t("未指定")}</option>${subs}</select></label>
        ${peopleFor(v.kind) ? `<label>${t(K.who)}<select name="patient_id" data-last="${d(v.patient_id || (v.patient_text ? "__text" : ""))}">${peopleOptions(peopleFor(v.kind), v.patient_id, v.patient_text)}</select><small>${t("从家庭成员里选，同一个人只建一次，家人各自录入也不会变成两个人。")} <a href="${href("bills", "onetime")}?people=1">${t("管理家庭成员")}</a></small></label>`
          : `<label>${t(K.who)}<input name="patient" maxlength="40" value="${d(v.patient)}"></label>`}
        ${K.guarantor ? `<label>${t("担保人 Guarantor")}<select name="guarantor_id" data-last="${d(v.guarantor_id || (v.guarantor_text ?? v.guarantor ? "__text" : ""))}">${peopleOptions(["adult"], v.guarantor_id, v.guarantor_id ? "" : v.guarantor)}</select><small>${t("负责付款的人，例如孩子的家长")}</small></label>` : ""}
        <label>${t("账单号 Bill #")}<input name="bill_ref" maxlength="60" value="${d(v.bill_ref)}"></label>
        ${K.insurance ? `<label>${t("保险公司")}<input name="insurer" maxlength="60" value="${d(v.insurer)}"></label>
        <label>${t("理赔号 Claim #")}<input name="claim_ref" maxlength="60" value="${d(v.claim_ref)}"></label>` : ""}
        </div>
      </fieldset>
      <fieldset data-sec="amount" ${hide("amount")}>
        <legend class="sr-only">${t("金额与日期")}</legend>
        <div class="form-grid">
        <label>${t(v.kind === "medical" || v.kind === "pet" ? "就诊日期" : v.kind === "travel" ? "出发日期" : "服务日期")}<input name="service_date" type="date" value="${d(v.service_date)}"></label>
        <label>${t("账单日期 Bill date")}<input name="bill_date" type="date" value="${d(v.bill_date)}"></label>
        <label>${t("到期日")}<input name="due_on" type="date" value="${d(v.due_on)}"></label>
        <label>${t(K.billed)}（${esc(v.currency)}）<input name="billed_amount" type="number" inputmode="decimal" min="0" step="0.01" value="${num0(v.billed_amount)}"></label>
        ${K.insurance ? `<label>${t("保险已付")}<input name="insurance_paid" type="number" inputmode="decimal" min="0" step="0.01" value="${num0(v.insurance_paid)}"></label>` : ""}
        <label>${t("折扣 / 冲减")}<input name="adjustment" type="number" inputmode="decimal" min="0" step="0.01" value="${num0(v.adjustment)}"></label>
        <label>${t(K.owed)}<input name="patient_amount" type="number" inputmode="decimal" min="0" step="0.01" value="${num0(v.patient_amount)}"><small>${t(K.insurance ? "留空 = 总额 − 保险已付 − 折扣；以保险说明（EOB）上的为准" : "留空 = 总额 − 折扣")}</small></label>
        <label>${t("状态")}<select name="status">${["awaiting_insurance", "open", "disputed", "collections", "written_off"].map((k) => `<option value="${k}" ${v.status === k ? "selected" : ""}>${t(STATUS[k])}</option>`).join("")}</select><small>${t("已结清 / 部分已付由付款记录自动算")}</small></label>
        ${v.kind === "medical" ? `<label class="span-2 check-inline"><input type="checkbox" name="hsa_eligible" ${v.hsa_eligible ? "checked" : ""}><span>${t("可用 HSA / FSA 报销")}</span></label>` : ""}
        </div>
      </fieldset>
      <fieldset data-sec="other" ${hide("other")}>
        <legend class="sr-only">${t("挂靠与其他")}</legend>
        <div class="form-grid">
        ${state.properties.length ? `<label>${t("房产")}<select name="property_id"><option value="">${t("与房产无关")}</option>${propertyOptionsHtml(v.property_id, { esc })}</select></label>` : ""}
        ${assetSelectHtml(v.asset_id, state.medEnriched)}
        <label>${t("谁能看到")}<select name="visibility"><option value="private" ${v.visibility === "private" ? "selected" : ""}>🔒 ${t("仅自己和家主可见")}</option><option value="family" ${v.visibility === "family" ? "selected" : ""}>${t("全家可见")}</option></select></label>
        <label class="span-2">${t("备注")}<input name="notes" maxlength="500" value="${d(v.notes)}" placeholder="${t(v.kind === "medical" ? "不要记诊断、保单号全文或身份证号" : "合同要点、联系人…")}"></label>
        </div>
      </fieldset>
      ${peopleFor(v.kind) && (!secQ || secQ === "basic") ? personAddPanel(v.kind) : ""}
      <datalist id="medProviders">${[...new Set(state.medBills.map((x) => x.provider))].map((x) => `<option value="${esc(x)}">`).join("")}</datalist>
      <p id="medBillError" class="form-error" role="alert"></p>
      <div class="form-actions sticky-actions"><button type="submit" class="btn btn-primary">${t("保存")}</button>${b ? `<a class="btn btn-ghost" href="${esc(detailHref("new"))}?copy=${encodeURIComponent(b.id)}">${t("复制为新账单")}</a>` : ""}</div>
    </form>
    ${b && secQ ? "" : b ? paymentsHtml(b, pay, owedNow) : `<p class="muted">${t("先保存账单，再记付款。")}</p>`}
    ${b && !secQ ? `<div class="danger-zone"><button type="button" class="btn btn-danger-ghost" data-action="med-del" data-id="${b.id}">${t("删除这张账单")}</button><small class="muted">${t("连同这张账单的付款记录一起删除，点两次确认。")}</small></div>` : ""}
  </section>`;
}
/* ───────────── 一次性账单详情页：分区卡片（一次滑动看全）+ 付款记录；每块单独「编辑」（?sec=） ───────────── */
const OTL = (zh, en) => (lang === "en" ? en : zh);
   // 字段标签：中英文直接写（这些词在别处的英文含义不同）
function medFacts(b, id) {
  const K = kindOf(b), none = `<span class="muted">${t("未填")}</span>`, c = b.currency;
  const dl = (rows) => `<dl class="fact-grid one">${rows.filter(Boolean).map(([k, val]) => `<div class="fact"><dt>${k}</dt><dd>${val || none}</dd></div>`).join("")}</dl>`;
  const prop = b.property_id ? state.properties.find((p) => p.id === b.property_id) : null, asset = b.asset_id ? state.assets.find((a) => a.id === b.asset_id) : null;
  if (id === "basic") return dl([[t(K.provider), esc(b.provider || "")], [OTL("小类", "Type"), subName(b) ? `${subIcon(b)} ${esc(t(subName(b)))}` : ""], [t(K.who), esc(b.patient || "")], K.guarantor ? [OTL("担保人", "Guarantor"), esc(b.guarantor || "")] : null,
    [OTL("账单号", "Bill #"), esc(b.bill_ref || "")], K.insurance ? [OTL("保险公司", "Insurer"), esc(b.insurer || "")] : null, K.insurance ? [OTL("理赔号", "Claim #"), esc(b.claim_ref || "")] : null]);
  if (id === "amount") return dl([[OTL(b.kind === "medical" || b.kind === "pet" ? "就诊日期" : b.kind === "travel" ? "出发日期" : "服务日期", "Service date"), b.service_date ? esc(fmtDate(b.service_date)) : ""], [OTL("账单日期", "Bill date"), b.bill_date ? esc(fmtDate(b.bill_date)) : ""],
    [OTL("到期日", "Due date"), b.due_on ? esc(fmtDate(b.due_on)) : ""], [t(K.billed), b.billed_amount != null ? mny(b.billed_amount, c) : ""], K.insurance ? [OTL("保险已付", "Insurance paid"), mny(b.insurance_paid || 0, c)] : null,
    num(b.adjustment) ? [OTL("折扣 / 冲减", "Adjustment"), mny(b.adjustment, c)] : null, [t(K.owed), b.owed != null ? mny(b.owed, c) : ""], [OTL("已付", "Paid"), mny(b.paid || 0, c)], [OTL("余额", "Balance"), b.balance != null ? mny(b.balance, c) : ""],
    [OTL("状态", "Status"), `<span class="badge ${STATUS_CLS[b.status] || ""}">${esc(t(STATUS[b.status] || b.status))}</span>`]]);
  return dl([[OTL("房产", "Property"), prop ? esc(prop.name) : t("与房产无关")], (state.assets || []).some((a) => a.kind === "vehicle" || a.kind === "equipment") ? [OTL("关联资产", "Linked asset"), asset ? esc(asset.name) : ""] : null,
    [OTL("谁能看到", "Visible to"), b.visibility === "private" ? `🔒 ${t("仅自己和家主可见")}` : `👪 ${t("全家可见")}`], b.kind === "medical" ? [OTL("HSA / FSA", "HSA / FSA"), b.hsa_eligible ? t("可报销") : t("否")] : null, [OTL("备注", "Notes"), b.notes ? esc(b.notes) : ""]]);
}
const MED_SECS = [{ id: "basic", icon: "🧾", name: "这是什么账单" }, { id: "amount", icon: "💲", name: "金额与日期" }, { id: "other", icon: "📎", name: "挂靠与其他" }];
function medBanner(b, q) {
  const isAi = q.get("ai") === "1", isNew = q.get("new") === "1"; if (!isAi && !isNew) return "";
  const K = kindOf(b), base = detailHref(b.id), missing = [!b.patient && OTL(K.who.split(" ")[0], "Who"), !b.due_on && OTL("到期日", "Due date"), !b.bill_ref && OTL("账单号", "Bill #")].filter(Boolean).slice(0, 3);
  const close = `<a class="btn btn-sm btn-ghost" href="${base}">${t("知道了")}</a>`;
  if (isAi) return `<div class="notice" role="status" style="margin-bottom:12px"><b>✨ ${t("AI 识别创建")}</b> ${t("看一眼就行：不对的地方点下面对应分区的“编辑”改；整张读错了就撤销创建。")}${missing.length ? ` ${t("还没读到：{list}。", { list: missing.join("、") })}` : ""}
    <div class="form-actions" style="margin-top:8px"><button type="button" class="btn btn-sm btn-ghost" data-action="med-del" data-id="${b.id}">${t("撤销创建")}</button>${close}</div></div>`;
  return `<div class="notice" role="status" style="margin-bottom:12px"><b>✅ ${t("已创建")}</b> ${missing.length ? t("这几项还没填：{list}，随时在下面补。", { list: missing.join("、") }) : t("信息都齐了。")}${b.owed != null ? ` ${t("接着可以在下面记付款。")}` : ""}<div class="form-actions" style="margin-top:8px">${close}</div></div>`;
}
function medCardsPage(b, payEdit) {
  const K = kindOf(b), base = detailHref(b.id), c = b.currency;
  const badges = [`<span class="badge ${STATUS_CLS[b.status] || ""}">${esc(t(STATUS[b.status] || b.status))}</span>`, b.due_on ? `<span class="badge" style="background:var(--surface-2)">${esc(t("到期 {d}", { d: fmtDate(b.due_on) }))}</span>` : "",
    b.owed != null ? `<span class="badge" style="background:var(--surface-2)">${t("余额 {a}", { a: mny(b.balance || 0, c) })}</span>` : "", b.visibility === "private" ? `<span class="badge" style="background:var(--surface-2)">🔒 ${t("仅自己和家主可见")}</span>` : ""].filter(Boolean).join("");
  const cards = MED_SECS.map((sec) => `<section class="panel prof-card" aria-labelledby="mc-${sec.id}">
      <header class="prof-head"><span class="mi" aria-hidden="true">${sec.icon}</span><div class="prof-t"><h3 id="mc-${sec.id}">${t(sec.name)}</h3></div>
        <a class="btn btn-sm btn-ghost prof-edit" href="${base}?sec=${sec.id}" aria-label="${esc(t("编辑 {name}", { name: t(sec.name) }))}">${t("编辑")}</a></header>${medFacts(b, sec.id)}</section>`).join("");
  return `<section class="section">
    ${crumbNav([...billScopeParts(b, "onetime"), { label: b.provider, icon: subIcon(b) }])}
    <h2 style="margin:0 0 8px">${subIcon(b)} ${esc(b.provider)}</h2>
    <div class="asset-badges" style="margin-bottom:12px">${badges}</div>
    <div class="form-actions" style="margin:0 0 12px"><a class="btn btn-primary" href="#medPayments">${t("记一笔付款")}</a><span class="spacer"></span>
      <a class="btn btn-sm btn-ghost" href="${esc(detailHref("new"))}?copy=${encodeURIComponent(b.id)}">${t("复制为新账单")}</a></div>
    ${medBanner(b, state.route.q)}
    <div class="prof-grid bill-detail-grid">${cards}</div>
    <div id="medPayments" style="scroll-margin-top:80px">${paymentsHtml(b, payEdit, b.owed)}</div>
    <div class="danger-zone"><button type="button" class="btn btn-danger-ghost" data-action="med-del" data-id="${b.id}">${t("删除这张账单")}</button><small class="muted">${t("连同这张账单的付款记录一起删除，删了找不回来。")}</small></div>
  </section>`;
}
/** 常用的付款方式（存中文标准词，显示时翻译；具体是哪张卡、哪个账户写在备注里）；旧记录里手填的方式保留成一个选项 */
const METHODS = ["信用卡", "借记卡", "HSA 卡", "FSA 卡", "支票", "银行转账（ACH）", "网上支付", "电话支付", "现金", "其他"];
/** 付款方式下拉：先列我的卡 / 账户（选了就记到那张卡上，和花费记录一样），再列通用方式 */
const methodOptions = (edit) => { const cur = edit?.card_id && acctById(edit.card_id) ? edit.card_id : edit?.method || ""; return `${accountOptions(cur, { none: "（未选）", extra: METHODS.map((m) => [m, m]) })}${cur && !METHODS.includes(cur) && !acctById(cur) ? `<option value="${esc(cur)}" selected>${esc(cur)}</option>` : ""}`; };
function paymentsHtml(b, edit, owed) {
  const rows = b.pays.map((p) => `<li class="med-pay${edit?.id === p.id ? " is-editing" : ""}" data-swipe-del="med-pay"><a class="badge pay-date" style="background:var(--surface-2)" href="${detailHref(b.id)}?pay=${p.id}" title="${esc(t("点一下编辑"))}">${esc(fmtDate(p.paid_on))}</a>
      <div class="grow"><a class="link-name name" href="${detailHref(b.id)}?pay=${p.id}" title="${esc(t("点一下编辑"))}">${mny(p.amount, p.currency || b.currency)}</a><small>${[paymentPayLabel(p), p.confirmation_ref ? t("确认号 {ref}", { ref: p.confirmation_ref }) : null, p.notes].filter(Boolean).map(esc).join(" · ")}</small></div>
      <button type="button" class="btn btn-sm btn-ghost swipe-src" data-action="med-pay-del" data-id="${p.id}">${t("删除")}</button></li>`).join("");
  const sumLine = owed == null ? t("还没填自付金额或总额，余额未知") : t("自付 {o} · 已付 {p} · 余额 {b}", { o: mny(owed, b.currency), p: mny(b.paid, b.currency), b: mny(b.balance, b.currency) });
  return `<div class="section-head"><h2>${t("付款记录")}</h2><p>${esc(sumLine)}</p></div>
    <details class="pay-fold" ${edit ? "open" : ""}><summary class="btn btn-primary pay-add"><span class="when-closed">${edit ? `✎ ${t("编辑这笔付款")}` : `＋ ${t("记一笔付款")}`}</span><span class="when-open">${edit ? t("编辑这笔付款") : t("收起")}</span></summary>
    <form id="medPayForm" class="panel" novalidate data-bill="${b.id}" data-id="${d(edit?.id)}">
      <div class="form-grid">
        <label>${t("付款日期 Payment date")}<input name="paid_on" type="date" required value="${d(edit?.paid_on || todayISO())}" max="${todayISO()}"></label>
        <label>${t("金额（{cur}）", { cur: b.currency })}<input name="amount" type="number" inputmode="decimal" min="0.01" step="0.01" required value="${edit ? Math.abs(num(edit.amount)).toFixed(2) : b.balance ? b.balance.toFixed(2) : ""}"></label>
        <label>${t("付款方式 / 账户")}<select name="method">${methodOptions(edit)}</select></label>
        <label>${t("确认号 Confirmation #")}<input name="confirmation_ref" maxlength="60" value="${d(edit?.confirmation_ref)}"></label>
        <label class="check-inline span-2"><input type="checkbox" name="refund" ${edit && num(edit.amount) < 0 ? "checked" : ""}><span>${t("这是退款 / 保险事后理赔")}</span></label>
        <label class="span-2">${t("备注")}<input name="notes" maxlength="500" value="${d(edit?.notes)}" placeholder="${t("例如：网上缴费，Chase 信用卡尾号 1234 / 支票 #1022 / HSA（Fidelity）。卡只写后四位")}"></label>
      </div>
      <p id="medPayError" class="form-error" role="alert"></p>
      <div class="form-actions pay-actions"><button type="submit" class="btn btn-primary">${edit ? t("保存修改") : t("保存这笔付款")}</button>${edit ? `<a class="btn btn-ghost" href="${detailHref(b.id)}">${t("取消")}</a>` : ""}
        <small class="muted">${t(b.kind === "travel" ? "付款会自动并入 花费 的“旅行出行”分类（按小类拆：机票、住宿…）。" : "付款会自动并入 花费 的“医疗”分类。")}</small></div>
    </form></details>
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
  const row = { property_id: fe.property_id?.value || null, asset_id: fe.asset_id?.value || null, kind: fe.kind.value || "medical", subkind: fe.subkind.value || null, provider, patient: fe.patient_id ? (pid ? state.people.find((x) => x.id === pid)?.name || null : optText(fe.patient_id)) : val(fe.patient), patient_id: pid,
    guarantor: fe.guarantor_id ? (gid ? state.people.find((x) => x.id === gid)?.name || null : optText(fe.guarantor_id)) : val(fe.guarantor), guarantor_id: gid, bill_ref: val(fe.bill_ref), claim_ref: val(fe.claim_ref), insurer: val(fe.insurer),
    service_date: fe.service_date.value || null, bill_date: fe.bill_date.value || null, due_on: fe.due_on.value || null, billed_amount: amt(fe.billed_amount), insurance_paid: amt(fe.insurance_paid) ?? 0,
    adjustment: amt(fe.adjustment) ?? 0, patient_amount: amt(fe.patient_amount), currency: cur(), status: fe.status.value, hsa_eligible: !!fe.hsa_eligible?.checked, visibility: fe.visibility.value, notes: val(fe.notes) };
  if (f.dataset.id) { const old = state.medBills.find((x) => x.id === f.dataset.id); if (old?.currency) row.currency = old.currency; }
  try {
    const id = await Store.saveMedicalBill(f.dataset.id ? { ...row, id: f.dataset.id } : row);
    await reloadMedical(); toast(f.dataset.id ? t("已保存修改") : t("已记下这张账单，接着可以记付款"));
    go(detailHref(id), { replace: true }); return true;
  } catch (e) { err.textContent = /(medical_bills|bills_one_time)_kind_check/i.test(e.message) ? t("还没执行数据库迁移 031（一次性账单加“旅行”种类），先在 Supabase 里执行 supabase/migrations/031_travel_bills.sql") : /medical_bills|does not exist|schema cache/i.test(e.message) ? t("还没执行数据库迁移 027（医疗账单表），先在 Supabase 里执行 supabase/migrations/027_medical_bills.sql") : t("保存失败：{msg}", { msg: e.message }); return false; }
}
export async function saveMedPayForm(f) {
  const fe = f.elements, err = $("#medPayError"), amount = amt(fe.amount);
  if (!amount || amount <= 0) { err.textContent = t("请填写大于 0 的金额。"); fe.amount.focus(); return false; }
  const b = state.medEnriched.find((x) => x.id === f.dataset.bill); if (!b) return false;
  const acct = acctById(fe.method.value), old = f.dataset.id ? state.medPayments.find((x) => x.id === f.dataset.id) : null;   // 选了卡 / 账户：card_id 记卡，method 记种类文字（导出 / 旧版本显示用）
  const row = { paid_on: fe.paid_on.value || todayISO(), amount: fe.refund?.checked ? -amount : amount, currency: b.currency, method: acct ? ({ credit: "信用卡", debit: "借记卡", wallet: "网上支付" }[acct.kind] || "银行转账（ACH）") : val(fe.method), confirmation_ref: val(fe.confirmation_ref), notes: val(fe.notes),
    ...(acct || old?.card_id ? { card_id: acct ? acct.id : null } : {}) };
  try {
    if (f.dataset.id) await Store.updateMedicalPayment(f.dataset.id, row); else await Store.addMedicalPayment({ ...row, bill_id: b.id });
    await reloadMedical(); toast(f.dataset.id ? t("已保存修改") : t("已记一笔付款"));
    go(detailHref(b.id), { replace: true }); return true;
  } catch (e) { err.textContent = t("保存失败：{msg}", { msg: e.message }); return false; }
}
export async function deleteMedBill(id) { await Store.deleteMedicalBill(id); await reloadMedical(); toast(t("已删除这张账单")); go(allBillsHref({ type: "onetime" })); }
export async function deleteMedPay(id) { await Store.deleteMedicalPayment(id); await reloadMedical(); toast(t("已删除这笔付款")); }
/** 新建账单时换种类：整页按新种类重画（标签、小类、保险项不同） */
export function onKindPick(e) {
  if (e.target.name !== "kindPick") return;
  go(`${detailHref("new")}?kind=${e.target.value}`, { replace: true });
}
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
export function personMergeOpen(id) { state.personMerge = state.personMerge === id ? null : id; state.personEdit = null; rerender(); }
export function personMergeCancel() { state.personMerge = null; rerender(); }
export async function personMerge(id) {
  const to = document.querySelector(`[data-merge-for="${id}"]`)?.value; if (!to) return toast(t("先选要合并到谁"));
  const from = state.people.find((x) => x.id === id), dest = state.people.find((x) => x.id === to);
  try { await Store.mergePeople(id, to); await reloadMedical(); state.people = await Store.listPeople(); applyMedical(state.medBills, state.medPayments); state.personMerge = null; toast(t("已把“{a}”合并到“{b}”", { a: from.name, b: dest.name })); rerender(); } catch (e) { toast(e.message); }
}
