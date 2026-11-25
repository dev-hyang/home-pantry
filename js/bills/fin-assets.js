/* 财务 → 资产（2026-11，P1）：现有记录的「钱的视角」，不是另一份数据。
 * 房产（properties：状态、买入 / 卖出日期和价格，交易交割时写入）、车辆（assets kind=vehicle：拥有状态含贷款中、贷款到期、买入 / 卖出价）、
 * 账户（cards 里 kind 是支票 / 储蓄 / 券商 / 退休 / HSA / 贷款 / 现金的那些）。每行都链回房屋 / 车辆 / 卡与账户的原记录去改——只有一个真相来源。
 * 估值和余额（P3，迁移 059）：每处房产 / 车辆显示当前市值（最新估值；房产没有估值按购入价，标出来）和净值（市值 − 挂在上面的贷款），
 * 每个账户显示最新余额；就地「更新估值 / 更新余额」，历史折叠在下面（5 条一页）。估值、余额是自己的历史表，不改房屋 / 卡的原记录。
 * 融资（2026-11，P2 迁移 058）：贷款按 id 挂在房产 / 车辆上（debt_accounts.property_id / asset_id），不再按账单名里的车名猜；
 * 还没建贷款的贷款账单、没关联车辆的车贷列在区块底下，提示去关联。
 * 数据量：房产、车辆、账单、卡、贷款都是启动时整表读进内存的小表，直接在内存里算；只有「今年这套房的花费」要扫花费明细，
 * 用现成的 spend_rollup 聚合（按月 × 分类 × 房产，和统计页共用缓存），不新增按行的查询。 */
import { allBillsHref } from "./all-views.js";
import { state } from "../core/state.js";
import { href } from "../core/router.js";
import { esc, fmtDate, money, num } from "../core/util.js";
import { t } from "../core/i18n.js";
import { isVehicle, myVehicles, assetName } from "../house/assets.js";
import { ACCOUNT_KINDS, cardHref, kindIcon, kindName } from "./cards.js";
import { debtHref } from "./debt-logic.js";
import { isClosedStatus } from "../core/debt-rules.js";
import { looseBillsHtml } from "./debts.js";
import { valuationPanel } from "./net-worth.js";
import { liveNetWorth } from "./nw-logic.js";
import { debtsEnriched } from "./debt-logic-common.js";
import { balancePanel } from "./net-worth-panel.js";
import { spendRollupFor } from "../stats/spend-roll.js";
import { pageHead } from "../core/page-head.js";
import { infoTip } from "../core/info-tip.js";
import { ASSET_TABS } from "../core/tabs.js";

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

/** 一行一项：左边灰色标签，右边内容靠右（和周期性账单的行一个样子，不再用自动折行的多列格子） */
const fact = (label, value) => (value ? `<div class="fa-line"><span>${esc(label)}</span><span class="fa-val">${value}</span></div>` : "");
const priceDate = (price, date) => [price != null && price !== "" ? money(num(price)) : "", date ? esc(fmtDate(date)) : ""].filter(Boolean).join(" · ");

/** 右上角的大数字：市值，下面一行净值（没执行 059 / 没估值时给占位） */
function valueHead(eq) {
  if (!state.nwOk) return `<span class="fa-amt"><b class="muted">—</b></span>`;
  if (!eq) return "";
  const v = eq.value == null ? `<b class="muted">${t("未估值")}</b>` : `<b>${money(eq.value)}</b>`;
  const sub = eq.equity != null ? `${t("净值")} <span class="${eq.equity < 0 ? "down" : ""}">${money(eq.equity)}</span>` : (eq.source === "purchase" ? t("按购入价") : "");
  return `<span class="fa-amt">${v}${sub ? `<small>${sub}</small>` : ""}</span>`;
}
/** 行的外壳：第一行 名称 + 状态徽标 | 市值；第二行 灰色一句话；下面一行一项；最后是「打开」链接 */
const faRow = ({ name, badge, meta, eq, lines, openHref, panel }) => `<li class="ui-row fa-row">
    <div class="fa-top"><div class="fa-name"><b><a href="${openHref}">${esc(name)}</a></b>${badge}</div>${valueHead(eq)}</div>
    ${meta ? `<div class="fa-meta">${meta}</div>` : ""}
    <div class="fa-lines">${lines}</div>
    ${panel}</li>`;

