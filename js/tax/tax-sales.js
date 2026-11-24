/* 税务 → 买卖与成本基础（三期，2026-11-22.22 改成一项一项填）：卖房 / 卖车前后的收益参考计算。
 *  · 房子按 ①→⑦ 一步一步看 / 填：① 买入价（来自房屋记录，只读）→ ② 买入时付的费用 → ③ 买入时收到的退款 / credit → ④ 装修翻新 → ⑤ 卖出价（只读）→ ⑥ 卖出时的费用 → ⑦ 自住满 2 年？
 *    ②③④⑥ 每一块都是一条条的清单，点「＋ 添加一项」才展开一个小表单（这一项是什么 + 金额 + 可选的日期），一次加一项，每项右边有 × 删除。
 *  · 成本基础 = 买入价 + ② − ③ + ④；收益 = 卖价 − ⑥ − 成本基础；自住满 2 年（近 5 年）合并报税最多排除 50 万美元，超出才交税；出租的房子另给折旧年额参考。
 *  · 车子：自用车卖得比买入价低是亏损，不能抵税；高了才有收益。
 * 买入价 / 卖出价 / 日期来自「房屋」和「车辆」里已有的记录；清单和「住满与否」记在这里（存预算表的 _tax_cfg.props，不动房产记录）。全是参考，政策和额度待核对。
 * 哪一块展开 / 哪一块正在加一项，记在内存里（ui），重画页面（每次保存后都会）不会把你正在填的那套房折叠起来。 */
import { esc } from "../core/util.js";
import { lang, t } from "../core/i18n.js";
import { state } from "../core/state.js";
import { href } from "../core/router.js";
import { propOf } from "./tax-calendar.js";
import { ui } from "./tax-ui.js";
import { closingBlock } from "./tax-closing-ai.js";
import { ensureSpend, linkedRefs, pickerHtml, resolveLink } from "./tax-links.js";
import { isTransfer, leafLabel } from "../core/taxonomy.js";
import { render } from "../app/render.js";

const money = (n) => Units.money(n);
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
export const HOME_EXCLUSION_MFJ = 500000;   // 合并报税，待核对
const num = (v) => (v == null || v === "" ? null : Number(v));
/** 界面状态（不入库）：open = 每套房的展开 / 折叠（用户点过的以用户为准）；add = 正在加一项的那一块 "房产 id|清单名" */
export { ui };

/** 四张清单：key = 存在 props[id] 里的字段；legacy = 以前（只有一个数字框时）存的合计，还认；sign = 对成本基础是加还是减 */
export const SECS = [
  { key: "buyItems", legacy: "buyCosts", sign: 1, n: "②", title: "买入时付的费用", hint: "过户费、律师费、评估费、贷款费用…", ph: "例如：律师费", date: true, link: "spend" },
  { key: "creditItems", legacy: "buyCredits", sign: -1, n: "③", title: "买入时收到的退款 / credit", hint: "买家中介退回的佣金、title 退回的 closing 多收款、贷款方的 credit（包括 Zelle 转来的）。会降低成本基础，不是收入；每笔单独记一项。", ph: "例如：贷款方 credit", date: true, link: "income" },
  { key: "improvements", legacy: null, sign: 1, n: "④", title: "装修翻新（加到成本基础）", hint: "屋顶、厨房、窗户、地板…大的翻新才算，日常维修不算。", ph: "例如：换屋顶", date: true, link: "spend" },
  { key: "sellItems", legacy: "sellCosts", sign: 1, n: "⑥", title: "卖出时的费用", hint: "中介佣金、过户费…", ph: "例如：中介佣金", date: true, link: "spend" },
];
/** 一块清单里的行（含以前填的合计）和合计 */
export function itemsOf(x, s, pid) {
  const rows = (x[s.key] || []).map((it, i) => ({ ...(it.link ? resolveLink(it, pid) : it), i })), old = s.legacy ? num(x[s.legacy]) : null;
  if (old) rows.unshift({ desc: t("以前填的合计"), amount: old, legacy: s.legacy });
  return { rows, total: r2(rows.reduce((a, r) => a + (+r.amount || 0), 0)) };
}

