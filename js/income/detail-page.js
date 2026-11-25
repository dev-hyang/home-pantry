/* 收入详情页（#/bills/income?tab=records&view=<id>）和编辑页（&form=<id>）：只读分块，每块右上角有自己的「编辑」（去编辑页，光标放到那一块的第一个格子）。
 * 入口：收入明细的点行 / 长按菜单「详情」「编辑」。还款（借款）那一块里可以直接记还款、删还款。 */
import { numAttrs } from "../core/ui-num.js";
import { esc, fmtDay, todayISO } from "../core/util.js";
import { CHANNELS, inc, kindLabel, kindOf, memberLabel, personName, repayState } from "./logic.js";
import { splitRecord } from "../core/income-taxonomy.js";
import { recCrumb } from "../core/rec-crumb.js";
import { moreMenu } from "../core/more-menu.js";
import { dtBlock, dtRow } from "../core/detail-ui.js";
import { debtHref } from "../bills/debt-logic.js";
import { formHtml } from "./record-form.js";
import { incFormHref, incomeHref, fmtMoney, acctShow } from "./shared.js";
import { state } from "../core/state.js";
import { href } from "../core/router.js";
import { t } from "../core/i18n.js";
import { canEdit } from "./records-tab.js";

const crumb = (label) => recCrumb("income", incomeHref("records"), label);
const find = (id) => inc().rec.find((r) => r.id === id);
const missing = () => `<section class="section">${crumb(t("详情"))}<div class="panel empty"><strong>${t("找不到这笔收入")}</strong><p><a class="ui-btn" data-size="sm" href="${incomeHref("records")}">${t("回到收入明细")}</a></p></div></section>`;

/** 还款（借款）这一块的内容：总额 / 已还 / 还差、还款记录、记一笔还款的小表单 */
function repayRows(r, s) {
  const sums = t("总额 {a}，已还 {b}，还差 {c}", { a: fmtMoney(s.total), b: fmtMoney(s.paid), c: fmtMoney(s.left) });
  if (s.debt) return [dtRow(t("已转为借款"), `${esc(sums)}<p style="margin:6px 0 0"><a class="ui-btn" data-size="sm" href="${esc(debtHref(s.debt))}">${t("去借贷里记还款")} ›</a></p>`)];
  const reps = inc().rep.filter((p) => p.record_id === r.id).sort((a, b) => b.paid_on.localeCompare(a.paid_on));
  const list = `<ul class="ix-reps">${reps.map((p) => `<li><span>${p.paid_on} · <b>${fmtMoney(p.amount)}</b>${p.method ? ` · ${esc(p.method)}` : ""}${p.purchase_id ? ` · <span class="muted">${t("已计入花费")}</span>` : ""}</span>${canEdit(r) ? `<button type="button" class="ui-btn" data-size="sm" data-tone="ghost" data-inc="rep-del" data-id="${p.id}">${t("删除")}</button>` : ""}</li>`).join("") || `<li class="muted">${t("还没有还款记录")}</li>`}</ul>`;
  const form = s.left > 0 && canEdit(r) ? `<form data-inc-form="repay" data-id="${r.id}" class="form-grid" style="margin-top:6px"><label>${t("还款日期")}<input type="date" name="paid_on" value="${todayISO()}" max="${todayISO()}" required></label><label>${t("金额")}<input ${numAttrs("money", { min: 0.01 })} name="amount" value="${s.left}" required></label><label>${t("方式")}<input name="method" maxlength="40" placeholder="Zelle / ${esc(t("现金"))}"></label><label class="check-inline" style="grid-column:1/-1"><input type="checkbox" name="as_spend" checked><span>${t("同时记为一笔花费（钱从账户里出去了）")}</span></label><small class="muted" style="grid-column:1/-1">${t("如果这笔转账已经从银行对账单导入成花费了，系统会发现并不再重复记；也可以取消勾选。")}</small><div class="form-actions"><button class="ui-btn" data-size="sm" data-tone="primary">${t("记一笔还款")}</button></div></form>` : "";
  return [dtRow(t("还款（还给对方）"), esc(sums)), r.repay_due_on ? dtRow(t("还款到期日"), esc(fmtDay(r.repay_due_on))) : "", dtRow(t("还款记录"), list + form)];
}

