/* 财务首页（#/bills，底部「财务」页签点进来的那页）：
 *  第一行：[目录] 💰 财务ⓘ —— 目录是贯穿财务各页的嵌套目录（fin-tree.js），这里当前项 = 财务首页；
 *  下面四张大卡片（分析 · 收支 · 账单 · 账户）：卡片头带组图标、名字、一句话、这一组要处理的总数；卡片里一行一个页面（带自己的数量），一点就进。
 *  手机一列，宽屏 2 × 2；没有财务权限的页面不出现，整组都空的组不出现。 */
import { state } from "../core/state.js";
import { esc } from "../core/util.js";
import { t } from "../core/i18n.js";
import { infoTip } from "../core/info-tip.js";
import { treePop } from "../core/tree-pop.js";
import { menuRow } from "../menu.js";
import { FIN_GROUPS, finGroupPages, finTree } from "./fin-tree.js";

const card = (g) => {
  const pages = finGroupPages(g); if (!pages.length) return "";
  const total = pages.reduce((a, p) => a + (+p.count || 0), 0);
  return `<section class="fin-card" aria-labelledby="fg-${g.id}">
    <header class="fin-card-h"><span class="fin-card-ico" aria-hidden="true">${g.icon}</span><span class="fin-card-t"><h3 id="fg-${g.id}">${esc(t(g.name))}</h3><small>${esc(t(g.desc))}</small></span>${total ? `<span class="ui-badge" data-tone="warn" data-size="sm">${total}</span>` : ""}</header>
    <div class="panel mlist">${pages.map((p) => menuRow({ href: p.href, icon: p.icon, title: p.label, desc: p.desc, count: p.count })).join("")}</div>
  </section>`;
};

export function viewFinanceMenu() {
  return `<section class="section menu-page">
    <div class="section-head"><div class="sh-title">${treePop(finTree(state.route), { id: "fintree" })}<h2>💰 ${t("财务")}${infoTip(t("和钱有关的都在这里；房子、车的日常维护在「房屋」"), { align: "start" })}</h2></div></div>
    <div class="fin-cards">${FIN_GROUPS.map(card).join("")}</div>
  </section>`;
}
