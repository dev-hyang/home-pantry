/* 房屋维护 · 第二期：设备档案与保养记录
 * - 设备档案：按房屋资料一键生成，或手动添加；记录品牌型号、安装年份、保修、寿命、保养周期、负责方
 * - 保养记录：挂在设备下；记一次后自动算下次保养日期；有费用的同时写入 purchases（分类 house_maint，统计并入“房屋维护”）
 * - 页面：#/house/assets 列表、#/house/asset-template 生成、#/asset/new 与 #/asset/<id> 整页表单（编辑页下方带保养记录） */
import { STATUS, state } from "../core/state.js";
import { Store } from "../core/store.js";
import { $, DAY, addMonths, daysUntil, esc, fmt, fmtDate, fmtShort, inSpace, money, num, stampText, todayISO, toast } from "../core/util.js";
import { openShopFor } from "../core/logic.js";
import { locationField, resolveLocation } from "../core/locations.js";
import { SECTIONS, go, href } from "../core/router.js";
import { compare, joinList, sameTerm, t } from "../core/i18n.js";
import { houseBar } from "./property-form.js";
import { countBadge, crumbNav, filledCount, hubList, hubRow, sectionCrumb } from "../core/hub.js";
import { dealHref, dealTasks, openVehicleDeal } from "./deals.js";
import { autofillBar } from "../core/autofill.js";
import { storeDatalist } from "../stats/views.js";
import { propertyName } from "../core/alerts.js";
import { activeProperties } from "../core/lifecycle.js";

const H = () => window.HOUSE;
const V = () => window.VEHICLES;
const C = () => window.CARE;
const OWNER_OPTS = ["self", "hoa", "landlord", "property", "varies"];
export const isVehicle = (a) => a?.kind === "vehicle";
/** 车辆拥有状态（选购中 / 持有 / 贷款中 / 租赁 / 已卖出 / 已归还）与徽章 */
export const vehStatus = (a) => V().statusOf(a);
export const vehStatusBadge = (a) => { const st = V().STATUS[vehStatus(a)]; return `<span class="badge ${st.cls}" ${st.cls ? "" : 'style="background:var(--surface-2)"'}>${t(st.name)}</span>`; };
/** 显示用名称：生成时按当时语言写入的内置名（如“热水器” / “Water heater”）切语言后跟着翻译；自己改过的名字原样显示（家庭词表里有翻译则用词表） */
export const assetName = (a) => (a?.t && sameTerm(a.name, a.t.name, a.t.en) ? t(a.t.name) : t(a?.name));
/** 里程单位：美制英里，其余公里（模板里的数字按用户单位理解） */
export const distUnit = () => (Units.region.system === "us" ? t("英里") : t("公里"));
const plusDays = (iso, n) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
export const SERVICE_BADGE = {
  overdue: { cls: "b-out",  label: "保养逾期" },
  due:     { cls: "b-soon", label: "该保养了" },
  ok:      { cls: "b-ok",   label: "保养正常" },
  unknown: { cls: "b-low",  label: "未记录保养" },
  none:    { cls: "",       label: "" },
};
export const WARRANTY_BADGE = {
  expiring: { cls: "b-soon", label: "保修快到期" },
  expired:  { cls: "",       label: "已过保" },
  active:   { cls: "b-ok",   label: "保修中" },
  none:     { cls: "",       label: "" },
};

/* ── 计算：房龄、寿命占比、下次保养、保修 ── */
export function enrichAssets(assets, logs) {
  const today = new Date(`${todayISO()}T12:00:00`).getTime();
  return assets.map((a) => {
    const at = H().assetType(a.type);
    const mine = logs.filter((l) => l.asset_id === a.id).sort((x, y) => (y.done_on || "").localeCompare(x.done_on || ""));
    // 检查 / 保养 / 更换都算“做过保养”；维修不重置周期
    const lastService = mine.find((l) => l.kind !== "repair")?.done_on || null;
    const interval = num(a.service_interval_months);
    const base = lastService || a.installed_on || null;
    const next = interval > 0 && base ? addMonths(base, interval) : null;
    const dueDays = next ? daysUntil(next) : null;
    const service = !(interval > 0) ? "none" : !base ? "unknown" : dueDays < 0 ? "overdue" : dueDays <= 30 ? "due" : "ok";
    const start = a.installed_on || (a.manufacture_year ? `${a.manufacture_year}-07-01` : null);
    const ageYears = start ? Math.max(0, (today - new Date(`${start}T12:00:00`).getTime()) / (365.25 * DAY)) : null;
    const life = num(a.expected_life_years);
    const lifePct = ageYears != null && life > 0 ? ageYears / life : null;
    const wList = [a.warranty_until, a.labor_warranty_until].filter(Boolean).map(daysUntil);
    const wDays = wList.length ? Math.max(...wList) : null;   // 任一保修仍有效就算保修中
    const warranty = wDays == null ? "none" : wDays < 0 ? "expired" : wDays <= 30 ? "expiring" : "active";
    const totalCost = mine.reduce((s, l) => s + (l.currency && l.currency !== Units.region.currency ? 0 : num(l.cost)), 0);
    // 检查结论为“需保养 / 维修 / 更换”，且之后没有对应记录 → 待处理（首页提醒，直到记一条保养 / 维修 / 更换）
    const lastInspect = mine.find((l) => l.kind === "inspect" && l.result && l.result !== "ok");
    const fixedAfter = lastInspect && mine.some((l) => l.kind !== "inspect" && (l.done_on || "") >= (lastInspect.done_on || "") && l.id !== lastInspect.id);
    const followUp = lastInspect && !fixedAfter ? lastInspect : null;
    const out = { ...a, t: at, logs: mine, lastService, next, dueDays, service, ageYears, lifePct, wDays, warranty, totalCost, followUp };
    if (a.kind === "vehicle") Object.assign(out, vehicleStatus(out, mine));
    return out;
  });
}

/** 车辆：按保养项算下次到期（按月 / 按里程取先到的），再汇总成 service 状态；牌照、排放、保险、租赁到期 */
function vehicleStatus(a, logs) {
  const v = a.vehicle || {};
  const today = todayISO();
  const annual = num(v.annual_miles) || 12000, perDay = annual / 365;
  const odo = num(v.odometer) || null;
  const nowMiles = odo != null ? Math.round(odo + (v.odometer_on ? Math.max(0, -daysUntil(v.odometer_on)) * perDay : 0)) : null;   // 按年均里程推到今天
  const items = V().itemsFor(a.type).filter((s) => s.key !== "other").map((s) => {
    const last = logs.find((l) => l.service_item === s.key && l.kind !== "repair") || null;
    const baseDate = last?.done_on || a.installed_on || null;
    const byDate = s.months && baseDate ? addMonths(baseDate, s.months) : null;
    const nextMiles = s.miles && last?.odometer != null ? last.odometer + s.miles : null;   // 没记过里程就只按日期
    const byMiles = nextMiles != null && nowMiles != null ? plusDays(today, Math.round((nextMiles - nowMiles) / perDay)) : null;
    const next = [byDate, byMiles].filter(Boolean).sort()[0] || null;
    // basis：下次日期是按里程推算还是按月份；fromPurchase：还没记过这项，按购车 / 安装日期起算
    const basis = !next ? null : byMiles && next === byMiles && byMiles !== byDate ? "miles" : "date";
    return { ...s, last, next, nextMiles, days: next ? daysUntil(next) : null, basis, fromPurchase: !last && !!a.installed_on };
  }).sort((x, y) => (x.days ?? 9999) - (y.days ?? 9999));
  const soonest = items.find((s) => s.days != null) || null;
  const service = !soonest ? "unknown" : soonest.days < 0 ? "overdue" : soonest.days <= 30 ? "due" : "ok";
  const doc = (iso) => (iso ? { date: iso, days: daysUntil(iso) } : null);
  const docs = { registration: doc(v.registration_due), emissions: doc(v.emissions_due), insurance: doc(v.insurance?.to), lease: doc(v.lease_end) };
  return { vItems: items, vSoonest: soonest, service, next: soonest?.next || null, dueDays: soonest?.days ?? null, nowMiles, vDocs: docs };
}

/** 车辆列表（不分房产）：全部 / 还在用的（含选购中）/ 已卖出、已归还的 */
export const myVehicles = () => state.assetsEnriched.filter(isVehicle).sort((x, y) => rank(x) - rank(y) || compare(x.name, y.name));
export const activeVehicles = () => myVehicles().filter((a) => V().isActive(a));
export const pastVehicles = () => myVehicles().filter((a) => !V().isActive(a)).sort((x, y) => (y.vehicle?.disposed_on || "").localeCompare(x.vehicle?.disposed_on || ""));

/** 当前房产的设备（不含车辆，车辆挂在家庭上） */
export const myAssets = () => state.assetsEnriched.filter((a) => a.property_id === state.propertyId && !isVehicle(a));
/** 概览用：检查发现问题 > 逾期 > 该保养 > 保修快到期 */
export const assetAlerts = (list) => list
  .filter((a) => a.followUp || a.service === "overdue" || a.service === "due" || a.warranty === "expiring")
  .sort((x, y) => rank(x) - rank(y) || (x.dueDays ?? 999) - (y.dueDays ?? 999));
const rank = (a) => (a.followUp ? 0 : a.service === "overdue" ? 1 : a.service === "due" ? 2 : 3);