function propertyRow(p, spend, loans = [], eq = null) {
  const ST = window.DEALS.PROPERTY_STATUS, K = window.BILLS.PROPERTY_KINDS;
  const bills = propertyBills(p.id), y = new Date().getFullYear();
  const spent = spend == null ? `<span class="muted">${t("读取中…")}</span>` : money(spend[p.id] || 0);
  const one = (state.medEnriched || []).filter((b) => b.property_id === p.id), oneBal = one.filter((b) => (b.currency || cur()) === cur()).reduce((s, b) => s + (b.balance || 0), 0);
  const oneTxt = one.length ? `${t("{n} 个一次性账单", { n: one.length })}${oneBal > 0 ? ` · ${t("余额 {a}", { a: money(oneBal) })}` : ""} · <a href="${allBillsHref({ type: "onetime", asset: `property:${p.id}` })}">${t("查看")}</a>` : "";
  const recTxt = bills.n ? `${money(bills.monthly)}${t("/月")}${bills.escrow ? ` <small class="muted">${t("+ Escrow {a}", { a: money(bills.escrow) })}</small>` : ""} · <a href="${allBillsHref({ type: "recurring", asset: `property:${p.id}` })}">${t("{n} 条账单", { n: bills.n })}</a>` : "";
  const meta = [t(K[p.kind] || ""), p.archived ? t("已归档") : ""].filter(Boolean).map(esc).join(" · ");
  return faRow({
    name: p.name, badge: `<span class="badge">${esc(t(ST[p.status] || "持有"))}</span>`, meta, eq,
    lines: [
      fact(t("买入"), priceDate(p.purchase_price, p.acquired_on) || `<span class="muted">${t("未记录")}</span>`),
      p.sold_on || p.sale_price != null ? fact(t("卖出"), priceDate(p.sale_price, p.sold_on)) : "",
      fact(t("账单"), recTxt || `<span class="muted">${t("没有挂账单")}</span>`),
      fact(t("一次性"), oneTxt),
      ...loans.map((e) => fact(t("贷款"), debtLine(e))),
      fact(t("{y} 年花费", { y }), `${spent} · <a href="${href("bills", "spend")}?tab=records&prop=${encodeURIComponent(p.id)}&year=${y}">${t("明细")}</a>`),
    ].join(""),
    openHref: `${href("house", "overview")}?prop=${encodeURIComponent(p.id)}`,
    panel: eq ? valuationPanel("property", p, { fallback: eq.source === "purchase" ? eq.value : null }) : "",
  });
}

