/* 一次性账单详情页的页头汇总卡（和周期性账单的 .bill-head 同一套样式）：图标 + 提供方、状态 / 到期 / 🔒 徽章、右上角 ⋯（记缴费、复制为新账单、删除）；
 * 下面一排「应付 / 已付 / 余额」+ 进度条 + 算式，一眼看清这张账单还差多少。每个信息块各自的「编辑」在下面的分块卡片里，不在 ⋯ 里。 */
import { esc, fmtDate, num } from "../core/util.js";
import { t } from "../core/i18n.js";
import { moreMenu } from "../core/more-menu.js";
import { STATUS, STATUS_CLS, detailHref, kindOf, subIcon } from "./medical.js";

const mny = (v, c) => (v == null ? "—" : Units.money(num(v), c || Units.region.currency));

export function medHeadCard(b) {
  const K = kindOf(b), c = b.currency, base = detailHref(b.id), owed = b.owed;
  const pct = owed ? Math.max(0, Math.min(100, Math.round((num(b.paid) / owed) * 100))) : 0;
  const badges = [`<span class="badge ${STATUS_CLS[b.status] || ""}">${esc(t(STATUS[b.status] || b.status))}</span>`, b.due_on ? `<span class="badge" style="background:var(--surface-2)">${esc(t("到期 {d}", { d: fmtDate(b.due_on) }))}</span>` : "",
    b.visibility === "private" ? `<span class="badge" style="background:var(--surface-2)" title="${esc(t("仅自己和家主可见"))}" aria-label="${esc(t("仅自己和家主可见"))}">🔒 ${t("私密")}</span>` : ""].filter(Boolean).join("");
  const menu = moreMenu([{ label: t("记一笔缴费"), href: "#medPayments", first: true }, { label: t("复制为新账单"), href: `${detailHref("new")}?copy=${encodeURIComponent(b.id)}` },
    { label: t("删除这张账单"), action: "med-del", data: { id: b.id }, danger: true }], { label: `${b.provider} · ${t("更多操作")}` });
  const formula = b.patient_amount == null && b.billed_amount != null ? (K.insurance ? t("= 总额 − 保险已付 − 冲减") : t("= 总额 − 冲减")) : "";
  return `<section class="panel bill-head" aria-label="${esc(t("账单概要"))}">
    <div class="bh-top"><span class="mi" aria-hidden="true">${subIcon(b)}</span><div class="bh-t"><h2>${esc(b.provider)}</h2>${badges}</div>${menu}</div>
    <div class="ot-stats" role="group" aria-label="${esc(t("应付 / 已付 / 余额"))}"><div><small>${t("应付")}</small><b>${mny(owed, c)}</b></div><div><small>${t("已付")}</small><b>${mny(b.paid || 0, c)}</b></div><div><small>${t("余额")}</small><b>${owed == null ? "—" : mny(b.balance || 0, c)}</b></div></div>
    ${owed != null ? `<span class="mprog ot-prog" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></span>` : `<p class="muted ot-note">${t("还没填自付金额或总额，余额未知")}</p>`}
    ${formula ? `<small class="muted ot-note">${esc(formula)}</small>` : ""}
    <a class="btn btn-primary bh-pay" href="#medPayments">${t("记一笔缴费")}</a>
  </section>`;
}
