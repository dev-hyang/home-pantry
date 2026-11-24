/* 税务 → 汇总 → 预缴税参考（四期，提醒级）：工资之外有较大收入（投资、租金、自由职业、卖股票的收益）或预扣不够时，要按季预缴，晚了有罚款。
 * 这里只按联邦的「安全港」规则给一个参考：全年至少交够 本年税额的 90% 和 去年税额的 100%（去年 AGI 超过 15 万美元是 110%）中较小的那个，
 * 减去已扣的税（工资预扣）和已缴的预缴税，剩下的平分到还没到期的几期。不是申报，也不替你算税额：本年税额、去年税额由你填（去年的在去年的报税表上）。
 * 伊利诺伊另有自己的规则，这里不算。数字和规则待核对，以 IRS 官网（Form 1040-ES）为准。 */
import { numAttrs } from "../core/ui-num.js";
import { esc, todayISO } from "../core/util.js";
import { lang, t } from "../core/i18n.js";
import { deadlinesFor, yearState } from "./tax-calendar.js";
import { taxRows, valueOf } from "./tax-numbers.js";

const money = (n) => Units.money(n);
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const tx = (o) => (lang === "en" ? o.en : o.zh);

/** 参考计算：返回 { required, needed, perQuarter, left（还没到期的期数）, dates } */
export function planOf(y) {
  const p = yearState(y).plan || {}, rows = taxRows(y), est = valueOf(y, rows.find((r) => r.id === "estPaid")) || 0, wh = +valueOf(y, rows.find((r) => r.id === "fedWh")) || 0;
  const cur = +p.expectedTax || 0, prior = +p.priorTax || 0, mult = p.priorAgiHigh ? 1.1 : 1;
  const required = cur || prior ? r2(Math.min(...[cur ? cur * 0.9 : null, prior ? prior * mult : null].filter((v) => v != null))) : 0;
  const needed = Math.max(0, r2(required - wh - est)), today = todayISO(), dates = deadlinesFor(y).filter((d) => /^q[1-4]$/.test(d.id) && d.date >= today);
  return { p, required, wh, est, needed, left: dates.length, dates, perQuarter: dates.length ? r2(needed / dates.length) : needed };
}
export function planCard(y) {
  const c = planOf(y), p = c.p, inp = (key, label, ph) => `<label>${esc(label)}<input ${numAttrs("money")} data-tax-plan="${key}" data-y="${y}" value="${p[key] ?? ""}" placeholder="${esc(ph)}"></label>`;
  const result = c.required ? `<dl class="dt-list"><div data-variant="detail" class="ui-row dt-row"><dt>${t("全年至少要交够（联邦，参考）")}</dt><dd>${money(c.required)}</dd></div><div data-variant="detail" class="ui-row dt-row"><dt>${t("已扣的税（W-2）+ 已缴的预缴税")}</dt><dd>${money(c.wh + c.est)}</dd></div>
      <div data-variant="detail" class="ui-row dt-row"><dt>${t("还差")}</dt><dd><b>${money(c.needed)}</b></dd></div>${c.left ? `<div data-variant="detail" class="ui-row dt-row"><dt>${t("还有 {n} 期，每期约", { n: c.left })}</dt><dd><b>${money(c.perQuarter)}</b> <span class="muted">${esc(c.dates.map((d) => d.date).join(" · "))}</span></dd></div>` : `<div data-variant="detail" class="ui-row dt-row"><dt>${t("预缴的几期都过了")}</dt><dd>—</dd></div>`}</dl>` : `<p class="muted">${t("填上本年预计税额或去年税额，才会算。")}</p>`;
  return `<section class="panel dt-block"><div class="dt-head"><h3>🗓️ ${t("{y} 年预缴税参考（联邦）", { y })}</h3></div>
    <p class="muted tax-wrap">${t("工资之外有较大收入（卖股票的收益、利息、租金、自由职业）或预扣不够时用。只是提醒级的参考，不是申报。")}</p>
    <div class="form-grid">${inp("expectedTax", t("本年预计联邦税额"), "0.00")}${inp("priorTax", t("去年联邦税额（去年 1040 总税额）"), "0.00")}
      <label class="check-inline span-2"><input type="checkbox" data-tax-plan-agi data-y="${y}" ${p.priorAgiHigh ? "checked" : ""}><span>${t("去年 AGI 超过 15 万美元（要交去年税额的 110%）")}</span></label></div>${result}
    <p class="hint">${t("规则：全年交够「本年税额的 90%」和「去年税额的 100%（去年 AGI 高于 15 万是 110%）」中较小的，一般可免预缴罚款；扣完预扣后欠税不到 1,000 美元也不用预缴（待核对）。")} <a href="https://www.irs.gov/businesses/small-businesses-self-employed/estimated-taxes" target="_blank" rel="noopener">${t("官方说明")} ↗</a> ${tx({ zh: "伊利诺伊的预缴规则另算。", en: "Illinois has its own estimated-tax rules." })}</p></section>`;
}
