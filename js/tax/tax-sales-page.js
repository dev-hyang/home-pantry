/* 税务 → 买卖与成本基础：页面入口。
 *  · 列表：每套房 / 每辆已卖出的车一张卡片（买入价、卖出价、收益摘要），点卡片进该资产的详情（?tab=sales&a=资产 id）；
 *  · 详情：一套房的 ①→⑦ 清单（homeCard）或一辆车的收益（carCard），面包屑多一层资产名（tax-page.js 的页头）。
 * 计算和清单的画法在 tax-sales.js；这里只管「列表 / 详情」二选一。 */
import { esc } from "../core/util.js";
import { lang, t } from "../core/i18n.js";
import { state } from "../core/state.js";
import { href } from "../core/router.js";
import { ensureSpend } from "./tax-links.js";
import { buyPriceOf, carCard, carGain, homeCard, homeGain } from "./tax-sales.js";
import { render } from "../app/render.js";

const money = (n) => `<span data-money>${Units.money(n)}</span>`;
const NA = `<span class="muted">—</span>`;
const tx = (zh, en) => (lang === "en" ? en : zh);
export const salesHref = (id) => `${href("bills", "tax")}?tab=sales${id ? `&a=${encodeURIComponent(id)}` : ""}`;

/** 能在买卖页里算的房子 / 已卖出的车 */
export const salesHomes = () => (state.properties || []).filter((p) => p.role !== "tenant" && !["looking", "renting", "moved_out"].includes(p.status));
export const salesCars = () => (state.assets || []).filter((a) => a.kind === "vehicle" && ["sold", "returned"].includes(a.vehicle?.status || ""));
export const carName = (a) => a.name || a.model || t("车辆");

/** 一行结论：收益 / 亏损 / 缺价 */
function verdict(gain, ready) {
  if (!ready) return `<span class="muted">${t("还缺买入价或卖出价")}</span>`;
  return gain < 0 ? `<b>${t("亏损 {a}", { a: money(-gain) })}</b>` : `<b>${t("收益 {a}", { a: money(gain) })}</b>`;
}
const card = (id, icon, name, tag, buy, sale, v) => `<a class="panel dt-block tax-sum tax-acard" href="${esc(salesHref(id))}"><div class="tax-sum-body"><h3>${icon} ${esc(name)}${tag ? ` <span class="muted">${esc(tag)}</span>` : ""}</h3>
    <p class="muted">${t("买入价")} ${buy != null ? money(buy) : NA} · ${t("卖出价")} ${sale != null ? money(sale) : NA}</p><p>${v}</p></div><span class="ui-chev" aria-hidden="true">›</span></a>`;

function homeSummary(p) {
  const g = homeGain(p), buy = buyPriceOf(p).price, sale = p.sale_price != null ? Number(p.sale_price) : null;
  return card(p.id, "🏡", p.name, tx(p.role === "landlord" ? "出租" : "自住", p.role === "landlord" ? "rental" : "owner-occupied"), buy, sale, verdict(g.gain, g.ready));
}
function carSummary(a) {
  const g = carGain(a);
  return card(a.id, "🚗", carName(a), "", g.buy, g.sale, verdict(g.gain, g.gain != null));
}

export function salesTab() {
  const homes = salesHomes(), cars = salesCars(), id = state.route?.q?.get("a") || "";
  ensureSpend(homes.map((p) => p.id), () => render(false));   // 这几套房关联的花费：读一次，读完重画
  const home = homes.find((p) => p.id === id), car = cars.find((a) => a.id === id);
  if (home) return homeCard(home);
  if (car) return carCard(car);
  return `<p class="muted tax-wrap">${t("卖房、卖车前后的收益参考。买入价、卖出价来自 房屋 / 车辆 里已有的记录；费用、退款、装修翻新、住满与否记在这里，一项一项加。参考用，以 TurboTax 和官方说明为准。点一张卡片进去看和填。")}</p>
    <h3 class="tax-sub">${t("房子")}</h3><div class="tax-cards">${homes.map(homeSummary).join("") || `<p class="muted">${t("还没有房产。")}</p>`}</div>
    <h3 class="tax-sub">${t("已卖出的车")}</h3><div class="tax-cards">${cars.map(carSummary).join("") || `<p class="muted">${t("还没有卖出的车。卖车时在车辆的交易里走「卖车」流程，价格记在那里。")}</p>`}</div>`;
}
/** 页头最后一层：当前打开的资产名（没有 = 空） */
export function salesLeaf() {
  const id = state.route?.q?.get("a"); if (!id) return "";
  const p = salesHomes().find((x) => x.id === id), a = salesCars().find((x) => x.id === id);
  return p ? p.name : a ? carName(a) : "";
}
