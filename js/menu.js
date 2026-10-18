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
import { collectAlerts } from "./core/alerts.js";
import { houseBar } from "./house/property-form.js";
import { PROFILE_SECTIONS } from "./house/views.js";

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
    deal:      { icon: "📝", desc: "买入 / 卖出 / 退租流程清单", count: () => (openDeal() ? 1 : 0), countLabel: "进行中" },
    profile:   { icon: "🏡", desc: "房型、设施、材料、地址、保险、HOA" },
    // 这套房产的账单：跳到账单清单并按房产筛选（账单页签保留全家视图、日历导出和与房产无关的账单）
    bills:     { icon: "🧾", desc: "这套房产的水电气网、HOA、房产税、房贷、保险", href: () => `${href("bills", "list")}?prop=${state.propertyId}`, count: () => billAlerts(state.billsEnriched.filter((b) => b.property_id === state.propertyId)).length, when: () => state.billsEnabled },
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

/** 房屋页签的第一层：房产列表（每套一行，带状态和待处理数），下面是家庭级的车辆和添加房产 */
export function viewPropertyList() {
  const K = window.BILLS.PROPERTY_KINDS, ST = window.DEALS.PROPERTY_STATUS;
  const KIND_ICON = { sfh: "🏡", townhome: "🏘️", condo: "🏢", apartment: "🔑", other: "🏠" };
  const alerts = collectAlerts();
  const live = state.properties.filter((p) => !p.archived);
  const rows = live.map((p) => {
    const n = alerts.filter((a) => a.property_id === p.id && a.severity <= 2).length;
    const desc = [t(ST[p.status] || "持有"), t(K[p.kind] || ""), p.address].filter(Boolean).join(" · ");
    return `<button type="button" class="mrow" data-action="house-open" data-id="${p.id}" ${p.id === state.propertyId ? 'aria-current="true"' : ""}>
      <span class="mi" aria-hidden="true">${KIND_ICON[p.kind] || "🏠"}</span>
      <span class="mt"><b>${esc(p.name)}</b><small>${esc(desc)}</small></span>
      ${n ? `<span class="badge b-soon mcount">${n}</span>` : ""}
      <span class="mch" aria-hidden="true">›</span></button>`;
  }).join("");
  const vehicles = myVehicles(), vAlerts = assetAlerts(vehicles).length;
  return `<section class="section menu-page">
    <div class="section-head"><h2>🏠 ${t("房屋")}</h2><p>${t("点一套房产进入它的概览、耗材、设备、季节任务、交易和资料")}</p></div>
    ${houseBar()}
    <div class="panel mlist">${rows || `<div class="empty"><strong>${t("还没有房产")}</strong></div>`}
      ${state.editProperty === "new" ? "" : `<button type="button" class="mrow" data-action="property-edit" data-id=""><span class="mi" aria-hidden="true">＋</span><span class="mt"><b>${t("添加房产")}</b><small>${t("自住、出租或租住的房子都可以")}</small></span></button>`}</div>
    <div class="section-head" style="margin-top:22px"><h2>${t("全家")}</h2></div>
    <div class="panel mlist">${menuRow({ href: href("house", "vehicles"), icon: "🚗", title: t("车辆"), desc: vehicles.length ? t("{n} 辆，保养时间表、牌照与保险", { n: vehicles.length }) : t("车辆档案、保养时间表、牌照与保险"), count: vAlerts })}</div>
  </section>`;
}

/** 某个页签的目录页（房屋：当前房产的页面目录） */
export function viewMenu(section) {
  const sec = SECTIONS[section]; if (!sec?.subs) return "";
  const extra = Object.entries(META[section] || {}).filter(([k, m]) => m.href && !sec.subs.some(([s]) => s === k) && (!m.when || m.when())).map(([k, m]) => [k, { bills: "账单" }[k] || k]);
  const rows = [...sec.subs.filter(([k, , hidden]) => !hidden && !HIDDEN(section, k)), ...extra].map(([k, label]) => {
    const m = META[section]?.[k] || {};
    let count = 0; try { count = m.count ? m.count() : 0; } catch { count = 0; }
    return menuRow({ href: m.href ? m.href() : href(section, k), icon: m.icon || "•", title: t(label), desc: m.desc ? t(m.desc) : "", count, countLabel: m.countLabel ? t(m.countLabel) : "" });
  }).join("");
  const apps = section === "me" ? (window.SISTER_APPS || []).filter((a) => a.id !== "home-pantry") : [];
  const prop = section === "house" ? state.properties.find((p) => p.id === state.propertyId) : null;
  return `<section class="section menu-page">
    ${prop ? `<nav class="crumb" aria-label="${t("位置")}"><a href="${href("house")}">‹ ${t("房屋")}</a><span class="sep">/</span><b>${esc(prop.name)}</b></nav>` : ""}
    <div class="section-head"><h2>${prop ? `🏠 ${esc(prop.name)}` : `${SECTION_ICON[section] || ""} ${t(sec.name)}`}</h2>${prop ? `<p>${esc([t(window.DEALS.PROPERTY_STATUS[prop.status] || "持有"), prop.address].filter(Boolean).join(" · "))}</p>` : ""}</div>
    ${section === "house" ? houseBar() : ""}
    <div class="panel mlist">${rows}</div>
    ${apps.length ? `<div class="section-head" style="margin-top:22px"><h2>${t("姐妹站点")}</h2></div>
      <div class="panel mlist">${apps.map((a) => menuRow({ href: a.url, icon: a.icon, title: t(a.name), desc: t(a.sub) })).join("")}</div>
      <p class="muted" style="font-size:13px;margin:8px 0 0">${t("同一作者的其他小工具，顶栏站名旁的小胶囊也能切换。")}</p>` : ""}
  </section>`;
}

/** 子页顶部的面包屑：‹ 回目录 · 当前页名（房屋子页回到该房产的目录，车辆回到房产列表） */
export function crumb(r) {
  const sec = SECTIONS[r.section]; if (!sec?.subs || r.sub === "menu" || r.sub === "pages") return "";
  const parent = r.section === "bills" ? { template: "list" } : { template: "supplies", "asset-template": "assets" };
  const cur = sec.subs.find(([k]) => k === r.sub) || sec.subs.find(([k]) => k === parent[r.sub]);
  const prop = r.section === "house" && r.sub !== "vehicles" ? state.properties.find((p) => p.id === state.propertyId) : null;
  let back = prop ? { href: href("house", "pages"), label: prop.name } : { href: href(r.section), label: t(sec.name) };
  let curLabel = cur ? t(cur[1]) : "";
  // 房屋资料的某个分区：回到分区列表
  const psec = r.section === "house" && r.sub === "profile" ? PROFILE_SECTIONS.find((s) => s.id === r.q.get("sec")) : null;
  if (psec) { back = { href: href("house", "profile"), label: t("房屋资料") }; curLabel = t(psec.name); }
  return `<nav class="crumb" aria-label="${t("位置")}"><a href="${back.href}">‹ ${esc(back.label)}</a><span class="sep">/</span><b>${curLabel}</b></nav>`;
}
