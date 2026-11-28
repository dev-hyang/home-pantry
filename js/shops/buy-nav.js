/* 采购（采购首页、购物车、加入购物车、常去的商店、特价一览…）统一的页头：[目录] 储藏 / 采购 / 页面 …… [页面自己的操作]
 * 2026-11-27.26 起采购是储藏下面的一个子目录（不再是单独的页签）：目录就是储藏的目录（pantry/restock-sync.js 的 pantryNodes，里面有「采购」一组），打开就停在当前页。
 * 路径里的页面名都是导航；某家商店 / 某条特价的详情页、表单仍用自己带名字的面包屑。 */
import { href } from "../core/router.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";
import { treePop } from "../core/tree-pop.js";
import { pathHead } from "../core/page-path.js";
import { pantryNodes } from "../pantry/restock-sync.js";

/** cur = home | list | add | shops-list | deals | find | log */
const PAGES = { home: [], list: ["购物车"], add: ["购物车", "加入购物车"], "shops-list": ["常去的商店"], deals: ["常去的商店", "特价一览"], find: ["常去的商店", "找附近的商店"], log: ["常去的商店", "更新记录"] };

/** 采购页的目录 = 储藏的目录；cur = home | list | add | shops-list | deals | find | log */
export const buyTree = (cur) => pantryNodes(cur ? `buy:${cur}` : "");

/** suffix = 标题末尾要放的 html（购物车的「N 项」）；right = 右边的操作 html。画法和财务页头一样（core/page-path.js）：路径行置顶，下面一行标题 */
export function buyHead(cur, { suffix = "", right = "" } = {}) {
  const names = (PAGES[cur] || []).map((x) => t(x)), trail = [{ href: href("pantry"), label: t("储藏") }, { href: names.length ? href("shopping") : "", label: t("采购") }];
  names.forEach((label, i) => trail.push({ href: i < names.length - 1 ? (label === t("购物车") ? href("shopping", "list") : href("shops", "list")) : "", label }));
  return pathHead({ treeHtml: treePop(buyTree(cur), { id: "buytree" }), trail, title: trail[trail.length - 1].label, after: suffix, right });
}
