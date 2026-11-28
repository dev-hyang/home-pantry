/* 储藏页面导航（每个储藏页顶上都要同步用到）。 */
import { esc, inSpace, isGear } from "../core/util.js";
import { href } from "../core/router.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";
import { treePop } from "../core/tree-pop.js";

/** 储藏的页面导航（2026-11-21 起和财务一样）：页顶一行「[目录] 储藏 / 当前页」，目录里列出 概览 / 库存 / 菜单 / 录入购物（购物车在底部导航，家居耐用品并进了库存），
 *  当前页高亮；库存带要补货的件数。路径只是导航文字（页面自己的标题在下面），不再另画上面的面包屑 */
/** 库存下面的二级目录（日常消耗品 / 汽车房屋消耗品 / 家居耐用品）：id、图标、名称、地址、有没有开、要补货的件数。概览的三张卡片也链到这里 */
export const INV_SUBS = [
  ["pantry", "🥫", "日常消耗品", () => `${href("pantry", "inventory")}?space=pantry`, () => true],
  ["house", "🧰", "汽车房屋消耗品", () => `${href("pantry", "inventory")}?space=house`, () => state.houseEnabled],
  ["gear", "🛋️", "家居耐用品", () => href("pantry", "gear"), () => state.gearEnabled],
];
/** 当前页在目录里的位置：「inventory」= 库存全部，「inventory:pantry」等 = 库存下的某一组，其余是页面 id */
export const pantryCur = (r) => (r.sub === "gear" ? "inventory:gear" : r.sub === "inventory" ? (["pantry", "house"].includes(r.q?.get("space")) ? `inventory:${r.q.get("space")}` : "inventory") : r.sub);
/** 目录里的「采购」一组（2026-11-27.26 起采购不再是单独的页签，并进储藏）：cur = "buy:home | list | add | shops-list | deals | find | log" 时停在那一页 */
function buyNode(cur) {
  const left = (state.shopping || []).filter((x) => x.status !== "bought").length, on = (id) => cur === `buy:${id}`;
  const shops = [["shops-list", href("shops", "list"), "🏪", "商店列表"], ["deals", href("shops", "deals"), "🏷", "特价一览"], ["find", href("shops", "find"), "📍", "找附近的商店"], ["log", href("shops", "log"), "📜", "更新记录"]]
    .map(([id, h, icon, label]) => ({ label: t(label), icon, href: h, current: on(id) }));
  const kids = [{ label: t("购物车"), icon: "🛍️", href: href("shopping", "list"), badge: left || "", current: on("list") || on("add") },
    { label: t("常去的商店"), icon: "🏪", href: href("shops", "list"), open: shops.some((x) => x.current), children: shops }];
  return { label: t("采购"), icon: "🛒", href: href("shopping"), badge: left || "", current: on("home"), open: cur.startsWith("buy:"), children: kids };
}
/** 储藏目录的结点（页头和深层页面的目录按钮共用） */
export function pantryNodes(cur) {
  const items = state.enriched || [], need = items.filter((x) => !isGear(x) && x.status !== "ok").length;
  const needIn = (sp) => (sp === "gear" ? 0 : items.filter((x) => inSpace(sp)(x) && x.status !== "ok").length);
  const kids = INV_SUBS.filter(([, , , , on]) => on()).map(([id, icon, name, h]) => ({ label: t(name), icon, href: h(), badge: needIn(id) || "", current: cur === `inventory:${id}` }));
  const inv = { label: t("库存"), icon: "📦", href: href("pantry", "inventory"), badge: need || "", current: cur === "inventory", open: cur.startsWith("inventory"), children: kids };
  return [{ label: t("概览"), icon: "📊", href: href("pantry"), current: cur === "overview" }, buyNode(cur), inv,
    { label: t("购买排行"), icon: "🏆", href: href("pantry", "buys"), current: cur === "buys" },
    { label: t("菜单"), icon: "🍳", href: href("pantry", "meals"), current: cur === "meals" }, { label: t("录入购物"), icon: "🧾", href: href("pantry", "scan"), current: cur === "scan" }];
}
/** 页头路径：储藏 / 库存 / 日常消耗品（库存下的某一组时多一层，库存可点回全部） */
export function pantryNav(cur) {
  const nodes = pantryNodes(cur), top = { overview: "概览", inventory: "库存", buys: "购买排行", meals: "菜单", scan: "录入购物" };
  const sub = cur.startsWith("inventory:") ? INV_SUBS.find(([id]) => id === cur.slice(10)) : null;
  const path = sub ? ` / <a href="${esc(href("pantry", "inventory"))}">${t("库存")}</a> / <b aria-current="page">${esc(t(sub[2]))}</b>`
    : top[cur] ? ` / <b aria-current="page">${esc(t(top[cur]))}</b>` : "";
  return `<div class="section-head fin-head sec-head"><div class="sh-title">${treePop(nodes, { id: "pantrytree" })}<nav class="sec-path" aria-label="${esc(t("当前位置"))}"><a class="h-root" href="${esc(href("pantry"))}">${t("储藏")}</a>${path}</nav></div></div>`;
}
