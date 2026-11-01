/* 财务 → 资产（2026-11，P1）：现有记录的「钱的视角」，不是另一份数据。
 * 房产（properties：状态、买入 / 卖出日期和价格，交易交割时写入）、车辆（assets kind=vehicle：拥有状态含贷款中、贷款到期、买入 / 卖出价）、
 * 账户（cards 里 kind 是支票 / 储蓄 / 券商 / 退休 / HSA / 贷款 / 现金的那些）。每行都链回房屋 / 车辆 / 卡与账户的原记录去改——只有一个真相来源。
 * 估值和余额（P3，迁移 059）：每处房产 / 车辆显示当前市值（最新估值；房产没有估值按购入价，标出来）和净值（市值 − 挂在上面的贷款），
 * 每个账户显示最新余额；就地「更新估值 / 更新余额」，历史折叠在下面（5 条一页）。估值、余额是自己的历史表，不改房屋 / 卡的原记录。
 * 融资（2026-11，P2 迁移 058）：贷款按 id 挂在房产 / 车辆上（debt_accounts.property_id / asset_id），不再按账单名里的车名猜；
 * 还没建贷款的贷款账单、没关联车辆的车贷列在区块底下，提示去关联。
 * 数据量：房产、车辆、账单、卡、贷款都是启动时整表读进内存的小表，直接在内存里算；只有「今年这套房的花费」要扫花费明细，
 * 用现成的 spend_rollup 聚合（按月 × 分类 × 房产，和统计页共用缓存），不新增按行的查询。 */
import { state } from "../core/state.js";
import { href } from "../core/router.js";
import { esc, fmtDate, money, num } from "../core/util.js";
import { t } from "../core/i18n.js";
import { isVehicle, myVehicles, assetName } from "../house/assets.js";
import { ACCOUNT_KINDS, cardHref, kindIcon, kindName } from "./cards.js";
import { spendRollupFor } from "../stats/views.js";
import { debtHref, debtsEnriched } from "./debt-logic.js";
import { isClosedStatus } from "../core/debt-rules.js";
import { looseBillsHtml } from "./debts.js";
import { balancePanel, valuationPanel } from "./net-worth.js";
import { liveNetWorth } from "./nw-logic.js";

const cur = () => Units.region.currency;
/** 今年 1 月到本月 */
const thisYearMonths = () => { const d = new Date(), y = d.getFullYear(); return Array.from({ length: d.getMonth() + 1 }, (_, i) => `${y}-${String(i + 1).padStart(2, "0")}`); };

/** 每套房产今年挂在它名下的花费（含账单缴费记的花费）：{ [property_id]: sum }；还在读返回 null */
function propertySpendThisYear() {
  const rows = spendRollupFor(thisYearMonths()); if (!rows) return null;
  const out = {};
  for (const r of rows) if (r.prop && r.nat !== "transfer" && (r.cur || cur()) === cur()) out[r.prop] = (out[r.prop] || 0) + r.sum;
  return out;
}

/** 挂在这套房产上的活跃账单：每月折算（自己交的 + Escrow 代缴的，后者已含在房贷月供里，分开写） */
function propertyBills(pid) {
  const list = state.billsEnriched.filter((b) => b.property_id === pid && b.active && !b.ended && (b.currency || cur()) === cur());
  return { n: list.length, monthly: list.reduce((s, b) => s + b.monthly, 0), escrow: list.reduce((s, b) => s + b.escrowMonthly, 0) };
}

/** 贷款（还在还的，按 id 挂在资产上）；没跑迁移 058 时是空的 */
const liveDebts = () => (state.debtsOk ? debtsEnriched().filter((e) => e.direction === "payable" && !isClosedStatus(e.status)) : []);
/** 贷款一行：名称（链到借贷详情）· 未还本金 · 每期；迁移猜的车辆标「待确认」 */
const debtLine = (e) => `<a href="${esc(debtHref(e.id))}">${esc(e.name)}</a> ${e.balance != null ? `${t("未还 {a}", { a: money(e.balance) })}` : ""}${e.bill ? ` · ${money(e.bill.monthly)}${t("/月")}` : ""}${e.link_confirmed === false ? ` <span class="badge b-soon">${t("待确认")}</span>` : ""}`;

const fact = (label, value) => (value ? `<span class="fa-fact"><small>${esc(label)}</small>${value}</span>` : "");
const priceDate = (price, date) => [price != null && price !== "" ? money(num(price)) : "", date ? esc(fmtDate(date)) : ""].filter(Boolean).join(" · ");

