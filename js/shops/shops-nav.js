/* 常去的商店 / 特价一览共用的导航：两张导航卡（商店列表、特价一览）、标题右上 ⋯（更新记录）、右下角圆形 ＋（添加商店、找附近的商店、用 Claude 整理、录入特价）。 */
import { dealsDue } from "./logic.js";
import { fabMenu } from "../core/fab-menu.js";
import { moreMenu } from "../core/more-menu.js";
import { tabCards } from "../core/hub.js";
import { href } from "../core/router.js";
import { state } from "../core/state.js";
import { t } from "../core/i18n.js";
import { shopHref } from "./shops-common.js";

export const SHOP_TABS = [["list", "商店列表", "🏪"], ["deals", "特价一览", "🏷"]];
const tabHref = (id) => href("shops", id);
export const shopsTabs = (active) => tabCards(SHOP_TABS, active, tabHref, t("商店内容"));
export const shopsMore = () => moreMenu([{ label: `📜 ${t("更新记录")}`, href: href("shops", "log"), first: true }], { label: t("更多操作") });
/** 右下角 ＋：录入特价去哪家——本周还没更新的那家优先，否则第一家常去的 */
export function shopsFab(page = "list") {
  const live = (state.shops || []).filter((s) => !s.archived), target = live.find(dealsDue) || live[0];
  return fabMenu([
    page === "list" ? { label: t("手动添加商店"), icon: "🏪", data: { action: "shops-new" } } : null,
    { label: t("找附近的商店"), icon: "📍", href: href("shops", "find") },
    target ? { label: t("录入特价"), icon: "🏷", desc: target.name, href: `${shopHref(target)}?add=1` } : null,
    page === "list" ? { label: t("用 Claude 整理"), icon: "🤖", data: { action: "shops-claude" } } : null,
  ], { label: t("添加") });
}
