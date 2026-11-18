/* 设备的纯逻辑（不碰界面）：保养 / 保修 / 召回状态、车辆保养项、显示名、车辆列表。
 * 从 assets.js、recall.js 里抽出来：启动时读数据要用 enrichAssets，菜单、储藏、财务也要用设备名，
 * 它们不必为此把整个设备页面（assets.js 94KB）加载进来。assets.js / recall.js 照旧从这里转出口。 */
import { state } from "../core/state.js";
import { DAY, addMonths, daysUntil, num, todayISO } from "../core/util.js";
import { compare, sameTerm, t } from "../core/i18n.js";

const H = () => window.HOUSE;
const V = () => window.VEHICLES;

/* ── 召回（界面在 recall.js） ── */
export const RECALL_STATUS = {
  stop_use: { name: "召回 · 停止使用", short: "停止使用", cls: "b-out" },
  open:     { name: "召回待处理",     short: "召回",     cls: "b-soon" },
  resolved: { name: "召回已处理",     short: "已处理",   cls: "b-ok" },
};
export const recallOf = (a) => (a?.recall && typeof a.recall === "object" && RECALL_STATUS[a.recall.status] ? a.recall : null);
/** 还没处理完的召回：stop_use / open；没有或已处理 → null */
export const recallActive = (a) => { const r = recallOf(a); return r && r.status !== "resolved" ? r.status : null; };
/** 换新或退款处理完的旧设备：退出列表、提醒和换季任务 */
export const isRetired = (a) => { const r = recallOf(a); return !!r && r.status === "resolved" && (r.remedy === "replace" || r.remedy === "refund"); };

export const isVehicle = (a) => a?.kind === "vehicle";
/** 显示用名称：生成时按当时语言写入的内置名（如“热水器” / “Water heater”）切语言后跟着翻译；自己改过的名字原样显示（家庭词表里有翻译则用词表） */
export const assetName = (a) => (a?.t && sameTerm(a.name, a.t.name, a.t.en) ? t(a.t.name) : t(a?.name));
const plusDays = (iso, n) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

/* ── 计算：房龄、寿命占比、下次保养、保修 ── */
export function enrichAssets(assets, logs) {
  const today = new Date(`${todayISO()}T12:00:00`).getTime();
  const byAsset = new Map();   // 先按设备分好组（一次遍历），每台设备不再扫全部保养记录
  for (const l of logs) { const arr = byAsset.get(l.asset_id); if (arr) arr.push(l); else byAsset.set(l.asset_id, [l]); }
  return assets.map((a) => {
    const at = H().assetType(a.type);
    const mine = (byAsset.get(a.id) || []).slice().sort((x, y) => (y.done_on || "").localeCompare(x.done_on || ""));
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
    // 召回：recallSt = stop_use / open（没处理完）；retired = 换新或退款处理完的旧设备
    const out = { ...a, t: at, logs: mine, lastService, next, dueDays, service, ageYears, lifePct, wDays, warranty, totalCost, followUp, recallSt: recallActive(a), retired: isRetired(a) };
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


/** 车辆列表（不分房产）：全部 / 还在用的（含选购中） */
export const rank = (a) => (a.recallSt === "stop_use" ? -2 : a.recallSt ? -1 : a.followUp ? 0 : a.service === "overdue" ? 1 : a.service === "due" ? 2 : 3);
export const myVehicles = () => state.assetsEnriched.filter(isVehicle).sort((x, y) => rank(x) - rank(y) || compare(x.name, y.name));
export const activeVehicles = () => myVehicles().filter((a) => V().isActive(a));

/** 保养记录页的搜索 / 筛选（换了设备就回到默认） */
export const maintFilter = { id: "", q: "", kind: "all", year: "all" };
