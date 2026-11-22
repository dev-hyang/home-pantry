/* 设备页：检查卡（看什么、正常是什么样、什么时候叫人、红线）和设备列表（搜索 + 类型 / 保养 / 保修 / 位置筛选）。 */
import { $, esc, fmtDate, money, num } from "../core/util.js";
import { FD, changed, clearFiltersBtn } from "../core/clear-filters.js";
import { houseCars, houseProps } from "../core/crumb-base.js";
import { ctx as askCtx, askInline } from "../core/ask.js";
import { assetCard } from "./vehicles-page.js";
import { assetName, isVehicle, rank } from "./assets-logic.js";
import { compare, t } from "../core/i18n.js";
import { crumbNav } from "../core/hub.js";
import { dotRow, propertyName } from "../core/alerts.js";
import { houseBar } from "./property-form.js";
import { href } from "../core/router.js";
import { pageLimit, pageMoreBtn, pageSize } from "../core/pager.js";
import { recallOf } from "./recall.js";
import { state } from "../core/state.js";
import { C, H, alertAct, alertBadge, alertText, assetAlerts, isFixture, isPortable, myAssets, retiredAssets } from "./asset-common.js";

/* ── 检查卡：看什么、正常是什么样、自己做什么、什么时候叫人、红线、费用、时段 ── */
/** 设备 / 车辆保养项的「问咩咩」：问题替用户写好，带这一项的情况 */
export const assetAsk = (a, careName = "") => ({ id: `asset-${a.id}${careName ? "-" + careName.replace(/[^\p{L}\p{N}]+/gu, "_") : ""}`, title: `${assetName(a)}${careName ? ` · ${careName}` : ""}`,
  question: careName ? t("「{c}」这项保养怎么做？自己做还是叫人？大概多少钱？", { c: careName }) : t("这台设备现在该做什么保养？什么情况要叫人？"), context: () => (isVehicle(a) ? askCtx.vehicle(a) : askCtx.asset(a)) });
