/* 财务的目录结构：分组 → 页面 → 页内标签。财务首页的四张卡片和各页的嵌套目录（treePop）都读这里，两边永远一致。
 * 分组和页面的顺序、名字、图标、说明、待处理数量都来自 menu.js 的 META / SECTIONS；这里只负责「哪些页面在哪一组」和把它们排成树。 */
import { META } from "../menu.js";
import { SECTIONS, href } from "../core/router.js";
import { t } from "../core/i18n.js";
import { FINANCE_HIDDEN_SUBS, financeOk } from "../core/finance-access.js";
import { ASSET_TABS, BUDGET_TABS, DEBT_TABS, INCOME_TABS, SPEND_TABS, STATEMENT_TABS, TAX_TABS, activeTab } from "../core/tabs.js";

/** 一级目录页（分析 / 收支 / 账单 / 账户）的网址：#/bills/group?g=<组 id> */
export const groupHref = (id) => `${href("bills", "group")}?g=${id}`;
export const FIN_GROUPS = [
  { id: "analysis", name: "分析", icon: "📊", desc: "资产、净资产、预算、税务", subs: ["assets", "budget", "tax"] },
  { id: "flow", name: "收支", icon: "⚖️", desc: "花费、收入、借贷、对账单", subs: ["spend", "income", "debts", "statements"] },
  { id: "bills", name: "账单", icon: "🧾", desc: "账单概览、明细、周期性账单", subs: ["overview", "all", "recurring"] },
  { id: "accounts", name: "账户", icon: "🗂️", desc: "账户概览、信用卡、银行、投资、钱包", subs: ["accounts", "cards", "banks", "invest", "wallets"] },
];
/** 有页内标签的页面：页面 key → 标签表 + 每个标签的网址；没有标签的页面不在这里 */
const own = (sub) => (id, tabs) => `${href("bills", sub)}${id === tabs[0][0] ? "" : `?tab=${id}`}`;
const TABS = {
  spend: { tabs: SPEND_TABS, href: own("spend") }, income: { tabs: INCOME_TABS.filter(([id]) => id !== "import"), href: own("income") },
  budget: { tabs: BUDGET_TABS, href: own("budget") }, tax: { tabs: TAX_TABS, href: own("tax") }, debts: { tabs: DEBT_TABS, href: own("debts") }, statements: { tabs: STATEMENT_TABS, href: own("statements") },
  assets: { tabs: ASSET_TABS, href: (id) => href("bills", id), routes: true },   // 资产概览 / 净资产是两个独立路由，不走 ?tab=
};
const known = () => new Set(SECTIONS.bills.subs.filter(([, , h]) => !h).map(([k]) => k));
const hidden = (k) => FINANCE_HIDDEN_SUBS.includes(META.bills[k]?.sub || k) && !financeOk();   // 没有财务权限：收入 / 预算这些不进目录

/** 一个页面的资料（名字、图标、说明、网址、待处理数） */
export function finPage(k) {
  const m = META.bills[k] || {}, sec = SECTIONS.bills;
  let count = 0; try { count = m.count ? m.count() : 0; } catch { count = 0; }
  return { k, sub: m.sub || k, label: t(m.title || sec.subs.find(([s]) => s === k)?.[1] || k), icon: m.icon || "•", desc: m.desc ? t(m.desc) : "", href: m.href ? m.href() : href("bills", k), count };
}
/** 这一组里看得见的页面 */
export const finGroupPages = (g) => g.subs.filter((k) => (known().has(k) || META.bills[k]?.sub) && !hidden(k)).map(finPage);

/** 当前路由在财务的哪里：{ sub, tab }；财务首页（目录页）sub = "menu" */
const where = (r) => (r?.section === "bills" ? { sub: r.sub || "menu", tab: r.sub && TABS[r.sub] && !TABS[r.sub].routes ? activeTab(r) : null, g: r.sub === "group" ? r.q?.get("g") || "" : "" } : { sub: "", tab: null, g: "" });

/** 嵌套目录的树：财务首页 + 每组（当前所在的组、页面展开，当前项标 current） */
export function finTree(route) {
  const at = where(route);
  const pageNode = (p) => {
    const tt = TABS[p.k];
    if (!tt) return { label: p.label, icon: p.icon, href: p.href, badge: p.count || "", current: at.sub === p.sub };
    const kids = tt.tabs.map(([id, name, icon]) => ({ label: t(name), icon, href: tt.href(id, tt.tabs), current: tt.routes ? at.sub === id : at.sub === p.k && at.tab === id }));
    return { label: p.label, icon: p.icon, href: tt.href(tt.tabs[0][0], tt.tabs), badge: p.count || "", open: kids.some((x) => x.current), children: kids };
  };
  const groups = FIN_GROUPS.map((g) => {
    const children = finGroupPages(g).map(pageNode);
    const cur = at.sub === "group" && at.g === g.id;   // 正停在这一组自己的目录页
    return children.length ? { label: t(g.name), icon: g.icon, href: groupHref(g.id), current: cur, open: cur || children.some((c) => c.open || c.current), children } : null;
  }).filter(Boolean);
  return [{ label: t("财务首页"), icon: "💰", href: href("bills"), current: at.sub === "menu" }, ...groups];
}
