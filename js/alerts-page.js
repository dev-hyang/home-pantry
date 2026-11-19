/* 注意事项页（#/alerts）：全部模块的提醒，按模块 / 按优先级两种视图（原来和首页在同一个文件里）。
 * 首页不再读提醒总线，这个页面第一次打开才下载；提醒由各模块自己注册进总线（core/alerts.js）。 */
import { state } from "./core/state.js";
import { Store } from "./core/store.js";
import { href } from "./core/router.js";
import { esc } from "./core/util.js";
import { joinList, t } from "./core/i18n.js";
import { propertyActive } from "./core/lifecycle.js";
import { SEVERITY_CLS, SEVERITY_LABEL, SOURCE_ICON, SOURCE_LABEL, alertCounts, alertRow, collectAlerts, liveProperties, multiProperty, propertyName, withProperty } from "./core/alerts.js";
import { quickOk } from "./core/finance-access.js";
import { allBillsHref } from "./bills/all-href.js";
import { assetsDueCount } from "./house/assets.js";
import "./house/tasks.js";   // 以下三个只为加载：它们加载时把自己的提醒注册进总线
import "./house/deals.js";
import "./house/views.js";
import { clearFiltersBtn } from "./core/clear-filters.js";
import { setTodayPref } from "./today.js";
import { myPersonOf } from "./settings/family-lite.js";

/** 首页提醒按偏好过滤（只看我负责的） */
function myAlerts() {
  let all = collectAlerts();
  const me = myPersonOf();   // 「只看我负责的」：按家庭成员（人）算，不是按设备
  if (state.today.mine && me) all = all.filter((x) => !x.assigned_person_id || x.assigned_person_id === me);
  return all;
}


/* ── 待办 · 按模块：每个模块一行（数量 + 最近的一件），点进模块自己的页面 ──
 * 来源全是提醒总线（已经按财务权限去掉了预算 / 收入 / 借贷）+ 内存里的购物车；链接再过一遍 quickOk，没权限的页面不会出现 */
const AREAS = () => [
  { src: ["bill"], icon: "🧾", name: "周期性账单", href: allBillsHref({ type: "recurring" }), on: state.billsEnabled },
  { src: ["medical"], icon: "🏥", name: "一次性账单", href: allBillsHref({ type: "onetime" }), on: state.billsEnabled },
  { src: ["debt"], icon: "🏦", name: "借贷还款", href: href("bills", "debts"), on: state.billsEnabled },
  { src: ["card"], icon: "💳", name: "卡与账户", href: href("bills", "cards"), on: state.billsEnabled },
  { src: ["budget"], icon: "💰", name: "预算", href: href("bills", "budget"), on: state.billsEnabled },
  { src: ["income"], icon: "🤝", name: "收入还款", href: `${href("bills", "income")}?tab=records`, on: state.billsEnabled },
  { src: ["asset"], icon: "⚙️", name: "设备保养", href: href("house", "assets"), on: state.houseEnabled },
  { src: ["season"], icon: "📅", name: "季节任务", href: `${href("house")}?todo=season`, on: state.houseEnabled },   // 季节任务、交易可能分属几套房产：先到房屋首页的「各房产要处理的事」看全部
  { src: ["deal"], icon: "📝", name: "交易", href: `${href("house")}?todo=deal`, on: state.houseEnabled },
  { src: ["pantry"], icon: "🥫", name: "储藏补货", href: href("pantry", "overview"), on: true },
  { src: ["house"], icon: "🧰", name: "汽车房屋消耗品 · HOA · 保险", href: `${href("house")}?todo=house`, on: state.houseEnabled },
  { src: ["finance"], icon: "📈", name: "财务", href: href("bills", "overview"), on: state.billsEnabled },
  { src: ["join"], icon: "👥", name: "加入申请", href: `${href("me", "settings")}?sec=family`, on: true },
];
/** 待办的行（导出给测试用）：[{ name, icon, href, n, worst, first }] */
export function todoRows(all = myAlerts()) {
  const rows = [];
  const open = state.shopping.filter((s) => s.status === "todo"), claimed = state.shopping.filter((s) => s.status === "claimed");
  if (open.length + claimed.length) {
    const who = joinList([...new Set(claimed.map((c) => c.claimed_by_name || t("家人")))]);
    rows.push({ name: t("购物车"), icon: "🛒", href: href("shopping"), n: open.length + claimed.length, worst: 3,
      first: open.length ? (claimed.length ? t("{n} 项待买，{m} 项家人正在买", { n: open.length, m: claimed.length }) : t("{n} 项待买", { n: open.length })) : t("{who} 正在买", { who }) });
  }
  for (const a of AREAS()) {
    if (!a.on || !quickOk(a.href)) continue;
    const items = all.filter((x) => a.src.includes(x.source));
    if (!items.length) continue;
    const top = items[0];   // 总线已经按轻重 → 必须 → 到期排好
    const spread = multiBucket(items);   // 分属几套房产 / 车辆：首行写分布（例如「自住 2 台 · 车辆 1 台」），免得和某一套房产页上的数字对不上
    rows.push({ name: t(a.name), icon: a.icon, href: spread && a.src[0] === "asset" ? `${href("house")}?todo=asset` : a.href, src: a.src,   // 设备分属几处：去房屋页签的「各房产要处理的事」，不进某一套房产的设备页
      n: a.src[0] === "asset" ? assetsDueCount() || items.length : items.length,   // 设备按台数（一辆车两条提醒算 1 台），和房屋首页、设备页同一个口径
      worst: Math.min(...items.map((x) => x.severity)),
      first: spread || `${withProperty(top.property_id, top.title)}${top.detail ? ` · ${top.detail}` : ""}` });
  }
  return rows.sort((x, y) => x.worst - y.worst);
}
/** 一组提醒分属不止一处（几套房产、车辆、与房产无关）时的分布文字；只有一处返回 ""。设备按台数去重 */
function multiBucket(items) {
  const isAsset = items[0]?.source === "asset", m = new Map();
  for (const x of items) {
    const veh = isAsset && !x.property_id, k = veh ? "veh" : x.property_id || "none";
    if (!m.has(k)) m.set(k, new Set());
    m.get(k).add(isAsset ? x.asset_id || x.title : `${x.title}|${x.due || ""}|${m.get(k).size}`);
  }
  if (m.size < 2) return "";
  const name = (k) => (k === "veh" ? t("车辆") : k === "none" ? t("其他") : propertyName(k) || t("其他"));
  return [...m].map(([k, set]) => `${name(k)} ${isAsset ? t("{n} 台", { n: set.size }) : t("{n} 件", { n: set.size })}`).join(" · ");
}

