/* 财务 → 资产（2026-11，P1）：现有记录的「钱的视角」，不是另一份数据。
 * 房产（properties：状态、买入 / 卖出日期和价格，交易交割时写入）、车辆（assets kind=vehicle：拥有状态含贷款中、贷款到期、买入 / 卖出价）、
 * 账户（cards 里 kind 是支票 / 储蓄 / 券商 / 退休 / HSA / 贷款 / 现金的那些）。每行都链回房屋 / 车辆 / 卡与账户的原记录去改——只有一个真相来源。
 * 估值（市值）和余额是第三期（净资产快照）的事，这里不加字段，只标「P3」。
 * 数据量：房产、车辆、账单、卡都是启动时整表读进内存的小表，直接在内存里算；只有「今年这套房的花费」要扫花费明细，
 * 用现成的 spend_rollup 聚合（按月 × 分类 × 房产，和统计页共用缓存），不新增按行的查询。 */
import { state } from "../core/state.js";
import { href } from "../core/router.js";
import { esc, fmtDate, money, num } from "../core/util.js";
import { t } from "../core/i18n.js";
import { hubList } from "../core/hub.js";
import { isVehicle, myVehicles, assetName } from "../house/assets.js";
import { ACCOUNT_KINDS, cardHref, kindIcon, kindName } from "./cards.js";
import { spendRollupFor } from "../stats/views.js";

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

/** 车贷账单：bills 没有指向车辆的外键，按分类 car_loan 找；名字里带车名的归到那辆车，其余列在车辆区底下 */
function carLoanBills() {
  return state.billsEnriched.filter((b) => b.category === "car_loan" && b.active && !b.ended);
}
const billMatchesVehicle = (b, a) => { const n = String(assetName(a) || "").trim().toLowerCase(); return n.length >= 2 && String(b.name || "").toLowerCase().includes(n); };

const fact = (label, value) => (value ? `<span class="fa-fact"><small>${esc(label)}</small>${value}</span>` : "");
const priceDate = (price, date) => [price != null && price !== "" ? money(num(price)) : "", date ? esc(fmtDate(date)) : ""].filter(Boolean).join(" · ");

