/* 账单详情的头部卡、记一笔缴费的整页表单、特别摊派下拉、金额分组、补记缴费。 */
import { numAttrs } from "../core/ui-num.js";
import { L, billCostParts, headSec, linkOf } from "./bill-form.js";
import { Store } from "../core/store.js";
import { acctText, billCat } from "./logic.js";
import { assessmentsOf, isPaid, unpaidItems } from "./assessments-lib.js";
import { esc, fmtDate, money, num, stampText, toast, todayISO } from "../core/util.js";
import { fillFromPurchase, purchaseById } from "../core/spend-data.js";
import { href } from "../core/router.js";
import { lang, t } from "../core/i18n.js";
import { moreMenu } from "../core/more-menu.js";
import { state } from "../core/state.js";
import { BADGE, STATUS_LABEL, mny } from "./bill-common.js";
import { PAY_EXTRA, accountOptions, acctById, billPayLabel, payAcctValue, resolvePayAccount } from "./card-picker.js";

/** 详情页顶上的汇总卡：名称（账号尾号）+ 下次到期 + 竖三点菜单；HOA / 服务商小表；付费小表（付费方式、费用总额）；添加 / 更新时间；记缴费大按钮。
 *  底色比下面的分区卡深一点（和 .prof-card 同一套圆角和内边距） */