function vehicleRow(a, loans, eq = null) {
  const V = window.VEHICLES, v = a.vehicle || {}, st = V.statusOf(a);
  return faRow({
    name: assetName(a), badge: `<span class="badge ${V.STATUS[st]?.cls || ""}">${esc(t(V.STATUS[st]?.name || st))}</span>`, meta: "", eq,
    lines: [
      fact(t("买入"), priceDate(a.purchase_price, a.installed_on) || `<span class="muted">${t("未记录")}</span>`),
      v.disposed_on || v.sale_price != null ? fact(st === "returned" ? t("归还") : t("卖出"), priceDate(v.sale_price, v.disposed_on)) : "",
      st === "financed" || st === "leased" || v.loan_end ? fact(st === "leased" ? t("租约到期") : t("贷款到期"), v.loan_end ? esc(fmtDate(v.loan_end)) : `<span class="muted">${t("未填")}</span>`) : "",
      ...loans.map((e) => fact(t("车贷"), debtLine(e))),
    ].join(""),
    openHref: href("asset", a.id),
    panel: eq ? valuationPanel("vehicle", a) : "",
  });
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
  const acctRows = [...ACCOUNT_KINDS, "credit"].flatMap((k) => [...accts, ...credit].filter((c) => c.kind === k).map((c) => `<li class="fa-acct"><a class="ui-row mrow" href="${esc(cardHref(c.id))}">
      <span class="mi" aria-hidden="true">${kindIcon(k)}</span>
      <span class="mt"><b>${esc(c.name)}${c.last4 ? ` ··${esc(c.last4)}` : ""}</b><small>${esc([kindName(k), c.issuer].filter(Boolean).join(" · "))} · ${esc(balTxt(c))}</small></span>
      <span class="ui-chev" aria-hidden="true">›</span></a>${acctOf(c.id)?.viaDebt ? "" : balancePanel(c)}</li>`));
  const cashLike = nw ? nw.assets.cash + nw.assets.investments + nw.assets.retirement + nw.assets.hsa : null;
  return `<section class="section fin-assets">
    ${pageHead({ icon: "🏛️", title: t("资产"), tabs: ASSET_TABS, tab: "assets", hrefOf: (id) => href("bills", id), label: t("资产内容"), plain: true, note: infoTip.classic(t("房产、车辆和账户的钱的那一面；改资料回到原来的地方（房屋 / 车辆 / 卡与账户），这里只读"), { align: "start" }) })}
    <div class="kpis">
      <div class="kpi"><span>${t("持有的房产")}</span><b>${held}</b><small>${t("共 {n} 套有记录", { n: props.length })}</small></div>
      <div class="kpi"><span>${t("在用的车辆")}</span><b>${liveVeh}</b><small>${t("共 {n} 辆有记录", { n: vehicles.length })}</small></div>
      <div class="kpi"><span>${t("账户")}</span><b>${accts.length}</b><small>${cashLike == null ? t("余额：执行 059 后可记") : t("余额合计 {a}", { a: money(cashLike) })}</small></div>
      ${nw ? `<div class="kpi"><span>${t("净资产")}</span><b class="${nw.netWorth < 0 ? "down" : ""}">${money(nw.netWorth)}</b><small>${t("资产 − 负债")}</small></div>` : ""}
      <div class="kpi"><span>${t("房产账单每月")}</span><b>${money(housing)}</b><small>${t("自己交的部分，不含 Escrow 代缴")}</small></div>
    </div>
    <div class="section-head"><h2>🏠 ${t("房产")}</h2>${state.houseEnabled ? `<a class="ui-btn" data-size="sm" data-tone="ghost" href="${href("house", "properties")}">${t("房产列表")}</a>` : ""}</div>
    <div class="panel">${props.length ? `<ul class="fa-list">${props.map((p) => propertyRow(p, spend, debts.filter((e) => e.property_id === p.id), eqOf("property", p.id))).join("")}</ul>` : `<div class="empty"><strong>${t("还没有房产")}</strong></div>`}</div>
    <p class="hint">${t("买入 / 卖出价在交易交割时写入（房屋 → 交易）；花费按记账时选的房产统计，账单缴费自动带上账单的房产。")}</p>
    <div class="section-head" style="margin-top:18px"><h2>🚗 ${t("车辆")}</h2><a class="ui-btn" data-size="sm" data-tone="ghost" href="${href("house", "cars")}">${t("车辆列表")}</a></div>
    <div class="panel">${vRows.length ? `<ul class="fa-list">${vRows.join("")}</ul>` : `<div class="empty"><strong>${t("还没有车辆")}</strong></div>`}
      ${loose.length ? `<p class="muted" style="margin:10px 4px 4px;font-size:13px">${t("还没关联车辆的车贷（在贷款详情里选车）：")} ${loose.map(debtLine).join(" · ")}</p>` : ""}</div>
    ${looseBillsHtml()}
    <div class="section-head" style="margin-top:18px"><h2>🏦 ${t("账户与余额")}</h2><a class="ui-btn" data-size="sm" data-tone="ghost" href="${href("bills", "accounts")}">${t("卡与账户")}</a></div>
    ${acctRows.length ? `<ul class="fa-accts panel">${acctRows.join("")}</ul>` : `<div class="panel empty"><strong>${t("还没有登记账户")}</strong>${t("在 卡与账户 里添加支票、储蓄、券商、退休、HSA、贷款或现金账户。")}</div>`}
  </section>`;
}