/* ───────────── 注意事项：清单 + 排序下拉；“全部 / 某来源”一页一页左右滑（桌面点 ‹ ›），每次进来都回到“全部” ───────────── */
const SORTS = [["severity", "按轻重"], ["due", "按到期"], ["source", "按来源"], ["property", "按房产"]];
/** 来源页的顺序：全部，然后按提醒总线的来源顺序只列有提醒的 */
export function alertSourceTabs(counts = alertCounts(myAlerts())) {
  return ["all", ...Object.keys(SOURCE_LABEL).filter((k) => counts.bySource[k])];
}
/** 左右滑动 / ‹ ›：换到上一个或下一个来源页（到头不循环） */
export function shiftAlertSource(delta) {
  const tabs = alertSourceTabs();
  const cur = state.today.source && tabs.includes(state.today.source) ? state.today.source : "all";
  const i = Math.min(tabs.length - 1, Math.max(0, tabs.indexOf(cur) + delta));
  setTodayPref({ source: tabs[i] === "all" ? null : tabs[i] });
}
/** 按模块：每个模块一行（数量 + 最近的一件），点进模块自己的页面（原来今日页的「待办 · 按模块」） */
function byArea(all) {
  const rows = todoRows(all);
  if (!rows.length) return `<section class="section"><div class="panel empty"><strong>${t("各处都没有待办 ✓")}</strong>${t("购物车是空的，账单、保养和季节任务都不急。")}</div></section>`;
  const row = (r) => `<a class="mrow" href="${esc(r.href)}"><span class="mi" aria-hidden="true">${r.icon}</span>
      <span class="mt"><b>${esc(r.name)}</b><small>${esc(r.first)}</small></span>
      <span class="badge mcount ${r.worst <= 2 ? SEVERITY_CLS[r.worst] : "attn-count"}">${r.n}</span><span class="mch" aria-hidden="true">›</span></a>`;
  return `<section class="section"><div class="panel mlist">${rows.map(row).join("")}</div></section>`;
}
export function viewAlerts() {
  const pref = state.today;
  const view = pref.view === "priority" ? "priority" : "area";   // 两种视图：按模块（默认）/ 按优先级；记在这台设备上
  const seg = `<div class="seg alerts-view" role="group" aria-label="${t("视图")}">
      <button type="button" data-action="today-view" data-v="area" aria-pressed="${view === "area"}">${t("按模块")}</button>
      <button type="button" data-action="today-view" data-v="priority" aria-pressed="${view === "priority"}">${t("按优先级")}</button></div>`;
  if (view === "area") {
    return `<nav class="crumb" aria-label="${t("当前位置")}"><a href="${href("today")}">‹ ${t("今日")}</a><span class="sep">/</span><b>${t("待办 | 注意事项")}</b></nav>
      <section class="section today-head">${seg}</section>${byArea(myAlerts())}`;
  }
  const all = myAlerts(), counts = alertCounts(all);
  const canMine = Store.mode === "cloud" && collectAlerts().some((x) => x.assigned_person_id);
  const tabs = alertSourceTabs(counts);
  const src = pref.source && counts.bySource[pref.source] ? pref.source : null;
  const idx = tabs.indexOf(src || "all");
  const shown = src ? all.filter((x) => x.source === src) : all;
  const mode = SORTS.some(([k]) => k === pref.mode) ? pref.mode : "severity";
  const sorts = SORTS.filter(([k]) => k !== "property" || multiProperty()).map(([k, n]) => `<option value="${k}" ${k === mode ? "selected" : ""}>${t(n)}</option>`).join("");
  const toggle = (key, label, on) => `<button type="button" class="chip" data-action="today-pref" data-key="${key}" aria-pressed="${on ? "true" : "false"}">${label}</button>`;
  const body = mode === "property" && multiProperty() ? byProperty(shown) : mode === "source" && !src ? bySource(shown) : mode === "due" ? byDue(shown) : bySeverity(shown);
  const tabName = (k) => (k === "all" ? t("全部") : `${SOURCE_ICON[k] || ""} ${t(SOURCE_LABEL[k] || k)}`);
  const tabCount = (k) => (k === "all" ? all.length : counts.bySource[k] || 0);
  // 来源筛选：下拉列表（全部 / 各来源 + 数量），换来源不用左右翻页
  const pager = tabs.length > 1 ? `<label class="src-dd"><span class="sr-only">${t("提醒来源")}</span><select id="alertSource" aria-label="${t("提醒来源")}">${tabs.map((k) => `<option value="${k}" ${k === tabs[idx] ? "selected" : ""}>${tabName(k)} (${tabCount(k)})</option>`).join("")}</select></label>` : "";
  const restockHere = src === "pantry" && all.some((x) => x.source === "pantry" && x.actions?.some((a) => a.action === "shop-add-item"));   // 只有选了「储藏」才显示；其他来源（账单、房屋…）和「全部」都不显示
  const tools = canMine || restockHere ? `<div class="chips today-chips">
        ${canMine ? toggle("mine", t("只看我负责的"), !!pref.mine) : ""}
        ${restockHere ? `<button type="button" class="chip" data-action="shop-add-alerts" data-space="pantry">${t("补货全部加入购物车")}</button>` : ""}
      </div>` : "";

  return `
    <nav class="crumb crumb-tools" aria-label="${t("当前位置")}"><a href="${href("today")}">‹ ${t("今日")}</a><span class="sep">/</span><b>${t("待办 | 注意事项")}</b>
      <label class="sort-dd"><span class="sr-only">${t("排序")}</span><select id="alertSort" aria-label="${t("排序")}">${sorts}</select></label></nav>
    <section class="section today-head">${seg}${pager}${tools}${clearFiltersBtn("alerts", !!src || !!pref.mine)}</section>
    <div>${body}</div>`;
}

