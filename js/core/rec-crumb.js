/* 记录详情页 / 编辑页的面包屑（花费、收入共用）：一行到底「财务 / 花费 / 明细 / 这条记录」，不再和全局那一行叠成两层。
 * 全局面包屑（menu.js crumb）在这些页上不画。上一层（‹ 返回）是「明细」列表。 */
import { href } from "./router.js";
import { t } from "./i18n.js";
import { crumbNav } from "./hub.js";

/** sub = "spend" | "income"；listHref = 明细列表的网址；leaf = 当前这一项的名字 */
export const recCrumb = (sub, listHref, leaf) => crumbNav([{ href: href("bills"), label: t("财务") }, { href: href("bills", sub), label: t(sub === "spend" ? "花费" : "收入") }, { href: listHref, label: t("明细") }, { label: leaf }]);