/** 一套房的收益参考；缺买入价或卖价时 ready = false */
export function homeGain(p) {
  const x = propOf(p.id), T = Object.fromEntries(SECS.map((s) => [s.key, itemsOf(x, s, p.id).total])), buy = num(p.purchase_price), sale = num(p.sale_price);
  const basis = buy == null ? null : r2(buy + T.buyItems - T.creditItems + T.improvements), realized = sale == null ? null : r2(sale - T.sellItems);
  const gain = basis != null && realized != null ? r2(realized - basis) : null, excl = x.lived === "yes" ? HOME_EXCLUSION_MFJ : 0;
  return { x, T, imps: T.improvements, basis, realized, gain, excl, taxable: gain == null ? null : Math.max(0, r2(gain - excl)), ready: gain != null };
}
export const carGain = (a) => { const buy = num(a.purchase_price), sale = num(a.vehicle?.sale_price); return { buy, sale, gain: buy != null && sale != null ? r2(sale - buy) : null }; };
/** 出租房的年折旧参考：（买入价 + 费用 − 退款 + 改善）去掉土地后 ÷ 27.5 年（第一年和最后一年按月折算这里没算） */
export const rentalDepreciation = (p) => { const g = homeGain(p), land = Math.min(95, Math.max(0, num(g.x.landPct) ?? 20)); return r2((((num(p.purchase_price) || 0) + g.T.buyItems - g.T.creditItems + g.T.improvements) * (1 - land / 100)) / 27.5); };

const tx = (zh, en) => (lang === "en" ? en : zh);
const row = (k, v) => `<div class="dt-row"><dt>${esc(k)}</dt><dd>${v}</dd></div>`;
const NA = `<span class="muted">—</span>`;
const step = (n, title, body, hint = "") => `<section class="tax-step"><h4><span class="tax-step-n">${n}</span> ${esc(title)}</h4>${hint ? `<p class="muted tax-wrap">${esc(hint)}</p>` : ""}${body}</section>`;

/** 一块清单：行 + 合计 + 「＋ 添加一项」（点了才展开小表单） */
function listBlock(p, s) {
  const x = propOf(p.id), { rows, total } = itemsOf(x, s, p.id), key = `${p.id}|${s.key}`, adding = ui.add === key;
  const li = rows.map((r) => `<li class="tax-imp ${r.missing ? "is-missing" : ""}"><span class="tax-imp-d">${r.on ? `<small class="muted">${esc(r.on)}</small>` : ""}${r.link ? `<span title="${esc(r.link === "income" ? t("链接到收入记录，金额跟着记录走") : t("链接到花费记录，金额跟着记录走"))}">🔗 </span>` : ""}${esc(r.desc || "")}${r.missing ? ` <small class="form-error">${t("记录已删除，不计入")}</small>` : ""}</span><b class="tax-imp-a">${money(+r.amount || 0)}</b><button type="button" class="btn btn-sm btn-ghost" data-tax-item-del="${esc(r.legacy ? `${p.id}|legacy|${r.legacy}` : `${key}|${r.i}`)}" aria-label="${esc(r.link ? t("解除链接") : t("删除这一条"))}">×</button></li>`).join("");
  const picking = s.link && ui.pick === key, linkBtn = s.link && !adding && !picking ? ` <button type="button" class="btn btn-sm btn-ghost tax-add-btn" data-tax-pick="${esc(key)}">🔗 ${s.link === "income" ? t("从收入记录里选") : t("从花费记录里选")}</button>` : "";
  const form = picking ? pickerHtml(p, key, s.link, leafLabel, isTransfer, linkedRefs(x, SECS.filter((z) => z.link === s.link).map((z) => z.key), s.link), money) : adding ? `<form class="tax-item-form" data-tax-item="${esc(key)}" novalidate>
      <label>${t("这一项是什么")}<input name="desc" maxlength="60" placeholder="${esc(t(s.ph))}" autocomplete="off"></label>
      <label>${t("金额")}<input name="amount" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="0.00"></label>
      ${s.date ? `<label>${t("日期（可不填）")}<input name="on" type="date"></label>` : ""}
      <div class="tax-item-actions"><button type="submit" class="btn btn-sm btn-primary">${t("添加")}</button><button type="button" class="btn btn-sm btn-ghost" data-tax-add-cancel>${t("取消")}</button></div>
      <p class="form-error tax-item-err" role="alert"></p></form>`
    : `<button type="button" class="btn btn-sm btn-ghost tax-add-btn" data-tax-add="${esc(key)}">＋ ${t("添加一项")}</button>${linkBtn}`;
  return step(s.n, t(s.title), `${rows.length ? `<ul class="tax-imps">${li}</ul><p class="tax-sub-total">${t("小计")} <b>${money(total)}</b></p>` : `<p class="muted">${t("还没有。没有就不用填，直接往下。")}</p>`}${form}`, s.hint ? t(s.hint) : "");
}

