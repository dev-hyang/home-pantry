/* 房屋 / 车辆 → 账单（#/bills/assetbills/<资产键>）：这个资产上设置的全部账单（周期性 + 一次性）。
 * 上面一行 = 这个资产自己的合计（应付 / 已付 / 余额，只算挂在这个资产上的账单，含预估会标出来）；
 * 下面 = 固定清单：一张账单一张卡，左右滑动、可自动换下一张（和今日页同一个滑动组件，控制行 + ⚙ 放在卡片上面）。
 * 没有筛选：时间范围默认本月（链接带 ?range= 的照链接），卡片不随时间变；右下角圆形 ＋ 添加账单。 */
import { state } from "../core/state.js";
import { esc, fmtDate } from "../core/util.js";
import { href } from "../core/router.js";
import { t } from "../core/i18n.js";
import { eyeFilter } from "../core/filter-pop.js";
import { infoTip } from "../core/info-tip.js";
import { crumbNav } from "../core/hub.js";
import { finHead } from "./fin-head.js";
import { finBase, houseCars, houseProps } from "../core/crumb-base.js";
import { propertyName } from "../core/alerts.js";
import { carouselHtml } from "../core/carousel.js";
import { fabHtml } from "./bill-fab.js";
import { BILL_RANGES } from "./instances.js";
import { allCompute, assetKeyLabel, summaryHtml } from "./all-views.js";
import { assetBillCards } from "./asset-bill-cards.js";
import { billHeadCard } from "./bill-pay.js";
import { medHeadCard } from "./medical-head.js";

/** 网址里的清单键：资产（property:ID / asset:ID / person:ID）；或 recurring（全部周期性账单）、general（没挂资产的）、vehicle（车辆类）；不合法就当没有 */
const routeKey = () => { try { const k = decodeURIComponent(state.route?.id || ""); return /^(property:|asset:|person:)[\w-]+$/.test(k) || ["recurring", "general", "vehicle"].includes(k) ? k : ""; } catch { return ""; } };
const labelOf = (key) => (key === "recurring" ? `🔁 ${t("周期性账单")}` : assetKeyLabel(key));
export { assetBillsHref } from "./all-href.js";   // 网址生成在 all-href.js（房屋 / 车辆页拼链接不必加载整个页面）

/** 统计用的时间范围：链接带 ?range= 的照链接，否则本月 */
const rangeOf = () => { const r = state.route?.q?.get("range"); return r && BILL_RANGES.some(([k]) => k === r) ? r : "m"; };
/** 面包屑的上层：房产 = 房屋 / 房产名（点房产名回它的概览）；车辆 / 设备 = 房屋 / 它自己的页面；其余清单（全部周期性、家庭通用、车辆）= 财务 */
function backParts(key) {
  const [type, id] = key.split(":");
  if (type === "property") return [...houseProps(), { href: `${href("house", "overview")}?prop=${encodeURIComponent(id)}`, label: propertyName(id) || t("房产"), icon: "🏠" }];
  if (type === "asset") return [...(state.assets.find((x) => x.id === id)?.kind === "vehicle" ? houseCars() : houseProps()), { href: href("asset", id), label: assetKeyLabel(key).replace(/^\S+\s/, "") }];
  return finBase("assetbills");
}

/** 一张卡 = 账单详情页顶上那张概要卡（周期性 billHeadCard / 一次性 medHeadCard），带「周期性 / 一次性」标记和同样的 ⋯ 菜单 */
const cardHtml = ({ kind, b }) => (kind === "onetime" ? medHeadCard(b, { listed: true }) : billHeadCard(b, href("bill", b.id), { listed: true }));

/** 页面上只留关键信息一行：时间范围 + 几张账单；长说明（合计口径、逾期、预估）收进标题旁的 ⓘ */
function keyLine(C, range, n) {
  const scope = range === "all" ? t("不限时间") : `${fmtDate(C.from)} – ${fmtDate(C.to)}`;
  return t("{r}（{s}） · 共 {n} 张账单", { r: t(BILL_RANGES.find(([k]) => k === range)?.[1] || range), s: scope, n });
}
const tipText = () => t("合计只算这个清单里的账单；逾期没缴的一直计入，不受时间范围限制；含预估的金额会标出来。账单卡片不随时间范围变。");

export function viewAssetBills() {
  const key = routeKey();
  if (!key) return `<section class="section"><div class="panel empty"><strong>${t("找不到这个资产")}</strong><p><a class="btn btn-sm" href="${href("bills", "all")}">${t("全部账单")}</a></p></div></section>`;
  const range = rangeOf(), C = allCompute({ key, q: "", range, asset: key === "recurring" ? "all" : key, type: key === "recurring" ? "recurring" : "all", cat: "all", status: "all", pay: "all", sort: "due" });
  const label = labelOf(key), name = label.replace(/^\S+\s/, ""), ico = label.split(" ")[0];
  const cards = assetBillCards(key, state.billsEnriched, state.medEnriched);
  const body = cards.length
    ? `<section class="section" aria-label="${esc(t("账单卡片"))}">${carouselHtml(`assetbills:${key}`, cards.map(cardHtml), { label: t("账单卡片：左右滑动，或点上面的短划线"), top: true, numbered: true })}</section>`
    : `<div class="panel empty"><strong>${t("这个资产还没有设置账单")}</strong>${t("点右下角的 ＋ 添加账单。")}</div>`;
  return `<section class="section" id="assetBillsPage">
    ${key === "recurring" ? finHead({ label: name, note: infoTip.classic(tipText(), { align: "start" }), right: eyeFilter() })   // 周期性账单：财务页头；某个房产 / 车辆的账单仍带自己的路径（回到那个资产）
      : `${crumbNav([...backParts(key), { label: t("账单"), icon: "🧾" }])}
    <div class="section-head"><h2>${ico} ${esc(name)} · ${t("账单")} ${infoTip.classic(tipText(), { align: "start" })}</h2><div class="head-acts">${eyeFilter()}</div></div>`}
    <p class="muted kinds-note" role="status">${esc(keyLine(C, range, cards.length))}</p>
    ${summaryHtml({ SK: C.S, truncated: 0 })}
    ${body}
  </section>${fabHtml()}`;
}