function propertyRow(p, spend) {
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
      ${fact(t("{y} 年花费", { y }), `${spent} · <a href="${href("bills", "spend")}?tab=records&prop=${encodeURIComponent(p.id)}&year=${y}">${t("明细")}</a>`)}
      ${fact(t("估值"), `<span class="muted">${t("P3")}</span>`)}
    </div></li>`;
}

function vehicleRow(a, loans) {
  const V = window.VEHICLES, v = a.vehicle || {}, st = V.statusOf(a);
  const loanTxt = loans.length ? loans.map((b) => `<a href="${href("bill", b.id)}">${esc(b.name)}</a> ${money(b.monthly)}${t("/月")}`).join(" · ") : "";
  return `<li class="fa-row">
    <div class="fa-head"><b>${esc(assetName(a))}</b><span class="badge ${V.STATUS[st]?.cls || ""}">${esc(t(V.STATUS[st]?.name || st))}</span>
      <a class="btn btn-sm btn-ghost fa-edit" href="${href("asset", a.id)}" aria-label="${esc(t("打开车辆 {name}", { name: assetName(a) }))}">${t("打开车辆")} ›</a></div>
    <div class="fa-facts">
      ${fact(t("买入"), priceDate(a.purchase_price, a.installed_on) || `<span class="muted">${t("未记录")}</span>`)}
      ${v.disposed_on || v.sale_price != null ? fact(st === "returned" ? t("归还") : t("卖出"), priceDate(v.sale_price, v.disposed_on)) : ""}
      ${st === "financed" || st === "leased" || v.loan_end ? fact(st === "leased" ? t("租约到期") : t("贷款到期"), v.loan_end ? esc(fmtDate(v.loan_end)) : `<span class="muted">${t("未填")}</span>`) : ""}
      ${fact(t("车贷账单"), loanTxt)}
      ${fact(t("估值"), `<span class="muted">${t("P3")}</span>`)}
    </div></li>`;
}

export function viewFinAssets() {
  const props = state.properties.filter((p) => !p.archived || p.purchase_price != null || p.sale_price != null);
  const spend = propertySpendThisYear();
  const vehicles = myVehicles().filter(isVehicle);
  const loans = carLoanBills(), used = new Set();
  const vRows = vehicles.map((a) => { const mine = loans.filter((b) => billMatchesVehicle(b, a)); mine.forEach((b) => used.add(b.id)); return vehicleRow(a, mine); });
  const loose = loans.filter((b) => !used.has(b.id));
  const accts = state.cards.filter((c) => ACCOUNT_KINDS.includes(c.kind) && c.active !== false);
  const held = props.filter((p) => !["sold", "moved_out", "looking"].includes(p.status) && !p.archived).length;
  const liveVeh = vehicles.filter((a) => window.VEHICLES.isActive(a) && window.VEHICLES.statusOf(a) !== "looking").length;
  const housing = props.reduce((s, p) => s + propertyBills(p.id).monthly, 0);
  const acctRows = ACCOUNT_KINDS.flatMap((k) => accts.filter((c) => c.kind === k).map((c) => `<a class="mrow" href="${esc(cardHref(c.id))}">
      <span class="mi" aria-hidden="true">${kindIcon(k)}</span>
      <span class="mt"><b>${esc(c.name)}${c.last4 ? ` ··${esc(c.last4)}` : ""}</b><small>${esc([kindName(k), c.issuer].filter(Boolean).join(" · "))} · ${t("余额：P3")}</small></span>
      <span class="mch" aria-hidden="true">›</span></a>`));
  return `<section class="section fin-assets">
    <p class="muted" style="margin:-6px 0 12px;font-size:13px">${t("房产、车辆和账户的钱的那一面；改资料回到原来的地方（房屋 / 车辆 / 卡与账户），这里只读")}</p>
    <div class="kpis">
      <div class="kpi"><span>${t("持有的房产")}</span><b>${held}</b><small>${t("共 {n} 套有记录", { n: props.length })}</small></div>
      <div class="kpi"><span>${t("在用的车辆")}</span><b>${liveVeh}</b><small>${t("共 {n} 辆有记录", { n: vehicles.length })}</small></div>
      <div class="kpi"><span>${t("账户")}</span><b>${accts.length}</b><small>${t("余额：P3")}</small></div>
      <div class="kpi"><span>${t("房产账单每月")}</span><b>${money(housing)}</b><small>${t("自己交的部分，不含 Escrow 代缴")}</small></div>
    </div>
    <div class="section-head"><h2>🏠 ${t("房产")}</h2>${state.houseEnabled ? `<a class="btn btn-sm btn-ghost" href="${href("house")}">${t("房产列表")}</a>` : ""}</div>
    <div class="panel">${props.length ? `<ul class="fa-list">${props.map((p) => propertyRow(p, spend)).join("")}</ul>` : `<div class="empty"><strong>${t("还没有房产")}</strong></div>`}</div>
    <p class="hint">${t("买入 / 卖出价在交易交割时写入（房屋 → 交易）；花费按记账时选的房产统计，账单缴费自动带上账单的房产。")}</p>
    <div class="section-head" style="margin-top:18px"><h2>🚗 ${t("车辆")}</h2><a class="btn btn-sm btn-ghost" href="${href("house", "vehicles")}">${t("车辆列表")}</a></div>
    <div class="panel">${vRows.length ? `<ul class="fa-list">${vRows.join("")}</ul>` : `<div class="empty"><strong>${t("还没有车辆")}</strong></div>`}
      ${loose.length ? `<p class="muted" style="margin:10px 4px 4px;font-size:13px">${t("没对上具体车辆的车贷账单（账单名里写上车名就会归到那辆车）：")} ${loose.map((b) => `<a href="${href("bill", b.id)}">${esc(b.name)}</a> ${money(b.monthly)}${t("/月")}`).join(" · ")}</p>` : ""}</div>
    <div class="section-head" style="margin-top:18px"><h2>🏦 ${t("账户")}</h2><a class="btn btn-sm btn-ghost" href="${href("bills", "cards")}">${t("卡与账户")}</a></div>
    ${acctRows.length ? hubList(acctRows) : `<div class="panel empty"><strong>${t("还没有登记账户")}</strong>${t("在 卡与账户 里添加支票、储蓄、券商、退休、HSA、贷款或现金账户。")}</div>`}
  </section>`;
}
