/* 税务 → 汇总（二期）：数字汇总表 + 标准 / 逐项扣除对比 + 境外账户 FBAR 预判。数字的来源和算法在 tax-numbers.js。
 * 每行：名称 / 数（自动算的只读，手填的是输入框）/ 来源链接 / TurboTax 里在哪填 / 「已核对」勾选。全是参考，以官方单据为准。 */
import { esc } from "../core/util.js";
import { lang, t } from "../core/i18n.js";
import { state } from "../core/state.js";
import { GROUP_NAMES, RULES_NOTE, deductionCompare, taxRows, valueOf } from "./tax-numbers.js";
import { TAX_THRESHOLDS, acctOf, setupFor, yearState } from "./tax-calendar.js";

const tx = (o) => (o ? (lang === "en" ? o.en : o.zh) : "");
const money = (n) => Units.money(n);

function rowHtml(y, r) {
  const st = yearState(y), manual = st.nums?.[r.id], val = valueOf(y, r), ok = !!st.ok?.[r.id];
  const valueCell = r.manual ? `<input class="tax-num-in" type="number" step="0.01" min="0" inputmode="decimal" data-tax-num="${r.id}" data-y="${y}" value="${manual ?? ""}" placeholder="0.00" aria-label="${esc(tx(r.name))}">`
    : `<b class="tax-num-val">${val == null ? "—" : money(val)}</b>`;
  return `<li class="tax-num"><div class="tax-num-top"><span class="tax-num-name">${esc(tx(r.name))}</span>${valueCell}</div>
    ${r.note ? `<small class="muted">${esc(tx(r.note))}</small>` : ""}${r.tt ? `<small class="tax-num-tt">TurboTax · ${esc(tx(r.tt))}</small>` : ""}
    <div class="tax-num-foot">${r.src ? `<a href="${esc(r.src)}">${t("看来源明细")} ›</a>` : "<span></span>"}<label class="check-inline"><input type="checkbox" data-tax-ok="${r.id}" data-y="${y}" ${ok ? "checked" : ""}><span>${t("已核对")}</span></label></div></li>`;
}
function deductionCard(y) {
  const c = deductionCompare(y), line = (k, v) => `<div class="dt-row"><dt>${esc(k)}</dt><dd>${v}</dd></div>`;
  const verdict = c.better == null ? `<p class="muted">${t("{y} 年没有标准扣除额的参考数据，请对着 IRS 官网比较。", { y })}</p>`
    : `<p><b>${c.better === "itemized" ? t("逐项扣除更划算（参考）") : t("标准扣除更划算（参考）")}</b> <span class="muted">${t("相差 {a}", { a: money(Math.abs(c.diff)) })}</span></p>`;
  return `<section class="panel dt-block"><div class="dt-head"><h3>${t("标准扣除 vs 逐项扣除（合并报税，参考）")}</h3></div><dl class="dt-list">
    ${line(t("标准扣除"), c.std == null ? "—" : money(c.std))}${line(t("逐项合计"), money(c.itemized))}
    ${line(t("其中房产税 + 州税"), `${money(c.salt)}${c.cap != null && c.salt > c.cap ? ` → ${t("按上限 {a}", { a: money(c.cap) })}` : ""}`)}</dl>${verdict}
    <p class="hint">${t("逐项 = 房贷利息 + 房产税和州税（有上限）+ 捐款；医疗要超过收入的一定比例才能扣，这里没算。最后以 TurboTax 的比较为准。")} ${esc(tx(RULES_NOTE))}</p></section>`;
}
/** 境外账户 FBAR 预判：标了「境外」的账户，这一年里每个账户的最高余额加起来和 1 万美元比（只在打开「境外账户」标记时显示） */
function fbarCard(y) {
  const flagged = (state.cards || []).filter((c) => acctOf(c.id).foreign), th = TAX_THRESHOLDS.fbar;
  const peak = (c) => Math.max(0, ...(state.balances || []).filter((b) => b.card_id === c.id && String(b.as_of).slice(0, 4) === String(y)).map((b) => +b.balance || 0));
  const rows = flagged.map((c) => ({ c, p: peak(c) })), total = rows.reduce((s, r) => s + r.p, 0);
  const body = rows.length ? `<dl class="dt-list">${rows.map((r) => `<div class="dt-row"><dt>${esc(r.c.name)}</dt><dd>${money(r.p)}</dd></div>`).join("")}</dl><p><b>${t("最高余额合计")} ${money(total)}</b> <span class="badge ${total > th.amount ? "b-out" : "b-ok"}">${total > th.amount ? t("超过 FBAR 线") : t("没超过")}</span></p>`
    : `<p class="muted">${t("还没有标成「境外」的账户：在「账户与开户」里给境外账户打勾。")}</p>`;
  return `<section class="panel dt-block"><div class="dt-head"><h3>🌏 ${t("{y} 年境外账户 FBAR 预判（可选）", { y })}</h3></div>${body}
    <p class="hint">${esc(tx(th.label))} · <a href="${esc(th.source)}" target="_blank" rel="noopener">${t("官方说明")} ↗</a> · ${t("这只是预判，不是申报；余额取你在「更新余额」里记过的。")}</p></section>`;
}
export function summaryTab(y) {
  const rows = taxRows(y), groups = Object.keys(GROUP_NAMES);
  const cards = groups.map((g) => `<section class="panel dt-block"><div class="dt-head"><h3>${esc(tx(GROUP_NAMES[g]))}</h3></div><ul class="tax-nums">${rows.filter((r) => r.group === g).map((r) => rowHtml(y, r)).join("")}</ul></section>`).join("");
  return `<p class="muted tax-wrap">${t("{y} 年和报税有关的数字，按 TurboTax 的填写顺序排。自动算的来自你已有的记录；手填的在这里直接输入。每行点「看来源明细」核对，核对完勾「已核对」。", { y })}</p>
    ${cards}${deductionCard(y)}${setupFor(y).flags.foreign ? fbarCard(y) : ""}`;
}
