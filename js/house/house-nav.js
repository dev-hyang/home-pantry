/* 房屋区域的页头：[目录] 房屋 / 房产名 / 页面
 * 目录 = 嵌套目录（treePop）：房屋首页 → 每套房产（展开是它的 概览 / 房屋资料 / 账单 / 季节任务 / 设备保养 / 交易）→ 车辆；打开时当前房产展开、当前页高亮。
 * 房产之间直接切：链接带 ?prop=<房产 id>（app/route.js 进页面时会切到那套房产）。
 * 房屋资料的分区、交易的子页、转让这类更深的页面仍用自己带名字的面包屑（menu.js 的 crumb）。 */
import { esc } from "../core/util.js";
import { href } from "../core/router.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";
import { treePop } from "../core/tree-pop.js";
import { KIND_ICON } from "../menu.js";
import { activeProperties } from "../core/lifecycle.js";
import { assetBillsHref } from "../bills/all-href.js";
import { activeVehicles, assetName } from "./assets-logic.js";

/** 一套房产下的页面（顺序同房产目录页）：[id, 名称, 图标] */
const PAGES = [["overview", "概览", "🏠"], ["profile", "房屋资料", "🏡"], ["bills", "账单", "🧾"], ["tasks", "季节任务", "📅"], ["assets", "设备保养", "⚙️"], ["deal", "交易", "📝"]];
/** 用页头（而不是面包屑）的页面；其余（模板、出了问题…）仍是面包屑 */
export const HOUSE_TOP = ["overview", "profile", "tasks", "assets", "deal", "supplies", "vehicles"];
/** 更深一层的状态（资料分区、交易子页 / 历史 / 车辆交易）：用面包屑 */
export const houseDeep = (r) => { const q = r?.q; return !!q && ((r.sub === "profile" && q.get("sec")) || (r.sub === "deal" && (q.get("sec") || q.get("deal") || q.get("asset")))); };

export function houseTree(r) {
  const sub = r?.sub || "menu", here = r?.section === "house";
  const props = activeProperties().map((p) => {
    const kids = PAGES.map(([id, name, icon]) => ({ label: t(name), icon, href: id === "bills" ? assetBillsHref(`property:${p.id}`) : `${href("house", id)}?prop=${encodeURIComponent(p.id)}`, current: here && sub === id && p.id === state.propertyId }));
    return { label: p.name, icon: KIND_ICON[p.kind] || "🏠", href: `${href("house", "overview")}?prop=${encodeURIComponent(p.id)}`, open: here && sub !== "menu" && p.id === state.propertyId, children: kids };
  });
  const cars = activeVehicles().map((a) => ({ label: assetName(a), icon: "🚗", href: href("asset", a.id) }));
  return [{ label: t("房屋首页"), icon: "🏠", href: href("house"), current: here && sub === "menu" }, ...props,
    ...(cars.length ? [{ label: t("汽车"), icon: "🚗", href: href("house"), children: cars }] : [])];
}

const NAME = { overview: "概览", profile: "房屋资料", tasks: "季节任务", assets: "设备保养", deal: "交易", supplies: "汽车房屋消耗品", vehicles: "车辆" };
export function houseHead(r) {
  const sub = r?.sub || "menu", p = state.properties.find((x) => x.id === state.propertyId), root = `<a class="h-root" href="${esc(href("house"))}">${t("房屋")}</a>`;
  const path = sub === "menu" || !NAME[sub] ? t("房屋")
    : sub === "supplies" || sub === "vehicles" ? `${root} / <b aria-current="page">${esc(t(NAME[sub]))}</b>`
      : `${root}${p ? ` / <a class="h-root" href="${esc(href("house", "overview"))}">${esc(p.name)}</a>` : ""} / <b aria-current="page">${esc(t(NAME[sub]))}</b>`;
  return `<div class="section-head fin-head sec-head"><div class="sh-title">${treePop(houseTree(r), { id: "housetree" })}<nav class="sec-path" aria-label="${esc(t("当前位置"))}">${path}</nav></div></div>`;
}