/** 估值 + 净值两格（净资产页同一份计算）；没执行 059 时只写「—」 */
function valueFacts(eq) {
  if (!state.nwOk) return fact(t("估值"), `<span class="muted">—</span>`);
  if (!eq) return "";
  const v = eq.value == null ? `<span class="muted">${t("未估值")}</span>` : `${money(eq.value)}${eq.source === "purchase" ? ` <small class="muted">${t("按购入价")}</small>` : ""}`;
  return fact(t("市值"), v) + (eq.equity != null ? fact(t("净值"), `<b class="${eq.equity < 0 ? "down" : ""}">${money(eq.equity)}</b>${eq.loanBalance ? ` <small class="muted">${t("贷款 {a}", { a: money(eq.loanBalance) })}</small>` : ""}`) : "");
}
function propertyRow(p, spend, loans = [], eq = null) {
  const ST = window.DEALS.PROPERTY_STATUS, K = window.BILLS.PROPERTY_KINDS;
  const bills = propertyBills(p.id), y = new Date().getFullYear();
  const spent = spend == null ? `<span class="muted">${t("读取中…")}</span>` : money(spend[p.id] || 0);
  const billTxt = bills.n ? `${money(bills.monthly)}${t("/月")}${bills.escrow ? ` <small class="muted">${t("+ Escrow {a}", { a: money(bills.escrow) })}</small>` : ""} · <a href="${href("bills", "recurring")}?tab=list&prop=${encodeURIComponent(p.id)}">${t("{n} 条账单", { n: bills.n })}</a>` : `<span class="muted">${t("没有挂账单")}</span>`;
  return `<li class="fa-row">
    <div class="fa-head"><b>${esc(p.name)}</b><span class="badge">${esc(t(ST[p.status] || "持有"))}</span><small class="muted">${esc(t(K[p.kind] || ""))}${p.archived ? ` · ${t("已归档")}` : ""}</small>
      <a class="btn btn-sm btn-ghost fa-edit" href="${href("house", "pages")}?prop=${encodeURIComponent(p.id)}" aria-label="${esc(t("在房屋里打开 {name}", { name: p.name }))}">${t("在房屋里打开")} ›</a></div>
    <div class="fa-facts">
      ${fact(t("买入"), priceDate(p.purchase_price, p.acquired_on) || `<span class="muted">${t("未记录")}</span>`)}
      ${p.sold_on || p.sale_price != null ? fact(t("卖出"), priceDate(p.sale_price, p.sold_on)) : ""}
      ${fact(t("关联账单"), billTxt)}
      ${loans.length ? fact(t("贷款"), loans.map(debtLine).join("<br>")) : ""}
      ${fact(t("{y} 年花费", { y }), `${spent} · <a href="${href("bills", "spend")}?tab=records&prop=${encodeURIComponent(p.id)}&year=${y}">${t("明细")}</a>`)}
      ${valueFacts(eq)}
    </div>
    ${eq ? valuationPanel("property", p, { fallback: eq.source === "purchase" ? eq.value : null }) : ""}</li>`;
}

function vehicleRow(a, loans, eq = null) {
  const V = window.VEHICLES, v = a.vehicle || {}, st = V.statusOf(a);
  const loanTxt = loans.length ? loans.map(debtLine).join("<br>") : "";
  return `<li class="fa-row">
    <div class="fa-head"><b>${esc(assetName(a))}</b><span class="badge ${V.STATUS[st]?.cls || ""}">${esc(t(V.STATUS[st]?.name || st))}</span>
      <a class="btn btn-sm btn-ghost fa-edit" href="${href("asset", a.id)}" aria-label="${esc(t("打开车辆 {name}", { name: assetName(a) }))}">${t("打开车辆")} ›</a></div>
    <div class="fa-facts">
      ${fact(t("买入"), priceDate(a.purchase_price, a.installed_on) || `<span class="muted">${t("未记录")}</span>`)}
      ${v.disposed_on || v.sale_price != null ? fact(st === "returned" ? t("归还") : t("卖出"), priceDate(v.sale_price, v.disposed_on)) : ""}
      ${st === "financed" || st === "leased" || v.loan_end ? fact(st === "leased" ? t("租约到期") : t("贷款到期"), v.loan_end ? esc(fmtDate(v.loan_end)) : `<span class="muted">${t("未填")}</span>`) : ""}
      ${fact(t("车贷"), loanTxt)}
      ${valueFacts(eq)}
    </div>
    ${eq ? valuationPanel("vehicle", a) : ""}</li>`;
}

