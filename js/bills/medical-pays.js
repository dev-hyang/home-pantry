/* 一次性账单的缴费：首页的「缴费记录」区（行格式和周期性账单一样：点一下编辑，⋯ / 长按有 编辑、复制、删除；空的时候区里有「记一笔缴费」）
 * 和缴费的独立页（?pay=new | <缴费 id>，&copy=<缴费 id> 是复制）。保存逻辑在 medical-views.js 的 saveMedPayForm。 */
import { payBody, payRowHtml } from "./pay-row-fmt.js";
import { crumbNav } from "../core/hub.js";
import { esc, fmtDate, num, todayISO } from "../core/util.js";
import { t } from "../core/i18n.js";
import { billScopeParts } from "./trail.js";
import { detailHref, subIcon } from "./medical.js";
import { accountOptions, acctById, paymentPayLabel } from "./card-picker.js";

const mny = (v, c) => (v == null ? "—" : Units.money(num(v), c || Units.region.currency));
const d = (x) => esc(x ?? "");

/** 常用的付款方式（存中文标准词，显示时翻译；具体是哪张卡、哪个账户写在备注里）；旧记录里手填的方式保留成一个选项 */
const METHODS = ["信用卡", "借记卡", "HSA 卡", "FSA 卡", "支票", "银行转账（ACH）", "网上支付", "电话支付", "现金", "其他"];
/** 付款方式下拉：先列我的卡 / 账户（选了就记到那张卡上，和花费记录一样），再列通用方式 */
const methodOptions = (edit) => { const cur = edit?.card_id && acctById(edit.card_id) ? edit.card_id : edit?.method || ""; return `${accountOptions(cur, { none: "（未选）", extra: METHODS.map((m) => [m, m]) })}${cur && !METHODS.includes(cur) && !acctById(cur) ? `<option value="${esc(cur)}" selected>${esc(cur)}</option>` : ""}`; };

/** 一行缴费：日期（点一下编辑）+ 方式 / 确认号 / 备注 + 金额；电脑右键、手机长按有 编辑、复制、删除 */
function payRow(b, p) {
  const edit = `${detailHref(b.id)}?pay=${encodeURIComponent(p.id)}`, refund = num(p.amount) < 0;
  const items = [{ label: t("编辑"), href: edit, first: true }, { label: t("复制"), href: `${detailHref(b.id)}?pay=new&copy=${encodeURIComponent(p.id)}` }, { label: t("删除"), action: "med-pay-del", data: { id: p.id }, danger: true }];
  const badge = `<span class="badge ${refund ? "b-low" : "b-ok"}">${esc(t(refund ? "退款" : "已缴费"))}</span>`;
  return payRowHtml({ edit, hitTitle: t("点一下编辑"), body: payBody({ date: fmtDate(p.paid_on), badge, meta: [paymentPayLabel(p), p.confirmation_ref ? t("确认号 {ref}", { ref: p.confirmation_ref }) : null].filter(Boolean).map(esc), note: p.notes ? esc(p.notes) : "" }),
    total: `<b class="pay-total${refund ? " ot-neg" : ""}" title="${esc(t("金额"))}">${mny(p.amount, p.currency || b.currency)}</b>`, items, lpTitle: fmtDate(p.paid_on), swipe: "med-pay", del: { action: "med-pay-del", id: p.id, label: t("删除") }, delLabel: t("删除这条记录") });
}

/** 首页的缴费记录区：有记录 = 列表；没有 = 提示 + 「记一笔缴费」按钮（页面上唯一的这个按钮；有记录后从卡片 ⋯ → 缴费进） */
export function paymentsSection(b) {
  const sum = b.owed == null ? t("还没填自付金额或总额，余额未知") : t("自付 {o} · 已付 {p} · 余额 {b}", { o: mny(b.owed, b.currency), p: mny(b.paid, b.currency), b: mny(b.balance, b.currency) });
  const body = b.pays.length ? `<ul class="restock-list pay-list">${b.pays.map((p) => payRow(b, p)).join("")}</ul>`
    : `<div class="empty"><strong>${t("还没有缴费记录")}</strong><p><a class="btn btn-primary" href="${detailHref(b.id)}?pay=new">${t("记一笔缴费")}</a></p></div>`;
  return `<div class="section-head"><h2>${t("缴费记录")}</h2><p>${esc(sum)}</p></div>
    <div class="panel">${body}</div>`;
}

/** 缴费的独立页：新记 / 编辑 / 复制（复制 = 带入那笔的金额和方式，日期改成今天） */
export function medPayPage(b, edit, copyFrom = null) {
  const src = edit || copyFrom, isCopy = !edit && !!copyFrom;
  const title = edit ? t("编辑缴费记录") : isCopy ? t("复制缴费记录") : t("记一笔缴费");
  const amountVal = src ? Math.abs(num(src.amount)).toFixed(2) : b.balance ? b.balance.toFixed(2) : "";
  return `<section class="section form-page">
    ${crumbNav([...billScopeParts(b, "onetime"), { href: detailHref(b.id), label: b.provider, icon: subIcon(b) }, { label: title }])}
    <form id="medPayForm" class="panel" novalidate data-bill="${b.id}" data-id="${d(edit?.id)}">
      <div class="form-grid">
        <label>${t("缴费日期 Payment date")}<input name="paid_on" type="date" required value="${d(edit?.paid_on || todayISO())}" max="${todayISO()}"></label>
        <label>${t("金额（{cur}）", { cur: b.currency })}<input name="amount" type="number" inputmode="decimal" min="0.01" step="0.01" required value="${amountVal}"></label>
        <label>${t("付款方式 / 账户")}<select name="method">${methodOptions(src)}</select></label>
        <label>${t("确认号 Confirmation #")}<input name="confirmation_ref" maxlength="60" value="${d(edit?.confirmation_ref)}"></label>
        <label class="check-inline span-2"><input type="checkbox" name="refund" ${src && num(src.amount) < 0 ? "checked" : ""}><span>${t("这是退款 / 保险事后理赔")}</span></label>
        <label class="span-2">${t("备注")}<input name="notes" maxlength="500" value="${d(src?.notes)}" placeholder="${t("例如：网上缴费，Chase 信用卡尾号 1234 / 支票 #1022 / HSA（Fidelity）。卡只写后四位")}"></label>
      </div>
      <p id="medPayError" class="form-error" role="alert"></p>
      <p class="muted" style="margin:10px 0 0;font-size:13px">${t(b.kind === "travel" ? "付款会自动并入 花费 的“旅行出行”分类（按小类拆：机票、住宿…）。" : "付款会自动并入 花费 的“医疗”分类。")}</p>
      <div class="form-actions form-actions-split sticky-actions">
        <a class="btn btn-ghost" href="${esc(detailHref(b.id))}">${t("取消")}</a>
        <button type="submit" class="btn btn-primary">${edit ? t("保存修改") : t("记一笔")}</button></div>
    </form></section>`;
}
