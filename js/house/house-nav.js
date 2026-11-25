/* 房屋区域的页头：[目录] 房屋 / 房产名 / 页面
 * 目录 = 嵌套目录（treePop）：房屋首页 → 每套房产（展开是它的 概览 / 房屋资料 / 账单 / 季节任务 / 设备保养 / 交易）→ 车辆；打开时当前房产展开、当前页高亮。
 * 房产之间直接切：链接带 ?prop=<房产 id>（app/route.js 进页面时会切到那套房产）。
 * 房屋资料的分区、交易的子页、转让这类更深的页面仍用自己带名字的面包屑（menu.js 的 crumb）。 */
import { esc } from "../core/util.js";
import { href } from "../core/router.js";
import { state } from "../core/state.js";
import { lang, t } from "../core/i18n.js";
import { treePop } from "../core/tree-pop.js";
import { KIND_ICON } from "../menu.js";
import { activeProperties } from "../core/lifecycle.js";
import { assetBillsHref } from "../bills/all-href.js";
import { activeVehicles, assetName } from "./assets-logic.js";

/** 一套房产下的页面（顺序同房产目录页）：[id, 名称, 图标] */
const PAGES = [["overview", "概览", "🏠"], ["profile", "房屋资料", "🏡"], ["bills", "账单", "🧾"], ["tasks", "季节任务", "📅"], ["assets", "设备保养", "⚙️"], ["deal", "交易", "📝"]];
/** 用页头（而不是面包屑）的页面；其余（模板、出了问题…）仍是面包屑 */
export const HOUSE_TOP = ["overview", "profile", "tasks", "assets", "deal", "supplies", "vehicles", "plan", "properties", "cars", "alerts"];
/** 更深一层的状态（资料分区、交易子页 / 历史 / 车辆交易）：用面包屑 */
export const houseDeep = (r) => { const q = r?.q; return !!q && ((r.sub === "profile" && q.get("sec")) || (r.sub === "deal" && (q.get("sec") || q.get("deal") || q.get("asset"))) || (r.sub === "plan" && q.get("k"))); };

/** 一辆车下面的页面：[id, 名称, 图标]；overview = 车辆枢纽页 #/asset/<id> */
const VEH_PAGES = [["overview", "车辆概览", "🚗"], ["profile", "车辆资料", "🚘"], ["log", "保养记录", "🛠️"], ["schedule", "保养时间表", "📋"], ["bills", "账单", "🧾"], ["deal", "交易", "📝"]];
/** 待办 / 注意事项的类别（和 todo-board.js 的 KINDS 一致） */
const TODO_KINDS = [["asset", "⚙️", "设备与车辆"], ["season", "📅", "季节任务"], ["deal", "📝", "交易"], ["house", "🧰", "耗材 · HOA · 保险"]];