/** 这张账单属于谁（卡片第一行）：具体资产（设备 / 车辆）> 房产 > 全家共用；账号尾号太不显眼，看这一行就知道 */
function ownerLine(b) {
  const a = b.asset_id && state.assets.find((x) => x.id === b.asset_id), p = !a && b.property_id && state.properties.find((x) => x.id === b.property_id);
  const [icon, name] = a ? [a.kind === "vehicle" ? "🚗" : "🔧", a.name] : p ? ["🏠", p.name] : ["👨‍👩‍👧", t("全家共用")];
  return `<p class="bh-owner${a || p ? "" : " is-shared"}"><span aria-hidden="true">${icon}</span> ${esc(name)}</p>`;
}
export function billHeadCard(b, base, { listed = false } = {}) {   // listed = 放在清单 / 滑动卡里：标「周期性」，删除按这张账单的 id（不是当前页面的）
  const cat = billCat(b.category), isHoa = b.category === "hoa", prop = b.property_id ? state.properties.find((p) => p.id === b.property_id) : null, hoa = isHoa && prop?.hoa ? prop.hoa : null;
  const due = b.status !== "ok" && b.status !== "none" ? `<span class="badge ${BADGE[b.status]}">${t(STATUS_LABEL[b.status])}${b.next_due_on ? ` · ${fmtDate(b.next_due_on)}` : ""}</span>`
    : b.next_due_on ? `<span class="badge b-ok">${t("下次到期 {d}", { d: fmtDate(b.next_due_on) })}</span>` : "";
  const menu = moreMenu([
    { label: t("详情"), href: `${base}?sec=detail`, first: true },
    { label: b.autopay ? t("记核对") : t("记缴费"), href: `${base}?pay=1` },
    { label: t("缴费记录"), href: `${base}?sec=pay` },
    { label: t("特别摊派"), href: `${base}?sec=assess` },
    b.pay_url ? { label: t("去服务商缴费"), href: b.pay_url, external: true } : null,
    { label: t("复制"), href: `${href("bill", "new")}?copy=${encodeURIComponent(b.id)}` },
    { label: t("删除"), action: "bill-delete", ...(listed ? { data: { id: b.id } } : {}), danger: true },
  ], listed ? { label: `${b.name} · ${t("更多操作")}` } : {});
  // HOA 账单：公司 / 联系方式 / 网站读房屋资料里的 HOA（只存一份）；其他账单：收款方 + 缴费网站 + 登录提示
  const emails = (hoa?.email || "").split(/[;,，；]/).map((x) => x.trim()).filter(Boolean);
  const contact = hoa ? [hoa.phone ? `<a href="tel:${esc(hoa.phone.replace(/[^\d+]/g, ""))}">${esc(hoa.phone)}</a>` : "", ...emails.map((e) => `<a href="mailto:${esc(e)}">${esc(e)}</a>`)].filter(Boolean).join("<br>") : "";
  const provider = isHoa && hoa
    ? headSec("HOA", [[L("HOA 公司", "HOA"), esc([hoa.name, hoa.mgmt].filter(Boolean).join(" · "))], [L("联系方式", "Contact"), contact], [L("官网 / 缴费网站", "Website"), linkOf(b.pay_url || hoa.url)]])
    : headSec(isHoa ? "HOA" : t("服务商"), [[L("收款方", "Payee"), esc(b.payee || "")], [L("官网 / 缴费网站", "Website"), linkOf(b.pay_url)], [L("登录提示", "Login hint"), b.login_hint ? `<span class="nolink">${esc(b.login_hint)}</span>` : ""]]);
  const method = b.autopay ? `${t("自动扣款")}${billPayLabel(b) ? ` · ${esc(billPayLabel(b))}` : ""}` : `${t("手动缴费")}${billPayLabel(b) ? ` · ${esc(billPayLabel(b))}` : ""}`;
  const cost = billCostParts(b);
  const formula = cost.parts.length > 1 ? `<small class="bh-formula">= ${cost.parts.map((x) => `${mny(x.amount, b.currency)} (${esc(x.k)})`).join(" + ")}</small>` : cost.parts.length ? `<small class="bh-formula">${esc(cost.parts[0].k)}${b.est != null && cost.parts[0].k === t("估算") ? ` · ${t("按最近均值")}` : ""}</small>` : "";
  const total = cost.parts.length ? `<b class="bh-total">${mny(cost.total, b.currency)}<span> / ${cost.per}</span></b>${formula}` : "";
  const monthly = b.monthly && b.frequency !== "monthly" ? t("折合每月 {m}", { m: money(b.monthly) }) : "";
  const pay = headSec(t("付费"), [[L("付费方式", "Method"), method], [L("费用总额", "Total"), total], [L("折合每月", "Per month"), esc(monthly)]]);
  return `<section class="panel bill-head${listed ? " is-open-card" : ""}" aria-label="${esc(t("账单概要"))}"${listed ? ` data-row-open="${esc(`${base}?sec=detail`)}"` : ""}>
    ${ownerLine(b)}
    <div class="bh-top"><span class="mi" aria-hidden="true">${cat.icon}</span>
      <div class="bh-t"><h2>${esc(b.name)}${b.account_last4 ? `<span class="bh-acct">（**${esc(b.account_last4)}）</span>` : ""}</h2>${listed ? `<span class="badge">${t("周期性")}</span>` : ""}${due}${b.priceUp ? `<span class="badge b-low">${t("涨价了")}</span>` : ""}</div>${menu}</div>
    ${provider}${pay}
    ${stampText(b) ? `<p class="record-meta bh-stamp">${esc(stampText(b))}</p>` : ""}
    <a class="ui-btn bh-pay" data-tone="primary" href="${base}?pay=1">${b.autopay ? t("记核对") : t("记缴费")}</a>
  </section>`;
}
export function payFormPage(b, edit = null, isCopy = false, settleId = null) {   // settleId：一次性结清某笔摊派（预先勾上它所有没缴的期）   // isCopy：edit 是「复制」带入的值（没有 id），标题和说明按新记一笔写
  const v = edit || {};   // 编辑某条记录时表单带入它的值
  // 账户下拉的当前值：编辑时按这条记录（卡 / 现金 / 支票 / 手填）；新记一笔按账单的付款账户
  const payVal = edit ? (edit.card_id ? edit.card_id : edit.method === "支票" ? "check" : payAcctValue(null, edit.method)) : (b.pay_card_id ? b.pay_card_id : payAcctValue(null, b.autopay_method));
  const linked = edit?.purchase_id ? purchaseById(edit.purchase_id) : null;   // 这条缴费记的花费：收款方存在它上面（按 id 读这一笔）
  if (edit?.purchase_id && !linked) fillFromPurchase(edit.purchase_id, '#billPayForm [name="store"]', (p) => p.store);   // 还没读回来：读到后填进收款方（没改过的话）
  const settleA = !edit && settleId ? assessmentsOf(b.id, state.assess, state.assessItems).find((x) => x.id === settleId) : null, settleLeft = settleA ? settleA.rows.filter((x) => !isPaid(x)) : [];
  return `
    <div class="section-head"><h2>${edit && !isCopy ? t("编辑缴费记录") : settleA ? t("一次性结清") : b.autopay ? t("记核对") : t("记缴费")}</h2><p>${acctText(b) ? `${esc(acctText(b))} · ` : ""}${edit && !isCopy ? t("改这条记录；不会动下次到期日") : t("记一笔后下次到期日自动推到下一期")}</p></div>
    ${settleA && settleLeft.length ? `<p class="panel muted" role="status">${t("一次性结清「{n}」：已勾上它所有没缴的 {c} 期，合计 {m}（金额不能改）。提交后这些期合并成一行“一次性结清”。本期金额已填 0（只交摊派）；要一起交本期，改成实际金额。", { n: esc(settleA.name), c: settleLeft.length, m: mny(settleA.remaining, b.currency) })}</p>` : ""}
    <form id="billPayForm" class="panel" data-focus="1" data-cur="${esc(b.currency || "")}">
      ${settleA && settleLeft.length ? `<input type="hidden" name="settle_assessment" value="${esc(settleA.id)}">` : ""}
      <input type="hidden" name="bill_id" value="${esc(b.id)}"><input type="hidden" name="pay_id" value="${esc(edit?.id || "")}">
      <div class="form-grid maint-grid">
        <label>${t("缴费日期")}<input name="paid_on" type="date" required value="${esc(edit ? edit.paid_on || "" : todayISO())}" max="${todayISO()}"></label>
        <label>${t("对应到期日")}<input name="due_on" type="date" value="${esc(edit ? edit.due_on || "" : b.next_due_on || "")}"></label>
        ${amountGroup(b, edit, settleId)}
        <label>${t("状态")}<select name="status"><option value="paid" ${edit?.status === "paid" ? "selected" : ""}>${t("已缴费")}</option><option value="verified" ${edit ? (edit.status === "verified" ? "selected" : "") : b.autopay ? "selected" : ""}>${t("已核对（自动扣款）")}</option><option value="skipped" ${edit?.status === "skipped" ? "selected" : ""}>${t("跳过这期")}</option></select></label>
        <label>${t("用哪张卡 / 账户")}<select name="pay_account" data-pay-acct>${accountOptions(payVal, { none: "（未指定）", extra: PAY_EXTRA })}</select></label>
        <label data-pay-other ${payVal === "other" ? "" : "hidden"}>${t("方式说明")}<input name="method" maxlength="40" placeholder="${t("例如：网银 / 支票 #1023 / 自动扣款")}" value="${esc(edit ? edit.method || "" : b.autopay_method || "")}"></label>
        <label>${t("收款方")}<input name="store" maxlength="40" value="${esc(edit ? (linked?.store || b.payee || b.name || "") : b.payee || b.name || "")}" placeholder="${esc(b.payee || b.name)}"><small>${edit ? t("只改这一条；中途换了收款方，旧记录保留当时的名字。") : t("没填就用账单的收款方。")}</small></label>
        <label>${t("确认号")}<input name="confirmation_ref" maxlength="60" value="${esc(edit?.confirmation_ref || "")}"></label>
        <label class="span-2">${t("备注")}<input name="notes" maxlength="500" value="${esc(edit?.notes || "")}"></label>
      </div>
      <p class="muted" style="margin:10px 0 0;font-size:13px">${edit && !isCopy ? t("金额改了，花费统计里对应的那笔也会跟着改。") : t("有金额的记录会同时记入花费统计的“账单”组。")}</p>
      <div class="ui-acts ui-acts-split sticky-actions">
        <button type="button" class="ui-btn" data-tone="ghost" data-action="billpay-cancel">${t("取消")}</button>
        <button type="submit" class="ui-btn" data-tone="primary">${edit ? t("保存修改") : t("记一笔")}</button></div>
    </form>`;
}
/** 缴费表单里勾选的摊派期：{ ids, sum } */
export const checkedItems = (fe) => { const all = fe.as_item ? (fe.as_item.length === undefined ? [fe.as_item] : [...fe.as_item]) : []; const on = all.filter((x) => x.checked); return { ids: on.map((x) => x.value), sum: Math.round(on.reduce((s, x) => s + num(x.dataset.amt), 0) * 100) / 100 }; };
/** 摊派下拉（多选）：本期之前到期的没缴期默认勾上，其余不勾；编辑时本笔已交的勾着。没有可选的期就不出现 */
function assessDropdown(b, edit, settleId = null) {
  const own = edit ? state.assessItems.filter((x) => x.payment_id === edit.id) : [];
  const open = unpaidItems(b.id, state.assess, state.assessItems);
  const multi = state.assess.filter((a) => a.bill_id === b.id).length > 1, byA = new Map(assessmentsOf(b.id, state.assess, state.assessItems).map((a) => [a.id, a]));
  // 每个选项一行：「第 N 期 · 日期 · 金额」（一次性结清写「一次性结清」）；有多笔摊派时前面加摊派名
  const asLabel = (x) => { const a = byA.get(x.assessment_id), nth = a ? a.rows.findIndex((r) => r.id === x.id) + 1 : 0; return [multi && a ? a.name : null, x.kind === "payoff" ? t("一次性结清") : t("第 {n} 期", { n: nth }), fmtDate(x.due_on), mny(x.amount, b.currency)].filter(Boolean).join(" · "); };
  const rows = [...own.map((x) => [x, true]), ...open.map((x) => [x, !!settleId && x.assessment_id === settleId])].sort((p, q) => (p[0].due_on || "").localeCompare(q[0].due_on || ""));
  if (!rows.length) return "";
  const on = rows.filter(([, c]) => c), sum = Math.round(on.reduce((s, [x]) => s + num(x.amount), 0) * 100) / 100;
  return `<div class="amt-row amt-as"><span class="amt-l">${t("特别摊派")}</span>
    <details class="pick amt-pick"><summary><span class="pick-val ${on.length ? "" : "is-empty"}" id="asSummary">${asSummaryText(on.length, sum, b.currency)}</span></summary>
      <div class="pick-panel" role="group" aria-label="${esc(t("这次交的特别摊派"))}"><button type="button" class="pick-row as-none" data-as-none>${t("未勾选")} <small class="muted">${t("这次不交摊派")}</small></button>${rows.map(([x, c]) => `<label class="pick-row check-inline"><input type="checkbox" name="as_item" value="${esc(x.id)}" data-amt="${num(x.amount)}" ${c ? "checked" : ""}><span class="as-opt">${esc(asLabel(x))}</span></label>`).join("")}</div></details></div>`;
}
const asSummaryText = (n, sum, cur) => (n ? t("{n} 期 · {m}", { n, m: mny(sum, cur) }) : t("未勾选"));
/** 点开下拉：有勾选的，列表滚到第一个勾选的那一期；没勾选的，从第一期往下 */
document.addEventListener("toggle", (e) => { const d = e.target; if (!d.matches?.("details.amt-pick") || !d.open) return; const panel = d.querySelector(".pick-panel"), first = panel.querySelector("input[name=as_item]:checked")?.closest(".pick-row"); panel.scrollTop = first ? Math.max(0, first.offsetTop - panel.offsetTop - 4) : 0; }, true);
document.addEventListener("click", (e) => { const b = e.target.closest?.("[data-as-none]"); if (!b) return; const f = b.closest("form"); f.querySelectorAll("input[name=as_item]").forEach((x) => { x.checked = false; }); recalcPayTotal(f); });
/** 缴费表单的「金额」一组：本期金额（HOA 拆成单元费 + 车位费）+ 滞纳金 + 手续费 + 税 + 特别摊派 = 总金额（实时加好） */
function amountGroup(b, edit, settleId = null) {
  const cur = b.currency || Units.region.currency, n2 = (x) => num(x).toFixed(2);
  const split = edit ? edit.unit_amount != null || edit.parking_amount != null : b.unit_amount != null || b.parking_amount != null;   // 老记录没拆过就保持一个金额
  const base = edit ? (edit.amount != null ? n2(edit.amount) : "") : settleId ? "0.00" : b.est != null ? n2(b.est) : "";   // 一次性结清：本期金额默认 0（只交摊派）
  const inp = (name, val, hint = "") => `<input name="${name}" ${numAttrs("money")} value="${val}" data-amt-in aria-label="${esc(hint)}">`;
  const row = (label, input) => `<label class="amt-row"><span class="amt-l">${label}</span>${input}</label>`;
  const baseRows = split
    ? row(`${t("单元费")}${lang === "en" ? "" : " <small>Unit</small>"}`, inp("unit_amount", edit ? n2(edit.unit_amount) : n2(b.unit_amount), t("单元费"))) + row(`${t("车位费")}${lang === "en" ? "" : " <small>Parking</small>"}`, inp("parking_amount", edit ? n2(edit.parking_amount) : n2(b.parking_amount), t("车位费"))) + `<div class="amt-row amt-sub"><span class="amt-l">${t("HOA 小计")} <small>${t("单元费 + 车位费")}</small></span><b id="paySub">${mny(edit ? num(edit.unit_amount) + num(edit.parking_amount) : num(b.unit_amount) + num(b.parking_amount), cur)}</b></div><input type="hidden" name="amount" value="${edit ? n2(edit.amount) : n2(num(b.unit_amount) + num(b.parking_amount))}">`
    : row(b.amount_type === "fixed" ? t("固定金额") : t("本期金额"), inp("amount", base, t("本期金额")));
  const hint = edit ? "" : `<p class="muted amt-hint">${b.amount_type === "fixed" && b.typical_amount != null ? t("本期按固定金额 {a}；实际不一样就改上面的金额。", { a: mny(b.typical_amount, b.currency) }) : b.est != null ? t("本期预估 {a}（最近几次的均值）；填实际金额，这一期就变成真实数字。", { a: mny(b.est, b.currency) }) : t("还没有历史金额可估：填这次的实际金额。")}</p>
      ${b.amount_type === "fixed" ? `<label class="check-inline amt-upd"><input type="checkbox" name="update_typical" checked><span>${t("实际金额和通常金额不同时，用这次的金额更新通常金额")}</span></label>` : ""}`;
  return `<fieldset class="span-2 amt-group" data-split="${split ? 1 : 0}"><legend>${t("金额（{cur}）", { cur })}</legend>
    ${baseRows}
    ${row(t("滞纳金"), inp("late_fee", edit ? n2(edit.late_fee) : "0", t("滞纳金")))}
    ${row(t("手续费"), inp("fee_amount", edit ? n2(edit.fee_amount) : b.typical_fee != null ? n2(b.typical_fee) : "0", t("手续费")))}
    ${row(t("税"), inp("tax_amount", edit ? n2(edit.tax_amount) : b.typical_tax != null ? n2(b.typical_tax) : "0", t("税")))}
    ${assessDropdown(b, edit, settleId)}
    <div class="amt-total" role="status"><span>${t("总金额")}</span><b id="payTotal">${mny(0, cur)}</b></div>
    ${hint}</fieldset>`;
}
/** 表单里改了任何一项：重算总金额（HOA 拆分时本期金额 = 单元费 + 车位费），并更新摊派下拉上的摘要 */
export function recalcPayTotal(form) {   // 第一次由 main.js 在页面画好后调用一次
  const el = (n) => form.elements[n], v = (n) => (el(n) && el(n).type !== "checkbox" ? num(el(n).value) : 0), split = form.querySelector(".amt-group")?.dataset.split === "1";
  const base = split ? Math.round((v("unit_amount") + v("parking_amount")) * 100) / 100 : v("amount");
  if (split && el("amount")) el("amount").value = base.toFixed(2);
  const sub = form.querySelector("#paySub"); if (sub) sub.textContent = Units.money(base, form.dataset.cur || undefined);   // HOA 小计 = 单元费 + 车位费
  const as = checkedItems(form.elements), status = el("status")?.value, total = status === "skipped" ? 0 : Math.round((base + v("late_fee") + v("fee_amount") + v("tax_amount") + as.sum) * 100) / 100;
  const out = form.querySelector("#payTotal"); if (out) out.textContent = Units.money(total, form.dataset.cur || undefined);
  const sm = form.querySelector("#asSummary"); if (sm) { sm.textContent = asSummaryText(as.ids.length, as.sum, form.dataset.cur || undefined); sm.classList.toggle("is-empty", !as.ids.length); }
}
document.addEventListener("input", (e) => { const f = e.target.closest?.("#billPayForm"); if (f) recalcPayTotal(f); });
document.addEventListener("change", (e) => { const f = e.target.closest?.("#billPayForm"); if (f) recalcPayTotal(f); });
/** 旧缴费记录没记账户时，列表页顶上的「一次性补上」提示 */
export const staleNotice = (b) => { const stale = backfillable(b); return stale.length ? `<div class="notice" role="status" style="margin-top:10px"><b>${t("有 {n} 条旧缴费记录没记账户。", { n: stale.length })}</b> ${t("按现在的付款账户 {a} 一次性补上？花费统计里对应的那几笔也会记到这张卡。现金 / 支票的不动。", { a: billPayLabel(b) })} <button type="button" class="ui-btn" data-size="sm" data-action="billpay-backfill" data-id="${b.id}">${t("补上")}</button></div>` : ""; };
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
