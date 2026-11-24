/* 财务首页（#/bills，底部「财务」页签点进来的那页）和四个一级目录页（#/bills/group?g=analysis|flow|bills|accounts）：
 *  · 财务首页：[目录] 💰 财务ⓘ + 四张入口卡片（分析 · 收支 · 账单 · 账户）：图标、名字、一句话、这一组要处理的总数、包含哪几页；点一张进它自己的目录页。
 *  · 一级目录页：页头「[目录] 财务 / 分析」，下面一行一个页面（带自己的数量和说明），点进去才是具体页面。
 *  目录（fin-tree.js）里点一级入口同样跳到这些目录页，展开箭头才展开下一层。
 *  手机一列，宽屏 2 × 2；没有财务权限的页面不出现，整组都空的组不出现。 */
import { state } from "../core/state.js";
import { esc } from "../core/util.js";
import { t } from "../core/i18n.js";
import { infoTip } from "../core/info-tip.js";
import { treePop } from "../core/tree-pop.js";
import { menuRow } from "../menu.js";
import { FIN_GROUPS, finGroupPages, finTree, groupHref } from "./fin-tree.js";
import { finHead } from "./fin-head.js";

/** 首页的一张入口卡：整张是链接，进这一组的目录页 */
const entry = (g) => {
  const pages = finGroupPages(g); if (!pages.length) return "";
  const total = pages.reduce((a, p) => a + (+p.count || 0), 0);
  return `<a class="fin-card fin-entry" href="${esc(groupHref(g.id))}" aria-labelledby="fg-${g.id}">
    <header class="fin-card-h"><span class="fin-card-ico" aria-hidden="true">${g.icon}</span><span class="fin-card-t"><h3 id="fg-${g.id}">${esc(t(g.name))}</h3><small>${esc(t(g.desc))}</small></span>${total ? `<span class="ui-badge" data-tone="warn" data-size="sm">${total}</span>` : ""}<span class="ui-chev" aria-hidden="true">›</span></header>
    <p class="fin-entry-pages">${pages.map((p) => esc(p.label)).join(" · ")}</p></a>`;
};

export function viewFinanceMenu() {
  return `<section class="section menu-page">
    <div class="section-head"><div class="sh-title">${treePop(finTree(state.route), { id: "fintree" })}<h2>💰 ${t("财务")}${infoTip.classic(t("和钱有关的都在这里；房子、车的日常维护在「房屋」"), { align: "start" })}</h2></div></div>
    <div class="fin-cards">${FIN_GROUPS.map(entry).join("")}</div>
  </section>`;
}

/** 一级目录页：这一组的所有页面，一行一个 */
export function viewFinGroup() {
  const g = FIN_GROUPS.find((x) => x.id === state.route?.q?.get("g")) || FIN_GROUPS[0], pages = finGroupPages(g);
  return `<section class="section menu-page">
    ${finHead({ label: t(g.name) })}
    ${pages.length ? `<div class="panel mlist">${pages.map((p) => menuRow({ href: p.href, icon: p.icon, title: p.label, desc: p.desc, count: p.count })).join("")}</div>` : `<div class="panel empty"><strong>${t("这一组现在没有可看的页面")}</strong>${t("有的页面需要家主开放财务权限")}</div>`}
  </section>`;
}
