/* 每个底部页签的“目录页”（参考家庭学堂“我的”页）：二级页不再用横向滑动的标签，而是一栏一栏的行，点进去；
 * 子页顶部一条面包屑「‹ 房屋」回目录。目录行带简短说明和当前要处理的数量。 */
import { state } from "./core/state.js";
import { SECTIONS, href } from "./core/router.js";
import { esc, inSpace } from "./core/util.js";
import { t } from "./core/i18n.js";
import { alertsOf } from "./core/logic.js";
import { assetAlerts, myAssets, myVehicles } from "./house/assets.js";
import { undoneThisMonth } from "./house/tasks.js";
import { openDeal } from "./house/deals.js";
import { billAlerts } from "./bills/logic.js";

const SECTION_ICON = { pantry: "🥫", house: "🏠", bills: "🧾", me: "👤" };
// 每个二级页：图标、一句说明、可选的“要处理的数量”
const META = {
  pantry: {
    overview:  { icon: "📊", desc: "补货与临期一览、各分类库存", count: () => alertsOf(state.enriched.filter(inSpace("pantry"))).length },
    inventory: { icon: "🥫", desc: "全部物品，点 −/+ 记消耗" },
    gear:      { icon: "🧳", desc: "床品、电器、自行车、工具：只记数量和位置" },
    meals:     { icon: "🍳", desc: "按现有食材推荐三餐" },
  },
  house: {
    overview:  { icon: "🏠", desc: "房屋卡片、耗材提醒、谁负责维护、本月任务" },
    supplies:  { icon: "🧰", desc: "滤网、电池、融雪盐等房屋耗材", count: () => alertsOf(state.enriched.filter(inSpace("house"))).length },
    assets:    { icon: "⚙️", desc: "设备档案、保养记录与检查卡", count: () => assetAlerts(myAssets()).length },
    tasks:     { icon: "📅", desc: "按月的检修清单，勾了家人都看到", count: () => (state.houseProfile ? undoneThisMonth().length : 0) },
    vehicles:  { icon: "🚗", desc: "车辆档案、保养时间表、牌照与保险", count: () => assetAlerts(myVehicles()).length },
    deal:      { icon: "📝", desc: "买入 / 卖出 / 退租流程清单", count: () => (openDeal() ? 1 : 0), countLabel: "进行中" },
    profile:   { icon: "🏡", desc: "房型、设施、材料、地址、保险、HOA" },
  },
  bills: {
    overview:  { icon: "🧾", desc: "未来 30 天要交多少、要处理的账单", count: () => billAlerts(state.billsEnriched).length },
    list:      { icon: "📋", desc: "全部账单、自动扣款开关、按房产筛选" },
    history:   { icon: "📈", desc: "缴费记录、金额趋势、CSV 导出" },
  },
  me: {
    stats:     { icon: "📊", desc: "花费与消耗统计、年度 CSV" },
    settings:  { icon: "⚙️", desc: "家庭成员、邀请码、房产、语言、模块、备份" },
    about:     { icon: "✎", desc: "这个网站是什么、怎么用、注意事项" },
  },
};
const HIDDEN = (section, k) => section === "pantry" && k === "gear" && !state.gearEnabled;

export const menuRow = ({ href: url, icon, title, desc, count, countLabel, external }) => `<a class="mrow" href="${esc(url)}" ${external ? 'target="_blank" rel="noopener noreferrer"' : ""}>
    <span class="mi" aria-hidden="true">${icon}</span>
    <span class="mt"><b>${esc(title)}</b>${desc ? `<small>${esc(desc)}</small>` : ""}</span>
    ${count ? `<span class="badge b-soon mcount">${count}${countLabel ? ` ${esc(countLabel)}` : ""}</span>` : ""}
    <span class="mch" aria-hidden="true">›</span></a>`;

/** 某个页签的目录页 */
export function viewMenu(section) {
  const sec = SECTIONS[section]; if (!sec?.subs) return "";
  const rows = sec.subs.filter(([k, , hidden]) => !hidden && !HIDDEN(section, k)).map(([k, label]) => {
    const m = META[section]?.[k] || {};
    let count = 0; try { count = m.count ? m.count() : 0; } catch { count = 0; }
    return menuRow({ href: href(section, k), icon: m.icon || "•", title: t(label), desc: m.desc ? t(m.desc) : "", count, countLabel: m.countLabel ? t(m.countLabel) : "" });
  }).join("");
  const apps = section === "me" ? (window.SISTER_APPS || []).filter((a) => a.id !== "home-pantry") : [];
  return `<section class="section menu-page">
    <div class="section-head"><h2>${SECTION_ICON[section] || ""} ${t(sec.name)}</h2>${section === "house" && state.properties.length > 1 ? `<p>${esc(state.properties.find((p) => p.id === state.propertyId)?.name || "")}</p>` : ""}</div>
    <div class="panel mlist">${rows}</div>
    ${apps.length ? `<div class="section-head" style="margin-top:22px"><h2>${t("姐妹站点")}</h2></div>
      <div class="panel mlist">${apps.map((a) => menuRow({ href: a.url, icon: a.icon, title: t(a.name), desc: t(a.sub) })).join("")}</div>
      <p class="muted" style="font-size:13px;margin:8px 0 0">${t("同一作者的其他小工具，顶栏站名旁的小胶囊也能切换。")}</p>` : ""}
  </section>`;
}

/** 子页顶部的面包屑：‹ 回目录 · 当前页名 */
export function crumb(r) {
  const sec = SECTIONS[r.section]; if (!sec?.subs || r.sub === "menu") return "";
  const parent = r.section === "bills" ? { template: "list" } : { template: "supplies", "asset-template": "assets" };
  const cur = sec.subs.find(([k]) => k === r.sub) || sec.subs.find(([k]) => k === parent[r.sub]);
  return `<nav class="crumb" aria-label="${t("位置")}"><a href="${href(r.section)}">‹ ${t(sec.name)}</a><span class="sep">/</span><b>${cur ? t(cur[1]) : ""}</b></nav>`;
}
