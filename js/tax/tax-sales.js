/* 税务 → 买卖与成本基础（三期）：卖房 / 卖车前后的收益参考计算。
 *  · 房子：成本基础 = 买入价 + 买入时的费用 + 装修翻新（你在这里逐条记）；收益 = 卖价 − 卖出费用 − 成本基础；
 *    自住满 2 年（近 5 年）合并报税最多排除 50 万美元，超出才交税；出租的房子另给一个折旧年额参考。
 *  · 车子：自用车卖得比买入价低是亏损，不能抵税；高了才有收益。
 * 买入价 / 卖出价 / 日期来自「房屋」和「车辆」里已有的记录；装修、费用、住满与否记在这里（存预算表的 _tax_cfg.props，不动房产记录）。
 * 全是参考，政策和额度待核对，以 TurboTax / 官网为准。 */
import { esc } from "../core/util.js";
import { lang, t } from "../core/i18n.js";
import { state } from "../core/state.js";
import { href } from "../core/router.js";
import { propOf } from "./tax-calendar.js";

const money = (n) => Units.money(n);
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
export const HOME_EXCLUSION_MFJ = 500000;   // 合并报税，待核对
const num = (v) => (v == null || v === "" ? null : Number(v));

/** 一套房的收益参考：输入来自房产记录 + 这里记的改善 / 费用；缺买入价或卖价时 ready = false */
export function homeGain(p) {
  const x = propOf(p.id), imps = (x.improvements || []).reduce((s, i) => s + (+i.amount || 0), 0), buy = num(p.purchase_price), sale = num(p.sale_price);
  const basis = buy == null ? null : r2(buy + (+x.buyCosts || 0) + imps), realized = sale == null ? null : r2(sale - (+x.sellCosts || 0));
  const gain = basis != null && realized != null ? r2(realized - basis) : null, excl = x.lived === "yes" ? HOME_EXCLUSION_MFJ : 0;
  return { x, imps, basis, realized, gain, excl, taxable: gain == null ? null : Math.max(0, r2(gain - excl)), ready: gain != null };
}
export const carGain = (a) => { const buy = num(a.purchase_price), sale = num(a.vehicle?.sale_price); return { buy, sale, gain: buy != null && sale != null ? r2(sale - buy) : null }; };
/** 出租房的年折旧参考：（买入价 + 费用 + 改善）去掉土地后 ÷ 27.5 年（住宅出租的直线折旧，第一年和最后一年按月折算这里没算） */
export const rentalDepreciation = (p) => { const x = propOf(p.id), base = (num(p.purchase_price) || 0) + (+x.buyCosts || 0) + (x.improvements || []).reduce((s, i) => s + (+i.amount || 0), 0), land = Math.min(95, Math.max(0, num(x.landPct) ?? 20)); return r2((base * (1 - land / 100)) / 27.5); };

const tx = (zh, en) => (lang === "en" ? en : zh);
const row = (k, v) => `<div class="dt-row"><dt>${esc(k)}</dt><dd>${v}</dd></div>`;
const NA = `<span class="muted">—</span>`;

