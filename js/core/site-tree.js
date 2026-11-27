/* 全站目录的第一层 = 底部（顶部）导航的 6 个区域（参考牧羊人的目录）。
 * 当前区域展开成它自己的页面树（各区域原来的树，由调用方传进来）；其余区域只是一行链接，带要处理的数量。
 * 由 tree-pop.js 的 treePop() 自动套上，各页的目录按钮都有这一层；不属于任何区域的页面（咩咩咩、快捷操作…）原样不变。 */
import { state } from "./state.js";
import { t } from "./i18n.js";
import { href } from "./router.js";
import { alertsOf } from "./logic.js";
import { inSpace } from "./util.js";

/** [区域 id, 图标, 名称]：和 index.html 的主导航同一个顺序 */
const AREAS = [["today", "🗓️", "今日"], ["pantry", "🗄️", "储藏"], ["house", "🏠", "房屋"], ["bills", "💰", "财务"], ["shopping", "🛒", "采购"], ["me", "👤", "我的"]];
/** 路由的 section → 区域（表单页、商店页、设备页都归到所在的底部页签） */
const AREA_OF = { today: "today", pantry: "pantry", item: "pantry", scan: "pantry", house: "house", asset: "house", bills: "bills", bill: "bills", otbill: "bills", shopping: "shopping", shops: "shopping", me: "me" };
export const areaOf = (r) => AREA_OF[r?.section] || null;

/** 其他区域那一行右边的数字：储藏 = 要补货 / 临期的件数，采购 = 购物车里还没买的 */
function badgeOf(id) {
  try {
    if (id === "pantry") return alertsOf((state.enriched || []).filter((x) => inSpace("pantry")(x) || (state.houseEnabled && inSpace("house")(x)))).length || "";
    if (id === "shopping") return (state.shopping || []).filter((s) => s.status !== "bought").length || "";
  } catch { /* 数据还没读到：不显示数字 */ }
  return "";
}

/** nodes = 当前区域的树；返回第一层是 6 个区域的新树（当前区域不在任何区域 / 没有树时原样返回） */
export function siteTree(nodes, r = state.route) {
  const cur = areaOf(r); if (!cur || !nodes?.length) return nodes;
  return AREAS.map(([id, icon, name]) => (id === cur
    ? { label: t(name), icon, href: href(id), open: true, children: nodes }
    : { label: t(name), icon, href: href(id), badge: badgeOf(id) }));
}
