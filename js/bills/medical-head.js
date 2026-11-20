/* 一次性账单首页的综合信息卡（和周期性账单的 .bill-head 同一套样式）：
 *  第一行 图标 + 机构 + 状态 / 私密徽标 + 右上角 ⋯（详情、缴费、复制、删除）；
 *  下面几行一眼看全：账单（患者 · 账单号）、日期（就诊 / 账单 / 到期）、保险（公司 · 计划类型 · 理赔状态 · 理赔号）、
 *  金额「应付 / 已付 / 余额」+ 进度条 + 一行算式（总额 − 保险 − 冲减）。要看全部细节点 ⋯ → 详情。 */
import { dots } from "../core/dots.js";
import { esc, fmtDate, num } from "../core/util.js";
import { lang, t } from "../core/i18n.js";
const L = (zh, en) => (lang === "en" ? en : zh);   // 这几个词在别处的英文含义不同（账单 = Bills、到期 = ends），直接按语言写
import { moreMenu } from "../core/more-menu.js";
import { PLAN_TYPES, STATUS, STATUS_CLS, detailHref, kindOf, subIcon } from "./medical.js";

const mny = (v, c) => (v == null ? "—" : Units.money(num(v), c || Units.region.currency));
/** 一行：左边标签，右边一串条目（items）；放不下就从「·」处整条换到下一行，靠右对齐 */
const line = (label, items) => { const v = dots(items); return v ? `<div class="oh-line"><span>${esc(label)}</span><span class="oh-val dots r">${v}</span></div>` : ""; };

/** 保险那一行：公司 · 计划类型 · 理赔状态 · 理赔号（保险是每张账单自己的信息，所以写在账单上） */
function insuranceItems(b) {
  const claimed = b.status !== "awaiting_insurance" && (num(b.insurance_paid) > 0 || !!b.claim_ref);
  const state = b.status === "awaiting_insurance" ? `<span class="badge b-soon">${esc(t("等理赔"))}</span>` : claimed ? `<span class="badge b-ok">${esc(t("已理赔"))}</span>` : "";
  return [esc(b.insurer || ""), b.plan_type ? esc(PLAN_TYPES[b.plan_type] ? t(PLAN_TYPES[b.plan_type]) : b.plan_type) : "", b.claim_ref ? `#${esc(b.claim_ref)}` : "", state];
}

export function medHeadCard(b) {
  const K = kindOf(b), c = b.currency, base = detailHref(b.id), owed = b.owed;
  const pct = owed ? Math.max(0, Math.min(100, Math.round((num(b.paid) / owed) * 100))) : 0;
  const badges = [`<span class="badge ${STATUS_CLS[b.status] || ""}">${esc(t(STATUS[b.status] || b.status))}</span>`,
    b.visibility === "private" ? `<span class="badge" style="background:var(--surface-2)" title="${esc(t("仅自己和家主可见"))}" aria-label="${esc(t("仅自己和家主可见"))}">🔒 ${t("私密")}</span>` : ""].filter(Boolean).join("");
  const menu = moreMenu([{ label: t("详情"), href: `${base}?sec=detail`, first: true }, { label: t("记缴费"), href: `${base}?pay=new` }, { label: t("复制"), href: `${detailHref("new")}?copy=${encodeURIComponent(b.id)}` },
    { label: t("删除"), action: "med-del", data: { id: b.id }, danger: true }], { label: `${b.provider} · ${t("更多操作")}` });
  const dates = [b.service_date ? `${L("就诊", "Visit")} ${fmtDate(b.service_date)}` : "", b.bill_date ? `${L("账单", "Billed")} ${fmtDate(b.bill_date)}` : "", b.due_on ? `${L("到期", "Due")} ${fmtDate(b.due_on)}` : ""].filter(Boolean).map(esc);
  const who = [b.patient, b.bill_ref ? `#${b.bill_ref}` : ""].filter(Boolean).map(esc);
  const ins = K.insurance ? insuranceItems(b) : [];
  const formula = b.billed_amount != null ? [`${t("总额")} ${mny(b.billed_amount, c)}`, num(b.insurance_paid) ? `${t("保险")} −${mny(b.insurance_paid, c)}` : "", num(b.adjustment) ? `${t("冲减")} −${mny(b.adjustment, c)}` : ""].filter(Boolean).map(esc) : [];
  return `<section class="panel bill-head" aria-label="${esc(t("账单概要"))}">
    <div class="bh-top"><span class="mi" aria-hidden="true">${subIcon(b)}</span><div class="bh-t"><h2>${esc(b.provider)}</h2>${badges}</div>${menu}</div>
    <div class="oh-lines">${line(t(K.who.split(/[ （(]/)[0]), who)}${line(t("日期"), dates)}${line(t("保险"), ins)}</div>
    <div class="ot-stats" role="group" aria-label="${esc(t("应付 / 已付 / 余额"))}"><div><small>${t("应付")}</small><b>${mny(owed, c)}</b></div><div><small>${t("已付")}</small><b>${mny(b.paid || 0, c)}</b></div><div><small>${t("余额")}</small><b>${owed == null ? "—" : mny(b.balance || 0, c)}</b></div></div>
    ${owed != null ? `<span class="mprog ot-prog" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></span>` : `<p class="muted ot-note">${t("还没填自付金额或总额，余额未知")}</p>`}
    ${formula.length ? `<small class="muted ot-note dots">${dots(formula)}</small>` : ""}
  </section>`;
}
