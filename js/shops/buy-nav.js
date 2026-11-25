/* 采购区域（采购首页、购物车、加入购物车、常去的商店、特价一览…）统一的页头：[目录] 采购 / 页面 …… [页面自己的操作]
 * 目录 = 整个采购的嵌套目录（treePop）：打开就停在当前页，「常去的商店」下面是 商店列表 / 特价一览 / 找附近的商店 / 更新记录。
 * 路径里的页面名都是导航；某家商店 / 某条特价的详情页、表单仍用自己带名字的面包屑。 */
import { href } from "../core/router.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";
import { treePop } from "../core/tree-pop.js";
import { pathHead } from "../core/page-path.js";

/** cur = home | list | add | shops-list | deals | find | log */
const PAGES = { home: [], list: ["购物车"], add: ["购物车", "加入购物车"], "shops-list": ["常去的商店"], deals: ["常去的商店", "特价一览"], find: ["常去的商店", "找附近的商店"], log: ["常去的商店", "更新记录"] };

export function buyTree(cur) {
  const left = (state.shopping || []).filter((s) => s.status !== "bought").length;
  const shopsKids = [["shops-list", href("shops", "list"), "🏪", t("商店列表")], ["deals", href("shops", "deals"), "🏷", t("特价一览")], ["find", href("shops", "find"), "📍", t("找附近的商店")], ["log", href("shops", "log"), "📜", t("更新记录")]]
    .map(([id, h, icon, label]) => ({ label, icon, href: h, current: id === cur }));
  return [{ label: t("采购首页"), icon: "🛒", href: href("shopping"), current: cur === "home" },
    { label: t("购物车"), icon: "🛍️", href: href("shopping", "list"), badge: left || "", current: cur === "list" || cur === "add" },
    { label: t("常去的商店"), icon: "🏪", href: href("shops", "list"), open: shopsKids.some((x) => x.current), children: shopsKids }];
}

/** suffix = 标题末尾要放的 html（购物车的「N 项」）；right = 右边的操作 html。画法和财务页头一样（core/page-path.js）：路径行置顶，下面一行标题 */
export function buyHead(cur, { suffix = "", right = "" } = {}) {
  const names = (PAGES[cur] || []).map((x) => t(x)), trail = [{ href: names.length ? href("shopping") : "", label: t("采购") }];
  names.forEach((label, i) => trail.push({ href: i < names.length - 1 ? (label === t("购物车") ? href("shopping", "list") : href("shops", "list")) : "", label }));
  return pathHead({ treeHtml: treePop(buyTree(cur), { id: "buytree" }), trail, title: trail[trail.length - 1].label, after: suffix, right });
}
