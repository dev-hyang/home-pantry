/* 储藏概览 · 购买洞察：最常购买（次数）、花费最多（金额，要财务权限）两张卡片，数据是近 90 天的购买（buys-load.js 读一次、10 分钟内不重读）。
 * 点进去是「购买排行」，同样的排序和时间范围，点开一行能看到每一笔，方便核对卡片上的数字。 */
import { esc, money } from "../core/util.js";
import { t } from "../core/i18n.js";
import { href } from "../core/router.js";
import { financeOk } from "../core/finance-access.js";
import { sortBuys } from "./buys-data.js";
import { dealCount, dealOf, dealShort, dealsSort } from "./buys-deals.js";
import { buysFor } from "./buys-load.js";

function card(sort, icon, name, big, who) {
  const url = `${href("pantry", "buys")}?sort=${sort}&range=90`;
  return `<a class="ov-card" href="${esc(url)}" aria-label="${esc(`${name}，${who || ""} ${big}`)}">
    <span class="ov-top"><span class="ov-ico" aria-hidden="true">${icon}</span><span class="ov-total"><b>${esc(big)}</b></span></span>
    <span class="ov-name">${esc(name)}</span><span class="ov-tags"><small class="muted">${esc(who || "")}</small></span></a>`;
}
/** 特价命中：常买的物品里现在有特价的，点进去按「有特价的」排 */
function dealCard(groups) {
  const n = groups ? dealCount(groups) : 0, top = groups && n ? dealsSort(groups)[0] : null, d = top && dealOf(top);
  return card("deals", "🏷️", t("特价命中"), !groups ? "…" : t("{n} 样", { n }), !groups ? t("正在读取…") : d ? `${top.name} · ${dealShort(d)}` : t("常买的东西现在没有特价"));
}
/** 三张（没有财务权限少一张）；还在读的时候显示 …，读完会自动重画 */
export function buysCards() {
  const e = buysFor(90), fin = financeOk(), loading = !e.groups;
  const top = loading ? null : sortBuys(e.groups, "count")[0], rich = loading || !fin ? null : sortBuys(e.groups, "spend")[0];
  const sub = (g) => (g ? `${g.name} · ${t("近 {d} 天", { d: 90 })}` : loading ? t("正在读取…") : t("近 90 天还没有购买记录"));
  return [card("count", "🛍️", t("最常购买"), loading ? "…" : top ? t("{n} 次", { n: top.n }) : "—", sub(top)),
    fin ? card("spend", "💸", t("花费最多"), loading ? "…" : rich ? money(rich.spend) : "—", sub(rich)) : "", dealCard(e.groups)].join("");
}