/** 目录 = 四个一级目录页（各自是独立的一页，点一级入口就跳过去）：房产（每套房产 → 它的页面）· 汽车（每辆车 → 它的页面）· 买卖计划（四种指南）· 注意事项（四类）；打开时当前所在的一路展开 */
export function houseTree(r) {
  const sub = r?.sub || "menu", here = r?.section === "house", q = r?.q, todo = here && sub === "alerts" ? q?.get("todo") || "" : "";
  const props = activeProperties().map((p) => {
    const kids = PAGES.map(([id, name, icon]) => ({ label: t(name), icon, href: id === "bills" ? assetBillsHref(`property:${p.id}`) : `${href("house", id)}?prop=${encodeURIComponent(p.id)}`, current: here && sub === id && p.id === state.propertyId }));
    return { label: p.name, icon: KIND_ICON[p.kind] || "🏠", href: `${href("house", "overview")}?prop=${encodeURIComponent(p.id)}`, open: kids.some((x) => x.current), children: kids };
  });
  const onAsset = r?.section === "asset" ? r.sub : "", onDealAsset = here && sub === "deal" ? q?.get("asset") || "" : "";
  const cars = activeVehicles().map((a) => {
    const base = href("asset", a.id), sec = onAsset === a.id ? q?.get("sec") || (q?.get("log") ? "log" : "overview") : "";
    const kids = VEH_PAGES.map(([id, name, icon]) => ({ label: t(name), icon,
      href: id === "overview" ? base : id === "bills" ? assetBillsHref(`asset:${a.id}`) : id === "deal" ? `${href("house", "deal")}?asset=${encodeURIComponent(a.id)}` : `${base}?sec=${id}`,
      current: id === "deal" ? onDealAsset === a.id : sec === id }));
    return { label: assetName(a), icon: "🚗", href: base, open: kids.some((x) => x.current), children: kids };
  });
  const G = window.GUIDES || { KINDS: [], GUIDES: {} };
  const plans = G.KINDS.map((k) => { const g = G.GUIDES[k], nm = Array.isArray(g?.name) ? (lang === "en" ? g.name[1] : g.name[0]) : ""; return { label: lang === "en" ? nm : `我想${nm}`, icon: g?.icon || "🧭", href: `${href("house", "plan")}?k=${k}`, current: here && sub === "plan" && q?.get("k") === k }; });
  const todos = TODO_KINDS.map(([k, icon, nm]) => ({ label: t(nm), icon, href: `${href("house", "alerts")}?todo=${k}`, current: todo === k }));
  const group = (label, icon, children, hrefTo, cur = false) => ({ label, icon, href: hrefTo, current: cur, open: cur || children.some((c) => c.open || c.current), children });
  return [{ label: t("房屋首页"), icon: "🏠", href: href("house"), current: here && sub === "menu" },
    group(t("房产"), "🏠", props, href("house", "properties"), here && sub === "properties"),
    group(t("汽车"), "🚗", cars, href("house", "cars"), here && sub === "cars"),
    group(t("买卖计划"), "🧭", plans, href("house", "plan"), here && sub === "plan" && !q?.get("k")),
    group(t("注意事项"), "🔔", todos, href("house", "alerts"), here && sub === "alerts" && !todo)];
}

const NAME = { properties: "房产", cars: "汽车", alerts: "注意事项", plan: "买卖计划", overview: "概览", profile: "房屋资料", tasks: "季节任务", assets: "设备保养", deal: "交易", supplies: "汽车房屋消耗品", vehicles: "车辆" };
export function houseHead(r) {
  const sub = r?.sub || "menu", p = state.properties.find((x) => x.id === state.propertyId), root = `<a class="h-root" href="${esc(href("house"))}">${t("房屋")}</a>`;
  const veh = sub === "supplies" && r?.q?.get("veh") ? activeVehicles().find((a) => a.id === r.q.get("veh")) : null;   // 某辆车的消耗品页：房屋 / 汽车 / 车名 / 消耗品；否则按当前房产
  const path = sub === "menu" || !NAME[sub] ? t("房屋")
    : veh ? `${root} / <a class="h-root" href="${esc(href("house", "cars"))}">${t("汽车")}</a> / <a class="h-root" href="${esc(href("asset", veh.id))}">${esc(assetName(veh))}</a> / <b aria-current="page">${esc(t(NAME[sub]))}</b>`
    : sub === "vehicles" || sub === "plan" || sub === "properties" || sub === "cars" || sub === "alerts" ? `${root} / <b aria-current="page">${esc(t(NAME[sub]))}</b>`
      : `${root} / <a class="h-root" href="${esc(href("house", "properties"))}">${t("房产")}</a>${p ? ` / <a class="h-root" href="${esc(href("house", "overview"))}">${esc(p.name)}</a>` : ""} / <b aria-current="page">${esc(t(NAME[sub]))}</b>`;
  return `<div class="section-head fin-head sec-head"><div class="sh-title">${treePop(houseTree(r), { id: "housetree" })}<nav class="sec-path" aria-label="${esc(t("当前位置"))}">${path}</nav></div></div>`;
}
