/* 房屋页签的目录页：房产列表 + 车辆 + 买卖计划（#/house/menu），以及房屋概览里的导航豆腐块。
 * 从 menu.js 里搬出来：menu.js 每个页面都要用（面包屑），而这几页要用到设备、季节任务、交易、买卖计划等整个房屋模块，点进房屋页签才下载。 */
import { META, KIND_ICON } from "../menu.js";
import { state } from "../core/state.js";
import { SECTIONS, href } from "../core/router.js";
import { esc } from "../core/util.js";
import { t } from "../core/i18n.js";
import { financeOk } from "../core/finance-access.js";
import { billAlerts } from "../bills/logic.js";
import { canManageHome } from "../settings/members.js";
import { activeProperties, endedProperties } from "../core/lifecycle.js";
import { houseBar } from "./property-form.js";
import { planEntryCards } from "./plan.js";
import { activeVehicles, assetName, assetsDueCount, myVehicles, pastVehicles, pastVehiclesSection } from "./assets.js";
import { monthTasks } from "./tasks-logic.js";
import { dealTasks, openDeal } from "./deals.js";
import { houseAlerts, houseTodoBoard } from "./todo-board.js";
import { PROFILE_SECTIONS, houseDraft, sectionStatus } from "./views.js";
import { myAssets, vehStatus } from "./asset-common.js";

/** 房屋概览里的导航豆腐块：房屋资料 → 季节任务 → 账单 → 设备保养 → 交易 → 花费（本月）；每块带自己的小统计（完成度、没做 / 总数、待处理 / 总数） */
export function houseNavTiles() {
  const M = META.house, label = (k) => t(SECTIONS.house.subs.find(([s]) => s === k)?.[1] || k);
  const tile = (url, icon, title, stat, desc, pct = null) => `<a class="hv-card hn-tile" href="${esc(url)}"><span class="hv-ico" aria-hidden="true">${icon}</span>
      <span class="hv-txt"><b>${esc(title)}</b>${stat ? `<small class="hn-stat">${esc(stat)}</small>` : ""}<small>${esc(desc)}</small>${pct != null ? `<span class="mprog"><i style="width:${pct}%"></i></span>` : ""}</span></a>`;
  const safe = (fn, dflt = null) => { try { return fn(); } catch { return dflt; } };
  const pid = state.propertyId, d = state.houseProfile ? houseDraft() : null;
  // 资料完成度：有进度的分区（地址、保险、HOA、应急、材料…）的平均；没填过资料时 0%
  const pcts = d ? PROFILE_SECTIONS.map((s) => sectionStatus(d, s.id).pct).filter((x) => x != null) : [];
  const pct = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : 0;
  const now = new Date(), tasks = safe(() => monthTasks(now.getFullYear(), now.getMonth() + 1).filter(Boolean), []), undone = tasks.filter((x) => !x.done).length;
  const bills = state.billsEnriched.filter((b) => b.property_id === pid), billTodo = safe(() => billAlerts(bills).length, 0);
  const assets = safe(() => myAssets(), []), due = safe(() => assetsDueCount({ property: pid }), 0);
  const deal = safe(() => openDeal());
  const dt = deal ? dealTasks(deal).filter((x) => !x.skipped) : [], dtDone = dt.filter((x) => x.done).length;
  const month = now.toISOString().slice(0, 7);
  return `<section class="section" aria-label="${esc(t("这套房产的各个页面"))}"><div class="hv-grid hn-grid">
    ${tile(href("house", "profile"), "🏡", label("profile"), t("完成度 {p}%", { p: pct }), t(M.profile.desc), pct)}
    ${tile(href("house", "tasks"), "📅", label("tasks"), state.houseProfile ? t("本月 {u} 项没做 / 共 {n} 项", { u: undone, n: tasks.length }) : t("先填写房屋资料"), t(M.tasks.desc))}
    ${!M.bills.when || M.bills.when() ? tile(M.bills.href(), "🧾", t("账单"), t("{a} 项待处理 / 共 {n} 张", { a: billTodo, n: bills.length }), t(M.bills.desc)) : ""}
    ${tile(href("house", "assets"), "⚙️", label("assets"), t("{a} 台待处理 / 共 {n} 台", { a: due, n: assets.length }), t(M.assets.desc))}
    ${tile(href("house", "deal"), "📝", label("deal"), deal ? t("进行中 {a} / {b}", { a: dtDone, b: dt.length }) : t("没有进行中的交易"), t(M.deal.desc))}
    ${financeOk() ? tile(`${href("bills", "spend")}?tab=records&prop=${encodeURIComponent(pid)}&month=${month}`, "💸", t("花费"), t("本月明细"), t("这套房产本月的花费记录")) : ""}
  </div></section>`;
}