/** 提醒总线：所有活跃房产的设备 + 家庭的车辆（检查发现问题 = 尽快·必须；保养逾期 = 今天级；到期 / 保修 = 尽快级） */
export function assetAlertItems() {
  if (!state.houseEnabled || state.pending?.maint) return [];   // 保养记录还在加载：没有记录会被误判成“从没保养过”
  const live = new Set(activeProperties().map((p) => p.id));
  const out = assetAlerts(state.assetsEnriched.filter((a) => (isVehicle(a) ? V().inService(a) : live.has(a.property_id)))).map((a) => ({
    source: "asset", severity: a.followUp ? 2 : a.service === "overdue" ? 1 : 2, must: !!a.followUp, due: a.next,
    daysLeft: a.followUp ? -(-daysUntil(a.followUp.done_on)) : a.service === "overdue" || a.service === "due" ? a.dueDays : a.wDays,
    property_id: a.property_id, title: `${a.t?.icon || "⚙️"} ${assetName(a)}`, detail: alertText(a), href: href("asset", a.id),
    badge: { label: a.followUp ? t(C().RESULTS[a.followUp.result]) : a.service === "overdue" ? t("逾期") : a.service === "due" ? t("保养") : t("保修"), cls: a.followUp || a.service === "overdue" ? "b-out" : "b-soon" },
    actions: [{ type: "link", href: `${href("asset", a.id)}?log=1`, label: a.followUp ? t("记处理结果") : t("记保养") }],
  }));
  // 车辆证照与保险：牌照 / 排放 / 保险 30 天内到期（尽快·必须，过期 → 今天）；租赁 90 天内（留意）
  for (const a of state.assetsEnriched.filter((x) => isVehicle(x) && V().inService(x))) {
    const D = a.vDocs || {};
    const push = (key, label, d, within, sevLate, mustFlag) => {
      if (!d || d.days > within) return;
      out.push({ source: "asset", severity: d.days < 0 ? sevLate : within <= 30 ? 2 : 3, must: mustFlag, due: d.date, daysLeft: d.days, property_id: null,
        title: `${a.t?.icon || "🚗"} ${assetName(a)} · ${label}`, detail: d.days < 0 ? t("已过期 {d} 天", { d: -d.days }) : d.days === 0 ? t("今天到期") : t("{d} 天后到期（{date}）", { d: d.days, date: fmtDate(d.date) }),
        href: href("asset", a.id), badge: { label: d.days < 0 ? t("已过期") : t("快到期"), cls: d.days < 0 ? "b-out" : "b-soon" }, actions: [{ type: "link", href: href("asset", a.id), label: t("更新") }] });
    };
    push("registration", t("牌照年贴"), D.registration, 30, 1, true);
    push("emissions", t("排放检测"), D.emissions, 30, 1, true);
    push("insurance", t("车险续保"), D.insurance, 30, 1, true);
    push("lease", t("租赁到期"), D.lease, 90, 2, false);
  }
  return out;
}

export function alertText(a) {
  if (a.followUp) return t("{date} 检查结论：{r}，还没记处理", { date: fmtDate(a.followUp.done_on), r: t(C().RESULTS[a.followUp.result]) });
  if (isVehicle(a) && a.vSoonest && (a.service === "overdue" || a.service === "due")) {
    const s = a.vSoonest, item = t(s.name);
    return a.dueDays < 0 ? t("{item}逾期 {d} 天", { item, d: -a.dueDays }) : a.dueDays === 0 ? t("{item}今天到期", { item }) : t("{item}{d} 天后到期", { item, d: a.dueDays });
  }
  if (a.service === "overdue") return t("保养逾期 {d} 天（上次 {last}）", { d: -a.dueDays, last: a.lastService ? fmtDate(a.lastService) : t("按安装日期算") });
  if (a.service === "due") return a.dueDays === 0 ? t("今天该保养了") : t("{d} 天后该保养", { d: a.dueDays });
  if (a.warranty === "expiring") return a.wDays === 0 ? t("保修今天到期") : t("保修 {d} 天后到期", { d: a.wDays });
  return "";
}

/* ── 检查卡：看什么、正常是什么样、自己做什么、什么时候叫人、红线、费用、时段 ── */
export function careCard(key, { open = false } = {}) {
  const c = C().cardOf(key); if (!c) return "";
  const list = (title, arr, cls = "") => (arr?.length ? `<div class="care-sec ${cls}"><h4>${title}</h4><ul class="tips">${arr.map((x) => `<li>${esc(t(x))}</li>`).join("")}</ul></div>` : "");
  return `<details class="care-card" ${open ? "open" : ""}><summary>🔍 ${t("怎么查、什么时候叫人")}</summary>
    ${list(t("看什么"), c.check)}
    ${c.ok ? `<p class="care-ok"><b>${t("正常是什么样")}</b>${esc(t(c.ok))}</p>` : ""}
    ${list(t("自己能做"), c.diy, "care-diy")}
    ${list(t("这些情况约师傅"), c.pro, "care-pro")}
    ${list(t("马上处理"), c.urgent, "care-urgent")}
    ${c.cost ? `<p class="care-meta"><b>${t("费用")}</b>${esc(t(c.cost))}</p>` : ""}
    ${c.when ? `<p class="care-meta"><b>${t("什么时候")}</b>${esc(t(c.when))}</p>` : ""}
  </details>`;
}

/** 设备页面包屑：来源 / 房产 / 设备名 / 当前块 —— 设备属于某套房产时带上房产（点它回到这套房产的设备保养）；车辆是全家的，没有房产这一段 */
/** 设备：房屋 / 房产 / 设备保养 / 设备名；车辆：房屋 / 车辆 / 车名（固定层级，不随“从哪个页面进来”变） */
const assetBase = (a, veh) => {
  const pid = a?.property_id || state.propertyId, pn = pid ? propertyName(pid) : "";
  return veh ? [{ href: href("house"), label: t("房屋") }, { href: href("house", "vehicles"), label: t("车辆"), icon: "🚗" }]
    : [{ href: href("house"), label: t("房屋") }, ...(pn ? [{ href: `${href("house", "pages")}?prop=${pid}`, label: pn, icon: "🏠" }] : []), { href: `${href("house", "assets")}${pid ? `?prop=${pid}` : ""}`, label: t("设备保养") }];
};
const assetTrail = (a, _root, hubHref) => [...assetBase(a, isVehicle(a)), { href: hubHref, label: assetName(a), icon: a.t?.icon || "⚙️" }];
const assetCrumb = (a, root, hubHref, cur) => crumbNav([...assetTrail(a, root, hubHref), { label: cur }]);
const ageText = (a) => (a.ageYears < 1 ? t("不到 1 年") : t("{n} 年", { n: Math.floor(a.ageYears) }));

/* ── 设备列表：搜索 + 类型 / 保养 / 保修 / 位置 筛选（只作用在下面的分组列表，上面的“要处理”提醒不受影响） ── */
const SERVICE_FILTERS = [["all", "全部保养状态"], ["attention", "需要处理"], ["overdue", "保养逾期"], ["due", "该保养了"], ["ok", "保养正常"], ["unknown", "未记录保养"], ["none", "没设保养周期"]];
const WARRANTY_FILTERS = [["all", "全部保修状态"], ["active", "保修中"], ["expiring", "保修快到期"], ["expired", "已过保"], ["none", "没填保修"]];
const ASSET_SORTS = [["alert", "提醒优先"], ["due", "下次保养：近 → 远"], ["name", "名称 A → Z"], ["age", "设备年龄：老 → 新"], ["life", "已用寿命：多 → 少"]];
const assetTypeLabel = (a) => (a.t ? t(a.t.name) : t(a.type || "其他"));
const matchAsset = (a, f) => {
  if (f.type !== "all" && a.type !== f.type) return false;
  if (f.loc !== "all" && a.location !== f.loc) return false;
  if (f.warranty !== "all" && a.warranty !== f.warranty) return false;
  if (f.service === "attention" ? !(a.followUp || a.service === "overdue" || a.service === "due") : f.service !== "all" && a.service !== f.service) return false;
  const q = f.q.trim().toLowerCase();
  return !q || [assetName(a), a.brand, a.model, a.location, assetTypeLabel(a)].filter(Boolean).some((x) => String(x).toLowerCase().includes(q));
};
/** 当前房产的筛选条件；选项里已经没有的值（换了房产、删了设备）按“全部”处理 */
function assetFilterNow(list) {
  const f = { ...state.assetFilter };
  if (!list.some((a) => a.type === f.type)) f.type = "all";
  if (!list.some((a) => a.location === f.loc)) f.loc = "all";
  return f;
}
function assetGroups(list) {
  const f = assetFilterNow(list), rows = list.filter((a) => matchAsset(a, f));
  const sorter = { alert: (x, y) => rank(x) - rank(y) || compare(x.name, y.name), due: (x, y) => (x.next || "9999").localeCompare(y.next || "9999") || compare(x.name, y.name), name: (x, y) => compare(assetName(x), assetName(y)),
    age: (x, y) => (y.ageYears ?? -1) - (x.ageYears ?? -1) || compare(x.name, y.name), life: (x, y) => (y.lifePct ?? -1) - (x.lifePct ?? -1) || compare(x.name, y.name) }[f.sort] || ((x, y) => rank(x) - rank(y));
  const group = (kind) => rows.filter((a) => a.kind === kind).sort(sorter);
  const section = (kind) => {
    const g = group(kind);
    if (!g.length) return "";
    const k = H().ASSET_KINDS[kind];
    return `<section class="section"><div class="section-head"><h2>${k.icon} ${t(k.name)}<span class="muted">（${g.length}）</span></h2></div>
      <div class="asset-grid">${g.map(assetCard).join("")}</div></section>`;
  };
  return { rows, html: rows.length ? section("equipment") + section("tool") : `<div class="panel empty"><strong>${t("没有符合条件的设备")}</strong>${t("换个关键词或筛选试试。")}</div>` };
}
const assetCountText = (rows, list) => (rows.length === list.length ? t("{n} 台", { n: list.length }) : t("{m} / {n} 台", { m: rows.length, n: list.length }));
/** 搜索 / 筛选变化：只重画列表和数量，输入框不丢焦点 */
export function renderAssetList() {
  const host = $("#assetList"); if (!host) return;
  const list = myAssets(), { rows, html } = assetGroups(list);
  host.innerHTML = html;
  const n = $("#assetCount"); if (n) n.textContent = assetCountText(rows, list);
}
function assetToolbar(list) {
  const f = assetFilterNow(list);
  const opt = (v, label, cur) => `<option value="${esc(v)}" ${cur === v ? "selected" : ""}>${esc(label)}</option>`;
  const types = [...new Map(list.map((a) => [a.type, assetTypeLabel(a)])).entries()].sort((x, y) => compare(x[1], y[1]));
  const locs = [...new Set(list.map((a) => a.location).filter(Boolean))].sort(compare);
  return `<div class="toolbar">
    <input type="search" id="assetSearch" placeholder="${t("搜索设备，例如：炉子、Carrier")}" value="${esc(f.q)}" aria-label="${t("搜索设备")}">
    ${types.length > 1 ? `<select id="assetType" aria-label="${t("按类型筛选")}">${opt("all", t("全部类型"), f.type)}${types.map(([v, l]) => opt(v, l, f.type)).join("")}</select>` : ""}
    <select id="assetService" aria-label="${t("按保养状态筛选")}">${SERVICE_FILTERS.map(([v, l]) => opt(v, t(l), f.service)).join("")}</select>
    <select id="assetWarranty" aria-label="${t("按保修状态筛选")}">${WARRANTY_FILTERS.map(([v, l]) => opt(v, t(l), f.warranty)).join("")}</select>
    <select id="assetSort" aria-label="${t("排序")}">${ASSET_SORTS.map(([v, l]) => opt(v, t(l), f.sort)).join("")}</select>
    ${locs.length > 1 ? `<select id="assetLoc" aria-label="${t("按位置筛选")}">${opt("all", t("全部位置"), f.loc)}${locs.map((l) => opt(l, t(l), f.loc)).join("")}</select>` : ""}</div>`;
}

