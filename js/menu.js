/* 每个底部页签的“目录页”（参考家庭学堂“我的”页）：二级页不再用横向滑动的标签，而是一栏一栏的行，点进去；
 * 子页顶部一条面包屑「‹ 房屋」回目录。目录行带简短说明和当前要处理的数量。 */
import { state } from "./core/state.js";
import { SECTIONS, href } from "./core/router.js";
import { esc, inSpace } from "./core/util.js";
import { t } from "./core/i18n.js";
import { alertsOf } from "./core/logic.js";
import { activeVehicles, assetAlerts, assetName, myAssets, myVehicles } from "./house/assets.js";
import { undoneThisMonth } from "./house/tasks.js";
import { dealSubLabel, historyLabel, openDeal, routeDeal } from "./house/deals.js";
import { SETTING_SECTIONS } from "./settings/views.js";
import { aiIcon } from "./core/ai.js";
import { crumbNav } from "./core/hub.js";
import { billAlerts } from "./bills/logic.js";
import { collectAlerts } from "./core/alerts.js";
import { houseBar } from "./house/property-form.js";
import { PROFILE_SECTIONS } from "./house/views.js";

const SECTION_ICON = { pantry: "🥫", house: "🏠", bills: "🧾", me: "👤" };
// 每个二级页：图标、一句说明、可选的“要处理的数量”
const META = {
  pantry: {
    overview:  { icon: "📊", desc: "补货与临期一览、各分类库存", count: () => alertsOf(state.enriched.filter(inSpace("pantry"))).length },
    inventory: { icon: "🥫", desc: "日常储备与房屋耗材，点 −/+ 记消耗" },
    gear:      { icon: "🧳", desc: "床品、电器、自行车、工具：只记数量和位置" },
    meals:     { icon: "🍳", desc: "按现有食材推荐三餐" },
  },
  house: {
    overview:  { icon: "🏠", desc: "房屋卡片、耗材提醒、谁负责维护、本月任务" },
    supplies:  { icon: "🧰", desc: "滤网、电池、融雪盐等房屋耗材", count: () => alertsOf(state.enriched.filter(inSpace("house"))).length },
    assets:    { icon: "⚙️", desc: "设备档案、保养记录、检查卡与相关耗材", count: () => assetAlerts(myAssets()).length },
    tasks:     { icon: "📅", desc: "按月的检修清单，勾了家人都看到", count: () => (state.houseProfile ? undoneThisMonth().length : 0) },
    deal:      { icon: "📝", desc: "买入 / 卖出 / 退租流程清单", count: () => (openDeal() ? 1 : 0), countLabel: "进行中" },
    profile:   { icon: "🏡", desc: "房型、设施、材料、地址、保险、HOA" },
    // 这套房产的账单：跳到账单清单并按房产筛选（账单页签保留全家视图、日历导出和与房产无关的账单）
    bills:     { icon: "🧾", desc: "这套房产的水电气网、HOA、房产税、房贷、保险", href: () => `${href("bills", "list")}?prop=${state.propertyId}`, count: () => billAlerts(state.billsEnriched.filter((b) => b.property_id === state.propertyId)).length, when: () => state.billsEnabled },
  },
  bills: {
    overview:  { icon: "🧾", desc: "未来 30 天要交多少、要处理的账单", count: () => billAlerts(state.billsEnriched).length },
    list:      { icon: "📋", desc: "全部账单、自动扣款开关、按房产筛选" },
    history:   { icon: "📈", desc: "每条账单的缴费记录、金额趋势、CSV 导出" },
    spend:     { icon: "📊", desc: "所有花费：每月花了多少、分类占比、商店、年度报表，可搜索筛选排序" },
  },
  me: {
    stats:     { icon: "📊", desc: "库存使用趋势（花费统计在 账单 → 花费）" },
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
const KIND_ICON = { sfh: "🏡", townhome: "🏘️", condo: "🏢", apartment: "🔑", other: "🏠" };   // 房产类型图标：列表行和面包屑共用
export function viewPropertyList() {
  const K = window.BILLS.PROPERTY_KINDS, ST = window.DEALS.PROPERTY_STATUS;
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
  const vehicles = activeVehicles(), vAlerts = assetAlerts(vehicles.filter((a) => window.VEHICLES.inService(a))).length;
  return `<section class="section menu-page">
    <div class="section-head"><h2>🏠 ${t("房屋")}</h2><p>${t("点一套房产进入它的概览、设备保养、季节任务、交易和资料")}</p></div>
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
    ${prop ? `${crumbNav([{ href: href("house"), label: t("房屋") }, { label: prop.name, icon: KIND_ICON[prop.kind] || "🏠" }])}<p class="muted" style="margin:-6px 0 12px;font-size:13px">${esc([t(window.DEALS.PROPERTY_STATUS[prop.status] || "持有"), prop.address].filter(Boolean).join(" · "))}</p>`
      : `<div class="section-head"><h2>${SECTION_ICON[section] || ""} ${t(sec.name)}</h2></div>`}
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
  const parts = [prop ? { href: href("house", "pages"), label: prop.name, icon: KIND_ICON[prop.kind] || "🏠" } : { href: href(r.section), label: t(sec.name) }];
  const curLabel = cur ? t(cur[1]) : "", subHref = href(r.section, cur?.[0] || r.sub);
  // 三级：房屋资料分区 / 交易子页 / 设置分区 / 库存分类 —— 中间项可点回上一级，页面不再另起标题行
  const q = r.q;
  const psec = r.section === "house" && r.sub === "profile" ? PROFILE_SECTIONS.find((s) => s.id === q.get("sec")) : null;
  const rdeal = r.section === "house" && r.sub === "deal" ? routeDeal() : null;
  const dsec = rdeal !== null || (r.section === "house" && r.sub === "deal") ? dealSubLabel(q.get("sec"), rdeal) : null;
  const hist = q.get("deal") ? historyLabel(rdeal) : null;   // 看历史交易：交易 / 历史 · 买入 / 子页
  // 车辆交易页：‹ 车辆 / 车名 / 交易 / 子页
  const vehDeal = r.section === "house" && r.sub === "deal" && q.get("asset") ? state.assetsEnriched.find((a) => a.id === q.get("asset")) : null;
  if (vehDeal) {
    const dealHref_ = `${subHref}?asset=${encodeURIComponent(vehDeal.id)}${q.get("deal") ? `&deal=${encodeURIComponent(q.get("deal"))}` : ""}`;
    const vparts = [{ href: href("house", "vehicles"), label: t("车辆"), icon: "🚗" }, { href: href("asset", vehDeal.id), label: assetName(vehDeal) }];
    const dealRoot = `${subHref}?asset=${encodeURIComponent(vehDeal.id)}`;
    if (hist) { vparts.push({ href: dealRoot, label: curLabel }); if (dsec) vparts.push({ href: dealHref_, label: hist }, { label: dsec }); else vparts.push({ label: hist }); }
    else if (dsec) vparts.push({ href: dealHref_, label: curLabel }, { label: dsec }); else vparts.push({ label: curLabel });
    return crumbNav(vparts);
  }
  const ssec = r.section === "me" && r.sub === "settings" ? SETTING_SECTIONS.find((s) => s.id === q.get("sec")) : null;
  const invPage = (r.section === "pantry" && (r.sub === "inventory" || r.sub === "gear")) || (r.section === "house" && r.sub === "supplies");
  const cat = invPage && state.filter.cat !== "all" ? window.CATEGORIES.find((c) => c.id === state.filter.cat) : null;
  if (psec) parts.push({ href: subHref, label: curLabel }, { label: t(psec.name), icon: psec.icon });
  else if (hist) { parts.push({ href: subHref, label: curLabel }); if (dsec) parts.push({ href: `${subHref}?deal=${encodeURIComponent(q.get("deal"))}`, label: hist }, { label: dsec }); else parts.push({ label: hist }); }   // 房产 / 交易 / 历史 · 买入 / 子页
  else if (dsec) parts.push({ href: subHref, label: curLabel }, { label: dsec });
  else if (ssec) parts.push({ href: subHref, label: curLabel }, { label: t(ssec.name), icon: ssec.icon === "__AI__" ? aiIcon(18) : ssec.icon });
  else if (cat) parts.push({ action: "cat", attrs: 'data-cat="all"', label: curLabel }, { label: t(cat.name), icon: cat.icon });   // “库存”可点回全部分类
  else parts.push({ label: curLabel });
  return crumbNav(parts);
}
