/* 储藏概览 · 最近入库 / 新物品两张卡片：数字和点进去的库存列表同一个口径（stocked.js），点进去列表顶上写明规则和件数，方便核对。
 * 最近入库 = 近 7 天的「补货入库 + 新建物品」：新建的物品带着初始库存进来，也是入库（以前只算补货，录入购物里新建的物品不在这张卡里，是漏洞）；
 * 新物品 = 近 30 天新建的（只看新建；新建物品不常发生，窗口放长）。两张卡会有重叠，数字和点进去的清单是同一个口径。 */
import { state } from "../core/state.js";
import { esc, inSpace } from "../core/util.js";
import { t } from "../core/i18n.js";
import { href } from "../core/router.js";
import { invSpaces } from "./inv-sync-common.js";
import { addedMatch } from "./stocked.js";

export const RECENT = { restock: { days: 7, kind: "all", icon: "📥", name: "最近入库", how: "补货或新入库" }, fresh: { days: 30, kind: "new", icon: "🆕", name: "新物品", how: "第一次建进库存" } };
const scope = () => state.enriched.filter((x) => invSpaces().some((s) => inSpace(s)(x)));
/** 一张卡片：整张是链接，去库存的物品视图（按最近入库排序、套上同一个时间范围） */
function card(c) {
  const n = scope().filter((x) => addedMatch(x, c.days, c.kind)).length, url = `${href("pantry", "inventory")}?added=${c.days}&kind=${c.kind}`;
  return `<a class="ov-card" href="${esc(url)}" aria-label="${esc(`${t(c.name)}，${t("近 {d} 天", { d: c.days })}，${t("共 {n} 件", { n })}`)}">
    <span class="ov-top"><span class="ov-ico" aria-hidden="true">${c.icon}</span><span class="ov-total"><b>${n}</b><small>${t("件")}</small></span></span>
    <span class="ov-name">${esc(t(c.name))}</span><span class="ov-tags"><small class="muted">${esc(t("近 {d} 天", { d: c.days }))} · ${esc(t(c.how))}</small></span></a>`;
}
export const recentCards = () => [RECENT.restock, RECENT.fresh].map(card).join("");