/** 房屋页签的第一层：房产列表（每套一行，带状态和待处理数），下面是家庭级的车辆和添加房产 */
function kit() {
  const K = window.BILLS.PROPERTY_KINDS, ST = window.DEALS.PROPERTY_STATUS;
  // 卡片（不是行）：图标 + 名称 + 一两行基本信息；最后一张空白卡「＋ 添加…」。不放统计数字
  const card = (attrs, icon, title, lines, current = false, flag = "") => {
    const link = attrs.startsWith("href");
    return `<${link ? "a" : 'button type="button"'} class="hv-card" ${attrs}${current ? ' aria-current="true"' : ""}>
      <span class="hv-ico" aria-hidden="true">${icon}</span>
      <span class="hv-txt">${flag || ""}<b>${esc(title)}</b>${lines.filter(Boolean).map((l) => `<small>${esc(l)}</small>`).join("")}</span></${link ? "a" : "button"}>`;
  };
  const addCard = (attrs, title, desc) => `<${attrs.startsWith("href") ? "a" : 'button type="button"'} class="hv-card hv-add" ${attrs}>
      <span class="hv-ico" aria-hidden="true">＋</span><span class="hv-txt"><b>${title}</b><small>${desc}</small></span></${attrs.startsWith("href") ? "a" : "button"}>`;
  const houseCard = (p) => card(`data-action="house-open" data-id="${p.id}"`, KIND_ICON[p.kind] || "🏠", p.name, [[t(ST[p.status] || "持有"), t(K[p.kind] || "")].filter(Boolean).join(" · "), p.address], p.id === state.propertyId, `<span class="hv-flags"><span class="hv-flag" title="${esc(t("用途"))}">⚑ ${t(window.BILLS.PROPERTY_ROLES[p.role || "owner_occupied"] || "自住")}</span>${p.is_default ? `<span class="hv-flag is-def">★ ${t("默认")}</span>` : ""}</span>`);
  const archivedCard = (p) => `<div class="hv-card hv-arch"><span class="hv-ico" aria-hidden="true">${KIND_ICON[p.kind] || "🏠"}</span><span class="hv-txt"><b>${esc(p.name)}</b>${p.address ? `<small>${esc(p.address)}</small>` : ""}</span>${canManageHome() ? `<button type="button" class="btn btn-sm" data-action="property-archive" data-id="${p.id}">${t("恢复")}</button>` : ""}</div>`;
  const props = activeProperties(), ended = endedProperties(), archived = state.properties.filter((p) => p.archived);   // 已卖出 / 已退租：收进「已结束」，档案、账单、设备、记录都还在
  const vehicles = activeVehicles(), pastN = myVehicles().length - vehicles.length;
  const vCard = (a) => {
    const v = a.vehicle || {}, pt = window.VEHICLES?.POWERTRAINS?.[a.type];
    return card(`href="${esc(href("asset", a.id))}"`, pt?.icon || "🚗", assetName(a), [[a.manufacture_year, a.brand, a.model].filter(Boolean).join(" "), [v.plate, t(window.VEHICLES?.STATUS?.[vehStatus(a)]?.name || "")].filter(Boolean).join(" · ")]);
  };
  return { props, vehicles, houseCard, archivedCard, vCard, addCard, ended, archived };
}
const sec = (inner) => `<section class="section menu-page house-landing">${houseBar()}${inner}</section>`;
/** 房屋首页：四个一级目录页的入口（房产 · 汽车 · 买卖计划 · 注意事项），点进去是各自的目录页 */
export function viewPropertyList() {
  const { props, vehicles } = kit(), n = houseAlerts().length;
  const entry = (url, icon, title, stat, desc) => `<a class="hv-card" href="${esc(url)}"><span class="hv-ico" aria-hidden="true">${icon}</span><span class="hv-txt"><b>${esc(title)}</b><small>${esc(stat)}</small><small>${esc(desc)}</small></span></a>`;
  return sec(`<div class="hv-grid">${entry(href("house", "properties"), "🏠", t("房产"), t("{n} 套", { n: props.length }), t("点一套房产进入它的概览"))}
    ${entry(href("house", "cars"), "🚗", t("汽车"), t("{n} 辆", { n: vehicles.length }), t("车辆资料、保养、账单、交易"))}
    ${entry(href("house", "plan"), "🧭", t("买卖计划"), t("买房 / 买车 / 卖房 / 卖车"), t("还没买 / 卖：先看指南、列清单"))}
    ${entry(href("house", "alerts"), "🔔", t("注意事项"), n ? t("{n} 件待处理", { n }) : t("都处理好了 ✓"), t("设备保养、季节任务、交易、耗材 · HOA · 保险"))}</div>`);
}
/** 房产目录页（#/house/properties）：每套房产一张卡，点进它的概览；已结束 / 已归档的收在下面 */
export function viewHouseProps() {
  const { props, houseCard, archivedCard, addCard, ended, archived } = kit();
  return sec(`<section class="hv-sec" aria-label="${esc(t("房产"))}"><div class="section-head"><h3>${t("房产")}</h3><p>${t("点一套房产进入它的概览")}</p></div>
    <div class="hv-grid">${props.map(houseCard).join("")}${state.editProperty === "new" || !canManageHome() ? "" : addCard(`href="${esc(href("house", "profile"))}?sec=type&newprop=1"`, t("添加房产"), t("自住、出租或租住的房子都可以"))}</div>
    ${ended.length ? `<details class="asset-ended"><summary>${t("已结束的房产")} <small>${t("{n} 套，已卖出或已退租；档案、账单和记录保留", { n: ended.length })}</small></summary><div class="hv-grid">${ended.map(houseCard).join("")}</div></details>` : ""}
    ${archived.length ? `<details class="asset-ended"><summary>${t("已归档的房产")} <small>${t("{n} 套，不再持有或租住；资料、账单、设备都保留，可随时恢复", { n: archived.length })}</small></summary><div class="hv-grid">${archived.map(archivedCard).join("")}</div></details>` : ""}</section>`);
}
/** 汽车目录页（#/house/cars）：每辆车一张卡，点进车辆概览；不再用的车收在下面 */
export function viewHouseCars() {
  const { vehicles, vCard, addCard } = kit();
  return sec(`<section class="hv-sec" aria-label="${esc(t("汽车"))}"><div class="section-head"><h3>🚗 ${t("汽车")}</h3></div>
    <div class="hv-grid">${vehicles.map(vCard).join("")}${addCard(`href="${esc(href("asset", "new"))}?type=vehicle_gas&wiz=1"`, t("添加车辆"), t("记下你已经有的车：油车、混动、纯电都可以"))}</div>
    ${pastVehiclesSection(pastVehicles())}</section>`);
}
/** 注意事项页（#/house/alerts）：各房产和车辆要处理的事，按类别看（原房屋首页的待办面板） */
export function viewHouseAlerts() { return sec(houseTodoBoard()); }
/* 房屋页签首页的折叠状态（资产 / 房屋 / 汽车）：记在这台设备上（hmh-house-fold），切换时不重画页面 */
const HF_KEY = "hmh-house-fold";
const houseFold = () => { if (!state.houseFold) { try { state.houseFold = JSON.parse(localStorage.getItem(HF_KEY) || "{}") || {}; } catch { state.houseFold = {}; } } return state.houseFold; };
const houseFolded = (k) => !!houseFold()[k];
if (typeof document !== "undefined") document.addEventListener("toggle", (e) => {   // toggle 不冒泡，用捕获
  const d = e.target; if (!d?.matches?.("details[data-hfold]")) return;
  const f = houseFold(); f[d.dataset.hfold] = !d.open;
  try { localStorage.setItem(HF_KEY, JSON.stringify(f)); } catch { /* 忽略 */ }
}, true);