export function viewAssets() {
  const list = myAssets();
  const p = state.houseProfile;
  const alerts = assetAlerts(list);
  const { rows, html } = assetGroups(list);
  return `
    ${houseBar()}
    <section class="section">
      <div class="section-head"><p id="assetCount">${list.length ? assetCountText(rows, list) : ""}</p>
        <div class="head-acts">${p ? `<a class="btn btn-sm btn-ghost" href="${href("house", "asset-template")}">${t("按房屋资料生成")}</a>` : ""}
          <a class="btn btn-primary" href="${href("asset", "new")}">${t("添加设备")}</a></div></div>
      <p class="muted" style="margin:0 0 10px;font-size:12.5px">${t("设备 = 有保养周期或保修的（热水器、割草机）；只要记数量和位置的（梯子、电钻、床品）放在 储藏 → 装备。")}</p>
      ${alerts.length ? `<div class="panel"><ul class="restock-list">${alerts.slice(0, 6).map((a) => `<li>
          <span class="badge ${a.service === "overdue" ? "b-out" : "b-soon"}">${a.service === "overdue" ? t("逾期") : a.service === "due" ? t("保养") : t("保修")}</span>
          <div class="grow"><a class="link-name" href="${href("asset", a.id)}">${esc(assetName(a))}</a><small>${esc(alertText(a))}</small></div>
          <a class="btn btn-sm" href="${href("asset", a.id)}?log=1">${t("记保养")}</a></li>`).join("")}</ul></div>`
        : list.length ? `<p class="muted" style="margin:0;font-size:13px">${t("保养都在周期内，保修也没有快到期的。")}</p>` : ""}
    </section>
    ${list.length ? `<section class="section">${assetToolbar(list)}<div id="assetList">${html}</div></section>` : `<section class="section"><div class="panel empty"><strong>${t("还没有设备档案")}</strong>
      ${p ? t("按房屋资料一次生成炉子、热水器、排水泵、屋顶等设备，再补充品牌、型号和安装年份。") : t("先填写房屋资料，就能按设施一键生成设备清单。")}
      <p>${p ? `<a class="btn btn-primary" href="${href("house", "asset-template")}">${t("生成设备清单")}</a>` : `<a class="btn btn-primary" href="${href("house", "profile")}">${t("填写房屋资料")}</a>`}
         <a class="btn btn-ghost" href="${href("asset", "new")}">${t("手动添加一台")}</a></p></div></section>`}`;
}

/* ── 车辆页：家庭的所有车（不分房产），每辆的保养到期、证照与保险 ── */
export function viewVehicles() {
  const list = activeVehicles(), past = pastVehicles();
  const alerts = assetAlerts(list.filter((a) => V().inService(a)));
  const region = state.houseProfile?.region || (Units.region.system === "us" ? "na" : "cn");
  const notes = V().REGION_NOTES[region] || [];
  return `
    <section class="section">
      <div class="section-head"><p>${list.length ? t("{n} 辆", { n: list.length }) : ""}</p>
        <div class="head-acts"><button type="button" class="btn btn-sm btn-ghost" data-action="veh-buy-start">${t("开始买车流程")}</button>
          <a class="btn btn-primary" href="${href("asset", "new")}?type=vehicle_gas">${t("添加车辆")}</a></div></div>
      ${alerts.length ? `<div class="panel"><ul class="restock-list">${alerts.map((a) => `<li>
          <span class="badge ${a.followUp || a.service === "overdue" ? "b-out" : "b-soon"}">${a.followUp ? t(C().RESULTS[a.followUp.result]) : a.service === "overdue" ? t("逾期") : a.service === "due" ? t("保养") : t("保修")}</span>
          <div class="grow"><a class="link-name" href="${href("asset", a.id)}">${esc(assetName(a))}</a><small>${esc(alertText(a))}</small></div>
          <a class="btn btn-sm" href="${href("asset", a.id)}?log=1">${t("记保养")}</a></li>`).join("")}</ul></div>` : ""}
    </section>
    ${list.length ? `<section class="section"><div class="asset-grid">${list.map(vehicleCard).join("")}</div></section>`
      : `<section class="section"><div class="panel empty"><strong>${past.length ? t("没有在用的车辆") : t("还没有车辆档案")}</strong>${t("记下年款、车牌、里程和动力类型，按月或按里程提醒机油、轮胎、刹车油、12V 电瓶等；牌照、排放、保险到期也会提醒。油车和电车用不同的保养模板。")}
        <p><a class="btn btn-primary" href="${href("asset", "new")}?type=vehicle_gas">${t("添加油车 / 混动")}</a> <a class="btn btn-ghost" href="${href("asset", "new")}?type=vehicle_ev">${t("添加纯电 / 插混")}</a></p></div></section>`}
    ${pastVehiclesSection(past)}
    ${notes.length ? `<section class="section"><div class="panel"><h3 style="font-size:15px;margin:0 0 6px">${t("本地须知")}</h3><ul class="tips">${notes.map((x) => `<li>${esc(t(x))}</li>`).join("")}</ul></div></section>` : ""}`;
}

/** 已卖出 / 已归还的车：一行一辆，点开还能看档案、保养记录和当时的交易清单 */
function pastVehiclesSection(past) {
  if (!past.length) return "";
  return `<section class="section"><details class="panel ref-panel"><summary><b>${t("历史车辆")}</b><small>${t("{n} 辆，已卖出或已归还；档案和保养记录保留", { n: past.length })}</small><span class="mch" aria-hidden="true">›</span></summary>
    <ul class="restock-list hist-list ref-body">${past.map((a) => { const v = a.vehicle || {}; return `<li>
      <span class="asset-ico" aria-hidden="true">${V().POWERTRAINS[a.type]?.icon || "🚗"}</span>
      <div class="grow"><a class="link-name" href="${href("asset", a.id)}">${esc(assetName(a))}</a>
        <small>${[t(V().STATUS[vehStatus(a)].name), v.disposed_on ? fmtDate(v.disposed_on) : null, v.sale_price != null ? money(num(v.sale_price)) : null,
          a.installed_on ? t("{d} 购入", { d: fmtDate(a.installed_on) }) : null, a.logs.length ? t("{n} 条保养记录", { n: a.logs.length }) : null, a.totalCost ? t("共花 {m}", { m: money(a.totalCost) }) : null].filter(Boolean).map(esc).join(" · ")}</small></div>
      <span class="hist-act"><a class="btn btn-sm btn-ghost" href="${href("asset", a.id)}">${t("详情")}</a></span></li>`; }).join("")}</ul></details></section>`;
}

/** “开始买车流程”：先建一辆“选购中”的占位车，再在它名下开交易；提车后改名、补车牌 */
export async function startVehiclePurchase() {
  const id = await Store.saveAsset({ kind: "vehicle", type: "vehicle_gas", name: t("新车（选购中）"), location: null, brand: null, model: null, serial: null,
    installed_on: null, manufacture_year: null, warranty_until: null, labor_warranty_until: null, expected_life_years: 15, service_interval_months: null,
    purchase_price: null, replacement_cost_estimate: null, owner: null, notes: null, property_id: null, vehicle: { status: "looking" } });
  return id;
}

function vehicleCard(a) {
  const v = a.vehicle || {}, pt = V().POWERTRAINS[a.type];
  const sb = SERVICE_BADGE[a.service];
  const D = a.vDocs || {};
  const docBadge = (label, d) => (!d ? "" : `<span class="badge ${d.days < 0 ? "b-out" : d.days <= 30 ? "b-soon" : "b-ok"}">${label} ${d.days < 0 ? t("已过期") : fmtDate(d.date)}</span>`);
  const upcoming = (a.vItems || []).filter((s) => s.days != null).slice(0, 3);
  const meta = [
    [a.manufacture_year, a.brand, a.model].filter(Boolean).join(" "),
    v.plate && `🪪 ${v.plate}${v.plate_state ? ` (${v.plate_state})` : ""}`,
    a.nowMiles != null && t("约 {n} {u}", { n: fmt(a.nowMiles), u: distUnit() }),
  ].filter(Boolean).map((x) => `<span>${esc(x)}</span>`).join("");
  return `<article class="asset-card">
    <div class="asset-head"><span class="asset-ico" aria-hidden="true">${pt?.icon || "🚗"}</span>
      <div class="grow"><a class="asset-name" href="${href("asset", a.id)}">${esc(assetName(a))}</a><div class="item-meta">${meta}<span class="badge" style="background:var(--surface-2)">${t(pt?.name || "")}</span></div></div></div>
    <div class="asset-badges">
      ${vehStatus(a) === "owned" ? "" : vehStatusBadge(a)}
      ${a.followUp ? `<span class="badge b-out">${t(C().RESULTS[a.followUp.result])}</span>` : ""}
      ${sb.label && V().inService(a) ? `<span class="badge ${sb.cls}">${t(sb.label)}</span>` : ""}
      ${docBadge(t("牌照"), D.registration)}${docBadge(t("排放"), D.emissions)}${docBadge(t("保险"), D.insurance)}${docBadge(t("租赁"), D.lease)}
    </div>
    ${vehDealLine(a)}
    ${vehStatus(a) === "looking" ? `<small class="muted">${t("选购中：提车后把名称、车牌、里程补上。")}</small>`
      : upcoming.length ? `<ul class="veh-due">${upcoming.map((s) => `<li class="${s.days < 0 ? "late" : s.days <= 30 ? "soon" : ""}"><span>${esc(t(s.name))}</span><small>${fmtDate(s.next)}${s.nextMiles != null ? ` · ${fmt(s.nextMiles)} ${distUnit()}` : ""}</small></li>`).join("")}</ul>`
      : `<small class="muted">${t("填购车日期或记第一次保养后，这里会列出下一步该做的保养。")}</small>`}
    <div class="acts"><a class="btn btn-sm" href="${href("asset", a.id)}?log=1">${t("记保养")}</a><a class="btn btn-sm btn-ghost" href="${href("asset", a.id)}">${t("详情")}</a></div>
  </article>`;
}
/** 卡片 / 枢纽里的一行：进行中的交易进度 */
function vehDealLine(a) {
  const d = openVehicleDeal(a.id); if (!d) return "";
  const tasks = dealTasks(d), done = tasks.filter((x) => x.done).length, late = tasks.filter((x) => !x.done && x.overdue).length;
  return `<a class="meta-tag b-soon" href="${dealHref(d)}"><small>${t(window.DEALS.KINDS[d.kind])}</small>${t("进行中 {a} / {b}", { a: done, b: tasks.length })}${late ? ` · <b class="lag-late">${t("逾期 {n}", { n: late })}</b>` : ""}</a>`;
}