function homeCard(p) {
  const g = homeGain(p), x = g.x, imps = x.improvements || [], rental = p.role === "landlord";
  const impRows = imps.map((i, n) => `<li class="tax-imp"><span>${esc(i.on || "")} · ${esc(i.desc || "")} <b>${money(+i.amount || 0)}</b></span><button type="button" class="btn btn-sm btn-ghost" data-tax-imp-del="${esc(p.id)}:${n}" aria-label="${esc(t("删除这一条"))}">×</button></li>`).join("");
  const verdict = !g.ready ? `<p class="muted">${t("缺买入价或卖出价：在 房屋 → 交易 里把成交价记上。")}</p>`
    : g.gain < 0 ? `<p><b>${t("亏损 {a}", { a: money(-g.gain) })}</b> <span class="muted">${t("自住房的亏损不能抵税")}</span></p>`
    : `<p><b>${t("收益 {a}", { a: money(g.gain) })}</b> · ${g.excl ? t("排除 {a} 后应税约 {b}", { a: money(g.excl), b: money(g.taxable) }) : t("没排除额度，全部 {b} 都是应税收益", { b: money(g.taxable) })}</p>`;
  return `<details class="panel tax-event" ${p.sale_price != null || ["selling", "sold"].includes(p.status) ? "open" : ""}><summary><b>🏡 ${esc(p.name)}</b> <span class="muted">${esc(tx(p.role === "landlord" ? "出租" : "自住", p.role === "landlord" ? "rental" : "owner-occupied"))}</span></summary>
    <dl class="dt-list">${row(t("买入价"), p.purchase_price != null ? money(p.purchase_price) : NA)}${row(t("卖出价"), p.sale_price != null ? money(p.sale_price) : NA)}
      ${row(t("装修翻新合计"), money(g.imps))}${row(t("成本基础"), g.basis == null ? NA : money(g.basis))}${row(t("扣掉卖出费用后的卖价"), g.realized == null ? NA : money(g.realized))}</dl>${verdict}
    <h4>${t("记一下这些")}</h4>
    <div class="form-grid"><label>${t("买入时的费用（过户、律师、评估…）")}<input type="number" min="0" step="0.01" inputmode="decimal" data-tax-prop="${esc(p.id)}" data-key="buyCosts" value="${x.buyCosts ?? ""}"></label>
      <label>${t("卖出时的费用（中介佣金、过户…）")}<input type="number" min="0" step="0.01" inputmode="decimal" data-tax-prop="${esc(p.id)}" data-key="sellCosts" value="${x.sellCosts ?? ""}"></label>
      <label class="span-2">${t("卖出前 5 年里自己住满 2 年（夫妻都要满足使用条件）")}<select data-tax-prop="${esc(p.id)}" data-key="lived" data-nosearch><option value="">${t("还没标")}</option><option value="yes" ${x.lived === "yes" ? "selected" : ""}>${t("是，满 2 年")}</option><option value="no" ${x.lived === "no" ? "selected" : ""}>${t("不满")}</option></select></label></div>
    <h4>${t("装修翻新（会加到成本基础）")}</h4><ul class="tax-imps">${impRows || `<li class="muted">${t("还没记")}</li>`}</ul>
    <form class="tax-imp-form" data-tax-imp="${esc(p.id)}"><input type="date" name="on" required aria-label="${esc(t("日期"))}"><input name="desc" maxlength="60" required placeholder="${esc(t("例如：换屋顶"))}" aria-label="${esc(t("内容"))}"><input name="amount" type="number" min="0.01" step="0.01" inputmode="decimal" required placeholder="${esc(t("金额"))}" aria-label="${esc(t("金额"))}"><button class="btn btn-sm" type="submit">${t("添加")}</button></form>
    ${rental ? `<label>${t("土地占比 %（折旧要去掉土地，不确定先填 20）")}<input type="number" min="0" max="95" step="1" inputmode="numeric" data-tax-prop="${esc(p.id)}" data-key="landPct" value="${x.landPct ?? ""}" placeholder="20"></label>` : ""}
    ${rental ? `<p class="hint">${t("出租房：每年折旧参考约 {a}（买入价 + 费用 + 改善，去掉 {p}% 土地后 ÷ 27.5 年；第一年和最后一年要按月折算）。卖出时折旧会被「回收」征税，别漏。", { a: money(rentalDepreciation(p)), p: propOf(p.id).landPct ?? 20 })}</p>` : ""}
    <p class="hint">${t("政策待核对：自住满 2 年合并报税最多排除 50 万美元收益（单身 25 万）；出租过的部分有折旧回收。")} <a href="https://www.irs.gov/taxtopics/tc701" target="_blank" rel="noopener">${t("官方说明")} ↗</a></p></details>`;
}
function carCard(a) {
  const g = carGain(a), name = a.name || a.model || t("车辆");
  const verdict = g.gain == null ? `<p class="muted">${t("缺买入价或卖出价：在车辆里记上。")}</p>` : g.gain < 0 ? `<p><b>${t("亏损 {a}", { a: money(-g.gain) })}</b> <span class="muted">${t("自用车的亏损不能抵税")}</span></p>` : `<p><b>${t("收益 {a}", { a: money(g.gain) })}</b> <span class="muted">${t("高于买入价的部分要报（少见）")}</span></p>`;
  return `<details class="panel tax-event" ${g.sale != null ? "open" : ""}><summary><b>🚗 ${esc(name)}</b></summary><dl class="dt-list">${row(t("买入价"), g.buy != null ? money(g.buy) : NA)}${row(t("卖出价"), g.sale != null ? money(g.sale) : NA)}</dl>${verdict}
    <p class="hint">${t("车曾用于做生意 / 出租的另有折旧规则，这里没算。")} <a href="${href("asset", a.id)}">${t("打开车辆")} ›</a></p></details>`;
}
export function salesTab() {
  const homes = (state.properties || []).filter((p) => p.role !== "tenant" && !["looking", "renting", "moved_out"].includes(p.status)), cars = (state.assets || []).filter((a) => a.kind === "vehicle" && ["sold", "returned"].includes(a.vehicle?.status || ""));
  return `<p class="muted tax-wrap">${t("卖房、卖车前后的收益参考。买入价、卖出价来自 房屋 / 车辆 里已有的记录；装修翻新、买卖费用、住满与否记在这里。参考用，以 TurboTax 和官方说明为准。")}</p>
    <h3 class="tax-sub">${t("房子")}</h3>${homes.map(homeCard).join("") || `<p class="muted">${t("还没有房产。")}</p>`}
    <h3 class="tax-sub">${t("已卖出的车")}</h3>${cars.map(carCard).join("") || `<p class="muted">${t("还没有卖出的车。卖车时在车辆的交易里走「卖车」流程，价格记在那里。")}</p>`}`;
}
