/* 面包屑的前几层（全站统一）：每一层都是一个真实存在的页面，点哪一层都回到那一层。
 *  财务：财务（首页）/ 分组（分析 · 收支 · 账单 · 账户 的目录页）/ 页面 / …
 *  房屋：房屋（首页）/ 房产（目录页）/ 某套房产 / 页面；房屋 / 汽车（目录页）/ 某辆车 / 页面；房屋 / 买卖计划 / …
 * 各处的面包屑从这里取前几层，再接自己那一级，不再各写各的（以前会漏掉新加的目录页）。 */
import { href } from "./router.js";
import { t } from "./i18n.js";
import { FIN_GROUPS, groupHref } from "../bills/fin-tree.js";

/** 财务各页（路由 sub）属于哪一组 */
const GROUP_OF = { overview: "bills", all: "bills", assetbills: "bills", template: "bills", recurring: "bills", spend: "flow", income: "flow", debts: "flow", statements: "flow",
  assets: "analysis", networth: "analysis", budget: "analysis", accounts: "accounts", cards: "accounts", banks: "accounts", invest: "accounts", wallets: "accounts" };
export const finGroupOf = (sub) => FIN_GROUPS.find((g) => g.id === GROUP_OF[sub]) || null;
/** 财务 / 这个页面所属的分组（没有分组的页面只有「财务」） */
export function finBase(sub) {
  const g = finGroupOf(sub);
  return [{ href: href("bills"), label: t("财务") }, ...(g ? [{ href: groupHref(g.id), label: t(g.name) }] : [])];
}

export const houseBase = () => [{ href: href("house"), label: t("房屋") }];
/** 房屋 / 房产（房产目录页） */
export const houseProps = () => [...houseBase(), { href: href("house", "properties"), label: t("房产") }];
/** 房屋 / 汽车（汽车目录页） */
export const houseCars = () => [...houseBase(), { href: href("house", "cars"), label: t("汽车") }];