export function assetCard(a) {
  const sb = SERVICE_BADGE[a.service], wb = WARRANTY_BADGE[a.warranty];
  const o = a.owner ? H().OWNERS[a.owner] : null;
  const life = num(a.expected_life_years);
  const pct = a.lifePct != null ? Math.min(100, Math.round(a.lifePct * 100)) : null;
  const lifeCls = pct == null ? "" : pct >= 100 ? "over" : pct >= 75 ? "late" : "";
  const meta = [
    [a.brand, a.model].filter(Boolean).join(" "),
    a.location && `📍${t(a.location)}`,
    o && t("负责：{who}", { who: t(o.name) }),
  ].filter(Boolean).map((x) => `<span>${esc(x)}</span>`).join("")
    + ((a.updated_at || a.created_at) ? `<span title="${esc(stampText(a))}">${t("{d} 更新", { d: fmtShort(a.updated_at || a.created_at) })}</span>` : "");
  return `<article class="asset-card">
    <div class="asset-head"><span class="asset-ico" aria-hidden="true">${a.t?.icon || "⚙️"}</span>
      <div class="grow"><a class="asset-name" href="${href("asset", a.id)}">${esc(assetName(a))}</a>
        <div class="item-meta">${meta || `<span>${esc(a.t ? t(a.t.name) : "")}</span>`}</div></div></div>
    <div class="asset-badges">
      ${a.followUp ? `<span class="badge b-out">${t("检查：{r}", { r: t(C().RESULTS[a.followUp.result]) })}</span>` : ""}
      ${sb.label ? `<span class="badge ${sb.cls}">${t(sb.label)}${a.next && a.service !== "unknown" ? ` · ${fmtDate(a.next)}` : ""}</span>` : ""}
      ${wb.label ? `<span class="badge ${wb.cls}">${t(wb.label)}</span>` : ""}
    </div>
    ${a.ageYears != null || life ? `<div class="life"><div class="life-bar ${lifeCls}"><i style="width:${pct ?? 0}%"></i></div>
      <small>${a.ageYears != null ? t("已用 {age}", { age: ageText(a) }) : t("安装日期未填")}${life ? t(" · 常见寿命约 {n} 年", { n: fmt(life) }) : ""}${pct != null && pct >= 75 ? t("，已到 {p}%", { p: pct }) : ""}</small></div>` : ""}
    <div class="acts"><a class="btn btn-sm" href="${href("asset", a.id)}?log=1">${t("记保养")}</a><a class="btn btn-sm btn-ghost" href="${href("asset", a.id)}">${t("详情")}</a></div>
  </article>`;
}

/* ── 按房屋资料生成设备 ── */
export function viewAssetTemplate() {
  const p = state.houseProfile;
  if (!p) return `<div class="panel empty"><strong>${t("先填写房屋资料")}</strong>${t("设备清单会根据房型和设施生成。")}<p><a class="btn btn-primary" href="${href("house", "profile")}">${t("填写房屋资料")}</a></p></div>`;
  const recs = H().recommendAssets(p);
  const haveTypes = new Set(state.assets.filter((a) => a.property_id === state.propertyId).map((a) => a.type));
  const groups = Object.entries(H().ASSET_KINDS).map(([kind, k]) => ({ kind, k, rows: recs.filter((r) => r.kind === kind) })).filter((g) => g.rows.length);
  const fresh = recs.filter((r) => !haveTypes.has(r.id)).length;
  return `
    <section class="section">
      <div class="section-head"><h2>${t("按房屋资料生成设备")}</h2><p>${t("共 {n} 项", { n: recs.length })}${fresh < recs.length ? t("，其中 {n} 项已有档案", { n: recs.length - fresh }) : ""}</p></div>
      <form id="assetTemplateForm" class="panel">
        <div class="tpl-bar">
          <button type="button" class="btn btn-sm btn-ghost" data-action="tpl-all" data-on="1">${t("全选")}</button>
          <button type="button" class="btn btn-sm btn-ghost" data-action="tpl-all" data-on="0">${t("全不选")}</button>
          <span class="muted">${t("生成后再到每台设备里补品牌、型号、安装年份和保修；寿命和周期是常见经验值，可改。")}</span>
        </div>
        ${groups.map(({ k, rows }) => `<fieldset class="tpl-group" style="--cat:#5c6b63">
          <legend>${k.icon} ${t(k.name)}</legend>
          ${rows.map((r) => {
            const exists = haveTypes.has(r.id);
            const o = H().OWNERS[r.owner];
            return `<label class="tpl-row ${exists ? "is-have" : ""}">
              <input type="checkbox" name="tpl" value="${esc(r.id)}" ${exists ? "disabled" : r.optional ? "" : "checked"}>
              <span class="grow"><b>${r.icon} ${esc(t(r.name))}</b><small>${r.life ? t("常见寿命约 {n} 年", { n: r.life }) : t("寿命不固定")}${r.interval ? t("，建议每 {n} 个月保养", { n: r.interval }) : ""}${o ? t("，通常由{who}负责", { who: t(o.name) }) : ""}</small>
                ${r.tip ? `<small class="note">${esc(t(r.tip))}</small>` : ""}</span>
              ${exists ? `<span class="badge b-ok">${t("已有")}</span>` : ""}
            </label>`;
          }).join("")}
        </fieldset>`).join("")}
        <div class="form-actions" style="margin-top:12px">
          <button type="submit" class="btn btn-primary" ${fresh ? "" : "disabled"}>${t("生成选中的设备")}</button>
          <a class="btn btn-ghost" href="${href("house", "assets")}">${t("稍后再说")}</a>
        </div>
      </form>
    </section>`;
}

/** 勾选的模板 → 设备行（名称和备注按当前语言写入） */
export function assetTemplateItems(ids) {
  return H().recommendAssets(state.houseProfile).filter((r) => ids.includes(r.id)).map((r) => ({
    kind: r.kind, type: r.id, name: t(r.name), location: null, brand: null, model: null, serial: null,
    installed_on: null, manufacture_year: null, warranty_until: null, labor_warranty_until: null,
    expected_life_years: r.life, service_interval_months: r.interval, purchase_price: null, replacement_cost_estimate: null,
    owner: r.kind === "equipment" ? r.owner : null, notes: r.tip ? t(r.tip) : null,
  }));
}

/* ── 设备表单（整页；编辑时下方带保养记录） ── */
export function openAsset(id, { type } = {}) {
  go(`${href("asset", id || "new")}${type ? `?type=${encodeURIComponent(type)}` : ""}`);
}

/** 分区页（?sec= / ?log=1）：后退一步回枢纽；枢纽页：直接跳回进来之前的页面（不能 history.back，会掉回刚看过的分区） */
export function leaveAsset(changed) {
  if (changed) state.needsRefresh = true;
  state.skipAutosave = true;
  const q = state.route?.q, inSection = !!(q && (q.get("sec") || q.get("log") === "1"));
  if (inSection && state.prevRoute) history.back();
  else if (state.prevHash && state.prevRoute) go(state.prevHash);
  else go(href("house", state.route?.id && isVehicle(state.assets.find((x) => x.id === state.route.id)) ? "vehicles" : "assets"), { replace: true });
}

function typeOptions(selected, kind) {
  const p = state.houseProfile;
  const list = (p ? H().forRegion(H().ASSET_TYPES, p.region) : H().ASSET_TYPES).filter((x) => !x.legacy || x.id === selected);   // 梯子、电钻等无保养的工具归“装备”，旧记录仍能显示
  const opt = (x) => `<option value="${x.id}" ${x.id === selected ? "selected" : ""}>${x.icon} ${esc(t(x.name))}</option>`;
  if (kind === "vehicle") return list.filter((x) => x.kind === "vehicle").map(opt).join("");   // 车辆只在动力类型里选
  const mine = list.filter((x) => x.kind === kind), others = list.filter((x) => x.kind !== kind && x.kind !== "vehicle");
  return `${mine.map(opt).join("")}<optgroup label="${kind === "tool" ? t("设备") : t("工具")}">${others.map(opt).join("")}</optgroup>`;
}

/** 车辆专有区块：车牌、里程、证照到期、保险（与房屋保险同构） */
function vehicleFieldset(a, hide = () => "") {
  const v = a?.vehicle || {}, ins = v.insurance || {};
  const d = (x) => esc(x ?? "");
  return `<fieldset class="veh-only" data-sec="plate" ${hide("plate")}>
      <legend>${t("车牌与里程")}</legend>
      <div class="form-grid">
        <label>${t("车牌")}<input name="veh_plate" maxlength="12" value="${d(v.plate)}"></label>
        <label>${t("上牌州 / 省")}<input name="veh_plate_state" maxlength="12" placeholder="IL" value="${d(v.plate_state)}"></label>
        <label>${t("当前里程（{u}）", { u: distUnit() })}<input name="veh_odometer" type="number" inputmode="numeric" min="0" step="1" value="${d(v.odometer)}"></label>
        <label>${t("里程记录日期")}<input name="veh_odometer_on" type="date" value="${d(v.odometer_on || todayISO())}"></label>
        <label>${t("年均里程（{u}）", { u: distUnit() })}<input name="veh_annual_miles" type="number" inputmode="numeric" min="0" step="100" placeholder="12000" value="${d(v.annual_miles)}"><small>${t("用来把“按里程”的保养换算成日期")}</small></label>
      </div>
    </fieldset>
    <fieldset class="veh-only" data-sec="docs" ${hide("docs")}>
      <legend>${t("拥有状态与证照")}</legend>
      <div class="form-grid">
        <label>${t("拥有状态")}<select name="veh_status">${Object.entries(V().STATUS).map(([k, x]) => `<option value="${k}" ${k === V().statusOf(a) ? "selected" : ""}>${t(x.name)}</option>`).join("")}</select>
          <small>${t("已卖出 / 已归还的车从列表和提醒里退出，档案和保养记录保留在“历史车辆”")}</small></label>
        <label>${t("租赁到期（租车才填）")}<input name="veh_lease_end" type="date" value="${d(v.lease_end)}"><small>${t("到期前 90 天提醒，可从车辆交易里走归还流程")}</small></label>
        <label>${t("贷款结清日期（贷款中才填）")}<input name="veh_loan_end" type="date" value="${d(v.loan_end)}"></label>
        <label>${t("卖出 / 归还日期")}<input name="veh_disposed_on" type="date" value="${d(v.disposed_on)}"></label>
        <label>${t("卖出价（{cur}）", { cur: Units.region.currency })}<input name="veh_sale_price" type="number" inputmode="decimal" min="0" step="0.01" value="${d(v.sale_price)}"></label>
        <label>${t("牌照年贴到期")}<input name="veh_registration_due" type="date" value="${d(v.registration_due)}"><small>${t("到期前 30 天提醒")}</small></label>
        <label>${t("排放检测到期")}<input name="veh_emissions_due" type="date" value="${d(v.emissions_due)}"><small>${t("纯电免检可留空")}</small></label>
      </div>
    </fieldset>
    <fieldset class="veh-only" data-sec="insurance" ${hide("insurance")}>
      <legend>${t("车险")}</legend>
      <div class="form-grid">
        <label>${t("保险公司")}<input name="veh_ins_provider" maxlength="60" value="${d(ins.provider)}"></label>
        <label>${t("保单号")}<input name="veh_ins_policy" maxlength="60" value="${d(ins.policy)}"><small>${t("几辆车同一张保单就填同一个号，提醒会合并")}</small></label>
        <label>${t("生效日")}<input name="veh_ins_from" type="date" value="${d(ins.from)}"></label>
        <label>${t("到期日")}<input name="veh_ins_to" type="date" value="${d(ins.to)}"><small>${t("到期前 30 天提醒续保")}</small></label>
        <label class="span-2">${t("保障范围")}<input name="veh_ins_coverage" maxlength="200" placeholder="${t("例如：责任 100/300/50、碰撞自付 $500、综合自付 $250")}" value="${d(ins.coverage)}"></label>
        <label>${t("代理 / 经纪人")}<input name="veh_ins_agent" maxlength="60" value="${d(ins.agent)}"></label>
        <label>${t("理赔电话")}<input name="veh_ins_phone" type="tel" maxlength="40" value="${d(ins.phone)}"></label>
        <label class="span-2">${t("理赔邮箱")}<input name="veh_ins_email" type="email" maxlength="120" value="${d(ins.email)}"></label>
      </div>
      <p class="hint">${t("账单里的“车险”负责缴费提醒，这里负责续保和保障范围。")}</p>
    </fieldset>`;
}