export function incomeDetailPage(id) {
  const r = find(id); if (!r) return missing();
  const s = repayState(r), sp = splitRecord(r), k = kindOf(r.kind), ed = (sec) => (canEdit(r) ? incFormHref(r.id, sec) : "");
  const who = r.person_id ? personName(r.person_id) : "", acct = acctShow(r), chan = CHANNELS.find((c) => c[0] === r.channel)?.[1];
  const basic = dtBlock(t("基本信息"), ed("basic"), [dtRow(t("到账日期"), esc(fmtDay(r.received_on))), dtRow(t("到账金额"), `<b>+${fmtMoney(r.amount)}</b>`),
    sp.cap ? dtRow(t("统计口径"), esc(t("认定收入 {a}，资本流入 {b}", { a: fmtMoney(sp.income), b: fmtMoney(sp.cap) }))) : "",
    dtRow(t("付款方"), esc(r.source_name)), dtRow(t("类型"), `${k.icon} ${esc(kindLabel(r.kind))}`), dtRow(t("收款方式"), chan ? esc(t(chan)) : "")]);
  const prop = r.property_id ? (state.properties || []).find((x) => x.id === r.property_id) : null;
  const owner = dtBlock(t("账户与归属"), ed("acct"), [dtRow(t("这是谁的收入"), esc(who)), dtRow(t("入到哪个账户"), esc(acct || "")),
    prop ? dtRow(t("关联房产"), `<a href="${href("house", "overview")}?prop=${esc(prop.id)}">🏠 ${esc(prop.name)} ›</a>`) : ""]);
  const fx = r.orig_amount || r.fee != null ? dtBlock(t("国际电汇 / 外币"), ed("fx"), [r.orig_amount ? dtRow(t("汇出金额（原币种）"), esc(`${r.orig_amount} ${r.orig_currency || ""}`)) : "", r.fee != null ? dtRow(t("手续费"), fmtMoney(r.fee)) : ""]) : "";
  const repay = s ? dtBlock(t("借款 / 还款"), ed("repay"), repayRows(r, s)) : "";
  const by = r.created_by && r.created_by !== state.user?.id && memberLabel(r.created_by) ? t("{n} 记的", { n: memberLabel(r.created_by) }) : "";
  const note = dtBlock(t("备注与来源"), ed("notes"), [dtRow(t("备注"), esc(r.notes || "")), r.import_batch ? dtRow(t("来源"), esc(t("银行导入"))) : "", by ? dtRow(t("记录人"), esc(by)) : ""]);
  const menu = canEdit(r) ? `<div class="head-acts">${moreMenu([{ label: t("复制"), data: { inc: "copy", id: r.id }, first: true }, { label: t("删除"), data: { inc: "del", id: r.id }, danger: true }])}</div>` : "";
  return `<section class="section">${crumb(r.source_name)}<div class="section-head"><div class="sh-title"><h2>${k.icon} ${esc(r.source_name)}</h2><p>${esc(fmtDay(r.received_on))}</p></div>${menu}</div>${basic}${owner}${fx}${repay}${note}</section>`;
}

/** 编辑页：只有一张表单；找不到（被删了 / 没权限）给提示 */
export function incomeFormPage(id) {
  const I = inc();
  if (id === "new") {   // 记一笔 / 复制：form 已经由点击处设好（复制带内容）；直接打开网址时是空白的新一笔
    const pk = state.route?.q?.get("kind");   // 税务页「＋ 国际电汇 / 个人赠与」：带类型进来就预选；每次新进都从头来
    if (pk && I._newRoute !== state.route) { I.form = { rec: { kind: pk } }; I._newRoute = state.route; }
    if (!I.form || I.form.rec?.id) I.form = { rec: null };
    I._formPage = true;
    return `<section class="section form-page">${crumb(I.form.rec ? t("复制收入") : t("记一笔收入"))}${formHtml()}</section>`;
  }
  const r = find(id);
  if (!r || !canEdit(r)) return missing();
  if (I.form?.rec?.id !== id) I.form = { rec: r };
  I._formPage = true;
  return `<section class="section form-page">${crumb(t("编辑收入"))}${formHtml()}</section>`;
}