export function viewFinAssets() {
  const props = state.properties.filter((p) => !p.archived || p.purchase_price != null || p.sale_price != null);
  const spend = propertySpendThisYear();
  const vehicles = myVehicles().filter(isVehicle);
  const debts = liveDebts();
  const nw = state.nwOk ? liveNetWorth() : null;   // 净资产（迁移 059）：市值、净值、账户余额和净资产页同一份计算
  const eqOf = (kind, id) => nw?.equity.find((e) => e.kind === kind && e.item.id === id) || null;
  const vRows = vehicles.map((a) => vehicleRow(a, debts.filter((e) => e.asset_id === a.id), eqOf("vehicle", a.id)));
  const loose = debts.filter((e) => e.category === "auto_loan" && !e.asset_id);   // 没关联车辆的车贷
  const accts = state.cards.filter((c) => ACCOUNT_KINDS.includes(c.kind) && c.active !== false);
  const credit = state.cards.filter((c) => c.kind === "credit" && c.active !== false);   // 信用卡欠款也是负债：余额在这里一起更新
  const acctOf = (id) => nw?.accounts.find((a) => a.card.id === id) || null;
  const balTxt = (c) => {
    const a = acctOf(c.id);
    if (!nw) return t("余额：执行 059 后可记");
    if (a?.viaDebt) return t("余额按借贷里的贷款算");
    if (!a || a.missing) return t("余额：未记录");
    return `${c.kind === "credit" || c.kind === "loan" ? t("欠款") : t("余额")} ${money(a.balance)} · ${fmtDate(a.as_of)}${a.stale ? ` · ${t("需要更新")}` : ""}`;
  };
  const held = props.filter((p) => !["sold", "moved_out", "looking"].includes(p.status) && !p.archived).length;
  const liveVeh = vehicles.filter((a) => window.VEHICLES.isActive(a) && window.VEHICLES.statusOf(a) !== "looking").length;
  const housing = props.reduce((s, p) => s + propertyBills(p.id).monthly, 0);
  const acctRows = [...ACCOUNT_KINDS, "credit"].flatMap((k) => [...accts, ...credit].filter((c) => c.kind === k).map((c) => `<li class="fa-acct"><a class="mrow" href="${esc(cardHref(c.id))}">
      <span class="mi" aria-hidden="true">${kindIcon(k)}</span>
      <span class="mt"><b>${esc(c.name)}${c.last4 ? ` ··${esc(c.last4)}` : ""}</b><small>${esc([kindName(k), c.issuer].filter(Boolean).join(" · "))} · ${esc(balTxt(c))}</small></span>
      <span class="mch" aria-hidden="true">›</span></a>${acctOf(c.id)?.viaDebt ? "" : balancePanel(c)}</li>`));
  const cashLike = nw ? nw.assets.cash + nw.assets.investments + nw.assets.retirement + nw.assets.hsa : null;
  return `<section class="section fin-assets">
    <p class="muted" style="margin:-6px 0 12px;font-size:13px">${t("房产、车辆和账户的钱的那一面；改资料回到原来的地方（房屋 / 车辆 / 卡与账户），这里只读")}</p>
    <div class="kpis">
      <div class="kpi"><span>${t("持有的房产")}</span><b>${held}</b><small>${t("共 {n} 套有记录", { n: props.length })}</small></div>
      <div class="kpi"><span>${t("在用的车辆")}</span><b>${liveVeh}</b><small>${t("共 {n} 辆有记录", { n: vehicles.length })}</small></div>
      <div class="kpi"><span>${t("账户")}</span><b>${accts.length}</b><small>${cashLike == null ? t("余额：执行 059 后可记") : t("余额合计 {a}", { a: money(cashLike) })}</small></div>
      ${nw ? `<a class="kpi" href="${href("bills", "networth")}"><span>${t("净资产")}</span><b class="${nw.netWorth < 0 ? "down" : ""}">${money(nw.netWorth)}</b><small>${t("资产 − 负债")} ›</small></a>` : ""}
      <div class="kpi"><span>${t("房产账单每月")}</span><b>${money(housing)}</b><small>${t("自己交的部分，不含 Escrow 代缴")}</small></div>
    </div>
    <div class="section-head"><h2>🏠 ${t("房产")}</h2>${state.houseEnabled ? `<a class="btn btn-sm btn-ghost" href="${href("house")}">${t("房产列表")}</a>` : ""}</div>
    <div class="panel">${props.length ? `<ul class="fa-list">${props.map((p) => propertyRow(p, spend, debts.filter((e) => e.property_id === p.id), eqOf("property", p.id))).join("")}</ul>` : `<div class="empty"><strong>${t("还没有房产")}</strong></div>`}</div>
    <p class="hint">${t("买入 / 卖出价在交易交割时写入（房屋 → 交易）；花费按记账时选的房产统计，账单缴费自动带上账单的房产。")}</p>
    <div class="section-head" style="margin-top:18px"><h2>🚗 ${t("车辆")}</h2><a class="btn btn-sm btn-ghost" href="${href("house", "vehicles")}">${t("车辆列表")}</a></div>
    <div class="panel">${vRows.length ? `<ul class="fa-list">${vRows.join("")}</ul>` : `<div class="empty"><strong>${t("还没有车辆")}</strong></div>`}
      ${loose.length ? `<p class="muted" style="margin:10px 4px 4px;font-size:13px">${t("还没关联车辆的车贷（在贷款详情里选车）：")} ${loose.map(debtLine).join(" · ")}</p>` : ""}</div>
    ${looseBillsHtml()}
    <div class="section-head" style="margin-top:18px"><h2>🏦 ${t("账户与余额")}</h2><a class="btn btn-sm btn-ghost" href="${href("bills", "cards")}">${t("卡与账户")}</a></div>
    ${acctRows.length ? `<ul class="fa-accts panel">${acctRows.join("")}</ul>` : `<div class="panel empty"><strong>${t("还没有登记账户")}</strong>${t("在 卡与账户 里添加支票、储蓄、券商、退休、HSA、贷款或现金账户。")}</div>`}
  </section>`;
}