/** 车辆详情页顶部：保养项时间表 */
function vehicleSchedule(a) {
  const items = a.vItems || [];
  if (!items.length) return "";
  const base = href("asset", a.id);
  // “下次”的依据写清楚：没记过的按购车日期起算；按里程推算的注明现在约多少里程，免得误以为没更新
  const why = (s) => (s.fromPurchase ? t("还没记过这项，按购车 / 安装日期起算") : s.basis === "miles" ? t("按里程推算，现在约 {n} {u}", { n: fmt(a.nowMiles), u: distUnit() }) : "");
  const row = (s) => `<tr class="${s.days == null ? "" : s.days < 0 ? "late" : s.days <= 30 ? "soon" : ""}">
      <th scope="row">${esc(t(s.name))}${s.note ? `<small>${esc(t(s.note))}</small>` : ""}</th>
      <td>${[s.months ? t("{n} 个月", { n: s.months }) : "", s.miles ? `${fmt(s.miles)} ${distUnit()}` : ""].filter(Boolean).join(" / ") || "—"}</td>
      <td>${s.last ? `${fmtDate(s.last.done_on)}${s.last.odometer != null ? `<small>${fmt(s.last.odometer)} ${distUnit()}</small>` : ""}` : `<span class="muted">—</span>`}</td>
      <td>${s.next ? `<b>${fmtDate(s.next)}</b>${s.nextMiles != null ? `<small>${fmt(s.nextMiles)} ${distUnit()}</small>` : ""}${s.days != null ? `<small>${s.days < 0 ? t("逾期 {d} 天", { d: -s.days }) : t("{d} 天后", { d: s.days })}</small>` : ""}${why(s) ? `<small class="muted">${why(s)}</small>` : ""}` : `<span class="muted">${t("记一次后开始算")}</span>`}</td>
      <td><a class="btn btn-sm btn-ghost" href="${base}?log=1&item=${s.key}">${t("记一次")}</a></td>
    </tr>`;
  return `<div class="section-head"><p>${t("按月和按里程取先到的；里程按年均里程推算。记保养时要选对“保养项目”，那一项的下次日期才会更新")}</p></div>
    <div class="panel"><div class="ch-scroll"><table class="owner-table veh-table"><thead><tr><th>${t("项目")}</th><th>${t("周期")}</th><th>${t("上次")}</th><th>${t("下次")}</th><th></th></tr></thead><tbody>${items.map(row).join("")}</tbody></table></div></div>`;
}

export function viewAssetForm() {
  const r = state.route;
  const a = r.id && r.id !== "new" ? state.assetsEnriched.find((x) => x.id === r.id) : null;
  if (r.id !== "new" && !a) {
    return `<div class="panel empty"><strong>${t("找不到这台设备")}</strong>${t("可能已被家人删除。")}<p><a class="btn btn-primary" href="${href("house", "assets")}">${t("回到设备档案")}</a></p></div>`;
  }
  const qType = r.q.get("type"), tplType = qType ? H().assetType(qType) : null;
  // 从装备物品升级：?from_item=<id> 带入名称、位置、备注
  const fromItem = !a && r.q.get("from_item") ? state.items.find((i) => i.id === r.q.get("from_item")) : null;
  const v = a || {
    kind: tplType?.kind || "equipment", type: tplType?.id || (fromItem ? "other_equipment" : "water_heater"), name: fromItem ? fromItem.name : tplType ? t(tplType.name) : "", location: fromItem?.location || "",
    expected_life_years: tplType?.life ?? "", service_interval_months: tplType?.interval ?? "", owner: "self", notes: fromItem?.notes || "",
  };
  const tool = v.kind === "tool", veh = v.kind === "vehicle";
  // 面包屑根：进来之前的页面（注意事项 / 房屋…），没有就回设备档案或车辆列表
  const root = { href: state.prevRoute && state.prevHash ? state.prevHash : href("house", veh ? "vehicles" : "assets"), label: state.prevRoute ? t(SECTIONS[state.prevRoute.section]?.name || "上一页") : veh ? t("车辆") : t("设备档案") };
  const d = (x) => esc(x ?? "");
  const thisYear = new Date().getFullYear();
  const cur = Units.region.currency;
  const kindPill = (k) => `<label class="radio-pill"><input type="radio" name="kind" value="${k}" ${v.kind === k ? "checked" : ""}><span>${H().ASSET_KINDS[k].icon} ${t(H().ASSET_KINDS[k].name)}</span></label>`;
  // 已有记录：先看枢纽（各块完成度、保养记录、时间表、检查卡），点进去只改一块；新建仍是整页
  const sec = r.q.get("log") === "1" ? "log" : r.q.get("sec") || "";
  const hubHref = href("asset", a?.id || "new");
  if (a && !sec) return assetHub(a, root);
  if (a && sec === "log") return `<section class="section form-page">${assetCrumb(a, root, hubHref, t("保养记录"))}${maintSection(a, r.q.get("log") === "1")}</section>`;
  if (a && sec === "schedule") return `<section class="section">${assetCrumb(a, root, hubHref, t("保养时间表"))}${vehicleSchedule(a)}</section>`;
  if (a && sec === "supplies") return `<section class="section">${assetCrumb(a, root, hubHref, t("相关耗材"))}${suppliesSection(a)}</section>`;
  if (a && sec === "care") return `<section class="section">${assetCrumb(a, root, hubHref, t("检查卡"))}${careCard(a.type, { open: true })}</section>`;
  const hide = (k) => (a && sec && sec !== k ? "hidden" : "");
  return `
    <section class="section form-page">
      ${a ? assetCrumb(a, root, hubHref, t(ASSET_SECTIONS.find((s) => s.id === sec)?.name || "")) : crumbNav([...assetBase(null, veh), { label: veh ? t("添加车辆") : t("添加设备") }])}
      ${a && sec === "notes" ? "" : autofillBar(veh ? "vehicle" : "asset", "#assetForm")}
      <form id="assetForm" class="panel ${tool ? "is-tool" : ""} ${veh ? "is-vehicle" : ""} ${a && sec ? "one-sec" : ""}" novalidate data-autosave>
        <input type="hidden" name="asset_id" value="${d(a?.id)}">
        ${fromItem ? `<input type="hidden" name="from_item" value="${esc(fromItem.id)}"><p class="hint" style="margin-top:0">${t("由装备“{name}”升级：补上品牌、安装日期、保修和保养周期后保存。", { name: esc(fromItem.name) })}</p>
          <label class="check-inline" style="margin-bottom:10px"><input type="checkbox" name="drop_item"><span>${t("建好后从装备里移除这件物品")}</span></label>` : ""}
        <fieldset data-sec="basic" ${hide("basic")}>
          <legend>${t("基本信息")}</legend>
          <div class="seg-radio" style="margin-bottom:10px">${kindPill("equipment")}${kindPill("tool")}${kindPill("vehicle")}</div>
          <div class="form-grid">
            <label><span class="veh-hide">${t("类型")}</span><span class="veh-show">${t("动力类型")}</span>
              <select name="type" required>${typeOptions(v.type, v.kind)}</select>
            </label>
            <label>${t("名称")}
              <input name="name" required maxlength="60" autocomplete="off" placeholder="${veh ? t("例如：白色 RAV4") : t("例如：Carrier 暖风炉")}" value="${d(v.name)}">
            </label>
            ${locationField(v.location, t("位置"))}
            <label>${t("品牌")}
              <input name="brand" maxlength="40" value="${d(v.brand)}">
            </label>
            <label>${t("型号")}
              <input name="model" maxlength="60" value="${d(v.model)}">
            </label>
            <label><span class="veh-hide">${t("序列号")}</span><span class="veh-show">VIN</span>
              <input name="serial" maxlength="60" value="${d(v.serial)}">
            </label>
          </div>
        </fieldset>
        ${veh ? vehicleFieldset(a, hide) : ""}
        <fieldset data-sec="years" ${hide("years")}>
          <legend><span class="veh-hide">${t("年份与保修")}</span><span class="veh-show">${t("年款与保修")}</span></legend>
          <div class="form-grid">
            <label><span class="veh-hide">${t("安装 / 购买日期")}</span><span class="veh-show">${t("购车日期")}</span>
              <input name="installed_on" type="date" value="${d(v.installed_on)}">
              <small class="veh-hide">${t("用来算房龄和首次保养日期")}</small><small class="veh-show">${t("没有保养记录时，按它算第一次保养")}</small>
            </label>
            <label><span class="veh-hide">${t("出厂年份（可选）")}</span><span class="veh-show">${t("年款")}</span>
              <input name="manufacture_year" type="number" inputmode="numeric" min="1950" max="${thisYear + 1}" placeholder="${veh ? "2022" : t("铭牌上通常有")}" value="${d(v.manufacture_year)}">
            </label>
            <label><span class="veh-hide">${t("整机保修到")}</span><span class="veh-show">${t("整车保修到")}</span>
              <input name="warranty_until" type="date" value="${d(v.warranty_until)}">
            </label>
            <label class="eq-only"><span class="veh-hide">${t("人工保修到（可选）")}</span><span class="veh-show">${t("动力总成 / 高压电池保修到")}</span>
              <input name="labor_warranty_until" type="date" value="${d(v.labor_warranty_until)}">
              <small class="veh-hide">${t("安装商的人工保修通常比厂家短")}</small><small class="veh-show">${t("电车高压电池通常 8 年 / 10 万英里")}</small>
            </label>
          </div>
        </fieldset>
        <fieldset class="veh-hide" data-sec="life" ${hide("life")}>
          <legend>${t("寿命与保养周期")}</legend>
          <div class="form-grid">
            <label>${t("预期寿命（年）")}
              <input name="expected_life_years" type="number" inputmode="decimal" min="0" max="100" step="0.5" placeholder="${t("常见经验值")}" value="${d(v.expected_life_years)}">
            </label>
            <label>${t("保养间隔（月）")}
              <input name="service_interval_months" type="number" inputmode="numeric" min="1" max="120" step="1" placeholder="${t("留空则不提醒")}" value="${d(v.service_interval_months)}">
              <small>${t("记一次检查或保养后，按这个间隔算下次")}</small>
            </label>
          </div>
        </fieldset>
        <fieldset data-sec="cost" ${hide("cost")}>
          <legend><span class="veh-hide">${t("费用与负责方")}</span><span class="veh-show">${t("购车价格")}</span></legend>
          <div class="form-grid">
            <label>${t("购买价格（{cur}）", { cur })}
              <input name="purchase_price" type="number" inputmode="decimal" min="0" step="0.01" value="${d(v.purchase_price)}">
            </label>
            <label class="eq-only">${t("更换估价（{cur}）", { cur })}
              <input name="replacement_cost_estimate" type="number" inputmode="decimal" min="0" step="0.01" placeholder="${t("第三期“修还是换”会用到")}" value="${d(v.replacement_cost_estimate)}">
            </label>
            <label class="eq-only">${t("谁负责维护")}
              <select name="owner">${OWNER_OPTS.map((k) => `<option value="${k}" ${v.owner === k ? "selected" : ""}>${t(H().OWNERS[k].name)}</option>`).join("")}</select>
            </label>
          </div>
        </fieldset>
        <fieldset data-sec="notes" ${hide("notes")}>
          <legend>${t("备注")}</legend>
          <label class="sr-only" for="assetNotes">${t("备注")}</label>
          <textarea id="assetNotes" name="notes" rows="3" maxlength="500" placeholder="${t("滤网尺寸、维修商电话、借给了谁…")}">${d(v.notes)}</textarea>
        </fieldset>
        <p id="assetFormError" class="form-error" role="alert"></p>
        <div class="form-actions sticky-actions">
          <button type="submit" class="btn btn-primary">${a ? t("保存修改") : veh ? t("添加车辆") : t("添加设备")}</button>
          <button type="button" class="btn btn-ghost" data-action="asset-cancel">${t("取消")}</button>
        </div>
      </form>
      ${a ? "" : `<p class="muted" style="margin-top:12px;font-size:13px">${veh ? t("保存后可以在这辆车下记录每次保养、维修，按项目算下次到期。") : t("保存后可以在这台设备下记录每次检查、保养和维修。")}</p>`}
    </section>`;
}