const section = (title, sub, items) => (items.length ? `<section class="section">
    <div class="section-head"><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ""}</div>
    <div class="panel"><ul class="restock-list alert-list">${items.map(alertRow).join("")}</ul></div>
  </section>` : "");
const EMPTY = () => `<section class="section"><div class="panel empty"><strong>${t("今天没有需要处理的事")}</strong></div></section>`;

function bySeverity(list) {
  const SUB = [t("已经过期，先处理"), t("今天到期或今天要做"), t("一周内到期、待核对的自动扣款、缺货"), t("少货、临期、本月季节任务")];
  return [0, 1, 2, 3].map((s) => section(t(SEVERITY_LABEL[s]), SUB[s], list.filter((x) => x.severity === s))).join("") || EMPTY();
}

function byProperty(list) {
  const groups = liveProperties().filter((p) => propertyActive(p) || list.some((x) => x.property_id === p.id)).map((p) => ({ title: `🏠 ${esc(p.name)}`, sub: t(window.DEALS.PROPERTY_STATUS[p.status] || "持有"), items: list.filter((x) => x.property_id === p.id) }));
  groups.push({ title: t("与房产无关"), sub: t("手机、车险、订阅等"), items: list.filter((x) => !x.property_id && x.source !== "pantry" && x.source !== "house") });
  groups.push({ title: t("家里的储藏"), sub: t("补货与临期"), items: list.filter((x) => !x.property_id && (x.source === "pantry" || x.source === "house")) });
  return groups.map((g) => section(g.title, g.sub, g.items)).join("") || EMPTY();
}

function bySource(list) {
  const order = Object.keys(SOURCE_LABEL);
  const srcs = [...new Set(list.map((x) => x.source))].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return srcs.map((s) => { const items = list.filter((x) => x.source === s); return section(`${SOURCE_ICON[s] || ""} ${t(SOURCE_LABEL[s] || s)}`, t("{n} 件", { n: items.length }), items); }).join("") || EMPTY();
}

/** 按到期：有日期的先到先列，没日期的（缺货、少货等）排最后 */
function byDue(list) {
  const dated = list.filter((x) => x.daysLeft != null).sort((a, b) => a.daysLeft - b.daysLeft || a.severity - b.severity);
  const undated = list.filter((x) => x.daysLeft == null);
  return (section(t("按到期先后"), t("逾期的在最前"), dated) + section(t("没有日期"), t("缺货、少货等"), undated)) || EMPTY();
}