function homeCard(p, idx) {
  const g = homeGain(p), x = g.x, rental = p.role === "landlord", open = ui.open.has(p.id) ? ui.open.get(p.id) : idx === 0 || p.sale_price != null || ["selling", "sold"].includes(p.status);
  const verdict = !g.ready ? `<p class="muted">${t("缺买入价或卖出价：在 房屋 → 交易 里把成交价记上，这里才能算。")}</p>`
    : g.gain < 0 ? `<p><b>${t("亏损 {a}", { a: money(-g.gain) })}</b> <span class="muted">${t("自住房的亏损不能抵税")}</span></p>`
    : `<p><b>${t("收益 {a}", { a: money(g.gain) })}</b> · ${g.excl ? t("排除 {a} 后应税约 {b}", { a: money(g.excl), b: money(g.taxable) }) : t("没排除额度，全部 {b} 都是应税收益", { b: money(g.taxable) })}</p>`;
  const lived = `<select data-tax-prop="${esc(p.id)}" data-key="lived" data-nosearch aria-label="${esc(t("自住满 2 年？"))}"><option value="">${t("还没标")}</option><option value="yes" ${x.lived === "yes" ? "selected" : ""}>${t("是，满 2 年")}</option><option value="no" ${x.lived === "no" ? "selected" : ""}>${t("不满")}</option></select>`;
  return `<details class="panel tax-event" data-tax-open="${esc(p.id)}" ${open ? "open" : ""}><summary><b>🏡 ${esc(p.name)}</b> <span class="muted">${esc(tx(p.role === "landlord" ? "出租" : "自住", p.role === "landlord" ? "rental" : "owner-occupied"))}</span></summary>
    <p class="muted tax-wrap">${t("按 ①→⑦ 一项一项看、一项一项加：没有的就空着，往下走。最底下是算出来的结果。")}</p>
    ${closingBlock(p)}
    ${step("①", t("买入价"), `<p><b>${p.purchase_price != null ? money(p.purchase_price) : NA}</b> <span class="muted">${t("来自 房屋 的记录，这里只读")}</span></p>`)}
    ${listBlock(p, SECS[0])}${listBlock(p, SECS[1])}${listBlock(p, SECS[2])}
    ${step("⑤", t("卖出价"), `<p><b>${p.sale_price != null ? money(p.sale_price) : NA}</b> <span class="muted">${t("来自 房屋 → 交易 的记录，这里只读")}</span></p>`)}
    ${listBlock(p, SECS[3])}
    ${step("⑦", t("自住满 2 年？"), lived, t("卖出前 5 年里自己住满 2 年（夫妻都要满足使用条件），才有 50 万美元的排除额度。"))}
    <section class="tax-step tax-result"><h4>${t("结果（参考）")}</h4><dl class="dt-list">${row(t("成本基础"), g.basis == null ? NA : money(g.basis))}${row(t("扣掉卖出费用后的卖价"), g.realized == null ? NA : money(g.realized))}</dl>${g.T.creditItems ? `<p class="hint">${t("closing 退款已调整成本基础：已按买入时的退款 / credit {a} 调低（不算收入）。", { a: money(g.T.creditItems) })}</p>` : ""}${verdict}</section>
    ${rental ? `<label>${t("土地占比 %（折旧要去掉土地，不确定先填 20）")}<input type="number" min="0" max="95" step="1" inputmode="numeric" data-tax-prop="${esc(p.id)}" data-key="landPct" value="${x.landPct ?? ""}" placeholder="20"></label>
      <p class="hint">${t("出租房：每年折旧参考约 {a}（买入价 + 费用 − 退款 + 改善，去掉 {p}% 土地后 ÷ 27.5 年；第一年和最后一年要按月折算）。卖出时折旧会被「回收」征税，别漏。", { a: money(rentalDepreciation(p)), p: x.landPct ?? 20 })}</p>` : ""}
    <p class="hint">${t("政策待核对：自住满 2 年合并报税最多排除 50 万美元收益（单身 25 万）；出租过的部分有折旧回收。")} <a href="https://www.irs.gov/taxtopics/tc701" target="_blank" rel="noopener">${t("官方说明")} ↗</a></p></details>`;
}
function carCard(a) {
  const g = carGain(a), name = a.name || a.model || t("车辆");
  const verdict = g.gain == null ? `<p class="muted">${t("缺买入价或卖出价：在车辆里记上。")}</p>` : g.gain < 0 ? `<p><b>${t("亏损 {a}", { a: money(-g.gain) })}</b> <span class="muted">${t("自用车的亏损不能抵税")}</span></p>` : `<p><b>${t("收益 {a}", { a: money(g.gain) })}</b> <span class="muted">${t("高于买入价的部分要报（少见）")}</span></p>`;
  return `<details class="panel tax-event" data-tax-open="${esc(a.id)}" ${(ui.open.has(a.id) ? ui.open.get(a.id) : g.sale != null) ? "open" : ""}><summary><b>🚗 ${esc(name)}</b></summary><dl class="dt-list">${row(t("买入价"), g.buy != null ? money(g.buy) : NA)}${row(t("卖出价"), g.sale != null ? money(g.sale) : NA)}</dl>${verdict}
    <p class="hint">${t("车曾用于做生意 / 出租的另有折旧规则，这里没算。")} <a href="${href("asset", a.id)}">${t("打开车辆")} ›</a></p></details>`;
}
export function salesTab() {
  const homes = (state.properties || []).filter((p) => p.role !== "tenant" && !["looking", "renting", "moved_out"].includes(p.status)), cars = (state.assets || []).filter((a) => a.kind === "vehicle" && ["sold", "returned"].includes(a.vehicle?.status || ""));
  ensureSpend(homes.map((p) => p.id), () => render(false));   // 这几套房关联的花费：读一次，读完重画
  return `<p class="muted tax-wrap">${t("卖房、卖车前后的收益参考。买入价、卖出价来自 房屋 / 车辆 里已有的记录；费用、退款、装修翻新、住满与否记在这里，一项一项加。参考用，以 TurboTax 和官方说明为准。")}</p>
    <h3 class="tax-sub">${t("房子")}</h3>${homes.map(homeCard).join("") || `<p class="muted">${t("还没有房产。")}</p>`}
    <h3 class="tax-sub">${t("已卖出的车")}</h3>${cars.map(carCard).join("") || `<p class="muted">${t("还没有卖出的车。卖车时在车辆的交易里走「卖车」流程，价格记在那里。")}</p>`}`;
}