/* ── 设备 ↔ 耗材：这类设备用到的耗材，对应 储藏 → 库存 → 房屋耗材 里的物品；没备的可一键按模板加进库存 ── */
const supplyTpl = (name, region) => [region, "na", "cn"].map((r) => (H().SUPPLIES[r] || []).find((s) => s.name === name)).find(Boolean) || null;
/** 按模板名生成一条库存物品（名称、单位按当前语言写入，之后作为用户数据不再翻译） */
export function supplyItem(name) {
  const r = supplyTpl(name, state.houseProfile?.region); if (!r) return null;
  return { name: t(r.name), category: r.category, subcategory: r.sub || null, unit: t(r.unit), quantity: r.qty, min_quantity: Math.min(r.min || 0, Math.max(0, r.qty - 1)),
    location: r.loc || null, expiry_date: null, lead_days: 14, avg_daily_use: r.every ? Math.round((1 / r.every) * 1000) / 1000 : null, notes: r.note ? t(r.note) : null };
}
function supplyRows(a) {
  const region = state.houseProfile?.region, mine = state.enriched.filter(inSpace("house"));
  // 物品表单里“关联设备”勾了这台设备的耗材，排在最前
  const linked = mine.filter((i) => Array.isArray(i.asset_ids) && i.asset_ids.includes(a.id)).map((item) => ({ name: item.name, item }));
  const rest = [...new Set(H().ASSET_SUPPLIES[a.type] || [])].map((name) => ({ name, item: mine.find((i) => [name, t(name)].includes(i.name.trim())) || null }))
    // 没备的只列当前地区模板里有的（例如北美列 AA 电池，国内列 5 号电池）
    .filter((r) => (r.item ? !linked.some((l) => l.item.id === r.item.id) : (H().SUPPLIES[region || "na"] || []).some((s) => s.name === r.name) || (!region && supplyTpl(r.name))));
  return [...linked, ...rest];
}
function suppliesSection(a) {
  const rows = supplyRows(a);
  const li = ({ name, item }) => item
    ? `<li><span class="badge ${STATUS[item.status].cls}">${t(STATUS[item.status].label)}</span>
        <div class="grow"><a class="link-name" href="${href("item", item.id)}">${esc(item.name)}</a><small>${t("剩 {q} {u}", { q: Math.round(item.dqty * 100) / 100, u: t(item.du) })}${item.location ? ` · 📍${esc(t(item.location))}` : ""}</small></div>
        ${openShopFor(item.id) ? `<span class="badge b-ok">${t("已在清单")}</span>` : `<button type="button" class="btn btn-sm" data-action="shop-add-item" data-id="${item.id}">${t("加入采购")}</button>`}</li>`
    : `<li><span class="badge" style="background:var(--surface-2)">${t("还没备")}</span>
        <div class="grow"><b>${esc(t(name))}</b><small>${t("库存里还没有这项")}</small></div>
        <button type="button" class="btn btn-sm btn-primary" data-action="supply-add" data-name="${esc(name)}">${t("加入库存")}</button></li>`;
  return `<div class="panel"><p class="muted" style="margin:0 0 8px;font-size:13px">${t("这类设备用到的耗材。库存统一在 储藏 → 库存 → 房屋耗材 里管理，少货会进采购提醒。")}</p>
    <ul class="restock-list">${rows.map(li).join("")}</ul>
    <div class="form-actions" style="margin-top:10px"><a class="btn btn-sm btn-ghost" href="${href("pantry", "inventory")}?space=house">${t("看全部房屋耗材")}</a></div></div>`;
}

const ASSET_SECTIONS = [
  { id: "basic", icon: "🏷️", name: "基本信息" },
  { id: "plate", icon: "🪪", name: "车牌与里程", veh: true },
  { id: "docs", icon: "📄", name: "拥有状态与证照", veh: true },
  { id: "insurance", icon: "🛡️", name: "车险", veh: true },
  { id: "years", icon: "📆", name: "年份与保修" },
  { id: "life", icon: "⏳", name: "寿命与保养周期", eq: true },
  { id: "cost", icon: "💵", name: "费用与负责方" },
  { id: "notes", icon: "📝", name: "备注" },
];
/** 设备 / 车辆枢纽页：摘要 + 各块完成度 + 保养记录 / 时间表 / 检查卡入口 + 删除 */
function assetHub(a, root) {
  const veh = isVehicle(a), v = a.vehicle || {}, ins = v.insurance || {};
  const base = href("asset", a.id);
  const pct = (n, m) => ({ pct: Math.round((n / m) * 100), badge: countBadge(n, m) });
  const st = {
    basic: () => { const n = 1 + filledCount([a.location, a.brand, a.model, a.serial]); return { text: [a.t ? t(a.t.name) : null, a.brand, a.model].filter(Boolean).join(" · "), ...pct(n, 5) }; },
    plate: () => { const n = filledCount([v.plate, v.odometer, v.annual_miles]); return { text: [v.plate, a.nowMiles != null ? t("约 {n} {u}", { n: fmt(a.nowMiles), u: distUnit() }) : null].filter(Boolean).join(" · ") || t("未填"), ...pct(n, 3) }; },
    docs: () => { const n = filledCount([v.registration_due, v.emissions_due]); return { text: [t(V().STATUS[vehStatus(a)].name), v.registration_due ? t("牌照 {d}", { d: fmtDate(v.registration_due) }) : null, v.emissions_due ? t("排放 {d}", { d: fmtDate(v.emissions_due) }) : null, v.lease_end ? t("租赁 {d}", { d: fmtDate(v.lease_end) }) : null, v.disposed_on ? fmtDate(v.disposed_on) : null].filter(Boolean).join(" · "), ...pct(n, 2) }; },
    insurance: () => { const n = filledCount([ins.provider, ins.policy, ins.to, ins.coverage, ins.agent, ins.phone]); return { text: ins.provider ? [ins.provider, ins.to ? t("到期 {d}", { d: fmtDate(ins.to) }) : null].filter(Boolean).join(" · ") : t("未填"), ...pct(n, 6) }; },
    years: () => { const n = filledCount([a.installed_on, a.manufacture_year, a.warranty_until]); return { text: [a.installed_on ? fmtDate(a.installed_on) : null, a.warranty_until ? t("保修到 {d}", { d: fmtDate(a.warranty_until) }) : null].filter(Boolean).join(" · ") || t("未填"), ...pct(n, 3) }; },
    life: () => { const n = filledCount([a.expected_life_years, a.service_interval_months]); return { text: [a.expected_life_years ? t("约 {n} 年", { n: fmt(a.expected_life_years) }) : null, a.service_interval_months ? t("每 {n} 个月保养", { n: a.service_interval_months }) : null].filter(Boolean).join(" · ") || t("未填"), ...pct(n, 2) }; },
    cost: () => { const n = filledCount([a.purchase_price, veh ? null : a.owner]); return { text: [a.purchase_price != null ? money(num(a.purchase_price)) : null, !veh && a.owner ? t("负责：{who}", { who: t(H().OWNERS[a.owner]?.name || "") }) : null].filter(Boolean).join(" · ") || t("未填"), ...pct(n, veh ? 1 : 2) }; },
    notes: () => ({ text: a.notes ? a.notes.slice(0, 60) : t("无"), pct: null, badge: "" }),
  };
  const rows = ASSET_SECTIONS.filter((s) => (veh ? !s.eq : !s.veh)).map((s) => { const x = st[s.id](); return hubRow({ href: `${base}?sec=${s.id}`, icon: s.icon, title: t(s.name), desc: esc(x.text), pct: x.pct, badge: x.badge }); });
  const more = [
    hubRow({ href: `${base}?log=1`, icon: "🛠️", title: t("保养记录"), desc: a.logs.length ? t("{n} 条，最近 {d}", { n: a.logs.length, d: fmtDate(a.logs[0].done_on) }) : t("还没有记录"), badge: a.followUp ? `<span class="badge b-out mcount">${t(C().RESULTS[a.followUp.result])}</span>` : a.service === "overdue" || a.service === "due" ? `<span class="badge b-soon mcount">${t(SERVICE_BADGE[a.service].label)}</span>` : "" }),
    veh ? hubRow({ href: `${base}?sec=schedule`, icon: "📋", title: t("保养时间表"), desc: a.vSoonest ? t("下一项：{name} {d}", { name: t(a.vSoonest.name), d: fmtDate(a.vSoonest.next) }) : t("记一次保养后开始算") }) : "",
    veh ? vehDealRow(a) : "",
    !veh && supplyRows(a).length ? (() => { const rs = supplyRows(a), have = rs.filter((r) => r.item), low = have.filter((r) => r.item.status !== "ok").length;
      return hubRow({ href: `${base}?sec=supplies`, icon: "🧰", title: t("相关耗材"), desc: t("{n} / {m} 项已在库存", { n: have.length, m: rs.length }), badge: low ? `<span class="badge b-soon mcount">${t("{n} 项要补", { n: low })}</span>` : "" }); })() : "",
    !veh && C().cardOf(a.type) ? hubRow({ href: `${base}?sec=care`, icon: "🔍", title: t("检查卡"), desc: t("怎么查、什么时候叫人") }) : "",
  ].filter(Boolean);
  return `<section class="section">
    ${crumbNav([...assetTrail(a, root, href("asset", a.id)).slice(0, -1), { label: assetName(a), icon: a.t?.icon || "⚙️" }])}
    ${assetSummary(a)}
    ${hubList(more)}
    <div class="section-head" style="margin-top:18px"><h3 style="font-size:15px">${t("档案")}</h3></div>
    ${hubList(rows)}
    <div class="form-actions" style="margin-top:14px"><a class="btn btn-primary" href="${base}?log=1">${t("记保养")}</a>
      <span class="spacer"></span><button type="button" class="btn btn-danger-ghost" data-action="asset-delete">${veh ? t("删除车辆") : t("删除设备")}</button></div>
  </section>`;
}