export function careCard(key, { open = false, ask = null } = {}) {
  const c = C().cardOf(key); if (!c) return "";   // 没检查卡的项不在这里画「问咩咩」：由行末的小问号负责，默认收着
  const list = (title, arr, cls = "") => (arr?.length ? `<div class="care-sec ${cls}"><h4>${title}</h4><ul class="tips">${arr.map((x) => `<li>${esc(t(x))}</li>`).join("")}</ul></div>` : "");
  return `<details class="care-card" ${open ? "open" : ""}><summary>🔍 ${t("怎么查、什么时候叫人")}</summary>
    ${list(t("看什么"), c.check)}
    ${c.ok ? `<p class="care-ok"><b>${t("正常是什么样")}</b>${esc(t(c.ok))}</p>` : ""}
    ${list(t("自己能做"), c.diy, "care-diy")}
    ${list(t("这些情况约师傅"), c.pro, "care-pro")}
    ${list(t("马上处理"), c.urgent, "care-urgent")}
    ${c.cost ? `<p class="care-meta"><b>${t("费用")}</b>${esc(t(c.cost))}</p>` : ""}
    ${c.when ? `<p class="care-meta"><b>${t("什么时候")}</b>${esc(t(c.when))}</p>` : ""}
    ${ask ? askInline(ask) : ""}
  </details>`;
}
/** 设备页面包屑：来源 / 房产 / 设备名 / 当前块 —— 设备属于某套房产时带上房产（点它回到这套房产的设备保养）；车辆是全家的，没有房产这一段 */
/** 设备：房屋 / 房产 / 设备保养 / 设备名；车辆：房屋 / 车辆 / 车名（固定层级，不随“从哪个页面进来”变） */
export const assetBase = (a, veh) => {
  const pid = a?.property_id || state.propertyId, pn = pid ? propertyName(pid) : "";
  return veh ? houseCars()
    : [...houseProps(), ...(pn ? [{ href: `${href("house", "overview")}?prop=${pid}`, label: pn, icon: "🏠" }] : []), { href: `${href("house", "assets")}${pid ? `?prop=${pid}` : ""}`, label: t("设备保养") }];
};
export const assetTrail = (a, _root, hubHref) => [...assetBase(a, isVehicle(a)), { href: hubHref, label: assetName(a), icon: a.t?.icon || "⚙️" }];
export const assetCrumb = (a, root, hubHref, cur) => crumbNav([...assetTrail(a, root, hubHref), { label: cur }]);
export const ageText = (a) => (a.ageYears < 1 ? t("不到 1 年") : t("{n} 年", { n: Math.floor(a.ageYears) }));
/* ── 设备列表：搜索 + 类型 / 保养 / 保修 / 位置 筛选（只作用在下面的分组列表，上面的“要处理”提醒不受影响） ── */
const SERVICE_FILTERS = [["all", "全部保养状态"], ["attention", "需要处理"], ["recall", "产品召回"], ["overdue", "保养逾期"], ["due", "该保养了"], ["ok", "保养正常"], ["unknown", "未记录保养"], ["none", "没设保养周期"]];
const WARRANTY_FILTERS = [["all", "全部保修状态"], ["active", "保修中"], ["expiring", "保修快到期"], ["expired", "已过保"], ["none", "没填保修"]];
const ASSET_SORTS = [["alert", "提醒优先"], ["due", "下次保养：近 → 远"], ["name", "名称 A → Z"], ["age", "设备年龄：老 → 新"], ["life", "已用寿命：多 → 少"]];
const assetTypeLabel = (a) => (a.t ? t(a.t.name) : t(a.type || "其他"));
const matchAsset = (a, f) => {
  if (f.type !== "all" && a.type !== f.type) return false;
  if (f.loc !== "all" && a.location !== f.loc) return false;
  if (f.warranty !== "all" && a.warranty !== f.warranty) return false;
  if (f.service === "attention" ? !(a.recallSt || a.followUp || a.service === "overdue" || a.service === "due") : f.service === "recall" ? !a.recallSt : f.service !== "all" && a.service !== f.service) return false;
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
  // 四组：设备（一台一条）/ 小家电与季节电器（一台一条）/ 固定装置（一类一条，位置数量在里面）/ 工具
  const sub = (a) => (isFixture(a) ? "fixture" : isPortable(a) ? "portable" : "");
  const group = (kind, g = "") => rows.filter((a) => a.kind === kind && (kind !== "equipment" || sub(a) === g)).sort(sorter);
  const lim = pageLimit("assets", JSON.stringify([state.propertyId, f])); let left = lim;   // 分批显示：四组按顺序一共只画前 lim 台，组标题的台数仍按完整结果
  const section = (kind, g = "") => {
    const list = group(kind, g);
    if (!list.length || left <= 0) return "";
    const part = list.slice(0, left); left -= part.length;
    const k = g === "fixture" ? H().FIXTURE_GROUP : g === "portable" ? H().PORTABLE_GROUP : H().ASSET_KINDS[kind];
    return `<section class="section"><div class="section-head"><h2>${k.icon} ${t(k.name)}<span class="muted">（${list.length}）</span></h2>${k.hint ? `<p>${esc(t(k.hint))}</p>` : ""}</div>
      <div class="asset-grid">${part.map(assetCard).join("")}</div></section>`;
  };
  return { rows, html: rows.length ? section("equipment") + section("equipment", "portable") + section("equipment", "fixture") + section("tool") + pageMoreBtn("assets", rows.length, lim) : `<div class="panel empty"><strong>${t("没有符合条件的设备")}</strong>${t("换个关键词或筛选试试。")}</div>` };
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
    ${locs.length > 1 ? `<select id="assetLoc" aria-label="${t("按位置筛选")}">${opt("all", t("全部位置"), f.loc)}${locs.map((l) => opt(l, t(l), f.loc)).join("")}</select>` : ""}
    ${clearFiltersBtn("asset", changed(f, FD.asset))}</div>`;
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
      <p class="muted" style="margin:0 0 10px;font-size:12.5px">${t("设备 = 有保养周期或保修的，一台一条（热水器、割草机）；固定装置按类记一条（马桶、门、吊扇、插座），位置和数量写在里面；只记数量和位置的（梯子、床品、节日装饰）放在 储藏 → 家居耐用品；灯泡、电池是耗材，在 储藏 → 库存 → 汽车房屋消耗品。")}</p>
      <p class="muted" style="margin:0 0 10px;font-size:12.5px">🩺 ${t("东西坏了？")}<a href="${href("house", "fix")}">${t("描述毛病（可拍照），先看常见小毛病，再让咩咩分析原因、给方案，配件直接加采购")}</a></p>
      ${alerts.length ? `<div class="panel"><ul class="restock-list">${alerts.slice(0, 6).map((a) => { const b = alertBadge(a), act = alertAct(a); return dotRow({ cls: b.cls, nameHtml: `<a class="link-name" href="${href("asset", a.id)}">${esc(assetName(a))}</a>`,
          badge: b, detail: alertText(a), primary: { href: act.href, label: act.label }, ask: assetAsk(a) }); }).join("")}</ul></div>`
        : list.length ? `<p class="muted" style="margin:0;font-size:13px">${t("保养都在周期内，保修也没有快到期的。")}</p>` : ""}
    </section>
    ${list.length ? `<section class="section">${assetToolbar(list)}<div id="assetList">${html}</div></section>` : `<section class="section"><div class="panel empty"><strong>${t("还没有设备档案")}</strong>
      ${p ? t("按房屋资料一次生成炉子、热水器、排水泵、屋顶等设备，再补充品牌、型号和安装年份。") : t("先填写房屋资料，就能按设施一键生成设备清单。")}
      <p>${p ? `<a class="btn btn-primary" href="${href("house", "asset-template")}">${t("生成设备清单")}</a>` : `<a class="btn btn-primary" href="${href("house", "profile")}">${t("填写房屋资料")}</a>`}
         <a class="btn btn-ghost" href="${href("asset", "new")}">${t("手动添加一台")}</a></p></div></section>`}
    ${retiredSection(retiredAssets())}`;
}
/** 召回后已换新 / 退款的旧设备：折叠在列表底部，点开还能看档案和保养记录 */
function retiredSection(list) {
  if (!list.length) return "";
  const lim = pageLimit("retired", state.propertyId);   // 点过「继续加载」就保持展开（整页重画会把 details 收起）
  return `<section class="section"><details class="panel ref-panel"${lim > pageSize() ? " open" : ""}><summary><b>${t("已更换 / 已退货")}</b><small>${t("{n} 台，召回后换新或退款；档案和保养记录保留", { n: list.length })}</small><span class="mch" aria-hidden="true">›</span></summary>
    <ul class="restock-list hist-list ref-body">${list.slice(0, lim).map((a) => { const r = recallOf(a) || {}, n = r.replaced_by ? state.assets.find((x) => x.id === r.replaced_by) : null; return `<li>
      <span class="asset-ico" aria-hidden="true">${a.t?.icon || "⚙️"}</span>
      <div class="grow"><a class="link-name" href="${href("asset", a.id)}">${esc(assetName(a))}</a>
        <small>${[t(r.remedy === "refund" ? "已退款" : "已换新"), r.resolved_on ? fmtDate(r.resolved_on) : null, r.remedy === "refund" && r.refund_amount != null ? money(num(r.refund_amount)) : null,
          n ? t("换成：{name}", { name: assetName(n) }) : null, [a.brand, a.model].filter(Boolean).join(" ") || null].filter(Boolean).map(esc).join(" · ")}</small></div>
      <span class="hist-act"><a class="btn btn-sm btn-ghost" href="${href("asset", a.id)}">${t("详情")}</a></span></li>`; }).join("")}</ul>${pageMoreBtn("retired", list.length, lim)}</details></section>`;
}
