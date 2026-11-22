/* 采购区域（采购首页、购物车、加入购物车、常去的商店、特价一览…）统一的页头：[目录] 采购 / 页面 …… [页面自己的操作]
 * 目录 = 整个采购的嵌套目录（treePop）：打开就停在当前页，「常去的商店」下面是 商店列表 / 特价一览 / 找附近的商店 / 更新记录。
 * 路径里的页面名都是导航；某家商店 / 某条特价的详情页、表单仍用自己带名字的面包屑。 */
import { esc } from "../core/util.js";
import { href } from "../core/router.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";
import { treePop } from "../core/tree-pop.js";

/** cur = home | list | add | shops-list | deals | find | log */
const PAGES = { home: [], list: ["购物车"], add: ["加入购物车"], "shops-list": ["常去的商店"], deals: ["常去的商店", "特价一览"], find: ["常去的商店", "找附近的商店"], log: ["常去的商店", "更新记录"] };

export function buyTree(cur) {
  const left = (state.shopping || []).filter((s) => s.status !== "bought").length;
  const shopsKids = [["shops-list", href("shops", "list"), "🏪", t("商店列表")], ["deals", href("shops", "deals"), "🏷", t("特价一览")], ["find", href("shops", "find"), "📍", t("找附近的商店")], ["log", href("shops", "log"), "📜", t("更新记录")]]
    .map(([id, h, icon, label]) => ({ label, icon, href: h, current: id === cur }));
  return [{ label: t("采购首页"), icon: "🛒", href: href("shopping"), current: cur === "home" },
    { label: t("购物车"), icon: "🛍️", href: href("shopping", "list"), badge: left || "", current: cur === "list" },
    { label: t("加入购物车"), icon: "＋", href: href("shopping", "add"), current: cur === "add" },
    { label: t("常去的商店"), icon: "🏪", href: href("shops", "list"), open: shopsKids.some((x) => x.current), children: shopsKids }];
}

/** suffix = 标题末尾要放的 html（购物车的「N 项」）；right = 右边的操作 html */
export function buyHead(cur, { suffix = "", right = "" } = {}) {
  const trail = (PAGES[cur] || []).map((x) => t(x)), root = t("采购");
  const mid = cur === "deals" || cur === "find" || cur === "log" ? `<a class="h-root" href="${esc(href("shops", "list"))}">${esc(trail[0])}</a> / ${esc(trail[1])}` : trail.map(esc).join(" / ");
  const path = trail.length ? `<a class="h-root" href="${esc(href("shopping"))}">${esc(root)}</a> / ${mid}` : esc(root);
  return `<div class="section-head fin-head"><div class="sh-title">${treePop(buyTree(cur), { id: "buytree" })}<h2>${path}${suffix}</h2></div>${right ? `<div class="head-acts">${right}</div>` : ""}</div>`;
}