/** 枢纽里的“交易”入口：进行中显示进度，否则按状态提示能走哪个流程 */
function vehDealRow(a) {
  const d = openVehicleDeal(a.id), K = window.DEALS.KINDS, st = vehStatus(a), v = a.vehicle || {};
  const hist = state.deals.filter((x) => x.asset_id === a.id && x.outcome).length;
  let desc, badge = "";
  if (d) { const tasks = dealTasks(d), done = tasks.filter((x) => x.done).length, late = tasks.filter((x) => !x.done && x.overdue).length; desc = t("{kind}进行中 · 已完成 {a} / {b}", { kind: t(K[d.kind]), a: done, b: tasks.length }); badge = late ? `<span class="badge b-out mcount">${t("逾期 {n}", { n: late })}</span>` : `<span class="badge b-soon mcount">${done}/${tasks.length}</span>`; }
  else if (st === "looking") desc = t("选购中：开始买车流程，按步骤办产权、上牌、保险");
  else if (st === "leased") desc = t("租赁{d}：到期前走归还流程", { d: v.lease_end ? ` ${fmtDate(v.lease_end)} ${t("到期")}` : "" });
  else if (st === "sold" || st === "returned") desc = [t(V().STATUS[st].name), v.disposed_on ? fmtDate(v.disposed_on) : null, v.sale_price != null ? money(num(v.sale_price)) : null].filter(Boolean).join(" · ") + (hist ? ` · ${t("{n} 笔历史交易", { n: hist })}` : "");
  else desc = t("要卖车时从这里开始：估价、收款、拆车牌、已售通知") + (hist ? ` · ${t("{n} 笔历史交易", { n: hist })}` : "");
  return hubRow({ href: `${href("house", "deal")}?asset=${a.id}`, icon: "🤝", title: t("买卖 / 归还"), desc, badge });
}

function assetSummary(a) {
  const sb = SERVICE_BADGE[a.service], wb = WARRANTY_BADGE[a.warranty];
  const bits = [
    isVehicle(a) && vehStatusBadge(a),
    a.followUp && `<span class="badge b-out">${t("检查：{r}", { r: t(C().RESULTS[a.followUp.result]) })}</span>`,
    sb.label && (!isVehicle(a) || V().inService(a)) && `<span class="badge ${sb.cls}">${t(sb.label)}${a.next && a.service !== "unknown" ? t(" · 下次 {d}", { d: fmtDate(a.next) }) : ""}</span>`,
    wb.label && `<span class="badge ${wb.cls}">${t(wb.label)}${a.warranty_until ? ` · ${fmtDate(a.warranty_until)}` : ""}</span>`,
    a.ageYears != null && `<span class="badge" style="background:var(--surface-2)">${t("已用 {age}", { age: ageText(a) })}${num(a.expected_life_years) ? t(" / 约 {n} 年", { n: fmt(a.expected_life_years) }) : ""}</span>`,
    a.logs.length && `<span class="badge" style="background:var(--surface-2)">${t("{n} 条记录", { n: a.logs.length })}${a.totalCost ? t("，共花 {m}", { m: money(a.totalCost) }) : ""}</span>`,
  ].filter(Boolean).join("");
  return `<div class="asset-badges" style="margin-bottom:12px">${bits}</div>${stampText(a) ? `<p class="record-meta" style="margin:-6px 0 12px">${esc(stampText(a))}</p>` : ""}`;
}

function maintSection(a, focusLog) {
  const K = H().MAINT_KINDS, R = C().RESULTS, veh = isVehicle(a);
  const editLog = a.logs.find((l) => l.id === state.route?.q?.get("edit")) || null;   // 编辑某条记录：表单带入原值
  const e = editLog || {}, isInspect = !veh && e.kind === "inspect";
  const preItem = editLog ? e.service_item || "" : state.route?.q?.get("item") || "";   // 时间表里“记一次”带过来的保养项目
  const rows = a.logs.map((l) => `<li data-swipe-del="maint">
      <span class="badge ${l.kind === "repair" ? "b-low" : l.kind === "replace" ? "b-exp" : l.result && l.result !== "ok" ? "b-out" : "b-ok"}">${t(K[l.kind] || l.kind)}${l.result ? ` · ${t(R[l.result] || l.result)}` : ""}</span>
      <div class="grow"><span class="name">${esc(fmtDate(l.done_on))}${l.service_item ? ` · ${esc(t(V().serviceItem(l.service_item)?.name || l.service_item))}` : ""}</span>
        <small>${joinList([l.odometer != null ? `${fmt(l.odometer)} ${distUnit()}` : null, l.vendor ? t("收款方：{who}", { who: l.vendor }) : null, l.diy ? t("自己做的") : null, l.cost != null ? t("花费 {m}", { m: Units.money(num(l.cost), l.currency || Units.region.currency) }) : null, l.notes,
          l.created_at && t("{d} 记录", { d: fmtShort(l.created_at) })].filter(Boolean).map(esc))}</small></div>
      <a class="btn btn-sm btn-ghost" href="${href("asset", a.id)}?log=1&edit=${l.id}" aria-label="${t("编辑这条记录")}">${t("编辑")}</a>
      <button type="button" class="btn btn-sm btn-ghost swipe-src" data-action="maint-del" data-id="${l.id}" aria-label="${t("删除这条记录")}">${t("删除")}</button>
    </li>`).join("");
  const followUp = a.followUp ? `<div class="panel cta-panel" style="margin-bottom:10px"><div><b>${t("{date} 检查结论：{r}", { date: fmtDate(a.followUp.done_on), r: t(R[a.followUp.result]) })}</b>
      <p class="muted">${t("记一条保养、维修或更换后，这条提醒会消失。")}</p></div></div>` : "";
  return `
    <div class="section-head"><p>${veh ? t("按保养项目算下次到期；维修不重置") : t("检查、保养、更换会重算下次保养日期；维修不会")}</p></div>
    ${followUp}
    ${autofillBar("maint", "#maintForm")}
    <form id="maintForm" class="panel ${isInspect ? "is-inspect" : ""}" ${focusLog ? 'data-focus="1"' : ""}>
      ${storeDatalist()}
      <input type="hidden" name="asset_id" value="${esc(a.id)}"><input type="hidden" name="log_id" value="${esc(e.id || "")}">
      ${editLog ? `<p class="hint" style="margin-top:0">${t("正在编辑 {d} 的这条记录", { d: fmtDate(e.done_on) })}</p>` : ""}
      <div class="form-grid maint-grid">
        <label>${t("日期")}<input name="done_on" type="date" required value="${esc(e.done_on || todayISO())}" max="${todayISO()}"></label>
        <label>${t("类型")}<select name="kind">${Object.entries(K).map(([k, n]) => `<option value="${k}" ${k === (e.kind || "service") ? "selected" : ""}>${t(n)}</option>`).join("")}</select></label>
        ${veh ? `<label>${t("保养项目")}<select name="service_item"><option value="">${t("请选择")}</option>${V().itemsFor(a.type).map((s) => `<option value="${s.key}" ${s.key === preItem ? "selected" : ""}>${esc(t(s.name))}</option>`).join("")}</select><small>${t("保养 / 检查 / 更换必选，这一项的下次日期才会更新；维修可不选")}</small></label>
                <label>${t("里程（{u}）", { u: distUnit() })}<input name="odometer" type="number" inputmode="numeric" min="0" step="1" value="${e.odometer ?? ""}" placeholder="${a.nowMiles != null ? fmt(a.nowMiles) : ""}"><small>${t("填了会同时更新车辆当前里程")}</small></label>`
              : `<label class="inspect-only">${t("检查结论")}<select name="result">${Object.entries(R).map(([k, n]) => `<option value="${k}" ${k === e.result ? "selected" : ""}>${t(n)}</option>`).join("")}</select><small>${t("“需保养 / 维修 / 更换”会提醒到记下一条为止")}</small></label>`}
        <label>${t("花费（{cur}，可不填）", { cur: Units.region.currency })}<input name="cost" type="number" inputmode="decimal" min="0" step="0.01" value="${e.cost ?? ""}"></label>
        <label>${t("收款方")}<input name="vendor" maxlength="40" list="storeList" value="${esc(e.vendor || "")}" placeholder="${t("维修商 / 师傅 / 商店，自己做可不填")}"></label>
        <label class="span-2 check-inline"><input type="checkbox" name="diy" ${e.diy ? "checked" : ""}><span>${t("自己动手")}</span></label>
        <label class="span-2">${t("备注")}<input name="notes" maxlength="500" value="${esc(e.notes || "")}" placeholder="${t("换了什么、师傅怎么说…")}"></label>
      </div>
      <div class="form-actions" style="margin-top:10px"><button type="submit" class="btn btn-primary btn-sm">${editLog ? t("保存修改") : t("记一笔")}</button>${editLog ? `<a class="btn btn-sm btn-ghost" href="${href("asset", a.id)}?log=1">${t("取消")}</a>` : ""}
        <small class="muted">${veh ? t("填了花费会同时记入“车辆”花费统计。") : t("填了花费会同时记入“房屋维护”花费统计。")}</small></div>
    </form>
    <div class="panel" style="margin-top:10px">${rows ? `<ul class="restock-list">${rows}</ul>` : `<div class="empty"><strong>${t("还没有记录")}</strong>${t("上面记第一次检查或保养，之后会按周期提醒。")}</div>`}</div>`;
}

/** 表单联动：切换类型时带入默认值（只对新设备）；切换种类时隐藏设备专用字段并换类型列表 */
export function onAssetFormChange(e) {
  const f = e.target.form, fe = f.elements, isNew = !fe.asset_id.value;
  if (e.target.name === "kind") {
    const toVeh = e.target.value === "vehicle", wasVeh = f.classList.contains("is-vehicle");
    if (isNew && toVeh !== wasVeh) {   // 车辆有自己的区块，整页按新种类重画
      const first = H().ASSET_TYPES.find((x) => x.kind === e.target.value);
      go(`${href("asset", "new")}?type=${first.id}`, { replace: true }); return;
    }
    f.classList.toggle("is-tool", e.target.value === "tool");
    const cur = fe.type.value;
    fe.type.innerHTML = typeOptions(cur, e.target.value);
    const first = H().ASSET_TYPES.find((x) => x.kind === e.target.value && (!state.houseProfile || x.region === "both" || x.region === state.houseProfile.region));
    if (H().assetType(cur)?.kind !== e.target.value && first) { fe.type.value = first.id; applyType(fe, first, isNew); }
  }
  if (e.target.name === "type") {
    const at = H().assetType(e.target.value);
    if (!at) return;
    if (at.kind !== fe.kind.value) { f.querySelector(`input[name="kind"][value="${at.kind}"]`).checked = true; f.classList.toggle("is-tool", at.kind === "tool"); }
    applyType(fe, at, isNew);
  }
}
/** 保养记录表单：检查类型才显示“检查结论” */
export function onMaintFormChange(e) {
  const f = e.target.form; if (!f || e.target.name !== "kind") return;
  f.classList.toggle("is-inspect", e.target.value === "inspect");
}
function applyType(fe, at, isNew) {
  if (!isNew) return;
  const prev = fe.name.dataset.auto, name = t(at.name);
  if (!fe.name.value.trim() || fe.name.value === prev) { fe.name.value = name; fe.name.dataset.auto = name; }
  fe.expected_life_years.value = at.life ?? "";
  fe.service_interval_months.value = at.interval ?? "";
  const ht = state.houseProfile ? H().typeOf(state.houseProfile.region, state.houseProfile.house_type) : null;
  fe.owner.value = (at.system && ht?.owners?.[at.system] && OWNER_OPTS.includes(ht.owners[at.system])) ? ht.owners[at.system] : "self";
}

/** silent=true：离开页面时自动保存（不跳转；校验不过就提示“没有自动保存”）。返回是否保存成功 */
export async function saveAssetForm(f, { silent = false } = {}) {
  const fe = f.elements, err = f.querySelector("#assetFormError");
  const fail = (msg, el) => { if (silent) toast(t("没有自动保存：{msg}", { msg })); else { err.textContent = msg; el.focus(); } return false; };
  const name = fe.name.value.trim();
  if (!name) return fail(t("请填写设备名称。"), fe.name);
  const numOrNull = (el, { int = false } = {}) => { if (el.value === "") return null; const n = num(el.value, NaN); return Number.isFinite(n) ? (int ? Math.round(n) : Math.round(n * 100) / 100) : null; };
  const thisYear = new Date().getFullYear();
  const year = numOrNull(fe.manufacture_year, { int: true });
  if (year != null && (year < 1950 || year > thisYear)) return fail(t("出厂年份需要在 1950 到 {y} 之间。", { y: thisYear }), fe.manufacture_year);
  const tool = fe.kind.value === "tool", veh = fe.kind.value === "vehicle";
  const a = {
    id: fe.asset_id.value || undefined,
    kind: fe.kind.value, type: fe.type.value, name,
    location: null, brand: fe.brand.value.trim() || null, model: fe.model.value.trim() || null, serial: fe.serial.value.trim() || null,
    installed_on: fe.installed_on.value || null, manufacture_year: year,
    warranty_until: fe.warranty_until.value || null, labor_warranty_until: tool ? null : fe.labor_warranty_until.value || null,
    expected_life_years: veh ? 15 : numOrNull(fe.expected_life_years), service_interval_months: veh ? null : numOrNull(fe.service_interval_months, { int: true }),
    purchase_price: numOrNull(fe.purchase_price), replacement_cost_estimate: tool || veh ? null : numOrNull(fe.replacement_cost_estimate),
    owner: tool || veh ? null : fe.owner.value || null, notes: fe.notes.value.trim() || null,
    property_id: veh ? null : (state.assets.find((x) => x.id === fe.asset_id.value)?.property_id || state.propertyId),
    vehicle: null,
  };
  if (veh) {
    const s = (el) => (el.value || "").trim() || null;
    a.vehicle = {
      plate: s(fe.veh_plate), plate_state: s(fe.veh_plate_state), odometer: numOrNull(fe.veh_odometer, { int: true }), odometer_on: fe.veh_odometer_on.value || null,
      annual_miles: numOrNull(fe.veh_annual_miles, { int: true }), registration_due: fe.veh_registration_due.value || null, emissions_due: fe.veh_emissions_due.value || null, lease_end: fe.veh_lease_end.value || null,
      status: fe.veh_status?.value || "owned", loan_end: fe.veh_loan_end?.value || null, disposed_on: fe.veh_disposed_on?.value || null, sale_price: fe.veh_sale_price ? numOrNull(fe.veh_sale_price) : null,
      insurance: { provider: s(fe.veh_ins_provider), policy: s(fe.veh_ins_policy), from: fe.veh_ins_from.value || null, to: fe.veh_ins_to.value || null, coverage: s(fe.veh_ins_coverage), agent: s(fe.veh_ins_agent), phone: s(fe.veh_ins_phone), email: s(fe.veh_ins_email) },
    };
  }
  const btn = f.querySelector('button[type="submit"]');
  btn.disabled = true;
  try {
    a.location = await resolveLocation(fe);
    await Store.saveAsset(a);
    if (silent) return true;
    toast(a.id ? t("已保存修改") : t("已添加 {name}", { name }));
    if (fe.from_item?.value && fe.drop_item?.checked) { await Store.deleteItem(fe.from_item.value); state.prevRoute = null; }   // 升级后移除原装备：别再退回那条已删除的物品页
    leaveAsset(true);
    return true;
  } catch (e) { if (silent) throw e; err.textContent = t("保存失败：{msg}", { msg: e.message }); btn.disabled = false; return false; }
}

/** 记一次保养：有费用先写 purchases（house_maint），再写记录并关联，删除记录时一起删 */
export async function saveMaintForm(f) {
  const fe = f.elements;
  const asset = state.assets.find((x) => x.id === fe.asset_id.value);
  if (!asset) return toast(t("设备不存在"));
  const done_on = fe.done_on.value || todayISO();
  const kind = fe.kind.value, vendor = fe.vendor.value.trim() || null, diy = fe.diy.checked, veh = isVehicle(asset);
  const cost = fe.cost.value === "" ? null : Math.round(Math.max(0, num(fe.cost.value)) * 100) / 100;
  const currency = Units.region.currency;
  const result = !veh && kind === "inspect" && fe.result ? fe.result.value || null : null;
  const service_item = veh && fe.service_item ? fe.service_item.value || null : null;
  // 车辆的保养 / 检查 / 更换必须选项目，否则时间表里那一项永远不会更新（之前的坑：下次日期一直停在购车日期 + 周期）
  if (veh && kind !== "repair" && !service_item) { toast(t("请选保养项目（维修可不选）")); fe.service_item.focus(); return false; }
  const odometer = veh && fe.odometer && fe.odometer.value !== "" ? Math.max(0, Math.round(num(fe.odometer.value))) : null;
  const itemName = service_item ? t(V().serviceItem(service_item)?.name || service_item) : t(H().MAINT_KINDS[kind]);
  const editing = fe.log_id.value ? state.maintLogs.find((x) => x.id === fe.log_id.value) : null;
  let purchase_id = editing?.purchase_id || null;
  const spend = { name: `${asset.name} · ${itemName}`, amount: cost, store: vendor, purchased_at: new Date(`${done_on}T12:00:00`).toISOString() };
  if (cost != null && cost > 0) {
    if (purchase_id && state.purchases.some((x) => x.id === purchase_id)) await Store.updatePurchase(purchase_id, spend);   // 编辑：同步改关联的花费
    else purchase_id = await Store.addPurchase({ item_id: null, category: veh ? VEHICLE_CAT.id : MAINT_CAT.id, quantity: null, unit: null, currency, ...spend });
  } else if (purchase_id) { await Store.deletePurchase(purchase_id); purchase_id = null; }   // 编辑时把花费清空：关联的花费一起删
  const fields = { done_on, kind, cost, currency: cost != null ? currency : null, diy, vendor, notes: fe.notes.value.trim() || null, purchase_id, result, service_item, odometer };
  if (editing) await Store.updateMaintLog(editing.id, fields);
  else await Store.addMaintLog({ asset_id: asset.id, ...fields });
  // 车辆：记录里的里程比档案新就更新档案里程
  if (veh && odometer != null && (num(asset.vehicle?.odometer) || 0) <= odometer) {
    await Store.saveAsset({ ...asset, vehicle: { ...(asset.vehicle || {}), odometer, odometer_on: done_on } });
  }
  if (editing) toast(t("已保存修改"));
  else if (result && result !== "ok") toast(t("已记录检查，结论“{r}”，会提醒到记下一条处理为止", { r: t(C().RESULTS[result]) }));
  else toast(kind === "replace" ? t("已记录更换，记得把安装日期改成新设备的日期") : t("已记录{kind}", { kind: itemName }));
  return true;
}
